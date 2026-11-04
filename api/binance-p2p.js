// api/binance-p2p.js — Precio P2P: VENDER USDT por VES (Banco de Venezuela)
// Uso: /api/binance-p2p?amount=5000000          (monto en Bs)
//      /api/binance-p2p?amount=5000000&pay=Banesco   (otro método de pago)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const amount = parseFloat(req.query.amount);
  const pay = req.query.pay || 'BancoDeVenezuela';

  const buscar = async (payTypes) => {
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
        fiat: 'VES',
        asset: 'USDT',
        tradeType: 'SELL',           // tú vendes USDT -> anuncios de compradores
        page: 1,
        rows: 10,
        payTypes,
        countries: [],
        publisherType: null,
        merchantCheck: false,
        proMerchantAds: false,
        shieldMerchantAds: false,
        filterType: 'all',
        classifies: ['mass', 'profession', 'fiat_trade'],
        transAmount: amount > 0 ? String(Math.round(amount)) : ''
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('Binance HTTP ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j.data)) throw new Error('Respuesta inesperada de Binance: ' + (j.message || j.code || ''));
    return j.data;
  };

  try {
    let anuncios = await buscar([pay]);
    let filtro = pay;

    // Si no hay anuncios con ese banco/monto, lo informamos (y damos referencia general)
    let referenciaGeneral = null;
    if (!anuncios.length) {
      const general = await buscar([]);
      if (general.length) referenciaGeneral = parseFloat(general[0].adv.price);
    }

    // Solo anuncios cuyo rango acepte el monto
    const aptos = anuncios.filter(a => {
      if (!(amount > 0)) return true;
      const min = parseFloat(a.adv.minSingleTransAmount);
      const max = parseFloat(a.adv.dynamicMaxSingleTransAmount ?? a.adv.maxSingleTransAmount);
      return amount >= min && amount <= max;
    });

    const lista = (aptos.length ? aptos : anuncios).slice(0, 5).map(a => ({
      precio: parseFloat(a.adv.price),
      min: parseFloat(a.adv.minSingleTransAmount),
      max: parseFloat(a.adv.dynamicMaxSingleTransAmount ?? a.adv.maxSingleTransAmount),
      vendedor: a.advertiser && a.advertiser.nickName
    }));

    if (!lista.length) {
      return res.status(200).json({
        precio_binance_p2p: 0,
        error: `Sin anuncios para ${filtro} con monto ${amount || 'cualquiera'} Bs`,
        referencia_sin_filtro: referenciaGeneral
      });
    }

    return res.status(200).json({
      precio_binance_p2p: lista[0].precio,
      monto_filtrado_bs: amount || null,
      metodo_pago: filtro,
      top: lista
    });
  } catch (error) {
    return res.status(500).json({ precio_binance_p2p: 0, error: error.message });
  }
};
