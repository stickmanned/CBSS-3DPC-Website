# CBSS Print Queue operations handoff

This is the maintainer runbook for the production queue. It covers accounts,
deployment, recovery, privacy, and the tasks that must survive student turnover.
Application behaviour and design rules are documented in `README.md` and
`.planning/design-config.md`.

## 1. Ownership and succession

Use a club-controlled GitHub organization and a club-owned functional email
address. Do not leave the repository or any provider under one graduating
student's personal account.

- The faculty advisor must be a co-owner of GitHub, Vercel, Neon, Cloudflare,
  Resend, and Turnstile, with a second approved adult recovery contact where the
  provider supports one.
- Put billing, recovery, security alerts, and domain notices in the club mailbox.
  The advisor controls its recovery methods. Require MFA and store recovery codes
  in the school's approved password vault, not in the repository or club chat.
- Give student maintainers the least privilege needed. Review members and the
  `admin_user` allowlist at the start and end of every school year; deactivate
  people promptly when they leave.
- Keep the repository private because GitHub Actions backup artifacts inherit
  repository access. Restrict Actions administration and artifact downloads to
  current maintainers and the advisor.
- **Current launch blocker:** this repository was verified as public during the
  August 2026 implementation review. The backup job has a fail-closed
  `github.event.repository.private` guard, so it will not create a database dump
  while the repository is public. Before launch, an owner must change visibility
  to private, audit every person/team with read access, verify the guard in an
  Actions run, and only then rely on the scheduled backup. Never remove the guard.
- Record account owners, renewal dates, domain registrar access, and the current
  incident contact in the advisor's private operations record.

Vercel Hobby is acceptable only while the site has **no payment, donation,
fee, sponsorship transaction, or other commercial use**. Before adding any
money flow, move to a plan/host whose terms permit it and have the advisor review
the change. Review the current terms rather than relying on this summary.

## 2. Provider setup

### Neon Postgres

Create the project in an AWS-backed Neon region approved by SD43. Prefer the
closest approved Canadian region if Neon offers one. If the selected region
stores student data outside Canada, obtain district privacy approval before
launch and record the approved region in the private operations record. Enable
Neon's available account protections and use a pooled, TLS-required connection
string for the application. A direct connection string can be used temporarily
for migration or restore tooling when Neon recommends it.

### GitHub OAuth and admin access

Create a GitHub OAuth app owned by the club organization. Configure:

- Homepage: the canonical production origin.
- Production callback: `https://YOUR-DOMAIN/api/auth/callback/github`.
- Local development callback: `http://localhost:3000/api/auth/callback/github`
  in a separate development OAuth app when needed.

Set `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and an independent 32-byte-or-longer
`AUTH_SECRET`. Set `AUTH_TRUST_HOST=true` only on a trusted deployment host. The
database allowlist uses GitHub's stable numeric account ID; a login can be
renamed and is not sufficient identity. A user can retrieve their own ID with
`gh api user --jq .id`. Confirm the ID belongs to the intended person through an
advisor-approved channel before seeding it.

### Cloudflare R2

Create a private bucket with no public/custom domain. Create an S3-compatible API
token limited to object read/write on that bucket. Set the R2 account, endpoint,
bucket, access key, and secret from `.env.example`.

Replace the placeholder in `docs/r2-cors.json` with the exact canonical HTTPS
origin and apply the policy to the bucket. Keep local `http://localhost:3000`
only if local direct-upload testing is needed. Add a specific Vercel preview
origin only for a deliberate test and remove it afterward. Never use wildcard
origins or headers. The required upload headers are `Content-Type`,
`Cache-Control`, `x-amz-meta-upload-nonce`, `x-amz-meta-declared-size`, and
`x-amz-meta-file-format`; expose only `ETag`.

The browser uploads STL/3MF files directly to a ten-minute presigned temporary
R2 URL because Vercel request bodies cannot safely carry a 50 MB model. The
server checks object size, type, metadata, and file structure, then copies it to
a new server-chosen immutable final key and deletes the temporary object. That
copy step matters: a presigned PUT can otherwise be replayed until expiry to
replace an already-accepted file. Downloads remain private, admin-authorized,
short-lived signed GETs.

The daily maintenance worker also removes temporary uploads and verified final
objects that are more than 24 hours old and were never attached to a database
request. As defense in depth, add an R2 lifecycle rule that deletes the
`uploads/temp/` prefix after one day; do not apply that rule to `uploads/final/`,
whose deletion is tied to the request's pickup event. Confirm the API token can
list and delete objects as well as read/write them, then test both abandoned-file
cleanup paths before launch.

Because exact byte-length signing relies on R2 honoring the browser-supplied
`Content-Length`, the launch smoke test must upload a valid file in current
Chrome, Safari, and Firefox, then confirm a PUT whose body length differs from
the signed length is rejected. Keep the completion-time `HeadObject` size/type
check even after that provider test passes.

