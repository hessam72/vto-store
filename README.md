# Virtual Try-On WebAR
<!-- pkill -f "next dev" -->
Next.js app serving WebAR.rocks jewelry try-on demos.

## Features

- **Earrings** - Face tracking (NN_EARS_4)
- **Necklace** - Neck tracking (NN_NECKLACE_9)
- **Rings** - Wrist tracking (NN_WRISTBACK_45)
- **Watch** - Wrist tracking (NN_WRISTBACK_45)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Requirements:**
- Webcam
- Modern browser (Chrome, Firefox, Safari, Edge)
- HTTPS or localhost

## Architecture

**Homepage:** Category selector (Tailwind, dark mode)

**VTO Routes:**
- `/vto/earrings` → Vanilla WebAR demo
- `/vto/necklace` → Vanilla WebAR demo
- `/vto/rings` → Vanilla WebAR demo
- `/vto/watch` → Vanilla WebAR demo

**Implementation:** Route handler serves static HTML from `public/vto/` with `<base>` tag injection.

See [arch-docs/implementation.md](arch-docs/implementation.md) for details.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS 4**
- **WebAR.rocks** (face + hand tracking)
- **Three.js r136** (3D rendering)

## Project Structure

```
app/
├── page.tsx                    # Homepage
├── layout.tsx                  # Root layout
└── vto/[category]/route.ts     # Serves HTML from public/

public/vto/
├── earrings/                   # Standalone demo
├── necklace/                   # Standalone demo
├── rings/                      # Standalone demo
└── watch/                      # Standalone demo
```

## Adding New Demos

1. Add demo to `public/vto/glasses/`
2. Update `CATEGORIES` in `app/page.tsx`
3. Update `VALID_CATEGORIES` in `app/vto/[category]/route.ts`

## Deployment

**Vercel:**
```bash
vercel
```

**Requirements:**
- HTTPS (camera permissions)
- Node.js 18+
