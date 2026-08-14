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
  room: "Room 113 Drafting",
  meets: "Tuesdays",
  time: "3:30–4:30 PM",
  emailDomain: "sd43.bc.ca",
  contactEmail: "080-wwen@sd43.bc.ca",
  sponsorName: "Mr. Anania",
  sponsorEmail: "danania@sd43.bc.ca",
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
