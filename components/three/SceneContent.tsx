"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import GoldArtifact from "./GoldArtifact";
import GoldParticles from "./GoldParticles";
import MuseumEnvironment from "./MuseumEnvironment";
import { useCursorPosition } from "@/hooks/useCursorPosition";

gsap.registerPlugin(ScrollTrigger);

// Scroll-driven camera keyframes
// Each entry: { scrollProgress, position, target, fov }
const CAMERA_KEYFRAMES = [
  { t: 0.00, pos: [0, 0, 8],    look: [0, 0, 0],   fov: 45 },
  { t: 0.08, pos: [0, 0, 6],    look: [0, 0, 0],   fov: 42 },
  { t: 0.20, pos: [3, 1, 6],    look: [0, 0, 0],   fov: 50 },
  { t: 0.32, pos: [-2, -0.5, 5],look: [0, 0, 0],   fov: 48 },
  { t: 0.44, pos: [0, 2, 7],    look: [0, 0, 0],   fov: 45 },
  { t: 0.56, pos: [0, 0, 9],    look: [0, 0.5, 0], fov: 40 },
  { t: 0.68, pos: [-3, 1, 8],   look: [0, 0, 0],   fov: 50 },
  { t: 0.80, pos: [2, -1, 6],   look: [0, 0.2, 0], fov: 48 },
  { t: 0.92, pos: [0, 0, 12],   look: [0, 0, 0],   fov: 38 },
  { t: 1.00, pos: [0, 0, 5],    look: [0, 0, 0],   fov: 60 },
] as const;

function lerp3(a: readonly number[], b: readonly number[], t: number) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ] as const;
}

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function SceneContent() {
  const { camera } = useThree();
  const cursor = useCursorPosition();

  // Mutable scroll progress read from GSAP
  const scrollRef = useRef(0);
  const targetCamPos = useRef(new THREE.Vector3(0, 0, 8));
  const targetCamLook = useRef(new THREE.Vector3(0, 0, 0));
  const currentFov = useRef(45);

  useEffect(() => {
    // Drive scrollRef from ScrollTrigger
    ScrollTrigger.create({
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        scrollRef.current = self.progress;
      },
    });
  }, []);

  useFrame((_, delta) => {
    const t = scrollRef.current;

    // Find the two keyframes we're between
    let fromKF = CAMERA_KEYFRAMES[0];
    let toKF = CAMERA_KEYFRAMES[1];

    for (let i = 0; i < CAMERA_KEYFRAMES.length - 1; i++) {
      if (t >= CAMERA_KEYFRAMES[i].t && t <= CAMERA_KEYFRAMES[i + 1].t) {
      //  @ts-expect-error ewewewdfjkdjkdfj
        fromKF = CAMERA_KEYFRAMES[i];
              //  @ts-expect-error ewewewdfjkdjkdfj

        toKF = CAMERA_KEYFRAMES[i + 1];
        break;
      }
    }

    const span = toKF.t - fromKF.t;
    const localT = span > 0 ? (t - fromKF.t) / span : 0;
    const easedT = easeInOut(Math.max(0, Math.min(1, localT)));

    const pos = lerp3(fromKF.pos, toKF.pos, easedT);
    const look = lerp3(fromKF.look, toKF.look, easedT);
    const fov = lerpNum(fromKF.fov, toKF.fov, easedT);

    // Cursor-based parallax on camera position (subtle ±0.3 units)
    const parallaxStrength = 0.3;
    const px = cursor.nx * parallaxStrength;
    const py = cursor.ny * parallaxStrength;

    targetCamPos.current.set(pos[0] + px, pos[1] + py, pos[2]);
    targetCamLook.current.set(look[0], look[1], look[2]);
    currentFov.current = fov;

    // Smooth camera lerp (~8 fps convergence)
    const speed = 1 - Math.pow(0.02, delta);
    camera.position.lerp(targetCamPos.current, speed);
    camera.lookAt(targetCamLook.current);

    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = THREE.MathUtils.lerp(cam.fov, currentFov.current, speed);
      cam.updateProjectionMatrix();
    }
  });

  return (
    <>
      {/* Neutral ambient — everything else comes from the environment */}
      <ambientLight intensity={0.1} />

      {/* Key light — warm golden from above */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={2.0}
        color="#ffd28a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Rim light — cool blue from behind */}
      <directionalLight
        position={[-8, 2, -6]}
        intensity={0.5}
        color="#2040a0"
      />

      {/* Under light — gold bounce from floor */}
      <pointLight
        position={[0, -4, 0]}
        intensity={1.2}
        color="#b8860b"
        distance={20}
        decay={2}
      />

      {/* Volumetric shaft light — above artifact */}
      <spotLight
        position={[0, 15, 0]}
        angle={Math.PI / 12}
        penumbra={0.9}
        intensity={4}
        color="#ffd28a"
        distance={30}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Environment map — provides realistic reflections on PBR materials */}
      <Environment preset="studio" background={false} />

      {/* Scene objects */}
      <MuseumEnvironment scrollProgress={scrollRef} />
      <GoldArtifact scrollProgress={scrollRef} cursor={cursor} />
      <GoldParticles scrollProgress={scrollRef} />
    </>
  );
}
