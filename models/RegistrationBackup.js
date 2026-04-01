const mongoose = require('mongoose');

const registrationBackupSchema = new mongoose.Schema({
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

// We don't set a unique index here because it's a backup log.
// Multiple entries for the same user+event might be useful for history.
// registrationBackupSchema.index({ userId: 1, eventId: 1 }); 

module.exports = mongoose.model('RegistrationBackup', registrationBackupSchema, 'registration_backup');
