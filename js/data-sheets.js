// ===== SINCRONIZACIÓN DE DATOS CUP / DDD / SIT =====
// Lee de la hoja fija CONFIG.DATA_SHEET_ID con los ranges CONFIG.DATA_RANGES

class DataSheetsSync {
  constructor() {
    this.apiKey = CONFIG.GOOGLE_API_KEY;
    this.sheetId = CONFIG.DATA_SHEET_ID;
  }

  async fetchData(range) {
    const u = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(range)}?key=${this.apiKey}`;
    const res = await fetch(u, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.values || [];
  }

  normalizarMarca(marca) {
    return (marca || '')
      .toString()
      .replace(/\s*\([^)]*\)/g, '')      // quitar (AZN), (A5U), etc.
      .replace(/\bLNI\b/gi, '')
      .replace(/\bMG\b/gi, '')
      .replace(/[+/]/g, ' ')
      .trim()
      .toUpperCase();
  }

  mercadoDeMarca(marca) {
    const n = this.normalizarMarca(marca);
    const fanter = /FANTER|FORXIGA|DAPAGLIFLOZINA/;
    const terovan = /TEROVAN|ENTRESTO|SACUB|VALSAR/;
    const esFanter = fanter.test(n);
    const esTerovan = terovan.test(n);
    if (esFanter && !esTerovan) return 'Fanter';
    if (esTerovan && !esFanter) return 'Terovan';
    return 'Otro';
  }

  marcasDelMercado(mercado) {
    if (!mercado) return null;
    const m = mercado.toString().trim();
    if (m === 'Fanter') return ['FANTER', 'FORXIGA', 'DAPAGLIFLOZINA'];
    if (m === 'Terovan') return ['TEROVAN', 'ENTRESTO', 'SACUB', 'VALSAR'];
    return null;
  }

  perteneceAMercado(marca, mercado) {
    if (!mercado) return true;
    const n = this.normalizarMarca(marca);
    const patrones = this.marcasDelMercado(mercado);
    if (!patrones) return true;
    return patrones.some(p => n.includes(p));
  }

  parseNumero(v) {
    if (v === undefined || v === null || v === '') return 0;
    const s = v.toString().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  parsePorcentaje(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = v.toString().replace('%', '').replace(/\./g, '').replace(',', '.').trim();
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // ===== CUP =====
  parseCUP(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => (h || '').toString().trim().toUpperCase());
    const mesCols = headers
      .map((h, i) => ({ h, i }))
      .filter(x => /^\d{4}-\d{2}$/.test(x.h));
    const idxMedico = headers.indexOf('MEDICO');
    const idxRegion = headers.indexOf('REGION');
    const idxEspecialidad = headers.indexOf('ESPECIALIDAD');
    const idxMarca = headers.indexOf('MARCA');
    const idxTotal = headers.indexOf('TOTAL');
    if (idxMedico === -1 || idxMarca === -1) return [];

    return rows.slice(1).map((r, i) => {
      const medico = (r[idxMedico] || '').toString().trim();
      if (!medico) return null;
      const meses = {};
      let totalCalculado = 0;
      for (const m of mesCols) {
        const val = this.parseNumero(r[m.i]);
        meses[m.h] = val;
        totalCalculado += val;
      }
      return {
        origenId: String(i),
        medico: medico.toUpperCase(),
        region: (r[idxRegion] || '').toString().trim().toUpperCase(),
        especialidad: (r[idxEspecialidad] || '').toString().trim().toUpperCase(),
        marca: (r[idxMarca] || '').toString().trim().toUpperCase(),
        meses,
        total: idxTotal !== -1 ? this.parseNumero(r[idxTotal]) : totalCalculado,
        mercado: this.mercadoDeMarca(r[idxMarca])
      };
    }).filter(Boolean);
  }

  // ===== DDD =====
  parseDDD(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => (h || '').toString().trim().toUpperCase());
    const idxBrick = headers.indexOf('BRICK');
    const idxCiudad = headers.indexOf('CIUDAD');
    const idxMarca = headers.indexOf('MARCA');
    const idxCant = headers.indexOf('QTR_CANT_ACTUAL');
    const idxMS = headers.indexOf('MS_QTR_PORCENTAJE');
    const idxCrec = headers.indexOf('CRECIMIENTO_PESO_BRICK_QTR');
    const idxValor = headers.indexOf('VALOR_OPORTUNIDAD_MARCA');
    if (idxBrick === -1 || idxMarca === -1) return [];

    return rows.slice(1).map((r, i) => {
      const brick = (r[idxBrick] || '').toString().trim();
      if (!brick) return null;
      return {
        origenId: String(i),
        brick: brick.toUpperCase(),
        ciudad: (r[idxCiudad] || '').toString().trim().toUpperCase(),
        marca: (r[idxMarca] || '').toString().trim().toUpperCase(),
        cantidad: this.parseNumero(r[idxCant]),
        ms: this.parsePorcentaje(r[idxMS]),
        crecimiento: this.parsePorcentaje(r[idxCrec]),
        valorOportunidad: idxValor !== -1 ? this.parsePorcentaje(r[idxValor]) : null,
        mercado: this.mercadoDeMarca(r[idxMarca])
      };
    }).filter(Boolean);
  }

  // ===== SIT =====
  parseSIT(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => (h || '').toString().trim().toUpperCase());
    const idxBrick = headers.indexOf('BRICK');
    const idxCiudad = headers.indexOf('CIUDAD');
    const idxPdv = headers.indexOf('PDV');
    const idxTipo = headers.indexOf('TIPO_INFORMACION');
    const idxTotal = headers.indexOf('TOTAL');
    const mesIdx = headers
      .map((h, i) => ({ h, i }))
      .filter(x => x.h.startsWith('MES_'));
    if (idxBrick === -1 || idxPdv === -1 || idxTipo === -1) return [];

    return rows.slice(1).map((r, i) => {
      const pdv = (r[idxPdv] || '').toString().trim();
      if (!pdv) return null;
      const meses = mesIdx.map(m => this.parseNumero(r[m.i]));
      const totalCalculado = meses.reduce((a, b) => a + b, 0);
      return {
        origenId: String(i),
        brick: (r[idxBrick] || '').toString().trim(),
        ciudad: (r[idxCiudad] || '').toString().trim().toUpperCase(),
        pdv: pdv,
        tipo: (r[idxTipo] || '').toString().trim(),
        meses,
        total: idxTotal !== -1 ? this.parseNumero(r[idxTotal]) : totalCalculado,
        mercado: null
      };
    }).filter(Boolean);
  }

  async syncAll() {
    const [cupRows, dddRows, sitRows] = await Promise.all([
      this.fetchData(CONFIG.DATA_RANGES.cup),
      this.fetchData(CONFIG.DATA_RANGES.ddd),
      this.fetchData(CONFIG.DATA_RANGES.sit)
    ]);
    const cup = this.parseCUP(cupRows);
    const ddd = this.parseDDD(dddRows);
    const sit = this.parseSIT(sitRows);
    await db.reemplazarCUP(cup);
    await db.reemplazarDDD(ddd);
    await db.reemplazarSIT(sit);
    await db.setConfig('lastSyncData', new Date().toISOString());
    return { cup: cup.length, ddd: ddd.length, sit: sit.length };
  }
}

const dataSheets = new DataSheetsSync();
