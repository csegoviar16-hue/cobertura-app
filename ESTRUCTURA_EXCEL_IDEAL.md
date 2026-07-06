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
