"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CursorState } from "@/types";

const SMOOTHING = 0.12;

export function useCursorPosition() {
  const [cursor, setCursor] = useState<CursorState>({
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    isHovering: false,
  });

  // Raw target (updated synchronously from events)
  const rawRef = useRef({ x: 0, y: 0 });
  // Smoothed (lerped every rAF)
  const smoothRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const hoverRef = useRef(false);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const loop = useCallback(() => {
    const dx = rawRef.current.x - smoothRef.current.x;
    const dy = rawRef.current.y - smoothRef.current.y;

    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      smoothRef.current.x = lerp(smoothRef.current.x, rawRef.current.x, SMOOTHING);
      smoothRef.current.y = lerp(smoothRef.current.y, rawRef.current.y, SMOOTHING);

      const nx = (smoothRef.current.x / window.innerWidth) * 2 - 1;
      const ny = -((smoothRef.current.y / window.innerHeight) * 2 - 1);

      setCursor({
        x: smoothRef.current.x,
        y: smoothRef.current.y,
        nx,
        ny,
        isHovering: hoverRef.current,
      });
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawRef.current = { x: e.clientX, y: e.clientY };
    };

    const onEnterLink = () => { hoverRef.current = true; };
    const onLeaveLink = () => { hoverRef.current = false; };

    // Track hover state on interactive elements
    document.addEventListener("mousemove", onMove, { passive: true });
    document.querySelectorAll("a, button, [data-cursor-hover]").forEach((el) => {
      el.addEventListener("mouseenter", onEnterLink);
      el.addEventListener("mouseleave", onLeaveLink);
    });

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  return cursor;
}
