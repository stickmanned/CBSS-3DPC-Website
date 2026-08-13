/**
 * A hand-drawn yellow stroke.
 *
 * This is the one deliberately imperfect thing in the interface — an
 * irregular SVG path rather than a border, so the nav and the hero
 * don't read as framework defaults. Used sparingly: the active nav
 * item, and exactly one word in the hero.
 */
export default function MarkerUnderline({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="absolute -left-[3%] -bottom-[0.18em] w-[106%] h-[0.22em] overflow-visible"
      >
        <path
          d="M2 7 C 20 2, 40 10, 58 5 S 86 2, 98 6"
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth={5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
