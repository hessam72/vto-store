# 3D Virtual Store Implementation Roadmap

<!-- 
1.Foundation - Next.js route + deps
 2.Scene - Canvas + HDRI lighting
 3.Multi-Model Loader - Array of GLBs (first = collision wireframe)
 4.Physics - Octree + Capsule collision
 5.Collision Response - Wall sliding + gravity
 6.Joystick - Virtual joystick + WASD
 7.POV Camera - Mouse/touch tracking
 8.PCSS Shadows - Contact-hardening soft shadows
 9.Reflective Floor - MeshReflectorMaterial
 10.Post-Processing - N8AO, bloom, vignette
 11.Performance - Octree optimization + LOD
 12.Polish - Loading screens + error boundaries -->


## Project Overview

A first-person 3D virtual store built with **Next.js 16 + React 19 + Three.js + React Three Fiber**, featuring:
- **Physics-based collision** from wireframe GLB models (Octree + Capsule)
- **Virtual joystick** movement + **POV camera** tracking
- **PCSS soft shadows** (contact-hardening, realistic penumbra)
- **Reflective floor** with mirror material
- **Post-processing** (AO, bloom, vignette, SMAA)
- **Multi-model system**: First GLB = invisible collision mesh, rest = visual models

---

## Architecture Summary

### Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2.9 (App Router) |
| 3D Engine | Three.js r161+ |
| React Integration | @react-three/fiber 8.17+ |
| Helpers | @react-three/drei 9.114+ |
| Post-FX | @react-three/postprocessing 2.16+ |
| Controls | Custom joystick + PointerLockControls |

### File Structure
```
app/
├── store/
│   └── page.tsx                    # Main store route
components/
├── store/
│   ├── Scene.tsx                   # R3F Canvas + Scene setup
│   ├── ModelLoader.tsx             # Multi-GLB loader
│   ├── PhysicsSystem.tsx           # Octree + Capsule collision
│   ├── PlayerController.tsx        # Character movement + gravity
│   ├── POVCamera.tsx               # First-person camera rig
│   ├── Joystick.tsx                # Virtual joystick UI
│   ├── ShadowSystem.tsx            # PCSS shadow setup
│   ├── ReflectiveFloor.tsx         # Mirror floor plane
│   └── PostProcessing.tsx          # Effects composer
public/
└── store-models/
    ├── wireframe-collision.glb     # Physics mesh (invisible)
    ├── store-visual.glb            # Main store model
    └── products/                   # Product models
```

### Core Concepts

#### 1. Multi-Model Loading System
```typescript
type ModelConfig = {
  url: string
  isWireframe: boolean  // First model = true (collision only)
  position?: [number, number, number]
  scale?: number
}

const STORE_MODELS: ModelConfig[] = [
  { url: '/store-models/wireframe-collision.glb', isWireframe: true },
  { url: '/store-models/store-visual.glb', isWireframe: false },
  { url: '/store-models/products/shelf-a.glb', isWireframe: false, position: [5, 0, 2] },
]
```

#### 2. Physics Architecture (from [3D_COLLISION_SYSTEM.md](./3D_COLLISION_SYSTEM.md))
```
Wireframe GLB (first model)
    ↓
Parse scene graph → Extract geometry
    ↓
Build Octree spatial index
    ↓
Player = Capsule primitive (1.1m tall, 0.35m radius)
    ↓
Every frame: Test capsule vs octree
    ↓
Collision? → Slide along walls / Stop at floors
```

#### 3. Rendering Pipeline (from [3d-scene-shadow-reflections-demo/HOW_IT_WORKS.md](../3d-scene-shadow-reflections-demo/HOW_IT_WORKS.md))
```
HDRI Environment (lighting + reflections)
    ↓
Directional Key Light (sun, casts PCSS shadows)
    ↓
Models (cast/receive shadows)
    ↓
Reflective Floor (MeshReflectorMaterial)
    ↓
Post-Processing (N8AO → Bloom → SMAA → Vignette)
```

---

## Implementation Phases

### **Phase 1: Foundation Setup**

#### Goals
- Install dependencies
- Set up Next.js route
- Create component structure

#### Tasks
1. **Install packages**
   ```bash
   npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
   npm install -D @types/three
   ```

2. **Create route**: `app/store/page.tsx`
   ```tsx
   import dynamic from 'next/dynamic'

   const StoreScene = dynamic(() => import('@/components/store/Scene'), {
     ssr: false
   })

   export default function StorePage() {
     return (
       <div className="h-screen w-screen">
         <StoreScene />
       </div>
     )
   }
   ```