### Resend and Turnstile

Use a club-owned sending domain and complete Resend SPF and DKIM verification.
Set `QUEUE_EMAIL_FROM` to the verified sender, `QUEUE_EMAIL_REPLY_TO` to the club
mailbox, and `QUEUE_NOTIFICATION_EMAIL` to the monitored queue inbox. Before
launch, send each message type to a real `@sd43.bc.ca` account and verify inbox
placement, links, replies, and district filtering. Obtain advisor/district
approval for the external email processor and document a manual contact fallback.
The queue must still show the private status link after a delivery failure.

Every intended message has its own `email_delivery` outbox row. Submitted creates
separate requester and club rows, so a broken club inbox cannot resend the
requester confirmation. Only `pending` and definitively `failed` rows are
automatic retry candidates. `sending` and `uncertain` mean the provider outcome
is ambiguous and require a human decision; `obsolete` means a newer request state
superseded the message and must never be described as sent. The initial requester
Submitted confirmation is the ordering anchor because it contains the first
private status link: later requester messages wait until it is confirmed sent or
reconciled.

To reconcile a `sending` or `uncertain` row:

1. Open the request event in the admin audit trail and record only the delivery
   ID, event ID, recipient kind, attempt time, and provider ID. Do not copy the
   destination address or message body into tickets or chat.
2. Check Resend for the provider ID. If none was recorded, check the event-scoped
   idempotency key `queue-event-EVENT_ID-requester` or
   `queue-event-EVENT_ID-club` and the attempt time. Resend's idempotency window
   is not a permanent deduplication guarantee; age alone never proves that a
   message was not accepted.
3. If Resend confirms acceptance, update the delivery to `sent`, preserve the
   real provider ID, set `sent_at`, clear `last_error_code`, and recompute the
   event's compatibility `emailed` marker as true only when every delivery for
   that event is `sent`.
4. If Resend definitively confirms it never accepted the message, update the row
   to `failed`, clear any incorrect provider ID, and set
   `last_error_code='manual_confirmed_not_sent'`. The next maintenance run can
   claim it safely.
5. If the evidence is inconclusive, leave the row `uncertain`. Never change an
   ambiguous row to `pending` or `failed` merely to make the queue move. Contact
   the requester manually through the advisor-approved channel if needed, then
   record the verified outcome.

The migration deliberately marks legacy unconfirmed event markers as
`uncertain`; the old shared boolean cannot prove which recipient received a
partially completed Submitted fan-out.

Create a Turnstile widget restricted to the production hostname. Set both
public and secret keys plus the expected hostname/action values. The honeypot,
minimum-fill time, and database rate limits remain active even with Turnstile.
The widget action is exactly `print-request`; set
`TURNSTILE_EXPECTED_ACTION=print-request`. The application fails closed when
only one of the public/secret Turnstile keys is present. Production also fails
closed when both are absent. Only set `TURNSTILE_DISABLED=true` after the
advisor explicitly approves and records a no-Turnstile abuse/privacy waiver;
keep the database rate limits and review submission volume more frequently.

## 3. First deployment and routine releases

Use Node.js 20 or newer. From a clean checkout:

```bash
npm ci
cp .env.example .env.local
# Fill .env.local with development/provider values.
npm run db:migrate
npm run seed:admin -- --github-id 12345678 --login club-maintainer --name "Club Maintainer"
npm run check
```

Then configure the same runtime values in Vercel, including a random
`CRON_SECRET`, and deploy from the protected production branch. `vercel.json`
runs `/api/cron/maintenance` once daily at 16:00 UTC (08:00 PST / 09:00 PDT;
Vercel Hobby may execute within the permitted daily window). Vercel sends its
cron authorization value from `CRON_SECRET`; never put that value in a URL.

For each release:

1. Review the migration SQL. Back up production before a schema change.
2. Apply committed migrations once with `npm run db:migrate` using the production
   `DATABASE_URL`. Do not use schema push against production.
3. Run `npm run check` and deploy the tested commit.
4. Smoke-test request submission, the returned private status URL, admin login,
   a permitted status transition, email delivery, and a signed file download.
5. Check provider logs for errors without copying requester names, emails,
   tokens, URLs, or model keys into tickets/chat.

The seed command is idempotent for one numeric GitHub ID: it adds or updates the
login/display name and reactivates that entry. It refuses unknown/missing
arguments and refuses to move a login already assigned to another ID. Removing
or deactivating an admin is an intentional database operation and is never done
by the seed command.

## 4. Secrets and key rotation

Use different random values for `AUTH_SECRET`, `REQUESTER_TOKEN_SECRET`,
`UPLOAD_TOKEN_SECRET`, `RATE_LIMIT_HMAC_SECRET`, and `CRON_SECRET`. Keep all
provider credentials server-only. `NEXT_PUBLIC_*` values are public by design.

