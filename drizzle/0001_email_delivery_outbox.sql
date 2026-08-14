create type email_recipient_kind as enum ('requester', 'club');
create type email_delivery_state as enum (
  'pending',
  'sending',
  'sent',
  'failed',
  'uncertain',
  'obsolete'
);

create table email_delivery (
  id bigint generated always as identity primary key,
  event_id bigint not null references request_event (id) on delete cascade on update cascade,
  recipient_kind email_recipient_kind not null,
  state email_delivery_state not null default 'pending',
  provider_id text,
  attempt_count integer not null default 0,
  last_error_code text,
  claimed_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_delivery_attempt_count_nonnegative check (attempt_count >= 0),
  constraint email_delivery_error_code_format check (
    last_error_code is null or last_error_code ~ '^[a-z0-9_]+$'
  ),
  constraint email_delivery_sent_fields check (
    state <> 'sent' or (provider_id is not null and sent_at is not null)
  ),
  constraint email_delivery_sent_at_state check (sent_at is null or state = 'sent'),
  constraint email_delivery_attempt_fields check (
    state not in ('sending', 'failed', 'uncertain', 'sent')
    or (attempt_count > 0 and last_attempt_at is not null)
  ),
  constraint email_delivery_claimed_fields check (
    state <> 'sending' or claimed_at is not null
  )
);

create unique index email_delivery_event_recipient_uidx
  on email_delivery (event_id, recipient_kind);
create index email_delivery_claimable_created_at_idx
  on email_delivery (recipient_kind, created_at, id)
  where state in ('pending', 'failed');
create index email_delivery_review_updated_at_idx
  on email_delivery (updated_at, id)
  where state in ('sending', 'uncertain');

-- A pre-outbox `emailed = false` event may have reached one recipient before
-- its shared marker failed. Preserve that ambiguity instead of risking a
-- duplicate. Administrators reconcile these rows using the provider logs.
insert into email_delivery (
  event_id,
  recipient_kind,
  state,
  provider_id,
  attempt_count,
  last_error_code,
  last_attempt_at,
  sent_at,
  created_at,
  updated_at
)
select
  event.id,
  recipients.recipient_kind::email_recipient_kind,
  case when event.emailed then 'sent' else 'uncertain' end::email_delivery_state,
  case when event.emailed then 'legacy-confirmed-all-sent' else null end,
  1,
  case when event.emailed then null else 'legacy_delivery_ambiguous' end,
  event.created_at,
  case when event.emailed then event.created_at else null end,
  event.created_at,
  now()
from request_event event
cross join lateral (
  values ('requester')
) as recipients(recipient_kind)
where
  (event.to_status = 'submitted' and event.reason_key = 'submitted')
  or event.to_status in (
    'approved',
    'needs_changes',
    'declined',
    'printing',
    'ready_for_pickup',
    'print_failed'
  );

insert into email_delivery (
  event_id,
  recipient_kind,
  state,
  provider_id,
  attempt_count,
  last_error_code,
  last_attempt_at,
  sent_at,
  created_at,
  updated_at
)
select
  event.id,
  'club'::email_recipient_kind,
  case when event.emailed then 'sent' else 'uncertain' end::email_delivery_state,
  case when event.emailed then 'legacy-confirmed-all-sent' else null end,
  1,
  case when event.emailed then null else 'legacy_delivery_ambiguous' end,
  event.created_at,
  case when event.emailed then event.created_at else null end,
  event.created_at,
  now()
from request_event event
where event.to_status = 'submitted' and event.reason_key = 'submitted';
