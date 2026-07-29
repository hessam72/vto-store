/**
 * Gesture Detector Configuration
 *
 * Fist-to-Palm gesture detection for product swapping
 */

export const GestureConfig = {
  // MediaPipe GestureRecognizer settings
  mediaPipe: {
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.7,
    minTrackingConfidence: 0.7,
    facingMode: 'user',
    videoWidth: 1280,
    videoHeight: 720,
    // Pinned version to match WASM fileset
    version: '0.10.35'
  },

  // Gesture recognition thresholds
  gesture: {
    // Minimum confidence for gesture classification (0.0 - 1.0)
    minConfidence: 0.7,

    // Lower confidence threshold for Open_Palm detection (easier to trigger)
    minPalmConfidence: 0.4,

    // Time window for Fist → Palm sequence (milliseconds)
    fistToPalmTimeoutMs: 3000,

    // Cooldown period after swap to prevent double-trigger (milliseconds)
    cooldownMs: 1000,

    // Screen division for directional swaps
    // Hand in left half = previous, right half = next
    screenDivisionRatio: 0.5
  },

  // Product carousel settings
  products: {
    // Sample products for demo
    items: [
      { id: 1, name: 'محصول ۱', image: '💍', color: '#FFD700' },
      { id: 2, name: 'محصول ۲', image: '⌚', color: '#C0C0C0' },
      { id: 3, name: 'محصول ۳', image: '📿', color: '#CD7F32' },
      { id: 4, name: 'محصول ۴', image: '👑', color: '#FFD700' },
      { id: 5, name: 'محصول ۵', image: '💎', color: '#B9F2FF' }
    ],
    initialIndex: 0
  },

  // Debug panel settings
  debug: {
    enabled: true,
    showLandmarks: false,
    showGestureInfo: true,
    showTimer: true,
    showStateMachine: true,
    panelPosition: 'top-left' // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
  }
};
