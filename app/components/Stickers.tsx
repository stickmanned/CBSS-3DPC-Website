import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

/* Real sticker artwork, not generated SVG. Each one is a transparent PNG that
   gets a white die-cut edge from a stack of drop-shadows — the outline follows
   the artwork's own alpha channel, so it hugs the boat's hull and the printer's
   gantry the way a cut sticker does. No square or circular plate behind it.

   Files live in public/img/stickers/. A sticker whose file is not on disk is
   skipped rather than rendering a broken image, so dropping a new PNG into that
   folder is the only step needed to make it appear. */

export type StickerKind = "logo" | "benchy" | "printer" | "spool";

type Spec = { src: string; ratio: number; outline: boolean };

/* `outline` is whether the CSS die-cut edge is drawn. The three artwork
   stickers ship with a white vinyl border already in the pixels, so adding
   ours on top would give them a double edge. The logo has no border of its
   own, so it gets one. */
const SOURCES: Record<StickerKind, Spec> = {
  logo: { src: "/img/logo.png", ratio: 699 / 902, outline: true },
  benchy: { src: "/img/stickers/benchy.png", ratio: 506 / 482, outline: false },
  printer: { src: "/img/stickers/printer.png", ratio: 375 / 506, outline: false },
  spool: { src: "/img/stickers/spool.png", ratio: 506 / 505, outline: false },
};

/* Server component, so this runs at build time and costs nothing at runtime. */
export function stickerExists(kind: StickerKind): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", SOURCES[kind].src));
}

export default function Sticker({
  kind,
  tilt = "-6deg",
  size = 96,
  className = "",
}: {
  kind: StickerKind;
  tilt?: string;
  size?: number;
  className?: string;
}) {
  if (!stickerExists(kind)) return null;

  const spec = SOURCES[kind];
  // Size is the long edge; the short edge follows the artwork's own ratio so
  // nothing is letterboxed or squashed into a square.
  const width = spec.ratio >= 1 ? size : Math.round(size * spec.ratio);
  const height = spec.ratio >= 1 ? Math.round(size / spec.ratio) : size;

  return (
    <span
      aria-hidden="true"
      className={`decal ${className}`}
      style={{ "--decal-tilt": tilt, width, height } as React.CSSProperties}
    >
      <Image
        src={spec.src}
        alt=""
        width={width * 2}
        height={height * 2}
        className={spec.outline ? "decal__art decal__art--outlined" : "decal__art"}
      />
    </span>
  );
}
