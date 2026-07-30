/**
 * VTO app bootstrap — wiring that is the same for every product.
 *
 * Builds the scene, loads the model, starts the tracker, runs the render loop
 * and connects the debug panel. An app supplies a config, an anchor and its
 * panel schema; everything else is here.
 */

import { MediaPipeTracker } from './MediaPipeTracker.js';
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
 * @returns {Promise<Object>} the app state, for debugging from the console.
 */
export async function startVTO({ config, anchor, panel, label = 'VTO' }) {
  const app = {
    tracker: null,
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

    app.tracker = new MediaPipeTracker({
      ...config.mediaPipe,
      onResults: (results) => handleResults(app, results)
    });
    await app.tracker.init(videoElement, canvasElement);
    app.tracker.start();

    // Apply initial camera transforms
    applyBackCameraTransforms(app.tracker, videoElement, canvasElement, vtoCanvas);

    changeCameraBtn?.addEventListener('click', async () => {
      try {
        await app.tracker.switchCamera();
        // Apply transforms after camera switch
        applyBackCameraTransforms(app.tracker, videoElement, canvasElement, vtoCanvas);
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
    app.scene?.destroy();
    app.debugPanel?.destroy();
  });

  return app;
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
