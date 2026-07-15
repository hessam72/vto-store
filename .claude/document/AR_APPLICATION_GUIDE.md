# AR Application Implementation Guide

A comprehensive guide to building cross-platform AR web applications using Google Model Viewer and Next.js. This document explains how to create applications that display 3D assets in the real world (floor/desk placement) with support for iOS, Android, and desktop devices.

---

## Table of Contents

1. [Tech Stack Overview](#tech-stack-overview)
2. [Project Setup](#project-setup)
3. [AR Implementation](#ar-implementation)
4. [Platform-Specific Support](#platform-specific-support)
5. [Model Asset Preparation](#model-asset-preparation)
6. [Component Architecture](#component-architecture)
7. [Advanced Features](#advanced-features)
8. [Deployment](#deployment)
9. [Quick Start Guide](#quick-start-guide)

---

## Tech Stack Overview

### Core Dependencies

```json
{
  "@google/model-viewer": "^4.1.0",    // Cross-platform AR web component
  "next": "15.3.3",                     // React framework with App Router
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5"
}
```

### Optional Dependencies (for non-AR fallback)

```json
{
  "@react-three/fiber": "^9.1.2",      // React renderer for Three.js
  "@react-three/drei": "^10.3.0",      // Three.js helpers
  "three": "^0.172.0",                  // 3D graphics library
  "framer-motion": "^12.18.1",         // Animation library
  "tailwindcss": "^4"                   // CSS framework
}
```

### Why These Technologies?

- **Google Model Viewer**: Handles AR complexity automatically, provides fallbacks for all platforms
- **Next.js**: Server-side rendering, optimized builds, great developer experience
- **TypeScript**: Type safety and better IDE support
- **Tailwind CSS**: Rapid UI development with utility classes

---

## Project Setup

### 1. Create New Next.js Project

```bash
npx create-next-app@latest my-ar-app --typescript --tailwind --app
cd my-ar-app
```

### 2. Install AR Dependencies

```bash
npm install @google/model-viewer
```

### 3. Install Optional 3D Libraries (for desktop fallback)

```bash
npm install @react-three/fiber @react-three/drei three
```

### 4. Project Structure

Create the following directory structure:

```
my-ar-app/
├── src/
│   └── app/
│       ├── components/
│       │   ├── ARViewer.tsx           # Main AR viewer
│       │   └── FallbackViewer.tsx     # Desktop 3D viewer
│       ├── layout.tsx                  # Root layout
│       ├── page.tsx                    # Main page
│       └── globals.css                 # Global styles
├── public/
│   └── models/
│       ├── your-model.glb             # Android/Web model
│       └── your-model.usdz            # iOS model
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## AR Implementation

### Basic AR Component

Create `src/app/components/ARViewer.tsx`:

```typescript
'use client'

import React, { useRef } from 'react'
import '@google/model-viewer'

export default function ARViewer() {
  const modelRef = useRef<any>(null)

  return (
    <div className="w-full h-screen">
      {/* @ts-ignore */}
      <model-viewer
        ref={modelRef}
        src="/models/your-model.glb"
        ios-src="/models/your-model.usdz"
        alt="3D Model in AR"
        poster="/placeholder.jpg"
        seamless-poster

        // AR Configuration
        ar
        ar-modes="webxr scene-viewer quick-look"
        xr-hit-test
        ar-placement="floor"
        ar-scale="fixed"

        // Visual Enhancements
        shadow-intensity="1"
        camera-controls
        auto-rotate
        xr-environment

        style={{ width: '100%', height: '100%' }}
      >
        {/* Custom AR Button */}
        <button
          slot="ar-button"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '12px 24px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            zIndex: 100
          }}
        >
          View in AR
        </button>
      </model-viewer>
    </div>
  )
}
```

### Key Attributes Explained

| Attribute | Purpose | Values |
|-----------|---------|--------|
| `src` | 3D model for Android/Web | Path to `.glb` file |
| `ios-src` | 3D model for iOS | Path to `.usdz` file |
| `ar` | Enables AR mode | Boolean attribute |
| `ar-modes` | AR platform priority | `"webxr scene-viewer quick-look"` |
| `xr-hit-test` | Surface detection | Boolean attribute |
| `ar-placement` | Where model appears | `"floor"` or `"wall"` |
| `ar-scale` | Scale behavior | `"fixed"` or `"auto"` |
| `shadow-intensity` | Shadow darkness | `"0"` to `"1"` |
| `camera-controls` | Interactive preview | Boolean attribute |
| `auto-rotate` | Auto-rotation | Boolean attribute |
| `xr-environment` | Real-world lighting | Boolean attribute |

### Wall Placement Variant

For objects that should be placed on walls (artwork, boards, etc.):

```typescript
<model-viewer
  // ... other attributes
  ar-placement="wall"    // Change from "floor" to "wall"
  // ...
/>
```

---

## Platform-Specific Support

### How AR Works on Different Platforms

```
ar-modes="webxr scene-viewer quick-look"
```

**Mode Priority Order:**

1. **WebXR** → Advanced web-based AR (Chrome Android with ARCore)
2. **Scene Viewer** → Google's AR viewer (Android fallback)
3. **Quick Look** → Apple's AR viewer (iOS/iPadOS)

### Platform Detection

Create `src/app/page.tsx`:

```typescript
'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ARViewer = dynamic(() => import('./components/ARViewer'), {
  ssr: false  // Disable server-side rendering
})

export default function Home() {
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    // User agent detection
    const ua = navigator.userAgent || ''
    const ios = /iPhone|iPad|iPod/.test(ua)
    const android = /Android/.test(ua)
    const mobile = /Mobi|Android|iPhone|iPad/.test(ua)

    setIsIOS(ios)
    setIsAndroid(android)
    setIsMobile(mobile)
  }, [])

  return (
    <div className="w-full h-screen">
      {/* Show message for desktop users */}
      {!isMobile && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-100 px-4 py-2 rounded-lg">
          AR is available on mobile devices only
        </div>
      )}

      <ARViewer />
    </div>
  )
}
```

### Platform Support Matrix

| Platform | Detection | AR Mode | Model Format | Features |
|----------|-----------|---------|--------------|----------|
| iOS Safari | `/iPhone\|iPad\|iPod/.test(ua)` | Quick Look | USDZ | Native AR, optimal performance |
| Android Chrome | `/Android/.test(ua)` | WebXR/Scene Viewer | GLB | WebXR API or Google viewer |
| Desktop | No mobile match | Preview only | GLB | 3D preview, no AR |

### iOS-Specific Implementation

**Requirements:**
- iOS 12+ with AR-capable hardware (iPhone 6s+, iPad 5th gen+)
- Safari browser
- USDZ model format

**How it works:**
1. User taps AR button
2. Model Viewer launches Apple Quick Look
3. Native iOS AR experience with ARKit
4. Plane detection and object placement
5. Built-in share/screenshot features

### Android-Specific Implementation

**Requirements:**
- Android 7.0+ with ARCore support
- Chrome browser
- GLB model format

**How it works:**
1. User taps AR button
2. Launches Scene Viewer (or WebXR if supported)
3. Camera-based AR with plane detection
4. Surface placement with visual feedback
5. On-screen controls for rotation/scale

---

## Model Asset Preparation

### File Format Requirements

You need **TWO formats** for cross-platform support:

```
public/models/
├── my-object.glb      # For Android, Web, Desktop
└── my-object.usdz     # For iOS
```

### Creating GLB Files

**From Blender:**

1. Model your 3D object in Blender
2. Set real-world dimensions (in meters)
   - Car: ~4.5m × 1.8m × 1.5m
   - Chair: ~0.5m × 0.5m × 0.8m
   - Use actual measured sizes for AR accuracy
3. Export: File → Export → glTF 2.0 (.glb/.gltf)
4. Settings:
   - Format: **glTF Binary (.glb)**
   - Include: Selected Objects
   - Transform: **+Y Up**
   - Geometry: Apply Modifiers, UVs, Normals, Tangents
   - Materials: Export
   - Compression: None (or Draco for smaller files)

**GLB Optimization (Draco Compression):**

```bash
# Install gltf-pipeline
npm install -g gltf-pipeline

# Compress GLB file (reduces size by ~90%)
gltf-pipeline -i model.glb -o compressed.glb -d
```

**Example size reduction:**
- Original: 18.5 MB
- Compressed: 1.7 MB
- Model Viewer supports Draco automatically

**Best Practices:**
- Keep textures under 2048×2048 pixels
- Use power-of-2 texture dimensions (512, 1024, 2048)
- Bake lighting into textures for mobile performance
- Single material per mesh when possible
- Test file size: aim for under 10 MB for mobile

### Creating USDZ Files

**Method 1: Reality Converter (Mac only, FREE)**

1. Download [Reality Converter](https://developer.apple.com/augmented-reality/tools/) from Apple
2. Drag your `.glb` or `.fbx` file into the app
3. Preview in AR using iPhone/iPad
4. File → Export → Save as `.usdz`

**Method 2: Command Line (Mac with Xcode)**

```bash
xcrun usdz_converter input.glb output.usdz
```

**Method 3: Online Converters**

- https://www.model-converter.com/
- https://glb-to-usdz.glitch.me/

**USDZ Requirements:**
- Max recommended size: 50 MB (iOS limitation)
- Real-world scale (same as GLB)
- Materials: PBR metallic-roughness workflow
- Textures: Embedded or referenced

### Model Dimensions & Scale

**Setting Correct Scale:**

The model's dimensions in Blender/3D software = AR dimensions in real world.

```typescript
// Check dimensions programmatically
const mv = modelRef.current
mv.addEventListener('load', () => {
  const size = mv.getDimensions()
  console.log(`Width: ${size.x}m`)
  console.log(`Height: ${size.y}m`)
  console.log(`Depth: ${size.z}m`)
})
```

**Examples:**
- Desk: 1.2m × 0.6m × 0.75m
- Car: 4.5m × 1.8m × 1.5m
- Coffee mug: 0.08m × 0.08m × 0.1m

Model Viewer respects these dimensions in AR mode with `ar-scale="fixed"`.

---

## Component Architecture

### Main Page with View Switching

```typescript
'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'

const ARViewer = dynamic(() => import('./components/ARViewer'), { ssr: false })
const ARViewer2 = dynamic(() => import('./components/ARViewer2'), { ssr: false })

type ViewType = 'model1' | 'model2'

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('model1')

  return (
    <div className="flex flex-col h-screen">
      {/* View Switcher */}
      <div className="bg-gray-900 p-4 flex justify-center gap-4">
        <button
          onClick={() => setActiveView('model1')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'model1'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Chair
        </button>
        <button
          onClick={() => setActiveView('model2')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'model2'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Table
        </button>
      </div>

      {/* AR Viewer */}
      <div className="flex-grow">
        {activeView === 'model1' ? <ARViewer /> : <ARViewer2 />}
      </div>
    </div>
  )
}
```

### Root Layout

```typescript
import React from 'react'
import './globals.css'

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-md p-4">
          <h1 className="text-2xl font-bold text-center text-gray-800">
            AR Furniture Viewer
          </h1>
        </header>
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  )
}
```

### Desktop Fallback Viewer (Optional)

For desktop users, provide an interactive 3D viewer:

```typescript
'use client'

import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'

function Model() {
  const gltf = useGLTF('/models/your-model.glb')
  return <primitive object={gltf.scene} />
}

export default function FallbackViewer() {
  return (
    <div className="w-full h-screen bg-gray-200">
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
        <Suspense fallback={null}>
          <Model />
          <Environment preset="sunset" />
        </Suspense>
        <OrbitControls enableZoom={true} />
      </Canvas>
    </div>
  )
}
```

---

## Advanced Features

### Material Color Changes

```typescript
'use client'

import React, { useRef, useState } from 'react'
import '@google/model-viewer'

export default function ARViewer() {
  const modelRef = useRef<any>(null)
  const [colorIndex, setColorIndex] = useState(0)
  const colors = ['#ff0000', '#00ff00', '#0000ff']

  const changeColor = () => {
    const mv = modelRef.current
    if (!mv) return

    const nextIndex = (colorIndex + 1) % colors.length
    setColorIndex(nextIndex)

    const hex = colors[nextIndex].slice(1)
    const r = parseInt(hex.substr(0, 2), 16) / 255
    const g = parseInt(hex.substr(2, 2), 16) / 255
    const b = parseInt(hex.substr(4, 2), 16) / 255

    mv.model.materials[0]
      .pbrMetallicRoughness
      .setBaseColorFactor([r, g, b, 1])
  }

  return (
    <div className="relative w-full h-screen">
      {/* @ts-ignore */}
      <model-viewer
        ref={modelRef}
        src="/models/your-model.glb"
        ios-src="/models/your-model.usdz"
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        style={{ width: '100%', height: '100%' }}
      >
        <button slot="ar-button">View in AR</button>
      </model-viewer>

      {/* Color Picker */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
        {colors.map((color, index) => (
          <button
            key={color}
            onClick={changeColor}
            className="w-12 h-12 rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}
```

### Hotspots (Annotations)

Add interactive markers on the model:

```typescript
<model-viewer
  // ... other attributes
>
  {/* Hotspot Button */}
  <button
    slot="hotspot-feature1"
    data-position="0.5 1.0 0"      // x y z position in model space
    data-normal="0 1 0"             // surface normal direction
    style={{
      position: 'absolute',
      backgroundColor: 'white',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      border: '2px solid #007bff',
      cursor: 'pointer'
    }}
  >
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'white',
      padding: '8px',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    }}>
      Premium leather seat
    </div>
  </button>

  <button slot="ar-button">View in AR</button>
</model-viewer>
```

### Camera Positions

Create preset camera views:

```typescript
const mv = modelRef.current

// Camera orbit: azimuth, altitude, radius
mv.cameraOrbit = "45deg 75deg 5m"

// Camera target: x, y, z in meters
mv.cameraTarget = "0m 1m 0m"

// Field of view
mv.fieldOfView = "30deg"
```

### Dimension Measurement

Display model dimensions:

```typescript
useEffect(() => {
  const mv = modelRef.current
  if (!mv) return

  const onLoad = () => {
    const center = mv.getBoundingBoxCenter()
    const size = mv.getDimensions()

    console.log('Center:', center)  // { x, y, z }
    console.log('Size:', size)      // { x, y, z } in meters

    // Update UI with dimensions
    setDimensions({
      width: (size.x * 100).toFixed(0) + ' cm',
      height: (size.y * 100).toFixed(0) + ' cm',
      depth: (size.z * 100).toFixed(0) + ' cm'
    })
  }

  mv.addEventListener('load', onLoad)
  return () => mv.removeEventListener('load', onLoad)
}, [])
```

### Animation Control

If your model has animations:

```typescript
const mv = modelRef.current

// List available animations
console.log(mv.availableAnimations)  // ['Walk', 'Run', 'Jump']

// Play animation
mv.animationName = "Walk"
mv.play()

// Pause
mv.pause()

// Set playback speed
mv.timeScale = 0.5  // Half speed
```

---

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Test production build locally
npm run start
```

### Environment Variables (if needed)

Create `.env.local`:

```env
NEXT_PUBLIC_MODEL_CDN=https://cdn.yoursite.com
```

Use in component:

```typescript
<model-viewer
  src={`${process.env.NEXT_PUBLIC_MODEL_CDN}/models/chair.glb`}
  // ...
/>
```

### Hosting Considerations

**Static Files:**
- Host GLB/USDZ files on CDN for faster loading
- Enable CORS if models are on different domain
- Compress files with gzip/brotli
- Set proper cache headers

**Server Requirements:**
- Node.js 18+ for Next.js 15
- HTTPS required for AR features (browser security)
- Mobile-optimized network delivery

### PM2 Deployment (Example)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "ar-app",
      script: "npm",
      args: "run start",
      cwd: "/path/to/your/app",
      instances: 1,
      exec_mode: "fork",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      autorestart: true,
      max_memory_restart: "500M",
    },
  ],
}
```

Deploy:

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
```

---

## Quick Start Guide

### Complete Setup (5 minutes)

**Step 1: Create Project**

```bash
npx create-next-app@latest furniture-ar --typescript --tailwind --app
cd furniture-ar
npm install @google/model-viewer
```

**Step 2: Create AR Component**

Create `src/app/components/ARViewer.tsx`:

```typescript
'use client'
import React from 'react'
import '@google/model-viewer'

export default function ARViewer() {
  return (
    <div className="w-full h-screen">
      {/* @ts-ignore */}
      <model-viewer
        src="/models/chair.glb"
        ios-src="/models/chair.usdz"
        alt="Chair"
        ar
        ar-modes="webxr scene-viewer quick-look"
        xr-hit-test
        ar-placement="floor"
        ar-scale="fixed"
        shadow-intensity="1"
        camera-controls
        auto-rotate
        style={{ width: '100%', height: '100%' }}
      >
        <button
          slot="ar-button"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '12px 24px',
            backgroundColor: 'white',
            borderRadius: '8px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          View in AR
        </button>
      </model-viewer>
    </div>
  )
}
```

**Step 3: Update Main Page**

Edit `src/app/page.tsx`:

```typescript
'use client'
import dynamic from 'next/dynamic'

const ARViewer = dynamic(() => import('./components/ARViewer'), { ssr: false })

export default function Home() {
  return <ARViewer />
}
```

**Step 4: Add Your Models**

Place your 3D models in:

```
public/
└── models/
    ├── chair.glb
    └── chair.usdz
```

**Step 5: Run**

```bash
npm run dev
```

Open http://localhost:3000 on your phone to test AR!

---

## Troubleshooting

### AR Button Not Showing

**Problem:** AR button doesn't appear on mobile device.

**Solutions:**
- Ensure you're on a mobile device (iOS/Android)
- Check that both `ar` attribute and `ar-modes` are set
- Verify model files load correctly (check Network tab)
- Use HTTPS (required for AR features)
- Test on real device, not simulator/emulator

### Model Not Loading

**Problem:** Model doesn't appear or shows error.

**Solutions:**
- Check file paths are correct (case-sensitive)
- Verify GLB/USDZ files are valid (test in other viewers)
- Ensure files are under 50 MB
- Check browser console for errors
- Verify CORS headers if using external CDN

### TypeScript Errors

**Problem:** TypeScript doesn't recognize `<model-viewer>`.

**Solution:** Add `// @ts-ignore` comment above the element:

```typescript
{/* @ts-ignore */}
<model-viewer ... />
```

### Hydration Errors

**Problem:** "Text content does not match" or hydration errors.

**Solutions:**
- Add `'use client'` directive at top of component
- Use dynamic import with `{ ssr: false }`
- Don't access `navigator` or `window` during initial render

### iOS AR Not Working

**Problem:** AR doesn't launch on iPhone.

**Solutions:**
- Ensure you have `.usdz` file with `ios-src` attribute
- Test on iOS 12+ with AR-capable device (iPhone 6s+)
- Use Safari browser (Chrome iOS doesn't support AR)
- Check USDZ file is valid (test in Reality Converter)

### Android AR Not Working

**Problem:** AR doesn't work on Android.

**Solutions:**
- Test on Android 7.0+ with ARCore support
- Use Chrome browser
- Verify device supports ARCore (check Google's list)
- Ensure `.glb` file loads correctly

### Model Too Large/Small in AR

**Problem:** Model appears wrong size in real world.

**Solutions:**
- Check dimensions in 3D software (must be in meters)
- Use `ar-scale="fixed"` to prevent user scaling
- Verify scale during export (Blender: scale factor 1.0)
- Test dimensions: `mv.getDimensions()`

---

## Important Notes

### TypeScript Integration

Model Viewer doesn't have official TypeScript types. Use these patterns:

```typescript
// Component with @ts-ignore
{/* @ts-ignore */}
<model-viewer ... />

// Ref typing
const modelRef = useRef<any>(null)

// Event typing
mv.addEventListener('load', () => {
  // Access model API
})
```

### Client-Side Only

**Always use:**
- `'use client'` directive at top of AR components
- Dynamic import with `ssr: false` for AR components
- Device detection inside `useEffect`

**Why:** AR features require browser APIs (`navigator`, DOM) not available during server-side rendering.

### Performance Optimization

**Model Files:**
- Use Draco compression for GLB files
- Keep textures under 2048×2048
- Optimize polygon count (aim for < 100k triangles)
- Use single material when possible

**Loading:**
- Add `poster` attribute for loading placeholder
- Use `seamless-poster` for smooth transition
- Consider lazy-loading models with Intersection Observer

**Runtime:**
- Limit active `model-viewer` instances (unmount when not visible)
- Use `loading="lazy"` for multiple models on page
- Optimize for mobile GPUs (low poly, compressed textures)

### Browser Support

| Feature | iOS Safari | Android Chrome | Desktop Chrome | Desktop Safari |
|---------|------------|----------------|----------------|----------------|
| AR Mode | ✅ (Quick Look) | ✅ (Scene Viewer/WebXR) | ❌ | ❌ |
| 3D Preview | ✅ | ✅ | ✅ | ✅ |
| Camera Controls | ✅ | ✅ | ✅ | ✅ |
| Hotspots | ✅ | ✅ | ✅ | ✅ |
| Animations | ✅ | ✅ | ✅ | ✅ |

**Minimum Versions:**
- iOS Safari: iOS 12+
- Android Chrome: Android 7.0+ with ARCore
- Desktop: Any modern browser for preview

---

## Resources

### Official Documentation

- [Google Model Viewer Docs](https://modelviewer.dev/)
- [Model Viewer Examples](https://modelviewer.dev/examples/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Apple AR Quick Look](https://developer.apple.com/augmented-reality/quick-look/)
- [Google ARCore](https://developers.google.com/ar)

### Tools

- [Reality Converter](https://developer.apple.com/augmented-reality/tools/) - USDZ creation (Mac)
- [Blender](https://www.blender.org/) - Free 3D modeling
- [gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) - GLB optimization
- [glTF Viewer](https://gltf-viewer.donmccurdy.com/) - Test GLB files online

### Testing

- **iOS:** Real iPhone/iPad with iOS 12+ (simulators don't support AR)
- **Android:** Real device with ARCore support (emulators limited)
- **Desktop:** Chrome DevTools device mode for initial testing
- **AR Support Check:** https://developers.google.com/ar/devices

### Model Resources

- [Sketchfab](https://sketchfab.com/) - Download 3D models (GLB format)
- [Google Poly Alternative](https://poly.pizza/) - Free 3D models
- [Turbosquid](https://www.turbosquid.com/) - Professional models
- [Free3D](https://free3d.com/) - Free models

---

## Summary

This guide provides everything needed to build a cross-platform AR web application:

1. **Use Google Model Viewer** for automatic AR platform handling
2. **Provide dual formats** (GLB for Android/Web, USDZ for iOS)
3. **Use Next.js App Router** with client-side rendering for AR components
4. **Set real-world dimensions** in 3D models for accurate AR scale
5. **Test on real devices** (iOS Safari, Android Chrome)
6. **Optimize assets** (Draco compression, texture sizes)
7. **Handle platform detection** but let Model Viewer choose AR mode

The key advantage of this approach: Google Model Viewer handles all platform complexity, falling back gracefully from WebXR → Scene Viewer → Quick Look → 3D preview depending on device capabilities.

Good luck building your AR application!
