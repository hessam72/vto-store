/**
 * Wrist anchor — forearm anatomy for watches and bracelets.
 *
 * Harder than the finger for one reason: **MediaPipe has no forearm landmark.**
 * Landmark 0 sits at the wrist crease at the base of the palm, and there is
 * nothing beyond it. A watch sits 30-40mm further up the forearm, a bracelet
 * 10-25mm, so both the anchor point and the axis are extrapolated off the end of
 * the tracked skeleton:
 *
 *   palmCentre  = mean(MCP row)
 *   forearmAxis = normalize(W[0] - palmCentre)     palm -> wrist, up the arm
 *   anchor      = W[0] + forearmAxis * offsetMm
 *
 * That extrapolation is exact only when the wrist is straight. Of the wrist's
 * three degrees of freedom, two corrupt it:
 *
 *   - flexion/extension (±70°)  -> axis tilts off the true forearm
 *   - radial/ulnar deviation (±20°) -> same, smaller
 *   - pronation/supination      -> HARMLESS
 *
 * The third is harmless because pronation rotates the radius over the ulna and
 * the hand rides the radius, so the palm normal reports roll about the arm
 * faithfully however the wrist is bent. Roll is what decides which way the watch
 * face points, i.e. the thing a user notices most, so the failure mode is a tilt
 * rather than a spin. See the README for measured error against flexion angle.
 *
 * The axis has a single source — forearmAxis() — so a MediaPipe Pose Landmarker
 * elbow->wrist vector can replace it later without touching anything else.
 */

import * as THREE from 'three';
import { HAND, MIN_DEPTH_M, MAX_DEPTH_M } from '../../shared/vto-core/HandSolver.js';

const MCP_ROW = [HAND.INDEX_MCP, HAND.MIDDLE_MCP, HAND.RING_MCP, HAND.PINKY_MCP];

export class WristAnchor {
  constructor(options = {}) {
    this.options = {
      // How far up the forearm from the wrist crease, in millimetres.
      anchorOffsetMm: 35,
      // Wrist breadth as a fraction of the index->pinky MCP span. Adult palm
      // breadth at the knuckles averages ~79mm against a ~55mm wrist breadth,
      // so ~0.70 is the right starting point.
      wristWidthCoeff: 0.70,
      // The wrist is elliptical, not round — depth as a fraction of breadth.
      wristDepthRatio: 0.72,
      ...options
    };

    this._primary = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._palmCentre = new THREE.Vector3();
    this._position = new THREE.Vector3();
  }

  /** Copies only keys this anchor owns, so the shared debug params can be passed wholesale. */
  setOptions(partial) {
    for (const key of Object.keys(this.options)) {
      if (partial[key] !== undefined) this.options[key] = partial[key];
    }
  }

  /**
   * @param {Object} frame - Result of HandSolver.prepare().
   * @param {HandSolver} solver
   * @returns {Object} { position, quaternion, primaryAxis, normal, width, thickness, depth, handedness }
   */
  solve(frame, solver) {
    const { landmarks, worldLandmarks, world, handedness, mirrorSign } = frame;

    // Depth of the wrist landmark itself. worldLandmarks are centred on the
    // hand, so a landmark's own world z is its offset from that centre.
    const wristDepth = THREE.MathUtils.clamp(
      frame.depth + worldLandmarks[HAND.WRIST].z, MIN_DEPTH_M, MAX_DEPTH_M
    );

    // Y runs up the arm. Built before the position, because buildBasis() mirrors
    // the axes in place and the offset must be applied in the mirrored frame.
    this.forearmAxis(world, this._primary);

    // The watch face points out of the BACK of the wrist, so the normal is the
    // palm normal negated.
    this._normal.copy(solver.palmNormal(handedness)).negate();

    const quaternion = solver.buildBasis(this._primary, this._normal, mirrorSign);

    // Back-project the wrist crease, then walk up the (now mirrored) forearm
    // axis. Extrapolating in metric space rather than in image space keeps the
    // offset a true distance along the arm at any depth or viewing angle.
    solver.backProject(
      landmarks[HAND.WRIST].x, landmarks[HAND.WRIST].y, wristDepth, frame, this._position
    );
    this._position.addScaledVector(this._primary, this.options.anchorOffsetMm * 0.001);

    const width = this.wristWidth(world);

    return {
      position: this._position,
      quaternion,
      primaryAxis: this._primary,
      normal: this._normal,
      width,
      thickness: width * this.options.wristDepthRatio,
      // Report the depth the product is actually at, not the wrist crease's.
      depth: -this._position.z,
      handedness
    };
  }

  /**
   * Direction up the forearm, in unmirrored world space.
   *
   * Single source for the axis: swap this for a Pose Landmarker elbow->wrist
   * vector and everything else keeps working.
   */
  forearmAxis(world, target = this._primary) {
    this._palmCentre.set(0, 0, 0);
    for (const index of MCP_ROW) this._palmCentre.add(world[index]);
    this._palmCentre.multiplyScalar(1 / MCP_ROW.length);

    target.subVectors(world[HAND.WRIST], this._palmCentre);
    if (target.lengthSq() < 1e-10) target.set(0, 1, 0);
    return target;
  }

  /** Wrist breadth in metres, measured from the hand rather than assumed. */
  wristWidth(world) {
    const span = world[HAND.INDEX_MCP].distanceTo(world[HAND.PINKY_MCP]);
    return span * this.options.wristWidthCoeff;
  }
}
