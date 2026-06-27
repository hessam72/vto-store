"use client";

import { useRef, useCallback, useEffect, useState } from "react";
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

/* ─────────────────────────────────────────────────────────────
   Logo Component
───────────────────────────────────────────────────────────── */
function ShahrOmidLogo() {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/images/shahr-omid-logo.png"
        alt="شهر امید"
        style={{
          width: '13rem',
          height: 'auto',
          marginTop: '1rem',
          filter: "brightness(1.15) contrast(1.08) saturate(1.1)",
        }}
        onError={() => setImgFailed(true)}
        className="h-12 md:h-16 w-auto object-contain"
      />
    );
  }

  // Text fallback
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-3">
        <span className="font-persian font-bold text-[0.65rem] md:text-[0.72rem] tracking-[0.28em] uppercase" style={{
          color: "#ffd700",
          textShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
          opacity: 0.8,
        }}>
          MUSEUM
        </span>
        <svg viewBox="0 0 20 20" className="w-[22px] h-[22px] md:w-[26px] md:h-[26px]" fill="none">
          <path
            d="M10 2L3 8l7 10 7-10L10 2z"
            stroke="#ffd700"
            strokeWidth="1.5"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(255, 215, 0, 0.6))" }}
          />
          <path d="M3 8h14" stroke="#ffd700" strokeWidth="1.2" opacity="0.6" />
        </svg>
      </div>
      <span className="font-persian font-bold text-[1.3rem] md:text-[1.6rem] tracking-[0.25em]" style={{
        background: "linear-gradient(135deg, #c9a227 0%, #ffd700 35%, #fffacd 52%, #ffd700 65%, #b8860b 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 0 15px rgba(255, 215, 0, 0.4))",
      }}>
        شهر امید
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HeroSection
═══════════════════════════════════════════════════════════ */
export default function HeroSection() {
  const router = useRouter();

  /* ── Refs ──────────────────────────────────────────────── */
  const scrollContainerRef = useRef<HTMLDivElement>(null); // 300vh tall
  const stickyFrameRef     = useRef<HTMLDivElement>(null); // sticky 100svh
  const videoRef           = useRef<HTMLVideoElement>(null);
  const canvasRef          = useRef<HTMLCanvasElement>(null);

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

  /* ── Smooth spring for scroll progress ── */
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    mass: 0.5,
  });

  /* ── Scroll-based animations ── */
  // Logo: starts center, moves to top (0 → 0.2)
  const logoY = useTransform(scrollYProgress, [0, 0.2], ["50vh", "0vh"]);
  const logoScale = useTransform(scrollYProgress, [0, 0.2], [1.5, 1]);

  // Hero content: staggered reveal, stays visible
  const labelOpacity = useTransform(scrollYProgress, [0, 0.2, 0.3, 1], [0, 0, 1, 1]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.35, 0.45, 1], [0, 0, 1, 1]);
  const ornamentOpacity = useTransform(scrollYProgress, [0, 0.5, 0.6, 1], [0, 0, 1, 1]);
  const subtitleOpacity = useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [0, 0, 1, 1]);

  // CTA button: fades in at end
  const ctaOpacity = useTransform(scrollYProgress, [0, 0.8, 0.95, 1], [0, 0, 1, 1]);

  /* ── Canvas rendering with throttled video seeks ── */
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let rafId: number;

    const drawFrame = () => {
      if (video.readyState >= 2 && video.duration) {
        const progress = smoothProgress.get();
        const targetTime = progress * video.duration;

        // Only seek video if we're far enough from target (reduces seek operations by ~70%)
        const timeDiff = Math.abs(video.currentTime - targetTime);
        if (timeDiff > 0.1) {
          video.currentTime = targetTime;
        }

        // Always draw current video frame to canvas for smooth visuals
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      rafId = requestAnimationFrame(drawFrame);
    };

    // Wait for video metadata to set canvas dimensions
    const onMetadata = () => {
      // Set canvas resolution based on viewport (lower on mobile for performance)
      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 0.7 : 1;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;

      rafId = requestAnimationFrame(drawFrame);
    };

    if (video.readyState >= 1) {
      onMetadata();
    } else {
      video.addEventListener("loadedmetadata", onMetadata);
    }

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener("loadedmetadata", onMetadata);
    };
  }, [smoothProgress]);

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
            LOGO — Scroll-controlled position (center → top)
        ════════════════════════════════════════════════ */}
        <motion.div
          className="absolute left-1/2 z-[100] pointer-events-none"
          style={{
            y: logoY,
            scale: logoScale,
            x: "-50%",
            transformOrigin: "center center",
          }}
        >
          <ShahrOmidLogo />
        </motion.div>

        {/* ════════════════════════════════════════════════
            LAYER 0 — SCROLL-CONTROLLED VIDEO via CANVAS
            Video element hidden but kept in DOM for decoding.
            Canvas displays frames with smooth interpolation.
            Reduces seek operations by ~70% for mobile performance.
        ════════════════════════════════════════════════ */}
        {/* Hidden video - source for canvas */}
        <video
          ref={videoRef}
          className="absolute invisible pointer-events-none"
          src="/hero.mp4"
          muted
          playsInline
          preload="auto"
        />

        {/* Visible canvas - renders video frames smoothly */}
        <motion.div
          className="absolute inset-0 z-[1]"
          style={{
            x:     vidX,   // subtle mouse parallax
            y:     vidY,
            scale: 1.06,   // slight over-scale hides parallax edges
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </motion.div>

        {/* ════════════════════════════════════════════════
            LAYER 1 — DARK OVERLAYS
            Identical to the previous version; ensure text
            remains readable over any video content.
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 z-[2] pointer-events-none">
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
        </div>

        {/* ════════════════════════════════════════════════
            LAYER 2 — CINEMATIC LIGHT SWEEP
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[3]">
          <motion.div
            className="absolute top-0 bottom-0"
            style={{
              width: "40%",
              skewX: "-16deg",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.04) 35%, rgba(255,240,140,0.08) 50%, rgba(255,250,205,0.10) 55%, rgba(255,240,140,0.08) 65%, rgba(212,175,55,0.04) 80%, transparent 100%)",
            }}
            animate={{ x: ["-140%", "400%"] }}
            transition={{ duration: 12, repeat: Infinity, repeatDelay: 8, ease: "linear" }}
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
                y:       [0, -38, 0],
                opacity: [0, p.opacity * 1.2, 0],
                scale:   [0.4, 1.5, 0.4],
              }}
              transition={{
                duration: p.dur * 1.15,
                delay:    p.delay,
                repeat:   Infinity,
                ease:     [0.45, 0.05, 0.55, 0.95],
              }}
            />
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            LAYER 5 — TEXT BLOCK (scroll-controlled staggered reveal)
        ════════════════════════════════════════════════ */}
        <div className="hero-text">

          {/* Label — centered row with flanking lines */}
          <motion.div
            className="flex items-center justify-center gap-4 mb-6 md:mb-8"
            style={{ opacity: labelOpacity }}
          >
            <span
              className="block w-10 md:w-12 h-[1.5px] flex-shrink-0"
              style={{
                background: "linear-gradient(to right, transparent, rgba(212, 175, 55, 0.8) 50%, transparent)",
                boxShadow: "0 0 8px rgba(212, 175, 55, 0.3)"
              }}
            />
            <p
              className="font-persian text-[0.62rem] md:text-[0.68rem] tracking-[0.35em] uppercase"
              style={{
                color: "#ffd700",
                textShadow: "0 0 20px rgba(212, 175, 55, 0.6), 0 0 40px rgba(212, 175, 55, 0.3)",
                opacity: 0.95,
              }}
            >
              به ویترین مجازی شهر امید خوش آمدید
            </p>
            <span
              className="block w-10 md:w-12 h-[1.5px] flex-shrink-0"
              style={{
                background: "linear-gradient(to left, transparent, rgba(212, 175, 55, 0.8) 50%, transparent)",
                boxShadow: "0 0 8px rgba(212, 175, 55, 0.3)"
              }}
            />
          </motion.div>

          {/* Heading — centered gold title */}
          <motion.h1
            className="font-persian font-bold leading-[1.15] mb-5 md:mb-6"
            style={{ textAlign: "center", opacity: titleOpacity }}
          >
            <span
              className="block"
              style={{
                fontSize: "clamp(3.6rem, 9vw, 10rem)",
                background: "linear-gradient(135deg, #c9a227 0%, #ffd700 25%, #fffacd 45%, #fff 52%, #fffacd 60%, #ffd700 75%, #b8860b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "0.12em",
                filter: "drop-shadow(0 0 40px rgba(255, 215, 0, 0.4)) drop-shadow(0 4px 20px rgba(0, 0, 0, 0.6))",
                position: "relative",
              }}
            >
              شهر امید
            </span>
          </motion.h1>

          {/* Gold accent ornament — centered */}
          <motion.div
            className="mb-6 md:mb-8 flex items-center gap-2 origin-center"
            style={{ opacity: ornamentOpacity }}
          >
            <span className="w-1 h-1 rounded-full bg-[#D4AF37]" style={{ boxShadow: "0 0 8px rgba(212, 175, 55, 0.8)" }} />
            <div
              className="h-[2px] w-20 md:w-28"
              style={{
                background: "linear-gradient(to right, transparent, #ffd700 30%, #fffacd 50%, #ffd700 70%, transparent)",
                boxShadow: "0 0 12px rgba(255, 215, 0, 0.5)",
              }}
            />
            <svg width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0">
              <path d="M8 2L10 6L14 6L11 9L12 14L8 11L4 14L5 9L2 6L6 6Z" fill="#ffd700" opacity="0.9" />
            </svg>
            <div
              className="h-[2px] w-20 md:w-28"
              style={{
                background: "linear-gradient(to left, transparent, #ffd700 30%, #fffacd 50%, #ffd700 70%, transparent)",
                boxShadow: "0 0 12px rgba(255, 215, 0, 0.5)",
              }}
            />
            <span className="w-1 h-1 rounded-full bg-[#D4AF37]" style={{ boxShadow: "0 0 8px rgba(212, 175, 55, 0.8)" }} />
          </motion.div>

          {/* Subtitle — centered */}
          <motion.p
            className="font-persian font-light leading-[2.2]"
            style={{
              fontSize: "clamp(0.82rem, 1.4vw, 1.08rem)",
              color: "rgba(245, 240, 232, 0.85)",
              maxWidth: "42ch",
              textAlign: "center",
              textShadow: "0 2px 16px rgba(0, 0, 0, 0.6)",
              letterSpacing: "0.02em",
              opacity: subtitleOpacity,
            }}
          >
            نمایشگاه سه‌بعدی و امتحان مجازی جواهرات؛ هر قطعه را پیش از خرید، روی خود ببینید.
          </motion.p>
        </div>

        {/* ════════════════════════════════════════════════
            PILL CTA — Bottom center, scroll-controlled reveal
            Fades in at 80-95% scroll progress
        ════════════════════════════════════════════════ */}
        <motion.div
          className="hero-cta-anchor"
          style={{ opacity: ctaOpacity }}
        >
          <motion.button
            onClick={() => router.push("/store")}
            whileHover={{
              boxShadow:
                "0 0 100px rgba(255,215,0,0.6), 0 0 50px rgba(212,175,55,0.4), 0 12px 48px rgba(0,0,0,0.75), inset 0 2px 0 rgba(255,250,205,0.5), inset 0 -2px 0 rgba(184,134,11,0.6)",
              borderColor: "rgba(255,235,100,1.0)",
              y: -4,
              scale: 1.05,
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden font-persian font-bold flex items-center justify-center gap-3 group pointer-events-auto"
            style={{
              padding: "1rem 3.2rem",
              border: "2px solid rgba(212,175,55,0.85)",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, rgba(10,7,1,0.85) 0%, rgba(20,15,2,0.75) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              boxShadow:
                "0 0 60px rgba(212,175,55,0.3), 0 6px 32px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,235,120,0.25), inset 0 -2px 0 rgba(130,88,0,0.4)",
              color: "#ffd700",
              fontSize: "0.9rem",
              letterSpacing: "0.1em",
              minWidth: "200px",
              textShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
            }}
          >
            {/* Continuous shimmer on the border */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[9999px]"
              style={{
                background:
                  "linear-gradient(105deg, transparent 15%, rgba(255,250,205,0.15) 40%, rgba(255,248,160,0.35) 52%, rgba(255,250,205,0.15) 65%, transparent 85%)",
              }}
              animate={{ x: ["-140%", "240%"] }}
              transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
            />
            {/* RTL arrow */}
            <svg
              className=" relative w-5 h-5 flex-shrink-0 transition-transform duration-500 group-hover:-translate-x-2"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M13 8H3M7 4l-4 4 4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="relative tracking-wider">ورود به گالری</span>
          </motion.button>
        </motion.div>

        {/* ════════════════════════════════════════════════
            DECORATIVE CORNER ORNAMENTS — Persian-inspired
        ════════════════════════════════════════════════ */}
        {/* Top-right corner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-4 right-4 md:top-8 md:right-8 w-12 h-12 md:w-16 md:h-16 hidden md:block z-[21] pointer-events-none"
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-40">
            <path d="M64 0 L64 20 C64 35 50 45 35 45 L20 45" stroke="#ffd700" strokeWidth="1.5" opacity="0.6" />
            <path d="M64 0 L64 12 C64 22 56 28 46 28 L32 28" stroke="#ffd700" strokeWidth="1" opacity="0.4" />
            <circle cx="60" cy="4" r="2" fill="#ffd700" opacity="0.7" />
            <circle cx="54" cy="10" r="1.5" fill="#d4af37" opacity="0.5" />
          </svg>
        </motion.div>

        {/* Top-left corner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-4 left-4 md:top-8 md:left-8 w-12 h-12 md:w-16 md:h-16 hidden md:block z-[21] pointer-events-none"
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-40">
            <path d="M0 0 L0 20 C0 35 14 45 29 45 L44 45" stroke="#ffd700" strokeWidth="1.5" opacity="0.6" />
            <path d="M0 0 L0 12 C0 22 8 28 18 28 L32 28" stroke="#ffd700" strokeWidth="1" opacity="0.4" />
            <circle cx="4" cy="4" r="2" fill="#ffd700" opacity="0.7" />
            <circle cx="10" cy="10" r="1.5" fill="#d4af37" opacity="0.5" />
          </svg>
        </motion.div>

        {/* GOLD VERTICAL LINE — desktop right edge */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 1.8, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-20 bottom-20 right-0 w-[2px] hidden md:block origin-top z-[21]"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(255,215,0,0.25) 15%, rgba(212,175,55,0.6) 50%, rgba(255,215,0,0.25) 85%, transparent)",
            boxShadow: "0 0 12px rgba(255, 215, 0, 0.3)",
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
        {/* <motion.div
          {...fadeIn(1.7)}
          className="absolute bottom-0 left-0 right-0 z-[30]"
          style={{
            background: "linear-gradient(to top, rgba(6,5,3,0.95) 0%, rgba(8,7,4,0.88) 100%)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            borderTop: "1.5px solid rgba(212,175,55,0.18)",
            boxShadow: "0 -4px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 215, 0, 0.08)",
          }}
        >
          <div
            className="w-full h-[2px]"
            style={{
              background:
                "linear-gradient(to right, transparent 2%, rgba(255,215,0,0.15) 15%, rgba(255,215,0,0.45) 50%, rgba(255,215,0,0.15) 85%, transparent 98%)",
              boxShadow: "0 0 16px rgba(255, 215, 0, 0.3)",
            }}
          />
          <div className="flex flex-row-reverse items-stretch">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.title}
                whileHover={{
                  background: "rgba(212,175,55,0.08)",
                  boxShadow: "inset 0 0 30px rgba(255, 215, 0, 0.12)",
                }}
                transition={{ duration: 0.35 }}
                className={`
                  flex-1 flex flex-col items-center justify-center gap-1.5
                  py-4 px-2 md:py-6 md:px-6 text-center cursor-default
                  ${i < STATS.length - 1 ? "border-l border-[rgba(212,175,55,0.15)]" : ""}
                `}
              >
                <motion.span
                  whileHover={{ scale: 1.3, rotate: 180 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="block leading-none"
                  style={{
                    color: "#ffd700",
                    fontSize: "0.75rem",
                    opacity: 0.9,
                    textShadow: "0 0 12px rgba(255, 215, 0, 0.5)",
                  }}
                >
                  {stat.icon}
                </motion.span>
                <p
                  className="font-persian font-medium leading-tight px-1"
                  style={{
                    fontSize: "clamp(0.56rem, 1.2vw, 0.74rem)",
                    color: "rgba(245, 240, 232, 0.7)",
                  }}
                >
                  {stat.title}
                </p>
                <p
                  className="font-persian font-semibold"
                  style={{
                    fontSize: "clamp(0.54rem, 1.1vw, 0.68rem)",
                    color: "rgba(255,215,0,0.85)",
                    letterSpacing: "0.06em",
                    textShadow: "0 0 10px rgba(255, 215, 0, 0.3)",
                  }}
                >
                  {stat.value}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div> */}

      </div>{/* /sticky frame */}
    </div>  /* /scroll container */
  );
}
