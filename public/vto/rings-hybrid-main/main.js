/**
 * Hybrid Ring VTO - Main Application
 * Combines MediaPipe hand detection with WebARRocks ring placement logic
 */

import { RingConfig } from './config.js';
import { MediaPipeTracker } from './core/MediaPipeTracker.js';
import { RingPositioner } from './core/RingPositioner.js';
import { ThreeRingScene } from './core/ThreeRingScene.js';
import { ThumbGestureDetector } from './core/ThumbGestureDetector.js';
import { DebugPanel } from './debug/DebugPanel.js';

// Application state
const app = {
  tracker: null,
  positioner: null,
  threeScene: null,
  detector: null,
  debugPanel: null,
  products: [],
  productIndex: 0,
  isSwitching: false,
  isInstructionsHidden: false,
  isLoading: true
};

/**
 * Initialize application
 */
async function init() {
  try {
    console.log('🚀 Initializing Hybrid Ring VTO...');

    // Get DOM elements
    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const vtoCanvas = document.getElementById('VTOCanvas');
    const changeCameraBtn = document.getElementById('changeCamera');

    // Initialize Three.js scene
    console.log('🎨 Creating Three.js scene...');
    app.threeScene = new ThreeRingScene(vtoCanvas, RingConfig);

    // Build the switchable catalogue
    app.products = resolveProducts();
    app.productIndex = resolveInitialIndex();
    setupProductControls();
    updateProductDisplay();

    // Load ring model
    console.log('📦 Loading ring model...');
    await app.threeScene.loadRingModel(app.products[app.productIndex].url);

    // Add soft occluder
    console.log('🔲 Adding soft occluder...');
    app.threeScene.addSoftOccluder();

    // Initialize ring positioner
    console.log('📐 Creating ring positioner...');
    app.positioner = new RingPositioner(RingConfig);

    // Thumbs up / down product switching
    if (RingConfig.gesture.enabled && RingConfig.mediaPipe.useGestureRecognizer) {
      console.log('👍 Creating thumb gesture detector...');
      app.detector = new ThumbGestureDetector(RingConfig.gesture);
      app.detector.onSwapTriggered = (direction) => switchProduct(
        app.productIndex + (direction === 'next' ? 1 : -1)
      );
      app.detector.canTrigger = () => !app.isSwitching;
    }

    // Initialize MediaPipe tracker
    console.log('👋 Initializing MediaPipe tracker...');
    app.tracker = new MediaPipeTracker({
      ...RingConfig.mediaPipe,
      onResults: handleTrackingResults
    });

    await app.tracker.init(videoElement, canvasElement);

    // Start tracking
    console.log('▶️ Starting hand tracking...');
    app.tracker.start();

    // Setup camera switch button
    changeCameraBtn.addEventListener('click', async () => {
      try {
        await app.tracker.switchCamera();
      } catch (error) {
        console.error('Error switching camera:', error);
      }
    });

    // Initialize debug panel (if enabled)
    if (RingConfig.debug.panelEnabled) {
      console.log('🎛️ Initializing debug panel...');
      app.debugPanel = new DebugPanel(RingConfig);

      // Connect debug params to components
      app.debugPanel.onUpdate = (params) => {
        app.positioner.debugParams = params;
        app.threeScene.debugParams = params;
      };

      // Trigger initial update
      app.debugPanel.onUpdate(app.debugPanel.params);

      // Keyboard toggle: Press 'D' to show/hide panel
      window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
          app.debugPanel.toggle();
        }
      });

      console.log('✅ Debug panel ready (Press D to toggle)');
    }

    // Arrow keys switch products too, so the catalogue can be exercised without
    // a camera in front of it.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') switchProduct(app.productIndex - 1);
      else if (e.key === 'ArrowLeft') switchProduct(app.productIndex + 1);
    });

    // Start render loop
    console.log('🔄 Starting render loop...');
    startRenderLoop();

    // Hide loading screen
    hideLoading();

    console.log('✅ Hybrid Ring VTO Ready!');
  } catch (error) {
    console.error('❌ Initialization Error:', error);
    alert('خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.');
  }
}

/**
 * Handle MediaPipe tracking results
 */
function handleTrackingResults(results) {
  const { canvasWidth, canvasHeight } = app.threeScene.getViewSize();
  const view = {
    videoWidth: app.tracker.videoElement.videoWidth,
    videoHeight: app.tracker.videoElement.videoHeight,
    canvasWidth,
    canvasHeight
  };

  // Match the render camera to the physical webcam BEFORE solving, so the pose
  // is computed with the same projection that will be used to draw it.
  app.positioner.solver.updateCamera(app.threeScene.camera, view);

  const transform = app.positioner.calculate(results, view, performance.now());

  app.threeScene.updateRingTransform(transform);
  app.debugPanel?.setReadout(transform);

  // Gestures run after the pose, so classification never delays the ring.
  if (app.detector) {
    updateGestureStatus(app.detector.process(results));
  }

  // Hide instructions when hand detected
  if (transform.visible && !app.isInstructionsHidden) {
    hideInstructions();
  }
}

/**
 * Build the switchable catalogue.
 *
 * A model injected by the Next.js route (window.VTO_MODEL_URL) still decides
 * which ring the session opens on: it selects the matching catalogue entry, or
 * joins the catalogue at the front if it is not one of them. With no catalogue
 * configured at all, that single model is the catalogue.
 */
