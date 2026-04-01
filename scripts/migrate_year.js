const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ecmeet26');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Rename class to year in studentdatas
    const res1 = await db.collection('studentdatas').updateMany(
      { class: { $exists: true } }, 
      { $rename: { "class": "year" } }
    );
    console.log('StudentData Migration:', res1.modifiedCount, 'documents updated');
    
    // Rename class to year in users
    const res2 = await db.collection('users').updateMany(
      { class: { $exists: true } }, 
      { $rename: { "class": "year" } }
    );
    console.log('User Migration:', res2.modifiedCount, 'documents updated');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
