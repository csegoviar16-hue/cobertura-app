/* ===== COBERTURA APP - Vanilla JS Architecture ===== */

// ===== STATE =====
const state = {
  view: 'dashboard',
  navVisible: true,
  filterSegment: null,
  medicoSubTab: 'Panel',
  farmaciaSubTab: 'Panel',
  ciudadMed: 'BOGOTÁ',
  ciudadFarm: 'BOGOTÁ',
  busquedaMed: '',
  busquedaFarm: '',
  especialidadMed: 'Todas',
  estadoMed: 'Todos',
  estadoFarm: 'Todos',
  filtroExtraMed: null,
  notaSubTab: 'Todas',
  metricasMes: mesActualISO(),
  metricasCiudad: 'Todas',
  dashboardPendFilter: 'Todos',
  pendMedCiudad: 'BOGOTÁ',
  pendFarmCiudad: 'BOGOTÁ',
  modal: null, // {type, data}
  toastTimer: null,
  // Data view
  dataSubTab: 'CUP',
  dataMercado: '', // '' | 'Fanter' | 'Terovan'
  dataMarcas: [],
  dataCiudad: [],
  dataExpanded: { cup: {}, ddd: {}, sit: {} },
  dataFiltersOpen: { mercado: false, marcas: false, ciudad: false },
  dataSitMesLabels: []
};

let usuarioActivo = null; // 'carlos' o 'esposa'

let medicosCache = [];
let farmaciasCache = [];
let visitasMap = {}; // entidadTipo-id -> count
const mesActual = mesActualISO();

let cupCache = [];
let dddCache = [];
let sitCache = [];

// ===== SCROLL NAV =====
let lastScrollY = 0;
let touchStartY = 0;
function setupScroll() {
  const main = document.querySelector('.main-content') || window;
  const onScroll = () => {
    const y = window.scrollY;
    if (y < 10) { setNav(true); lastScrollY = y; return; }
    if (y > lastScrollY + 5) setNav(false);
    else if (y < lastScrollY - 5) setNav(true);
    lastScrollY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (diff > 10) setNav(false); else if (diff < -10) setNav(true);
  }, { passive: true });
}
function setNav(show) {
  state.navVisible = show;
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.toggle('hidden', !show);
}

// ===== TOAST =====
function toast(msg, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

// ===== RENDER CORE =====
function $(id) { return document.getElementById(id); }
function html(str) { return str; }
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

async function init() {
  // Verificar si hay usuario guardado
  const guardado = localStorage.getItem('cobertura_usuario');
  if (guardado && CONFIG.USUARIOS[guardado]) {
    await seleccionarUsuario(guardado, false);
  } else {
    renderSelectorUsuario();
  }
}

window.seleccionarUsuario = async function(usuario, guardar = true) {
  if (!CONFIG.USUARIOS[usuario]) { toast('Usuario no válido', 'err'); return; }
  usuarioActivo = usuario;
  if (guardar) localStorage.setItem('cobertura_usuario', usuario);

  // Inicializar DB del usuario
  db = new CoberturaDB(usuario);
  await db.init();

  // Cargar bricks personalizados
  const customBricks = await db.getConfig('customBricks');
  if (customBricks?.value) customBricksMap = customBricks.value;

  // Inicializar sheets con el ID del usuario
  await sheets.init();

  await recargarDatos();

  // Cargar o actualizar panel local para Carlos
  if (usuario === 'carlos' && typeof PANEL_DATA !== 'undefined') {
    try {
      const panelVersionCfg = await db.getConfig('panelVersion');
      const panelVersionActual = panelVersionCfg?.value || '';
      const panelVersionNueva = PANEL_DATA.panelVersion || '';
      // Si no hay médicos o cambió la versión del panel, recargar datos
      if (medicosCache.length === 0 || (panelVersionNueva && panelVersionActual !== panelVersionNueva)) {
        await cargarPanelLocal();
        await recargarDatos();
      }
    } catch (e) { console.error('Error cargando panel local:', e); }
  }

  renderApp();
  setupScroll();
  setupEvents();
};

function renderSelectorUsuario() {
  const app = $('app');
  if (!app) return;
  app.innerHTML = `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg)">
      <div style="font-size:2.5rem;margin-bottom:8px">👨‍⚕️</div>
      <h1 style="font-size:1.4rem;margin-bottom:32px;color:var(--text)">Cobertura</h1>
      <p style="font-size:.9rem;color:var(--text2);margin-bottom:24px">Seleccioná tu usuario</p>
      <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:280px">
        <button class="btn btn-primary" style="padding:18px;font-size:1rem" onclick="window.seleccionarUsuario('carlos')">
          <div>Carlos</div>
          <div style="font-size:.75rem;font-weight:400;opacity:.8">Adium - Falla Cardíaca</div>
        </button>
        <button class="btn btn-outline" style="padding:18px;font-size:1rem" onclick="window.seleccionarUsuario('esposa')">
          <div>Esposa</div>
          <div style="font-size:.75rem;font-weight:400;opacity:.8">Farmacéutica</div>
        </button>
      </div>
    </div>
  `;
}

async function recargarDatos() {
  medicosCache = await db.getAll('medicos');
  farmaciasCache = await db.getAll('farmacias');
  cupCache = await db.getAll('cup');
  dddCache = await db.getAll('ddd');
  sitCache = await db.getAll('sit');
  const sitLabelsCfg = await db.getConfig('dataSitMesLabels');
  state.dataSitMesLabels = sitLabelsCfg?.value || [];
  visitasMap = {};
  for (const m of medicosCache) {
    visitasMap['medico-' + m.id] = await db.countVisitasEntidad(m.id, 'medico', mesActual);
  }
  for (const f of farmaciasCache) {
    visitasMap['farmacia-' + f.id] = await db.countVisitasEntidad(f.id, 'farmacia', mesActual);
  }
}

function renderApp() {
  const app = $('app');
  if (!app) return;
  // Preservar foco activo para evitar perder el cursor en búsqueda
  const activeEl = document.activeElement;
  const activeId = activeEl?.id;
  const selStart = activeEl?.selectionStart;
  const selEnd = activeEl?.selectionEnd;
  app.innerHTML = renderLayout();
  attachHandlers();
  // Restaurar foco y posición del cursor
  if (activeId) {
    const el = $(activeId);
    if (el) {
      el.focus();
      if (typeof selStart === 'number' && el.setSelectionRange) {
        el.setSelectionRange(selStart, selEnd);
      }
    }
  }
}

function renderLayout() {
  const tabs = [
    {k:'dashboard',l:'Dashboard',i:'📊'},
    {k:'medicos',l:'Médicos',i:'👨‍⚕️'},
    {k:'farmacias',l:'Farmacias',i:'🏥'},
    {k:'data',l:'Data',i:'📈'},
    {k:'resumen-panel',l:'Panel',i:'📋'},
    {k:'notas',l:'Notas',i:'📝'},
    {k:'config',l:'Config',i:'⚙️'}
  ];
  return `
    <header class="app-header">
      <h1>Cobertura</h1>
      <div class="header-actions">
        <span style="font-size:.75rem;color:#666">${navigator.onLine?'🟢':'🔴'}</span>
      </div>
    </header>
    <main class="main-content" id="main-content">
      ${renderView()}
    </main>
    <nav class="bottom-nav ${state.navVisible?'':'hidden'}" id="bottom-nav">
      ${tabs.map(t=>`<button class="nav-item ${state.view===t.k?'active':''}" data-view="${t.k}"><span class="nav-icon">${t.i}</span><span class="nav-label">${t.l}</span></button>`).join('')}
    </nav>
    <div class="toast-container" id="toast-container"></div>
    ${renderModal()}
  `;
}

function renderView() {
  switch(state.view) {
    case 'dashboard': return renderDashboard();
    case 'medicos': return renderMedicos();
    case 'farmacias': return renderFarmacias();
    case 'data': return renderData();
    case 'notas': return renderNotas();
    case 'config': return renderConfig();
    case 'resumen-panel': return renderResumenPanel();
    case 'metricas-mes': return renderMetricasMes();
    case 'resumen-dias': return renderResumenDias();
    case 'pendientes-medicos': return renderPendientesMedicos();
    case 'pendientes-farmacias': return renderPendientesFarmacias();
    default: return renderDashboard();
  }
}

function attachHandlers() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.onclick = () => { state.view = el.dataset.view; state.filterSegment = null; state.filtroExtraMed = null; window.scrollTo(0,0); renderApp(); };
  });
  document.querySelectorAll('[data-action]').forEach(el => {
    const action = el.dataset.action;
    const data = el.dataset;
    el.onclick = (e) => handleAction(action, data, e);
  });
}

async function handleAction(action, data, e) {
  if (e) e.stopPropagation();
  switch(action) {
    case 'dash-filter': {
      const lbl = data.label;
      if (lbl === 'Tareas') { state.view = 'notas'; }
      else if (lbl === 'Farmacias Total') { state.view = 'farmacias'; }
      else { state.view = 'medicos'; state.filterSegment = (lbl === 'Médicos Total' ? null : lbl); }
      window.scrollTo(0,0); renderApp(); break;
    }
    case 'set-subtab': {
      if (data.target === 'med') { state.medicoSubTab = data.tab; state.filtroExtraMed = null; }
      else state.farmaciaSubTab = data.tab;
      renderApp(); break;
    }
    case 'set-ciudad': {
      if (data.target === 'med') { state.ciudadMed = data.ciudad; state.filtroExtraMed = null; }
      else state.ciudadFarm = data.ciudad;
      renderApp(); break;
    }
    case 'open-medico': state.modal = {type:'medico', id: parseInt(data.id)}; renderApp(); break;
    case 'open-farmacia': state.modal = {type:'farmacia', id: parseInt(data.id)}; renderApp(); break;
    case 'add-visita-med': state.modal = {type:'calendario', entidadId: parseInt(data.id), entidadTipo:'medico'}; renderApp(); break;
    case 'add-visita-farm': state.modal = {type:'calendario', entidadId: parseInt(data.id), entidadTipo:'farmacia'}; renderApp(); break;
    case 'nota-rapida': state.modal = {type:'nota', medicoId: parseInt(data.id), nombre: data.nombre}; renderApp(); break;
    case 'editar-medico': state.modal = {type:'editar-medico', id: parseInt(data.id)}; renderApp(); break;
    case 'editar-farmacia': state.modal = {type:'editar-farmacia', id: parseInt(data.id)}; renderApp(); break;
    case 'nota-rapida-farm': state.modal = {type:'nota', farmaciaId: parseInt(data.id), nombre: data.nombre}; renderApp(); break;
    case 'close-modal': state.modal = null; renderApp(); break;
    case 'guardar-visita': await guardarVisita(data); break;
    case 'guardar-nota': await guardarNota(); break;
    case 'guardar-alta': await guardarAlta(); break;
    case 'guardar-baja': await guardarBaja(); break;
    case 'toggle-nota': await toggleNota(parseInt(data.id)); break;
    case 'eliminar-visita': {
      await db.delete('visitas', parseInt(data.id));
      await recargarDatos();
      toast('Visita eliminada', 'ok');
      renderApp();
      break;
    }
    case 'sync-sheets': await doSync(); break;
    case 'export-csv': await doExport(); break;
    case 'backup': await doBackup(); break;
    case 'guardar-url': await guardarUrl(); break;
    case 'nueva-nota': state.modal = {type:'nota'}; renderApp(); break;
    case 'nueva-tarea': state.modal = {type:'tarea'}; renderApp(); break;
    case 'guardar-tarea': await guardarTarea(); break;
    case 'open-nota-detalle': state.modal = {type:'nota-detalle', id: parseInt(data.id)}; renderApp(); break;
    case 'editar-nota': state.modal = {type:'editar-nota', id: parseInt(data.id)}; renderApp(); break;
    case 'eliminar-nota': await eliminarNota(parseInt(data.id)); break;
    case 'guardar-nota-editada': await guardarNotaEditada(data); break;
    case 'nueva-alta': state.modal = {type:'alta'}; renderApp(); break;
    case 'nueva-baja': state.modal = {type:'baja'}; renderApp(); break;
    case 'nuevo-brick': state.modal = {type:'brick'}; renderApp(); break;
    case 'set-nota-tab': state.notaSubTab = data.tab; renderApp(); break;
    case 'cal-select': calSelect(data); break;
    case 'cal-month': calMonth(parseInt(data.delta)); break;
    case 'cal-today': calToday(); break;
    case 'open-dia': state.modal = {type:'dia', fecha: data.fecha}; renderApp(); break;
    case 'editar-visita-fecha': {
      state.modal = {type:'editar-visita', id: parseInt(data.id), fecha: data.fecha};
      renderApp();
      break;
    }
    case 'guardar-visita-editada': guardarVisitaEditada(data); break;
    case 'guardar-medico': await guardarMedico(data); break;
    case 'guardar-farmacia': await guardarFarmacia(data); break;
    case 'guardar-brick': await guardarBrick(); break;
    case 'eliminar-brick': await eliminarBrick(data.brick); break;
    case 'importar-backup': await importarBackup(data); break;
    case 'resumen-filter': {
      const target = data.target;
      if (target === 'medicos') {
        state.view = 'medicos';
        state.filtroExtraMed = null;
        state.ciudadMed = data.ciudad || state.ciudadMed;
        if (data.segmento) { state.medicoSubTab = data.segmento; state.filterSegment = null; }
        if (data.especialidad) { state.especialidadMed = data.especialidad; }
        if (data.filtro === 'H') { state.medicoSubTab = 'H'; state.filterSegment = null; }
        if (data.filtro === 'Deblax') { state.medicoSubTab = 'Deblax'; state.filterSegment = null; }
        if (data.filtro === 'sin-celular') { state.filtroExtraMed = 'sin-celular'; state.medicoSubTab = 'Panel'; }
        if (data.filtro === 'sin-email') { state.filtroExtraMed = 'sin-email'; state.medicoSubTab = 'Panel'; }
        if (data.filtro === 'freq2') { state.filtroExtraMed = 'freq2'; state.medicoSubTab = 'Panel'; }
      } else if (target === 'farmacias') {
        state.view = 'farmacias';
        state.ciudadFarm = data.ciudad || state.ciudadFarm;
        if (data.filtro === 'Adium') { state.farmaciaSubTab = 'Adium tu Aliado'; }
      } else if (target === 'notas') {
        state.view = 'notas';
        if (data.filtro === 'altas') state.notaSubTab = 'Altas';
        if (data.filtro === 'bajas') state.notaSubTab = 'Bajas';
      }
      window.scrollTo(0,0); renderApp(); break;
    }
    case 'set-pend-filter': state.dashboardPendFilter = data.filtro; renderApp(); break;
    case 'open-resumen-dias': state.view = 'resumen-dias'; window.scrollTo(0,0); renderApp(); break;
    case 'open-pendientes-medicos': state.view = 'pendientes-medicos'; window.scrollTo(0,0); renderApp(); break;
    case 'open-pendientes-farmacias': state.view = 'pendientes-farmacias'; window.scrollTo(0,0); renderApp(); break;
    case 'volver-dashboard': state.view = 'dashboard'; window.scrollTo(0,0); renderApp(); break;
    case 'open-metricas-mes': state.view = 'metricas-mes'; window.scrollTo(0,0); renderApp(); break;
    case 'set-metricas-mes': state.metricasMes = data.mes; renderApp(); break;
    case 'set-metricas-ciudad': {
      const ciudad = data.ciudad;
      state.metricasCiudad = state.metricasCiudad === ciudad ? 'Todas' : ciudad;
      renderApp(); break;
    }
    case 'set-pend-ciudad': {
      if (data.target === 'med') state.pendMedCiudad = data.ciudad;
      else state.pendFarmCiudad = data.ciudad;
      renderApp(); break;
    }
    case 'set-especialidad': {
      state.especialidadMed = data.especialidad;
      renderApp(); break;
    }
    case 'set-estado-med': {
      state.estadoMed = data.estado;
      renderApp(); break;
    }
    case 'set-estado-farm': {
      state.estadoFarm = data.estado;
      renderApp(); break;
    }
    case 'limpiar-busqueda-med': {
      state.busquedaMed = '';
      renderApp();
      setTimeout(() => { const el = $('busqueda-med'); if (el) el.focus(); }, 0);
      break;
    }
    case 'limpiar-busqueda-farm': {
      state.busquedaFarm = '';
      renderApp();
      setTimeout(() => { const el = $('busqueda-farm'); if (el) el.focus(); }, 0);
      break;
    }
    case 'set-data-tab': state.dataSubTab = data.tab; renderApp(); break;
    case 'toggle-data-expand': {
      const { tipo, key } = data;
      state.dataExpanded[tipo][key] = !state.dataExpanded[tipo][key];
      renderApp();
      break;
    }
    case 'toggle-data-filter': {
      const f = data.filter;
      state.dataFiltersOpen[f] = !state.dataFiltersOpen[f];
      renderApp();
      break;
    }
    case 'clear-data-marcas': {
      state.dataMarcas = [];
      state.dataFiltersOpen.marcas = false;
      renderApp();
      break;
    }
    case 'clear-data-ciudad': {
      state.dataCiudad = [];
      state.dataFiltersOpen.ciudad = false;
      renderApp();
      break;
    }
    case 'set-data-mercado': {
      state.dataMercado = data.mercado;
      state.dataMarcas = [];
      state.dataFiltersOpen.mercado = false;
      renderApp();
      break;
    }
    case 'toggle-data-marca': {
      const marca = data.marca;
      const idx = state.dataMarcas.indexOf(marca);
      if (idx >= 0) state.dataMarcas.splice(idx, 1);
      else state.dataMarcas.push(marca);
      state.dataFiltersOpen.marcas = false;
      renderApp();
      break;
    }
    case 'toggle-data-ciudad': {
      const ciudad = data.ciudad;
      const idx = state.dataCiudad.indexOf(ciudad);
      if (idx >= 0) state.dataCiudad.splice(idx, 1);
      else state.dataCiudad.push(ciudad);
      state.dataFiltersOpen.ciudad = false;
      renderApp();
      break;
    }
    case 'sync-data': await doSyncData(); break;
    case 'cambiar-usuario': {
      localStorage.removeItem('cobertura_usuario');
      location.reload();
      break;
    }
  }
}

