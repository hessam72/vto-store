# Sunlight, Shadows &amp; Reflective Floor — Porting Guide

A self-contained spec for reproducing this project's window-sunlight + PCSS soft shadow +
reflective floor stack in another React Three Fiber project. Every value here was read out of
the shipping source, not from other docs (which have drifted). Read top-to-bottom once, then
port section by section — the order of sections is the order to implement in.

Target stack: R3F + drei. All code blocks are paste-ready; the only edits needed are import
paths and the two hooks marked `// YOUR PROJECT`.

---

## 0. What this builds

A walkable interior lit as if the sun were coming through a window: a hand-aimed directional
light outside the building shines through an opening modelled in the GLB, and PCSS soft
shadows paint a window-shaped light patch on a mirror-ish floor, softening at the edges with
distance. Around it sits an HDRI-based ambient fill, per-fixture lamp point lights discovered
from GLB mesh names, and a small post stack.

```
HDRI Environment            ambient fill + reflections (no background)
        ↓
SoftShadows (PCSS)          global shadow shader patch — MUST mount before GLB materials
        ↓
DirectionalLight "sun"      castShadow + orthographic shadow camera enclosing the whole room
        ↓
GLB mesh naming policy      glass = no cast · lamp = anchor · light = emissive · shadowSide
        ↓
Reflective floor            MeshReflectorMaterial, receiveShadow = true
        ↓
EffectComposer              N8AO → Bloom → SMAA → Vignette
```

### Dependencies

| Package | Version here | Note |
|---|---|---|
| `three` | `0.170.0` | pinned exact |
| `@react-three/fiber` | `8.17.10` | pinned exact |
| `@react-three/drei` | `9.122.0` | pinned exact — `SoftShadows`, `MeshReflectorMaterial`, `Environment`, `Lightformer`, `ContactShadows`, `AccumulativeShadows`, `PerformanceMonitor` |
| `@react-three/postprocessing` | `2.19.1` | |
| `postprocessing` | `6.37.8` | |
| `realism-effects` | `^1.1.2` | optional (SSGI) |

> **Version constraint:** if you port the optional SSGI path, keep `three` ≤ 0.171.
> `realism-effects` uses `WebGLMultipleRenderTargets`, removed in r172. Without SSGI you are
> free to use a newer three, but re-verify `SoftShadows` still patches cleanly — it monkey-
> patches three's internal shadow shader chunk and is version-sensitive.

Next.js users: transpile the 3D packages.

```js
// next.config.mjs
transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
```

---

## 1. Renderer baseline

Everything downstream is calibrated to these two numbers. Port them first, verify a grey box
looks right, then move on.

```tsx
<Canvas
  shadows                                  // default PCFSoftShadowMap; SoftShadows replaces the chunk
  frameloop="demand"
  dpr={dpr}                                // see §7
  gl={{
    // The EffectComposer renders offscreen, so canvas MSAA is never displayed.
    // AA lives in the composer (multisampling / SMAA).
    antialias: false,
    powerPreference: 'high-performance',
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 0.3,
  }}
  camera={{ position: [0, 2, 5], fov: 60, near: 0.1, far: 200 }}
>
```

> **`toneMappingExposure: 0.3` is load-bearing.** Every light intensity in this document
> (sun 20, lamps 10, vitrine 18) is a candela value tuned against it. If you copy the
> intensities into a scene at exposure 1.0 the whole thing blows out. Change exposure *or*
> intensities, never assume one without the other.

`outputColorSpace` is never set anywhere — R3F's default (`SRGBColorSpace`) is correct and
overriding it will break the tone-mapping calibration.

The three canvases in this repo, for reference on what varies:

| Surface | Tone mapping | Exposure | dpr | canvas AA | File |
|---|---|---|---|---|---|
| `/store` (this guide) | ACESFilmic | 0.3 | tier-driven | off | `components/store/Scene.tsx:169` |
| `/car` configurator | `NeutralToneMapping` | 1.0 | tier-driven | off | `components/car/CarTuningScene.tsx:12` |
| Homepage hero | ACESFilmic | 1.2 | `[0.75, 1.5]` | **on** | `components/sections/HeroSection.tsx:290` |

> `/car` uses Khronos PBR Neutral because ACESFilmic pushed pure red paint toward orange.
> `AgXToneMapping` is the filmic alternative that is also hue-stable. Pick per content:
> ACES for atmosphere, Neutral/AgX for brand-accurate product colour.

---

## 2. The sun

### Design, stated honestly

There is **no solar azimuth / elevation / time-of-day math**. This is a static
`directionalLight` placed outside the building by hand and aimed through a window opening
that exists as geometry in the GLB. The window shape on the floor comes entirely from the
shadow depth pass hitting the wall around the opening. If you want a real sun position, layer
a solar-position library on top and feed `position` — nothing else in this section changes.

### Config-first shape

Aiming a sun by editing source and reloading is miserable. The pattern here is: a typed
config object, a code-side default, a shallow merge so a scene overrides only what it cares
about, and a dev overlay (§8) that prints a paste-ready block.

