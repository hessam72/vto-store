# Watch Virtual Try-On Demo

Minimal standalone demo for watch virtual try-on using WebAR.rocks.hand.

## Features
- Real-time wrist tracking using proprietary neural network (NN_WRISTBACK_45)
- 3D GLB watch models
- 8-point wrist pose estimation
- Hand pose flip detection and filtering
- Wrist occluder for realistic rendering
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
- Webcam access (rear camera recommended for better results)
- HTTPS or localhost (required for camera access)

## Files Structure
- `index.html` - Main HTML with loading/instruction modals
- `main.js` - Demo logic, pose points, and settings
- `dist/` - WebAR.rocks.hand core library
- `helpers/` - Helper modules (HandTrackerThreeHelper, PoseFlipFilter, ChangeCameraHelper, Stabilizer)
- `libs/three/` - Three.js r136 and extensions
- `neuralNets/` - NN_WRISTBACK_45.json model
- `assets/` - Watch 3D model, occluder, environment map, guideline image
- `assets/debug/` - Debug hand placeholder models

## Usage Instructions
1. Allow camera access
2. Position your hand as shown in the guideline image
3. Keep wrist visible and stable
4. Click "Change camera" button to switch between cameras

## Wrist Pose Landmarks
The demo tracks 8 wrist landmarks:
- `wristPinkySideBot` / `wristThumbSideBot`
- `wristPinkySideTop` / `wristThumbSideTop`
- `wristUpTop` / `wristUpBot`
- `wristDownTop` / `wristDownBot`

## Customization
Edit `main.js` settings:
- `threshold` - Detection sensitivity (0-1, default: 0.97)
- `modelOffset` - Adjust watch position on wrist
- `modelScale` - Watch model scale factor
- `NNsPaths` - Switch neural network model (45, 42, 38, 36)
- `isPoseFilter` - Enable/disable pose flip filtering
- Soft occluder parameters for gradient fading

## Alternative Neural Networks
Commented options in main.js:
- NN_WRISTBACK_45 (active) - Best overall
- NN_WRISTBACK_42 - Alternative 8-point model
- NN_WRISTBACK_38 - More stable, different landmarks
- NN_WRISTBACK_36 - Alternative 8-point configuration
