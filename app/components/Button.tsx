import Link from "next/link";

type Variant = "primary" | "secondary" | "light" | "dark";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  light: "btn--light",
  dark: "btn--dark",
};

export default function Button({
  href,
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: {
  href?: string;
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["btn", variants[variant], size === "lg" ? "btn--lg" : "", className]
    .filter(Boolean)
    .join(" ");

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
