# Ring VTO — MediaPipe + Three.js

Real-time ring try-on. MediaPipe Hand Landmarker supplies the landmarks; a metric
pinhole solve turns them into a Three.js pose.

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
gaps, giving a measured finger width in metres. The GLB is normalized from its
own bounding box and fitted to that width, so it holds its size as the hand moves
nearer or further.

## Files

```
config.js                  metric configuration, no scale/depth knobs
main.js                    wiring and render loop
core/
  MediaPipeTracker.js      camera + HandLandmarker, frame-gated inference
  HandPoseSolver.js        the conversion above; no scene knowledge
  RingPositioner.js        mm offsets in finger space, smoothing, hysteresis
  ThreeRingScene.js        renderer, GLB fitting, depth-only finger occluder
utils/
  OneEuroFilter.js         speed-adaptive smoothing (scalar, Vector3, quaternion)
debug/
  DebugPanel.js            lil-gui panel + solved depth/finger-width readout
```

## Conventions

- **Units:** metres everywhere in the scene; millimetres only for the ring
  offsets a human tunes. Camera at the origin looking down −Z.
- **Finger frame:** X across the finger, Y along it toward the tip, Z out of the
  palm. `ring.offsetMm` is expressed in this frame, so it means the same thing at
  any hand orientation or distance.
- **Mirroring:** the video is CSS-mirrored (selfie view) and the solver mirrors
  the 3D to match. The mirror is applied to the finished quaternion, not to the
  basis vectors — negating a basis vector would make the matrix a reflection
  (det = −1) and `setFromRotationMatrix` would return garbage.
- **Screen mapping:** the video, the landmark overlay and the WebGL canvas all
  cover the viewport under the same `object-fit: cover` crop, and
  `HandPoseSolver.updateCamera()` derives the render camera's FOV from that same
  crop. If these three ever disagree, the 3D drifts off the hand.

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
in `index.html`. The MediaPipe wasm fileset URL in `MediaPipeTracker.js` must
stay on the same version as the JS bundle.
