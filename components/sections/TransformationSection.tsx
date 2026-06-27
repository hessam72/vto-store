"use client";

import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const TRANSFORMATION_STEPS = [
  {
    phase: "01",
    title: "The Artifact Awakens",
    body: "From the void of pure darkness, the gold takes shape. A singular form born from centuries of craftsmanship.",
  },
  {
    phase: "02",
    title: "Elements Emerge",
    body: "Rings. Bracelets. Necklaces. Each piece separates from the whole — a galaxy of gold expanding into the light.",
  },
  {
    phase: "03",
    title: "Stories Unfold",
    body: "Every curve, every edge tells a story. The metal remembers every hand that shaped it, every fire that tested it.",
  },
];

export default function TransformationSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const headingY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const opacity  = useTransform(scrollYProgress, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const items = sectionRef.current.querySelectorAll("[data-transform-step]");

    items.forEach((item, i) => {
      gsap.fromTo(
        item,
        { opacity: 0, x: i % 2 === 0 ? -60 : 60 },
        {
          opacity: 1,
          x: 0,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: item,
            start: "top 80%",
            end: "top 40%",
            scrub: 0.5,
          },
        }
      );
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative section-padding min-h-[200vh]"
      style={{
        background:
          "linear-gradient(180deg, #060608 0%, #0d0d14 40%, #111118 70%, #060608 100%)",
      }}
    >
      {/* Sticky title block */}
      <div className="sticky top-0 pt-20 pb-8 z-10 pointer-events-none">
        <motion.div
          style={{ y: headingY, opacity }}
          className="container-luxury text-center"
        >
          <p className="museum-label mb-4">Section II — Transformation</p>
          <h2 className="font-display text-[clamp(2rem,5vw,4.5rem)] font-bold text-[var(--text-primary)]">
            The Living{" "}
            <span className="text-gold-gradient">Metamorphosis</span>
          </h2>
        </motion.div>
      </div>

      {/* Step cards */}
      <div className="container-luxury mt-20 space-y-[40vh]">
        {TRANSFORMATION_STEPS.map((step, i) => (
          <div
            key={step.phase}
            data-transform-step
            className={`flex flex-col md:flex-row items-center gap-12 ${
              i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
            }`}
          >
            {/* Visual placeholder — in production, a Three.js portal here */}
            <div className="flex-1 relative">
              <div
                className="clip-gold-border relative overflow-hidden"
                style={{
                  aspectRatio: "4/3",
                  background: "linear-gradient(135deg, #0d0d14, #1a1a24)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* Animated gradient to suggest a 3D render */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse 70% 60% at ${
                      i === 0 ? "30% 50%" : i === 1 ? "70% 40%" : "50% 60%"
                    }, rgba(212,175,55,0.12) 0%, transparent 70%)`,
                  }}
                />
                {/* Placeholder glow orb */}
                <div
                  className="absolute rounded-full animate-pulse-gold"
                  style={{
                    width: "45%",
                    paddingBottom: "45%",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background:
                      "radial-gradient(circle, rgba(212,175,55,0.25), transparent 65%)",
                  }}
                />
                <div className="absolute bottom-4 left-4 museum-label opacity-50">
                  Phase {step.phase} — 3D Live
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-4">
                <span
                  className="font-display text-[4rem] font-bold leading-none"
                  style={{
                    WebkitTextStroke: "1px rgba(212,175,55,0.3)",
                    color: "transparent",
                  }}
                >
                  {step.phase}
                </span>
                <div className="w-px h-12 bg-[var(--border-default)]" />
                <span className="museum-label">Transformation</span>
              </div>

              <h3 className="font-display text-[clamp(1.5rem,3vw,2.5rem)] font-semibold text-[var(--text-primary)]">
                {step.title}
              </h3>

              <div className="w-16 h-px bg-gradient-to-r from-[var(--gold-primary)] to-transparent" />

              <p className="font-serif text-[1.1rem] text-[var(--text-secondary)] leading-relaxed font-light">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Transition gradient to next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #060608)" }}
      />
    </section>
  );
}