3. **Create folder structure**
   ```bash
   mkdir -p components/store
   mkdir -p public/store-models
   ```

#### Deliverables
- ✅ Dependencies installed
- ✅ `/store` route accessible
- ✅ Component folders created

---

### **Phase 2: Basic Scene Setup**

#### Goals
- R3F Canvas with proper settings
- HDRI environment lighting
- Basic directional light with shadows

#### Implementation: `components/store/Scene.tsx`
```tsx
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{ position: [0, 1.6, 5], fov: 60, near: 0.1, far: 200 }}
    >
      {/* HDRI lighting */}
      <Environment
        files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr"
        background={false}
        environmentIntensity={1.0}
      />

      {/* Key light (sun) */}
      <directionalLight
        position={[10, 15, 5]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-20, 20, 20, -20, 0.1, 60]}
        />
      </directionalLight>

      {/* Fill light */}
      <directionalLight position={[-7, 4, -5]} intensity={0.5} color="#cdd6ff" />

      {/* Dark background */}
      <color attach="background" args={['#0c0d0f']} />

      {/* Temporary test cube */}
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {/* Temporary ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
  )
}
```

#### Deliverables
- ✅ Scene renders with proper tone mapping
- ✅ HDRI lighting works
- ✅ Shadows visible on test cube

---

### **Phase 3: Multi-Model Loader**

#### Goals
- Load array of GLB files
- First model → invisible wireframe (collision only)
- Rest → visible with shadows

#### Implementation: `components/store/ModelLoader.tsx`
```tsx
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

type ModelConfig = {
  url: string
  isWireframe: boolean
  position?: [number, number, number]
  scale?: number
}

export function ModelLoader({ models }: { models: ModelConfig[] }) {
  return (
    <>
      {models.map((config, idx) => (
        <Model key={idx} config={config} />
      ))}
    </>
  )
}

function Model({ config }: { config: ModelConfig }) {
  const { scene } = useGLTF(config.url)

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)

    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (config.isWireframe) {
          // Wireframe model: invisible, used only for collision
          obj.visible = false
          obj.castShadow = false
          obj.receiveShadow = false
        } else {
          // Visual models: visible with shadows
          obj.castShadow = true
          obj.receiveShadow = true
          if (obj.material) {
            obj.material.envMapIntensity = 1
            obj.material.needsUpdate = true
          }
        }
      }
    })

    // Auto-center on Y=0
    const box = new THREE.Box3().setFromObject(clone)
    const yOffset = -box.min.y
    clone.position.y = yOffset

    return clone
  }, [scene, config.isWireframe])

  return (
    <primitive
      object={clonedScene}
      position={config.position || [0, 0, 0]}
      scale={config.scale || 1}
    />
  )
}
```

#### Usage in Scene
```tsx
const STORE_MODELS = [
  { url: '/store-models/wireframe-collision.glb', isWireframe: true },
  { url: '/store-models/store-visual.glb', isWireframe: false },
]

<ModelLoader models={STORE_MODELS} />
```

#### Deliverables
- ✅ Array of models loads correctly
- ✅ First model invisible (wireframe)
- ✅ Visual models have shadows enabled

---

### **Phase 4: Physics Engine (Octree + Capsule)**

#### Goals
- Build Octree from wireframe model
- Create player Capsule
- Per-frame collision detection
- Wall/floor recognition

#### Implementation: `components/store/PhysicsSystem.tsx`
```tsx
import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Octree } from 'three/examples/jsm/math/Octree.js'
import { Capsule } from 'three/examples/jsm/math/Capsule.js'
import * as THREE from 'three'

export function usePhysics() {
  const { scene } = useThree()
  const worldOctree = useRef(new Octree())
  const playerCollider = useRef(
    new Capsule(
      new THREE.Vector3(0, 0.35, 0),  // Bottom
      new THREE.Vector3(0, 1.45, 0),  // Top (player eye height ~1.6m)
      0.35                             // Radius
    )
  )
  const playerVelocity = useRef(new THREE.Vector3())
  const playerOnFloor = useRef(false)

  // Build octree once on mount
  useEffect(() => {
    console.log('Building collision octree...')
    worldOctree.current.fromGraphNode(scene)
    console.log('Octree built from', scene.children.length, 'objects')
  }, [scene])

  // Collision detection every frame
  useFrame((state, delta) => {
    const result = worldOctree.current.capsuleIntersect(playerCollider.current)
    playerOnFloor.current = false

    if (result) {
      // Check if collision is with floor (normal pointing up)
      playerOnFloor.current = result.normal.y > 0

      if (!playerOnFloor.current) {
        // Wall collision: remove velocity component into wall
        playerVelocity.current.addScaledVector(
          result.normal,
          -result.normal.dot(playerVelocity.current)
        )
      }

      // Push capsule out of collision
      playerCollider.current.translate(
        result.normal.multiplyScalar(result.depth)
      )
    }
  })

  return {
    worldOctree,
    playerCollider,
    playerVelocity,
    playerOnFloor,
  }
}
```

