/**
 * MediaPipe Hand Landmarks Configuration
 * 21 landmarks per hand (indices 0-20)
 */

export const HAND_LANDMARKS = {
  WRIST: 0,

  // Thumb (1-4)
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,

  // Index Finger (5-8)
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,

  // Middle Finger (9-12)
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,

  // Ring Finger (13-16)
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,

  // Pinky (17-20)
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
};

/**
 * Watch wrist landmark configuration
 */
export const WATCH_CONFIG = {
  // Primary placement point (wrist landmark where watches are worn)
  PLACEMENT_LANDMARK: HAND_LANDMARKS.WRIST,

  // Finger base landmarks for orientation calculation
  ORIENTATION_LANDMARKS: [
    HAND_LANDMARKS.INDEX_FINGER_MCP,   // 5
    HAND_LANDMARKS.MIDDLE_FINGER_MCP,  // 9
    HAND_LANDMARKS.RING_FINGER_MCP,    // 13
    HAND_LANDMARKS.PINKY_MCP           // 17
  ],

  // Surface offset (push watch toward camera to sit ON wrist, not IN it)
  SURFACE_OFFSET: 0.005,  // 5mm offset

  // Target watch diameter (standard size)
  TARGET_DIAMETER: 0.042,  // 42mm

  // For occluder axis (wrist to palm center)
  OCCLUDER_AXIS: {
    base: HAND_LANDMARKS.WRIST,
    tip: HAND_LANDMARKS.MIDDLE_FINGER_MCP
  }
};
