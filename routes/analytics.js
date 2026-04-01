const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Registration = require('../models/Registration');

// ─── Dashboard Stats ───────────────────────────────────────────────────────────
router.get('/stats', authenticate, requireRole('coordinator', 'admin', 'dev'), async (req, res) => {
  try {
    const [
      totalUsers,
      onlineUsers,
      totalRegistrations,
      registrationsByEvent
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ isOnline: true }),
      Registration.countDocuments({ status: { $ne: 'cancelled' } }),
      Registration.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: '$eventId', count: { $sum: 1 }, eventName: { $first: '$eventName' } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      totalUsers,
      onlineUsers,
      offlineUsers: totalUsers - onlineUsers,
      totalRegistrations,
      registrationsByEvent
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Active Users (last 30 min) ────────────────────────────────────────────────
router.get('/active-users', authenticate, requireRole('coordinator', 'admin', 'dev'), async (req, res) => {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const activeUsers = await User.find({
      isOnline: true
    }).select('name email profilePicture team lastLogin isOnline department rrn')
    .sort({ lastLogin: -1 });

    res.json({ activeUsers, count: activeUsers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

module.exports = router;