function setupEvents() {
  // Delegación para elementos dinámicos
  document.addEventListener('click', e => {
    // Determinar si el click original fue dentro de un filtro Data antes de re-renderizar
    const dentroFiltro = !!e.target.closest('.data-filter-wrap');
    const btn = e.target.closest('[data-action]');
    if (btn) handleAction(btn.dataset.action, btn.dataset, e);

    // Cerrar dropdowns de filtros Data al hacer click fuera
    if (!dentroFiltro && (state.dataFiltersOpen.mercado || state.dataFiltersOpen.marcas || state.dataFiltersOpen.ciudad)) {
      state.dataFiltersOpen = { mercado: false, marcas: false, ciudad: false };
      renderApp();
    }
  });
}


// ===== DASHBOARD =====
function renderDashboard() {
  const hoy = hoyISO();
  const dht = diasHabilesCicloHasta(hoy);
  const dhMes = diasHabilesMes(new Date().getFullYear(), new Date().getMonth());
  const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesActual = nombresMes[new Date().getMonth()];

  // Totales del panel cargado (contactos únicos)
  const totalContactosMed = medicosCache.length || 180;
  const totalContactosFarm = farmaciasCache.length || 60;

  // Meta diaria según días hábiles del mes (recalcular si < 20 días)
  const metaDiariaMed = dhMes >= 20 ? 9 : Math.max(1, Math.round(totalContactosMed / dhMes));
  const metaDiariaFarm = dhMes >= 20 ? 3 : Math.max(1, Math.round(totalContactosFarm / dhMes));

  // Visitas totales (entidades distintas visitadas en el mes actual)
  const vMed = medicosCache.filter(m => (visitasMap['medico-'+m.id]||0) > 0).length;
  const vFarm = farmaciasCache.filter(f => (visitasMap['farmacia-'+f.id]||0) > 0).length;

  // Meta acumulada al día (nunca supera el total de contactos del panel)
  const metaDiaMed = Math.min(dht * metaDiariaMed, totalContactosMed);
  const metaDiaFarm = Math.min(dht * metaDiariaFarm, totalContactosFarm);

  // Cobertura al día
  const pctMed = metaDiaMed > 0 ? Math.round((vMed / metaDiaMed) * 100) : 0;
  const pctFarm = metaDiaFarm > 0 ? Math.round((vFarm / metaDiaFarm) * 100) : 0;
  const clsMed = claseCobGeneral(pctMed);
  const clsFarm = claseCobGeneral(pctFarm);
  const colMed = colorCobGeneral(pctMed);
  const colFarm = colorCobGeneral(pctFarm);

  // % Total mes (sobre el total de contactos del panel)
  const pctTotalMesMed = totalContactosMed > 0 ? Math.round((vMed / totalContactosMed) * 100) : 0;
  const pctTotalMesFarm = totalContactosFarm > 0 ? Math.round((vFarm / totalContactosFarm) * 100) : 0;

  // Segmentos H, C, P (cobertura sobre total del segmento, mínimo 95%)
  const segData = ['H','C','P'].map(seg => {
    const lista = medicosCache.filter(m => obtenerSegmentos(m).includes(seg));
    const vr = lista.filter(m => (visitasMap['medico-'+m.id]||0) > 0).length;
    const pct = lista.length > 0 ? Math.round((vr / lista.length) * 100) : 0;
    const ok = pct >= 95;
    return {seg, vr, total: lista.length, pct, ok, cls: claseCobSegmento(pct), col: colorCobSegmento(pct)};
  });

  // Pendientes conteos
  const pendMedCount = medicosCache.filter(m => {
    const v = visitasMap['medico-'+m.id] || 0;
    return v < (parseInt(m.frecuencia) || 1);
  }).length;
  const pendFarmCount = farmaciasCache.filter(f => {
    const v = visitasMap['farmacia-'+f.id] || 0;
    return v < (parseInt(f.frecuencia) || 1);
  }).length;

  return `
    <div style="background:var(--surface);border-radius:14px;padding:12px 14px;border:1.5px solid var(--border);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:.78rem;color:var(--text2)">Ciclo ${mesActual} ${new Date().getFullYear()}</div>
        <div style="font-size:.95rem;font-weight:700">📅 Día ${dht} de ${dhMes} hábiles</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.78rem;color:var(--text2)">Hoy</div>
        <div style="font-size:.95rem;font-weight:700">${fmtFecha(hoy)}</div>
      </div>
    </div>

    <!-- TARJETA MÉDICOS -->
    <div class="dash-card medico-card ${clsMed}" data-action="open-metricas-mes" style="margin-bottom:12px;padding:18px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="font-size:1.1rem;font-weight:700">👨‍⚕️ MÉDICOS</div>
        <div style="font-size:1.6rem;font-weight:800;color:${colMed}">${pctMed}%</div>
      </div>
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:8px">Cobertura al día · Meta ${metaDiariaMed}/día</div>
      <div class="dash-bar" style="margin-bottom:10px"><div class="dash-fill" style="width:${Math.min(pctMed,100)}%;background:${colMed}"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text2)">
        <div>Meta al día: <strong>${metaDiaMed}</strong></div>
        <div>Realizadas: <strong>${vMed}</strong></div>
      </div>
      <div style="font-size:.78rem;color:var(--text2);margin-top:4px">% Total panel: <strong>${pctTotalMesMed}%</strong> · Total: ${totalContactosMed}</div>
    </div>

    <!-- TARJETA FARMACIAS -->
    <div class="dash-card farmacia-card ${clsFarm}" data-action="open-metricas-mes" style="margin-bottom:12px;padding:18px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="font-size:1.1rem;font-weight:700">🏥 FARMACIAS</div>
        <div style="font-size:1.6rem;font-weight:800;color:${colFarm}">${pctFarm}%</div>
      </div>
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:8px">Cobertura al día · Meta ${metaDiariaFarm}/día</div>
      <div class="dash-bar" style="margin-bottom:10px"><div class="dash-fill" style="width:${Math.min(pctFarm,100)}%;background:${colFarm}"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text2)">
        <div>Meta al día: <strong>${metaDiaFarm}</strong></div>
        <div>Realizadas: <strong>${vFarm}</strong></div>
      </div>
      <div style="font-size:.78rem;color:var(--text2);margin-top:4px">% Total panel: <strong>${pctTotalMesFarm}%</strong> · Total: ${totalContactosFarm}</div>
    </div>

    <!-- SEGMENTOS H, C, P -->
    <div class="dash-section-title">Segmentos</div>
    <div class="dashboard-grid" style="margin-top:4px;margin-bottom:12px">
      ${segData.map(s => `
        <div class="dash-card segmento-${s.seg.toLowerCase()}-card ${s.cls}" data-action="dash-filter" data-label="${s.seg}">
          <div class="dash-label">${s.seg} ${s.ok ? '✓' : '✗'}</div>
          <div class="dash-value" style="font-size:1.3rem;font-weight:800;color:${s.col}">${s.pct}%</div>
          <div class="dash-bar"><div class="dash-fill" style="width:${Math.min(s.pct,100)}%;background:${s.col}"></div></div>
          <div style="font-size:.72rem;color:var(--text2);margin-top:6px">${s.vr}/${s.total} · Meta ≥95%</div>
        </div>
      `).join('')}
    </div>

    <!-- ACCIONES RÁPIDAS -->
    <div class="dash-section-title">Acciones rápidas</div>
    <div class="dashboard-grid" style="margin-top:4px">
      <div class="dash-card resumen-card" data-action="open-resumen-dias">
        <div class="dash-label">📅 Resumen día</div>
        <div class="dash-value">Ver días</div>
      </div>
      <div class="dash-card pend-med-card" data-action="open-pendientes-medicos">
        <div class="dash-label">👨‍⚕️ Pend. Médicos</div>
        <div class="dash-value">${pendMedCount}</div>
      </div>
      <div class="dash-card pend-farm-card" data-action="open-pendientes-farmacias">
        <div class="dash-label">🏥 Pend. Farmacias</div>
        <div class="dash-value">${pendFarmCount}</div>
      </div>
    </div>
  `;
}

window.cambiarMetricasMes = function(v) { state.metricasMes = v; renderApp(); };

function ultimosMeses(mesStr, n = 6) {
  const [y, m] = mesStr.split('-').map(Number);
  const meses = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    meses.push(`${yy}-${mm}`);
  }
  return meses;
}

function filtrarPorCiudad(lista, ciudad) {
  if (!ciudad || ciudad === 'Todas') return lista;
  return lista.filter(x => x.ciudad && x.ciudad.toUpperCase().includes(ciudad));
}

async function metricasMesData(mes, ciudad) {
  const [y, m] = mes.split('-').map(Number);
  const mesIdx = m - 1;
  const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dh = diasHabilesMes(y, mesIdx);

  const medsFiltrados = filtrarPorCiudad(medicosCache, ciudad);
  const farmsFiltrados = filtrarPorCiudad(farmaciasCache, ciudad);

  // Totales del panel cargado
  const totalContactosMed = medsFiltrados.length || 180;
  const totalContactosFarm = farmsFiltrados.length || 60;

  // Meta diaria según días hábiles (recalcular si < 20 días)
  const metaDiariaMed = dh >= 20 ? 9 : Math.max(1, Math.round(totalContactosMed / dh));
  const metaDiariaFarm = dh >= 20 ? 3 : Math.max(1, Math.round(totalContactosFarm / dh));

  // Meta del mes (nunca supera el total de contactos)
  const metaMesMed = Math.min(dh * metaDiariaMed, totalContactosMed);
  const metaMesFarm = Math.min(dh * metaDiariaFarm, totalContactosFarm);

  const visitas = await db.visitasDelMes(mes);
  const medVisitados = new Set(visitas.filter(v => v.entidadTipo === 'medico').map(v => v.entidadId));
  const farmVisitadas = new Set(visitas.filter(v => v.entidadTipo === 'farmacia').map(v => v.entidadId));

  const vMed = medsFiltrados.filter(m => medVisitados.has(m.id)).length;
  const vFarm = farmsFiltrados.filter(f => farmVisitadas.has(f.id)).length;

  const pctMed = metaMesMed > 0 ? Math.round((vMed / metaMesMed) * 100) : 0;
  const pctFarm = metaMesFarm > 0 ? Math.round((vFarm / metaMesFarm) * 100) : 0;

  const segmentos = {};
  for (const seg of ['H','C','P']) {
    const listaSeg = medsFiltrados.filter(m => obtenerSegmentos(m).includes(seg));
    const vSeg = listaSeg.filter(m => medVisitados.has(m.id)).length;
    const pctSeg = listaSeg.length > 0 ? Math.round((vSeg / listaSeg.length) * 100) : 0;
    segmentos[seg] = { pct: pctSeg, visitados: vSeg, total: listaSeg.length };
  }

  return {
    mes,
    label: `${nombresMes[mesIdx]} ${y}`,
    dh,
    medicos: { pct: pctMed, visitados: vMed, metaMes: metaMesMed, metaDiaria: metaDiariaMed, total: totalContactosMed },
    farmacias: { pct: pctFarm, visitados: vFarm, metaMes: metaMesFarm, metaDiaria: metaDiariaFarm, total: totalContactosFarm },
    segmentos
  };
}

