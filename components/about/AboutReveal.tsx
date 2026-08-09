"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Scroll-entrance wrapper. Flips `data-ab-reveal` to "in" once the element
 * enters the viewport, driving the transition defined in about.css.
 *
 * Deliberately not an animation library — the CSS contract already exists,
 * this adds no bundle weight, and `prefers-reduced-motion` is honoured both
 * here (observer short-circuit) and in the stylesheet.
 */
export default function AboutReveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Stagger in ms. */
  delay?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Users who asked for less motion get the content immediately.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.setAttribute("data-ab-reveal", "in");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute("data-ab-reveal", "in");
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-ab-reveal=""
      className={className}
      style={delay ? ({ "--ab-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
