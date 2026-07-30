/**
 * Neck anchor — torso anatomy for necklaces and pendants.
 *
 * The problem this exists to solve: a necklace has to follow the TORSO, and a
 * face tracker cannot see one. The previous implementation solved a 6-point PnP
 * on neck landmarks and then damped the result — `rotYFactor: 0.3`,
 * `rotZFactor: 0.5` — so the necklace kept only 30% of body yaw and 50% of body
 * lean and appeared to stay facing the camera. The damping was not arbitrary:
 * three of those six points sit behind or under the neck and are never visible
 * to a front camera, so yaw and roll came out of an ill-conditioned solve and
 * had to be suppressed to stop them flipping.
 *
 * The shoulder line fixes the conditioning rather than hiding it:
 *
 *   across = shoulderRight - shoulderLeft
 *
 * Both endpoints are always visible at head-and-shoulders framing, the baseline
 * is the widest on the upper body, and this one vector already carries BOTH
 * missing degrees of freedom — its vertical component is body roll, its depth
 * component is body yaw. Nothing needs damping because nothing is guessed.
 *
 * A third vector is still needed to fix rotation about `across` itself. The
 * textbook choice is shoulder-centre -> hip-centre, but at bust framing the hips
 * are out of shot and MediaPipe extrapolates them, so `upSource` selects:
 *
 *   'worldUp' (default) - world up, projected perpendicular to `across`.
 *                         Keeps roll and yaw exactly, ignores torso pitch. Also
 *                         the physically honest choice: a chain hangs under
 *                         gravity, so it does not pitch with the chest anyway.
 *   'head'              - shoulder centre -> ear midpoint. Adds pitch, at the
 *                         cost of head movement bleeding into the necklace.
 *   'hips'              - the textbook vector, used only when the hips are
 *                         genuinely visible.
 *
 * In every case the source is Gram-Schmidt'd perpendicular to `across`, so a
 * bad up-vector can never corrupt the two DOFs that actually matter.
 *
 * Whatever `upSource` says, `across` is measured and `up` is derived — never
 * the other way round.
 */

