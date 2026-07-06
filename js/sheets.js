class SheetsSync {
  constructor() {
    this.apiKey = CONFIG.GOOGLE_API_KEY;
    this.sheetId = '';
  }

  async init() {
    const c = await db.getConfig('sheetsUrl');
    // Extraer sheetId de la URL si existe
    if (c?.value) {
      this.sheetId = this.extractId(c.value) || '';
    }
    // Si no hay URL configurada, usar el del usuario activo
    if (!this.sheetId && usuarioActivo && CONFIG.USUARIOS[usuarioActivo]) {
      this.sheetId = CONFIG.USUARIOS[usuarioActivo].sheetId;
    }
  }

  extractId(url) {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  }

  async fetchSheetData(range) {
    if (!this.sheetId) throw new Error('Sheet ID no configurado');
    const u = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(range)}?key=${this.apiKey}`;
    const res = await fetch(u, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.values || [];
  }

  mapearSegmento(v) {
    const val = (v || '').toString().trim().toUpperCase();
    if (val === 'PS' || val === 'POR SEGMENTAR') return 'PS';
    if (val === 'EVALUAR') return 'E';
    if (val === 'CONQUISTAR') return 'C';
    if (val === 'MANTENER') return 'M';
    if (val === 'PROTEGER') return 'P';
    return '';
  }

  parseMedicos(rows) {
    if (rows.length < 2) return [];
    const dataRows = rows.slice(1);

    return dataRows.map((r, i) => {
      const nombre = (r[2] || '').toString().trim();
      if (!nombre) return null;
      const medicoH = (r[5] || '').toString().trim().toUpperCase();
      const segmentoLinea = (r[7] || '').toString().trim();
      const segs = [];
      if (medicoH === 'SI') segs.push('H');
      const seg = this.mapearSegmento(segmentoLinea);
      if (seg) segs.push(seg);
      const brickNum = (r[10] || '').toString().trim();
      const comarketing = (r[14] || '').toString().trim().toLowerCase();

      return {
        origenId: (r[0] || String(i)).toString().trim(),
        nombre: nombre,
        especialidad: (r[3] || '').toString().trim(),
        segmento: segs.join(','),
        frecuencia: parseInt(r[6]) || 1,
        ciudad: (r[8] || '').toString().trim().toUpperCase(),
        brick: brickNum,
        brickZona: getBrickZona(brickNum),
        direccion: (r[9] || '').toString().trim(),
        celular: (r[11] || '').toString().trim(),
        email: (r[12] || '').toString().trim(),
        deblax: comarketing === 'deblax'
      };
    }).filter(Boolean);
  }

  parseFarmacias(rows) {
    if (rows.length < 2) return [];
    const dataRows = rows.slice(1);

    return dataRows.map((r, i) => {
      const nombre = (r[1] || '').toString().trim();
      if (!nombre) return null;
      const brickNum = (r[5] || '').toString().trim();
      return {
        origenId: (r[0] || String(i)).toString().trim(),
        nombre: nombre,
        cadena: '',
        ciudad: (r[3] || '').toString().trim().toUpperCase(),
        brick: brickNum,
        brickZona: getBrickZona(brickNum),
        direccion: (r[4] || '').toString().trim(),
        frecuencia: parseInt(r[2]) || 1,
        adium: typeof esFarmaciaAdium === 'function' ? esFarmaciaAdium(nombre) : false
      };
    }).filter(Boolean);
  }

  async syncAll() {
    if (!this.sheetId) throw new Error('Sheet ID no configurado');

    let medRows = [];
    try {
      medRows = await this.fetchSheetData(CONFIG.RANGES.medicos);
    } catch (e) {
      throw new Error('No se pudo leer la hoja de médicos: ' + e.message);
    }
    const medicos = this.parseMedicos(medRows);

    let farmRows = [];
    try {
      farmRows = await this.fetchSheetData(CONFIG.RANGES.farmacias);
    } catch (e) {
      console.warn('No se pudo leer farmacias:', e.message);
    }
    const farmacias = this.parseFarmacias(farmRows);

    await db.reemplazarMedicos(medicos);
    await db.reemplazarFarmacias(farmacias);
    await db.setConfig('lastSync', new Date().toISOString());

    return { medicos: medicos.length, farmacias: farmacias.length };
  }

  async exportarVisitasMes(mes) {
    const vs = await db.visitasDelMes(mes);
    const ms = await db.getAll('medicos');
    const fs = await db.getAll('farmacias');
    const map = {};
    for (const m of ms) map['M-' + m.id] = m.nombre;
    for (const f of fs) map['F-' + f.id] = f.nombre;
    const filas = vs.map(v => ({
      Fecha: v.fecha,
      Tipo: v.entidadTipo === 'medico' ? 'Médico' : 'Farmacia',
      Nombre: map[(v.entidadTipo === 'medico' ? 'M-' : 'F-') + v.entidadId] || '',
      Notas: v.notas || ''
    }));
    descargarCSV(`visitas_${mes}.csv`, filas);
  }
}

const sheets = new SheetsSync();
