const fs = require('fs');
const path = require('path');
const base = __dirname;

// Leer archivos
const css = fs.readFileSync(path.join(base, 'css/style.css'), 'utf8');
const utils = fs.readFileSync(path.join(base, 'js/utils.js'), 'utf8');
const config = fs.readFileSync(path.join(base, 'js/config.js'), 'utf8');
const db = fs.readFileSync(path.join(base, 'js/db.js'), 'utf8');
const sheets = fs.readFileSync(path.join(base, 'js/sheets.js'), 'utf8');
const panelData = fs.readFileSync(path.join(base, 'js/panel-data.js'), 'utf8');
const app = fs.readFileSync(path.join(base, 'js/app.js'), 'utf8');
const xlsx = fs.readFileSync(path.join(base, 'lib/xlsx.full.min.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Cobertura - Offline</title>
<style>${css}</style>
<script>${xlsx}</script>
<script>${utils}</script>
<script>${config}</script>
<script>${db}</script>
<script>${sheets}</script>
<script>${panelData}</script>
<script>${app}</script>
</head>
<body>
<div id="app"></div>
<script>init();</script>
</body>
</html>`;

fs.writeFileSync(path.join(base, 'Cobertura-Offline.html'), html);
console.log('Generado: Cobertura-Offline.html (' + (html.length/1024).toFixed(1) + ' KB)');
