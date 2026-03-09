# AGENT.md — Smarter BlinkIt

## Quick Context

**Project:** Smarter BlinkIt — AI-powered grocery marketplace  
**Repo:** `smarter-blinkit`

**Stack:**
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS (globals.css + inline styles)
- Backend: Node.js, Express 5, Mongoose 9 (MongoDB Atlas)
- Graph DB: Neo4j AuraDB (vector index + relationships)
- AI: Google Gemini (2.0-flash, 2.5-flash, embedding-001), HuggingFace Qwen2.5-72B (fallback)
- Maps: Leaflet.js + react-leaflet + Nominatim (geocoding) + OSRM (routing)
- Payments: Stripe (test mode) + COD + mock fallback
- Real-time: Socket.io
- Auth: JWT + face-api.js (Face ID)
- Barcode: @zxing/browser + OpenFoodFacts API
- Charts: Recharts
- Reports: exceljs

**Key Systems:**
- AI intent search (Gemini → HuggingFace → regex, 3-tier fallback)
- AI recipe agent (natural language → cart items)
- Neo4j graph suggestions (SIMILAR_TO, BOUGHT_WITH, vector semantic search)
- Barcode inventory system (ZXing scanner + OpenFoodFacts external lookup)
- Smart cart splitting (multi-shop, distance-optimized)
- Cart intelligence (cross-sells + replacement suggestions via Neo4j)
- Location system (GeoJSON, MapPicker, Nominatim, PostalPincode API)
- Face ID (face-api.js, browser-side TensorFlow.js)
- Live storeboard (Socket.io real-time events)
- Money map (Leaflet heatmap of order density)
- Light/dark theme (CSS variables, localStorage)

---

## Do NOT Replace

| Technology | Reason |
|---|---|
| **Neo4j AuraDB** | Core graph DB for BOUGHT_WITH, SIMILAR_TO, 3072D vector index |
| **Leaflet.js** | All map features (MapPicker, MoneyMap, delivery routing) |
| **Nominatim** | Free geocoding — forward and reverse |
| **OSRM** | Free vehicle routing for delivery optimization |
| **OpenFoodFacts** | Barcode product lookup (free, no API key) |
| **face-api.js** | Browser-side face recognition (no server-side ML infra) |
| **@zxing/browser** | Cross-platform barcode scanning |
| **Google Gemini API** | Primary AI — intent parsing, recipe extraction, 3072D embeddings |
| **HuggingFace Inference** | AI fallback (Qwen2.5-72B) when Gemini is rate-limited |
| **Stripe** | Payment processing (test mode; real integration ready) |
| **Socket.io** | Real-time storeboard events |
| **MongoDB Atlas** | Primary database + vector fallback storage |

---

## Architecture Decisions

### State Management
- React Context (`useApp()` hook) — no Redux/Zustand. Auth, cart, API instance, and toasts all in one provider.
- Cart persisted to `localStorage('sb_cart')`, token to `localStorage('sb_token')`, theme to `localStorage('sb_theme')`.

### AI Fallback Chain
- All AI endpoints follow: **Gemini → HuggingFace → regex/keyword extraction**.
- Vector search follows: **Neo4j vector index → MongoDB embeddings + local cosine similarity**.
- Product suggestions follow: **Neo4j graph → semantic vector → MongoDB category match**.

### Data Conventions
- Coordinates stored as GeoJSON: `{ type: "Point", coordinates: [lng, lat] }`.
- All geospatial queries use MongoDB `2dsphere` indexes.
- Product embeddings are 3072-dimensional (Gemini `gemini-embedding-001`).

### Auth Architecture
- JWT with configurable expiration (`JWT_EXPIRES_IN`, default 7d).
- `protect` middleware verifies token, `requireRole(...roles)` checks authorization.
- Face ID: 128-dim descriptor, Euclidean distance threshold 0.55.
- Admin: separate `x-admin-secret` header (not JWT).

### Cart & Orders
- Cart splitting groups items by shop with per-shop subtotals.
- Smart cart service picks optimal shop per item: distance (2km threshold) → rating → price.
- Orders store items in both flat `items[]` and grouped `shopGroups[]` (with per-shop status tracking).
- Delivery fee: ₹29/shop if subtotal ≤ ₹500, free above. Platform fee: flat ₹5.

### Styling
- Single `globals.css` (~1,750 lines) with CSS custom properties for theming.
- `framer-motion` powers all page/component animations (installed v11). Use variants from `frontend/lib/animations.ts`.
- `lenis` smooth scroll via `frontend/components/SmoothScroll.tsx` (wrapped in `layout.tsx`).
- `app/template.tsx` handles per-page fade transitions (App Router pattern).
- Key CSS utility classes: `.blob`, `.blob-green/blue/purple`, `.glass-panel`, `.glass-input`, `.ai-thinking-dot`, `.ai-glow-ring`, `.feature-card`, `.feature-icon`, `.btn-glow`, `.gradient-text`, `.skeleton-card`.
- Components use inline styles (no CSS modules, no styled-components).
- Dark theme is default, light via `[data-theme='light']`.

