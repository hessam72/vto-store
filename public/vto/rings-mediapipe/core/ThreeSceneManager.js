/**
 * Three.js Scene Manager
 * Handles 3D scene setup, rendering, and ring model management
 */

import { RING_CONFIG } from '../config/landmarks.js';
import { CoordinateConverter } from '../utils/CoordinateConverter.js';

export class ThreeSceneManager {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.config = {
      modelURL: '/models/rings/default.glb',
      modelScale: 0.45,
      occluderRadiusRange: [1.2, 1.5],
      occluderHeight: 30,
      debugOccluder: false,
      ...config
    };

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ringMesh = null;
    this.occluderMesh = null;
    this.loadingManager = null;

    // State
    this.isRingVisible = false;
    this.currentHandedness = null;
    this.autoNormalizeScale = 1.0; // Auto-calculated based on model size

    // Smoothing filters for position
    this.positionFilters = {
      x: new LowPassFilter(0.5),
      y: new LowPassFilter(0.5),
      z: new LowPassFilter(0.5)
    };

    // Smoothing filter for rotation
    this.rotationFilter = new LowPassFilter(0.3);

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

    // Camera - Calibrated for AR overlay matching video perspective
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const videoHeight = 720; // From MediaPipe config
    const focalLength = videoHeight; // Approximate for standard webcam
    const fov = 2 * Math.atan(videoHeight / (2 * focalLength)) * (180 / Math.PI);

    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.01, 100);
    this.camera.position.set(0, 0, 0); // Camera at origin for AR
    console.log(`  📌 Camera created (FOV: ${fov.toFixed(1)}°, calibrated for AR)`);

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
   * Load ring 3D model
   */
  async loadRingModel() {
    console.log(`    📦 Loading ring model from: ${this.config.modelURL}`);
    return new Promise((resolve, reject) => {
      new THREE.GLTFLoader(this.loadingManager).load(
        this.config.modelURL,
        (gltf) => {
          console.log('    📌 GLTF loaded, processing...');
          this.ringMesh = gltf.scene.children[0] || gltf.scene;

          // Find actual mesh if it's wrapped in a group
          let actualMesh = this.ringMesh;
          if (!actualMesh.geometry) {
            actualMesh.traverse((child) => {
              if (child.isMesh && !actualMesh.geometry) {
                actualMesh = child;
              }
            });
          }

          // Center geometry and normalize to standard size
          if (actualMesh.geometry) {
            const box = new THREE.Box3().setFromObject(this.ringMesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            actualMesh.geometry.translate(-center.x, -center.y, -center.z);

            // Normalize to standard ring size (0.02 units = 2cm diameter)
            const maxDimension = Math.max(size.x, size.y, size.z);
            const targetSize = 0.02;
            this.autoNormalizeScale = targetSize / maxDimension;

            console.log(`    🎯 Centered geometry: offset (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
            console.log(`    📏 Model original size: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
            console.log(`    🔧 Auto-normalize scale: ${this.autoNormalizeScale.toFixed(6)} (${maxDimension.toFixed(3)} → ${targetSize})`);
          }

          // Apply auto-normalization + user modelScale
          const finalScale = this.autoNormalizeScale * this.config.modelScale;
          this.ringMesh.scale.set(finalScale, finalScale, finalScale);
          this.ringMesh.visible = false;
          this.scene.add(this.ringMesh);

          console.log(`    ✅ Ring loaded | Final scale: ${finalScale.toFixed(6)} (auto: ${this.autoNormalizeScale.toFixed(6)} × user: ${this.config.modelScale})`);
          resolve(this.ringMesh);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          console.log(`    📊 Loading ring model: ${percent}%`);
        },
        (error) => {
          console.error('    ❌ Error loading ring model:', error);
          console.error('    ❌ Model URL was:', this.config.modelURL);
          reject(error);
        }
      );
    });
  }

  /**
   * Add soft occluder for finger depth effect
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
    this.occluderMesh.scale.set(1.0, 1.0, 0.7);  // Flatten slightly
    this.occluderMesh.visible = false;

    this.scene.add(this.occluderMesh);
    console.log('Soft occluder added');
  }

  /**
   * Update ring position and orientation from MediaPipe landmarks
   * @param {Object} results - MediaPipe results with landmarks and worldLandmarks
   */
  updateFromLandmarks(results) {
    if (!results.landmarks || results.landmarks.length === 0) {
      this.hideRing();
      return;
    }

    // Get first hand
    const landmarks = results.landmarks[0];
    const worldLandmarks = results.worldLandmarks[0];
    const handedness = results.handedness[0][0].categoryName;  // "Left" or "Right"

    this.currentHandedness = handedness;

    // Get ring finger PIP (landmark 14 - where rings are worn)
    // Use NORMALIZED landmarks for position (camera-relative [0,1] coordinates)
    // World landmarks are hand-centric, not camera-centric!
    const COORD_SCALE = 5.0; // Scale to push hand to realistic distance (~0.38 units from camera)
    const normalizedPIP = landmarks[RING_CONFIG.PLACEMENT_LANDMARK];
    let position = CoordinateConverter.normalizedToThreeJS(normalizedPIP, COORD_SCALE);

    // Apply position smoothing
    position.x = this.positionFilters.x.filter(position.x);
    position.y = this.positionFilters.y.filter(position.y);
    position.z = this.positionFilters.z.filter(position.z);

    // Calculate rotation from normalized landmarks for camera-consistent orientation
    const normalizedMCP = landmarks[13]; // Ring finger base
    const normalizedDIP = landmarks[15]; // Ring finger top joint

    const mcpPos = CoordinateConverter.normalizedToThreeJS(normalizedMCP, COORD_SCALE);
    const pipPos = CoordinateConverter.normalizedToThreeJS(normalizedPIP, COORD_SCALE);
    const dipPos = CoordinateConverter.normalizedToThreeJS(normalizedDIP, COORD_SCALE);

    // Get two direction vectors for more stable orientation
    const dir1 = new THREE.Vector3().subVectors(pipPos, mcpPos).normalize();
    const dir2 = new THREE.Vector3().subVectors(dipPos, pipPos).normalize();
    const direction = new THREE.Vector3().addVectors(dir1, dir2).normalize();

    // Get wrist for perpendicular reference
    const wristPos = CoordinateConverter.normalizedToThreeJS(landmarks[0], COORD_SCALE);
    const toWrist = new THREE.Vector3().subVectors(wristPos, position).normalize();

    // Create orthogonal basis
    const right = new THREE.Vector3().crossVectors(direction, toWrist).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();

    // Build rotation matrix from basis vectors
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(direction, up, right);

    const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    // Update ring mesh
    if (this.ringMesh) {
      this.ringMesh.position.copy(position);
      this.ringMesh.quaternion.copy(quaternion);

      // Apply auto-normalization + user modelScale
      const finalScale = this.autoNormalizeScale * this.config.modelScale;

      // Debug: Log actual scale being applied
      if (Math.random() < 0.02) {
        console.log(`[SCALE DEBUG] Final scale: ${finalScale.toFixed(6)} (auto: ${this.autoNormalizeScale.toFixed(6)} × user: ${this.config.modelScale})`);
      }

      this.ringMesh.scale.setScalar(finalScale);
      this.ringMesh.visible = true;
      this.isRingVisible = true;
    }

    // Update occluder
    if (this.occluderMesh) {
      this.occluderMesh.position.copy(position);
      this.occluderMesh.quaternion.copy(quaternion);
      this.occluderMesh.visible = true;
    }
  }

  /**
   * Hide ring when hand not detected
   */
  hideRing() {
    if (this.ringMesh) {
      this.ringMesh.visible = false;
    }
    if (this.occluderMesh) {
      this.occluderMesh.visible = false;
    }
    this.isRingVisible = false;

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
   * Handle window resize
   */
  handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

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
    this.alpha = alpha; // 0 = no smoothing, 1 = no filtering
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
