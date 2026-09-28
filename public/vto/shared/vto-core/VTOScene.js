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
export function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
  return sorted[index];
}

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

const RADIAL_BINS = 16;

/**
 * Radial profile about a candidate centre, measured PER ANGULAR SECTOR.
 *
 * Taking a percentile over per-vertex radii assumes vertex density is uniform
 * around the section. Real jewellery is the opposite: engraving, stones and
 * bezels put the overwhelming majority of vertices on the outer surface, while
 * the plain inner surface — the part that actually touches the limb — can be a
 * fraction of a percent of the mesh. A 1st-percentile radius then lands above
 * the true hole, the fit comes out too small, and the product renders inside the
 * limb. Binning by angle and taking one value per sector removes the density
 * weighting: a sector counts the same whether it holds four vertices or four
 * thousand.
 *
 *  - `innerRadius` — median of per-sector minima. Because the input samples the
 *    surface by area rather than its vertices, every sector the inner surface
 *    passes through really does have samples on it, so the median is both robust
 *    (a clasp bar crossing the bore affects a few sectors and is discarded) and
 *    sensitive (material near the axis in most sectors correctly reads as "no
 *    bore here", which is what keeps an open watch from claiming one).
 *  - `outerRadius` — median of per-sector maxima, so a charm or a gem occupying
 *    a few sectors does not inflate it.
 *  - `coverage` — fraction of sectors holding any geometry. This is what
 *    separates a bore from a coincidental gap: a torus seen edge-on also has
 *    empty space in the middle of its projection, two blobs either side, so a
 *    hole-size measure alone rates the wrong axis just as highly. Only a true
 *    bore has material all the way *around* the centre — coverage is 1.0 through
 *    the bore and ~0.1 edge-on. It also correctly rejects an open watch, whose
 *    case sits on one side of the wrist rather than encircling it.
 */
function radialProfile(a, b, cx, cy) {
  const minima = new Float64Array(RADIAL_BINS).fill(Infinity);
  const maxima = new Float64Array(RADIAL_BINS).fill(-Infinity);

  for (let i = 0; i < a.length; i++) {
    const dx = a[i] - cx;
    const dy = b[i] - cy;
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const bin = Math.min(
      RADIAL_BINS - 1,
      Math.floor(((angle + Math.PI) / (2 * Math.PI)) * RADIAL_BINS)
    );
    if (radius < minima[bin]) minima[bin] = radius;
    if (radius > maxima[bin]) maxima[bin] = radius;
  }

  const sectorMinima = [];
  const sectorMaxima = [];
  for (let bin = 0; bin < RADIAL_BINS; bin++) {
    if (minima[bin] === Infinity) continue;
    sectorMinima.push(minima[bin]);
    sectorMaxima.push(maxima[bin]);
  }
  if (sectorMinima.length === 0) return { innerRadius: 0, outerRadius: 0, coverage: 0 };

  sectorMinima.sort((p, q) => p - q);
  sectorMaxima.sort((p, q) => p - q);

  return {
    innerRadius: percentile(sectorMinima, 0.5),
    outerRadius: percentile(sectorMaxima, 0.5),
    coverage: sectorMinima.length / RADIAL_BINS
  };
}

/** Hole size about a candidate centre — what the centre search maximizes. */
function holeRadius(a, b, cx, cy) {
  return radialProfile(a, b, cx, cy).innerRadius;
}

/**
 * Locate the bore's centre in a projection plane.
 *
 * No summary statistic makes a safe seed. The bounding-box centre is dragged off
 * the bore by a clasp or a solitaire, and so is the coordinate median once the
 * samples are area-weighted, because a large gem can carry more surface area
 * than the whole band. Seeding from either and refining locally inherits the
 * bias.
 *
 * So search rather than seed: a coarse grid over the section, then a hill-climb
 * from the best cell. The objective is the hole radius itself, so the search is
 * looking directly for "the point the material surrounds", which is the bore by
 * definition and does not care what else the model carries. The grid runs on a
 * subsample — locating the centre needs far fewer points than measuring it.
 */
const CENTRE_GRID = 9;
const CENTRE_SEARCH_STRIDE = 4;
// A bore centre must be surrounded by material. Below this the candidate is not
// inside a hole, so its "hole radius" is meaningless.
const ENCLOSURE_MIN = 0.85;

