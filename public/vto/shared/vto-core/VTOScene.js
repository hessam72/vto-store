/**
 * VTO Scene — renderer, camera, model fitting and occlusion.
 *
 * Works in metres, camera at the origin looking down -Z. The camera's projection
 * is configured every frame by HandSolver.updateCamera() so it matches the
 * physical webcam over the region of video actually on screen.
 *
 * Product-agnostic: the only things it needs from a product are a config and the
 * per-frame transform produced by ProductPositioner.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const NEAR_M = 0.02;
const FAR_M = 10;

/**
 * Which bounding-box axis the product's bore runs along.
 *
 * There is no single rule, because the two product shapes are opposites:
 *
 *  - `narrowest` — a ring or a closed bracelet is a flat torus: two extents are
 *    the diameter and the third, the band width, runs along the bore. Survives a
 *    gem, since a gem grows a radial extent and never the narrowest one.
 *
 *  - `longest` — an open watch (a case plus two strap stubs, which is how most
 *    watch GLBs are authored) is *elongated* along the bore instead: the strap
 *    runs up and down the arm while the case is wider than it is thick. Applying
 *    the ring rule to one picks the case thickness and stands the watch on end.
 *
 * A shape heuristic cannot separate these reliably — a solitaire ring and an open
 * watch have similarly lopsided bounding boxes — so it is a per-product policy.
 * The load-time log names both the policy and the axis chosen. A closed-loop
 * watch model behaves like a bracelet and wants `narrowest`, or an explicit axis.
 */
function detectBoreAxis({ x, y, z }, policy = 'narrowest') {
  const axes = [['x', x], ['y', y], ['z', z]];
  axes.sort((a, b) => a[1] - b[1]);
  return policy === 'longest' ? axes[2][0] : axes[0][0];
}

export class VTOScene {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.debugParams = null; // Set by DebugPanel

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.productMesh = null;
    this.productPivot = null;
    this.occluderMesh = null;
    this.debugMarker = null;

    // Bounding-box extents of the loaded GLB in its own units, kept so the bore
    // axis can be re-derived without re-fetching the model. Authoring units vary
    // wildly between tools, so everything is measured rather than assumed.
    this.modelExtents = null;
    this.detectedBoreAxis = null;
    this.modelBoreDiameter = 1;
    this.modelMaxDiameter = 1;

    this._onResize = () => this.handleResize();

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();

    // FOV and aspect are set every frame by HandSolver.updateCamera().
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

