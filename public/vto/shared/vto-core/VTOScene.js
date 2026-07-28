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

const AXES = ['x', 'y', 'z'];

// An axis only counts as the bore if the geometry is convincingly annular about
// it, and clearly more so than the runner-up. Below either threshold the shape is
// not a recognizable loop and the configured bbox policy decides instead.
const ANNULARITY_MIN = 0.25;
const ANNULARITY_MARGIN = 1.6;

/** Value at a percentile of an already-sorted array. */
function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
  return sorted[index];
}

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

/** 1st-percentile radius about a candidate centre — i.e. how big the hole is. */
function holeRadius(a, b, cx, cy) {
  const radii = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) radii[i] = Math.hypot(a[i] - cx, b[i] - cy);
  radii.sort();
  return percentile(radii, 0.01);
}

const COVERAGE_BINS = 16;

/**
 * Fraction of directions around a centre that have geometry in them.
 *
 * This is what separates a bore from a coincidental gap. A torus seen edge-on
 * also has empty space in the middle of its projection — two blobs either side —
 * so a hole-size measure alone rates the wrong axis just as highly as the right
 * one. But only the true bore has material all the way *around* the centre:
 * coverage is 1.0 through the bore and ~0.1 edge-on.
 *
 * It also correctly rejects an open watch, whose case sits on one side of the
 * wrist rather than encircling it — which is why watches fall back to the bbox
 * policy instead of trusting a bore that is not there.
 */
function angularCoverage(a, b, cx, cy) {
  const bins = new Uint8Array(COVERAGE_BINS);
  for (let i = 0; i < a.length; i++) {
    const angle = Math.atan2(b[i] - cy, a[i] - cx);
    const bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * COVERAGE_BINS) % COVERAGE_BINS;
    bins[bin] = 1;
  }
  return bins.reduce((sum, occupied) => sum + occupied, 0) / COVERAGE_BINS;
}

/**
 * Locate the bore's centre in a projection plane.
 *
 * The bounding-box centre is not good enough: a clasp, a charm or a solitaire
 * sits off to one side and drags the bbox centre away from the bore, after which
 * the "hole" is measured about the wrong axis and reads as almost nothing.
 *
 * The median of the projected coordinates is a robust seed (a minority of
 * outlying geometry barely moves it), then a short hill-climb maximizes the hole
 * radius. The search is clamped to a neighbourhood of the seed: an off-centre
 * clasp displaces the bore by a little, so a centre that has wandered far from
 * the body of the model has found empty space outside the product, not its bore.
 */
function findBoreCentre(a, b, extent) {
  const seedX = medianOf(a);
  const seedY = medianOf(b);
  const limit = extent * 0.25;

  let cx = seedX;
  let cy = seedY;
  let best = holeRadius(a, b, cx, cy);
  let step = extent * 0.1;

  for (let round = 0; round < 6; round++) {
    let improved = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (Math.hypot(nx - seedX, ny - seedY) > limit) continue;
      const radius = holeRadius(a, b, nx, ny);
      if (radius > best) {
        best = radius;
        cx = nx;
        cy = ny;
        improved = true;
      }
    }
    if (!improved) step *= 0.5;
  }
  return { cx, cy, innerRadius: best };
}

// Cap the vertex count used for measurement; a dense GLB does not measure any
// better than a well-spread sample of it, and the hill-climb is O(rounds x N).
const MEASURE_MAX_VERTICES = 20000;

/**
 * Measure the model about each candidate axis by looking at its actual vertices.
 *
 * A bounding box cannot see a hole, which is the whole problem with deriving
 * either the bore axis or the fit from extents: for a torus both extents
 * perpendicular to the bore are the OUTER diameter, so a bbox measure silently
 * fits the outside of the band and leaves the hole smaller than the limb.
 *
 * Projecting vertices onto the plane perpendicular to an axis gives the real
 * radii, and with them three things:
 *
 *  - `centre` — where the bore actually is, which is not the bbox centre once a
 *    clasp or a gem is involved.
 *  - `innerRadius` — the hole, which is what a worn product must fit around.
 *  - `annularity` = inner/outer — how ring-like the geometry is about that axis.
 *    A true bore leaves a clear hole (~0.5-0.9); a wrong axis slices through the
 *    material and has vertices sitting on the axis itself, giving ~0. That
 *    identifies the bore without guessing from the silhouette.
 *
 * Percentiles rather than min/max, so one stray vertex cannot define the fit.
 *
 * @param {THREE.Object3D} model
 * @returns {Object|null} { x: {...}, y: {...}, z: {...} } or null if no geometry.
 */
