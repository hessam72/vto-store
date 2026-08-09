"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "./icons";
import type { Slot } from "./content";

/**
 * `next/image` that degrades to a labelled glass panel when the file is
 * missing, so every slot reads as intentional before any photography is
 * uploaded — drop a file at the slot's path and it appears with no code change.
 *
 * `src` is always a plain string, never a static import: importing a file that
 * does not exist is a hard build error, which is exactly what this avoids.
 */
export default function AboutImage({
  slot,
  ratio,
  sizes,
  priority = false,
  blend = false,
  backdrop = false,
}: {
  slot: Slot;
  /** "fill" stretches to a positioned parent instead of holding a ratio. */
  ratio: "wide" | "card" | "tall" | "fill";
  sizes: string;
  priority?: boolean;
  /** Fade the image out on every edge so it melts into the page. */
  blend?: boolean;
  /** Frameless full-bleed variant that sits behind copy; feathers wider and
   *  drops its empty-slot placeholder to the bottom so it never lands behind
   *  the headline. */
  backdrop?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure
      className="about-figure"
      data-ratio={ratio}
      data-blend={blend ? "" : undefined}
      data-backdrop={backdrop ? "" : undefined}
    >
      {failed ? (
        <div className="about-img-fallback">
          <ImageIcon />
          <span>{slot.label}</span>
        </div>
      ) : (
        <Image
          src={slot.src}
          alt={slot.alt}
          fill
          unoptimized
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className="about-img"
        />
      )}
    </figure>
  );
}
