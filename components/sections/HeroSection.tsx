"use client";

import { useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useScroll,
} from "framer-motion";

/* ─────────────────────────────────────────────────────────────
   Scroll section height — increase for more scroll room per
   second of video. 300vh ≈ comfortable for a 6-10s clip.
───────────────────────────────────────────────────────────── */
const SCROLL_HEIGHT = "300vh";

/* ─────────────────────────────────────────────────────────────
   Animation presets
───────────────────────────────────────────────────────────── */
const fadeUp = (delay: number) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] as const },
});
const fadeIn = (delay: number) => ({
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  transition: { duration: 1.2, delay, ease: "easeOut" as const },
});

/* ─────────────────────────────────────────────────────────────
   Gold dust particles — deterministic (no Math.random → no SSR
   hydration mismatch)
───────────────────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id:      i,
  left:    `${((i * 19 + 7) % 88) + 4}%`,
  top:     `${((i * 31 + 13) % 72) + 6}%`,
  size:    1.3 + (i % 4) * 0.65,
  dur:     3.8 + (i % 6) * 1.05,
  delay:   (i % 9) * 0.42,
  opacity: 0.28 + (i % 4) * 0.14,
}));

/* ─────────────────────────────────────────────────────────────
   Feature bar
───────────────────────────────────────────────────────────── */
const STATS = [
  { icon: "◆", title: "مجموعه‌های نادر",    value: "۲۵۰+ اثر"  },
  { icon: "◈", title: "سالن‌های نمایش",     value: "۱۲+ گالری" },
  { icon: "◎", title: "امنیت و حریم خصوصی", value: "سطح بالا"  },
];

