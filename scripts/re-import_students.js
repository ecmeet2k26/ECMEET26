const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const StudentData = require('../models/StudentData');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecmeet26';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Clearing existing StudentData...');
        await StudentData.deleteMany({});
        console.log('Cleared successfully.');

        const filePath = 'd:/ecmeet26/frontend-user/public/assets/data/II_YEAR_AIDS_ALL_SECTIONS_HOUSE_ALLOCATION.xls';
        console.log(`\nImporting from: ${filePath}`);
        
        const wb = XLSX.readFile(filePath);
        let totalImported = 0;

        for (const sn of wb.SheetNames) {
            if (sn.includes('Summary')) continue;
            
            console.log(`  Processing Sheet: ${sn}`);
            const s = wb.Sheets[sn];
            const data = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
            
            let startIdx = -1;
            for (let i = 0; i < 20; i++) {
                if(!data[i]) continue;
                const rowStr = data[i].map(String).join(' ').toUpperCase();
                if (rowStr.includes('RRN') || rowStr.includes('REG')) {
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

                const rrn = String(row[1] || '').trim();
                const name = String(row[2] || '').trim();
                let house = String(row[3] || '').trim().toUpperCase();

                if (!rrn || !name || rrn.length < 5) continue;

                // Normalize house
                const validHouses = ['GRYFFINDOR', 'SLYTHERIN', 'RAVENCLAW', 'HUFFLEPUFF'];
                if (!validHouses.includes(house)) {
                    console.log(`    Skipping student ${name} (${rrn}) - Invalid/Missing House: ${house}`);
                    continue;
                }
                house = house.charAt(0) + house.slice(1).toLowerCase();

                try {
                    await StudentData.create({
                        studentName: name,
                        rrn,
                        emailId: `${rrn.toLowerCase()}@crescent.education`,
                        team: house,
                        dept: 'AI&DS',
                        class: 'AI&DS 2nd YEAR',
                        section: sn.slice(-1),
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
            totalImported += sheetCount;
        }

        console.log(`\nSuccess! Re-imported ${totalImported} AIDS students.`);
        process.exit(0);
    } catch (err) {
        console.error('Operation failed:', err);
        process.exit(1);
    }
}

run();
