/**
 * Glasses scene — VTOScene with eyewear fitting and a head occluder.
 *
 * Reuses the shared renderer, camera, resize and render loop. What differs from
 * a ring or a bracelet:
 *
 *  - The model is not a loop, so there is no bore. It is oriented and measured
 *    by GlassesModel.analyzeGlasses() into the wearable frame (X across, Y up,
 *    Z out of the face, origin at the lens centre on the lens plane), which is
 *    the canonical face's own frame — so the anchor's rotation applies to it
 *    directly.
 *  - Sizing: `fit` makes the frame front a fraction of the measured face width
 *    at the temples; `absolute` renders a real frame width in millimetres, which
 *    means something because the anchor calibrates face scale from the iris.
 *  - Occlusion is a head, not a limb: MediaPipe's canonical face mesh, inset a
 *    few millimetres so the frame never clips into a nose that is flatter than
 *    average, plus an ellipsoid skull behind it. Together they hide the far
 *    temple and the far lens edge as the head turns.
 *  - Temples. A GLB's temples are rigid and straight; heads are wider than most
 *    frames at the ears and the temples end behind them. Two vertex/fragment
 *    patches, in the spirit of WebAR.rocks' glasses helper but working on any
 *    GLB rather than on materials named "frame":
 *      splay — temples behind the hinge bend outward to clear the head, so the
 *              near temple is seen running along the side of the head instead
 *              of vanishing into it;
 *      fade  — temples fade out over the ear, where the real ones disappear
 *              behind it. The fade writes premultiplied transparency, which the
 *              alpha canvas composites straight over the camera feed.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VTOScene } from '../../shared/vto-core/VTOScene.js';
import {
  CANONICAL_FACE_VERTICES, CANONICAL_FACE_TRIANGLES
} from '../../shared/vto-core/CanonicalFace.js';
import { FACE } from '../../shared/vto-core/FaceLandmarkerTracker.js';
import { analyzeGlasses, prepareMaterial } from './GlassesModel.js';

// Canonical landmarks the temple patches are measured against (cm).
const TRAGUS_Z_CM = CANONICAL_FACE_VERTICES[FACE.LEFT_TRAGUS * 3 + 2];
const TEMPLE_HALF_WIDTH_CM = CANONICAL_FACE_VERTICES[FACE.LEFT_TEMPLE * 3];

// Skull ellipsoid behind the face mesh, canonical cm. Narrower than the face at
// the temples, so the near temple is never swallowed; deep enough to hide the
// far temple and everything behind the ears.
const SKULL_CENTRE_CM = [0, 2, -5];
const SKULL_RADII_CM = [7.0, 9.5, 8.5];

// A disabled fade: everything is in front of it.
const NO_FADE = new THREE.Vector2(-1e6, -1e6 - 1);

// Must match the importmap's three version.
const THREE_VERSION = '0.167.0';

/** A mesh the GLB bundles as a head occluder (by node or material name), not as product. */
function isBundledOccluder(object) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return /occluder/i.test(object.name) || materials.some((m) => /occluder/i.test(m?.name ?? ''));
}

export class GlassesScene extends VTOScene {
  constructor(canvas, config) {
    super(canvas, config);

    this.analysis = null;
    this.tiltGroup = null;
    this.frameGroup = null;
    this.occluderGroup = null;
    this.occluderContent = null;
    this.occluderMaterial = null;

    // Shared by every patched material, so one write per frame updates all.
    this.templeUniforms = {
      uTempleFade: { value: NO_FADE.clone() },
      // (outward bend, start z, ramp length, min |x|) in wearable-frame units.
      uTempleSplay: { value: new THREE.Vector4(0, 0, 1, 1e6) }
    };

    this._offset = new THREE.Vector3();
    this._defaultAnchorCm = new THREE.Vector3(0, 2.625, 5.44);
    this._loggedFit = false;
  }

  /**
   * HDR environment when the store has one, otherwise a generated studio room:
   * frames are glossy acetate or polished metal, and with only an ambient and
   * a key light they read as flat plastic.
   */
  setupLighting() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const useRoom = () => {
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      console.log('Environment: generated studio room');
    };

    this.scene.environmentIntensity = this.config.lighting?.environmentIntensity ?? 1;
    if (!this.config.envMapURL) {
      useRoom();
      return;
    }

