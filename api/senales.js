// api/senales.js — consulta Binance P2P (pestaña Venta, sin patrocinados) para TODOS tus métodos de pago de una vez
// /api/senales?venta=1000000&recompra=20000
const METODOS = {
  BDV:       ['BancoDeVenezuela'],
  Banesco:   ['Banesco'],
  Mercantil: ['Mercantil'],
  Provincial:['Provincial'],
  PagoMovil: ['PagoMovil']
};

async function buscar(pay, amount) {
  const r = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://p2p.binance.com',
      'Referer': 'https://p2p.binance.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      fiat: 'VES', asset: 'USDT', tradeType: 'SELL', page: 1, rows: 20,
      payTypes: [pay], countries: [], publisherType: null,
      merchantCheck: false, proMerchantAds: false, shieldMerchantAds: false, filterType: 'all',
      transAmount: String(Math.round(amount))
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error('Binance HTTP ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j.data)) throw new Error('Respuesta inesperada de Binance');

  const esPromo = (a) => Object.entries(a.adv || {}).some(([k, v]) => /promot|sponsor/i.test(k) && v && v !== 'false');
  let ads = j.data.filter(a => !esPromo(a));
  const conMetodo = ads.filter(a => (a.adv.tradeMethods || []).some(m => m.identifier === pay));
  if (conMetodo.length) ads = conMetodo;
  ads = ads.filter(a => {
    const min = parseFloat(a.adv.minSingleTransAmount);
    const max = parseFloat(a.adv.dynamicMaxSingleTransAmount ?? a.adv.maxSingleTransAmount);
    return amount >= min && amount <= max;
  });
  ads.sort((a, b) => parseFloat(b.adv.price) - parseFloat(a.adv.price));
  return ads.slice(0, 5).map(a => ({
    name: (a.advertiser && a.advertiser.nickName) || '—',
    rate: parseFloat(a.adv.price),
    min: parseFloat(a.adv.minSingleTransAmount),
    max: parseFloat(a.adv.dynamicMaxSingleTransAmount ?? a.adv.maxSingleTransAmount)
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const venta = parseFloat(req.query.venta) || 1000000;
  const recompra = parseFloat(req.query.recompra) || 20000;
  const metodos = {}, errores = {};

  await Promise.all(Object.entries(METODOS).flatMap(([clave, candidatos]) =>
    [['venta', venta], ['recompra', recompra]].map(async ([tipo, monto]) => {
      metodos[clave] = metodos[clave] || {};
      try {
        let top = [];
        for (const c of candidatos) { top = await buscar(c, monto); if (top.length) break; }
        metodos[clave][tipo] = { precio: top[0] ? top[0].rate : 0, top };
      } catch (e) {
        errores[`${clave}:${tipo}`] = e.message;
        metodos[clave][tipo] = { precio: 0, top: [] };
      }
    })
  ));

  return res.status(200).json({ ok: true, venta, recompra, metodos, errores });
};
