import VisionImage from "./VisionImage";
import AboutReveal from "./AboutReveal";
import { Eyebrow, Heading } from "./AboutHeading";
import type { AboutCopy } from "./content";

export default function AboutVision({ copy }: { copy: AboutCopy }) {
  return (
    <section className="about-section" id="vision" aria-labelledby="about-vision">
      <div className="about-panel" data-tone="b">
        <AboutReveal className="about-head">
          <Eyebrow>{copy.vision.eyebrow}</Eyebrow>
          <Heading id="about-vision" segments={copy.vision.heading} />
        </AboutReveal>

        <AboutReveal className="about-band-figure" delay={100}>
          <VisionImage
            slot={copy.vision.image}
            ratio="wide"
            blend
            sizes="(max-width: 1088px) 100vw, 1088px"
          />
        </AboutReveal>

        <AboutReveal className="about-head">
          {copy.vision.paragraphs.map((paragraph, i) => (
            <p key={i} className="about-p">
              {paragraph}
            </p>
          ))}
        </AboutReveal>

        <AboutReveal delay={80}>
          <blockquote className="about-quote">
            <p>{copy.vision.quote}</p>
          </blockquote>
        </AboutReveal>
      </div>
    </section>
  );
}
