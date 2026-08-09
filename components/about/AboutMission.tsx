import AboutImage from "./AboutImage";
import AboutReveal from "./AboutReveal";
import { Eyebrow, Heading } from "./AboutHeading";
import type { AboutCopy } from "./content";

export default function AboutMission({ copy }: { copy: AboutCopy }) {
  return (
    <section className="about-section" id="mission" aria-labelledby="about-mission">
      <div className="about-panel" data-tone="b">
        <AboutReveal className="about-head">
          <Eyebrow>{copy.mission.eyebrow}</Eyebrow>
          <Heading id="about-mission" segments={copy.mission.heading} />
        </AboutReveal>

        <div className="about-split">
          <AboutReveal className="about-split-copy">
            {copy.mission.paragraphs.map((paragraph, i) => (
              <p key={i} className="about-p">
                {paragraph}
              </p>
            ))}
          </AboutReveal>

          <AboutReveal delay={120}>
            <AboutImage
              slot={copy.mission.image}
              ratio="tall"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
          </AboutReveal>
        </div>
      </div>
    </section>
  );
}