function renderMetricasMes() {
  const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesActualStr = mesActualISO();
  let opciones = ultimosMeses(mesActualStr, 12);
  if (!opciones.includes(state.metricasMes)) opciones.push(state.metricasMes);
  opciones.sort();

  const selectHtml = opciones.map(m => {
    const [y, mm] = m.split('-').map(Number);
    const label = `${nombresMes[mm-1]} ${y}`;
    return `<option value="${m}" ${state.metricasMes===m?'selected':''}>${esc(label)}</option>`;
  }).join('');

  setTimeout(async () => {
    const data = await metricasMesData(state.metricasMes, state.metricasCiudad);
    const evolucion = await Promise.all(ultimosMeses(state.metricasMes, 6).map(m => metricasMesData(m, state.metricasCiudad)));
    const el = $('metricas-contenido');
    if (!el) return;
    el.innerHTML = renderMetricasContenido(data, evolucion);
  }, 0);

  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button class="btn btn-outline btn-sm" data-action="volver-dashboard" style="width:auto">←</button>
      <h2 style="font-size:1.1rem;font-weight:700;flex:1">📊 Métricas por mes</h2>
    </div>
    <div class="form-group" style="margin-bottom:10px">
      <label class="form-label">Mes</label>
      <select class="form-input" onchange="window.cambiarMetricasMes(this.value)">${selectHtml}</select>
    </div>
    <div class="city-filters" style="margin-bottom:12px">
      <button class="city-btn ${state.metricasCiudad==='Todas'?'active':''}" data-action="set-metricas-ciudad" data-ciudad="Todas">Todas</button>
      <button class="city-btn ${state.metricasCiudad==='BOGOTÁ'?'active':''}" data-action="set-metricas-ciudad" data-ciudad="BOGOTÁ">BOGOTÁ</button>
      <button class="city-btn ${state.metricasCiudad==='IBAGUÉ'?'active':''}" data-action="set-metricas-ciudad" data-ciudad="IBAGUÉ">IBAGUÉ</button>
    </div>
    <div id="metricas-contenido"><div class="empty-state">Calculando métricas...</div></div>
  `;
}

function renderMetricasContenido(data, evolucion) {
  const colMed = colorCobGeneral(data.medicos.pct);
  const colFarm = colorCobGeneral(data.farmacias.pct);
  const barColores = { medicos: '#ed8936', H: '#f56565', C: '#4299e1', P: '#48bb78', farmacias: '#48bb78' };

  const segmentosHtml = ['H','C','P'].map(seg => {
    const s = data.segmentos[seg];
    const ok = s.pct >= 95;
    return `
      <div class="metricas-kpi">
        <div class="metricas-kpi-label">Segmento ${seg} ${ok ? '✓' : '✗'}</div>
        <div class="metricas-kpi-value" style="color:${ok?'#276749':'#c53030'}">${s.pct}%</div>
        <div class="metricas-kpi-meta">${s.visitados}/${s.total} visitados · Meta ≥95%</div>
      </div>
    `;
  }).join('');

  const chartsHtml = [
    { key: 'medicos', label: '👨‍⚕️ Médicos' },
    { key: 'H', label: 'Segmento H' },
    { key: 'C', label: 'Segmento C' },
    { key: 'P', label: 'Segmento P' },
    { key: 'farmacias', label: '🏥 Farmacias' }
  ].map(chart => {
    return `
      <div class="metricas-chart-wrap">
        <div class="metricas-chart-title">${esc(chart.label)}</div>
        <div class="metricas-chart">
          <div class="metricas-ref-line" title="Meta 95%"></div>
          ${evolucion.map(d => {
            const pct = chart.key === 'medicos' ? d.medicos.pct : chart.key === 'farmacias' ? d.farmacias.pct : d.segmentos[chart.key].pct;
            return `<div class="metricas-bar-col"><div class="metricas-bar" style="height:${Math.min(pct,100)}%;background:${barColores[chart.key]}"></div></div>`;
          }).join('')}
        </div>
        <div class="metricas-chart-labels">
          ${evolucion.map(d => `<div>${d.label.split(' ')[0]}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  const tablaHtml = `
    <div class="metricas-table-wrap">
      <table class="metricas-table">
        <thead>
          <tr><th>Mes</th><th>Médicos</th><th>H</th><th>C</th><th>P</th><th>Farmacias</th></tr>
        </thead>
        <tbody>
          ${evolucion.map(d => {
            const clsMed = d.medicos.pct >= 95 ? 'good' : 'bad';
            const clsH = d.segmentos.H.pct >= 95 ? 'good' : 'bad';
            const clsC = d.segmentos.C.pct >= 95 ? 'good' : 'bad';
            const clsP = d.segmentos.P.pct >= 95 ? 'good' : 'bad';
            const clsFarm = d.farmacias.pct >= 95 ? 'good' : 'bad';
            return `
              <tr class="${d.mes===data.mes?'selected':''}">
                <td>${d.label}</td>
                <td class="${clsMed}">${d.medicos.pct}%</td>
                <td class="${clsH}">${d.segmentos.H.pct}%</td>
                <td class="${clsC}">${d.segmentos.C.pct}%</td>
                <td class="${clsP}">${d.segmentos.P.pct}%</td>
                <td class="${clsFarm}">${d.farmacias.pct}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="metricas-big-card">
      <div class="metricas-big-title">👨‍⚕️ MÉDICOS</div>
      <div class="metricas-big-value" style="color:${colMed}">${data.medicos.pct}%</div>
      <div class="metricas-big-meta">Realizadas: <strong>${data.medicos.visitados}</strong> de <strong>${data.medicos.total}</strong></div>
      <div class="metricas-big-meta">Meta del mes: <strong>${data.medicos.metaMes}</strong></div>
      <div class="metricas-big-meta">Meta diaria: <strong>${data.medicos.metaDiaria}</strong> · Días hábiles: <strong>${data.dh}</strong></div>
    </div>

    <div class="metricas-kpi-grid">
      ${segmentosHtml}
    </div>

    <div class="metricas-big-card">
      <div class="metricas-big-title">🏥 FARMACIAS</div>
      <div class="metricas-big-value" style="color:${colFarm}">${data.farmacias.pct}%</div>
      <div class="metricas-big-meta">Realizadas: <strong>${data.farmacias.visitados}</strong> de <strong>${data.farmacias.total}</strong></div>
      <div class="metricas-big-meta">Meta del mes: <strong>${data.farmacias.metaMes}</strong></div>
      <div class="metricas-big-meta">Meta diaria: <strong>${data.farmacias.metaDiaria}</strong> · Días hábiles: <strong>${data.dh}</strong></div>
    </div>

    <div class="dash-section-title">Evolución mensual</div>
    ${chartsHtml}

    <div class="dash-section-title">Tabla resumen</div>
    ${tablaHtml}
  `;
}

// ===== RESUMEN PANEL =====
function renderResumenPanel() {
  // --- MÉDICOS ---
  const totalMed = medicosCache.length;
  const medicosBog = medicosCache.filter(m => m.ciudad && m.ciudad.toUpperCase().includes('BOGOTÁ')).length;
  const medicosIba = medicosCache.filter(m => m.ciudad && m.ciudad.toUpperCase().includes('IBAGUÉ')).length;

  const segCounts = {};
  for (const seg of ['H','C','P','M','E','PS']) {
    segCounts[seg] = medicosCache.filter(m => obtenerSegmentos(m).includes(seg)).length;
  }

  const espCounts = {};
  for (const m of medicosCache) {
    if (m.especialidad) espCounts[m.especialidad] = (espCounts[m.especialidad] || 0) + 1;
  }
  const espSorted = Object.entries(espCounts).sort((a,b) => b[1] - a[1]);

  const medH = medicosCache.filter(m => obtenerSegmentos(m).includes('H')).length;
  const medDeblax = medicosCache.filter(m => m.deblax === true).length;
  const medSinCel = medicosCache.filter(m => !m.celular || m.celular.trim() === '').length;
  const medSinEmail = medicosCache.filter(m => !m.email || m.email.trim() === '').length;
  const medFreq2 = medicosCache.filter(m => (parseInt(m.frecuencia) || 1) >= 2).length;

  // --- FARMACIAS ---
  const totalFarm = farmaciasCache.length;
  const farmBog = farmaciasCache.filter(f => f.ciudad && f.ciudad.toUpperCase().includes('BOGOTÁ')).length;
  const farmIba = farmaciasCache.filter(f => f.ciudad && f.ciudad.toUpperCase().includes('IBAGUÉ')).length;
  const farmAdium = farmaciasCache.filter(f => f.adium === true).length;

  // --- BRICKS ---
  const bricksMed = [...new Set(medicosCache.map(m => m.brick).filter(Boolean))];
  const bricksFarm = [...new Set(farmaciasCache.map(f => f.brick).filter(Boolean))];
  const allBricks = [...new Set([...bricksMed, ...bricksFarm])];
  const bricksBog = allBricks.filter(b => {
    const z = getBrickZona(b);
    return z && !z.toUpperCase().includes('IBAGUÉ');
  }).length;
  const bricksIba = allBricks.filter(b => {
    const z = getBrickZona(b);
    return z && z.toUpperCase().includes('IBAGUÉ');
  }).length;

  // --- PENDIENTES VEEVA (Altas/Bajas) ---
  // Se cargan async
  setTimeout(async () => {
    const notas = await db.getAll('notas');
    const altas = notas.filter(n => n.tipo === 'alta' && !n.completada).length;
    const bajas = notas.filter(n => n.tipo === 'baja' && !n.completada).length;
    const elA = $('rp-altas');
    const elB = $('rp-bajas');
    if (elA) elA.textContent = altas;
    if (elB) elB.textContent = bajas;
  }, 0);

  return `
    <div style="font-size:1.1rem;font-weight:700;margin-bottom:14px">📋 Resumen Panel</div>

    <!-- MÉDICOS -->
    <div style="background:var(--surface);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-bottom:12px">
      <div style="font-size:.9rem;font-weight:700;margin-bottom:10px;color:#2b6cb0">👨‍⚕️ Médicos en Panel</div>
      <div style="font-size:1.4rem;font-weight:800;margin-bottom:12px">${totalMed}</div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text2);margin-bottom:6px">Por ciudad</div>
      <div class="dashboard-grid" style="margin-bottom:12px">
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-ciudad="BOGOTÁ">
          <div class="dash-label">Bogotá</div>
          <div class="dash-value">${medicosBog} <span style="font-size:.75rem">(${totalMed>0?Math.round(medicosBog/totalMed*100):0}%)</span></div>
          <div class="dash-bar"><div class="dash-fill" style="width:${totalMed>0?medicosBog/totalMed*100:0}%;background:#4299e1"></div></div>
        </div>
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-ciudad="IBAGUÉ">
          <div class="dash-label">Ibagué</div>
          <div class="dash-value">${medicosIba} <span style="font-size:.75rem">(${totalMed>0?Math.round(medicosIba/totalMed*100):0}%)</span></div>
          <div class="dash-bar"><div class="dash-fill" style="width:${totalMed>0?medicosIba/totalMed*100:0}%;background:#4299e1"></div></div>
        </div>
      </div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text2);margin-bottom:6px">Por segmento</div>
      <div class="dashboard-grid" style="margin-bottom:12px">
        ${['H','C','P','M','E','PS'].map(seg => {
          const cnt = segCounts[seg] || 0;
          return `
            <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-segmento="${seg}">
              <div class="dash-label">${seg}</div>
              <div class="dash-value">${cnt} <span style="font-size:.75rem">(${totalMed>0?Math.round(cnt/totalMed*100):0}%)</span></div>
              <div class="dash-bar"><div class="dash-fill" style="width:${totalMed>0?cnt/totalMed*100:0}%;background:#4299e1"></div></div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text2);margin-bottom:6px">Especialidades</div>
      <div style="max-height:200px;overflow-y:auto;margin-bottom:12px">
        ${espSorted.map(([esp, cnt]) => `
          <div class="list-item" data-action="resumen-filter" data-target="medicos" data-especialidad="${esc(esp)}">
            <div class="list-info">
              <div class="list-name" style="font-size:.85rem">${esc(esp)}</div>
              <div class="list-meta">${cnt} médico${cnt!==1?'s':''} · ${totalMed>0?Math.round(cnt/totalMed*100):0}%</div>
            </div>
            <div class="list-actions"><span style="font-size:.9rem;font-weight:700">${cnt}</span></div>
          </div>
        `).join('')}
      </div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text2);margin-bottom:6px">Otros filtros</div>
      <div class="dashboard-grid">
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-filtro="H">
          <div class="dash-label">Médicos H</div>
          <div class="dash-value">${medH}</div>
        </div>
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-filtro="Deblax">
          <div class="dash-label">Con Deblax</div>
          <div class="dash-value">${medDeblax}</div>
        </div>
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-filtro="sin-celular">
          <div class="dash-label">Sin celular ⚠️</div>
          <div class="dash-value">${medSinCel}</div>
        </div>
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-filtro="sin-email">
          <div class="dash-label">Sin email ⚠️</div>
          <div class="dash-value">${medSinEmail}</div>
        </div>
        <div class="dash-card rp-med" data-action="resumen-filter" data-target="medicos" data-filtro="freq2">
          <div class="dash-label">Frecuencia 2+</div>
          <div class="dash-value">${medFreq2}</div>
        </div>
      </div>
    </div>

    <!-- FARMACIAS -->
    <div style="background:var(--surface);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-bottom:12px">
      <div style="font-size:.9rem;font-weight:700;margin-bottom:10px;color:#38a169">🏥 Farmacias</div>
      <div style="font-size:1.4rem;font-weight:800;margin-bottom:12px">${totalFarm}</div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text2);margin-bottom:6px">Por ciudad</div>
      <div class="dashboard-grid" style="margin-bottom:12px">
        <div class="dash-card rp-farm" data-action="resumen-filter" data-target="farmacias" data-ciudad="BOGOTÁ">
          <div class="dash-label">Bogotá</div>
          <div class="dash-value">${farmBog} <span style="font-size:.75rem">(${totalFarm>0?Math.round(farmBog/totalFarm*100):0}%)</span></div>
          <div class="dash-bar"><div class="dash-fill" style="width:${totalFarm>0?farmBog/totalFarm*100:0}%;background:#48bb78"></div></div>
        </div>
        <div class="dash-card rp-farm" data-action="resumen-filter" data-target="farmacias" data-ciudad="IBAGUÉ">
          <div class="dash-label">Ibagué</div>
          <div class="dash-value">${farmIba} <span style="font-size:.75rem">(${totalFarm>0?Math.round(farmIba/totalFarm*100):0}%)</span></div>
          <div class="dash-bar"><div class="dash-fill" style="width:${totalFarm>0?farmIba/totalFarm*100:0}%;background:#48bb78"></div></div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="dash-card rp-farm" data-action="resumen-filter" data-target="farmacias" data-filtro="Adium">
          <div class="dash-label">Adium tu Aliado</div>
          <div class="dash-value">${farmAdium}</div>
        </div>
      </div>
    </div>

    <!-- BRICKS -->
    <div style="background:var(--surface);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-bottom:12px">
      <div style="font-size:.9rem;font-weight:700;margin-bottom:10px;color:#dd6b20">🏗️ Bricks</div>
      <div style="font-size:1.4rem;font-weight:800;margin-bottom:8px">${allBricks.length}</div>
      <div style="font-size:.85rem;color:var(--text2)">Bogotá: <strong>${bricksBog}</strong> · Ibagué: <strong>${bricksIba}</strong></div>
    </div>

    <!-- PENDIENTES VEEVA -->
    <div style="background:var(--surface);border-radius:14px;padding:14px;border:1.5px solid var(--border);margin-bottom:12px">
      <div style="font-size:.9rem;font-weight:700;margin-bottom:10px;color:#c53030">📋 Pendientes Veeva</div>
      <div class="dashboard-grid">
        <div class="dash-card rp-veeva" data-action="resumen-filter" data-target="notas" data-filtro="altas">
          <div class="dash-label">Altas</div>
          <div class="dash-value" id="rp-altas">—</div>
        </div>
        <div class="dash-card rp-veeva" data-action="resumen-filter" data-target="notas" data-filtro="bajas">
          <div class="dash-label">Bajas</div>
          <div class="dash-value" id="rp-bajas">—</div>
        </div>
      </div>
    </div>
  `;
}

// ===== MEDICOS =====
function renderMedicos() {
  const subTabs = usuarioActivo === 'carlos'
    ? ['Panel','H','C','P','M','E','PS','Brick','Deblax']
    : ['Panel','H','C','P','M','E','PS','Brick'];
  const tabsHtml = subTabs.map(t => `<button class="sub-tab ${state.medicoSubTab===t?'active':''}" data-action="set-subtab" data-tab="${t}" data-target="med">${t}</button>`).join('');

  let filtrados = medicosCache.filter(m => {
    if (m.ciudad && !m.ciudad.toUpperCase().includes(state.ciudadMed)) return false;
    if (state.medicoSubTab === 'Panel') return true;
    if (state.medicoSubTab === 'Brick') return true;
    if (state.medicoSubTab === 'Deblax') return m.deblax === true;
    return obtenerSegmentos(m).includes(state.medicoSubTab);
  });

  // Filtros extra desde Resumen Panel
  if (state.filtroExtraMed === 'sin-celular') {
    filtrados = filtrados.filter(m => !m.celular || m.celular.trim() === '');
  } else if (state.filtroExtraMed === 'sin-email') {
    filtrados = filtrados.filter(m => !m.email || m.email.trim() === '');
  } else if (state.filtroExtraMed === 'freq2') {
    filtrados = filtrados.filter(m => (parseInt(m.frecuencia) || 1) >= 2);
  }

  if (state.filterSegment && state.filterSegment !== 'Médicos Total') {
    filtrados = filtrados.filter(m => obtenerSegmentos(m).includes(state.filterSegment));
  }

  if (state.busquedaMed.trim()) {
    const b = quitarTildes(state.busquedaMed);
    filtrados = filtrados.filter(m => quitarTildes(m.nombre).includes(b));
  }

  // Filtro especialidad
  if (state.especialidadMed && state.especialidadMed !== 'Todas') {
    filtrados = filtrados.filter(m => m.especialidad === state.especialidadMed);
  }

  // Filtro estado
  if (state.estadoMed === 'Visitados') {
    filtrados = filtrados.filter(m => {
      const v = visitasMap['medico-'+m.id] || 0;
      return v >= (parseInt(m.frecuencia) || 1);
    });
  } else if (state.estadoMed === 'Pendientes') {
    filtrados = filtrados.filter(m => {
      const v = visitasMap['medico-'+m.id] || 0;
      return v < (parseInt(m.frecuencia) || 1);
    });
  }

  // Ordenamiento: H primero, luego alfabético
  filtrados.sort((a, b) => {
    const aH = obtenerSegmentos(a).includes('H');
    const bH = obtenerSegmentos(b).includes('H');
    if (aH && !bH) return -1;
    if (!aH && bH) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  // Especialidades únicas para dropdown
  const especialidades = ['Todas', ...[...new Set(medicosCache.map(m => m.especialidad).filter(Boolean))].sort()];
  const espHtml = `<select class="filter-select" onchange="window.cambiarEsp(this.value)">
    ${especialidades.map(e => `<option value="${esc(e)}" ${state.especialidadMed===e?'selected':''}>${esc(e)}</option>`).join('')}
  </select>`;

  const estados = ['Todos','Visitados','Pendientes'];
  const estadoHtml = estados.map(e =>
    `<button class="estado-btn ${state.estadoMed===e?'active':''}" data-action="set-estado-med" data-estado="${e}">${e}</button>`
  ).join('');

  const searchHtml = `
    <div class="search-wrap">
      <input class="search-box" id="busqueda-med" placeholder="Buscar médico..." value="${esc(state.busquedaMed)}" oninput="window.buscarMed(this.value)">
      ${state.busquedaMed ? `<button class="search-clear" data-action="limpiar-busqueda-med" aria-label="Limpiar búsqueda">✕</button>` : ''}
    </div>
  `;

  if (state.medicoSubTab === 'Brick') {
    const porBrick = {};
    for (const m of filtrados) { const b = m.brick || 'Sin brick'; if(!porBrick[b]) porBrick[b]=[]; porBrick[b].push(m); }
    const bricks = Object.keys(porBrick).sort();
    return `
      <div class="city-filters">
        <button class="city-btn ${state.ciudadMed==='BOGOTÁ'?'active':''}" data-action="set-ciudad" data-ciudad="BOGOTÁ" data-target="med">BOGOTÁ</button>
        <button class="city-btn ${state.ciudadMed==='IBAGUÉ'?'active':''}" data-action="set-ciudad" data-ciudad="IBAGUÉ" data-target="med">IBAGUÉ</button>
      </div>
      <div class="sub-tabs">${tabsHtml}</div>
      <div class="extra-filters">
        ${espHtml}
        <div class="estado-filters">${estadoHtml}</div>
      </div>
      ${searchHtml}
      ${bricks.map(b => {
        const zona = porBrick[b][0]?.brickZona || '';
        const brickTitle = zona ? `BRICK ${esc(b)} - ${esc(zona)}` : `BRICK ${esc(b)}`;
        return `
        <div class="brick-group">
          <div class="brick-title">${brickTitle}</div>
          <div class="lista">${porBrick[b].map(m => renderMedicoItem(m)).join('')}</div>
        </div>
        `;
      }).join('')}
      ${filtrados.length===0?'<div class="empty-state">No hay médicos</div>':''}
    `;
  }

  return `
    <div class="city-filters">
      <button class="city-btn ${state.ciudadMed==='BOGOTÁ'?'active':''}" data-action="set-ciudad" data-ciudad="BOGOTÁ" data-target="med">BOGOTÁ</button>
      <button class="city-btn ${state.ciudadMed==='IBAGUÉ'?'active':''}" data-action="set-ciudad" data-ciudad="IBAGUÉ" data-target="med">IBAGUÉ</button>
    </div>
    <div class="sub-tabs">${tabsHtml}</div>
    <div class="extra-filters">
      ${espHtml}
      <div class="estado-filters">${estadoHtml}</div>
    </div>
    ${searchHtml}
    <div class="lista">
      ${filtrados.map(m => renderMedicoItem(m)).join('')}
    </div>
    ${filtrados.length===0?'<div class="empty-state">No hay médicos</div>':''}
  `;
}

function renderMedicoItem(m) {
  const v = visitasMap['medico-'+m.id] || 0;
  const frec = parseInt(m.frecuencia) || 1;
  const st = estadoVisita(v, frec);
  const segs = obtenerSegmentos(m);
  const brickMeta = m.brick ? (m.brickZona ? `Brick ${esc(m.brick)} · ${esc(m.brickZona)}` : `Brick ${esc(m.brick)}`) : '';
  const completo = v >= frec;
  return `
    <div class="list-item">
      <div class="semaforo ${st.cls}" title="${st.lbl}"></div>
      <div class="list-info" data-action="open-medico" data-id="${m.id}">
        <div class="list-name">${esc(m.nombre)}</div>
        <div class="list-meta">${esc(m.especialidad)}${brickMeta ? ' · ' + brickMeta : ''}</div>
      </div>
      <div class="list-segs">${segs.map(s=>`<span class="seg-badge seg-${s.toString().trim().toLowerCase()}">${s}</span>`).join('')}</div>
      <div class="list-actions">
        <button class="btn-icon" data-action="editar-medico" data-id="${m.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="nota-rapida" data-id="${m.id}" data-nombre="${esc(m.nombre)}" title="Nota">📝</button>
        ${completo ? '<span class="btn-icon" style="background:#c6f6d5;color:#276749;font-size:1rem">✓</span>' : `<button class="btn-icon" data-action="add-visita-med" data-id="${m.id}" title="Visita">+</button>`}
      </div>
    </div>
  `;
}

let busquedaMedTimer = null;
let busquedaFarmTimer = null;

window.buscarMed = function(v) {
  state.busquedaMed = v;
  if (busquedaMedTimer) clearTimeout(busquedaMedTimer);
  busquedaMedTimer = setTimeout(() => {
    renderApp();
    const el = $('busqueda-med');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 200);
};
window.buscarFarm = function(v) {
  state.busquedaFarm = v;
  if (busquedaFarmTimer) clearTimeout(busquedaFarmTimer);
  busquedaFarmTimer = setTimeout(() => {
    renderApp();
    const el = $('busqueda-farm');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 200);
};
window.cambiarEsp = function(v) { state.especialidadMed = v; renderApp(); };

// ===== FARMACIAS =====
function renderFarmacias() {
  const subTabs = usuarioActivo === 'carlos'
    ? ['Panel','Brick','Adium tu Aliado']
    : ['Panel','Brick'];
  const tabsHtml = subTabs.map(t => `<button class="sub-tab ${state.farmaciaSubTab===t?'active':''}" data-action="set-subtab" data-tab="${t}" data-target="farm">${t}</button>`).join('');

  let filtrados = farmaciasCache.filter(f => {
    if (f.ciudad && !f.ciudad.toUpperCase().includes(state.ciudadFarm)) return false;
    if (state.farmaciaSubTab === 'Adium tu Aliado') return f.adium === true;
    return true;
  });

  // Filtro búsqueda (sin discriminar tildes)
  if (state.busquedaFarm.trim()) {
    const b = quitarTildes(state.busquedaFarm.toLowerCase());
    filtrados = filtrados.filter(f => quitarTildes(f.nombre.toLowerCase()).includes(b));
  }

  // Filtro estado farmacias
  if (state.estadoFarm === 'Visitadas') {
    filtrados = filtrados.filter(f => {
      const v = visitasMap['farmacia-'+f.id] || 0;
      return v >= (parseInt(f.frecuencia) || 1);
    });
  } else if (state.estadoFarm === 'Pendientes') {
    filtrados = filtrados.filter(f => {
      const v = visitasMap['farmacia-'+f.id] || 0;
      return v < (parseInt(f.frecuencia) || 1);
    });
  }

  filtrados.sort((a,b) => a.nombre.localeCompare(b.nombre));

  const estadosFarm = ['Todos','Visitadas','Pendientes'];
  const estadoFarmHtml = estadosFarm.map(e =>
    `<button class="estado-btn ${state.estadoFarm===e?'active':''}" data-action="set-estado-farm" data-estado="${e}">${e}</button>`
  ).join('');

  if (state.farmaciaSubTab === 'Brick') {
    const porBrick = {};
    for (const f of filtrados) { const b = f.brick || 'Sin brick'; if(!porBrick[b]) porBrick[b]=[]; porBrick[b].push(f); }
    const bricks = Object.keys(porBrick).sort();
    return `
      <div class="city-filters">
        <button class="city-btn ${state.ciudadFarm==='BOGOTÁ'?'active':''}" data-action="set-ciudad" data-ciudad="BOGOTÁ" data-target="farm">BOGOTÁ</button>
        <button class="city-btn ${state.ciudadFarm==='IBAGUÉ'?'active':''}" data-action="set-ciudad" data-ciudad="IBAGUÉ" data-target="farm">IBAGUÉ</button>
      </div>
      <div class="sub-tabs">${tabsHtml}</div>
      <div class="extra-filters">
        <div class="estado-filters">${estadoFarmHtml}</div>
      </div>
      <div class="search-wrap">
        <input class="search-box" id="busqueda-farm" placeholder="Buscar farmacia..." value="${esc(state.busquedaFarm)}" oninput="window.buscarFarm(this.value)">
        ${state.busquedaFarm ? `<button class="search-clear" data-action="limpiar-busqueda-farm" aria-label="Limpiar búsqueda">✕</button>` : ''}
      </div>
      ${bricks.map(b => {
        const zona = porBrick[b][0]?.brickZona || '';
        const brickTitle = zona ? `BRICK ${esc(b)} - ${esc(zona)}` : `BRICK ${esc(b)}`;
        return `
        <div class="brick-group">
          <div class="brick-title">${brickTitle}</div>
          <div class="lista">${porBrick[b].map(f => renderFarmaciaItem(f)).join('')}</div>
        </div>
        `;
      }).join('')}
      ${filtrados.length===0?'<div class="empty-state">No hay farmacias</div>':''}
    `;
  }

  return `
    <div class="city-filters">
      <button class="city-btn ${state.ciudadFarm==='BOGOTÁ'?'active':''}" data-action="set-ciudad" data-ciudad="BOGOTÁ" data-target="farm">BOGOTÁ</button>
      <button class="city-btn ${state.ciudadFarm==='IBAGUÉ'?'active':''}" data-action="set-ciudad" data-ciudad="IBAGUÉ" data-target="farm">IBAGUÉ</button>
    </div>
    <div class="sub-tabs">${tabsHtml}</div>
    <div class="extra-filters">
      <div class="estado-filters">${estadoFarmHtml}</div>
    </div>
    <div class="search-wrap">
      <input class="search-box" id="busqueda-farm" placeholder="Buscar farmacia..." value="${esc(state.busquedaFarm)}" oninput="window.buscarFarm(this.value)">
      ${state.busquedaFarm ? `<button class="search-clear" data-action="limpiar-busqueda-farm" aria-label="Limpiar búsqueda">✕</button>` : ''}
    </div>
    <div class="lista">
      ${filtrados.map(f => renderFarmaciaItem(f)).join('')}
    </div>
    ${filtrados.length===0?'<div class="empty-state">No hay farmacias</div>':''}
  `;
}

function renderFarmaciaItem(f) {
  const v = visitasMap['farmacia-'+f.id] || 0;
  const frec = parseInt(f.frecuencia) || 1;
  const st = estadoVisita(v, frec);
  const brickMeta = f.brick ? (f.brickZona ? `Brick ${esc(f.brick)} · ${esc(f.brickZona)}` : `Brick ${esc(f.brick)}`) : '';
  const completo = v >= frec;
  return `
    <div class="list-item">
      <div class="semaforo ${st.cls}" title="${st.lbl}"></div>
      <div class="list-info" data-action="open-farmacia" data-id="${f.id}">
        <div class="list-name">${esc(f.nombre)}</div>
        <div class="list-meta">${esc(f.cadena)}${brickMeta ? ' · ' + brickMeta : ''}</div>
      </div>
      <div class="list-actions">
        <button class="btn-icon" data-action="editar-farmacia" data-id="${f.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="nota-rapida-farm" data-id="${f.id}" data-nombre="${esc(f.nombre)}" title="Nota">📝</button>
        ${completo ? '<span class="btn-icon" style="background:#c6f6d5;color:#276749;font-size:1rem">✓</span>' : `<button class="btn-icon" data-action="add-visita-farm" data-id="${f.id}" title="Visita">+</button>`}
      </div>
    </div>
  `;
}


// ===== NOTAS =====
function renderNotas() {
  const tabs = ['Todas','Notas','Tareas','Completadas'];
  const tabsHtml = tabs.map(t =>
    `<button class="sub-tab ${state.notaSubTab===t?'active':''}" data-action="set-nota-tab" data-tab="${t}">${t}</button>`
  ).join('');

  db.getAll('notas').then(notas => {
    notas.sort((a,b) => new Date(b.creado) - new Date(a.creado));
    let filtradas = notas;
    if (state.notaSubTab === 'Notas' || state.notaSubTab === 'Generales') {
      filtradas = notas.filter(n => n.tipo === 'nota' || n.tipo === 'general' || n.tipo === 'alta' || n.tipo === 'baja' || !n.tipo);
    } else if (state.notaSubTab === 'Tareas') {
      filtradas = notas.filter(n => n.tipo === 'tarea' && !n.completada);
    } else if (state.notaSubTab === 'Completadas') {
      filtradas = notas.filter(n => n.tipo === 'tarea' && n.completada);
    } else if (state.notaSubTab === 'Altas') {
      filtradas = notas.filter(n => n.tipo === 'alta');
    } else if (state.notaSubTab === 'Bajas') {
      filtradas = notas.filter(n => n.tipo === 'baja');
    }

    const el = $('notas-lista');
    if (!el) return;
    el.innerHTML = filtradas.map(n => renderNotaItem(n)).join('') +
      (filtradas.length===0?'<div class="empty-state">Sin notas</div>':'');
  });

  return `
    <div class="action-row">
      <button class="btn btn-outline" data-action="nueva-nota">📝 Nota</button>
      <button class="btn btn-outline" data-action="nueva-tarea" style="color:#2b6cb0;border-color:#bee3f8">➕ Tarea</button>
      <button class="btn btn-outline" data-action="nueva-alta" style="color:#166534;border-color:#bbf7d0">➕ Alta</button>
      <button class="btn btn-outline" data-action="nueva-baja" style="color:#991b1b;border-color:#fecaca">➖ Baja</button>
    </div>
    <div class="sub-tabs">${tabsHtml}</div>
    <div class="lista" id="notas-lista"><div class="empty-state">Cargando...</div></div>
  `;
}

function renderNotaItem(n) {
  const tipoLabel = n.tipo === 'alta' ? '<span class="nota-tipo nota-tipo-alta">Alta</span>' :
    n.tipo === 'baja' ? '<span class="nota-tipo nota-tipo-baja">Baja</span>' :
    n.tipo === 'tarea' ? '<span class="nota-tipo nota-tipo-tarea">Tarea</span>' :
    '<span class="nota-tipo nota-tipo-general">Nota</span>';
  let contenido = n.texto || '';
  if (n.tipo === 'alta' && n.nombreAlta) contenido = `Alta: ${esc(n.nombreAlta)} — ${esc(n.especialidadAlta||'')}`;
  if (n.tipo === 'baja' && n.nombreBaja) contenido = `Baja: ${esc(n.nombreBaja)} — ${esc(n.motivoBaja||'')}`;
  let titulo = '';
  if (n.medicoId) {
    const m = medicosCache.find(x => x.id === n.medicoId);
    titulo = m ? esc(m.nombre) : '';
  } else if (n.farmaciaId) {
    const f = farmaciasCache.find(x => x.id === n.farmaciaId);
    titulo = f ? esc(f.nombre) : '';
  } else if (n.tipo === 'tarea') {
    titulo = esc(n.titulo) || 'Tarea';
  } else {
    titulo = esc(n.titulo) || 'Nota aislada';
  }
  const tieneCheckbox = n.tipo === 'tarea' || n.tipo === 'alta' || n.tipo === 'baja';
  return `
    <div class="list-item nota-item">
      ${tieneCheckbox ? `<input type="checkbox" class="nota-checkbox" ${n.completada?'checked':''} data-action="toggle-nota" data-id="${n.id}" aria-label="Marcar completada">` : '<div style="width:24px;flex-shrink:0"></div>'}
      <div class="list-info nota-info" data-action="open-nota-detalle" data-id="${n.id}">
        <div class="nota-titulo">${tipoLabel}${titulo}</div>
        <div class="nota-contenido" style="text-decoration:${n.completada?'line-through':'none'};opacity:${n.completada?0.6:1}">${contenido}</div>
        ${n.fecha ? `<div class="list-meta">📅 ${fmtFecha(n.fecha)}</div>` : ''}
      </div>
    </div>
  `;
}

async function toggleNota(id) {
  const n = await db.getById('notas', id);
  if (!n) return;
  n.completada = !n.completada;
  await db.put('notas', n);
  renderApp();
}

// ===== CONFIG =====
function renderConfig() {
  db.getConfig('sheetsUrl').then(c => {
    const el = $('cfg-url');
    if (el && c?.value) el.value = c.value;
  });
  db.getConfig('lastSync').then(c => {
    const el = $('cfg-last');
    if (el && c?.value) el.textContent = 'Último sync: ' + new Date(c.value).toLocaleString('es-CO');
  });

  const usuarioLabel = usuarioActivo ? (CONFIG.USUARIOS[usuarioActivo]?.nombre || usuarioActivo) : '—';
  const metaMed = usuarioActivo ? CONFIG.USUARIOS[usuarioActivo].metaMedicos : 9;
  const metaFarm = usuarioActivo ? CONFIG.USUARIOS[usuarioActivo].metaFarmacias : 2;

  setTimeout(() => renderBricksConfigList(), 0);

  return `
    <div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:.9rem;margin-bottom:12px">👤 Usuario activo</h3>
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:4px">${esc(usuarioLabel)}</div>
      <div class="text-sm text-secondary mb-1">Meta médicos: ${metaMed}/día · Meta farmacias: ${metaFarm}/día</div>
      <button class="btn btn-outline" data-action="cambiar-usuario">Cambiar usuario</button>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:.9rem;margin-bottom:12px">🔗 Google Sheets</h3>
      <div class="form-group">
        <label class="form-label">URL del panel</label>
        <input class="form-input" id="cfg-url" placeholder="https://docs.google.com/spreadsheets/d/...">
      </div>
      <button class="btn btn-outline mb-1" data-action="guardar-url">Guardar URL</button>
      <button class="btn btn-primary" data-action="sync-sheets">🔄 Sincronizar ahora</button>
      <div class="text-xs text-secondary mt-1" id="cfg-last"></div>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:.9rem;margin-bottom:12px">📤 Exportar</h3>
      <button class="btn btn-outline" data-action="export-csv">Exportar visitas del mes a Excel (CSV)</button>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:.9rem;margin-bottom:12px">📥 Cargar Excel</h3>
      <p class="text-sm text-secondary mb-1">Sube tu archivo .xlsx directamente (hojas "Médicos" y "Farmacias")</p>
      <input type="file" id="cfg-file" accept=".xlsx,.xls" style="margin-bottom:8px" onchange="window.handleExcelFile(this)">
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:.9rem;margin-bottom:12px">🏗️ Gestionar Bricks</h3>
      <div id="bricks-config-list" style="margin-bottom:10px"></div>
      <button class="btn btn-primary" data-action="nuevo-brick">+ Agregar brick</button>
      <div class="text-xs text-secondary mt-1">Bricks personalizados se guardan localmente</div>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:.9rem;margin-bottom:12px">💾 Backup JSON</h3>
      <button class="btn btn-outline mb-1" data-action="backup">📤 Exportar backup</button>
      <button class="btn btn-outline mb-1" onclick="window.cargarBackupInicial()">📥 Cargar backup inicial de julio</button>
      <input type="file" id="cfg-backup-file" accept=".json" style="margin-bottom:8px" onchange="window.importarBackup(this)">
      <div class="text-xs text-secondary">Seleccioná un .json para restaurar</div>
    </div>
  `;
}

async function guardarUrl() {
  const v = ($('cfg-url')?.value || '').trim();
  if (!v) { toast('Ingresa una URL', 'err'); return; }
  await sheets.setUrl(v);
  toast('URL guardada', 'ok');
}

async function doSync() {
  try {
    const r = await sheets.syncAll();
    await recargarDatos();
    toast(`Sync OK: ${r.medicos} médicos, ${r.farmacias} farmacias`, 'ok');
    renderApp();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function doSyncData() {
  try {
    const r = await dataSheets.syncAll();
    await recargarDatos();
    toast(`Data sync OK: ${r.cup} CUP, ${r.ddd} DDD, ${r.sit} SIT`, 'ok');
    renderApp();
  } catch (e) {
    toast('Error Data: ' + e.message, 'err');
  }
}

window.handleExcelDataFile = async function(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    toast('Leyendo Excel...', 'ok');
    const parsed = await parseDataExcel(file);
    await db.reemplazarCUP(parsed.cup);
    await db.reemplazarDDD(parsed.ddd);
    await db.reemplazarSIT(parsed.sit);
    await db.setConfig('dataSitMesLabels', parsed.sitMesLabels);
    await db.setConfig('lastExcelData', { name: file.name, date: new Date().toISOString() });
    await recargarDatos();
    toast(`Excel cargado: ${parsed.cup.length} CUP, ${parsed.ddd.length} DDD, ${parsed.sit.length} SIT`, 'ok');
    renderApp();
  } catch (e) {
    toast('Error Excel: ' + e.message, 'err');
    console.error(e);
  }
  input.value = '';
};

async function doExport() {
  try {
    await sheets.exportarVisitasMes(mesActualISO());
    toast('CSV descargado', 'ok');
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function doBackup() {
  const medicos = await db.getAll('medicos');
  const farmacias = await db.getAll('farmacias');
  const visitas = await db.getAll('visitas');
  const notas = await db.getAll('notas');
  const cup = await db.getAll('cup');
  const ddd = await db.getAll('ddd');
  const sit = await db.getAll('sit');
  const dataSitMesLabels = await db.getConfig('dataSitMesLabels');
  const customBricks = await db.getConfig('customBricks');
  const data = {medicos, farmacias, visitas, notas, cup, ddd, sit, dataSitMesLabels: dataSitMesLabels?.value || [], customBricks: customBricks?.value || {}, fecha: new Date().toISOString()};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = `backup_cobertura_${hoyISO()}.json`; a.click();
  URL.revokeObjectURL(u);
  await db.setConfig('lastBackup', new Date().toISOString());
  toast('Backup descargado', 'ok');
}

async function renderBricksConfigList() {
  const el = $('bricks-config-list');
  if (!el) return;
  const custom = await db.getConfig('customBricks');
  const bricks = custom?.value || {};
  const allBricks = {...BRICK_ZONA, ...bricks};
  const entries = Object.entries(allBricks).sort((a,b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) { el.innerHTML = '<div class="text-sm text-secondary">Sin bricks</div>'; return; }
  el.innerHTML = entries.map(([num, zona]) => {
    const esCustom = bricks.hasOwnProperty(num);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:.82rem"><strong>BRICK ${esc(num)}</strong> — ${esc(zona)}${esCustom?' <span style="color:#319795;font-size:.7rem">(custom)</span>':''}</div>
        ${esCustom ? `<button class="btn-icon" style="width:28px;height:28px;font-size:.8rem" data-action="eliminar-brick" data-brick="${esc(num)}" title="Eliminar">🗑️</button>` : ''}
      </div>
    `;
  }).join('');
  attachHandlers();
}

