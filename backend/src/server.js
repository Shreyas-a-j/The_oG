require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDb = require('./config/db');
const authMiddleware = require('./middleware/auth');
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const setupSocket = require('./socket');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', apiLimiter, authMiddleware, roomRoutes);
app.use('/api/messages', apiLimiter, authMiddleware, messageRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: 'Internal server error', details: error.message });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

setupSocket(io);

const PORT = process.env.PORT || 4000;

connectDb()
  .then(() => {
    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  });
