require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http'); // Node's built-in http server
const socketIO = require('./utils/socket'); // Our new socket utility

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const httpServer = http.createServer(app); // Wrap Express with HTTP
const PORT = process.env.PORT || 5000;

// ─── Initialize Socket.io ───────────────────────────────────────────────────
socketIO.init(httpServer);

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://admin.ecmeet2k26.zylapse.com',
  'https://ecmeet2k26.zylapse.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman, mobile apps, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('❌ Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Database ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.all('/api/health', (req, res) => {
  if (req.method === 'HEAD') {
    return res.status(200).end(); // No body for HEAD
  }

  res.json({
    status: 'OK',
    message: 'ECMEET\'26 Backend Running',
    timestamp: new Date().toISOString()
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 ECMEET'26 Backend + Live Sync running on port ${PORT}`);
});
