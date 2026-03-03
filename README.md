# Smarter BlinkIt 🛒⚡

> An AI-powered marketplace connecting buyers and local sellers. Instead of item-by-item searching, simply describe what you need — the AI fills your cart automatically.

**Status: 🟢 Features Working**

* Dual Login
* Face ID Login
* Role-based Routing
* Theme Consistency
* Progressive Smart Search
* AI Recipe Agent
* Neo4j Graph Suggestions
* Intent-Aware Search
* Location Auto-Detect
* Live Storeboard
* Smart Cart Splitting
* Product Detail Page
* Live Dynamic Filters

**NOTE:** The platform is still under production and some of the features are not working as expected.
---

## 📸 Screenshots

| Shop — Product Grid | Text Search ("pizza") |
|---|---|
| ![Shop Grid](docs/screenshots/shop_grid.png) | ![Pizza Search](docs/screenshots/text_search.png) |

| 🧠 AI Intent Search ("I have a cold") | Product Detail + Neo4j Suggestions |
|---|---|
| ![AI Intent](docs/screenshots/ai_intent.png) | ![Product Detail](docs/screenshots/product_detail.png) |

| 🤖 AI Recipe Agent | 📡 Live Storeboard |
|---|---|
| ![AI Agent](docs/screenshots/ai_agent.png) | ![Storeboard](docs/screenshots/storeboard.png) |

| 🗺️ Money Map (Leaflet.js) | Buyer Dashboard |
|---|---|
| ![alt text](image.png) | ![Dashboard](docs/screenshots/dashboard.png) |

---

## 🎯 Project Overview

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
| **Barcode Scanning** | `@zxing/browser` (ZXing — cross-platform, all major barcode formats) |
| **Payments** | Mock payment flow (Razorpay-ready architecture) |
| **Real-time** | Socket.io (live storeboard events) |
| **Maps** | Leaflet.js + OpenStreetMap (Money Map) |

---

## 🚀 How It Works

### Stage 1 — The Foundation ✅
- **Dual Login**: Buyers and Sellers see completely different dashboards after login.
- **Role-based Routing**: Seamless redirection post-login preventing back-button loops.
- **Face ID Login**: Register your face once, then log in just by looking at the camera (face-api.js), now integrated directly into the signup flow.
- **Theme Consistency**: Fully reactive Light/Dark CSS Variable Theme architecture across the app.
- **Progressive Smart Search**: Google-like live search — results update as you type. Typing `V` instantly returns Vicks, Vitamins, Vegetables etc. No need to type the full keyword.

### Stage 2 — The Automator ✅
- **AI Recipe Agent**: Type "Make pizza for 4 people" → Gemini extracts ingredients → matches nearest shop products → one-click cart fill.
- **Neo4j Graph Suggestions**: Products stored as graph nodes. When you buy pasta, the system records `BOUGHT_WITH` cheese → next user sees suggestion.
- **Intent-Aware Search**: Search "I have a cold" → AI returns Honey, Ginger Tea, Vitamin C.
- **AI Redundancy**: Complete fallback protocols for both Intent and Recipe agents, bypassing Gemini rate limit errors invisibly.

### Stage 3 — Orchestrator ✅
- **Advanced Checkout Workflow**: Multi-stage Payment Selection UI (CoD, Mock UPI, Mock Cards) instead of a 1-click buy button.
- **Location Auto-Detect**: Integrates Nominatim Reverse Geocoding enabling auto-detecting user checkout delivery address.
- **Live Storeboard**: Real-time Socket.io dashboard showing top-selling products and top-rated shops.
- **Smart Cart Splitting**: Multi-shop orders auto-split per shop.
- **Product Detail Page**: Full product info with quantity selector and Neo4j-powered Smart Suggestions.
- **Live Dynamic Filters**: Categories and Shops are fetched live from the database. Any new shop or category added by a seller is instantly reflected for all buyers. Shop filter ensures you can browse specific catalogs effortlessly.

### Bonus / God Mode ✅
- **Money Map**: Leaflet.js + OpenStreetMap heatmap showing which shops drive the most revenue.
- **Advanced Seller Dashboard**: Barcode scanner powered by `@zxing/browser` (ZXing) — works on Windows/Mac/Linux in Chrome and Edge, supports EAN-13, UPC, Code-128, QR and more.
- **Secure Developer Admin**: Secure Admin Panel (`/admin/users`) for full site surveillance.

---

