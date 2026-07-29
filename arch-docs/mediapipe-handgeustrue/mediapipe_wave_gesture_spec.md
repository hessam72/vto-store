# Technical Specification: MediaPipe Wave & Swipe Gesture Recognizer

This document provides a complete technical specification, data structure reference, mathematical model, state machine design, and reference implementation prompt for building a real-time **Wave / Horizontal Air-Swipe Gesture Recognizer** using Google MediaPipe.

Use this document as context for Claude (or any AI coding assistant) to implement a robust, production-ready gesture control system for web or mobile UI components (e.g., product carousels, spatial navigation).

---

## 1. Overview & Objectives

* **Primary Goal**: Detect explicit left/right hand waving (air-swiping) to trigger actions like swapping product cards.
* **Secondary Goal**: Prevent false positives from idle hand movements, jitter, or static holding.
* **Key Requirements**:
  * Real-time performance (30+ FPS) via `@mediapipe/tasks-vision` or `@mediapipe/camera_utils`.
  * FPS-independent calculations using frame timestamps.
  * Hysteresis and state-machine-based debouncing to avoid double-triggering.
  * Camera horizontal mirroring compensation.

---

## 2. MediaPipe Hand Landmark Reference Data

MediaPipe output provides 21 3D landmarks ($x, y, z$) per detected hand, normalized to $[0.0, 1.0]$.

### Key Landmark Indices for Wave Detection
| Landmark ID | Name | Role in Wave Recognition |
| :--- | :--- | :--- |
| **0** | `WRIST` | Base anchor point for hand orientation and scale calculation |
| **5** | `INDEX_FINGER_MCP` | Knuckle anchor for palm center |
| **8** | `INDEX_FINGER_TIP` | Primary fingertip tracking point |
| **9** | `MIDDLE_FINGER_MCP` | Knuckle anchor for palm center |
| **12** | `MIDDLE_FINGER_TIP` | Secondary tracking point / height verification |
| **17** | `PINKY_MCP` | Outer boundary anchor for palm center |

### Derived Palm Center Calculation
To prevent single-finger twitching from triggering a swipe, track the **Centroid of the Palm** alongside the finger tips:

$$\text{Palm}_{x} = \frac{x_0 + x_5 + x_{17}}{3}$$
$$\text{Palm}_{y} = \frac{y_0 + y_5 + y_{17}}{3}$$

---

## 3. Mathematical Model & Gesture Detection Rules

### A. Hand Open / Readiness Verification
Before evaluating swipe velocity, verify that the hand is extended in an open "wave-ready" posture.

1. **Finger Extension Check**: Distance from Wrist (0) to Tips (8, 12, 16, 20) must be greater than distance from Wrist to PIP joints (6, 10, 14, 18).
2. **Alternative (Pre-trained classification)**: Standard MediaPipe `GestureRecognizer` output category equals `Open_Palm`.

### B. Frame Buffer & Smoothing (Noise Reduction)
Raw landmark positions contain micro-jitter. Apply an **Exponential Moving Average (EMA)** filter to the tracked coordinate $(x_t, y_t)$:

$$x_{\text{smooth}, t} = \alpha \cdot x_t + (1 - \alpha) \cdot x_{\text{smooth}, t-1}$$

*Recommended $\alpha = 0.35$ for low latency with adequate smoothing.*

### C. Motion Vector & Velocity Thresholding
Maintain a rolling buffer of coordinate samples over a time window $\Delta T \approx 150\text{ms} - 300\text{ms}$ (typically 5 to 10 frames at 30 FPS).

* **Displacement**: $\Delta X = x_{\text{current}} - x_{\text{start}}$
* **Velocity**: $V_x = \frac{\Delta X}{\Delta t}$ (normalized units per second)

#### Threshold Criteria for Triggering
1. **Minimum Horizontal Distance (Threshold $D_x$)**: $|\Delta X| \ge 0.15$ (15% of screen width).
2. **Horizontal Dominance Ratio**: $\frac{|\Delta X|}{|\Delta Y|} \ge 1.8$ (ensures motion is horizontal, not vertical or diagonal).
3. **Minimum Velocity (Threshold $V_{\text{min}}$)**: $|V_x| \ge 0.5$ screen units per second.

#### Direction Mapping (Assuming Mirrored Camera Stream)
* **$\Delta X < -D_x$ (User moves hand to their Right / Camera view moves Left)**: **Swipe Next Product**
* **$\Delta X > D_x$ (User moves hand to their Left / Camera view moves Right)**: **Swipe Previous Product**

*(Note: If the camera feedback is un-mirrored, swap the sign of $\Delta X$.)*

---

## 4. Gesture Recognizer State Machine