function resolveProducts() {
  const products = (RingConfig.products ?? []).filter((p) => p?.url);
  const injectedURL = window.VTO_MODEL_URL;

  if (products.length === 0) {
    return [{ id: 'default', name: 'انگشتر', url: RingConfig.modelURL }];
  }

  if (injectedURL && !products.some((p) => p.url === injectedURL)) {
    const injected = { id: 'injected', name: 'انگشتر', url: injectedURL };
    return [injected, ...products];
  }

  return products;
}

/** Which ring the session opens on. */
function resolveInitialIndex() {
  const injectedURL = window.VTO_MODEL_URL;
  const injectedIndex = injectedURL
    ? app.products.findIndex((p) => p.url === injectedURL)
    : -1;

  return clampIndex(injectedIndex >= 0 ? injectedIndex : (RingConfig.initialProductIndex ?? 0));
}

/** Wrap an index around the catalogue in both directions. */
function clampIndex(index) {
  const count = app.products.length;
  return ((index % count) + count) % count;
}

/**
 * Wear a different ring, without touching the tracker or the solved pose.
 *
 * Deliberately not awaited by its callers: the hand keeps being tracked and the
 * render loop keeps running while the GLB downloads. The ring is simply not
 * drawn until it arrives, because ThreeRingScene clears the pivot up front.
 */
async function switchProduct(index) {
  if (app.isSwitching || app.products.length < 2) return;

  const nextIndex = clampIndex(index);
  if (nextIndex === app.productIndex) return;

  const previousIndex = app.productIndex;

  app.isSwitching = true;
  app.productIndex = nextIndex;
  updateProductDisplay();
  showSwapAnimation();

  try {
    await app.threeScene.loadRingModel(app.products[nextIndex].url);
  } catch (error) {
    // A failed switch leaves no ring on the hand, so fall back to the one that
    // was being worn rather than stranding the user on an empty finger. It
    // loaded once already, so the retry is served from cache.
    console.error('Error switching product, reverting:', error);
    app.productIndex = previousIndex;
    await app.threeScene
      .loadRingModel(app.products[previousIndex].url)
      .catch((revertError) => console.error('Revert failed:', revertError));
  } finally {
    app.isSwitching = false;
    updateProductDisplay();
  }
}

function setupProductControls() {
  const bar = document.getElementById('productBar');

  if (app.products.length < 2) {
    bar?.remove();
    return;
  }

  document.getElementById('nextProduct')
    ?.addEventListener('click', () => switchProduct(app.productIndex + 1));
  document.getElementById('prevProduct')
    ?.addEventListener('click', () => switchProduct(app.productIndex - 1));
}

function updateProductDisplay() {
  const product = app.products[app.productIndex];
  const nameEl = document.getElementById('productName');
  const counterEl = document.getElementById('productCounter');

  if (nameEl) nameEl.textContent = product.name ?? product.id ?? '';
  if (counterEl) {
    counterEl.textContent = `${app.productIndex + 1} / ${app.products.length}`;
  }

  for (const id of ['nextProduct', 'prevProduct']) {
    const button = document.getElementById(id);
    if (button) button.disabled = app.isSwitching;
  }
}

function showSwapAnimation() {
  const bar = document.getElementById('productBar');
  if (!bar) return;

  bar.classList.add('swap-animation');
  setTimeout(() => bar.classList.remove('swap-animation'), 300);
}

/**
 * Mirror the hold back to the user. A 1.5s dwell with no feedback reads as a
 * gesture that simply did not work.
 */
function updateGestureStatus(detectorState) {
  const statusEl = document.getElementById('gestureStatus');
  if (!statusEl) return;

  const textEl = document.getElementById('gestureStatusText');
  const fillEl = document.getElementById('gestureProgressFill');
  const { state, progress } = detectorState;

  let text = '';
  let className = '';

  if (state === 'THUMB_UP_HOLDING') {
    text = '👍 نگه دارید برای بعدی...';
    className = 'holding';
  } else if (state === 'THUMB_DOWN_HOLDING') {
    text = '👎 نگه دارید برای قبلی...';
    className = 'holding';
  } else if (state === 'COOLDOWN') {
    text = '✅ تعویض شد';
    className = 'done';
  }

  statusEl.className = text ? `visible ${className}` : '';
  if (textEl) textEl.textContent = text;
  if (fillEl) fillEl.style.width = `${Math.round(progress * 100)}%`;
}

/**
 * Three.js render loop
 */
function startRenderLoop() {
  function animate() {
    app.threeScene.render();
    requestAnimationFrame(animate);
  }
  animate();
}

/**
 * Hide loading screen
 */
function hideLoading() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.opacity = '0';
    setTimeout(() => {
      loadingEl.parentNode?.removeChild(loadingEl);
    }, 500);
  }
  app.isLoading = false;
}

/**
 * Hide instructions
 */
function hideInstructions() {
  const instructionsEl = document.getElementById('instructions');
  if (instructionsEl && !app.isInstructionsHidden) {
    instructionsEl.style.opacity = '0';
    app.isInstructionsHidden = true;
    setTimeout(() => {
      instructionsEl.parentNode?.removeChild(instructionsEl);
    }, 500);
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  if (app.tracker) {
    app.tracker.destroy();
  }
  if (app.threeScene) {
    app.threeScene.destroy();
  }
  if (app.detector) {
    app.detector.destroy();
  }
  if (app.debugPanel) {
    app.debugPanel.destroy();
  }
});

// Start application
if (document.readyState === 'loading') {
  window.addEventListener('load', init);
} else {
  init();
}
