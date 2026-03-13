# PROGRESS.md — Smarter BlinkIt

> Tracks completed features, in-progress work, planned tasks, and known issues.  
> Updated by AI agents after each work session.

---

## Completed Features

### Stage 1 — Foundation ✅
- [x] Buyer/Seller auth (JWT) with role-based routing
- [x] Face ID login & registration (face-api.js, browser-side)
- [x] Progressive smart search (live text search with debounce)
- [x] Native barcode scanner (ZXing) for seller inventory
- [x] Light/dark theme (CSS variables + localStorage toggle)
- [x] Admin user dashboard (secret-key auth)
- [x] 3-step registration wizard (info → map → face)

### Stage 2 — Automator ✅
- [x] AI Recipe Agent (Gemini 2.5-flash → HuggingFace fallback)
- [x] Neo4j graph: BOUGHT_WITH relationships (recorded on order placement)
- [x] Neo4j graph: SIMILAR_TO relationships (created on product add)
- [x] Intent-aware search ("I have a cold" → honey, ginger tea, vitamin C)

### Stage 3 — Orchestrator ✅
- [x] Smart cart splitting (multi-shop, per-shop subtotals & status)
- [x] Live storeboard (Socket.io real-time newOrder events)
- [x] Product detail page with Neo4j-powered suggestions
- [x] Stripe payment integration (test mode) + COD + mock fallback
- [x] Location auto-detect (Nominatim reverse geocoding)
- [x] Dynamic live filters (categories + shops fetched from DB)
- [x] Smart shop filter (shop override bypasses proximity constraint)
- [x] Smart category combobox (searchable + add new)

### Stage 4 — God Mode ✅
- [x] Money Map (Leaflet.js heatmap of order density/revenue)
- [x] Smart Product Pairing (Gemini 3072D embeddings, 3-tier fallback)
- [x] Local-first geocoding (manual address → Nominatim → coordinates)
- [x] Intelligent barcode inventory (ZXing + OpenFoodFacts external lookup)
- [x] Dynamic product constraints (expiry dates on perishable categories)
- [x] Secure admin panel (/admin/users)
- [x] Saved addresses feature (address book + active address switching)

### Stage 6 — Smart Logistics & Resilience ✅
- [x] Smart Delivery Route Visualization (nearest-neighbour optimizer, Leaflet dark map, polylines, ETA, pickup summary)
- [x] Multi-model AI fallback router (`aiRouter.js` — priority list: gemini-2.5-flash → gemini-2.0-flash → lite → 1.5-flash)
- [x] Per-response `modelUsed` field + subtle frontend indicator on AI agent page and intent search
- [x] AI model priority list centralized in `backend/config/aiModels.js`
- [x] Shop coordinates surfaced in cart analysis response for frontend route visualization

### Stage 5 — Reliability ✅
- [x] Instant Neo4j fail-fast (3s connection timeout)
- [x] In-memory semantic search fallback (MongoDB embeddings + local cosine similarity)
- [x] HuggingFace inference fallback (Qwen2.5-72B when Gemini is rate-limited)
- [x] OSRM route optimization (multi-stop delivery routing with timeout fallback)
- [x] Auto-image fetcher (Google Images via `googlethis` on product save)

---

## Files by Feature Area

| Area | Key Files |
|---|---|
| Auth & Users | `backend/routes/auth.js`, `backend/middleware/auth.js`, `backend/models/User.js` |
| Products | `backend/routes/products.js`, `backend/models/Product.js` |
| Shops | `backend/routes/shops.js`, `backend/models/Shop.js` |
| Orders | `backend/routes/orders.js`, `backend/models/Order.js` |
| AI (Intent + Recipe) | `backend/routes/ai.js`, `backend/services/neo4j.js` |
| Cart Intelligence | `backend/routes/cart.js`, `backend/services/smartCartService.js`, `backend/services/cartIntelligenceService.js`, `backend/services/cartSplitter.js` |
| Payments | `backend/routes/payments.js` |
| Admin | `backend/routes/admin.js`, `backend/services/userReportService.js` |
| Real-time | `backend/sockets/storeboard.js` |
| Frontend State | `frontend/lib/context.tsx` |
| Frontend Pages | `frontend/app/*/page.tsx` |
| Frontend Components | `frontend/components/*.tsx` |
| Styling | `frontend/app/globals.css` |

---

## Known Issues / Technical Debt

