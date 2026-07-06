# DIAGNÓSTICO PWA - COBERTURA OFFLINE

## 1. ESTRUCTURA DE ARCHIVOS

```
cobertura/
├── build-standalone.js
├── Cobertura-Offline.html
├── cobertura-server.js
├── css/
│   └── style.css
├── ESTRUCTURA_EXCEL_IDEAL.md
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
├── index.html
├── js/
│   ├── app.js
│   ├── db.js
│   ├── panel-data.js
│   ├── sheets.js
│   └── utils.js
├── lib/
│   └── xlsx.full.min.js
├── manifest.json
└── sw.js
```

---

## 2. MANIFEST.JSON

```json
{
  "name": "Cobertura",
  "short_name": "Cobertura",
  "description": "CRM médico offline con sincronización a Google Sheets",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "orientation": "portrait",
  "scope": "./",
  "icons": [
    { "src": "icons/icon-72x72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "icons/icon-96x96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "icons/icon-144x144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "icons/icon-152x152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 3. SERVICE WORKER (sw.js)

```javascript
const CACHE_NAME = 'cobertura-v9';
const STATIC_ASSETS = [
  './','./index.html','./css/style.css',
  './lib/xlsx.full.min.js',
  './js/utils.js','./js/db.js','./js/sheets.js','./js/panel-data.js','./js/app.js',
  './manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(res => {
      return caches.open(CACHE_NAME).then(c => { c.put(request, res.clone()); return res; });
    })));
    return;
  }
  if (url.hostname.includes('google.com') || url.hostname.includes('script.google.com') || url.hostname.includes('docs.google.com')) {
    e.respondWith(fetch(request));
    return;
  }
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
```

---

## 4. ESTRUCTURA DE DATOS

```markdown
# Estructura Ideal del Excel para Cargar en Cobertura

Usa **1 solo archivo Excel (.xlsx)** con **2 hojas** y **1 sola fila de encabezado**.

---

## 📋 HOJA 1: "Médicos"

| Columna | Contenido | Ejemplo |
|---------|-----------|---------|
| A | ID (opcional) | 14297580 |
| B | ID Salesforce (no se muestra) | 0015f00000X9H63AAF |
| C | **Nombre** (obligatorio) | Rodríguez Arciniegas, Douglas Eduardo |
| D | Especialidad | Medicina interna |
| E | Médico H (SI / NO) | NO |
| F | Médico H (SI / NO) | NO |
| G | Frecuencia (visitas/mes) | 1 |
| H | **Segmento Línea** | PS / Evaluar / Conquistar / Mantener / Proteger |
| I | Tipo Consulta (info solo visual) | Privado |
| J | Ciudad | Bogotá |
| K | Dirección | Calle 27 Sur #21A-19 |
| L | Brick | 5219 |

### Segmentos que usa la app:

| Valor en Excel | Letra | Significado |
|----------------|-------|-------------|
| Médico H = **SI** | **H** | Hypertargeting (médicos más importantes) |
| Segmento Línea = **Conquistar** | **C** | Conquistar |
| Segmento Línea = **Proteger** | **P** | Proteger |
| Segmento Línea = **Mantener** | **M** | Mantener |
| Segmento Línea = **Evaluar** | **E** | Evaluar |
| Segmento Línea = **PS** | **PS** | Por Segmentar |

Un médico puede tener **2 segmentos** a la vez. Ejemplo: `H,PS` (Hypertargeting + Por Segmentar).

---

## 📋 HOJA 2: "Farmacias"

| Columna | Contenido | Ejemplo |
|---------|-----------|---------|
| A | ID (opcional) | 1 |
| B | **Nombre** (obligatorio) | Drogas la Rebaja |
| C | Cadena | Cruz Verde |
| D | Ciudad | Bogotá |
| E | Brick | 5219 |
| F | Dirección | Calle 100 #19A-35 |
| G | Frecuencia (visitas/mes) | 2 |

---

## ⚠️ Reglas importantes

1. **1 sola fila de encabezado** en cada hoja
2. **No dejar filas vacías** en medio de los datos
3. **Nombre exacto de las hojas**: `Médicos` y `Farmacias` (con tilde)
4. **Guardar como .xlsx**
5. Los segmentos se leen automáticamente de la **columna H (Segmento Línea)** y de si el médico tiene **H = SI**

---

## 🔄 Cómo cargar el panel del mes siguiente

