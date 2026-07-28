/**
 * Ring VTO Configuration
 *
 * Everything here is metric. Lengths are millimetres where a human would think
 * in millimetres (ring offsets) and metres in the solver. There is deliberately
 * no "global scale" or "depth multiplier": those two knobs were coupled — depth
 * and world scale moved together — so no combination of them was ever correct.
 * Scale now comes from the hand's own measured size.
 */

export const RingConfig = {
  modelURL: window.VTO_MODEL_URL || '/models/rings/default.glb',

  camera: {
    // Assumed vertical field of view of the webcam, in degrees.
    // Screen alignment and apparent size are independent of this value (the
    // focal length cancels between the depth solve and the projection), so it
    // only affects the reported absolute depth and subtle perspective.
    // ~60 suits phone front cameras, ~50 most laptop webcams.
    vFOV: 60,

    // The video is displayed mirrored, selfie-style. The 3D is mirrored to match.
    mirror: true,

    // MediaPipe labels handedness assuming a mirrored input image. Flip this if
    // the reported hand is the opposite of the one on screen. Affects only the
    // label and the palm-normal sign, never the position.
    flipHandedness: false
  },

  ring: {
    // Where the ring sits along the proximal phalanx: 0 = MCP joint (knuckle),
    // 1 = PIP joint. A worn ring sits just above the knuckle.
    anchorAlongPhalanx: 0.45,

    // Offset in millimetres in the finger frame:
    // X across the finger, Y along it toward the tip, Z out of the palm.
    offsetMm: [0, 0, 0],

    // Which axis the ring's hole runs along in the GLB. The solver's +Y is the
    // finger axis, so the model is rotated to match. 'auto' takes the narrowest
    // bounding-box axis, which for a ring is always the hole; override with
    // 'x' / 'y' / 'z' if a model is shaped unusually enough to fool that.
    holeAxis: 'auto',

    // Rotation about the finger axis, in degrees — where the gem ends up.
    rollDeg: 0,

    // Finger width is measured from the hand: the index→pinky MCP row spans
    // three inter-finger gaps, and this calibrates a gap to a finger width.
    // Raise it if the ring reads slightly small on your hand.
    fingerWidthCoeff: 0.72,

    // Ring outer diameter as a multiple of the finger width. A band adds a
    // couple of millimetres of metal around the finger.
    outerDiameterRatio: 1.25
  },

  mediaPipe: {
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
    facingMode: 'user',
    debugDrawLandmarks: true,

    // Pinned deliberately. The importmap used to resolve `@latest`, which rolled
    // over to the 1.0.0 release; the wasm fileset must match the JS bundle.
    version: '0.10.35'
  },

  // Depth-only cylinder along the finger, so the far side of the band is hidden.
  occluder: {
    enabled: true,
    // Multiples of the measured finger width.
    radiusRatio: 0.5,
    lengthRatio: 3.0,
    // 1 = round, lower = flatter. Fingers are wider than they are deep.
    flattenCoeff: 0.75,
    debug: false
  },

  /**
   * One Euro filter parameters. Inputs are metric, so these are physical:
   * minCutoff is in Hz (lower = smoother while the hand is still) and beta is
   * the speed coefficient (higher = less lag while the hand moves).
   */
  smoothing: {
    position: { enabled: true, minCutoff: 1.0, beta: 0.007 },
    rotation: { enabled: true, minCutoff: 1.5, beta: 0.35 },
    confidence: { hysteresisFrames: 3 }
  },

  debug: {
    displayLandmarks: true,
    meshMaterial: false,
    marker: true,
    logPositions: false,
    panelEnabled: true
  }
};
