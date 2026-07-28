/**
 * Ring Positioner
 * Calculates ring position and rotation from MediaPipe hand landmarks
 */

import { CoordinateConverter } from '../utils/CoordinateConverter.js';
import * as THREE from 'three';

export class RingPositioner {
  constructor(config) {
    this.config = config;

    // Smoothing filters
    this.positionFilter = {
      current: new THREE.Vector3(),
      target: new THREE.Vector3(),
      alpha: config.smoothing.position.alpha
    };

    this.rotationFilter = {
      current: new THREE.Quaternion(),
      target: new THREE.Quaternion(),
      alpha: config.smoothing.rotation.alpha
    };

    // Confidence tracking
    this.confidenceFrames = 0;
    this.isStable = false;

    // Previous hand state
    this.lastHandedness = null;
  }

  /**
   * Calculate ring position and rotation from MediaPipe landmarks
   * @param {Object} results - MediaPipe hand detection results
   * @param {number} videoWidth - Video width in pixels
   * @param {number} videoHeight - Video height in pixels
   * @returns {Object} {position: Vector3, rotation: Quaternion, visible: boolean}
   */
  calculate(results, videoWidth, videoHeight) {
    // No hand detected
    if (!results.landmarks || results.landmarks.length === 0) {
      this.confidenceFrames = Math.max(0, this.confidenceFrames - 1);
      if (this.confidenceFrames === 0) {
        this.isStable = false;
      }
      return { visible: false };
    }

    // Get first hand
    const landmarks = results.landmarks[0];
    const handedness = results.handednesses?.[0]?.[0];

    // Check handedness change (reset filters)
    if (this.lastHandedness !== handedness?.categoryName) {
      this.resetFilters();
      this.lastHandedness = handedness?.categoryName;
    }

    // Confidence hysteresis
    const confidence = handedness?.score || 0;
    if (confidence >= this.config.smoothing.confidence.threshold) {
      this.confidenceFrames = Math.min(
        this.config.smoothing.confidence.hysteresisFrames,
        this.confidenceFrames + 1
      );
    } else {
      this.confidenceFrames = Math.max(0, this.confidenceFrames - 1);
    }

    this.isStable = this.confidenceFrames >= this.config.smoothing.confidence.hysteresisFrames;

    if (!this.isStable) {
      return { visible: false };
    }

    // Extract ring finger landmarks
    const ringMCP = landmarks[this.config.landmarks.ringMCP];   // Base (13)
    const ringPIP = landmarks[this.config.landmarks.ringPIP];   // Middle (14)
    const ringDIP = landmarks[this.config.landmarks.ringDIP];   // Top (15)
    const ringTIP = landmarks[this.config.landmarks.ringTIP];   // Tip (16)

    // Calculate base position (ring MCP joint)
    const basePosition = CoordinateConverter.normalizedToThreeJS(
      ringMCP,
      100 // scale factor
    );

    // Calculate finger orientation vector (MCP → TIP)
    const fingerStart = new THREE.Vector3(
      ringMCP.x * videoWidth,
      ringMCP.y * videoHeight,
      ringMCP.z * videoWidth
    );
    const fingerEnd = new THREE.Vector3(
      ringTIP.x * videoWidth,
      ringTIP.y * videoHeight,
      ringTIP.z * videoWidth
    );
    const fingerVector = new THREE.Vector3().subVectors(fingerEnd, fingerStart).normalize();

    // Calculate rotation quaternion from finger orientation
    const targetRotation = this.calculateRotationFromVector(fingerVector);

    // Apply model offset (from config - proven values)
    const offset = new THREE.Vector3(
      this.config.modelOffset[0],
      this.config.modelOffset[1],
      this.config.modelOffset[2]
    );

    // Transform offset by current rotation
    offset.applyQuaternion(targetRotation);

    const targetPosition = basePosition.clone().add(offset);

    // Apply smoothing
    if (this.config.smoothing.position.enabled) {
      this.positionFilter.target.copy(targetPosition);
      this.positionFilter.current.lerp(
        this.positionFilter.target,
        this.positionFilter.alpha
      );
    } else {
      this.positionFilter.current.copy(targetPosition);
    }

    if (this.config.smoothing.rotation.enabled) {
      this.rotationFilter.target.copy(targetRotation);
      this.rotationFilter.current.slerp(
        this.rotationFilter.target,
        this.rotationFilter.alpha
      );
    } else {
      this.rotationFilter.current.copy(targetRotation);
    }

    // Apply model quaternion (from config)
    const modelQuat = new THREE.Quaternion(
      this.config.modelQuaternion[0],
      this.config.modelQuaternion[1],
      this.config.modelQuaternion[2],
      this.config.modelQuaternion[3]
    );

    const finalRotation = this.rotationFilter.current.clone().multiply(modelQuat);

    if (this.config.debug.logPositions) {
      console.log('Ring Position:', this.positionFilter.current);
      console.log('Ring Rotation:', finalRotation);
    }

    return {
      visible: true,
      position: this.positionFilter.current.clone(),
      rotation: finalRotation,
      handedness: handedness?.categoryName || 'unknown'
    };
  }

  /**
   * Calculate rotation quaternion from finger direction vector
   * @param {THREE.Vector3} fingerVector - Normalized finger direction
   * @returns {THREE.Quaternion}
   */
  calculateRotationFromVector(fingerVector) {
    // Default up vector (Y-axis)
    const upVector = new THREE.Vector3(0, 1, 0);

    // Calculate rotation to align Y-axis with finger direction
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(upVector, fingerVector);

    return quaternion;
  }

  /**
   * Reset smoothing filters
   */
  resetFilters() {
    this.positionFilter.current.set(0, 0, 0);
    this.positionFilter.target.set(0, 0, 0);
    this.rotationFilter.current.set(0, 0, 0, 1);
    this.rotationFilter.target.set(0, 0, 0, 1);
    this.confidenceFrames = 0;
    this.isStable = false;
  }

  /**
   * Get current ring transform
   */
  getCurrentTransform() {
    return {
      position: this.positionFilter.current.clone(),
      rotation: this.rotationFilter.current.clone()
    };
  }
}
