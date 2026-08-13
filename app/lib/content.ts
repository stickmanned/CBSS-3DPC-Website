/* ---------------------------------------------------------------
   EVERYTHING EDITABLE LIVES HERE.
   Change the club's details in this one file and every page updates.
   No JSX, no components — just data. This is the file to hand to
   next year's club officers.
   --------------------------------------------------------------- */

export const club = {
  name: "CBSS 3D Printing Club",
  short: "CBSS 3DPC",
  school: "Dr. Charles Best Secondary",
  district: "SD43",
  room: "Room 112",
  meets: "Mon + Thu",
  time: "3:15 – 4:30 PM",
  emailDomain: "sd43.bc.ca",
  // TODO: replace with the club advisor's real address
  advisorEmail: "advisor@sd43.bc.ca",
  foundedYear: 2019,
};

/* ---- The printer ------------------------------------------------
   One machine, no network. If the club gets another, add it here. */
export const printers = [
  {
    // TODO: put the real make/model in — it shows on /about
    name: "The printer",
    model: "TODO — make and model",
    note: "Old, loud, and not connected to anything. It does the job.",
  },
];

/* ---- The Log ----------------------------------------------------
   The signature of this site: every print the club runs, including
   the ones that failed. Add a row each time something comes off the
   bed. `ok: false` entries want a `note` explaining what went wrong
   — that note is the whole point.

   TODO: the Wizard is real. Everything below it is placeholder data
   so the page has something to show. Replace it with real prints, or
   delete the rows and let the empty state do its job.               */
export type LogEntry = {
  date: string; // YYYY-MM-DD
  title: string;
  who?: string;
  material: string;
  colour: string;
  duration: string;
  ok: boolean;
  note?: string;
};

export const log: LogEntry[] = [
  {
    date: "2026-03-04",
    title: "Wizard figure",
    who: "Parham",
    material: "PLA",
    colour: "BLACK",
    duration: "TODO",
    ok: true,
  },
  {
    date: "2026-02-27",
    title: "TODO — a real print",
    material: "PLA",
    colour: "GREY",
    duration: "1h 48m",
    ok: true,
  },
  {
    date: "2026-02-27",
    title: "TODO — a real failure",
    material: "PETG",
    colour: "CLEAR",
    duration: "2h 05m",
    ok: false,
    note: "Write what actually went wrong here. That sentence is worth more than the rest of the page.",
  },
];

/* ---- Gallery ----------------------------------------------------
   Photos live in public/img/student-works/. Take them on a phone,
   under the lab lights, in someone's hand. Do not stage them. */
export type Work = {
  slug: string;
  title: string;
  author: string;
  blurb: string;
  image: string;
  material: string;
};

export const gallery: Work[] = [
  {
    slug: "wizard",
    title: "Wizard",
    author: "Parham",
    blurb:
      "A cute, tiny wizard figure. The hat brim needed supports and you can still see where they came off.",
    image: "/img/student-works/wizard.png",
    material: "PLA · BLACK",
  },
  // TODO: add the rest of the club's work here.
];

/* ---- Guides ---------------------------------------------------- */
export const guides = [
  {
    title: "Tinkercad",
    level: "Start here",
    blurb:
      "Browser-based, free with a school account, and you can have something printable in an afternoon. Every member starts here.",
    href: "https://www.tinkercad.com/",
  },
  {
    title: "Fusion",
    level: "When you outgrow Tinkercad",
    blurb:
      "Real parametric CAD. Free for students. Worth it once you need parts that fit other parts.",
    href: "https://www.autodesk.com/products/fusion-360/education",
  },
  {
    title: "OrcaSlicer",
    level: "When you want to run the machine",
    blurb:
      "Turns your model into instructions the printer understands. Layer height, infill, supports, brims — this is where prints are won and lost.",
    href: "https://orcaslicer.com/",
  },
];

/* ---- Site navigation ------------------------------------------- */
export const nav = [
  { href: "/request", label: "Request" },
  { href: "/gallery", label: "Gallery" },
  { href: "/guides", label: "Guides" },
  { href: "/log", label: "The Log" },
  { href: "/about", label: "About" },
];

/* ---- helpers --------------------------------------------------- */
export const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${m}·${d}`;
};

export const logStats = () => {
  const total = log.length;
  const done = log.filter((e) => e.ok).length;
  return { total, done, failed: total - done };
};
