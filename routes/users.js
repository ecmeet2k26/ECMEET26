const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');

// ─── Get My Profile ────────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      role: user.role,
      team: user.team,
      rrn: user.rrn,
      department: user.department,
      class: user.class,
      section: user.section,
      contactNumber: user.contactNumber,
      houseRevealed: user.houseRevealed,
      sortingCombo: user.sortingCombo
    }
  });
});

// ─── Update Profile ────────────────────────────────────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  try {
    const allowed = ['name', 'profilePicture', 'contactNumber', 'sortingCombo'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// ─── Reveal House ──────────────────────────────────────────────────────────────
router.post('/reveal-house', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.team) {
      return res.status(400).json({
        error: 'NO_TEAM',
        message: 'No team assigned to your account. Please contact admin or re-import student data.'
      });
    }

    const updates = { houseRevealed: true };
    
    // If frontend sends a combo and we don't have one, save it
    if (req.body.sortingCombo && !user.sortingCombo) {
      updates.sortingCombo = req.body.sortingCombo;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, 
      updates, 
      { new: true }
    );

    res.json({
      success: true,
      alreadyRevealed: user.houseRevealed,
      team: user.team,
      sortingCombo: updatedUser.sortingCombo,
      message: `Welcome to ${user.team}!`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reveal house' });
  }
});

module.exports = router;
