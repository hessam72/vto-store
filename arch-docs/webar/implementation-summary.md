# Virtual Try-On (VTO) Jewelry Application - Implementation Summary

## Project Overview

A web-based augmented reality (AR) application built with Next.js 15 that enables users to virtually try on jewelry items through their device camera. Supports five jewelry categories: necklace, earrings, crown, rings, and watch.

---

## Technology Stack

### Core Framework
- **Next.js 16.2.9** - React framework with App Router
- **React 19.2.4** - UI library
- **TypeScript 5** - Type safety

### 3D Graphics & Rendering
- **Three.js** - WebGL-based 3D rendering engine
- **GLTFLoader** - 3D model loading (GLB format)

### AR Tracking Libraries
- **WebAR.rocks.face** - Facial feature detection and tracking (self-hosted)
- **WebAR.rocks.hand** - Hand/wrist detection and tracking (self-hosted)

### Neural Network Models
- Face-based categories use pre-trained models from WebAR.rocks.face repository
- Hand-based categories use pre-trained models from WebAR.rocks.hand repository
- All models hosted locally in `/public/NN/` directory

---

## Architecture Decisions

### 1. Dual-Canvas Approach
Following the official WebAR.rocks demo patterns, the application uses two separate HTML5 canvas elements:

- **WebAR Tracking Canvas** - Handles video stream and AR tracking (z-index: 0)
  - `faceTrackerCanvas` for face-based categories
  - `handTrackerCanvas` for hand-based categories
- **Three.js Rendering Canvas** - Overlays 3D jewelry models (z-index: 1)

This separation enables WebAR libraries to process video independently while Three.js renders 3D content on top.

### 2. Category-Based Neural Network Selection
Each jewelry category uses a specialized neural network model optimized for that specific use case:

**Face-Based Categories:**
- **Necklace**: `NN_NECKLACE_7.json` - Trained for neck/chin area tracking
- **Earrings**: `NN_EARS_4.json` - Trained for ear position detection
- **Crown**: `NN_FACE_3.json` - Full-face tracking for forehead placement

**Hand-Based Categories:**
- **Rings**: `NN_RINGBACK_11.json` - Finger keypoint detection
- **Watch**: `NN_WRISTBACK_45.json` - Wrist tracking (same model used in official VTOWatch demo)

### 3. Official Helper Library Wrappers
Rather than calling WebAR.rocks libraries directly, the implementation uses official wrapper helpers:

**Face Tracking (via WebARRocksMirror):**
- `WebARRocksMirror.js` - High-level wrapper handling initialization, canvas sizing, lighting, and video rendering
- `WebARRocksFaceThreeHelper.js` - Three.js integration helper
- Internally bundles landmark stabilization

**Hand Tracking (via HandTrackerThreeHelper):**
- `HandTrackerThreeHelper.js` - High-level wrapper for hand tracking + Three.js integration
- `PoseFlipFilter.js` - Pose orientation correction for hand accessories

**Core Libraries (Self-Hosted):**
- `WebARRocksFace.js` (171KB) - Core face tracking engine
- `WebARRocksHand.js` (173KB) - Core hand tracking engine

All libraries copied from official GitHub repositories to `/public/lib/` for reliability and performance.

### 4. Dynamic Route Pattern
Using Next.js 15 App Router dynamic routes for category selection:
- Route: `/vto/[category]`
- Valid categories: necklace, earrings, crown, rings, watch
- Invalid categories show error page with redirect

---

## Implementation Workflow

### Phase 1: Project Setup
1. Initialized Next.js 15 with TypeScript and Tailwind CSS
2. Installed Three.js and type definitions
3. Created directory structure for modular organization

### Phase 2: Core Component Architecture
1. **Landing Page** - Category selection with 5 buttons linking to dynamic routes
2. **ARCanvas Component** - Simplified to just manage canvas refs and call init functions
3. **Initialization Modules**:
   - `lib/webAR-face.ts` - Wraps WebARRocksMirror.init() for face tracking
   - `lib/webAR-hand.ts` - Wraps HandTrackerThreeHelper.init() for hand tracking
   - No custom Three.js scene creation (helpers manage Three.js internally)

### Phase 3: WebAR Integration
1. Downloaded WebAR.rocks libraries from official GitHub repositories
2. Copied official wrapper helpers (WebARRocksMirror, WebARRocksFaceThreeHelper, HandTrackerThreeHelper)
3. Placed all library files in `/public/lib/` for local serving
4. Implemented dynamic script loading with proper dependency ordering
5. Configured category-specific neural network model paths
6. Set up Three.js global context (window.THREE) before helper script loading

