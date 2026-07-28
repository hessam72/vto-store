# MediaPipe → Three.js Virtual Try-On: Working Solution

## Overview

The method used to place 3D jewellery on a live camera feed with MediaPipe hand
tracking and Three.js. Proven in `public/vto/rings-hybrid/` (ring VTO) and
`public/vto/wrist-hybrid/` (watches and bracelets), July 2026, sharing
`public/vto/shared/vto-core/`. Written to generalize further to neck and ear
products.

The core problem is turning MediaPipe's 2D landmarks into a 3D pose that holds up
as the user moves. This document records the solution, the derivation behind it,
and the failure modes it replaced — the previous approach failed in ways that
looked like tuning problems but were structural, and cost a lot of time before
being diagnosed.

**Related:** `public/vto/rings-hybrid/README.md` and
`public/vto/wrist-hybrid/README.md` document those implementations specifically.
This document is the method.

---

## The Central Difficulty

MediaPipe Hand Landmarker returns two landmark sets per hand, and **neither one
alone can place an object in a 3D scene**:

| Output | What it is | Why it is not enough |
|---|---|---|
| `landmarks` | Normalized image coords `[0,1]`, `z` relative and unitless | A projection. No metric depth, so no way to size an object. |
| `worldLandmarks` | Metres, real 3D | Centred on the hand — the translation is discarded, so no position. |

The solution uses both: `worldLandmarks` supplies metric scale and orientation,
`landmarks` supplies where on screen the hand actually is.

### The trap to avoid

The intuitive approach — map normalized coords onto a "frustum plane" at some
tunable distance — cannot be made to work:

```js
// DO NOT DO THIS
const distance = globalScale + landmark.z * globalScale * depthMultiplier;
const height = 2 * Math.tan(vFOV / 2) * distance;
const x = (landmark.x - 0.5) * height * camera.aspect;
```

Object size on screen is a function of distance, so `globalScale` sets depth
**and** apparent scale together, while the model's own scale knob sets size
independently. Push the object back to fix depth and it shrinks; enlarge it to
compensate and it no longer fits. **There is no combination of these numbers that
is simultaneously correct**, which is why tuning them feels endless. If a VTO
implementation has a "global scale" and a "depth multiplier", it has this bug.

---

## The Method

Camera at the origin looking down −Z. Everything metric, in metres.

### Step 1 — Camera intrinsics

```js
f_px = (videoHeight / 2) / Math.tan(vFOV_radians / 2)
```

`vFOV` is an assumed constant (≈60° phone front camera, ≈50° laptop webcam).
Step 6 shows why its exact value does not matter.

### Step 2 — Metric depth from world landmarks

Take a segment of the hand. Its image-plane extent in `worldLandmarks` is a real
length in metres; its observed length in pixels comes from `landmarks`:

```js
L_perp = Math.hypot(wb.x - wa.x, wb.y - wa.y);   // metres, ⊥ to view axis
L_px   = Math.hypot((lb.x - la.x) * videoW, (lb.y - la.y) * videoH);
Z      = f_px * L_perp / L_px;                    // metres
```

Using the world segment's **x/y components** rather than its full 3D length is
what cancels foreshortening — the world landmarks already encode the segment's 3D
orientation, so a finger angled toward the camera no longer reads as further
away. Run this over several segments and take the median so one badly-tracked
landmark cannot dominate.

### Step 3 — Refine by reprojection (do not skip this)

Step 2 assumes both ends of a segment sit at the same depth. When the hand tilts
they do not, and the error is real: **a 50° tilt reads ~8% too close**, which
looks like the object swimming as the hand rotates.

Each landmark projects as `u = cx + f·(X + wx)/(Z + wz)`, so a few Gauss-Newton
steps on the hand-centre translation `(X, Y, Z)` resolve it exactly. This is the
translation half of PnP — the rotation is already known from `worldLandmarks`, so
only 3 unknowns remain. Seeded from Step 2 it converges in two or three
iterations. Jacobian:

```
∂u/∂X = f/d      ∂u/∂Y = 0        ∂u/∂Z = −f(X+wx)/d²     where d = Z + wz
∂v/∂X = 0        ∂v/∂Y = f/d      ∂v/∂Z = −f(Y+wy)/d²
```

The 3×3 normal equations solve directly by Cramer's rule; no linear algebra
library needed.

### Step 4 — Position by pinhole back-projection

Take the depth from Step 3, but the **screen position from the observed landmark
pixel** — not from the fitted model. This keeps the object glued to the hand the
user can see, even when the world landmarks and the normalized landmarks disagree
slightly.

```js
const anchorDepth = Z + w_anchor.z;   // world z is the offset from the hand centre
position.set(
  mirrorSign * (px - videoW / 2) * anchorDepth / f_px,
  -(py - videoH / 2) * anchorDepth / f_px,   // image Y is down, Three.js Y is up
  -anchorDepth                                // camera looks down −Z
);
```

