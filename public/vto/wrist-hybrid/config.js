/**
 * Wrist VTO Configuration — watches and bracelets.
 *
 * Two presets over one solver: they share the wrist anchor and differ only in
 * where they sit on the forearm and how they are sized.
 *
 * Everything is metric. Lengths are millimetres where a human would think in
 * millimetres (offsets, case size) and metres inside the solver.
 */

const BASE = {
  envMapURL: '/models/envmaps/hotel_room_1k.hdr',

  camera: {
    // Assumed vertical field of view of the webcam, in degrees. Screen alignment
    // and apparent size are independent of this (the focal length cancels
    // between the depth solve and the projection), so it only affects the
    // reported absolute depth. ~60 suits phone front cameras, ~50 laptops.
    vFOV: 60,
    mirror: true,
    flipHandedness: false
  },

  anchor: {
    // Wrist breadth as a fraction of the index→pinky MCP span. The anatomical
    // starting point is ~0.70 (adult palm breadth at the knuckles averages
    // ~79mm against a ~55mm wrist breadth), which is what WristAnchor defaults
    // to. 0.81 is a measured on-camera calibration and belongs here, in the
    // shipped preset, rather than in the class.
    wristWidthCoeff: 0.81,
    // The wrist is elliptical, not round.
    wristDepthRatio: 0.72,

    // Damping on the forearm DIRECTION only, ahead of the basis. Separate from
    // smoothing.rotation, which cannot damp tilt without also making the watch
    // face lag pronation. A forearm turns slowly, so a low cutoff is free.
    axisSmoothing: true,
    axisMinCutoff: 0.6,
    axisBeta: 0.05
  },

  mediaPipe: {
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
    facingMode: 'user',
    debugDrawLandmarks: true,
    // Extrapolated forearm/arm lines past the wrist, same style as the hand
    // skeleton — visual check for the axis WristAnchor.forearmAxis() computes.
    debugDrawForearm: true,
    // Kept in step with anchor.axisRays / ulnarBiasCoeff so the line shows the
    // axis the solver actually uses.
    forearmRays: [5, 9],
    forearmUlnarBias: 1.0,
    // Pinned: the wasm fileset must match the JS bundle in index.html.
    version: '0.10.35'
  },

  occluder: {
    enabled: true,
    // Multiples of wrist width. Generous, because a strap that pokes out past
    // the end of the occluder destroys the effect.
    lengthRatio: 2.5,
    // Slide the cylinder up the forearm, so more of it covers the arm side than
    // the hand side.
    proximalBias: 0.15,
    debug: false
  },

  smoothing: {
    position: { enabled: true, minCutoff: 1.0, beta: 0.007 },
    rotation: { enabled: true, minCutoff: 1.5, beta: 0.35 },
    // Higher than the ring's 3: the wrist sits at the edge of the hand's
    // bounding box, so detection drops out more often than on a finger.
    confidence: { hysteresisFrames: 5 }
  },

  debug: {
    displayLandmarks: true,
    meshMaterial: false,
    marker: true,
    logPositions: false,
    panelEnabled: true
  }
};

export const WATCH_PRESET = {
  ...BASE,
  modelURL: window.VTO_MODEL_URL || '/models/watch/default.glb',
  anchor: {
    ...BASE.anchor,
    // A watch sits roughly a hand's-breadth of thumb up the forearm from the
    // wrist crease.
    anchorOffsetMm: 35
  },
  product: {
    boreAxis: 'auto',
    // A watch is ELONGATED along its bore — the strap runs up and down the arm
    // while the case is wider than it is thick — so the ring's narrowest-axis
    // rule would pick the case thickness and stand the watch on end. Verified:
    // a case-plus-stubs mesh with its bore on Y auto-detects as 'z' under
    // 'narrowest' and correctly as 'y' under 'longest'.
    // A closed-loop watch model behaves like a bracelet instead: switch this to
    // 'narrowest', or set boreAxis explicitly. The load-time log names both.
    boreAxisPolicy: 'longest',
    // 0 puts the face on the back of the wrist.
    rollDeg: 0,
    offsetMm: [0, 0, 0],
    sizing: {
      // A watch case is a fixed product spec, NOT something to fit to the wearer.
      // 38/40/42/44mm is exactly what the customer is shopping for; scaling it to
      // wrist width would make every case look identical on every arm.
      mode: 'absolute',
      diameterMm: 41.5,

      // MEASURED ON CAMERA, AND A FLAG RATHER THAN A SETTING TO BE PROUD OF.
      // Anything but 1.0 defeats the point of `absolute` mode: at 2.06 a 41.5mm
      // case renders at ~85mm, so the case size no longer means what it says.
      //
      // If anyone wants to chase it, the load-time console line
      //   Model oriented | ... | hole NNmm outer NNmm case NNmm
      // reports what `case` (modelMaxDiameter) actually measured. If that reads
      // ~85mm for a 41.5mm case, the GLB is a closed loop and the bbox is
      // measuring the whole band rather than the case — 85/41.5 = 2.05, close
      // enough to this multiplier to be worth a look. The fix would then be in
      // how a closed-loop watch is measured, not in this number.
      scaleMultiplier: 2.06
    }
  }
};

export const BRACELET_PRESET = {
  ...BASE,
  modelURL: window.VTO_MODEL_URL || '/models/bracelet/default.glb',
  anchor: {
    ...BASE.anchor,
    // A bracelet sits closer to the hand than a watch.
    anchorOffsetMm: 18
  },
  product: {
    // A closed bracelet is a flat torus, like a ring.
    boreAxis: 'auto',
    boreAxisPolicy: 'narrowest',
    rollDeg: 0,
    offsetMm: [0, 0, 0],
    sizing: {
      // Like a ring, a bracelet wraps the wearer — size follows the measurement.
      mode: 'fit',
      // Clearance on the wrist: the bracelet's HOLE is fitted to wristWidth x
      // this. Was 1.15 against the OUTER diameter, which left the hole narrower
      // than the wrist by twice the band thickness — the bracelet sat inside the
      // arm and the occluder hid it.
      boreDiameterRatio: 1.05,

      // Manual size override on top of the derived fit. 1.0 = use the
      // measurement. An escape hatch for a model the automatic fit reads wrong,
      // not the way to size a product.
      scaleMultiplier: 1.0
    }
  }
};

/** Preset chosen by ?product=watch|bracelet, defaulting to watch. */
export function resolveConfig() {
  const product = new URLSearchParams(window.location.search).get('product');
  return product === 'bracelet'
    ? { config: BRACELET_PRESET, product: 'bracelet' }
    : { config: WATCH_PRESET, product: 'watch' };
}
