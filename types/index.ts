export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CursorState {
  x: number;
  y: number;
  /** Normalised -1 → 1 */
  nx: number;
  ny: number;
  isHovering: boolean;
}

export interface ScrollState {
  /** Raw pixel scroll offset */
  offset: number;
  /** 0 → 1 across the full page */
  progress: number;
  /** Velocity pixels/frame */
  velocity: number;
}

export type JewelryCategory =
  | "rings"
  | "necklaces"
  | "bracelets"
  | "earrings"
  | "exclusive";

export interface MuseumChamber {
  id: JewelryCategory;
  label: string;
  roomNumber: string;
  description: string;
  goldHue: string;
  accentLight: string;
}

export type DeviceTier = "high" | "mid" | "low";
