const express = require('express');
const Room = require('../models/Room');

const router = express.Router();

router.get('/', async (req, res) => {
  const rooms = await Room.find({ members: req.user._id })
    .sort({ updatedAt: -1 })
    .populate('members', 'username isOnline')
    .lean();

  return res.json({ rooms });
});

router.post('/', async (req, res) => {
  const { name, isPrivate = false, memberIds = [] } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const uniqueMembers = Array.from(new Set([req.user._id.toString(), ...memberIds]));

  const room = await Room.create({
    name,
    isPrivate,
    members: uniqueMembers,
    createdBy: req.user._id,
  });

  const populated = await Room.findById(room._id).populate('members', 'username isOnline').lean();

  return res.status(201).json({ room: populated });
});

module.exports = router;
