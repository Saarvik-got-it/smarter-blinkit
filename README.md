# Smarter BlinkIt ðŸ›’âš¡

> An AI-powered marketplace connecting buyers and local sellers. Instead of item-by-item searching, simply describe what you need â€” the AI fills your cart automatically.

**Status: ðŸŸ¢ All 4 Stages Completed Partially â€” Foundation, Automator, Orchestrator, God Mode**

**NOTE:** Currently working extensively on stage 1. The platform is still under production and some of the features are not working as expected. Also the database is not fully populated with the products and shops. There are some issues with the Gemnini API which will be resolved soon.
---

## ðŸ“¸ Screenshots

| Shop â€” Product Grid | Text Search ("pizza") |
|---|---|
| ![Shop Grid](docs/screenshots/shop_grid.png) | ![Pizza Search](docs/screenshots/text_search.png) |

| ðŸ§  AI Intent Search ("I have a cold") | Product Detail + Neo4j Suggestions |
|---|---|
| ![AI Intent](docs/screenshots/ai_intent.png) | ![Product Detail](docs/screenshots/product_detail.png) |

| ðŸ¤– AI Recipe Agent | ðŸ“¡ Live Storeboard |
|---|---|
| ![AI Agent](docs/screenshots/ai_agent.png) | ![Storeboard](docs/screenshots/storeboard.png) |

| ðŸ—ºï¸ Money Map (Leaflet.js) | Buyer Dashboard |
|---|---|
| ![alt text](image.png) | ![Dashboard](docs/screenshots/dashboard.png) |

---

## ï¿½ Project Overview

Smarter BlinkIt is a full-stack web application built around the concept of an **AI Shopping Assistant** and a **Barcode-based Inventory System** for sellers.

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) + Vanilla CSS |
| **Backend** | Node.js + Express REST API |
| **Primary DB** | MongoDB Atlas (users, products, orders, shops) |
| **Graph DB** | Neo4j AuraDB (product relationships: SIMILAR_TO, BOUGHT_WITH) |
| **AI / LLM** | Google Gemini 2.0 Flash (intent parsing, recipe agent) |
| **Face Recognition** | face-api.js (browser-side, TensorFlow.js models) |
| **Barcode Scanning** | QuaggaJS (live camera barcode detection) |
| **Payments** | Mock payment flow (Razorpay-ready architecture) |
| **Real-time** | Socket.io (live storeboard events) |
| **Maps** | Leaflet.js + OpenStreetMap (Money Map) |

---

## ðŸš€ How It Works

### Stage 1 â€” The Foundation âœ…
- **Dual Login**: Buyers and Sellers see completely different dashboards after login.
- **Role-based Routing**: Seamless redirection post-login preventing back-button loops.
- **Face ID Login**: Register your face once, then log in just by looking at the camera (face-api.js), now integrated directly into the signup flow.
- **Theme Consistency**: Fully reactive Light/Dark CSS Variable Theme architecture across the app.
- **Live Sync Search**: Product search auto-updates as you type with debouncing for a smooth experience.

### Stage 2 â€” The Automator âœ…
- **AI Recipe Agent**: Type "Make pizza for 4 people" â†’ Gemini extracts ingredients â†’ matches nearest shop products â†’ one-click cart fill.
- **Neo4j Graph Suggestions**: Products stored as graph nodes. When you buy pasta, the system records `BOUGHT_WITH` cheese â†’ next user sees suggestion.
- **Intent-Aware Search**: Search "I have a cold" â†’ AI returns Honey, Ginger Tea, Vitamin C.
- **AI Redundancy**: Complete fallback protocols for both Intent and Recipe agents, bypassing Gemini rate limit errors invisibly.

### Stage 3 â€” Orchestrator âœ…
- **Advanced Checkout Workflow**: Multi-stage Payment Selection UI (CoD, Mock UPI, Mock Cards) instead of a 1-click buy button.
- **Location Auto-Detect**: Integrates Nominatim Reverse Geocoding enabling auto-detecting user checkout delivery address.
- **Live Storeboard**: Real-time Socket.io dashboard showing top-selling products and top-rated shops.
- **Smart Cart Splitting**: Multi-shop orders auto-split per shop.
- **Product Detail Page**: Full product info with quantity selector and Neo4j-powered Smart Suggestions.
- **Category & Shop Filters**: Browse products by specific shops or categories effortlessly.

### Bonus / God Mode âœ…
- **Money Map**: Leaflet.js + OpenStreetMap heatmap showing which shops drive the most revenue.
- **Advanced Seller Dashboard**: Barcode Scanners rewritten with `html5-qrcode` integration for instantaneous accuracy.
- **Secure Developer Admin**: Secure Admin Panel (`/admin/users`) for full site surveillance.

### Bonus â€” God Mode âœ…
- **Money Map**: Leaflet.js + OpenStreetMap heatmap showing which shops drive the most revenue
- **AI Intent Fallback**: Rate-limit safe â€” falls back to keyword splitting if Gemini is quota-limited

---

## ðŸ›  Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Neo4j AuraDB account
- Google Gemini API key

### 1. Clone & Setup Backend
```bash
git clone https://github.com/Saarvik-got-it/smarter-blinkit.git
cd smarter-blinkit/backend
npm install
# Fill in .env (see .env.example)
npm run dev
```

