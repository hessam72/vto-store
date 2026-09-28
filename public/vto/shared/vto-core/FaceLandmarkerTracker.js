/**
 * MediaPipe Face Landmarker as a PRIMARY tracker, for products worn on the face.
 *
 * Interchangeable with MediaPipeTracker and PoseLandmarkerTracker from the
 * bootstrap's point of view: same init/start/stop/switchCamera/destroy, same
 * `onResults` callback, same `videoElement`.
 *
 * The one thing the face model does not give is the `worldLandmarks` HandSolver
 * is built on. It gives something equivalent instead: a rigid
 * `facialTransformationMatrix` that carries MediaPipe's canonical metric face
 * (CanonicalFace.js) onto the observed one. Rotating the canonical vertices by
 * it produces exactly what a hand's worldLandmarks are — metric points in
 * camera orientation, centred on the object, with the translation discarded —
 * so the metric depth solve, the Gauss-Newton refinement and the pinhole
 * back-projection all run unchanged. The translation MediaPipe reports is
 * deliberately ignored: it is computed under MediaPipe's own assumed camera,
 * whereas HandSolver's depth is tied to the same f_px the renderer projects
 * with, which is what makes alignment independent of the assumed FOV.
 *
 * Scale is the canonical face's. That is an average face, so absolute depth is
 * only as right as the wearer is average; the glasses anchor corrects it from
 * the iris, whose diameter barely varies between adults.
 */

import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { CANONICAL_FACE_VERTICES, CANONICAL_FACE_VERTEX_COUNT } from './CanonicalFace.js';

/** 468 mesh landmarks plus 10 iris landmarks. */
export const FACE_LANDMARK_COUNT = 478;

export const FACE = {
  NOSE_TIP: 1,
  NOSE_BRIDGE_LOW: 6,
  FOREHEAD: 10,
  RIGHT_EYE_OUTER: 33,
  RIGHT_TEMPLE: 127,
  RIGHT_EYE_INNER: 133,
  CHIN: 152,
  NOSE_BRIDGE: 168,
  RIGHT_TRAGUS: 234,
  LEFT_EYE_OUTER: 263,
  LEFT_TEMPLE: 356,
  LEFT_EYE_INNER: 362,
  LEFT_TRAGUS: 454,
  // Iris: centre, then four boundary points. "Right" is the subject's right,
  // i.e. the eye around landmarks 33 / 133.
  RIGHT_IRIS: 468,
  LEFT_IRIS: 473
};

// The iris plane sits this far in front of the eye corners' midpoint (cm).
const IRIS_FORWARD_CM = 0.5;

export const RIGHT_IRIS_RING = [469, 470, 471, 472];
export const LEFT_IRIS_RING = [474, 475, 476, 477];

// Drawn by the debug overlay: the landmarks the solve leans on, so a bad fit
// can be traced to a bad detection at a glance.
const DEBUG_POINTS = [
  FACE.NOSE_TIP, FACE.NOSE_BRIDGE_LOW, FACE.NOSE_BRIDGE, FACE.FOREHEAD, FACE.CHIN,
  FACE.RIGHT_EYE_OUTER, FACE.RIGHT_EYE_INNER, FACE.LEFT_EYE_OUTER, FACE.LEFT_EYE_INNER,
  FACE.RIGHT_TEMPLE, FACE.LEFT_TEMPLE, FACE.RIGHT_TRAGUS, FACE.LEFT_TRAGUS
];

/** Canonical vertex `i` into `target`, in centimetres. */
function canonicalVertex(i, target) {
  return target.fromArray(CANONICAL_FACE_VERTICES, i * 3);
}

export class FaceLandmarkerTracker {
  constructor(config = {}) {
    this.videoElement = null;
    this.canvasElement = null;
    this.ctx = null;
    this.faceLandmarker = null;
    this.stream = null;
    this.rafId = null;
    this.isRunning = false;
    this.lastVideoTime = -1;
    this.lastResults = null;

    this.config = {
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      facingMode: 'user',
      // A face fills much more of the frame than a hand, and the landmark model
      // runs on a 256px crop regardless, so 1080p would only cost upload time.
      videoWidth: 1280,
      videoHeight: 720,
      modelPath: '/tasks/face_landmarker.task',
      debugDrawLandmarks: false,
      // Pin the release: the wasm fileset and the JS bundle must be the same
      // version, as in MediaPipeTracker.
      version: '0.10.35',
      ...config
    };

    this.onResults = config.onResults || (() => {});

    // Reused every frame. The results are consumed synchronously by the
    // solver, so handing out the same objects each frame is safe.
    this._world = Array.from({ length: FACE_LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));
    this._matrix = new THREE.Matrix4();
    this._rotation = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._irisSeeds = this.buildIrisSeeds();
    this._empty = { landmarks: [], worldLandmarks: [], faceRotation: null };
  }

