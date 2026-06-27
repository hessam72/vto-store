"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const dot = { x: useMotionValue(0), y: useMotionValue(0) };
  const ring = {
    x: useSpring(0, { stiffness: 120, damping: 18, mass: 0.6 }),
    y: useSpring(0, { stiffness: 120, damping: 18, mass: 0.6 }),
  };

  const isHovering = useRef(false);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      dot.x.set(e.clientX);
      dot.y.set(e.clientY);
      ring.x.set(e.clientX);
      ring.y.set(e.clientY);
    };

    const enterHover = () => {
      isHovering.current = true;
      if (ringRef.current) {
        ringRef.current.style.transform += " scale(2)";
        ringRef.current.style.borderColor = "var(--gold-bright)";
      }
    };

    const leaveHover = () => {
      isHovering.current = false;
      if (ringRef.current) {
        ringRef.current.style.borderColor = "";
      }
    };

    window.addEventListener("mousemove", move, { passive: true });
    document.querySelectorAll("a, button, [data-cursor-hover]").forEach((el) => {
      el.addEventListener("mouseenter", enterHover);
      el.addEventListener("mouseleave", leaveHover);
    });

    return () => {
      window.removeEventListener("mousemove", move);
    };
  }, [dot.x, dot.y, ring.x, ring.y]);

  return (
    // Only render on pointer: fine devices
    <div className="pointer-events-none fixed inset-0 z-[99999] hidden md:block">
      {/* Dot */}
      <motion.div
        className="absolute w-2 h-2 bg-[var(--gold-primary)] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{ left: dot.x, top: dot.y }}
      />

      {/* Ring */}
      <motion.div
        ref={ringRef}
        className="absolute w-9 h-9 rounded-full border border-[rgba(212,175,55,0.5)] -translate-x-1/2 -translate-y-1/2 transition-[border-color,transform] duration-300 ease-[var(--ease-luxury)]"
        style={{ left: ring.x, top: ring.y }}
      />
    </div>
  );
}
