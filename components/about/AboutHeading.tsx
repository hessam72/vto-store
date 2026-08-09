import type { Seg } from "./content";

/**
 * Bold white heading where only the segments flagged `gold` take the gold
 * gradient. Keeping headings as segment arrays (rather than markup) is what
 * lets the treatment survive translation — see content.ts.
 */
export function Heading({
  segments,
  as: Tag = "h2",
  id,
}: {
  segments: readonly Seg[];
  as?: "h1" | "h2" | "h3";
  id?: string;
}) {
  return (
    <Tag id={id} className={`about-h ${Tag === "h1" ? "about-h1" : "about-h2"}`}>
      {segments.map((segment, i) =>
        segment.gold ? (
          <span key={i} className="about-gold">
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </Tag>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <span className="about-eyebrow">{children}</span>;
}