#### Deliverables
- ✅ Octree built from wireframe mesh
- ✅ Capsule collision primitive created
- ✅ Collision detection working
- ✅ Floor vs wall recognized

---

### **Phase 5: Collision Response (Sliding + Gravity)**

#### Implementation: `components/store/PlayerController.tsx`
```tsx
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

const GRAVITY = 30 // units/second²

export function usePlayerPhysics(physics: ReturnType<typeof usePhysics>) {
  const damping = useRef(0)

  useFrame((state, delta) => {
    const { playerVelocity, playerOnFloor, playerCollider } = physics

    // Apply gravity when airborne
    if (!playerOnFloor.current) {
      playerVelocity.current.y -= GRAVITY * delta
    }

    // Apply damping (friction/air resistance)
    damping.current = Math.exp(-4 * delta) - 1
    playerVelocity.current.addScaledVector(
      playerVelocity.current,
      damping.current
    )

    // Move capsule by velocity
    const deltaPosition = playerVelocity.current.clone().multiplyScalar(delta)
    playerCollider.current.translate(deltaPosition)

    // Update camera position to follow capsule
    state.camera.position.copy(playerCollider.current.end)

    // Safety: teleport if fallen through floor
    if (state.camera.position.y < -5) {
      playerCollider.current.start.set(0, 0.35, 0)
      playerCollider.current.end.set(0, 1.45, 0)
      state.camera.position.copy(playerCollider.current.end)
      playerVelocity.current.set(0, 0, 0)
    }
  })
}
```

#### Deliverables
- ✅ Gravity pulls player down when airborne
- ✅ Damping decelerates player naturally
- ✅ Player slides along walls
- ✅ Fallthrough safety (teleport if Y < -5)

---

### **Phase 6: Joystick Controls**

#### Goals
- Virtual joystick UI for mobile
- WASD fallback for desktop
- Apply velocity in camera-relative directions

#### Implementation: `components/store/Joystick.tsx`
```tsx
'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function useJoystickControls(playerVelocity: React.RefObject<THREE.Vector3>, camera: THREE.Camera) {
  const keysPressed = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const updateMovement = (delta: number) => {
    const speed = 5 // units/second
    const keys = keysPressed.current

    // Get camera direction (ignore Y component for movement)
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    // Apply input
    if (keys['w']) playerVelocity.current.add(forward.multiplyScalar(speed * delta))
    if (keys['s']) playerVelocity.current.add(forward.multiplyScalar(-speed * delta))
    if (keys['a']) playerVelocity.current.add(right.multiplyScalar(-speed * delta))
    if (keys['d']) playerVelocity.current.add(right.multiplyScalar(speed * delta))
  }

  return { updateMovement }
}
```

#### Mobile Joystick (Optional: Use nipplejs or custom)
```tsx
// Install: npm install nipplejs @types/nipplejs
import nipplejs from 'nipplejs'

export function VirtualJoystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const zoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!zoneRef.current) return

    const manager = nipplejs.create({
      zone: zoneRef.current,
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      color: 'cyan',
    })

    manager.on('move', (evt, data) => {
      const angle = data.angle.radian
      const force = Math.min(data.force, 2) / 2
      const x = Math.cos(angle) * force
      const y = Math.sin(angle) * force
      onMove(x, y)
    })

    manager.on('end', () => onMove(0, 0))

    return () => manager.destroy()
  }, [onMove])

  return <div ref={zoneRef} className="fixed bottom-0 left-0 w-40 h-40 pointer-events-auto" />
}
```

#### Deliverables
- ✅ WASD keyboard controls work
- ✅ Movement is camera-relative
- ✅ Virtual joystick for mobile (optional)

---

### **Phase 7: POV Camera System**

#### Goals
- First-person camera locked to player capsule
- Mouse drag / touch → look around (yaw/pitch)
- Smooth camera rotation