## 🛠 Quick Start

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
| 🛒 Buyer | `aryan@buyer.com` | `password123` |
| 🏪 Seller 1 | `ramesh@shop.com` | `password123` |
| 🏪 Seller 2 | `priya@shop.com` | `password123` |

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

## 📁 Project Structure
```
smarter-blinkit/
├── frontend/                    # Next.js 14 app
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── login/              # Login (+ Face ID)
│   │   ├── register/           # Buyer / Seller registration
│   │   ├── dashboard/          # Role-based dashboard
│   │   ├── shop/               # Shop + intent search
│   │   │   └── [id]/           # Product detail + Neo4j suggestions
│   │   ├── ai-agent/           # AI Recipe Agent (Gemini)
│   │   ├── storeboard/         # Live Socket.io dashboard
│   │   └── money-map/          # Leaflet.js revenue heatmap
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── CartSidebar.tsx     # Cart with mock checkout & location
│   │   ├── FaceLogin.tsx       # face-api.js face recognition login
│   │   ├── FaceRegister.tsx    # face-api.js enrollment
│   │   ├── BuyerDashboard.tsx
│   │   └── SellerDashboard.tsx # Inventory + native BarcodeDetector scanner tab
│   └── lib/context.tsx         # Global state (auth, cart, toasts)
│
├── backend/                     # Express API
│   ├── server.js               # Entry point (MongoDB + Socket.io)
│   ├── seed.js                 # Mock data seeder (42 products, 2 shops)
│   ├── models/                 # User, Product, Shop, Order
│   ├── routes/                 # auth, products, orders, shops, payments, ai, admin
│   ├── middleware/auth.js      # JWT + role guard
│   ├── services/
│   │   ├── neo4j.js           # Graph DB service (BOUGHT_WITH, SIMILAR_TO)
│   │   └── cartSplitter.js    # Multi-shop cart splitting
│   └── sockets/storeboard.js  # Real-time Socket.io events
│
├── .env.example                # Required environment variables
└── README.md
```

---

## 🔑 Environment Variables

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

## 📊 Progress Tracker

| Stage | Feature | Status |
|---|---|---|
| 1 | Buyer/Seller Auth (JWT) | ✅ Done |
| 1 | Face ID Login & Registration | ✅ Done |
| 1 | Intent-based Semantic Search | ✅ Done |
| 1 | Native BarcodeDetector Inventory Scanner | ✅ Done |
| 1 | Location Checkout & Mock Payments | ✅ Done |
| 1 | Global Light/Dark Theme & Filters | ✅ Done |
| 1 | Secure Admin User Dashboard | ✅ Done |
| 2 | AI Recipe Agent (Gemini 2.0 Flash) | ✅ Done |
| 2 | Neo4j Graph: BOUGHT_WITH | ✅ Done |
| 2 | Neo4j Graph: SIMILAR_TO | ✅ Done |
| 3 | Smart Cart Splitting | ✅ Done |
| 3 | Live Storeboard (Socket.io) | ✅ Done |
| 3 | Product Detail + Neo4j Suggestions | ✅ Done |
| Bonus | Money Map (Leaflet.js + OSM) | ✅ Done |
| Bonus | AI Intent Rate-limit Fallback | ✅ Done |

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register buyer/seller |
| POST | `/api/auth/login` | JWT login |
| POST | `/api/auth/face-login` | Face descriptor match |
| GET | `/api/products/search?q=&lat=&lng=` | Intent + geo search |
| GET | `/api/products/:id/suggestions` | Neo4j similar products |
| POST | `/api/products/barcode/lookup` | Barcode → product |
| POST | `/api/orders` | Place order (with cart splitting) |
| POST | `/api/ai/recipe-agent` | Gemini recipe → cart items |
| POST | `/api/ai/intent-search` | Semantic query expansion |
| GET | `/api/shops/nearby?lat=&lng=` | Geo-sorted shops |
| GET | `/api/shops/storeboard` | Live top sellers |
| GET | `/api/shops/money-map` | Heatmap data |
| DELETE | `/api/auth/delete-account` | Delete current user account (+ shop if seller) |
| GET | `/api/auth/me` | Get current logged-in user |
| POST | `/api/auth/face-register` | Save face descriptor for current user |
| GET | `/api/shops/my` | Get seller's own shop |
| POST | `/api/shops` | Create a shop (for sellers without one) |
| PUT | `/api/shops/my` | Update seller's shop details |

---

*Last updated: All 4 stages complete — March 2026*
