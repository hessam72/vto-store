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
          this.ringMesh = gltf.scene.children[0];

          // Center geometry to eliminate pivot offset (prevents scale-induced misplacement)
          const box = new THREE.Box3().setFromObject(this.ringMesh);
          const center = box.getCenter(new THREE.Vector3());
          this.ringMesh.geometry.translate(-center.x, -center.y, -center.z);
          console.log(`    🎯 Centered geometry: offset (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);

          this.ringMesh.scale.set(
            this.config.modelScale,
            this.config.modelScale,
            this.config.modelScale
          );
          this.ringMesh.visible = false;
          this.scene.add(this.ringMesh);

          console.log('    ✅ Ring model loaded and added to scene');
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
    const normalizedPIP = landmarks[RING_CONFIG.PLACEMENT_LANDMARK];
    let position = CoordinateConverter.normalizedToThreeJS(normalizedPIP, 1.0);

    // Apply position smoothing
    position.x = this.positionFilters.x.filter(position.x);
    position.y = this.positionFilters.y.filter(position.y);
    position.z = this.positionFilters.z.filter(position.z);

    // Adaptive ring sizing based on finger width
    const fingerWidth = CoordinateConverter.landmarkDistance(
      worldLandmarks[9],  // Middle finger MCP
      worldLandmarks[13]  // Ring finger MCP
    );
    // Map typical finger spacing (0.02-0.04m) to ring scale
    const ringScale = THREE.MathUtils.mapLinear(
      fingerWidth,
      0.02, 0.04,  // Min/max finger spacing in meters
      0.08, 0.15   // Min/max ring scale (geometry centered, proper range)
    );

    // Debug logging (remove after testing)
    if (Math.random() < 0.02) { // Log 2% of frames
      console.log(`[NORMALIZED] Pos: (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}) | Scale: ${ringScale.toFixed(3)} | FingerWidth: ${fingerWidth.toFixed(3)}m`);
    }

    // Calculate rotation from normalized landmarks for camera-consistent orientation
    const normalizedMCP = landmarks[13]; // Ring finger base
    const normalizedDIP = landmarks[15]; // Ring finger top joint

    const mcpPos = CoordinateConverter.normalizedToThreeJS(normalizedMCP, 1.0);
    const pipPos = CoordinateConverter.normalizedToThreeJS(normalizedPIP, 1.0);
    const dipPos = CoordinateConverter.normalizedToThreeJS(normalizedDIP, 1.0);

    // Get two direction vectors for more stable orientation
    const dir1 = new THREE.Vector3().subVectors(pipPos, mcpPos).normalize();
    const dir2 = new THREE.Vector3().subVectors(dipPos, pipPos).normalize();
    const direction = new THREE.Vector3().addVectors(dir1, dir2).normalize();

    // Get wrist for perpendicular reference
    const wristPos = CoordinateConverter.normalizedToThreeJS(landmarks[0], 1.0);
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
      this.ringMesh.scale.setScalar(ringScale); // Adaptive sizing (now safe - geometry centered)
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
