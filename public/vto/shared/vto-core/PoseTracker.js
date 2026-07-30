/**
 * Forearm axis from MediaPipe Pose Landmarker.
 *
 * Exists for one reason: the hand model has no forearm landmark, so
 * `WristAnchor.forearmAxis()` has to extrapolate the axis off the end of the
 * hand skeleton, and that extrapolation is only valid with the wrist straight.
 * Measured error tracks flexion nearly 1:1 (15° -> 15°, 30° -> 30°; see
 * arch-docs/WRIST_VTO_IMPLEMENTATION.md §3). Pose Landmarker carries a real
 * elbow and a real wrist, so elbow->wrist is the true forearm direction and is
 * immune to wrist flexion by construction.
 *
 * `pose_landmarker_lite` is 5.5MB (verified; the arch-doc's estimate of ~16MB
 * predates checking). Lite is enough — elbow and wrist are among the easiest
 * landmarks the model produces, and nothing here uses the other 29.
 *
 * DIRECTION ONLY. Position still comes from the hand's wrist landmark, which is
 * far better localized than pose's, and roll still comes from the palm normal —
 * pronation is the one wrist DOF the hand tracks faithfully, and it decides
 * which way the watch face points, i.e. the thing a user notices most.
 *
 * Cost is kept off the critical path three ways: the model loads only after the
 * hand tracker is already running, inference runs every Nth frame (a forearm
 * moves slowly), and it is skipped entirely while no hand is detected, since
 * nothing is rendered then anyway.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

/** The only four landmarks this file cares about. */
const POSE = {
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16
};

const ARMS = [
  { elbow: POSE.LEFT_ELBOW, wrist: POSE.LEFT_WRIST },
  { elbow: POSE.RIGHT_ELBOW, wrist: POSE.RIGHT_WRIST }
];

