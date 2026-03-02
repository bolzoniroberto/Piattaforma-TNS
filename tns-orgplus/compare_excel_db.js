const XLSX = require('xlsx');
const { execSync } = require('child_process');

// Read Excel
const wb = XLSX.readFile('/Users/robertobolzoni/Downloads/01_31.01.2026_puntuali con filtri.xlsx');
const ws = wb.Sheets['DB'];
const excelRows = XLSX.utils.sheet_to_json(ws, { defval: null });

// Build map: CF -> { name, struttura }
const excelByCF = new Map();
excelRows.forEach(row => {
  const cf = String(row['Codice Fiscale'] || '').trim();
  if (!cf || cf.length !== 16) return;
  const cognome = String(row['Cognome'] || '').trim();
  const nome = String(row['Nome'] || '').trim();
  const struttura = String(row['Codice struttura - livello 2'] || row['Codice struttura - livello 1'] || '').trim();
  excelByCF.set(cf, { name: cognome + ' ' + nome, struttura });
});

console.log('Excel unique CFs (16 chars):', excelByCF.size);

// Read DB via sqlite3 CLI
const dbRows = execSync("sqlite3 '/Users/robertobolzoni/Library/Application Support/tns-orgplus/orgplus.db' \"SELECT codice_fiscale, titolare, codice_struttura FROM dipendenti WHERE deleted_at IS NULL\"").toString().trim();
const dbByCF = new Map();
dbRows.split('\n').forEach(line => {
  if (!line.trim()) return;
  const [cf, titolare, struttura] = line.split('|');
  if (cf) dbByCF.set(cf.trim(), { titolare: (titolare || '').trim(), struttura: (struttura || '').trim() });
});

console.log('DB active dipendenti:', dbByCF.size);

// NEW (in Excel but not in DB)
const newHires = [];
excelByCF.forEach((data, cf) => {
  if (!dbByCF.has(cf)) {
    newHires.push({ cf, name: data.name, struttura: data.struttura });
  }
});
console.log('\n=== NUOVI ASSUNTI (in Excel ma non in DB) ===');
console.log('Count:', newHires.length);
newHires.forEach(h => console.log(h.cf, '|', h.name, '|', h.struttura));

// LEAVERS (in DB but not in Excel)
const leavers = [];
dbByCF.forEach((data, cf) => {
  if (!excelByCF.has(cf)) {
    leavers.push({ cf, titolare: data.titolare, struttura: data.struttura });
  }
});
console.log('\n=== CESSATI (in DB ma non in Excel) ===');
console.log('Count:', leavers.length);
leavers.forEach(l => console.log(l.cf, '|', l.titolare, '|', l.struttura));
