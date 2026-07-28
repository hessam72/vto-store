/**
 * Hand Solver — product-agnostic half of the MediaPipe → Three.js conversion.
 *
 * Owns the camera model, the metric depth solve and the coordinate plumbing.
 * Knows nothing about rings, watches or bracelets: an *anchor* supplies the
 * anatomy (which landmarks, which axes, what size) and this class supplies the
 * geometry that is identical for every product.
 *
 *   1. f_px = (videoHeight / 2) / tan(vFOV / 2)          camera intrinsics
 *   2. Z    = f_px * L_perp / L_px                        metric depth from
 *                                                         worldLandmarks (metres)
 *   3. X    = (px - cx) * Z / f_px                        pinhole back-projection
 *
 * Step 2 compares the image-plane component of a world-space segment against its
 * observed pixel length, which cancels foreshortening, then refines by
 * Gauss-Newton on reprojection error (see refineDepth).
 *
 * A useful property falls out: on-screen size is f_px * S / Z, where S comes
 * from worldLandmarks (independent of f_px) and Z is proportional to f_px — so
 * f_px cancels. Screen position and apparent size stay correct even if the
 * assumed vFOV is wrong; only the reported absolute depth shifts. That is why
 * vFOV is a documented constant rather than a knob to hunt with.
 *
 * Everything is in metres. Camera sits at the origin looking down -Z.
 *
 * See arch-docs/MEDIAPIPE_VTO_SYSTEM.md for the full derivation.
 */

import * as THREE from 'three';

export const HAND = {
  WRIST: 0,
  THUMB_CMC: 1,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17
};

// Segments used to seed the depth estimate. Each is measured both in world
// space (metres) and in image space (pixels); the ratio gives Z. Several are
// used and the median taken, so one badly-tracked landmark cannot dominate.
const DEPTH_REFERENCE_PAIRS = [
  [HAND.INDEX_MCP, HAND.PINKY_MCP],
  [HAND.WRIST, HAND.INDEX_MCP],
  [HAND.WRIST, HAND.PINKY_MCP],
  [HAND.WRIST, HAND.MIDDLE_MCP]
];

export const MIN_DEPTH_M = 0.08;
export const MAX_DEPTH_M = 2.5;

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

export class HandSolver {
  /**
   * @param {Object} options
   * @param {number} options.vFOV - Assumed vertical field of view of the webcam, in degrees.
   * @param {boolean} options.mirror - True when the video is displayed mirrored (selfie view).
   * @param {boolean} options.flipHandedness - Correct MediaPipe's mirror assumption if it disagrees.
   */
  constructor(options = {}) {
    this.options = {
      vFOV: 60,
      mirror: true,
      flipHandedness: false,
      ...options
    };

    // Scratch objects — the solver runs every frame, so nothing is allocated here.
    this._world = Array.from({ length: 21 }, () => new THREE.Vector3());
    this._primary = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._side = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._position = new THREE.Vector3();
  }

  setOptions(partial) {
    Object.assign(this.options, partial);
  }

  /** Focal length in pixels, in the video's own pixel grid. */
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
   * crop is symmetric about the principal point, so the render camera's vertical
   * FOV follows from the same f_px used for the solve.
   *
   * Call this BEFORE solve() each frame — applying FOV changes afterwards leaves
   * the pose and the projection a frame apart.
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

  /** Fraction of the video still visible on each axis under `object-fit: cover`. */
  coverScale({ videoWidth, videoHeight, canvasWidth, canvasHeight }) {
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    return videoAspect > canvasAspect
      ? { sx: canvasAspect / videoAspect, sy: 1 }   // cropped left/right
      : { sx: 1, sy: videoAspect / canvasAspect };  // cropped top/bottom
  }

