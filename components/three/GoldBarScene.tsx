"use client";

/**
 * GoldBarScene — cinematic museum 3D experience.
 *
 * Scene hierarchy:
 *   MuseumHall      — reflective floor, emerald walls, architectural light ring
 *   CentralSculpture — TorusKnot on a dark pedestal (the museum centrepiece)
 *   JewelryPieces   — 3 rings, 2 bracelets, 1 necklace arc orbiting the sculpture
 *
 * Scroll phases (via GSAP ScrollTrigger → scrollRef 0 → 1):
 *   0.00 – 0.25   sculpture slow Y-rotation, jewelry drift
 *   0.25 – 0.50   camera pulls forward (Z: 11 → 8)
 *   0.50 – 0.75   sculpture rises (Y: 0 → 0.9)
 *   0.75 – 1.00   emissive richens, subtle colour temperature shift
 */

import { useRef, useEffect, useMemo, MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Float, Environment, MeshReflectorMaterial } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════
   SHARED MATERIALS (created once, reused across all jewelry)
══════════════════════════════════════════════════════════════════ */
function useGoldMaterial(roughness = 0.1, emissiveIntensity = 0.14) {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:            new THREE.Color("#D4AF37"),
        emissive:         new THREE.Color("#7a4a00"),
        emissiveIntensity,
        metalness:        1.0,
        roughness,
        envMapIntensity:  2.6,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roughness, emissiveIntensity]
  );
}

function useDarkMaterial(color = "#111114") {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:           new THREE.Color(color),
        metalness:       0.85,
        roughness:       0.2,
        envMapIntensity: 1.2,
      }),
    [color]
  );
}

/* ═══════════════════════════════════════════════════════════════
   MUSEUM HALL
══════════════════════════════════════════════════════════════════ */
function MuseumHall() {
  const goldMat   = useGoldMaterial(0.3, 0.06);
  const darkMat   = useDarkMaterial("#0a0a0d");

  // Emerald wall material
  const emeraldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:     new THREE.Color("#0D3B32"),
        metalness: 0.6,
        roughness: 0.5,
        envMapIntensity: 0.8,
      }),
    []
  );

  return (
    <group>
      {/* ── Reflective dark floor ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.8, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <MeshReflectorMaterial
          blur={[400, 150]}
          resolution={512}
          mixBlur={10}
          mixStrength={0.55}
          roughness={0.85}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#0a0a0d"
          metalness={0.9}
          mirror={0}
        />
      </mesh>

      {/* ── Back wall — far, dark ── */}
      <mesh position={[0, 4, -14]} receiveShadow>
        <planeGeometry args={[32, 20]} />
        <primitive object={emeraldMat} />
      </mesh>

      {/* ── Side walls — emerald tint ── */}
      <mesh position={[-13, 4, -4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[22, 20]} />
        <primitive object={emeraldMat} />
      </mesh>
      <mesh position={[13, 4, -4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[22, 20]} />
        <primitive object={emeraldMat} />
      </mesh>

      {/* ── Ceiling ── */}
      <mesh position={[0, 10, -4]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 22]} />
        <primitive object={darkMat} />
      </mesh>

      {/* ── Architectural overhead light ring ──
           Thin emissive torus — the "museum skylight ring" */}
      <mesh position={[0, 7.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.2, 0.055, 16, 128]} />
        <meshStandardMaterial
          color="#D4AF37"
          emissive="#D4AF37"
          emissiveIntensity={1.8}
          metalness={1}
          roughness={0}
        />
      </mesh>

      {/* Secondary inner ring */}
      <mesh position={[0, 7.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.8, 0.025, 12, 100]} />
        <meshStandardMaterial
          color="#D4AF37"
          emissive="#D4AF37"
          emissiveIntensity={1.2}
          metalness={1}
          roughness={0}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* ── Architectural columns — far background ── */}
      {[-9, 9].map((x, i) => (
        <group key={i} position={[x, 3.5, -10]}>
          {/* Shaft */}
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.26, 13, 12]} />
            <primitive object={emeraldMat} />
          </mesh>
          {/* Capital */}
          <mesh position={[0, 6.6, 0]}>
            <cylinderGeometry args={[0.38, 0.22, 0.4, 12]} />
            <primitive object={darkMat} />
          </mesh>
        </group>
      ))}

      {/* ── Gold floor runner strip ── */}
      <mesh position={[0, -2.78, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 24]} />
        <meshStandardMaterial
          color="#b8860b"
          emissive="#7a4a00"
          emissiveIntensity={0.5}
          metalness={1}
          roughness={0.08}
        />
      </mesh>

      {/* ── Display podium for the sculpture ── */}
      <group position={[0, -2.8, 0]}>
        {/* Base disk */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.8, 0.12, 40]} />
          <primitive object={darkMat} />
        </mesh>
        {/* Gold trim ring on podium */}
        <mesh position={[0, 0.08, 0]}>
          <torusGeometry args={[1.5, 0.025, 8, 80]} />
          <primitive object={goldMat} />
        </mesh>
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CENTRAL SCULPTURE — monumental TorusKnot
══════════════════════════════════════════════════════════════════ */
interface SculptureProps {
  scrollRef: MutableRefObject<number>;
}

