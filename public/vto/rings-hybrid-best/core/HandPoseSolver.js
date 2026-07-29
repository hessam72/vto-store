/**
 * Hand Pose Solver
 *
 * Converts MediaPipe hand landmarks into a metric Three.js pose.
 *
 * The old approach mapped normalized coords onto an arbitrary "frustum plane"
 * at a tunable distance, which coupled depth to world scale: pushing the ring
 * back to fix depth shrank it, enlarging it to compensate broke the fit. There
 * was no set of numbers that was simultaneously correct.
 *
 * This solver has no such coupling because it uses a real pinhole camera model:
 *
 *   1. f_px = (videoHeight / 2) / tan(vFOV / 2)          camera intrinsics
 *   2. Z    = f_px * L_perp / L_px                        metric depth, from
 *                                                         worldLandmarks (metres)
 *   3. X    = (px - cx) * Z / f_px,  Y = -(py - cy) * Z / f_px
 *
 * Step 2 compares the image-plane component of a world-space segment against
 * its observed pixel length, which cancels foreshortening: a finger tilted
 * toward the camera no longer reads as "further away".
 *
 * A useful property falls out of this: on-screen size is f_px * S / Z, where S
 * comes from worldLandmarks (independent of f_px) and Z is proportional to
 * f_px — so f_px cancels. Screen position and apparent size stay correct even
 * if the assumed vFOV is wrong; only the reported absolute depth shifts. That
 * is why vFOV is a documented constant here rather than a knob to hunt with.
 *
 * Everything is in metres. Camera sits at the origin looking down -Z.
 */

import * as THREE from 'three';

export const HAND = {
  WRIST: 0,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17
};

// Segments used to estimate depth. Each is measured both in world space
// (metres) and in image space (pixels); the ratio gives Z. Several are used
// and the median taken, so one badly-tracked landmark cannot dominate.
const DEPTH_REFERENCE_PAIRS = [
  [HAND.INDEX_MCP, HAND.PINKY_MCP],
  [HAND.WRIST, HAND.INDEX_MCP],
  [HAND.WRIST, HAND.PINKY_MCP],
  [HAND.WRIST, HAND.MIDDLE_MCP]
];

const MIN_DEPTH_M = 0.08;
const MAX_DEPTH_M = 2.5;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Solve a 3x3 symmetric system by Cramer's rule. Small and fixed-size, so the
 * determinant is cheap and there is no need for a general linear solver.
 * @returns {number[]|null} [x, y, z], or null if the system is singular.
 */
function solve3x3Symmetric(a00, a01, a02, a11, a12, a22, b0, b1, b2) {
  const c00 = a11 * a22 - a12 * a12;
  const c01 = a02 * a12 - a01 * a22;
  const c02 = a01 * a12 - a02 * a11;

  const det = a00 * c00 + a01 * c01 + a02 * c02;
  if (Math.abs(det) < 1e-12) return null;

  const c11 = a00 * a22 - a02 * a02;
  const c12 = a02 * a01 - a00 * a12;
  const c22 = a00 * a11 - a01 * a01;

  return [
    (c00 * b0 + c01 * b1 + c02 * b2) / det,
    (c01 * b0 + c11 * b1 + c12 * b2) / det,
    (c02 * b0 + c12 * b1 + c22 * b2) / det
  ];
}

export class HandPoseSolver {
  /**
   * @param {Object} options
   * @param {number} options.vFOV - Assumed vertical field of view of the webcam, in degrees.
   * @param {boolean} options.mirror - True when the video is displayed mirrored (selfie view).
   * @param {number} options.fingerWidthCoeff - Calibration for finger width from the MCP row.
   * @param {number} options.anchorAlongPhalanx - 0 = at the MCP joint, 1 = at the PIP joint.
   * @param {boolean} options.flipHandedness - Correct MediaPipe's mirror assumption if it disagrees.
   */
  constructor(options = {}) {
    this.options = {
      vFOV: 60,
      mirror: true,
      fingerWidthCoeff: 0.72,
      anchorAlongPhalanx: 0.45,
      flipHandedness: false,
      ...options
    };

    // Scratch objects — the solver runs every frame, so nothing is allocated here.
    this._world = Array.from({ length: 21 }, () => new THREE.Vector3());
    this._fingerAxis = new THREE.Vector3();
    this._palmNormal = new THREE.Vector3();
    this._sideAxis = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._position = new THREE.Vector3();
  }

  setOptions(partial) {
    Object.assign(this.options, partial);
  }