export class PoseTracker {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      modelPath: '/tasks/pose_landmarker_lite.task',
      // A forearm moves slowly, so a third of the frame rate is plenty and the
      // axis filter in WristAnchor covers the frames in between.
      everyNFrames: 3,
      minVisibility: 0.5,
      // Normalized image distance between pose's wrist and the hand's wrist
      // landmark, past which the two are assumed to be different limbs.
      maxWristMismatch: 0.15,
      // Must match the wasm fileset to the JS bundle in index.html, same as
      // MediaPipeTracker.
      version: '0.10.35',
      ...config
    };

    this.poseLandmarker = null;
    this.isReady = false;
    this.lastResults = null;
    this._frameCounter = 0;
    // detectForVideo demands strictly increasing timestamps, and throttling
    // means the series has gaps; this only has to be monotonic, not real.
    this._lastTimestamp = -1;

    // Where forearmAxis() leaves its result. Read it after a call that returned
    // a weight >= 0; it is reused every frame, so copy before storing.
    this.axis = new THREE.Vector3();
    // Normalized 2D endpoints of the arm forearmAxis() actually chose, purely so
    // the debug overlay can draw the same axis the solver is using. null when
    // there is none this frame.
    this.forearm2D = null;
    this._elbow = new THREE.Vector3();
    this._wrist = new THREE.Vector3();
  }

  /**
   * Loads the wasm fileset and the model. Deliberately separate from the
   * constructor so the caller can start it after first paint.
   */
  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.config.version}/wasm`
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.config.modelPath,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      // Nothing here needs a silhouette, and generating one costs a GPU pass.
      outputSegmentationMasks: false
    });

    this.isReady = true;
    console.log('  ✅ Pose Landmarker created (forearm axis)');
    return true;
  }

  /**
   * Run inference at the throttled rate. Cheap to call every frame.
   *
   * @param {HTMLVideoElement} video
   * @param {number} timestampMs
   * @returns {boolean} true when inference actually ran this call.
   */
  maybeDetect(video, timestampMs) {
    if (!this.isReady || !this.config.enabled) return false;

    const stride = Math.max(1, Math.round(this.config.everyNFrames));
    if (this._frameCounter++ % stride !== 0) return false;

    const timestamp = timestampMs > this._lastTimestamp
      ? timestampMs
      : this._lastTimestamp + 1;
    this._lastTimestamp = timestamp;

    try {
      this.lastResults = this.poseLandmarker.detectForVideo(video, timestamp);
    } catch (error) {
      // A dropped frame must not take the whole try-on down; the anchor simply
      // falls back to the hand-extrapolated axis.
      console.warn('Pose inference failed, falling back to the hand axis:', error);
      this.lastResults = null;
    }
    return true;
  }

  /** Forget the current pose, so a hand change cannot inherit the other arm. */
  reset() {
    this.lastResults = null;
    this._frameCounter = 0;
  }

  /**
   * Direction up the forearm, in the same unmirrored world space HandSolver
   * uses, pointing wrist -> elbow.
   *
   * That sense matters: `WristAnchor` walks the anchor from the wrist crease
   * *up the arm* by `anchorOffsetMm`, and its hand-derived axis runs
   * palmCentre -> wrist, which points toward the elbow. Returning elbow -> wrist
   * would put the watch on the back of the hand.
   *
   * The arm is chosen by proximity to the hand's own wrist landmark rather than
   * by handedness. Hand-landmarker handedness assumes a mirrored input and
   * already needs `flipHandedness` to correct, so pairing pose's anatomical
   * labels against it would invite a mirror bug that only shows on one hand.
   * Proximity is unambiguous and doubles as the sanity check.
   *
   * @param {Object} handWrist - The hand's landmark 0, normalized {x, y}.
   * @param {THREE.Vector3} target
   * @returns {number} Blend weight in [0, 1], or -1 when there is no usable axis.
   */
  forearmAxis(handWrist, target = this.axis) {
    this.forearm2D = null;

    const landmarks = this.lastResults?.landmarks?.[0];
    const worldLandmarks = this.lastResults?.worldLandmarks?.[0];
    if (!landmarks || !worldLandmarks || !handWrist) return -1;

    // Pick the arm whose wrist is nearest the hand we are actually tracking.
    let best = null;
    let bestDistance = Infinity;
    for (const arm of ARMS) {
      const poseWrist = landmarks[arm.wrist];
      if (!poseWrist) continue;
      const distance = Math.hypot(poseWrist.x - handWrist.x, poseWrist.y - handWrist.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = arm;
      }
    }

    if (!best || bestDistance > this.config.maxWristMismatch) return -1;

    // `visibility` is how sure the model is that the joint is actually in shot.
    // An occluded elbow gives a plausible-looking but invented axis, which is
    // worse than falling back to the hand.
    const visibility = Math.min(
      landmarks[best.elbow]?.visibility ?? 1,
      landmarks[best.wrist]?.visibility ?? 1
    );
    if (visibility < this.config.minVisibility) return -1;

    // MediaPipe world space is X-right, Y-down, Z-toward-the-camera-negative;
    // Three.js is Y-up, Z-toward-the-viewer. Same mapping HandSolver.prepare()
    // applies, so the two axes live in one coordinate system. Unmirrored — the
    // mirror is applied later, to the finished quaternion.
    const elbowWorld = worldLandmarks[best.elbow];
    const wristWorld = worldLandmarks[best.wrist];
    if (!elbowWorld || !wristWorld) return -1;

    this._elbow.set(elbowWorld.x, -elbowWorld.y, -elbowWorld.z);
    this._wrist.set(wristWorld.x, -wristWorld.y, -wristWorld.z);

    // Wrist -> elbow, i.e. up the arm.
    target.subVectors(this._elbow, this._wrist);
    if (target.lengthSq() < 1e-10) return -1;
    target.normalize();

    this.forearm2D = {
      wrist: { x: landmarks[best.wrist].x, y: landmarks[best.wrist].y },
      elbow: { x: landmarks[best.elbow].x, y: landmarks[best.elbow].y }
    };

    // Ramp rather than a hard pass/fail. A detection sitting right on the
    // threshold flickering in and out would swing the product between two
    // axes; fading it in over a small band above the threshold means a
    // marginal pose is trusted proportionally, and a confident one fully.
    return THREE.MathUtils.smoothstep(
      visibility,
      this.config.minVisibility,
      Math.min(1, this.config.minVisibility + 0.2)
    );
  }

  destroy() {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isReady = false;
    this.lastResults = null;
    console.log('Pose tracker destroyed');
  }
}
