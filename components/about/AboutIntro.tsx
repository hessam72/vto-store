import AboutReveal from "./AboutReveal";
import type { AboutCopy } from "./content";

/** The "we believe the future of the web…" statement — a quiet editorial band
 *  between the hero and the mission, with no heading of its own. */
export default function AboutIntro({ copy }: { copy: AboutCopy }) {
  return (
    <section className="about-section">
      <div className="about-panel" data-tone="a">
        <AboutReveal className="about-head">
          <hr className="about-divider" />
          {copy.intro.paragraphs.map((paragraph, i) => (
            <p key={i} className="about-p">
              {paragraph}
            </p>
          ))}
          <hr className="about-divider" />
        </AboutReveal>
      </div>
    </section>
  );
}
