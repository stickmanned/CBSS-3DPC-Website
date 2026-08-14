create type material_kind as enum ('pla', 'petg', 'asa');
create type request_status as enum (
  'submitted',
  'under_review',
  'approved',
  'needs_changes',
  'declined',
  'queued',
  'printing',
  'ready_for_pickup',
  'print_failed',
  'picked_up'
);

create sequence print_request_ref_seq
  as integer
  increment by 1
  minvalue 1
  maxvalue 9999
  start with 1
  no cycle;

create table admin_user (
  id uuid primary key default gen_random_uuid(),
  github_id text not null,
  github_login text not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_user_github_id_not_blank check (length(btrim(github_id)) > 0),
  constraint admin_user_github_login_not_blank check (length(btrim(github_login)) > 0)
);

create unique index admin_user_github_id_uidx on admin_user (github_id);
create unique index admin_user_github_login_lower_uidx on admin_user (lower(github_login));

create table print_request (
  id uuid primary key default gen_random_uuid(),
  ref text not null default ('CBSS-' || lpad(nextval('print_request_ref_seq')::text, 4, '0')),
  requester_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requester_name text not null,
  requester_email text not null,
  quantity smallint not null,
  deadline date,
  purpose text not null,
  material material_kind not null,
  colors text[] not null default '{}',
  model_url text,
  current_status request_status not null default 'submitted',
  admin_notes text,
  assignee_id uuid references admin_user (id) on delete set null on update cascade,
  version integer not null default 0,
  idempotency_key text not null,
  submitter_ip_hmac text not null,
  constraint print_request_ref_format check (ref ~ '^CBSS-[0-9]{4}$'),
  constraint print_request_requester_token_hash_format check (requester_token_hash ~ '^[0-9a-f]{64}$'),
  constraint print_request_requester_name_length check (length(requester_name) between 1 and 120),
  constraint print_request_requester_email_normalized check (
    requester_email = lower(requester_email) and length(requester_email) between 3 and 320
  ),
  constraint print_request_quantity_range check (quantity between 1 and 50),
  constraint print_request_deadline_not_before_submission check (
    deadline is null or deadline >= (created_at at time zone 'America/Vancouver')::date
  ),
  constraint print_request_purpose_length check (length(purpose) between 1 and 4000),
  constraint print_request_colors_count check (cardinality(colors) between 0 and 4),
  constraint print_request_colors_not_blank check (
    array_position(colors, '') is null and array_position(colors, null) is null
  ),
  constraint print_request_model_url_https check (model_url is null or model_url ~ '^https://'),
  constraint print_request_version_nonnegative check (version >= 0),
  constraint print_request_idempotency_key_length check (length(idempotency_key) between 8 and 200),
  constraint print_request_submitter_ip_hmac_format check (submitter_ip_hmac ~ '^[0-9a-f]{64}$')
);

create unique index print_request_ref_uidx on print_request (ref);
create unique index print_request_requester_token_hash_uidx on print_request (requester_token_hash);
create unique index print_request_idempotency_key_uidx on print_request (idempotency_key);
create index print_request_status_created_at_idx on print_request (current_status, created_at desc);
create index print_request_created_at_idx on print_request (created_at desc);
create index print_request_requester_email_idx on print_request (requester_email);
create index print_request_assignee_id_idx on print_request (assignee_id);
create index print_request_assignee_status_created_at_idx
  on print_request (assignee_id, current_status, created_at desc);

create table request_file (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references print_request (id) on delete cascade on update cascade,
  storage_key text not null,
  original_name text not null,
  verified_byte_size bigint not null,
  file_kind text not null,
  thumbnail_data_uri text,
  bbox_mm numeric(10, 3)[],
  etag text not null,
  uploaded_at timestamptz not null default now(),
  purged_at timestamptz,
  constraint request_file_storage_key_not_blank check (length(btrim(storage_key)) > 0),
  constraint request_file_original_name_length check (length(original_name) between 1 and 255),
  constraint request_file_verified_byte_size_positive check (verified_byte_size > 0),
  constraint request_file_kind_allowed check (file_kind in ('stl', '3mf')),
  constraint request_file_thumbnail_data_uri check (
    thumbnail_data_uri is null or (
      thumbnail_data_uri ~ '^data:image/(png|jpeg|webp);base64,'
      and octet_length(thumbnail_data_uri) <= 524288
    )
  ),
  constraint request_file_bbox_mm_valid check (
    bbox_mm is null or (
      cardinality(bbox_mm) = 3
      and bbox_mm[1] > 0 and bbox_mm[1] <= 1000000
      and bbox_mm[2] > 0 and bbox_mm[2] <= 1000000
      and bbox_mm[3] > 0 and bbox_mm[3] <= 1000000
    )
  ),
  constraint request_file_etag_not_blank check (length(btrim(etag)) > 0),
  constraint request_file_purge_after_upload check (purged_at is null or purged_at >= uploaded_at)
);

