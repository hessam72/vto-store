/**
 * Glasses VTO — entry point for eyewear.
 *
 * Everything generic lives in ../shared/vto-core. This file supplies the face
 * tracker choice, the face anchor, the glasses scene and the glasses-specific
 * debug controls.
 */

import { GLASSES_CONFIG as config } from './config.js';
import { GlassesAnchor } from './core/GlassesAnchor.js';
import { GlassesScene } from './core/GlassesScene.js';
import { startVTO } from '../shared/vto-core/bootstrap.js';
import {
  FaceLandmarkerTracker, FACE_LANDMARK_COUNT
} from '../shared/vto-core/FaceLandmarkerTracker.js';

// Long, rigid baselines for the depth seed: outer and inner eye corners, the
// temples, the forehead sides, and one vertical (forehead -> nose tip) so a
// turned head, which foreshortens the horizontal ones, still has a clean one.
const DEPTH_REFERENCE_PAIRS = [
  [33, 263], [133, 362], [127, 356], [54, 284], [10, 4]
];

// The Gauss-Newton refinement weights every landmark equally, so it gets only
// the skull-rigid part of MediaPipe's own Procrustes basis: forehead, brow
// ridge, eye corners, nose, cheekbones and temples. The jaw and the cheeks
// around the mouth move with speech and smiles and are left out.
const REFINE_INDICES = [
  4, 6, 10, 33, 54, 67, 117, 119, 121, 127, 129, 133, 143, 168, 198,
  263, 284, 297, 346, 348, 350, 356, 358, 362, 372, 420
];

const isAbsolute = config.product.sizing.mode === 'absolute';

startVTO({
  label: 'Glasses VTO',
  config: {
    ...config,
    camera: {
      ...config.camera,
      landmarkCount: FACE_LANDMARK_COUNT,
      depthReferencePairs: DEPTH_REFERENCE_PAIRS,
      refineIndices: REFINE_INDICES
    }
  },
  anchor: new GlassesAnchor(config.anchor),
  tracker: FaceLandmarkerTracker,
  scene: GlassesScene,
  panel: {
    title: 'Glasses VTO Debug',
    storageKey: 'glasses-vto-debug-params-v1',
    // A frame has no bore and no roll about a limb.
    omit: ['boreAxis', 'rollDeg', 'flipHandedness'],
    labels: {
      offsetXMm: 'Offset across (mm)',
      offsetYMm: 'Offset up (mm)',
      offsetZMm: 'Offset out of face (mm)',
      showOccluder: 'Show occluder (head)'
    },
    defaults: {
      lensHeightMm: config.anchor.lensHeightMm,
      lensStandoffMm: config.anchor.lensStandoffMm,
      irisScale: config.anchor.irisScale,
      tiltDeg: config.product.tiltDeg,
      // Must be restated here. VTOScene reads `debugParams.scaleMultiplier ??
      // config...`, and the panel always carries COMMON_DEFAULTS' 1.0 — so
      // without this line the config value is permanently shadowed.
      scaleMultiplier: config.product.sizing.scaleMultiplier,
      ...(isAbsolute
        ? { frameWidthMm: config.product.sizing.frameWidthMm ?? 140 }
        : { frameWidthRatio: config.product.sizing.frameWidthRatio })
    },
    extra: [
      { folder: 'Fit', key: 'lensHeightMm', args: [-15, 15, 0.5], name: 'Lens height (mm)' },
      { folder: 'Fit', key: 'lensStandoffMm', args: [-8, 15, 0.5], name: 'Lens standoff (mm)' },
      { folder: 'Fit', key: 'tiltDeg', args: [-10, 20, 0.5], name: 'Pantoscopic tilt (deg)' },
      isAbsolute
        ? { folder: 'Fit', key: 'frameWidthMm', args: [110, 170, 0.5], name: 'Frame width (mm)' }
        : { folder: 'Fit', key: 'frameWidthRatio', args: [0.7, 1.2, 0.005], name: 'Frame / face width' },
      { folder: 'Fit', key: 'irisScale', name: 'Iris face-scale calib.' }
    ],
    readouts: [
      { key: 'depthCm', name: 'Depth (cm)', format: (t) => (t.depth * 100).toFixed(1) },
      { key: 'faceWidthMm', name: 'Face width (mm)', format: (t) => (t.width * 1000).toFixed(1) },
      {
        key: 'frameWidthMm',
        name: 'Frame width (mm)',
        format: (t) => (t.fittedOuterM * 1000).toFixed(1) +
          (t.scaleMultiplier === 1 ? '' : ` (x${t.scaleMultiplier})`)
      },
      // Real millimetres only once the iris has calibrated the face scale.
      {
        key: 'pdMm',
        name: 'PD (mm)',
        format: (t) => (t.diagnostics?.pdMm ?? 0).toFixed(1) +
          (t.diagnostics?.irisCalibrated ? '' : ' (uncal.)')
      },
      { key: 'faceScale', name: 'Face scale', format: (t) => (t.diagnostics?.faceScale ?? 1).toFixed(3) },
      {
        key: 'headAngles',
        name: 'Yaw / pitch (deg)',
        format: (t) => `${(t.diagnostics?.yawDeg ?? 0).toFixed(0)} / ${(t.diagnostics?.pitchDeg ?? 0).toFixed(0)}`
      }
    ]
  }
});
