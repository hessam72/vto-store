/**
 * Glasses anchor — face anatomy for eyewear.
 *
 * Returns the same pose shape as WristAnchor and NeckAnchor, so the shared
 * positioner and smoothing run unchanged. Inputs come from
 * FaceLandmarkerTracker: 478 observed landmarks, the canonical face rotated into
 * camera orientation as `worldLandmarks`, and the rotation itself.
 *
 * Orientation is the face's rotation, used as-is. MediaPipe fits it with
 * weighted Procrustes over its rigid landmark set, so it is already the
 * orientation of the skull rather than of any one feature, and it carries
 * pitch, yaw and roll together — which a frame, rigidly seated on the nose and
 * ears, follows exactly.
 *
 * Position follows the repo's rule for every product: depth from the metric
 * solve, screen position from observed pixels. The anchor — the lens centre on
 * the lens plane — is not itself a landmark, so each of several rigid landmarks
 * votes for it: its own pixel back-projected at its own depth, plus the known
 * canonical offset from that landmark to the anchor, rotated into the camera.
 * Averaging the votes averages out per-landmark pixel noise without letting
 * any one landmark decide.
 *
 * Scale. The canonical face is an average face, so the solve's depth and sizes
 * are right only for an average wearer. The iris fixes that: its visible
 * diameter is 11.7mm with very little spread across adults, which is how
 * MediaPipe Iris estimates metric distance. The ratio between 11.7mm and the
 * iris measured at canonical scale is the wearer's face scale. In `fit` sizing
 * it changes nothing on screen (everything scales together, and the projection
 * does not change); it is what makes `absolute` sizing — a real 140mm frame on
 * a real face — mean something, and it is what makes the PD readout real.
 */

import * as THREE from 'three';
import { MIN_DEPTH_M, MAX_DEPTH_M } from '../../shared/vto-core/HandSolver.js';
import { CANONICAL_FACE_VERTICES } from '../../shared/vto-core/CanonicalFace.js';
import { FACE, RIGHT_IRIS_RING, LEFT_IRIS_RING } from '../../shared/vto-core/FaceLandmarkerTracker.js';

// Rigid landmarks around the eyes and nose bridge that vote for the anchor.
// Close to where the frame sits, so a small rotation error moves each vote
// very little.
const POSITION_VOTERS = [
  FACE.NOSE_BRIDGE, FACE.NOSE_BRIDGE_LOW,
  FACE.RIGHT_EYE_OUTER, FACE.RIGHT_EYE_INNER,
  FACE.LEFT_EYE_OUTER, FACE.LEFT_EYE_INNER
];

// Height of the canonical eye line: the mean of the four eye corners, in cm.
const CANONICAL_EYE_Y_CM = 2.625;