Rotate immediately after suspected exposure, maintainer turnover, or provider
warning; otherwise review at least annually. Rotate R2/Resend/GitHub credentials
by creating a new key, updating every active environment, deploying and testing,
then revoking the old key. Rotate `UPLOAD_TOKEN_SECRET` after allowing current
short-lived uploads to finish. Rotating `REQUESTER_TOKEN_SECRET` invalidates all
existing requester status links; plan a supported reissue/migration before doing
so. Rotating `RATE_LIMIT_HMAC_SECRET` resets bucket identity and should be timed
for a quiet period. Rotating `AUTH_SECRET` signs out all admins. Record the date
and operator, never the secret value.

## 5. Backups and restoration

`.github/workflows/backup.yml` runs weekly and on manual dispatch. It uses the
repository secret `NEON_DATABASE_URL`, creates a PostgreSQL 18 custom-format
`pg_dump` without ownership/privilege statements, creates a SHA-256 checksum,
and uploads both as a private GitHub artifact for 14 days. Secrets are passed by
environment and must never be echoed. Keep the repository private and monitor
workflow failures. Keep the dump client at the same or a newer major version
than the Neon server during the annual review. R2 model files are intentionally
not part of the database dump; their lifecycle is governed by retention below.

Run and record a restore drill at least once per term:

1. Manually run **Neon database backup** and download its artifact.
2. Verify it with `sha256sum --check cbss-print-queue.dump.sha256` (use
   `shasum -a 256 -c` on macOS if needed).
3. Create an isolated temporary Neon branch/database—never use production for a
   drill—and set `RESTORE_DATABASE_URL` locally.
4. Restore with:

   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists \
     --dbname="$RESTORE_DATABASE_URL" cbss-print-queue.dump
   ```

5. Point a local app at the restored database, confirm request/event/file/admin
   counts and sample status histories, then delete the temporary branch.

Do not upload dumps to chat, email, shared drives, or public artifacts: they
contain minors' contact details.

## 6. Retention, privacy, and scheduled care

The daily maintenance route sends the uncollected reminder after 14 days in
ready-for-pickup status and deletes the private R2 model 90 days after the
request is marked picked up. It records the purge so retries are idempotent.
It also deletes expired temporary uploads and verified final uploads that never
became requests after a 24-hour grace period. Email processing claims each
recipient independently, sends the Submitted requester confirmation before any
later requester update, closes superseded pending updates as `obsolete`, and
leaves ambiguous provider outcomes for the reconciliation procedure above.
Review maintenance execution regularly. If a deletion fails, correct the
provider/configuration issue and rerun the job; do not mark a file purged unless
R2 deletion succeeded. Requests not yet picked up are not automatically purged.

Collect only what the form requires. Never put requester names, email addresses,
private status URLs/tokens, IP-derived identifiers, filenames, storage keys, or
model contents into application logs, analytics, issue trackers, screenshots,
or chat. Status links are bearer secrets: send them only to the requester and
use generic not-found responses. The bearer belongs after `#` in the private
URL; the browser exchanges it for a short-lived, route-scoped HttpOnly cookie so
hosting access logs see only `/status/CBSS-####`. Never change this to a path or
query parameter. Handle access/deletion requests through the advisor and
district process.

Every August, before students return:

- review Vercel, Neon, Cloudflare R2, Resend, Turnstile, and GitHub Actions free
  tiers, limits, retention, privacy terms, and non-commercial eligibility;
- test OAuth, R2 CORS/upload/download, all email types, cron authorization,
  database backup/restore, and 90-day deletion;
- rotate departing maintainers, verify adult recovery access, review the admin
  allowlist, and confirm the club mailbox/domain still work;
- verify build-plate dimensions, filament availability, pickup copy, and advisor
  contact details shown by the site.

## 7. Incident basics

1. Stop the affected capability without destroying evidence: disable queue
   intake or revoke a compromised provider key. Do not delete database rows or
   objects merely to hide an incident.
2. Notify the faculty advisor and follow SD43's privacy/security reporting
   process. The advisor decides whether district IT, affected students, or
   providers must be contacted.
3. Preserve timestamps, request reference numbers, deployment IDs, and provider
   event IDs only. Keep PII and bearer tokens out of normal logs and tickets;
   share sensitive evidence solely through an approved restricted channel.
4. Rotate the affected credential, redeploy, test the smallest safe path, and
   review for unauthorized admins, exports, downloads, or configuration changes.
5. Write a short no-PII incident record with cause, scope, decisions, fixes, and
   follow-up owner. Restore service only after the advisor approves it.

If continuity or safety is uncertain, keep intake closed. The public club site
can remain available while queue routes are unavailable.
