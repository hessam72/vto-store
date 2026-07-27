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
  RING_FINGER_MCP: 13,  // Base knuckle - PRIMARY PLACEMENT POINT
  RING_FINGER_PIP: 14,  // Middle joint
  RING_FINGER_DIP: 15,  // Top joint
  RING_FINGER_TIP: 16,  // Fingertip

  // Pinky (17-20)
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
};

/**
 * Ring finger landmark configuration
 */
export const RING_CONFIG = {
  // Primary placement point
  PLACEMENT_LANDMARK: HAND_LANDMARKS.RING_FINGER_MCP,

  // Landmarks for orientation calculation (6-point set)
  POSE_LANDMARKS: [
    HAND_LANDMARKS.RING_FINGER_MCP,   // 13 - Base
    HAND_LANDMARKS.RING_FINGER_PIP,   // 14 - Middle
    HAND_LANDMARKS.RING_FINGER_DIP,   // 15 - Top
    HAND_LANDMARKS.RING_FINGER_TIP,   // 16 - Tip
    HAND_LANDMARKS.MIDDLE_FINGER_MCP, // 9  - Left reference
    HAND_LANDMARKS.PINKY_MCP          // 17 - Right reference
  ],

  // For depth calculation (wrist to ring finger distance)
  DEPTH_REFERENCE: {
    from: HAND_LANDMARKS.WRIST,
    to: HAND_LANDMARKS.RING_FINGER_MCP
  },

  // For occluder axis (base to tip)
  OCCLUDER_AXIS: {
    base: HAND_LANDMARKS.RING_FINGER_MCP,
    tip: HAND_LANDMARKS.RING_FINGER_TIP
  }
};

/**
 * Finger groups for multi-ring support (future use)
 */
export const FINGER_GROUPS = {
  THUMB: [
    HAND_LANDMARKS.THUMB_CMC,
    HAND_LANDMARKS.THUMB_MCP,
    HAND_LANDMARKS.THUMB_IP,
    HAND_LANDMARKS.THUMB_TIP
  ],
  INDEX: [
    HAND_LANDMARKS.INDEX_FINGER_MCP,
    HAND_LANDMARKS.INDEX_FINGER_PIP,
    HAND_LANDMARKS.INDEX_FINGER_DIP,
    HAND_LANDMARKS.INDEX_FINGER_TIP
  ],
  MIDDLE: [
    HAND_LANDMARKS.MIDDLE_FINGER_MCP,
    HAND_LANDMARKS.MIDDLE_FINGER_PIP,
    HAND_LANDMARKS.MIDDLE_FINGER_DIP,
    HAND_LANDMARKS.MIDDLE_FINGER_TIP
  ],
  RING: [
    HAND_LANDMARKS.RING_FINGER_MCP,
    HAND_LANDMARKS.RING_FINGER_PIP,
    HAND_LANDMARKS.RING_FINGER_DIP,
    HAND_LANDMARKS.RING_FINGER_TIP
  ],
  PINKY: [
    HAND_LANDMARKS.PINKY_MCP,
    HAND_LANDMARKS.PINKY_PIP,
    HAND_LANDMARKS.PINKY_DIP,
    HAND_LANDMARKS.PINKY_TIP
  ]
};
