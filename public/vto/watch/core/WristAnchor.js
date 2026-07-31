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
 * WHICH metacarpals define palmCentre matters, and it is not obvious. The four
 * rays are not anatomically equivalent:
 *
 *   2nd (index, LM5)  trapezoid CMC  rigid, <2°
 *   3rd (middle, LM9) capitate CMC   rigid, <2°
 *   4th (ring, LM13)  hamate CMC     mobile, ~15°
 *   5th (pinky, LM17) hamate CMC     mobile, ~25-30°
 *
 * Palm cupping as a fist closes IS the motion of the mobile ulnar rays. Averaging
 * all four therefore drags palmCentre ulnar-and-proximal as the hand shuts, which
 * rotates the axis and tilts the product — the bug where the bracelet swings when
 * the hand opens and closes with the forearm perfectly still.
 *
 * But the two rigid rays alone are not a drop-in replacement: they sit on the
 * RADIAL side of the hand, so their midpoint is about one inter-ray spacing
 * thumb-ward of the hand's true central axis, and the anchor slides off the arm.
 * The fix is to keep only rigid inputs and put the centre back where it belongs
 * with an anatomical constant, expressed in units of the index->middle span so it
 * scales with hand size:
 *
 *   ulnar      = MIDDLE_MCP - INDEX_MCP
 *   palmCentre = mean(INDEX_MCP, MIDDLE_MCP) + ulnarBiasCoeff * ulnar
 *
 * At ulnarBiasCoeff = 1 this reproduces the four-ray centroid on a resting hand
 * to well under a millimetre, while being immune to cupping by construction.
 * `axisRays: 'mcpRow'` restores the old rule so the two can be compared rather
 * than argued about.
 *
 * The axis has a single source — forearmAxis() — so a MediaPipe Pose Landmarker
 * elbow->wrist vector can replace it later without touching anything else.
 *
 * That later is now: setExternalAxis() accepts a true forearm direction (see
 * ../../shared/vto-core/PoseTracker.js) and forearmAxis() blends toward it,
 * which removes the flexion tilt entirely because a real elbow->wrist vector
 * does not care how the wrist is bent. The hand-derived rule above is kept as
 * the fallback for every frame pose cannot supply — pose is throttled, and it
 * drops out whenever the elbow leaves the shot — and with `axisBlend: 0` or no
 * external axis the behaviour is bit-for-bit what it was before.
 */

import * as THREE from 'three';
import { HAND, MIN_DEPTH_M, MAX_DEPTH_M } from '../../shared/vto-core/HandSolver.js';
import { Vector3Filter } from '../../shared/vto-core/OneEuroFilter.js';