function findBoreCentre(a, b, extent) {
  // Subsample for the search; the final profile is measured on everything.
  const sa = [];
  const sb = [];
  for (let i = 0; i < a.length; i += CENTRE_SEARCH_STRIDE) {
    sa.push(a[i]);
    sb.push(b[i]);
  }

  // Hole radius alone is an unbounded objective — travel far enough from the
  // model and every sample is distant, so "the hole" grows without limit. The
  // enclosure gate is what makes it well posed: only points the geometry
  // surrounds are candidates at all.
  const score = (x, y) => {
    const { innerRadius, coverage } = radialProfile(sa, sb, x, y);
    return coverage >= ENCLOSURE_MIN ? innerRadius : -1;
  };

  const span = extent * 0.4;
  let cx = 0;
  let cy = 0;
  let best = score(0, 0);

  for (let i = 0; i < CENTRE_GRID; i++) {
    for (let j = 0; j < CENTRE_GRID; j++) {
      const x = -span + (2 * span * i) / (CENTRE_GRID - 1);
      const y = -span + (2 * span * j) / (CENTRE_GRID - 1);
      const value = score(x, y);
      if (value > best) {
        best = value;
        cx = x;
        cy = y;
      }
    }
  }

  let step = (2 * span) / (CENTRE_GRID - 1);
  for (let round = 0; round < 6; round++) {
    let improved = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (Math.abs(nx) > span || Math.abs(ny) > span) continue;
      const value = score(nx, ny);
      if (value > best) {
        best = value;
        cx = nx;
        cy = ny;
        improved = true;
      }
    }
    if (!improved) step *= 0.5;
  }

  return { cx, cy, innerRadius: holeRadius(a, b, cx, cy) };
}

// Sample budget for the surface measurement. A denser GLB does not measure any
// better than a well-spread sample of it, and the centre search is O(rounds x N).
const MEASURE_SAMPLES = 20000;

// Deterministic stratified barycentric offsets, so a model always measures the
// same. Enough spread that a large triangle still lands in several sectors.
const BARYCENTRIC = [
  [1 / 3, 1 / 3], [0.2, 0.2], [0.6, 0.2], [0.2, 0.6],
  [0.1, 0.45], [0.45, 0.1], [0.45, 0.45], [0.7, 0.15]
];

/**
 * Sample points across the model's SURFACE, weighted by area.
 *
 * Reading vertices directly gets both the density and the sampling wrong. Real
 * jewellery puts most of its vertices on decorated outer surfaces, so a
 * vertex-based statistic is dominated by the outside; and a sparsely tessellated
 * inner surface has no vertex at all in most angular sectors, so the hole goes
 * unseen exactly where it matters. Area-weighted sampling fixes both: a big
 * plain triangle on the inner surface yields many samples, a thousand tiny
 * triangles of engraving yield about as many as their area deserves.
 *
 * @param {Function} [include] - (mesh) => boolean; meshes it rejects are not
 *   sampled, so non-product geometry bundled in a GLB cannot skew a measurement.
 * @returns {number[]|null} flat [x, y, z, ...] relative to `origin`.
 */
