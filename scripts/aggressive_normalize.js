require('dotenv').config();
const mongoose = require('mongoose');

async function aggressiveNormalize() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collections = ['studenttdatas', 'studentdatas', 'users'];
    
    const houses = [
      { regex: /gryffindor/i, fixed: 'Gryffindor' },
      { regex: /slytherin/i, fixed: 'Slytherin' },
      { regex: /ravenclaw/i, fixed: 'Ravenclaw' },
      { regex: /hufflepuff/i, fixed: 'Hufflepuff' }
    ];

    for (const name of collections) {
      console.log(`Checking collection: ${name}`);
      const cursor = await db.collection(name).find({});
      const docs = await cursor.toArray();
      console.log(` - Found ${docs.length} docs`);

      for (const doc of docs) {
        if (!doc.team) continue;
        
        let normalized = doc.team.toString().replace(/[\r\n\t]/g, '').trim();
        const low = normalized.toLowerCase();
        
        let found = false;
        for (const h of houses) {
          if (low.includes(h.fixed.toLowerCase())) {
            normalized = h.fixed;
            found = true;
            break;
          }
        }

        if (normalized !== doc.team || found) {
          await db.collection(name).updateOne(
            { _id: doc._id },
            { $set: { team: normalized } }
          );
        }
      }
    }
    
    console.log('Aggressive Normalization Finished');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

aggressiveNormalize();
