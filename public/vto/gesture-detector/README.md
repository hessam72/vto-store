# Gesture Detector - Product Swap System

**MediaPipe-based hand gesture recognition for product navigation**

## Overview

Real-time gesture detection system using MediaPipe GestureRecognizer to swap products in VTO applications. Supports two gesture methods:

1. **Fist→Palm Combo**: Closed fist followed by open palm (3-second window)
2. **Thumb Hold**: Hold thumbs-up (next) or thumbs-down (previous) for 1.5 seconds

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        main.js                              │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │ Product Carousel│  │      Event Handlers               │ │
│  │  - 5 Products   │  │  - onSwapTriggered()              │ │
│  │  - Index State  │  │  - onStateChange()                │ │
│  └────────┬────────┘  └──────────────┬───────────────────┘ │
│           │                           │                     │
└───────────┼───────────────────────────┼─────────────────────┘
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌──────────────────────────────┐
│ MediaPipeGestureTracker│◄─►│   FistPalmDetector          │
│                        │   │   (State Machine)            │
│ - GestureRecognizer   │   │                              │
│ - Camera Management    │   │ States:                      │
│ - Frame Processing     │   │  • IDLE                      │
│ - Gesture Classification│   │  • FIST_DETECTED            │
│                        │   │  • THUMB_UP_HOLDING          │
│ Outputs:               │   │  • THUMB_DOWN_HOLDING        │
│  • gestures[]          │   │  • PALM_DETECTED             │
│  • landmarks[]         │   │  • COOLDOWN                  │
│  • handedness[]        │   │                              │
└───────────────────────┘   └──────────────────────────────┘
            │                           │
            └───────────────┬───────────┘
                            ▼
                    ┌───────────────┐
                    │  DebugPanel   │
                    │               │
                    │ - FPS         │
                    │ - Gesture Info│
                    │ - State       │
                    │ - Timer       │
                    │ - Hand Pos    │
                    └───────────────┘
```

---

## File Structure

```
gesture-detector/
├── index.html                      # UI: video, canvas, product carousel
├── config.js                       # Configuration & thresholds
├── main.js                         # App initialization & event handling
├── core/
│   ├── MediaPipeGestureTracker.js  # MediaPipe GestureRecognizer wrapper
│   └── FistPalmDetector.js         # State machine for gesture sequences
└── debug/
    └── DebugPanel.js               # Real-time debug visualization
```

---

## Gesture Recognition Methods

### Method 1: Fist→Palm Combo

**Trigger Sequence:**
1. Close fist (🤜 `Closed_Fist` detected)
2. Within 3 seconds, open palm (✋ `Open_Palm` detected)
3. Direction based on hand position:
   - **Left half of screen** → Previous product
   - **Right half of screen** → Next product

**State Flow:**
```
IDLE → FIST_DETECTED → PALM_DETECTED → COOLDOWN → IDLE
       (3s timeout)      (instant)      (1s)
```

**Key Features:**
- Accepts `None` gesture during transition (handles detection gaps)
- Lower confidence threshold for `Open_Palm` (40% vs 70%)
- Resets on unwanted gestures (e.g., `Victory`, `Pointing_Up`)

---

### Method 2: Thumb Hold

**Trigger Sequence:**
- **Thumbs-Up (👍)**: Hold for 1.5 seconds → Next product
- **Thumbs-Down (👎)**: Hold for 1.5 seconds → Previous product

**State Flow:**
```
IDLE → THUMB_UP_HOLDING → COOLDOWN → IDLE
       (1.5s hold)         (1s)

IDLE → THUMB_DOWN_HOLDING → COOLDOWN → IDLE
       (1.5s hold)           (1s)
