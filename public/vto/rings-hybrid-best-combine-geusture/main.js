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
import { GestureDebugPanel } from './debug/GestureDebugPanel.js';

// Application state
const app = {
  tracker: null,
  positioner: null,
  threeScene: null,
  debugPanel: null,
  gestureDebugPanel: null,
  gestureDetector: null,
  currentModelIndex: 0,
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

    // Load ring model
    console.log('📦 Loading ring model...');
    await app.threeScene.loadRingModel();

    // Add soft occluder
    console.log('🔲 Adding soft occluder...');
    app.threeScene.addSoftOccluder();

    // Initialize ring positioner
    console.log('📐 Creating ring positioner...');
    app.positioner = new RingPositioner(RingConfig);

    // Initialize gesture detector
    console.log('👆 Initializing gesture detector...');
    app.gestureDetector = new ThumbGestureDetector(RingConfig.gesture);

    app.gestureDetector.onSwapTriggered = (direction) => {
      handleSwap(direction);
    };

    app.gestureDetector.onStateChange = (stateInfo) => {
      updateGestureStatus(stateInfo.to);
    };

    // Initialize gesture debug panel
    console.log('🎛️ Initializing gesture debug panel...');
    app.gestureDebugPanel = new GestureDebugPanel({
      enabled: true,
      panelPosition: 'top-left'
    });

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

  // Process gestures
  if (app.gestureDetector && results.gestures) {
    const gestureState = app.gestureDetector.process(results);

    // Update gesture debug panel
    if (app.gestureDebugPanel) {
      app.gestureDebugPanel.update(gestureState);
    }
  }

  // Match the render camera to the physical webcam BEFORE solving, so the pose
  // is computed with the same projection that will be used to draw it.
  app.positioner.solver.updateCamera(app.threeScene.camera, view);

  const transform = app.positioner.calculate(results, view, performance.now());

  app.threeScene.updateRingTransform(transform);
  app.debugPanel?.setReadout(transform);

  // Hide instructions when hand detected
  if (transform.visible && !app.isInstructionsHidden) {
    hideInstructions();
  }
}

/**
 * Handle product swap via gesture
 */
async function handleSwap(direction) {
  if (direction === 'next') {
    app.currentModelIndex = (app.currentModelIndex + 1) % RingConfig.products.items.length;
  } else if (direction === 'previous') {
    app.currentModelIndex = (app.currentModelIndex - 1 + RingConfig.products.items.length) % RingConfig.products.items.length;
  }

  const modelURL = RingConfig.products.items[app.currentModelIndex];
  console.log(`🔄 Swapping ring: ${direction} → Model ${app.currentModelIndex + 1}/${RingConfig.products.items.length}`);

  try {
    await app.threeScene.reloadModel(modelURL);
  } catch (error) {
    console.error('Error loading model:', error);
  }
}

/**
 * Update gesture status display
 */
function updateGestureStatus(state) {
  const statusEl = document.getElementById('gestureStatus');
  if (!statusEl) return;

  const messages = {
    'IDLE': '👋 منتظر حرکت...',
    'THUMB_UP_HOLDING': '👍 نگه دارید = بعدی',
    'THUMB_DOWN_HOLDING': '👎 نگه دارید = قبلی',
    'COOLDOWN': '⏳ صبر کنید...'
  };

  statusEl.textContent = messages[state] || state;
  statusEl.className = `gesture-status ${state.toLowerCase().replace(/_/g, '-')}`;
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
  if (app.debugPanel) {
    app.debugPanel.destroy();
  }
  if (app.gestureDebugPanel) {
    app.gestureDebugPanel.destroy();
  }
  if (app.gestureDetector) {
    app.gestureDetector.destroy();
  }
});

// Start application
if (document.readyState === 'loading') {
  window.addEventListener('load', init);
} else {
  init();
}
