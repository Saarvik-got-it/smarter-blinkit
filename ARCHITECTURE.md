# ARCHITECTURE.md — Smarter BlinkIt

> Technical architecture reference. Describes system design decisions, data flows, and component interactions.

---

## System Overview

```
Browser (Next.js 16 App Router)
    │
    ├─ React Context (useApp)  ──────── Auth, Cart, API, Toasts
    │
    ├─ Pages (app/)            ──────── shop, ai-agent, dashboard, storeboard, money-map
    │
    └─ Components              ──────── CartSidebar, DeliveryRouteMap, Navbar, MapPicker, ...
         │
         ▼ HTTP/REST (axios)
Express 5 Backend (port 5000)
    │
    ├─ Routes (routes/)        ──────── auth, products, shops, orders, payments, ai, cart, admin
    │
    ├─ Middleware              ──────── JWT protect, requireRole
    │
    └─ Services
         ├─ aiRouter.js        ──────── Multi-model Gemini fallback
         ├─ neo4j.js           ──────── Graph DB + vector search + local cosine fallback
         ├─ smartCartService.js ─────── Multi-criteria shop selection + route coordinates
         ├─ cartSplitter.js    ──────── Group items by shop
         ├─ cartIntelligenceService.js  Cross-sells + replacements
         └─ userReportService.js ─────── Excel reports

External Services
    ├─ MongoDB Atlas            ──────── Primary DB + vector fallback storage
    ├─ Neo4j AuraDB             ──────── SIMILAR_TO, BOUGHT_WITH, vector index
    ├─ Google Gemini API        ──────── Text generation + 3072D embeddings
    ├─ Hugging Face             ──────── NLP fallback (Qwen2.5-72B)
    ├─ Nominatim                ──────── Reverse / forward geocoding
    ├─ Stripe                   ──────── Payment processing
    └─ Socket.io                ──────── Real-time storeboard events
```

---

## 1. AI System Architecture

### 1.1 Multi-Model Fallback Router

All text-generation calls go through `backend/services/aiRouter.js`.

```
Request → aiRouter.generateText(parts)
    │
    ├─ Try model[0] from AI_MODELS list
    │       ├─ Success → return { text, modelUsed }
    │       └─ Recoverable error (429, quota, 503) → try next model
    │
    ├─ Try model[1] ...
    │       ├─ Success → cache as lastSuccessfulModel → return { text, modelUsed }
    │       └─ Recoverable → try next
    │
    └─ All models exhausted → throw last error
```

**Model priority list** (configured in `backend/config/aiModels.js`):
1. `gemini-2.5-flash` — Primary
2. `gemini-2.0-flash` — First fallback
3. `gemini-2.0-flash-lite` — Lighter fallback
4. `gemini-1.5-flash` — Older stable

**Recoverable error detection:**
- HTTP 429 (Too Many Requests)
- HTTP 503 / 502 (Service unavailable)
- HTTP 404 / "model not found"
- Message patterns: `quota`, `rate limit`, `resource_exhausted`, `overloaded`

**Performance optimisation:** The module caches `lastSuccessfulModel`. Future requests start from the cached model, skipping failed ones.

**Logging example:**
```
[AI Router] Attempting model: gemini-2.5-flash
[AI Router] Rate limit hit → switching model. Failed: gemini-2.5-flash | Reason: 429 ...
[AI Router] Attempting model: gemini-2.0-flash
[AI Router] Using fallback model: gemini-2.0-flash — caching as preferred
```

### 1.2 AI Endpoint Fallback Chain

Beyond the model router, each endpoint has its own fallback:

```
/api/ai/recipe-agent
    1. aiRouter.generateText()     → structured JSON (ingredients)
    2. Hugging Face Qwen2.5-72B   → structured JSON fallback
    3. Regex keyword extraction   → simple search keywords

/api/ai/intent-search
    1. aiRouter.generateText()     → expanded keyword list
    2. Hugging Face Qwen2.5-72B   → keyword list fallback
    3. Split query on whitespace   → raw tokens
```

### 1.3 Embedding Generation

