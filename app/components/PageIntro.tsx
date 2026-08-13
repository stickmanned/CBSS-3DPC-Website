/**
 * Shared page opener. Every route except home starts with one of
 * these so the pages feel like one publication rather than six.
 */
export default function PageIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-14 pb-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display text-[clamp(2.6rem,7vw,4.2rem)] mt-4">{title}</h1>
      {lead && <p className="text-[19px] max-w-[46ch] mt-6">{lead}</p>}
    </div>
  );
}
