"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useState } from "react";

/* ─────────────────────────────────────────────────────────────
   Shahr Omid brand logo
   Tries to load /images/shahr-omid-logo.png; falls back to the
   Persian text mark if the file hasn't been placed yet.
───────────────────────────────────────────────────────────── */
function ShahrOmidLogo() {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/images/shahr-omid-logo.png"
        alt="شهر امید"
        style={{    width: '13rem',
          height: 'auto',
          marginTop: '1rem',
         filter: "brightness(1.15) contrast(1.08) saturate(1.1)",
        }}
        onError={() => setImgFailed(true)}
        className="h-12 md:h-16 w-auto object-contain"
     
      />
    );
  }

  // Text fallback — shown until the logo file is placed
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

export default function Navigation() {
  const { scrollYProgress } = useScroll();

  // Fade in when scroll > 0.15 (when logo reaches top)
  const navOpacity = useTransform(scrollYProgress, [0, 0.15, 0.25], [0, 0, 1]);

  return (
    <motion.nav
      dir="rtl"
      className="fixed top-0 left-0 right-0 z-50 bg-transparent pointer-events-none"
      style={{ opacity: navOpacity , marginTop:'4rem' }}
    >
      <div className="flex flex-col items-center pt-4 gap-3">
        {/* Logo */}
        {/* <motion.div
          className="pointer-events-auto"
          whileHover={{
            scale: 1.05,
            filter: "drop-shadow(0 0 30px rgba(255, 215, 0, 0.5))"
          }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.2))"
          }}
        >
          <ShahrOmidLogo />
        </motion.div> */}

        {/* Menu Items */}
        <motion.ul
          className="flex items-center gap-8 md:gap-12 pointer-events-auto"
          style={{ opacity: navOpacity }}
        >
         
          <li>
            <Link
              href="/"
              className="font-persian text-[0.85rem] md:text-[0.9rem] tracking-wide font-medium hover:text-[#ffd700] transition-all duration-400 group relative"
              style={{
                 color: "rgba(255, 255, 255, 0.85)",
                transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  textShadow: "#d9bf12c3 4px 4px 6px",
                fontWeight: "bold",
                fontSize: "1.2rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textShadow = "0 0 20px rgba(255, 215, 0, 0.5)";
                e.currentTarget.style.color = "#ffd700";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textShadow = "0 0 0 transparent";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.85)";
              }}
            >
              خانه
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-gradient-to-r from-transparent via-[#ffd700] to-transparent group-hover:w-full transition-all duration-500" style={{ boxShadow: "0 0 8px rgba(255, 215, 0, 0.6)" }} />
            </Link>
          </li>
           <li>
            <Link
              href="/store"
              className="font-persian text-[0.85rem] md:text-[0.9rem] tracking-wide font-medium hover:text-[#ffd700] transition-all duration-400 group relative"
              style={{
                color: "rgba(255, 255, 255, 0.85)",
                transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                textShadow: "#d9bf12c3 4px 4px 6px",
                fontWeight: "bold",
                fontSize: "1.2rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textShadow = "0 0 20px rgba(255, 215, 0, 0.5)";
                e.currentTarget.style.color = "#ffd700";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textShadow = "0 0 0 transparent";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.85)";
              }}
            >
              تجربه سه‌بعدی
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-gradient-to-r from-transparent via-[#ffd700] to-transparent group-hover:w-full transition-all duration-500" style={{ boxShadow: "0 0 8px rgba(255, 215, 0, 0.6)" }} />
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              className="font-persian text-[0.85rem] md:text-[0.9rem] tracking-wide font-medium hover:text-[#ffd700] transition-all duration-400 group relative"
              style={{
                 color: "rgba(255, 255, 255, 0.85)",
                transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                textShadow: "#d9bf12c3 4px 4px 6px",
                fontWeight: "bold",
                fontSize: "1.2rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textShadow = "0 0 20px rgba(255, 215, 0, 0.5)";
                e.currentTarget.style.color = "#ffd700";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textShadow = "0 0 0 transparent";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.85)";
              }}
            >
              درباره ما
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-gradient-to-r from-transparent via-[#ffd700] to-transparent group-hover:w-full transition-all duration-500" style={{ boxShadow: "0 0 8px rgba(255, 215, 0, 0.6)" }} />
            </Link>
          </li>
        </motion.ul>
      </div>
    </motion.nav>
  );
}