### Step 5 — Orientation from world landmarks only

Never from projected pixels — those carry perspective distortion and an inverted
Y. Build an orthonormal basis, re-orthogonalizing because anatomical axes are
never exactly perpendicular:

```js
primary = normalize(W[b] - W[a]);                  // e.g. finger axis
normal  = normalize(cross(W[5] - W[0], W[17] - W[0]));  // palm plane
side    = normalize(cross(primary, normal));
normal  = cross(side, primary);                    // re-orthogonalize
matrix.makeBasis(side, primary, normal);
```

Convert MediaPipe world axes (X right, Y **down**, Z toward-camera-negative) to
Three.js with `(wx, -wy, -wz)`.

The index→pinky sweep runs the opposite way on left and right hands, so the cross
product flips: negate the normal for one handedness or the object sits rotated
180°.

### Step 6 — Why the assumed FOV does not matter

Apparent on-screen size is `f_px · S / Z`. `S` comes from `worldLandmarks`
(independent of `f_px`), and `Z ∝ f_px` from Step 2. **`f_px` cancels.**

Screen position is the landmark's own pixel by construction (Step 4), and screen
size is FOV-invariant. So a wrong `vFOV` shifts only the reported absolute depth,
never the alignment or the size. This is the property that ends the tuning loop —
and it is a decisive test: change `vFOV` from 40° to 80°; if anything but the
depth readout moves, the pipeline is wrong somewhere.

---

## Sizing: Two Modes, and Using the Wrong One Is a Product Bug

Never hardcode object size, but do not assume every product is sized the same way
either. There are two modes, and they are opposites:

**Fit-driven** — the product wraps the wearer, so it scales with the measured
anatomy. Rings and bracelets: the wearer's finger or wrist sets the size.

```js
// The index→pinky MCP row spans three inter-finger gaps.
fingerWidth = |W[5] − W[17]| / 3 × coefficient;   // coefficient ≈ 0.72
scale = (fingerWidth × boreDiameterRatio) / modelBoreDiameter;
```

**Absolute** — the product has a fixed real-world size that is itself the thing
being shopped for. A watch case is 38/40/42/44mm, and that number is the point:

```js
scale = (caseDiameterMm × 0.001) / modelMaxDiameter;
```

Fitting a watch case to the wrist would render every watch identically on every
arm and defeat the entire purpose of trying one on. Conversely, giving a ring an
absolute size ignores the wearer's finger. Pick per product category.

Absolute sizing is a one-liner *only because the pipeline is metric* — this is the
concrete payoff of everything above. Verified: a 42mm case renders at 42.00mm on
45/53/65mm wrists, with a bit-identical scale factor.

The model's own dimensions must be measured at load, not assumed — GLB authoring
units vary wildly between tools. Measure the bounding box once and derive
everything from it: the **bore** diameter from the smaller of the two extents
perpendicular to the bore (a gem or a case inflates one radial direction), and the
**max** diameter from the larger (which is the watch case's own size).

---

## Model Orientation: Derive, Don't Configure

A GLB is only correct when its axes match the solver's frame (in the ring case,
+Y along the finger). The tempting fix is a per-model quaternion constant, but
that breaks on the next asset and is unusable in a GUI — four coupled components
that must stay normalized.

Detect it from the geometry instead — but note that **the two product shapes need
opposite rules**, so this is a per-product policy, not one universal heuristic:

- **`narrowest`** — a ring or a closed bracelet is a flat torus: two bounding-box
  extents are the diameter, and the narrowest is the band width, which runs along
  the bore. Survives a gem, because a gem grows a radial extent and never the
  narrowest one.
- **`longest`** — an **open watch** (a case plus two strap stubs, which is how
  most watch GLBs are authored) is *elongated* along the bore instead: the strap
  runs up and down the arm while the case is wider than it is thick.

Applying the ring rule to a watch picks the case thickness and stands the watch on
end. Verified: a case-plus-stubs mesh with its bore on Y detects as `z` under
`narrowest` and correctly as `y` under `longest`. A *closed-loop* watch model
behaves like a bracelet and wants `narrowest`.

A shape heuristic cannot separate the two automatically — a solitaire ring and an
open watch have similarly lopsided bounding boxes — so let each product category
declare its policy and log the choice at load. Expose a manual axis override for
unusual geometry, and a **roll in degrees** about the primary axis for rotational
placement.

---

## Smoothing: One Euro, Not Fixed Alpha

A fixed-alpha low-pass filter forces a choice between jitter when still and lag
when moving. The One Euro filter removes the tradeoff by adapting the cutoff to
speed:

```
fc = minCutoff + β·|ẋ|          α = 1 / (1 + τ/Te)
```