#### Implementation: `components/store/POVCamera.tsx`
```tsx
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function usePOVCamera() {
  const { camera, gl } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)
  const isDragging = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = () => {
      isDragging.current = true
      canvas.requestPointerLock()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current && document.pointerLockElement !== canvas) return

      const sensitivity = 0.002
      yaw.current -= e.movementX * sensitivity
      pitch.current -= e.movementY * sensitivity

      // Clamp pitch to prevent flipping
      pitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.current))
    }

    const onPointerUp = () => {
      isDragging.current = false
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [gl])

  useFrame(() => {
    // Apply rotation to camera
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)
  })
}
```

#### Deliverables
- ✅ Camera follows player position
- ✅ Mouse drag rotates view
- ✅ Pitch clamped to prevent upside-down
- ✅ Pointer lock for desktop

---

### **Phase 8: PCSS Soft Shadows**

#### Goals
- Integrate Drei's `<SoftShadows>` component
- Contact-hardening shadows (crisp near contact, soft far away)
- Configurable quality

#### Implementation: `components/store/ShadowSystem.tsx`
```tsx
import { SoftShadows } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

export function ShadowSystem({
  size = 18,
  samples = 17,
  focus = 0,
}: {
  size?: number
  samples?: number
  focus?: number
}) {
  const { scene, gl } = useThree()

  // Force material update when shadow params change
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        obj.material.needsUpdate = true
      }
    })
    gl.shadowMap.needsUpdate = true
  }, [size, samples, focus, scene, gl])

  return (
    <SoftShadows
      size={size}
      samples={samples}
      focus={focus}
    />
  )
}
```

#### Recommended Settings
| Setting | Value | Effect |
|---------|-------|--------|
| size | 18-22 | Penumbra spread (softness) |
| samples | 17-20 | Quality (smoothness, more = slower) |
| focus | 0-0.5 | Contact sharpness |

#### Usage
```tsx
<Canvas shadows>
  <ShadowSystem size={20} samples={17} focus={0} />
  {/* rest of scene */}
</Canvas>
```

#### Deliverables
- ✅ PCSS shadows enabled
- ✅ Crisp shadows at contact points
- ✅ Soft penumbra far from contact

---

### **Phase 9: Reflective Floor**

#### Implementation: `components/store/ReflectiveFloor.tsx`
```tsx
import { MeshReflectorMaterial } from '@react-three/drei'

export function ReflectiveFloor({
  size = 60,
  mixStrength = 0.62,
  blur = 0.85,
  roughness = 0.62,
}: {
  size?: number
  mixStrength?: number
  blur?: number
  roughness?: number
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={1024}
        mixBlur={1}
        mixStrength={mixStrength * 14}
        blur={[blur * 600, blur * 120]}
        mirror={0}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        roughness={roughness}
        metalness={0.55}
        color="#0e0f12"
      />
    </mesh>
  )
}
```

#### Deliverables
- ✅ Glossy reflective floor
- ✅ Adjustable reflection strength & blur
- ✅ Performance-optimized (1024 resolution)

---

### **Phase 10: Post-Processing**

#### Implementation: `components/store/PostProcessing.tsx`
```tsx
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'

export function PostProcessing({
  enableAO = true,
  enableBloom = true,
  enableVignette = true,
}: {
  enableAO?: boolean
  enableBloom?: boolean
  enableVignette?: boolean
}) {
  return (
    <EffectComposer multisampling={0}>
      {enableAO && (
        <N8AO
          aoRadius={1.2}
          intensity={2.4}
          distanceFalloff={1.0}
          quality="performance"
          color="black"
        />
      )}
      {enableBloom && (
        <Bloom
          intensity={0.42}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.2}
          mipmapBlur
          radius={0.6}
        />
      )}
      <SMAA />
      {enableVignette && (
        <Vignette
          eskil={false}
          offset={0.32}
          darkness={0.62}
        />
      )}
    </EffectComposer>
  )
}
```

#### Effects Explained
| Effect | Purpose |
|--------|---------|
| N8AO | Ambient occlusion (contact shadows in crevices) |
| Bloom | Subtle glow on bright highlights |
| SMAA | Anti-aliasing (smooth edges) |
| Vignette | Darken frame edges (focus attention) |

#### Deliverables
- ✅ Post-processing pipeline active
- ✅ Scene looks photoreal
- ✅ Toggleable effects for performance

---

### **Phase 11: Performance Optimization**

#### Strategies

1. **Octree Optimization**
   - Build once on load, reuse every frame
   - No per-frame updates unless scene changes

2. **Shadow Map Caching**
   ```tsx
   <directionalLight
     castShadow
     shadow-mapSize={[2048, 2048]}
     shadow-camera-updateProjectionMatrix={false}
   />
   ```

