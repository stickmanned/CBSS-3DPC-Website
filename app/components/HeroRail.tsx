import Image from "next/image";
import { heroPhotos } from "../lib/content";

/* One column of the collage that frames the hero. The reference site fills
   these with 27 photos; we have one, so the rail renders what exists and
   fills the rest with filament-coloured blocks. That way it reads as a
   designed pattern today and simply gets richer as photos land — a visitor
   never sees an empty slot, and the shoot list lives in content.ts. */
const FILL = ["#f5c21b", "#fc9257", "#9ad0c0", "#213366", "#b15533"];
const TILT = ["-3deg", "2.5deg", "-1.5deg", "3deg", "-2deg"];

export default function HeroRail({
  side,
  cells = 4,
}: {
  side: "left" | "right";
  cells?: number;
}) {
  // The two rails split the photo list rather than each reading from the top,
  // so the same print never appears on both sides of the hero.
  const split = Math.ceil(heroPhotos.length / 2);
  const photos =
    side === "left" ? heroPhotos.slice(0, split) : heroPhotos.slice(split);

  return (
    <div className="rail" aria-hidden="true">
      {Array.from({ length: cells }).map((_, index) => {
        const photo = photos[index];
        const offset = side === "left" ? index : index + 2;

        return (
          <div
            key={index}
            className="rail__cell"
            style={
              { "--cell-tilt": TILT[offset % TILT.length] } as React.CSSProperties
            }
          >
            {photo ? (
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="200px"
                className="object-cover"
              />
            ) : (
              <div
                className="size-full"
                style={{ background: FILL[offset % FILL.length] }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