```ts
/** Orthographic shadow-camera frustum for the window sun (world units) */
export type SunShadowConfig = {
  left: number; right: number; top: number; bottom: number
  near: number; far: number
  bias: number; normalBias: number
}

/** drei SoftShadows (PCSS) parameters */
export type SoftShadowConfig = {
  size: number      // light-source size — larger = softer penumbra
  samples: number   // PCF samples — quality vs cost
  focus: number     // depth focus of the softening
}

export type SunConfig = {
  enabled: boolean
  position: [number, number, number]
  target: [number, number, number]
  intensity: number
  color: string
  soft: SoftShadowConfig
  shadow: SunShadowConfig
}
```

```ts
export const DEFAULT_SUN: SunConfig = {
  enabled: false,
  position: [8, 7, -6],
  target: [0, 0.5, 0],
  intensity: 20,
  color: '#ffe3c2',
  soft: { size: 20, samples: 16, focus: 0 },
  shadow: {
    left: -14, right: 14, top: 14, bottom: -14,
    near: 0.5, far: 45, bias: -0.0001, normalBias: 0.03,
  },
}

function mergeSun(base: SunConfig, over?: DeepPartial<SunConfig> | null): SunConfig {
  if (!over) return base
  return {
    enabled: over.enabled ?? base.enabled,
    position: (over.position as [number, number, number]) ?? base.position,
    target: (over.target as [number, number, number]) ?? base.target,
    intensity: over.intensity ?? base.intensity,
    color: over.color ?? base.color,
    soft: { ...base.soft, ...over.soft },
    shadow: { ...base.shadow, ...over.shadow },
  }
}
```

### The component

```tsx
'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function SunLight({ sun }: { sun?: DeepPartial<SunConfig> }) {
  const invalidate = useThree((s) => s.invalidate)
  const res = useShadowResolution()          // YOUR PROJECT: 512 / 1024 / 2048

  const [override, setOverride] = useState<SunConfig | null>(null)
  const cfg = useMemo(() => override ?? mergeSun(DEFAULT_SUN, sun), [override, sun])

  const lightRef = useRef<THREE.DirectionalLight>(null)
  const shadowCamRef = useRef<THREE.OrthographicCamera>(null)
  const targetObj = useMemo(() => new THREE.Object3D(), [])
  const prevRes = useRef(res)

  // (1) Frozen initial args — see note below
  const initialArgs = useRef<[number, number, number, number, number, number]>([
    cfg.shadow.left, cfg.shadow.right, cfg.shadow.top,
    cfg.shadow.bottom, cfg.shadow.near, cfg.shadow.far,
  ])

  useLayoutEffect(() => {
    const cam = shadowCamRef.current
    if (cam) {
      cam.left = cfg.shadow.left
      cam.right = cfg.shadow.right
      cam.top = cfg.shadow.top
      cam.bottom = cfg.shadow.bottom
      cam.near = cfg.shadow.near
      cam.far = cfg.shadow.far
      cam.updateProjectionMatrix()
    }
    // (2) three never resizes an existing shadow FBO — drop it so it rebuilds
    const light = lightRef.current
    if (light && prevRes.current !== res) {
      prevRes.current = res
      const shadow = light.shadow as unknown as { map: THREE.WebGLRenderTarget | null }
      shadow.map?.dispose()
      shadow.map = null
    }
    invalidate()
  }, [cfg, res, invalidate])

  if (!cfg.enabled) return null

  return (
    <>
      <directionalLight
        ref={lightRef}
        castShadow
        position={cfg.position}
        intensity={cfg.intensity}
        color={cfg.color}
        target={targetObj}
        shadow-mapSize-width={res}
        shadow-mapSize-height={res}
        shadow-bias={cfg.shadow.bias}
        shadow-normalBias={cfg.shadow.normalBias}
      >
        <orthographicCamera ref={shadowCamRef} attach="shadow-camera" args={initialArgs.current} />
      </directionalLight>

      {/* (3) Target must live in the graph so its world matrix updates */}
      <primitive object={targetObj} position={cfg.target} />
    </>
  )
}
```

### Three non-obvious details

1. **Frozen `initialArgs`.** If you pass live config values to `args`, R3F tears down and
   reconstructs the `OrthographicCamera` on every change. That invalidates
   `light.shadow.camera`, which kills any `CameraHelper` holding a reference to it and
   re-allocates state per keystroke while tuning. Freeze `args` at first mount and drive the
   bounds imperatively in a `useLayoutEffect`.

2. **Shadow FBO does not resize.** `light.shadow.mapSize` is respected only when the render
   target is first allocated. Changing resolution at runtime (a quality selector) does
   nothing until you `dispose()` the existing `shadow.map` and set it to `null`; three then
   rebuilds it at the new size on the next shadow pass. Same quirk applies to spot lights.

3. **`target` must be in the scene graph.** A `THREE.Object3D` assigned to `light.target` only
   contributes a direction once its world matrix has been updated, which only happens if it
   is a descendant of the scene. Mount it via `<primitive object={targetObj} position={...} />`
   — setting `light.target.position` on a detached object silently does nothing.

### Shipped values

| Field | `DEFAULT_SUN` | Shipped (`mall` store) |
|---|---|---|
| `position` | `[8, 7, -6]` | `[28, 8.5, -4.5]` |
| `target` | `[0, 0.5, 0]` | `[0.5, 0.5, 6.5]` |
| `intensity` | 20 | 20 |
| `color` | `#ffe3c2` | `#ffe3c2` |
| `soft` | size 20 · samples 16 · focus 0 | same |
| ortho box | ±14 | **±22** |
| `near` / `far` | 0.5 / 45 | 0.5 / 45 |
| `bias` / `normalBias` | -0.0001 / 0.03 | -0.0001 / 0.03 |

