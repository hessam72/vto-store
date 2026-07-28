# Wrist VTO — watches and bracelets

Real-time wrist try-on. MediaPipe Hand Landmarker supplies the landmarks; a
metric pinhole solve turns them into a Three.js pose.

> The general method and its derivation are in
> [`arch-docs/MEDIAPIPE_VTO_SYSTEM.md`](../../../arch-docs/MEDIAPIPE_VTO_SYSTEM.md).
> This app shares its solver with `../rings-hybrid` via `../shared/vto-core`;
> what follows is wrist-specific.

```bash
npm run dev
# http://localhost:3000/vto/wrist-hybrid/index.html            → watch
# http://localhost:3000/vto/wrist-hybrid/index.html?product=bracelet
```

Camera access needs localhost or HTTPS. Press **D** for the debug panel.

---

## The wrist problem: there is no forearm landmark

MediaPipe's landmark 0 sits at the **wrist crease at the base of the palm**, and
there is nothing beyond it. A watch sits 30–40 mm further up the forearm, so both
the anchor and the axis are extrapolated off the end of the tracked skeleton:

```
palmCentre  = mean(MCP row)
forearmAxis = normalize(W[0] - palmCentre)      // palm → wrist, on up the arm
anchor      = W[0] + forearmAxis × anchorOffsetMm
```

That extrapolation is exact only when the wrist is straight. Of the wrist's three
degrees of freedom, two corrupt it and one does not:

| DOF | Range | Effect on the axis |
|---|---|---|
| Flexion / extension | ±70° | **Corrupts it** — the product tilts off the arm |
| Radial / ulnar deviation | ±20° | Corrupts it, smaller |
| Pronation / supination | ±80° | **Harmless** |

Pronation is harmless because it rotates the radius over the ulna and the hand
rides the radius, so the palm normal reports roll about the arm faithfully however
the wrist is bent. Roll decides which way the watch face points — the thing a user
notices most — so the failure mode is a **tilt, not a spin**.

### Measured error

From `wrist.mjs` in the test harness, against a synthetic hand attached to a known
forearm, at the 35 mm watch offset:

| Wrist flexion | Axis error | Anchor displacement |
|---|---|---|
| 0° | 0.4° | 0.0 mm |
| 15° | 15.0° | 9.1 mm |
| 30° | 30.0° | 18.1 mm |
| 45° | 45.0° | 26.8 mm |
| 60° | 60.0° | 35.0 mm |

Axis error tracks flexion very nearly 1:1. Read it as: **fine to ~15°, visibly
wrong past 30°.** The natural "look at my watch" pose holds the wrist near
straight, which is why hand-only is worth shipping first.

**The fix, if the numbers above prove too costly in practice:** MediaPipe Pose
Landmarker gives a true elbow→wrist vector, at ~16 MB on top of the hand model's
7.5 MB plus a second inference per frame (it can run every 3rd frame — a forearm
moves slowly). `WristAnchor.forearmAxis()` is the single source of the axis, so
that swap touches nothing else.

---

## Sizing: watches are absolute, bracelets fit

A real divergence from rings, and getting it backwards makes every watch wrong.

- A **bracelet** wraps the wearer, so its bore follows the measured wrist —
  `sizing.mode: 'fit'`, exactly like a ring.
- A **watch case** is a fixed product spec (38/40/42/44 mm) that the customer is
  specifically shopping for — `sizing.mode: 'absolute'`, `diameterMm`. Fitting a
  case to the wrist would render every watch the same size on every arm and defeat
  the point of trying one on.

Absolute sizing is a one-liner only because the whole pipeline is metric. Verified:
a 42 mm case renders at 42.00 mm on 45/53/65 mm wrists, and its scale factor is
bit-identical across them.

Wrist dimensions come from the hand, reusing the ring's palm-width measure:

```
wristWidth = |W[5] - W[17]| × wristWidthCoeff   // ≈0.70
wristDepth = wristWidth × wristDepthRatio        // ≈0.72, the wrist is elliptical
```

Adult palm breadth at the knuckles averages ~79 mm against a ~55 mm wrist breadth,
hence 0.70. Calibrate it in the panel if the product reads wide or narrow.

## Model orientation and fit

The GLB's bore must run along +Y, the forearm axis, and its **hole** must fit the
wrist. Both come from measuring the geometry at load rather than its bounding box,
because a bounding box cannot see a hole.

