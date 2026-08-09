import AboutImage from "./AboutImage";
import AboutReveal from "./AboutReveal";
import { Eyebrow, Heading } from "./AboutHeading";
import type { AboutCopy } from "./content";

export default function AboutHero({ copy }: { copy: AboutCopy }) {
  return (
    <section className="about-hero" aria-labelledby="about-title">
      {/* The photograph is the hero's backdrop rather than a block beneath it.
          Purely decorative in this role — the copy above carries the meaning —
          so it is hidden from assistive tech. Contrast is guaranteed by the
          scrim and text well in about.css, not by the image itself. */}
      <div className="about-hero-backdrop" aria-hidden="true">
        <AboutImage slot={copy.hero.image} ratio="fill" sizes="100vw" priority backdrop />
      </div>

      <AboutReveal className="about-hero-inner">
        <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
        <Heading as="h1" id="about-title" segments={copy.hero.heading} />
        <p className="about-lead">{copy.hero.lead}</p>
        <span className="about-scrollcue" aria-hidden="true">
          {copy.ui.scrollCue}
        </span>
      </AboutReveal>
    </section>
  );
}