### Phase 4: Neural Network Model Setup
1. Downloaded all face models from WebAR.rocks.face repository
2. Downloaded all hand models from WebAR.rocks.hand repository
3. Organized models in `/public/NN/face/` and `/public/NN/hand/`
4. Selected latest/most optimized models for each category

### Phase 5: 3D Model Integration
1. Created placeholder directories in `/public/models/` for each category
2. Implemented GLTFLoader for loading 3D jewelry models
3. Set up model positioning based on tracking data
4. Configured category-specific landmark-based adjustments

---

## Key Features

### Camera & Video Processing
- Requests user camera permission on category page load
- Supports front-facing camera (user/selfie mode)
- Video resolution: 640x480 (configurable)
- Real-time video processing for AR tracking
- **Video rendered via WebGL texture** (handled by WebARRocksMirror/HandTrackerThreeHelper)

### Face Tracking Features (via WebARRocksMirror)
- Detects facial landmarks in real-time using neural networks
- Tracks face position, rotation, and scale
- Landmark stabilization for smooth tracking
- Configurable detection threshold (category-specific)
- Supports 8-point pose estimation for accurate 3D model placement

### Hand Tracking Features (via HandTrackerThreeHelper)
- Detects hand keypoints (wrist + 5 fingers) in real-time
- Tracks hand orientation and scale
- Hand-flip correction (left/right hand handling)
- Landmark stabilization with One Euro filter
- Supports configurable pose filtering

### 3D Model Rendering
- **Three.js scene managed by helpers** (not manual setup)
- Real-time GLB model loading via GLTFLoader
- Dynamic model visibility based on detection state
- Automatic pose updates (position, rotation, scale)
- Scene lighting with ambient + point lights (configured per category)
- Responsive canvas resizing with devicePixelRatio support
- Optional post-processing (bloom, temporal anti-aliasing)

---

## Directory Structure

```
/app
  /page.tsx                      # Landing page with category buttons
  /vto/[category]/page.tsx       # Dynamic VTO route

/components
  /ARCanvas.tsx                  # Main AR viewer (dual-canvas setup)

/lib
  /webAR-face.ts                 # Face tracking helper
  /webAR-hand.ts                 # Hand tracking helper
  /three-scene.ts                # Three.js utilities

/public
  /lib/
    WebARRocksFace.js            # Core face tracking (171KB)
    WebARRocksHand.js            # Core hand tracking (173KB)
    WebARRocksMirror.js          # Face tracking wrapper with Three.js integration
    WebARRocksFaceThreeHelper.js # Three.js helper for face tracking
    HandTrackerThreeHelper.js    # Three.js helper for hand tracking
    PoseFlipFilter.js            # Pose correction for hand tracking
    OneEuroLMStabilizer.js       # Landmark smoothing filter
    WebARRocksResizer.js         # Canvas resizing utility
  /NN/
    /face/                       # 45 face neural network models
    /hand/                       # 79 hand neural network models
  /models/                       # 3D jewelry models (user-provided)
    /necklace/model.glb
    /earrings/model.glb
    /crown/model.glb
    /rings/ring_{finger}.glb
    /watch/model.glb

/arch-docs
  /deep-research-webar.md        # WebAR technical documentation
  /webar-demos.md                # Official demo references
  /examples-to-use.md            # Example implementations
  /implementation-summary.md     # This file
```

---

## Challenges & Solutions

### Challenge 1: Canvas Context Mismatch
**Issue**: Manual implementation attempted 2D context for video rendering while WebAR.rocks uses WebGL
**Solution**: Switched to official WebARRocksMirror helper which handles WebGL video rendering internally

### Challenge 2: Complex Initialization Sequence
**Issue**: Direct WEBARROCKSFACE.init() calls lacked proper video rendering and canvas management
**Solution**: Used WebARRocksMirror wrapper which abstracts away complexity and manages:
- Canvas sizing with devicePixelRatio
- Lighting setup (ambient + point lights)
- Video rendering via WebGL texture
- Model loading and positioning

### Challenge 3: Helper Library Loading Order
**Issue**: WebARRocksLMStabilizer.js uses ES6 exports and fails when loaded via script tag
**Solution**: Load WebARRocksFaceThreeHelper.js instead (bundles stabilizer internally), then load WebARRocksMirror

### Challenge 4: Three.js Global Context
**Issue**: WebAR helper scripts expect window.THREE to be defined before they load
**Solution**: Import Three.js as ES module and expose to window before loading helper scripts

### Challenge 5: Model Selection
**Issue**: Multiple neural network models available per category
**Solution**: Researched official demos (VTOWatch, VTONecklace, VTOGlasses) to identify which models they use

---

## Performance Considerations