Embeddings bypass `aiRouter` (use the original model always):
```
genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    └─ 3072-dimensional float vector
    └─ On failure → return null → Neo4j step skipped → regex fallback
```

---

## 2. Smart Delivery Route System

### 2.1 Data Flow

```
User opens Cart
    │
    │ POST /api/cart/analyze
    ▼
smartCartService.analyzeCart(items, userCoords)
    │
    ├─ For each cart item: find best shop (distance → rating → price)
    ├─ Enrich items with shopCoordinates, shopAddress, deliveryMins
    ├─ Build shopLocMap { shopId → { coordinates, address } }
    ├─ cartSplitter(enrichedItems) → shopGroups
    └─ Attach shopLocation to each group
    │
    │ Response includes shopGroups[].shopLocation.coordinates ([lng, lat])
    ▼
CartSidebar (frontend)
    │
    └─ <DeliveryRouteMap cartAnalysis={...} userCoords={[lng,lat]} />
         │
         ├─ nearestNeighbour(userCoords, shopsWithCoords)
         │       Greedy: start from user → find closest shop → repeat
         │
         ├─ Route Summary Panel (always visible)
         │       ∙ Horizontal flow bar: [ Shop 1 ] → [ Shop 2 ] → [ 🏠 Home ]
         │       ∙ Stop list with item counts and stop time estimates
         │       ∙ Total ETA: max(deliveryEstimateMins) + (stops-1)×2 min
         │
         └─ Interactive Leaflet Map (toggled via "View Map" button)
                 ∙ Dark tile layer: CartoDB dark_matter
                 ∙ Store markers (🏪): green border, numbered badge
                 ∙ Home marker (🏠): blue border
                 ∙ Store→Store polylines: #00d26a dashed
                 ∙ Last-mile polyline: #4da6ff dashed
                 ∙ Hover tooltips: store name, item count, stop time
                 ∙ Auto-fit bounds: all markers visible on open
```

### 2.2 Route Optimisation Algorithm

Nearest-neighbour heuristic (O(n²), sufficient for ≤10 shops):

```typescript
function nearestNeighbour(start: [lng, lat], shops: Shop[]): Shop[] {
    let current = start;
    const remaining = [...shops];
    const ordered = [];
    while (remaining.length > 0) {
        // Find closest unvisited shop by Haversine distance
        const nearest = remaining.reduce(minByDist, current);
        ordered.push(nearest);
        current = nearest.shopLocation.coordinates;
        remove nearest from remaining;
    }
    return ordered; // → append User Home as final stop
}
```

### 2.3 ETA Estimation

```
totalEta = max(shop.deliveryEstimateMins across all shops)
         + (numShops - 1) × 2   ← 2 min stop per additional shop

displayEta = `${totalEta}–${totalEta + 5} minutes`
```

Per-shop `deliveryEstimateMins` comes from `smartCartService`:
```
deliveryMins = 5 + Math.round(distance_km × 3)
```

---

## 3. Cart Intelligence Pipeline

```
Raw CartItem[]
    │
    ▼
smartCartService.analyzeCart(items, userCoords)
    ├─ Product.find() → populate shopId (name, location, rating)
    ├─ Per-item: sort alternatives by distance → rating → price
    ├─ enrichedItems[] with best shop per item + shopCoordinates
    ├─ cartSplitter() → shopGroups by shopId
    ├─ Attach deliveryEstimateMins + shopLocation to each group
    └─ Subtotal / delivery fee / platform fee
    │
    ▼
cartIntelligenceService
    ├─ getCrossSells(productIds) → Neo4j BOUGHT_WITH → MongoDB lookup
    └─ getReplacements(productId) → Neo4j SIMILAR_TO → MongoDB lookup
    │
    ▼
CartSidebar renders:
    ├─ <DeliveryRouteMap>        — logistics preview
    ├─ Unavailable items         — out-of-stock with replacements
    ├─ Shop groups               — items grouped by store
    └─ Cross-sell row            — "People also bought"
```

---

## 4. Location & Geospatial

