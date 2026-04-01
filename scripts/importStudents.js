/**
 * ECMEET'26 — Import Students from Excel to MongoDB
 * Run: node scripts/importStudents.js
 */
require('dotenv').config({ path: '../.env' });
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
const StudentData = require('../models/StudentData');

async function importStudents() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecmeet26');
  console.log('✅ Connected to MongoDB');

  const filePath = path.join(__dirname, '../data/students.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  let count = 0;
  for (const row of rows) {
    try {
      await StudentData.findOneAndUpdate(
        { emailId: row['email_id']?.toLowerCase() },
        {
          studentName: row['Student_Name'],
          rrn: String(row['RRN']),
          emailId: row['email_id']?.toLowerCase(),
          team: row['Team'],
          dept: row['dept'],
          class: row['Class'],
          section: row['section'],
          contactNumber: String(row['contact number'] || '')
        },
        { upsert: true, new: true }
      );
      count++;
      console.log(`  ✓ ${row['Student_Name']} (${row['email_id']})`);
    } catch (err) {
      console.error(`  ✗ Error for ${row['email_id']}: ${err.message}`);
    }
  }

  console.log(`\n✅ Imported ${count} students`);
  await mongoose.disconnect();
}

importStudents().catch(console.error);