Starting points for hands: `minCutoff ≈ 1.0 Hz`, `β ≈ 0.007`, `dCutoff = 1 Hz`.
Because the inputs are metric, these constants are physically meaningful rather
than arbitrary.

**Rotations must be smoothed as quaternion slerp** with a speed-adaptive alpha
driven by angular distance. Filtering quaternion components independently is not
valid. Also flip the target to the same hemisphere (`dot < 0` → negate) or slerp
takes the long way round.

Add detection hysteresis (≈3 frames) so a single dropped frame does not blink the
object, and reset the filters when the tracked hand changes.

---

## Occlusion

A depth-only proxy for the body part, so the far side of a band is hidden:

```js
material = new THREE.MeshBasicMaterial({
  colorWrite: false,     // invisible
  depthWrite: true,      // but occludes
  transparent: false,    // MUST be opaque
  side: THREE.DoubleSide
});
mesh.renderOrder = -1;   // before the product
```

`transparent: true` puts the proxy in the transparent pass, where `renderOrder`
no longer sequences it ahead of opaque geometry — it silently stops occluding.
Size the proxy from the measured anatomy, never from constants.

---

## The Screen-Mapping Contract

**Three surfaces must share one mapping from camera frame to screen**: the video
element, the 2D landmark debug overlay, and the WebGL canvas. If any two
disagree, the 3D drifts off the hand while the debug overlay still looks perfect
— a genuinely misleading symptom, because the overlay tracking correctly suggests
the tracking is fine and the maths is wrong.

The setup that holds:

- Video and overlay both `object-fit: cover` over the viewport. The overlay's
  backing store matches the video's dimensions, so the crop is identical.
- The render camera's FOV derives from the **same** cover crop:
  ```js
  const { sy } = coverScale(view);   // visible fraction of the video's height
  camera.fov = radToDeg(2 * Math.atan((videoHeight * sy / 2) / f_px));
  camera.aspect = canvasWidth / canvasHeight;
  ```
- Update the camera **before** solving each frame. Applying FOV changes after the
  pose is computed leaves the two a frame apart.
- Mirroring (selfie view) is CSS-only; the 3D mirrors to match.

### Mirroring a rotation

Negating a basis vector turns the rotation matrix into a **reflection**
(det = −1), and `setFromRotationMatrix` returns garbage. Build the basis
unmirrored, then mirror the finished quaternion — conjugating by
`diag(-1, 1, 1)` negates the y and z components:

```js
q.set(q.x, -q.y, -q.z, q.w);
```

---

## Canvas Sizing