The warm `#ffe3c2` plus a low ortho angle is what reads as "late afternoon". The ±22 box was
grown from ±14 during tuning because the room did not fit — see the leak rule below.

Stored as JSON so it is editable without a rebuild:

```json
{
  "sun": {
    "enabled": true,
    "position": [28, 8.5, -4.5],
    "target": [0.5, 0.5, 6.5],
    "intensity": 20,
    "color": "#ffe3c2",
    "soft": { "size": 20, "samples": 16, "focus": 0 },
    "shadow": {
      "left": -22, "right": 22, "top": 22, "bottom": -22,
      "near": 0.5, "far": 45, "bias": -0.0001, "normalBias": 0.03
    }
  }
}
```

---

## 3. PCSS soft shadows

drei's `SoftShadows` replaces three's shadow sampling with percentage-closer soft shadows:
penumbra widens with distance from the occluder, which is exactly the window-light signature —
crisp where the light patch meets the wall base, blurry at the far edge.

```tsx
'use client'
import { SoftShadows } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

export function ShadowSystem({ size = 20, samples = 17, focus = 0 }) {
  const { scene, gl, invalidate } = useThree()

  // drei SoftShadows swaps the global shadow shader chunk + recompiles on
  // mount / param change, but skips array materials and never repaints. Cover
  // both gaps: force array-material recompile, then invalidate so the newly
  // compiled state actually draws under frameloop='demand'.
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) obj.material.needsUpdate = true
    })
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [size, samples, focus, scene, gl, invalidate])

  return <SoftShadows size={size} samples={samples} focus={focus} />
}
```

Shipped: `size 20, samples 16, focus 0`. Useful range: `size 18–22`, `samples 16–20`,
`focus 0–0.5`. `size` is the virtual light-source diameter — the single knob for "how soft".

### Mount order

`SoftShadows` patches a **global** shader chunk and triggers a recompile. Materials that
compile *after* the patch pick it up for free; materials already compiled need
`needsUpdate = true`, which is what the effect above does. In practice: mount `ShadowSystem`
inside the Canvas, above the model loader, and make sure the Canvas itself only mounts once
scene config has resolved. Then GLB materials stream in against an already-patched chunk.

### The leak rule

> **drei's PCSS returns *fully lit* for any fragment outside the orthographic shadow box.**
> Not "unshadowed by this light" — fully lit. An undersized box therefore does not clip the
> shadow, it floods sunlight through your walls into the parts of the room that fall outside
> the frustum. **The box must enclose the entire interior**, not just the lit patch. This is
> the number one failure mode; verify it visually with the `CameraHelper` in §8 before
> debugging anything else.

### Scope of the patch

PCSS patches `getShadow` for **directional and spot** lights only. Point lights fall back to
three's native cube PCF and are unaffected — relevant when you add lamps (§6).

---

## 4. GLB mesh naming contract

The window-shaped patch is produced by the shadow depth pass, which is **alpha-blind**: a
transparent glass pane casts a solid black shadow like any other mesh, blacking out the
entire sun patch. The fix is a naming contract enforced during model traversal.

| Mesh name contains | Effect | Why |
|---|---|---|
| `glass` | `castShadow = false` | depth pass ignores alpha; a pane would black out the whole patch |
| `lamp` | `userData.isLamp = true`, `castShadow = false` | anchor for §6; a lamp must not occlude its own bulb |
| `light` | `emissive = #f6ffc4`, `emissiveIntensity = 2` | feeds Bloom for string-light glow |
| `ceiling`, or `position.y > 3` | `material.side = DoubleSide` | visible from below in floor reflections |
| *(all visual meshes)* | `material.shadowSide = DoubleSide` | thin single-plane walls cast regardless of GLB winding |
| *(all visual meshes)* | `castShadow = receiveShadow = true` | |
| collision/wireframe model | all shadows off, `opacity 0`, `transparent`, `depthWrite false`, `renderOrder -1` | invisible physics proxy |

Window **frames and mullions keep casting** — they are what draws the window pattern on the
floor. Only the panes opt out.

```tsx
clone.traverse((obj) => {
  if (!(obj instanceof THREE.Mesh)) return

  obj.castShadow = true
  obj.receiveShadow = true

  if (obj.name.toLowerCase().includes('glass')) obj.castShadow = false

  const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
  materials.forEach((mat) => {
    mat.envMapIntensity = 1
    // Cast from both faces so thin single-plane walls / window frames are
    // reliable regardless of GLB winding (affects the depth pass only).
    mat.shadowSide = THREE.DoubleSide
    mat.needsUpdate = true
  })

  if (obj.name.toLowerCase().includes('ceiling') || obj.position.y > 3) {
    materials.forEach((mat) => { mat.side = THREE.DoubleSide; mat.needsUpdate = true })
  }

  if (obj.name.toLowerCase().includes('lamp')) {
    obj.userData.isLamp = true
    obj.castShadow = false
  }

  if (obj.name.toLowerCase().includes('light')) {
    materials.forEach((mat) => {
      mat.emissive = new THREE.Color('#f6ffc4')
      mat.emissiveIntensity = 2
      mat.needsUpdate = true
    })
  }
})

// Sit the model on y=0 regardless of how it was exported
const box = new THREE.Box3().setFromObject(clone)
clone.position.y = -box.min.y
```

