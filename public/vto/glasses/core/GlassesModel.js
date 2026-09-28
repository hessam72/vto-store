/**
 * Glasses model analysis — orient and measure an arbitrary glasses GLB.
 *
 * The wearable frame the scene works in is
 *   X  across the face (width),  Y  up,  Z  out of the face (toward the viewer),
 * origin at the lens centre, on the plane the back of the lenses sits in.
 *
 * GLBs do not arrive like that. glTF says Y-up and "front faces +Z", but a
 * Blender export without the Y-up conversion is Z-up and faces -Y, catalogue
 * assets are often authored facing -Z, and units are anything from metres to
 * millimetres. So, as for rings, the orientation is DERIVED from the geometry
 * rather than configured per model:
 *
 *  - Width is the axis the frame is mirror-symmetric about. Extents cannot
 *    decide it: with the temples open a frame is about as deep as it is wide
 *    (WebAR.rocks' own models measure 2.12 wide x 2.19 deep), and symmetry is
 *    the one property only the width axis has. Among near-equally symmetric
 *    axes the longest wins, which settles a temple-less front whose thin depth
 *    also mirrors onto itself.
 *  - Depth vs up: open temples make one remaining axis nearly as long as the
 *    width — that is the depth. Without temples the depth is the thinnest.
 *  - Front: the lenses and rims carry far more surface area than two temple
 *    tips, so the end of the depth axis with more area is the front.
 *  - Up: temples hinge at the top of the rims, so the temples sit above the
 *    front's centre.
 *
 * Where the geometry cannot decide (no temples to give a front or an up), the
 * glTF convention is used, and the log line says so.
 */

import { sampleSurface, percentile } from '../../shared/vto-core/VTOScene.js';

const AXES = ['x', 'y', 'z'];
const AXIS_INDEX = { x: 0, y: 1, z: 2 };

// Two axes this close in symmetry are treated as equally symmetric, and the
// longer one is the width.
const SYMMETRY_TIE = 0.08;
// Open temples make the depth at least this fraction of the width. Real frames
// are 0.9-1.1; a temple-less front is under 0.3.
const TEMPLES_MIN_RATIO = 0.6;
// A signal (area imbalance, temple height) weaker than this is not evidence.
const SIGN_MIN = 0.1;

/**
 * Fraction of samples whose mirror image across the plane through the bbox
 * centre perpendicular to `axis` lands on geometry. ~1 for the width axis of
 * any frame, much lower for the depth axis once temples exist.
 */
function mirrorSymmetry(samples, axisIndex, cell) {
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const occupied = new Set();
  for (let i = 0; i < samples.length; i += 3) {
    occupied.add(key(samples[i], samples[i + 1], samples[i + 2]));
  }

  let hits = 0;
  let count = 0;
  const p = [0, 0, 0];
  // Every other sample is plenty to measure a fraction.
  for (let i = 0; i < samples.length; i += 6) {
    p[0] = samples[i];
    p[1] = samples[i + 1];
    p[2] = samples[i + 2];
    p[axisIndex] = -p[axisIndex];
    count++;

    // A neighbourhood test, so a mirror image landing a hair beside a voxel
    // boundary still counts.
    let found = false;
    for (let dx = -1; dx <= 1 && !found; dx++) {
      for (let dy = -1; dy <= 1 && !found; dy++) {
        for (let dz = -1; dz <= 1 && !found; dz++) {
          found = occupied.has(key(p[0] + dx * cell, p[1] + dy * cell, p[2] + dz * cell));
        }
      }
    }
    if (found) hits++;
  }
  return count ? hits / count : 0;
}

// The bridge cue is read off fewer samples than the temple cue, so it needs a
// clearer margin to count.
const BRIDGE_MIN = 0.15;

/**
 * Height of the front's centre strip above the front's vertical centre, as a
 * fraction of the front's height. Positive when `+up` really is up.
 */
function bridgeLift(samples, w, u, f, forwardSign, extent, widthAxis, forwardAxis, hasTemples) {
  const frontEdge = forwardSign * extent[forwardAxis] / 2;
  const frontDepth = hasTemples ? 0.2 * extent[widthAxis] : Infinity;
  const all = [];
  const strip = [];
  for (let i = 0; i < samples.length; i += 3) {
    if (forwardSign * (samples[i + f] - frontEdge) < -frontDepth) continue;
    all.push(samples[i + u]);
    if (Math.abs(samples[i + w]) < 0.06 * extent[widthAxis]) strip.push(samples[i + u]);
  }
  if (strip.length < 20 || all.length === 0) return null;

  all.sort((a, b) => a - b);
  const low = percentile(all, 0.02);
  const high = percentile(all, 0.98);
  if (high <= low) return null;
  const stripMean = strip.reduce((sum, v) => sum + v, 0) / strip.length;
  return (stripMean - (low + high) / 2) / (high - low);
}