```

**Key Features:**
- Explicit directional control
- Must maintain gesture for full duration
- Releases early reset to IDLE

---

## Configuration

**File:** [`config.js`](config.js)

```javascript
gesture: {
  minConfidence: 0.7,           // Standard gesture confidence threshold
  minPalmConfidence: 0.4,       // Lower threshold for Open_Palm (easier trigger)
  fistToPalmTimeoutMs: 3000,    // Fist→Palm window (3 seconds)
  thumbHoldDurationMs: 1500,    // Thumb hold duration (1.5 seconds)
  cooldownMs: 1000,             // Cooldown after swap (1 second)
  screenDivisionRatio: 0.5      // Screen split for fist→palm direction
}
```

### Adjustable Parameters

| Parameter | Default | Purpose | Tuning Guide |
|-----------|---------|---------|--------------|
| `minConfidence` | 0.7 | Standard gesture threshold | Lower = more sensitive (more false positives) |
| `minPalmConfidence` | 0.4 | Open_Palm specific threshold | Handles fist→palm transition gaps |
| `fistToPalmTimeoutMs` | 3000ms | Time window for combo | Longer = easier, shorter = more precise |
| `thumbHoldDurationMs` | 1500ms | Thumb hold duration | Longer = prevents accidents, shorter = faster |
| `cooldownMs` | 1000ms | Post-swap debounce | Prevents double-triggering |
| `screenDivisionRatio` | 0.5 | Left/right split point | Adjust for ergonomics |

---

## State Machine Logic

**File:** [`core/FistPalmDetector.js`](core/FistPalmDetector.js)

### State Definitions

```javascript
states = {
  IDLE: 'IDLE',                    // No gesture detected, ready for input
  FIST_DETECTED: 'FIST_DETECTED',  // Fist detected, waiting for palm
  THUMB_UP_HOLDING: '...',         // Holding thumbs-up, counting duration
  THUMB_DOWN_HOLDING: '...',       // Holding thumbs-down, counting duration
  PALM_DETECTED: 'PALM_DETECTED',  // Palm detected after fist, triggering swap
  COOLDOWN: 'COOLDOWN'             // Post-swap cooldown period
}
```

### Transition Rules

#### From IDLE
```javascript
if (Closed_Fist && confidence >= 0.7)
  → FIST_DETECTED (start 3s timer)

if (Thumb_Up && confidence >= 0.7)
  → THUMB_UP_HOLDING (start 1.5s timer)

if (Thumb_Down && confidence >= 0.7)
  → THUMB_DOWN_HOLDING (start 1.5s timer)
```

#### From FIST_DETECTED
```javascript
if (Open_Palm && confidence >= 0.4)
  → PALM_DETECTED (trigger swap based on hand position)

if (elapsed > 3000ms)
  → IDLE (timeout)

if (unwanted gesture detected)
  → IDLE (reset)

// Stays in FIST_DETECTED if:
// - Still Closed_Fist
// - None gesture (transition gap)
// - Low-confidence gesture
```

#### From THUMB_UP_HOLDING
```javascript
if (Thumb_Up && elapsed >= 1500ms)
  → COOLDOWN (trigger "next")

if (!Thumb_Up || different gesture)
  → IDLE (released too early)
```

#### From THUMB_DOWN_HOLDING
```javascript
if (Thumb_Down && elapsed >= 1500ms)
  → COOLDOWN (trigger "previous")

if (!Thumb_Down || different gesture)
  → IDLE (released too early)
```

---

## MediaPipe Integration

**File:** [`core/MediaPipeGestureTracker.js`](core/MediaPipeGestureTracker.js)

### Detected Gestures (MediaPipe Built-in)

| Gesture | Category Name | Use Case |
|---------|--------------|----------|
| 🤜 Closed Fist | `Closed_Fist` | Fist→Palm combo (first step) |
| ✋ Open Palm | `Open_Palm` | Fist→Palm combo (second step) |
| 👍 Thumbs Up | `Thumb_Up` | Next product (hold 1.5s) |
| 👎 Thumbs Down | `Thumb_Down` | Previous product (hold 1.5s) |
| ☝️ Pointing Up | `Pointing_Up` | Not used (resets fist state) |
| ✌️ Victory | `Victory` | Not used (resets fist state) |
| 🤟 I Love You | `ILoveYou` | Not used (resets fist state) |

### Confidence Scores

Each gesture returns:
```javascript
{
  category: "Closed_Fist",  // Gesture name
  confidence: 0.87          // 0.0 - 1.0 (87%)
}
```

### Hand Landmarks

21 3D points per hand (normalized [0,1]):
```javascript
landmarks[0]  // Wrist (used for hand position)
landmarks[5]  // Index finger MCP
landmarks[8]  // Index finger tip
landmarks[17] // Pinky MCP
// ... etc
```

**Used For:**
- Hand position tracking (`landmarks[0].x` for left/right detection)
- Future expansion (custom gesture patterns)

---

## Integration Guide

### 1. Standalone Usage

```bash
# Open in browser
vto-store/public/vto/gesture-detector/index.html
```

### 2. Integration into VTO Apps

**Step 1: Import modules**
```javascript
import { FistPalmDetector } from './gesture-detector/core/FistPalmDetector.js';
import { MediaPipeGestureTracker } from './gesture-detector/core/MediaPipeGestureTracker.js';
import { GestureConfig } from './gesture-detector/config.js';
```

**Step 2: Initialize detector**
```javascript
const detector = new FistPalmDetector(GestureConfig.gesture);

