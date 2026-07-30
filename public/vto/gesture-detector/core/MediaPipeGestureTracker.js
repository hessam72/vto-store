/**
 * MediaPipe Gesture Recognizer Wrapper
 * Detects built-in gestures: Closed_Fist, Open_Palm, Pointing_Up, Thumb_Up, Thumb_Down, Victory, ILoveYou
 */

import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';

export class MediaPipeGestureTracker {
  constructor(config = {}) {
    this.videoElement = null;
    this.canvasElement = null;
    this.ctx = null;
    this.gestureRecognizer = null;
    this.stream = null;
    this.rafId = null;
    this.isRunning = false;
    this.lastVideoTime = -1;

    this.config = {
      numHands: 1,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
      facingMode: 'user',
      videoWidth: 1280,
      videoHeight: 720,
      version: '0.10.35',
      ...config
    };

    this.onResults = config.onResults || (() => {});
  }

  /**
   * Initialize MediaPipe GestureRecognizer and camera
   */
  async init(videoElement, canvasElement) {
    console.log('📌 MediaPipeGestureTracker init() started');
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    try {
      console.log('📌 Loading MediaPipe FilesetResolver...');
      const vision = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.config.version}/wasm`
      );
      console.log('✅ MediaPipe FilesetResolver loaded');

      console.log('📌 Creating Gesture Recognizer...');
      this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/tasks/gesture_recognizer.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: this.config.numHands,
        minHandDetectionConfidence: this.config.minHandDetectionConfidence,
        minHandPresenceConfidence: this.config.minHandPresenceConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence
      });

      console.log('✅ MediaPipe Gesture Recognizer created');

      console.log('📌 Setting up camera...');
      await this.setupCamera();
      console.log('✅ Camera setup complete');

      return true;
    } catch (error) {
      console.error('❌ Error initializing MediaPipe:', error);
      throw error;
    }
  }

  /**
   * Setup webcam
   */
  async setupCamera() {
    try {
      console.log('🎥 Requesting camera access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.config.facingMode,
          width: { ideal: this.config.videoWidth },
          height: { ideal: this.config.videoHeight }
        }
      });
      console.log('✅ Camera access granted');

      this.videoElement.srcObject = this.stream;

      return new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          console.log(`✅ Video ready: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);
          resolve();
        };
      });
    } catch (error) {
      console.error('❌ Camera error:', error);
      throw new Error('Cannot access camera. Please allow camera permissions.');
    }
  }

  /**
   * Start gesture detection loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('▶️ Starting gesture detection loop');
    this.detectGestures();
  }

  /**
   * Stop gesture detection
   */
  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    console.log('⏸️ Gesture detection stopped');
  }

  /**
   * Main detection loop
   */
  detectGestures() {
    if (!this.isRunning) return;

    const video = this.videoElement;
    const startTimeMs = performance.now();

    // Only process if video time has advanced
    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;

      // Detect gestures
      const results = this.gestureRecognizer.recognizeForVideo(video, startTimeMs);

      // Draw video frame to canvas
      this.drawFrame();

      // Process results
      this.processResults(results);
    }

    // Continue loop
    this.rafId = requestAnimationFrame(() => this.detectGestures());
  }

  /**
   * Draw video frame to canvas
   */
  drawFrame() {
    const canvas = this.canvasElement;
    const video = this.videoElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    this.ctx.save();
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.restore();
  }

  /**
   * Process gesture recognition results
   */
  processResults(results) {
    const processedResults = {
      gestures: [],
      landmarks: [],
      handedness: [],
      timestamp: performance.now()
    };

    if (results.gestures && results.gestures.length > 0) {
      // Get first hand gestures
      const handGestures = results.gestures[0];
      processedResults.gestures = handGestures.map(g => ({
        category: g.categoryName,
        confidence: g.score
      }));
    }

    if (results.landmarks && results.landmarks.length > 0) {
      processedResults.landmarks = results.landmarks[0];
    }

    if (results.handedness && results.handedness.length > 0) {
      processedResults.handedness = results.handedness[0].map(h => ({
        category: h.categoryName,
        confidence: h.score
      }));
    }

    // Call results callback
    this.onResults(processedResults);
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera() {
    const currentFacing = this.config.facingMode;
    this.config.facingMode = currentFacing === 'user' ? 'environment' : 'user';

    // Stop current stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    // Restart with new camera
    await this.setupCamera();
    console.log(`🔄 Camera switched to ${this.config.facingMode}`);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.gestureRecognizer) {
      this.gestureRecognizer.close();
    }

    console.log('🗑️ MediaPipeGestureTracker destroyed');
  }
}
