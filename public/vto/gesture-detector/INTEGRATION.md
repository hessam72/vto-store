# Quick Integration Guide

**5-minute setup for VTO apps**

## Minimal Integration

### Step 1: Copy Files

```bash
cp -r gesture-detector/core/ your-vto-app/
cp gesture-detector/config.js your-vto-app/
```

### Step 2: Add HTML

```html
<video id="videoElement" autoplay playsinline></video>
<canvas id="canvasElement"></canvas>

<!-- Import map -->
<script type="importmap">
{
  "imports": {
    "@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
  }
}
</script>
```

### Step 3: Initialize

```javascript
import { FistPalmDetector } from './core/FistPalmDetector.js';
import { MediaPipeGestureTracker } from './core/MediaPipeGestureTracker.js';
import { GestureConfig } from './config.js';

const app = {
  tracker: null,
  detector: null,
  currentModelIndex: 0,
  models: ['ring1.glb', 'ring2.glb', 'ring3.glb']
};

async function init() {
  // Initialize detector
  app.detector = new FistPalmDetector(GestureConfig.gesture);

  app.detector.onSwapTriggered = (direction) => {
    if (direction === 'next') {
      app.currentModelIndex = (app.currentModelIndex + 1) % app.models.length;
    } else {
      app.currentModelIndex = (app.currentModelIndex - 1 + app.models.length) % app.models.length;
    }
    loadModel(app.models[app.currentModelIndex]);
  };

  // Initialize MediaPipe tracker
  app.tracker = new MediaPipeGestureTracker({
    ...GestureConfig.mediaPipe,
    onResults: (results) => {
      app.detector.process(results);
    }
  });

  const video = document.getElementById('videoElement');
  const canvas = document.getElementById('canvasElement');

  await app.tracker.init(video, canvas);
  app.tracker.start();
}

function loadModel(modelPath) {
  console.log('Loading model:', modelPath);
  // Your 3D model loading logic here
}

init();
```

## Event Callbacks

### onSwapTriggered

```javascript
detector.onSwapTriggered = (direction) => {
  // direction: 'next' | 'previous'

  console.log(`Swap to ${direction}`);

  // Update your VTO state here
  if (direction === 'next') {
    showNextProduct();
  } else {
    showPreviousProduct();
  }
};
```

### onStateChange

```javascript
detector.onStateChange = (stateInfo) => {
  // stateInfo: { from: string, to: string, timestamp: number }

  console.log(`State: ${stateInfo.from} → ${stateInfo.to}`);

  // Update UI feedback
  switch (stateInfo.to) {
    case 'FIST_DETECTED':
      showStatus('🤜 Make a fist, then open palm');
      break;
    case 'THUMB_UP_HOLDING':
      showStatus('👍 Hold for next...');
      break;
    case 'COOLDOWN':
      showStatus('⏳ Wait...');
      break;
  }
};
```

## Configuration Presets

### High Sensitivity (Easy Mode)

```javascript
const easyConfig = {
  minConfidence: 0.5,
  minPalmConfidence: 0.3,
  fistToPalmTimeoutMs: 4000,
  thumbHoldDurationMs: 1000,
  cooldownMs: 800
};

const detector = new FistPalmDetector(easyConfig);
```

### Low Sensitivity (Precise Mode)

```javascript
const preciseConfig = {
  minConfidence: 0.8,
  minPalmConfidence: 0.6,
  fistToPalmTimeoutMs: 2000,
  thumbHoldDurationMs: 2000,
  cooldownMs: 1500
};

const detector = new FistPalmDetector(preciseConfig);
```

### Thumbs-Only Mode

```javascript
const thumbsOnlyConfig = {
  minConfidence: 0.7,
  thumbHoldDurationMs: 1200,
  cooldownMs: 1000,
  // Fist→Palm disabled by setting timeout to 0
  fistToPalmTimeoutMs: 0
};
```

## UI Feedback Examples

### Status Indicator

```javascript
const statusEl = document.getElementById('gestureStatus');

function handleResults(results) {
  const state = detector.process(results);

  const messages = {
    'IDLE': 'Ready for gesture',
    'FIST_DETECTED': '🤜 Now open palm!',
    'THUMB_UP_HOLDING': '👍 Keep holding...',
    'THUMB_DOWN_HOLDING': '👎 Keep holding...',
    'PALM_DETECTED': '✅ Swapped!',
    'COOLDOWN': 'Please wait...'
  };

  statusEl.textContent = messages[state.state] || 'Unknown';
}
```

### Countdown Timer

```javascript
const timerEl = document.getElementById('timer');

function handleResults(results) {
  const state = detector.process(results);

  if (state.timeRemaining > 0) {
    const seconds = (state.timeRemaining / 1000).toFixed(1);
    timerEl.textContent = `${seconds}s`;
    timerEl.style.display = 'block';
  } else {
    timerEl.style.display = 'none';
  }
}
```

### Progress Bar

