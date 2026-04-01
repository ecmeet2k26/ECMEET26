require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Event = require('../models/Event');
const CONFIG = require('../config/events.config');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26';

async function migrate() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    const staticEvents = CONFIG.events || [];
    console.log(`📦 Found ${staticEvents.length} static events.`);

    for (let i = 0; i < staticEvents.length; i++) {
        const ev = staticEvents[i];
        
        // Prepare coordinator object
        const coordinator = {
            name: ev.coordinatorName || ev.coordinator?.name || '',
            contact: ev.coordinatorContact || ev.coordinator?.contact || '',
            department: ev.coordinatorDept || ev.coordinator?.department || ''
        };

        const eventData = {
            id: ev.id,
            name: ev.name,
            category: ev.category,
            description: ev.description,
            venue: ev.venue,
            date: ev.date,
            time: ev.time,
            maxParticipants: ev.maxParticipants,
            teamSize: ev.teamSize,
            coordinator,
            rules: Array.isArray(ev.rules) ? ev.rules : [],
            registrationOpen: ev.registrationOpen !== false,
            order: i
        };

        await Event.findOneAndUpdate(
            { id: ev.id },
            { $set: eventData },
            { upsert: true, new: true }
        );
        console.log(`  ✅ Synced: ${ev.name}`);
    }

    console.log('🎉 Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
