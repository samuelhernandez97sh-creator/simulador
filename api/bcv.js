// api/bcv.js — Tasa oficial BCV con 4 decimales (consulta varias fuentes y prefiere las de mayor precisión)
const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const opts = { method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json' }, signal: AbortSignal.timeout(6000) };

  // "1.234,5678" / "893,2173" / "893.2173" -> número (sin perder decimales)
  const aNumero = (txt) => {
    let s = String(txt).trim();
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s);
  };
  const decimales = (v) => { const s = String(v); return s.includes('.') ? s.split('.')[1].length : 0; };

  // bcv.org.ve suele tener la cadena de certificados incompleta: solo para leer este dato público se omite la verificación TLS
  const getBcv = (url) => new Promise((resolve, reject) => {
    const r = https.get(url, { agent: new https.Agent({ rejectUnauthorized: false }), headers: { 'User-Agent': UA }, timeout: 7000 }, (resp) => {
      let d = ''; resp.setEncoding('utf8');
      resp.on('data', c => d += c);
      resp.on('end', () => resp.statusCode === 200 ? resolve(d) : reject(new Error('bcv HTTP ' + resp.statusCode)));
    });
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('bcv timeout')));
  });

  const fuentes = {
    bcv_oficial: async () => {
      const html = await getBcv('https://www.bcv.org.ve/glosario/cambio-oficial');
      const m = html.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
      if (!m) throw new Error('estructura bcv no encontrada');
      return aNumero(m[1]);
    },
    dolarapi: async () => {
      const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', opts);
      if (!r.ok) throw new Error('dolarapi ' + r.status);
      const d = await r.json();
      return aNumero(d.promedio ?? d.venta ?? d.compra);
    },
    exchangemonitor: async () => {
      const r = await fetch('https://p2p.exchangemonitor.net/api/v1/ve/dolar', opts);
      if (!r.ok) throw new Error('exchangemonitor ' + r.status);
      const d = await r.json();
      return aNumero(d.bcv.precio);
    },
    tcambio: async () => {
      const r = await fetch('https://tcambio.app/', opts);
      if (!r.ok) throw new Error('tcambio ' + r.status);
      const html = await r.text();
      const m = html.match(/Bs\.?S?\s*<strong>\s*([\d.,]+)\s*<\/strong>/i);
      if (!m) throw new Error('estructura tcambio no encontrada');
      return aNumero(m[1]);
    }
  };

  const nombres = Object.keys(fuentes);
  const resultados = await Promise.allSettled(nombres.map(n => fuentes[n]()));

  const validos = [], errores = {};
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled' && Number.isFinite(r.value) && r.value > 1) validos.push({ source: nombres[i], bcv: r.value, dec: decimales(r.value) });
    else errores[nombres[i]] = r.status === 'rejected' ? r.reason.message : 'valor inválido';
  });
  if (!validos.length) return res.status(502).json({ success: false, error: 'Todas las fuentes fallaron', detalle: errores });

  // Descarta atípicos (>5% de la mediana) y toma el valor más alto (el BCV publica primero la tasa del día siguiente)
  const orden = validos.map(v => v.bcv).sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)];
  const buenos = validos.filter(v => Math.abs(v.bcv - mediana) / mediana <= 0.05);
  let mejor = buenos.reduce((a, b) => (b.bcv > a.bcv ? b : a));

  // Si el ganador viene redondeado (ej. 893.22) y otra fuente da el mismo valor con más decimales (893.2173), usa esa
  if (mejor.dec < 4) {
    const preciso = buenos.filter(v => v.dec >= 3 && Math.abs(v.bcv - mejor.bcv) <= 0.0051).sort((a, b) => b.dec - a.dec)[0];
    if (preciso) mejor = preciso;
  }

  return res.status(200).json({
    success: true,
    bcv: Math.round(mejor.bcv * 10000) / 10000,
    source: mejor.source,
    decimales: Math.min(mejor.dec, 4),
    fuentes: validos.map(v => ({ source: v.source, bcv: v.bcv })),
    errores
  });
};