function CentralSculpture({ scrollRef }: SculptureProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const matRef   = useRef<THREE.MeshStandardMaterial>(null!);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:            new THREE.Color("#D4AF37"),
        emissive:         new THREE.Color("#7a4a00"),
        emissiveIntensity: 0.18,
        metalness:        1.0,
        roughness:        0.07,
        envMapIntensity:  3.0,
      }),
    []
  );

  // Scroll phase refs — updated in useFrame
  const baseY      = useRef(0);
  const extraRotY  = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t    = scrollRef.current;
    const time = state.clock.getElapsedTime();

    // ── Phase 1 (0–0.25): ambient idle rotation
    groupRef.current.rotation.y += delta * (0.1 + t * 0.08);

    // ── Phase 3 (0.5–0.75): sculpture rises
    const riseT = THREE.MathUtils.smoothstep(t, 0.5, 0.75);
    const targetY = riseT * 0.9;
    baseY.current = THREE.MathUtils.lerp(baseY.current, targetY, 1 - Math.pow(0.04, delta));
    groupRef.current.position.y = baseY.current;

    // ── Subtle breathing tilt
    groupRef.current.rotation.x = Math.sin(time * 0.18) * 0.04;
    groupRef.current.rotation.z = Math.sin(time * 0.13 + 1) * 0.025;

    // ── Phase 4 (0.75–1): emissive richens
    const richT = THREE.MathUtils.smoothstep(t, 0.75, 1.0);
    mat.emissiveIntensity = THREE.MathUtils.lerp(
      mat.emissiveIntensity,
      0.18 + richT * 0.45,
      1 - Math.pow(0.06, delta)
    );
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Main sculpture — TorusKnot p:2 q:3 gives a flowing trefoil knot form */}
      <mesh material={mat} castShadow>
        <torusKnotGeometry args={[1.25, 0.3, 256, 32, 2, 3]} />
      </mesh>

      {/* Outer translucent shell — gives depth and luxury layering */}
      <mesh scale={1.045}>
        <torusKnotGeometry args={[1.25, 0.3, 128, 24, 2, 3]} />
        <meshStandardMaterial
          color="#D4AF37"
          emissive="#c8900a"
          emissiveIntensity={0.06}
          metalness={1}
          roughness={0.35}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Pedestal stem */}
      <mesh position={[0, -1.7, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.16, 1.4, 16]} />
        <meshStandardMaterial color="#1a1a1e" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   JEWELRY PIECES
══════════════════════════════════════════════════════════════════ */

