"use client";

import { useEffect, useRef, useState } from "react";

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  as: Component = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const delayClass =
    delay === 1
      ? "reveal-delay-1"
      : delay === 2
      ? "reveal-delay-2"
      : delay === 3
      ? "reveal-delay-3"
      : delay === 4
      ? "reveal-delay-4"
      : "";

  const classes = `reveal ${isVisible ? "is-visible" : ""} ${delayClass} ${className}`;

  if (Component === "li") {
    return (
      <li ref={(node) => { ref.current = node; }} className={classes}>
        {children}
      </li>
    );
  }

  return (
    <div ref={(node) => { ref.current = node; }} className={classes}>
      {children}
    </div>
  );
}