function measureModel(model, THREE) {
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  const extents = box.getSize(new THREE.Vector3());
  const points = { x: [], y: [], z: [] };
  const vertex = new THREE.Vector3();

  // Total first, so the sample is spread across the whole model rather than
  // taken entirely from whichever mesh happens to come first.
  let total = 0;
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    const position = child.isMesh && child.geometry?.getAttribute('position');
    if (position) total += position.count;
  });
  if (total === 0) return null;

  const stride = Math.max(1, Math.ceil(total / MEASURE_MAX_VERTICES));
  let seen = 0;
  model.traverse((child) => {
    const position = child.isMesh && child.geometry?.getAttribute('position');
    if (!position) return;
    for (let i = 0; i < position.count; i++, seen++) {
      if (seen % stride !== 0) continue;
      vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld).sub(centre);
      points.x.push(vertex.y, vertex.z);
      points.y.push(vertex.x, vertex.z);
      points.z.push(vertex.x, vertex.y);
    }
  });

  const measured = {};
  for (const axis of AXES) {
    const flat = points[axis];
    const a = [];
    const b = [];
    for (let i = 0; i < flat.length; i += 2) {
      a.push(flat[i]);
      b.push(flat[i + 1]);
    }

    const perpendicular = AXES.filter((other) => other !== axis);
    const extent = Math.max(extents[perpendicular[0]], extents[perpendicular[1]]);
    const { cx, cy, innerRadius } = findBoreCentre(a, b, extent);

    const radii = a.map((value, i) => Math.hypot(value - cx, b[i] - cy)).sort((p, q) => p - q);
    const outerRadius = percentile(radii, 0.99);
    const coverage = angularCoverage(a, b, cx, cy);

    measured[axis] = {
      centre: [cx, cy],
      innerRadius,
      outerRadius,
      coverage,
      // Both factors are needed: a big hole that the geometry does not surround
      // is a gap, not a bore.
      annularity: outerRadius > 0 ? (innerRadius / outerRadius) * coverage : 0
    };
  }
  return measured;
}

/**
 * Fallback when the geometry is not a recognizable loop, working off the
 * bounding box. The two product shapes need opposite rules:
 *
 *  - `narrowest` — a ring or closed bracelet is a flat torus: two extents are the
 *    diameter, the third (the band width) runs along the bore.
 *  - `longest` — an open watch (a case plus two strap stubs) is elongated along
 *    the bore instead, since the strap runs up and down the arm.
 *
 * Open watches are also not centred on the wrist axis, so annularity cannot be
 * trusted for them and this is the path they take.
 */