```javascript
const progressBar = document.getElementById('progress');

function handleResults(results) {
  const state = detector.process(results);

  if (state.state === 'FIST_DETECTED') {
    // Countdown: empties from 100% → 0%
    const percent = (state.timeRemaining / 3000) * 100;
    progressBar.style.width = percent + '%';
  } else if (state.state.includes('THUMB')) {
    // Count up: fills from 0% → 100%
    const percent = ((1500 - state.timeRemaining) / 1500) * 100;
    progressBar.style.width = percent + '%';
  }
}
```

## Common Use Cases

### Ring VTO with Gesture Swap

```javascript
import { RingScene } from './RingScene.js';

const ringScene = new RingScene();
const ringModels = [
  '/models/rings/gold.glb',
  '/models/rings/silver.glb',
  '/models/rings/diamond.glb'
];
let currentRingIndex = 0;

detector.onSwapTriggered = async (direction) => {
  if (direction === 'next') {
    currentRingIndex = (currentRingIndex + 1) % ringModels.length;
  } else {
    currentRingIndex = (currentRingIndex - 1 + ringModels.length) % ringModels.length;
  }

  await ringScene.loadModel(ringModels[currentRingIndex]);
  console.log('Loaded ring:', ringModels[currentRingIndex]);
};
```

### Watch VTO with Product Info

```javascript
const watches = [
  { name: 'Classic Gold', model: 'watch1.glb', price: '$299' },
  { name: 'Sport Silver', model: 'watch2.glb', price: '$199' },
  { name: 'Luxury Diamond', model: 'watch3.glb', price: '$999' }
];
let currentIndex = 0;

detector.onSwapTriggered = (direction) => {
  if (direction === 'next') {
    currentIndex = (currentIndex + 1) % watches.length;
  } else {
    currentIndex = (currentIndex - 1 + watches.length) % watches.length;
  }

  const watch = watches[currentIndex];

  // Update 3D model
  watchScene.loadModel(watch.model);

  // Update UI
  document.getElementById('productName').textContent = watch.name;
  document.getElementById('productPrice').textContent = watch.price;
  document.getElementById('productIndex').textContent = `${currentIndex + 1}/${watches.length}`;
};
```

## Error Handling

```javascript
async function init() {
  try {
    app.detector = new FistPalmDetector(GestureConfig.gesture);
    app.tracker = new MediaPipeGestureTracker({
      ...GestureConfig.mediaPipe,
      onResults: handleResults
    });

    await app.tracker.init(videoElement, canvasElement);
    app.tracker.start();

  } catch (error) {
    console.error('Initialization failed:', error);

    if (error.message.includes('camera')) {
      alert('Camera access required. Please allow camera permissions.');
    } else if (error.message.includes('model')) {
      alert('Failed to load MediaPipe model. Check your internet connection.');
    } else {
      alert('Gesture detection initialization failed: ' + error.message);
    }
  }
}
```

## Cleanup

```javascript
window.addEventListener('beforeunload', () => {
  if (app.tracker) {
    app.tracker.destroy();
  }
  if (app.detector) {
    app.detector.destroy();
  }
});

// Or manual cleanup
function cleanup() {
  app.tracker?.destroy();
  app.detector?.destroy();
  app.tracker = null;
  app.detector = null;
}
```

## Testing Tips

### Console Debugging

```javascript
detector.onStateChange = (stateInfo) => {
  console.log(`[${new Date().toISOString()}] ${stateInfo.from} → ${stateInfo.to}`);
};

detector.onSwapTriggered = (direction) => {
  console.log(`[SWAP] Direction: ${direction}`);
};
```

### Mock Gestures (for testing without camera)

```javascript
// Simulate fist→palm combo
function mockFistPalm() {
  const fistResult = {
    gestures: [{ category: 'Closed_Fist', confidence: 0.9 }],
    landmarks: [{ x: 0.3, y: 0.5, z: 0 }]
  };

  detector.process(fistResult);

  setTimeout(() => {
    const palmResult = {
      gestures: [{ category: 'Open_Palm', confidence: 0.8 }],
      landmarks: [{ x: 0.3, y: 0.5, z: 0 }]
    };
    detector.process(palmResult);
  }, 500);
}

// Simulate thumb up
function mockThumbUp() {
  const thumbResult = {
    gestures: [{ category: 'Thumb_Up', confidence: 0.9 }],
    landmarks: [{ x: 0.5, y: 0.5, z: 0 }]
  };

  const interval = setInterval(() => {
    detector.process(thumbResult);
  }, 100);

  setTimeout(() => clearInterval(interval), 1600);
}
```

## Performance Tips

1. **Lower video resolution** for faster processing:
```javascript
mediaPipe: {
  videoWidth: 640,
  videoHeight: 480
}
```

2. **Disable debug panel** in production:
```javascript
debug: {
  enabled: false
}
```

3. **Reduce frame processing** if needed:
```javascript
let lastProcessTime = 0;
const PROCESS_INTERVAL = 100; // Process every 100ms

function onResults(results) {
  const now = performance.now();
  if (now - lastProcessTime < PROCESS_INTERVAL) return;

  lastProcessTime = now;
  detector.process(results);
}
```

## Complete Example

See [`index.html`](index.html) and [`main.js`](main.js) for full working implementation.

---

**Ready to integrate?** Start with Step 1 above!
