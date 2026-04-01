require('dotenv').config();
const mongoose = require('mongoose');

async function bruteForce() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    console.log('Connected to:', uri.split('@')[1] || uri);
    
    const db = mongoose.connection.db;
    const collections = ['studentdatas', 'users'];
    const houses = [
      { regex: /gryffindor/i, fixed: 'Gryffindor' },
      { regex: /slytherin/i, fixed: 'Slytherin' },
      { regex: /ravenclaw/i, fixed: 'Ravenclaw' },
      { regex: /hufflepuff/i, fixed: 'Hufflepuff' }
    ];

    for (const colName of collections) {
      console.log(`Processing ${colName}...`);
      for (const h of houses) {
        const res = await db.collection(colName).updateMany(
          { team: h.regex },
          { $set: { team: h.fixed } }
        );
        console.log(` - ${colName}: ${h.fixed} updated ${res.modifiedCount} docs`);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

bruteForce();
