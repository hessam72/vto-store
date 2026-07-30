/**
 * VTO app bootstrap — wiring that is the same for every product.
 *
 * Builds the scene, loads the model, starts the tracker, runs the render loop
 * and connects the debug panel. An app supplies a config, an anchor and its
 * panel schema; everything else is here.
 */

import { MediaPipeTracker } from './MediaPipeTracker.js';
import { PoseTracker } from './PoseTracker.js';
import { ProductPositioner } from './ProductPositioner.js';
import { VTOScene } from './VTOScene.js';
import { DebugPanel } from './DebugPanel.js';

/**
 * Apply camera-specific transforms for back camera mirroring fix
 */
function applyBackCameraTransforms(tracker, videoElement, canvasElement, vtoCanvas) {
  const isBackCamera = tracker.config.facingMode === 'environment';
  
  if (isBackCamera) {
    // Back camera: no mirror
    videoElement.style.transform = 'scale(1)';
    canvasElement.style.transform = 'scale(1)';
    vtoCanvas.style.transform = 'scaleX(-1)';
  } else {
    // Front camera: mirror everything
    videoElement.style.transform = 'scaleX(-1)';
    canvasElement.style.transform = 'scaleX(-1)';
    vtoCanvas.style.transform = 'none';
  }
}

/**
 * @param {Object} spec
 * @param {Object} spec.config - The product config.
 * @param {Object} spec.anchor - RingAnchor / WristAnchor instance.
 * @param {Object} spec.panel  - { title, storageKey, defaults, extra, readouts }.
 * @param {string} spec.label  - Name used in the startup logs.
 * @param {Function} [spec.tracker] - Tracker class owning the camera and the
 *   frame loop. Defaults to the hand landmarker; a torso-anchored product
 *   passes PoseLandmarkerTracker instead. The two are interchangeable here:
 *   same lifecycle, and both emit `{ landmarks[], worldLandmarks[] }`.
 * @returns {Promise<Object>} the app state, for debugging from the console.
 */
export async function startVTO({
  config, anchor, panel, label = 'VTO', tracker: TrackerClass = MediaPipeTracker
}) {
  const app = {
    tracker: null,
    poseTracker: null,
    positioner: null,
    scene: null,
    debugPanel: null,
    isInstructionsHidden: false
  };

  try {
    console.log(`Initializing ${label}...`);

    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const vtoCanvas = document.getElementById('VTOCanvas');
    const changeCameraBtn = document.getElementById('changeCamera');

    app.scene = new VTOScene(vtoCanvas, config);
    await app.scene.loadModel();
    app.scene.addOccluder();

    app.positioner = new ProductPositioner(config, anchor);

    app.tracker = new TrackerClass({
      ...config.mediaPipe,
      onResults: (results) => handleResults(app, results)
    });
    await app.tracker.init(videoElement, canvasElement);
    app.tracker.start();

    // Deliberately after the hand tracker is already running and NOT awaited:
    // the pose model is another 5.5MB, and the try-on is fully usable on the
    // hand-derived axis while it downloads. It simply starts improving the
    // forearm angle once it arrives.
    startPoseTracker(app, config);

    // Apply initial camera transforms
    applyBackCameraTransforms(app.tracker, videoElement, canvasElement, vtoCanvas);

    changeCameraBtn?.addEventListener('click', async () => {
      try {
        await app.tracker.switchCamera();
        // Apply transforms after camera switch
        applyBackCameraTransforms(app.tracker, videoElement, canvasElement, vtoCanvas);
        // The old camera's pose is about to be a stale view of a different
        // framing; drop it rather than blend it into the first new frames.
        app.poseTracker?.reset();
        app.positioner.resetFilters();
      } catch (error) {
        console.error('Error switching camera:', error);
      }
    });

    if (config.debug.panelEnabled) {
      app.debugPanel = new DebugPanel(panel);
      app.debugPanel.onUpdate = (params) => {
        app.positioner.debugParams = params;
        app.scene.debugParams = params;
      };
      app.debugPanel.onUpdate(app.debugPanel.params);

      window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') app.debugPanel.toggle();
      });
      console.log('Debug panel ready (press D to toggle)');
    }

    startRenderLoop(app);
    hideElement('loading');

    console.log(`${label} ready`);
  } catch (error) {
    console.error('Initialization error:', error);
    alert('خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.');
  }

  window.addEventListener('beforeunload', () => {
    app.tracker?.destroy();
    app.poseTracker?.destroy();
    app.scene?.destroy();
    app.debugPanel?.destroy();
  });

  return app;
}

