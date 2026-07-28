# Hybrid Ring VTO

Combines **MediaPipe Hands** (superior hand detection) with **WebARRocks ring placement logic** (proven position/rotation).

## Architecture

```
MediaPipe Hands (21 landmarks)
    ↓
Extract Ring Finger (landmarks 13-16)
    ↓
RingPositioner (calculate position + rotation)
    ↓
Apply WebARRocks proven offset/quaternion
    ↓
Three.js (render ring + soft occluder)
```

## Features

- **MediaPipe Detection**: GPU-accelerated, 21-landmark hand tracking
- **Proven Placement**: Uses tested `modelOffset` and `modelQuaternion` from WebARRocks implementation
- **Soft Occluder**: Depth-based finger occlusion for realistic rendering
- **Smoothing Filters**: Position (alpha 0.65) and rotation (alpha 0.45) filters
- **Confidence Hysteresis**: 5-frame stability check before showing ring

## File Structure

```
rings-hybrid/
├── index.html              # Entry point
├── main.js                 # Application orchestrator
├── config.js               # Ring settings (modelOffset, modelQuaternion, etc.)
├── core/
│   ├── MediaPipeTracker.js    # Hand detection (copied from watch-mediapipe)
│   ├── RingPositioner.js      # Landmark → position/rotation calculation
│   └── ThreeRingScene.js      # Three.js scene + ring model + occluder
└── utils/
    └── CoordinateConverter.js # Coordinate transformations
```

## Key Components

### 1. MediaPipeTracker
- Initializes MediaPipe Hands
- Detects 21 hand landmarks
- Draws debug landmarks (if enabled)
- Returns results to callback

### 2. RingPositioner
- **Input**: MediaPipe 21 landmarks
- **Extract**: Ring finger (13=MCP, 14=PIP, 15=DIP, 16=TIP)
- **Calculate**:
  - Position: Ring MCP (landmark 13) as anchor
  - Rotation: Quaternion from finger vector (13→16)
- **Apply**: `modelOffset` [-1.5, -11, 0] and `modelQuaternion` [0, 0, 0.707, 0.707]
- **Smooth**: Low-pass filters for position/rotation
- **Output**: `{visible, position: Vector3, rotation: Quaternion}`

### 3. ThreeRingScene
- Three.js scene setup
- GLTF ring model loading
- Soft occluder (cylinder geometry, depth-only material)
- Ring transform updates
- Render loop

## Configuration (config.js)

```javascript
modelOffset: [-1.5, -11, 0]        // Proven position offset
modelQuaternion: [0, 0, 0.707, 0.707]  // 90° Z rotation
modelScale: 0.1                     // Ring size

occluder: {
  radiusRange: [1.2, 1.5],         // Finger cylinder size
  height: 30,                      // Occluder length
  flattenCoeff: 0.7                // Cylinder flattening
}

smoothing: {
  position: { alpha: 0.65 },       // Position filter
  rotation: { alpha: 0.45 }        // Rotation filter
}
```

## How It Works

1. **MediaPipe** detects hand → 21 landmarks
2. **RingPositioner** extracts ring finger (13-16):
   - Anchor: Landmark 13 (ring MCP joint)
   - Orientation: Vector from 13→16 (finger direction)
3. **Calculate rotation**: Quaternion aligning Y-axis with finger vector
4. **Apply offset**: `modelOffset` transformed by rotation
5. **Apply model rotation**: `modelQuaternion` for final orientation
6. **Smooth**: Low-pass filters reduce jitter
7. **Render**: Three.js draws ring at calculated position

## MediaPipe Landmarks Used

```
Ring Finger Chain:
13 (MCP)  ← Base/anchor point
14 (PIP)
15 (DIP)
16 (TIP)  ← Used for orientation vector
```

## Coordinate Systems

### MediaPipe Output
- Normalized [0, 1] (x, y)
- Relative depth (z)

### Three.js Scene
- Pixel-based coordinates
- Camera at (0, 0, 100)
- Ring positioned in 3D space

### Transformation Pipeline
```
MediaPipe normalized → Pixel coords → Three.js Vector3
                                    ↓
                            Apply modelOffset
                                    ↓
                         Apply modelQuaternion
                                    ↓
                             Final ring pose
```

## Debug Options

In `config.js`:

```javascript
debug: {
  displayLandmarks: true,   // Show MediaPipe landmarks on canvas
  meshMaterial: false,      // Use normal material for ring
  occluder: false,          // Make occluder visible (pink)
  logPositions: false       // Console log positions
}
```

## Proven Settings (from WebARRocks)

These values were fine-tuned in the original WebARRocks implementation:

- **modelOffset**: `[-1.5, -11, 0]` - Positions ring on finger segment
- **modelQuaternion**: `[0, 0, 0.707, 0.707]` - ~90° rotation around Z-axis
- **modelScale**: `0.1` - Ring size relative to hand

## Smoothing Filters

**Low-Pass Filter (Exponential Moving Average)**:
```javascript
current = current * (1 - alpha) + target * alpha
```

- **Position alpha 0.65**: More responsive, less smooth
- **Rotation alpha 0.45**: Smoother, less jitter

## Advantages Over Pure Implementations

| Feature | WebARRocks | MediaPipe | Hybrid |
|---------|-----------|-----------|--------|
| Hand Detection | ⚠️ Moderate | ✅ Excellent | ✅ Excellent |
| Ring Placement | ✅ Proven | ❌ Basic | ✅ Proven |
| Performance | ⚠️ CPU-heavy | ✅ GPU-accelerated | ✅ GPU-accelerated |
| Maintenance | ❌ Proprietary | ✅ Open-source | ✅ Open-source |

## Dependencies

- **MediaPipe Tasks Vision**: Hand landmark detection
- **Three.js r167**: 3D rendering
- **GLTFLoader**: Ring model loading
- **RGBELoader**: HDR environment maps

## Usage

```bash
# Serve with any HTTP server
python3 -m http.server 8000
# or
npx serve .

# Open in browser
http://localhost:8000/index.html
```

## Browser Requirements

- Modern browser (Chrome 90+, Safari 15+, Firefox 88+)
- WebGL 2.0 support
- Camera access (HTTPS or localhost)

## Performance Notes

- **MediaPipe model**: ~5MB download (one-time)
- **GPU acceleration**: Uses WebGL for landmark detection
- **Frame rate**: 30-60 FPS on modern devices
- **Latency**: ~50-100ms total (detection + rendering)

## Troubleshooting

**Ring not appearing?**
- Check browser console for errors
- Verify camera permissions granted
- Ensure HTTPS or localhost (required for camera)
- Check MediaPipe model downloaded (5MB)

**Ring position wrong?**
- Adjust `modelOffset` in config.js
- Try different camera distances (30-50cm optimal)
- Check `debugDisplayLandmarks` to see detection points

**Ring rotation wrong?**
- Adjust `modelQuaternion` in config.js
- Verify finger orientation vector calculation
- Test with different hand poses

**Jittery ring movement?**
- Increase smoothing alpha values (0.45 → 0.3)
- Improve lighting conditions
- Reduce background motion

## Future Enhancements

- [ ] Multi-finger support (all fingers simultaneously)
- [ ] Ring sizing based on finger width
- [ ] Collision detection with other fingers
- [ ] Screenshot/save functionality
- [ ] Multiple ring models selector

## Credits

- **MediaPipe Hands**: Google MediaPipe team
- **WebARRocks**: WebAR.rocks team (placement logic inspiration)
- **Three.js**: Three.js contributors