detector.onSwapTriggered = (direction) => {
  if (direction === 'next') {
    // Load next ring/watch model
  } else {
    // Load previous ring/watch model
  }
};

detector.onStateChange = (stateInfo) => {
  console.log(`State: ${stateInfo.from} → ${stateInfo.to}`);
};
```

**Step 3: Initialize MediaPipe tracker**
```javascript
const tracker = new MediaPipeGestureTracker({
  ...GestureConfig.mediaPipe,
  onResults: (results) => {
    const state = detector.process(results);
    // Update UI based on state
  }
});

await tracker.init(videoElement, canvasElement);
tracker.start();
```

**Step 4: Update UI**
```javascript
function handleResults(results) {
  const state = detector.process(results);

  // Display gesture status
  updateGestureIndicator(state.gesture.category);

  // Show countdown timer
  if (state.timeRemaining > 0) {
    showTimer(state.timeRemaining / 1000);
  }
}
```

### 3. Customization Examples

**Adjust sensitivity:**
```javascript
const customConfig = {
  ...GestureConfig.gesture,
  minConfidence: 0.6,          // More sensitive
  thumbHoldDurationMs: 1000    // Faster thumb trigger (1s)
};

const detector = new FistPalmDetector(customConfig);
```

**Change screen division:**
```javascript
const customConfig = {
  ...GestureConfig.gesture,
  screenDivisionRatio: 0.4  // 40% left = prev, 60% right = next
};
```

---

## Debug Panel

**File:** [`debug/DebugPanel.js`](debug/DebugPanel.js)

Press **`D`** key to toggle debug panel.

### Displayed Information

```
┌─────────────────────────┐
│ 🎛️ DEBUG PANEL         │
├─────────────────────────┤
│ FPS: 29.8               │
├─────────────────────────┤
│ GESTURE:                │
│ Closed_Fist             │
│ Confidence: 87.3%       │
├─────────────────────────┤
│ STATE MACHINE:          │
│ FIST_DETECTED           │
├─────────────────────────┤
│ TIME REMAINING:         │
│ 2.34s                   │
│ ████████░░░░░░░░ 78%   │
├─────────────────────────┤
│ HAND POSITION:          │
│ X: 0.342                │
│ Y: 0.567                │
│ Direction: LEFT (Prev)  │
├─────────────────────────┤
│ Press 'D' to toggle     │
└─────────────────────────┘
```

### Progress Bar Logic

- **Fist→Palm**: Countdown (empties from 100% → 0%)
- **Thumb Hold**: Count up (fills from 0% → 100%)

---

## Performance Optimization

### Target Metrics
- **FPS**: 30+ frames per second
- **Latency**: <100ms gesture detection
- **Accuracy**: 95%+ for intended gestures

### Configuration for Performance

```javascript
mediaPipe: {
  numHands: 1,                    // Single hand tracking (faster)
  minHandDetectionConfidence: 0.7, // Higher = fewer false detections
  videoWidth: 1280,               // Lower resolution = faster (try 640)
  videoHeight: 720                // Lower resolution = faster (try 480)
}
```

### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 90+ | ✅ Full | Optimal performance |
| Edge 90+ | ✅ Full | Optimal performance |
| Firefox 88+ | ✅ Full | Slightly slower |
| Safari 14+ | ⚠️ Partial | Camera permission issues |
| Mobile Chrome | ✅ Full | Works on Android |
| Mobile Safari | ⚠️ Partial | iOS WebRTC limitations |

---

## Troubleshooting

### Issue: Gestures not detected

**Possible Causes:**
1. **Low confidence**: Lower `minConfidence` in config
2. **Poor lighting**: Advise user to improve lighting
3. **Hand too far/close**: Ideal distance: 30-50cm from camera
4. **Background clutter**: Use plain background

**Solution:**
```javascript
gesture: {
  minConfidence: 0.5,        // Lower threshold
  minPalmConfidence: 0.3     // Even lower for palm
}
```

### Issue: Fist→Palm combo not triggering

**Common Reason:** Gap between gestures exceeds threshold

**Solution:** Already handled by allowing `None` gesture during transition

**Verification:**
```javascript
// Check console logs:
// ✅ "🤜 Fist detected - waiting for palm..."
// ✅ "✋ Palm detected - SWAP TRIGGERED!"

