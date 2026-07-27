/**
 * Coordinate Conversion Utilities
 * Converts MediaPipe normalized coordinates to Three.js world space
 * Based on proven Codrops implementation
 */

export class CoordinateConverter {
  /**
   * Convert MediaPipe normalized landmark to pixel coordinates
   * MediaPipe: x,y in [0, 1], z is relative depth
   * @param {Object} landmark - {x, y, z}
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Object} - {x, y, z} in pixels
   */
  static normalizedToPixel(landmark, width, height) {
    return {
      x: landmark.x * width,
      y: landmark.y * height,
      z: landmark.z * width  // Scale depth by width
    };
  }

  /**
   * Convert MediaPipe normalized coordinates to Three.js position
   * Normalized coords are [0,1] camera-relative, unlike world coords (hand-relative)
   * @param {Object} landmark - {x, y, z} MediaPipe normalized landmark
   * @param {number} scale - Scene scale multiplier (default 1 for AR overlay)
   * @returns {THREE.Vector3}
   */
  static normalizedToThreeJS(landmark, scale = 1) {
    return new THREE.Vector3(
      (-landmark.x + 0.5) * scale,  // Center and invert X
      (-landmark.y + 0.5) * scale,  // Center and invert Y
      -landmark.z * scale           // Negate Z (depth)
    );
  }

  /**
   * Convert MediaPipe world landmarks (in meters) to Three.js
   * World landmarks are already in 3D, centered at hand geometric center
   * @param {Object} worldLandmark - {x, y, z} in meters
   * @param {number} scale - Convert meters to scene units (1-2 works for AR overlay)
   * @returns {THREE.Vector3}
   */
  static worldToThreeJS(worldLandmark, scale = 1.5) {
    return new THREE.Vector3(
      worldLandmark.x * scale,
      -worldLandmark.y * scale,  // Invert Y for Three.js
      -worldLandmark.z * scale   // Invert Z for Three.js
    );
  }

  /**
   * Calculate depth (Z-axis) from 2D distance between landmarks
   * Used when MediaPipe's Z value is unreliable
   * @param {Object} landmarkA - {x, y, z}
   * @param {Object} landmarkB - {x, y, z}
   * @param {number} minDepth - Minimum depth value
   * @param {number} maxDepth - Maximum depth value
   * @returns {number} - Calculated depth
   */
  static calculateDepthFrom2D(landmarkA, landmarkB, minDepth = -2, maxDepth = 4) {
    const distance2D = Math.sqrt(
      Math.pow(landmarkB.x - landmarkA.x, 2) +
      Math.pow(landmarkB.y - landmarkA.y, 2)
    );

    // Map distance to depth range
    // Larger distance = hand closer to camera = more negative Z
    const depthZ = THREE.MathUtils.mapLinear(
      distance2D,
      0,    // Min distance (hand far)
      0.3,  // Max distance (hand close)
      maxDepth,  // Far depth
      minDepth   // Near depth
    );

    return THREE.MathUtils.clamp(depthZ, minDepth, maxDepth);
  }

  /**
   * Calculate finger orientation from landmarks
   * @param {Array} landmarks - Array of {x, y, z} for finger
   * @param {number} baseIdx - Index of base landmark
   * @param {number} tipIdx - Index of tip landmark
   * @returns {THREE.Quaternion}
   */
  static calculateFingerRotation(landmarks, baseIdx, tipIdx) {
    const base = this.normalizedToThreeJS(landmarks[baseIdx]);
    const tip = this.normalizedToThreeJS(landmarks[tipIdx]);

    // Direction vector from base to tip
    const direction = new THREE.Vector3().subVectors(tip, base).normalize();

    // Default finger direction (pointing up along Y axis)
    const defaultDir = new THREE.Vector3(0, 1, 0);

    // Calculate rotation quaternion
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(defaultDir, direction);

    return quaternion;
  }

  /**
   * Convert normalized [0,1] to centered [-1, 1] for WebGL
   * @param {Object} landmark - {x, y, z}
   * @returns {Object}
   */
  static normalizedToClip(landmark) {
    return {
      x: (landmark.x * 2) - 1,
      y: -((landmark.y * 2) - 1),  // Flip Y axis
      z: landmark.z
    };
  }

  /**
   * Calculate distance between two landmarks
   * @param {Object} landmarkA - {x, y, z}
   * @param {Object} landmarkB - {x, y, z}
   * @param {boolean} use3D - Include Z in distance calculation
   * @returns {number}
   */
  static landmarkDistance(landmarkA, landmarkB, use3D = false) {
    const dx = landmarkB.x - landmarkA.x;
    const dy = landmarkB.y - landmarkA.y;

    if (use3D) {
      const dz = landmarkB.z - landmarkA.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Estimate ring size from finger width
   * Measures distance between adjacent MCP joints
   * @param {Array} landmarks - All 21 hand landmarks
   * @param {number} fingerMCP - MCP index of target finger
   * @param {number} leftMCP - MCP index of left adjacent finger
   * @param {number} rightMCP - MCP index of right adjacent finger
   * @returns {number} - Estimated ring radius scale factor
   */
  static estimateRingSize(landmarks, fingerMCP, leftMCP, rightMCP) {
    const finger = landmarks[fingerMCP];
    const left = landmarks[leftMCP];
    const right = landmarks[rightMCP];

    // Average distance to adjacent fingers
    const distLeft = this.landmarkDistance(finger, left);
    const distRight = this.landmarkDistance(finger, right);
    const avgDistance = (distLeft + distRight) / 2;

    // Map to ring scale (0.8 - 1.2 range)
    return THREE.MathUtils.mapLinear(avgDistance, 0.05, 0.15, 0.8, 1.2);
  }
}
