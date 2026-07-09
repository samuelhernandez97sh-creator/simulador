module.exports = async (req, res) => {
    // Habilitar CORS para conectar con tu GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Capturamos el monto exacto (Costo Banco + Colchón) enviado desde el simulador
        const { amount } = req.query;

        // Consulta directa a Binance P2P con tus parámetros blindados
        const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                "asset": "USDT",
                "fiat": "VES",
                "merchantCheck": false,
                "page": 1,
                "rows": 5,
                "tradeType": "SELL",
                "transAmount": amount ? String(amount) : "", // Tu filtro dinámico diario automatizado
                "payTypes": ["BancoDeVenezuela"]              // Filtro fijo: Solo Banco de Venezuela
            })
        });

        if (!response.ok) throw new Error('Binance no respondió');
        const data = await response.json();
        
        let precioReal = 0;
        if (data.data && data.data.length > 0) {
            // Extrae el precio del primer competidor real bajo tus filtros
            precioReal = parseFloat(data.data[0].adv.price);
        }

        return res.status(200).json({ precio_binance_p2p: precioReal });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