  async init(videoElement, canvasElement) {
    console.log('  📌 Face Landmarker init() started');
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    try {
      const vision = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.config.version}/wasm`
      );
      console.log('  ✅ MediaPipe FilesetResolver loaded');

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.config.modelPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: this.config.numFaces,
        minFaceDetectionConfidence: this.config.minFaceDetectionConfidence,
        minFacePresenceConfidence: this.config.minFacePresenceConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
        // The pose comes from here. Blendshapes are an extra network pass that
        // nothing worn on the face needs.
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false
      });
      console.log('  ✅ Face Landmarker created successfully');

      await this.setupCamera();
      console.log('  ✅ Camera setup complete');

      return true;
    } catch (error) {
      console.error('Error initializing Face Landmarker:', error);
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

    const detectFace = () => {
      if (!this.isRunning) return;

      // Only infer when the camera has actually produced a new frame.
      // detectForVideo requires strictly increasing timestamps, and re-running
      // on a repeated frame is a wasted GPU pass on every rAF tick that
      // outpaces the camera.
      if (this.videoElement.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.videoElement.currentTime;
        const raw = this.faceLandmarker.detectForVideo(this.videoElement, performance.now());
        this.lastResults = this.toSolverResults(raw);

        this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        if (this.config.debugDrawLandmarks) {
          this.drawLandmarks(this.lastResults);
        }
      }

      if (this.lastResults) this.onResults(this.lastResults);

      this.rafId = requestAnimationFrame(detectFace);
    };

    detectFace();
    console.log('Face tracking started');
  }

  /**
   * Reshape a FaceLandmarkerResult into the `{ landmarks[], worldLandmarks[] }`
   * form every other tracker emits, adding the rotation for the anchor.
   *
   * worldLandmarks follow MediaPipe's hand convention (X right, Y down, Z away
   * from the camera, metres, centred on the object), because that is what
   * HandSolver converts from.
   */
  toSolverResults(raw) {
    const landmarks = raw?.faceLandmarks?.[0];
    const matrix = raw?.facialTransformationMatrixes?.[0];
    if (!landmarks || landmarks.length < FACE_LANDMARK_COUNT || !matrix) return this._empty;

    // Column-major, like THREE.Matrix4.fromArray. Rigid — its columns are unit
    // length — but extractRotation() renormalizes anyway.
    this._matrix.fromArray(matrix.data);
    this._rotation.extractRotation(this._matrix);

    const v = this._v;
    for (let i = 0; i < CANONICAL_FACE_VERTEX_COUNT; i++) {
      canonicalVertex(i, v).applyMatrix4(this._rotation).multiplyScalar(0.01);
      const w = this._world[i];
      w.x = v.x;
      w.y = -v.y;
      w.z = -v.z;
    }

    // The iris landmarks have no canonical vertex. Nothing solves on them, but
    // every index must hold a finite point, so seed them at the eye centres.
    for (let i = CANONICAL_FACE_VERTEX_COUNT; i < FACE_LANDMARK_COUNT; i++) {
      v.copy(this._irisSeeds[i < FACE.LEFT_IRIS ? 0 : 1])
        .applyMatrix4(this._rotation).multiplyScalar(0.01);
      const w = this._world[i];
      w.x = v.x;
      w.y = -v.y;
      w.z = -v.z;
    }

    return {
      landmarks: [landmarks],
      worldLandmarks: [this._world],
      faceRotation: this._rotation,
      faceLandmarkerResult: raw
    };
  }

  /**
   * Canonical iris centres (cm), standing in for the iris landmarks: the eye
   * corners' midpoint, brought forward to the iris plane. The corners sit
   * behind the cornea, and seeding the iris at their depth would read every
   * iris ~1.5% too large.
   */
  buildIrisSeeds() {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const seed = (outer, inner) => canonicalVertex(outer, a)
      .add(canonicalVertex(inner, b))
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 0, IRIS_FORWARD_CM))
      .clone();
    return [
      seed(FACE.RIGHT_EYE_OUTER, FACE.RIGHT_EYE_INNER),
      seed(FACE.LEFT_EYE_OUTER, FACE.LEFT_EYE_INNER)
    ];
  }

  stop() {
    this.isRunning = false;
    this.lastVideoTime = -1;
    this.lastResults = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    console.log('Face tracking stopped');
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

  /** The solve's key landmarks, the eye line and both iris circles. */
  drawLandmarks(results) {
    const landmarks = results?.landmarks?.[0];
    if (!landmarks) return;

    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const px = (i) => [landmarks[i].x * width, landmarks[i].y * height];

    this.ctx.fillStyle = '#FF3B30';
    for (const i of DEBUG_POINTS) {
      const [x, y] = px(i);
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(...px(FACE.RIGHT_EYE_OUTER));
    this.ctx.lineTo(...px(FACE.LEFT_EYE_OUTER));
    this.ctx.stroke();

    this.ctx.strokeStyle = '#00E5FF';
    this.ctx.lineWidth = 2;
    for (const [centre, ring] of [[FACE.RIGHT_IRIS, RIGHT_IRIS_RING], [FACE.LEFT_IRIS, LEFT_IRIS_RING]]) {
      const [cx, cy] = px(centre);
      const radius = ring.reduce((sum, i) => {
        const [x, y] = px(i);
        return sum + Math.hypot(x - cx, y - cy);
      }, 0) / ring.length;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
  }

  destroy() {
    this.stop();
    this.stopCamera();

    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }

    console.log('Face tracker destroyed');
  }
}
