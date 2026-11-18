// api/_filtros.js — filtros anti-manipulación para los anuncios de Binance P2P (el "_" evita que Vercel lo cuente como función)
// Descarta anuncios con poca fiabilidad o con un precio muy por encima del resto (típico de anuncios "de vitrina" que casi nadie puede tomar).
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

function opciones(q = {}) {
  const n = (v, d) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
  return {
    minFinish: n(q.minfinish, 90) / 100,   // tasa de completado mínima de los últimos 30 días (90 %)
    minOrders: n(q.minorders, 50),        // órdenes mínimas en 30 días
    gap: n(q.gap, 0.8) / 100               // salto máximo del 1.er anuncio respecto al siguiente (0,8 %)
  };
}

// ads: ya filtrados por método y monto, y ORDENADOS de mejor a peor precio. tipo: 'SELL' (mayor = mejor) o 'BUY' (menor = mejor)
function filtrar(ads, tipo, o) {
  const excluidos = [];
  const nombre = (a) => (a.advertiser && a.advertiser.nickName) || '—';
  const precio = (a) => parseFloat(a.adv.price);

  let lista = ads.filter(a => {
    let f = a.advertiser ? num(a.advertiser.monthFinishRate) : null;
    if (f !== null && f > 1) f = f / 100;                       // por si viene como porcentaje
    const n = a.advertiser ? num(a.advertiser.monthOrderCount) : null;
    if (f !== null && f < o.minFinish) { excluidos.push({ name: nombre(a), rate: precio(a), motivo: `completado ${(f * 100).toFixed(1)} %` }); return false; }
    if (n !== null && n < o.minOrders) { excluidos.push({ name: nombre(a), rate: precio(a), motivo: `solo ${n} órdenes` }); return false; }
    return true;
  });

  let relajado = false;
  if (!lista.length && ads.length) { lista = ads.slice(); excluidos.length = 0; relajado = true; }  // si no queda nada, no se rompe el sistema

  // Anuncio de vitrina: precio muy por encima del siguiente (hasta 2 veces)
  for (let i = 0; i < 2 && lista.length >= 2; i++) {
    const p1 = precio(lista[0]), p2 = precio(lista[1]);
    const salto = tipo === 'SELL' ? (p1 - p2) / p2 : (p2 - p1) / p2;
    if (salto > o.gap) { excluidos.push({ name: nombre(lista[0]), rate: p1, motivo: `precio ${(salto * 100).toFixed(2)} % por encima del resto` }); lista.shift(); }
    else break;
  }
  return { ads: lista, excluidos, relajado };
}

module.exports = { opciones, filtrar };
