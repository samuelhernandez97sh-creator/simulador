module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Recogemos los parámetros de la URL
        const { amount, bank, type } = req.query;

        // Valores por defecto seguros
        const bancoSeleccionado = bank ? bank : "BancoDeVenezuela";
        const tipoOperacion = type ? type.toUpperCase() : "SELL"; 
        const montoFiltro = amount ? String(amount) : "";

        const response = await fetch('https://p2p.binance.com/bapi/c2c/v1/friendly/c2c/adv/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://p2p.binance.com',
                'Referer': 'https://p2p.binance.com/'
            },
            body: JSON.stringify({
                "asset": "USDT",
                "fiat": "VES",
                "merchantCheck": false,
                "page": 1,
                "rows": 10,
                "tradeType": tipoOperacion,
                "transAmount": montoFiltro, // Filtro exacto de monto en la API de Binance P2P
                "payTypes": [bancoSeleccionado]
            })
        });

        if (!response.ok) throw new Error('Binance no respondió correctamente');
        
        const data = await response.json();

        let precioReal = 0;
        if (data && data.data && data.data.length > 0) {
            // Buscamos el primer anuncio que realmente cumpla con el rango del monto si Binance lo devuelve
            precioReal = parseFloat(data.data[0].adv.price);
        }

        return res.status(200).json({ 
            banco: bancoSeleccionado,
            tipo: tipoOperacion,
            monto_solicitado: montoFiltro,
            precio_binance_p2p: precioReal 
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
