# Wrist VTO Implementation — Watches & Bracelets

Implementation reference for `public/vto/wrist-hybrid/` — the working watch and
bracelet virtual try-on. Covers what the app is, how it places and sizes a
product on a live wrist, and what it does not yet handle.

**Related docs:**
- [`arch-docs/MEDIAPIPE_VTO_SYSTEM.md`](./MEDIAPIPE_VTO_SYSTEM.md) — the general
  MediaPipe → Three.js method (camera model, metric depth solve, orientation
  basis), shared with the ring implementation. Read that first if the *why* behind
  the pinhole maths below is unfamiliar.
- [`public/vto/wrist-hybrid/README.md`](../public/vto/wrist-hybrid/README.md) —
  quick-start, file list, dev checklist. This document goes deeper on how the
  implementation actually works and why it looks the way it does.
- [`public/vto/rings-hybrid/README.md`](../public/vto/rings-hybrid/README.md) —
  the sibling ring implementation, sharing the same core.

---

## 1. Overview

One app, two product presets, chosen by a query string:

```
/vto/wrist-hybrid/index.html                    → watch  (default)
/vto/wrist-hybrid/index.html?product=bracelet    → bracelet
```

Watches and bracelets share an anchor point (the wrist), a coordinate frame (the
forearm), and almost every mechanism — camera model, depth solve, smoothing,
occlusion, model-fitting. They differ in exactly two things: how far up the arm
the anchor sits, and how the product is sized. Those differences live in
`config.js`; everything else is one code path.

The app is built on `public/vto/shared/vto-core/`, the same core the ring
implementation (`public/vto/rings-hybrid/`) uses. Products plug into that core by
providing an **anchor** — a small class that answers "where on the body, which
way up, how big" — and a **config**. Nothing product-specific leaks into the
shared code.

## 2. Architecture

```
public/vto/wrist-hybrid/
  config.js              WATCH_PRESET + BRACELET_PRESET, resolveConfig()
  main.js                wires WristAnchor + config into the shared bootstrap,
                          defines the debug-panel schema
  core/WristAnchor.js     forearm anatomy: axis, anchor offset, wrist basis/dims
  index.html              importmap (three, tasks-vision, lil-gui), video/canvas
                          layout, loading/instructions UI

public/vto/shared/vto-core/     (shared with rings-hybrid)
  HandSolver.js           camera model, metric depth (weak-perspective seed +
                           Gauss-Newton refine), pinhole back-projection,
                           orthonormal basis construction, handedness
  ProductPositioner.js    mm offsets in the product's local frame, One Euro
                           smoothing, detection hysteresis
  VTOScene.js             renderer, canvas sizing, GLB load, bore-axis detection,
                           model fitting, occluder, debug marker
  MediaPipeTracker.js     camera + HandLandmarker, frame-gated inference
  OneEuroFilter.js        scalar/Vector3/quaternion adaptive smoothing
  DebugPanel.js           lil-gui wrapper: common controls + per-app schema
  bootstrap.js            app startup: load model, start tracker, render loop
```

### The anchor contract

`WristAnchor.solve(frame, solver)` is called once per frame and returns:

```js
{
  position,      // THREE.Vector3, metres, camera-space
  quaternion,    // THREE.Quaternion, product orientation
  primaryAxis,   // THREE.Vector3, the forearm direction (local +Y)
  normal,        // THREE.Vector3, dorsal direction (local +Z)
  width,         // metres — wrist breadth
  thickness,     // metres — wrist depth (front-to-back)
  depth,         // metres — distance from camera along the view axis
  handedness     // 'Left' | 'Right'
}
```

This is the same shape `RingAnchor` returns for a finger, which is what lets
`ProductPositioner` and `VTOScene` be product-agnostic. A future neck or ear
anchor would return the same shape.

## 3. The forearm axis problem

MediaPipe Hand Landmarker has **no forearm landmark**. Landmark 0 sits at the
wrist crease, at the base of the palm, and the tracked skeleton stops there. A
watch sits 30–40 mm further up the forearm; a bracelet, 10–25 mm. Both the anchor
point and the direction to place it along have to be extrapolated past the end of
what MediaPipe actually tracks:

