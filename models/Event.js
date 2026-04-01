const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  category: { 
    type: String, 
    default: 'Cultural' 
  },
  description: { 
    type: String, 
    default: '' 
  },
  venue: { 
    type: String, 
    default: '' 
  },
  date: { 
    type: String, 
    default: '' 
  },
  time: { 
    type: String, 
    default: '' 
  },
  maxParticipants: { 
    type: Number, 
    default: 100 
  },
  teamSize: { 
    type: String, 
    default: '1' 
  },
  coordinator: {
    name: { type: String, default: '' },
    contact: { type: String, default: '' },
    department: { type: String, default: '' }
  },
  rules: { 
    type: [String], 
    default: [] 
  },
  registrationOpen: { 
    type: Boolean, 
    default: true 
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);