function renderBrickModal() {
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>🏗️ Agregar Brick</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Número de brick</label><input id="edit-brick-num" placeholder="Ej: 8809"></div>
          <div class="form-group"><label>Nombre de la zona</label><input id="edit-brick-zona" placeholder="Ej: CHICO COLSANITAS"></div>
          <button class="btn btn-primary" data-action="guardar-brick">Guardar</button>
        </div>
      </div>
    </div>
  `;
}

async function guardarBrick() {
  const num = ($('edit-brick-num')?.value || '').trim();
  const zona = ($('edit-brick-zona')?.value || '').trim();
  if (!num || !zona) { toast('Ingresá número y zona', 'err'); return; }
  const custom = await db.getConfig('customBricks');
  const bricks = custom?.value || {};
  bricks[num] = zona;
  await db.setConfig('customBricks', bricks);
  customBricksMap = {...customBricksMap, ...bricks};
  toast('Brick guardado', 'ok');
  state.modal = null;
  renderBricksConfigList();
  await recargarDatos();
  renderApp();
}

async function eliminarBrick(num) {
  if (!confirm('¿Eliminar brick ' + num + '?')) return;
  const custom = await db.getConfig('customBricks');
  const bricks = custom?.value || {};
  delete bricks[num];
  await db.setConfig('customBricks', bricks);
  customBricksMap = {...BRICK_ZONA, ...bricks};
  toast('Brick eliminado', 'ok');
  renderBricksConfigList();
  await recargarDatos();
  renderApp();
}

async function aplicarBackupData(data) {
  if (!data.medicos || !data.farmacias) { toast('Archivo inválido', 'err'); return; }
  await db.reemplazarMedicos(data.medicos);
  await db.reemplazarFarmacias(data.farmacias);
  if (data.visitas) {
    const vs = await db.getAll('visitas');
    for (const v of vs) await db.delete('visitas', v.id);
    for (const v of data.visitas) await db.add('visitas', v);
  }
  if (data.notas) {
    const ns = await db.getAll('notas');
    for (const n of ns) await db.delete('notas', n.id);
    for (const n of data.notas) await db.add('notas', n);
  }
  if (data.customBricks) {
    await db.setConfig('customBricks', data.customBricks);
    customBricksMap = {...BRICK_ZONA, ...data.customBricks};
  }
  if (data.cup) await db.reemplazarCUP(data.cup);
  if (data.ddd) await db.reemplazarDDD(data.ddd);
  if (data.sit) await db.reemplazarSIT(data.sit);
  if (data.dataSitMesLabels) await db.setConfig('dataSitMesLabels', data.dataSitMesLabels);
  await recargarDatos();
  renderApp();
  toast('Backup restaurado', 'ok');
}

window.importarBackup = async function(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.medicos || !data.farmacias) { toast('Archivo inválido', 'err'); return; }
    if (confirm(`Restaurar backup de ${data.fecha || 'fecha desconocida'}?\n${data.medicos.length} médicos, ${data.farmacias.length} farmacias`)) {
      await aplicarBackupData(data);
    }
  } catch (e) {
    toast('Error: ' + e.message, 'err');
    console.error(e);
  }
  input.value = '';
};

window.cargarBackupInicial = async function() {
  try {
    const res = await fetch('backup-inicial.json');
    if (!res.ok) throw new Error('No se encontró el archivo de backup inicial');
    const data = await res.json();
    if (confirm(`Cargar backup inicial de julio?\n${data.medicos.length} médicos, ${data.farmacias.length} farmacias, ${data.visitas.length} visitas`)) {
      await aplicarBackupData(data);
    }
  } catch (e) {
    toast('Error: ' + e.message, 'err');
    console.error(e);
  }
};

// ===== MODALES =====
function renderModal() {
  if (!state.modal) return '';
  switch(state.modal.type) {
    case 'medico': return renderMedicoModal(state.modal.id);
    case 'farmacia': return renderFarmaciaModal(state.modal.id);
    case 'calendario': return renderCalendarioModal();
    case 'nota': return renderNotaModal();
    case 'tarea': return renderTareaModal();
    case 'nota-detalle': return renderNotaDetalleModal(state.modal.id);
    case 'editar-nota': return renderEditarNotaModal(state.modal.id);
    case 'alta': return renderAltaModal();
    case 'baja': return renderBajaModal();
    case 'brick': return renderBrickModal();
    case 'dia': return renderDiaModal(state.modal.fecha);
    case 'editar-visita': return renderEditarVisitaModal(state.modal.id, state.modal.fecha);
    case 'editar-medico': return renderEditarMedicoModal(state.modal.id);
    case 'editar-farmacia': return renderEditarFarmaciaModal(state.modal.id);
    default: return '';
  }
}

function renderMedicoModal(id) {
  const m = medicosCache.find(x => x.id === id);
  if (!m) return '';
  const segs = obtenerSegmentos(m);
  setTimeout(() => loadModalVisitas(id, 'medico'), 0);
  setTimeout(() => loadModalNotasEntidad(id, 'medico'), 0);
  setTimeout(() => loadModalCUP(id), 0);
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${esc(m.nombre)}</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="modal-info-grid">
            <div><span class="text-sm text-secondary">Cédula</span><div class="selectable-text">${esc(m.cedula)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Especialidad</span><div class="selectable-text">${esc(m.especialidad)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Segmento</span><div class="selectable-text">${segs.join(', ')||'—'}</div></div>
            <div><span class="text-sm text-secondary">Frecuencia</span><div class="selectable-text">${m.frecuencia||1} visita(s)/mes</div></div>
            <div><span class="text-sm text-secondary">Ciudad</span><div class="selectable-text">${esc(m.ciudad)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Brick</span><div class="selectable-text">${esc(m.brick)||'—'}${m.brickZona?' · '+esc(m.brickZona):''}</div></div>
            <div><span class="text-sm text-secondary">Celular</span><div class="selectable-text">${esc(m.celular)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Teléfono</span><div class="selectable-text">${esc(m.telefono)||'—'}</div></div>
          </div>
          <div class="form-group" style="margin-bottom:6px"><span class="text-sm text-secondary">Dirección</span><div class="selectable-text">${esc(m.direccion)||'—'}</div></div>
          <div class="form-group" style="margin-bottom:6px"><span class="text-sm text-secondary">Email</span><div class="selectable-text">${esc(m.email)||'—'}</div></div>
          <div class="form-group" style="margin-bottom:6px"><span class="text-sm text-secondary">IPS / Institución</span><div class="selectable-text">${esc(m.ips)||'—'}</div></div>
          <div id="modal-cup-info"></div>
          <div id="modal-notas-entidad"></div>
          <div id="modal-visitas"></div>
        </div>
      </div>
    </div>
  `;
}