```js
ulnar       = W[MIDDLE_MCP] - W[INDEX_MCP]
palmCentre  = mean(W[INDEX_MCP], W[MIDDLE_MCP]) + ulnarBiasCoeff × ulnar
forearmAxis = normalize(W[WRIST] - palmCentre)        // palm → wrist, continuing up the arm
anchor      = W[WRIST] + forearmAxis × anchorOffsetMm
```

(`WristAnchor.palmCentre()` and `.forearmAxis()`,
`public/vto/wrist-hybrid/core/WristAnchor.js`. See §3.1 for why `palmCentre` is
built this way rather than from all four metacarpal heads.)

This extrapolation is exact only when the wrist is straight — it assumes the
forearm continues in the same direction the hand is pointing. The wrist has three
rotational degrees of freedom, and they are not equally destructive:

| DOF | Range | Effect on the derived axis |
|---|---|---|
| Flexion / extension | ±70° | **Corrupts it** — the product tilts off the true arm |
| Radial / ulnar deviation | ±20° | Corrupts it too, less severely |
| Pronation / supination (forearm roll) | ±80° | **Harmless** |

Pronation is harmless because it is rotation of the radius over the ulna, and the
hand rides the radius — so the palm normal reports roll about the arm faithfully
no matter how the wrist is bent. Roll is what determines which way a watch face
points, which is the thing a user looks at first. So the failure mode this
limitation produces is a **tilt**, not a spin, and it is absent in the pose people
naturally hold when checking a watch.

### 3.1 Which metacarpals define `palmCentre`

Not a detail. The first version averaged all four metacarpal heads, and the
product visibly swung whenever the hand opened and closed — with the forearm
perfectly still. The four rays are not anatomically equivalent:

| Ray | CMC joint | Mobility |
|---|---|---|
| 2nd (index, LM 5) | trapezoid | rigid, <2° |
| 3rd (middle, LM 9) | capitate | rigid, <2° |
| 4th (ring, LM 13) | hamate | mobile, ~15° |
| 5th (pinky, LM 17) | hamate | mobile, ~25–30° |

Palm cupping as a fist closes **is** the motion of the mobile ulnar rays.
Averaging all four therefore drags `palmCentre` as the hand shuts, which rotates
the axis and tilts the product. Measured on a synthetic hand (`wrist.mjs` §8),
against cupping angle:

| Cupping | Four-ray axis error | Rigid-ray axis error |
|---|---|---|
| 5° | 0.76° | 0.00° |
| 15° | 2.28° | 0.00° |
| 25° | 3.78° | 0.00° |

The rigid pair alone is not a drop-in replacement, though: both rays sit on the
**radial** side of the hand, so their midpoint lands about one inter-ray spacing
thumb-ward of the hand's true central axis, and the anchor slides off the arm.
Hence the `ulnarBiasCoeff` term — an anatomical constant expressed in units of
the index→middle span, so it scales with hand size. At the default `1.0` it
reproduces the old four-ray centroid on a resting hand to **0.04° / 0.02 mm**
while being immune to cupping by construction.

`anchor.axisRays: 'mcpRow'` restores the four-ray rule for comparison.

### 3.2 Axis smoothing

MediaPipe noise still spikes during articulation. That is damped by a One Euro
`Vector3Filter` on the axis **direction**, applied inside `WristAnchor.solve()`
before the basis is built — not by the positioner's pose-level `QuaternionFilter`,
which cannot separate the two rotations that matter here. Damping the whole
quaternion hard enough to steady the tilt would also make the watch face lag
pronation, and pronation is the one wrist DOF the hand tracks faithfully.

Defaults `axisMinCutoff: 0.6`, `axisBeta: 0.05` — low, because a forearm turns
slowly. Verified (`wrist.mjs` §9) to settle on the *unfiltered* axis to 0.000°,
so it damps transients without biasing where the axis ends up.
`ProductPositioner.resetFilters()` calls `anchor.reset()` so a hand swap does not
smooth across two different arms.

### Measured error from wrist flexion

Quantified against a synthetic hand rigidly attached to a known forearm (test
harness `wrist.mjs`, section 3), at the watch preset's 35 mm anchor offset:

