// api/bcv.js  — Tasa oficial BCV (consulta varias fuentes y valida)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const opts = {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/json'
    },
    signal: AbortSignal.timeout(6000)
  };

  // Convierte "1.234,56" / "737,88" / "737.88" a número
  const aNumero = (txt) => {
    let s = String(txt).trim();
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s);
  };

  const fuentes = {
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
    bcv_oficial: async () => {
      const r = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', opts);
      if (!r.ok) throw new Error('bcv ' + r.status);
      const html = await r.text();
      // El bloque del dólar: <div id="dolar"> ... <strong> 737,88 </strong>
      const m = html.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
      if (!m) throw new Error('estructura bcv no encontrada');
      return aNumero(m[1]);
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

  const validos = [];
  const errores = {};
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled' && Number.isFinite(r.value) && r.value > 1) {
      validos.push({ source: nombres[i], bcv: r.value });
    } else {
      errores[nombres[i]] = r.status === 'rejected' ? r.reason.message : 'valor inválido';
    }
  });

  if (!validos.length) {
    return res.status(502).json({ success: false, error: 'Todas las fuentes fallaron', detalle: errores });
  }

  // Descarta valores atípicos (>5% lejos de la mediana) y toma el más alto
  // (el BCV publica primero la tasa del día siguiente, que es la mayor)
  const ordenados = validos.map(v => v.bcv).sort((a, b) => a - b);
  const mediana = ordenados[Math.floor(ordenados.length / 2)];
  const buenos = validos.filter(v => Math.abs(v.bcv - mediana) / mediana <= 0.05);
  const mejor = buenos.reduce((a, b) => (b.bcv > a.bcv ? b : a));

  return res.status(200).json({
    success: true,
    bcv: mejor.bcv,
    source: mejor.source,
    fuentes: validos,
    errores
  });
};
