# Troubleshooting Guide

## Build/Dev Issues

### 404 on `/vto/earrings`

**Symptom:** Route not found

**Cause:** Demo folder missing or route handler error

**Fix:**
```bash
# Verify demo exists
ls -la public/vto/earrings/

# Check route handler
cat app/vto/[category]/route.ts
```

### 404 on `/vto/earrings/main.js`

**Symptom:** Scripts not loading

**Cause:** Missing `<base>` tag injection

**Fix:** Verify route handler injects base:
```ts
const baseTag = `<base href="/vto/${category}/">`;
htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`);
```

### TypeScript errors in route handler

**Symptom:** `params` type error

**Cause:** Next.js 15+ async params

**Fix:**
```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;  // Await params
  // ...
}
```

---

## Camera Issues

### Camera permission denied

**Symptom:** `NotAllowedError: Permission denied`

**Fix:**
1. Check browser permissions (Safari: Settings → Camera)
2. Ensure HTTPS in production
3. Use `localhost` in dev (not `127.0.0.1`)

### Camera not starting (HTTPS required)

**Symptom:** Silent failure, no video feed

**Cause:** HTTP instead of HTTPS

**Fix:**
- Dev: Use `localhost:3000` (not IP address)
- Production: Deploy to Vercel/Netlify (auto-HTTPS)

### Wrong camera selected

**Symptom:** Front camera when rear expected (watch/ring demos)

**Fix:**
```js
// main.js - HandTrackerThreeHelper
const handTrackerCanvas = _VTOThreeHelper.init({
  // ...
  cameraSettings: {
    facingMode: 'environment'  // Rear camera
    // facingMode: 'user'       // Front camera
  }
});
```

---

## Tracking Issues

### Face/hand not detected

**Symptom:** No 3D model appears

**Cause:**
- Poor lighting
- Face/hand outside frame
- Neural network loading failed

**Fix:**
1. Check console for NN loading errors
2. Improve lighting (front-facing light)
3. Center face/hand in frame
4. Verify NN path: `neuralNets/NN_*.json`

### Jittery/unstable tracking

**Symptom:** Model shakes/jumps

**Fix:** Adjust stabilizer:
```js
// helpers/landmarksStabilizers/OneEuroLMStabilizer.js
const stabilizer = new OneEuroLMStabilizer({
  minCutOff: 0.001,     // Lower = smoother (more lag)
  beta: 5,              // Higher = more responsive
  freqRange: [2, 60],
  forceFreq: 60
});
```

### Model appears upside-down/rotated

**Symptom:** Orientation wrong

**Fix:**
```js
// main.js - Adjust rotation
loader.load(_glbURL, (gltf) => {
  const model = gltf.scene;
  model.rotation.x = Math.PI / 2;  // Rotate 90°
  model.rotation.z = Math.PI;      // Flip 180°
});
```

---

## 3D Model Issues

### Model not visible

**Symptom:** Camera works, tracking works, no model

**Cause:**
- Wrong GLB path
- Model scale too small/large
- Material issues (unlit, missing textures)

**Fix:**
1. Check path: `'./assets/model.glb'`
2. Adjust scale:
   ```js
   scale: [2, 2, 2]  // 2x larger
   ```
3. Add debug cube:
   ```js
   const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
   const cube = new THREE.Mesh(geometry, material);
   scene.add(cube);
   ```

### Model too dark

**Symptom:** Model barely visible

**Fix:**
```js
// main.js - Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);  // Increase intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 5, 5);
scene.add(directionalLight);
```

### Textures missing

**Symptom:** Model solid color, no materials

**Cause:** GLB missing embedded textures

**Fix:**
1. Re-export GLB with embedded textures (Blender: Include → Textures)
2. Or load textures separately:
   ```js
   const textureLoader = new THREE.TextureLoader();
   const texture = textureLoader.load('./assets/texture.jpg');
   material.map = texture;
   ```

---

## Performance Issues

### Low FPS (<30fps)

**Cause:**
- Heavy post-processing (TAA, Bloom)
- Large neural network
- Complex 3D model

**Fix:**
1. **Disable post-processing:**
   ```js
   // main.js - Comment out
   // _VTOThreeHelper.add_TAARenderPass(...);
   // _VTOThreeHelper.add_UnrealBloomPass(...);
   ```

2. **Lower TAA quality:**
   ```js
   taa: {
     sampleLevel: 1  // Was 3-5
   }
   ```

3. **Simplify model:**
   - Reduce poly count (Blender: Decimate modifier)
   - Optimize textures (lower resolution)

4. **Use rear camera (hand demos):**
   - Typically better performance

### Long load time

**Symptom:** 5+ seconds before demo starts

**Cause:**
- Large neural network (4.2MB for hand tracking)
- Multiple 3D models

**Fix:**
- Add loading indicator (already present in demos)
- Optimize assets:
  - Compress GLB (gltf-pipeline)
  - Reduce NN size (not recommended, accuracy loss)

---

## Deployment Issues

### Works localhost, fails production

**Symptom:** Camera/tracking broken after deploy

**Cause:** HTTP instead of HTTPS

**Fix:** Deploy to platform with auto-HTTPS:
- Vercel (recommended)
- Netlify
- Cloudflare Pages

### Large bundle size warning

**Symptom:** Vercel warns about 4.5MB+ bundle

**Cause:** Neural networks in `public/`

**Fix:** Ignore warning — these are static assets, not JS bundle:
```json
// vercel.json
{
  "functions": {
    "app/**": {
      "maxDuration": 10
    }
  }
}
```

### Route handler timeout

**Symptom:** 504 Gateway Timeout

**Cause:** Reading HTML file too slow (unlikely)

**Fix:**
- Increase timeout (Vercel: max 60s serverless)
- Or serve directly from public (alternative architecture)

---

## Debugging Tips

### Check console

**Browser DevTools → Console:**
- Neural network loading errors
- WebAR init failures
- Three.js warnings

### Verify file paths

```js
// Add to main.js
console.log('Loading model from:', _glbURL);
console.log('NN path:', './neuralNets/NN_EARS_4.json');
```

### Enable debug features

**Earrings:**
```js
const settings = {
  debugDisplayLandmarks: true,  // Show ear landmarks
  // ...
};
```

**Necklace:**
```js
const settings = {
  debugCube: true,  // Show tracking cube
  // ...
};
```

**Watch/Rings:**
```js
const handTrackerCanvas = _VTOThreeHelper.init({
  // Three.js inspector: Shift+Ctrl+Alt+I
  debugDisplayLandmarks: true
});
```

### Network tab

**DevTools → Network:**
- Verify all assets load (200 status)
- Check NN download size
- Look for 404s

### Three.js Inspector

Chrome extension: [Three.js Developer Tools](https://chrome.google.com/webstore/detail/threejs-developer-tools/)

---

## Common Error Messages

### `Failed to execute 'texImage2D'`

**Cause:** Invalid texture format or size

**Fix:** Use power-of-2 textures (512x512, 1024x1024)

### `WebGL context lost`

**Cause:** GPU crash (too complex scene)

**Fix:**
- Simplify 3D models
- Reduce texture resolution
- Disable post-processing

### `Cannot read property 'position' of undefined`

**Cause:** Model not loaded before accessing

**Fix:**
```js
loader.load(_glbURL, (gltf) => {
  const model = gltf.scene;
  // Only access model inside callback
  model.position.set(0, 0, 0);
});
```

### `Mixed content blocked`

**Cause:** Loading HTTP resource from HTTPS page

**Fix:** Ensure all assets use relative paths (no hardcoded URLs)