Vertices are projected about each candidate axis and scored on hole size × how
completely material surrounds the centre. A real bore scores 0.35–0.93; every
wrong axis scores ~0.1, because a bangle seen edge-on has empty space in the
middle but nothing *around* it. The bore's centre is found the same way, so a
clasp or charm cannot drag the pivot off-axis.

An **open watch** — a case plus two strap stubs, how most watch GLBs are authored
— has no bore to find and is not centred on the wrist axis. It scores as
inconclusive and falls back to a bounding-box policy:

- `boreAxisPolicy: 'longest'` — an open watch is elongated along the bore, since
  the strap runs up and down the arm. (Verified: a case-plus-stubs mesh with its
  bore on Y detects as `z` under the ring rule and correctly as `y` under this one.)
- `boreAxisPolicy: 'narrowest'` — a **closed-loop** watch behaves like a bracelet.

The load-time log names the path taken and the scores, so a wrong pick is
immediately identifiable:

```
Model oriented | bbox 0.042 x 0.070 x 0.012 | bore axis y (bbox longest,
  annularity inconclusive: z 0.26, y 0.18, x 0.11) | hole 42.0mm outer 70.0mm case 70.0mm
```

**Sizing fits the hole.** `boreDiameterRatio` is clearance on the wrist (~1.05),
applied to the measured hole, so band thickness does not affect the fit. Fitting
the *outer* diameter instead — what a bounding box gives you — leaves the hole
narrower than the wrist by twice the band: on an 8 mm band that is 13 mm too
small, the bracelet sits inside the arm, and the occluder hides it. The panel's
"Fitted hole" readout must always exceed the measured wrist width.

## Occlusion

Matters more here than for rings — a watch wraps the wrist, so the far side of the
strap must be hidden or the illusion collapses. The proxy is an **elliptical**
cylinder (`scale.x = wristWidth`, `scale.z = wristDepth`) along the forearm,
2.5× wrist width long and slid 15% up the arm so the strap cannot poke out past
the end. Opaque, `colorWrite:false`, `depthWrite:true`, `renderOrder:-1` —
`transparent:true` moves it to the transparent pass where it silently stops
occluding.

## Files

```
config.js                  WATCH_PRESET + BRACELET_PRESET, chosen by ?product=
main.js                    anatomy + debug schema; wiring is in the shared bootstrap
core/WristAnchor.js        forearm axis, proximal offset, wrist basis and dimensions
```

Everything else — camera model, metric depth, smoothing, canvas sizing, GLB
fitting, occluder, debug panel — is `../shared/vto-core/`, shared with the ring
app.

## Config deltas

| | Watch | Bracelet |
|---|---|---|
| `anchorOffsetMm` | 35 | 18 |
| `sizing.mode` | `absolute`, 42 mm case | `fit`, hole = 1.05 × wrist |
| `boreAxisPolicy` | `longest` | `narrowest` |

`smoothing.confidence.hysteresisFrames` is 5 for both, up from the ring's 3: the
wrist sits at the edge of the hand's bounding box, so detection drops out more
often than on a finger.

## Checks that should hold

- The blue anchor marker sits on the forearm, straight down the arm from the wrist
  landmark drawn by the 2D debug overlay.
- Depth readout ≈ 30 at 30 cm, ≈ 70 at 70 cm; the watch holds its apparent size
  relative to the arm throughout.
- **Rotate the forearm** (pronation) — the watch should stay put on the back of
  the wrist. This is the DOF the hand tracks faithfully, and it is the strongest
  single indicator the basis is right.
- **Bend the wrist** — expect the tilt in the table above. Anything worse means
  something else is wrong.
- Setting vFOV to 40 or 80 changes the reported depth but not the alignment or the
  apparent size.

## Known limitations

- Wrist flexion tilts the product, as measured above.
- Rigid GLB straps do not deform, so a very small or large wrist will show strap
  intersection.
- **Tracking needs the hand in frame.** A forearm alone with the hand out of shot
  loses tracking entirely — inherent to a hand-landmark approach, and more
  restrictive here than for rings because a wrist product invites framing just the
  arm.

## Dependencies

Three.js r167 and `@mediapipe/tasks-vision` 0.10.35, both pinned in the importmap
in `index.html`. The MediaPipe wasm fileset URL in
`../shared/vto-core/MediaPipeTracker.js` must stay on the same version as the JS
bundle.
