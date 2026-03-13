const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const shopRoutes = require('./routes/shops');
const paymentRoutes = require('./routes/payments');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const storeboardSocket = require('./sockets/storeboard');

const app = express();
const server = http.createServer(app);
const FRONTEND_ORIGIN = process.env.FRONTEND_URL;
const PORT = process.env.PORT || 5000;

console.log('Starting Smarter Blinkit backend...');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach io to requests
app.use((req, _, next) => { req.io = io; next(); });

const cartRoutes = require('./routes/cart');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/api/health', (_, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Socket.io
storeboardSocket(io);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = { app, server };
