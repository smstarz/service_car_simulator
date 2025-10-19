// CSV validation & normalization utilities
// Exports a single function: validateAndNormalizeRows(rows)
// - rows: array of rows (first row is header), each row is array of cell strings
// Returns:
// - { ok: true, rows: normalizedRows } on success
// - { ok: false, errors: [{ row: <1-based data index>, message: string }, ...] } on failure

function randomId6() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function isTimeHHMMSS(s) {
  if (typeof s !== 'string') return false;
  // allow leading/trailing spaces
  s = s.trim();
  const m = s.match(/^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
  return !!m;
}

// Validate and normalize CSV rows. Header row is expected at rows[0]. Data rows start at index 1.
export function validateAndNormalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, errors: [{ row: 0, message: 'CSV is empty or invalid format' }] };
  }

  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const requiredFields = ['id','address','longitude','latitude','time','job_type'];

  // map header names to indexes
  const idxMap = {};
  header.forEach((h, i) => { idxMap[h] = i; });

  // check required headers exist
  const missing = requiredFields.filter(f => !(f in idxMap));
  if (missing.length) {
    return { ok: false, errors: [{ row: 0, message: 'Missing required headers: ' + missing.join(',') }] };
  }

  const seenIds = new Set();
  const normalized = [rows[0]]; // keep header
  const errors = [];

  // First pass: normalize ids (generate missing/invalid, remove duplicates)
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r].map(c => (c == null ? '' : String(c).trim()));
    const idIdx = idxMap['id'];
    let idVal = row[idIdx];
    if (!idVal || idVal.length !== 6) {
      let newId;
      do { newId = randomId6(); } while (seenIds.has(newId));
      idVal = newId;
      row[idIdx] = idVal;
    }
    if (seenIds.has(idVal)) {
      let newId;
      do { newId = randomId6(); } while (seenIds.has(newId));
      idVal = newId;
      row[idIdx] = idVal;
    }
    seenIds.add(idVal);
    normalized.push(row);
  }

  // Second pass: validate required fields and time format on normalized rows
  for (let r = 1; r < normalized.length; r++) {
    const row = normalized[r];
    const dataRowIndex = r; // 1-based relative to data rows
    for (const f of ['address','longitude','latitude','time','job_type']) {
      const i = idxMap[f];
      if (!row[i]) {
        errors.push({ row: dataRowIndex, field: f, message: `${f} is required but empty` });
      }
    }
    const timeIdx = idxMap['time'];
    if (row[timeIdx] && !isTimeHHMMSS(row[timeIdx])) {
      errors.push({ row: dataRowIndex, field: 'time', message: `time has invalid format (expected hh:mm:ss): "${row[timeIdx]}"` });
    }
  }

  // always return normalized rows so caller can render and highlight errors
  if (errors.length) return { ok: false, rows: normalized, errors };
  return { ok: true, rows: normalized, errors: [] };
}

export default { validateAndNormalizeRows };
