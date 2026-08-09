"use client";

import type { Lang } from "./content";

/**
 * Two-segment FA|EN pill. Rendered in both the header and the footer so the
 * switch is reachable without scrolling back up on a long page.
 *
 * Labels are written in their own script (فا / EN) rather than translated, so
 * a reader of either language recognises the option they want.
 */
export default function AboutLangToggle({
  lang,
  onChange,
  label,
}: {
  lang: Lang;
  onChange: (next: Lang) => void;
  label: string;
}) {
  return (
    <div className="about-lang" role="group" aria-label={label}>
      <button
        type="button"
        lang="fa"
        aria-pressed={lang === "fa"}
        onClick={() => onChange("fa")}
      >
        فا
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={lang === "en"}
        onClick={() => onChange("en")}
      >
        EN
      </button>
    </div>
  );
}
