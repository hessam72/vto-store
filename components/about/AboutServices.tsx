import AboutImage from "./AboutImage";
import AboutReveal from "./AboutReveal";
import { Eyebrow, Heading } from "./AboutHeading";
import { ServiceGlyph } from "./icons";
import type { AboutCopy } from "./content";

export default function AboutServices({ copy }: { copy: AboutCopy }) {
  return (
    <section className="about-section" id="services" aria-labelledby="about-services">
      <div className="about-panel" data-tone="a">
        <AboutReveal className="about-head">
          <Eyebrow>{copy.services.eyebrow}</Eyebrow>
          <Heading id="about-services" segments={copy.services.heading} />
          <p className="about-p">{copy.services.lead}</p>
        </AboutReveal>

        <ul className="about-grid">
          {copy.services.items.map((service, i) => (
            <AboutReveal
              key={service.icon}
              as="li"
              className="about-card"
              // Stagger by column, not by index, so a row appears together
              // instead of the last card trailing a second behind the first.
              delay={(i % 4) * 90}
            >
              <div className="about-card-media">
                <AboutImage
                  slot={service.image}
                  ratio="card"
                  sizes="(max-width: 560px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <span className="about-chip" aria-hidden="true">
                  <ServiceGlyph name={service.icon} />
                </span>
              </div>

              <div className="about-card-body">
                <h3 className="about-card-title">{service.title}</h3>
                <p className="about-card-text">{service.description}</p>
              </div>
            </AboutReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
