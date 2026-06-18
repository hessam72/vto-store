# 3D Collision System: Wall & Floor Recognition

## Overview

This document explains how the VR Store application recognizes walls and floors from 3D wireframe models and prevents players from walking through them using physics-based collision detection.

---

## Architecture

### High-Level Flow

```
GLB Wireframe Model Loaded
        ↓
Three.js Scene Graph Created
        ↓
Octree Spatial Index Built from Scene Geometry
        ↓
Player Represented as Capsule Collision Primitive
        ↓
Every Frame: Test Capsule Against Octree
        ↓
Collision Detected? → Push Player Back + Stop Velocity
        ↓
Floor Contact? → Disable Gravity, Enable Jumping
```

---

## Core Components

### 1. **Wireframe Model Format (GLB)**

**File Source:** `BASE_MODEL` from config (priority: 0, quality: "low")

**Characteristics:**
- Loaded from `/public/files/final/compressed_raw-wireframe.glb`
- Contains raw geometry for all structural elements:
  - Walls
  - Floors
  - Boundaries
  - Store structures

**Processing:**
- Loaded via Three.js `GLTFLoader` with `DRACOLoader` decompression
- Scene graph parsed into geometric mesh data
- No geometry manipulation—uses raw structure as-is

---

### 2. **Wall & Floor Recognition**

#### Recognition Strategy

Walls and floors are **automatically recognized** from the wireframe geometry itself. No special naming conventions required.

**Process:**
1. Wireframe GLB is loaded into Three.js scene
2. All mesh geometries are converted to collision geometry
3. Spatial index (Octree) built from mesh triangles
4. No separate classification needed—all geometry acts as collision surface

#### Floor Detection (Y-Coordinate Based)

Once player collides with geometry, the system identifies if contact is with a **floor** by checking the collision normal:

**Logic (from [useCharacter.ts:241-242](virtual-core/src/virtual/character/useCharacter.ts#L241-L242)):**

```typescript
playerOnFloor_ref.current =
  (world_capsuleIntersect_result_ref.current?.normal?.y || 0) > 0;
```

**Meaning:**
- If collision normal's Y-component > 0 → **Floor detected**
- If collision normal's Y-component ≤ 0 → **Wall/vertical surface detected**

**Floor Classification by Y-Position:**

| Floor | Y-Range | Location |
|-------|---------|----------|
| 1 | -4 to 1.5 | Ground level |
| 2 | 1.5 to 6.5 | Level 2 |
| 3 | 6.5 to 11.5 | Level 3 |
| 4 | 11.5 to 16.5 | Level 4 |
| 5 | 16.5 to 25 | Level 5 |

**File:** [findFloorBasedOnY.ts](virtual-core/src/virtual/utility/findFloorBasedOnY.ts)

---

### 3. **Collision Detection System**

#### Three.js Octree & Capsule

**Components (from [useCharacter.ts:4, 28, 35-36](virtual-core/src/virtual/character/useCharacter.ts#L4-L36)):**

```typescript
import { Capsule, Octree } from "three/examples/jsm/Addons.js";

// Spatial index built from all scene geometry
const worldOctree_ref = useRef(new Octree());

// Player collision primitive (cylinder with rounded ends)
const playerCollider_ref = useRef(
  new Capsule(
    new Vector3(-20, 0.35, 0),  // Capsule bottom
    new Vector3(-12, 1.45, 0),  // Capsule top
    0.35                        // Capsule radius
  )
);
```

**Why Capsule?**
- Represents player as 3D cylinder (~1.1m height, 0.35m radius)
- More accurate than AABB for humanoid navigation
- Handles edge/corner collisions smoothly

#### Building the Octree

**When:** On scene load (after all models loaded)

**File:** [useCharacter.ts:92](virtual-core/src/virtual/character/useCharacter.ts#L92)

```typescript
useEffect(() => {
  worldOctree_ref.current.fromGraphNode(scene);
  // ...
}, []);
```

**Process:**
1. Traverses entire Three.js scene graph
2. Extracts all mesh geometry
3. Builds hierarchical spatial index
4. Result: Efficient collision queries without checking every triangle

#### Per-Frame Collision Test

**When:** Every frame (60fps typical)

**File:** [useCharacter.ts:239-257](virtual-core/src/virtual/character/useCharacter.ts#L239-L257)

```typescript
// Test capsule against octree
world_capsuleIntersect_result_ref.current =
  worldOctree_ref.current.capsuleIntersect(playerCollider_ref.current);

// Check if on floor
playerOnFloor_ref.current =
  (world_capsuleIntersect_result_ref.current?.normal?.y || 0) > 0;

// If collision detected
if (world_capsuleIntersect_result_ref.current) {
  // If NOT on floor (wall collision)
  if (!playerOnFloor_ref.current) {
    // Remove velocity component perpendicular to wall
    playerVelocity_ref.current.addScaledVector(
      world_capsuleIntersect_result_ref.current.normal,
      -world_capsuleIntersect_result_ref.current.normal.dot(
        playerVelocity_ref.current
      )
    );
  }

  // Push capsule out of collision depth
  playerCollider_ref.current.translate(
    world_capsuleIntersect_result_ref.current.normal.multiplyScalar(
      world_capsuleIntersect_result_ref.current.depth
    )
  );
}
```

---

## Physics System

### Gravity

**File:** [useCharacter.ts:18, 229](virtual-core/src/virtual/character/useCharacter.ts#L18-L229)

```typescript
const GRAVITY = 30; // units/second²

// Applied only when NOT on floor
if (!playerOnFloor_ref.current) {
  playerVelocity_ref.current.y -= GRAVITY * delta;
}
```

**Behavior:**
- Player falls at 30 units/sec² when airborne
- Disabled on floor contact to prevent sinking

### Velocity Dampening

**File:** [useCharacter.ts:227-234](virtual-core/src/virtual/character/useCharacter.ts#L227-L234)

```typescript
damping_ref.current = Math.exp(-4 * delta) - 1;
playerVelocity_ref.current.addScaledVector(
  playerVelocity_ref.current,
  damping_ref.current
);
```

**Effect:** Natural friction/air resistance decelerates player over time

### Player Movement

**File:** [useCharacter.ts:206-225](virtual-core/src/virtual/character/useCharacter.ts#L206-L225)

**Speed Calculation:**
```typescript
const speedMultiplier = 2 + (cameraControls.current.speed || 0) * 20;
// Results in 2-22 units/sec movement speed
```

**Input Handling:**
- Forward/backward: Apply velocity along camera forward direction
- Left/right: Apply velocity perpendicular to camera direction
- All velocities accumulated, then damped, then collided

---

## Collision Response System

### Wall Collision

When player's capsule intersects a **non-floor surface** (wall):

1. **Normal Detection:** Collision normal points away from wall
2. **Velocity Projection:** Remove velocity component pushing into wall
3. **Position Adjustment:** Translate capsule backward (out of wall)
4. **Result:** Player slides along wall instead of penetrating

**Mathematical Formula:**

```
velocity_parallel = velocity - (velocity · normal) * normal
```

This keeps movement perpendicular to wall intact while blocking movement through wall.

### Floor Collision

When player's capsule intersects a **floor surface** (normal.y > 0):

1. **Floor Contact Detected:** Set `playerOnFloor_ref.current = true`
2. **Gravity Disabled:** Stop downward acceleration
3. **Position Adjustment:** Push capsule up to surface
4. **Movement:** Horizontal velocity maintained, allows sliding on floor

### Out-of-Bounds Fallback

**File:** [useCharacter.ts:125-133](virtual-core/src/virtual/character/useCharacter.ts#L125-L133)

```typescript
if (camera.position.y <= -5 && !disableAutoTeleport.current) {
  // Reset to spawn position
  playerCollider_ref.current.start.set(0, 0.35, 0);
  playerCollider_ref.current.end.set(0, 1.45, 0);
  playerCollider_ref.current.radius = 0.35;
  camera.position.copy(playerCollider_ref.current.end);
}
```

**Safety:** If player falls below Y=-5, teleports back to spawn

---

## Multi-Floor System

### Floor Switching (Stairs/Elevators)

**File:** [useCharacter.ts:140-145](virtual-core/src/virtual/character/useCharacter.ts#L140-L145)

```typescript
window.addEventListener("message", (event) => {
  if (event.data.type === "switch_floor") {
    floor.current = event.data.data;
    setCurrentFloorToCookie(floor.current);
    teleportUser(true);
  }
});
```

**Mechanism:**
- Web app sends `switch_floor` message when player uses stairs
- Player teleports to new floor's spawn position
- All collision geometry remains static—octree doesn't change
- Collision detection continuous across floor transitions

### Collision Geometry Per Floor

**Important:** Octree contains collision geometry for **ALL floors simultaneously**

**Why This Works:**
- Collision geometry includes vertical walls between floors
- Floors are at different Y-levels (floor spacing ~5 units)
- Player can only physically reach one floor at a time
- Geometry of distant floors acts as impassable boundary

**Example:**
- Floor 1 geometry: Y ∈ [-4, 1.5]
- Floor 2 geometry: Y ∈ [1.5, 6.5]
- Player at floor 1 cannot walk through ceiling (floor 2 walls block)

---

## Data Flow Summary

```
1. LOAD PHASE
   └─ GLB wireframe model (raw geometry)
      └─ Parse scene graph
         └─ Build Octree spatial index
            └─ Collision system ready

2. RUNTIME PHASE (every frame)
   └─ Update player input → playerVelocity
      └─ Apply gravity (if airborne)
         └─ Apply damping (friction)
            └─ Translate capsule by velocity*delta
               └─ Test capsule against octree
                  └─ Collision detected?
                     ├─ YES: Check collision normal
                     │  ├─ Floor (normal.y > 0)?
                     │  │  └─ Stop gravity, keep horizontal velocity
                     │  └─ Wall (normal.y ≤ 0)?
                     │     └─ Stop perpendicular velocity, slide along wall
                     │  └─ Push capsule out by collision depth
                     └─ NO: No collision, continue movement
                        └─ Copy capsule position to camera (player view)
```

---

## Performance Optimization

### Octree Benefits

1. **Spatial Partitioning:** Avoids testing all triangles every frame
2. **Hierarchical:** Each level halves search space
3. **Three.js Native:** Optimized C++ implementation
4. **Static Geometry:** Octree built once, reused indefinitely

### Capsule vs AABB

| Aspect | Capsule | AABB |
|--------|---------|------|
| Edge handling | Smooth sliding | Jarring stops |
| Accuracy | Better for humanoid | Overly conservative |
| Complexity | Slightly higher | Lower |
| Frame time | Acceptable | Faster, less accurate |

---

## Wireframe to Physical Space

### The Connection

**Wireframe Role:**
- Visual representation of structure
- Source of ALL collision geometry
- No additional collision mesh needed

**Physical Interpretation:**
- Every triangle in wireframe = potential collision
- Solid surfaces (walls, floors) = dense triangle areas
- Thin edges/outlines = minimal collision (player slides through)

**Practical Result:**
- Wireframe visually represents layout
- Same geometry enforces physical boundaries
- Single source of truth for both rendering and physics

---

## Configuration & Customization

### Tweaking Physics

**File:** [useCharacter.ts:18](virtual-core/src/virtual/character/useCharacter.ts#L18)

```typescript
const GRAVITY = 30;  // Adjust fall speed
```

**Capsule Size:** [useCharacter.ts:35-36](virtual-core/src/virtual/character/useCharacter.ts#L35-L36)

```typescript
new Capsule(
  new Vector3(x, 0.35, z),    // Bottom (0.35m above ground)
  new Vector3(x, 1.45, z),    // Top (1.45m height)
  0.35                        // Radius (0.35m = ~1.4m shoulder width)
)
```

### Changing Floor Ranges

**File:** [findFloorBasedOnY.ts](virtual-core/src/virtual/utility/findFloorBasedOnY.ts)

Update Y-coordinate ranges to adjust floor boundaries.

---

## Debugging

### Verify Collision Geometry

1. Load wireframe model in Three.js inspector
2. Check scene graph for all mesh objects
3. Confirm geometries are not hidden/invisible
4. Check material `visible` property is `true`

### Test Octree

```typescript
// Log octree debug info
console.log(worldOctree_ref.current);
```

### Player Position Tracking

```typescript
// Log collision test results
console.log(world_capsuleIntersect_result_ref.current);
// - normal: Vector3 (points away from surface)
// - depth: number (penetration distance)
```

---

## Key Takeaways

1. **Wireframe = Physics**: No separate collision mesh; geometry parsed from GLB directly
2. **Octree + Capsule**: Efficient spatial collision detection every frame
3. **Normal Vector**: Distinguishes floors (normal.y > 0) from walls (normal.y ≤ 0)
4. **Velocity Projection**: Sliding behavior via normal-perpendicular movement
5. **Multi-Floor**: Single octree, Y-coordinate based floor detection
6. **Fallback Safety**: Auto-teleport if player falls out of bounds

---

## Related Files

- [useCharacter.ts](virtual-core/src/virtual/character/useCharacter.ts) - Main collision engine
- [Character.desktop.tsx](virtual-core/src/virtual/character/desktop/Character.desktop.tsx) - Model loading
- [findFloorBasedOnY.ts](virtual-core/src/virtual/utility/findFloorBasedOnY.ts) - Floor detection
- [LOCAL_3D_FILE_LOADING.md](arch-docs/LOCAL_3D_FILE_LOADING.md) - Model loading architecture
