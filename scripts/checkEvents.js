require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Event = require('../models/Event');

const MONGO_URI = process.env.MONGO_URI;

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26');
  const count = await Event.countDocuments();
  console.log(`📊 Total Events in DB: ${count}`);
  process.exit(0);
}
check();
