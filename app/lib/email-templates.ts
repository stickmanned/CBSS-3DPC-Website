import type {
  DeclinedReasonKey,
  NeedsChangesReasonKey,
  PrintFailedReasonKey,
} from "./queue/domain";

export type EmailTemplate = {
  subject: string;
  text: string;
};

/** Token names intentionally match the queue plan and its copy deck. */
export type QueueEmailTokens = {
  first_name: string;
  ref: string;
  model_name: string;
  material: string;
  colors: string | readonly string[] | null | undefined;
  quantity: number;
  bbox: string | readonly number[] | null | undefined;
  status_url: string;
};

type NormalizedTokens = Omit<QueueEmailTokens, "colors" | "bbox"> & {
  colors: string;
  bbox: string;
};

type ReasonCopy = {
  problem: (tokens: NormalizedTokens) => string;
  next: (tokens: NormalizedTokens) => string;
};

const SIGN_OFF = "— CBSS 3D Printing Club";

function clean(value: string, fallback: string) {
  return value.trim() || fallback;
}

export function firstName(requesterName: string): string {
  return clean(requesterName, "there").split(/\s+/, 1)[0];
}

export function formatEmailColors(colors: QueueEmailTokens["colors"]): string {
  if (Array.isArray(colors)) {
    const normalized = colors.map((color) => color.trim()).filter(Boolean);
    return normalized.length ? normalized.join(", ") : "club's choice";
  }
  return typeof colors === "string" ? clean(colors, "club's choice") : "club's choice";
}

function formatMeasurement(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export function formatEmailBbox(bbox: QueueEmailTokens["bbox"]): string {
  if (Array.isArray(bbox)) {
    if (bbox.length !== 3 || bbox.some((value) => !Number.isFinite(value) || value <= 0)) {
      return "dimensions unavailable";
    }
    return `${bbox.map(formatMeasurement).join(" × ")} mm`;
  }
  return typeof bbox === "string" ? clean(bbox, "dimensions unavailable") : "dimensions unavailable";
}

export function modelNameFromFileOrUrl(fileName: string | null, modelUrl: string | null): string {
  if (fileName?.trim()) return fileName.trim();
  if (!modelUrl) return "your model";
  try {
    const url = new URL(modelUrl);
    const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "")
      .replace(/[-_]+/g, " ")
      .trim();
    return slug || url.hostname;
  } catch {
    return "your model";
  }
}

function normalizeTokens(tokens: QueueEmailTokens): NormalizedTokens {
  if (!Number.isInteger(tokens.quantity) || tokens.quantity < 1 || tokens.quantity > 50) {
    throw new RangeError("Email quantity must be an integer from 1 to 50.");
  }
  return {
    ...tokens,
    first_name: clean(tokens.first_name, "there"),
    ref: clean(tokens.ref, "your request"),
    model_name: clean(tokens.model_name, "your model"),
    material: clean(tokens.material, "the selected material").toUpperCase(),
    colors: formatEmailColors(tokens.colors),
    bbox: formatEmailBbox(tokens.bbox),
    status_url: clean(tokens.status_url, "the status link in your confirmation email"),
  };
}

export const PRINT_FAILED_REASON_COPY: Readonly<Record<PrintFailedReasonKey, ReasonCopy>> = {
  came_off_plate: {
    problem: () =>
      "It lifted off the build plate partway up. That's a printer-side issue, not a problem with your model.",
    next: () => "We've put it back in the queue and we'll rerun it — nothing needed from you.",
  },
  ran_out_of_filament: {
    problem: () => "Our spool ran out mid-print.",
    next: () => "We've reloaded and requeued it. Nothing needed from you.",
  },
  layer_shift: {
    problem: () =>
      "The printer lost its position partway through, so the upper layers came out offset.",
    next: () => "Requeued — we'll rerun it with slower travel speeds.",
  },
  supports_collapsed: {
    problem: () =>
      "The supports holding up the overhangs gave way, and the section above them printed into open air.",
    next: () =>
      "We'd like to try it in a different orientation. That may change which surfaces end up smooth — tell us if a particular face needs to look clean.",
  },
  warped: {
    problem: () => "The corners curled up as it cooled, which pulled the part out of shape.",
    next: (tokens) =>
      `${tokens.material} is prone to this on large flat parts. We can rerun it, or switch material — tell us if you'd rather change.`,
  },
  nozzle_clogged: {
    problem: () => "The nozzle jammed mid-print.",
    next: () => "Cleared and requeued. Nothing needed from you.",
  },
};

export const NEEDS_CHANGES_REASON_COPY: Readonly<Record<NeedsChangesReasonKey, ReasonCopy>> = {
  too_large: {
    problem: (tokens) => `The model is ${tokens.bbox}, which is larger than our build plate.`,
    next: () =>
      "You can scale it down, or we can split it into pieces and glue them together — tell us which you'd prefer.",
  },
  thin_walls: {
    problem: () =>
      "Some walls are thinner than our nozzle can reliably print, so those areas would come out weak or gappy.",
    next: () => "Thickening them to at least 1.2 mm in your modelling program will fix it.",
  },
  broken_mesh: {
    problem: () =>
      "The file has holes and flipped faces, so the slicer can't work out what's inside and what's outside.",
    next: () =>
      "A free mesh-repair tool, or Blender's 3D Print Toolbox, usually fixes this in one pass.",
  },
  heavy_overhangs: {
    problem: () =>
      "Large sections hang out at steep angles, so it needs a lot of support material — and supports leave marks on whatever they touch.",
    next: () =>
      "We're happy to print it as-is if you don't mind some cleanup marks. If you'd rather avoid them, reorienting or splitting the model helps. Tell us which you'd prefer.",
  },
  cant_access_link: {
    problem: () => "We only got a link, and the page needs an account we don't have.",
    next: () => "Could you download the file and reply with it attached?",
  },
  scale_looks_off: {
    problem: (tokens) =>
      `The model came through at ${tokens.bbox}, which looks like a units mix-up rather than the size you meant.`,
    next: () => "Let us know the size you actually want and we'll scale it.",
  },
};