/* ═══════════════════════════════════════════════════════════
   HeroSection
═══════════════════════════════════════════════════════════ */
export default function HeroSection() {
  const router = useRouter();

  /* ── Refs ──────────────────────────────────────────────── */
  const scrollContainerRef = useRef<HTMLDivElement>(null); // 300vh tall
  const stickyFrameRef     = useRef<HTMLDivElement>(null); // sticky 100svh
  const videoRef           = useRef<HTMLVideoElement>(null);

  /* ── Mouse parallax (applied to video layer for subtle depth) */
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx   = useSpring(rawX, { stiffness: 52, damping: 22 });
  const my   = useSpring(rawY, { stiffness: 52, damping: 22 });
  const vidX = useTransform(mx, [-1, 1], [-10, 10]);
  const vidY = useTransform(my, [-1, 1],  [-6,  6]);

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = stickyFrameRef.current?.getBoundingClientRect();
    if (!r) return;
    rawX.set(((e.clientX - r.left) / r.width)  * 2 - 1);
    rawY.set(((e.clientY - r.top)  / r.height) * 2 - 1);
  }, [rawX, rawY]);

  const handleLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  /* ── Scroll progress (0 → 1 across the 300vh container) ── */
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"],
  });

  /* ── RAF loop: map scroll progress → video.currentTime ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;

    const sync = () => {
      // readyState ≥ 2 (HAVE_CURRENT_DATA) means the browser can seek
      if (video.readyState >= 2 && video.duration) {
        const target = scrollYProgress.get() * video.duration;
        // Skip micro-updates smaller than one frame (~16 ms at 60fps)
        if (Math.abs(video.currentTime - target) > 0.016) {
          video.currentTime = target;
        }
      }
      rafId = requestAnimationFrame(sync);
    };

    rafId = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(rafId);
  }, [scrollYProgress]);

  /* ── Render ────────────────────────────────────────────── */
  return (
    /*
      Outer div — the scroll container.
      Height = SCROLL_HEIGHT (300vh). Scrolling through it drives
      the video from t=0 to t=duration.
    */
    <div
      ref={scrollContainerRef}
      className="relative w-screen"
      style={{ height: SCROLL_HEIGHT }}
    >

      {/*
        Sticky frame — stays pinned to the top of the viewport
        while the user scrolls through the 300vh container.
        All UI lives inside this frame.
      */}
      <div
        ref={stickyFrameRef}
        dir="rtl"
        aria-label="صفحه اصلی شهر امید"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="sticky top-0 w-full overflow-hidden bg-[#060606]"
        style={{ height: "100svh", minHeight: "100vh" }}
      >

        {/* ════════════════════════════════════════════════
            LAYER 0 — SCROLL-CONTROLLED FULL-SCREEN VIDEO
            Replaces the jewelry.png / 3D model.
            currentTime is driven entirely by scroll position;
            no autoplay, no loop — scroll IS the playhead.
        ════════════════════════════════════════════════ */}
        <motion.div
          className="absolute inset-0 z-[1]"
          style={{
            x:     vidX,   // subtle mouse parallax
            y:     vidY,
            scale: 1.06,   // slight over-scale hides parallax edges
          }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            src="/hero.mp4"
            muted
            playsInline
            preload="auto"
            // No autoplay — scroll controls currentTime
            // No loop   — scroll direction controls forward/backward
          />
        </motion.div>

        {/* ════════════════════════════════════════════════
            LAYER 1 — DARK OVERLAYS
            Identical to the previous version; ensure text
            remains readable over any video content.
        ════════════════════════════════════════════════ */}
        <motion.div {...fadeIn(0)} className="absolute inset-0 z-[2] pointer-events-none">
          {/* Right-side veil — text contrast */}
          <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to left, rgba(5,4,2,0.92) 0%, rgba(5,4,2,0.72) 20%, rgba(5,4,2,0.18) 52%, transparent 100%)",
          }} />
          {/* Top + bottom vignette */}
          <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to bottom, rgba(6,6,6,0.55) 0%, transparent 20%, transparent 68%, rgba(6,6,6,0.88) 100%)",
          }} />
          {/* Emerald left accent */}
          <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to right, rgba(14,50,44,0.45) 0%, rgba(14,50,44,0.10) 38%, transparent 60%)",
          }} />
          {/* Mobile extra veil */}
          <div className="absolute inset-0 md:hidden" style={{ background: "rgba(5,4,2,0.22)" }} />
        </motion.div>

        {/* ════════════════════════════════════════════════
            LAYER 2 — CINEMATIC LIGHT SWEEP
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[3]">
          <motion.div
            className="absolute top-0 bottom-0"
            style={{
              width: "36%",
              skewX: "-14deg",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.030) 40%, rgba(255,240,140,0.050) 55%, rgba(212,175,55,0.030) 70%, transparent 100%)",
            }}
            animate={{ x: ["-130%", "380%"] }}
            transition={{ duration: 10, repeat: Infinity, repeatDelay: 7, ease: "linear" }}
          />
        </div>

        {/* ════════════════════════════════════════════════
            LAYER 3 — GOLD DUST PARTICLES
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 pointer-events-none z-[4]">
          {PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left:       p.left,
                top:        p.top,
                width:      `${p.size}px`,
                height:     `${p.size}px`,
                background: "#D4AF37",
                boxShadow:  `0 0 ${p.size * 3.5}px rgba(212,175,55,0.85)`,
              }}
              animate={{
                y:       [0, -32, 0],
                opacity: [0, p.opacity, 0],
                scale:   [0.5, 1.3, 0.5],
              }}
              transition={{
                duration: p.dur,
                delay:    p.delay,
                repeat:   Infinity,
                ease:     "easeInOut",
              }}
            />
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            LAYER 5 — TEXT BLOCK (right side, RTL)
            Unchanged from previous implementation.
        ════════════════════════════════════════════════ */}
        <div className="hero-text">

          {/* Label — centered row with flanking lines */}
          <motion.div {...fadeUp(0.5)} className="flex items-center justify-center gap-3 mb-5 md:mb-7">
            <span
              className="block w-8 h-px flex-shrink-0"
              style={{ background: "rgba(212, 175, 55, 0.9)" }}
            />
            <p
              className="font-persian text-[#D4AF37] text-[0.58rem] md:text-[0.64rem] tracking-[0.32em]"
              style={{ opacity: 1 }}
            >
              به ویترین مجازی شهر امید خوش آمدید
            </p>
            <span
              className="block w-8 h-px flex-shrink-0"
              style={{ background: "rgba(212, 175, 55, 0.8)" }}
            />
          </motion.div>

          {/* Heading — centered gold title */}
          <motion.h1
            {...fadeUp(0.65)}
            className="font-persian font-bold leading-[1.08] mb-4 md:mb-5"
            style={{ textAlign: "center" }}
          >
            {/* <span
              className="block mb-2"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3.2rem)",
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "0.06em",
              }}
            >
              زیبایی را پیش از خرید تجربه کنید
            </span> */}
            <span
              className="block"
              style={{
                fontSize:             "clamp(3.2rem, 8.5vw, 9rem)",
                background:           "linear-gradient(135deg, #c9a227 0%, #ffd700 35%, #fffacd 52%, #e8c84a 66%, #b8860b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
                letterSpacing:        "0.08em",
              }}
            >
              شهر امید
            </span>
          </motion.h1>

          {/* Gold accent line — centered */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.85, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5 md:mb-7 h-px w-16 md:w-20 origin-center"
            style={{
              background: "linear-gradient(to right, transparent, #D4AF37 40%, #D4AF37 60%, transparent)",
            }}
          />

          {/* Subtitle — centered */}
          <motion.p
            {...fadeUp(0.9)}
            className="font-persian font-light leading-[2.1]"
            style={{
              fontSize:  "clamp(0.76rem, 1.3vw, 1.0rem)",
              color:     "rgba(255, 255, 255, 0.99)",
              maxWidth:  "36ch",
              textAlign: "center",
            }}
          >
            نمایشگاه سه‌بعدی و امتحان مجازی جواهرات؛ هر قطعه را پیش از خرید، روی خود ببینید.
          </motion.p>
        </div>

        {/* ════════════════════════════════════════════════
            PILL CTA — pinned to bottom-center of the frame
            Lifted above the stats bar (bottom: 88px)
        ════════════════════════════════════════════════ */}
        <motion.div
          {...fadeUp(1.15)}
          className="hero-cta-anchor"
        >
          <motion.button
            onClick={() => router.push("/museum")}
            whileHover={{
              boxShadow:
                "0 0 80px rgba(212,175,55,0.55), 0 0 36px rgba(212,175,55,0.35), 0 10px 44px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,232,90,0.42), inset 0 -1px 0 rgba(130,88,0,0.48)",
              borderColor: "rgba(255,220,60,1.0)",
              y: -3,
              scale: 1.03,
            }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden font-persian font-semibold flex items-center justify-center gap-3 group"
            style={{
              padding:              "0.85rem 2.8rem",
              border:               "1.5px solid rgba(212,175,55,0.75)",
              borderRadius:         "9999px",
              background:           "rgba(10,7,1,0.72)",
              backdropFilter:       "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              boxShadow:
                "0 0 40px rgba(212,175,55,0.22), 0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,218,70,0.20), inset 0 -1px 0 rgba(110,72,0,0.35)",
              color:         "#D4AF37",
              fontSize:      "0.85rem",
              letterSpacing: "0.08em",
              minWidth:      "180px",
            }}
          >
            {/* Continuous shimmer on the border — keyframe via motion */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[9999px]"
              style={{
                background:
                  "linear-gradient(105deg, transparent 20%, rgba(255,232,100,0.10) 45%, rgba(255,248,160,0.22) 55%, transparent 80%)",
              }}
              animate={{ x: ["-120%", "220%"] }}
              transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" }}
            />
            {/* RTL arrow */}
            <svg
              className="relative w-4 h-4 flex-shrink-0 transition-transform duration-500 group-hover:-translate-x-1"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M13 8H3M7 4l-4 4 4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="relative">ورود به موزه</span>
          </motion.button>
        </motion.div>

        {/* ════════════════════════════════════════════════
            GOLD VERTICAL LINE — desktop right edge
        ════════════════════════════════════════════════ */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 1.5, delay: 1.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-16 bottom-16 right-0 w-px hidden md:block origin-top z-[21]"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(212,175,55,0.52) 25%, rgba(212,175,55,0.52) 75%, transparent)",
          }}
        />

        {/* ════════════════════════════════════════════════
            SCROLL INDICATOR — desktop only
        ════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.1, duration: 1.2 }}
          className="absolute bottom-[76px] left-8 hidden md:flex items-center gap-3 pointer-events-none z-[21]"
        >
          <div
            className="relative w-px h-10"
            style={{ background: "rgba(212,175,55,0.16)" }}
          >
            <motion.div
              className="absolute top-0 left-0 w-full"
              style={{ background: "#D4AF37" }}
              animate={{ height: ["0%", "100%"] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <p
            className="font-persian text-[0.5rem] tracking-[0.22em] rotate-90 origin-left whitespace-nowrap"
            style={{ color: "rgba(212,175,55,0.36)" }}
          >
            برای کشف بیشتر اسکرول کنید
          </p>
        </motion.div>

        {/* ════════════════════════════════════════════════
            STATS / FEATURE BAR
        ════════════════════════════════════════════════ */}
        <motion.div
          {...fadeIn(1.7)}
          className="absolute bottom-0 left-0 right-0 z-[30]"
          style={{
            background:           "rgba(5,4,2,0.90)",
            backdropFilter:       "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop:            "1px solid rgba(212,175,55,0.13)",
          }}
        >
          <div
            className="w-full h-px"
            style={{
              background:
                "linear-gradient(to right, transparent 4%, rgba(212,175,55,0.30) 28%, rgba(212,175,55,0.30) 72%, transparent 96%)",
            }}
          />
          <div className="flex flex-row-reverse items-stretch">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.title}
                whileHover={{ background: "rgba(212,175,55,0.055)" }}
                transition={{ duration: 0.28 }}
                className={`
                  flex-1 flex flex-col items-center justify-center gap-1
                  py-3 px-2 md:py-5 md:px-6 text-center cursor-default
                  ${i < STATS.length - 1 ? "border-l border-[rgba(212,175,55,0.10)]" : ""}
                `}
              >
                <motion.span
                  whileHover={{ scale: 1.2 }}
                  transition={{ duration: 0.32 }}
                  className="block leading-none"
                  style={{ color: "#D4AF37", fontSize: "0.68rem", opacity: 0.82 }}
                >
                  {stat.icon}
                </motion.span>
                <p
                  className="font-persian font-medium leading-tight text-white/62 px-1"
                  style={{ fontSize: "clamp(0.52rem, 1.15vw, 0.70rem)" }}
                >
                  {stat.title}
                </p>
                <p
                  className="font-persian"
                  style={{
                    fontSize:      "clamp(0.50rem, 1.05vw, 0.65rem)",
                    color:         "rgba(212,175,55,0.74)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {stat.value}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>{/* /sticky frame */}
    </div>  /* /scroll container */
  );
}
