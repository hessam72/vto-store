"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useTransform,
  useScroll,
  MotionValue,
} from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, SpotLight } from "@react-three/drei";
import * as THREE from "three";
import { Suspense } from "react";

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

/* ─────────────────────────────────────────────────────────────
   JewelryModel Component — Single 3D model with auto-rotate
───────────────────────────────────────────────────────────── */
interface JewelryModelProps {
  url: string;
  position: [number, number, number];
  scrollOpacity: MotionValue<number>;
  scale?: number;
}

function JewelryModel({ url, position, scrollOpacity, scale = 5 }: JewelryModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const [clonedScene, setClonedScene] = useState<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.Material[]>([]);

  // Clone scene once and prepare materials
  useEffect(() => {
    const cloned = scene.clone();
    const materials: THREE.Material[] = [];

    // Center the model at origin
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            mat.transparent = true;
            mat.opacity = 0;
            // Enhance gold reflections
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              mat.metalness = 1;
              mat.roughness = 0.15;
              mat.envMapIntensity = 2.5;
            }
            materials.push(mat);
          });
        } else {
          mesh.material.transparent = true;
          mesh.material.opacity = 0;
          // Enhance gold reflections
          const mat = mesh.material;
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            mat.metalness = 1;
            mat.roughness = 0.15;
            mat.envMapIntensity = 2.5;
          }
          materials.push(mesh.material);
        }
      }
    });

    materialsRef.current = materials;
    setClonedScene(cloned);
  }, [scene]);

  // Subscribe to scroll opacity changes and update materials
  useEffect(() => {
    // Set initial scroll opacity value
    const currentOpacity = scrollOpacity.get();
    materialsRef.current.forEach((mat) => {
      mat.opacity = currentOpacity;
    });

    // Listen for scroll changes
    const unsubscribe = scrollOpacity.on("change", (v) => {
      materialsRef.current.forEach((mat) => {
        mat.opacity = v;
      });
    });
    return unsubscribe;
  }, [scrollOpacity]);

  // Auto-rotate
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.31;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {clonedScene && <primitive object={clonedScene} scale={scale} />}
    </group>
  );
}

// Preload models

useGLTF.preload("/home_models/jewel-1.glb");
useGLTF.preload("/home_models/jewel-2.glb");
useGLTF.preload("/home_models/jewel-3.glb");
useGLTF.preload("/home_models/jewel-4.glb");
useGLTF.preload("/home_models/jewel-5.glb");
useGLTF.preload("/home_models/jewel-6.glb");
useGLTF.preload("/home_models/jewel-7.glb");
useGLTF.preload("/home_models/jewel-8.glb");