### Seed Data
- 4 sellers/shops across 3 cities (Bengaluru ×2, New Delhi, Mumbai).
- 3 buyer accounts (one per city).
- 126+ products with auto-generated Gemini embeddings.
- Common password: `password123`.

---

## Project Structure (Key Files)

```
smarter-blinkit/
├── AGENT.md                     # THIS FILE — rules & decisions
├── PROGRESS.md                  # Feature progress tracker
├── README.md                    # Full project documentation
├── .env.example                 # Required environment variables
│
├── backend/
│   ├── server.js                # Express entry (MongoDB + Socket.io)
│   ├── seed.js                  # Database seeder (users, shops, products)
│   ├── middleware/auth.js       # JWT protect + requireRole
│   ├── models/                  # User, Product, Shop, Order (Mongoose)
│   ├── routes/                  # auth, products, orders, shops, payments, ai, admin, cart
│   ├── services/
│   │   ├── neo4j.js             # Graph + vector search + fallback engine
│   │   ├── cartSplitter.js      # Pure shop-grouping function
│   │   ├── smartCartService.js  # Multi-criteria shop optimization
│   │   ├── cartIntelligenceService.js  # Cross-sells & replacements
│   │   └── userReportService.js # Excel report generation
│   └── sockets/storeboard.js   # Real-time Socket.io events
│
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout (AppProvider wrapper)
│   │   ├── globals.css          # Design system (~955 lines)
│   │   ├── page.tsx             # Landing page
│   │   ├── login/               # Login + Face ID
│   │   ├── register/            # 3-step wizard (info → map → face)
│   │   ├── dashboard/           # Role-based (BuyerDashboard / SellerDashboard)
│   │   ├── shop/                # Product catalog + search
│   │   │   └── [id]/            # Product detail + Neo4j suggestions
│   │   ├── ai-agent/            # AI Recipe Agent
│   │   ├── storeboard/          # Live Socket.io dashboard
│   │   ├── money-map/           # Leaflet revenue heatmap
│   │   ├── admin/users/         # Admin panel (secret-key auth)
│   │   └── forgot-password/     # Mock password reset
│   ├── components/
│   │   ├── BuyerDashboard.tsx   # Orders, Face ID, address book (~500L)
│   │   ├── SellerDashboard.tsx  # Full seller console, 6 tabs (~1240L)
│   │   ├── CartSidebar.tsx      # Smart cart + Stripe checkout (~500L)
│   │   ├── Navbar.tsx           # Nav + address switcher + theme toggle
│   │   ├── MapPicker.tsx        # SSR-safe Leaflet wrapper
│   │   ├── MapPickerBase.tsx    # Interactive map (search, drag, GPS)
│   │   ├── MoneyMap.tsx         # Heatmap component
│   │   ├── MultiSelectDropdown.tsx  # Reusable multi-select
│   │   ├── FaceLogin.tsx        # Face recognition login
│   │   └── FaceRegister.tsx     # Face enrollment
│   └── lib/context.tsx          # Global state (auth, cart, api, toast)
```

---

## API Endpoints (44 total)

| Route File | Count | Key Endpoints |
|---|---|---|
| auth.js | 12 | register, login, face-login, face-register, me, addresses CRUD, reset-password, delete-account |
| products.js | 10 | search (geo+text), categories, suggestions (3-tier), CRUD, barcode lookup/update, low-stock |
| shops.js | 8 | all, nearby (geo), storeboard, money-map, my, create, update, :id |
| orders.js | 4 | create (split+route+Neo4j), buyer history, seller orders, detail |
| payments.js | 4 | create-intent (Stripe/mock), verify, mock-intent, mock-verify |
| ai.js | 2 | recipe-agent, intent-search |
| admin.js | 3 | users, user-report (Excel), storeboard |
| cart.js | 1 | analyze (smart grouping + cross-sells + replacements) |

---

## Known Issues (Do Not Ignore)

1. **`cartIntelligenceService.js`** calls `neo4jService.read()` — that function does NOT exist in `neo4j.js`. Will throw `TypeError` at runtime.
2. **`smartCartService.js`** imports `neo4jService` but never uses it (dead import).
3. **Password reset** is mock-only — no token verification, no email. Direct password change by email.
4. **Socket.io** has no authentication — any client can join rooms.
5. **Admin routes** use `x-admin-secret` header with hardcoded fallback `'smarter-dev-123'`.
6. **`userReportService`** loads all users/shops/orders into memory at once.
7. **MoneyMap page** (`money-map/page.tsx`) loads Leaflet via script injection instead of npm import.

---

## Environment Variables

Backend `.env` (see `.env.example`):
```
MONGODB_URI, GEMINI_API_KEY, NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE,
JWT_SECRET, JWT_EXPIRES_IN, PORT, NODE_ENV, FRONTEND_URL, PAYMENT_MODE,
STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, HF_TOKEN, ADMIN_SECRET
```

Frontend `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```
