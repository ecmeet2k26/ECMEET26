require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Event = require('../models/Event');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

const eventsList = [
    {
      "id": "dance",
      "name": "Dance (Solo)",
      "category": "Cultural",
      "description": "Showcase your dance talent in solo or group performances.",
      "maxParticipants": 100,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": ["dance_rules.png.jpg"],
      "coordinator": {
        "name": "Riaz / Aishwarya",
        "contact": "9344211992 / 6381602514",
        "department": "AIDS-B / IOT"
      },
      "registrationOpen": true
    },
    {
      "id": "dance_group",
      "name": "Dance (Group)",
      "category": "Cultural",
      "description": "Showcase your dance talent in solo or group performances.",
      "maxParticipants": 100,
      "teamSize": "2-5",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Riaz / Aishwarya",
        "contact": "9344211992 / 6381602514",
        "department": "AIDS-B / IOT"
      },
      "registrationOpen": true
    },
    {
      "id": "singing",
      "name": "Singing",
      "category": "Cultural",
      "description": "Solo singing competition to showcase your vocal skills.",
      "maxParticipants": 80,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Rahman / Amrita",
        "contact": "9514831431 / 8807580188",
        "department": "CSE-B / CSE-B"
      },
      "registrationOpen": true
    },
    {
      "id": "fashion",
      "name": "Fashion",
      "category": "Cultural",
      "description": "Ramp walk and fashion showcase event.",
      "maxParticipants": 60,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Imran / Jayasri",
        "contact": "9791818260 / 9962450928",
        "department": "CSE-B / AIDS-A"
      },
      "registrationOpen": true
    },
    {
      "id": "mehendi",
      "name": "Mehendi",
      "category": "Cultural",
      "description": "Creative mehendi design competition.",
      "maxParticipants": 40,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Madeeha / Zainab",
        "contact": "6380794906 / 7397688633",
        "department": "AIDS-B / CSE-D"
      },
      "registrationOpen": true
    },
    {
      "id": "chess",
      "name": "Chess",
      "category": "Sports",
      "description": "Strategic chess competition.",
      "maxParticipants": 50,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Wajith / Famila",
        "contact": "8668087619 / 6385555381",
        "department": "CSE-B / Cyber"
      },
      "registrationOpen": true
    },
    {
      "id": "Photography",
      "name": "Photography",
      "category": "Media",
      "description": "Capture and create visual stories through photos or videos.",
      "maxParticipants": 100,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Nadheem / Jocelin ",
        "contact": "6383891852 / 9025742470",
        "department": "IOT "
      },
      "registrationOpen": true
    },
    {
      "id": "Reels",
      "name": "Reels",
      "category": "Media",
      "description": "Capture and create visual stories through photos or videos.",
      "maxParticipants": 100,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Niyaz",
        "contact": "9626635867",
        "department": "IOT"
      },
      "registrationOpen": true
    },
    {
      "id": "ShortFilm",
      "name": "Short Film",
      "category": "Media",
      "description": "Capture and create visual stories through photos or videos.",
      "maxParticipants": 70,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Zainab",
        "contact": "9865048888",
        "department": "Cyber"
      },
      "registrationOpen": true
    },
    {
      "id": "box_cricket",
      "name": "Box Cricket",
      "category": "Sports",
      "description": "Fast-paced cricket played in a compact arena.",
      "maxParticipants": 100,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Akram / Bhuvanesh",
        "contact": "9003969809 / 9342421920",
        "department": "CSE-B / IOT"
      },
      "registrationOpen": true
    },
    {
      "id": "football",
      "name": "Petti Post Football",
      "category": "Sports",
      "description": "Mini football tournament.",
      "maxParticipants": 100,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Asif / Jaffar",
        "contact": "9360476268 / 8056232333",
        "department": "AIDS-B / CSE-B"
      },
      "registrationOpen": true
    },
    {
      "id": "kho_kho",
      "name": "Kho-Kho",
      "category": "Sports",
      "description": "Traditional Indian tag sport.",
      "maxParticipants": 60,
      "teamSize": "1",
      "venue": "Ground",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Vishnu / Stefina",
        "contact": "9025459025 / 9940410303",
        "department": "CSE-D / AIDS-C"
      },
      "registrationOpen": true
    },
    {
      "id": "tug_of_war",
      "name": "Tug of War",
      "category": "Sports",
      "description": "Team strength competition.",
      "maxParticipants": 80,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Adel / Sandhiya Sree",
        "contact": "7402227577 / 7010959537",
        "department": "CSE-A / CSE-C"
      },
      "registrationOpen": true
    },
    {
      "id": "volleyball",
      "name": "Volley Ball",
      "category": "Sports",
      "description": "Team-based volleyball competition.",
      "maxParticipants": 80,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Jaseel / Faraz Akram",
        "contact": "7397072570 / 7708580038",
        "department": "CSE-D / AIDS-A"
      },
      "registrationOpen": true
    },
    {
      "id": "throwball",
      "name": "Throw Ball",
      "category": "Sports",
      "description": "Throwball match competition.",
      "maxParticipants": 60,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Nusra / Sara Sakeena",
        "contact": "9080023828 / 7305958242",
        "department": "CSE-C / CSE-D"
      },
      "registrationOpen": true
    },
    {
      "id": "cooking",
      "name": "Fireless Cooking",
      "category": "Cultural",
      "description": "Cooking without fire using creativity.",
      "maxParticipants": 40,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Gayathri / Jayasree",
        "contact": "9499001593 / 7200807135",
        "department": "CSE-A / AIDS-A"
      },
      "registrationOpen": true
    },
    {
      "id": "fitness",
      "name": "Fitness",
      "category": "Sports",
      "description": "Fitness and endurance competition.",
      "maxParticipants": 50,
      "teamSize": "1",
      "venue": "",
      "date": "",
      "time": "",
      "rules": [],
      "coordinator": {
        "name": "Naffir / Chatuniya",
        "contact": "9500257521 / 9080829662",
        "department": "CSE-C / AIDS-C"
      },
      "registrationOpen": true
    }
];

async function seed() {
  try {
    console.log('🔄 Connecting to MongoDB for seeding...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    // Clear existing events to avoid duplicates and ensure a clean list
    await Event.deleteMany({});
    console.log('🗑️  Cleared existing events.');

    for (let i = 0; i < eventsList.length; i++) {
        const ev = eventsList[i];
        await Event.create({ ...ev, order: i });
        console.log(`  ✅ Added: ${ev.name}`);
    }

    console.log('🎉 Seeding successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
