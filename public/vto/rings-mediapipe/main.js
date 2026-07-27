/**
 * Main Application Entry Point
 * MediaPipe Hands + Three.js Ring Try-On
 */

import { MediaPipeTracker } from './core/MediaPipeTracker.js';
import { ThreeSceneManager } from './core/ThreeSceneManager.js';

// Application state
const appState = {
  tracker: null,
  threeScene: null,
  isInstructionsHidden: false
};

/**
 * Initialize application
 */
async function init() {
  try {
    console.log('Initializing Ring Try-On Application...');

    // Get DOM elements
    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const vtoCanvas = document.getElementById('VTOCanvas');
    const changeCameraBtn = document.getElementById('changeCamera');

    // Initialize Three.js scene
    appState.threeScene = new ThreeSceneManager(vtoCanvas, {
      modelURL: window.VTO_MODEL_URL || '/models/rings/default.glb',
      modelScale: 0.45,
      occluderRadiusRange: [1.2, 1.5],
      occluderHeight: 30,
      debugOccluder: false
    });

    // Load ring model
    await appState.threeScene.loadRingModel();

    // Add soft occluder
    appState.threeScene.addSoftOccluder();

    // Initialize MediaPipe tracker
    appState.tracker = new MediaPipeTracker({
      numHands: 1,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
      facingMode: 'user',
      debugDrawLandmarks: false,  // Set to true to see landmarks on canvas
      onResults: handleTrackingResults
    });

    await appState.tracker.init(videoElement, canvasElement);

    // Start tracking
    appState.tracker.start();

    // Setup camera switch button
    changeCameraBtn.addEventListener('click', async () => {
      try {
        await appState.tracker.switchCamera();
      } catch (error) {
        console.error('Error switching camera:', error);
      }
    });

    // Start render loop
    startRenderLoop();

    // Hide loading screen
    hideLoading();

    console.log('Application initialized successfully!');
  } catch (error) {
    console.error('Initialization error:', error);
    alert('خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.');
  }
}

/**
 * Handle MediaPipe tracking results
 */
function handleTrackingResults(results) {
  // Update Three.js ring position from landmarks
  appState.threeScene.updateFromLandmarks(results);

  // Hide instructions when hand detected
  if (results.landmarks && results.landmarks.length > 0) {
    if (!appState.isInstructionsHidden) {
      hideInstructions();
    }
  }
}

/**
 * Three.js render loop
 */
function startRenderLoop() {
  function animate() {
    appState.threeScene.render();
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
      loadingEl.parentNode.removeChild(loadingEl);
    }, 500);
  }
}

/**
 * Hide instructions
 */
function hideInstructions() {
  const instructionsEl = document.getElementById('instructions');
  if (instructionsEl && !appState.isInstructionsHidden) {
    instructionsEl.style.opacity = '0';
    appState.isInstructionsHidden = true;
    setTimeout(() => {
      instructionsEl.parentNode.removeChild(instructionsEl);
    }, 500);
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  if (appState.tracker) {
    appState.tracker.destroy();
  }
  if (appState.threeScene) {
    appState.threeScene.destroy();
  }
});

// Start application when page loads
window.addEventListener('load', init);
