const FESTIVOS_2026 = [
  '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
  '2026-04-05','2026-05-01','2026-05-18','2026-06-08','2026-06-15',
  '2026-07-05','2026-07-20','2026-08-07','2026-08-17','2026-10-12',
  '2026-11-02','2026-11-16','2026-12-08','2026-12-25'
];
function esFestivo(f){ return FESTIVOS_2026.includes(f); }
function esDiaHabil(f){ const d=new Date(f+'T00:00:00'); const ds=d.getDay(); if(ds===0||ds===6) return false; return !esFestivo(f); }
function diasHabilesHasta(finStr){ const fin=new Date(finStr+'T00:00:00'); const ini=new Date('2026-01-01T00:00:00'); let c=0; const cur=new Date(ini); while(cur<=fin){ const s=cur.toISOString().split('T')[0]; if(esDiaHabil(s)) c++; cur.setDate(cur.getDate()+1); } return c; }
function diasHabilesMes(a,m){ const ini=new Date(a,m,1); const fin=new Date(a,m+1,0); let c=0; const cur=new Date(ini); while(cur<=fin){ const s=cur.toISOString().split('T')[0]; if(esDiaHabil(s)) c++; cur.setDate(cur.getDate()+1); } return c; }
function diasHabilesCicloHasta(finStr){ const fin=new Date(finStr+'T00:00:00'); const a=fin.getFullYear(), m=fin.getMonth(); const ini=new Date(a,m,1); let c=0; const cur=new Date(ini); while(cur<=fin){ const s=cur.toISOString().split('T')[0]; if(esDiaHabil(s)) c++; cur.setDate(cur.getDate()+1); } return c; }
function calcCobertura(vr,dht,md){ if(!dht||dht<=0) return 0; const ma=dht*md; if(!ma) return 0; return Math.round((vr/ma)*100); }
function colorCob(pct,esF){ if(esF){ if(pct>=100) return '#4CAF50'; if(pct>=70) return '#FF9800'; return '#F44336'; } if(pct>=100) return '#4CAF50'; if(pct>=70) return '#FF9800'; return '#F44336'; }
function claseCob(pct,esF){ if(esF){ if(pct>=100) return 'verde'; if(pct>=70) return 'amarillo'; return 'rojo'; } if(pct>=100) return 'verde'; if(pct>=70) return 'amarillo'; return 'rojo'; }
function colorCobGeneral(pct){ if(pct>=90) return '#4CAF50'; if(pct>=85) return '#FF9800'; return '#F44336'; }
function claseCobGeneral(pct){ if(pct>=90) return 'verde'; if(pct>=85) return 'amarillo'; return 'rojo'; }
function colorCobSegmento(pct){ if(pct>=95) return '#4CAF50'; if(pct>=90) return '#FF9800'; return '#F44336'; }
function claseCobSegmento(pct){ if(pct>=95) return 'verde'; if(pct>=90) return 'amarillo'; return 'rojo'; }
function estadoVisita(cv,freq){ const f=parseInt(freq)||1; if(cv>=f) return {color:'#4CAF50',cls:'verde',lbl:'Completado'}; if(cv>=1&&f>=2) return {color:'#FFC107',cls:'amarillo',lbl:'En progreso'}; return {color:'#9E9E9E',cls:'gris',lbl:'Pendiente'}; }
function hoyISO(){
  const d = new Date();
  // Forzar zona horaria Colombia (UTC-5)
  const bogota = new Date(d.toLocaleString('en-US', {timeZone: 'America/Bogota'}));
  const y = bogota.getFullYear();
  const m = String(bogota.getMonth()+1).padStart(2,'0');
  const day = String(bogota.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function mesActualISO(){ return new Date().toISOString().slice(0,7); }
function fmtFecha(f){ if(!f) return ''; const [y,m,d]=f.split('-'); return d+'/'+m+'/'+y; }
function normalizarFila(row){ const out={}; for(const k in row){ const key=k.toLowerCase().trim().replace(/\s+/g,'_'); out[key]=(row[k]||'').toString().trim(); } return out; }
function descargarCSV(nom,filas){ if(!filas||!filas.length) return; const h=Object.keys(filas[0]); const esc=v=>{ const s=String(v??''); if(s.includes(',')||s.includes('"')||s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"'; return s; }; const lineas=[h.join(','),...filas.map(r=>h.map(x=>esc(r[x])).join(','))]; const blob=new Blob([lineas.join('\n')],{type:'text/csv;charset=utf-8;'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=nom; a.click(); URL.revokeObjectURL(u); }
function obtenerSegmentos(m){ const segs=[]; if(m.segmento){ const p=m.segmento.split(/[,;\s]+/).filter(Boolean); for(const x of p){ const k=x.toUpperCase().trim(); if(['H','C','P','M','E','PS'].includes(k)) segs.push(k); } } if(m.medico_h==='H'||m.medico_h==='Sí'||m.medico_h==='1') segs.push('H'); return [...new Set(segs)]; }
let customBricksMap = {};
function getBrickZona(brick){ if(!brick) return ''; return customBricksMap[brick] || (typeof BRICK_ZONA !== 'undefined' ? BRICK_ZONA[brick] : '') || ''; }
const FARMACIAS_ADIUM_NOMBRES = [
  'Droguería Farmatodo Cosmos 100','Droguería Cruz Verde Acomédica','Droguería Cafam Bogotá Éxito Colina',
  'Droguería Cafam Bogotá Carulla Calle 140','Droguería Colsubsidio San Rafael','Droguería Cruz Verde Uap Ibagué',
  'Droguería Alemana 222','Droguería Optimo Lh','Droguería Audifarma Castellana','Droguería Colsubsidio Cedro',
  'Droguería Alemana 76','Droguería Colsubsidio Palatino','Droguería Alemana 378',
  'Droguería Farmacádiz La Samaria - Coopidrogas','Droguería Cafam Centro de Experiencia Unicentro - Calle 119',
  'Droguería Farmatodo Calle 127','Droguería Farmatodo Colina'
];
function esFarmaciaAdium(nombre){ if(!nombre) return false; const n=nombre.toLowerCase().trim(); return FARMACIAS_ADIUM_NOMBRES.some(a=>n===a.toLowerCase().trim()||a.toLowerCase().trim().includes(n)||n.includes(a.toLowerCase().trim().replace(/^droguería\s+/,''))); }