3. **Frustum Culling**
   - Three.js handles automatically
   - Ensure models have correct bounding boxes

4. **LOD (Level of Detail)**
   ```tsx
   import { Lod } from '@react-three/drei'

   <Lod distances={[0, 10, 20]}>
     <Model detail="high" />
     <Model detail="medium" />
     <Model detail="low" />
   </Lod>
   ```

5. **Lazy Loading**
   ```tsx
   <Suspense fallback={<LoadingScreen />}>
     <ModelLoader models={STORE_MODELS} />
   </Suspense>
   ```

6. **Mobile Optimizations**
   - Reduce shadow map size to 1024 on mobile
   - Lower post-processing quality
   - Disable reflections on low-end devices

#### Deliverables
- ✅ 60fps on desktop
- ✅ 30fps+ on mobile
- ✅ Loading screens for async content

---

### **Phase 12: Polish & Testing**

#### Tasks

1. **Loading Screen**
   ```tsx
   import { useProgress } from '@react-three/drei'

   function LoadingScreen() {
     const { progress } = useProgress()
     return (
       <div className="loading">
         Loading {Math.round(progress)}%
       </div>
     )
   }
   ```

2. **Error Boundaries**
   ```tsx
   class SceneErrorBoundary extends React.Component {
     componentDidCatch(error) {
       console.error('3D scene error:', error)
     }
     render() {
       return this.state.error ? <FallbackUI /> : this.props.children
     }
   }
   ```

3. **Mobile Testing**
   - Virtual joystick usability
   - Touch camera controls
   - Performance profiling

4. **Cross-Browser Testing**
   - Chrome, Safari, Firefox
   - iOS Safari (WebGL limitations)
   - Android Chrome

5. **Debugging Tools**
   ```tsx
   // Show collision capsule
   import { CapsuleHelper } from 'three/examples/jsm/helpers/CapsuleHelper'

   <primitive object={new CapsuleHelper(playerCollider.current)} />
   ```

#### Deliverables
- ✅ Production-ready build
- ✅ All browsers tested
- ✅ Mobile optimized
- ✅ Error handling complete

---

## Final Checklist

### Core Features
- [ ] Multi-model loader (wireframe + visual models)
- [ ] Octree collision detection
- [ ] Capsule player primitive
- [ ] Wall/floor recognition (normal.y > 0)
- [ ] Gravity + damping physics
- [ ] Joystick controls (keyboard + virtual)
- [ ] POV camera (mouse/touch look)
- [ ] PCSS soft shadows
- [ ] Reflective floor
- [ ] Post-processing (AO, bloom, vignette)

### Performance
- [ ] 60fps on desktop
- [ ] 30fps+ on mobile
- [ ] Proper frustum culling
- [ ] Shadow map optimization
- [ ] Lazy loading models

### Polish
- [ ] Loading screen with progress
- [ ] Error boundaries
- [ ] Fallthrough safety (teleport)
- [ ] Mobile joystick UI
- [ ] Cross-browser tested

---

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.161.0",
    "@react-three/fiber": "^8.17.10",
    "@react-three/drei": "^9.114.3",
    "@react-three/postprocessing": "^2.16.3",
    "nipplejs": "^0.10.2"
  },
  "devDependencies": {
    "@types/three": "^0.161.0",
    "@types/nipplejs": "^0.10.0"
  }
}
```

---

## Reference Documents

- **Collision System Details:** [3D_COLLISION_SYSTEM.md](./3D_COLLISION_SYSTEM.md)
- **Shadow/Reflection Implementation:** [../3d-scene-shadow-reflections-demo/HOW_IT_WORKS.md](../3d-scene-shadow-reflections-demo/HOW_IT_WORKS.md)
- **Three.js Octree Docs:** [Three.js Examples - Octree](https://threejs.org/examples/?q=octree#misc_controls_pointerlock)
- **R3F Docs:** [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- **Drei Helpers:** [Drei Components](https://github.com/pmndrs/drei)

---

## Next Steps

1. **Phase 1-3:** Basic scene + model loading (1-2 days)
2. **Phase 4-5:** Physics engine (2-3 days)
3. **Phase 6-7:** Controls + camera (1-2 days)
4. **Phase 8-10:** Visual polish (shadows, reflections, post-FX) (2 days)
5. **Phase 11-12:** Optimization + testing (2-3 days)

**Total estimated time:** 8-12 days for full implementation

---

**Status:** ✅ Roadmap complete — ready for implementation