```
         +---------------------------------------------------+
         |                                                   |
         v                                                   |
     +------+       Hand Detected &       +---------------+  | Cooldown
     | IDLE | --------------------------> | TRACKING_WAVE |  | Expired
     +------+      Hand Open Check        +---------------+  |
        ^                                         |          |
        | Hand Lost                               | Motion   |
        |                                         | Exceeds  |
        +------------------+                      | Threshold|
                           |                      v          |
                    +--------------+      +---------------+  |
                    |  DEBOUNCE    | <--- |   TRIGGERED   | -+
                    | (COOLDOWN)   |      +---------------+
                    +--------------+
```

### State Definitions
1. **`IDLE`**: No hand detected or hand is in a fist/random pose. Rolling buffer cleared.
2. **`TRACKING_WAVE`**: Open palm detected. Continuously filling rolling history buffer and evaluating $\Delta X$ and $V_x$.
3. **`TRIGGERED`**: Gesture threshold exceeded. Emit `onSwipeLeft` or `onSwipeRight` event immediately. Transition to `DEBOUNCE`.
4. **`DEBOUNCE`** (Cooldown): Locks gesture recognition for **600ms – 800ms** to prevent a single wave follow-through from firing multiple swap triggers.

---

## 5. Complete Data Structures (TypeScript Definitions)

```typescript
export type SwipeDirection = 'LEFT' | 'RIGHT';

export interface GestureConfig {
  minSwipeDistance: number;      // Normalized 0.0 - 1.0 (Default: 0.15)
  minVelocity: number;           // Normalized screen units per sec (Default: 0.5)
  horizontalDominanceRatio: number; // Dx / Dy minimum (Default: 1.8)
  debounceCooldownMs: number;    // Cooldown delay (Default: 700)
  emaAlpha: number;              // Smoothing factor 0.0 - 1.0 (Default: 0.35)
  bufferTimeWindowMs: number;    // Rolling history window (Default: 250)
}

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FrameSample {
  timestamp: number;
  x: number;
  y: number;
}

export interface WaveGestureResult {
  detected: boolean;
  direction: SwipeDirection | null;
  velocity: number;
  displacement: number;
}
```

---

## 6. Detailed Implementation Prompt for Claude

> **Copy and paste the prompt block below to instruct Claude to build the complete code module:**

```text
System Prompt for Claude:

You are an expert Frontend & Computer Vision Developer. Implement a standalone, TypeScript-ready JavaScript module for recognizing horizontal Hand Wave / Air-Swipe gestures using MediaPipe.

Requirements:
1. Module Name: `MediaPipeWaveRecognizer`
2. Dependencies: Use `@mediapipe/tasks-vision` (GestureRecognizer / HandLandmarker) or standard `@mediapipe/camera_utils` & `@mediapipe/hands`.
3. Architectural Specification:
   - Implement the Exponential Moving Average (EMA) for landmark smoothing (alpha = 0.35).
   - Implement a rolling sample buffer tracking palm center [average of landmarks 0, 5, 17] over a 250ms window.
   - Implement the state machine: IDLE -> TRACKING_WAVE -> TRIGGERED -> DEBOUNCE.
   - Provide configurable thresholds: `minSwipeDistance` (0.15), `minVelocity` (0.5 units/sec), `debounceCooldownMs` (700ms), and `horizontalDominanceRatio` (1.8).
   - Correctly compensate for camera mirror state (toggleable `isMirrored` parameter).
4. Public API Interface:
   - `constructor(config?: Partial<GestureConfig>)`
   - `processLandmarks(landmarks: HandLandmarkPoint[], timestampMs: number): WaveGestureResult`
   - Event listeners / Callbacks: `onSwipeLeft(fn)`, `onSwipeRight(fn)`, `onStateChange(fn)`
   - `reset()`
5. Provide a clean HTML/JS example demonstrating how to hook this module up to an HTML `<video>` element and trigger swapping cards in a UI product carousel. Include visual Feedback (e.g. status badge, swipe progress bar).

Make the code fully documented, robust against missing frames/hand loss, and ready for production use.
```

---

## 7. Edge Cases & Optimization Checklist

- [ ] **Camera Mirroring**: Webcams flip input horizontally. Ensure UI directional logic aligns with user perception (User swiping to their right = carousel moving right).
- [ ] **Variable Frame Rate**: Always calculate velocity using performance timestamps (`timestampMs`), never frame counts, to ensure identical sensitivity across 30 FPS webcams and 120 FPS high-speed cameras.
- [ ] **Multi-Hand Filtering**: If multiple hands are detected, pin tracking strictly to the first detected primary hand index or the largest hand in frame.
- [ ] **Hand Exit Re-initialization**: Instantly reset state machine to `IDLE` when `landmarks.length === 0` to prevent baseline drift when a hand re-enters the frame.
