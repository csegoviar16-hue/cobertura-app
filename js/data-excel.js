// ===== PARSER DE EXCEL DATA (Data cruda mayo.xlsx) =====
// Lee las hojas específicas del Excel que el usuario sube desde el celular/PC.

const DATA_EXCEL_SHEETS = {
  cupFanter: ['Cup Mayo Fanter', 'CUP Mayo Fanter', 'Cup Fanter'],
  cupTerovan: ['Cup Mayo Terovan', 'CUP Mayo Terovan', 'Cup Terovan'],
  dddFanter: ['DDD mayo Fanter', 'DDD Mayo Fanter', 'DDD Fanter'],
  dddTerovan: ['DDD mayo Terovan', 'DDD Mayo Terovan', 'DDD Terovan'],
  sitFanter: ['Inv-Rot Fanter', 'Inv Rot Fanter', 'SIT Fanter', 'Inv-Rot Fanter'],
  sitTerovan: ['Inv-Rot Terovan', 'Inv Rot Terovan', 'SIT Terovan', 'Inv-Rot Terovan']
};

function findSheetName(sheets, candidates) {
  const lowerSheets = sheets.map(s => s.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lowerSheets.indexOf(c.toLowerCase().trim());
    if (idx >= 0) return sheets[idx];
  }
  return null;
}

