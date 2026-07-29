/**
 * MediaPipe Hand Tracker Wrapper
 *
 * Runs one vision task over the camera and hands the raw result to onResults.
 * The task is either HandLandmarker or GestureRecognizer: the latter emits the
 * same landmarks / worldLandmarks / handedness the ring solver consumes, and
 * adds a classified gesture, so gesture control costs no extra inference.
 */

import { FilesetResolver, HandLandmarker, GestureRecognizer } from '@mediapipe/tasks-vision';

const MODEL_URLS = {
  handLandmarker:
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  gestureRecognizer:
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
};

export class MediaPipeTracker {
  constructor(config = {}) {
    this.videoElement = null;
    this.canvasElement = null;
    this.ctx = null;
    this.detector = null;
    this.stream = null;
    this.rafId = null;
    this.isRunning = false;
    this.lastVideoTime = -1;
    this.lastResults = null;

    // Configuration
    this.config = {
      numHands: 1,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
      facingMode: 'user',  // 'user' or 'environment'
      videoWidth: 1280,
      videoHeight: 720,
      useGestureRecognizer: true,
      // Pin the release: the wasm fileset and the JS bundle must be the same
      // version, and the importmap used to float on `@latest`.
      version: '0.10.35',
      ...config
    };

    // Callback for tracking results
    this.onResults = config.onResults || (() => {});
  }

  /**
   * Initialize MediaPipe and camera
   */
  async init(videoElement, canvasElement) {
    console.log('  📌 MediaPipe init() started');
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    console.log('  📌 Canvas context created');

    try {
      // Initialize MediaPipe vision tasks
      console.log('  📌 Loading MediaPipe FilesetResolver...');
      const vision = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.config.version}/wasm`
      );
      console.log('  ✅ MediaPipe FilesetResolver loaded');

      // Both tasks take the same options; only the class and the bundle differ.
      const useGestures = this.config.useGestureRecognizer;
      const Task = useGestures ? GestureRecognizer : HandLandmarker;
      const modelAssetPath = useGestures ? MODEL_URLS.gestureRecognizer : MODEL_URLS.handLandmarker;

      console.log(`  📌 Creating ${useGestures ? 'Gesture Recognizer' : 'Hand Landmarker'} (downloading model ~5MB)...`);
      this.detector = await Task.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: this.config.numHands,
        minHandDetectionConfidence: this.config.minHandDetectionConfidence,
        minHandPresenceConfidence: this.config.minHandPresenceConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence
      });

      console.log('  ✅ MediaPipe detector created successfully');

      // Setup camera
      console.log('  📌 Setting up camera...');
      await this.setupCamera();
      console.log('  ✅ Camera setup complete');

      return true;
    } catch (error) {
      console.error('Error initializing MediaPipe:', error);
      throw error;
    }
  }

  /**
   * Setup webcam
   */
  async setupCamera() {
    try {
      console.log('    🎥 Requesting camera access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.config.facingMode,
          width: { ideal: this.config.videoWidth },
          height: { ideal: this.config.videoHeight }
        }
      });
      console.log('    ✅ Camera access granted');

      this.videoElement.srcObject = this.stream;

      // Wait for video metadata to load
      console.log('    📌 Waiting for video metadata...');
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = resolve;
      });
      console.log('    ✅ Video metadata loaded');

      console.log('    📌 Starting video playback...');
      await this.videoElement.play();
      console.log('    ✅ Video playing');

      // Set canvas size to match video
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;

      console.log(`    ✅ Camera initialized: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw error;
    }
  }

  /**
   * Start hand tracking loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const detectHands = () => {
      if (!this.isRunning) return;

      // Only run inference when the camera has actually produced a new frame.
      // detectForVideo requires strictly increasing timestamps, and re-running
      // it on a repeated frame is a wasted GPU pass on every rAF tick that
      // outpaces the camera's frame rate.
      if (this.videoElement.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.videoElement.currentTime;
        const timestamp = performance.now();
        this.lastResults = this.config.useGestureRecognizer
          ? this.detector.recognizeForVideo(this.videoElement, timestamp)
          : this.detector.detectForVideo(this.videoElement, timestamp);

        // The video element itself is what the user sees; this canvas is a
        // transparent overlay for the landmark debug drawing only.
        this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        if (this.config.debugDrawLandmarks) {
          this.drawLandmarks(this.lastResults);
        }
      }

      if (this.lastResults) this.onResults(this.lastResults);

      this.rafId = requestAnimationFrame(detectHands);
    };

    detectHands();
    console.log('Hand tracking started');
  }

  /**
   * Stop tracking
   */
  stop() {
    this.isRunning = false;
    this.lastVideoTime = -1;
    this.lastResults = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    console.log('Hand tracking stopped');
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera() {
    this.stop();
    this.stopCamera();

    // Toggle facing mode
    this.config.facingMode = this.config.facingMode === 'user' ? 'environment' : 'user';

    await this.setupCamera();
    this.start();

    console.log(`Camera switched to: ${this.config.facingMode}`);
    return this.config.facingMode;
  }

  /**
   * Stop camera stream
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /**
   * Draw landmarks on canvas (debug visualization)
   */
  drawLandmarks(results) {
    if (!results.landmarks || results.landmarks.length === 0) return;

    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    results.landmarks.forEach((handLandmarks) => {
      // Draw connections
      this.ctx.strokeStyle = '#00FF00';
      this.ctx.lineWidth = 2;
      this.drawConnections(handLandmarks, width, height);

      // Draw points
      this.ctx.fillStyle = '#FF0000';
      handLandmarks.forEach((landmark) => {
        const x = landmark.x * width;
        const y = landmark.y * height;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
        this.ctx.fill();
      });

      // Draw landmark 13 (ring finger MCP) in different color
      const ringMCP = handLandmarks[13];
      this.ctx.fillStyle = '#FFD700';  // Gold for ring finger anchor
      this.ctx.beginPath();
      this.ctx.arc(ringMCP.x * width, ringMCP.y * height, 8, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  /**
   * Draw hand connections (bones)
   */
  drawConnections(landmarks, width, height) {
    // Hand connections array (MediaPipe standard)
    const HAND_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],  // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
      [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
      [5, 9], [9, 13], [13, 17]  // Palm
    ];

    HAND_CONNECTIONS.forEach(([start, end]) => {
      const startLm = landmarks[start];
      const endLm = landmarks[end];

      this.ctx.beginPath();
      this.ctx.moveTo(startLm.x * width, startLm.y * height);
      this.ctx.lineTo(endLm.x * width, endLm.y * height);
      this.ctx.stroke();
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    this.stopCamera();

    if (this.detector) {
      this.detector.close();
      this.detector = null;
    }

    console.log('MediaPipe tracker destroyed');
  }
}
