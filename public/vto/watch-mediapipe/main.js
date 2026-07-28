/**
 * Main Application Entry Point
 * MediaPipe Hands + Three.js Watch Try-On
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
    console.log('🚀 Step 1: Initializing Watch Try-On Application...');

    // Get DOM elements
    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const vtoCanvas = document.getElementById('VTOCanvas');
    const changeCameraBtn = document.getElementById('changeCamera');
    console.log('✅ Step 2: DOM elements retrieved');

    // Initialize Three.js scene
    console.log('🎨 Step 3: Creating Three.js scene...');
    appState.threeScene = new ThreeSceneManager(vtoCanvas, {
      modelURL: window.VTO_MODEL_URL || '/models/watch/default.glb',
      modelScale: 90,
      watchDiameter: 100,  // 42mm standard watch
      occluderRadiusRange: [4.0, 4.5],
      occluderHeight: 8,
      debugOccluder: false
    });
    console.log('✅ Step 4: Three.js scene created');

    // Load watch model
    console.log('📦 Step 5: Loading watch model...');
    await appState.threeScene.loadWatchModel();
    console.log('✅ Step 6: Watch model loaded');

    // Add soft occluder
    console.log('🔲 Step 7: Adding occluder...');
    appState.threeScene.addSoftOccluder();
    console.log('✅ Step 8: Occluder added');

    // Add debug box
    console.log('🔴 Step 8.5: Adding debug box...');
    appState.threeScene.addDebugBox();
    console.log('✅ Step 8.5: Debug box added');

    // Initialize MediaPipe tracker
    console.log('👋 Step 9: Initializing MediaPipe tracker...');
    appState.tracker = new MediaPipeTracker({
      numHands: 1,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
      facingMode: 'user',
      debugDrawLandmarks: true,  // Set to true to see landmarks on canvas
      onResults: handleTrackingResults
    });
    console.log('✅ Step 10: MediaPipe tracker instance created');

    console.log('🎥 Step 11: Initializing camera and MediaPipe...');
    await appState.tracker.init(videoElement, canvasElement);
    console.log('✅ Step 12: Camera and MediaPipe initialized');

    // Start tracking
    console.log('▶️ Step 13: Starting hand tracking...');
    appState.tracker.start();
    console.log('✅ Step 14: Tracking started');

    // Setup camera switch button
    changeCameraBtn.addEventListener('click', async () => {
      try {
        await appState.tracker.switchCamera();
      } catch (error) {
        console.error('Error switching camera:', error);
      }
    });

    // Start render loop
    console.log('🔄 Step 15: Starting render loop...');
    startRenderLoop();
    console.log('✅ Step 16: Render loop started');

    // Hide loading screen
    console.log('🎉 Step 17: Hiding loading screen...');
    hideLoading();

    console.log('✅✅✅ APPLICATION READY! ✅✅✅');
  } catch (error) {
    console.error('❌❌❌ INITIALIZATION ERROR ❌❌❌');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    alert('خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.\n\nCheck console for details.');
  }
}

/**
 * Handle MediaPipe tracking results
 */
function handleTrackingResults(results) {
  // Update Three.js watch position from landmarks
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
// Since we're using dynamic imports, page may already be loaded
if (document.readyState === 'loading') {
  window.addEventListener('load', init);
} else {
  // Page already loaded, call init immediately
  console.log('📄 Page already loaded, calling init()...');
  init();
}
