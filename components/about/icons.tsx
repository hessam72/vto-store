/**
 * Inline SVG set for the About page.
 *
 * Deliberately not an icon package: the module has to drop into any Next.js
 * app without pulling a dependency along. All glyphs are 24×24, stroke-based
 * and inherit `currentColor`, so the gold chip styling in about.css applies
 * without per-icon overrides.
 */

import type { ReactElement } from "react";
import type { ServiceIcon } from "./content";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Storefront — 3D exhibitions & showrooms. */
function Showroom() {
  return (
    <svg {...base}>
      <path d="M4.2 9.5 5.6 4.6h12.8l1.4 4.9" />
      <path d="M5.2 9.5v9.4a1 1 0 0 0 1 1h11.6a1 1 0 0 0 1-1V9.5" />
      <path d="M4.2 9.5a2 2 0 0 0 3.9 0 2 2 0 0 0 3.9 0 2 2 0 0 0 3.9 0 2 2 0 0 0 3.9 0" />
      <path d="M9.8 19.9v-5.4h4.4v5.4" />
    </svg>
  );
}

/** Isometric cube — interactive product experiences. */
function Product() {
  return (
    <svg {...base}>
      <path d="M20.5 7.6v8.8L12 21 3.5 16.4V7.6L12 3z" />
      <path d="m3.5 7.6 8.5 4.6 8.5-4.6" />
      <path d="M12 12.2V21" />
    </svg>
  );
}

/** House — virtual property tours. */
function RealEstate() {
  return (
    <svg {...base}>
      <path d="M3.4 10.6 12 3.6l8.6 7" />
      <path d="M5.6 9.6V20h12.8V9.6" />
      <path d="M9.9 20v-5.2h4.2V20" />
    </svg>
  );
}

/** Car profile — automotive showrooms. */
function Automotive() {
  return (
    <svg {...base}>
      <path d="M4.6 12.2 6.3 7.6a2 2 0 0 1 1.9-1.3h7.6a2 2 0 0 1 1.9 1.3l1.7 4.6" />
      <path d="M3.5 12.2h17v4.2a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <circle cx="7.4" cy="17.4" r="1.7" />
      <circle cx="16.6" cy="17.4" r="1.7" />
    </svg>
  );
}

/** Cut gem — gold & jewellery solutions. */
function Jewelry() {
  return (
    <svg {...base}>
      <path d="M6.6 3.7h10.8l3.3 5.4L12 20.4 3.3 9.1z" />
      <path d="M3.3 9.1h17.4" />
      <path d="m9.4 9.1 2.6 11.3 2.6-11.3" />
      <path d="m6.6 3.7 2.8 5.4M17.4 3.7l-2.8 5.4" />
    </svg>
  );
}

/** Ring with a set stone — virtual jewellery try-on. */
function TryOn() {
  return (
    <svg {...base}>
      <circle cx="12" cy="14.6" r="5.1" />
      <path d="M9.2 6.1h5.6l1.9 2.6L12 11.4 8.6 8.7z" />
      <path d="M8.6 8.7h6.8" />
    </svg>
  );
}

/** Ticket — event & ticketing systems. */
function Events() {
  return (
    <svg {...base}>
      <path d="M3.4 9.2V6.9a1 1 0 0 1 1-1h15.2a1 1 0 0 1 1 1v2.3a2.8 2.8 0 0 0 0 5.6v2.3a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1v-2.3a2.8 2.8 0 0 0 0-5.6z" />
      <path d="M14.4 5.9v2.4M14.4 11.2v1.6M14.4 15.7v2.4" />
    </svg>
  );
}

/** Calendar with a check — service booking. */
function Booking() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5.4" width="17" height="14.2" rx="1.6" />
      <path d="M3.5 9.7h17M8.2 3.6v3.4M15.8 3.6v3.4" />
      <path d="m9.2 14.4 2 2 3.6-3.6" />
    </svg>
  );
}

const SERVICE_GLYPHS: Record<ServiceIcon, () => ReactElement> = {
  showroom: Showroom,
  product: Product,
  realestate: RealEstate,
  automotive: Automotive,
  jewelry: Jewelry,
  tryon: TryOn,
  events: Events,
  booking: Booking,
};

export function ServiceGlyph({ name }: { name: ServiceIcon }) {
  const Glyph = SERVICE_GLYPHS[name];
  return <Glyph />;
}

/** Points "back" in LTR; about.css mirrors it under dir="rtl". */
export function BackIcon() {
  return (
    <svg {...base}>
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </svg>
  );
}

/** Shown on the placeholder while an image file does not exist yet. */
export function ImageIcon() {
  return (
    <svg {...base}>
      <rect x="3.2" y="5" width="17.6" height="14" rx="2" />
      <circle cx="8.6" cy="10" r="1.6" />
      <path d="m4 17.4 4.9-4.6a1.6 1.6 0 0 1 2.2 0l3.4 3.2a1.6 1.6 0 0 0 2.2 0l1.6-1.5a1.6 1.6 0 0 1 2.2 0l1.5 1.4" />
    </svg>
  );
}
