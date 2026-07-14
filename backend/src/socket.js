const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const Room = require('./models/Room');
const User = require('./models/User');

const getToken = (socket) => {
  const tokenFromAuth = socket.handshake.auth?.token || '';
  if (tokenFromAuth.startsWith('Bearer ')) {
    return tokenFromAuth.slice(7);
  }
  return tokenFromAuth;
};

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getToken(socket);
      if (!token) {
        throw new Error('Missing token');
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('-passwordHash');

      if (!user) {
        throw new Error('Unauthorized');
      }

      socket.user = user;
      return next();
    } catch (_error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('presence:update', { userId, isOnline: true });

    socket.on('room:join', async ({ roomId }, callback = () => {}) => {
      try {
        const room = await Room.findById(roomId);

        if (!room || !room.members.some((memberId) => memberId.toString() === userId)) {
          return callback({ ok: false, error: 'Access denied' });
        }

        socket.join(roomId);
        return callback({ ok: true });
      } catch (error) {
        return callback({ ok: false, error: error.message });
      }
    });

    socket.on('message:send', async ({ roomId, content }, callback = () => {}) => {
      try {
        if (!content?.trim()) {
          return callback({ ok: false, error: 'Message content is required' });
        }

        const room = await Room.findById(roomId);
        if (!room || !room.members.some((memberId) => memberId.toString() === userId)) {
          return callback({ ok: false, error: 'Access denied' });
        }

        const message = await Message.create({
          room: roomId,
          sender: userId,
          content: content.trim(),
        });

        const payload = await Message.findById(message._id)
          .populate('sender', 'username')
          .lean();

        io.to(roomId).emit('message:new', payload);
        return callback({ ok: true, message: payload });
      } catch (error) {
        return callback({ ok: false, error: error.message });
      }
    });

    socket.on('typing:start', ({ roomId }) => {
      socket.to(roomId).emit('typing:update', {
        roomId,
        userId,
        username: socket.user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ roomId }) => {
      socket.to(roomId).emit('typing:update', {
        roomId,
        userId,
        username: socket.user.username,
        isTyping: false,
      });
    });

    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(userId, { isOnline: false });
      io.emit('presence:update', { userId, isOnline: false });
    });
  });
};

module.exports = setupSocket;
