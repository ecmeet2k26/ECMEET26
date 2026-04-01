const mongoose = require('mongoose');

const studentDataSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  rrn: { type: String, required: true, unique: true },
  emailId: { type: String, required: true, unique: true, lowercase: true },
  team: { type: String, required: true },
  dept: { type: String },
  year: { type: String },
  section: { type: String },
  contactNumber: { type: String },
  profilePicture: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('StudentData', studentDataSchema);
