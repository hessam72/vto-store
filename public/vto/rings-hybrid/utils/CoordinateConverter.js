/**
 * Coordinate Conversion Utilities
 * Converts MediaPipe normalized coordinates to Three.js world space
 * Enhanced with wrist-specific positioning for watch try-on
 */

import * as THREE from 'three';

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
   * Convert wrist landmark to Three.js position with surface offset
   * Calculates proper position for watch to sit ON wrist surface
   * @param {Array} landmarks - All 21 hand landmarks
   * @param {number} scale - Scene scale multiplier
   * @returns {THREE.Vector3}
   */
  static wristToThreeJS(landmarks, scale = 5.0) {
    const wrist = landmarks[0];

    // Calculate palm center from finger bases
    const fingerBases = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    const palmCenter = {
      x: fingerBases.reduce((sum, lm) => sum + lm.x, 0) / 4,
      y: fingerBases.reduce((sum, lm) => sum + lm.y, 0) / 4,
      z: fingerBases.reduce((sum, lm) => sum + lm.z, 0) / 4
    };

    // Get base wrist position
    const wristPos = this.normalizedToThreeJS(wrist, scale);
    const palmPos = this.normalizedToThreeJS(palmCenter, scale);

    // Calculate vector from palm to wrist (points toward camera)
    const toCamera = new THREE.Vector3()
      .subVectors(wristPos, palmPos)
      .normalize()
      .multiplyScalar(0.005 * scale);  // 5mm offset scaled

    // Add offset to push watch toward camera (sit ON wrist, not IN it)
    return wristPos.clone().add(toCamera);
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
}