### 2. Seed the Database
```bash
cd backend
node seed.js
```
This creates 2 shops, 3 users, and 42 products across 6 categories.

| Account | Email | Password |
|---|---|---|
| ðŸ›’ Buyer | `aryan@buyer.com` | `password123` |
| ðŸª Seller 1 | `ramesh@shop.com` | `password123` |
| ðŸª Seller 2 | `priya@shop.com` | `password123` |

### 3. Setup Frontend
```bash
cd ../frontend
npm install
# Fill in .env.local with: NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev
```

### 4. Open App
Visit `http://localhost:3000`

---

## ðŸ“ Project Structure
```
smarter-blinkit/
â”œâ”€â”€ frontend/                    # Next.js 14 app
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ page.tsx            # Landing page
â”‚   â”‚   â”œâ”€â”€ login/              # Login (+ Face ID)
â”‚   â”‚   â”œâ”€â”€ register/           # Buyer / Seller registration
â”‚   â”‚   â”œâ”€â”€ dashboard/          # Role-based dashboard
â”‚   â”‚   â”œâ”€â”€ shop/               # Shop + intent search
â”‚   â”‚   â”‚   â””â”€â”€ [id]/           # Product detail + Neo4j suggestions
â”‚   â”‚   â”œâ”€â”€ ai-agent/           # AI Recipe Agent (Gemini)
â”‚   â”‚   â”œâ”€â”€ storeboard/         # Live Socket.io dashboard
â”‚   â”‚   â””â”€â”€ money-map/          # Leaflet.js revenue heatmap
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ Navbar.tsx
â”‚   â”‚   â”œâ”€â”€ CartSidebar.tsx     # Cart with mock checkout
â”‚   â”‚   â”œâ”€â”€ FaceLogin.tsx       # face-api.js face recognition
â”‚   â”‚   â”œâ”€â”€ BuyerDashboard.tsx
â”‚   â”‚   â””â”€â”€ SellerDashboard.tsx # Inventory + barcode scanner tab
â”‚   â””â”€â”€ lib/context.tsx         # Global state (auth, cart, toasts)
â”‚
â”œâ”€â”€ backend/                     # Express API
â”‚   â”œâ”€â”€ server.js               # Entry point (MongoDB + Socket.io)
â”‚   â”œâ”€â”€ seed.js                 # Mock data seeder (42 products, 2 shops)
â”‚   â”œâ”€â”€ models/                 # User, Product, Shop, Order
â”‚   â”œâ”€â”€ routes/                 # auth, products, orders, shops, payments, ai
â”‚   â”œâ”€â”€ middleware/auth.js      # JWT + role guard
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ neo4j.js           # Graph DB service (BOUGHT_WITH, SIMILAR_TO)
â”‚   â”‚   â””â”€â”€ cartSplitter.js    # Multi-shop cart splitting
â”‚   â””â”€â”€ sockets/storeboard.js  # Real-time Socket.io events
â”‚
â”œâ”€â”€ .env.example                # Required environment variables
â””â”€â”€ README.md
```

---

## ðŸ” Environment Variables

Create `backend/.env` with:
```env
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=AIza...
NEO4J_URI=neo4j+s://...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
NEO4J_DATABASE=...
JWT_SECRET=your_secret
PORT=5000
```

Create `frontend/.env.local` with:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## ðŸ“Š Progress Tracker

| Stage | Feature | Status |
|---|---|---|
| 1 | Buyer/Seller Auth (JWT) | âœ… Done |
| 1 | Face ID Login (face-api.js) | âœ… Done |
| 1 | Intent-based Semantic Search | âœ… Done |
| 1 | Barcode Inventory Manager | âœ… Done |
| 1 | Mock Payment Checkout | âœ… Done |
| 1 | Location-based Shop Query | âœ… Done |
| 2 | AI Recipe Agent (Gemini 2.0 Flash) | âœ… Done |
| 2 | Neo4j Graph: BOUGHT_WITH | âœ… Done |
| 2 | Neo4j Graph: SIMILAR_TO | âœ… Done |
| 3 | Smart Cart Splitting | âœ… Done |
| 3 | Live Storeboard (Socket.io) | âœ… Done |
| 3 | Product Detail + Neo4j Suggestions | âœ… Done |
| Bonus | Money Map (Leaflet.js + OSM) | âœ… Done |
| Bonus | AI Intent Rate-limit Fallback | âœ… Done |

---

## ðŸ”— API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register buyer/seller |
| POST | `/api/auth/login` | JWT login |
| POST | `/api/auth/face-login` | Face descriptor match |
| GET | `/api/products/search?q=&lat=&lng=` | Intent + geo search |
| GET | `/api/products/:id/suggestions` | Neo4j similar products |
| POST | `/api/products/barcode/lookup` | Barcode â†’ product |
| POST | `/api/orders` | Place order (with cart splitting) |
| POST | `/api/ai/recipe-agent` | Gemini recipe â†’ cart items |
| POST | `/api/ai/intent-search` | Semantic query expansion |
| GET | `/api/shops/nearby?lat=&lng=` | Geo-sorted shops |
| GET | `/api/shops/storeboard` | Live top sellers |
| GET | `/api/shops/money-map` | Heatmap data |
| POST | `/api/payments/mock-intent` | Start mock payment |
| POST | `/api/payments/mock-verify` | Verify mock payment |

---

*Last updated: All 4 stages complete â€” March 2026*