    new RGBELoader().load(
      this.config.envMapURL,
      (texture) => {
        this.scene.environment = pmrem.fromEquirectangular(texture).texture;
        texture.dispose();
        pmrem.dispose();
        console.log('Environment map loaded');
      },
      undefined,
      (error) => {
        console.warn('Environment map failed to load, using a generated room', error);
        useRoom();
      }
    );
  }

  /**
   * As VTOScene.loadModel(), with the decoders a catalogue GLB is likely to
   * need: Draco and meshopt geometry, KTX2 textures. Each is fetched only if
   * the file actually uses it.
   */
  async loadModel() {
    const decoders = this.config.decoders ?? {};
    const draco = new DRACOLoader().setDecoderPath(decoders.dracoPath ?? '/draco/');
    const loader = new GLTFLoader()
      .setDRACOLoader(draco)
      .setKTX2Loader(
        new KTX2Loader()
          .setTranscoderPath(decoders.basisPath
            ?? `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/libs/basis/`)
          .detectSupport(this.renderer)
      )
      .setMeshoptDecoder(MeshoptDecoder);

    try {
      const gltf = await loader.loadAsync(this.config.modelURL, (progress) => {
        if (progress.total > 0) {
          console.log(`Loading model: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
        }
      });

      if (this.config.debug.meshMaterial) {
        gltf.scene.traverse((child) => {
          if (child.isMesh) child.material = new THREE.MeshNormalMaterial();
        });
      }

      this.adoptModel(gltf.scene);
      return this.productPivot;
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    } finally {
      draco.dispose();
    }
  }

  /**
   * Orient, measure and dress a loaded glasses model.
   *
   *   productPivot   solved pose and fitted scale, per frame
   *     tiltGroup    pantoscopic tilt about the lens centre
   *       frameGroup model -> wearable frame, from the analysis
   *         GLB scene
   */
  adoptModel(root) {
    if (this.productPivot) this.scene.remove(this.productPivot);

    // A GLB exported from a scene can carry its camera and lights; a stray
    // point light from the modelling scene would light the product unevenly.
    const strays = [];
    root.traverse((object) => {
      if (object.isLight || object.isCamera) strays.push(object);
    });
    strays.forEach((object) => object.removeFromParent());

    root.updateMatrixWorld(true);
    const include = (mesh) => mesh.visible && !isBundledOccluder(mesh);
    const analysis = analyzeGlasses(root, THREE, {
      orientation: this.config.product.orientation,
      include
    });
    if (!analysis) throw new Error('The glasses model contains no geometry');
    this.analysis = analysis;

    this.frameGroup = new THREE.Group();
    this.frameGroup.quaternion.setFromRotationMatrix(analysis.rotation);
    this.frameGroup.position.copy(analysis.origin).negate();
    this.frameGroup.updateMatrix();

    // Materials first, while the GLB is still detached and its matrixWorld is
    // its own model space: the temple patches need model -> wearable per mesh.
    const lensCount = this.prepareMaterials(root, this.frameGroup.matrix);

    this.productMesh = root;
    this.frameGroup.add(root);
    this.tiltGroup = new THREE.Group();
    this.tiltGroup.add(this.frameGroup);
    this.productPivot = new THREE.Group();
    this.productPivot.add(this.tiltGroup);
    this.productPivot.visible = false;
    this.scene.add(this.productPivot);
    this._loggedFit = false;

    const { frontWidth, frontHeight, depth, hasTemples } = analysis;
    console.log(
      `Glasses oriented | ${analysis.summary}` +
      ` | front ${frontWidth.toFixed(3)} x ${frontHeight.toFixed(3)}, depth ${depth.toFixed(3)} (model units)` +
      ` | temples ${hasTemples ? 'yes' : 'no'}, lens materials ${lensCount}`
    );
    return this.productPivot;
  }

  /** @returns {number} how many lens materials were found. */
  prepareMaterials(root, toWearable) {
    const { lensOpacity, envMapIntensity } = this.config.product;
    const meshToWearable = new THREE.Matrix4();
    let lensCount = 0;

    root.traverse((mesh) => {
      if (!mesh.isMesh) return;

      // A GLB authored for WebAR.rocks may ship its own head occluder in the
      // frame's coordinates. Keep it as what it is: depth only.
      if (isBundledOccluder(mesh)) {
        mesh.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
        mesh.renderOrder = -1;
        return;
      }

      meshToWearable.multiplyMatrices(toWearable, mesh.matrixWorld);
      const convert = (source) => {
        const { material, isLens } = prepareMaterial(source, { lensOpacity, envMapIntensity });
        if (isLens) lensCount++;
        this.patchTemples(material, meshToWearable);
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    });

    return lensCount;
  }

  /** Temple splay (vertex) and ear fade (fragment), in the wearable frame. */
  patchTemples(material, meshToWearable) {
    const toWearable = { value: meshToWearable.clone() };
    const fromWearable = { value: meshToWearable.clone().invert() };
    const { uTempleFade, uTempleSplay } = this.templeUniforms;

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uToWearable: toWearable, uFromWearable: fromWearable, uTempleFade, uTempleSplay
      });

      shader.vertexShader =
        'uniform mat4 uToWearable;\nuniform mat4 uFromWearable;\nuniform vec4 uTempleSplay;\nvarying float vWearableZ;\n' +
        shader.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
        {
          vec4 wearable = uToWearable * vec4(transformed, 1.0);
          float behind = clamp((uTempleSplay.y - wearable.z) / uTempleSplay.z, 0.0, 1.0);
          float isTemple = step(uTempleSplay.w, abs(wearable.x));
          wearable.x += sign(wearable.x) * uTempleSplay.x * behind * isTemple;
          vWearableZ = wearable.z;
          transformed = (uFromWearable * wearable).xyz;
        }`);

      shader.fragmentShader =
        'uniform vec2 uTempleFade;\nvarying float vWearableZ;\n' +
        shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor *= smoothstep(uTempleFade.y, uTempleFade.x, vWearableZ);`);
    };
    // Every patched material compiles to the same source; share the program.
    material.customProgramCacheKey = () => 'vto-glasses-temples';
    material.needsUpdate = true;
  }

  /**
   * The head occluder, in canonical face centimetres. Placed per frame at the
   * anchor, so its content is offset by the anchor's canonical position.
   */
  addOccluder() {
    if (!this.config.occluder.enabled) return;

    const debug = this.config.occluder.debug;
    this.occluderMaterial = new THREE.MeshBasicMaterial({
      colorWrite: debug,
      depthWrite: true,
      transparent: false,
      side: THREE.DoubleSide,
      color: new THREE.Color(0xff00ff),
      wireframe: debug
    });

    this.occluderGroup = new THREE.Group();
    this.occluderContent = new THREE.Group();
    this.occluderGroup.add(this.occluderContent);

    const face = new THREE.BufferGeometry();
    face.setAttribute('position', new THREE.BufferAttribute(CANONICAL_FACE_VERTICES.slice(), 3));
    face.setIndex(new THREE.BufferAttribute(CANONICAL_FACE_TRIANGLES, 1));
    face.computeVertexNormals();

    // Inset along the normals. The canonical nose is an average nose; a
    // wearer's flatter bridge must not make the frame vanish into it.
    const inset = (this.config.occluder.faceInsetMm ?? 4) * 0.1;
    const position = face.getAttribute('position');
    const normal = face.getAttribute('normal');
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(
        i,
        position.getX(i) - normal.getX(i) * inset,
        position.getY(i) - normal.getY(i) * inset,
        position.getZ(i) - normal.getZ(i) * inset
      );
    }
    face.computeBoundingSphere();
    const faceMesh = new THREE.Mesh(face, this.occluderMaterial);
    faceMesh.renderOrder = -1;
    this.occluderContent.add(faceMesh);

    if (this.config.occluder.skull !== false) {
      const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), this.occluderMaterial);
      skull.position.fromArray(SKULL_CENTRE_CM);
      skull.scale.fromArray(SKULL_RADII_CM);
      skull.renderOrder = -1;
      this.occluderContent.add(skull);
    }

    this.occluderGroup.visible = false;
    this.scene.add(this.occluderGroup);
    console.log('Occluder added (canonical face mesh + skull, opaque, depth-only)');
  }

  /**
   * `fit`: frame front = face width at the temples x ratio.
   * `absolute`: frame front = a real width in mm, or the GLB's own size when it
   * is plausibly authored in metres.
   */
  automaticScale(width) {
    const { sizing } = this.config.product;
    const frontWidth = this.analysis?.frontWidth || 1;

    if (sizing.mode === 'absolute') {
      const mm = this.debugParams?.frameWidthMm ?? sizing.frameWidthMm;
      if (mm) return (mm * 0.001) / frontWidth;
      if (frontWidth >= 0.09 && frontWidth <= 0.2) return 1;
      if (!this._warnedUnits) {
        this._warnedUnits = true;
        console.warn(
          `Absolute sizing needs a frame width: the GLB front measures ${frontWidth.toFixed(3)} ` +
          'units, which is not metres. Set product.sizing.frameWidthMm; fitting to the face meanwhile.'
        );
      }
    }

    const ratio = this.debugParams?.frameWidthRatio ?? sizing.frameWidthRatio;
    return (width * ratio) / frontWidth;
  }

  /** Rendered frame front width in metres — the readout the panel shows. */
  fittedOuterDiameter(width) {
    return (this.analysis?.frontWidth ?? 0) * this.fitScale(width);
  }

  /** The positioner's fine offset, so the occluder can stay on the face. */
  offsetWorld(quaternion) {
    const p = this.debugParams;
    const [x, y, z] = this.config.product.offsetMm;
    return this._offset
      .set(p?.offsetXMm ?? x, p?.offsetYMm ?? y, p?.offsetZMm ?? z)
      .multiplyScalar(0.001)
      .applyQuaternion(quaternion);
  }

  /**
   * Temple uniforms for this frame. Both patches are measured against the
   * canonical ear, converted into the wearable frame's model units.
   */
  updateTemples(faceScale, scale, anchorCm) {
    const { templeFade, templeSplay } = this.config.product;
    const analysis = this.analysis;
    const anchor = anchorCm ?? this._defaultAnchorCm;
    const cmToLocal = (0.01 * faceScale) / scale;

    const fade = this.templeUniforms.uTempleFade.value;
    if (templeFade?.enabled && analysis?.hasTemples) {
      fade.set(
        (TRAGUS_Z_CM + templeFade.startBeforeTragusMm * 0.1 - anchor.z) * cmToLocal,
        (TRAGUS_Z_CM - templeFade.endBehindTragusMm * 0.1 - anchor.z) * cmToLocal
      );
    } else {
      fade.copy(NO_FADE);
    }

    const splay = this.templeUniforms.uTempleSplay.value;
    if (templeSplay?.enabled && analysis?.hasTemples) {
      const target = (TEMPLE_HALF_WIDTH_CM + templeSplay.clearanceMm * 0.1) * cmToLocal;
      const hinge = analysis.frontWidth * 0.48;
      const reach = Math.max((anchor.z - TRAGUS_Z_CM) * cmToLocal, 0.1 * analysis.frontWidth);
      splay.set(
        Math.max(0, target - hinge),
        -0.04 * analysis.frontWidth,
        reach,
        0.3 * analysis.frontWidth
      );
    } else {
      splay.set(0, 0, 1, 1e6);
    }
  }

  /**
   * @param {Object} transform - Result of ProductPositioner.calculate().
   */
  updateTransform(transform) {
    if (!transform.visible) {
      if (this.productPivot) this.productPivot.visible = false;
      if (this.occluderGroup) this.occluderGroup.visible = false;
      if (this.debugMarker) this.debugMarker.visible = false;
      return;
    }

    const diagnostics = transform.diagnostics ?? {};
    const faceScale = diagnostics.faceScale ?? 1;
    const scale = this.fitScale(transform.width);

    if (this.productPivot) {
      this.productPivot.visible = true;
      this.productPivot.position.copy(transform.position);
      this.productPivot.quaternion.copy(transform.rotation);
      this.productPivot.scale.setScalar(scale);

      const tiltDeg = this.debugParams?.tiltDeg ?? this.config.product.tiltDeg ?? 0;
      // +X tilt swings the lens bottoms toward the cheeks.
      this.tiltGroup.rotation.x = THREE.MathUtils.degToRad(tiltDeg);

      this.updateTemples(faceScale, scale, diagnostics.anchorCm);
      this.logFit(transform, scale, faceScale);
    }

    if (this.occluderGroup) {
      // The occluder is the face: it follows the solved face, not the fine
      // offset applied to the glasses, or nudging a frame off a clipping nose
      // would drag the nose along with it.
      this.occluderGroup.visible = true;
      this.occluderGroup.quaternion.copy(transform.bodyRotation);
      this.occluderGroup.position.copy(transform.position).sub(this.offsetWorld(transform.bodyRotation));
      this.occluderGroup.scale.setScalar(faceScale * 0.01);
      this.occluderContent.position.copy(diagnostics.anchorCm ?? this._defaultAnchorCm).negate();

      const show = this.debugParams?.showOccluder ?? this.config.occluder.debug;
      if (this.occluderMaterial.colorWrite !== show) {
        this.occluderMaterial.colorWrite = show;
        this.occluderMaterial.wireframe = show;
        this.occluderMaterial.needsUpdate = true;
      }
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
        `face ${(transform.width * 1000).toFixed(1)}mm | ` +
        `pos ${transform.position.x.toFixed(3)}, ${transform.position.y.toFixed(3)}, ${transform.position.z.toFixed(3)}`
      );
    }
  }

  /** Once per model: the numbers that make a wrong size attributable. */
  logFit(transform, scale, faceScale) {
    if (this._loggedFit) return;
    this._loggedFit = true;
    const mm = (metres) => (metres * 1000).toFixed(1);
    const { sizing } = this.config.product;
    const multiplier = this.scaleMultiplier();
    console.log(
      `Fit | face at temples ${mm(transform.width)}mm (face scale ${faceScale.toFixed(3)})` +
      ` | ${sizing.mode} | frame front ${this.analysis.frontWidth.toFixed(3)} model units` +
      ` -> ${mm(this.analysis.frontWidth * scale)}mm | scale ${scale.toFixed(5)}` +
      (multiplier === 1 ? '' : ` (manual x${multiplier})`)
    );
  }
}
