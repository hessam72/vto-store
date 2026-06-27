"use client";

/**
 * Museum corridor environment.
 *
 * Builds the architectural shell:
 *  - Reflective obsidian floor
 *  - Dark ceiling with subtle coffers
 *  - Side columns
 *  - Atmospheric volume fog
 *  - Museum chamber entry portals
 *
 * Visibility controlled by scroll progress so the corridor
 * only fully reveals itself once the user has scrolled past
 * the hero section.
 */

import { useRef, useMemo, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Reflector } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  scrollProgress: MutableRefObject<number>;
}

// Procedural column instanced mesh
function Columns({ count = 8 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -6 : 6;
      const z    = -i * 4 + 8;
      dummy.position.set(side, -1, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <cylinderGeometry args={[0.18, 0.22, 8, 8]} />
      <meshStandardMaterial
        color="#0a0a0f"
        metalness={0.9}
        roughness={0.2}
        envMapIntensity={1.5}
      />
    </instancedMesh>
  );
}

// Door arch — used for chamber entry portals
function DoorArch({ position, visible }: { position: [number,number,number]; visible: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2, 0);
    s.lineTo(-2, 3);
    s.quadraticCurveTo(-2, 5, 0, 5);
    s.quadraticCurveTo(2, 5, 2, 3);
    s.lineTo(2, 0);
    s.closePath();

    // Cut out the opening
    const hole = new THREE.Path();
    hole.moveTo(-1.6, 0.1);
    hole.lineTo(-1.6, 2.8);
    hole.quadraticCurveTo(-1.6, 4.6, 0, 4.6);
    hole.quadraticCurveTo(1.6, 4.6, 1.6, 2.8);
    hole.lineTo(1.6, 0.1);
    hole.closePath();
    s.holes.push(hole);

    return s;
  }, []);

  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.04,
        bevelSegments: 4,
      }),
    [shape]
  );

  return (
    <mesh ref={meshRef} geometry={geometry} position={position} visible={visible} castShadow>
      <meshStandardMaterial
        color="#0d0d14"
        metalness={0.7}
        roughness={0.25}
        envMapIntensity={2}
      />
      {/* Gold trim on arch */}
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#b8860b" />
      </lineSegments>
    </mesh>
  );
}

export default function MuseumEnvironment({ scrollProgress }: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const fogRef = useRef<THREE.FogExp2>(null!);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = scrollProgress.current;

    // Fade in environment after hero
    const envOpacity = t > 0.1
      ? Math.min(1, (t - 0.1) / 0.2)
      : 0;
    groupRef.current.visible = envOpacity > 0.01;

    // Subtle sway
    groupRef.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.002;
  });

  return (
    <group ref={groupRef}>
      {/* Reflective floor */}
      <Reflector
        position={[0, -3, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        args={[40, 60]}
        resolution={256}
        mirror={0.6}
        mixBlur={8}
        mixStrength={0.8}
        blur={[200, 100]}
        minDepthThreshold={0.8}
        maxDepthThreshold={1.2}
        depthScale={1}
        depthToBlurRatioBias={0.2}
        distortion={0.15}
      >
        {(Material, props) => (
          <Material
            {...props}
            color="#0a0a0e"
            metalness={0.9}
            roughness={0.1}
          />
        )}
      </Reflector>

      {/* Ceiling */}
      <mesh position={[0, 8, -10]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 60, 8, 16]} />
        <meshStandardMaterial color="#08080d" metalness={0.3} roughness={0.9} />
      </mesh>

      {/* Back wall — far end of corridor */}
      <mesh position={[0, 2, -30]}>
        <planeGeometry args={[30, 24]} />
        <meshStandardMaterial color="#0a0a10" metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-10, 2, -10]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[60, 24]} />
        <meshStandardMaterial color="#090912" metalness={0.4} roughness={0.7} />
      </mesh>
      <mesh position={[10, 2, -10]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[60, 24]} />
        <meshStandardMaterial color="#090912" metalness={0.4} roughness={0.7} />
      </mesh>

      {/* Columns */}
      <Columns count={10} />

      {/* Chamber portals */}
      {[
        { pos: [-9.5, -3, -5]  as [number,number,number] },
        { pos: [-9.5, -3, -13] as [number,number,number] },
        { pos: [7.5,  -3, -5]  as [number,number,number] },
        { pos: [7.5,  -3, -13] as [number,number,number] },
      ].map(({ pos }, i) => (
        <DoorArch key={i} position={pos} visible />
      ))}

      {/* Ceiling accent lights */}
      {[-6, -2, 2, 6, -14, -18].map((z, i) => (
        <pointLight
          key={i}
          position={[0, 7, z]}
          intensity={0.8}
          color="#ffd28a"
          distance={12}
          decay={2}
        />
      ))}

      {/* Golden floor runner strip */}
      <mesh position={[0, -2.98, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 60]} />
        <meshStandardMaterial
          color="#b8860b"
          emissive="#7a5500"
          emissiveIntensity={0.4}
          metalness={1}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}
