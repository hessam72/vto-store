/**
 * Three.js Scene Manager - Watch VTO Edition
 * Optimized for wrist tracking with fixes:
 * - Corrected FOV calculation
 * - Wrist-specific positioning
 * - Watch sizing (42mm vs 20mm ring)
 * - Improved filtering
 * - Confidence hysteresis
 */

import { WATCH_CONFIG } from '../config/landmarks.js';
import { CoordinateConverter } from '../utils/CoordinateConverter.js';

export class ThreeSceneManager {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.config = {
      modelURL: '/models/watch/default.glb',
      modelScale: 1.0,
      watchDiameter: 42,  // mm
      occluderRadiusRange: [4.0, 4.5],
      occluderHeight: 8,
      debugOccluder: false,
      ...config
    };

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.watchMesh = null;
    this.occluderMesh = null;
    this.debugBox = null;  // DEBUG: Simple box to test positioning
    this.loadingManager = null;

    // State
    this.isWatchVisible = false;
    this.currentHandedness = null;
    this.autoNormalizeScale = 1.0;

    // Confidence hysteresis (prevent flickering)
    this.detectionHistory = [];
    this.HYSTERESIS_FRAMES = 5;
    this.CONFIDENCE_THRESHOLD = 0.6;  // 60% of frames must have detection

    // Smoothing filters for position (watches move slower than fingers)
    this.positionFilters = {
      x: new LowPassFilter(0.65),  // Increased from 0.5
      y: new LowPassFilter(0.65),
      z: new LowPassFilter(0.65)
    };

    // Smoothing filter for rotation (less aggressive for larger object)
    this.rotationFilter = new LowPassFilter(0.45);  // Increased from 0.3

