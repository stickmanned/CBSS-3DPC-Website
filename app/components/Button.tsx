import Link from "next/link";

type Variant = "primary" | "secondary" | "signal";

const base =
  "inline-flex items-center gap-2.5 font-display font-bold text-[15px] tracking-tight px-5 py-3 border-[1.5px] transition-colors active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-paper border-navy hover:bg-ink hover:border-ink",
  secondary:
    "bg-transparent text-navy border-navy hover:bg-signal hover:border-signal hover:text-ink",
  signal: "bg-signal text-ink border-signal hover:bg-navy hover:border-navy hover:text-paper",
};

export default function Button({
  href,
  variant = "primary",
  children,
  className = "",
  ...rest
}: {
  href?: string;
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
