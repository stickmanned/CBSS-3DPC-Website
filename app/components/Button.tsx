import Link from "next/link";

type Variant = "primary" | "secondary" | "light" | "dark";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[var(--radius-pill)] px-6 py-3 font-display text-[15px] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "border border-signal bg-signal text-ink hover:border-white hover:bg-white",
  secondary:
    "border border-navy/20 bg-transparent text-navy hover:border-navy hover:bg-navy hover:text-white",
  light:
    "border border-white/30 bg-transparent text-white hover:border-white hover:bg-white hover:text-ink",
  dark: "border border-ink bg-ink text-white hover:border-navy hover:bg-navy",
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
