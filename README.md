# CBSS 3D Printing Club

The official website and private print-request queue for the 3D Printing Club at Dr.
Charles Best Secondary School.

**https://3dprintingclub.org**

Students or anyone who would like a print picks a material and colour, upload an STL or 3MF (or model link), preview it in the
browser, and submit the print request. Club admins work the queue from a dashboard. 

## Screenshots

![The CBSS 3D Printing Club homepage](docs/screenshots/home.png)

**Upload a model and see it before you send it.** The file is parsed and rendered
in the browser. Nothing is uploaded until you actually submit the request.

![The request form with an STL loaded in the 3D preview](docs/screenshots/model-preview.png)

**238 filament colours, searchable, in print order.** Pick up to four, or leave it
empty and let the club choose.

![The filament colour picker](docs/screenshots/filament-picker.png)

![The print request form](docs/screenshots/request-form.png)

![ The admin queue dashboard ](docs/screenshots/admin-queue.png)

![A requester status page](docs/screenshots/status.png)



## Why I built this
After the first year leading my school's (Dr Charles Best Secondary School's) 3D Printing Club, I realized that the club was falling off due to multiple factors, mainly to do with organization, print requests, and management. 3D printing is still relatively niche even in 2026 and most students don't know what it is, which results in less signups/interest compared to similar engineering clubs at my school; as a result, I decided to create this website to make the club more accessible for students who are interested in the club or want to know more about 3D printing at my school. 

People kept asking me "can you print this?" "I saw this cool thing on tiktok! can you make one for me?" "My headphones broke, can you print a new one?" "can you print a phone stand for me?" etc. This was refreshing at first, since it meant that people were interested in 3D printing; however, as time went on, I realized that it was a bit too much to remember so many requests. That's why I integrated the "Print Request System" to the website so students can easily submit their wildest print ideas without asking and other club leaders.

You may be thinking to yourselves: "Why not a spreadsheet rather than a complicated backend?" I thought of that as well, and I came to the conclusion that spreadsheets are versitile for fundraisers and tracking club earnings, but a dedicated print requesting system feels more robust and easier to use for both admins and students.

## The website
When you first load in, you are welcomed to a very personal greeting page, featuring various 3D printed examples and stickers like a collage. There is an alternating adjective which changes every 2 seconds to make the site feel a bit more unique and like it's talking to you. 

Once you scroll down, you find yourselves with all the necessary information about the club, such as student creations, meeting dates, how to join the Teams channel (our school uses Teams), and the print request page.

We also have a header with separate pages for:
- Gallary - A page to showcase various 3D prints and models created by club members.
- Learn - A page to provide educational resources on 3D printing for beginners.
- About - A page to provide general information about the club, along with club contacts.
- Join the Club - A page with information on how to join the club.
- Request a Print - A page to submit print requests (the standing feature of the website).

## The Print Request/Queue system

**For students**

- Fill in one form: what you need, quantity, what material and colour, and
  anything the club should know.
- Attach a model by uploading an STL or 3MF, linking one, or both. The file is
  checked in your browser first and only uploads when you send the request.
- See the model rendered in the browser before you send it, so you catch the
  wrong file before an admin does. For multicolor prints, you can change the colors directly on the site with your selected colors without entering the Slicer.
- Choose from 238 searchable filament colours, with guidance on when PLA, PETG,
  or ASA is the right call. Note: we do not actually have 238 filament colors; I created a list of the most common filament colors for all 3 materials and added them to the site so that students can get an idea of what colors we have. If we don't have the color that the students are asking for, we will order it.
- Get a private status link back. No account, no password. Check progress
  whenever you want.

**For club admins**

- Sign in with GitHub authentication. Only allowlisted accounts get in.
- Work the queue: accept, decline, print, mark complete, leave internal notes. 
- Download the model file through a short-lived signed link.
- Email the requester from the request page if anything else is needed. There are premade email templates for the submission process and also if anything happens to the print.
- Read the full status history. Events are append-only, so nothing gets quietly
  rewritten.