    this.init();
  }

  /**
   * Initialize Three.js scene
   */
  init() {
    console.log('  🎨 ThreeSceneManager init() started');

    // Scene
    this.scene = new THREE.Scene();
    console.log('  📌 Scene created');

    // Camera - FIXED FOV calculation for realistic webcam
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const videoHeight = this.canvas.clientHeight || 720;

    // FIX: Use realistic focal length (0.7 × video dimension, not 1.0)
    const focalLengthPx = videoHeight * 0.7;
    const fov = 2 * Math.atan(videoHeight / (2 * focalLengthPx)) * (180 / Math.PI);

    // FIX: Near plane 0.1 (was 0.01 - caused z-fighting), far 50 (was 100 - unnecessarily large)
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 50);
    this.camera.position.set(0, 0, 0);
    console.log(`  📌 Camera created (FOV: ${fov.toFixed(1)}°, corrected for realistic webcam)`);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    console.log('  📌 Renderer created');

    // Lighting setup
    console.log('  📌 Setting up lighting...');
    this.setupLighting();

    // Loading manager
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onLoad = () => {
      console.log('  ✅ All Three.js assets loaded');
    };
    console.log('  📌 Loading manager created');

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());

    console.log('  ✅ Three.js scene initialized');
  }

  /**
   * Setup HDR environment lighting
   */
  setupLighting() {
    console.log('    💡 Setting up HDR lighting...');
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    new THREE.RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .load('/models/envmaps/hotel_room_1k.hdr',
        (texture) => {
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          pmremGenerator.dispose();
          this.scene.environment = envMap;
          console.log('    ✅ HDR environment map loaded');
        },
        undefined,
        (error) => {
          console.warn('    ⚠️ Failed to load HDR environment map:', error);
          console.warn('    ⚠️ Continuing without HDR lighting');
        }
      );
  }

  /**
   * Load watch 3D model
   */
  async loadWatchModel() {
    console.log(`    📦 Loading watch model from: ${this.config.modelURL}`);
    return new Promise((resolve, reject) => {
      new THREE.GLTFLoader(this.loadingManager).load(
        this.config.modelURL,
        (gltf) => {
          console.log('    📌 GLTF loaded, processing...');
          this.watchMesh = gltf.scene.children[0] || gltf.scene;

          // Find actual mesh if it's wrapped in a group
          let actualMesh = this.watchMesh;
          if (!actualMesh.geometry) {
            actualMesh.traverse((child) => {
              if (child.isMesh && !actualMesh.geometry) {
                actualMesh = child;
              }
            });
          }

          // Center geometry and normalize to watch size
          if (actualMesh.geometry) {
            const box = new THREE.Box3().setFromObject(this.watchMesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            actualMesh.geometry.translate(-center.x, -center.y, -center.z);

            // FIX: Normalize to watch size (42mm = 0.042 units, NOT 20mm ring)
            const maxDimension = Math.max(size.x, size.y, size.z);
            const targetSize = this.config.watchDiameter / 1000;  // mm to meters
            this.autoNormalizeScale = targetSize / maxDimension;

            console.log(`    🎯 Centered geometry: offset (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
            console.log(`    📏 Model original size: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
            console.log(`    🔧 Auto-normalize scale: ${this.autoNormalizeScale.toFixed(6)} (${maxDimension.toFixed(3)} → ${targetSize})`);
          }

          // Apply auto-normalization + user modelScale
          const finalScale = this.autoNormalizeScale * this.config.modelScale;
          this.watchMesh.scale.set(finalScale, finalScale, finalScale);
          this.watchMesh.visible = false;
          this.scene.add(this.watchMesh);

          console.log(`    ✅ Watch loaded | Final scale: ${finalScale.toFixed(6)} (auto: ${this.autoNormalizeScale.toFixed(6)} × user: ${this.config.modelScale})`);
          resolve(this.watchMesh);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            console.log(`    📊 Loading watch model: ${percent}%`);
          }
        },
        (error) => {
          console.error('    ❌ Error loading watch model:', error);
          console.error('    ❌ Model URL was:', this.config.modelURL);
          reject(error);
        }
      );
    });
  }

  /**
   * Add soft occluder for wrist depth effect
   */
  addSoftOccluder() {
    const occluderRadius = this.config.occluderRadiusRange[1];
    const geometry = new THREE.CylinderGeometry(
      occluderRadius,
      occluderRadius,
      this.config.occluderHeight,
      32,
      1,
      true
    );

    const material = this.config.debugOccluder
      ? new THREE.MeshNormalMaterial()
      : new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true
        });

    this.occluderMesh = new THREE.Mesh(geometry, material);
    this.occluderMesh.quaternion.set(0.707, 0, 0, 0.707);  // Rotate 90° along X
    this.occluderMesh.scale.set(1.0, 1.0, 0.6);  // Flatten for wrist
    this.occluderMesh.visible = false;

    this.scene.add(this.occluderMesh);
    console.log('Soft occluder added');
  }

  /**
   * Add debug box to visualize wrist position
   */
  addDebugBox() {
    const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);  // 5cm cube
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,  // Red
      wireframe: false
    });

    this.debugBox = new THREE.Mesh(geometry, material);
    this.debugBox.visible = false;
    this.scene.add(this.debugBox);
    console.log('DEBUG: Red box added for wrist visualization');
  }

  /**
   * Update watch position and orientation from MediaPipe landmarks
   * @param {Object} results - MediaPipe results with landmarks
   */
  updateFromLandmarks(results) {
    // CONFIDENCE HYSTERESIS: Track detection history to prevent flickering
    const hasDetection = results.landmarks && results.landmarks.length > 0;
    this.detectionHistory.push(hasDetection);

    if (this.detectionHistory.length > this.HYSTERESIS_FRAMES) {
      this.detectionHistory.shift();
    }

    const recentDetections = this.detectionHistory.filter(Boolean).length;
    const shouldShow = recentDetections >= this.HYSTERESIS_FRAMES * this.CONFIDENCE_THRESHOLD;

    if (!shouldShow) {
      this.hideWatch();
      return;
    }

    // Verify handedness data exists (prevents crash when hand exits viewport)
    if (!results.handedness || !results.handedness[0] || !results.handedness[0][0]) {
      this.hideWatch();
      return;
    }

    // Get first hand
    const landmarks = results.landmarks[0];
    const handedness = results.handedness[0][0].categoryName;  // "Left" or "Right"
    this.currentHandedness = handedness;

    // WRIST POSITIONING: Use wrist landmark (0) instead of finger
    const COORD_SCALE = 5.0;
    let position = CoordinateConverter.wristToThreeJS(landmarks, COORD_SCALE);

    // Apply position smoothing with adjusted alpha for watch
    position.x = this.positionFilters.x.filter(position.x);
    position.y = this.positionFilters.y.filter(position.y);
    position.z = this.positionFilters.z.filter(position.z);

    // Calculate rotation from wrist to palm direction
    const wristLandmark = landmarks[WATCH_CONFIG.PLACEMENT_LANDMARK];

    // Get finger bases for palm center
    const fingerBases = WATCH_CONFIG.ORIENTATION_LANDMARKS.map(idx => landmarks[idx]);
    const palmCenter = {
      x: fingerBases.reduce((sum, lm) => sum + lm.x, 0) / 4,
      y: fingerBases.reduce((sum, lm) => sum + lm.y, 0) / 4,
      z: fingerBases.reduce((sum, lm) => sum + lm.z, 0) / 4
    };

    const wristPos = CoordinateConverter.normalizedToThreeJS(wristLandmark, COORD_SCALE);
    const palmPos = CoordinateConverter.normalizedToThreeJS(palmCenter, COORD_SCALE);

    // Hand direction (wrist → palm)
    const handDirection = new THREE.Vector3().subVectors(palmPos, wristPos).normalize();

    // Create orthogonal basis for watch orientation
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(handDirection, worldUp).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(right, handDirection).normalize();

    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(handDirection, correctedUp, right);

    const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    // Update watch mesh
    if (this.watchMesh) {
      this.watchMesh.position.copy(position);
      this.watchMesh.quaternion.copy(quaternion);

      const finalScale = this.autoNormalizeScale * this.config.modelScale;
      this.watchMesh.scale.setScalar(finalScale);
      this.watchMesh.visible = true;
      this.isWatchVisible = true;
    }

    // Update occluder
    if (this.occluderMesh) {
      this.occluderMesh.position.copy(position);
      this.occluderMesh.quaternion.copy(quaternion);
      this.occluderMesh.visible = true;
    }

    // DEBUG: Update debug box
    if (this.debugBox) {
      this.debugBox.position.copy(position);
      this.debugBox.visible = true;
    }
  }

  /**
   * Hide watch when hand not detected
   */
  hideWatch() {
    if (this.watchMesh) {
      this.watchMesh.visible = false;
    }
    if (this.occluderMesh) {
      this.occluderMesh.visible = false;
    }
    if (this.debugBox) {
      this.debugBox.visible = false;
    }
    this.isWatchVisible = false;

    // Reset smoothing filters to prevent artifacts when hand reappears
    this.positionFilters.x.reset();
    this.positionFilters.y.reset();
    this.positionFilters.z.reset();
  }

  /**
   * Render scene
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize - FIXED to recalculate FOV
   */
  handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Recalculate FOV based on new dimensions
    const focalLengthPx = height * 0.7;
    const fov = 2 * Math.atan(height / (2 * focalLengthPx)) * (180 / Math.PI);

    this.camera.fov = fov;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Cleanup
   */
  destroy() {
    // Dispose geometries and materials
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    window.removeEventListener('resize', () => this.handleResize());

    console.log('Three.js scene destroyed');
  }
}

/**
 * Low-pass filter for smoothing position/rotation
 */
class LowPassFilter {
  constructor(alpha = 0.3) {
    this.alpha = alpha; // 0 = instant response, 1 = frozen
    this.prev = null;
  }

  filter(value) {
    if (this.prev === null) {
      this.prev = value;
      return value;
    }
    const filtered = this.prev + this.alpha * (value - this.prev);
    this.prev = filtered;
    return filtered;
  }

  reset() {
    this.prev = null;
  }
}