/** Gold ring — plain or with optional stone */
function GoldRing({
  position,
  rotation = [0, 0, 0],
  radius = 0.52,
  tube = 0.09,
  roughness = 0.08,
  hasStone = false,
  scrollRef,
  scrollMult = 1,
  floatSpeed = 1.2,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
  tube?: number;
  roughness?: number;
  hasStone?: boolean;
  scrollRef: MutableRefObject<number>;
  scrollMult?: number;
  floatSpeed?: number;
}) {
  const ringRef  = useRef<THREE.Group>(null!);
  const goldMat  = useGoldMaterial(roughness);

  const stoneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:           new THREE.Color("#e8f4ff"),
        metalness:       0.05,
        roughness:       0.0,
        transparent:     true,
        opacity:         0.88,
        envMapIntensity: 4.0,
      }),
    []
  );

  const initY = useRef(position[1]);

  useFrame((state, delta) => {
    if (!ringRef.current) return;
    const t = scrollRef.current;

    // Slow self-rotation
    ringRef.current.rotation.z += delta * 0.14;

    // Phase 2 (0.25–0.5): shift position as camera moves forward
    const fwdT = THREE.MathUtils.smoothstep(t, 0.25, 0.5);
    ringRef.current.position.y = THREE.MathUtils.lerp(
      ringRef.current.position.y,
      initY.current - fwdT * 0.35 * scrollMult,
      1 - Math.pow(0.05, delta)
    );
  });

  return (
    <Float speed={floatSpeed} rotationIntensity={0.12} floatIntensity={0.22}>
      <group ref={ringRef} position={position} rotation={rotation}>
        {/* Ring band */}
        <mesh material={goldMat} castShadow>
          <torusGeometry args={[radius, tube, 28, 96]} />
        </mesh>

        {/* Engraving detail band */}
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[radius, tube * 0.55, 8, 96]} />
          <meshStandardMaterial
            color="#c49020"
            metalness={1}
            roughness={0.28}
            envMapIntensity={1.6}
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Diamond stone */}
        {hasStone && (
          <group position={[0, radius + tube * 0.5, 0]}>
            <mesh material={stoneMat} castShadow>
              <octahedronGeometry args={[tube * 1.5, 0]} />
            </mesh>
            {/* Stone setting prongs (4 thin cylinders) */}
            {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
              <mesh
                key={i}
                position={[
                  Math.sin(a) * tube * 1.1,
                  -tube * 0.5,
                  Math.cos(a) * tube * 1.1,
                ]}
                rotation={[0, a, 0.3]}
                material={goldMat}
              >
                <cylinderGeometry args={[0.01, 0.01, tube * 1.4, 4]} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </Float>
  );
}

/** Wide bracelet */
function Bracelet({
  position,
  rotation = [0, 0, 0],
  scrollRef,
  scrollMult = 1,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scrollRef: MutableRefObject<number>;
  scrollMult?: number;
}) {
  const ref     = useRef<THREE.Group>(null!);
  const goldMat = useGoldMaterial(0.13);
  const initY   = useRef(position[1]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = scrollRef.current;
    ref.current.rotation.y += delta * 0.11;
    const fwdT = THREE.MathUtils.smoothstep(t, 0.25, 0.5);
    ref.current.position.y = THREE.MathUtils.lerp(
      ref.current.position.y,
      initY.current - fwdT * 0.4 * scrollMult,
      1 - Math.pow(0.05, delta)
    );
  });

  return (
    <Float speed={0.9} rotationIntensity={0.08} floatIntensity={0.18}>
      <group ref={ref} position={position} rotation={rotation}>
        {/* Main bracelet band */}
        <mesh material={goldMat} castShadow>
          <torusGeometry args={[0.72, 0.072, 20, 100]} />
        </mesh>
        {/* Inner decorative band */}
        <mesh>
          <torusGeometry args={[0.72, 0.038, 10, 100]} />
          <meshStandardMaterial color="#c49020" metalness={1} roughness={0.25} envMapIntensity={1.4} />
        </mesh>
        {/* Clasp detail */}
        <mesh position={[0.72, 0, 0]}>
          <boxGeometry args={[0.08, 0.16, 0.04]} />
          <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.1} />
        </mesh>
      </group>
    </Float>
  );
}

