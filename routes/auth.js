const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentData = require('../models/StudentData');
const CONFIG = require('../config/events.config');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Google Sign-In ────────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential, source } = req.body;
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email: rawEmail, name: rawName, picture } = payload;
    const name = rawName.replace(/\s*btech.*/i, '').trim();
    const email = rawEmail.toLowerCase();

    // ── Check if Admin / Coordinator from config ─────────────────────────────
    let role = 'student';
    const adminEntry = CONFIG.admins.find(a => a.email === email);
    const coordEntry = CONFIG.coordinators.find(c => c.email === email);

    // Hardcoded dev accounts — survive DB wipes, always protected
    const DEV_EMAILS = [
      'zzayir21@gmail.com',
      '230171601108@crescent.education'
    ];
    const isDevAccount = DEV_EMAILS.includes(email);

    if (isDevAccount) role = 'dev';
    else if (adminEntry) role = adminEntry.role || 'admin';
    else if (coordEntry) role = 'coordinator';

    // ── Check Database for existing elevated role ────────────────────────────
    const existingUser = await User.findOne({ email });
    if (existingUser && ['admin', 'coordinator', 'captain', 'dev'].includes(existingUser.role)) {
      role = existingUser.role;
    }

    // ── Domain Check ────────────────────────────────────────────────────────
    const allowedDomain = process.env.ALLOWED_DOMAIN || 'crescent.education';
    const isMasterAdmin = email === 'zzayir21@gmail.com';
    const isElevatedRole = ['admin', 'coordinator', 'captain', 'dev'].includes(role);
    const isFromAdminPortal = source === 'admin';
    
    // Allow users with elevated roles to bypass the domain restriction ONLY on frontend-admin
    if (!email.endsWith(`@${allowedDomain}`) && !isMasterAdmin && !(isElevatedRole && isFromAdminPortal)) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: `Only @${allowedDomain} email addresses are allowed for this portal.`
      });
    }

    // ── Look up StudentData ──────────────────────────────────────────────────
    const studentData = await StudentData.findOne({ emailId: email });

    // ── Block students not found in StudentData ──────────────────────────────
    if (role === 'student' && !studentData && !(isElevatedRole && isFromAdminPortal)) {
      return res.status(403).json({
        error: 'NOT_REGISTERED',
        message: 'Your email is not registered for ECMEET\'26. Please contact the organizers.',
      });
    }

    // Prefer the name from StudentData; fall back to cleaned Google name
    const displayName = studentData?.name?.trim() || name;

    // ── Find or Create User ──────────────────────────────────────────────────
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        googleId,
        email,
        name: displayName,
        profilePicture: picture,
        role,
        rrn: studentData?.rrn,
        team: studentData?.team,
        department: studentData?.dept,
        class: studentData?.class,
        section: studentData?.section,
        contactNumber: studentData?.contactNumber
      });
    } else {
      // Update login info
      user.googleId = googleId;
      user.profilePicture = picture;
      // Always sync name from StudentData if available
      if (studentData?.name?.trim()) {
        user.name = studentData.name.trim();
      }
      // DB role takes precedence. Only apply config role if user is currently a student.
      // Exception: always force 'dev' role for hardcoded dev accounts.
      if (isDevAccount) {
        user.role = 'dev';
      } else if (user.role === 'student') {
        user.role = role;
      }
    }

    user.lastLogin = new Date();
    user.loginCount += 1;
    user.isOnline = true;
    await user.save();

    
    // ── Sync to StudentData ──────────────────────────────────────────────────
    if (user.email) {
      await StudentData.findOneAndUpdate(
        { emailId: user.email.toLowerCase() },
        { $set: { profilePicture: user.profilePicture } }
      ).catch(err => console.error('StudentData sync failed:', err.message));
    }

    // ── Generate JWT ─────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ecmeet26secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
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
        houseRevealed: user.houseRevealed
      }
    });

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed', message: err.message });
  }
});



// ─── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ecmeet26secret');
      await User.findByIdAndUpdate(decoded.userId, { isOnline: false });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.json({ message: 'Logged out' });
  }
});

// ─── Verify Token ─────────────────────────────────────────────────────────────
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ valid: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ecmeet26secret');
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ valid: false });

    res.json({
      valid: true,
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
        houseRevealed: user.houseRevealed
      }
    });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
