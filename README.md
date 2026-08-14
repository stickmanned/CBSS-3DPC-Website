# CBSS 3D Printing Club

Website and private print-request queue for the Dr. Charles Best Secondary
(SD43) 3D Printing Club.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Neon
Postgres · private Cloudflare R2 · Auth.js GitHub OAuth · Resend

## What is included

- `/request` — accessible request form with STL/3MF preview, direct private
  upload, 238 searchable filament choices, and PLA/PETG/ASA guidance.
- `/status/[ref]#token` — no-index requester status page; the bearer stays in a
  browser fragment and is exchanged for a narrow HttpOnly session cookie.
- `/admin` — GitHub-authenticated queue dashboard for allowlisted club admins.
- `/admin/requests/[id]` — request details, secure file download, status history,
  notes, and requester email workflow.
- `/api/uploads/*` — short-lived, signed R2 upload lifecycle. Files never pass
  through the Vercel request body.
- `/api/cron/maintenance` — daily reminders and retention cleanup, protected by
  `CRON_SECRET`.

The database stores the queue, immutable status events, admin allowlist, and
atomic rate-limit buckets. R2 objects stay private; upload completion verifies
the object before copying it from a temporary key to an immutable final key.
Requester status tokens and rate-limit identifiers are stored only as HMACs.

## Local setup

Requirements: Node.js 20+, npm, a Neon database, a private R2 bucket, and a
GitHub OAuth app. Resend and Turnstile can be left unconfigured for local UI
work, but both are launch requirements unless the advisor approves an
alternative.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run seed:admin -- --github-id 12345678 --login club-maintainer --name "Club Maintainer"
npm run dev
```

Fill `.env.local` before migrating or seeding. Never commit that file. The
GitHub OAuth callbacks are:

- Local: `http://localhost:3000/api/auth/callback/github`
- Production: `https://YOUR-DOMAIN/api/auth/callback/github`

Use the stable numeric GitHub account ID for the allowlist—not only the mutable
login. A signed-in account is checked against the database on every privileged
request.

## Commands

```bash
npm run dev          # local development
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run test         # unit/integration tests
npm run test:e2e     # browser tests
npm run build        # production build
npm run check        # full pre-deploy verification
npm run db:generate  # generate a migration after an intentional schema change
npm run db:migrate   # apply committed migrations
npm run db:studio    # inspect the database locally
npm run seed:admin   # add or update one allowlisted GitHub admin
```

## Provider setup

1. Create Neon Postgres in an SD43-approved AWS region and set `DATABASE_URL`.
2. Create a private R2 bucket, an API token scoped only to that bucket, and apply
   [the CORS template](docs/r2-cors.json) after replacing its production-origin
   placeholder. Add exact preview origins only when they are deliberately used;
   never use `*`. Give the application object-list/delete access and add a
   one-day lifecycle rule for the `uploads/temp/` prefix as described in the
   handoff.
3. Create a GitHub OAuth app, configure both callback URLs above, then seed each
   approved admin by numeric GitHub ID.
4. Verify a club-owned sending domain in Resend (SPF/DKIM), set the sender,
   reply-to, and notification addresses, and test delivery to a real
   `@sd43.bc.ca` mailbox.
5. Configure Turnstile for the production hostname and set both site and secret
   keys. Production refuses queue submissions if they are absent unless the
   advisor explicitly approves `TURNSTILE_DISABLED=true`.
6. Add all variables from `.env.example` to the deployment. Add
   `NEON_DATABASE_URL` separately as a GitHub Actions secret for backups.

See [HANDOFF.md](HANDOFF.md) for the exact deployment, backup, recovery,
rotation, privacy, and succession runbook.

## Design and content

The site uses the “Precision in Motion” direction: deep navy and ink, warm
white surfaces, signal yellow for actions, measured grids, and a layer-build
homepage interaction. Geist Sans carries display/body copy and Geist Mono
carries technical labels. Club facts and contact details live in
`app/lib/content.ts`; visual rules live in `.planning/design-config.md`.

Real student work belongs in `public/img/student-works/` with an entry in
`app/lib/content.ts`. Use `printedBy` unless the student also designed the model,
and never invent outcomes or authorship.

## Launch gates

Do not accept student requests until all of these are complete:

- change this currently public repository to private, audit repository/Actions
  readers, and verify the backup workflow's private-repository guard;
- advisor and SD43 privacy approval for minors' contact details and model files;
- club/advisor co-ownership and recovery access for every provider account;
- private R2 access, exact-origin CORS, upload/download smoke tests, and retention
  cleanup verification;
- real `@sd43.bc.ca` email delivery test plus documented fallback handling;
- a successful backup and restore drill;
- no payment, donation, fee, or commercial activity while using Vercel Hobby.
  Move to an eligible paid host before adding any money flow.