> Naming is substring-matched and case-insensitive, so the categories are not mutually
> exclusive. Keep fixture names free of `light`/`glass`/`ceiling` if you only want the `lamp`
> behaviour.

Also worth copying: one shared `DRACOLoader` instance across all models. Each instance spins
up its own wasm worker pool, so a new one per model is pure waste.

---

## 5. Reflective floor

`MeshReflectorMaterial` renders the scene a second time from a mirrored camera into an FBO
and blends it in with a depth-based fade. It is the single most expensive recurring pass in
the scene — one full extra scene render on every drawn frame.

```tsx
import { MeshReflectorMaterial, useTexture } from '@react-three/drei'
import { useEffect } from 'react'
import * as THREE from 'three'

export function ReflectiveFloor({
  size = 30,
  mixStrength = 0.85,
  blur = 0,               // maps to mixBlur
  roughness = 1,
  resolution = 1024,
  enabled = true,
  receiveShadow = false,  // opt-in: must be true for the sun to land on the floor
  y = 0,
  textureRepeat = 1,
  anisotropy = 16,
  mapUrl = '/textures/concrete_wall_009_diff_1k.jpg',
}) {
  const textures = useTexture(enabled ? { map: mapUrl } : {})

  useEffect(() => {
    Object.values(textures).forEach((t) => {
      if (!t) return
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(textureRepeat, textureRepeat)
      t.anisotropy = anisotropy
    })
  }, [textures, textureRepeat, anisotropy])

  return (
    <mesh name="reflective-floor" rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow={receiveShadow}>
      <planeGeometry args={[size, size]} />
      {enabled ? (
        <MeshReflectorMaterial
          resolution={resolution}
          mixBlur={blur}
          mixStrength={mixStrength}
          mirror={0.1}
          depthScale={4}
          minDepthThreshold={0}
          maxDepthThreshold={0.9}
          roughness={roughness}
          metalness={0.7}
          color="#ffffff"
          map={textures?.map as THREE.Texture}
        />
      ) : (
        // Same base look without the reflection FBO — used by the low tier
        <meshStandardMaterial color="#3f3d39" metalness={0.6} roughness={1} />
      )}
    </mesh>
  )
}
```

### Parameters

| Prop | Shipped | What it does |
|---|---|---|
| `mirror` | `0.1` | 0 = no mirror contribution, 1 = pure mirror. Low value = subtle sheen, not a mirror floor. |
| `mixStrength` | `0.4` (/store) | Blend weight of the reflection over the base material. |
| `mixBlur` | `0.5` (/store) | Roughness-driven blur of the reflection. |
| `depthScale` | `4` | Strength of the depth fade — reflections die off with distance. |
| `min/maxDepthThreshold` | `0` / `0.9` | Window over which the depth fade runs. |
| `roughness` | `0.8` (/store), `1` (/car) | Feeds both the PBR shading and the reflection blur. |
| `metalness` | `0.7` | |
| `resolution` | tier-driven | Reflection FBO size. See the cap note below. |

Call sites in this repo:

| Surface | Values |
|---|---|
| `/store` | `size 30, mixStrength 0.4, blur 0.5, roughness 0.8`, `receiveShadow` = sun enabled |
| `/car` | all defaults (`mixStrength 0.85, blur 0, roughness 1, size 30`), `receiveShadow false` |
| Hero | `resolution 512`, everything else default |

A darker, glossier mall-floor variant that also reads well, if you want more mirror:

```tsx
<MeshReflectorMaterial
  resolution={1024} mixStrength={0.9} mixBlur={0} mirror={0}
  depthScale={1.1} roughness={0.62} metalness={0.55} color="#0e0f12"
/>
```

### Things to know before copying

- **`receiveShadow` must be opt-in and on.** With it false the sun patch never appears on the
  floor. It is defaulted off here so surfaces without a sun are not paying for a shadow lookup.
- **The `enabled` escape hatch is the real perf lever.** Swapping in a plain
  `meshStandardMaterial` removes the extra scene render entirely — that is what the low tier
  does. Do this before you touch resolution.
- **Resolution has a low ceiling of usefulness.** On a high-roughness, depth-faded floor,
  1024 and 2048 targets look identical to 512. Measure before paying for the big target.
- **Two live bugs in this repo — do not replicate.** The component accepts an `opacity` prop
  but the material hardcodes `opacity={1}`, so it does nothing; and `normalMap`/`roughnessMap`
  are commented out pending an EXR→PNG conversion. Wire them properly in the port.
- **Three near-identical copies exist here** (`ReflectiveFloor`, `CarReflectiveFloor`,
  `HomeReflectiveFloor`) differing only in `map` URL and Y position. That is copy-paste debt.
  Port **one** component with `y` and `mapUrl` as props, as written above.

---

## 6. The rest of the lighting stack

### HDRI environment

Ambient fill and reflections. Background off — the room's own walls are the backdrop.

```tsx
<Suspense fallback={null}>
  <Environment
    files="/hdr/main_hdr.exr"
    background={false}
    environmentIntensity={1}
    resolution={envResolution}      // 256 / 512 / 1024 / 2048 by tier
  />
</Suspense>
```

Use 1K–2K HDRIs. An 8K EXR is 10–20 MB and buys nothing at these resolutions.