/* ─────────────────────────────────────────────────────────────
   Camera Controller — Subtle orbit during scroll
───────────────────────────────────────────────────────────── */
function CameraController() {
  const { camera } = useThree();
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const angle = timeRef.current * 0.08;
    camera.position.x = Math.sin(angle) * 0.2;
    camera.position.z = Math.cos(angle) * 0.2 + 5;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════
   HeroSection
═══════════════════════════════════════════════════════════ */
export default function HeroSection() {
  const router = useRouter();

  /* ── Refs ──────────────────────────────────────────────── */
  const scrollContainerRef = useRef<HTMLDivElement>(null); // 300vh tall
  const stickyFrameRef     = useRef<HTMLDivElement>(null); // sticky 100svh

  /* ── Scroll progress (0 → 1 across the 300vh container) ── */
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"],
  });


  /* ── Scroll-based animations ── */
  // Logo: starts 35vh (15% higher than center), moves to top (0 → 0.2)
  const logoY = useTransform(scrollYProgress, [0, 0.2], ["35vh", "0vh"]);
  const logoScale = useTransform(scrollYProgress, [0, 0.2], [1.5, 1]);

  // Scroll hint: fades out early (0 → 0.15)
  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  // Hero content: staggered reveal, stays visible
  const labelOpacity = useTransform(scrollYProgress, [0, 0.2, 0.3, 1], [0, 0, 1, 1]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.35, 0.45, 1], [0, 0, 1, 1]);
  const ornamentOpacity = useTransform(scrollYProgress, [0, 0.5, 0.6, 1], [0, 0, 1, 1]);
  const subtitleOpacity = useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [0, 0, 1, 1]);

  // CTA button: fades in at end
  const ctaOpacity = useTransform(scrollYProgress, [0, 0.8, 0.95, 1], [0, 0, 1, 1]);

  // 3D Models: progressive accumulation
  const model1Opacity = useTransform(scrollYProgress, [0, 0.15, 0.25], [0, 1, 1]);
  const model2Opacity = useTransform(scrollYProgress, [0.25, 0.4, 0.5], [0, 1, 1]);
  const model3Opacity = useTransform(scrollYProgress, [0.5, 0.65, 0.75], [0, 1, 1]);
  const model4Opacity = useTransform(scrollYProgress, [0.75, 0.9, 1], [0, 1, 1]);
  const model5Opacity = useTransform(scrollYProgress, [0.82, 1], [0, 1]);
  const model6Opacity = useTransform(scrollYProgress, [0.91, 1], [0, 1]);


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
        className="sticky top-0 w-full overflow-hidden bg-[#060606]"
        style={{ height: "100svh", minHeight: "100vh" }}
      >

        {/* ════════════════════════════════════════════════
            BACKGROUND IMAGE — Museum backdrop under 3D models
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 z-[0]">
          <div
            className="w-full h-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/images/museum-bg.webp')",
              opacity: 0.3,
            }}
          />
        </div>

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

          {/* Scroll hint text + gesture below logo */}
          <motion.div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-8 flex flex-col items-center gap-3"
            style={{ opacity: scrollHintOpacity }}
          >
            <p
              className="font-persian text-[0.7rem] tracking-[0.15em] whitespace-nowrap"
              style={{
                color: "rgba(255,215,0,0.7)",
                textShadow: "0 0 15px rgba(255, 215, 0, 0.3)",
              }}
            >
            برای ورود به شهر جواهرات اسکرول کنید
            </p>

            {/* Animated scroll gesture */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex flex-col items-center gap-2"
            >
              {/* Mouse icon */}
              <svg
                width="24"
                height="36"
                viewBox="0 0 24 36"
                fill="none"
                className="opacity-70"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="32"
                  rx="10"
                  stroke="#ffd700"
                  strokeWidth="2"
                  fill="none"
                />
                <motion.rect
                  x="10"
                  y="8"
                  width="4"
                  height="8"
                  rx="2"
                  fill="#ffd700"
                  animate={{ y: [8, 14, 8] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </svg>

              {/* Down arrow */}
              <motion.svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                animate={{ y: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <path
                  d="M8 2L8 14M8 14L3 9M8 14L13 9"
                  stroke="#ffd700"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ════════════════════════════════════════════════
            LAYER 0 — 3D JEWELRY MODELS (Progressive Scroll Reveal)
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 z-[1]">
          <Canvas
            camera={{ position: [0, 0, 8], fov: 30 }}
            dpr={[1, 1.5]}
            gl={{
              alpha: true,
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.8
            }}
          >
            <CameraController />

            {/* HDRI environment for gold reflections */}
            <Suspense fallback={null}>
              <Environment
                files="/hdr/main_hdr.exr"
                background={false}
                environmentIntensity={2.2}
                resolution={512}
              />
            </Suspense>

            {/* Reduced lighting - let HDR do the work */}
            <ambientLight intensity={8} color="#ffffff" />
            <SpotLight
              position={[5, 5, 5]}
              angle={0.3}
              penumbra={0.5}
              intensity={40}
              color="#ffd700"
            />
            <SpotLight
              position={[-5, 3, 5]}
              angle={0.4}
              penumbra={0.5}
              intensity={40}
              color="#fffacd"
            />
            <pointLight position={[0, 3, 3]} intensity={20} color="#ffd700" />

            {/* Progressive jewelry models */}
            <Suspense fallback={null}>
              <JewelryModel
                url="/home_models/jewel-3.glb"
                position={[0, 0, 0]}
                scrollOpacity={model1Opacity}
              />
              <JewelryModel
                url="/home_models/jewel-1.glb"
                position={[-0.4, .9, 0]}
                scrollOpacity={model2Opacity}
              />
              <JewelryModel
                url="/home_models/jewel-2.glb"
                position={[0.3, .9, 0]}
                scrollOpacity={model3Opacity}
              />
              <JewelryModel
                url="/home_models/jewel-4.glb"
                position={[.4, -.1, 0]}
                scrollOpacity={model4Opacity}
                scale={5}
              />
              <JewelryModel
                url="/home_models/jewel-5.glb"
                position={[-0.6, -.1, 0]}
                scrollOpacity={model5Opacity}
                scale={5}
              />
              {/* <JewelryModel
                url="/home_models/jewel-6.glb"
                position={[0.1, -.3, 0]}
                scrollOpacity={model6Opacity}
                scale={5}
              /> */}
              <JewelryModel
                url="/home_models/jewel-7.glb"
                position={[-0.15, -.7, 0.5]}
                scrollOpacity={model5Opacity}
              />
              <JewelryModel
                url="/home_models/jewel-8.glb"
                position={[0, -1, 0.5]}
                scrollOpacity={model6Opacity}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* ════════════════════════════════════════════════
            LAYER 1 — DARK OVERLAYS
            Identical to the previous version; ensure text
            remains readable over any video content.
        ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 z-[2] pointer-events-none">
          {/* Right-side veil — text contrast */}
          {/* <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to left, rgba(5,4,2,0.92) 0%, rgba(5,4,2,0.72) 20%, rgba(5,4,2,0.18) 52%, transparent 100%)",
          }} /> */}
          {/* Top + bottom vignette */}
          <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to bottom, rgba(6,6,6,0.55) 0%, transparent 20%, transparent 68%, rgba(6,6,6,0.88) 100%)",
          }} />
          {/* Emerald left accent */}
          {/* <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to right, rgba(14,50,44,0.45) 0%, rgba(14,50,44,0.10) 38%, transparent 60%)",
          }} /> */}
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
            className="flex items-center justify-center gap-4 mb-6 md:mb-8 w-screen md:w-auto px-4"
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
                       fontSize: "clamp(.8rem, 1.4vw, 1.3rem)",
              fontWeight:'bold',
                color: "#ffd700",
                textShadow: "0 0 20px rgba(212, 175, 55, 0.6), 0 0 40px rgba(212, 175, 55, 0.3)",
                opacity: 0.95,
              }}
            >
             پاساژ دیجیتال شهر امید دروازه‌ای به آینده جواهرات
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
          {/* <motion.h1
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
                filter: "drop-shadow(0 0 40px rgba(255, 215, 0, 0.4)) drop-shadow(0 4px 20px rgba(0, 0, 0, 0.6))",
                position: "relative",
              }}
            >
              شهر امید
            </span>
          </motion.h1> */}
            <motion.div
            className="flex justify-center mb-5 md:mb-6"
            style={{ opacity: titleOpacity }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Lumina-single.png"
              alt="Lumina"
              className="w-auto"
              style={{
                height: "auto",
                filter: "drop-shadow(0 0 40px rgba(255, 215, 0, 0.4)) drop-shadow(0 4px 20px rgba(0, 0, 0, 0.6))",
              }}
            />
          </motion.div>


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
              fontSize: "clamp(1rem, 1.4vw, 1.3rem)",
              fontWeight:'bold',
              color: "rgba(245, 240, 232, 0.85)",
              maxWidth: "42ch",
              textAlign: "center",
              textShadow: "0 2px 16px rgba(0, 0, 0, 0.6)",
              opacity: subtitleOpacity,
            }}
          >
هر قطعه طلا قبل از خرید متعلق به توست
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
