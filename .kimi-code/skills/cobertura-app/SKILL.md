---
name: cobertura-app
description: Contexto de la app Cobertura PWA - rutas, deploy, carga de datos CUP/DDD/SIT, panel médicos/farmacias y convenciones del proyecto.
---

# Skill: App Cobertura (PWA)

Este skill guarda el contexto de la aplicación **Cobertura**, una PWA usada en el celular para registrar visitas a médicos y farmacias, y para consultar datos de CUP, DDD y SIT. Sirve para que, en futuras conversaciones, el asistente sepa dónde están los archivos, cómo cargar datos, cómo hacer deploy y cuáles son las convenciones del proyecto.

---

## Ubicaciones clave

| Recurso | Ruta / URL |
|---------|------------|
| Código local | `C:\Users\csego\cobertura v2\cobertura` |
| Repositorio GitHub | `https://github.com/csegoviar16-hue/cobertura-app.git` |
| App en producción | `https://cobertura-seven.vercel.app` |
| Excel de Data (ejemplo mayo) | `C:\Users\csego\OneDrive\Documentos\TECNOFARMA\Falla Cardiaca\Analisis Territorio\Data Mayo\Data cruda mayo.xlsx` |
| Panel de médicos (ejemplo julio) | `C:\Users\csego\OneDrive\Documentos\TECNOFARMA\Falla Cardiaca\Panel\2026\julio\Cobertura_App_Julio_2026.xlsx` |

---

## Estructura del proyecto

```
cobertura v2/cobertura/
├── index.html              # Punto de entrada PWA
├── manifest.json
├── sw.js
├── css/style.css           # Estilos principales
├── js/
│   ├── app.js              # UI, renderizados, handlers
│   ├── db.js               # IndexedDB wrapper
│   ├── data-excel.js       # Parser de Excel de Data (CUP/DDD/SIT)
│   ├── panel-data.js       # Parser del panel de médicos/farmacias
│   ├── sheets.js           # Sync con Google Sheets (médicos/farmacias)
│   ├── data-sheets.js      # Sync con Google Sheets (Data)
│   ├── utils.js, config.js # Helpers
└── lib/xlsx.full.min.js    # Librería SheetJS para leer Excel
```

---

## Deploy

- El proyecto está conectado a **Vercel** desde el repositorio GitHub.
- Cada `git push` a la rama `main` dispara un deploy automático en `https://cobertura-seven.vercel.app`.
- Para actualizar la app en el celular, normalmente basta con cerrarla completamente y volverla a abrir. Si queda cacheada, abrir la URL directamente en Chrome una vez suele forzar la actualización.

---

## Cómo cargar datos

### 1. Panel de médicos y farmacias (mensual)

- El usuario suele tener un Excel mensual con el panel de médicos (y a veces farmacias).
- La app tiene una función de importación de panel (buscar en `panel-data.js` y en la UI).
- Los segmentos de médicos se toman del archivo de panel (columnas de segmento y médico).
- Mensualmente puede cambiar el panel; también puede mantenerse igual.

### 2. Data: CUP, DDD y SIT (mensual)

- Se sube desde la pestaña **Data** de la app, usando el input de archivo Excel.
- El Excel esperado tiene estas hojas (el parser busca varios nombres alternativos):
  - CUP Fanter: `Cup Mayo Fanter`, `CUP Mayo Fanter`, `Cup Fanter`
  - CUP Terovan: `Cup Mayo Terovan`, `CUP Mayo Terovan`, `Cup Terovan`
  - DDD Fanter: `DDD mayo Fanter`, `DDD Mayo Fanter`, `DDD Fanter`
  - DDD Terovan: `DDD mayo Terovan`, `DDD Mayo Terovan`, `DDD Terovan`
  - SIT Fanter: `Inv-Rot Fanter`, `Inv Rot Fanter`, `SIT Fanter`
  - SIT Terovan: `Inv-Rot Terovan`, `Inv Rot Terovan`, `SIT Terovan`

#### Estructura esperada de las hojas SIT (Inv-Rot)

- Fila 0: encabezado con códigos de mes (ej. `202512`, `202601`, `202602`, `202603`, `202604`, `202605`) y `Total` al final.
- Fila 1: sub-encabezado `SELECCION_3x3` (se ignora).
- Desde fila 2: datos.
- Columnas:
  - A: `Brick - Ciudad` (ej. `9012 - Bogota`). Puede heredarse de la fila anterior si está vacío.
  - B: `Descrip PDV` (nombre de la farmacia). Puede heredarse de la fila anterior si está vacío.
  - C: `Tipo Informacion` (`Inventario` o `Rotacion`).
  - D en adelante: valores mensuales.
  - Última columna: `Total`.