### Studio Lightformer rig (product/hero scenes)

For a car or product on a turntable, an HDRI alone is too low-frequency to produce the long
specular streaks that make paint read. Layer a `Lightformer` rig inside `<Environment>`;
`frames={1}` bakes the whole thing into a cubemap once at mount — zero per-frame cost.

```tsx
<Environment files={hdriPath} background={false} resolution={envResolution}
             frames={1} environmentIntensity={envIntensity}>
  <group rotation={[0, rotationRadians, 0]}>
    {/* rig */}
  </group>
</Environment>
```

| Role | form | position | rotation | scale | intensity | color |
|---|---|---|---|---|---|---|
| Overhead strip (back) | rect | `[0, 5, -2]` | `[-π/2, 0, 0]` | `[9, 1, 1]` | 3 | — |
| Overhead strip (mid) | rect | `[0, 5, 0]` | `[-π/2, 0, 0]` | `[9, 1.2, 1]` | 3.5 | — |
| Overhead strip (front) | rect | `[0, 5, 2]` | `[-π/2, 0, 0]` | `[9, 1, 1]` | 3 | — |
| Side softbox L | rect | `[-6, 2, 0]` | `[0, π/2, 0]` | `[6, 3, 1]` | 1 | — |
| Side softbox R | rect | `[6, 2, 0]` | `[0, -π/2, 0]` | `[6, 3, 1]` | 1 | — |
| Rim card (cool) | rect | `[0, 3, -7]` | — | `[8, 3, 1]` | 0.8 | `#a8c2ff` |
| Front card (warm) | rect | `[0, 1.5, 7]` | `[0, π, 0]` | `[8, 2, 1]` | 0.6 | `#ffe8d0` |
| Dome ring | ring | `[0, 8, 0]` | `[-π/2, 0, 0]` | `[12, 12, 1]` | 0.5 | — |

Aim the highlights by rotating the parent `<group>`, not the individual formers. Rotation
change re-triggers the one-shot capture automatically.

### Three-point rig (used alongside the HDRI on `/car`)

```tsx
{/* Key — main illumination from front-right, the only shadow caster */}
<spotLight
  position={[5, 8, 5]} intensity={70} angle={0.5} penumbra={0.5}
  castShadow
  shadow-mapSize-width={shadowResolution} shadow-mapSize-height={shadowResolution}
  shadow-camera-near={5} shadow-camera-far={18}
  shadow-bias={-0.0001} shadow-normalBias={0.03}
/>
{/* Fill — softens shadows from the left */}
<spotLight position={[-5, 5, 3]} intensity={40} angle={0.6} penumbra={0.7} />
{/* Rim — cool edge highlight from behind */}
<spotLight position={[0, 4, -6]} intensity={80} angle={0.4} penumbra={0.6} color="#88aaff" />
{/* Ground bounce — reflected light from the floor */}
<pointLight position={[0, 0.5, 0]} intensity={40} distance={6} decay={2} color="#ffeedd" />
<ambientLight intensity={0.3} />
```

Presets that work (key / fill / rim / envIntensity / env rotation°):

| Preset | HDRI | Key | Fill | Rim | envIntensity | Rotation |
|---|---|---|---|---|---|---|
| studio | `main_hdr.exr` | 70 | 40 | 80 | 1.5 | 0 |
| sunset | `sunset.exr` | 50 | 60 | 30 | 1.8 | 90 |
| showroom | `showroom.exr` | 80 | 35 | 50 | 1.2 | 0 |
| garage | `garage.exr` | 40 | 50 | 20 | 1.0 | 180 |

### Lamps discovered from GLB anchors

Every mesh tagged `userData.isLamp` in §4 becomes a warm emissive shade plus a real point
light at its world position. No hardcoded coordinates, no knowledge of GLB internals — the
artist places lamps, the code finds them.

```tsx
const [anchors, setAnchors] = useState<THREE.Vector3[]>([])

useEffect(() => {
  const found: THREE.Vector3[] = []
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.userData.isLamp || !obj.material) return
    applyEmissive(obj.material, cfg.color, cfg.emissiveIntensity)
    obj.updateWorldMatrix(true, false)
    const p = obj.getWorldPosition(new THREE.Vector3())
    // Dedupe multi-part fixtures (shade + bulb both named lamp)
    if (!found.some((q) => q.distanceTo(p) < 0.25)) found.push(p)
  })
  setAnchors(found)
  invalidate()
}, [active, revision, scene, invalidate, cfg])

// ...
{anchors.slice(0, maxLights).map((p, i) => (
  <pointLight
    key={i}
    position={[p.x, p.y + cfg.offsetY, p.z]}
    color={cfg.color} intensity={cfg.intensity}
    distance={cfg.distance} decay={cfg.decay}
    castShadow={i < shadowCasters}
    shadow-mapSize-width={cfg.shadowMapSize}
    shadow-mapSize-height={cfg.shadowMapSize}
    shadow-bias={cfg.bias}
    shadow-normalBias={cfg.normalBias}
    shadow-camera-far={cfg.distance > 0 ? cfg.distance : 25}
  />
))}
```

