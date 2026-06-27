"use client";

import { useEffect, useState } from "react";
import type { DeviceTier } from "@/types";

/**
 * Detects device capability tier so we can gracefully degrade
 * heavy 3D effects on lower-end hardware.
 */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>("high");

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced || (isMobile && cores <= 4 && memory <= 2)) {
      setTier("low");
    } else if (isMobile || cores <= 4 || memory <= 4) {
      setTier("mid");
    } else {
      setTier("high");
    }
  }, []);

  return tier;
}
