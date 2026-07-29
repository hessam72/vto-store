# API Reference

Quick reference for gesture detector classes and methods.

---

## FistPalmDetector

**File:** `core/FistPalmDetector.js`

### Constructor

```javascript
new FistPalmDetector(config)
```

**Parameters:**
- `config` (Object): Configuration options

**Config Properties:**
```javascript
{
  minConfidence: 0.7,          // number - Standard gesture threshold
  minPalmConfidence: 0.4,      // number - Open_Palm threshold
  fistToPalmTimeoutMs: 3000,   // number - Fist→Palm window
  thumbHoldDurationMs: 1500,   // number - Thumb hold duration
  cooldownMs: 1000,            // number - Post-swap cooldown
  screenDivisionRatio: 0.5     // number - Left/right split (0-1)
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `currentState` | string | Current state machine state |
| `states` | object | State constants (IDLE, FIST_DETECTED, etc.) |
| `config` | object | Configuration object |

### Methods

#### process(results)

Process MediaPipe gesture results.

**Parameters:**
- `results` (Object): MediaPipe gesture results
  ```javascript
  {
    gestures: [{ category: string, confidence: number }],
    landmarks: [{ x: number, y: number, z: number }]
  }
  ```

**Returns:** Object
```javascript
{
  state: string,           // Current state
  gesture: object,         // { category: string, confidence: number }
  timeRemaining: number,   // Milliseconds remaining
  handPosition: object     // { x: number, y: number }
}
```

**Example:**
```javascript
const state = detector.process({
  gestures: [{ category: 'Closed_Fist', confidence: 0.87 }],
  landmarks: [{ x: 0.3, y: 0.5, z: 0 }]
});

console.log(state.state); // 'FIST_DETECTED'
console.log(state.timeRemaining); // 3000
```

#### reset()

Reset detector to IDLE state.

**Example:**
```javascript
detector.reset();
console.log(detector.currentState); // 'IDLE'
```

#### destroy()

Cleanup and remove event listeners.

**Example:**
```javascript
detector.destroy();
```

### Event Callbacks

#### onSwapTriggered

Called when swap gesture is completed.

**Signature:**
```javascript
(direction: 'next' | 'previous') => void
```

**Example:**
```javascript
detector.onSwapTriggered = (direction) => {
  if (direction === 'next') {
    loadNextProduct();
  } else {
    loadPreviousProduct();
  }
};
```

#### onStateChange

Called when state machine transitions.

**Signature:**
```javascript
(stateInfo: { from: string, to: string, timestamp: number }) => void
```

**Example:**
```javascript
detector.onStateChange = (info) => {
  console.log(`${info.from} → ${info.to}`);
};
```

### State Machine States

```javascript
detector.states = {
  IDLE: 'IDLE',
  FIST_DETECTED: 'FIST_DETECTED',
  THUMB_UP_HOLDING: 'THUMB_UP_HOLDING',
  THUMB_DOWN_HOLDING: 'THUMB_DOWN_HOLDING',
  PALM_DETECTED: 'PALM_DETECTED',
  COOLDOWN: 'COOLDOWN'
}
```

---

## MediaPipeGestureTracker

**File:** `core/MediaPipeGestureTracker.js`

### Constructor

```javascript
new MediaPipeGestureTracker(config)
```

**Parameters:**
- `config` (Object): Configuration options

**Config Properties:**
```javascript
{
  numHands: 1,                      // number - Max hands to track
  minHandDetectionConfidence: 0.7,  // number - Detection threshold
  minHandPresenceConfidence: 0.7,   // number - Presence threshold
  minTrackingConfidence: 0.7,       // number - Tracking threshold
  facingMode: 'user',               // string - Camera facing ('user' | 'environment')
  videoWidth: 1280,                 // number - Video width
  videoHeight: 720,                 // number - Video height
  version: '0.10.35',               // string - MediaPipe version
  onResults: (results) => {}        // function - Results callback
}
```

### Methods

#### init(videoElement, canvasElement)

Initialize MediaPipe and camera.

**Parameters:**
- `videoElement` (HTMLVideoElement): Video element for camera stream
- `canvasElement` (HTMLCanvasElement): Canvas for visualization

**Returns:** Promise<boolean>

**Example:**
```javascript
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

