/**
 * Gesture Detector - Main Application
 * Fist-to-Palm gesture recognition for product swapping
 */

import { GestureConfig } from './config.js';
import { MediaPipeGestureTracker } from './core/MediaPipeGestureTracker.js';
import { FistPalmDetector } from './core/FistPalmDetector.js';
import { DebugPanel } from './debug/DebugPanel.js';

// Application state
const app = {
  tracker: null,
  detector: null,
  debugPanel: null,
  currentProductIndex: 0,
  products: [],
  isLoading: true
};

/**
 * Initialize application
 */
async function init() {
  try {
    console.log('🚀 Initializing Gesture Detector...');

    // Get DOM elements
    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const changeCameraBtn = document.getElementById('changeCamera');

    // Initialize products
    app.products = GestureConfig.products.items;
    app.currentProductIndex = GestureConfig.products.initialIndex;
    updateProductDisplay();

    // Initialize FistPalmDetector
    console.log('📐 Creating FistPalmDetector...');
    app.detector = new FistPalmDetector(GestureConfig.gesture);

    // Setup callbacks
    app.detector.onSwapTriggered = handleSwap;
    app.detector.onStateChange = handleStateChange;

    // Initialize MediaPipe tracker
    console.log('👋 Initializing MediaPipe GestureRecognizer...');
    app.tracker = new MediaPipeGestureTracker({
      ...GestureConfig.mediaPipe,
      onResults: handleGestureResults
    });

    await app.tracker.init(videoElement, canvasElement);

    // Start tracking
    console.log('▶️ Starting gesture tracking...');
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
    if (GestureConfig.debug.enabled) {
      console.log('🎛️ Initializing debug panel...');
      app.debugPanel = new DebugPanel(GestureConfig.debug);

      // Keyboard toggle: Press 'D' to show/hide panel
      window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
          app.debugPanel.toggle();
        }
      });

      console.log('✅ Debug panel ready (Press D to toggle)');
    }

    // Hide loading screen
    hideLoading();

    console.log('✅ Gesture Detector Ready!');
  } catch (error) {
    console.error('❌ Initialization Error:', error);
    alert('خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.');
  }
}

/**
 * Handle gesture results from MediaPipe
 */
function handleGestureResults(results) {
  // Process with FistPalmDetector
  const detectorState = app.detector.process(results);

  // Update debug panel
  if (app.debugPanel) {
    app.debugPanel.update({
      gesture: detectorState.gesture,
      state: detectorState.state,
      timeRemaining: detectorState.timeRemaining,
      handPosition: detectorState.handPosition
    });
  }

  // Update gesture status display
  updateGestureStatus(detectorState);
}

/**
 * Handle swap trigger
 */
function handleSwap(direction) {
  console.log(`🔄 Swap triggered: ${direction}`);

  if (direction === 'next') {
    app.currentProductIndex = (app.currentProductIndex + 1) % app.products.length;
  } else {
    app.currentProductIndex = (app.currentProductIndex - 1 + app.products.length) % app.products.length;
  }

  updateProductDisplay();
  showSwapAnimation(direction);
}

/**
 * Handle state change
 */
function handleStateChange(stateInfo) {
  console.log(`🔀 State: ${stateInfo.from} → ${stateInfo.to}`);
}

/**
 * Update product display
 */
function updateProductDisplay() {
  const product = app.products[app.currentProductIndex];
  const displayEl = document.getElementById('productDisplay');
  const nameEl = document.getElementById('productName');
  const emojiEl = document.getElementById('productEmoji');
  const indexEl = document.getElementById('productIndex');

  nameEl.textContent = product.name;
  emojiEl.textContent = product.image;
  indexEl.textContent = `${app.currentProductIndex + 1} / ${app.products.length}`;
  displayEl.style.borderColor = product.color;
}

/**
 * Update gesture status display
 */
function updateGestureStatus(detectorState) {
  const statusEl = document.getElementById('gestureStatus');
  const timerEl = document.getElementById('gestureTimer');

  const { state, gesture, timeRemaining } = detectorState;

  let statusText = '';
  let statusClass = '';

  switch (state) {
    case 'IDLE':
      statusText = 'منتظر حرکت...';
      statusClass = 'idle';
      timerEl.textContent = '';
      break;

    case 'FIST_DETECTED':
      statusText = '🤜 مشت تشخیص داده شد - دست را باز کنید';
      statusClass = 'fist';
      timerEl.textContent = `${(timeRemaining / 1000).toFixed(1)}s`;
      break;

    case 'PALM_DETECTED':
      statusText = '✋ تعویض محصول!';
      statusClass = 'palm';
      timerEl.textContent = '';
      break;

    case 'COOLDOWN':
      statusText = '⏳ صبر کنید...';
      statusClass = 'cooldown';
      timerEl.textContent = '';
      break;
  }

  statusEl.textContent = statusText;
  statusEl.className = `gesture-status ${statusClass}`;
}

/**
 * Show swap animation
 */
function showSwapAnimation(direction) {
  const displayEl = document.getElementById('productDisplay');
  displayEl.classList.add('swap-animation');

  setTimeout(() => {
    displayEl.classList.remove('swap-animation');
  }, 500);
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
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  if (app.tracker) {
    app.tracker.destroy();
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
