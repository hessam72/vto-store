# Product Click & Popup System

## Overview

Interactive 3D jewelry store with click-to-interact product detection. When users click 3D objects in the store, the system identifies if they're products and displays a Farsi-language popup with product details (price, weight, category) and a Virtual Try-On (VTO) button.

## Architecture

### Components

1. **ProductInteraction** (`components/store/ProductInteraction.tsx`)
   - Runs raycasting on canvas click
   - Traverses object hierarchy to match against product database
   - Emits selected product data via callback

2. **ProductPopup** (`components/store/ProductPopup.tsx`)
   - Modal overlay displaying product details in Farsi (RTL)
   - Shows: name, price (تومان), weight (گرم), category
   - "امتحان مجازی" button links to `/vto/{category}?model={variant}`
   - Close on ESC key or background click

3. **Scene Integration** (`components/store/Scene.tsx`)
   - Manages `selectedProduct` state
   - Renders ProductInteraction & ProductPopup conditionally after models load
   - Wires product click callbacks

### Data Flow

```
User Click on 3D Object
    ↓
ProductInteraction (Raycasting)
    ↓
Match object name against products.json keys
    ↓
If match found → emit ProductData
    ↓
Scene receives ProductData → setState(selectedProduct)
    ↓
ProductPopup renders with selected product
```

## Product Data Structure

**File:** `/public/config/products.json`

```json
{
  "earring-gold": {
    "category": "earrings",
    "variant": "default",
    "price": "2,500,000",
    "weight": "3.2",
    "name_fa": "گوشواره طلا"
  },
  "necklace-black-panther": {
    "category": "necklace",
    "variant": "black-panther",
    "price": "4,200,000",
    "weight": "15.5",
    "name_fa": "گردنبند پلنگ سیاه"
  }
}
```

### Schema

| Field | Type | Purpose |
|-------|------|---------|
| `category` | string | Product type: `earrings`, `necklace`, `rings`, `watch` |
| `variant` | string | VTO model variant or "default" |
| `price` | string | Formatted price (e.g., "2,500,000") |
| `weight` | string | Weight in grams |
| `name_fa` | string | Product name in Farsi |

## How It Works

### 1. Object Detection

Objects are matched by **name matching**:
- ProductInteraction checks if mesh name (lowercase) includes product key
- Searches object hierarchy (traverses parent objects)
- First match wins

**Example matches:**
- GLTF mesh named `"earring_gold_001"` → matches key `"earring-gold"`
- GLTF parent named `"Box_necklace"` → searches parent, finds `"necklace-black-panther"` if available

### 2. Click Handling

1. User clicks canvas
2. Raycaster casts ray from camera through click point
3. Tests intersection with all scene objects
4. For first intersection, traverses up object hierarchy
5. Compares object names against all product keys
6. If match found, fires `onProductClick()` callback

### 3. Popup Display

1. Scene receives product data → updates state
2. ProductPopup component mounts with product
3. Displays Farsi text using Vazirmatn font
4. Shows price/weight formatted
5. VTO button constructs URL: `/vto/{category}?model={variant}`

**URL Examples:**
- Earring (default): `/vto/earrings`
- Black Panther necklace: `/vto/necklace?model=black-panther`
- Ring (default): `/vto/rings`

### 4. VTO Navigation

Button links to existing VTO route which:
- Serves WebAR face/hand tracking interface
- Loads product model based on category + variant
- Allows user to virtually try on product

## Farsi Support

### Font

**Vazirmatn** (Google Fonts) configured in:
- `app/layout.tsx`: Imported with arabic/latin subsets
- `app/globals.css`: Registered as `--font-vazir`
- Components: Use `font-[family-name:var(--font-vazir)]`

### RTL Layout

ProductPopup sets `dir="rtl"` on container for proper text direction.

## Setup Instructions

### 1. Name Your GLTF Objects

In Blender/3D modeling software, name objects with product keywords:
```
earring-gold_001
earring-silver_002
necklace-black-panther
necklace-native-american
ring-diamond
watch-luxury
```

### 2. Add to products.json

For each clickable object, add an entry:
```json
{
  "product-key": {
    "category": "category_name",
    "variant": "model_variant",
    "price": "formatted_price",
    "weight": "weight_grams",
    "name_fa": "فارسی نام"
  }
}
```

### 3. Verify VTO Routes Exist

Ensure VTO categories exist in `/app/vto/`:
- `/app/vto/earrings/route.ts`
- `/app/vto/necklace/route.ts`
- `/app/vto/rings/route.ts`
- `/app/vto/watch/route.ts`

## Customization

### Change Popup Colors

Edit `ProductPopup.tsx` Tailwind classes:
- `from-purple-600 to-pink-600` → VTO button gradient
- `bg-white` → modal background
- `rounded-2xl` → modal border radius

### Change Product Category List

Extend `products.json` with new categories and update ProductPopup category translation logic.

### Change Click Behavior

**Custom product detection:** Modify ProductInteraction matching logic in `useEffect` click handler

**Alternative detection methods:**
- Check mesh `userData.isProduct`
- Parse GLTF hierarchy metadata
- Use custom naming convention

### Add More Product Details

Extend ProductData schema:
- Add `color`, `material`, `dimensions`
- Update ProductPopup UI to display new fields

## Performance

- **Raycasting:** Runs only on click (not continuous)
- **Font:** Vazirmatn uses `display: 'swap'` for fast text rendering
- **Popup:** Renders conditionally (null when no product selected)
- **Product database:** Loaded once on ProductInteraction mount

## Integration Points

**Depends on:**
- Three.js/R3F canvas for raycasting
- GLTF models loaded via ModelLoader
- VTO routes in `/app/vto/`

**Used by:**
- Scene component
- VTO product pages

## Future Enhancements

- Product history/recently viewed
- Add to cart from popup
- Product reviews/ratings display
- Multiple clickable zones per product
- Analytics tracking for product clicks
