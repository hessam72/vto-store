/**
 * Ring anchor — the finger anatomy, and nothing else.
 *
 * Everything geometric (camera model, metric depth, back-projection, basis
 * construction, mirroring) lives in the shared HandSolver. This file only
 * answers three product questions: where on the hand, which way up, how big.
 */

import * as THREE from 'three';
import { HAND, MIN_DEPTH_M, MAX_DEPTH_M } from '../../shared/vto-core/HandSolver.js';

export class RingAnchor {
  constructor(options = {}) {
    this.options = {
      // Where the ring sits along the proximal phalanx: 0 = MCP joint (knuckle),
      // 1 = PIP joint. A worn ring sits just above the knuckle.
      anchorAlongPhalanx: 0.45,
      // The index→pinky MCP row spans three inter-finger gaps, so a gap is
      // roughly a finger width; this calibrates that approximation.
      fingerWidthCoeff: 0.72,
      ...options
    };

    this._primary = new THREE.Vector3();
    this._normal = new THREE.Vector3();
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
    const t = this.options.anchorAlongPhalanx;

    // Anchor between the MCP and PIP joints, on the proximal phalanx.
    const mcp = landmarks[HAND.RING_MCP];
    const pip = landmarks[HAND.RING_PIP];
    const anchorU = THREE.MathUtils.lerp(mcp.x, pip.x, t);
    const anchorV = THREE.MathUtils.lerp(mcp.y, pip.y, t);

    // worldLandmarks are centred on the hand, so a landmark's own world z is its
    // offset from the hand centre along the view axis.
    const anchorWorldZ = THREE.MathUtils.lerp(
      worldLandmarks[HAND.RING_MCP].z,
      worldLandmarks[HAND.RING_PIP].z,
      t
    );
    const anchorDepth = THREE.MathUtils.clamp(
      frame.depth + anchorWorldZ, MIN_DEPTH_M, MAX_DEPTH_M
    );

    // Y runs along the finger — the ring's bore axis.
    this._primary.subVectors(world[HAND.RING_PIP], world[HAND.RING_MCP]);
    this._normal.copy(solver.palmNormal(handedness));

    const quaternion = solver.buildBasis(this._primary, this._normal, mirrorSign);
    solver.backProject(anchorU, anchorV, anchorDepth, frame, this._position);

    const width = this.fingerWidth(world);

    return {
      position: this._position,
      quaternion,
      primaryAxis: this._primary,
      normal: this._normal,
      width,
      thickness: width,   // a finger is near enough circular in section
      depth: anchorDepth,
      handedness
    };
  }

  /** Finger width in metres, measured from the hand rather than assumed. */
  fingerWidth(world) {
    const span = world[HAND.INDEX_MCP].distanceTo(world[HAND.PINKY_MCP]);
    return (span / 3) * this.options.fingerWidthCoeff;
  }
}
