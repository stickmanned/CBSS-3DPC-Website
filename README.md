# CBSS 3D Printing Club

Website for the Dr. Charles Best Secondary (SD43) 3D Printing Club.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Where things are

```
app/
  lib/content.ts        ← EDIT THIS. Club details, the Log, gallery, guides.
  globals.css           ← design tokens (colours, fonts)
  components/           ← shared UI
  page.tsx              ← home
  about|request|gallery|guides|log/page.tsx
public/img/
  logo.png              ← club mark, background removed
  logo-source.png       ← the original render, untouched
  student-works/        ← photos of prints
legacy/index.html       ← the old single-file site, kept for reference
```

**Almost everything you'll want to change is in `app/lib/content.ts`.** Meeting
times, the room, the advisor's email, the Log, the gallery, the guides — all of
it is plain data in that one file. You shouldn't need to touch a component to
update the club's details.

## Adding a print to the Log

The Log is the heart of this site. Every print goes in it, including the ones
that fail — the failure notes are institutional memory for members who haven't
joined yet.

Open `app/lib/content.ts` and add an entry to `log`:

```ts
{
  date: "2026-03-11",
  title: "Gearbox housing",
  who: "Priya",
  material: "PETG",
  colour: "BLACK",
  duration: "5h 40m",
  ok: false,
  note: "Layer shift about 40mm up. Belt was loose. Retensioned and reprinted.",
}
```

## Adding to the gallery

1. Put the photo in `public/img/student-works/`. Take it on a phone, in the lab,
   in someone's hand — don't stage it.
2. Add an entry to `gallery` in `app/lib/content.ts`.

## Design

Navy `#213366` and silver are sampled from the club's printed logo. Yellow
`#E8B613` marks anything you can act on, and nothing else. Everything else is
greyscale on purpose — the remaining colour on this site comes from photographs
of real prints.

Type is Bricolage Grotesque (headings), Source Serif 4 (body), Martian Mono
(dates, materials, durations).

The full component library lives in Claude Design under **CBSS 3DPC**.

## Still to do

- [ ] Fill in the real printer make/model and advisor email in `content.ts`
- [ ] Replace the placeholder Log entries with real prints
- [ ] Wire the request form to a database (currently composes an email)
- [ ] Admin page for the print queue
- [ ] Deploy to Vercel
