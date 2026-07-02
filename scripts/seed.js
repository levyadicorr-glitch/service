const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const excelPath = path.join(__dirname, '../customers_report_20260701.xlsx');
const dbPath = path.join(__dirname, '../db.json');

console.log('Reading Excel file from:', excelPath);

if (!fs.existsSync(excelPath)) {
  console.error('Excel file not found!');
  process.exit(1);
}

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // The headers are at row index 3 (range: 3), which is row 4 in Excel.
  const rawData = xlsx.utils.sheet_to_json(worksheet, { range: 3 });
  
  console.log(`Successfully parsed ${rawData.length} rows from Excel.`);

  // Load existing DB to preserve customer UUIDs and service requests
  let existingRequests = [];
  let existingCustomers = [];
  if (fs.existsSync(dbPath)) {
    try {
      const dbContent = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      if (dbContent.serviceRequests) {
        existingRequests = dbContent.serviceRequests;
      }
      if (dbContent.customers) {
        existingCustomers = dbContent.customers;
      }
    } catch (e) {
      console.log('No valid existing db.json found, creating a new one.');
    }
  }

  const customers = rawData.map(row => {
    const excelId = Number(row['מס׳']) || 0;
    const phone = row['טלפון'] ? row['טלפון'].toString().trim() : undefined;
    
    // Preserve existing customer ID to not break linked service requests
    const existing = existingCustomers.find(c => 
      (c.excelId && c.excelId === excelId) || (c.phone && phone && c.phone === phone)
    );

    // Map fields and handle undefined/empty values
    return {
      id: existing ? existing.id : crypto.randomUUID(),
      excelId,
      firstName: (row['שם פרטי'] || '').toString().trim(),
      lastName: (row['שם משפחה'] || '').toString().trim(),
      phone,
      email: row['אימייל'] ? row['אימייל'].toString().trim() : undefined,
      address: row['כתובת'] ? row['כתובת'].toString().trim() : undefined,
      licensePlate: row['מס׳ רישוי'] ? row['מס׳ רישוי'].toString().trim() : undefined,
      color: row['צבע כלי'] ? row['צבע כלי'].toString().trim() : undefined,
      serialNumber: row['מס׳ סריאלי'] ? row['מס׳ סריאלי'].toString().trim() : undefined,
    };
  }).filter(c => c.firstName !== '' || c.lastName !== ''); // filter empty rows

  console.log(`Formatted ${customers.length} customers.`);

  const dbData = {
    customers,
    serviceRequests: existingRequests
  };

  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf-8');
  console.log(`Successfully seeded db.json with ${customers.length} customers and preserved existing requests!`);

} catch (err) {
  console.error('Error seeding database:', err);
  process.exit(1);
}
