# PWA COBERTURA - REFACTOR COMPLETO

## STACK TÉCNICO
- Vanilla JavaScript (ES6+), sin frameworks
- CSS puro, mobile-first, responsive
- IndexedDB para almacenamiento local
- Google Sheets API v4 (solo lectura, API Key)
- Service Worker para PWA
- Sin React, Sin Vue, Sin Angular
- Sin jQuery
- Sin Bootstrap

## REGLAS DE CÓDIGO
- Usar async/await, no callbacks
- Usar template literals para HTML
- Manejar errores con try/catch
- Código en español (variables, comentarios)
- NO usar librerías externas salvo xlsx.js (ya incluido)

## CONTEXTO
App PWA para representantes médicos. Vanilla JS, IndexedDB, Google Sheets API (solo lectura).
Usuario principal: Carlos (Adium - Falla Cardíaca). Esposa: otra empresa farmacéutica.
Panel Carlos: ~176 médicos, ~60 farmacias. Esposa: ~200 médicos.

## ARCHIVOS ACTUALES
- index.html (entrada, carga scripts)
- css/style.css (estilos mobile-first)
- js/app.js (lógica principal, ~1000 líneas)
- js/db.js (IndexedDB, 5 stores: medicos, farmacias, visitas, notas, config)
- js/sheets.js (sincronización Google Sheets, export CSV)
- js/utils.js (funciones helper: días hábiles, cobertura, colores)
- js/panel-data.js (datos incrustados fallback)
- sw.js (Service Worker básico)
- manifest.json (PWA completo)
- Cobertura-Offline.html (versión monolítica legacy)

## CREDENCIALES GOOGLE SHEETS
- API Key: AIzaSy...s9Mw
- Sheet ID Carlos: 1yDvv9Tg-fxJ4tDB8_8mbc6dL6hzDlJysSWXlZOQ4Cxg
- Sheet Esposa: [PENDIENTE - usuario la configurará después]
- Permiso Sheet: "Cualquiera con el enlace puede ver"

## ESTRUCTURA EXCEL (15 columnas)
A. Cedula | B. ID 18 Account | C. Nombre de la cuenta | D. Especialidad | E. Adium Call Specialty | F. Medico H (SI/NO) | G. Frecuencia | H. Segmento Línea | I. Ciudad de eleccion | J. Direccion de eleccion | K. Brick de eleccion | L. Celular | M. Email | N. CATEGORIA FC | O. Comarketing

## SEGMENTOS
H = Hypertargeting | C = Conquistar | P = Proteger | M = Mantener | E = Evaluar | PS = Por Segmentar

## FASES A IMPLEMENTAR

### FASE 1: SELECTOR DE USUARIO + REFACTOR BASE
- [ ] Pantalla inicial: selector Carlos / Esposa
- [ ] Sesiones COMPLETAMENTE INDEPENDIENTES
- [ ] Prefijo IndexedDB: carlos_ / esposa_
- [ ] Configuración por usuario: URL Sheet, meta médicos, meta farmacias
- [ ] Metas: Carlos = 9 médicos/día + 2 farmacias/día | Esposa = 13 médicos/día + 3 farmacias/día

### FASE 2: DASHBOARD REORGANIZADO
- [ ] Días hábiles del ciclo (Colombia 2026, función ya existe)
- [ ] Tarjeta Médicos: visitados/meta (%) + barra progreso + color
- [ ] Tarjeta Farmacias: visitadas/meta (%) + barra progreso + color
- [ ] Tarjetas por segmento: H, C, P, M, E, PS (cobertura, %, pendientes)
- [ ] Colores: ������≥100% ������70-99% ������<70%
- [ ] Acciones rápidas: ������ Resumen día / ������‍⚕️ Pend. Médicos / ������ Pend. Farmacias

### FASE 3: MÉDICOS MEJORADO
- [ ] Sub-tabs: Panel, H, C, P, M, E, PS, Brick, Deblax
- [ ] Filtros: ciudad (Bogotá/Ibagué), especialidad, visitado/pendiente
- [ ] Búsqueda texto
- [ ] Ordenamiento: Médicos H primero, luego alfabético (en TODAS las vistas)
- [ ] Iconos por médico: ������ notas, ✏️ editar, + registrar visita

### FASE 4: FARMACIAS MEJORADO
- [ ] Sub-tabs: Panel, Brick, Adium tu Aliado
- [ ] Mismo formato que médicos (filtros, iconos, modal)

### FASE 5: MODALES
- [ ] Modal médico/farmacia: info completa + visitas ciclo + notas
- [ ] Registrar visita: calendario → confirmación → guardar
- [ ] Editar datos: formulario (guarda en IndexedDB, NO sync con Sheets)

### FASE 6: NOTAS + ALTAS/BAJAS
- [ ] Integrar Altas/Bajas dentro de Notas
- [ ] Tarjeta Altas: formulario completo (nombre, CC, cel, email, especialidad, ciudad, dirección, observaciones)
- [ ] Tarjeta Bajas: texto libre (nombre, motivo)
- [ ] Marcar como completada
- [ ] Notas generales actuales
- [ ] Notas por médico (en modal)

### FASE 7: LISTAS ESPECIALES
- [ ] Deblax: leer columna "Comarketing" = "Deblax", mostrar lista
- [ ] Adium tu Aliado: lista farmacias, conteo dependientes inscritos

### FASE 8: BRICKS
- [ ] Actualizar BRICK_ZONA con 29 bricks (22 Bogotá, 7 Ibagué)
- [ ] Vista agrupada por brick con nombre zona
- [ ] Gestión desde Configuración (añadir nuevos)

### FASE 9: CONFIGURACIÓN
- [ ] URL del Sheet por usuario
- [ ] Botón Sincronizar ahora
- [ ] Exportar/Importar backup JSON
- [ ] Cambiar usuario
- [ ] Gestionar bricks
- [ ] Última sincronización (timestamp)

### FASE 10: PWA + DEPLOY
- [ ] Verificar manifest.json
- [ ] Service Worker con cache actualizado
- [ ] Iconos completos
- [ ] Deploy en Netlify (cuenta ya existe)

### FASE 11: MEJORAS ESTÉTICAS / UI POLISH
- [ ] Animaciones suaves en transiciones
- [ ] Mejorar tipografía y espaciado
- [ ] Iconos consistentes
- [ ] Dark mode opcional
- [ ] Feedback visual en botones (hover, active)
- [ ] Skeleton loaders mientras carga
- [ ] Empty states (mensajes cuando no hay datos)

## REGLAS IMPORTANTES
- SOLO LECTURA de Google Sheets (Opción A). NO implementar escritura.
- Cambios locales guardados en IndexedDB.
- NO sincronizar Altas/Bajas con Sheets (solo locales).
- NO compartir datos entre usuarios.
- NO hardcodear metas (diferentes para Carlos y Esposa).
- Festivos Colombia 2026 ya están en utils.js.

## ENTREGABLES ESPERADOS
- Código refactorizado en archivos separados
- Cada fase funcional y probada
- README con instrucciones de deploy

## INSTRUCCIÓN DE TRABAJO
Implementar por fases, una a una. Cada fase debe estar completa y funcional antes de pasar a la siguiente. Al final de cada fase, generar un resumen de cambios.