/** The old rule: every metacarpal head, two of them mobile. */
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
      // 'radial'  — rigid 2nd/3rd metacarpals plus the ulnar bias below.
      // 'mcpRow'  — the old four-ray centroid, kept for comparison only.
      axisRays: 'radial',
      // Multiples of the index->middle span, shifting the rigid midpoint back
      // onto the hand's central axis. 1.0 matches the four-ray centroid at rest.
      ulnarBiasCoeff: 1.0,
      // Dedicated smoothing for the axis DIRECTION, applied before the basis is
      // built. The positioner's single quaternion filter cannot separate tilt
      // from roll: damping enough to kill articulation twitch would also make
      // the watch face lag pronation, which is the DOF the hand tracks well.
      // Filtering here damps only the tilt. A forearm rotates slowly, so a low
      // cutoff costs nothing real.
      axisSmoothing: true,
      axisMinCutoff: 0.6,
      axisBeta: 0.05,
      // How far to trust an external (Pose Landmarker) forearm axis when one is
      // available: 1 uses it outright, 0 ignores it and reproduces the
      // hand-only behaviour exactly. Scaled by the confidence the supplier
      // reports, so this is a ceiling rather than a fixed mix.
      axisBlend: 1.0,
      // Frames of raw wrist span to take the median of. The span feeds both the
      // fitted size and the occluder, and a single frame of landmark noise
      // makes both breathe. A median leaves the average untouched, so it does
      // not disturb wristWidthCoeff's calibration — 1 disables it.
      widthMedianFrames: 5,
      ...options
    };

    this._axisFilter = new Vector3Filter(this.options.axisMinCutoff, this.options.axisBeta);
    this._primary = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._palmCentre = new THREE.Vector3();
    this._ulnar = new THREE.Vector3();
    this._position = new THREE.Vector3();

    // External axis, supplied per frame and consumed by forearmAxis().
    this._externalAxis = new THREE.Vector3();
    this._externalWeight = 0;

    // The hand-derived axis, kept unblended so the divergence between the two
    // can be reported. That angle IS the flexion error the hand-only approach
    // makes, measured live on a real arm instead of on a synthetic hand.
    this._handAxis = new THREE.Vector3();
    this.axisDivergenceDeg = null;

    this._widthHistory = [];
  }

  /** Copies only keys this anchor owns, so the shared debug params can be passed wholesale. */
  setOptions(partial) {
    for (const key of Object.keys(this.options)) {
      if (partial[key] !== undefined) this.options[key] = partial[key];
    }
    this._axisFilter.setParams(this.options.axisMinCutoff, this.options.axisBeta);
  }

  reset() {
    this._axisFilter.reset();
    // Both of these are per-limb. Carrying either across a hand change would
    // blend one arm's forearm direction, or one wrist's width, into the other.
    this.clearExternalAxis();
    this._widthHistory.length = 0;
  }

  /**
   * Supply a true forearm direction for this frame, in the same unmirrored
   * world space HandSolver uses, pointing wrist -> elbow.
   *
   * @param {THREE.Vector3} axis - Need not be normalized.
   * @param {number} weight - Supplier's confidence in [0, 1].
   */
  setExternalAxis(axis, weight = 1) {
    if (!axis || axis.lengthSq() < 1e-10 || !(weight > 0)) {
      this.clearExternalAxis();
      return;
    }
    this._externalAxis.copy(axis).normalize();
    this._externalWeight = THREE.MathUtils.clamp(weight, 0, 1);
  }

  clearExternalAxis() {
    this._externalWeight = 0;
  }

  /**
   * @param {Object} frame - Result of HandSolver.prepare().
   * @param {HandSolver} solver
   * @param {number} [timestampMs] - Monotonic frame time, for the axis filter.
   * @returns {Object} { position, quaternion, primaryAxis, normal, width, thickness, depth, handedness }
   */
  solve(frame, solver, timestampMs) {
    const { landmarks, worldLandmarks, world, handedness, mirrorSign } = frame;

    // Depth of the wrist landmark itself. worldLandmarks are centred on the
    // hand, so a landmark's own world z is its offset from that centre.
    const wristDepth = THREE.MathUtils.clamp(
      frame.depth + worldLandmarks[HAND.WRIST].z, MIN_DEPTH_M, MAX_DEPTH_M
    );

    // Y runs up the arm. Built before the position, because buildBasis() mirrors
    // the axes in place and the offset must be applied in the mirrored frame.
    this.forearmAxis(world, this._primary);

    // Damp the direction, not the whole pose. Normalized first so the filter
    // sees a pure direction and its speed term stays in comparable units.
    if (this.options.axisSmoothing && timestampMs !== undefined) {
      this._primary.normalize();
      this._primary.copy(this._axisFilter.filter(this._primary, timestampMs));
    }

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
      handedness,
      // null when no external axis was available this frame — which is itself
      // the useful signal that the fallback is in use.
      axisDivergenceDeg: this.axisDivergenceDeg
    };
  }

  /**
   * Direction up the forearm, in unmirrored world space.
   *
   * Single source for the axis: swap this for a Pose Landmarker elbow->wrist
   * vector and everything else keeps working.
   */
  forearmAxis(world, target = this._primary) {
    this.palmCentre(world, this._palmCentre);
    target.subVectors(world[HAND.WRIST], this._palmCentre);
    if (target.lengthSq() < 1e-10) target.set(0, 1, 0);
    target.normalize();

    this._handAxis.copy(target);
    this.axisDivergenceDeg = null;

    const weight = this._externalWeight * THREE.MathUtils.clamp(this.options.axisBlend, 0, 1);
    if (weight <= 0) return target;

    // Report the disagreement before resolving it. With the external axis
    // trusted this is the error the hand-only rule would have made.
    const dot = THREE.MathUtils.clamp(this._handAxis.dot(this._externalAxis), -1, 1);
    this.axisDivergenceDeg = THREE.MathUtils.radToDeg(Math.acos(dot));

    // Near-antiparallel means one of the two is simply wrong, and interpolating
    // would pass through a zero-length vector on the way. The hand rule is the
    // one that can invert (a badly-tracked palm centre crossing the wrist), so
    // the external axis wins outright rather than being averaged with nonsense.
    if (dot < -0.9) return target.copy(this._externalAxis);

    // Normalized lerp: for two unit vectors this follows the arc closely enough
    // at these angles, and unlike slerp it needs no quaternion and degenerates
    // gracefully. weight 0 leaves the hand axis exactly, weight 1 gives the
    // external axis exactly.
    return target.lerp(this._externalAxis, weight).normalize();
  }

  /**
   * The point on the palm the forearm axis is measured from. See the header for
   * why this is not simply the centroid of the metacarpal heads.
   */
  palmCentre(world, target = this._palmCentre) {
    if (this.options.axisRays === 'mcpRow') {
      target.set(0, 0, 0);
      for (const index of MCP_ROW) target.add(world[index]);
      return target.multiplyScalar(1 / MCP_ROW.length);
    }

    const index = world[HAND.INDEX_MCP];
    const middle = world[HAND.MIDDLE_MCP];
    this._ulnar.subVectors(middle, index);
    return target
      .copy(index)
      .add(middle)
      .multiplyScalar(0.5)
      .addScaledVector(this._ulnar, this.options.ulnarBiasCoeff);
  }

  /**
   * Wrist breadth in metres, measured from the hand rather than assumed.
   *
   * The raw span is taken over a short median window. It feeds the fitted size
   * and the occluder every frame, so per-frame landmark noise shows up directly
   * as the product and its occluder breathing. A median is the right filter
   * here rather than a low-pass: it rejects the odd bad frame outright and
   * leaves the central value alone, so `wristWidthCoeff`'s on-camera
   * calibration keeps meaning exactly what it meant before.
   */
  wristWidth(world) {
    const span = world[HAND.INDEX_MCP].distanceTo(world[HAND.PINKY_MCP]);
    return this.medianSpan(span) * this.options.wristWidthCoeff;
  }

  /** Median of the last `widthMedianFrames` raw spans, in metres. */
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
