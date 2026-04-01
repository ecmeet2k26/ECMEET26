const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const StudentData = require('../models/StudentData');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecmeet26';

const files = [
    'd:/ecmeet26/frontend-user/public/assets/data/2ND YEARS_CSE HOUSE  ALLOCATION.xls',
    'd:/ecmeet26/frontend-user/public/assets/data/II_YEAR_AIDS_ALL_SECTIONS_HOUSE_ALLOCATION.xls'
];

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Clearing existing StudentData...');
        await StudentData.deleteMany({});
        console.log('Cleared successfully.');

        let totalProcessed = 0;

        for (const filePath of files) {
            console.log(`\nProcessing file: ${filePath}`);
            const wb = XLSX.readFile(filePath);

            for (const sn of wb.SheetNames) {
                if (sn.includes('Summary')) continue;
                
                console.log(`  Processing Sheet: ${sn}`);
                const s = wb.Sheets[sn];
                const data = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
                
                let startIdx = -1;
                for (let i = 0; i < 30; i++) {
                    if(!data[i]) continue;
                    const rowStr = data[i].map(String).join(' ').toUpperCase();
                    if (rowStr.includes('RRN') || (rowStr.includes('REG') && rowStr.includes('NO'))) {
                        startIdx = i + 1;
                        break;
                    }
                }

                if (startIdx === -1) {
                    console.warn(`    Warning: Could not find headers in ${sn}. Skipping.`);
                    continue;
                }

                let sheetCount = 0;
                for (let i = startIdx; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length < 4) continue;

                    // S.no, RRN, Student_Name, Team, Year, dept, section
                    const rrn = String(row[1] || '').trim();
                    const name = String(row[2] || '').trim();
                    let house = String(row[3] || '').trim().toUpperCase();
                    const year = String(row[4] || '').trim();
                    const dept = String(row[5] || '').trim();
                    const section = String(row[6] || '').trim();

                    if (!rrn || !name || rrn.length < 5) continue;

                    // Normalize house
                    const validHouses = ['GRYFFINDOR', 'SLYTHERIN', 'RAVENCLAW', 'HUFFLEPUFF'];
                    if (!validHouses.includes(house)) {
                        console.warn(`    Skipping row - Invalid House: ${house} for ${name}`);
                        continue; 
                    } else {
                        house = house.charAt(0) + house.slice(1).toLowerCase();
                    }

                    try {
                        await StudentData.create({
                            studentName: name,
                            rrn,
                            emailId: `${rrn.toLowerCase()}@crescent.education`,
                            team: house,
                            dept: dept,
                            class: year,
                            section: section,
                            contactNumber: ''
                        });
                        sheetCount++;
                    } catch (e) {
                        if (e.code === 11000) {
                            console.warn(`    Duplicate RRN/Email skipped: ${rrn}`);
                        } else {
                            throw e;
                        }
                    }
                }
                console.log(`    Imported ${sheetCount} students from ${sn}`);
                totalProcessed += sheetCount;
            }
        }

        console.log(`\nSuccess! Re-imported ${totalProcessed} students.`);
        process.exit(0);
    } catch (err) {
        console.error('Operation failed:', err);
        process.exit(1);
    }
}

run();