- El parser toma los **últimos 3 meses con datos** y los guarda como `meses: [m3, m2, m1]` y `total`.

#### Estructura esperada de CUP

- Fila 0: encabezado con seriales de fecha en columnas 2-6 y `Total` en columna 7.
- Fila 1: sub-encabezado.
- Desde fila 2:
  - Columna A: `MEDICO - REGION - ESPECIALIDAD` (ej. `MILENA CASTILLO - BOGOTA - CARDIOLOGO`).
  - Columna B: Marca (ej. `FANTER`, `TEROVAN`).
  - Columnas 2-6: valores mensuales.
  - Columna 7: Total.

#### Estructura esperada de DDD

- Fila 0: encabezado.
- Desde fila 1:
  - Columna A: Brick (ej. `9012 - Bogota`).
  - Columna B: Marca.
  - Columna C: Cantidad.
  - Columna D: Market Share.
  - Columna E: Crecimiento.
  - Columna F: Valor Oportunidad (opcional).

---

## Funcionalidades principales de la app

- **Dashboard**: métricas de cobertura de médicos y farmacias, segmentos H/C/P.
- **Médicos**: listado, búsqueda, filtros (segmento, ciudad, brick), ficha del médico con cédula, registro de visitas.
- **Farmacias**: listado por panel/brick/Adium tu Aliado, registro de visitas.
- **Data**: pestañas CUP, DDD y SIT con filtros por mercado, marcas y ciudad.
  - SIT se muestra como árbol: Brick → Farmacia → Inventario/Rotación.
- **Panel**: resumen del mes.
- **Notas** y **Config**.

---

## Convenciones y criterios

- Todos los nombres de médicos, farmacias, marcas y ciudades se comparan **sin tildes** y en mayúsculas.
- Los filtros de Data deben leer los valores únicos reales de los datos cargados.
- Los datos SIT deben mostrarse **contraídos por defecto**; un toque en el brick expande/colapsa.
- El encabezado de SIT debe permanecer fijo al hacer scroll.
- Los cambios deben ser mínimos y seguir el estilo existente del proyecto.
- Antes de tocar código, verificar el estado del repo con `git status` y `git log`.
- Después de editar, validar sintaxis con `node --check js/app.js`.
- Siempre hacer `git add -A`, `git commit` y `git push origin main`; Vercel hará el deploy solo.

---

## Proceso de actualización mensual (checklist)

1. Pedir al usuario el Excel del panel de médicos del mes y el Excel de Data (CUP/DDD/SIT).
2. Revisar los archivos con Python/Node/XLSX para confirmar que las hojas y columnas coinciden con las esperadas.
3. Actualizar el panel de médicos (y farmacias si aplica) en la app.
4. Si el Excel de Data cambió de formato, ajustar `js/data-excel.js`.
5. Verificar localmente el parser con el Excel real.
6. Hacer commit/push a GitHub.
7. Esperar el deploy en Vercel y pedirle al usuario que pruebe en el celular.

---

## Errores comunes y soluciones

| Error | Causa probable | Solución |
|-------|----------------|----------|
| `setSelectionRange` en input file | Intentar restaurar foco en un `<input type="file">` | Verificar que `selectionStart` sea un número antes de llamar `setSelectionRange` |
| SIT no muestra datos | Parser no encuentra las hojas o los meses no están donde espera | Confirmar nombres de hojas y que la fila 0 tenga los códigos de mes y la última columna sea `Total` |
| SIT muestra bricks pero no números | Scroll horizontal corta las columnas de mes/Total | Revisar el layout responsive de SIT; preferir mostrar meses y total visibles sin scroll excesivo |
| Filtros no abren | Estado o CSS del dropdown | Revisar `state.dataFiltersOpen`, z-index y que el handler `toggle-data-filter` esté asignado |
| App nativa no se actualiza | Service worker/cache | Abrir URL en Chrome o borrar caché; desinstalar e instalar solo como último recurso |

---

## Contacto / decisiones del usuario

- La app se usa **principalmente en el celular**; el diseño mobile-first es prioritario.
- El usuario NO es técnico; hay que dar instrucciones paso a paso cuando se requiera ejecutar comandos.
- Los datos se cargan mensualmente por Excel; Google Sheets solo se usa como respaldo alternativo y a veces no tiene la data completa.
