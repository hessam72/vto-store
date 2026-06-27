"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}
      //  @ts-expect-error ewewewdfjkdjkdfj

type GSAPCallback = (gsap: typeof import("gsap").gsap, ScrollTrigger: typeof ScrollTrigger) => gsap.core.Timeline | void;

/**
 * Convenience hook that runs a GSAP context inside a React component,
 * automatically registering ScrollTrigger and cleaning up on unmount.
 */
export function useGSAP(
  callback: GSAPCallback,
  deps: React.DependencyList = []
) {
  const contextRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    contextRef.current = gsap.context(() => {
      callback(gsap, ScrollTrigger);
    });

    return () => {
      contextRef.current?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return contextRef;
}
