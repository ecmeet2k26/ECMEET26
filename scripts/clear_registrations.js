const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Registration = require('../models/Registration');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26';
    await mongoose.connect(mongoUri);
    console.log('connected');
    const res = await Registration.deleteMany({});
    console.log(`Successfully deleted ${res.deletedCount} registrations.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
