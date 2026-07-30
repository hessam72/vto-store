/**
 * Necklace VTO Configuration.
 *
 * Two presets over one solver: a necklace that hangs on the chest and a choker
 * that sits on the neck. They share the torso anchor and differ in how far down
 * the chest they sit and how they are sized.
 *
 * Everything is metric. Millimetres where a human thinks in millimetres,
 * metres inside the solver.
 */

const BASE = {
  envMapURL: '/models/envmaps/venice_sunset_1k.hdr',

  camera: {
    // Assumed vertical field of view of the webcam, in degrees. Screen
    // alignment and apparent size are independent of this (the focal length
    // cancels between the depth solve and the projection), so it only affects
    // the reported absolute depth. ~60 suits phone front cameras, ~50 laptops.
    vFOV: 60,
    mirror: true,
    flipHandedness: false
  },

  anchor: {
    // Neck breadth as a fraction of biacromial (shoulder-to-shoulder) breadth.
    // Adult biacromial averages ~39cm against a ~12cm neck, hence ~0.32.
    // Calibrate in the panel if the product reads wide or narrow.
    neckWidthCoeff: 0.32,
    // The neck is elliptical, not round.
    neckDepthRatio: 0.78,

    // 'worldUp' | 'head' | 'hips'. worldUp is the default because at
    // head-and-shoulders framing the hips are extrapolated rather than seen,
    // and because a chain hangs under gravity rather than pitching with the
    // chest. Body roll and yaw come from the shoulder line either way — this
    // only decides rotation ABOUT the shoulder line.
    upSource: 'worldUp',
    hipVisibility: 0.7,
    shoulderVisibility: 0.5,

    // Damping on the shoulder DIRECTION only, ahead of the basis. Separate from
    // smoothing.rotation below.
    //
    // Raised from the wrist's forearm-axis values (0.5Hz/0.04) that this
    // started from: those were tuned for a wrist bending a few degrees, not a
    // torso making a large, deliberate turn, and the lower numbers read as
    // "the necklace moves less than I actually did" while the turn is in
    // progress (it still reaches the right angle once you stop — this is lag,
    // not a wrong answer). A torso is heavy and can't snap, so it's safe to
    // trust the raw signal more.
    axisSmoothing: true,
    axisMinCutoff: 1.2,
    axisBeta: 0.15,

    // Escape hatch if under-rotation persists after the retuning above — see
    // the option's own doc comment in NeckAnchor.js. 1.0 is a no-op; that
    // means responsiveness alone was the problem and no gain is needed.
    rotationGain: 1.0,

    widthMedianFrames: 5
  },

  // Pose Landmarker is the PRIMARY tracker here, not a passenger: the torso is
  // the thing being tracked. Note these keys are consumed by
  // PoseLandmarkerTracker, so they are pose options, not hand options.
  mediaPipe: {
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
    facingMode: 'user',
    modelPath: '/tasks/pose_landmarker_lite.task',
    // Requested, not guaranteed; `ideal` degrades on a device that cannot do
    // it. A sharper frame gives the model a better crop and tightens the
    // shoulder landmarks, which is where all the orientation comes from.
    videoWidth: 1920,
    videoHeight: 1080,
    debugDrawLandmarks: false,
    debugMinVisibility: 0.5,
    // Pinned: the wasm fileset must match the JS bundle in index.html.
    version: '0.10.35'
  },

  occluder: {
    enabled: true,
    // Closed at the top, unlike a limb: an open tube would let the chain show
    // through where the neck meets the jaw.
    shape: 'capsule',
    // Multiples of neck width. The chain has to be hidden all the way round the
    // back of the neck or the illusion collapses.
    lengthRatio: 2.2,
    // Slide the proxy up toward the head, so it covers the nape rather than
    // extending down over the chest where the pendant is supposed to be seen.
    proximalBias: 0.2,
    debug: false
  },

  smoothing: {
    position: { enabled: true, minCutoff: 1.0, beta: 0.007 },
    // Raised from the wrist's 1.5Hz/0.35: this filter runs on the FINAL
    // quaternion, in series with the shoulder-axis filter above, and the two
    // compounded were the other half of the "moves less than I actually did"
    // lag. Loosened here since the axis filter already does the real jitter
    // rejection; this pass only needs to catch what that one doesn't.
    rotation: { enabled: true, minCutoff: 2.5, beta: 0.6 },
    // Higher than the wrist's 5: a torso is large and slow, so a few dropped
    // frames are far more likely to be a detection blink than real motion.
    confidence: { hysteresisFrames: 6 }
  },

  debug: {
    displayLandmarks: false,
    meshMaterial: false,
    marker: false,
    logPositions: false,
    panelEnabled: true
  }
};

export const NECKLACE_PRESET = {
  ...BASE,
  modelURL: window.VTO_MODEL_URL || '/models/necklace/black-panther.glb',
  anchor: {
    ...BASE.anchor,
    // Just below the shoulder line, at the base of the neck — was 45mm, which
    // put the anchor down on the chest rather than at the neck, and every mm
    // here is on top of however much the GLB's own chain already drops the
    // pendant. Let the model's own geometry provide most of the hang.
    anchorDropMm: 15,
    // And stands off the body so it rests on the chest rather than inside it.
    chestStandoffMm: 20
  },
  product: {
    boreAxis: 'auto',
    // A necklace is a closed loop — a flat torus, like a bracelet — so the
    // narrowest extent runs along the bore. If a pendant is large enough to
    // confuse the annularity measure, set boreAxis explicitly; the load-time
    // log names the path taken and the scores.
    boreAxisPolicy: 'narrowest',
    // 0 puts the pendant at the front.
    rollDeg: 0,
    offsetMm: [0, 0, 0],
    sizing: {
      // The loop wraps the wearer, so size follows the measurement.
      mode: 'fit',
      // Clearance on the neck: the necklace's HOLE is fitted to neckWidth x
      // this. Generous, because a necklace hangs away from the throat rather
      // than gripping it like a ring.
      boreDiameterRatio: 1.35,
      // Manual override on top of the derived fit. 1.0 = use the measurement.
      scaleMultiplier: 1.0
    }
  }
};

export const CHOKER_PRESET = {
  ...BASE,
  modelURL: window.VTO_MODEL_URL || '/models/necklace/black-panther.glb',
  anchor: {
    ...BASE.anchor,
    // A choker sits on the neck itself, barely below the shoulder line.
    anchorDropMm: 10,
    chestStandoffMm: 8
  },
  product: {
    boreAxis: 'auto',
    boreAxisPolicy: 'narrowest',
    rollDeg: 0,
    offsetMm: [0, 0, 0],
    sizing: {
      mode: 'fit',
      // Close on the neck, which is what makes it a choker.
      boreDiameterRatio: 1.05,
      scaleMultiplier: 1.0
    }
  }
};

/** Preset chosen by ?product=necklace|choker, defaulting to necklace. */
export function resolveConfig() {
  const product = new URLSearchParams(window.location.search).get('product');
  return product === 'choker'
    ? { config: CHOKER_PRESET, product: 'choker' }
    : { config: NECKLACE_PRESET, product: 'necklace' };
}