/** Parse an explicit orientation such as { width: 'x', up: '+y', forward: '-z' }. */
function parseAxis(spec) {
  const match = /^([+-]?)([xyz])$/.exec(String(spec).trim().toLowerCase());
  if (!match) return null;
  return { axis: match[2], sign: match[1] === '-' ? -1 : 1 };
}

function unitVector(axis, sign, THREE) {
  const v = new THREE.Vector3();
  v.setComponent(AXIS_INDEX[axis], sign);
  return v;
}

/**
 * The glTF convention, for when the geometry cannot decide a sign. A Z-up
 * (unconverted Blender) export faces -Y; a model whose depth runs along X has
 * no convention at all.
 */
function conventionalSign(role, axis) {
  if (role === 'up') return 1;
  if (axis === 'y') return -1;
  return 1;
}

/**
 * @param {THREE.Object3D} model - Detached GLB scene, matrices current.
 * @param {typeof import('three')} THREE
 * @param {Object} [options]
 * @param {'auto'|{width: string, up: string, forward: string}} [options.orientation]
 * @param {Function} [options.include] - (mesh) => boolean, what counts as the frame.
 * @returns {Object|null} rotation (model -> wearable frame), origin (in the
 *   wearable frame), frontWidth, frontHeight, depth, hasTemples, summary.
 */