export const DECLINED_REASON_COPY: Readonly<Record<DeclinedReasonKey, ReasonCopy>> = {
  against_school_policy: {
    problem: () => "The model falls outside what we're able to print at school.",
    next: () => "If you'd like, we can help you find something similar that works — just ask.",
  },
  too_big_a_job: {
    problem: (tokens) =>
      `At ${tokens.quantity} copies this size, it would tie up the printer for a very long stretch and use most of a spool.`,
    next: () =>
      "We could do a smaller number, or scale it down — reply and tell us what would still be useful to you.",
  },
  licensing: {
    problem: () => "The model's license doesn't allow us to reproduce it this way.",
    next: () =>
      "Plenty of similar models on Printables and MakerWorld do allow it — happy to help you find one.",
  },
  not_printable: {
    problem: () => "This one can't be made on an FDM printer in one piece, even with changes.",
    next: () =>
      "If you can redesign it as separate parts, send it back over and we'll take another look.",
  },
};

export function renderSubmittedEmail(rawTokens: QueueEmailTokens): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  return {
    subject: "We've got your print request",
    text: `Hi ${tokens.first_name},

We've got your request for ${tokens.model_name}. Your reference is ${tokens.ref}.

Nothing needed from you right now. We'll email you after we've reviewed it.

Track it here: ${tokens.status_url}

${SIGN_OFF}`,
  };
}

export function renderApprovedEmail(rawTokens: QueueEmailTokens): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  return {
    subject: `Your print is approved — ${tokens.ref}`,
    text: `Hi ${tokens.first_name},

Good news — we've checked over ${tokens.model_name} and it prints cleanly. It's in the queue now.

Material: ${tokens.material}
Colors: ${tokens.colors}
Copies: ${tokens.quantity}

We'll email you as soon as it's off the printer. Track it here: ${tokens.status_url}

${SIGN_OFF}`,
  };
}

export function renderPrintingEmail(rawTokens: QueueEmailTokens): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  return {
    subject: "Your print just started",
    text: `Hi ${tokens.first_name},

${tokens.model_name} is on the printer now.

Material: ${tokens.material}
Colors: ${tokens.colors}

Track it here: ${tokens.status_url}

${SIGN_OFF}`,
  };
}

export function renderReadyForPickupEmail(rawTokens: QueueEmailTokens): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  return {
    subject: "Your print is ready",
    text: `Hi ${tokens.first_name},

${tokens.model_name} is ready for pickup in Room 113 (Drafting).

We're there Tuesdays from 3:30–4:30 PM. If that doesn't work, reply and we'll arrange another time.

Track it here: ${tokens.status_url}

${SIGN_OFF}`,
  };
}

export function renderUncollectedEmail(rawTokens: QueueEmailTokens): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  return {
    subject: "Your print is still waiting",
    text: `Hi ${tokens.first_name},

${tokens.model_name} is still waiting for you in Room 113 (Drafting).

We'll hold it for the rest of the term. Reply if you need to arrange a pickup time.

Track it here: ${tokens.status_url}

${SIGN_OFF}`,
  };
}

export function renderPrintFailedEmail(
  rawTokens: QueueEmailTokens,
  reason: PrintFailedReasonKey,
): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  const copy = PRINT_FAILED_REASON_COPY[reason];
  return {
    subject: `Your print hit a snag — ${tokens.ref}`,
    text: `Hi ${tokens.first_name},

Heads up: the first attempt at ${tokens.model_name} didn't finish.

${copy.problem(tokens)}

${copy.next(tokens)}

Track it here: ${tokens.status_url}

${SIGN_OFF}`,
  };
}

export function renderNeedsChangesEmail(
  rawTokens: QueueEmailTokens,
  reason: NeedsChangesReasonKey,
): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  const copy = NEEDS_CHANGES_REASON_COPY[reason];
  return {
    subject: `One thing to sort out on your print — ${tokens.ref}`,
    text: `Hi ${tokens.first_name},

We took a look at ${tokens.model_name} and ran into something before we could start:

${copy.problem(tokens)}

${copy.next(tokens)}

Reply with an updated file and we'll pick it straight back up — your spot in the queue is held.

${SIGN_OFF}`,
  };
}

export function renderDeclinedEmail(
  rawTokens: QueueEmailTokens,
  reason: DeclinedReasonKey,
): EmailTemplate {
  const tokens = normalizeTokens(rawTokens);
  const copy = DECLINED_REASON_COPY[reason];
  return {
    subject: `About your print request — ${tokens.ref}`,
    text: `Hi ${tokens.first_name},

Thanks for sending this over. Unfortunately we're not able to take on ${tokens.model_name}.

${copy.problem(tokens)}

${copy.next(tokens)}

If you think we've misread the request, just reply — we're happy to take another look.

${SIGN_OFF}`,
  };
}

/** Picked-up is terminal and intentionally sends no email. */
export function renderPickedUpEmail(): null {
  return null;
}
