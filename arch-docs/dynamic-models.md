# Dynamic GLB Model Loading

## Overview

GLB files are loaded dynamically via URL parameters instead of hardcoded in demo scripts. Models are centralized in `public/models/` with a whitelist in `models-config.ts`.

## Architecture

### File Structure

```
public/models/
├── earrings/
│   └── default.glb
├── necklace/
│   ├── black-panther.glb
│   └── native-american.glb
├── rings/
│   └── default.glb
└── watch/
    └── default.glb
```

### How It Works

```
User visits: /vto/earrings?model=default
    ↓
Route handler [category]/route.ts
    ↓
1. Parse URL param: model = "default"
2. Validate against whitelist
3. Get model path: /models/earrings/default.glb
4. Inject into HTML: window.VTO_MODEL_URL = "/models/earrings/default.glb"
5. Serve HTML with injected script
    ↓
Browser loads HTML
    ↓
Demo main.js reads: window.VTO_MODEL_URL || 'assets/fallback.glb'
    ↓
GLTF loader loads: /models/earrings/default.glb
```

## Usage

### URL Patterns

**Default model (no param):**
```
/vto/earrings
/vto/rings
/vto/watch
```

**Specific model:**
```
/vto/necklace?model=black-panther
/vto/necklace?model=native-american
```

**Invalid model (returns 400):**
```
/vto/earrings?model=invalid  → "Invalid model name"
```

## Code Examples

### 1. Route Handler (`app/vto/[category]/route.ts`)

```typescript
import { getModelPath, Category } from '../models-config';

export async function GET(request, { params }) {
  const { category } = await params;

  // Parse URL param
  const modelName = request.nextUrl.searchParams.get('model') || undefined;
  const modelPath = getModelPath(category as Category, modelName);

  // Validate
  if (modelName && !modelPath) {
    return new NextResponse('Invalid model name', { status: 400 });
  }

  // Read HTML
  let htmlContent = await readFile(htmlPath, 'utf-8');

  // Inject model URL
  if (modelPath) {
    const modelScript = `<script>window.VTO_MODEL_URL="${modelPath}";</script>`;
    htmlContent = htmlContent.replace('</head>', `${modelScript}\n</head>`);
  }

  return new NextResponse(htmlContent, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### 2. Models Config (`app/vto/models-config.ts`)

```typescript
export const MODELS_CONFIG = {
  earrings: {
    default: '/models/earrings/default.glb',
  },
  necklace: {
    'black-panther': '/models/necklace/black-panther.glb',
    'native-american': '/models/necklace/native-american.glb',
  },
  rings: {
    default: '/models/rings/default.glb',
  },
  watch: {
    default: '/models/watch/default.glb',
  },
};

export function getModelPath(category, modelName) {
  const categoryModels = MODELS_CONFIG[category];
  if (!categoryModels) return null;

  if (!modelName) {
    return categoryModels['default'] || Object.values(categoryModels)[0];
  }

  return categoryModels[modelName] || null;
}
```

### 3. Demo Script Update (any main.js)

**Before:**
```javascript
const _settings = {
  GLTFModelURL: 'assets/earringsSimple.glb',
};
```

**After:**
```javascript
const _settings = {
  GLTFModelURL: window.VTO_MODEL_URL || 'assets/earringsSimple.glb',
};
```

Only one line changed! Falls back to original path if `window.VTO_MODEL_URL` undefined.

### 4. Demo Script Examples

**Earrings (main.js):**
```javascript
const _settings = {
  GLTFModelURL: window.VTO_MODEL_URL || 'assets/earringsSimple.glb',
  // ... rest of settings
};
```

**Necklace (main.js):**
```javascript
const settings = {
  occluderURL: "assets/models3D/occluder.glb",
  modelURL: window.VTO_MODEL_URL || "assets/models3D/blackPanther.glb",
  // ... rest of settings
};
```

**Watch (main.js):**
```javascript
const _settings = {
  modelURL: window.VTO_MODEL_URL || 'assets/watchCasio.glb',
  // ... rest of settings
};
```

## Adding New Models

### Step 1: Add GLB File
```bash
cp my-model.glb public/models/earrings/my-model.glb
```

### Step 2: Update Config
```typescript
// app/vto/models-config.ts
export const MODELS_CONFIG = {
  earrings: {
    default: '/models/earrings/default.glb',
    'my-model': '/models/earrings/my-model.glb',  // ← Add here
  },
  // ...
};
```

### Step 3: Use
```
/vto/earrings?model=my-model
```

## Security

✅ **Whitelist validation** - Only models in `MODELS_CONFIG` allowed
✅ **No path traversal** - Can't use `..` or absolute paths
✅ **Type-safe** - TypeScript prevents typos in model names

Invalid requests:
```
/vto/earrings?model=../../../etc/passwd  → 400
/vto/earrings?model=../../.env           → 400
/vto/earrings?model=invalid              → 400
```

## Common Tasks

### Get Available Models for Category

```typescript
import { getAvailableModels } from '@/app/vto/models-config';

const necklaceModels = getAvailableModels('necklace');
// ['black-panther', 'native-american']
```

### Programmatically Generate URLs

```typescript
const baseUrl = 'http://localhost:3000/vto';

// Default
const url1 = `${baseUrl}/earrings`;

// Specific model
const url2 = `${baseUrl}/necklace?model=black-panther`;
```

### Fallback Handling

If `window.VTO_MODEL_URL` not set:
- Demo uses original hardcoded path
- Works with or without dynamic loading
- Safe for backward compatibility

```javascript
// This works even if window.VTO_MODEL_URL is undefined
modelURL: window.VTO_MODEL_URL || 'assets/fallback.glb'
```

## Advantages

✅ **Centralized models** - Single source of truth
✅ **Easy to add** - One file, one URL pattern
✅ **Secure** - Whitelist prevents abuse
✅ **Backward compatible** - Demos work without dynamic loading
✅ **SEO friendly** - URL params are shareable
✅ **Analytics ready** - Track which models are used

## Limitations

❌ **No dynamic model discovery** - Must update config manually
❌ **Duplicates Three.js** - Models exist independently per demo
❌ **Large initial download** - 4.2MB+ for hand tracking NNs

## Future Improvements

- API endpoint to list available models
- Admin UI to upload new models
- Model preview/thumbnails
- Usage analytics
- CDN caching strategy