function buscarCupPorMedico(m) {
  if (!m || !m.nombre || !cupCache.length) return [];
  return cupCache.filter(row => nombresCoinciden(row.medico, m.nombre));
}

function loadModalCUP(id) {
  const m = medicosCache.find(x => x.id === id);
  if (!m) return;
  const rows = buscarCupPorMedico(m);
  const el = $('modal-cup-info');
  if (!el) return;
  if (rows.length === 0) { el.innerHTML = ''; return; }
  // Agrupar por marca y mercado
  const porMarca = {};
  let totalGlobal = 0;
  for (const row of rows) {
    const key = `${row.mercado} · ${row.marca}`;
    if (!porMarca[key]) porMarca[key] = { mercado: row.mercado, marca: row.marca, total: 0 };
    porMarca[key].total += row.total || 0;
    totalGlobal += row.total || 0;
  }
  const items = Object.values(porMarca).sort((a, b) => b.total - a.total);
  el.innerHTML = `
    <div class="form-group" style="margin-top:12px">
      <span class="text-sm text-secondary">Cerrado Up (CUP) — Total: ${totalGlobal}</span>
      <div class="visitas-list">
        ${items.map(it => `
          <div class="visita-item" style="justify-content:space-between">
            <span class="selectable-text">${esc(it.marca)} <span style="color:var(--text2);font-size:.75rem">(${esc(it.mercado)})</span></span>
            <span class="selectable-text" style="font-weight:700">${it.total}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function loadModalVisitas(id, tipo) {
  db.visitasPorEntidad(id, tipo).then(vs => {
    const el = $('modal-visitas');
    if (!el) return;
    const mesVs = vs.filter(v => v.mes === mesActual);
    if (mesVs.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="form-group" style="margin-top:12px">
        <span class="text-sm text-secondary">Visitas este mes</span>
        <div class="visitas-list">
          ${mesVs.map(v => `
            <div class="visita-item">
              <span class="visita-fecha">${fmtFecha(v.fecha)}</span>
              <div style="display:flex;gap:4px">
                <button class="btn-icon btn-edit" data-action="editar-visita-fecha" data-id="${v.id}" data-fecha="${v.fecha}" title="Cambiar fecha">✏️</button>
                <button class="btn-icon btn-danger" data-action="eliminar-visita" data-id="${v.id}" title="Eliminar visita">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    attachHandlers();
  });
}

async function loadModalNotasEntidad(id, tipo) {
  const el = $('modal-notas-entidad');
  if (!el) return;
  const notas = await db.getAll('notas');
  const previas = notas.filter(n => {
    if (tipo === 'medico' && n.medicoId === id) return true;
    if (tipo === 'farmacia' && n.farmaciaId === id) return true;
    return false;
  }).sort((a,b) => new Date(b.creado) - new Date(a.creado));
  if (previas.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="form-group" style="margin-top:12px">
      <span class="text-sm text-secondary">Notas</span>
      <div class="visitas-list">
        ${previas.map(n => `
          <div class="visita-item nota-previa-item" data-action="open-nota-detalle" data-id="${n.id}" style="align-items:flex-start">
            <div>
              ${n.tipo === 'alta' ? '<span class="nota-tipo nota-tipo-alta">Alta</span>' : n.tipo === 'baja' ? '<span class="nota-tipo nota-tipo-baja">Baja</span>' : n.tipo === 'tarea' ? '<span class="nota-tipo nota-tipo-tarea">Tarea</span>' : '<span class="nota-tipo nota-tipo-general">Nota</span>'}
              <span style="opacity:${n.completada?0.6:1};text-decoration:${n.completada?'line-through':'none'};font-size:.82rem">${esc(n.texto)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  attachHandlers();
}

function renderFarmaciaModal(id) {
  const f = farmaciasCache.find(x => x.id === id);
  if (!f) return '';
  setTimeout(() => loadModalVisitas(id, 'farmacia'), 0);
  setTimeout(() => loadModalNotasEntidad(id, 'farmacia'), 0);
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${esc(f.nombre)}</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="modal-info-grid">
            <div><span class="text-sm text-secondary">Cadena</span><div>${esc(f.cadena)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Ciudad</span><div>${esc(f.ciudad)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Brick</span><div>${esc(f.brick)||'—'}${f.brickZona?' · '+esc(f.brickZona):''}</div></div>
            <div><span class="text-sm text-secondary">Frecuencia</span><div>${f.frecuencia||1} visita(s)/mes</div></div>
            <div><span class="text-sm text-secondary">Administrador</span><div>${esc(f.administrador)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Celular</span><div>${esc(f.celular)||'—'}</div></div>
            <div><span class="text-sm text-secondary">Email</span><div>${esc(f.email)||'—'}</div></div>
          </div>
          <div class="form-group" style="margin-bottom:6px"><span class="text-sm text-secondary">Dirección</span><div>${esc(f.direccion)||'—'}</div></div>
          ${f.dependientes ? `<div class="form-group" style="margin-bottom:6px"><span class="text-sm text-secondary">Dependientes</span><div>${esc(f.dependientes)}</div></div>` : ''}
          <div id="modal-notas-entidad"></div>
          <div id="modal-visitas"></div>
        </div>
      </div>
    </div>
  `;
}

// Calendario modal state
let calState = {y: new Date().getFullYear(), m: new Date().getMonth()};
function renderCalendarioModal() {
  const first = new Date(calState.y, calState.m, 1).getDay();
  const dim = new Date(calState.y, calState.m + 1, 0).getDate();
  const prev = new Date(calState.y, calState.m, 0).getDate();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const hoy = hoyISO();
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>Seleccionar fecha</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="flex gap-2" style="justify-content:center;margin-bottom:12px">
            <button class="btn-icon" data-action="cal-month" data-delta="-1">◀</button>
            <strong>${months[calState.m]} ${calState.y}</strong>
            <button class="btn-icon" data-action="cal-month" data-delta="1">▶</button>
          </div>
          <div class="cal-grid">
            ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d=>`<div class="cal-day-h">${d}</div>`).join('')}
            ${Array.from({length:first}).map((_,i)=>`<div class="cal-day other">${prev-first+1+i}</div>`).join('')}
            ${Array.from({length:dim}).map((_,i)=>{
              const d=i+1;
              const ds=`${calState.y}-${String(calState.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const cls=['cal-day']; if(ds===hoy) cls.push('today');
              return `<div class="${cls.join(' ')}" data-action="cal-select" data-fecha="${ds}">${d}</div>`;
            }).join('')}
          </div>
          <button class="btn btn-primary mt-1" data-action="cal-today">Hoy</button>
        </div>
      </div>
    </div>
  `;
}

function calMonth(delta) {
  const d = new Date(calState.y, calState.m + delta, 1);
  calState = {y: d.getFullYear(), m: d.getMonth()};
  renderApp();
}

function calSelect(data) {
  guardarVisita({fecha: data.fecha, entidadId: state.modal.entidadId, entidadTipo: state.modal.entidadTipo});
}

function calToday() {
  guardarVisita({fecha: hoyISO(), entidadId: state.modal.entidadId, entidadTipo: state.modal.entidadTipo});
}

async function guardarVisita(data) {
  await db.add('visitas', {
    entidadId: parseInt(data.entidadId),
    entidadTipo: data.entidadTipo,
    fecha: data.fecha,
    mes: data.fecha.slice(0,7),
    notas: '',
    creado: new Date().toISOString()
  });
  await recargarDatos();
  toast('Visita registrada', 'ok');
  state.modal = null;
  renderApp();
}

function renderNotaDetalleModal(id) {
  setTimeout(async () => {
    const nota = await db.getById('notas', id);
    const el = $('nota-detalle-contenido');
    if (!el) return;
    if (!nota) { el.innerHTML = '<div class="empty-state">Nota no encontrada</div>'; return; }
    el.innerHTML = renderNotaDetalleContenido(nota);
    attachHandlers();
  }, 0);
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>📝 Detalle de nota</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div id="nota-detalle-contenido"><div class="empty-state">Cargando...</div></div>
        </div>
      </div>
    </div>
  `;
}

function renderNotaDetalleContenido(n) {
  const tipoBadge = n.tipo === 'alta' ? '<span class="nota-tipo nota-tipo-alta">Alta</span>' :
    n.tipo === 'baja' ? '<span class="nota-tipo nota-tipo-baja">Baja</span>' :
    n.tipo === 'tarea' ? '<span class="nota-tipo nota-tipo-tarea">Tarea</span>' :
    '<span class="nota-tipo nota-tipo-general">Nota</span>';
  let propietario = '';
  if (n.medicoId) {
    const m = medicosCache.find(x => x.id === n.medicoId);
    if (m) propietario = `<div class="nota-detalle-prop">👨‍⚕️ Vinculado a: ${esc(m.nombre)}</div>`;
  } else if (n.farmaciaId) {
    const f = farmaciasCache.find(x => x.id === n.farmaciaId);
    if (f) propietario = `<div class="nota-detalle-prop">🏥 Vinculado a: ${esc(f.nombre)}</div>`;
  }
  const fechaCreado = n.creado ? n.creado.slice(0, 10) : null;
  const mostrarTitulo = n.titulo && (n.tipo === 'tarea' || (!n.medicoId && !n.farmaciaId));
  return `
    <div class="nota-detalle-badge">${tipoBadge}</div>
    ${mostrarTitulo ? `<div class="nota-detalle-titulo">${esc(n.titulo)}</div>` : ''}
    <div class="nota-detalle-texto">${esc(n.texto)}</div>
    ${propietario}
    <div class="nota-detalle-meta">📅 Creado: ${fechaCreado ? fmtFecha(fechaCreado) : '—'}</div>
    ${n.fecha ? `<div class="nota-detalle-meta">⏰ Recordatorio: ${fmtFecha(n.fecha)}</div>` : ''}
    <div class="nota-detalle-meta">Estado: ${n.completada ? '<span style="color:#276749;font-weight:700">✓ Completada</span>' : '<span style="color:var(--text2);font-weight:700">Pendiente</span>'}</div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="btn btn-outline" data-action="editar-nota" data-id="${n.id}">✏️ Editar</button>
      <button class="btn btn-outline" style="color:#c53030;border-color:#fecaca" data-action="eliminar-nota" data-id="${n.id}">🗑️ Eliminar</button>
    </div>
  `;
}

function renderEditarNotaModal(id) {
  setTimeout(async () => {
    const nota = await db.getById('notas', id);
    const el = $('editar-nota-contenido');
    if (!el) return;
    if (!nota) { el.innerHTML = '<div class="empty-state">Nota no encontrada</div>'; return; }
    const esAisladaEdit = !nota.medicoId && !nota.farmaciaId;
    const permiteTipo = nota.tipo === 'nota' || nota.tipo === 'general' || nota.tipo === 'tarea';
    const tipoActual = nota.tipo === 'tarea' ? 'tarea' : 'nota';
    el.innerHTML = `
      ${permiteTipo ? `
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-input" id="nota-edit-tipo" ${esAisladaEdit ? '' : 'onchange="window.toggleEditTitulo(this.value)"'}>
            <option value="nota" ${tipoActual==='nota'?'selected':''}>Nota informativa</option>
            <option value="tarea" ${tipoActual==='tarea'?'selected':''}>Tarea pendiente</option>
          </select>
        </div>
      ` : ''}
      ${esAisladaEdit || nota.tipo === 'tarea' ? `<div class="form-group" id="nota-edit-titulo-wrap"><label class="form-label">Título</label><input class="form-input" id="nota-edit-titulo" value="${esc(nota.titulo)}"></div>` : ''}
      <div class="form-group">
        <label class="form-label">Contenido</label>
        <textarea class="form-textarea" id="nota-edit-texto">${esc(nota.texto)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Recordatorio (opcional)</label>
        <input type="date" class="form-input" id="nota-edit-fecha" value="${nota.fecha || ''}">
      </div>
      <button class="btn btn-primary" data-action="guardar-nota-editada" data-id="${nota.id}">Guardar cambios</button>
    `;
    attachHandlers();
  }, 0);
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>✏️ Editar nota</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div id="editar-nota-contenido"><div class="empty-state">Cargando...</div></div>
        </div>
      </div>
    </div>
  `;
}

async function eliminarNota(id) {
  if (!confirm('¿Eliminar esta nota?')) return;
  await db.delete('notas', id);
  toast('Nota eliminada', 'ok');
  state.modal = null;
  renderApp();
}

async function guardarNotaEditada(data) {
  const nota = await db.getById('notas', parseInt(data.id));
  if (!nota) { toast('Nota no encontrada', 'err'); return; }
  const texto = ($('nota-edit-texto')?.value || '').trim();
  if (!texto) { toast('El contenido no puede quedar vacío', 'err'); return; }
  nota.texto = texto;
  const esAislada = !nota.medicoId && !nota.farmaciaId;
  const permiteTipo = nota.tipo === 'nota' || nota.tipo === 'general' || nota.tipo === 'tarea';
  if (permiteTipo) {
    const nuevoTipo = ($('nota-edit-tipo')?.value || nota.tipo);
    nota.tipo = nuevoTipo;
  }
  if (esAislada || nota.tipo === 'tarea') {
    nota.titulo = ($('nota-edit-titulo')?.value || '').trim() || null;
  }
  const fecha = $('nota-edit-fecha')?.value || null;
  nota.fecha = fecha;
  await db.put('notas', nota);
  toast('Nota actualizada', 'ok');
  state.modal = {type:'nota-detalle', id: nota.id};
  renderApp();
}

function renderNotaModal() {
  const prefill = state.modal || {};
  const esAislada = !prefill.medicoId && !prefill.farmaciaId;
  const desdeEntidad = prefill.medicoId || prefill.farmaciaId;
  setTimeout(() => loadModalNotasPrevias(prefill.medicoId, prefill.farmaciaId), 0);
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${prefill.nombre ? 'Nota rápida: ' + esc(prefill.nombre) : 'Nueva nota'}</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div id="notas-previas"></div>
          ${desdeEntidad ? `
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-input" id="nota-tipo">
                <option value="nota">Nota informativa</option>
                <option value="tarea">Tarea pendiente</option>
              </select>
            </div>
            <div class="form-group hidden" id="nota-titulo-wrap">
              <label class="form-label">Título</label>
              <input class="form-input" id="nota-titulo" placeholder="Título de la tarea">
            </div>
          ` : ''}
          ${esAislada ? `<div class="form-group"><label class="form-label">Título</label><input class="form-input" id="nota-titulo" placeholder="Título de la nota"></div>` : ''}
          <textarea class="form-textarea" id="nota-texto" placeholder="Escribe la nota..."></textarea>
          <label class="checkbox-row">
            <input type="checkbox" id="nota-cal">
            Agregar al calendario
          </label>
          <div class="form-group mt-1 hidden" id="nota-fecha-wrap">
            <input type="date" class="form-input" id="nota-fecha" value="${hoyISO()}">
          </div>
          <button class="btn btn-primary mt-1" data-action="guardar-nota">Guardar nota</button>
        </div>
      </div>
    </div>
  `;
}

function renderTareaModal() {
  const prefill = state.modal || {};
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${prefill.nombre ? 'Nueva tarea: ' + esc(prefill.nombre) : 'Nueva tarea'}</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Título</label>
            <input class="form-input" id="tarea-titulo" placeholder="Título de la tarea">
          </div>
          <textarea class="form-textarea" id="tarea-texto" placeholder="Detalles de la tarea..."></textarea>
          <label class="checkbox-row">
            <input type="checkbox" id="tarea-cal">
            Agregar recordatorio
          </label>
          <div class="form-group mt-1 hidden" id="tarea-fecha-wrap">
            <input type="date" class="form-input" id="tarea-fecha" value="${hoyISO()}">
          </div>
          <button class="btn btn-primary mt-1" data-action="guardar-tarea">Guardar tarea</button>
        </div>
      </div>
    </div>
  `;
}

async function guardarTarea() {
  const titulo = ($('tarea-titulo')?.value || '').trim();
  const texto = ($('tarea-texto')?.value || '').trim();
  if (!titulo && !texto) { toast('Escribe algo', 'err'); return; }
  const agregarCal = $('tarea-cal')?.checked || false;
  const fecha = $('tarea-fecha')?.value || null;
  const prefill = state.modal || {};
  await db.add('notas', {
    texto: texto || titulo,
    titulo,
    tipo: 'tarea',
    medicoId: prefill.medicoId || null,
    farmaciaId: prefill.farmaciaId || null,
    fecha: agregarCal ? fecha : null,
    completada: false,
    creado: new Date().toISOString()
  });
  toast('Tarea guardada', 'ok');
  state.modal = null;
  renderApp();
}

async function loadModalNotasPrevias(medicoId, farmaciaId) {
  const el = $('notas-previas');
  if (!el || (!medicoId && !farmaciaId)) return;
  const notas = await db.getAll('notas');
  const previas = notas.filter(n => {
    if (medicoId && n.medicoId === medicoId) return true;
    if (farmaciaId && n.farmaciaId === farmaciaId) return true;
    return false;
  }).sort((a,b) => new Date(b.creado) - new Date(a.creado)).slice(0, 5);
  if (previas.length === 0) return;
  el.innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:.78rem;font-weight:600;color:var(--text2);margin-bottom:6px">Notas previas</div>
      ${previas.map(n => `
        <div style="background:var(--bg);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:.82rem">
          ${n.tipo === 'alta' ? '<span class="nota-tipo nota-tipo-alta">Alta</span>' : n.tipo === 'baja' ? '<span class="nota-tipo nota-tipo-baja">Baja</span>' : '<span class="nota-tipo nota-tipo-general">Nota</span>'}
          <span style="opacity:${n.completada?0.6:1};text-decoration:${n.completada?'line-through':'none'}">${esc(n.texto)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function guardarNota() {
  const texto = ($('nota-texto')?.value || '').trim();
  if (!texto) { toast('Escribe algo', 'err'); return; }
  const agregarCal = $('nota-cal')?.checked || false;
  const fecha = $('nota-fecha')?.value || null;
  const prefill = state.modal || {};
  const esAislada = !prefill.medicoId && !prefill.farmaciaId;
  const desdeEntidad = prefill.medicoId || prefill.farmaciaId;
  let tipo = 'nota';
  if (desdeEntidad) tipo = ($('nota-tipo')?.value || 'nota');
  const titulo = ($('nota-titulo')?.value || '').trim();
  await db.add('notas', {
    texto,
    titulo: titulo || null,
    tipo,
    medicoId: prefill.medicoId || null,
    farmaciaId: prefill.farmaciaId || null,
    fecha: agregarCal ? fecha : null,
    completada: false,
    creado: new Date().toISOString()
  });
  toast(tipo === 'tarea' ? 'Tarea guardada' : 'Nota guardada', 'ok');
  state.modal = null;
  renderApp();
}

function renderAltaModal() {
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>➕ Nueva Alta</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre completo</label><input id="alta-nombre" placeholder="Nombre del médico/farmacia"></div>
          <div class="form-group"><label>Cédula</label><input id="alta-cc" placeholder="Número de cédula"></div>
          <div class="form-group"><label>Celular</label><input id="alta-celular" placeholder="Teléfono"></div>
          <div class="form-group"><label>Email</label><input id="alta-email" placeholder="correo@ejemplo.com"></div>
          <div class="form-group"><label>Especialidad</label><input id="alta-especialidad" placeholder="Ej: Cardiología"></div>
          <div class="form-group"><label>Ciudad</label><input id="alta-ciudad" placeholder="Ej: BOGOTÁ"></div>
          <div class="form-group"><label>Dirección</label><input id="alta-direccion" placeholder="Dirección completa"></div>
          <div class="form-group"><label>Observaciones</label><textarea id="alta-obs" placeholder="Notas adicionales..."></textarea></div>
          <button class="btn btn-primary" data-action="guardar-alta">Guardar Alta</button>
        </div>
      </div>
    </div>
  `;
}

function renderBajaModal() {
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>➖ Nueva Baja</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre</label><input id="baja-nombre" placeholder="Nombre del médico/farmacia"></div>
          <div class="form-group"><label>Motivo</label><textarea id="baja-motivo" placeholder="Motivo de la baja..."></textarea></div>
          <button class="btn btn-primary" data-action="guardar-baja">Guardar Baja</button>
        </div>
      </div>
    </div>
  `;
}

async function guardarAlta() {
  const nombre = ($('alta-nombre')?.value || '').trim();
  if (!nombre) { toast('Ingresá el nombre', 'err'); return; }
  await db.add('notas', {
    tipo: 'alta',
    nombreAlta: nombre,
    ccAlta: ($('alta-cc')?.value || '').trim(),
    celularAlta: ($('alta-celular')?.value || '').trim(),
    emailAlta: ($('alta-email')?.value || '').trim(),
    especialidadAlta: ($('alta-especialidad')?.value || '').trim(),
    ciudadAlta: ($('alta-ciudad')?.value || '').trim(),
    direccionAlta: ($('alta-direccion')?.value || '').trim(),
    observacionesAlta: ($('alta-obs')?.value || '').trim(),
    texto: `Alta: ${nombre}`,
    completada: false,
    creado: new Date().toISOString()
  });
  toast('Alta registrada', 'ok');
  state.modal = null;
  renderApp();
}

async function guardarBaja() {
  const nombre = ($('baja-nombre')?.value || '').trim();
  if (!nombre) { toast('Ingresá el nombre', 'err'); return; }
  await db.add('notas', {
    tipo: 'baja',
    nombreBaja: nombre,
    motivoBaja: ($('baja-motivo')?.value || '').trim(),
    texto: `Baja: ${nombre}`,
    completada: false,
    creado: new Date().toISOString()
  });
  toast('Baja registrada', 'ok');
  state.modal = null;
  renderApp();
}

window.handleExcelFile = async function(input) {
  const file = input.files[0];
  if (!file) return;
  toast('Procesando Excel...');
  try {
    const buf = await file.arrayBuffer();
    const res = await procesarExcelFile(buf);
    await recargarDatos();
    renderApp();
    toast(`Excel cargado: ${res.medicos} médicos, ${res.farmacias} farmacias`, 'ok');
  } catch (e) {
    toast('Error leyendo Excel: ' + e.message, 'err');
    console.error(e);
  }
  input.value = '';
};

// ===== MODAL DETALLE POR DÍA =====
function renderDiaModal(fecha) {
  setTimeout(async () => {
    const vs = await db.visitasDelMes(mesActual);
    const diaVs = vs.filter(v => v.fecha === fecha).sort((a,b) => b.creado.localeCompare(a.creado));
    const el = $('dia-detalle');
    if (!el) return;
    if (diaVs.length === 0) { el.innerHTML = '<div class="empty-state">Sin visitas este día</div>'; return; }

    const map = {};
    for (const m of medicosCache) map['medico-'+m.id] = m;
    for (const f of farmaciasCache) map['farmacia-'+f.id] = f;

    el.innerHTML = diaVs.map(v => {
      const ent = map[v.entidadTipo+'-'+v.entidadId];
      const tipoIcon = v.entidadTipo === 'medico' ? '👨‍⚕️' : '🏥';
      const nombre = ent ? ent.nombre : 'Desconocido';
      const seg = v.entidadTipo === 'medico' && ent ? obtenerSegmentos(ent).join(',') : '';
      return `
        <div class="list-item" data-action="${v.entidadTipo==='medico'?'open-medico':'open-farmacia'}" data-id="${v.entidadId}">
          <div class="list-info">
            <div class="list-name">${tipoIcon} ${esc(nombre)}</div>
            ${seg ? `<div class="list-segs" style="margin-top:4px"><span class="seg-badge seg-${seg.toLowerCase()}">${seg}</span></div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    attachHandlers();
  }, 0);

  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>📅 ${fmtFecha(fecha)}</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div id="dia-detalle"><div class="empty-state">Cargando...</div></div>
        </div>
      </div>
    </div>
  `;
}

// ===== VISTA RESUMEN POR DÍA =====
function renderResumenDias() {
  db.visitasDelMes(mesActual).then(vs => {
    const el = $('resumen-dias-lista');
    if (!el) return;
    if (vs.length === 0) { el.innerHTML = '<div class="empty-state">Sin visitas este mes</div>'; return; }
    const porDia = {};
    for (const v of vs) {
      if (!porDia[v.fecha]) porDia[v.fecha] = {med:0, farm:0};
      if (v.entidadTipo === 'medico') porDia[v.fecha].med++;
      else porDia[v.fecha].farm++;
    }
    const fechas = Object.keys(porDia).sort((a,b) => b.localeCompare(a));
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    el.innerHTML = fechas.map(f => {
      const [yy,mm,dd] = f.split('-').map(Number);
      const label = `${dd} ${meses[mm-1]}`;
      const d = porDia[f];
      return `
        <div class="dash-dia-card" data-action="open-dia" data-fecha="${f}">
          <div class="dash-dia-fecha">${esc(label)}</div>
          <div class="dash-dia-stats">
            <span>👨‍⚕️ ${d.med}</span>
            <span>🏥 ${d.farm}</span>
          </div>
        </div>
      `;
    }).join('');
    attachHandlers();
  });

  return `
    <button class="btn btn-outline mb-1" data-action="volver-dashboard">← Volver al Dashboard</button>
    <h2 style="font-size:1.1rem;margin-bottom:12px">📅 Resumen por día</h2>
    <div id="resumen-dias-lista"><div class="empty-state">Cargando...</div></div>
  `;
}

// ===== VISTA PENDIENTES MÉDICOS =====
function renderPendientesMedicos() {
  const filtros = ['Todos','H','C','P','M','E','PS'];
  const fHtml = filtros.map(f => `<button class="pendiente-btn ${state.dashboardPendFilter===f?'active':''}" data-action="set-pend-filter" data-filtro="${f}">${f==='Todos'?'Todos':f}</button>`).join('');

  let meds = medicosCache.filter(m => {
    if (m.ciudad && !m.ciudad.toUpperCase().includes(state.pendMedCiudad)) return false;
    const v = visitasMap['medico-'+m.id] || 0;
    const freq = parseInt(m.frecuencia) || 1;
    return v < freq;
  });

  if (state.dashboardPendFilter !== 'Todos') {
    meds = meds.filter(m => obtenerSegmentos(m).includes(state.dashboardPendFilter));
  }

  meds.sort((a,b) => a.nombre.localeCompare(b.nombre));

  return `
    <button class="btn btn-outline mb-1" data-action="volver-dashboard">← Volver al Dashboard</button>
    <h2 style="font-size:1.1rem;margin-bottom:12px">👨‍⚕️ Pendientes Médicos</h2>
    <div class="city-filters">
      <button class="city-btn ${state.pendMedCiudad==='BOGOTÁ'?'active':''}" data-action="set-pend-ciudad" data-ciudad="BOGOTÁ" data-target="med">BOGOTÁ</button>
      <button class="city-btn ${state.pendMedCiudad==='IBAGUÉ'?'active':''}" data-action="set-pend-ciudad" data-ciudad="IBAGUÉ" data-target="med">IBAGUÉ</button>
    </div>
    <div class="pendientes-filters">${fHtml}</div>
    <div class="lista">
      ${meds.map(m => renderMedicoItem(m)).join('')}
      ${meds.length===0?'<div class="empty-state">No hay médicos pendientes</div>':''}
    </div>
  `;
}

// ===== VISTA PENDIENTES FARMACIAS =====
function renderPendientesFarmacias() {
  let farms = farmaciasCache.filter(f => {
    if (f.ciudad && !f.ciudad.toUpperCase().includes(state.pendFarmCiudad)) return false;
    const v = visitasMap['farmacia-'+f.id] || 0;
    const freq = parseInt(f.frecuencia) || 1;
    return v < freq;
  });

  farms.sort((a,b) => a.nombre.localeCompare(b.nombre));

  return `
    <button class="btn btn-outline mb-1" data-action="volver-dashboard">← Volver al Dashboard</button>
    <h2 style="font-size:1.1rem;margin-bottom:12px">🏥 Pendientes Farmacias</h2>
    <div class="city-filters">
      <button class="city-btn ${state.pendFarmCiudad==='BOGOTÁ'?'active':''}" data-action="set-pend-ciudad" data-ciudad="BOGOTÁ" data-target="farm">BOGOTÁ</button>
      <button class="city-btn ${state.pendFarmCiudad==='IBAGUÉ'?'active':''}" data-action="set-pend-ciudad" data-ciudad="IBAGUÉ" data-target="farm">IBAGUÉ</button>
    </div>
    <div class="lista">
      ${farms.map(f => renderFarmaciaItem(f)).join('')}
      ${farms.length===0?'<div class="empty-state">No hay farmacias pendientes</div>':''}
    </div>
  `;
}

// ===== MODAL EDITAR VISITA =====
function renderEditarVisitaModal(id, fecha) {
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>✏️ Editar fecha de visita</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nueva fecha</label>
            <input type="date" class="input-fecha-edit" id="edit-visita-fecha" value="${fecha}">
          </div>
          <button class="btn btn-primary" data-action="guardar-visita-editada" data-id="${id}">Guardar cambio</button>
        </div>
      </div>
    </div>
  `;
}

async function guardarVisitaEditada(data) {
  const nuevaFecha = $('edit-visita-fecha')?.value;
  if (!nuevaFecha) { toast('Seleccioná una fecha', 'err'); return; }
  const visita = await db.getById('visitas', parseInt(data.id));
  if (!visita) { toast('Visita no encontrada', 'err'); return; }
  visita.fecha = nuevaFecha;
  visita.mes = nuevaFecha.slice(0,7);
  await db.put('visitas', visita);
  await recargarDatos();
  toast('Fecha actualizada', 'ok');
  state.modal = null;
  renderApp();
}

function renderEditarMedicoModal(id) {
  const m = medicosCache.find(x => x.id === id);
  if (!m) return '';
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>Editar médico</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre</label><input id="edit-med-nombre" value="${esc(m.nombre)}"></div>
          <div class="form-group"><label>Especialidad</label><input id="edit-med-especialidad" value="${esc(m.especialidad)}"></div>
          <div class="form-group"><label>Dirección</label><input id="edit-med-direccion" value="${esc(m.direccion)}"></div>
          <div class="form-group"><label>Celular</label><input id="edit-med-celular" value="${esc(m.celular)}"></div>
          <div class="form-group"><label>Email</label><input id="edit-med-email" value="${esc(m.email)}"></div>
          <div class="form-group"><label>Brick</label><input id="edit-med-brick" value="${esc(m.brick)}"></div>
          <div class="form-group"><label>Frecuencia</label><input id="edit-med-frecuencia" type="number" value="${m.frecuencia||1}"></div>
          <button class="btn-primary" data-action="guardar-medico" data-id="${m.id}">Guardar</button>
        </div>
      </div>
    </div>
  `;
}

async function guardarMedico(data) {
  const m = medicosCache.find(x => x.id === parseInt(data.id));
  if (!m) { toast('Médico no encontrado', 'err'); return; }
  m.nombre = $('edit-med-nombre')?.value || m.nombre;
  m.especialidad = $('edit-med-especialidad')?.value || m.especialidad;
  m.direccion = $('edit-med-direccion')?.value || m.direccion;
  m.celular = $('edit-med-celular')?.value || m.celular;
  m.email = $('edit-med-email')?.value || m.email;
  m.frecuencia = parseInt($('edit-med-frecuencia')?.value) || m.frecuencia;
  const nuevoBrick = $('edit-med-brick')?.value?.trim();
  if (nuevoBrick !== undefined) {
    m.brick = nuevoBrick;
    m.brickZona = getBrickZona(nuevoBrick);
  }
  await db.put('medicos', m);
  await recargarDatos();
  toast('Médico actualizado', 'ok');
  state.modal = null;
  renderApp();
}

function renderEditarFarmaciaModal(id) {
  const f = farmaciasCache.find(x => x.id === id);
  if (!f) return '';
  return `
    <div class="modal" data-action="close-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>Editar farmacia</h3>
          <button class="btn-icon" data-action="close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>Nombre</label><input id="edit-farm-nombre" value="${esc(f.nombre)}"></div>
          <div class="form-group"><label>Cadena</label><input id="edit-farm-cadena" value="${esc(f.cadena)}"></div>
          <div class="form-group"><label>Dirección</label><input id="edit-farm-direccion" value="${esc(f.direccion)}"></div>
          <div class="form-group"><label>Dependientes</label><textarea id="edit-farm-dependientes" placeholder="Nombres separados por coma">${esc(f.dependientes)}</textarea></div>
          <div class="form-group"><label>Administrador</label><input id="edit-farm-administrador" value="${esc(f.administrador)}"></div>
          <div class="form-group"><label>Celular</label><input id="edit-farm-celular" type="tel" value="${esc(f.celular)}"></div>
          <div class="form-group"><label>Email</label><input id="edit-farm-email" type="email" value="${esc(f.email)}"></div>
          <div class="form-group"><label>Brick</label><input id="edit-farm-brick" value="${esc(f.brick)}"></div>
          <div class="form-group"><label>Frecuencia</label><input id="edit-farm-frecuencia" type="number" value="${f.frecuencia||1}"></div>
          <button class="btn-primary" data-action="guardar-farmacia" data-id="${f.id}">Guardar</button>
        </div>
      </div>
    </div>
  `;
}

async function guardarFarmacia(data) {
  const f = farmaciasCache.find(x => x.id === parseInt(data.id));
  if (!f) { toast('Farmacia no encontrada', 'err'); return; }
  f.nombre = $('edit-farm-nombre')?.value || f.nombre;
  f.cadena = $('edit-farm-cadena')?.value || f.cadena;
  f.direccion = $('edit-farm-direccion')?.value || f.direccion;
  f.dependientes = ($('edit-farm-dependientes')?.value || '').trim();
  f.administrador = ($('edit-farm-administrador')?.value || '').trim();
  f.celular = ($('edit-farm-celular')?.value || '').trim();
  f.email = ($('edit-farm-email')?.value || '').trim();
  f.frecuencia = parseInt($('edit-farm-frecuencia')?.value) || f.frecuencia;
  const nuevoBrickFarm = $('edit-farm-brick')?.value?.trim();
  if (nuevoBrickFarm !== undefined) {
    f.brick = nuevoBrickFarm;
    f.brickZona = getBrickZona(nuevoBrickFarm);
  }
  await db.put('farmacias', f);
  await recargarDatos();
  toast('Farmacia actualizada', 'ok');
  state.modal = null;
  renderApp();
}

// Checkbox toggle en modal nota/tarea
setInterval(() => {
  const cbNota = $('nota-cal');
  const wrapNota = $('nota-fecha-wrap');
  if (cbNota && wrapNota) wrapNota.classList.toggle('hidden', !cbNota.checked);
  const cbTarea = $('tarea-cal');
  const wrapTarea = $('tarea-fecha-wrap');
  if (cbTarea && wrapTarea) wrapTarea.classList.toggle('hidden', !cbTarea.checked);
  // Mostrar/ocultar título según tipo en modal nota rápida
  const tipoNota = $('nota-tipo');
  const wrapTituloNota = $('nota-titulo-wrap');
  if (tipoNota && wrapTituloNota) wrapTituloNota.classList.toggle('hidden', tipoNota.value !== 'tarea');
}, 200);

window.toggleEditTitulo = function(v) {
  const wrap = $('nota-edit-titulo-wrap');
  if (wrap) wrap.classList.toggle('hidden', v !== 'tarea');
};

// ===== DATA VIEW (CUP / DDD / SIT) =====

function ultimos3MesesSIT() {
  // Intentar deducir el mes más reciente disponible en CUP
  let maxMes = '';
  for (const row of cupCache) {
    for (const mes of Object.keys(row.meses || {})) {
      if (/^\d{4}-\d{2}$/.test(mes) && mes > maxMes) maxMes = mes;
    }
  }
  if (!maxMes) {
    const d = new Date();
    maxMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const [y, m] = maxMes.split('-').map(Number);
  const meses = [];
  for (let i = 2; i >= 0; i--) {
    const dt = new Date(y, m - 1 - i, 1);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    meses.push(`${yy}${mm}`);
  }
  return meses;
}

function normalizarNombreMarcaData(marca) {
  return (marca || '')
    .toString()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\bLNI\b/gi, '')
    .replace(/\bMG\b/gi, '')
    .replace(/[+/]/g, ' ')
    .trim()
    .toUpperCase();
}

function marcasDisponiblesData(tipo) {
  const source = tipo === 'ddd' ? dddCache : cupCache;
  const set = new Set();
  for (const row of source) {
    const n = normalizarNombreMarcaData(row.marca);
    if (n) set.add(n);
  }
  let lista = [...set].sort();
  if (state.dataMercado) {
    lista = lista.filter(m => dataSheets.perteneceAMercado(m, state.dataMercado));
  }
  return lista;
}

function filtrarDataPorMercadoMarcas(data, tipo) {
  return data.filter(row => {
    if (state.dataMercado && !dataSheets.perteneceAMercado(row.marca, state.dataMercado)) return false;
    if (state.dataMarcas.length > 0) {
      const n = normalizarNombreMarcaData(row.marca);
      if (!state.dataMarcas.includes(n)) return false;
    }
    return true;
  });
}

function filtrarDataPorCiudad(data, tipo) {
  if (!state.dataCiudad || state.dataCiudad.length === 0) return data;
  return data.filter(row => {
    const ciudad = quitarTildes(row.ciudad || row.region || '');
    return state.dataCiudad.some(c => quitarTildes(c) === ciudad);
  });
}

function fmtNum(n, dec = 0) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function ciudadesDisponiblesData() {
  const set = new Set();
  const addCiudad = v => {
    if (!v) return;
    const c = v.toString().trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (c) set.add(c);
  };
  for (const row of cupCache) addCiudad(row.region);
  for (const row of dddCache) addCiudad(row.ciudad);
  for (const row of sitCache) addCiudad(row.ciudad);
  const orden = { 'BOGOTA': 1, 'IBAGUE': 2 };
  return [...set].sort((a, b) => (orden[a] || 99) - (orden[b] || 99));
}

function mercadosDisponiblesData() {
  const set = new Set();
  for (const row of cupCache) set.add(row.mercado);
  for (const row of dddCache) set.add(row.mercado);
  const orden = { 'Fanter': 1, 'Terovan': 2, 'Otro': 3 };
  return [...set].filter(Boolean).sort((a, b) => (orden[a] || 99) - (orden[b] || 99));
}

function renderDataFilters() {
  const mercados = mercadosDisponiblesData();
  const mercadoOpts = [{ k: '', l: 'Todos los mercados' }].concat(
    mercados.map(m => ({ k: m, l: 'Mercado ' + m }))
  );

  // Marcas según la pestaña actual (CUP/DDD usan marcas; SIT no, pero mostramos las de CUP como referencia)
  const tipoMarca = state.dataSubTab === 'ddd' ? 'ddd' : 'cup';
  const marcaOpts = marcasDisponiblesData(tipoMarca);

  // Ciudades únicas reales de los datos (normalizadas sin tildes)
  const ciudadOptsRaw = ciudadesDisponiblesData();
  const ciudadDisplayMap = { 'BOGOTA': 'BOGOTÁ', 'IBAGUE': 'IBAGUÉ' };

  const mercadoLabel = mercadoOpts.find(o => o.k === state.dataMercado)?.l || 'Todos los mercados';
  const marcaLabel = state.dataMarcas.length === 0
    ? 'Todas'
    : (state.dataMarcas.length === 1 ? state.dataMarcas[0] : `${state.dataMarcas.length} marcas`);
  const ciudadLabel = state.dataCiudad.length === 0 || state.dataCiudad.length === ciudadOptsRaw.length
    ? 'Todas'
    : state.dataCiudad.map(c => ciudadDisplayMap[c] || c).join(', ');

  const mercadoOpen = state.dataFiltersOpen.mercado ? 'open' : '';
  const marcasOpen = state.dataFiltersOpen.marcas ? 'open' : '';
  const ciudadOpen = state.dataFiltersOpen.ciudad ? 'open' : '';

  return `
    <div class="data-filters">
      <div class="data-filter-wrap">
        <button class="data-filter-btn ${mercadoOpen}" data-action="toggle-data-filter" data-filter="mercado">
          <span class="data-filter-label">Mercado</span>
          <span class="data-filter-value">${esc(mercadoLabel)}</span>
        </button>
        <div class="data-filter-list ${mercadoOpen}" id="data-filter-mercado">
          ${mercadoOpts.map(o => `
            <div class="data-filter-option ${state.dataMercado === o.k ? 'selected' : ''}" data-action="set-data-mercado" data-mercado="${esc(o.k)}">
              <span>${esc(o.l)}</span>
              ${state.dataMercado === o.k ? '<span class="data-filter-check">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="data-filter-wrap">
        <button class="data-filter-btn ${marcasOpen}" data-action="toggle-data-filter" data-filter="marcas">
          <span class="data-filter-label">Marcas</span>
          <span class="data-filter-value">${esc(marcaLabel)}</span>
        </button>
        <div class="data-filter-list ${marcasOpen}" id="data-filter-marcas">
          <div class="data-filter-option ${state.dataMarcas.length === 0 ? 'selected' : ''}" data-action="clear-data-marcas">
            <span>Todas</span>
            ${state.dataMarcas.length === 0 ? '<span class="data-filter-check">✓</span>' : ''}
          </div>
          ${marcaOpts.map(m => `
            <div class="data-filter-option ${state.dataMarcas.includes(m) ? 'selected' : ''}" data-action="toggle-data-marca" data-marca="${esc(m)}">
              <span>${esc(m)}</span>
              ${state.dataMarcas.includes(m) ? '<span class="data-filter-check">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="data-filter-wrap">
        <button class="data-filter-btn ${ciudadOpen}" data-action="toggle-data-filter" data-filter="ciudad">
          <span class="data-filter-label">Ciudad</span>
          <span class="data-filter-value">${esc(ciudadLabel)}</span>
        </button>
        <div class="data-filter-list ${ciudadOpen}" id="data-filter-ciudad">
          <div class="data-filter-option ${state.dataCiudad.length === 0 || state.dataCiudad.length === ciudadOptsRaw.length ? 'selected' : ''}" data-action="clear-data-ciudad">
            <span>Todas</span>
            ${state.dataCiudad.length === 0 || state.dataCiudad.length === ciudadOptsRaw.length ? '<span class="data-filter-check">✓</span>' : ''}
          </div>
          ${ciudadOptsRaw.map(c => `
            <div class="data-filter-option ${state.dataCiudad.includes(c) ? 'selected' : ''}" data-action="toggle-data-ciudad" data-ciudad="${esc(c)}">
              <span>${esc(ciudadDisplayMap[c] || c)}</span>
              ${state.dataCiudad.includes(c) ? '<span class="data-filter-check">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderData() {
  const subTabs = ['CUP', 'DDD', 'SIT'];
  const tabsHtml = subTabs.map(t => `
    <button class="sub-tab ${state.dataSubTab === t ? 'active' : ''}" data-action="set-data-tab" data-tab="${t}">${t}</button>
  `).join('');

  let content = '';
  if (state.dataSubTab === 'CUP') content = renderCUP();
  else if (state.dataSubTab === 'DDD') content = renderDDD();
  else content = renderSIT();

  const sinDatos = cupCache.length === 0 && dddCache.length === 0 && sitCache.length === 0;
  const dataActions = `
    <div class="data-sync-bar">
      <input type="file" accept=".xlsx,.xls" id="data-excel-file" class="data-file-input" onchange="window.handleExcelDataFile(this)">
      <button class="btn btn-sm btn-outline" data-action="sync-data">🔄 Sync Sheets</button>
      ${sinDatos ? '<span class="text-sm text-secondary">Subí el Excel para ver datos</span>' : ''}
    </div>
  `;

  return `
    <h2 class="data-title">Data</h2>
    <div class="sub-tabs">${tabsHtml}</div>
    ${dataActions}
    ${renderDataFilters()}
    <div class="data-content">
      ${content}
    </div>
    <div style="height:12px"></div>
  `;
}

// ----- CUP -----
function renderCUP() {
  let data = filtrarDataPorMercadoMarcas(cupCache, 'cup');
  data = filtrarDataPorCiudad(data, 'cup');

  // Extraer columnas de meses en orden
  const mesCols = [];
  for (const row of cupCache) {
    for (const m of Object.keys(row.meses || {})) {
      if (!mesCols.includes(m)) mesCols.push(m);
    }
  }
  mesCols.sort();

  // Agrupar por médico
  const grupos = {};
  for (const row of data) {
    if (!grupos[row.medico]) {
      grupos[row.medico] = {
        medico: row.medico,
        region: row.region,
        especialidad: row.especialidad,
        rows: [],
        total: 0
      };
    }
    grupos[row.medico].rows.push(row);
    grupos[row.medico].total += row.total;
  }

  const doctores = Object.values(grupos).sort((a, b) => b.total - a.total);

  // Totales generales
  const totalesGenerales = { total: 0 };
  for (const m of mesCols) totalesGenerales[m] = 0;
  for (const doc of doctores) {
    for (const row of doc.rows) {
      totalesGenerales.total += row.total;
      for (const m of mesCols) totalesGenerales[m] += (row.meses[m] || 0);
    }
  }

  const mostrarSubtotal = state.dataMarcas.length >= 2;

  const headerHtml = `
    <thead>
      <tr>
        <th class="data-cup-col-medico">Médico</th>
        <th class="data-cup-col-region">Región</th>
        <th class="data-cup-col-espec">Espec</th>
        ${mesCols.map(m => `<th>${esc(m)}</th>`).join('')}
        <th class="data-cup-col-total">Total</th>
      </tr>
    </thead>
  `;

  const footerHtml = `
    <tfoot>
      <tr class="data-total-row">
        <td colspan="3"><strong>TOTAL</strong></td>
        ${mesCols.map(m => `<td>${fmtNum(totalesGenerales[m])}</td>`).join('')}
        <td><strong>${fmtNum(totalesGenerales.total)}</strong></td>
      </tr>
    </tfoot>
  `;

  const bodyHtml = doctores.map(doc => {
    const key = 'cup-' + doc.medico;
    const expanded = !!state.dataExpanded.cup[key]; // por defecto contraído
    const icon = expanded ? '⊟' : '⊞';
    const subtotal = { total: 0 };
    for (const m of mesCols) subtotal[m] = 0;
    for (const row of doc.rows) {
      subtotal.total += row.total;
      for (const m of mesCols) subtotal[m] += (row.meses[m] || 0);
    }
    const brandRows = expanded
      ? doc.rows.map(row => `
          <tr class="data-cup-brand-row">
            <td class="data-cup-brand-name" colspan="3">${esc(row.marca)}</td>
            ${mesCols.map(m => `<td>${fmtNum(row.meses[m] || 0)}</td>`).join('')}
            <td>${fmtNum(row.total)}</td>
          </tr>
        `).join('')
      : '';

    const subtotalRow = (expanded && mostrarSubtotal)
      ? `
        <tr class="data-cup-subtotal-row">
          <td class="data-cup-brand-name" colspan="3"><em>Subtotal</em></td>
          ${mesCols.map(m => `<td>${fmtNum(subtotal[m])}</td>`).join('')}
          <td>${fmtNum(subtotal.total)}</td>
        </tr>
      `
      : '';

    return `
      <tr class="data-cup-doctor-row" data-action="toggle-data-expand" data-tipo="cup" data-key="${esc(key)}">
        <td class="data-cup-col-medico">
          <span class="data-expand-icon">${icon}</span>
          <strong>${esc(doc.medico)}</strong>
        </td>
        <td class="data-cup-col-region">${esc(doc.region)}</td>
        <td class="data-cup-col-espec">${esc(doc.especialidad)}</td>
        ${mesCols.map(m => `<td>${fmtNum(subtotal[m])}</td>`).join('')}
        <td class="data-cup-col-total"><strong>${fmtNum(subtotal.total)}</strong></td>
      </tr>
      ${brandRows}
      ${subtotalRow}
    `;
  }).join('');

  return `
    <div class="data-table-scroll data-cup-scroll">
      <table class="data-table data-cup-table">
        ${headerHtml}
        <tbody>${bodyHtml || '<tr><td colspan="' + (mesCols.length + 4) + '" class="empty-state">Sin datos</td></tr>'}</tbody>
        ${footerHtml}
      </table>
    </div>
  `;
}

// ----- DDD -----
function renderDDD() {
  let data = filtrarDataPorMercadoMarcas(dddCache, 'ddd');
  data = filtrarDataPorCiudad(data, 'ddd');

  // Agrupar por brick
  const grupos = {};
  for (const row of data) {
    if (!grupos[row.brick]) {
      grupos[row.brick] = {
        brick: row.brick,
        ciudad: row.ciudad,
        rows: [],
        totalCantidad: 0
      };
    }
    grupos[row.brick].rows.push(row);
    grupos[row.brick].totalCantidad += row.cantidad;
  }
  const bricks = Object.values(grupos).sort((a, b) => b.totalCantidad - a.totalCantidad);

  const headerHtml = `
    <thead>
      <tr>
        <th class="data-ddd-col-brick">Brick</th>
        <th>QTR Cant. Actual</th>
        <th>% M.S. QTR</th>
        <th>Crecimiento Peso Brick QTR</th>
        <th>Valor oportunidad Marca</th>
      </tr>
    </thead>
  `;

  const bodyHtml = bricks.map(grp => {
    const key = 'ddd-' + grp.brick;
    const expanded = !!state.dataExpanded.ddd[key]; // por defecto contraído
    const icon = expanded ? '⊟' : '⊞';
    const brandRows = expanded
      ? grp.rows.map(row => {
          const ms = grp.totalCantidad > 0 ? (row.cantidad / grp.totalCantidad) * 100 : 0;
          const esFanter = /FANTER/.test(normalizarNombreMarcaData(row.marca));
          return `
            <tr class="data-ddd-brand-row">
              <td class="data-ddd-col-brick data-ddd-brand-name">${esc(row.marca)}</td>
              <td>${fmtNum(row.cantidad, 2)}</td>
              <td>${fmtPct(ms)}</td>
              <td>${row.crecimiento !== null ? fmtPct(row.crecimiento) : ''}</td>
              <td>${esFanter && row.valorOportunidad !== null ? fmtNum(row.valorOportunidad, 2) : ''}</td>
            </tr>
          `;
        }).join('')
      : '';

    return `
      <tr class="data-ddd-brick-row" data-action="toggle-data-expand" data-tipo="ddd" data-key="${esc(key)}">
        <td class="data-ddd-col-brick">
          <span class="data-expand-icon">${icon}</span>
          <strong>${esc(grp.brick)}</strong>
        </td>
        <td><strong>${fmtNum(grp.totalCantidad, 2)}</strong></td>
        <td><strong>100,00%</strong></td>
        <td>—</td>
        <td>—</td>
      </tr>
      ${brandRows}
    `;
  }).join('');

  return `
    <div class="data-table-scroll data-ddd-scroll">
      <table class="data-table data-ddd-table">
        ${headerHtml}
        <tbody>${bodyHtml || '<tr><td colspan="5" class="empty-state">Sin datos</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

// ----- SIT -----
function renderSIT() {
  let data = filtrarDataPorCiudad(sitCache, 'sit');

  // Determinar cantidad real de meses en los datos
  const numMeses = Math.max(3, ...data.map(r => (r.meses || []).length));

  // Etiquetas de meses
  let mesLabels = state.dataSitMesLabels.length === numMeses
    ? state.dataSitMesLabels
    : (state.dataSitMesLabels.length === 3 ? state.dataSitMesLabels : ultimos3MesesSIT());
  // Asegurar que haya tantas etiquetas como meses
  while (mesLabels.length < numMeses) mesLabels.push(`M${mesLabels.length + 1}`);
  mesLabels = mesLabels.slice(0, numMeses);

  // Totales por mes
  const totales = new Array(numMeses + 1).fill(0);
  for (const row of data) {
    for (let i = 0; i < numMeses; i++) totales[i] += (row.meses[i] || 0);
    totales[numMeses] += row.total || 0;
  }

  // Agrupar: brick -> pdv -> {Inventario, Rotacion}
  const arbol = {};
  for (const row of data) {
    const bKey = `${row.brick} - ${(row.ciudad || '').toUpperCase()}`;
    if (!arbol[bKey]) arbol[bKey] = { brick: row.brick, ciudad: row.ciudad, pdvs: {} };
    if (!arbol[bKey].pdvs[row.pdv]) arbol[bKey].pdvs[row.pdv] = {};
    arbol[bKey].pdvs[row.pdv][row.tipo] = row;
  }

  const mesHeaderHtml = mesLabels.map(m => `<div class="sit-h-mes">${esc(m)}</div>`).join('');

  const totalRowHtml = `
    <div class="sit-total-bar">
      <div class="sit-total-label"><strong>TOTAL</strong></div>
      <div class="sit-total-meses">
        ${totales.slice(0, numMeses).map(v => `<div class="sit-h-mes"><strong>${fmtNum(v)}</strong></div>`).join('')}
        <div class="sit-h-total"><strong>${fmtNum(totales[numMeses])}</strong></div>
      </div>
    </div>
  `;

  const renderTipo = (row) => {
    if (!row) return '';
    const meses = row.meses || [];
    while (meses.length < numMeses) meses.push(0);
    return `
      <div class="sit-tipo-row">
        <div class="sit-tipo-name">${esc(row.tipo)}</div>
        <div class="sit-tipo-meses">
          ${meses.slice(0, numMeses).map((v, i) => `
            <div class="sit-mes-cell">
              <span class="sit-mes-label">${esc(mesLabels[i])}</span>
              <span class="sit-mes-val">${fmtNum(v)}</span>
            </div>
          `).join('')}
          <div class="sit-mes-cell sit-mes-total">
            <span class="sit-mes-label">Total</span>
            <span class="sit-mes-val">${fmtNum(row.total)}</span>
          </div>
        </div>
      </div>
    `;
  };

  const brickHtml = Object.entries(arbol).map(([bKey, brickNode]) => {
    const expanded = !!state.dataExpanded.sit[bKey]; // por defecto contraído
    const icon = expanded ? '⊟' : '⊞';
    const pdvHtml = expanded
      ? Object.entries(brickNode.pdvs).map(([pdv, tipos]) => `
          <div class="sit-pdv">
            <div class="sit-pdv-name">${esc(pdv)}</div>
            ${renderTipo(tipos['Inventario'])}
            ${renderTipo(tipos['Rotacion'])}
          </div>
        `).join('')
      : '';

    return `
      <div class="sit-brick">
        <div class="sit-brick-header" data-action="toggle-data-expand" data-tipo="sit" data-key="${esc(bKey)}">
          <span class="data-expand-icon">${icon}</span>
          <strong>${esc(bKey)}</strong>
        </div>
        ${expanded ? `<div class="sit-brick-body">${pdvHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="sit-scroll-wrap">
      <div class="sit-header-row">
        <div class="sit-h-brick">Brick - Ciudad</div>
        <div class="sit-h-meses-wrap">
          ${mesHeaderHtml}
          <div class="sit-h-total">Total</div>
        </div>
      </div>
      ${totalRowHtml}
      <div class="sit-tree">
        ${brickHtml || '<div class="empty-state">Sin datos</div>'}
      </div>
    </div>
  `;
}

// Init
document.addEventListener('DOMContentLoaded', init);
