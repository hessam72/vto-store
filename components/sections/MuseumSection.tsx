"use client";

import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { MuseumChamber } from "@/types";

gsap.registerPlugin(ScrollTrigger);

const CHAMBERS: MuseumChamber[] = [
  {
    id: "rings",
    label: "Rings",
    roomNumber: "I",
    description:
      "Forged circles of eternity. Each ring carries the weight of a promise, the warmth of a moment forever sealed in gold.",
    goldHue: "#d4af37",
    accentLight: "rgba(212,175,55,0.18)",
  },
  {
    id: "necklaces",
    label: "Necklaces",
    roomNumber: "II",
    description:
      "Cascading gold that traces the body's contours. Architecture you can wear — links of destiny draped in elegance.",
    goldHue: "#ffd700",
    accentLight: "rgba(255,215,0,0.15)",
  },
  {
    id: "bracelets",
    label: "Bracelets",
    roomNumber: "III",
    description:
      "The language of the wrist. Fluid gold that moves with you — a second skin of luxury forged to outlast time.",
    goldHue: "#daa520",
    accentLight: "rgba(218,165,32,0.2)",
  },
  {
    id: "earrings",
    label: "Earrings",
    roomNumber: "IV",
    description:
      "Golden whispers at the edge of perception. Delicate structures that catch light like captured star fragments.",
    goldHue: "#b8860b",
    accentLight: "rgba(184,134,11,0.22)",
  },
  {
    id: "exclusive",
    label: "Exclusive",
    roomNumber: "V",
    description:
      "One-of-one. Each piece a private commission — never replicated, never forgotten. The definition of heirloom.",
    goldHue: "#ffeaa0",
    accentLight: "rgba(255,234,160,0.12)",
  },
];

// Icons (SVG paths) per category
const CATEGORY_ICONS: Record<string, JSX.Element> = {
  rings: (
    <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M22 26 Q32 16 42 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  necklaces: (
    <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
      <path d="M12 16 Q32 52 52 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="48" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M26 47 L32 38 L38 47" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  bracelets: (
    <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
      <path d="M16 32 Q16 12 32 12 Q48 12 48 32 Q48 52 32 52 Q16 52 16 32Z" stroke="currentColor" strokeWidth="2.5" />
      <path d="M20 20 Q32 8 44 20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  ),
  earrings: (
    <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
      <circle cx="22" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="42" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M22 19 L22 44 L17 52 L27 52 L22 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 19 L42 44 L37 52 L47 52 L42 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  exclusive: (
    <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12">
      <path d="M32 8 L38 22 L54 24 L43 35 L46 51 L32 44 L18 51 L21 35 L10 24 L26 22 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

function ChamberCard({ chamber, index }: { chamber: MuseumChamber; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 60, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: cardRef.current,
          start: "top 85%",
          end: "top 50%",
          scrub: 0.8,
        },
      }
    );
  }, []);

  return (
    <motion.div
      ref={cardRef}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative group cursor-pointer"
      data-cursor-hover
    >
      {/* Card body */}
      <div
        className="clip-gold-border relative overflow-hidden h-[480px] flex flex-col"
        style={{
          background: "linear-gradient(145deg, #0d0d14, #14141e)",
          border: "1px solid var(--border-subtle)",
          transition: "border-color 0.4s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = chamber.goldHue + "50";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "";
        }}
      >
        {/* Inner glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${chamber.accentLight}, transparent)`,
          }}
        />

        {/* Room number — large decorative */}
        <div
          className="absolute top-4 right-6 font-display text-[6rem] font-bold leading-none pointer-events-none select-none"
          style={{
            color: "transparent",
            WebkitTextStroke: `1px ${chamber.goldHue}25`,
          }}
        >
          {chamber.roomNumber}
        </div>

        {/* Icon */}
        <div
          className="mt-10 ml-8 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1"
          style={{ color: chamber.goldHue }}
        >
          {CATEGORY_ICONS[chamber.id]}
        </div>

        {/* Text content */}
        <div className="flex-1 flex flex-col justify-end p-8">
          <div className="museum-label mb-3 opacity-70">
            Chamber {chamber.roomNumber}
          </div>
          <h3
            className="font-display text-[1.8rem] font-bold mb-4"
            style={{ color: chamber.goldHue }}
          >
            {chamber.label}
          </h3>
          <p className="font-serif text-[1rem] text-[var(--text-secondary)] leading-relaxed font-light line-clamp-3 group-hover:line-clamp-none transition-all duration-500">
            {chamber.description}
          </p>

          {/* CTA row */}
          <div className="flex items-center gap-3 mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-y-2 group-hover:translate-y-0">
            <span className="museum-label text-[0.6rem]" style={{ color: chamber.goldHue }}>
              Enter Chamber
            </span>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" style={{ color: chamber.goldHue }}>
              <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Bottom shimmer line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(90deg, transparent, ${chamber.goldHue}, transparent)`,
          }}
        />
      </div>
    </motion.div>
  );
}

export default function MuseumSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const titleY = useTransform(scrollYProgress, [0, 0.3], [80, 0]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section
      ref={sectionRef}
      id="museum"
      className="relative section-padding"
      style={{ background: "#060608" }}
    >
      {/* Top edge gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #060608, transparent)" }}
      />

      <div className="container-luxury">
        {/* Section header */}
        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="text-center mb-24"
        >
          <p className="museum-label mb-6">Section IV — Digital Museum</p>

          <h2 className="font-display text-[clamp(2.2rem,5.5vw,5rem)] font-bold text-[var(--text-primary)] mb-6">
            The{" "}
            <span className="text-gold-gradient">Exhibition Chambers</span>
          </h2>

          <p className="font-serif text-[1.1rem] text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed font-light">
            Five dedicated chambers. Each one a universe of craftsmanship, waiting to be explored.
          </p>

          <div className="mt-8 gold-divider max-w-xs mx-auto">
            <span className="museum-label">Select a Chamber</span>
          </div>
        </motion.div>

        {/* Chambers grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {CHAMBERS.map((chamber, i) => (
            <ChamberCard key={chamber.id} chamber={chamber} index={i} />
          ))}
        </div>

        {/* Featured quote */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-32 text-center max-w-3xl mx-auto"
        >
          <p className="font-serif text-[clamp(1.3rem,2.5vw,2rem)] text-[var(--text-secondary)] italic font-light leading-relaxed">
            &ldquo;Gold does not rust, does not tarnish, does not fade. It is the only material
            worthy of holding infinity.&rdquo;
          </p>
          <cite className="block mt-6 museum-label opacity-60 not-italic">
            — Master Goldsmith, House of Aurum
          </cite>
        </motion.blockquote>
      </div>

      {/* Bottom edge gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #060608)" }}
      />
    </section>
  );
}
