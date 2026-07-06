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
  async reemplazarCUP(arr) { await this.clear('cup'); for (const x of arr) await this.add('cup', x); }
  async reemplazarDDD(arr) { await this.clear('ddd'); for (const x of arr) await this.add('ddd', x); }
  async reemplazarSIT(arr) { await this.clear('sit'); for (const x of arr) await this.add('sit', x); }
}

// Se crea dinámicamente según el usuario activo
let db = null;
