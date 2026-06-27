"use client";

/**
 * Floating golden dust particles.
 * Count and size scale with device tier and scroll progress.
 */

import { useRef, useMemo, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 800;

interface Props {
  scrollProgress: MutableRefObject<number>;
}

export default function GoldParticles({ scrollProgress }: Props) {
  const pointsRef = useRef<THREE.Points>(null!);

  // Generate particle positions + random offsets
  const { positions, velocities, phases } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 2 + Math.random() * 8;

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      velocities[i * 3]     = (Math.random() - 0.5) * 0.004;
      velocities[i * 3 + 1] = Math.random() * 0.006 + 0.001;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;

      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, velocities, phases };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xd4af37,
        size: 0.035,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const posArr = useRef(positions.slice());

  useFrame((state) => {
    const t = scrollProgress.current;
    const time = state.clock.getElapsedTime();

    const pos = posArr.current;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Float upward + sine wave
      pos[i3]     += velocities[i3]     + Math.sin(time * 0.3 + phases[i]) * 0.001;
      pos[i3 + 1] += velocities[i3 + 1];
      pos[i3 + 2] += velocities[i3 + 2] + Math.cos(time * 0.2 + phases[i]) * 0.001;

      // Reset when too high
      if (pos[i3 + 1] > 10) {
        pos[i3 + 1] = -10;
        pos[i3]     = (Math.random() - 0.5) * 18;
        pos[i3 + 2] = (Math.random() - 0.5) * 18;
      }
    }

    geometry.attributes.position.array.set(pos);
    geometry.attributes.position.needsUpdate = true;

    // Expand particle field as user scrolls deeper
    const scale = 1 + t * 1.5;
    if (pointsRef.current) {
      pointsRef.current.scale.setScalar(scale);
      // Rotate slowly
      pointsRef.current.rotation.y = time * 0.02;

      // Opacity: fade in during hero, maintain, fade at finale
      const opacity = t > 0.88
        ? THREE.MathUtils.lerp(0.7, 0, (t - 0.88) / 0.12)
        : 0.7;
      material.opacity = opacity;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