// ❌ "⏱️ Fist-to-palm timeout - resetting"  → User too slow
// ❌ "❌ Unwanted gesture ... - resetting"   → Wrong gesture
```

### Issue: Double-triggering

**Cause:** Cooldown too short

**Solution:**
```javascript
gesture: {
  cooldownMs: 1500  // Increase to 1.5 seconds
}
```

### Issue: Thumb hold triggers immediately

**Cause:** Hold duration too short

**Solution:**
```javascript
gesture: {
  thumbHoldDurationMs: 2000  // Increase to 2 seconds
}
```

---

## Testing Guide

### Manual Testing Checklist

#### Fist→Palm Combo
- [ ] Close fist → Status shows "🤜 مشت تشخیص داده شد"
- [ ] Timer counts down from 3.0s
- [ ] Open palm within 3s → Product swaps
- [ ] Left hand position → Previous product
- [ ] Right hand position → Next product
- [ ] Wait >3s → Resets to IDLE

#### Thumb Up
- [ ] Show thumbs-up → Status shows "👍 نگه دارید"
- [ ] Timer counts down from 1.5s
- [ ] Hold for full 1.5s → Next product
- [ ] Release early → Resets to IDLE

#### Thumb Down
- [ ] Show thumbs-down → Status shows "👎 نگه دارید"
- [ ] Timer counts down from 1.5s
- [ ] Hold for full 1.5s → Previous product
- [ ] Release early → Resets to IDLE

#### Edge Cases
- [ ] Cooldown prevents double-swap (1s delay)
- [ ] Wrong gesture during fist state resets to IDLE
- [ ] `None` gesture during fist state is allowed
- [ ] Camera switch maintains state correctly

---

## Future Enhancements

### Planned Features
1. **Custom Wave Gesture**: Horizontal swipe detection using landmark velocity
2. **Pinch Gesture**: For zoom/scale control
3. **Multi-hand Support**: Two-handed gestures for complex interactions
4. **Gesture Recording**: Save user gesture patterns for analysis
5. **Accessibility Mode**: Voice confirmation + visual feedback enhancements

### Integration Opportunities
- **Ring VTO**: Swap ring designs with gestures
- **Wrist VTO**: Change watch faces, straps
- **Earring VTO**: Switch earring styles
- **Glasses VTO**: Try different frames

---

## Technical Specifications

### Dependencies

```json
{
  "@mediapipe/tasks-vision": "0.10.35"
}
```

**CDN Import:**
```javascript
"@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
```

### Browser APIs Used

- **getUserMedia**: Camera access
- **Canvas 2D**: Video rendering
- **Performance API**: Timestamps for FPS-independent calculations
- **requestAnimationFrame**: Render loop

### Model Files

- **GestureRecognizer Model**: `gesture_recognizer.task` (~5MB)
- **Source**: Google MediaPipe storage
- **URL**: `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`

---

## Security & Privacy

### Data Processing
- ✅ **100% client-side**: All processing in browser
- ✅ **No video upload**: Video never leaves device
- ✅ **No tracking**: No analytics or telemetry
- ✅ **Camera-only**: Microphone not accessed

### Camera Permissions
```javascript
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'user',  // Front camera
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
  // NO audio requested
});
```

---

## License & Attribution

**MediaPipe**: Apache License 2.0 (Google)
**Project**: Custom implementation for VTO product swapping

---

## Developer Notes

### Code Style
- ES6 modules
- Async/await for promises
- Event-driven architecture
- State machine pattern

### Key Design Decisions

1. **Why two gesture methods?**
   - Fist→Palm: Natural, position-aware
   - Thumbs: Explicit, no ambiguity

2. **Why lower confidence for Open_Palm?**
   - Handles detection gaps during fist→palm transition
   - Users often have partial palm detection

3. **Why 1.5s thumb hold?**
   - Balance between speed and accident prevention
   - Long enough to be intentional, short enough to be practical

4. **Why cooldown period?**
   - Prevents gesture "follow-through" from triggering multiple swaps
   - Gives user visual feedback before next gesture

---

## Support & Contact

**Issues**: Report bugs via project issue tracker
**Documentation**: This README + inline code comments
**Debug**: Press `D` key for real-time debug panel

---

**Last Updated**: 2026-07-29
**Version**: 1.0.0
**Status**: Production-ready ✅
