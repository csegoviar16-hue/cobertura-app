// Genera el PANEL_DATA.medicos de agosto desde la hoja "Panel" del Excel mensual,
// conservando por cédula los campos del panel actual (segmento, email, deblax, ips, etc.).
// Los médicos nuevos (sin cédula en el panel actual) entran con segmento 'PS'.
const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'lib', 'xlsx.full.min.js'));

const [,, archivo, backupJson] = process.argv;
if (!archivo || !backupJson) {
  console.error('Uso: node tools/generar-panel.js "<excel Data Mes>" "<backup actual.json>"');
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Panel'], { header: 1 });
const enc = rows[0];
const col = nombre => enc.findIndex(h => (h || '').toString().trim().toLowerCase() === nombre.toLowerCase());
const C = {
  cedula: col('Cedula'), id18: col('ID 18 Account'), nombre: col('Nombre de la cuenta'),
  espec: col('Adium Call Specialty'), espec2: col('Especialidad'), medH: col('Medico H'),
  freq: col('Frecuencia'), seg: col('Segmento Línea'), ciudad: col('Ciudad de eleccion'),
  dir: col('Direccion de eleccion'), brick: col('Brick de eleccion'), tel: col('Teléfono'),
  cel: col('Celular'), ips: col('IPS/Institucion'), tipo: col('Tipo Consulta')
};

// Panel actual desde el backup reparado
const backup = JSON.parse(fs.readFileSync(backupJson, 'utf8'));
const actPorCedula = {};
for (const m of backup.medicos) if (m.cedula) actPorCedula[String(m.cedula)] = m;

// BRICK_ZONA desde panel-data.js
const pdSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'panel-data.js'), 'utf8');
eval(pdSrc.slice(0, pdSrc.indexOf('const PANEL_DATA')) + '\nglobalThis.__bz = BRICK_ZONA;');
const BRICK_ZONA = globalThis.__bz;

const data = rows.slice(1).filter(r => r[C.cedula]);
const medicos = [];
const nuevos = [];
const sinMatch = [];
for (const r of data) {
  const ced = String(r[C.cedula]).trim();
  const prev = actPorCedula[ced];
  const brick = (r[C.brick] || '').toString().trim();
  const esNuevo = !prev;
  if (esNuevo) nuevos.push((r[C.nombre] || '').trim());
  const m = {
    origenId: (r[C.id18] || prev?.origenId || ced).toString().trim(),
    cedula: ced,
    nombre: (r[C.nombre] || prev?.nombre || '').toString().trim(),
    especialidad: (r[C.espec] || r[C.espec2] || prev?.especialidad || '').toString().trim(),
    segmento: prev?.segmento || 'PS',
    frecuencia: parseInt(r[C.freq]) || prev?.frecuencia || 1,
    ciudad: (r[C.ciudad] || prev?.ciudad || '').toString().trim().toUpperCase(),
    brick: brick || prev?.brick || '',
    brickZona: BRICK_ZONA[brick] || prev?.brickZona || '',
    direccion: (r[C.dir] || prev?.direccion || '').toString().trim(),
    celular: (r[C.cel] || prev?.celular || '').toString().trim(),
    telefono: (r[C.tel] || prev?.telefono || '').toString().trim(),
    email: prev?.email || '',
    ips: (r[C.ips] || prev?.ips || '').toString().trim(),
    tipoConsulta: (r[C.tipo] || prev?.tipoConsulta || '').toString().trim(),
    deblax: prev?.deblax || false
  };
  if ((r[C.medH] || '').toString().trim().toUpperCase() === 'SI' && !m.segmento.includes('H')) {
    m.segmento = 'H,' + m.segmento;
  }
  medicos.push(m);
}

// Médicos del panel actual que ya NO están en el Excel (salen del panel)
const cedsExcel = new Set(medicos.map(m => m.cedula));
const salen = backup.medicos.filter(m => m.cedula && !cedsExcel.has(String(m.cedula))).map(m => m.nombre);

console.log('Médicos en nuevo panel:', medicos.length);
console.log('Nuevos (entran como PS salvo Medico H=SI):', nuevos.length, nuevos);
console.log('Salen del panel (quedarán como fueraDePanel):', salen.length);
for (const s of salen) console.log('  -', s);

const outJson = JSON.stringify({ medicos }, null, 2);
fs.writeFileSync(path.join(__dirname, 'panel_agosto_medicos.json'), outJson);
console.log('Escrito tools/panel_agosto_medicos.json');
