// api/binance-p2p.js
// /api/binance-p2p?amount=450000                -> VENDER USDT (tradeType=SELL) con Banco de Venezuela
// /api/binance-p2p?amount=450000&type=BUY       -> COMPRAR USDT
// /api/binance-p2p?amount=450000&pay=Banesco    -> otro método de pago
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const amount = parseFloat(req.query.amount);
  const pay = req.query.pay || 'BancoDeVenezuela';
  const type = String(req.query.type || 'SELL').toUpperCase() === 'BUY' ? 'BUY' : 'SELL';

  try {
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
        fiat: 'VES', asset: 'USDT', tradeType: type,
        page: 1, rows: 20,
        payTypes: [pay], countries: [], publisherType: null,
        merchantCheck: false, proMerchantAds: false, shieldMerchantAds: false,
        filterType: 'all',
        transAmount: amount > 0 ? String(Math.round(amount)) : ''
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('Binance HTTP ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j.data)) throw new Error('Respuesta inesperada de Binance');

    let ads = j.data;

    // Solo anuncios que realmente aceptan el método de pago pedido (si hay datos para verificarlo)
    const conMetodo = ads.filter(a => (a.adv.tradeMethods || []).some(m => m.identifier === pay));
    if (conMetodo.length) ads = conMetodo;

    // Solo anuncios cuyo rango acepte el monto
    if (amount > 0) {
      ads = ads.filter(a => {
        const min = parseFloat(a.adv.minSingleTransAmount);
        const max = parseFloat(a.adv.dynamicMaxSingleTransAmount ?? a.adv.maxSingleTransAmount);
        return amount >= min && amount <= max;
      });
    }

    // Mejor precio primero (SELL: el más alto; BUY: el más bajo). Evita que un anuncio "promocionado" tape al resto.
    ads.sort((a, b) => type === 'SELL'
      ? parseFloat(b.adv.price) - parseFloat(a.adv.price)
      : parseFloat(a.adv.price) - parseFloat(b.adv.price));

    const top = ads.slice(0, 5).map(a => ({
      name: (a.advertiser && a.advertiser.nickName) || '—',
      rate: parseFloat(a.adv.price),
      min: parseFloat(a.adv.minSingleTransAmount),
      max: parseFloat(a.adv.dynamicMaxSingleTransAmount ?? a.adv.maxSingleTransAmount)
    }));

    if (!top.length) {
      return res.status(200).json({ precio_binance_p2p: 0, top: [], error: `Sin anuncios ${type} para ${pay} con ${amount || 'cualquier'} Bs` });
    }
    return res.status(200).json({ precio_binance_p2p: top[0].rate, tipo: type, metodo_pago: pay, monto_bs: amount || null, top });
  } catch (e) {
    return res.status(500).json({ precio_binance_p2p: 0, top: [], error: e.message });
  }
};
