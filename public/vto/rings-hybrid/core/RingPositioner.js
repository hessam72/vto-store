/**
 * Ring Positioner
 *
 * Thin layer over HandPoseSolver: takes the solved metric pose, applies the
 * ring's own offset/rotation in finger-local space, smooths, and gates on
 * detection stability.
 *
 * All offsets are in millimetres in the finger frame:
 *   X = across the finger, Y = along it (towards the fingertip), Z = out of the palm.
 * They are applied in the finger's local frame, so they stay meaningful no
 * matter how the hand is oriented or how far away it is.
 */

import * as THREE from 'three';
import { HandPoseSolver } from './HandPoseSolver.js';
import { Vector3Filter, QuaternionFilter } from '../utils/OneEuroFilter.js';

const OFFSET_AXIS_INDEX = { X: 0, Y: 1, Z: 2 };

export class RingPositioner {
  constructor(config) {
    this.config = config;
    this.debugParams = null; // Set by DebugPanel

    this.solver = new HandPoseSolver({
      vFOV: config.camera.vFOV,
      mirror: config.camera.mirror,
      fingerWidthCoeff: config.ring.fingerWidthCoeff,
      anchorAlongPhalanx: config.ring.anchorAlongPhalanx,
      flipHandedness: config.camera.flipHandedness
    });

    const { position, rotation } = config.smoothing;
    this.positionFilter = new Vector3Filter(position.minCutoff, position.beta);
    this.rotationFilter = new QuaternionFilter(rotation.minCutoff, rotation.beta);

    // Detection hysteresis, so a single dropped frame does not blink the ring.
    this.confidenceFrames = 0;
    this.isStable = false;
    this.lastHandedness = null;

    this._offset = new THREE.Vector3();
    this._modelQuat = new THREE.Quaternion();
    this._finalQuat = new THREE.Quaternion();
    this._targetPosition = new THREE.Vector3();
    this._targetQuat = new THREE.Quaternion();
    this._smoothedPosition = new THREE.Vector3();
  }

  /**
   * @param {Object} results - MediaPipe HandLandmarkerResult.
   * @param {Object} view - { videoWidth, videoHeight, canvasWidth, canvasHeight }.
   * @param {number} timestampMs - Monotonic frame timestamp, for the filters.
   * @returns {Object} { visible, position, rotation, fingerWidth, depth, ... }
   */
  calculate(results, view, timestampMs) {
    this.syncDebugParams();

    const pose = this.solver.solve(results, view);

    if (!pose) {
      this.confidenceFrames = Math.max(0, this.confidenceFrames - 1);
      if (this.confidenceFrames === 0) this.isStable = false;
      return { visible: false };
    }

    // Reset the filters when the tracked hand changes, otherwise the smoother
    // interpolates across the gap between two different hands.
    if (this.lastHandedness !== pose.handedness) {
      this.resetFilters();
      this.lastHandedness = pose.handedness;
    }

    const { hysteresisFrames } = this.config.smoothing.confidence;
    this.confidenceFrames = Math.min(hysteresisFrames, this.confidenceFrames + 1);
    this.isStable = this.confidenceFrames >= hysteresisFrames;
    if (!this.isStable) return { visible: false };

    // Ring offset, in millimetres, expressed in the finger's local frame.
    this._offset
      .set(this.offsetParam('X'), this.offsetParam('Y'), this.offsetParam('Z'))
      .multiplyScalar(0.001)
      .applyQuaternion(pose.quaternion);

    this._targetPosition.copy(pose.position).add(this._offset);
    this._targetQuat.copy(pose.quaternion);

    const smoothedPosition = this.config.smoothing.position.enabled
      ? this.positionFilter.filter(this._targetPosition, timestampMs)
      : this._targetPosition;
    this._smoothedPosition.copy(smoothedPosition);

    const smoothedRotation = this.config.smoothing.rotation.enabled
      ? this.rotationFilter.filter(this._targetQuat, timestampMs)
      : this._targetQuat;

    // Model-space correction for however the GLB happens to be authored.
    const q = this.config.ring.modelQuaternion;
    this._modelQuat.set(
      this.debugParams?.modelQuatX ?? q[0],
      this.debugParams?.modelQuatY ?? q[1],
      this.debugParams?.modelQuatZ ?? q[2],
      this.debugParams?.modelQuatW ?? q[3]
    ).normalize();

    this._finalQuat.copy(smoothedRotation).multiply(this._modelQuat);

    return {
      visible: true,
      position: this._smoothedPosition,
      rotation: this._finalQuat,
      // Unrotated by the model quaternion — the occluder follows the finger,
      // not the GLB's authoring frame.
      fingerRotation: smoothedRotation,
      fingerAxis: pose.fingerAxis,
      palmNormal: pose.palmNormal,
      fingerWidth: pose.fingerWidth,
      depth: pose.depth,
      handedness: pose.handedness
    };
  }

  offsetParam(axis) {
    const fromDebug = this.debugParams?.[`ringOffset${axis}Mm`];
    if (fromDebug !== undefined) return fromDebug;
    return this.config.ring.offsetMm[OFFSET_AXIS_INDEX[axis]];
  }

  /**
   * Push live debug values into the solver and filters. Runs before the solve
   * so a parameter change takes effect on the same frame it is made.
   */
  syncDebugParams() {
    if (!this.debugParams) return;
    const p = this.debugParams;

    this.solver.setOptions({
      vFOV: p.vFOV,
      mirror: p.mirror,
      fingerWidthCoeff: p.fingerWidthCoeff,
      anchorAlongPhalanx: p.anchorAlongPhalanx,
      flipHandedness: p.flipHandedness
    });

    this.positionFilter.setParams(p.positionMinCutoff, p.positionBeta);
    this.rotationFilter.setParams(p.rotationMinCutoff, p.rotationBeta);
  }

  resetFilters() {
    this.positionFilter.reset();
    this.rotationFilter.reset();
    this.confidenceFrames = 0;
    this.isStable = false;
  }
}