| Route | What it is |
| --- | --- |
| `/` `/about` `/gallery` `/guides` | Public club site |
| `/request` | The request form, 3D preview, filament picker |
| `/status/[ref]#token` | Requester status page, no-index, token in the fragment |
| `/admin` | Queue dashboard, GitHub auth, allowlisted |
| `/admin/requests/[id]` | One request: files, history, notes, email |
| `/api/uploads/*` | Signed direct-to-R2 upload lifecycle |
| `/api/cron/maintenance` | Daily reminders and retention cleanup |

## Tech stack

| What | Why |
| --- | --- |
| Next.js (App Router), React, TypeScript | Server components keep the queue logic on the server, where the secrets are |
| Tailwind CSS | Styling |
| Neon Postgres + Drizzle ORM | Queue, immutable status events, admin allowlist, atomic rate-limit buckets |
| Cloudflare R2, private, via the S3 SDK | Model files. Browsers upload straight to R2 with presigned URLs, so files never pass through a Vercel request body and never hit its size limit |
| Auth.js v5, GitHub OAuth | Admin sign-in. |
| three.js + saxes | In-browser STL and 3MF preview. 3MF is a zipped XML format, so it needs a real parser |
| Resend | Requester and admin email |
| Cloudflare Turnstile | Bot filtering on the public form |
| Zod | Every input boundary |
| Vitest (26 unit tests) + Playwright | Unit and browser tests |
| Vercel + GitHub Actions | Hosting, cron, and scheduled database backups |

## How I built it, and what broke
I first started the website as a simple HTML/CSS site; however, I realized quickly that it would be better to use React/Next.js for the website as I wanted more interactiveness and make the website an impactful impression on anyone who visited it.

The most time consuming and complex part of building this website was definitely the web design for the frontend and the print request system for the backend.

I first vibe-coded a simple design using AI, but the design was far worse than the one I first created manually. Because I don't want my site to look vibe-coded and low effort, I decided to design myself and ended up watching a couple of web design videos and read some articles on web design as well. I then made a mistake of looking at minimalist startup websites for inspiration on the design and I ended up implementing a similar design/vibe on the website. The startup/minimalist design did not fit the vibe I was going for, which is a handmade/personal/cozy vibe. I then had to think of a way to make it feel more personal and add that sense of "elegance". I looked for more inspiration online but all the "club websites" were either static or vibe coded slop. It was then when I realized that the perfect style/design to give me all the vibes I was looking for was right in front of me all along: the Hack Club website. It had all the elements that made the website feel more cozy and personal, yet still professional enough for people to sign up; it was the perfect design to base my website off of. I then spent more hours remaking the design based on the Hack Club website while paying attention to all the small details that makes that website feel "handmade" and truly special. The new design checked all my boxes and turned out to be the design I was looking for this entire time. 

The backend for the print request system was also a challenge. I wanted to create a system that was that was both easy for admins and students to use. The main problem that occured was the file not uploading to cloudflare's storage on the actual website (3dprintingclub.org). This was due to the fact that I forgot to update the domain name which lead to incompatibility and errors in the uploading process, along with the system not being able to recognize slicer exported 3mfs which contains the print settings already. 

## Privacy and security decisions

The system holds contact details for minors and their model files, which lead to increase in security:

- **Model files are private.** The R2 bucket has no public access. Downloads go
  through short-lived signed URLs generated per request.
- **Status tokens live in the URL fragment.** The bearer after `#` is never sent
  in a request line, so it stays out of server logs. The page exchanges it for a
  narrow HttpOnly session cookie scoped to that one request.
- **Tokens and rate-limit identifiers are stored as HMACs**, never in the clear.
- **Admin access is re-checked on every privileged request** against the database,
  not just at sign-in, so removing an admin takes effect immediately.
- **Uploads are verified before they are kept.** A completed upload is checked
  against the object in R2, then copied from a temporary key to an immutable final
  key. Temporary keys expire on a lifecycle rule.