export function sampleSurface(model, origin, THREE, include = null) {
  const triangles = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let totalArea = 0;

  model.updateMatrixWorld(true);
  model.traverse((child) => {
    const geometry = child.isMesh && child.geometry;
    const position = geometry?.getAttribute('position');
    if (!position || (include && !include(child))) return;

    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const [i0, i1, i2] = index
        ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
        : [i, i + 1, i + 2];
      a.fromBufferAttribute(position, i0).applyMatrix4(child.matrixWorld);
      b.fromBufferAttribute(position, i1).applyMatrix4(child.matrixWorld);
      c.fromBufferAttribute(position, i2).applyMatrix4(child.matrixWorld);

      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
      if (area <= 0) continue;
      totalArea += area;
      triangles.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, area]);
    }
  });

  if (triangles.length === 0 || totalArea === 0) return null;

  const points = [];
  for (const [ax, ay, az, bx, by, bz, cx, cy, cz, area] of triangles) {
    const wanted = Math.max(1, Math.round((area / totalArea) * MEASURE_SAMPLES));
    for (let s = 0; s < wanted; s++) {
      // Cycle the stratified offsets; beyond them, jitter deterministically so a
      // very large triangle keeps spreading rather than repeating a few spots.
      const [u0, v0] = BARYCENTRIC[s % BARYCENTRIC.length];
      const jitter = Math.floor(s / BARYCENTRIC.length) * 0.6180339887;
      let u = (u0 + jitter) % 1;
      let v = (v0 + jitter * 0.7548776662) % 1;
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      points.push(
        ax + (bx - ax) * u + (cx - ax) * v - origin.x,
        ay + (by - ay) * u + (cy - ay) * v - origin.y,
        az + (bz - az) * u + (cz - az) * v - origin.z
      );
    }
  }
  return points;
}

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
  const samples = sampleSurface(model, centre, THREE);
  if (!samples) return null;

  const measured = {};
  for (const axis of AXES) {
    // Project onto the plane perpendicular to this axis.
    const a = [];
    const b = [];
    for (let i = 0; i < samples.length; i += 3) {
      const [x, y, z] = [samples[i], samples[i + 1], samples[i + 2]];
      if (axis === 'x') { a.push(y); b.push(z); }
      else if (axis === 'y') { a.push(x); b.push(z); }
      else { a.push(x); b.push(y); }
    }

    const perpendicular = AXES.filter((other) => other !== axis);
    const extent = Math.max(extents[perpendicular[0]], extents[perpendicular[1]]);
    const { cx, cy, innerRadius } = findBoreCentre(a, b, extent);

    const { outerRadius, coverage } = radialProfile(a, b, cx, cy);

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

    // Both shapes are unit-sized (radius 0.5, height 1) along Y — the primary
    // axis — and scaled per frame from the measured anatomy.
    //
    //   'cylinder' — a limb: a wrist, a finger. Open-ended, because the ends are
    //                never seen and capping them would occlude past the limb.
    //   'capsule'  — a neck: closed at the top so the chain cannot show through
    //                where the neck meets the jaw, which an open tube leaves
    //                wide open.
    const shape = this.config.occluder.shape ?? 'cylinder';
    const geometry = shape === 'capsule'
      ? new THREE.CapsuleGeometry(0.5, 1, 8, 24)
      : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true);

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
    console.log(`Occluder added (${shape}, opaque, depth-only)`);
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
    return this.automaticScale(width) * this.scaleMultiplier();
  }

  /** The derived scale, before any manual override. */
  automaticScale(width) {
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

  /**
   * Manual size override, applied on top of whichever mode produced the scale.
   *
   * Deliberately separate from `boreDiameterRatio`, which means "clearance on the
   * limb" and keeps the hole at `limbWidth x ratio`. Overloading that to double
   * as a size fudge would make a knob whose name says one thing and does another,
   * which is the exact trap this pipeline was rebuilt to escape. This one is
   * honestly unphysical: it scales the finished result and nothing else.
   *
   * On a watch it deliberately breaks the point of `absolute` mode — a 42mm case
   * no longer renders at 42mm — so it is an escape hatch, not a sizing method.
   */
  scaleMultiplier() {
    return this.debugParams?.scaleMultiplier ?? this.config.product.sizing.scaleMultiplier ?? 1;
  }

  /**
   * Rendered OUTER diameter in metres — what is actually on screen.
   *
   * Deliberately not the inner diameter: that one is
   * `modelInnerDiameter x (width x ratio) / modelInnerDiameter`, i.e. exactly
   * `width x ratio` whatever the model does, so it can never reveal a bad
   * measurement. The outer diameter carries the model through, and for a
   * fit-driven product it must exceed the limb width or the product is inside
   * the limb.
   */
  fittedOuterDiameter(width) {
    return this.modelOuterDiameter * this.fitScale(width);
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
      const scale = this.fitScale(transform.width);
      this.productPivot.visible = true;
      this.productPivot.position.copy(transform.position);
      this.productPivot.quaternion.copy(transform.rotation);
      this.productPivot.scale.setScalar(scale);

      // Report the fit once, when a limb measurement first exists. Model size
      // and limb size are independent inputs, so seeing both alongside the
      // result is what makes a bad fit attributable rather than mysterious.
      if (!this._loggedFit) {
        this._loggedFit = true;
        const mm = (metres) => (metres * 1000).toFixed(1);
        const multiplier = this.scaleMultiplier();
        console.log(
          `Fit | limb ${mm(transform.width)}mm | model hole ${mm(this.modelInnerDiameter)} ` +
          `outer ${mm(this.modelOuterDiameter)} (model units) | scale ${scale.toFixed(4)}` +
          (multiplier === 1 ? '' : ` (manual x${multiplier})`) + ' ' +
          `| rendered hole ${mm(this.modelInnerDiameter * scale)}mm ` +
          `outer ${mm(this.modelOuterDiameter * scale)}mm` +
          (this.config.product.sizing.mode === 'fit' && this.modelOuterDiameter * scale <= transform.width
            ? '  <-- OUTER IS INSIDE THE LIMB, the product will be hidden by the occluder'
            : '')
        );
      }
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
