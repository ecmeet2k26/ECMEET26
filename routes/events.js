const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Registration = require('../models/Registration');
const RegistrationBackup = require('../models/RegistrationBackup');
const Event = require('../models/Event'); // Import Event model
const CONFIG = require('../config/events.config');
const axios = require('axios');
const socketIO = require('../utils/socket');

// ─── Get All Events ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ order: 1 });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events from database' });
  }
});

// ─── Get Single Event ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event detail' });
  }
});

// ─── Register for Event ────────────────────────────────────────────────────────
router.post('/register', authenticate, async (req, res) => {
  try {
    const { eventId, name, contactNumber, profilePicture } = req.body;
    const user = req.user;

    // Validate event exists
    const event = await Event.findOne({ id: eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check max registrations (3 per user)
    const existingRegistrations = await Registration.countDocuments({
      userId: user._id,
      status: { $ne: 'cancelled' }
    });

    if (existingRegistrations >= 3) {
      return res.status(400).json({
        error: 'MAX_REGISTRATIONS',
        message: 'You can only register for a maximum of 3 events.'
      });
    }

    // Check duplicate registration
    const existing = await Registration.findOne({ userId: user._id, eventId });
    if (existing) {
      return res.status(400).json({
        error: 'ALREADY_REGISTERED',
        message: `You are already registered for ${event.name}.`
      });
    }

    // ── Create Registration ──────────────────────────────────────────────────
    const registration = new Registration({
      userId: user._id,
      email: user.email,
      name: name || user.name,
      profilePicture: profilePicture || user.profilePicture,
      rrn: user.rrn,
      team: user.team,
      department: user.department,
      section: user.section,
      contactNumber: contactNumber || user.contactNumber,
      eventId,
      eventName: event.name
    });

    await registration.save();

    // ── Internal Backup: Save to secondary collection ────────────────────────
    const backup = new RegistrationBackup(registration.toObject());
    await backup.save().catch(err => console.error('Internal backup failed:', err.message));

    // Update User's contact number if they don't have one and provided it here
    if (contactNumber && !user.contactNumber) {
      user.contactNumber = contactNumber;
      await user.save();
    }

    // ── Backup: Submit to Google Form ──────────────────────────────────────
    submitToGoogleForm(registration, event).catch(err =>
      console.error('Google Form backup failed:', err.message)
    );

    socketIO.getIO().emit('data-updated', { 
      type: 'REGISTRATION_ADDED', 
      eventId: registration.eventId,
      eventName: registration.eventName,
      team: registration.team
    });

    res.json({
      success: true,
      message: `Successfully registered for ${event.name}!`,
      registration: {
        id: registration._id,
        eventId,
        eventName: event.name,
        registeredAt: registration.createdAt
      }
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Already registered for this event' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed', message: err.message });
  }
});

// ─── Get User's Registrations ──────────────────────────────────────────────────
router.get('/my/registrations', authenticate, async (req, res) => {
  try {
    const registrations = await Registration.find({
      userId: req.user._id,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });
    res.json({ registrations, count: registrations.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// ─── Cancel Registration ───────────────────────────────────────────────────────
router.delete('/register/:eventId', authenticate, async (req, res) => {
  try {
    const reg = await Registration.findOneAndUpdate(
      { userId: req.user._id, eventId: req.params.eventId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    
    socketIO.getIO().emit('data-updated', { 
      type: 'REGISTRATION_CANCELLED', 
      eventId: req.params.eventId,
      userId: req.user._id
    });
    
    res.json({ success: true, message: 'Registration cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel registration' });
  }
});

// ─── Google Form Backup ────────────────────────────────────────────────────────
async function submitToGoogleForm(registration, event) {
  if (!process.env.GOOGLE_FORM_URL) return;

  const formData = new URLSearchParams();
  if (process.env.GOOGLE_FORM_NAME_FIELD)
    formData.append(process.env.GOOGLE_FORM_NAME_FIELD, registration.name);
  if (process.env.GOOGLE_FORM_EMAIL_FIELD)
    formData.append(process.env.GOOGLE_FORM_EMAIL_FIELD, registration.email);
  if (process.env.GOOGLE_FORM_EVENT_FIELD)
    formData.append(process.env.GOOGLE_FORM_EVENT_FIELD, registration.eventName);
  if (process.env.GOOGLE_FORM_DEPT_FIELD)
    formData.append(process.env.GOOGLE_FORM_DEPT_FIELD, registration.department || '');
  if (process.env.GOOGLE_FORM_SECTION_FIELD)
    formData.append(process.env.GOOGLE_FORM_SECTION_FIELD, registration.section || '');
  if (process.env.GOOGLE_FORM_RRN_FIELD)
    formData.append(process.env.GOOGLE_FORM_RRN_FIELD, registration.rrn || '');
  if (process.env.GOOGLE_FORM_TEAM_FIELD)
    formData.append(process.env.GOOGLE_FORM_TEAM_FIELD, registration.team || '');

  await axios.post(process.env.GOOGLE_FORM_URL, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  await Registration.findByIdAndUpdate(registration._id, {
    googleFormSubmitted: true,
    backupCreatedAt: new Date()
  });
}

module.exports = router;
