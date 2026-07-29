# Ring VTO — MediaPipe + Three.js

Real-time ring try-on. MediaPipe Hand Landmarker supplies the landmarks; a metric
pinhole solve turns them into a Three.js pose.

> The general method, its derivation, and the failure modes it replaces are
> documented in [`arch-docs/MEDIAPIPE_VTO_SYSTEM.md`](../../../arch-docs/MEDIAPIPE_VTO_SYSTEM.md).
> Read that before adapting this to a watch, bracelet or other product. What
> follows is this implementation's specifics.

## How the 2D → 3D conversion works

MediaPipe gives two things per hand: `landmarks` (normalized image coordinates,
with a relative and unitless `z`) and `worldLandmarks` (metres, but centred on
the hand, so the translation is thrown away). Neither alone can place an object
in a 3D scene. Used together they can.

```
1. f_px = (videoHeight / 2) / tan(vFOV / 2)             camera intrinsics
2. Z    = f_px * L_perp / L_px                          metric depth
3. X    = (px - cx) * Z / f_px,  Y = -(py - cy) * Z / f_px
```

Step 2 takes a segment of the hand, measures its image-plane extent in
`worldLandmarks` (metres) and its observed length in pixels, and solves for
depth. Using the world segment's x/y components rather than its full 3D length
cancels foreshortening — a finger pointing toward the camera no longer reads as
"further away".

Step 3 is plain pinhole back-projection, so the ring lands on the finger's actual
pixel by construction.

**vFOV is not a tuning knob.** On-screen size is `f_px · S / Z`, where `S` comes
from `worldLandmarks` (independent of `f_px`) and `Z ∝ f_px` — so `f_px`
cancels. Position and apparent size stay correct even if the assumed FOV is
wrong; only the reported absolute depth shifts.

Orientation comes from `worldLandmarks` only, as an orthonormal basis: Y along
the proximal phalanx (13→14), Z the palm normal, X completing the frame. Never
from projected pixels, which mix in perspective and flip Y.

Scale comes from the hand: the index→pinky MCP row spans three inter-finger
gaps, giving a measured finger width in metres. The GLB's own **hole** is measured
from its geometry and fitted to that width, so the ring holds its size as the hand
moves nearer or further, and band thickness does not affect the fit.

## Files

```
config.js                  metric configuration, no scale/depth knobs
main.js                    finger anatomy + debug schema; wiring is shared
core/RingAnchor.js         anchor lerp 13→14, finger basis, finger width
```

Everything else is `../shared/vto-core/`, shared with the wrist app:

```
HandSolver.js          camera model, metric depth, back-projection, basis
ProductPositioner.js   mm offsets, One Euro smoothing, hysteresis
VTOScene.js            renderer, canvas sizing, GLB fitting, occluder
MediaPipeTracker.js    camera + HandLandmarker, frame-gated inference
OneEuroFilter.js       speed-adaptive smoothing (scalar, Vector3, quaternion)
DebugPanel.js          lil-gui panel + solved readout
bootstrap.js           app wiring and render loop
```

## Conventions

- **Units:** metres everywhere in the scene; millimetres only for the ring
  offsets a human tunes. Camera at the origin looking down −Z.
- **Finger frame:** X across the finger, Y along it toward the tip, Z out of the
  palm. `product.offsetMm` is expressed in this frame, so it means the same thing at
  any hand orientation or distance.
- **Model orientation:** +Y is the finger axis, so a ring GLB is correct when its
  bore runs along +Y. Rather than carrying a per-model quaternion, the bore is
  measured from the geometry at load — vertices projected about each candidate
  axis, scored on hole size × how completely material surrounds the centre — and
  the model is rotated to match. `product.boreAxis` overrides it;
  `product.rollDeg` turns the ring about the finger to place the gem.
- **Sizing fits the hole, not the outside.** A bounding box cannot see a hole, and
  fitting the outer diameter leaves the bore narrower than the finger by twice the
  band thickness. `boreDiameterRatio` is clearance on the finger (~1.05), so band
  thickness no longer affects the fit. The panel's "Fitted outer" readout must
  always exceed the measured finger width — the fitted *hole* is
  `width x ratio` by algebra and so can never reveal a bad measurement.
- **Mirroring:** the video is CSS-mirrored (selfie view) and the solver mirrors
  the 3D to match. The mirror is applied to the finished quaternion, not to the
  basis vectors — negating a basis vector would make the matrix a reflection
  (det = −1) and `setFromRotationMatrix` would return garbage.
- **Screen mapping:** the video, the landmark overlay and the WebGL canvas all
  cover the viewport under the same `object-fit: cover` crop, and
  `HandSolver.updateCamera()` derives the render camera's FOV from that same
  crop. If these three ever disagree, the 3D drifts off the hand.

### Manual scale multiplier

`sizing.scaleMultiplier` (panel: **Scale multiplier**, 0.25–4.0) scales the
finished result, on top of whichever mode produced it. `1.0` uses the measurement
and is a no-op.

This is an **escape hatch, not a sizing method.** It is deliberately separate from
`boreDiameterRatio`, which means "clearance on the limb" and keeps the hole at
`limbWidth x ratio`; overloading that to double as a size fudge would make a knob
whose name says one thing and does another, which is the trap this pipeline was
rebuilt to escape. On a watch the multiplier also defeats the point of `absolute`
mode — a 42 mm case no longer renders at 42 mm.

So if it ends up far from 1.0, that is a measurement on the model worth reporting
rather than a setting to keep. The console `Fit |` line and the "Fitted outer"
readout both mark a non-default value, so an override can never be mistaken for a
bug later.

## Smoothing

One Euro filter: `fc = minCutoff + beta · |ẋ|`. Low cutoff while the hand is
still (kills jitter), high cutoff while it moves (kills lag) — a fixed alpha has
to trade one for the other. Rotations use a slerp with the same adaptation law,
driven by angular speed; filtering quaternion components independently is not
valid.

## Running

```bash
npm run dev
# http://localhost:3000/vto/rings-hybrid/index.html
```

Served straight from `public/`; the two-segment path bypasses the
`app/vto/[category]` route handler, so `window.VTO_MODEL_URL` is not injected and
`config.js` falls back to `/models/rings/default.glb`. Camera access needs
localhost or HTTPS. Press **D** to toggle the debug panel.

## Checks that should hold

- The blue anchor marker sits on the ring-finger landmark drawn by the 2D debug
  overlay, at every position in frame, on both standard and HiDPI displays.
- Hand at ~30 cm then ~70 cm reads roughly 30 → 70 in the panel's depth readout,
  and the ring keeps the same size relative to the finger throughout.
- Setting vFOV to 40 or 80 changes the reported depth but not the alignment or
  the apparent size.
- Rotating the hand keeps the ring perpendicular to the finger, with no free spin
  about the finger axis.

## Dependencies

Three.js r167 and `@mediapipe/tasks-vision` 0.10.35, both pinned in the importmap
in `index.html`. The MediaPipe wasm fileset URL in
`../shared/vto-core/MediaPipeTracker.js` must stay on the same version as the JS
bundle.
