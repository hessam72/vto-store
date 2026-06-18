# Implementation Architecture

## Overview

Next.js app serving vanilla HTML/JS WebAR demos as static content via route handlers.

**Key principle:** Minimal-demos run **unchanged** — no conversion to React components.

---

## Project Structure

```
vot-webar-nextjs/
├── app/
│   ├── page.tsx                    # Homepage: category selector
│   ├── layout.tsx                  # Root layout (Geist fonts, Tailwind)
│   ├── globals.css                 # Tailwind + CSS variables
│   └── vto/[category]/route.ts     # Route handler serving HTML
│
└── public/vto/
    ├── earrings/                   # Copied from minimal-demos/earrings/
    │   ├── index.html
    │   ├── main.js
    │   ├── dist/                   # WebARRocksFace.js
    │   ├── helpers/                # WebAR helpers
    │   ├── libs/three/v136/
    │   ├── neuralNets/
    │   └── assets/
    ├── necklace/                   # Copied from minimal-demos/necklace/
    ├── rings/                      # Copied from minimal-demos/ring/
    └── watch/                      # Copied from minimal-demos/watch/
```

---

## Routing Flow

### 1. Homepage (`/`)
- Renders 4 category cards: Necklace, Earrings, Rings, Watch
- Links to `/vto/[category]`

### 2. VTO Route (`/vto/earrings`, `/vto/necklace`, etc.)
**Handler:** `app/vto/[category]/route.ts`

```ts
export async function GET(request, { params }) {
  const { category } = await params;

  // Read HTML from public/vto/{category}/index.html
  const htmlPath = join(process.cwd(), 'public', 'vto', category, 'index.html');
  let htmlContent = await readFile(htmlPath, 'utf-8');

  // Inject <base> tag for relative paths
  const baseTag = `<base href="/vto/${category}/">`;
  htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`);

  return new NextResponse(htmlContent, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

**Why `<base>` tag?**
- Minimal-demos use relative paths: `libs/three/v136/build/three.js`
- Without `<base>`, browser resolves as `/vto/libs/...` → 404
- With `<base href="/vto/earrings/">`, resolves as `/vto/earrings/libs/...` ✅

---

## Tech Stack

### Next.js App
- **Next.js 16.2.9** (App Router)
- **React 19.2.4**
- **Tailwind CSS 4**
- **TypeScript 5**

### Minimal-Demos (Vanilla JS)
- **WebAR.rocks.face** - Face/neck tracking (earrings, necklace)
- **WebAR.rocks.hand** - Wrist tracking (rings, watch)
- **Three.js r136** - 3D rendering
- **Neural Networks:**
  - `NN_EARS_4` (48KB) - Earring landmarks
  - `NN_NECKLACE_9` - Neck/torso landmarks
  - `NN_WRISTBACK_45` (4.2MB) - Wrist landmarks (watch, ring)

---

## How It Works

### Request Flow

```
User clicks "Earrings"
  ↓
Next.js route: /vto/earrings
  ↓
Route handler reads: public/vto/earrings/index.html
  ↓
Injects: <base href="/vto/earrings/">
  ↓
Returns HTML
  ↓
Browser loads:
  - /vto/earrings/dist/WebARRocksFace.js
  - /vto/earrings/libs/three/v136/build/three.js
  - /vto/earrings/main.js
  - /vto/earrings/assets/*.glb
  ↓
WebAR demo runs (vanilla JS, no React)
```

### Static Asset Serving

Next.js automatically serves `/public` at root:
- `public/vto/earrings/main.js` → `/vto/earrings/main.js`
- Works for all files: `.js`, `.glb`, `.bin`, `.jpg`, etc.

---

## Adding New Demos

1. **Add demo folder:**
   ```bash
   cp -r minimal-demos/glasses public/vto/glasses
   ```

2. **Update homepage:**
   ```ts
   // app/page.tsx
   const CATEGORIES = [
     // ...
     { id: 'glasses', label: 'Glasses' },
   ];
   ```

3. **Update route handler:**
   ```ts
   // app/vto/[category]/route.ts
   const VALID_CATEGORIES = ['earrings', 'necklace', 'rings', 'watch', 'glasses'];
   ```

Done. No React components needed.

---

## Advantages

✅ **Zero conversion effort** - Demos run as-is
✅ **Easy debugging** - Browser DevTools directly inspect vanilla JS
✅ **Fast updates** - Edit `public/vto/*/main.js` → refresh
✅ **Independent demos** - Each has own libs, no version conflicts
✅ **Simple deployment** - Static files + serverless route handlers

---

## Differences from Old Project

**Old project** (`/Users/hesam/Documents/GitHub/vot_virtual_try_on/`):
- React components wrapping WebAR
- `lib/webAR-face.ts`, `lib/webAR-hand.ts`
- Complex script loading logic
- TypeScript abstractions
- Dynamic imports

**This project** (vot-webar-nextjs):
- Vanilla HTML/JS served directly
- No wrapper components
- No TypeScript for demos
- Minimal abstraction (just route handler)
- Simpler, faster

---

## Development

```bash
npm run dev      # Start dev server
```

**Test routes:**
- http://localhost:3000 → Homepage
- http://localhost:3000/vto/earrings → Earrings demo
- http://localhost:3000/vto/necklace → Necklace demo
- http://localhost:3000/vto/rings → Ring demo
- http://localhost:3000/vto/watch → Watch demo

---

## Production Considerations

### Camera Permissions
- Requires **HTTPS** in production
- `localhost` exempt (dev only)

### Bundle Size
- Neural networks: 48KB–4.2MB per demo
- Three.js r136: ~1MB per demo
- **Duplicated across demos** (acceptable tradeoff for independence)

### Optimization Opportunities
- Shared Three.js lib (breaking independence)
- Neural network CDN (requires WebAR.rocks hosting)
- Service worker caching (offline VTO)

**Current approach:** Keep demos fully standalone for simplicity.
