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

    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ringMesh = null;
    this.occluderMesh = null;

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

    // Create camera
    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.z = 100;

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
   * Update ring position and rotation
   * @param {Object} transform - {position: Vector3, rotation: Quaternion, visible: boolean}
   */
  updateRingTransform(transform) {
    if (!this.ringMesh) return;

    if (transform.visible) {
      this.ringMesh.visible = true;
      this.ringMesh.position.copy(transform.position);
      this.ringMesh.quaternion.copy(transform.rotation);

      // Update occluder to follow ring
      if (this.occluderMesh) {
        this.occluderMesh.visible = true;
        this.occluderMesh.position.copy(transform.position);
        // Occluder rotation is relative to ring, keep its local rotation
      }
    } else {
      this.ringMesh.visible = false;
      if (this.occluderMesh) {
        this.occluderMesh.visible = false;
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

    this.renderer.dispose();
    console.log('Three.js scene destroyed');
  }
}
