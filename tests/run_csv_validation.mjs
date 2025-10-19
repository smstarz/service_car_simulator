import fs from 'fs';
import path from 'path';
import { validateAndNormalizeRows } from '../public/utils/csv.js';

function parseCSVForTest(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i+1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      row.push(cur);
      cur = '';
      if (ch === '\r' && next === '\n') i++;
      if (!(row.length === 1 && row[0] === '')) {
        rows.push(row);
      }
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.map(r => r.map(c => (c == null ? '' : c.toString().trim())));
}

const csvPath = path.join(process.cwd(), 'tests', 'sample_invalid.csv');
const text = fs.readFileSync(csvPath, 'utf8');
const rows = parseCSVForTest(text);
console.log('Parsed rows:', rows.length);
const res = validateAndNormalizeRows(rows);
console.log('Validation result:');
console.dir(res, { depth: 4 });
