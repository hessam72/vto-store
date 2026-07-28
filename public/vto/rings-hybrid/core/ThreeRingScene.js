/**
 * Three.js Ring Scene Manager
 * Handles 3D scene, ring model, and soft occluder
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class ThreeRingScene {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.debugParams = null; // Set by DebugPanel

    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ringMesh = null;
    this.occluderMesh = null;
    this.debugMarker = null; // Blue circle for ring finger position

    this.init();
  }

  /**
   * Initialize Three.js scene
   */
  init() {
    // Set canvas size to match viewport
    this.resizeCanvas();

    // Create scene
    this.scene = new THREE.Scene();

    // Create camera with realistic FOV matching video perspective
    const aspect = this.canvas.width / this.canvas.height;
    const videoHeight = this.canvas.height || 720;
    const focalLengthPx = videoHeight * 0.7;  // Realistic webcam focal length
    const fov = 2 * Math.atan(videoHeight / (2 * focalLengthPx)) * (180 / Math.PI);
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 50);
    this.camera.position.z = 20;  // AR overlay alignment

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Setup lighting
    this.setupLighting();

    // Create debug marker (blue circle on ring finger)
    this.createDebugMarker();

    console.log('Three.js scene initialized');
  }

  /**
   * Resize canvas to match viewport
   */
  resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    this.canvas.width = width * pixelRatio;
    this.canvas.height = height * pixelRatio;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
  }

  /**
   * Setup HDR environment lighting
   */
  setupLighting() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .load('/models/envmaps/hotel_room_1k.hdr', (texture) => {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        pmremGenerator.dispose();
        this.scene.environment = envMap;
        console.log('Environment map loaded');
      }, undefined, (error) => {
        console.warn('Environment map failed to load, using basic lighting', error);
        // Fallback to basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight);
        this.scene.add(directionalLight);
      });
  }

  /**
   * Create debug marker (blue circle on ring finger)
   */
  createDebugMarker() {
    const geometry = new THREE.CircleGeometry(0.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0000ff, // Blue
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthTest: false // Always visible on top
    });

    this.debugMarker = new THREE.Mesh(geometry, material);
    this.debugMarker.renderOrder = 999; // Render on top
    this.debugMarker.visible = true;

    this.scene.add(this.debugMarker);
    console.log('Debug marker created');
  }

  /**
   * Load ring model
   */
  async loadRingModel() {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();

      loader.load(
        this.config.modelURL,
        (gltf) => {
          this.ringMesh = gltf.scene.children[0];

          // Apply scale
          this.ringMesh.scale.set(
            this.config.modelScale,
            this.config.modelScale,
            this.config.modelScale
          );

          // Debug material
          if (this.config.debug.meshMaterial) {
            this.ringMesh.traverse((child) => {
              if (child.material) {
                child.material = new THREE.MeshNormalMaterial();
              }
            });
          }

          this.ringMesh.visible = false;
          this.scene.add(this.ringMesh);

          console.log('Ring model loaded');
          resolve(this.ringMesh);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`Loading ring model: ${percent.toFixed(1)}%`);
        },
        (error) => {
          console.error('Error loading ring model:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Add soft occluder (ported from WebARRocks)
   */
  addSoftOccluder() {
    if (!this.config.occluder.enabled) return;

    const radiusOuter = this.config.occluder.radiusRange[1];
    const radiusInner = this.config.occluder.radiusRange[0];
    const height = this.config.occluder.height;
    const flattenCoeff = this.config.occluder.flattenCoeff;

    // Create cylinder geometry for finger occluder
    const geometry = new THREE.CylinderGeometry(
      radiusOuter,
      radiusOuter,
      height,
      32,
      1,
      true
    );

    // Occluder material (depth-only, no color)
    const material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });

    if (this.config.debug.occluder) {
      // Debug mode: make occluder visible
      material.colorWrite = true;
      material.color = new THREE.Color(0xff00ff);
      material.opacity = 0.3;
      material.transparent = true;
    }

    this.occluderMesh = new THREE.Mesh(geometry, material);

    // Apply offset
    this.occluderMesh.position.set(
      this.config.occluder.offset[0],
      this.config.occluder.offset[1],
      this.config.occluder.offset[2]
    );

    // Apply rotation (90° around X-axis)
    this.occluderMesh.quaternion.set(
      this.config.occluder.quaternion[0],
      this.config.occluder.quaternion[1],
      this.config.occluder.quaternion[2],
      this.config.occluder.quaternion[3]
    );

    // Apply flattening
    this.occluderMesh.scale.set(1.0, 1.0, flattenCoeff);

    // Render occluder first (before ring)
    this.occluderMesh.renderOrder = -1e12;
    this.occluderMesh.visible = false;

    this.scene.add(this.occluderMesh);
    console.log('Soft occluder added');
  }

  /**
   * Update camera settings from debug params
   */
  updateCameraSettings() {
    if (!this.camera || !this.debugParams) return;

    // Update camera Z position
    if (this.debugParams.cameraZ !== undefined) {
      this.camera.position.z = this.debugParams.cameraZ;
    }

    // Update camera FOV
    if (this.debugParams.cameraFOV !== undefined) {
      this.camera.fov = this.debugParams.cameraFOV;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Update ring position and rotation
   * @param {Object} transform - {position: Vector3, rotation: Quaternion, visible: boolean}
   */
  updateRingTransform(transform) {
    if (!this.ringMesh) return;

    // Update camera settings if debug params available
    this.updateCameraSettings();

    if (transform.visible) {
      this.ringMesh.visible = true;
      this.ringMesh.position.copy(transform.position);
      this.ringMesh.quaternion.copy(transform.rotation);

      // Apply debug model scale if available
      const scale = this.debugParams?.modelScale ?? this.config.modelScale;
      this.ringMesh.scale.setScalar(scale);

      // Update occluder to follow ring
      if (this.occluderMesh) {
        this.occluderMesh.visible = true;
        this.occluderMesh.position.copy(transform.position);
        // Occluder rotation is relative to ring, keep its local rotation
      }

      // Update debug marker to follow ring finger (2D screen position)
      if (this.debugMarker && transform.rawLandmark) {
        this.debugMarker.visible = true;

        // Convert MediaPipe normalized coords [0,1] to centered [-0.5, 0.5]
        const normX = transform.rawLandmark.x - 0.5;
        const normY = -(transform.rawLandmark.y - 0.5); // Flip Y for Three.js

        // Use same distance calculation as GLB for comparison
        const depthScale = this.debugParams?.globalScale ?? 1.0;
        const depthMult = this.debugParams?.depthMultiplier ?? 1.0;
        const distance = depthScale + (transform.rawLandmark.z * depthScale * depthMult);

        // Calculate camera frustum size at distance
        const vFOV = this.camera.fov * (Math.PI / 180);
        const height = 2 * Math.tan(vFOV / 2) * distance;
        const width = height * this.camera.aspect;

        // Map normalized coords to frustum at distance
        const x = normX * width;
        const y = normY * height;
        const z = this.camera.position.z - distance;

        const pos = new THREE.Vector3(x, y, z);
        this.debugMarker.position.copy(pos);
        this.debugMarker.lookAt(this.camera.position);

        // Log positions for debugging
        console.log('MediaPipe raw landmark (normalized 0-1):', {
          x: transform.rawLandmark.x.toFixed(3),
          y: transform.rawLandmark.y.toFixed(3),
          z: transform.rawLandmark.z.toFixed(3)
        });
        console.log('MediaPipe Yellow Dot (canvas pixels):', {
          x: (transform.rawLandmark.x * this.canvas.width).toFixed(1),
          y: (transform.rawLandmark.y * this.canvas.height).toFixed(1)
        });
        console.log('Ring GLB position (3D transformed):', {
          x: transform.position.x.toFixed(3),
          y: transform.position.y.toFixed(3),
          z: transform.position.z.toFixed(3)
        });
        console.log('Blue dot position (2D overlay):', {
          x: pos.x.toFixed(3),
          y: pos.y.toFixed(3),
          z: pos.z.toFixed(3)
        });
        console.log('---');
      }
    } else {
      this.ringMesh.visible = false;
      if (this.occluderMesh) {
        this.occluderMesh.visible = false;
      }
      if (this.debugMarker) {
        this.debugMarker.visible = false;
      }
    }
  }

  /**
   * Render scene
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update camera aspect ratio
   */
  updateCameraAspect() {
    this.resizeCanvas();
    this.camera.aspect = this.canvas.width / this.canvas.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.canvas.width, this.canvas.height);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.ringMesh) {
      this.scene.remove(this.ringMesh);
      this.ringMesh.geometry?.dispose();
      this.ringMesh.material?.dispose();
    }

    if (this.occluderMesh) {
      this.scene.remove(this.occluderMesh);
      this.occluderMesh.geometry?.dispose();
      this.occluderMesh.material?.dispose();
    }

    if (this.debugMarker) {
      this.scene.remove(this.debugMarker);
      this.debugMarker.geometry?.dispose();
      this.debugMarker.material?.dispose();
    }

    this.renderer.dispose();
    console.log('Three.js scene destroyed');
  }
}