| Field | Default | Shipped | Note |
|---|---|---|---|
| `color` | `#ffd6aa` | `#ffd6aa` | warm tungsten |
| `intensity` | 20 | **10** | candela at exposure 0.3 |
| `distance` | 6 | **16** | falloff range; 0 = infinite |
| `decay` | 2 | 2 | 2 = physical inverse-square |
| `offsetY` | -0.15 | -0.15 | drop to the bulb, below the shade |
| `emissiveIntensity` | 2.5 | 2.5 | feeds Bloom |
| `shadowMapSize` | 512 | 512 | per cube face |
| `bias` / `normalBias` | -0.005 / 0.02 | same | |

Tiering that matters: **the emissive glow is applied on every tier** (it is free — a material
property), while real point lights are gated and capped (`lampMaxLights`) and only the first
`lampShadowCasters` cast. A cube shadow is six depth passes; two casters is a realistic
ceiling. Recovering a plausible-looking room on a phone with *zero* real lamp lights is the
whole reason to split glow from light.

Also in the store: one shadowless vitrine spot,
`<pointLight position={[0, 7, -1.5]} intensity={18} distance={12} decay={0.7} color="#ffffff" />`
— deliberately shadowless because PCSS is global and the sun already owns the shadow budget.

### Ground contact shadows (for an object on a floor)

A directional sun does not give a product convincing ground contact. Two modes:

```tsx
// Low / medium / high — cheap blurred contact shadow.
// frames={160} renders only the first 160 invalidated frames after (re)mount;
// the key remount re-runs it exactly when geometry moves.
<ContactShadows
  key={geometryGeneration}
  frames={160}
  position={[0, -0.89, 0]}
  opacity={0.7} scale={12} blur={2.2} far={3}
  resolution={groundShadowResolution} color="#000000"
/>

// Ultra — temporally accumulated soft shadows (area-light quality), baked once.
<AccumulativeShadows temporal frames={45} alphaTest={0.8} opacity={0.85}
                     scale={14} position={[0, -0.89, 0]} resolution={groundShadowResolution}>
  <RandomizedLight amount={8} radius={4} ambient={0.6} intensity={1}
                   position={[5, 8, -3]} bias={0.001}
                   mapSize={groundShadowResolution} size={14} />
</AccumulativeShadows>
```

The shadow catcher floats 0.01 above the floor plane (floor at `-0.9`, catcher at `-0.89`).
Re-bake triggers: mount, then after animations settle — 900 ms after a part swap (~0.7 s
fade), 1400 ms after a door animation (~1.2 s). Under `frameloop="demand"` the accumulation
needs frames to exist at all, so pump `invalidate()` for `frames + 5` iterations.

### Post-processing

```tsx
<EffectComposer multisampling={multisampling}>
  {enableN8AO && (
    <N8AO halfRes aoRadius={0.5} intensity={3} distanceFalloff={1.0}
          quality={n8aoQuality} color="black" />
  )}
  <Bloom intensity={0.15} luminanceThreshold={0.9} luminanceSmoothing={0.2}
         mipmapBlur radius={0.3} />
  {enableSMAA && <SMAA />}
  <Vignette eskil={false} offset={0.32} darkness={0.62} />
</EffectComposer>
```

Order matters: AO before Bloom (AO should not darken the glow), SMAA last for edge quality,
Vignette as a cheap final overlay.

> **The EffectComposer renders offscreen, so the canvas `antialias` flag is never displayed.**
> Turning it on with a composer mounted costs MSAA memory and bandwidth for nothing. AA must
> come from composer `multisampling` and/or `<SMAA />`.

`luminanceThreshold: 0.9` is high on purpose — only genuine highlights (emissive lamp shades,
the sun patch) glow, so materials stay crisp. If you use the string-light emissive from §4,
emissive intensity must clear this threshold after tone mapping or nothing glows.

`N8AO` with `halfRes` computes AO at half resolution with depth-aware upsampling: roughly
3× cheaper, visually near-identical.

---

## 7. Performance rules

This stack is not cheap. These are what make it shippable, roughly in order of payoff.

### Demand frameloop + activity governor

`frameloop="demand"` renders only on `invalidate()`. For a walkable scene, keep frames flowing
while there is input, then park entirely (0 GPU at rest).

```tsx
export const IDLE_COOLDOWN_MS = 1500
const activity = { last: Date.now() }
export function markStoreActivity() { activity.last = Date.now() }

export function ActivityGovernor({ forceActive, onIdleChange }) {
  const invalidate = useThree((s) => s.invalidate)
  const idleRef = useRef(false)
  useFrame(() => {
    const active = forceActive || Date.now() - activity.last < IDLE_COOLDOWN_MS
    if (active) {
      if (idleRef.current) { idleRef.current = false; onIdleChange(false) }
      invalidate()
    } else if (!idleRef.current) {
      idleRef.current = true
      onIdleChange(true)   // no invalidate — the loop parks after this frame
    }
  })
  return null
}
```

DOM handlers wake it: `onPointerDownCapture`, `onPointerMoveCapture` (when `buttons !== 0`),
and `keydown` all call `markStoreActivity()` + `invalidate()`. Physics is paused while idle.

### Freeze static shadow maps

Shadow maps re-render every frame by default. With a static light and static geometry that is
a wasted 2048² depth pass per frame.

```tsx
useEffect(() => {
  gl.shadowMap.autoUpdate = false
  gl.shadowMap.needsUpdate = true
  return () => { gl.shadowMap.autoUpdate = true }
}, [gl])

// Reopen a frame-counted window on events that change shadow content
useFrame(() => {
  if (pendingRef.current > 0) {
    pendingRef.current -= 1
    gl.shadowMap.needsUpdate = true
    invalidate()
  }
})
```