    console.log('VTO scene initialized (metric, camera at origin)');
  }

  /**
   * Size the drawing buffer.
   *
   * setSize() takes CSS pixels and derives the buffer from the pixel ratio, so
   * the backing store must not be set by hand. Passing an already-multiplied
   * buffer width back into setSize() writes an inline CSS size of viewport x DPR,
   * which renders the scene oversized into the top-left corner on every HiDPI
   * display while looking perfect at DPR 1.
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
      this.config.envMapURL,
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

  /** Small disc pinned to the solved anchor, sized in metres. */
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

  async loadModel() {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(
        this.config.modelURL,
        (gltf) => {
          // A pivot decouples the fitted scale from the model's own transform, so
          // the GLB can keep whatever root transform it was exported with.
          this.productPivot = new THREE.Group();
          this.productMesh = gltf.scene;

          const box = new THREE.Box3().setFromObject(this.productMesh);
          this.modelExtents = box.getSize(new THREE.Vector3());

          if (this.config.debug.meshMaterial) {
            this.productMesh.traverse((child) => {
              if (child.isMesh) child.material = new THREE.MeshNormalMaterial();
            });
          }

          this.productPivot.add(this.productMesh);
          this.productPivot.visible = false;
          this.scene.add(this.productPivot);

          this.applyBoreAxis(this.config.product.boreAxis);

          resolve(this.productPivot);
        },
        (progress) => {
          if (progress.total > 0) {
            console.log(`Loading model: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
          }
        },
        (error) => {
          console.error('Error loading model:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Rotate the model so its bore runs along +Y, which is the primary anatomical
   * axis in the solver's frame — the finger for a ring, the forearm for a watch
   * or bracelet. A GLB authored with the bore on X or Z otherwise renders
   * standing across the body part instead of encircling it.
   *
   * @param {'auto'|'x'|'y'|'z'} preference
   */
  applyBoreAxis(preference = 'auto') {
    if (!this.productMesh || !this.modelExtents) return;

    const extents = this.modelExtents;
    const policy = this.debugParams?.boreAxisPolicy ?? this.config.product.boreAxisPolicy ?? 'narrowest';
    const axis = preference === 'auto' ? detectBoreAxis(extents, policy) : preference;
    this.detectedBoreAxis = axis;

    // Bring the bore axis onto +Y.
    this.productMesh.quaternion.identity();
    this.productMesh.position.set(0, 0, 0);
    if (axis === 'x') this.productMesh.rotateZ(Math.PI / 2);
    else if (axis === 'z') this.productMesh.rotateX(-Math.PI / 2);

    // Recentre after rotating — the pivot must sit at the product's centre so
    // the per-frame pose rotates it about the body part and not the GLB origin.
    this.productMesh.updateMatrixWorld(true);
    const rotatedBox = new THREE.Box3().setFromObject(this.productMesh);
    this.productMesh.position.sub(rotatedBox.getCenter(new THREE.Vector3()));

    // Two diameters from the extents perpendicular to the bore:
    //  - bore diameter: the SMALLER, because a gem or a watch case inflates one
    //    radial direction and taking the max would undersize the band;
    //  - max diameter: the LARGER, which is the watch case's own size.
    const [d1, d2] = ['x', 'y', 'z'].filter((a) => a !== axis).map((a) => extents[a]);
    this.modelBoreDiameter = Math.min(d1, d2) || 1;
    this.modelMaxDiameter = Math.max(d1, d2) || 1;

    console.log(
      `Model oriented | bbox ${extents.x.toFixed(3)} x ${extents.y.toFixed(3)} x ${extents.z.toFixed(3)} ` +
      `| bore axis ${axis}${preference === 'auto' ? ` (auto, ${policy})` : ' (forced)'} ` +
      `| bore ${this.modelBoreDiameter.toFixed(4)} max ${this.modelMaxDiameter.toFixed(4)}`
    );
  }

  /**
   * Depth-only proxy for the body part, so the far side of a band is hidden.
   *
   * Must stay opaque: with transparent:true it lands in the transparent pass,
   * where renderOrder no longer sequences it ahead of the product and it
   * silently stops occluding. Scaled per frame from the measured anatomy.
   */
  addOccluder() {
    if (!this.config.occluder.enabled) return;

    // Unit cylinder (radius 0.5, height 1) along Y — the primary axis.
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
    console.log('Occluder added (opaque, depth-only)');
  }

  /**
   * Scale factor to fit the model to the body part.
   *
   * Two modes, and using the wrong one is a real product bug:
   *  - `fit`: the bore wraps the anatomy, so the model scales with the measured
   *    body part. Correct for rings and bracelets, whose size is set by the wearer.
   *  - `absolute`: the model is scaled to a real-world millimetre dimension from
   *    the product spec. Correct for watches, where the case size (38/40/42/44mm)
   *    is exactly what the customer is shopping for. Fitting a watch to the wrist
   *    would make every case look identical on every arm.
   *
   * Absolute sizing is only possible because the whole pipeline is metric.
   */
  fitScale(width) {
    const { sizing } = this.config.product;

    if (sizing.mode === 'absolute') {
      const diameterM = (this.debugParams?.absoluteDiameterMm ?? sizing.diameterMm) * 0.001;
      return diameterM / this.modelMaxDiameter;
    }

    const ratio = this.debugParams?.boreDiameterRatio ?? sizing.boreDiameterRatio;
    return (width * ratio) / this.modelBoreDiameter;
  }

  /**
   * @param {Object} transform - Result of ProductPositioner.calculate().
   */
  updateTransform(transform) {
    // The bore-axis correction is baked in at load, so a live change has to
    // re-run the orientation. Cheap, and only when the value actually moves.
    const boreAxis = this.debugParams?.boreAxis;
    if (boreAxis && boreAxis !== this._appliedBoreAxis) {
      this._appliedBoreAxis = boreAxis;
      this.applyBoreAxis(boreAxis);
    }

    if (!transform.visible) {
      if (this.productPivot) this.productPivot.visible = false;
      if (this.occluderMesh) this.occluderMesh.visible = false;
      if (this.debugMarker) this.debugMarker.visible = false;
      return;
    }

    if (this.productPivot) {
      this.productPivot.visible = true;
      this.productPivot.position.copy(transform.position);
      this.productPivot.quaternion.copy(transform.rotation);
      this.productPivot.scale.setScalar(this.fitScale(transform.width));
    }

    if (this.occluderMesh) {
      const { lengthRatio, proximalBias } = this.config.occluder;

      this.occluderMesh.visible = true;
      this.occluderMesh.quaternion.copy(transform.bodyRotation);
      // Elliptical cross-section: a wrist is ~0.72 as deep as it is broad. A
      // finger passes thickness === width and gets a round one.
      this.occluderMesh.scale.set(
        transform.width,
        transform.width * lengthRatio,
        transform.thickness
      );
      // Slide the cylinder along the limb so it covers more of the proximal side
      // — a watch strap must not poke out past the end of the occluder.
      this.occluderMesh.position
        .copy(transform.position)
        .addScaledVector(transform.primaryAxis, transform.width * lengthRatio * proximalBias);
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
        `width ${(transform.width * 1000).toFixed(1)}mm | ` +
        `pos ${transform.position.x.toFixed(3)}, ${transform.position.y.toFixed(3)}, ${transform.position.z.toFixed(3)}`
      );
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);

    this.scene.traverse((object) => {
      object.geometry?.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });

    this.scene.environment?.dispose();
    this.renderer.dispose();
    console.log('VTO scene destroyed');
  }
}
