# Ring Virtual Try-On Demo

Minimal standalone demo for ring virtual try-on using WebAR.rocks.hand.

**NOTE:** Currently uses NN_WRISTBACK_45 (wrist tracking) with scaled-down ring model. Ring-specific neural networks (NN_RING_*) require proper landmark label documentation which is not publicly available.

## Features
- Real-time wrist tracking using proprietary neural network (NN_WRISTBACK_45)
- 3D GLB ring models
- 6-point finger pose estimation
- Hand pose flip detection and filtering
- Finger occluder for realistic rendering
- Landmark stabilization (One Euro filter)
- Environment map lighting (HDR)
- Multi-camera support

## How to Run

### Using Python
```bash
python3 -m http.server 8000
```

### Using Node.js
```bash
npx serve .
```

Then open http://localhost:8000 (or the port shown) in your browser.

## Requirements
- Modern browser with WebGL support
- Webcam access (front or rear camera)
- HTTPS or localhost (required for camera access)

## Files Structure
- `index.html` - Main HTML with loading/instruction modals
- `main.js` - Demo logic, pose points, and settings
- `dist/` - WebAR.rocks.hand core library
- `helpers/` - Helper modules (HandTrackerThreeHelper, PoseFlipFilter, ChangeCameraHelper, Stabilizer)
- `libs/three/` - Three.js r136 and extensions
- `neuralNets/` - NN_WRISTBACK_45.json model (4.2MB)
- `assets/` - Ring 3D model, environment map

## Usage Instructions
1. Allow camera access
2. Position your hand with palm facing camera
3. Keep your hand visible and stable
4. The ring will appear on your finger when tracking is active
5. Click "Change camera" button to switch between cameras

## Wrist Pose Landmarks
The demo tracks 8 wrist landmarks (same as watch demo):
- `wristPinkySideBot` / `wristThumbSideBot`
- `wristPinkySideTop` / `wristThumbSideTop`
- `wristUpTop` / `wristUpBot`
- `wristDownTop` / `wristDownBot`

## Customization
Edit `main.js` settings:
- `threshold` - Detection sensitivity (0-1, default: 0.95)
- `modelOffset` - Adjust ring position on finger [x, y, z]
- `modelScale` - Ring model scale factor (default: 0.8)
- `NNsPaths` - Switch neural network model if needed
- `isPoseFilter` - Enable/disable pose flip filtering
- `occluderRadiusRange` - Soft occluder gradient parameters
- `occluderHeight` - Height of occluder cylinder

## 3D Model Requirements
Ring models should be:
- Format: GLB (GLTF binary)
- Scale: Appropriate for finger size (adjust with `modelScale`)
- Orientation: Default Three.js orientation
- Materials: PBR materials work best with environment map

## Troubleshooting

**Ring not appearing?**
- Check browser console for errors
- Ensure neural network file exists: `neuralNets/NN_RING_14.json`
- Verify ring model exists: `assets/ring.glb`
- Try adjusting `threshold` value in main.js

**Tracking jittery?**
- Adjust `stabilizerOptions.beta` (lower = more stable, higher = more responsive)
- Modify `minCutOff` value (higher = more filtering)

**Ring size wrong?**
- Adjust `modelScale` in main.js
- Modify `modelOffset` to reposition

**Performance issues?**
- Use rear camera for better performance
- Reduce canvas resolution
- Close other tabs/apps
- Try different browser

## Technical Details

### Pose Estimation
The demo uses solvePnP algorithm to estimate the 3D pose of the finger from 2D landmark positions. The 6 landmarks provide enough points for robust pose calculation.

### Occluder System
A soft gradient occluder is placed around the finger to hide the ring when it goes behind the hand, creating realistic depth perception.

### Stabilization
One Euro filter is applied to landmark positions to reduce jitter while maintaining responsiveness to hand movements.

## Comparison with Other Demos

| Feature | Ring | Watch | Earrings |
|---------|------|-------|----------|
| Tracking | Wrist (8 pts) | Wrist (8 pts) | Ears (2 pts) |
| Library | hand | hand | face |
| Neural Net | NN_WRISTBACK_45 | NN_WRISTBACK_45 | NN_EARS_4 |
| Occluder | Wrist cylinder | Wrist cylinder | Ear cylinder |
| Scale | 0.3 | 1.2-1.3 | 100x |

## Notes
- Currently uses wrist tracking (NN_WRISTBACK_45) as placeholder for ring demonstration
- Ring model is scaled to 0.3x (much smaller than watch at 1.2x)
- Actual ring-specific NNs exist (NN_RING_12, NN_RING_13, NN_RING_14) but lack public documentation
- Keep hand at comfortable distance from camera (30-50cm)
- Good lighting improves tracking quality

## Ring-Specific Neural Networks (Not Implemented)
The following ring neural networks exist but require landmark label documentation:
- NN_RING_12, NN_RING_13, NN_RING_14 - General ring detection
- NN_RING_9 - Older model version
- NN_RING_RB_8, NN_RING_RP_8 - Back/palm focused
- NN_RINGBACK_* (0-11) - Back-of-hand focused models

**To use ring-specific NNs:** Extract landmark labels from WebARRocksHand.js or neural network metadata, update `poseLandmarksLabels` in main.js accordingly.
