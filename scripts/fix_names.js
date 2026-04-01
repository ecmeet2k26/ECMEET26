const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

// We need the User model. Since scripts are often run standalone, 
// let's define a minimal schema if the model import fails or keep it simple.
const userSchema = new mongoose.Schema({
  name: String,
  email: String
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function fixNames() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26';
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const users = await User.find({ name: /btech/i });
    console.log(`Found ${users.length} users with "btech" in their name.`);

    let updatedCount = 0;
    for (const user of users) {
      const oldName = user.name;
      const newName = oldName.replace(/\s*btech.*/i, '').trim();
      
      if (oldName !== newName) {
        user.name = newName;
        await user.save();
        console.log(`Updated: "${oldName}" -> "${newName}"`);
        updatedCount++;
      }
    }

    console.log(`Finished. Total updated: ${updatedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

fixNames();