function detectBoreAxisFromExtents({ x, y, z }, policy = 'narrowest') {
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

    // Measurements of the loaded GLB in its own units, kept so the bore axis can
    // be re-derived without re-fetching the model. Authoring units vary wildly
    // between tools, so everything is measured rather than assumed.
    this.modelExtents = null;         // bounding box
    this.modelMeasurements = null;    // per-axis radii, see measureModel()
    this.detectedBoreAxis = null;
    this.modelInnerDiameter = 1;      // the hole — what a worn product fits around
    this.modelOuterDiameter = 1;
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
          if (this.config.debug.meshMaterial) {
            gltf.scene.traverse((child) => {
              if (child.isMesh) child.material = new THREE.MeshNormalMaterial();
            });
          }

          this.adoptModel(gltf.scene);
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
   * Take a loaded model into the scene: measure it, then orient it.
   *
   * Separated from loadModel() so the measurement path is identical whether the
   * mesh came from a GLB or from a test — measuring in the loader only meant the
   * tests exercised a different code path than production.
   *
   * @param {THREE.Object3D} mesh
   */
  adoptModel(mesh) {
    if (this.productPivot) this.scene.remove(this.productPivot);

    // A pivot decouples the fitted scale from the model's own transform, so the
    // GLB can keep whatever root transform it was exported with.
    this.productPivot = new THREE.Group();
    this.productMesh = mesh;

    this.modelExtents = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    // One vertex pass; reused whenever the bore axis changes.
    this.modelMeasurements = measureModel(mesh, THREE);

    this.productPivot.add(mesh);
    this.productPivot.visible = false;
    this.scene.add(this.productPivot);

    this._appliedBoreAxis = undefined;
    this.applyBoreAxis(this.config.product.boreAxis);
    return this.productPivot;
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

    // Prefer the measured bore. Fall back to the bbox policy when the geometry
    // is not a recognizable loop — an open watch, or a flat chain design.
    const measured = this.modelMeasurements;
    let axis = preference;
    let decidedBy = 'forced';

    if (preference === 'auto') {
      const ranked = measured
        ? AXES.map((a) => ({ axis: a, ...measured[a] })).sort((p, q) => q.annularity - p.annularity)
        : null;
      const confident = ranked
        && ranked[0].annularity >= ANNULARITY_MIN
        && ranked[0].annularity >= ranked[1].annularity * ANNULARITY_MARGIN;

      if (confident) {
        axis = ranked[0].axis;
        decidedBy = `annularity ${ranked[0].annularity.toFixed(2)} vs ${ranked[1].annularity.toFixed(2)}`;
      } else {
        axis = detectBoreAxisFromExtents(extents, policy);
        decidedBy = `bbox ${policy}` + (ranked
          ? ` (annularity inconclusive: ${ranked.map((r) => `${r.axis} ${r.annularity.toFixed(2)}`).join(', ')})`
          : ' (no geometry)');
      }
    }

    this.detectedBoreAxis = axis;

    // Bring the bore axis onto +Y.
    this.productMesh.quaternion.identity();
    this.productMesh.position.set(0, 0, 0);
    if (axis === 'x') this.productMesh.rotateZ(Math.PI / 2);
    else if (axis === 'z') this.productMesh.rotateX(-Math.PI / 2);

    // Recentre so the pivot sits on the BORE, not on the bounding box. With a
    // clasp or a gem the two differ, and centring on the box would swing the
    // product in an orbit around the limb instead of encircling it.
    this.productMesh.updateMatrixWorld(true);
    const rotatedBox = new THREE.Box3().setFromObject(this.productMesh);
    const boxCentre = rotatedBox.getCenter(new THREE.Vector3());
    this.productMesh.position.sub(boxCentre);

    const radial = measured?.[axis];
    if (radial) {
      // The measured centre is in the pre-rotation plane perpendicular to the
      // bore; after rotation that plane is XZ, with the bore along Y. The axis
      // order below follows the same rotations applied above.
      const [u, v] = radial.centre;
      const offset = axis === 'x' ? new THREE.Vector3(0, -u, v)
        : axis === 'z' ? new THREE.Vector3(u, -v, 0)
          : new THREE.Vector3(u, 0, v);
      this.productMesh.position.sub(offset);
      this.productMesh.updateMatrixWorld(true);
    }

    // The HOLE, measured from the geometry — this is what a worn product must fit
    // around. Taking it from the bounding box measures the outside of the band
    // instead, which leaves the hole narrower than the limb by twice the band
    // thickness: the product then sits inside the arm and the occluder hides it.
    this.modelInnerDiameter = (radial ? radial.innerRadius * 2 : 0) || 1;
    this.modelOuterDiameter = (radial ? radial.outerRadius * 2 : 0) || 1;

    // Absolute sizing stays on the bounding box: the radial distance to a watch
    // case is its height above the wrist, not its diameter. The larger extent
    // perpendicular to the bore is the case's own size.
    const [d1, d2] = AXES.filter((a) => a !== axis).map((a) => extents[a]);
    this.modelMaxDiameter = Math.max(d1, d2) || 1;

    console.log(
      `Model oriented | bbox ${extents.x.toFixed(3)} x ${extents.y.toFixed(3)} x ${extents.z.toFixed(3)}` +
      ` | bore axis ${axis} (${decidedBy})` +
      ` | hole ${(this.modelInnerDiameter * 1000).toFixed(1)}mm` +
      ` outer ${(this.modelOuterDiameter * 1000).toFixed(1)}mm` +
      ` case ${(this.modelMaxDiameter * 1000).toFixed(1)}mm` +
      ' (mm assumes the GLB is authored in metres)'
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

    // Fit the HOLE to the limb, not the outside of the band. `ratio` is a
    // clearance on the limb (~1.05), so the fit is independent of how chunky the
    // band is — a 2mm ring band and a 15mm bangle both end up wearable.
    const ratio = this.debugParams?.boreDiameterRatio ?? sizing.boreDiameterRatio;
    return (width * ratio) / this.modelInnerDiameter;
  }

  /** Rendered inner diameter in metres, for the debug readout. */
  fittedInnerDiameter(width) {
    return this.modelInnerDiameter * this.fitScale(width);
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

      // Live toggle: an invisible occluder that is swallowing the product looks
      // identical to a product that failed to load, so make it inspectable.
      const showOccluder = this.debugParams?.showOccluder ?? this.config.occluder.debug;
      const material = this.occluderMesh.material;
      if (material.colorWrite !== showOccluder) {
        material.colorWrite = showOccluder;
        material.wireframe = showOccluder;
        material.color.set(showOccluder ? 0xff00ff : 0xffffff);
        material.needsUpdate = true;
      }

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
