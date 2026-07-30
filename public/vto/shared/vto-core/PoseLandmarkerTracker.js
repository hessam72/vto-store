/**
 * MediaPipe Pose Landmarker as a PRIMARY tracker.
 *
 * Distinct from PoseTracker.js, and the difference is the point: that one is a
 * throttled passenger riding the hand tracker's video to supply one extra
 * vector, and it owns no camera. This one owns the camera and the frame loop,
 * and its results are what the whole solve is built from — the shape
 * MediaPipeTracker has for hands, but for bodies.
 *
 * Exists because a necklace is anchored to the torso, and the torso is only
 * observable here: the shoulder line (landmarks 11 and 12) carries body roll in
 * its vertical component and body yaw in its depth component. A face tracker
 * measures neither, which is why the WebAR.rocks necklace cannot follow a user
 * who leans or turns.
 *
 * Interchangeable with MediaPipeTracker from the bootstrap's point of view:
 * same init/start/stop/switchCamera/destroy, same `onResults` callback, same
 * `videoElement`. `PoseLandmarkerResult` and `HandLandmarkerResult` share the
 * `{ landmarks[], worldLandmarks[] }` shape, so HandSolver.prepare() consumes
 * either given the right `landmarkCount`.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

/** MediaPipe's pose model emits 33 landmarks. */
export const POSE_LANDMARK_COUNT = 33;

export const POSE = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_HIP: 23,
  RIGHT_HIP: 24
};

// Upper body only. At head-and-shoulders framing everything below the hips is
// extrapolated by the model rather than seen, so drawing it would present
// invented data as measurement.
const POSE_CONNECTIONS = [
  [POSE.NOSE, POSE.LEFT_EAR], [POSE.NOSE, POSE.RIGHT_EAR],
  [POSE.MOUTH_LEFT, POSE.MOUTH_RIGHT],
  [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER],
  [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW], [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
  [POSE.LEFT_SHOULDER, POSE.LEFT_HIP], [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP],
  [POSE.LEFT_HIP, POSE.RIGHT_HIP]
];

export class PoseLandmarkerTracker {
  constructor(config = {}) {
    this.videoElement = null;
    this.canvasElement = null;
    this.ctx = null;
    this.poseLandmarker = null;
    this.stream = null;
    this.rafId = null;
    this.isRunning = false;
    this.lastVideoTime = -1;
    this.lastResults = null;

    this.config = {
      numPoses: 1,
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
      facingMode: 'user',
      videoWidth: 1920,
      videoHeight: 1080,
      modelPath: '/tasks/pose_landmarker_lite.task',
      // Landmarks below this visibility are drawn dimmed, so it is obvious at a
      // glance which parts of the skeleton the model is guessing at.
      debugMinVisibility: 0.5,
      debugDrawLandmarks: false,
      // Pin the release: the wasm fileset and the JS bundle must be the same
      // version, as in MediaPipeTracker.
      version: '0.10.35',
      ...config
    };

    this.onResults = config.onResults || (() => {});
  }

  async init(videoElement, canvasElement) {
    console.log('  📌 Pose Landmarker init() started');
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    try {
      const vision = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.config.version}/wasm`
      );
      console.log('  ✅ MediaPipe FilesetResolver loaded');

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.config.modelPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: this.config.numPoses,
        minPoseDetectionConfidence: this.config.minPoseDetectionConfidence,
        minPosePresenceConfidence: this.config.minPosePresenceConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
        // A silhouette costs an extra GPU pass and nothing here consumes one.
        outputSegmentationMasks: false
      });
      console.log('  ✅ Pose Landmarker created successfully');

      await this.setupCamera();
      console.log('  ✅ Camera setup complete');

      return true;
    } catch (error) {
      console.error('Error initializing Pose Landmarker:', error);
      throw error;
    }
  }

  async setupCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.config.facingMode,
          width: { ideal: this.config.videoWidth },
          height: { ideal: this.config.videoHeight }
        }
      });

      this.videoElement.srcObject = this.stream;

      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = resolve;
      });
      await this.videoElement.play();

      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;

      console.log(
        `    ✅ Camera initialized: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`
      );
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw error;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const detectPose = () => {
      if (!this.isRunning) return;

      // Only infer when the camera has actually produced a new frame.
      // detectForVideo requires strictly increasing timestamps, and re-running
      // on a repeated frame is a wasted GPU pass on every rAF tick that
      // outpaces the camera.
      if (this.videoElement.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.videoElement.currentTime;
        this.lastResults = this.poseLandmarker.detectForVideo(
          this.videoElement,
          performance.now()
        );

        this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        if (this.config.debugDrawLandmarks) {
          this.drawLandmarks(this.lastResults);
        }
      }

      if (this.lastResults) this.onResults(this.lastResults);

      this.rafId = requestAnimationFrame(detectPose);
    };

    detectPose();
    console.log('Pose tracking started');
  }

  stop() {
    this.isRunning = false;
    this.lastVideoTime = -1;
    this.lastResults = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    console.log('Pose tracking stopped');
  }

  async switchCamera() {
    this.stop();
    this.stopCamera();

    this.config.facingMode = this.config.facingMode === 'user' ? 'environment' : 'user';

    await this.setupCamera();
    this.start();

    console.log(`Camera switched to: ${this.config.facingMode}`);
    return this.config.facingMode;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Upper-body skeleton, with the shoulder line called out because it is what
   * actually drives the product's orientation — if it looks wrong here, the
   * necklace will be wrong in the same way.
   */
  drawLandmarks(results) {
    const landmarks = results?.landmarks?.[0];
    if (!landmarks) return;

    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const minVisibility = this.config.debugMinVisibility;
    const visible = (i) => (landmarks[i]?.visibility ?? 1) >= minVisibility;

    this.ctx.lineWidth = 2;
    for (const [start, end] of POSE_CONNECTIONS) {
      const a = landmarks[start];
      const b = landmarks[end];
      if (!a || !b) continue;

      // Dim anything the model is not confident it can see, rather than drawing
      // a guess in the same colour as a measurement.
      this.ctx.strokeStyle = visible(start) && visible(end) ? '#00FF00' : '#336633';
      this.ctx.beginPath();
      this.ctx.moveTo(a.x * width, a.y * height);
      this.ctx.lineTo(b.x * width, b.y * height);
      this.ctx.stroke();
    }

    for (let i = 0; i < landmarks.length; i++) {
      if (i > POSE.RIGHT_HIP) break; // upper body only, as above
      this.ctx.fillStyle = visible(i) ? '#FF0000' : '#663333';
      this.ctx.beginPath();
      this.ctx.arc(landmarks[i].x * width, landmarks[i].y * height, 4, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // The shoulder line: the whole reason this tracker exists.
    const left = landmarks[POSE.LEFT_SHOULDER];
    const right = landmarks[POSE.RIGHT_SHOULDER];
    if (left && right) {
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(left.x * width, left.y * height);
      this.ctx.lineTo(right.x * width, right.y * height);
      this.ctx.stroke();

      this.ctx.fillStyle = '#FFD700';
      for (const point of [left, right]) {
        this.ctx.beginPath();
        this.ctx.arc(point.x * width, point.y * height, 8, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
  }

  destroy() {
    this.stop();
    this.stopCamera();

    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }

    console.log('Pose tracker destroyed');
  }
}