  /**
   * Focal length in pixels, expressed in the video's own pixel grid.
   * @param {number} videoHeight
   */
  focalLengthPx(videoHeight) {
    const vFOVRad = THREE.MathUtils.degToRad(this.options.vFOV);
    return (videoHeight / 2) / Math.tan(vFOVRad / 2);
  }

  /**
   * Configure a Three.js camera so its projection matches the physical webcam
   * over the region of the video that is actually visible on screen.
   *
   * The video is displayed with `object-fit: cover`, so one axis is cropped.
   * The visible half-height in video pixels is (videoHeight * sy / 2), and the
   * crop is symmetric about the principal point, so the render camera's
   * vertical FOV follows directly from the same f_px used for the solve.
   *
   * Call this BEFORE solve() each frame — the old code applied FOV changes
   * after the pose was computed, so the two disagreed by a frame.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {{videoWidth:number, videoHeight:number, canvasWidth:number, canvasHeight:number}} view
   */
  updateCamera(camera, view) {
    const { videoWidth, videoHeight, canvasWidth, canvasHeight } = view;
    if (!videoWidth || !videoHeight || !canvasWidth || !canvasHeight) return;

    const fPx = this.focalLengthPx(videoHeight);
    const { sy } = this.coverScale(view);

    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((videoHeight * sy / 2) / fPx));
    camera.aspect = canvasWidth / canvasHeight;
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
    camera.updateProjectionMatrix();
  }

  /**
   * Fraction of the video that remains visible on each axis under `object-fit: cover`.
   */
  coverScale({ videoWidth, videoHeight, canvasWidth, canvasHeight }) {
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    return videoAspect > canvasAspect
      ? { sx: canvasAspect / videoAspect, sy: 1 }   // cropped left/right
      : { sx: 1, sy: videoAspect / canvasAspect };  // cropped top/bottom
  }

  /**
   * Solve the ring pose for the first detected hand.
   *
   * @param {Object} results - MediaPipe HandLandmarkerResult.
   * @param {{videoWidth:number, videoHeight:number, canvasWidth:number, canvasHeight:number}} view
   * @returns {Object|null} { position, quaternion, fingerAxis, palmNormal, fingerWidth, depth, handedness }
   *                        or null when there is nothing usable to solve.
   */
  solve(results, view) {
    const landmarks = results?.landmarks?.[0];
    const worldLandmarks = results?.worldLandmarks?.[0];
    if (!landmarks || !worldLandmarks || landmarks.length < 21) return null;

    const { videoWidth, videoHeight } = view;
    if (!videoWidth || !videoHeight) return null;

    const fPx = this.focalLengthPx(videoHeight);
    const mirrorSign = this.options.mirror ? -1 : 1;

    // MediaPipe world space is X-right, Y-down, Z-toward-the-camera-negative.
    // Three.js is X-right, Y-up, Z-toward-the-viewer. Note the mirror is NOT
    // applied here: mirroring the basis vectors would turn the rotation matrix
    // into a reflection (det = -1) and setFromRotationMatrix would return
    // garbage. It is applied to the finished quaternion instead.
    for (let i = 0; i < 21; i++) {
      const w = worldLandmarks[i];
      this._world[i].set(w.x, -w.y, -w.z);
    }

    const depth = this.solveDepth(landmarks, worldLandmarks, fPx, videoWidth, videoHeight);
    if (depth === null) return null;

    const handedness = this.resolveHandedness(results);

    // The ring sits on the proximal phalanx, between the MCP and PIP joints.
    const t = this.options.anchorAlongPhalanx;
    const mcp = landmarks[HAND.RING_MCP];
    const pip = landmarks[HAND.RING_PIP];
    const anchorU = THREE.MathUtils.lerp(mcp.x, pip.x, t);
    const anchorV = THREE.MathUtils.lerp(mcp.y, pip.y, t);

    // worldLandmarks are centred on the hand, so a landmark's own world z is
    // its offset from the hand centre along the view axis.
    const anchorWorldZ = THREE.MathUtils.lerp(
      worldLandmarks[HAND.RING_MCP].z,
      worldLandmarks[HAND.RING_PIP].z,
      t
    );
    const anchorDepth = THREE.MathUtils.clamp(depth + anchorWorldZ, MIN_DEPTH_M, MAX_DEPTH_M);

    // Pinhole back-projection. Camera at the origin looking down -Z, so a point
    // in front of the camera has a negative Z.
    const px = anchorU * videoWidth;
    const py = anchorV * videoHeight;
    this._position.set(
      mirrorSign * (px - videoWidth / 2) * anchorDepth / fPx,
      -(py - videoHeight / 2) * anchorDepth / fPx,
      -anchorDepth
    );

    const quaternion = this.solveOrientation(handedness, mirrorSign);
    const fingerWidth = this.solveFingerWidth();

    return {
      position: this._position,
      quaternion,
      fingerAxis: this._fingerAxis,
      palmNormal: this._palmNormal,
      fingerWidth,
      depth: anchorDepth,
      handedness
    };
  }

  /**
   * Metric depth of the hand centre, in metres.
   *
   * For each reference segment, the world-space x/y components give the length
   * the segment would project to if it were at unit depth; comparing that with
   * the observed pixel length yields Z. Because the world landmarks already
   * encode the segment's 3D orientation, this is foreshortening-free.
   */
  solveDepth(landmarks, worldLandmarks, fPx, videoWidth, videoHeight) {
    const initial = this.estimateDepthWeakPerspective(
      landmarks, worldLandmarks, fPx, videoWidth, videoHeight
    );
    if (initial === null) return null;

    const refined = this.refineDepth(
      landmarks, worldLandmarks, fPx, videoWidth, videoHeight, initial
    );

    return refined ?? initial;
  }

  /**
   * First estimate, assuming both ends of a segment sit at the same depth.
   *
   * Several segments are used and the median taken, so one badly-tracked
   * landmark cannot dominate. Good to a few percent when the hand faces the
   * camera; refineDepth() removes the rest.
   */
  estimateDepthWeakPerspective(landmarks, worldLandmarks, fPx, videoWidth, videoHeight) {
    const estimates = [];

    for (const [a, b] of DEPTH_REFERENCE_PAIRS) {
      const wa = worldLandmarks[a];
      const wb = worldLandmarks[b];
      const la = landmarks[a];
      const lb = landmarks[b];

      // Image-plane component of the segment, in metres.
      const lPerp = Math.hypot(wb.x - wa.x, wb.y - wa.y);
      // Observed length, in video pixels.
      const lPx = Math.hypot((lb.x - la.x) * videoWidth, (lb.y - la.y) * videoHeight);

      // A segment pointing almost straight at the camera carries no scale
      // information — skip it rather than let it produce a wild estimate.
      if (lPx < 4 || lPerp < 0.005) continue;

      // Depth of the segment's midpoint, then corrected back to the hand centre
      // (world z is the offset from that centre, larger = further away).
      const zMidpoint = fPx * lPerp / lPx;
      const zCentre = zMidpoint - (wa.z + wb.z) / 2;

      if (zCentre > MIN_DEPTH_M && zCentre < MAX_DEPTH_M) estimates.push(zCentre);
    }

    return median(estimates);
  }

  /**
   * Refine the hand-centre translation by minimizing reprojection error over
   * all 21 landmarks — pose estimation with known 3D points and known
   * intrinsics, i.e. the translation half of PnP (the rotation is already given
   * by worldLandmarks).
   *
   * This matters because the weak-perspective estimate above treats a segment's
   * two ends as being at the same depth. When the hand tilts toward the camera
   * they are not, and the error is real: a 50° tilt reads ~8% too close. Each
   * landmark projects as
   *
   *   u = cx + f * (X + wx) / (Z + wz)
   *
   * so a few Gauss-Newton steps on (X, Y, Z) resolve it exactly. Converges in
   * two or three iterations from the weak-perspective seed.
   *
   * @returns {number|null} Refined hand-centre depth, or null if it diverged.
   */
  refineDepth(landmarks, worldLandmarks, fPx, videoWidth, videoHeight, initialDepth) {
    const cx = videoWidth / 2;
    const cy = videoHeight / 2;

    // Seed the lateral translation from the observed centroid at the seed depth.
    let X = 0;
    let Y = 0;
    let Z = initialDepth;
    {
      let uSum = 0;
      let vSum = 0;
      for (let i = 0; i < 21; i++) {
        uSum += landmarks[i].x * videoWidth - cx;
        vSum += landmarks[i].y * videoHeight - cy;
      }
      X = (uSum / 21) * Z / fPx;
      Y = (vSum / 21) * Z / fPx;
    }

    for (let iteration = 0; iteration < 6; iteration++) {
      // Normal equations for the 3x3 symmetric system JᵀJ · d = -Jᵀr.
      let h00 = 0, h01 = 0, h02 = 0, h11 = 0, h12 = 0, h22 = 0;
      let g0 = 0, g1 = 0, g2 = 0;

      for (let i = 0; i < 21; i++) {
        const w = worldLandmarks[i];
        const depth = Z + w.z;
        if (depth < MIN_DEPTH_M) return null;

        const inv = fPx / depth;
        const px = (X + w.x) * inv;
        const py = (Y + w.y) * inv;

        const ru = px - (landmarks[i].x * videoWidth - cx);
        const rv = py - (landmarks[i].y * videoHeight - cy);

        // ∂u/∂X = f/depth,  ∂u/∂Z = -f(X+wx)/depth²  (and likewise for v)
        const duX = inv;
        const duZ = -px / depth;
        const dvY = inv;
        const dvZ = -py / depth;

        h00 += duX * duX;
        h02 += duX * duZ;
        h11 += dvY * dvY;
        h12 += dvY * dvZ;
        h22 += duZ * duZ + dvZ * dvZ;

        g0 += duX * ru;
        g1 += dvY * rv;
        g2 += duZ * ru + dvZ * rv;
      }

      // h01 stays zero: u does not depend on Y, nor v on X.
      const delta = solve3x3Symmetric(h00, h01, h02, h11, h12, h22, -g0, -g1, -g2);
      if (!delta) return null;

      X += delta[0];
      Y += delta[1];
      Z += delta[2];

      if (!Number.isFinite(Z) || Z < MIN_DEPTH_M || Z > MAX_DEPTH_M) return null;
      if (Math.abs(delta[2]) < 1e-5) break;
    }

    return Z;
  }

  /**
   * Orthonormal basis on the ring finger, built from world landmarks only.
   *
   * Y is the finger axis (the ring's hole points along it), Z is the palm
   * normal, X completes the frame. The basis is re-orthogonalized because the
   * finger axis and the palm normal are not exactly perpendicular in practice.
   */
  solveOrientation(handedness, mirrorSign) {
    const W = this._world;

    this._fingerAxis.subVectors(W[HAND.RING_PIP], W[HAND.RING_MCP]);
    if (this._fingerAxis.lengthSq() < 1e-10) {
      this._fingerAxis.set(0, 1, 0);
    } else {
      this._fingerAxis.normalize();
    }

    this._a.subVectors(W[HAND.INDEX_MCP], W[HAND.WRIST]);
    this._b.subVectors(W[HAND.PINKY_MCP], W[HAND.WRIST]);
    this._palmNormal.crossVectors(this._a, this._b);
    if (this._palmNormal.lengthSq() < 1e-10) {
      this._palmNormal.set(0, 0, 1);
    } else {
      this._palmNormal.normalize();
    }

    // The index→pinky sweep runs the opposite way on the two hands, so the
    // cross product flips. Without this the ring would sit rotated 180° about
    // the finger on one hand.
    if (handedness === 'Left') this._palmNormal.negate();

    this._sideAxis.crossVectors(this._fingerAxis, this._palmNormal).normalize();
    this._palmNormal.crossVectors(this._sideAxis, this._fingerAxis).normalize();

    this._basis.makeBasis(this._sideAxis, this._fingerAxis, this._palmNormal);
    this._quaternion.setFromRotationMatrix(this._basis);

    // Mirror the finished rotation about the YZ plane. Conjugating by
    // diag(-1, 1, 1) negates the y and z quaternion components.
    if (mirrorSign < 0) {
      this._quaternion.set(
        this._quaternion.x,
        -this._quaternion.y,
        -this._quaternion.z,
        this._quaternion.w
      );
      this._fingerAxis.x *= -1;
      this._palmNormal.x *= -1;
    }

    return this._quaternion;
  }

  /**
   * Finger width in metres, measured from the hand itself rather than assumed.
   * The MCP row spans three inter-finger gaps, so a gap is roughly a finger
   * width; fingerWidthCoeff calibrates that approximation.
   */
  solveFingerWidth() {
    const span = this._world[HAND.INDEX_MCP].distanceTo(this._world[HAND.PINKY_MCP]);
    return (span / 3) * this.options.fingerWidthCoeff;
  }

  /**
   * MediaPipe labels handedness assuming a mirrored (selfie) input image, which
   * does not always match how the frames are actually fed in. flipHandedness
   * corrects that without touching any of the geometry.
   */
  resolveHandedness(results) {
    // `handednesses` is the deprecated spelling; `handedness` is current.
    const category = results.handedness?.[0]?.[0] ?? results.handednesses?.[0]?.[0];
    const name = category?.categoryName;
    if (!name) return 'unknown';
    if (!this.options.flipHandedness) return name;
    return name === 'Left' ? 'Right' : 'Left';
  }
}
