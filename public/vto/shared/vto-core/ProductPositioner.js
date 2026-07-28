/**
 * Product Positioner — solve, offset, smooth, gate.
 *
 * Product-agnostic: the anatomy comes from the injected anchor (RingAnchor,
 * WristAnchor, ...), so this file is the same for every product.
 *
 * Offsets are in millimetres in the product's local frame:
 *   X across the body part, Y along it, Z out of the skin.
 * They are applied in that frame, so they mean the same thing at any orientation
 * or distance.
 */

import * as THREE from 'three';
import { HandSolver } from './HandSolver.js';
import { Vector3Filter, QuaternionFilter } from './OneEuroFilter.js';

const OFFSET_AXIS_INDEX = { X: 0, Y: 1, Z: 2 };
const UNIT_Y = new THREE.Vector3(0, 1, 0);

export class ProductPositioner {
  /**
   * @param {Object} config - The product config (see any app's config.js).
   * @param {Object} anchor - Supplies the anatomy; must implement solve(frame, solver)
   *                          and setOptions(partial).
   */
  constructor(config, anchor) {
    this.config = config;
    this.anchor = anchor;
    this.debugParams = null; // Set by DebugPanel

    this.solver = new HandSolver({
      vFOV: config.camera.vFOV,
      mirror: config.camera.mirror,
      flipHandedness: config.camera.flipHandedness
    });

    const { position, rotation } = config.smoothing;
    this.positionFilter = new Vector3Filter(position.minCutoff, position.beta);
    this.rotationFilter = new QuaternionFilter(rotation.minCutoff, rotation.beta);

    // Detection hysteresis, so a single dropped frame does not blink the product.
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
   * @returns {Object} { visible, position, rotation, width, thickness, depth, ... }
   */
  calculate(results, view, timestampMs) {
    this.syncDebugParams();

    const frame = this.solver.prepare(results, view);
    const pose = frame ? this.anchor.solve(frame, this.solver) : null;

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

    // Fine offset, in millimetres, expressed in the product's local frame.
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

    // Roll about the primary axis — which way round the product sits. The GLB's
    // own orientation is corrected once at load by VTOScene.applyBoreAxis(), so
    // local Y is already the primary axis by the time this is applied.
    const rollDeg = this.debugParams?.rollDeg ?? this.config.product.rollDeg;
    this._modelQuat.setFromAxisAngle(UNIT_Y, THREE.MathUtils.degToRad(rollDeg));
    this._finalQuat.copy(smoothedRotation).multiply(this._modelQuat);

    return {
      visible: true,
      position: this._smoothedPosition,
      rotation: this._finalQuat,
      // Not rotated by the roll — the occluder follows the body part, not the GLB.
      bodyRotation: smoothedRotation,
      primaryAxis: pose.primaryAxis,
      normal: pose.normal,
      width: pose.width,
      thickness: pose.thickness,
      depth: pose.depth,
      handedness: pose.handedness
    };
  }

  offsetParam(axis) {
    const fromDebug = this.debugParams?.[`offset${axis}Mm`];
    if (fromDebug !== undefined) return fromDebug;
    return this.config.product.offsetMm[OFFSET_AXIS_INDEX[axis]];
  }

  /**
   * Push live debug values into the solver, anchor and filters. Runs before the
   * solve so a parameter change takes effect on the same frame it is made.
   */
  syncDebugParams() {
    if (!this.debugParams) return;
    const p = this.debugParams;

    this.solver.setOptions({
      vFOV: p.vFOV,
      mirror: p.mirror,
      flipHandedness: p.flipHandedness
    });
    this.anchor.setOptions(p);

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