await tracker.init(video, canvas);
```

#### start()

Start gesture detection loop.

**Example:**
```javascript
tracker.start();
```

#### stop()

Stop gesture detection loop.

**Example:**
```javascript
tracker.stop();
```

#### switchCamera()

Switch between front/back camera.

**Returns:** Promise<void>

**Example:**
```javascript
await tracker.switchCamera();
```

#### destroy()

Cleanup resources and stop camera.

**Example:**
```javascript
tracker.destroy();
```

### Event Callbacks

#### onResults

Called for each frame with gesture results.

**Signature:**
```javascript
(results: {
  gestures: Array<{ category: string, confidence: number }>,
  landmarks: Array<{ x: number, y: number, z: number }>,
  handedness: Array<{ category: string, confidence: number }>,
  timestamp: number
}) => void
```

**Example:**
```javascript
tracker.onResults = (results) => {
  console.log('Detected:', results.gestures[0]?.category);
  console.log('Confidence:', results.gestures[0]?.confidence);
};
```

---

## DebugPanel

**File:** `debug/DebugPanel.js`

### Constructor

```javascript
new DebugPanel(config)
```

**Parameters:**
- `config` (Object): Debug configuration

**Config Properties:**
```javascript
{
  enabled: true,              // boolean - Show/hide panel
  showLandmarks: false,       // boolean - Show hand landmarks
  showGestureInfo: true,      // boolean - Show gesture name/confidence
  showTimer: true,            // boolean - Show countdown timer
  showStateMachine: true,     // boolean - Show current state
  panelPosition: 'top-left'   // string - Position ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')
}
```

### Methods

#### update(data)

Update debug panel with current data.

**Parameters:**
- `data` (Object): State data
  ```javascript
  {
    gesture: { category: string, confidence: number },
    state: string,
    timeRemaining: number,
    handPosition: { x: number, y: number }
  }
  ```

**Example:**
```javascript
const state = detector.process(results);
debugPanel.update(state);
```

#### toggle()

Toggle panel visibility.

**Example:**
```javascript
// Keyboard shortcut
window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugPanel.toggle();
});
```

#### show()

Show panel.

**Example:**
```javascript
debugPanel.show();
```

#### hide()

Hide panel.

**Example:**
```javascript
debugPanel.hide();
```

#### destroy()

Remove panel from DOM.

**Example:**
```javascript
debugPanel.destroy();
```

---

## GestureConfig

**File:** `config.js`

Default configuration object.

### Structure

```javascript
export const GestureConfig = {
  mediaPipe: {
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.7,
    minTrackingConfidence: 0.7,
    facingMode: 'user',
    videoWidth: 1280,
    videoHeight: 720,
    version: '0.10.35'
  },

  gesture: {
    minConfidence: 0.7,
    minPalmConfidence: 0.4,
    fistToPalmTimeoutMs: 3000,
    thumbHoldDurationMs: 1500,
    cooldownMs: 1000,
    screenDivisionRatio: 0.5
  },

  products: {
    items: [
      { id: 1, name: 'محصول ۱', image: '💍', color: '#FFD700' },
      // ... more products
    ],
    initialIndex: 0
  },

  debug: {
    enabled: true,
    showLandmarks: false,
    showGestureInfo: true,
    showTimer: true,
    showStateMachine: true,
    panelPosition: 'top-left'
  }
};
```

### Usage

```javascript
import { GestureConfig } from './config.js';

// Use default config
const detector = new FistPalmDetector(GestureConfig.gesture);

// Override specific values
const customConfig = {
  ...GestureConfig.gesture,
  minConfidence: 0.6
};
const detector = new FistPalmDetector(customConfig);
```

---

## MediaPipe Gesture Categories

Built-in gestures detected by MediaPipe GestureRecognizer.

| Gesture | Category Name | Confidence Range |
|---------|---------------|------------------|
| 🤜 Closed Fist | `Closed_Fist` | 0.0 - 1.0 |
| ✋ Open Palm | `Open_Palm` | 0.0 - 1.0 |
| 👍 Thumbs Up | `Thumb_Up` | 0.0 - 1.0 |
| 👎 Thumbs Down | `Thumb_Down` | 0.0 - 1.0 |
| ☝️ Pointing Up | `Pointing_Up` | 0.0 - 1.0 |
| ✌️ Victory | `Victory` | 0.0 - 1.0 |
| 🤟 I Love You | `ILoveYou` | 0.0 - 1.0 |
| ❌ None | `None` | 0.0 |

**Note:** Only `Closed_Fist`, `Open_Palm`, `Thumb_Up`, and `Thumb_Down` are actively used by the detector.

---

## Type Definitions

### GestureResult

```typescript
interface GestureResult {
  category: string;      // Gesture name
  confidence: number;    // 0.0 - 1.0
}
```

### Landmark

```typescript
interface Landmark {
  x: number;  // Normalized 0.0 - 1.0 (screen width)
  y: number;  // Normalized 0.0 - 1.0 (screen height)
  z: number;  // Depth (meters from camera)
}
```

### DetectorState

```typescript
interface DetectorState {
  state: string;              // Current state machine state
  gesture: GestureResult;     // Detected gesture
  timeRemaining: number;      // Milliseconds remaining
  handPosition: {             // Hand position
    x: number;
    y: number;
  };
}
```

### StateChangeInfo

```typescript
interface StateChangeInfo {
  from: string;        // Previous state
  to: string;          // New state
  timestamp: number;   // Performance.now() timestamp
}
```

---

## Constants

### Landmark Indices

```javascript
const LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  // ... etc (21 total)
};
```

### Default Thresholds

```javascript
const DEFAULTS = {
  MIN_CONFIDENCE: 0.7,
  MIN_PALM_CONFIDENCE: 0.4,
  FIST_PALM_TIMEOUT: 3000,
  THUMB_HOLD_DURATION: 1500,
  COOLDOWN_DURATION: 1000
};
```

---

## Error Codes

Possible errors thrown by the system:

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot access camera` | Camera permission denied | Request user to allow camera access |
| `MediaPipe model load failed` | Network error | Check internet connection |
| `Invalid configuration` | Bad config values | Verify config object structure |
| `Video element not ready` | Video metadata not loaded | Wait for `loadedmetadata` event |

---

## Browser Compatibility

### Required APIs

- `navigator.mediaDevices.getUserMedia`
- `HTMLCanvasElement.getContext('2d')`
- `performance.now()`
- `requestAnimationFrame()`
- ES6 modules (`import`/`export`)

### Minimum Versions

- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+ (partial support)

---

**For detailed examples, see [INTEGRATION.md](INTEGRATION.md)**
