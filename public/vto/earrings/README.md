# Earrings Virtual Try-On Demo

Minimal standalone demo for 3D earring virtual try-on using WebAR.rocks.face.

## Features
- Real-time face tracking using proprietary neural network (NN_EARS_4)
- 3D GLB earring models with PBR materials
- Ear landmark detection for precise placement
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
- `index.html` - Main HTML file
- `main.js` - Demo logic and settings
- `dist/` - WebAR.rocks.face core library
- `helpers/` - Helper modules (Earrings3DHelper, Resizer, Stabilizer)
- `libs/three/` - Three.js r136 and extensions
- `neuralNets/` - NN_EARS_4.json model
- `assets/` - 3D earring model and environment map

## Customization
Edit `main.js` settings:
- `GLTFModelURL` - Path to your earring 3D model
- `envmapURL` - Environment map for lighting
- `bloom` - Bloom effect parameters
- `taaLevel` - Temporal anti-aliasing samples