export function analyzeGlasses(model, THREE, { orientation = 'auto', include = null } = {}) {
  model.updateMatrixWorld(true);

  const box = new THREE.Box3();
  model.traverse((child) => {
    if (child.isMesh && (!include || include(child))) box.expandByObject(child);
  });
  if (box.isEmpty()) return null;

  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const extent = { x: size.x, y: size.y, z: size.z };
  const samples = sampleSurface(model, centre, THREE, include);
  if (!samples) return null;

  const maxExtent = Math.max(size.x, size.y, size.z);
  const symmetry = {};
  for (const axis of AXES) {
    symmetry[axis] = mirrorSymmetry(samples, AXIS_INDEX[axis], maxExtent / 48);
  }

  let widthAxis;
  let upAxis;
  let forwardAxis;
  let upSign;
  let forwardSign;
  let hasTemples;
  const evidence = [];

  const forced = orientation && orientation !== 'auto'
    ? [parseAxis(orientation.width), parseAxis(orientation.up), parseAxis(orientation.forward)]
    : null;

  if (forced && forced.every(Boolean) && new Set(forced.map((f) => f.axis)).size === 3) {
    [widthAxis, upAxis, forwardAxis] = forced.map((f) => f.axis);
    upSign = forced[1].sign;
    forwardSign = forced[2].sign;
    hasTemples = extent[forwardAxis] >= TEMPLES_MIN_RATIO * extent[widthAxis];
    evidence.push('forced by config');
  } else {
    if (forced) console.warn('Glasses orientation override is invalid, detecting instead:', orientation);

    // --- Width: the mirror-symmetry axis --------------------------------
    const best = Math.max(symmetry.x, symmetry.y, symmetry.z);
    widthAxis = AXES
      .filter((axis) => symmetry[axis] >= best - SYMMETRY_TIE)
      .sort((a, b) => extent[b] - extent[a])[0];

    // --- Depth vs up -----------------------------------------------------
    const [p, q] = AXES.filter((axis) => axis !== widthAxis);
    const ratio = (axis) => extent[axis] / extent[widthAxis];
    const longer = ratio(p) >= ratio(q) ? p : q;
    const shorter = longer === p ? q : p;
    hasTemples = ratio(longer) >= TEMPLES_MIN_RATIO;

    if (hasTemples) {
      forwardAxis = longer;
      upAxis = shorter;
      evidence.push(`temples along ${forwardAxis} (${ratio(longer).toFixed(2)} of width)`);
    } else if (Math.abs(ratio(p) - ratio(q)) < 0.15 && (p === 'y' || q === 'y')) {
      // Folded temples or a chunky front: extents are no evidence either way.
      upAxis = 'y';
      forwardAxis = p === 'y' ? q : p;
      evidence.push('no temples, extents ambiguous: glTF Y-up');
    } else {
      // A front only: taller than it is thick.
      upAxis = longer;
      forwardAxis = shorter;
      evidence.push('no temples: depth is the thinnest axis');
    }

    // --- Signs -----------------------------------------------------------
    const f = AXIS_INDEX[forwardAxis];
    const u = AXIS_INDEX[upAxis];
    const halfDepth = extent[forwardAxis] / 2;

    if (hasTemples) {
      // Front: the end holding the lenses has far more surface than the
      // temple tips.
      let plus = 0;
      let minus = 0;
      for (let i = 0; i < samples.length; i += 3) {
        const d = samples[i + f];
        if (d > halfDepth * 0.5) plus++;
        else if (d < -halfDepth * 0.5) minus++;
      }
      const imbalance = (plus - minus) / Math.max(1, plus + minus);
      if (Math.abs(imbalance) >= SIGN_MIN) {
        forwardSign = Math.sign(imbalance);
        evidence.push(`front by area ${imbalance.toFixed(2)}`);
      }

      // Up: temples hinge at the top of the rims.
      if (forwardSign) {
        const frontEdge = forwardSign * halfDepth;
        const front = [];
        const rear = [];
        for (let i = 0; i < samples.length; i += 3) {
          const along = forwardSign * (samples[i + f] - frontEdge);
          (along > -0.2 * extent[widthAxis] ? front : rear).push(samples[i + u]);
        }
        if (front.length && rear.length) {
          front.sort((a, b) => a - b);
          const frontMid = (percentile(front, 0.02) + percentile(front, 0.98)) / 2;
          const frontHeight = percentile(front, 0.98) - percentile(front, 0.02);
          const rearMean = rear.reduce((sum, v) => sum + v, 0) / rear.length;
          const lift = frontHeight > 0 ? (rearMean - frontMid) / frontHeight : 0;
          if (Math.abs(lift) >= SIGN_MIN) {
            upSign = Math.sign(lift);
            evidence.push(`temples ${lift > 0 ? 'above' : 'below'} rim centre ${lift.toFixed(2)}`);
          }
        }
      }
    }

    // Up, second opinion: the bridge. Down the middle of the front the only
    // geometry is the bridge over the nose and, below it, the nose pads, so the
    // centre strip sits high on every frame — including temple-less fronts and
    // frames whose temples hinge at mid-height, which the rule above cannot read.
    if (!upSign) {
      const lift = bridgeLift(samples, AXIS_INDEX[widthAxis], u, AXIS_INDEX[forwardAxis],
        forwardSign || conventionalSign('forward', forwardAxis), extent, widthAxis, forwardAxis, hasTemples);
      if (lift !== null && Math.abs(lift) >= BRIDGE_MIN) {
        upSign = Math.sign(lift);
        evidence.push(`bridge ${lift > 0 ? 'above' : 'below'} rim centre ${lift.toFixed(2)}`);
      }
    }

    if (!forwardSign) {
      forwardSign = conventionalSign('forward', forwardAxis);
      evidence.push(`front by convention (${forwardSign > 0 ? '+' : '-'}${forwardAxis})`);
    }
    if (!upSign) {
      upSign = conventionalSign('up', upAxis);
      evidence.push(`up by convention (+${upAxis})`);
    }
  }

  // --- Rotation into the wearable frame ------------------------------------
  const up = unitVector(upAxis, upSign, THREE);
  const forward = unitVector(forwardAxis, forwardSign, THREE);
  // Right-handed: X = Y x Z. A frame is symmetric across X, so its sign is
  // free and this is simply the one that keeps the basis a rotation.
  const across = new THREE.Vector3().crossVectors(up, forward);
  const toWearable = new THREE.Matrix4().makeBasis(across, up, forward).transpose();

  // --- Measure in the wearable frame ---------------------------------------
  const v = new THREE.Vector3();
  const xs = [];
  const ys = [];
  const zs = [];
  for (let i = 0; i < samples.length; i += 3) {
    v.set(samples[i], samples[i + 1], samples[i + 2]).applyMatrix4(toWearable);
    xs.push(v.x);
    ys.push(v.y);
    zs.push(v.z);
  }

  const zSorted = [...zs].sort((a, b) => a - b);
  const zFront = zSorted[zSorted.length - 1];
  const zBack = zSorted[0];
  const width = extent[widthAxis];

  // The front: rims, lenses, bridge and hinges, without the temples.
  const frontDepth = hasTemples ? 0.2 * width : Infinity;
  const frontX = [];
  const frontY = [];
  for (let i = 0; i < xs.length; i++) {
    if (zs[i] >= zFront - frontDepth) {
      frontX.push(xs[i]);
      frontY.push(ys[i]);
    }
  }
  frontX.sort((a, b) => a - b);
  frontY.sort((a, b) => a - b);

  // Near-extremes rather than extremes, so one stray sample cannot size the frame.
  const left = percentile(frontX, 0.002);
  const right = percentile(frontX, 0.998);
  const bottom = percentile(frontY, 0.005);
  const top = percentile(frontY, 0.995);
  const frontWidth = right - left;
  const frontHeight = top - bottom;
  const centreX = (left + right) / 2;
  const lensCentreY = (bottom + top) / 2;

  // The back of the lenses: the rear-most front geometry in the lens region,
  // clear of the nose pads in the middle and the hinges at the ends.
  const lensBack = [];
  for (let i = 0; i < xs.length; i++) {
    const lateral = Math.abs(xs[i] - centreX) / frontWidth;
    if (zs[i] >= zFront - frontDepth && lateral >= 0.15 && lateral <= 0.4) lensBack.push(zs[i]);
  }
  lensBack.sort((a, b) => a - b);
  const lensBackZ = lensBack.length ? percentile(lensBack, 0.05) : zFront - 0.05 * width;

  const sign = (s) => (s > 0 ? '+' : '-');
  const summary =
    `width ${widthAxis}, up ${sign(upSign)}${upAxis}, front ${sign(forwardSign)}${forwardAxis}` +
    ` (${evidence.join('; ')})` +
    ` | symmetry x ${symmetry.x.toFixed(2)} y ${symmetry.y.toFixed(2)} z ${symmetry.z.toFixed(2)}`;

  // The samples are relative to the bbox centre; the origin is applied to raw
  // model coordinates, so the centre has to go back in.
  const origin = new THREE.Vector3(centreX, lensCentreY, lensBackZ)
    .add(centre.clone().applyMatrix4(toWearable));

  return {
    rotation: toWearable,
    origin,
    frontWidth,
    frontHeight,
    depth: zFront - zBack,
    // Distance from the lens plane back to the temple tips.
    templeLength: lensBackZ - zBack,
    hasTemples,
    axes: { width: widthAxis, up: `${sign(upSign)}${upAxis}`, forward: `${sign(forwardSign)}${forwardAxis}` },
    symmetry,
    extent,
    summary
  };
}