`renderer.setSize(w, h)` takes **CSS pixels** and derives the backing store from
the pixel ratio. Setting `canvas.width/height` by hand and passing those buffer
dimensions back into `setSize()` writes an inline CSS size of `viewport × DPR`,
overriding the stylesheet. Measured on a DPR-3 phone: a 390×844 viewport got a
1170×2532 CSS canvas — the scene rendered 3× oversized into the top-left corner,
moving at 3× the hand's speed. DPR 1 is unaffected, so it presents as an
intermittent, device-specific bug.

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
```

---

## MediaPipe Notes

- `runningMode` on web is `"IMAGE" | "VIDEO"` only — no `LIVE_STREAM`.
- `detectForVideo` needs **strictly increasing** timestamps. Gate on
  `video.currentTime` changing (or use `requestVideoFrameCallback`), otherwise
  every rAF tick faster than the camera burns a GPU pass on a repeated frame.
- `handedness` is current; `handednesses` is deprecated.
- Handedness assumes a **mirrored** input image, which may not match how frames
  are fed in. Keep a `flipHandedness` flag; it should affect only the label and
  the normal's sign, never the position.
- **Pin the version.** The wasm fileset URL and the JS bundle must match. A
  floating `@latest` in the importmap silently rolled from 0.10.x to 1.0.0 when
  that released (2026-07-28). The HandLandmarker API is identical across that
  boundary, but a version skew between wasm and bundle is not something to
  discover in production.

---

## Applying to a New Product Category

The solver is product-agnostic. A new category supplies four things:

| | Ring | Watch | Bracelet |
|---|---|---|---|
| **Anchor** | lerp(13→14) at 0.45 | Wrist (0) + 35mm up the forearm | Wrist (0) + 18mm |
| **Primary axis** | Finger axis (13→14) | Forearm axis (palm centre → wrist, extended) | As watch |
| **Normal** | Palm normal | Palm normal **negated** (face on the back) | As watch |
| **Reference size** | `\|W[5]−W[17]\|/3 × 0.72` | `\|W[5]−W[17]\| × 0.70`, depth × 0.72 | As watch |
| **Sizing mode** | Fit | **Absolute** (case mm) | Fit |
| **Bore policy** | `narrowest` | `longest` | `narrowest` |
| **Occluder** | Round cylinder | Elliptical, along the forearm, biased proximally | As watch |
| **Hysteresis** | 3 frames | 5 frames | 5 frames |

Steps 1–6, the smoothing, the mapping contract and the canvas sizing are
unchanged. Implemented in `public/vto/rings-hybrid/` and
`public/vto/wrist-hybrid/`, sharing `public/vto/shared/vto-core/`.

### The wrist is harder than the finger

MediaPipe has **no forearm landmark** — landmark 0 is the wrist crease at the base
of the palm, and nothing lies beyond it. The forearm axis must be extrapolated
from `palm centre → wrist`, which is exact only when the wrist is straight.

Of the wrist's three degrees of freedom, two corrupt that axis (flexion ±70°,
deviation ±20°) and one does not: pronation rotates the radius over the ulna and
the hand rides the radius, so **roll about the arm is reported faithfully however
the wrist is bent**. Roll is what decides which way a watch face points, so the
failure mode is a tilt rather than a spin.

Measured against a synthetic hand on a known forearm, at a 35mm watch offset:

| Wrist flexion | Axis error | Anchor displacement |
|---|---|---|
| 0° | 0.4° | 0.0 mm |
| 15° | 15.0° | 9.1 mm |
| 30° | 30.0° | 18.1 mm |
| 45° | 45.0° | 26.8 mm |
| 60° | 60.0° | 35.0 mm |

Error tracks flexion nearly 1:1 — fine to ~15°, visibly wrong past 30°. If that
proves too costly, MediaPipe Pose Landmarker supplies a true elbow→wrist vector
for ~16MB on top of the hand model's 7.5MB plus a second inference (which can run
every 3rd frame — a forearm moves slowly). Keep the axis behind a single function
so the swap is local.

Also budget extra detection hysteresis on wrist products: the wrist sits at the
edge of the hand's bounding box, so tracking drops out more often than on a
finger. And note that tracking needs the **hand** in frame — a forearm alone with
the hand out of shot loses tracking entirely.

---

## Verification Recipe

These are the checks that distinguish a correct pipeline from one that merely
looks close, ordered by diagnostic value.

1. **Overlay agreement** — the 3D anchor marker sits exactly on the 2D debug
   landmark, at every position in frame, **on both a DPR-1 and a DPR-2+ display**.
   Testing only on a non-retina desktop hides the canvas-sizing class of bug.
2. **FOV independence** — set `vFOV` to 40° then 80°. Only the depth readout may
   change. If alignment or size moves, the metric solve is not doing the work.
3. **Depth linearity** — hand at ~30 cm then ~70 cm should read ≈0.30 → ≈0.70,
   and the object must hold its size *relative to the body part* throughout.
4. **Rotation stability** — pitch/yaw/roll the hand; the object must stay
   correctly seated with no free spin about the primary axis.
5. **Tilt** — a hand angled toward the camera must not swim in depth. This is
   what Step 3 buys; without it the error is ~8% at 50°.
6. **Occlusion** — the far side of the band hides, and nothing else disappears.

Steps 1–5 are testable headlessly without a camera: build a synthetic hand at a
known metric pose, project it through a known pinhole to produce exactly what
MediaPipe would emit, run the solver, and assert the pose comes back. Reprojection
error should be 0.00 px. This is worth building — it catches sign errors,
reflections and foreshortening bugs that are nearly impossible to see by eye on a
live feed.

---

## Failure Modes Reference

Symptoms observed during development, with causes, since several are misleading:

| Symptom | Cause |
|---|---|
| Object offset and moving faster than the hand, on phones only | Canvas sizing — buffer pixels passed to `setSize()` |
| 2D debug landmarks track perfectly, 3D does not | Overlay and WebGL canvas using different screen mappings |
| No knob setting is ever correct | Depth coupled to world scale (`globalScale` × frustum mapping) |
| Object swims in depth as the hand rotates | Weak-perspective depth without the reprojection refinement |
| Object spins freely about its axis | `setFromUnitVectors` — leaves roll undetermined |
| Object mirrored / rotation garbage | Mirror applied to basis vectors instead of the quaternion |
| Object rotated 180° on one hand only | Palm-normal sign not flipped for handedness |
| Object flipped vertically | Image Y (down) used directly as Three.js Y (up) |
| Occluder stops working, or hides everything | `transparent: true`, or proxy sized by constants |
| Object blinks on dropped frames | No detection hysteresis |
| Ring stands across the finger | GLB bore axis not aligned to the solver's primary axis |
| Watch stands on end | Ring's `narrowest` bore policy applied to an open watch — use `longest` |
| Every watch looks the same size on every wrist | Absolute-sized product put through the fit-driven path |
| Band looks undersized | Fitting diameter taken as `max()` over all three extents (gem inflates it) |
| Watch tilts off the arm when the wrist bends | Hand-only forearm axis; inherent, see the flexion table |