| Wrist flexion | Axis error | Anchor displacement |
|---|---|---|
| 0° | 0.4° | 0.0 mm |
| 15° | 15.0° | 9.1 mm |
| 30° | 30.0° | 18.1 mm |
| 45° | 45.0° | 26.8 mm |
| 60° | 60.0° | 35.0 mm |

Error tracks flexion almost exactly 1:1. Read as: fine to roughly 15° of flexion,
visibly wrong past 30°.

### The upgrade path, if needed

`WristAnchor.forearmAxis()` is the single call site that produces this axis. A
MediaPipe Pose Landmarker elbow→wrist vector would be immune to wrist flexion,
at a cost of ~16 MB beyond the hand model's ~7.5 MB and a second inference per
frame (tolerable at reduced rate — a forearm moves slowly, so every 3rd frame is
enough). Because the axis has one source, this swap would not touch the solver,
the positioner, the scene, or either preset's config.

## 4. Sizing: absolute vs. fit

Watches and bracelets need opposite sizing semantics, and treating them the same
produces a real product bug:

- **Bracelet** — wraps the wearer. Its bore should follow the measured wrist, the
  same as a ring follows a finger: `sizing.mode: 'fit'`.
- **Watch** — the case is a fixed product spec (38/40/42/44 mm) that is *itself*
  what the customer is choosing. Scaling the case to wrist size would render
  every watch the same on every arm, defeating the purpose of a try-on:
  `sizing.mode: 'absolute'`, `diameterMm` (41.5 in the shipped preset).

```js
// fit mode  (bracelet)
scale = (wristWidth × boreDiameterRatio) / modelInnerDiameter

// absolute mode  (watch)
scale = (diameterMm × 0.001) / modelMaxDiameter
```