1. Prepara tu nuevo Excel con la misma estructura
2. Abre la app → **Config** → **Cargar Excel**
3. Selecciona el archivo
4. La app **reemplaza** médicos y farmacias, tus **visitas se mantienen**
```

---

## 5. CONFIGURACIÓN ACTUAL

| Pregunta | Respuesta |
|----------|-----------|
| ¿La app está hosteada en algún servidor? | **No.** Funciona como archivo HTML local (`file://`) o desde `localhost:8000` con servidor Node.js local. |
| ¿Cuál es la URL de acceso actual? | `file:///storage/emulated/0/Download/Cobertura-Offline.html` (en celular) o `http://localhost:8000` (desde PC) |
| ¿Funciona el icono en pantalla de inicio? | **No.** El archivo `manifest.json` no funciona en protocolo `file://`. Chrome/Safari no ofrecen "Agregar a pantalla de inicio" para archivos locales. Para tener icono nativo se necesita servir la app desde HTTPS (GitHub Pages, Netlify, etc.). |
| ¿Funciona offline? | **Sí**, parcialmente. El archivo HTML monolítico (`Cobertura-Offline.html`) tiene todo inlineado (CSS, JS, datos) y no necesita internet para funcionar. IndexedDB funciona en Android Chrome. En iOS Safari IndexedDB tiene limitaciones en `file://`. El Service Worker está desactivado en la versión offline porque los SW no funcionan en `file://`. |

---

## 6. PROBLEMAS CONOCIDOS

1. **No hay icono en pantalla de inicio nativo**
   - Causa: `manifest.json` y Service Workers no funcionan en protocolo `file://`.
   - Solución temporal: Usar **Kiwi Browser** en Android (permite agregar páginas locales a pantalla de inicio).
   - Solución definitiva: Subir a **GitHub Pages** (HTTPS gratuito).

2. **IndexedDB limitado en iPhone/iPad**
   - Causa: WebKit (Safari) bloquea o limita IndexedDB en archivos locales desde iOS 14+.
   - Impacto: Las visitas pueden no guardarse en iPhone si se abre el archivo local.
   - Solución: Usar Chrome para iOS o subir a GitHub Pages.

3. **Service Worker inactivo en versión offline**
   - Causa: Los navegadores bloquean el registro de SW en `file://` por seguridad.
   - Impacto: No hay caché automático ni actualización en segundo plano.
   - Solución: Solo funciona si la app se sirve desde HTTPS o localhost.

4. **No hay notificaciones push ni sincronización en segundo plano**
   - Causa: Requiere Service Worker activo + permisos del sistema operativo.
   - Solución: Subir a HTTPS y registrar el SW correctamente.

5. **Actualización manual**
   - Causa: Sin SW ni servidor, cada nueva versión requiere que el usuario descargue y reemplace el archivo HTML manualmente.
   - Impacto: Si se mejora la app, el usuario debe borrar el archivo viejo y abrir el nuevo.

---

## 7. FUNCIONALIDADES ACTUALES

### Navegación
- **Dashboard**: Resumen de cobertura, resumen por día y acceso a pendientes.
- **Médicos**: Lista con búsqueda, filtros por ciudad (Bogotá/Ibagué), sub-pestañas por segmento (H, C, P, M, E, PS, Brick).
- **Farmacias**: Lista con filtros por ciudad y vista por Brick.
- **Notas**: Notas rápidas con checkboxes.
- **Config**: Cargar Excel, sincronizar Google Sheets, exportar CSV, backup.

### Gestión de visitas
- Registrar visita con calendario mensual (seleccionar cualquier día).
- Semáforo de visitas: gris (0), amarillo (1 de 2), verde (completado).
- **Bloqueo de visitas adicionales**: si un médico/farmacia ya alcanzó su frecuencia, el botón ➕ se reemplaza por ✓ verde.
- **Editar fecha de visita**: botón ✏️ en el modal del médico/farmacia.
- **Eliminar visita**: botón 🗑️ en el modal del médico/farmacia.
- **Resumen por día**: tarjetas con cada fecha que tiene visitas. Al tocar una fecha se ve el detalle de quiénes fueron visitados.

### Pendientes
- **Pendientes Médicos**: lista filtrable por ciudad (Bogotá/Ibagué) y segmento (H, C, P, M, E, PS).
- **Pendientes Farmacias**: lista filtrable por ciudad (Bogotá/Ibagué).
- Solo muestra entidades con visitas < frecuencia.

### Datos y sincronización
- **Carga de Excel**: acepta archivos `.xlsx` con hojas "Médicos" y "Farmacias".
- **Google Sheets**: sincronización opcional vía CSV export.
- **Backup**: descarga JSON con todos los datos.
- **Datos incluidos**: 176 médicos y 60 farmacias con mapeo de bricks a zonas.

### UX / Mobile-first
- CSS mobile-first con bottom navigation.
- Nav se oculta al scrollear hacia abajo y aparece al scrollear hacia arriba.
- Input de búsqueda preserva foco al tipear.
- Modal compacto de médico/farmacia con grid de 2 columnas para evitar scroll.
- Anti-zoom en inputs (`font-size: 16px`).
- Anti-bounce y anti-pull-to-refresh.
- `user-select: none` para evitar selección accidental de texto.
