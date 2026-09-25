/* ---------------------------------------------------------------
   CLUB CONTENT

   Keep changing facts in this file so future club officers can
   update the site without touching page components.
   --------------------------------------------------------------- */

export const club = {
  name: "CBSS 3D Printing Club",
  short: "CBSS 3DPC",
  school: "Dr. Charles Best Secondary",
  district: "SD43",
  room: "Room 213 Drafting",
  meets: "Tuesdays",
  time: "3:30–4:30 PM",
  emailDomain: "sd43.bc.ca",
  contactEmail: "080-wwen@sd43.bc.ca",
  sponsorName: "Mr. Anania",
  sponsorEmail: "danania@sd43.bc.ca",
};

/* ---- Club sign-up ----------------------------------------------
   A Fillout form, embedded on /about. `url` is the plain share link,
   the fallback for anyone whose network or blocker stops the embed. */
export const signupForm = {
  id: "cuz2BFxYmJus",
  url: "https://forms.fillout.com/t/cuz2BFxYmJus",
};

/* ---- Teams ------------------------------------------------------
   The club runs out of a Microsoft Teams team. All three routes below
   open the same team and all three need a school (sd43) account, so
   they move together: if the team is ever recreated, the code and the
   link change AND public/img/teams-qr.png has to be regenerated from
   the new link. A stale QR is the failure nobody notices, because it
   still scans — it just lands somewhere that no longer exists. */
export const teams = {
  code: "s3yqurx",
  url: "https://teams.microsoft.com/l/team/19%3AOYoLtzDA1zUgCFH-588ENOhAz0dJ7chJxJ2QOJyu2cQ1%40thread.tacv2/conversations?groupId=92bae179-8df7-4ab8-8822-5bfc72f0aa12&tenantId=d9658cef-0292-4252-9925-6442de24a44b",
  /* Encodes `url` above verbatim — no shortener in between, so nothing
     else has to keep working for a scan to land on the team. Denser
     for it (57 modules against 33), which is why it is displayed big.
     It still decodes in software at 160px, but a phone camera aimed at
     a screen has far less to work with than a clean downscale, so the
     headroom is the point — do not shrink it to fill a gap.
     Regenerate after any change to `url`, from the repo root:

       npx -y qrcode -o public/img/teams-qr.png -e M -q 4 -s 12 \
         -d 1b2233 -l ffffff "<the url above>"

     (-q is the quiet zone in modules; -m is the mask pattern, not the
     margin, and setting it by hand is how you get a QR that scans on
     one phone and not the next.)

     Then scan it with an actual phone before committing. */
  qr: "/img/teams-qr.png",
};

export const meetingFacts = [
  { label: "Meet", value: club.meets },
  { label: "Time", value: club.time },
  { label: "Place", value: club.room },
  { label: "School", value: club.school },
] as const;

/* ---- Gallery ----------------------------------------------------
   Photos live in public/img/student-works/. Use real club work and
   say "printed by" unless the student also designed the model. */
export type Work = {
  slug: string;
  title: string;
  printedBy: string;
  blurb: string;
  image: string;
  material: string;
};

export const gallery: Work[] = [
  {
    slug: "wizard",
    title: "Wizard",
    printedBy: "Parham",
    blurb:
      "A small wizard figure wearing a magical hat with stars and gems. Made using TinkerCAD's repository of shapes.",
    image: "/img/student-works/wizard.png",
    material: "Black PLA",
  },
];

/* ---- Hero collage rail ------------------------------------------
   The photos that frame the homepage hero. Add a file to
   public/img/hero/ and a line here — the rail sizes itself to
   whatever exists, so it never looks broken while it fills up.

   All eight slots are filled. What the rail has plenty of now is
   finished objects; what it still has none of is the club itself.
   Worth shooting when the chance comes:
     - a printer mid-job, nozzle and part in frame
     - the drafting room during a meeting, wide
     - hands at a screen modelling in TinkerCAD or Fusion
     - a failed print: spaghetti, warping, a collapsed support
     - a group shot at a meeting
   Landscape or square crop best; the rail is 4:3 and crops portrait
   shots to a band. Phone photos are fine and read as more honest
   than staged ones — do not shoot these "nicely".

   Source files are downsized to 640x480 JPEG on the way in. Drop a
   full-resolution original here and it will be served as-is, so
   resize before committing anything over ~200KB. */
export type HeroPhoto = {
  src: string;
  alt: string;
  /* Set on borrowed photos only. Anything with a credit is a PLACEHOLDER and
     should be deleted the moment a real club photo can take its slot — a rail
     of other people's prints is the thing this redesign set out to remove. */
  credit?: { who: string; licence: string; url: string };
};

export const heroPhotos: HeroPhoto[] = [
  {
    src: "/img/student-works/wizard.png",
    alt: "A student holding a small black 3D printed wizard figure",
  },
  {
    src: "/img/hero/dragon.jpg",
    alt: "A long articulated dragon printed in colour-shifting orange and green filament, coiled on a print bed",
  },
  {
    src: "/img/hero/spiderman.jpg",
    alt: "A multi-colour Spider-Man figure held up in one hand",
  },
  {
    src: "/img/hero/pikachu.jpg",
    alt: "A yellow Pikachu print with black-tipped ears and red cheeks",
  },
  {
    src: "/img/hero/creepers.jpg",
    alt: "Two green Minecraft creeper figures printed at different sizes",
  },
  {
    src: "/img/hero/minions.jpg",
    alt: "Two yellow Minion figures on a wooden shelf beside a printer",
  },
  {
    src: "/img/hero/golem.jpg",
    alt: "A cracked stone golem printed in brown filament with green flecks",
  },

  /* The last remaining borrowed photo. Delete this entry and its file to
     make the rail entirely club work — the eighth slot falls back to a
     filament-coloured block, which is what it was designed to do. */
  {
    src: "/img/hero/benchy-print.jpg",
    alt: "A green and brown two-colour 3DBenchy boat held between finger and thumb",
    credit: {
      who: "Wikimedia Commons",
      licence: "CC0",
      url: "https://commons.wikimedia.org/wiki/File:Dual-print_multi-part_color_3D_print_of_3DBenchy_v45.jpg",
    },
  },
];

/* ---- Learning path --------------------------------------------- */
export const guides = [
  {
    title: "TinkerCAD",
    level: "Start here",
    blurb:
      "Build a first model from simple shapes and learn the fundamentals of size, alignment, and combining parts.",
    href: "https://www.tinkercad.com/",
  },
  {
    title: "Autodesk Fusion",
    level: "Build with precision",
    blurb:
      "Move into an industry standard CAD workflow when exact dimensions and editable features matter.",
    href: "https://www.autodesk.com/products/fusion-360/education",
  },
  {
    title: "The Slicer",
    level: "Prepare the print",
    blurb:
      "Learn how to operate the slicer, software that turns a 3D model into printer instructions, such as layers, supports, and infill.",
    href: "https://prusaslicer.com/",
  },
] as const;

/* ---- Primary navigation ----------------------------------------
   Request and Join are persistent actions in the header, so this
   list stays intentionally short. */
export const nav = [
  { href: "/gallery", label: "Gallery" },
  { href: "/guides", label: "Learn" },
  { href: "/about", label: "About" },
] as const;