| # | Issue | Severity | File |
|---|---|---|---|
| 1 | `cartIntelligenceService.js` calls `neo4jService.read()` which doesn't exist | 🔴 Runtime crash | `backend/services/cartIntelligenceService.js` |
| 2 | Dead import of `neo4jService` in `smartCartService.js` | 🟡 Cleanup | `backend/services/smartCartService.js` |
| 3 | Password reset has no token verification (mock only) | 🟡 Security | `backend/routes/auth.js` |
| 4 | Socket.io has no authentication | 🟡 Security | `backend/sockets/storeboard.js` |
| 5 | Admin fallback secret hardcoded (`'smarter-dev-123'`) | 🟡 Security | `backend/routes/admin.js` |
| 6 | `userReportService` loads all records into memory | 🟡 Scalability | `backend/services/userReportService.js` |
| 7 | MoneyMap page loads Leaflet via script injection | 🟢 Cleanup | `frontend/app/money-map/page.tsx` |
| 8 | Frontend UI/UX needs significant improvement (per README) | 🟡 UX | All frontend files |

---

## Potential Next Tasks

- [ ] Fix `neo4jService.read()` missing function (Issue #1)
- [ ] Improve frontend UI/UX — design, animations, responsiveness
- [ ] Add order status updates for sellers (confirm, prepare, dispatch, deliver)
- [ ] Add product reviews and ratings from buyers
- [ ] Implement real email-based password reset (with token)
- [ ] Add Socket.io authentication
- [ ] Implement notification system (order updates, low stock alerts)
- [ ] Add seller analytics dashboard (sales charts, trends)
- [ ] Implement order tracking for buyers (real-time status)
- [ ] Add product image upload (currently URL-based or auto-fetched)
- [ ] Performance: optimize AI response times (Gemini/HuggingFace/Neo4j priority)
- [ ] Mobile responsiveness across all pages

---

### Session — UI/UX Transformation
**Agent:** GitHub Copilot (Claude Sonnet 4.6)
**Task:** Premium UI/UX transformation with Framer Motion animations

**Completed:**
- Installed `framer-motion` (v11) + `lenis` (smooth scroll)
- Created `frontend/lib/animations.ts` — central animation variant library (typed `Variants`)
- Created `frontend/components/SmoothScroll.tsx` — Lenis smooth scroll provider
- Created `frontend/app/template.tsx` — Next.js App Router page transitions
- Enhanced `frontend/app/globals.css` — 800+ lines of premium additions:
  - New CSS variables (glass effects, gradients, spring transitions)
  - Glassmorphism utility classes (`.glass-panel`, `.glass-input`, `.glass-card`)
  - Animated blob backgrounds (`.blob`, `.blob-green`, `.blob-blue`, `.blob-purple`)
  - AI-specific components (`.ai-thinking-dot`, `.ai-glow-ring`, `.ai-badge`)
  - Feature cards with hover overlay (`.feature-card`, `.feature-icon`)
  - Skeleton screens (`.skeleton-card`, `.skeleton-img`, `.skeleton-line`)
  - Premium button variants (`.btn-glow`, `.btn-gradient`)
  - Keyframes: `float`, `pulse-dot`, `gradient-shift`, `blob-move`, `glow-pulse`, `scan-line`
- Updated `frontend/app/layout.tsx` — SmoothScroll wrapper added
- Transformed `frontend/app/page.tsx` — hero with parallax blobs, mouse-tracked gradient, animated stats, floating ambient cards, staggered feature grid, motion-powered stages + CTA
- Transformed `frontend/app/login/page.tsx` — glassmorphism panel, animated background blobs, staggered form fields, glowing submit button
- Transformed `frontend/app/register/page.tsx` — AnimatePresence step transitions, animated step indicator with glow, role picker with hover animations, parallax background
- Transformed `frontend/components/Navbar.tsx` — slide-in on mount, logo hover scale
- Transformed `frontend/app/ai-agent/page.tsx` — AI glow ring header, animated thinking dots, glassmorphism input panel, staggered example prompts, AnimatePresence results
- Transformed `frontend/app/shop/page.tsx` — animated search hero, AnimatePresence for loading/empty/results states, animated thinking dots loader

**Architecture decisions:**
- All Framer Motion variants typed with `Variants` import — zero TypeScript errors
- Bezier easing stored as `[number, number, number, number]` tuple type
- All existing logic (API calls, state, handlers) left untouched — purely additive

## Agent Work Log

### Session — March 9, 2026 (Initial Setup)
**Agent:** GitHub Copilot (Claude Opus 4.6)  
**Task:** Deep project analysis + AI memory system setup

**Completed:**
- Full codebase analysis (backend: 4 models, 8 route files, 5 services, 1 middleware, 1 socket; frontend: 11 pages, 10 components, 1 context provider)
- Created `AGENT.md` with Quick Context, architecture decisions, rules, known issues
- Created `PROGRESS.md` with full feature tracker, issue log, and next tasks
- Catalogued all 44 API endpoints and their auth requirements
- Identified 8 known bugs/technical debt items

**Files Created:**
- `AGENT.md`
- `PROGRESS.md`

**Notes:**
- All 5 development stages are complete and functional
- Primary focus areas per README: AI response time optimization and frontend UI/UX improvement
- `cartIntelligenceService.js` has a broken contract with `neo4j.js` (missing `read()` method) — highest priority fix