Absolute sizing is only a one-line branch because the whole pipeline is metric
end to end (see the parent doc's derivation) — that is the concrete payoff of
building the pinhole solve in real units rather than screen-space units.
Verified: a 42 mm case renders at 42.00 mm on 45/53/65 mm wrists, with the scale
factor bit-identical across all three (`wrist-scene.mjs`, section 1).

> **The shipped watch preset does not currently get this guarantee.** It carries
> `scaleMultiplier: 2.06`, which multiplies the result of the branch above, so a
> 41.5 mm case renders at ~85 mm. That is a live flag, not a setting — see §7.

Wrist dimensions come from the hand itself, reusing the same MCP-row measurement
the ring implementation uses for finger width:

```js
wristWidth = |W[INDEX_MCP] - W[PINKY_MCP]| × wristWidthCoeff
wristDepth = wristWidth × wristDepthRatio                       // ratio ≈ 0.72
```

`WristAnchor`'s own default coefficient is `0.70`, from adult anthropometry —
palm breadth at the knuckles averages ~79 mm against a ~55 mm wrist breadth. The
shipped wrist config overrides it to **0.81**, an on-camera calibration; keeping
the anatomical value in the class and the calibrated value in the preset means
the shared class is not carrying one setup's webcam numbers. `0.72` accounts for
the wrist being elliptical rather than round (front-to-back is shallower than
side-to-side). Both are calibratable in the debug panel if a product reads
systematically wide or narrow.

## 5. Model measurement: finding the bore

This is the part of the implementation that took the most iteration, because a
bounding box **cannot see a hole**. Two earlier attempts (bbox-derived fit,
then a naive per-vertex percentile) both under-sized the product for reasons that
were only visible once real, non-uniform geometry was tested against. The
current approach measures the model's actual surface.

### Sample the surface by area, not the vertices

Reading vertex positions directly is wrong twice over. Vertex density on real
jewellery is wildly uneven — engraving, stones, and bezels put the overwhelming
majority of a mesh's vertices on the decorated outer surface, while the plain
inner surface (the part that actually touches skin) can be a fraction of a
percent of the total. A statistic taken over vertices is dominated by the
outside, and a sparsely tessellated inner surface can have *no* vertex at all in
whole angular sectors — so the hole goes unseen exactly where it matters.

`measureModel()` (`VTOScene.js`) instead triangulates the mesh, weights by
triangle area, and samples up to `MEASURE_SAMPLES = 20000` points spread
proportionally across the surface — a large plain triangle yields many samples, a
thousand tiny engraving triangles yield only as many as their area deserves.
Barycentric offsets are deterministic (not random), so a given model always
measures identically.

### Per-sector radial profile

For each candidate bore axis, the sampled points are projected onto the plane
perpendicular to it and binned into `RADIAL_BINS = 16` angular sectors. Per
sector:

```js
sectorMin = min(radius in this sector)
sectorMax = max(radius in this sector)
```

Then, across the sectors that have any samples at all:

```js
innerRadius = median(sectorMinima)   // the hole — what a worn product fits around
outerRadius = median(sectorMaxima)   // the outside
coverage    = occupiedSectors / 16   // how completely material surrounds the centre
annularity  = (innerRadius / outerRadius) × coverage
```

Binning by sector rather than taking a percentile over raw samples is what makes
the result density-independent: a sector counts once whether it holds four
samples or four thousand. Medians (not min/max) make both `innerRadius` and
`outerRadius` robust to a clasp bar crossing the bore or a gem occupying a few
sectors.

**Coverage is doing real work, not redundant with hole size.** A torus viewed
edge-on projects to two separate blobs with a gap between them — that gap can
score just as large as a genuine hole on `innerRadius` alone. Only the *true* bore
has material essentially all the way around its centre. Measured across a battery
of synthetic shapes (plain torus, thin band, torus + off-centre charm, oval
bangle, small gem ring), the correct axis scores 0.35–0.93 while every wrong axis
scores 0.03–0.16 — a wide, decisive gap (`ANNULARITY_MIN = 0.25`,
`ANNULARITY_MARGIN = 1.6` require the winner to clear both an absolute floor and
the runner-up by 60%).

### Finding the bore's centre

The bounding-box centre is not a safe assumption for where the bore is — a clasp,
charm, or off-centre solitaire drags it away from the true axis, after which the
hole is measured about the wrong point and reads as nearly nothing. The
coordinate median is not safe either once samples are area-weighted, since a
large gem can carry more surface area than the entire band.

So the centre is *found by search*, not seeded from a summary statistic: a coarse
9×9 grid (`CENTRE_GRID`) over the section, then hill-climbing from the best cell.
The objective is enclosure-gated hole size — `radialProfile(...).innerRadius`,
but only counted when `coverage ≥ ENCLOSURE_MIN (0.85)`. The gate exists because
hole size alone is an *unbounded* objective: far enough from the model, every
sample looks distant, so an ungated search escapes toward infinity. Requiring the
candidate point to actually be surrounded by material makes the problem
well-posed.

### Bore-axis selection: measurement first, bbox policy as fallback

A ring or a **closed** bracelet is a torus and the annularity score above
identifies its bore reliably. An **open watch** — a case plus two strap stubs,
which is how most watch GLBs are authored — has no bore to find at all: the case
sits to one side of the wrist rather than encircling it, so every axis scores low
and the measurement correctly reports "inconclusive."

When that happens, orientation falls back to a bounding-box heuristic controlled
by `product.boreAxisPolicy`:

- **`'longest'`** (watch default) — an open watch is *elongated* along its bore,
  since the strap runs up and down the arm while the case itself is wider than it
  is thick.
- **`'narrowest'`** (bracelet default, ring default) — a closed loop is *flattest*
  along its bore, the band-width axis.

Verified: a synthetic case-plus-stubs mesh with its true bore on Y is
mis-detected as `z` under the `narrowest` rule and correctly resolves to `y`
under `longest`. A closed-loop watch model does not need the fallback at all and
should use `boreAxisPolicy: 'narrowest'` (or set `boreAxis` explicitly) instead.

The load-time console line names exactly which path decided, and on what
evidence:

```
Model oriented | bbox 0.042 x 0.070 x 0.012 | bore axis y (bbox longest,
  annularity inconclusive: z 0.26, y 0.18, x 0.11) | hole 42.0mm outer 70.0mm case 70.0mm
```

### Fitting: the hole, not the outside

`fitScale()` scales fit-mode products so the **measured hole**, not the outer
diameter, matches `wristWidth × boreDiameterRatio` (default clearance ratio
1.05). This is deliberate and load-bearing: fitting the outer diameter — the
only thing a bounding box can give you — leaves the hole narrower than the wrist
by twice the band thickness. On an 8 mm band that is 13 mm too small, so the
bracelet renders *inside* the arm and the occluder (sized to wrist width) hides
it entirely. Because the fit now targets the actual hole, band thickness no
longer affects sizing at all — verified identical rendered results across 2 mm,
8 mm, and 15 mm bands on the same nominal hole (`wrist-scene.mjs`, section 3).

## 6. Occlusion

More consequential here than for a ring — a wrist-worn product wraps most of the
way around a much larger limb, so if the far side of the band isn't hidden, the
illusion collapses immediately. The occluder is a depth-only cylinder:

- **Elliptical**, not round: `scale.x = wristWidth`, `scale.z = wristDepth`
  (`wristDepthRatio ≈ 0.72`).
- **Length** `wristWidth × occluder.lengthRatio` (2.5) along the forearm —
  generous, because a strap poking out past either end of the occluder is as
  bad as no occlusion at all.
- **`proximalBias` (0.15)** slides the cylinder up the arm slightly, so it covers
  more of the forearm side than the hand side, matching where a strap actually
  extends.
- **Must render opaque**: `colorWrite: false, depthWrite: true, transparent:
  false, renderOrder: -1`. `transparent: true` would move it into the
  transparent render pass, where `renderOrder` no longer guarantees it draws
  before the product — a subtle failure mode that silently disables occlusion
  rather than erroring.

## 7. Manual scale multiplier

`sizing.scaleMultiplier` (debug panel: **Scale multiplier**, range 0.25–4.0,
default 1.0) scales the finished result on top of whichever mode produced it.
`1.0` is a no-op — verified bit-identical to the fit computed without it.

This is intentionally **not** the same knob as `boreDiameterRatio`.
`boreDiameterRatio` means "clearance on the wrist" and keeps the hole locked to
`wristWidth × ratio`; folding a general size fudge into it would create a
parameter whose name says one thing and does another — the exact failure mode
this implementation was rebuilt to eliminate. The multiplier is instead an
honest, purely cosmetic override, applied identically in fit and absolute mode.

On a watch, using it deliberately breaks the promise of absolute sizing — a
42 mm case dialed to `×1.3` no longer renders at 42 mm. That is expected: it's an
escape hatch for a specific model or a specific wearer reading wrong, not a
sizing method. A value that settles far from 1.0 is a signal that the underlying
measurement (section 5) needs attention, not that the multiplier has "fixed" it.

### The shipped watch preset's ×2.06

The watch preset currently ships `scaleMultiplier: 2.06`, tuned on camera. It is
recorded here so it is never mistaken for a bug, and so the reasoning above is
not quietly contradicted by the config: at 2.06 a 41.5 mm case renders at ~85 mm,
which means absolute mode is no longer delivering an absolute case size.

By the rule above, a multiplier that far from 1.0 points at the measurement. The
diagnostic is the load-time console line, whose `case` field is the
`modelMaxDiameter` that absolute mode divides into:

```
Model oriented | ... | hole NNmm outer NNmm case NNmm
```

If that reads ~85 mm for a 41.5 mm case, the GLB is a **closed loop** — a full
band rather than a case plus strap stubs — and the bounding-box measurement that
absolute mode relies on is sizing the band, not the case. 85/41.5 = 2.05, close
enough to the shipped multiplier to be the likely explanation. The fix would then
belong in how a closed-loop watch is measured (§5), not in the multiplier.

To make an active override impossible to miss later, it is echoed everywhere the
fit is reported:

```
Fit | limb 52.5mm | model hole 52.0 outer 68.0 (model units) | scale 0.9107
  (manual x1.30) | rendered hole 66.9mm outer 88.4mm
```

and the panel's **Fitted outer (mm)** readout appends `(x1.30)` whenever the
multiplier is not 1.

## 8. Debug panel & diagnostics

Press **D** to toggle. Common controls (camera model, placement, orientation,
smoothing) are shared with the ring app via `DebugPanel.js`; each app supplies
its own extra fields and readouts through `main.js`.

- **`Fit |` console line** — logged once per model load: limb width, measured
  model hole/outer, applied scale (and manual multiplier if active), and
  rendered hole/outer in millimetres. The single fastest way to diagnose "wrong
  size" — it separates "the model measured wrong" from "the fit math is wrong"
  from "the wrist measurement is wrong."
- **"Fitted outer (mm)" readout** — must always exceed the wrist-width readout
  for a fit-mode product; if it doesn't, the product is rendering inside the
  limb. (Deliberately *not* "fitted hole" — that value is algebraically
  `wristWidth × ratio` regardless of what the model actually contains, so it
  can never reveal a measurement bug. Outer diameter passes the model's real
  measurement through.)
- **`showOccluder`** toggle — renders the occluder as a visible wireframe, so an
  invisible-but-present occluder (which looks identical to "the product failed
  to load") can be told apart from an actual load failure.
- **Storage schema versioning** — debug-panel presets are saved to
  `localStorage` tagged with a schema version (currently `2`). When a
  parameter's *meaning* changes — as happened when `boreDiameterRatio` moved
  from "multiplier on outer diameter" to "clearance on inner diameter" — old
  saved presets are discarded outright rather than silently reinterpreted under
  their old values.

## 9. Known limitations

- **Wrist flexion tilts the product**, per the measured table in §3. Not fixable
  without a second model (MediaPipe Pose) or accepting the error.
- **Straps are rigid.** The GLB does not deform to conform to a very small or
  very large wrist; extreme sizes will show visible strap/case intersection with
  the occluder or the arm silhouette.
- **Tracking requires the hand in frame.** A forearm shot that excludes the hand
  loses tracking entirely — this is inherent to a hand-landmark-based approach,
  and worth calling out because wrist products are the ones users are most likely
  to try framing arm-only.

## 10. Verification

The implementation is covered by a headless-Chromium test harness
(`solvertest/`, outside the repo — see session history for setup) rather than
requiring a live camera for most checks:

- **`wrist.mjs`** — anchor placement, forearm-axis correctness, the flexion error
  table in §3, the cupping table in §3.1 (with the rigid rule held to 0.00° and
  the old four-ray rule required to *show* its drift, or the test would prove
  nothing), the axis filter's settling behaviour from §3.2, depth solve, and
  mirroring/handedness on synthetic hand poses attached to a known forearm.
- **`wrist-scene.mjs`** — sizing correctness (absolute case size invariant to
  wrist width; fit-mode hole tracks wrist width and is invariant to band
  thickness), bore-axis detection/fallback across synthetic torus, oval, charm,
  and open-watch geometries, occluder geometry and render-pass state, manual
  multiplier linearity, and a direct reproduction of the "hole ends up narrower
  than the wrist" regression that motivated the current measurement approach.
- **Shared regression** (`test.mjs`, `orient.mjs`, `browser.mjs`) — the ring
  implementation's suites, run to confirm changes to shared core code (solver,
  scene, positioner) don't regress the sibling product.

On-camera checks (no substitute for these — the harness cannot exercise the real
MediaPipe model or a real device camera):

1. Blue anchor marker sits on the forearm, in line with the wrist landmark drawn
   by the 2D debug overlay.
2. Depth readout tracks distance (~30 at 30 cm camera distance, ~70 at 70 cm);
   apparent size relative to the arm stays constant.
3. **Rotate the forearm (pronation)** — product should stay planted on the back
   of the wrist. This is the single strongest live indicator that the basis
   construction (§3) is correct, since it's the DOF the hand tracks faithfully
   regardless of wrist bend.
4. **Bend the wrist** — expect tilt consistent with the §3 table; anything
   substantially worse indicates a regression elsewhere.
5. **Open and close a fist, forearm held still** — the product, the cyan forearm
   debug line and the occluder proxy should all hold their angle. This is the
   live check for §3.1; the debug line is drawn from the same `palmCentre` rule
   the solver uses, so if it swings, the pose is swinging with it.
6. "Fitted outer" readout exceeds the wrist-width readout at all times for a
   fit-mode product (bracelet).
