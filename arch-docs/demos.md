# Demo Reference

## Available Demos

### Earrings
- **Path:** `public/vto/earrings/`
- **Tracking:** Face (ear landmarks)
- **Neural Network:** NN_EARS_4 (48KB)
- **Helper:** WebARRocksFaceEarrings3DHelper
- **3D Model:** `assets/earring.glb`
- **Post-FX:** Bloom + TAA
- **Occluder:** Ear cylinders

### Necklace
- **Path:** `public/vto/necklace/`
- **Tracking:** Face (neck/torso landmarks)
- **Neural Network:** NN_NECKLACE_9
- **Helper:** WebARRocksMirror
- **3D Models:**
  - `assets/Necklace_1.glb`
  - `assets/Necklace_2.glb`
- **Post-FX:** Bloom + TAA
- **Occluder:** Neck mesh
- **UI:** Model switcher (disabled by default)

### Rings
- **Path:** `public/vto/rings/`
- **Tracking:** Hand (wrist landmarks)
- **Neural Network:** NN_WRISTBACK_45 (4.2MB)
- **Helper:** HandTrackerThreeHelper
- **3D Model:** `assets/ring.glb` (scaled 0.3x)
- **Post-FX:** Basic
- **Occluder:** Wrist gradient
- **UI:** Camera switcher
- **Note:** Uses wrist tracking (ring-specific NNs lack documentation)

### Watch
- **Path:** `public/vto/watch/`
- **Tracking:** Hand (wrist landmarks)
- **Neural Network:** NN_WRISTBACK_45 (4.2MB)
- **Helper:** HandTrackerThreeHelper
- **3D Model:** `assets/watch.glb`
- **Post-FX:** Basic
- **Occluder:** Wrist gradient
- **UI:** Camera switcher

---

## Demo Structure

Each demo contains:

```
{demo}/
├── index.html                  # Entry point
├── main.js                     # Demo initialization
├── dist/
│   └── WebARRocks{Face|Hand}.js  # Core tracking library
├── helpers/
│   ├── WebARRocks*Helper.js    # Demo-specific helper
│   ├── landmarksStabilizers/   # Stabilization (OneEuro filter)
│   ├── WebARRocksResizer.js    # Canvas resizing
│   └── ...
├── libs/three/v136/
│   ├── build/three.js          # Three.js r136
│   └── examples/js/
│       ├── loaders/            # GLTFLoader, RGBELoader
│       ├── postprocessing/     # EffectComposer, TAA, Bloom
│       └── shaders/
├── neuralNets/
│   └── NN_*.json               # Neural network model
└── assets/
    ├── *.glb                   # 3D models
    └── *.hdr                   # Environment maps
```

---

## Customization

### Replace 3D Model

1. Export GLB with correct scale
2. Replace `assets/*.glb`
3. Update `main.js`:
   ```js
   const _glbURL = './assets/your-model.glb';
   ```

### Adjust Tracking

**Earrings:**
```js
// main.js
WebARRocksFaceEarrings3DHelper.init({
  scale: [1, 1, 1],  // Scale model
  offset: [0, 0, 0], // Position offset
  // ...
});
```

**Necklace:**
```js
// main.js
const settings = {
  necklaceMeshURL: './assets/Necklace_1.glb',
  debugCube: false,
  // ...
};
```

**Rings/Watch:**
```js
// main.js
const handTrackerCanvas = _VTOThreeHelper.init({
  VTOModel: './assets/ring.glb',
  scale: 0.3,  // Ring needs scaling
  // ...
});
```

### Change Post-Processing

**Face demos (Earrings, Necklace):**
```js
// main.js
const _settings = {
  bloom: {
    threshold: 0.8,
    strength: 2,
    radius: 0.5
  },
  taa: {
    sampleLevel: 3  // 0-5, higher = better quality, slower
  }
};
```

**Hand demos (Rings, Watch):**
- Basic rendering only
- Add EffectComposer manually in `main.js` if needed

---

## Neural Networks

### NN_EARS_4
- Size: 48KB
- Landmarks: 2 (left ear, right ear)
- Use case: Earrings, ear accessories

### NN_NECKLACE_9
- Size: ~500KB (estimated)
- Landmarks: 8 (neck/torso contour)
- Use case: Necklaces, pendants

### NN_WRISTBACK_45
- Size: 4.2MB
- Landmarks: 8 (wrist contour, back-of-hand view)
- Use case: Watches, bracelets, rings (scaled)

**Note:** Ring-specific NNs exist (NN_RING_*) but lack landmark documentation. Current ring demo uses wrist NN with scaled model.

---

## Helpers

### WebARRocksFaceEarrings3DHelper
- Positions earring pair at ear landmarks
- Manages occluders (ear cylinders)
- Handles stabilization

### WebARRocksMirror
- Multi-model manager (switch necklaces)
- Canvas mirroring
- Lighting/environment setup

### HandTrackerThreeHelper
- Hand pose estimation
- Wrist tracking
- Camera switching (front/rear)

### OneEuroLMStabilizer
- Landmark smoothing (noise reduction)
- Configurable frequency/cutoff
- Used in all demos

---

## Common Issues

**Camera not starting:**
- Check HTTPS (production) or localhost (dev)
- Browser permissions denied
- Webcam in use by another app

**Model not loading:**
- Check path in `main.js`
- Verify GLB exists in `assets/`
- Console errors for details

**Tracking unstable:**
- Adjust `OneEuroLMStabilizer` params
- Improve lighting
- Reduce head/hand movement speed

**Low FPS:**
- Disable TAA/Bloom
- Lower neural network resolution
- Close other apps/tabs
