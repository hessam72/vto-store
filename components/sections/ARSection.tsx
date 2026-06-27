"use client";

import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const AR_FEATURES = [
  {
    icon: "◈",
    title: "Real-Time Overlay",
    body: "See jewelry mapped perfectly to your body using advanced depth sensing and ML pose estimation.",
  },
  {
    icon: "◇",
    title: "True-to-Life Scale",
    body: "Every piece renders at exact physical dimensions. What you see is precisely what you receive.",
  },
  {
    icon: "◈",
    title: "360° Inspection",
    body: "Rotate around any piece. Examine the clasp, the engraving, the stone setting — from every angle.",
  },
  {
    icon: "◎",
    title: "Material Fidelity",
    body: "PBR materials replicate the exact surface properties of gold alloys, gemstones, and patinas.",
  },
];

// Floating device mockup — CSS-only, no image assets required
function PhoneMockup({ delay = 0, rotateY = 0, x = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 80, rotateY: rotateY - 20 }}
      whileInView={{ opacity: 1, y: 0, rotateY }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000, x }}
      className="relative"
    >
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
        style={{
          transformStyle: "preserve-3d",
          rotateY,
        }}
      >
        {/* Phone body */}
        <div
          className="relative w-[160px] h-[320px] rounded-[2.4rem] flex flex-col items-center overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #1a1a24, #0d0d14)",
            border: "1.5px solid rgba(212,175,55,0.3)",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.12), inset 0 1px 1px rgba(255,255,255,0.06)",
          }}
        >
          {/* Notch */}
          <div className="w-16 h-5 bg-[#0a0a10] rounded-b-2xl mt-3 flex items-center justify-center">
            <div className="w-2 h-2 bg-[#1a1a24] rounded-full" />
          </div>

          {/* Screen content — AR visualization placeholder */}
          <div
            className="flex-1 w-full flex items-center justify-center relative overflow-hidden"
            style={{
              background: "radial-gradient(ellipse at 50% 60%, rgba(212,175,55,0.15), #080810)",
            }}
          >
            {/* Simulated hand silhouette */}
            <div
              className="absolute bottom-0 w-full h-40 opacity-20"
              style={{
                background:
                  "linear-gradient(to top, rgba(200,170,100,0.5), transparent)",
                borderRadius: "60% 60% 0 0 / 40% 40% 0 0",
              }}
            />

            {/* Floating ring indicator */}
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="relative"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  border: "2px solid var(--gold-primary)",
                  boxShadow: "0 0 20px rgba(212,175,55,0.4)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-full"
                  style={{
                    border: "1px solid rgba(212,175,55,0.5)",
                    background:
                      "radial-gradient(circle, rgba(212,175,55,0.3), transparent)",
                  }}
                />
              </div>
              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[var(--gold-primary)] animate-pulse" />
            </motion.div>

            {/* AR corner indicators */}
            {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map(
              (pos) => (
                <div
                  key={pos}
                  className={`absolute ${pos} w-5 h-5 opacity-60`}
                  style={{
                    borderTop: pos.includes("top") ? "1.5px solid var(--gold-primary)" : "none",
                    borderBottom: pos.includes("bottom") ? "1.5px solid var(--gold-primary)" : "none",
                    borderLeft: pos.includes("left") ? "1.5px solid var(--gold-primary)" : "none",
                    borderRight: pos.includes("right") ? "1.5px solid var(--gold-primary)" : "none",
                  }}
                />
              )
            )}
          </div>

          {/* Bottom bar */}
          <div className="w-10 h-1 bg-[rgba(212,175,55,0.3)] rounded-full my-3" />
        </div>

        {/* Glow beneath */}
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[120px] h-8 rounded-full blur-xl"
          style={{ background: "rgba(212,175,55,0.25)" }}
        />
      </motion.div>
    </motion.div>
  );
}

export default function ARSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const headerY = useTransform(scrollYProgress, [0, 0.4], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const features = sectionRef.current.querySelectorAll("[data-ar-feature]");
    features.forEach((el, i) => {
      gsap.fromTo(
        el,
        { opacity: 0, x: 40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          delay: i * 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
        }
      );
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      id="ar"
      className="relative section-padding overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #060608 0%, #0a0a10 30%, #060608 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container-luxury">
        {/* Header */}
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="text-center mb-24"
        >
          <p className="museum-label mb-6">Section V — AR Experience</p>
          <h2 className="font-display text-[clamp(2.2rem,5.5vw,5rem)] font-bold text-[var(--text-primary)] mb-6">
            Try Before{" "}
            <span className="text-gold-gradient">You Cherish</span>
          </h2>
          <p className="font-serif text-[1.1rem] text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed font-light">
            Advanced augmented reality lets you visualize every piece on yourself — before you commit to a lifetime.
          </p>
        </motion.div>

        {/* Main layout: devices + features */}
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          {/* Phone mockups */}
          <div className="flex-1 flex items-end justify-center gap-6 min-h-[420px]">
            <PhoneMockup delay={0.1} rotateY={-8} x={-10} />
            <div className="mb-12">
              <PhoneMockup delay={0.25} rotateY={0} />
            </div>
            <PhoneMockup delay={0.4} rotateY={8} x={10} />
          </div>

          {/* Feature list */}
          <div className="flex-1 space-y-8">
            {AR_FEATURES.map((feat, i) => (
              <div key={feat.title} data-ar-feature className="flex gap-6 items-start">
                <div
                  className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-[1.4rem]"
                  style={{
                    color: "var(--gold-primary)",
                    border: "1px solid var(--border-subtle)",
                    background: "rgba(212,175,55,0.04)",
                  }}
                >
                  {feat.icon}
                </div>
                <div>
                  <h4 className="font-display text-[1rem] font-semibold text-[var(--text-primary)] mb-2 tracking-wide">
                    {feat.title}
                  </h4>
                  <p className="font-serif text-[0.95rem] text-[var(--text-secondary)] leading-relaxed font-light">
                    {feat.body}
                  </p>
                </div>
              </div>
            ))}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="pt-4 flex flex-col sm:flex-row gap-4"
            >
              <button className="btn-primary">
                Start Virtual Try-On
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="2" fill="currentColor" />
                </svg>
              </button>
              <button className="btn-secondary">Watch Demo</button>
            </motion.div>
          </div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-subtle)]"
          style={{ border: "1px solid var(--border-subtle)" }}
        >
          {[
            { value: "99.7%", label: "Accuracy Rate" },
            { value: "< 2ms", label: "Render Latency" },
            { value: "4K", label: "Resolution Output" },
            { value: "360°", label: "Inspection Range" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center py-8 px-4 text-center"
              style={{ background: "#0a0a10" }}
            >
              <span className="font-display text-[2rem] font-bold text-gold-gradient block">
                {stat.value}
              </span>
              <span className="museum-label mt-2 opacity-60">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #060608)" }}
      />
    </section>
  );
}
