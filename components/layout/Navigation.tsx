"use client";

import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

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
    <>
      <motion.nav
        dir="rtl"
        className="fixed top-0 left-0 right-0 z-50 bg-transparent"
        style={{ opacity: navOpacity }}
      >
        <div className="container-luxury flex items-center justify-center h-16 md:h-24">
          {/* Logo — top left */}
          {/* <motion.a
            href="#"
            className="relative flex items-center"
            whileHover={{
              scale: 1.08,
              filter: "drop-shadow(0 0 30px rgba(255, 215, 0, 0.5))"
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.2))"
            }}
          >
            <ShahrOmidLogo />
          </motion.a> */}

          {/* Desktop nav — RTL: items flow right → left */}
          {/* <ul className="hidden md:flex items-center gap-10 flex-row-reverse">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => scrollTo(item.href)}
                  className="relative font-persian text-[0.82rem] tracking-wide font-medium text-[var(--text-secondary)] hover:text-[#ffd700] transition-all duration-400 group"
                  style={{
                    textShadow: "0 0 0 transparent",
                    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textShadow = "0 0 20px rgba(255, 215, 0, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textShadow = "0 0 0 transparent";
                  }}
                >
                  {item.label}
                  <span className="absolute -bottom-1 right-0 w-0 h-[2px] bg-gradient-to-l from-transparent via-[#ffd700] to-transparent group-hover:w-full transition-all duration-500 ease-[var(--ease-luxury)]" style={{ boxShadow: "0 0 8px rgba(255, 215, 0, 0.6)" }} />
                </button>
              </li>
            ))}
          </ul> */}

          {/* CTA + hamburger — RTL: appears on left */}
          {/* <div className="flex items-center gap-5 flex-row-reverse">
            <motion.button
              className="hidden md:block font-persian text-[0.7rem] tracking-wider font-semibold"
              whileHover={{
                boxShadow: "0 0 50px rgba(255,215,0,0.4), 0 4px 24px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,235,120,0.25)",
                borderColor: "rgba(255,215,0,0.85)",
                y: -2,
              }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: "0.65rem 1.6rem",
                border: "1.5px solid rgba(212,175,55,0.5)",
                borderRadius: "6px",
                background: "linear-gradient(135deg, rgba(10,8,2,0.7) 0%, rgba(15,12,3,0.6) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "0 0 24px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,235,120,0.12)",
                color: "#ffd700",
                textShadow: "0 0 10px rgba(255, 215, 0, 0.3)",
              }}
            >
              ورود به موزه
            </motion.button>

            <button
              className="flex md:hidden flex-col gap-1.5 p-2"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="منو"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={
                    menuOpen
                      ? i === 0 ? { rotate: 45, y: 7 }
                      : i === 1 ? { opacity: 0, x: -8 }
                      : { rotate: -45, y: -7 }
                      : { rotate: 0, y: 0, opacity: 1, x: 0 }
                  }
                  className="w-6 h-px bg-[var(--gold-primary)] block"
                />
              ))}
            </button>
          </div> */}
        </div>
      </motion.nav>

      {/* Mobile menu */}
      {/* <AnimatePresence>
        {menuOpen && (
          <motion.div
            dir="rtl"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-14 md:top-20 z-40 backdrop-blur-2xl bg-[rgba(8,8,10,0.97)] border-b border-[rgba(212,175,55,0.1)] p-8 md:hidden"
          >
            <ul className="flex flex-col gap-6">
              {NAV_ITEMS.map((item, i) => (
                <motion.li
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35 }}
                >
                  <button
                    onClick={() => scrollTo(item.href)}
                    className="font-persian text-[1rem] text-[var(--text-primary)] hover:text-[var(--gold-primary)] transition-colors duration-300"
                  >
                    {item.label}
                  </button>
                </motion.li>
              ))}
              <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}>
                <button
                  className="font-persian font-medium w-full flex items-center justify-center gap-3 mt-2"
                  style={{
                    padding:              "0.85rem 1.5rem",
                    border:               "1px solid rgba(212,175,55,0.45)",
                    background:           "rgba(8,6,2,0.62)",
                    backdropFilter:       "blur(22px)",
                    WebkitBackdropFilter: "blur(22px)",
                    boxShadow:            "0 0 24px rgba(212,175,55,0.13), inset 0 1px 0 rgba(212,175,55,0.1)",
                    color:                "rgba(255,255,255,0.9)",
                    fontSize:             "0.87rem",
                    letterSpacing:        "0.04em",
                  }}
                >
                  ورود به موزه
                </button>
              </motion.li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence> */}
    </>
  );
}