/**
 * Optional second model supplying a true forearm axis, for anchors that can use
 * one. Skipped silently when the product's anchor has no notion of an external
 * axis (a ring is defined by finger landmarks that are all present), so this
 * costs the ring app nothing at all.
 */
function startPoseTracker(app, config) {
  if (!config.pose?.enabled) return;
  if (typeof app.positioner.anchor.setExternalAxis !== 'function') return;

  app.poseTracker = new PoseTracker(config.pose);
  app.poseTracker.init().catch((error) => {
    // A failed pose model must not break the try-on: the anchor keeps using the
    // hand-extrapolated axis exactly as it did before this existed.
    console.warn('Pose tracker unavailable, keeping the hand-derived axis:', error);
    app.poseTracker = null;
  });
}

/**
 * Feed this frame's forearm direction to the anchor, before the solve.
 *
 * Runs no pose inference while there is no hand: nothing is rendered in that
 * case, so the GPU pass would be pure waste.
 */
function updateForearmAxis(app, results) {
  const anchor = app.positioner.anchor;
  if (typeof anchor.setExternalAxis !== 'function') return;

  const handWrist = results?.landmarks?.[0]?.[0];
  if (!app.poseTracker?.isReady || !handWrist) {
    anchor.clearExternalAxis();
    app.tracker.poseForearm2D = null;
    return;
  }

  app.poseTracker.maybeDetect(app.tracker.videoElement, performance.now());

  const weight = app.poseTracker.forearmAxis(handWrist);
  if (weight > 0) anchor.setExternalAxis(app.poseTracker.axis, weight);
  else anchor.clearExternalAxis();

  // Debug overlay only; drawn beside the hand-extrapolated line for comparison.
  app.tracker.poseForearm2D = app.poseTracker.forearm2D;
}

function handleResults(app, results) {
  const view = {
    videoWidth: app.tracker.videoElement.videoWidth,
    videoHeight: app.tracker.videoElement.videoHeight,
    ...app.scene.getViewSize()
  };

  // Match the render camera to the physical webcam BEFORE solving, so the pose
  // is computed with the same projection that will be used to draw it.
  app.positioner.solver.updateCamera(app.scene.camera, view);

  // Must precede the solve — the anchor reads the external axis during it.
  updateForearmAxis(app, results);

  const transform = app.positioner.calculate(results, view, performance.now());

  app.scene.updateTransform(transform);

  if (app.debugPanel) {
    // The fit lives on the scene, not the pose. Surfacing it turns "it looks too
    // small" into a number next to the limb it is supposed to fit.
    app.debugPanel.setReadout(transform.visible
      ? {
          ...transform,
          fittedOuterM: app.scene.fittedOuterDiameter(transform.width),
          scaleMultiplier: app.scene.scaleMultiplier()
        }
      : transform);
  }

  if (transform.visible && !app.isInstructionsHidden) {
    app.isInstructionsHidden = true;
    hideElement('instructions');
  }
}

function startRenderLoop(app) {
  function animate() {
    app.scene.render();
    requestAnimationFrame(animate);
  }
  animate();
}

function hideElement(id) {
  const element = document.getElementById(id);
  if (!element) return;
  element.style.opacity = '0';
  setTimeout(() => element.parentNode?.removeChild(element), 500);
}