`UPDATE_WINDOW_FRAMES = 150` — enough to cover an accumulative bake (~50 frames), a cube
capture (~60), and a 1.2 s animation at 120 Hz (~144). Reopen on mount, geometry change,
animation, and quality change.

### Count frames, not milliseconds

Every deferred operation here (contact-shadow render, accumulative bake, cube capture) is
scheduled by **rendered-frame count**, never `setTimeout`. Under a demand loop, wall-clock
time and rendered frames are unrelated — a wall-clock capture fires during an idle gap and
captures nothing. Frame counting is also GPU-speed-independent: the capture always lands
after the bake regardless of hardware.

### DPR pixel budget

```ts
export const PIXEL_BUDGET = 4.5e6

export function clampDprToBudget(dpr: [number, number]): [number, number] {
  if (typeof window === 'undefined') return dpr
  const area = window.innerWidth * window.innerHeight
  const budgetMax = Math.max(1, Math.sqrt(PIXEL_BUDGET / area))
  return [dpr[0], Math.max(dpr[0], Math.min(dpr[1], budgetMax))]
}
```

Above ~4.5 MP the extra pixels are invisible but the fill-rate cost (× MSAA, × post) is very
real on 4K/5K screens. Never clamps below native.

### Sustained-FPS ladder

```tsx
<>
  {adaptive && <AdaptiveDpr pixelated />}
  <PerformanceMonitor
    flipflops={4}
    onDecline={(api) => { if (api.fps >= 5) onScale((s) => Math.max(0.7, +(s - 0.15).toFixed(2))) }}
    onIncline={() => onScale((s) => Math.min(1, +(s + 0.15).toFixed(2)))}
    onFallback={() => onScale(() => 0.7)}
  />
</>
```

Steps the tier's max DPR ×1 → ×0.85 → ×0.7 and back. `flipflops={4}` locks a stable point
after four oscillations. **The `api.fps >= 5` guard is required under a demand loop** — an
idle gap produces a near-zero FPS sample that would otherwise crash the ladder to its floor.

### Swap the mirror floor out during cube captures

If you also do one-shot `CubeCamera` reflection captures, temporarily replace the
`reflective-floor` material with a plain one during capture. Otherwise each of the six cube
faces re-renders the live `MeshReflectorMaterial` — a 6× scene-render spike.

### Quality tiers

These are the values in `lib/config/quality.ts`.

| Setting | low | medium | high | ultra |
|---|---|---|---|---|
| `dpr` | `[0.5, 1]` | `[1, 1.5]` | `[1, 1.75]` | `[1, 2]` |
| `adaptiveDpr` | true | true | true | true |
| `shadowResolution` | 512 | 1024 | 2048 | 2048 |
| `floorReflectionsEnabled` | **false** | true | true | true |
| `floorReflectionResolution` | 128 | 1024 | 1024 | 2048 |
| `multisampling` | 0 | 4 | 4 | 4 |
| `enableSMAA` | true | false | true | true |
| `enableN8AO` | false | false | false | true |
| `n8aoQuality` | performance | performance | performance | high |
| `anisotropyLevel` | 4 | 4 | 8 | 16 |
| `groundShadows` | contact | contact | contact | accumulative |
| `groundShadowResolution` | 256 | 512 | 512 | 1024 |
| `lampLights` | false | true | true | true |
| `lampMaxLights` | 0 | 6 | 80 | 24 |
| `lampShadowCasters` | 0 | 0 | 1 | 2 |
| `envResolution` | 256 | 512 | 1024 | 2048 |
| `envIntensity` | 1.5 | 1.5 | 1.5 | 1.5 |
| `cubeReflections` | false | false | false | true |
| `cubeReflectionResolution` | 128 | 128 | 1024 | 1024 |

Default preset is `medium`; first visit under 768 px width forces `low`. Persisted to
`localStorage`.

> **Two anomalies in the shipped table — fix them in the port rather than copying them.**
> `high.lampMaxLights = 80` is larger than ultra's 24 (a stray edit), and `experimentalSSGI`
> is `false` on every tier, so the SSGI toggle can never render.
>
> `arch-docs/QUALITY_TIER_SYSTEM.md` documents a different set of values than the code above.
> The code is authoritative; that doc has drifted.

Targets: 60 fps desktop, 30 fps+ mobile. Measure on real GPU hardware — software/headless GL
renders the whole scene under 1 fps and drowns every delta in noise.

---

## 8. Tuning workflow — port this first

Aiming a sun by editing a file and reloading does not converge. Port the debug overlay
**before** you tune anything.