/**
 * Materials as a try-on needs them, whatever the exporter wrote.
 *
 *  - Opaque parts exported as BLEND (common: an alpha channel left on at 1.0)
 *    go back to the opaque pass, where they sort and depth-test properly.
 *  - Lenses using transmission cannot work over a camera feed: transmission
 *    refracts the rendered scene, and here the scene behind the lens is an
 *    empty transparent buffer, so the lens renders dark. They become a plain
 *    tinted, reflective transparent surface instead.
 *  - Blender custom properties exported as `extras` (WebAR.rocks' convention
 *    for roughness / metalness the exporter drops) are applied.
 *
 * @returns {{ material: THREE.Material, isLens: boolean }}
 */
export function prepareMaterial(source, { lensOpacity, envMapIntensity }) {
  const material = source.clone();

  for (const [key, value] of Object.entries(material.userData || {})) {
    if (key in material && typeof value === typeof material[key]) material[key] = value;
  }

  const transmission = material.transmission ?? 0;
  const alphaTextured = Boolean(material.alphaMap || (material.map && material.transparent && material.opacity >= 0.99));
  const isLens = transmission > 0.01 || (material.transparent && material.opacity < 0.98 && !alphaTextured);

  if (isLens) {
    if (transmission > 0.01) {
      material.transmission = 0;
      // Keep the author's tint; transmission's opacity is implied, so supply one.
      material.opacity = lensOpacity;
    }
    material.transparent = true;
    // A lens must not hide what is behind it from the depth test, only tint it.
    material.depthWrite = false;
  } else if (material.transparent && material.opacity >= 0.98 && !alphaTextured) {
    material.transparent = false;
    material.depthWrite = true;
  }

  if ('envMapIntensity' in material && envMapIntensity !== undefined) {
    material.envMapIntensity = envMapIntensity;
  }
  material.fog = false;
  return { material, isLens };
}
