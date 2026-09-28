/**
 * Glasses VTO Configuration.
 *
 * Everything is metric. Millimetres where a human thinks in millimetres,
 * metres inside the solver, canonical-face centimetres only inside the anchor.
 */

const query = new URLSearchParams(window.location.search);

export const GLASSES_CONFIG = {
  modelURL: window.VTO_MODEL_URL || '/models/glasses/default.glb',
  // Missing is fine: the scene falls back to a generated studio environment.
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
    // Lens centre above the eye line, mm. Pupils sit at or a little above the
    // optical centre of most frames.
    lensHeightMm: 0,
    // Back of the lenses in front of the nose bridge, mm. ~2 gives the usual
    // 13-14mm vertex distance to the cornea.
    lensStandoffMm: 2,
    // Calibrate the wearer's face scale from the iris (11.7mm across adults).
    // Needed for `absolute` sizing; `fit` looks the same either way.
    irisScale: true
  },

  // Face Landmarker is the primary tracker. These keys are consumed by
  // FaceLandmarkerTracker.
  mediaPipe: {
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    facingMode: 'user',
    videoWidth: 1280,
    videoHeight: 720,
    modelPath: '/tasks/face_landmarker.task',
    debugDrawLandmarks: query.has('landmarks'),
    // Pinned: the wasm fileset must match the JS bundle in index.html.
    version: '0.10.35'
  },

  occluder: {
    enabled: true,
    // Canonical face mesh pulled in along its normals, so the frame never
    // clips into a nose flatter than the average one.
    faceInsetMm: 4,
    skull: true,
    debug: false
  },

  product: {
    // 'auto' derives the GLB's axes from its geometry (see GlassesModel.js).
    // Override only if the load-time "Glasses oriented" log is wrong, e.g.
    // { width: 'x', up: '+y', forward: '+z' } — forward is where the lenses face.
    orientation: 'auto',
    // Pantoscopic tilt, degrees: + swings the lens bottoms toward the cheeks.
    // Most frames are modelled with it already.
    tiltDeg: 0,
    rollDeg: 0,
    offsetMm: [0, 0, 0],

    // Temples fade out over the ear, where real ones disappear behind it.
    templeFade: { enabled: true, startBeforeTragusMm: 3, endBehindTragusMm: 10 },
    // Temples bend outward to clear the head instead of sinking into it.
    templeSplay: { enabled: true, clearanceMm: 2 },

    // Only used for lenses authored with transmission, which cannot render over
    // a camera feed; lenses with their own opacity keep it.
    lensOpacity: 0.3,
    envMapIntensity: 1.0,

    sizing: {
      // 'fit'      — frame front = face width at the temples x frameWidthRatio.
      //              Works for any GLB, whatever its units.
      // 'absolute' — the real frame: frameWidthMm, or the GLB's own width if it
      //              is authored in metres. True-to-life only with irisScale.
      mode: 'fit',
      frameWidthRatio: 0.95,
      frameWidthMm: null,
      // Manual override on top of either mode. 1.0 = use the measurement.
      scaleMultiplier: 1.0
    }
  },

  smoothing: {
    position: { enabled: true, minCutoff: 1.0, beta: 0.01 },
    rotation: { enabled: true, minCutoff: 1.2, beta: 0.3 },
    confidence: { hysteresisFrames: 3 }
  },

  debug: {
    displayLandmarks: false,
    meshMaterial: false,
    marker: false,
    logPositions: false,
    // ?debug shows the tuning panel (press D to toggle); shoppers never see it.
    panelEnabled: query.has('debug')
  }
};
