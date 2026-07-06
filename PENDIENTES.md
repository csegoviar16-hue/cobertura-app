# PENDIENTES Y MEJORAS FUTURAS - COBERTURA APP

## 📌 Resumen de lo construido hasta el momento

- PWA con 5 vistas: Dashboard, Médicos, Farmacias, Notas, Config.
- Carga de Excel (.xlsx) con 176 médicos y 60 farmacias.
- Sincronización opcional con Google Sheets.
- Registro de visitas con calendario mensual.
- Edición y eliminación de visitas.
- Bloqueo de visitas adicionales cuando se alcanza la frecuencia.
- Dashboard con cobertura, resumen por día y acceso a pendientes.
- Pendientes filtrables por ciudad (Bogotá/Ibagué) y segmento (H, C, P, M, E, PS).
- Nombres de zona en bricks (ej: BRICK 8809 - CHICO COLSANITAS).
- Versión offline: `Cobertura-Offline.html` con todo inlineado.
- Service Worker en v9.
- Diagnóstico técnico completo en `DIAGNOSTICO_PWA.md`.

---

## 📝 Pendientes / Ideas de mejoras

Agregá acá abajo las mejoras que quieras hacerle después. Cuando vuelvas a contactar al agente de IA, pasale este archivo para que recupere contexto rápido.

### Alta prioridad
- [ ] 
- [ ] 
- [ ] 

### Media prioridad
- [ ] 
- [ ] 
- [ ] 

### Baja prioridad / Ideas
- [ ] 
- [ ] 
- [ ] 

---

## 🔧 Problemas pendientes por resolver

- [ ] La app no tiene icono en pantalla de inicio nativo porque funciona como archivo local (`file://`).
- [ ] En iPhone/iPad Safari puede tener problemas con IndexedDB en archivo local.
- [ ] El Service Worker solo funciona si la app se sirve desde HTTPS o localhost.

---

## 🚀 Cómo retomar el trabajo

1. Descomprimí el ZIP `cobertura-backup-AAAA-MM-DD.zip`.
2. Abrí la carpeta con Visual Studio Code o cualquier editor.
3. Si vas a seguir trabajando con el agente de IA:
   - Pasale el archivo `DIAGNOSTICO_PWA.md`.
   - Pasale el archivo `PENDIENTES.md` (este archivo).
   - Pasale el ZIP completo o dale acceso a la carpeta del proyecto.
   - Decile: *"Continuá el proyecto Cobertura. Leé los archivos DIAGNOSTICO_PWA.md y PENDIENTES.md primero."*