create unique index request_file_request_id_uidx on request_file (request_id);
create unique index request_file_storage_key_uidx on request_file (storage_key);
create index request_file_purged_at_idx on request_file (purged_at);

create or replace function reject_request_file_storage_key_change()
returns trigger
language plpgsql
as $$
begin
  if new.storage_key is distinct from old.storage_key then
    raise exception 'request_file.storage_key is immutable';
  end if;
  return new;
end;
$$;

create trigger request_file_storage_key_immutable
before update of storage_key on request_file
for each row execute function reject_request_file_storage_key_change();

create table request_event (
  id bigint generated always as identity primary key,
  request_id uuid not null references print_request (id) on delete cascade on update cascade,
  from_status request_status,
  to_status request_status not null,
  reason_key text,
  requester_visible_note text,
  emailed boolean not null default false,
  actor text not null,
  created_at timestamptz not null default now(),
  constraint request_event_status_changed check (from_status is null or from_status <> to_status),
  constraint request_event_actor_not_blank check (length(btrim(actor)) > 0),
  constraint request_event_reason_key_format check (reason_key is null or reason_key ~ '^[a-z0-9_]+$'),
  constraint request_event_system_reason_guard check (
    reason_key not in ('uncollected_14d', 'file_purged_90d')
    or (
      actor = 'system'
      and (
        (reason_key = 'uncollected_14d' and to_status = 'ready_for_pickup')
        or (reason_key = 'file_purged_90d' and to_status = 'picked_up')
      )
    )
  )
);

create index request_event_request_id_created_at_idx on request_event (request_id, created_at desc);
create index request_event_to_status_created_at_idx on request_event (to_status, created_at desc);
create index request_event_unemailed_created_at_idx on request_event (created_at) where emailed = false;
create unique index request_event_singleton_system_reason_uidx
  on request_event (request_id, reason_key)
  where reason_key in ('uncollected_14d', 'file_purged_90d');

create table rate_limit_bucket (
  scope text not null,
  key_hmac text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint rate_limit_bucket_pk primary key (scope, key_hmac, window_start),
  constraint rate_limit_bucket_scope_not_blank check (length(btrim(scope)) > 0),
  constraint rate_limit_bucket_key_hmac_format check (key_hmac ~ '^[0-9a-f]{64}$'),
  constraint rate_limit_bucket_request_count_positive check (request_count > 0),
  constraint rate_limit_bucket_expiry_valid check (expires_at > window_start)
);

create index rate_limit_bucket_expires_at_idx on rate_limit_bucket (expires_at);

create or replace function legal_request_status_transition(
  from_status request_status,
  to_status request_status
)
returns boolean
language sql
immutable
strict
as $$
  select case from_status
    when 'submitted' then to_status in ('under_review', 'declined')
    when 'under_review' then to_status in ('approved', 'needs_changes', 'declined')
    when 'approved' then to_status in ('queued', 'needs_changes', 'declined')
    when 'needs_changes' then to_status in ('under_review', 'declined')
    when 'queued' then to_status in ('printing', 'declined')
    when 'printing' then to_status in ('ready_for_pickup', 'print_failed')
    when 'print_failed' then to_status in ('queued', 'declined')
    when 'ready_for_pickup' then to_status = 'picked_up'
    when 'declined' then false
    when 'picked_up' then false
  end;
$$;

create or replace function enforce_request_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.current_status is distinct from old.current_status
     and not legal_request_status_transition(old.current_status, new.current_status) then
    raise exception 'illegal request status transition: % -> %', old.current_status, new.current_status;
  end if;
  return new;
end;
$$;

create trigger print_request_legal_status_transition
before update of current_status on print_request
for each row execute function enforce_request_status_transition();