- All coordinates stored as GeoJSON `[lng, lat]` (MongoDB convention).
- Leaflet uses `[lat, lng]` — conversion happens in `DeliveryRouteMap.tsx` before passing to map component.
- Proximity queries use MongoDB `$near` with `2dsphere` index.
- Distance calculations use Haversine formula (both backend `getDistance()` and frontend `haversine()`).
- Geocoding: Nominatim forward/reverse (no API key, rate-limited — 1 req/s).

---

## 5. Authentication Architecture

```
Registration → POST /api/auth/register
            → bcrypt hash password
            → save User (role: buyer|seller)
            → return JWT (7d expiry)

Login        → POST /api/auth/login
            → bcrypt compare
            → return JWT

Face Login   → Browser: face-api.js detects 128-dim descriptor
            → POST /api/auth/face-login { descriptor: float[] }
            → Backend: euclidean distance < 0.55 → match
            → return JWT

protect MW   → Authorization: Bearer <token>
            → jwt.verify → req.user
            → 401 if invalid/missing

Admin        → x-admin-secret header (not JWT)
            → process.env.ADMIN_SECRET || 'smarter-dev-123'
```

---

## 6. Payment Flow

```
Buyer → Checkout
    │
    ├─ COD path:
    │   POST /orders { paymentMode: 'cod', paymentId: 'cod_<ts>' }
    │
    └─ Card path:
        POST /payments/create-intent { amount }
            ├─ Stripe mode: create PaymentIntent → return clientSecret
            └─ Mock mode: return { mode: 'mock', paymentIntentId }
        
        Stripe.confirmCardPayment(clientSecret, { card })
            └─ success: POST /payments/verify { paymentIntentId }
                        POST /orders { paymentId, paymentMode: 'stripe' }
        
        Mock: skip Stripe, POST /orders directly with mock ID
```

---

## 7. Real-Time Architecture

```
Socket.io server (attached to Express HTTP server)
    │
    ├─ Namespace: /storeboard (default namespace)
    │
    ├─ Events emitted by backend:
    │   'newOrder'  → { orderId, shopId, totalAmount, itemCount, buyerCity }
    │
    └─ Frontend (storeboard/page.tsx):
        socket.on('newOrder') → update live feed + stats
```

---

## 8. Neo4j Graph Schema

```
Nodes:
    Product { id: ObjectId.toString(), name, price }

Relationships:
    (Product)-[:BOUGHT_WITH { weight: int }]->(Product)
        Created on order: for each pair (i,j) in order items
        Weight incremented on repeat pairs

    (Product)-[:SIMILAR_TO]->(Product)
        Created when product added/updated (shared barcode, category)

Vector Index:
    product_embeddings: 3072-dimensional float32
    Created from Gemini gemini-embedding-001
    Query: cosine similarity, topK=20, default threshold 0.5
```

---

## 9. Frontend Rendering Patterns

| Pattern | Where Used |
|---|---|
| `dynamic(() => import(...), { ssr: false })` | MapPickerBase, DeliveryRouteMapBase, MoneyMap — Leaflet requires DOM |
| `'use client'` on every page/component | App Router — all interactive, no RSC |
| `framer-motion` variants | Page transitions, product cards, hero sections |
| Inline styles + CSS variables | Components — no CSS modules. Variables: `--bg-primary`, `--accent`, `--border`, etc. |
| `useCallback` for stable references | triggerCartFly, triggerAddPulse, doSearch |
| `useMemo` for derived data | orderedShops, mapStops, totalEta in DeliveryRouteMap |

---

## 10. Future Extension Points

The Smart Delivery Route system is designed for easy extension:

| Extension | Where to implement |
|---|---|
| Live rider tracking | Add `riderLocation` field to Order model; emit via Socket.io; update `DeliveryRouteMapBase` markers in real-time |
| OSRM road-accurate routing | Replace straight-line polylines with OSRM `/route` API in `DeliveryRouteMapBase` |
| Traffic-based ETA | Integrate HERE Maps / Google Maps Distance Matrix in `smartCartService.calculateETA()` |
| Multi-rider dispatch | Extend `cartSplitter` to assign rider IDs; render separate polylines per rider |
| Dynamic rerouting | Web Worker running nearest-neighbour on each rider location update |
