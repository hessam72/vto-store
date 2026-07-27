# Ring Virtual Try-On - MediaPipe Implementation

Modern ring try-on using **Google MediaPipe Hands** for accurate hand tracking and **Three.js** for 3D rendering.

## Features

✅ **21-point hand landmark detection** (MediaPipe Hands)
✅ **Precise ring finger placement** (MCP joint - landmark 13)
✅ **Real-time 3D orientation** (follows finger rotation)
✅ **Soft occluder** for realistic depth
✅ **HDR environment lighting** (PBR materials)
✅ **Camera switching** (front/back)
✅ **Persian UI** (RTL support)

## Technology Stack

- **MediaPipe Hands** (@mediapipe/tasks-vision) - Hand tracking
- **Three.js r136** - 3D rendering
- **GLTF/GLB** - Ring models
- **RGBE HDR** - Environment maps
- **ES6 Modules** - Modern JavaScript

## File Structure

```
rings-mediapipe/
├── index.html                      # Entry point
├── main.js                         # App initialization
├── README.md                       # Documentation
├── config/
│   └── landmarks.js                # MediaPipe 21-point landmark mapping
├── core/
│   ├── MediaPipeTracker.js         # Hand tracking wrapper
│   └── ThreeSceneManager.js        # Three.js scene + ring rendering
└── utils/
    └── CoordinateConverter.js      # MediaPipe ↔ Three.js conversion
```

## How It Works

### 1. Hand Tracking (MediaPipe)

MediaPipe detects hands and outputs **21 landmarks** per hand:

- **Landmark 0**: WRIST
- **Landmarks 13-16**: RING_FINGER (MCP, PIP, DIP, TIP)
- **Landmarks 9, 17**: Adjacent fingers (for orientation)

### 2. Coordinate Conversion

MediaPipe normalized coords `[0, 1]` → Three.js world space:

```javascript
x = (-landmark.x + 0.5) * scale  // Center & invert X
y = (-landmark.y + 0.5) * scale  // Center & invert Y
z = -landmark.z * scale           // Negate depth
```

### 3. Ring Placement

- **Position**: Ring finger MCP (landmark 13)
- **Rotation**: Calculated from base→tip direction (landmarks 13→16)
- **Scale**: 0.45x (adjustable via modelScale)

### 4. Depth Occlusion

Soft cylinder occluder:
- Radius: 1.2-1.5 (finger size)
- Height: 30
- Gradient transparency for realistic hand-over-ring effect

## Configuration

Edit `ThreeSceneManager` constructor in `main.js`:

```javascript
appState.threeScene = new ThreeSceneManager(vtoCanvas, {
  modelURL: '/models/rings/default.glb',  // Ring 3D model
  modelScale: 0.45,                       // Ring size
  occluderRadiusRange: [1.2, 1.5],       // Finger thickness
  occluderHeight: 30,                     // Occluder length
  debugOccluder: false                    // Show/hide occluder
});
```

MediaPipe confidence thresholds in `MediaPipeTracker`:

```javascript
minHandDetectionConfidence: 0.7,  // Lower = more sensitive
minHandPresenceConfidence: 0.7,
minTrackingConfidence: 0.7
```

## Testing

1. Open `http://localhost:PORT/vto/rings-mediapipe/`
2. Allow camera access
3. Show your hand with ring finger visible
4. Ring should appear on ring finger MCP (base knuckle)

### Debug Mode

Enable landmark visualization:

```javascript
// In main.js
appState.tracker = new MediaPipeTracker({
  debugDrawLandmarks: true  // Shows 21 landmarks + connections
});
```

Landmark #13 (ring MCP) appears in **gold**.

## Troubleshooting

### Ring not appearing
- Check browser console for errors
- Verify `/models/rings/default.glb` exists
- Ensure proper lighting conditions
- Try increasing detection confidence (0.5 instead of 0.7)

### Ring in wrong position
- Adjust `modelScale` (0.3-0.6 range)
- Check coordinate conversion in `CoordinateConverter.js`
- Verify landmark 13 is gold dot when debug enabled

### Performance issues
- Reduce `videoWidth`/`videoHeight` (720p instead of 1080p)
- Set `numHands: 1` (already default)
- Disable `debugDrawLandmarks` in production

## Advantages Over WebAR.rocks

| Feature | MediaPipe | WebAR.rocks |
|---------|-----------|-------------|
| Landmark docs | ✅ 21 documented | ❌ Undocumented |
| World coords | ✅ Meters (3D) | ❌ Custom units |
| Multi-hand | ✅ Yes | ⚠️ Limited |
| Mobile perf | ✅ Optimized | ⚠️ Varies |
| Community | ✅ Large | ⚠️ Small |
| License | ✅ Apache 2.0 | ⚠️ Custom |
| Support | ✅ Google | ⚠️ Limited |

## Next Steps

1. ✅ Test with different ring models
2. ⚠️ Add landmark stabilization (OneEuro filter) if jittery
3. ⚠️ Implement multi-ring (multiple fingers)
4. ⚠️ Auto ring sizing from finger width
5. ⚠️ Adaptive lighting based on environment
6. ⚠️ Two-hand support (both hands simultaneously)

## References

- [MediaPipe Hand Landmarker Docs](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)
- [Codrops MediaPipe+Three.js Tutorial](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/)
- [MediaPipe Tasks Vision NPM](https://www.npmjs.com/package/@mediapipe/tasks-vision)
