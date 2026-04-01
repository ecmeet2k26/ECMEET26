const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const StudentData = require('../models/StudentData');

async function syncProfilePics() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26');
    console.log('Connected.');

    const users = await User.find({ profilePicture: { $exists: true, $ne: null } });
    console.log(`Found ${users.length} users with profile pictures.`);

    let synced = 0;
    for (const user of users) {
      const result = await StudentData.findOneAndUpdate(
        { emailId: user.email.toLowerCase() },
        { $set: { profilePicture: user.profilePicture } },
        { new: true }
      );
      if (result) {
        synced++;
      }
    }

    console.log(`Successfully synced ${synced} profile pictures to StudentData.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

syncProfilePics();
