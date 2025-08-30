const fs = require('fs');

// Read the CSV file
const csvContent = fs.readFileSync('test_trades.csv', 'utf8');
const lines = csvContent.trim().split('\n');

console.log('=== CSV DEBUG ANALYSIS ===');
console.log('Total lines:', lines.length);
console.log('');

// Parse first line (headers)
const headerLine = lines[0];
console.log('Raw header line:', headerLine);

// Parse headers - handle quoted CSV
const headers = headerLine.split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
console.log('Parsed headers:', headers);
console.log('');

// Test parsing first few data rows
for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
  const line = lines[i];
  console.log(`=== ROW ${i + 1} ===`);
  console.log('Raw line:', line);
  
  // Parse values
  let values = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  console.log('Parsed values:', values);
  
  // Create row object
  const row = {};
  headers.forEach((header, index) => {
    row[header] = (values[index] || '').replace(/^"(.*)"$/, '$1');
  });
  
  console.log('Row object:', row);
  
  // Test validation
  const action = String(row.Action || '').trim();
  const symbol = String(row.Symbol || '').trim();
  const quantityStr = String(row.Quantity || '').replace(/[,$]/g, '').trim();
  const quantity = Math.abs(parseFloat(quantityStr) || 0);
  const priceStr = String(row.Price || '').replace(/[$,]/g, '').trim();
  const price = parseFloat(priceStr) || 0;
  
  console.log('Validation check:');
  console.log('  Action:', `"${action}"`, action && ['Buy', 'Sell'].includes(action) ? '✅' : '❌');
  console.log('  Symbol:', `"${symbol}"`, symbol ? '✅' : '❌');
  console.log('  Quantity:', `"${row.Quantity}" -> "${quantityStr}" -> ${quantity}`, quantity > 0 ? '✅' : '❌');
  console.log('  Price:', `"${row.Price}" -> "${priceStr}" -> ${price}`, price > 0 ? '✅' : '❌');
  
  // Test date parsing
  const dateStr = String(row.Date || '').trim();
  let dateValid = false;
  let parsedDate = null;
  
  try {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts.map(p => parseInt(p, 10));
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
          parsedDate = new Date(year, month - 1, day);
          dateValid = !isNaN(parsedDate.getTime());
        }
      }
    }
  } catch (e) {
    dateValid = false;
  }
  
  console.log('  Date:', `"${dateStr}" -> ${parsedDate ? parsedDate.toDateString() : 'FAILED'}`, dateValid ? '✅' : '❌');
  console.log('');
}
