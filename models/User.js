const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Google Auth data
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  profilePicture: { type: String },

  // From Excel
  rrn: { type: String },
  team: { type: String, enum: ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff', null] },
  department: { type: String },
  year: { type: String },
  section: { type: String },
  contactNumber: { type: String },

  // System flags
  houseRevealed: { type: Boolean, default: false },
  role: {
    type: String,
    enum: ['student', 'coordinator', 'captain', 'admin', 'dev'],
    default: 'student'
  },
  assignedEvents: [{ type: String }],
  isActive: { type: Boolean, default: true },

  // Analytics
  lastLogin: { type: Date, default: Date.now },
  loginCount: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: false },

  // Sorting Hat Persistence
  sortingCombo: {
    idleIdx: { type: Number },
    thinkingIdx: { type: Number },
    readingIdx: { type: Number },
    chosenIdx: { type: Number },
    houseIdx: { type: Number }
  },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
