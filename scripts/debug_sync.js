const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const StudentData = require('../models/StudentData');

async function debugSync() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26');
    const users = await User.find({ profilePicture: { $exists: true, $ne: null } });
    for (const u of users) {
      console.log('User Email:', u.email);
      const student = await StudentData.findOne({ emailId: u.email.toLowerCase() });
      if (student) {
        console.log('Found StudentData for:', u.email);
      } else {
        console.log('No StudentData found for:', u.email);
        // Try searching without lowercase?
        const student2 = await StudentData.findOne({ emailId: new RegExp(`^${u.email}$`, 'i') });
        if (student2) {
          console.log('Found StudentData (case-insensitive) for:', u.email, 'Actual email in DB:', student2.emailId);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
debugSync();