  /**
   * Per-frame context shared by every product: converted world landmarks, metric
   * depth of the hand centre, handedness and the camera constants.
   *
   * @returns {Object|null} null when there is nothing usable to solve.
   */
  prepare(results, view) {
    const landmarks = results?.landmarks?.[0];
    const worldLandmarks = results?.worldLandmarks?.[0];
    if (!landmarks || !worldLandmarks || landmarks.length < 21) return null;

    const { videoWidth, videoHeight } = view;
    if (!videoWidth || !videoHeight) return null;

    const fPx = this.focalLengthPx(videoHeight);

    // MediaPipe world space is X-right, Y-down, Z-toward-the-camera-negative.
    // Three.js is X-right, Y-up, Z-toward-the-viewer. The mirror is NOT applied
    // here: mirroring basis vectors would turn the rotation matrix into a
    // reflection (det = -1) and setFromRotationMatrix would return garbage. It
    // is applied to the finished quaternion instead, in buildBasis().
    for (let i = 0; i < 21; i++) {
      const w = worldLandmarks[i];
      this._world[i].set(w.x, -w.y, -w.z);
    }

    const depth = this.solveDepth(landmarks, worldLandmarks, fPx, videoWidth, videoHeight);
    if (depth === null) return null;

    return {
      landmarks,
      worldLandmarks,
      world: this._world,
      depth,
      fPx,
      view,
      mirrorSign: this.options.mirror ? -1 : 1,
      handedness: this.resolveHandedness(results)
    };
  }

  /**
   * Pinhole back-projection of a normalized image point at a given metric depth.
   * Camera at the origin looking down -Z, so a point in front has a negative Z.
   *
   * @param {number} u - Normalized x in the video frame, [0,1].
   * @param {number} v - Normalized y in the video frame, [0,1].
   * @param {number} depth - Metres along the view axis.
   * @param {Object} frame - Result of prepare().
   * @param {THREE.Vector3} [target]
   */
  backProject(u, v, depth, frame, target = this._position) {
    const { videoWidth, videoHeight } = frame.view;
    const px = u * videoWidth;
    const py = v * videoHeight;
    return target.set(
      frame.mirrorSign * (px - videoWidth / 2) * depth / frame.fPx,
      -(py - videoHeight / 2) * depth / frame.fPx,
      -depth
    );
  }

  /**
   * Palm normal in unmirrored world space.
   *
   * The index→pinky sweep runs the opposite way on the two hands, so the cross
   * product flips; without the handedness correction the product would sit
   * rotated 180° on one hand.
   */
  palmNormal(handedness, target = this._normal) {
    const W = this._world;
    this._a.subVectors(W[HAND.INDEX_MCP], W[HAND.WRIST]);
    this._b.subVectors(W[HAND.PINKY_MCP], W[HAND.WRIST]);
    target.crossVectors(this._a, this._b);

    if (target.lengthSq() < 1e-10) target.set(0, 0, 1);
    else target.normalize();

    if (handedness === 'Left') target.negate();
    return target;
  }

  /**
   * Orthonormal basis from a primary axis (local +Y) and a normal hint (local
   * +Z), re-orthogonalized because anatomical axes are never exactly
   * perpendicular. Mirroring is applied to the finished quaternion.
   *
   * Mutates `primary` and `normalHint` in place to the final mirrored axes, so
   * callers get axes consistent with the returned rotation.
   *
   * @returns {THREE.Quaternion} internal instance — copy before storing.
   */
  buildBasis(primary, normalHint, mirrorSign) {
    if (primary.lengthSq() < 1e-10) primary.set(0, 1, 0);
    else primary.normalize();

    this._side.crossVectors(primary, normalHint);
    if (this._side.lengthSq() < 1e-10) {
      // Degenerate: primary is parallel to the hint. Any perpendicular will do.
      this._side.set(1, 0, 0).cross(primary);
      if (this._side.lengthSq() < 1e-10) this._side.set(0, 0, 1).cross(primary);
    }
    this._side.normalize();
    normalHint.crossVectors(this._side, primary).normalize();

    this._basis.makeBasis(this._side, primary, normalHint);
    this._quaternion.setFromRotationMatrix(this._basis);

    if (mirrorSign < 0) {
      // Conjugating a rotation by diag(-1, 1, 1) negates its y and z components.
      this._quaternion.set(
        this._quaternion.x,
        -this._quaternion.y,
        -this._quaternion.z,
        this._quaternion.w
      );
      primary.x *= -1;
      normalHint.x *= -1;
    }

    return this._quaternion;
  }

  /** Metric depth of the hand centre, in metres. */
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
   * Good to a few percent when the hand faces the camera; refineDepth() removes
   * the rest.
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
   * Refine the hand-centre translation by minimizing reprojection error over all
   * 21 landmarks — pose estimation with known 3D points and known intrinsics,
   * i.e. the translation half of PnP (the rotation is already given by
   * worldLandmarks).
   *
   * This matters because the weak-perspective estimate treats a segment's two
   * ends as being at the same depth. When the hand tilts toward the camera they
   * are not, and the error is real: a 50° tilt reads ~8% too close. Each
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