```tsx
'use client'
import { useHelper } from '@react-three/drei'
import * as THREE from 'three'

const MOVE = 0.5, INTENSITY = 2, BOUND = 1

/** Symmetric grow/shrink of the ortho shadow box (keeps it centred) */
function resizeBox(s: SunShadowConfig, d: number): SunShadowConfig {
  return { ...s, left: s.left - d, right: s.right + d, top: s.top + d, bottom: s.bottom - d }
}

export function SunDebug({ lightRef, camRef, cfg, onChange }) {
  const invalidate = useThree((s) => s.invalidate)

  useHelper(camRef, THREE.CameraHelper)                            // shadow frustum wireframe
  useHelper(lightRef, THREE.DirectionalLightHelper, 2, '#ffaa00')  // yellow sun gizmo

  const cfgRef = useRef(cfg); cfgRef.current = cfg

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = clone(cfgRef.current)
      const axis = e.shiftKey ? c.target : c.position
      let handled = true
      switch (e.key) {
        case 'ArrowLeft':  axis[0] -= MOVE; break
        case 'ArrowRight': axis[0] += MOVE; break
        case 'ArrowUp':    axis[2] -= MOVE; break
        case 'ArrowDown':  axis[2] += MOVE; break
        case 'PageUp':     c.position[1] += MOVE; break
        case 'PageDown':   c.position[1] -= MOVE; break
        case '+': case '=': c.intensity += INTENSITY; break
        case '-': case '_': c.intensity = Math.max(0, c.intensity - INTENSITY); break
        case ']': c.shadow = resizeBox(c.shadow, BOUND); break
        case '[': c.shadow = resizeBox(c.shadow, -BOUND); break
        default: handled = false
      }
      if (!handled) return
      e.preventDefault()
      onChange(c)
      invalidate()
      console.info('[sundebug] paste into config →\n' + JSON.stringify({ sun: c }, null, 2))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [invalidate, onChange])

  return null
}
```

Gate it on `NODE_ENV === 'development'` **and** a query flag (`?sundebug=1`), and have the
live override fully replace the config-merged value so edits are immediate.

| Key | Effect |
|---|---|
| Arrow keys | Move sun on X/Z (±0.5) |
| Shift + Arrows | Move target (aim point) on X/Z |
| Page Up / Page Down | Move sun on Y |
| `+` / `-` | Intensity ±2 |
| `[` / `]` | Shrink / grow the shadow box by 1 (symmetric) |

Workflow: open with the flag → check the `CameraHelper` wireframe box **fully encloses the
room** (grow with `]` until it does) → aim with arrows until the patch lands where you want →
scrub intensity → copy the last console block into config → reload without the flag and
confirm the patch is soft-edged and stable as you walk.

The same pattern generalises: a `?lampdebug=1` overlay does `+/-` intensity and `[/]` distance
for the lamps and logs the found anchor positions so you can confirm your GLB names matched.

---

## 9. Port checklist

- [ ] Install deps at compatible versions; transpile them if on Next.js
- [ ] Canvas: `shadows`, `frameloop="demand"`, `antialias: false`, ACESFilmic @ **0.3**
- [ ] `<Environment>` HDRI, `background={false}`, tier-driven resolution
- [ ] GLB naming pass in the model loader (`glass` / `lamp` / `light` / `ceiling`, `shadowSide`)
- [ ] `<SoftShadows>` mounted inside the Canvas, above the model loader, with the
      `needsUpdate` + `invalidate` workaround
- [ ] `SunLight` with the frozen `initialArgs`, imperative bounds, FBO disposal, `<primitive>` target
- [ ] Floor with `receiveShadow` **on** and an `enabled` off-switch
- [ ] Post stack in order: N8AO → Bloom → SMAA → Vignette
- [ ] Quality tiers + `localStorage` persistence + mobile default
- [ ] `?sundebug=1` overlay — then aim the sun and paste the config back
- [ ] Perf: activity governor, shadow freeze, frame-counted deferrals, DPR budget, perf ladder

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No shadow at all | `sun.enabled` false, or `castShadow` missing on the light / meshes |
| **Sunlight leaks through walls** | **Ortho shadow box too small — PCSS returns fully lit outside it. Grow it with `]`.** |
| Whole window is one solid dark shadow | Pane mesh is not named `*glass*`, so it casts |
| Hard edges instead of soft | `SoftShadows` not mounted, or `soft.samples`/`soft.size` zeroed |
| Soft shadows appear only on some meshes | Array-material recompile skipped — force `material.needsUpdate` |
| Shadows never update after mount | Shadow freeze left `autoUpdate = false` without reopening a window |
| Washed-out / blown-out patch | Lower `intensity` in steps of 4–5, or check exposure is 0.3 |
| Whole scene too dark | Exposure 0.3 with intensities tuned for exposure 1.0 |
| Shadow acne (striping on lit surfaces) | Increase `normalBias` (0.03 baseline); `bias` more negative as last resort |
| Peter-panning (shadow detached from object) | `bias`/`normalBias` too large — reduce, and tighten `near`/`far` |
| Thin walls do not cast | `material.shadowSide` not set to `DoubleSide` |
| Blocky / pixelated shadow edges | Ortho box far larger than the room — shrink it, or raise `shadowResolution` |
| Resolution change does nothing | Shadow FBO not disposed — `shadow.map.dispose()` + `map = null` |
| Floor is black / no reflection | `enabled` false, or the reflection FBO is at a degenerate resolution |
| Sun patch not on the floor | Floor `receiveShadow` still false |
| FPS tanks when the floor is visible | Reflection pass — disable it or drop resolution before anything else |
| Nothing renders after an interaction | Demand loop parked — call `invalidate()` from the DOM handler |
| Lamp shadows unaffected by PCSS | Expected: PCSS patches directional/spot only; point lights use cube PCF |
| Emissive meshes do not glow | `emissiveIntensity` below Bloom's `luminanceThreshold` after tone mapping |
