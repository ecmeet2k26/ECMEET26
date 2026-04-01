const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  // User info (snapshot at time of registration)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  profilePicture: { type: String },
  rrn: { type: String },
  team: { type: String },
  department: { type: String },
  section: { type: String },
  contactNumber: { type: String },

  // Event info
  eventId: { type: String, required: true },
  eventName: { type: String, required: true },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed'
  },

  // Backup tracking
  googleFormSubmitted: { type: Boolean, default: false },
  backupCreatedAt: { type: Date },

}, { timestamps: true });

// Prevent duplicate registrations
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
