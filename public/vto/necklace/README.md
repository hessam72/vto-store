# Necklace Virtual Try-On Demo

Minimal standalone demo for 3D necklace virtual try-on using WebAR.rocks.face with WebARRocksMirror helper.

## Features
- Real-time neck/torso tracking using proprietary neural network (NN_NECKLACE_9)
- 3D GLB necklace models with PBR materials
- 8-point pose estimation for accurate placement
- Landmark stabilization (One Euro filter)
- Multiple necklace models with UI controls
- Bloom and TAA post-processing effects
- Environment map lighting (HDR)

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
- Webcam access
- HTTPS or localhost (required for camera access)

## Files Structure
- `index.html` - Main HTML file with UI controls
- `main.js` - Demo logic, pose points, and settings
- `dist/` - WebAR.rocks.face core library
- `helpers/` - Helper modules (Mirror, FaceThreeHelper, Stabilizer)
- `libs/three/` - Three.js r136 and extensions
- `neuralNets/` - NN_NECKLACE_9.json model
- `assets/models3D/` - Necklace 3D models (blackPanther, nativeAmerican)
- `assets/envmaps/` - HDR environment maps

## UI Controls
Enable controls by setting `display: flex` in CSS (#controls):
- **Black Panther** - Load black panther necklace
- **Native American** - Load native american necklace
- **Video only** - Remove 3D model
- **Pause/Resume** - Pause/resume tracking
- **Resize** - Test resize functionality
- **Capture** - Capture screenshot

## Customization
Edit `main.js`:
- `solvePnPObjPointsPositions` - 3D neck landmark positions
- `landmarksStabilizerSpec` - Stabilization settings
- `scanSettings.threshold` - Detection sensitivity (0-1)
