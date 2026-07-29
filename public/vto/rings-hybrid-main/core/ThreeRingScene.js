/**
 * Three.js Ring Scene Manager
 *
 * The scene works in metres, with the camera at the origin looking down -Z.
 * The camera's projection is configured by HandPoseSolver.updateCamera() so it
 * matches the physical webcam over the region of video actually on screen.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const NEAR_M = 0.02;
const FAR_M = 10;

// Switching back to an already-seen ring should not refetch it. Cache holds the
// decoded response, so a repeat load is a parse rather than a download.
THREE.Cache.enabled = true;
const gltfLoader = new GLTFLoader();

/**
 * Free everything a GLB subtree holds on the GPU.
 *
 * material.dispose() releases the program but not the images bound to it, so a
 * catalogue cycled a few dozen times would leak every map it ever loaded. The
 * material's own properties are walked to find them, which covers whichever of
 * map / normalMap / roughnessMap / … a given GLB happens to use.
 */
function disposeSubtree(root) {
  root.traverse((object) => {
    object.geometry?.dispose();

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** The narrowest bounding-box axis of a ring is the one its hole runs along. */
function detectHoleAxis({ x, y, z }) {
  if (x <= y && x <= z) return 'x';
  if (z <= x && z <= y) return 'z';
  return 'y';
}

export class ThreeRingScene {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.debugParams = null; // Set by DebugPanel

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ringMesh = null;
    this.ringPivot = null;
    this.occluderMesh = null;
    this.debugMarker = null;

    // Outer diameter of the loaded GLB in its own units, measured once so the
    // model can be scaled to the hand. public/models is not in the repo, so the
    // GLB's authoring units are unknown and must be derived rather than assumed.
    this.modelBaseDiameter = 1;

    // Bounding-box extents of the loaded GLB, kept so the hole axis can be
    // re-derived without re-fetching the model.
    this.modelExtents = null;
    this.detectedHoleAxis = null;

    // Bumped on every load. A load whose token is stale by the time it resolves
    // lost a race to a later switch, and throws its result away rather than
    // overwriting the ring the user actually asked for.
    this._loadToken = 0;

    this._onResize = () => this.handleResize();

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();

    // FOV and aspect are set every frame by HandPoseSolver.updateCamera().
    this.camera = new THREE.PerspectiveCamera(60, 1, NEAR_M, FAR_M);
    this.camera.position.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearAlpha(0);
    this.handleResize();

    this.setupLighting();
    this.createDebugMarker();

    window.addEventListener('resize', this._onResize);

    console.log('Three.js scene initialized (metric, camera at origin)');
  }

  /**
   * Size the drawing buffer.
   *
   * setSize() takes CSS pixels and derives the buffer from the pixel ratio, so
   * the backing store must not be set by hand. The previous code passed the
   * already-multiplied buffer width back into setSize(), which wrote an inline
   * CSS width of twice the viewport on any HiDPI display — the whole scene
   * rendered at 2x into the top-left quadrant, which is why the ring was offset
   * and moved at twice the hand's speed.
   */
  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Canvas size in CSS pixels, for the cover-fit maths in the solver. */
  getViewSize() {
    return {
      canvasWidth: this.canvas.clientWidth || window.innerWidth,
      canvasHeight: this.canvas.clientHeight || window.innerHeight
    };
  }

  setupLighting() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);

    new RGBELoader().load(
      '/models/envmaps/hotel_room_1k.hdr',
      (texture) => {
        this.scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        pmremGenerator.dispose();
        console.log('Environment map loaded');
      },
      undefined,
      (error) => {
        console.warn('Environment map failed to load, using basic lighting', error);
        pmremGenerator.dispose();
        const ambient = new THREE.AmbientLight(0xffffff, 1.5);
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(0.5, 0.5, 1);
        this.scene.add(ambient, key);
      }
    );
  }

  /**
   * Small disc pinned to the solved anchor. Sized in metres — the previous
   * CircleGeometry(0.5) was a half-metre disc, which filled the screen.
   */
  createDebugMarker() {
    const geometry = new THREE.CircleGeometry(0.004, 24);
    const material = new THREE.MeshBasicMaterial({
      color: 0x2196f3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false
    });

    this.debugMarker = new THREE.Mesh(geometry, material);
    this.debugMarker.renderOrder = 999;
    this.debugMarker.visible = false;
    this.scene.add(this.debugMarker);
  }

  /**
   * Load a ring, replacing whatever is currently worn.
   *
   * Safe to call repeatedly: the previous model is removed and disposed first,
   * and updateRingTransform() already skips a null pivot, so the ring simply
   * goes unrendered for the frames the load spans instead of flickering the old
   * model at the new one's scale.
   *
   * @param {string} [url] - GLB to load. Defaults to the configured single model.
   */
  async loadRingModel(url = this.config.modelURL) {
    const token = ++this._loadToken;
    this.disposeRingModel();

    return new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          // A newer switch already started: this result is stale.
          if (token !== this._loadToken) {
            disposeSubtree(gltf.scene);
            resolve(null);
            return;
          }

          // A pivot decouples the fitted scale from the model's own transform,
          // so the GLB can keep whatever root transform it was exported with.
          this.ringPivot = new THREE.Group();
          this.ringMesh = gltf.scene;

          const box = new THREE.Box3().setFromObject(this.ringMesh);
          this.modelExtents = box.getSize(new THREE.Vector3());

          if (this.config.debug.meshMaterial) {
            this.ringMesh.traverse((child) => {
              if (child.isMesh) child.material = new THREE.MeshNormalMaterial();
            });
          }

          this.ringPivot.add(this.ringMesh);
          this.ringPivot.visible = false;
          this.scene.add(this.ringPivot);

          // Mandatory on every load, not just the first: modelBaseDiameter is
          // measured per model and drives the fit-to-finger scale, so a swap
          // that skipped this would wear the new ring at the old one's size.
          this.applyHoleAxis(this.config.ring.holeAxis);

          // Let a debug-panel override re-apply itself to the new mesh.
          this._appliedHoleAxis = null;

          resolve(this.ringPivot);
        },
        (progress) => {
          if (progress.total > 0) {
            console.log(`Loading ring model: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
          }
        },
        (error) => {
          console.error('Error loading ring model:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Detach and free the worn ring. Without this a switch would orphan the old
   * pivot inside the scene graph — still drawn, still holding GPU memory.
   */
  disposeRingModel() {
    if (!this.ringPivot) return;

    this.scene.remove(this.ringPivot);
    disposeSubtree(this.ringPivot);

    this.ringPivot = null;
    this.ringMesh = null;
    this.modelExtents = null;
    this.modelBaseDiameter = 1;
  }

  /**
   * Rotate the model so its hole runs along +Y, which is the finger axis in the
   * solver's frame. A GLB authored with the hole on X or Z otherwise renders
   * standing across the finger instead of encircling it.
   *
   * The axis is detected from the geometry rather than configured per model: a
   * ring is a flat torus, so two bounding-box extents are the diameter and the
   * third — the narrowest — is the band width, which runs along the hole. That
   * holds even with a gem, since a gem grows a radial extent and never the
   * narrowest one.
   *
   * @param {'auto'|'x'|'y'|'z'} preference
   */
  applyHoleAxis(preference = 'auto') {
    if (!this.ringMesh || !this.modelExtents) return;

    const extents = this.modelExtents;
    const axis = preference === 'auto' ? detectHoleAxis(extents) : preference;
    this.detectedHoleAxis = axis;

    // Bring the hole axis onto +Y.
    this.ringMesh.quaternion.identity();
    this.ringMesh.position.set(0, 0, 0);
    if (axis === 'x') this.ringMesh.rotateZ(Math.PI / 2);
    else if (axis === 'z') this.ringMesh.rotateX(-Math.PI / 2);

    // Recentre after rotating — the pivot must sit at the ring's centre so the
    // per-frame pose rotates it about the finger and not about the GLB's origin.
    this.ringMesh.updateMatrixWorld(true);
    const rotatedBox = new THREE.Box3().setFromObject(this.ringMesh);
    this.ringMesh.position.sub(rotatedBox.getCenter(new THREE.Vector3()));

    // Diameter comes from the two extents perpendicular to the hole. The
    // smaller of them is used because a gem inflates one radial direction, and
    // taking the max there would undersize the band against the finger.
    const [d1, d2] = ['x', 'y', 'z'].filter((a) => a !== axis).map((a) => extents[a]);
    this.modelBaseDiameter = Math.min(d1, d2) || 1;

    console.log(
      `Ring model oriented | bbox ${extents.x.toFixed(3)} x ${extents.y.toFixed(3)} x ${extents.z.toFixed(3)} ` +
      `| hole axis ${axis}${preference === 'auto' ? ' (auto)' : ' (forced)'} ` +
      `| diameter ${this.modelBaseDiameter.toFixed(4)}`
    );
  }

  /**
   * Depth-only cylinder standing in for the finger, so the far side of the band
   * is hidden. It must stay opaque: with transparent:true it lands in the
   * transparent pass, where renderOrder no longer places it ahead of the ring.
   * Its size comes from the measured finger, not from constants.
   */
  addSoftOccluder() {
    if (!this.config.occluder.enabled) return;

    // Unit cylinder (radius 0.5, height 1) along Y, scaled per frame to match
    // the finger. Y is the finger axis in the solver's frame.
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true);

    const debug = this.config.occluder.debug;
    const material = new THREE.MeshBasicMaterial({
      colorWrite: debug,
      depthWrite: true,
      transparent: false,
      side: THREE.DoubleSide,
      ...(debug ? { color: new THREE.Color(0xff00ff), wireframe: true } : {})
    });

    this.occluderMesh = new THREE.Mesh(geometry, material);
    this.occluderMesh.renderOrder = -1;
    this.occluderMesh.visible = false;

    this.scene.add(this.occluderMesh);
    console.log('Soft occluder added (opaque, depth-only)');
  }

  /**
   * @param {Object} transform - Result of RingPositioner.calculate().
   */
  updateRingTransform(transform) {
    // The hole-axis correction is baked in at load, so a live change to it has
    // to re-run the orientation. Cheap, and only when the value actually moves.
    const holeAxis = this.debugParams?.holeAxis;
    if (holeAxis && holeAxis !== this._appliedHoleAxis) {
      this._appliedHoleAxis = holeAxis;
      this.applyHoleAxis(holeAxis);
    }

    if (!transform.visible) {
      if (this.ringPivot) this.ringPivot.visible = false;
      if (this.occluderMesh) this.occluderMesh.visible = false;
      if (this.debugMarker) this.debugMarker.visible = false;
      return;
    }

    const { fingerWidth } = transform;

    if (this.ringPivot) {
      this.ringPivot.visible = true;
      this.ringPivot.position.copy(transform.position);
      this.ringPivot.quaternion.copy(transform.rotation);

      // Fit the ring to the finger: target outer diameter in metres divided by
      // the model's own diameter. No magic numbers, and it tracks the hand as
      // it moves nearer or further.
      const ratio = this.debugParams?.outerDiameterRatio ?? this.config.ring.outerDiameterRatio;
      const targetDiameter = fingerWidth * ratio;
      this.ringPivot.scale.setScalar(targetDiameter / this.modelBaseDiameter);
    }

    if (this.occluderMesh) {
      const { radiusRatio, lengthRatio, flattenCoeff } = this.config.occluder;
      const diameter = fingerWidth * radiusRatio * 2;

      this.occluderMesh.visible = true;
      this.occluderMesh.position.copy(transform.position);
      this.occluderMesh.quaternion.copy(transform.fingerRotation);
      this.occluderMesh.scale.set(
        diameter,
        fingerWidth * lengthRatio,
        diameter * flattenCoeff
      );
    }

    if (this.debugMarker) {
      const show = this.debugParams?.showMarker ?? this.config.debug.marker;
      this.debugMarker.visible = show;
      if (show) {
        this.debugMarker.position.copy(transform.position);
        this.debugMarker.quaternion.copy(this.camera.quaternion);
      }
    }

    if (this.config.debug.logPositions) {
      console.log(
        `depth ${(transform.depth * 100).toFixed(1)}cm | ` +
        `finger ${(fingerWidth * 1000).toFixed(1)}mm | ` +
        `pos ${transform.position.x.toFixed(3)}, ${transform.position.y.toFixed(3)}, ${transform.position.z.toFixed(3)}`
      );
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);

    // Strands any load still in flight, so it cannot attach to a dead scene.
    this._loadToken++;

    disposeSubtree(this.scene);

    this.scene.environment?.dispose();
    this.renderer.dispose();
    console.log('Three.js scene destroyed');
  }
}
