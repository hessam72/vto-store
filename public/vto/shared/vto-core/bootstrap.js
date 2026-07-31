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

// Below this, MediaPipe is guessing at where the shoulders are rather than
// seeing them, and the necklace is being placed on an inferred torso. High
// enough to catch a user drifting out of frame, low enough not to nag through
// an ordinary body turn.
const SHOULDER_CONFIDENCE_FLOOR = 0.6;

/**
 * Apply camera-specific transforms for back camera mirroring fix.
 *
 * Also re-declares the screenshot layers, because which layer is mirrored is
 * exactly what changes here. Compositing with a stale set produces an image
 * that is flipped relative to what the user was looking at when they pressed
 * the shutter.
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

  window.vtoUI?.registerCapture({
    mode: 'viewport',
    // Back to front. The landmark overlay is deliberately left out: it is a
    // debug drawing, not something a shopper wants in a saved photo.
    layers: [
      { el: videoElement, mirrored: !isBackCamera },
      { el: vtoCanvas, mirrored: isBackCamera }
    ]
  });
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
    debugPanel: null
  };

  try {
    console.log(`Initializing ${label}...`);

    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const vtoCanvas = document.getElementById('VTOCanvas');
    const changeCameraBtn = document.getElementById('changeCamera');

    app.scene = new VTOScene(vtoCanvas, config);
    window.vtoUI?.setBootStage('در حال بارگذاری محصول…', 'مدل سه‌بعدی در حال آماده‌سازی است');
    await app.scene.loadModel();
    app.scene.addOccluder();

    app.positioner = new ProductPositioner(config, anchor);

    app.tracker = new TrackerClass({
      ...config.mediaPipe,
      onResults: (results) => handleResults(app, results)
    });
    window.vtoUI?.setBootStage('در حال راه‌اندازی دوربین…', 'لطفاً اجازه دسترسی به دوربین را تأیید کنید');
    await app.tracker.init(videoElement, canvasElement);
    app.tracker.start();

    // Deliberately after the hand tracker is already running and NOT awaited:
    // the pose model is another 5.5MB, and the try-on is fully usable on the
    // hand-derived axis while it downloads. It simply starts improving the
    // forearm angle once it arrives.
    startPoseTracker(app, config);

    // Apply initial camera transforms
    applyBackCameraTransforms(app.tracker, videoElement, canvasElement, vtoCanvas);

    const switchCamera = async () => {
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
        window.vtoUI?.toast('تعویض دوربین انجام نشد');
      }
    };

    changeCameraBtn?.addEventListener('click', switchCamera);

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
    window.vtoUI?.hideBoot();

    console.log(`${label} ready`);
  } catch (error) {
    // The shared UI turns the error into something a shopper can act on —
    // a denied camera permission and a failed model download need different
    // instructions, and neither is served by a browser alert().
    if (window.vtoUI) {
      window.vtoUI.showErrorFor(error);
    } else {
      console.error('Initialization error:', error);
      alert('خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.');
    }
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

  updateTrackingHint(transform);
}

/**
 * Turn the solve into one line of guidance.
 *
 * `visible` is the honest signal for "the product is on screen". For a torso
 * product the shoulder confidence is what degrades first as the user drifts
 * out of frame, so a weak reading is called out while the product is still
 * drawn — that is the moment the advice is actually useful, rather than after
 * it has already disappeared. setTracking() ignores repeats, so this is safe
 * to call every frame.
 */
function updateTrackingHint(transform) {
  const ui = window.vtoUI;
  if (!ui) return;

  if (!transform.visible) {
    ui.setTracking('none');
    return;
  }

  const shoulders = transform.shoulderVisibility;
  if (shoulders !== undefined && shoulders < SHOULDER_CONFIDENCE_FLOOR) {
    ui.setTracking('poor', 'شانه‌های خود را کامل در کادر دوربین قرار دهید');
    return;
  }

  ui.setTracking('good');
}

function startRenderLoop(app) {
  function animate() {
    app.scene.render();
    requestAnimationFrame(animate);
  }
  animate();
}
