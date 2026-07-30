/**
 * Necklace VTO — entry point for necklaces and chokers.
 *
 * Everything generic lives in ../shared/vto-core. This file supplies only the
 * torso anatomy, the pose tracker choice, and the necklace-specific controls.
 */

import { resolveConfig } from './config.js';
import { NeckAnchor } from './core/NeckAnchor.js';
import { startVTO } from '../shared/vto-core/bootstrap.js';
import {
  PoseLandmarkerTracker, POSE, POSE_LANDMARK_COUNT
} from '../shared/vto-core/PoseLandmarkerTracker.js';

const { config, product } = resolveConfig();

// Biacromial breadth is the widest, most reliably visible segment on the upper
// body, so it leads the depth solve. Shoulder-to-ear adds a second, roughly
// perpendicular measurement so a face-on pose is not relying on one baseline.
const DEPTH_REFERENCE_PAIRS = [
  [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER],
  [POSE.LEFT_SHOULDER, POSE.LEFT_EAR],
  [POSE.RIGHT_SHOULDER, POSE.RIGHT_EAR],
  [POSE.LEFT_EAR, POSE.RIGHT_EAR]
];

// The Gauss-Newton refinement weights every landmark it is given equally, so it
// must only see landmarks actually in shot. At head-and-shoulders framing
// MediaPipe still reports hips, knees and ankles — extrapolated, not observed —
// and including them would fit the solve to invented geometry.
const REFINE_INDICES = [
  POSE.NOSE,
  POSE.LEFT_EAR, POSE.RIGHT_EAR,
  POSE.MOUTH_LEFT, POSE.MOUTH_RIGHT,
  POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER
];

startVTO({
  label: `${product === 'choker' ? 'Choker' : 'Necklace'} VTO`,
  config: {
    ...config,
    camera: {
      ...config.camera,
      landmarkCount: POSE_LANDMARK_COUNT,
      depthReferencePairs: DEPTH_REFERENCE_PAIRS,
      refineIndices: REFINE_INDICES
    }
  },
  anchor: new NeckAnchor(config.anchor),
  // The torso is what is being tracked, so pose is the primary tracker rather
  // than a passenger on a hand tracker as it is for the watch.
  tracker: PoseLandmarkerTracker,
  panel: {
    title: `${product === 'choker' ? 'Choker' : 'Necklace'} VTO Debug`,
    // Namespaced per product, so the two presets do not overwrite each other.
    storageKey: `necklace-vto-debug-params-${product}-v1`,
    defaults: {
      boreAxis: config.product.boreAxis,
      anchorDropMm: config.anchor.anchorDropMm,
      chestStandoffMm: config.anchor.chestStandoffMm,
      neckWidthCoeff: config.anchor.neckWidthCoeff,
      neckDepthRatio: config.anchor.neckDepthRatio,
      upSource: config.anchor.upSource,
      axisMinCutoff: config.anchor.axisMinCutoff,
      axisBeta: config.anchor.axisBeta,
      rotationGain: config.anchor.rotationGain,
      widthMedianFrames: config.anchor.widthMedianFrames,
      // Must be restated here. VTOScene reads `debugParams.scaleMultiplier ??
      // config...`, and the panel always carries COMMON_DEFAULTS' 1.0 — so
      // without this line the config value is permanently shadowed.
      scaleMultiplier: config.product.sizing.scaleMultiplier,
      boreDiameterRatio: config.product.sizing.boreDiameterRatio
    },
    extra: [
      {
        folder: 'Fit',
        key: 'anchorDropMm',
        args: [0, 200, 1],
        name: 'Down the chest (mm)'
      },
      {
        folder: 'Fit',
        key: 'chestStandoffMm',
        args: [0, 80, 0.5],
        name: 'Out from body (mm)'
      },
      {
        folder: 'Fit',
        key: 'neckWidthCoeff',
        args: [0.15, 0.6, 0.005],
        name: 'Neck width calib.'
      },
      {
        folder: 'Fit',
        key: 'neckDepthRatio',
        args: [0.4, 1.2, 0.01],
        name: 'Neck depth / width'
      },
      {
        folder: 'Fit',
        key: 'boreDiameterRatio',
        args: [0.8, 2.5, 0.01],
        name: 'Bore / neck width'
      },
      {
        folder: 'Fit',
        key: 'widthMedianFrames',
        args: [1, 15, 1],
        name: 'Width median frames'
      },
      // Which vector fixes rotation ABOUT the shoulder line. It cannot affect
      // body roll or yaw — those are measured from the shoulders themselves —
      // so this only trades torso pitch against stability.
      {
        folder: 'Torso basis',
        key: 'upSource',
        args: [['worldUp', 'head', 'hips']],
        name: 'Up vector source'
      },
      // Shoulder-direction damping, independent of the pose filter in
      // Smoothing. Lower cutoff = steadier, slower to follow a real body turn.
      {
        folder: 'Torso basis',
        key: 'axisMinCutoff',
        args: [0.1, 4.0, 0.05],
        name: 'Shoulder axis cutoff'
      },
      {
        folder: 'Torso basis',
        key: 'axisBeta',
        args: [0.0, 1.0, 0.01],
        name: 'Shoulder axis beta'
      },
      // Escape hatch, not a first resort — see NeckAnchor.applyRotationGain.
      // Reach for this only if bend/turn still under-shoots at 1.0 after the
      // two filters above are opened up; that would mean MediaPipe's own
      // shoulder-depth estimate is conservative, not that the tracking lags.
      {
        folder: 'Torso basis',
        key: 'rotationGain',
        args: [0.5, 2.5, 0.05],
        name: 'Rotation gain'
      }
    ],
    readouts: [
      { key: 'depthCm', name: 'Depth (cm)', format: (t) => (t.depth * 100).toFixed(1) },
      { key: 'neckWidthMm', name: 'Neck width (mm)', format: (t) => (t.width * 1000).toFixed(1) },
      // Must exceed the neck width, or the product is inside the neck and the
      // occluder hides it. The fitted HOLE is neckWidth x ratio by algebra and
      // so can never reveal a bad measurement — this is the number that can.
      {
        key: 'fittedOuterMm',
        name: 'Fitted outer (mm)',
        format: (t) => (t.fittedOuterM * 1000).toFixed(1) +
          (t.scaleMultiplier === 1 ? '' : ` (x${t.scaleMultiplier})`)
      },
      // How sure the model is that it can actually see both shoulders. The
      // whole torso frame rests on them, so when placement looks wrong this is
      // the first thing to read.
      {
        key: 'shoulders',
        name: 'Shoulder conf.',
        format: (t) => (t.shoulderVisibility ?? 0).toFixed(2)
      }
    ]
  }
});
