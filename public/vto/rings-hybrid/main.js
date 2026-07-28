/**
 * Hybrid Ring VTO - Main Application
 * Combines MediaPipe hand detection with WebARRocks ring placement logic
 */

import { RingConfig } from './config.js';
import { MediaPipeTracker } from './core/MediaPipeTracker.js';
import { RingPositioner } from './core/RingPositioner.js';
import { ThreeRingScene } from './core/ThreeRingScene.js';

// Application state
const app = {
  tracker: null,
  positioner: null,
  threeScene: null,
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
  // Calculate ring position and rotation from landmarks
  const videoWidth = app.tracker.canvasElement.width;
  const videoHeight = app.tracker.canvasElement.height;

  const transform = app.positioner.calculate(results, videoWidth, videoHeight);

  // Update Three.js ring
  app.threeScene.updateRingTransform(transform);

  // Hide instructions when hand detected
  if (transform.visible && !app.isInstructionsHidden) {
    hideInstructions();
  }
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
 * Handle window resize
 */
window.addEventListener('resize', () => {
  if (app.threeScene) {
    app.threeScene.updateCameraAspect();
  }
});

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
});

// Start application
if (document.readyState === 'loading') {
  window.addEventListener('load', init);
} else {
  init();
}
