require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB:', uri.split('@')[1] || uri);
    
    const db = mongoose.connection.db;
    
    const normalize = (t) => {
      if (!t) return t;
      const clean = String(t).trim().toLowerCase();
      const map = {
        'gryffindor': 'Gryffindor',
        'slytherin': 'Slytherin',
        'ravenclaw': 'Ravenclaw',
        'hufflepuff': 'Hufflepuff'
      };
      return map[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
    };

    const studentCol = db.collection('studentdatas');
    const userCol = db.collection('users');

    const students = await studentCol.find({}).toArray();
    let sCount = 0;
    for (const s of students) {
      const n = normalize(s.team);
      if (n !== s.team) {
        await studentCol.updateOne({ _id: s._id }, { $set: { team: n } });
        sCount++;
      }
    }
    console.log('StudentData House Normalized:', sCount, 'docs');

    const users = await userCol.find({}).toArray();
    let uCount = 0;
    for (const u of users) {
      const n = normalize(u.team);
      if (n !== u.team) {
        await userCol.updateOne({ _id: u._id }, { $set: { team: n } });
        uCount++;
      }
    }
    console.log('User House Normalized:', uCount, 'docs');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
