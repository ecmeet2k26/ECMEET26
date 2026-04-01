/**
 * ECMEET'26 — Generate Sample Student Excel
 * Run: node scripts/createExcel.js
 * This creates data/students.xlsx with sample data
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── Sample Student Data ──────────────────────────────────────────────────────
const students = [
  {
    Student_Name: 'Mohamed Riaz',
    RRN: '230171601108',
    email_id: '230171601108@crescent.education',
    Team: 'Gryffindor',
    dept: 'CSE',
    Class: 'AI&DS',
    section: 'B',
    'contact number': '9344211992'
  },
  {
    Student_Name: 'Ayesha Siddiqui',
    RRN: '230171601109',
    email_id: '230171601109@crescent.education',
    Team: 'Slytherin',
    dept: 'CSE',
    Class: 'AI&DS',
    section: 'A',
    'contact number': '9876543210'
  },
  {
    Student_Name: 'Rahul Verma',
    RRN: '230171601110',
    email_id: '230171601110@crescent.education',
    Team: 'Ravenclaw',
    dept: 'CSE',
    Class: 'AI&DS',
    section: 'B',
    'contact number': '9123456780'
  },
  {
    Student_Name: 'Priya Nambiar',
    RRN: '230171601111',
    email_id: '230171601111@crescent.education',
    Team: 'Hufflepuff',
    dept: 'CSE',
    Class: 'AI&DS',
    section: 'C',
    'contact number': '9234567891'
  }
];

// ── Create Main Excel ──────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(students);

// Column widths
ws['!cols'] = [
  { wch: 20 }, { wch: 15 }, { wch: 35 },
  { wch: 15 }, { wch: 10 }, { wch: 10 },
  { wch: 10 }, { wch: 15 }
];

XLSX.utils.book_append_sheet(wb, ws, 'Students');

const outputPath = path.join(dataDir, 'students.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`✅ Created students.xlsx at: ${outputPath}`);

// ── Create Team-wise Excel files ───────────────────────────────────────────────
const teams = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'];

teams.forEach(team => {
  const teamStudents = students.filter(s => s.Team === team);
  const teamWb = XLSX.utils.book_new();
  const teamWs = XLSX.utils.json_to_sheet(teamStudents);
  XLSX.utils.book_append_sheet(teamWb, teamWs, team);

  const teamPath = path.join(dataDir, `team_${team.toLowerCase()}.xlsx`);
  XLSX.writeFile(teamWb, teamPath);
  console.log(`✅ Created team_${team.toLowerCase()}.xlsx`);
});

console.log('\n📋 Instructions:');
console.log('1. Open students.xlsx and add all students');
console.log('2. Run: node scripts/importStudents.js to import into MongoDB');