/** Elegant necklace arc */
function Necklace({
  position,
  scrollRef,
}: {
  position: [number, number, number];
  scrollRef: MutableRefObject<number>;
}) {
  const ref     = useRef<THREE.Group>(null!);
  const goldMat = useGoldMaterial(0.09);
  const initY   = useRef(position[1]);

  const chainGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * i) / n;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.2, -Math.sin(a) * 0.7, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.032, 10, false);
  }, []);

  const pendantGeo = useMemo(
    () => new THREE.TorusGeometry(0.18, 0.022, 12, 48),
    []
  );

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = scrollRef.current;
    ref.current.rotation.z += delta * 0.08;
    const fwdT = THREE.MathUtils.smoothstep(t, 0.25, 0.5);
    ref.current.position.y = THREE.MathUtils.lerp(
      ref.current.position.y,
      initY.current - fwdT * 0.5,
      1 - Math.pow(0.05, delta)
    );
  });

  return (
    <Float speed={1.0} rotationIntensity={0.1} floatIntensity={0.15}>
      <group ref={ref} position={position}>
        <mesh geometry={chainGeo} material={goldMat} castShadow />
        {/* Pendant hanging at the bottom of the arc */}
        <mesh geometry={pendantGeo} material={goldMat} position={[0, -0.72, 0]} castShadow>
          {/* Small diamond in pendant */}
          <mesh position={[0, 0, 0]}>
            <octahedronGeometry args={[0.08, 0]} />
            <meshStandardMaterial
              color="#ddf0ff"
              metalness={0.0}
              roughness={0.0}
              transparent
              opacity={0.9}
              envMapIntensity={5}
            />
          </mesh>
        </mesh>
      </group>
    </Float>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAMERA SCROLL CONTROLLER
══════════════════════════════════════════════════════════════════ */
function CameraController({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const { camera } = useThree();
  const camZ = useRef(11);

  // Set initial lookAt
  useEffect(() => {
    camera.lookAt(0, 0.5, 0);
  }, [camera]);

  useFrame((_, delta) => {
    const t = scrollRef.current;

    // Phase 2 (0.25–0.5): camera pulls forward
    const fwdT = THREE.MathUtils.smoothstep(t, 0.25, 0.5);
    const targetZ = 11 - fwdT * 3; // 11 → 8
    camZ.current = THREE.MathUtils.lerp(camZ.current, targetZ, 1 - Math.pow(0.04, delta));

    camera.position.z = camZ.current;
    camera.lookAt(0, 0.4, 0);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   ROOT SCENE
══════════════════════════════════════════════════════════════════ */
export default function GoldBarScene() {
  const scrollRef = useRef(0);

  useEffect(() => {
    ScrollTrigger.create({
      start: "top top",
      end:   "bottom bottom",
      onUpdate: (self) => { scrollRef.current = self.progress; },
    });
    return () => ScrollTrigger.getAll().forEach((t) => t.kill());
  }, []);

  return (
    <>
      {/* ── Scroll-driven camera ── */}
      <CameraController scrollRef={scrollRef} />

      {/* ── Environment — studio HDR for clean gold reflections ── */}
      <Environment preset="studio" background={false} />

      {/* ── Lighting rig ── */}

      {/* Warm amber key — from upper right, main gold highlighter */}
      <spotLight
        position={[5, 10, 5]}
        angle={Math.PI / 10}
        penumbra={0.85}
        intensity={5.0}
        color="#ffe8b0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.001}
      />

      {/* Left fill — warm secondary */}
      <spotLight
        position={[-6, 7, 3]}
        angle={Math.PI / 8}
        penumbra={0.9}
        intensity={2.5}
        color="#ffd880"
        castShadow={false}
      />

      {/* Cool rim from behind — gives separation from dark bg */}
      <directionalLight
        position={[-3, 4, -8]}
        intensity={0.6}
        color="#a0c0e8"
      />

      {/* Under-bounce — gold glow from the floor */}
      <pointLight
        position={[0, -1.8, 2]}
        intensity={1.4}
        color="#c8880a"
        distance={10}
        decay={2}
      />

      {/* Emerald accent fill — from side walls */}
      <pointLight position={[-11, 3, 0]} intensity={0.6} color="#0D3B32" distance={16} decay={2} />
      <pointLight position={[11,  3, 0]} intensity={0.6} color="#0D3B32" distance={16} decay={2} />

      {/* Neutral ambient — very low, keeps shadows soft but not black */}
      <ambientLight intensity={0.08} color="#ffe4b0" />

      {/* ── Scene objects ── */}
      <MuseumHall />
      <CentralSculpture scrollRef={scrollRef} />

      {/* Rings */}
      <GoldRing
        position={[-3.0,  1.2,  1.2]}
        rotation={[0.5, 0, 0.35]}
        scrollRef={scrollRef}
        scrollMult={0.65}
        floatSpeed={1.1}
      />
      <GoldRing
        position={[ 2.8,  0.9,  0.6]}
        rotation={[0.7, 0.3, -0.4]}
        radius={0.48}
        tube={0.1}
        roughness={0.12}
        hasStone
        scrollRef={scrollRef}
        scrollMult={0.85}
        floatSpeed={1.4}
      />
      <GoldRing
        position={[-2.4, -1.0, -0.3]}
        rotation={[1.2, -0.2, 0.5]}
        radius={0.44}
        tube={0.085}
        roughness={0.15}
        scrollRef={scrollRef}
        scrollMult={1.05}
        floatSpeed={0.9}
      />
      {/* Extra ring — upper area */}
      <GoldRing
        position={[ 1.8,  2.4, -0.8]}
        rotation={[0.3, 0.6, 0.2]}
        radius={0.56}
        tube={0.095}
        hasStone
        scrollRef={scrollRef}
        scrollMult={0.5}
        floatSpeed={1.6}
      />

      {/* Bracelets */}
      <Bracelet
        position={[ 3.4,  0.1,  0.4]}
        rotation={[0.6, 0, 0.25]}
        scrollRef={scrollRef}
        scrollMult={0.75}
      />
      <Bracelet
        position={[-3.6, -0.5, -0.6]}
        rotation={[1.1, 0.3, -0.3]}
        scrollRef={scrollRef}
        scrollMult={1.0}
      />

      {/* Necklace */}
      <Necklace position={[2.2, 2.6, -0.5]} scrollRef={scrollRef} />

      {/* Floor shadow catcher */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.79, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.4} />
      </mesh>
    </>
  );
}
