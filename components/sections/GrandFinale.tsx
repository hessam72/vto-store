"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

// Animated museum doors
function MuseumDoors() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Left door */}
      <motion.div
        initial={{ x: 0 }}
        whileInView={{ x: "-100%" }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 2.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-0 top-0 bottom-0 w-1/2"
        style={{ background: "linear-gradient(135deg, #0a0a10, #111120)" }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--gold-primary)] to-transparent opacity-50" />
        {/* Door panel details */}
        <div className="absolute inset-6 border border-[rgba(212,175,55,0.15)]" />
        <div className="absolute inset-10 border border-[rgba(212,175,55,0.08)]" />
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[var(--gold-primary)] opacity-60" />
      </motion.div>

      {/* Right door */}
      <motion.div
        initial={{ x: 0 }}
        whileInView={{ x: "100%" }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 2.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute right-0 top-0 bottom-0 w-1/2"
        style={{ background: "linear-gradient(225deg, #0a0a10, #111120)" }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--gold-primary)] to-transparent opacity-50" />
        {/* Door panel details */}
        <div className="absolute inset-6 border border-[rgba(212,175,55,0.15)]" />
        <div className="absolute inset-10 border border-[rgba(212,175,55,0.08)]" />
        <div className="absolute left-12 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[var(--gold-primary)] opacity-60" />
      </motion.div>
    </div>
  );
}

// Expanding golden light ray
function GoldenLightRay() {
  return (
    <motion.div
      initial={{ scaleY: 0, opacity: 0 }}
      whileInView={{ scaleY: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 2, delay: 2.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 pointer-events-none origin-top"
      style={{
        background:
          "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 50%, transparent 70%)",
      }}
    />
  );
}

export default function GrandFinale() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const contentY = useTransform(scrollYProgress, [0.2, 0.6], [80, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const smoothY = useSpring(contentY, { stiffness: 60, damping: 20 });

  const outerGlowSize = useTransform(scrollYProgress, [0.3, 0.8], ["0%", "120%"]);

  return (
    <section
      ref={sectionRef}
      id="finale"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "#060608" }}
    >
      {/* Museum doors open */}
      <MuseumDoors />

      {/* Golden light floods in */}
      <GoldenLightRay />

      {/* Radial expanding glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse var(--glow-size, 0%) var(--glow-size, 0%) at 50% 50%, rgba(212,175,55,0.08) 0%, transparent 70%)`,
        }}
      />

      {/* Main content */}
      <motion.div
        style={{ y: smoothY, opacity: contentOpacity }}
        className="relative z-10 text-center px-6 max-w-4xl mx-auto"
      >
        {/* Ornament */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, delay: 3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center gap-6 mb-12"
        >
          <span className="flex-1 h-px bg-gradient-to-l from-[var(--gold-primary)] to-transparent max-w-[120px]" />
          <svg
            viewBox="0 0 40 40"
            className="w-8 h-8 text-[var(--gold-primary)] animate-rotate-slow"
            fill="none"
          >
            <path
              d="M20 4 L24 16 L36 16 L26 24 L30 36 L20 28 L10 36 L14 24 L4 16 L16 16 Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="flex-1 h-px bg-gradient-to-r from-[var(--gold-primary)] to-transparent max-w-[120px]" />
        </motion.div>

        {/* Final headline */}
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 3.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold leading-tight mb-8"
          style={{ fontSize: "clamp(2.5rem, 6vw, 5.5rem)" }}
        >
          <span className="block text-[var(--text-primary)]">The Future of</span>
          <span className="block text-shimmer">Luxury Is</span>
          <span className="block text-[var(--text-primary)]">Experiential.</span>
        </motion.h2>

        {/* Body copy */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 3.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-[1.2rem] text-[var(--text-secondary)] font-light leading-relaxed max-w-xl mx-auto mb-14"
        >
          You have walked the corridors of gold. Witnessed the transformation. Felt the weight of artistry.
          Now, begin your own collection.
        </motion.p>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 3.8, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.button
            className="btn-primary text-sm py-4 px-10"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            Begin Your Journey
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>

          <motion.button
            className="btn-secondary text-sm py-4 px-10"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            Explore Collections
          </motion.button>
        </motion.div>

        {/* Signature */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, delay: 4.4 }}
          className="mt-20 flex flex-col items-center gap-4"
        >
          <div
            className="font-display text-4xl font-bold text-shimmer tracking-[0.5em]"
          >
            AURUM
          </div>
          <p className="museum-label opacity-40">Maison de Luxe — Est. MMXXV</p>
        </motion.div>
      </motion.div>

      {/* Floor glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold-primary), transparent)",
          opacity: 0.3,
        }}
      />
    </section>
  );
}