function excelSerialToMonth(serial) {
  // El serial de Excel (sistema 1900) a mes YYYY-MM
  if (typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
    const d = XLSX.SSF.parse_date_code(Number(serial));
    if (d && d.y && d.m) return `${d.y}-${String(d.m).padStart(2, '0')}`;
  }
  // Fallback manual
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + Number(serial) * 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseNumExcel(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function parseCupSheet(rows, mercado) {
  if (!rows || rows.length < 3) return [];
  // Fila 0: encabezado con seriales de fecha en cols 2-6, Total en col 7
  // Fila 1: sub-encabezado
  const serials = rows[0].slice(2, 7);
  const mesCols = serials.map(s => excelSerialToMonth(s));
  const dataRows = rows.slice(2);
  const result = [];
  for (const r of dataRows) {
    const col0 = (r[0] || '').toString().trim();
    const col1 = (r[1] || '').toString().trim();
    if (!col0) continue;
    // Ignorar filas de subtotal/total
    if (col1.toUpperCase() === 'TOTAL' || col0.toUpperCase() === 'TOTAL') continue;
    const parts = col0.split(' - ').map(p => p.trim());
    const medico = (parts[0] || '').toUpperCase();
    const region = (parts[1] || '').toUpperCase();
    const especialidad = (parts[2] || '').toUpperCase();
    const marca = col1.toUpperCase();
    if (!medico || !marca) continue;
    const meses = {};
    let totalCalculado = 0;
    for (let i = 0; i < mesCols.length; i++) {
      const val = parseNumExcel(r[2 + i]);
      meses[mesCols[i]] = val;
      totalCalculado += val;
    }
    const total = parseNumExcel(r[7]) || totalCalculado;
    result.push({
      origenId: `${mercado}-${result.length}`,
      medico,
      region,
      especialidad,
      marca,
      meses,
      total,
      mercado
    });
  }
  return result;
}

function parseDddSheet(rows, mercado) {
  if (!rows || rows.length < 2) return [];
  const dataRows = rows.slice(1);
  const result = [];
  for (const r of dataRows) {
    const brick = (r[0] || '').toString().trim();
    if (!brick || brick.toUpperCase() === 'TOTAL') continue;
    const ciudad = brick.split(' ')[0].toUpperCase();
    const marca = (r[1] || '').toString().trim();
    const cantidad = parseNumExcel(r[2]);
    const ms = parseNumExcel(r[3]) * 100;
    const crecimiento = parseNumExcel(r[4]) * 100;
    const valorOportunidad = r[5] !== undefined && r[5] !== '' ? parseNumExcel(r[5]) : null;
    result.push({
      origenId: `${mercado}-${result.length}`,
      brick: brick.toUpperCase(),
      ciudad,
      marca,
      cantidad,
      ms,
      crecimiento,
      valorOportunidad,
      mercado
    });
  }
  return result;
}

function parseInvRotSheet(rows, mercado) {
  if (!rows || rows.length < 3) return { rows: [], mesLabels: [] };
  // Fila 0: encabezado con códigos de mes en cols 3 en adelante, Total al final
  // Fila 1: sub-encabezado
  const headerAll = rows[0];
  const monthHeaders = [];
  for (let i = 3; i < headerAll.length - 1; i++) {
    const v = headerAll[i];
    if (v !== undefined && v !== null && v !== '') monthHeaders.push(v.toString().trim());
  }
  // Tomar los últimos 3 meses con datos
  const last3 = monthHeaders.slice(-3);
  const dataRows = rows.slice(2);
  const result = [];
  let lastBrickCiudad = '';
  let lastPdv = '';
  for (const r of dataRows) {
    let brickCiudad = (r[0] || '').toString().trim();
    let pdv = (r[1] || '').toString().trim();
    const tipo = (r[2] || '').toString().trim();
    // Heredar brick y pdv de la fila anterior si están vacíos
    if (brickCiudad) lastBrickCiudad = brickCiudad;
    else brickCiudad = lastBrickCiudad;
    if (pdv) lastPdv = pdv;
    else pdv = lastPdv;
    if (!brickCiudad || !pdv || !tipo) continue;
    if (brickCiudad.toUpperCase() === 'TOTAL' || pdv.toUpperCase() === 'TOTAL') continue;
    // Extraer brick y ciudad del texto "9012 - Bogota"
    const bcParts = brickCiudad.split(' - ').map(p => p.trim());
    const brick = bcParts[0] || brickCiudad;
    const ciudad = (bcParts[1] || '').toUpperCase();
    // Tomar los últimos 3 valores de mes
    const values = r.slice(3, 3 + monthHeaders.length);
    const meses = last3.map((_, idx) => parseNumExcel(values[values.length - 3 + idx]));
    const totalRaw = r[r.length - 1];
    const total = totalRaw !== undefined && totalRaw !== '' ? parseNumExcel(totalRaw) : meses.reduce((a, b) => a + b, 0);
    result.push({
      origenId: `${mercado}-${result.length}`,
      brick,
      ciudad,
      pdv,
      tipo,
      meses,
      total,
      mercado,
      mesLabels: last3
    });
  }
  return { rows: result, mesLabels: last3 };
}

async function parseDataExcel(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === 'undefined') {
      reject(new Error('Librería XLSX no cargada'));
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheets = workbook.SheetNames;
        console.log('Hojas encontradas en Excel:', sheets);

        let cup = [];
        let ddd = [];
        let sit = [];
        let sitMesLabels = [];

        const readSheet = candidates => {
          const name = findSheetName(sheets, candidates);
          if (!name) {
            console.warn('No se encontró hoja entre:', candidates);
            return [];
          }
          const ws = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          console.log(`Leyendo ${name}: ${rows.length} filas`);
          return rows;
        };

        const cupFanterRows = readSheet(DATA_EXCEL_SHEETS.cupFanter);
        if (cupFanterRows.length) cup = cup.concat(parseCupSheet(cupFanterRows, 'Fanter'));

        const cupTerovanRows = readSheet(DATA_EXCEL_SHEETS.cupTerovan);
        if (cupTerovanRows.length) cup = cup.concat(parseCupSheet(cupTerovanRows, 'Terovan'));

        const dddFanterRows = readSheet(DATA_EXCEL_SHEETS.dddFanter);
        if (dddFanterRows.length) ddd = ddd.concat(parseDddSheet(dddFanterRows, 'Fanter'));

        const dddTerovanRows = readSheet(DATA_EXCEL_SHEETS.dddTerovan);
        if (dddTerovanRows.length) ddd = ddd.concat(parseDddSheet(dddTerovanRows, 'Terovan'));

        const sitFanterRows = readSheet(DATA_EXCEL_SHEETS.sitFanter);
        if (sitFanterRows.length) {
          const parsed = parseInvRotSheet(sitFanterRows, 'Fanter');
          sit = sit.concat(parsed.rows);
          if (parsed.mesLabels.length) sitMesLabels = parsed.mesLabels;
        }

        const sitTerovanRows = readSheet(DATA_EXCEL_SHEETS.sitTerovan);
        if (sitTerovanRows.length) {
          const parsed = parseInvRotSheet(sitTerovanRows, 'Terovan');
          sit = sit.concat(parsed.rows);
          if (parsed.mesLabels.length) sitMesLabels = parsed.mesLabels;
        }

        console.log('Resultado parseo:', { cup: cup.length, ddd: ddd.length, sit: sit.length, sitMesLabels });
        resolve({ cup, ddd, sit, sitMesLabels });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsArrayBuffer(file);
  });
}
