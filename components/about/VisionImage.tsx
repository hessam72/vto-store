"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "./icons";
import type { Slot } from "./content";

export default function VisionImage({
  slot,
  ratio,
  sizes,
  priority = false,
  blend = false,
}: {
  slot: Slot;
  ratio: "wide" | "card" | "tall" | "fill";
  sizes: string;
  priority?: boolean;
  blend?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure
      className="about-figure vision-figure"
      data-ratio={ratio}
      data-blend={blend ? "" : undefined}
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
          className="about-img vision-img"
        />
      )}
    </figure>
  );
}
