"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useGLTF,
  Float,
  ContactShadows,
  AdaptiveDpr,
  AdaptiveEvents,
} from "@react-three/drei";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────────
   Config — change this path if the model is moved
───────────────────────────────────────────────────────────── */
export const GOLD_BAR_MODEL_PATH = "/models/gold-bar.glb";

/* ─────────────────────────────────────────────────────────────
   Model transform constants — edit these to reposition/rescale
   without touching any other code.
───────────────────────────────────────────────────────────── */
const MODEL_SCALE    = 16;
const MODEL_POSITION = [-1.0, -2.2, 0] as [number, number, number];
const MODEL_ROTATION = [0, 0, 0]       as [number, number, number];

/* ─────────────────────────────────────────────────────────────
   Material upgrade — forces luxury PBR gold on every mesh
   regardless of what material the GLB ships with
───────────────────────────────────────────────────────────── */
function upgradeToGold(scene: THREE.Object3D) {
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    mats.forEach((mat) => {
      if (
        mat instanceof THREE.MeshStandardMaterial ||
        mat instanceof THREE.MeshPhysicalMaterial
      ) {
        mat.metalness       = 0.98;
        mat.roughness       = 0.055;
        mat.envMapIntensity = 0;   // no env map loaded — keep at 0
        // Keep the model's own color if it looks gold; otherwise force one
        const lum = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114;
        if (lum < 0.3) mat.color.set("#c9a21e"); // dark default → gold
        mat.needsUpdate = true;
      }
    });
    child.castShadow    = true;
    child.receiveShadow = true;
  });
}

/* ─────────────────────────────────────────────────────────────
   Actual GLB model — loaded once, reused
───────────────────────────────────────────────────────────── */
function GoldBarModel({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  const groupRef   = useRef<THREE.Group>(null!);

  useEffect(() => {
    upgradeToGold(scene);
  }, [scene]);

  // Slow dignified rotation — museum-grade presentation
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.13;
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        dispose={null}
        scale={MODEL_SCALE}
        position={MODEL_POSITION}
        rotation={MODEL_ROTATION}
      />
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   Fallback shown while the GLB downloads (or if file is absent)
   Uses standard gold-bar proportions: roughly 16 × 9 × 4
───────────────────────────────────────────────────────────── */
function GoldBarFallback() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.13;
    meshRef.current.rotation.x =
      Math.sin(state.clock.getElapsedTime() * 0.35) * 0.06;
  });

  return (
    <group>
      {/* Main bar */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.62, 1.25]} />
        <meshPhysicalMaterial
          color="#c9a21e"
          metalness={0.98}
          roughness={0.055}
          envMapIntensity={0}
        />
      </mesh>

      {/* Floating decorative ring */}
      <mesh
        position={[0, 0.85, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[0.55, 0.065, 16, 64]} />
        <meshPhysicalMaterial
          color="#d4af37"
          metalness={0.98}
          roughness={0.045}
          envMapIntensity={0}
        />
      </mesh>

      {/* Small satellite ring */}
      <mesh
        position={[1.1, 0.5, 0.3]}
        rotation={[Math.PI / 3, 0.4, 0]}
        castShadow
      >
        <torusGeometry args={[0.28, 0.042, 12, 48]} />
        <meshPhysicalMaterial
          color="#e8c84a"
          metalness={0.98}
          roughness={0.04}
          envMapIntensity={0}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   Scene — lights + floating model + shadow plane
───────────────────────────────────────────────────────────── */
function Scene({ modelPath }: { modelPath: string }) {
  return (
    <>
      {/* Sky/ground hemisphere — replaces HDRI ambient contribution */}
      <hemisphereLight
        color="#fff5cc"
        groundColor="#3a2a00"
        intensity={1.1}
      />

      {/* Ambient fill — prevents pure-black shadows */}
      <ambientLight intensity={0.35} color="#fff5e0" />

      {/* Key light — warm gold, from top-right */}
      <directionalLight
        position={[4, 7, 4]}
        intensity={3.2}
        color="#ffd98a"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
      />

      {/* Secondary key — front-left fill, softens harsh shadow */}
      <directionalLight
        position={[-3, 4, 6]}
        intensity={1.2}
        color="#ffe8a0"
      />

      {/* Rim light — cool emerald from behind-left */}
      <directionalLight
        position={[-5, 2, -5]}
        intensity={1.1}
        color="#8ecfb0"
      />

      {/* Bounce — warm uplighting from floor */}
      <pointLight position={[0, -2, 3]} intensity={1.0} color="#c8941a" />

      {/* Specular fill from behind camera */}
      <pointLight position={[0, 3, 8]} intensity={0.55} color="#fff5cc" />

      <Float
        speed={1.4}
        rotationIntensity={0.14}
        floatIntensity={0.52}
        floatingRange={[-0.08, 0.08]}
      >
        <Suspense fallback={<GoldBarFallback />}>
          <GoldBarModel path={modelPath} />
        </Suspense>
      </Float>

      <ContactShadows
        position={[0, -1.7, 0]}
        opacity={0.28}
        scale={7}
        blur={3.5}
        far={3}
        color="#000000"
      />

      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Exported viewer — drop-in replacement for the jewelry image
───────────────────────────────────────────────────────────── */
export default function GoldModelViewer({
  modelPath = GOLD_BAR_MODEL_PATH,
}: {
  modelPath?: string;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.7, 6.8], fov: 32, near: 0.1, far: 100 }}
      gl={{
        antialias:         true,
        alpha:             true,
        powerPreference:   "high-performance",
        preserveDrawingBuffer: false,
      }}
      dpr={[1, 2]}
      shadows
      style={{ background: "transparent" }}
    >
      <Scene modelPath={modelPath} />
    </Canvas>
  );
}

// Eagerly start the fetch so the model is ready before interaction
useGLTF.preload(GOLD_BAR_MODEL_PATH);
