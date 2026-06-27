"use client";

import { useEffect, useRef, useState } from "react";
import type { ScrollState } from "@/types";

export function useScrollProgress(): ScrollState {
  const [state, setState] = useState<ScrollState>({
    offset: 0,
    progress: 0,
    velocity: 0,
  });

  const prevOffset = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      const offset = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? offset / maxScroll : 0;
      const velocity = offset - prevOffset.current;
      prevOffset.current = offset;

      setState({ offset, progress, velocity });
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return state;
}
