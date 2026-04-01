const XLSX = require('xlsx');

const file1 = 'd:/ecmeet26/frontend-user/public/assets/data/2ND YEARS_CSE HOUSE  ALLOCATION.xls';
const file2 = 'd:/ecmeet26/frontend-user/public/assets/data/II_YEAR_AIDS_ALL_SECTIONS_HOUSE_ALLOCATION.xls';

function processFile(path) {
    console.log(`\n--- File: ${path} ---`);
    const wb = XLSX.readFile(path);
    wb.SheetNames.forEach(sn => {
        if (sn === 'Export Summary') return;
        console.log(`\n  Sheet: ${sn}`);
        const s = wb.Sheets[sn];
        const data = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
        
        let headerIdx = -1;
        data.slice(0, 30).forEach((row, i) => {
            const str = row.map(String).join(' ').toUpperCase();
            if ((str.includes('NAME') && str.includes('RRN')) || (str.includes('REG') && str.includes('NO'))) {
                headerIdx = i;
                console.log(`    Header at row ${i}:`, row);
            }
        });

        if (headerIdx !== -1) {
            console.log(`    Data Row ${headerIdx + 1}:`, data[headerIdx + 1]);
            console.log(`    Data Row ${headerIdx + 2}:`, data[headerIdx + 2]);
        } else {
            const firstData = data.find(r => r.filter(c => c !== '').length > 2);
            if (firstData) console.log(`    First data row found:`, firstData);
        }
    });
}

processFile(file1);
processFile(file2);
