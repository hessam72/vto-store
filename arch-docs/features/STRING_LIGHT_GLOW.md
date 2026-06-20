# String Light Glow Implementation

## Overview
Implements realistic glowing string lights using emissive materials and post-processing bloom effects, without performance-heavy real-time point lights.

## Approach
**Selected Method:** Emissive Material + Bloom Post-Processing

**Rationale:**
- Medium realism with low performance cost
- Leverages existing EffectComposer and UnrealBloomPass (already configured in PostProcessing.tsx)
- Scalable to any number of light bulbs/meshes
- No additional light objects or shadow calculations

## Implementation Details

### Material Properties
- **Emissive Color:** Yellow-green warm tone (#eeff00)
- **Emissive Intensity:** 6.0-6.5 (exceeds bloom luminance threshold of 0.85)
- Applied to all meshes containing "light" in their name (case-insensitive)

### Mesh Detection
- Traverses loaded GLB models during scene initialization
- Matches any mesh with "light" substring in name
- Supports both single materials and material arrays

### Post-Processing Integration
- Existing bloom configuration:
  - Luminance threshold: 0.85
  - Intensity: 0.35
  - Radius: 0.6
  - Mipmap blur: enabled
- Emissive intensity tuned to exceed threshold for visible glow
- SMAA anti-aliasing maintains edge quality

### Location
**File:** `components/store/ModelLoader.tsx`
**Section:** Model traversal loop (visual models branch)
**Execution:** During model clone and setup, before scene addition

## Performance Characteristics
- **Render Cost:** Minimal (no additional lights)
- **CPU Impact:** None (material properties set once at load)
- **GPU Impact:** Existing bloom pass (no new overhead)
- **Scalability:** O(1) regardless of light count

## Alternatives Rejected
1. **Per-Bulb PointLights:** High CPU/GPU cost (O(N) lights), shadow calculation overhead
2. **RectAreaLight:** Limited to 4-5 before performance degrades, no shadow support
3. **Baked Lightmaps:** Static only, complex workflow, not needed for this use case

## Configuration
Adjust visual intensity via:
- `emissiveIntensity` in ModelLoader.tsx (affects brightness)
- Bloom `intensity` in PostProcessing.tsx (affects glow spread)
- Bloom `luminanceThreshold` (controls glow activation threshold)

## Dependencies
- Three.js Color API
- Existing UnrealBloomPass in PostProcessing component
- GLB models with meshes named containing "light"
