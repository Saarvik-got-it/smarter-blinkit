# Smarter BlinkIt 🛒⚡

> An AI-powered marketplace connecting buyers and local sellers. Instead of item-by-item searching, simply describe what you need — the AI fills your cart automatically.

**Status: 🟡 Stage 1 & 2 Complete — Stage 3 (Orchestrator) & Bonus in Progress**

---

## 📸 Project Overview

Smarter BlinkIt is a full-stack web application built around the concept of an **AI Shopping Assistant** and a **Barcode-based Inventory System** for sellers.

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) + Vanilla CSS |
| **Backend** | Node.js + Express REST API |
| **Primary DB** | MongoDB Atlas (users, products, orders, shops) |
| **Graph DB** | Neo4j AuraDB (product relationships: SIMILAR_TO, BOUGHT_WITH) |
| **AI / LLM** | Google Gemini 1.5 Flash (intent parsing, recipe agent) |
| **Face Recognition** | face-api.js (browser-side, TensorFlow.js models) |
| **Barcode Scanning** | QuaggaJS (live camera barcode detection) |
| **Payments** | Mock payment flow (Razorpay-ready architecture) |
| **Real-time** | Socket.io (live storeboard events) |
| **Maps** | Leaflet.js + OpenStreetMap (Money Map) |

---

## 🚀 How It Works

### Stage 1 — The Foundation ✅
- **Dual Login**: Buyers and Sellers see completely different dashboards after login
- **Face ID Login**: Register your face once, then log in just by looking at the camera (face-api.js)
- **Intent Search**: Search "I have a cold" → AI returns Honey, Ginger Tea, Vitamin C (not just keyword match)
- **Barcode Scanner**: Sellers scan product barcodes via camera to update inventory instantly
- **Mock Payments**: Full checkout flow simulating Razorpay — no real transactions

### Stage 2 — The Automator ✅
- **AI Recipe Agent**: Type "Make pizza for 4 people" → Gemini extracts ingredients → matches nearest shop products → one-click cart fill
- **Neo4j Graph Suggestions**: Products stored as graph nodes. When you buy pasta, the system records `BOUGHT_WITH` cheese → next user sees suggestion
- **Intent-Aware Search**: Gemini expands queries semantically before searching the catalog

### Stage 3 — Orchestrator 🔄
- **Smart Cart Splitting**: Multi-shop orders auto-split per shop (Shop A: pasta, Shop B: cheese)
- **Live Storeboard**: Real-time Socket.io dashboard showing top-selling products and top-rated shops

### Bonus — God Mode 📍
- **Money Map**: Leaflet.js heatmap showing which neighbourhoods buy the most
- **Smart Product Pairing**: HuggingFace ML model for co-purchase prediction

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

### 2. Setup Frontend
```bash
cd ../frontend
npm install
# Fill in .env.local with: NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev
```

### 3. Open App
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
│   │   └── ai-agent/           # AI Recipe Agent
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── CartSidebar.tsx     # Cart with mock checkout
│   │   ├── FaceLogin.tsx       # face-api.js face recognition
│   │   ├── BuyerDashboard.tsx
│   │   └── SellerDashboard.tsx # With barcode scanner tab
│   └── lib/context.tsx         # Global state (auth, cart, toasts)
│
├── backend/                     # Express API
│   ├── server.js               # Entry point (MongoDB + Socket.io)
│   ├── models/                 # User, Product, Shop, Order
│   ├── routes/                 # auth, products, orders, shops, payments, ai
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

## 🔐 Environment Variables

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
| 1 | Face ID Login (face-api.js) | ✅ Done |
| 1 | Intent-based Semantic Search | ✅ Done |
| 1 | Barcode Inventory Manager | ✅ Done |
| 1 | Mock Payment Checkout | ✅ Done |
| 1 | Location-based Shop Query | ✅ Done |
| 2 | AI Recipe Agent (Gemini) | ✅ Done |
| 2 | Neo4j Graph: BOUGHT_WITH | ✅ Done |
| 2 | Neo4j Graph: SIMILAR_TO | ✅ Done |
| 3 | Smart Cart Splitting | ✅ Done |
| 3 | Live Storeboard (Socket.io) | ✅ Backend Done |
| Bonus | Money Map (Leaflet.js) | 🔄 In Progress |
| Bonus | Smart Product Pairing (HuggingFace) | 📋 Planned |

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
| POST | `/api/payments/mock-intent` | Start mock payment |
| POST | `/api/payments/mock-verify` | Verify mock payment |

---

*Last updated: Stage 1 & 2 complete — March 2026*
