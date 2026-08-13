# CBSS 3D Printing Club

Website for the Dr. Charles Best Secondary (SD43) 3D Printing Club.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal.

## Project map

```text
app/
  lib/content.ts        club details, contacts, gallery, and learning links
  globals.css           design tokens and the layer-build visual system
  components/           shared navigation, footer, buttons, form, and hero stage
  page.tsx              homepage
  about/page.tsx        club overview and joining information
  request/page.tsx      email-based print request flow
  gallery/page.tsx      student work
  guides/page.tsx       3D-design learning path
public/img/
  logo.png              club mark used by the site
  logo-source.png       original source render
  student-works/        real project photography
.planning/
  design-config.md      visual direction, content rules, and acceptance checks
docs/
  design-research.md    source-linked design research behind the redesign
legacy/index.html       previous single-file site, retained for reference
```

The changing club facts live in `app/lib/content.ts`: meeting details, contact
addresses, navigation, student work, and learning links. Update that file first
when information changes.

## Add student work

1. Put the image in `public/img/student-works/`.
2. Add an entry to `gallery` in `app/lib/content.ts`.
3. Use `printedBy` unless the student also designed the model.
4. Describe one specific detail from the process. Do not invent outcomes or
   authorship.

## Request flow

The request form currently composes an email to the student club contact. It
does not upload a file or write to a database. The requester attaches their 3D
model in the email draft before sending it.

## Design system

The site uses a “Precision in Motion” direction based on additive manufacturing:
deep navy and ink, warm white surfaces, signal yellow for actions, measured
grids, and one layer-build interaction in the homepage hero. Geist Sans carries
display/body copy and Geist Mono carries technical labels.

See `.planning/design-config.md` before changing the visual language.

## Still to do

- Add more real project, room, and process photography.
- Replace the email handoff with a real request backend if the club needs a
  managed queue.
- Add an admin workflow only after the request backend is defined.
- Deploy and verify the production domain.