/** Canonical vertex `i` into `target`, in centimetres. */
function canonical(i, target) {
  return target.fromArray(CANONICAL_FACE_VERTICES, i * 3);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class GlassesAnchor {
  constructor(options = {}) {
    this.options = {
      // Lens centre height above the canonical eye line, in mm. Pupils sit at or
      // slightly above the optical centre of most frames.
      lensHeightMm: 0,
      // How far the back of the lenses sits in front of the nose bridge
      // (landmark 168). ~2mm puts the lenses 13-14mm in front of the cornea,
      // the usual vertex distance.
      lensStandoffMm: 2,

      // Face scale from the iris. Off, the wearer is treated as the canonical
      // (average) face: `fit` sizing looks identical, `absolute` sizing loses
      // its meaning.
      irisScale: true,
      irisDiameterMm: 11.7,
      // Only sample the iris when the head faces the camera: a turned eye
      // foreshortens it.
      irisMaxAngleDeg: 25,
      irisWindow: 60,
      irisMinSamples: 8,
      // A face 25% off the canonical one is a measurement error, not a face.
      minFaceScale: 0.75,
      maxFaceScale: 1.25,
      ...options
    };

    this._rotation = new THREE.Matrix4();
    this._up = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._position = new THREE.Vector3();
    this._vote = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._anchorCm = new THREE.Vector3();

    this._irisSamples = [];
    this.faceScale = 1;
  }

  /** Copies only keys this anchor owns, so the whole debug bag can be passed. */
  setOptions(partial) {
    for (const key of Object.keys(this.options)) {
      if (partial[key] !== undefined) this.options[key] = partial[key];
    }
  }

  /**
   * The face scale is the one piece of state that belongs to a person, not a
   * frame. It survives dropped frames, but a camera switch may show someone
   * else, so the bootstrap's filter reset clears it.
   */
  reset() {
    this._irisSamples.length = 0;
    this.faceScale = 1;
  }

  /** The anchor in canonical face coordinates (cm): lens centre, on the lens plane. */
  anchorCm(target = this._anchorCm) {
    const bridge = canonical(FACE.NOSE_BRIDGE, this._c);
    return target.set(
      0,
      CANONICAL_EYE_Y_CM + this.options.lensHeightMm * 0.1,
      bridge.z + this.options.lensStandoffMm * 0.1
    );
  }

  /**
   * @param {Object} frame - Result of HandSolver.prepare() over face landmarks.
   * @param {HandSolver} solver
   * @returns {Object|null} The standard anchor pose.
   */
  solve(frame, solver) {
    const rotation = frame.results?.faceRotation;
    if (!rotation) return null;
    this._rotation.copy(rotation);

    const { landmarks, worldLandmarks, mirrorSign } = frame;
    const anchor = this.anchorCm();

    // Unmirrored axes of the face, for the angle gate below; buildBasis()
    // mirrors them in place afterwards.
    this._up.set(0, 1, 0).applyMatrix4(this._rotation);
    this._forward.set(0, 0, 1).applyMatrix4(this._rotation);
    const yawDeg = THREE.MathUtils.radToDeg(Math.atan2(this._forward.x, this._forward.z));
    const pitchDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(this._forward.y, -1, 1)));

    this.updateFaceScale(frame, yawDeg, pitchDeg);
    const scale = this.faceScale;

    // +Y up the face, +Z out of it — the canonical frame, which is the frame
    // the glasses model is normalized into.
    const quaternion = solver.buildBasis(this._up, this._forward, mirrorSign);

    // Every voter's estimate of where the anchor is, at canonical scale.
    this._position.set(0, 0, 0);
    for (const i of POSITION_VOTERS) {
      const depth = THREE.MathUtils.clamp(
        frame.depth + worldLandmarks[i].z, MIN_DEPTH_M, MAX_DEPTH_M
      );
      solver.backProject(landmarks[i].x, landmarks[i].y, depth, frame, this._vote);

      this._offset.subVectors(anchor, canonical(i, this._c))
        .applyMatrix4(this._rotation)
        .multiplyScalar(0.01);
      this._offset.x *= mirrorSign;

      this._position.add(this._vote.add(this._offset));
    }
    this._position.multiplyScalar(1 / POSITION_VOTERS.length);

    // Everything above is at canonical size. Scaling about the camera centre
    // moves the anchor along its own ray, so it stays on the same pixel —
    // only the metric depth and sizes change.
    this._position.multiplyScalar(scale);

    // Face breadth at the temples, at eye height: what a frame is fitted to.
    const width = frame.world[FACE.RIGHT_TEMPLE].distanceTo(frame.world[FACE.LEFT_TEMPLE]) * scale;

    return {
      position: this._position,
      quaternion,
      primaryAxis: this._up,
      normal: this._forward,
      width,
      thickness: width,
      depth: -this._position.z,
      // No handedness on a face; a constant never triggers the filter reset.
      handedness: 'face',
      diagnostics: {
        faceScale: scale,
        irisCalibrated: this._irisSamples.length >= this.options.irisMinSamples,
        pdMm: this.pupillaryDistanceCm() * 10 * scale,
        yawDeg,
        pitchDeg,
        anchorCm: anchor
      }
    };
  }

  /** Canonical distance between the eye centres, in cm (63.1 — the adult average). */
  pupillaryDistanceCm() {
    if (this._pdCm) return this._pdCm;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const centre = (outer, inner) => canonical(outer, a).add(canonical(inner, b)).multiplyScalar(0.5).clone();
    this._pdCm = centre(FACE.RIGHT_EYE_OUTER, FACE.RIGHT_EYE_INNER)
      .distanceTo(centre(FACE.LEFT_EYE_OUTER, FACE.LEFT_EYE_INNER));
    return this._pdCm;
  }

  /**
   * One iris sample per usable frame; the scale is their median, so a blink or
   * a bad detection cannot move it.
   */
  updateFaceScale(frame, yawDeg, pitchDeg) {
    const o = this.options;
    if (!o.irisScale) {
      this.faceScale = 1;
      return;
    }
    if (Math.abs(yawDeg) > o.irisMaxAngleDeg || Math.abs(pitchDeg) > o.irisMaxAngleDeg) return;

    const { landmarks, worldLandmarks, view, fPx } = frame;
    const diameters = [];
    for (const [centre, ring] of [[FACE.RIGHT_IRIS, RIGHT_IRIS_RING], [FACE.LEFT_IRIS, LEFT_IRIS_RING]]) {
      const px = (i) => [landmarks[i].x * view.videoWidth, landmarks[i].y * view.videoHeight];
      const [a, b, c, d] = ring.map(px);
      // The larger of the two diameters: a turn foreshortens the horizontal
      // one, a nod the vertical one, and neither shrinks the other.
      const diameterPx = Math.max(Math.hypot(a[0] - c[0], a[1] - c[1]), Math.hypot(b[0] - d[0], b[1] - d[1]));
      // The tracker seeds the iris world points on the iris plane, so this is
      // the iris's own depth at canonical scale.
      const depth = frame.depth + worldLandmarks[centre].z;
      if (diameterPx > 2 && depth > MIN_DEPTH_M) diameters.push(diameterPx * depth / fPx);
    }
    if (diameters.length === 0) return;

    const measuredM = diameters.reduce((sum, v) => sum + v, 0) / diameters.length;
    const sample = (o.irisDiameterMm * 0.001) / measuredM;
    if (!Number.isFinite(sample)) return;

    this._irisSamples.push(sample);
    while (this._irisSamples.length > o.irisWindow) this._irisSamples.shift();
    if (this._irisSamples.length < o.irisMinSamples) return;

    this.faceScale = THREE.MathUtils.clamp(median(this._irisSamples), o.minFaceScale, o.maxFaceScale);
  }
}
