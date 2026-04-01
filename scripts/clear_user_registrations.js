const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Registration = require('../models/Registration');

async function clearRegistrations() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26';
    await mongoose.connect(mongoUri);
    console.log('connected to db');

    // Target User: Mohamed Riaz (RRN: 230171601108)
    const result = await Registration.deleteMany({
      $or: [
        { rrn: '230171601108' },
        { name: 'Mohamed Riaz' }
      ]
    });

    console.log(`Successfully cleared ${result.deletedCount} registrations.`);
    process.exit(0);
  } catch (err) {
    console.error('Error clearing registrations:', err);
    process.exit(1);
  }
}

clearRegistrations();
