/**
 * Ring VTO Configuration
 * Proven settings from WebARRocks implementation
 */

export const RingConfig = {
  // Model settings (proven values from current implementation)
  modelURL: window.VTO_MODEL_URL || '/models/rings/default.glb',
  modelScale: .1,
  modelOffset: [-1.5, -11, 0], // [x, y, z] - Fine-tuned position on finger
  modelQuaternion: [0, 0, 0.707, 0.707], // [X, Y, Z, W] - 90° Z rotation

  // MediaPipe settings
  mediaPipe: {
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.7,
    minTrackingConfidence: 0.7,
    facingMode: 'user',
    debugDrawLandmarks: true
  },

  // Soft occluder parameters (from WebARRocks)
  occluder: {
    enabled: true,
    radiusRange: [1.2, 1.5], // [inner, outer] - Finger size
    height: 30,
    offset: [0, 0, 0],
    quaternion: [0.707, 0, 0, 0.707], // 90° X rotation
    flattenCoeff: 0.7, // 1 = cylinder, 0.5 = 50% flattened
    debug: false
  },

  // Smoothing filters (from watch-mediapipe)
  smoothing: {
    position: {
      enabled: true,
      alpha: 0.65 // Higher = more responsive, lower = smoother
    },
    rotation: {
      enabled: true,
      alpha: 0.45
    },
    confidence: {
      hysteresisFrames: 5,
      threshold: 0.6
    }
  },

  // Ring finger landmarks (MediaPipe indices)
  landmarks: {
    ringMCP: 13, // Ring finger base (Metacarpophalangeal joint)
    ringPIP: 14, // Ring finger middle knuckle
    ringDIP: 15, // Ring finger top knuckle
    ringTIP: 16, // Ring finger tip
    wrist: 0,
    // For calculating finger orientation
    middlePIP: 10,
    pinkyPIP: 18
  },

  // Debug flags
  debug: {
    displayLandmarks: true,
    meshMaterial: false,
    occluder: false,
    logPositions: false
  }
};