import * as THREE from 'three';
import { MIN_DEPTH_M, MAX_DEPTH_M } from '../../shared/vto-core/HandSolver.js';
import { POSE } from '../../shared/vto-core/PoseLandmarkerTracker.js';
import { Vector3Filter } from '../../shared/vto-core/OneEuroFilter.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class NeckAnchor {
  constructor(options = {}) {
    this.options = {
      // Where the necklace sits relative to the shoulder line: down the chest
      // from it, and standing off the body so it rests on the chest rather than
      // inside it.
      anchorDropMm: 45,
      chestStandoffMm: 20,

      // Neck breadth as a fraction of biacromial (shoulder-to-shoulder) breadth.
      // Adult biacromial averages ~39cm against a ~12cm neck, so ~0.32 is the
      // anatomical starting point. Calibrate on camera like wristWidthCoeff.
      neckWidthCoeff: 0.32,
      // The neck is elliptical, not round — depth as a fraction of breadth.
      neckDepthRatio: 0.78,

      // 'worldUp' | 'head' | 'hips'. See the header.
      upSource: 'worldUp',
      // Hips are only trusted above this visibility; below it 'hips' silently
      // behaves as 'worldUp' rather than following an extrapolated pelvis.
      hipVisibility: 0.7,
      // Both shoulders must be at least this visible or the frame is refused.
      // Everything here is built on them, so a guessed shoulder is not a pose
      // worth showing.
      shoulderVisibility: 0.5,

      // Dedicated smoothing on the shoulder DIRECTION, before the basis is
      // built. Pose Landmarker jitters (its z more than its x/y, and z is
      // exactly what carries yaw), and the legacy `smoothLandmarks` option no
      // longer exists in tasks-vision. The positioner's quaternion filter alone
      // cannot damp that without also making the necklace lag a real turn. A
      // torso rotates slowly, so a low cutoff costs nothing.
      axisSmoothing: true,
      axisMinCutoff: 0.5,
      axisBeta: 0.04,

      // Median window on the raw shoulder span. It drives both the fitted size
      // and the occluder, so single-frame noise shows up as both breathing. A
      // median leaves the average alone, so neckWidthCoeff keeps its meaning.
      widthMedianFrames: 5,
      ...options
    };

    this._axisFilter = new Vector3Filter(this.options.axisMinCutoff, this.options.axisBeta);

    this._across = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._position = new THREE.Vector3();
    this._shoulderMid = new THREE.Vector3();
    this._scratch = new THREE.Vector3();

    this._widthHistory = [];
  }

  /** Copies only keys this anchor owns, so the whole debug bag can be passed. */
  setOptions(partial) {
    for (const key of Object.keys(this.options)) {
      if (partial[key] !== undefined) this.options[key] = partial[key];
    }
    this._axisFilter.setParams(this.options.axisMinCutoff, this.options.axisBeta);
  }

  reset() {
    this._axisFilter.reset();
    this._widthHistory.length = 0;
  }

  /**
   * @param {Object} frame - Result of HandSolver.prepare() over pose landmarks.
   * @param {HandSolver} solver
   * @param {number} [timestampMs]
   * @returns {Object|null} The standard anchor pose, or null when the shoulders
   *   are not visible enough to build a torso frame from.
   */
  solve(frame, solver, timestampMs) {
    const { landmarks, worldLandmarks, world, mirrorSign } = frame;

    const leftShoulder = landmarks[POSE.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE.RIGHT_SHOULDER];
    if (!leftShoulder || !rightShoulder) return null;

    const shoulderVisibility = Math.min(
      leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1
    );
    if (shoulderVisibility < this.options.shoulderVisibility) return null;

    // Pose world landmarks are centred on the HIP MIDPOINT, not on the tracked
    // part, so frame.depth is the depth of the hips. The shoulders sit at their
    // own z offset from that — the same correction WristAnchor makes for the
    // wrist crease, and it matters more here because at bust framing the hips
    // are extrapolated rather than seen.
    const shoulderZ = (
      worldLandmarks[POSE.LEFT_SHOULDER].z + worldLandmarks[POSE.RIGHT_SHOULDER].z
    ) / 2;
    const shoulderDepth = THREE.MathUtils.clamp(
      frame.depth + shoulderZ, MIN_DEPTH_M, MAX_DEPTH_M
    );

    // THE measurement. Everything else is derived from it.
    this._across.subVectors(world[POSE.RIGHT_SHOULDER], world[POSE.LEFT_SHOULDER]);
    if (this._across.lengthSq() < 1e-10) return null;
    this._across.normalize();

    // Damp the direction, not the whole pose, and do it before the basis is
    // built so the smoothing acts on one clean vector rather than on a
    // quaternion that has already mixed the axes together.
    if (this.options.axisSmoothing && timestampMs !== undefined) {
      this._across.copy(this._axisFilter.filter(this._across, timestampMs)).normalize();
    }

    this.torsoUp(world, landmarks, this._up);

    // Chest facing direction, inheriting the yaw and roll `across` measured.
    //
    // The operand order is load-bearing. For a user facing the camera, their
    // LEFT shoulder appears on the viewer's right, so `across` (left -> right)
    // points along -X. `up x across` then gives +Z, out of the chest toward the
    // camera. The other order gives -Z and the pendant faces into the body.
    this._normal.crossVectors(this._up, this._across);
    if (this._normal.lengthSq() < 1e-10) return null;
    this._normal.normalize();

    // +Y is the bore (what the head goes through), +Z the chest normal.
    // buildBasis re-orthogonalizes and applies the mirror to the quaternion.
    const quaternion = solver.buildBasis(this._up, this._normal, mirrorSign);

    // Back-project the shoulder midpoint, then walk down the chest and out from
    // it in the mirrored frame. Metric offsets, so they mean the same thing at
    // any distance or body angle.
    solver.backProject(
      (leftShoulder.x + rightShoulder.x) / 2,
      (leftShoulder.y + rightShoulder.y) / 2,
      shoulderDepth, frame, this._position
    );
    this._position
      .addScaledVector(this._up, -this.options.anchorDropMm * 0.001)
      .addScaledVector(this._normal, this.options.chestStandoffMm * 0.001);

    const width = this.neckWidth(world);

    return {
      position: this._position,
      quaternion,
      primaryAxis: this._up,
      normal: this._normal,
      width,
      thickness: width * this.options.neckDepthRatio,
      depth: -this._position.z,
      // Pose results carry no handedness; the positioner uses this only as a
      // filter-reset key, and a constant simply means it never resets on it.
      handedness: 'torso',
      shoulderVisibility
    };
  }

  /**
   * Torso up-vector, always perpendicular to `across`.
   *
   * The Gram-Schmidt is the whole safety property: whichever source is chosen,
   * and however wrong it is, it can only rotate the basis ABOUT the shoulder
   * line. Body roll and yaw are carried by `across` and are untouchable here.
   */
  torsoUp(world, landmarks, target) {
    const source = this.options.upSource;
    let reference = WORLD_UP;

    if (source === 'hips') {
      const leftHip = landmarks[POSE.LEFT_HIP];
      const rightHip = landmarks[POSE.RIGHT_HIP];
      const visibility = Math.min(leftHip?.visibility ?? 0, rightHip?.visibility ?? 0);
      // Below the threshold the hips are extrapolated, not seen. Falling back to
      // world up is better than pointing at an invented pelvis.
      if (visibility >= this.options.hipVisibility) {
        this._shoulderMid
          .addVectors(world[POSE.LEFT_SHOULDER], world[POSE.RIGHT_SHOULDER])
          .multiplyScalar(0.5);
        this._scratch
          .addVectors(world[POSE.LEFT_HIP], world[POSE.RIGHT_HIP])
          .multiplyScalar(0.5);
        // Hips -> shoulders, i.e. up the spine.
        reference = this._scratch.subVectors(this._shoulderMid, this._scratch);
      }
    } else if (source === 'head') {
      this._shoulderMid
        .addVectors(world[POSE.LEFT_SHOULDER], world[POSE.RIGHT_SHOULDER])
        .multiplyScalar(0.5);
      // Ears rather than the nose: they sit closer to the neck axis and move
      // far less when the user looks up or down.
      this._scratch
        .addVectors(world[POSE.LEFT_EAR], world[POSE.RIGHT_EAR])
        .multiplyScalar(0.5);
      reference = this._scratch.sub(this._shoulderMid);
    }

    // Remove the component along `across`, leaving the part of the reference
    // that is genuinely perpendicular to the shoulder line.
    const projection = reference.dot(this._across);
    target.copy(reference).addScaledVector(this._across, -projection);

    // Reference parallel to the shoulder line carries no information about the
    // remaining DOF; anything perpendicular will do.
    if (target.lengthSq() < 1e-10) {
      target.set(0, 1, 0).addScaledVector(this._across, -this._across.y);
      if (target.lengthSq() < 1e-10) target.set(0, 0, 1).cross(this._across);
    }
    return target.normalize();
  }

  /** Neck breadth in metres, measured from the shoulders rather than assumed. */
  neckWidth(world) {
    const span = world[POSE.LEFT_SHOULDER].distanceTo(world[POSE.RIGHT_SHOULDER]);
    return this.medianSpan(span) * this.options.neckWidthCoeff;
  }

  /** Median of the last `widthMedianFrames` raw shoulder spans, in metres. */
  medianSpan(span) {
    const window = Math.max(1, Math.round(this.options.widthMedianFrames));
    if (window === 1) return span;

    this._widthHistory.push(span);
    while (this._widthHistory.length > window) this._widthHistory.shift();

    const sorted = [...this._widthHistory].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
