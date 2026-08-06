class CoberturaDB {
  constructor(usuario) {
    this.usuario = usuario || 'default';
    this.dbName = `CoberturaDB_${this.usuario}`;
    this.db = null;
  }

  init() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onerror = () => rej(req.error);
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('medicos')) {
          const s = d.createObjectStore('medicos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nombre', 'nombre', { unique: false });
          s.createIndex('segmento', 'segmento', { unique: false });
          s.createIndex('ciudad', 'ciudad', { unique: false });
          s.createIndex('brick', 'brick', { unique: false });
        }
        if (!d.objectStoreNames.contains('farmacias')) {
          const s = d.createObjectStore('farmacias', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nombre', 'nombre', { unique: false });
          s.createIndex('ciudad', 'ciudad', { unique: false });
          s.createIndex('brick', 'brick', { unique: false });
        }
        if (!d.objectStoreNames.contains('visitas')) {
          const s = d.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true });
          s.createIndex('entidadId', 'entidadId', { unique: false });
          s.createIndex('entidadTipo', 'entidadTipo', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
          s.createIndex('mes', 'mes', { unique: false });
        }
        if (!d.objectStoreNames.contains('notas')) {
          d.createObjectStore('notas', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('config')) {
          d.createObjectStore('config', { keyPath: 'key' });
        }
        if (!d.objectStoreNames.contains('cup')) {
          d.createObjectStore('cup', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('ddd')) {
          d.createObjectStore('ddd', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('sit')) {
          d.createObjectStore('sit', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  _tx(s, m) { return this.db.transaction(s, m).objectStore(s); }
  getAll(s) { return new Promise((res, rej) => { const r = this._tx(s, 'readonly').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  add(s, d) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').add(d); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  put(s, d) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').put(d); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  delete(s, id) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
  getById(s, id) { return new Promise((res, rej) => { const r = this._tx(s, 'readonly').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  getByIndex(s, idx, val) { return new Promise((res, rej) => { const r = this._tx(s, 'readonly').index(idx).getAll(val); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  clear(s) { return new Promise((res, rej) => { const r = this._tx(s, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
  getConfig(k) { return this.getById('config', k); }
  setConfig(k, v) { return this.put('config', { key: k, value: v }); }
  async countVisitasEntidad(eid, etipo, mes) { const all = await this.getByIndex('visitas', 'entidadId', eid); const f = all.filter(v => v.entidadTipo === etipo); if (mes) return f.filter(v => v.mes === mes).length; return f.length; }
  async visitasDelMes(mes) { return this.getByIndex('visitas', 'mes', mes); }
  async visitasPorEntidad(eid, etipo) { const all = await this.getByIndex('visitas', 'entidadId', eid); return all.filter(v => v.entidadTipo === etipo).sort((a, b) => b.fecha.localeCompare(a.fecha)); }
  async reemplazarMedicos(arr) { await this.clear('medicos'); for (const x of arr) await this.add('medicos', x); }
  async reemplazarFarmacias(arr) { await this.clear('farmacias'); for (const x of arr) await this.add('farmacias', x); }
  // Actualiza el panel sin romper las visitas: conserva el id de los médicos que ya
  // existen (misma cédula) y solo agrega los nuevos. Los que salen del panel NO se
  // borran: quedan marcados fueraDePanel para poder registrarles visitas de meses
  // anteriores; sus visitas quedan guardadas en la base.
  async fusionarMedicos(arr) {
    const actuales = await this.getAll('medicos');
    const porCedula = {};
    for (const m of actuales) { if (m.cedula) porCedula[String(m.cedula)] = m.id; }
    const cedulasNuevas = new Set();
    for (const x of arr) {
      const ced = x.cedula != null && x.cedula !== '' ? String(x.cedula) : '';
      if (ced) cedulasNuevas.add(ced);
      const idExistente = ced ? porCedula[ced] : undefined;
      if (idExistente != null) await this.put('medicos', { ...x, id: idExistente, fueraDePanel: false });
      else await this.add('medicos', { ...x, fueraDePanel: false });
    }
    for (const m of actuales) {
      if (m.cedula && !cedulasNuevas.has(String(m.cedula)) && !m.fueraDePanel) {
        await this.put('medicos', { ...m, fueraDePanel: true });
      }
    }
  }
  // Igual que fusionarMedicos pero por nombre (las farmacias no tienen cédula)
  async fusionarFarmacias(arr) {
    const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const actuales = await this.getAll('farmacias');
    const porNombre = {};
    for (const f of actuales) porNombre[norm(f.nombre)] = f.id;
    const nombresNuevos = new Set();
    for (const x of arr) {
      const n = norm(x.nombre);
      nombresNuevos.add(n);
      const idExistente = porNombre[n];
      if (idExistente != null) await this.put('farmacias', { ...x, id: idExistente });
      else await this.add('farmacias', x);
    }
    for (const f of actuales) {
      if (!nombresNuevos.has(norm(f.nombre))) await this.delete('farmacias', f.id);
    }
  }
  async reemplazarCUP(arr) { await this.clear('cup'); for (const x of arr) await this.add('cup', x); }
  async reemplazarDDD(arr) { await this.clear('ddd'); for (const x of arr) await this.add('ddd', x); }
  async reemplazarSIT(arr) { await this.clear('sit'); for (const x of arr) await this.add('sit', x); }
}

// Se crea dinámicamente según el usuario activo
let db = null;
