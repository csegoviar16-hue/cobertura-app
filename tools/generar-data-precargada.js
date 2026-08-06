// Genera data-precargada.json a partir del Excel mensual "Data <Mes>.xlsx".
// Uso:
//   node tools/generar-data-precargada.js "C:\ruta\Data Julio.xlsx" 2026-07
// El segundo argumento es la versión (YYYY-MM del mes del archivo). La app
// detecta la versión nueva al abrir y precarga CUP/DDD/SIT automáticamente.
//
// Nota: los archivos de OneDrive deben copiarse antes a una ruta local
// (ej. Downloads) o pasarse como buffer; XLSX.readFile no los hidrata.

const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'lib', 'xlsx.full.min.js'));
globalThis.XLSX = XLSX;

// Reutilizar el parser real de la app (js/data-excel.js) evaluándolo en este contexto
const parserSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'data-excel.js'), 'utf8');
eval(parserSrc + '\nglobalThis.__parser = { DATA_EXCEL_SHEETS, findSheetName, parseCupSheet, parseDddSheet, parseInvRotSheet };');
const P = globalThis.__parser;

const [,, archivo, version] = process.argv;
if (!archivo || !version || !/^\d{4}-\d{2}$/.test(version)) {
  console.error('Uso: node tools/generar-data-precargada.js "<ruta Excel>" <YYYY-MM>');
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' });
const sheets = wb.SheetNames;
console.log('Hojas:', sheets.join(' | '));

const read = cands => {
  const n = P.findSheetName(sheets, cands);
  if (!n) { console.error('HOJA NO ENCONTRADA entre:', cands.join(', ')); return []; }
  return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
};

const cup = P.parseCupSheet(read(P.DATA_EXCEL_SHEETS.cupFanter), 'Fanter')
  .concat(P.parseCupSheet(read(P.DATA_EXCEL_SHEETS.cupTerovan), 'Terovan'));
const ddd = P.parseDddSheet(read(P.DATA_EXCEL_SHEETS.dddFanter), 'Fanter')
  .concat(P.parseDddSheet(read(P.DATA_EXCEL_SHEETS.dddTerovan), 'Terovan'));
const sitF = P.parseInvRotSheet(read(P.DATA_EXCEL_SHEETS.sitFanter), 'Fanter');
const sitT = P.parseInvRotSheet(read(P.DATA_EXCEL_SHEETS.sitTerovan), 'Terovan');
const sit = sitF.rows.concat(sitT.rows);
const labels = sitF.mesLabels.length ? sitF.mesLabels : sitT.mesLabels;

if (!cup.length && !ddd.length && !sit.length) {
  console.error('ERROR: no se parseó nada; revisar nombres de hojas');
  process.exit(1);
}

const out = { version, fecha: new Date().toISOString(), cup, ddd, sit, dataSitMesLabels: labels };
const destino = path.join(__dirname, '..', 'data-precargada.json');
fs.writeFileSync(destino, JSON.stringify(out));
console.log(`OK -> data-precargada.json (version ${version}): ${cup.length} CUP, ${ddd.length} DDD, ${sit.length} SIT, labels: ${JSON.stringify(labels)}`);
