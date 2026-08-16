/* The page opener, on paper. It used to be a full-bleed dark panel with a
   stock photo behind a left-to-right gradient scrim — the most product-launch
   thing on the site. Now it is a sticker, a heading at a readable size, and a
   sentence. The sticker text is the display face in sentence case, never
   uppercase monospace: that pattern reads as a machine talking. */
export default function PageIntro({
  label,
  title,
  lead,
  accent = "mint",
  titleClassName,
}: {
  label: string;
  title: React.ReactNode;
  lead?: string;
  accent?: "mint" | "mandarin" | "yellow";
  titleClassName?: string;
}) {
  const stickerClass =
    accent === "mandarin"
      ? "sticker sticker--mandarin"
      : accent === "yellow"
      ? "sticker"
      : "sticker sticker--mint";

  return (
    <section className="mx-auto max-w-6xl px-5 pb-4 pt-10 md:pt-14">
      <p className={`${stickerClass} w-fit`}>{label}</p>
      <h1
        className={`mt-5 text-[clamp(2.25rem,5.5vw,3.5rem)] text-ink ${
          titleClassName || "max-w-[18ch]"
        }`}
      >
        {title}
      </h1>
      {lead && (
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-slate">
          {lead}
        </p>
      )}
    </section>
  );
}
