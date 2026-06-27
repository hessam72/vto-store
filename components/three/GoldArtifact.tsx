"use client";

/**
 * The iconic living gold artifact — the emotional centerpiece.
 *
 * Phases driven by scroll progress (0 → 1):
 *   0.00 – 0.15  →  TorusKnot (hero reveal)
 *   0.15 – 0.35  →  Morphs / rotates, camera orbits
 *   0.35 – 0.55  →  Icosahedron (museum / collection reveal)
 *   0.55 – 0.75  →  Ring geometry (AR section)
 *   0.75 – 1.00  →  OctahedronGeometry opens for grand finale
 *
 * Material reacts: metalness, roughness, emissive intensity change with scroll.
 */

import { useRef, useMemo, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Float, Trail } from "@react-three/drei";
import * as THREE from "three";
import type { CursorState } from "@/types";

// Easing helpers
const easeInOut3 = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
  outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

interface Props {
  scrollProgress: MutableRefObject<number>;
  cursor: CursorState;
}

export default function GoldArtifact({ scrollProgress, cursor }: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  // We keep 4 geometries in memory and swap via morphTargets approach
  // (Three.js morph targets require same vertex count — instead we use opacity fade + scale)
  const geometries = useMemo(
    () => [
      new THREE.TorusKnotGeometry(1.4, 0.42, 256, 32, 2, 3),
      new THREE.IcosahedronGeometry(1.8, 4),
      new THREE.TorusGeometry(1.6, 0.5, 64, 128),
      new THREE.OctahedronGeometry(2, 4),
    ],
    []
  );

  // Transition helpers — 4 phases
  const phases = [
    { enter: 0.0, exit: 0.3 },
    { enter: 0.25, exit: 0.5 },
    { enter: 0.45, exit: 0.72 },
    { enter: 0.68, exit: 1.0 },
  ];

  const meshRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = scrollProgress.current;
    const time = state.clock.getElapsedTime();

    // ── Cursor parallax (world-space offset)
    const cx = cursor.nx * 0.4;
    const cy = cursor.ny * 0.2;

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x, cx, 1 - Math.pow(0.05, delta)
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y, cy, 1 - Math.pow(0.05, delta)
    );

    // ── Continuous slow rotation (modulated by scroll phase)
    const rotSpeed = 0.15 + t * 0.3;
    groupRef.current.rotation.y += delta * rotSpeed;
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.08;

    // ── Phase-specific geometry visibility (fade in/out via scale + opacity)
    phases.forEach(({ enter, exit }, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;

      let alpha = 0;
      if (t >= enter && t <= exit) {
        const halfSpan = (exit - enter) * 0.5;
        const mid = enter + halfSpan;
        if (t <= mid) {
          alpha = easeInOut3(clamp(remap(t, enter, mid, 0, 1), 0, 1));
        } else {
          alpha = 1 - easeInOut3(clamp(remap(t, mid, exit, 0, 1), 0, 1));
        }
      }

      const targetScale = 0.3 + alpha * 0.7;
      mesh.scale.setScalar(
        THREE.MathUtils.lerp(mesh.scale.x, targetScale, 1 - Math.pow(0.08, delta))
      );

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, alpha, 1 - Math.pow(0.08, delta));
      mat.needsUpdate = true;
    });

    // ── Material property animation with scroll
    // Scroll 0→0.5: bright, high metalness
    // Scroll 0.5→1: more emissive, almost glowing
    meshRefs.current.forEach((mesh) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      const emissiveIntensity =
        t < 0.5
          ? 0.3 + t * 0.6
          : 0.6 + (t - 0.5) * 1.6;

      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        emissiveIntensity,
        1 - Math.pow(0.1, delta)
      );

      mat.roughness = THREE.MathUtils.lerp(
        mat.roughness,
        t < 0.5 ? 0.08 : 0.04,
        1 - Math.pow(0.1, delta)
      );
    });
  });

  // Gold PBR material factory
  const makeGoldMat = () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd4af37),
      emissive: new THREE.Color(0xb8860b),
      emissiveIntensity: 0.3,
      metalness: 0.98,
      roughness: 0.08,
      envMapIntensity: 2.5,
      transparent: true,
      opacity: 0,
    });

  const materials = useMemo(() => [
    makeGoldMat(),
    makeGoldMat(),
    makeGoldMat(),
    makeGoldMat(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <group ref={groupRef}>
      {/* Phase geometries — stacked at origin */}
      {geometries.map((geo, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          geometry={geo}
          material={materials[i]}
          castShadow
          receiveShadow
        />
      ))}

      {/* Inner glowing core — always visible */}
      <mesh scale={0.35}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ff9000"
          emissiveIntensity={2}
          metalness={1}
          roughness={0}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Orbiting ring */}
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.2}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[2.8, 2.8, 0.02]}>
          <torusGeometry args={[1, 0.015, 8, 128]} />
          <meshStandardMaterial
            color="#ffd700"
            emissive="#daa520"
            emissiveIntensity={1.5}
            metalness={1}
            roughness={0}
            transparent
            opacity={0.4}
          />
        </mesh>
      </Float>
    </group>
  );
}
