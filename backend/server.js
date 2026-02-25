require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');

const db = require('./db');
const authRoutes = require('./routes/auth');
const devicesRoutes = require('./routes/devices');
const telemetryRoutes = require('./routes/telemetry');
const eventsRoutes = require('./routes/events');
const geocercaRoutes = require('./routes/geocercas');
const usersRoutes = require('./routes/users');
const alertsRoutes = require('./routes/alerts');

const { simulateTelemetry } = require('./services/simulator');
const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'solartrack-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', verifyToken, devicesRoutes);
app.use('/api/telemetry', verifyToken, telemetryRoutes);
app.use('/api/events', verifyToken, eventsRoutes);
app.use('/api/geocercas', verifyToken, geocercaRoutes);
app.use('/api/users', verifyToken, usersRoutes);
app.use('/api/alerts', verifyToken, alertsRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

// Socket.IO — Real-time telemetry
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const { verifyTokenSync } = require('./middleware/auth');
    socket.user = verifyTokenSync(token);
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.user?.username}`);
  
  socket.on('subscribe_device', (deviceId) => {
    socket.join(`device:${deviceId}`);
  });

  socket.on('unsubscribe_device', (deviceId) => {
    socket.leave(`device:${deviceId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.user?.username}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Initialize DB then start
db.initialize().then(() => {
  // Start simulator (replace with real Queclink webhook in production)
  simulateTelemetry(io);
  
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`\n🚀 SolarTrack backend running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🗄  Database initialized\n`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

module.exports = { app, io };
