const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'Cobertura-Offline.html');

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf-8');
}

// Leer index.html base (sin modificar)
const html = read('index.html');

// Definir los scripts a inlinear, en orden, con sus etiquetas exactas
const scripts = [
  { src: 'lib/xlsx.full.min.js', tag: '<script src="lib/xlsx.full.min.js"></script>' },
  { src: 'js/utils.js', tag: '<script src="js/utils.js"></script>' },
  { src: 'js/db.js', tag: '<script src="js/db.js"></script>' },
  { src: 'js/config.js', tag: '<script src="js/config.js"></script>' },
  { src: 'js/sheets.js', tag: '<script src="js/sheets.js"></script>' },
  { src: 'js/data-sheets.js', tag: '<script src="js/data-sheets.js"></script>' },
  { src: 'js/data-excel.js', tag: '<script src="js/data-excel.js"></script>' },
  { src: 'js/panel-data.js', tag: '<script src="js/panel-data.js"></script>' },
  { src: 'js/app.js', tag: '<script src="js/app.js"></script>' },
];

// Función para escapar </script> dentro del contenido JS
function escapeScript(content) {
  return content.replace(/<\/script>/gi, '<\\/script>');
}

// Reconstruir el HTML cortando en los índices exactos del HTML original
let result = '';
let cursor = 0;

for (const s of scripts) {
  const idx = html.indexOf(s.tag, cursor);
  if (idx === -1) {
    console.error(`❌ No se encontró la etiqueta: ${s.tag}`);
    process.exit(1);
  }
  // Agregar todo lo que hay entre el cursor y esta etiqueta
  result += html.slice(cursor, idx);
  // Agregar el contenido inlineado
  const content = escapeScript(read(s.src));
  result += `<script>\n${content}\n</script>`;
  // Avanzar el cursor después de la etiqueta original
  cursor = idx + s.tag.length;
}

// Agregar el resto del HTML desde el cursor hasta el final
result += html.slice(cursor);

// Reemplazar CSS inline (ahora en result)
const css = read('css/style.css');
result = result.replace(
  /<link rel="stylesheet" href="css\/style.css">/,
  `<style>\n${css}\n</style>`
);

// Quitar manifest e icono (no funcionan en file://)
result = result.replace(/<link rel="manifest"[^>]*>/, '<!-- manifest no funciona en file:// -->');
result = result.replace(/<link rel="apple-touch-icon"[^>]*>/, '<!-- icono no disponible en file:// -->');

// Reemplazar registro de Service Worker
result = result.replace(
  /if \('serviceWorker' in navigator\) navigator\.serviceWorker\.register\('sw\.js'\)\.catch\(console\.error\);/,
  `// Service Worker desactivado: no funciona en file://\n` +
  `    (function(){\n` +
  `      if(location.protocol==='file:'){\n` +
  `        console.log('Modo file:// detectado. IndexedDB funciona en Android Chrome. En iOS Safari puede tener limitaciones.');\n` +
  `      }\n` +
  `    })();`
);

// Agregar banner informativo para file://
result = result.replace(
  '<div id="app"></div>',
  `<div id="file-banner" style="display:none;background:#fff3cd;color:#856404;padding:10px 14px;font-size:.82rem;text-align:center;border-bottom:1px solid #ffeaa7">
    📱 <strong>Modo archivo local</strong><br>
    Funciona offline. Para icono en pantalla principal usá Kiwi Browser (Android) o compartí por WhatsApp/Telegram y abrí desde ahí.<br>
    <button onclick="document.getElementById('file-banner').style.display='none'" style="margin-top:6px;padding:4px 10px;border:none;border-radius:6px;background:#856404;color:#fff;font-size:.75rem;cursor:pointer">Entendido</button>
  </div>
  <div id="app"></div>
  <script>
    if(location.protocol==='file:'){
      var b=document.getElementById('file-banner');
      if(b) b.style.display='block';
    }
  </script>`
);

fs.writeFileSync(OUT, result, 'utf-8');

const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✅ Cobertura-Offline.html generado: ${sizeKB} KB`);
console.log(`📍 Ubicación: ${OUT}`);

// Verificación rápida
const remaining = (result.match(/<script src=/g) || []).length;
if (remaining > 0) {
  console.warn(`⚠️ Quedaron ${remaining} etiquetas <script src=> sin inlinear`);
} else {
  console.log(`✅ Todas las dependencias están inlineadas`);
}
