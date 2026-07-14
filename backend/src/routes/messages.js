const express = require('express');
const Message = require('../models/Message');
const Room = require('../models/Room');

const router = express.Router();

router.get('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const limit = Math.min(Number(req.query.limit || 50), 200);

  const room = await Room.findById(roomId);

  if (!room || !room.members.some((memberId) => memberId.toString() === req.user._id.toString())) {
    return res.status(403).json({ error: 'Room not found or access denied' });
  }

  const messages = await Message.find({ room: roomId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username')
    .lean();

  return res.json({ messages: messages.reverse() });
});

module.exports = router;
