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

    // Camera
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.z = 5;
    console.log('  📌 Camera created');

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

    // Get ring finger MCP (landmark 13)
    const ringMCP = worldLandmarks[RING_CONFIG.PLACEMENT_LANDMARK];

    // Convert to Three.js coordinates (meters to cm)
    const position = CoordinateConverter.worldToThreeJS(ringMCP, 100);

    // Calculate rotation from finger orientation
    const ringBase = worldLandmarks[RING_CONFIG.OCCLUDER_AXIS.base];
    const ringTip = worldLandmarks[RING_CONFIG.OCCLUDER_AXIS.tip];

    const basePos = CoordinateConverter.worldToThreeJS(ringBase, 100);
    const tipPos = CoordinateConverter.worldToThreeJS(ringTip, 100);

    // Direction vector from base to tip
    const direction = new THREE.Vector3().subVectors(tipPos, basePos).normalize();

    // Create rotation matrix
    const up = new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(up, direction).normalize();
    const actualUp = new THREE.Vector3().crossVectors(direction, right);

    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, direction, actualUp);

    const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    // Update ring mesh
    if (this.ringMesh) {
      this.ringMesh.position.copy(position);
      this.ringMesh.quaternion.copy(quaternion);
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
