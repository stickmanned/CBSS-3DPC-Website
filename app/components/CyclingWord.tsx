"use client";

import { useEffect, useState } from "react";

/* The last word of the hero line, cycling. The list runs from the impressive
   to the honest and lands on "yours" before looping — a returning student sees
   different words than a first-time visitor, which is the whole reason this
   moves at all instead of picking one adjective and standing still.

   Order matters: enormous/tiny, useful/useless and terrible/glorious are
   setup-and-payoff pairs and only work adjacent. */
const WORDS = [
  "astonishing",
  "ridiculous",
  "enormous",
  "tiny",
  "useful",
  "useless",
  "weird",
  "impossible",
  "unnecessary",
  "terrible",
  "glorious",
  "ambitious",
  "beautiful",
  "yours",
] as const;

const HOLD_MS = 2000;

export default function CyclingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;

    /* Re-read the preference on change rather than only at mount, so toggling
       it in the OS settles the word back on the first one immediately. */
    const sync = () => {
      clearInterval(timer);
      if (query.matches) {
        setIndex(0);
        return;
      }
      timer = setInterval(
        () => setIndex((i) => (i + 1) % WORDS.length),
        HOLD_MS
      );
    };

    sync();
    query.addEventListener("change", sync);
    return () => {
      clearInterval(timer);
      query.removeEventListener("change", sync);
    };
  }, []);

  return (
    <>
      {/* Screen readers get the sentence once, with the word it renders with
          on load. Announcing a swap every 2s would be unusable. */}
      <span className="sr-only">{WORDS[0]}</span>
      <span aria-hidden="true" className="word-cycle">
        {WORDS.map((word, i) => (
          <span
            key={word}
            className={`word-cycle__word rainbow-text${
              i === index ? " is-current" : ""
            }`}
          >
            {word}
          </span>
        ))}
      </span>
    </>
  );
}