### Neural Network Processing
- Models run entirely client-side (no backend required)
- WebAR.rocks engines are 2-10× faster than TensorFlow.js
- Optimized model selection per category reduces unnecessary computation

### 3D Rendering Optimization
- RequestAnimationFrame loop for smooth 60fps rendering
- Model visibility toggling to skip rendering when not detected
- Lightweight GLB models required (<50K triangles recommended)

### Asset Loading
- Lazy loading of neural network models (loaded after camera permission)
- Asynchronous library script loading
- Models cached by browser after first load

---

## Security & Privacy

### Camera Access
- Camera permission requested explicitly per session
- Video processing happens entirely on-device
- No video data transmitted to servers

### Data Handling
- No biometric data stored or logged
- All AR processing client-side via WebGL
- Neural networks run in browser sandbox

---

## Browser Compatibility

### Requirements
- Modern browser with WebGL2 support (or WebGL1 with extensions)
- HTTPS required for camera access
- Recommended: Chrome/Edge 90+, Safari 14+, Firefox 88+

### Mobile Support
- Tested on mid-range Android/iOS devices
- Responsive canvas sizing
- Touch-friendly UI

---

## Future Enhancements

### Planned Features
1. **Multi-model support** - Multiple jewelry designs per category with UI switcher
2. **Screenshot/capture** - Save AR try-on images
3. **Social sharing** - Share try-on results
4. **Analytics** - Track category popularity, session duration
5. **Model customization** - Color/material variants
6. **Multiple object detection** - Both hands for rings, both ears for earrings

### Technical Improvements
1. **Progressive Web App (PWA)** - Offline support, installable
2. **Performance monitoring** - FPS tracking, model load times
3. **Error recovery** - Better handling of camera/permission failures
4. **WebXR integration** - Native AR support on compatible devices
5. **Server-side rendering** - Optimize initial load

---

## Deployment Considerations

### Production Requirements
- HTTPS certificate (mandatory for camera access)
- Static file hosting (Vercel, Netlify, S3, etc.)
- Enable gzip compression for NN JSON files (large files benefit from compression)
- CDN recommended for global distribution

### Environment Configuration
- No environment variables required (fully client-side)
- No backend/database needed
- All assets served statically

---

## Model Specifications (User-Provided)

### GLB Model Requirements
- **Format**: GLB (binary GLTF) - single file with embedded textures
- **Scale**: Real-world units (1 unit = 1 meter), typically 0.01-0.1 scale works best
- **Orientation**: Y-up axis, facing +Z direction
- **Poly Count**: <50,000 triangles for mobile performance
- **Textures**: Embedded in GLB (no external dependencies)
- **Materials**: PBR materials recommended (metalness/roughness workflow)

### Model Placement
- Place GLB files in corresponding `/public/models/[category]/` directories
- Naming convention:
  - Single model: `model.glb`
  - Rings: `ring_thumb.glb`, `ring_index.glb`, `ring_middle.glb`, `ring_ring.glb`, `ring_pinky.glb`

---

## References

### Official Documentation
- WebAR.rocks.face: https://github.com/WebAR-rocks/WebAR.rocks.face
- WebAR.rocks.hand: https://github.com/WebAR-rocks/WebAR.rocks.hand
- Three.js: https://threejs.org/docs/
- Next.js 15: https://nextjs.org/docs

### Official Demo Examples
- VTOWatch (hand tracking): `/official-examples/VTOWatchOnly/`
- VTONecklace (face tracking): `/official-examples/VTONecklace/`
- Earrings3D: `/official-examples/earrings3D/`

---

## Implementation Notes

### Why Official Helpers?
Using WebARRocksMirror and HandTrackerThreeHelper instead of raw WebAR.rocks API provides:
- **Proven pattern**: Matches all official demos (VTOWatch, VTONecklace, VTOGlasses)
- **Video rendering**: WebGL-based video texture rendering (not manual 2D drawing)
- **Canvas management**: Automatic sizing, lighting, and scene setup
- **Stability**: Landmark smoothing and pose filtering built-in
- **Maintainability**: Less code, fewer bugs, easier updates

### Script Loading Strategy
1. Import Three.js as ES module and expose to window.THREE
2. Load WebARRocksFace.js
3. Wait for WEBARROCKSFACE global to be available
4. Load WebARRocksFaceThreeHelper.js (bundles stabilizers internally)
5. Load WebARRocksMirror.js (depends on step 4)

This order prevents ES6 module conflicts and ensures dependencies are ready.

---

**Document Version**: 2.0
**Last Updated**: 2026-06-17
**Implementation Status**: Architecture refactored to use official helpers. Core tracking functional, awaiting 3D model assets for production testing.