- **Status pages are noindex.**
- **No payment, donation, or fee handling.** Deliberately out of scope for the website. Students will simply pay in cash/e transfer when needed.
## Running it locally

You need Node.js 20 or newer and npm.

### start here:

```bash
git clone https://github.com/stickmanned/CBSS-3DPC-Website.git
cd CBSS-3DPC-Website
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

With an empty `.env.local` you get the homepage, about, gallery, guides, and the
full request form including the 3D model preview.

What will not work, and why:

| Won't work | Needs |
| --- | --- |
| Actually submitting a request | `DATABASE_URL` and an R2 bucket |
| Admin sign-in at `/admin` | A GitHub OAuth app |
| Status pages | `DATABASE_URL` |
| Emails | A Resend key and a verified domain |


### Full setup

All five providers have free tiers. Takes some time to set up.

1. **Neon Postgres.** Create a database ([neon.tech](https://neon.tech)), set `DATABASE_URL` with `sslmode=require`, then run
   `npm run db:migrate`.
2. **Cloudflare R2.** Create a private bucket
   ([R2 docs](https://developers.cloudflare.com/r2/)) and an API token scoped to
   only that bucket. Apply [the CORS template](docs/r2-cors.json) after replacing
   its production-origin placeholder. Add exact preview origins only if you
   actually use them, never `*`. Give the app object list and delete access, and
   add a one-day lifecycle rule on the `uploads/temp/` prefix.
3. **GitHub OAuth app.**
   ([Create one](https://github.com/settings/developers).) Callback URLs:
   - Local: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://YOUR-DOMAIN/api/auth/callback/github`

   Then seed yourself as an admin using your numeric GitHub account ID:

   ```bash
   npm run seed:admin -- --github-id 12345678 --login your-login --name "Your Name"
   ```
4. **Resend.** Verify a club-owned sending domain with SPF and DKIM
   ([resend.com](https://resend.com)), set the sender, reply-to, and notification
   addresses.
5. **Cloudflare Turnstile.**
   ([Docs](https://developers.cloudflare.com/turnstile/).) Set both keys and list
   every hostname the form is served from under the widget's Hostname Management.

Every variable is documented inline in [`.env.example`](.env.example). Fill it
before migrating or seeding, and never commit `.env.local` unless you want your private data to be leaked!

### Commands

```bash
npm run dev          # local development
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run test         # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright)
npm run build        # production build
npm run check        # lint + typecheck + test + build
npm run db:generate  # generate a migration after a schema change
npm run db:migrate   # apply committed migrations
npm run db:studio    # inspect the database locally
npm run seed:admin   # add or update one allowlisted GitHub admin
```

### Where things live

```
app/
  request/          the public request form
  status/[ref]/     requester status page
  admin/            queue dashboard and request detail
  api/uploads/      signed direct-to-R2 upload lifecycle
  api/cron/         daily reminders and retention cleanup
  lib/
    queue/          state machine, schemas, transitions
    storage/        R2 upload lifecycle, downloads, retention sweep
    security/       HMAC tokens, rate limiting, Turnstile
    email/          templates and outbox
    db/             Drizzle schema and lazy client
    content.ts      club facts, contact details, gallery entries
tests/unit/         26 Vitest suites
tests/e2e/          Playwright
drizzle/            committed migrations
```

Club facts, contact details, and gallery entries are all in
[`app/lib/content.ts`](app/lib/content.ts). Student work goes in
`public/img/student-works/` with an entry there. Use `printedBy` unless the
student also designed the model.

## AI disclosure
AI was used as a tool in this project rather than a replacement for everything. I used AI mainly to help with the interactive animations on the website and the backend logic for the print request system. AI was also a big help in debugging and testing as I used it to help me with errors I encountered and help me test if everything was working as intended so the site is ready for shipping.

## Credits
Thanks to Hack Club for the amazing website that inspired this design.
Special thanks to Mr. Anania, our amazing club sponsor teacher. Without you, this club would not exist.
Huge thanks to co leader Paya Maroufi for helping out with club affairs and testing the website.
## License
MIT License
