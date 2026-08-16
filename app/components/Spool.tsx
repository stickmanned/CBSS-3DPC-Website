/* The spool, shared by the homepage picker and the request form's colour
   step. `fill` is either a hex or the CSS gradient a multicolour filament
   carries on `color.swatch` — the styles never branch on which. */
export default function Spool({
  fill,
  className = "",
}: {
  fill: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`spool ${className}`}
      style={{ "--spool-fill": fill } as React.CSSProperties}
    >
      <span className="spool__strand" />
      <span className="spool__flange">
        <span className="spool__wind" />
        <span className="spool__grooves" />
      </span>
      <span className="spool__hub">
        <span className="spool__bore" />
      </span>
    </div>
  );
}
