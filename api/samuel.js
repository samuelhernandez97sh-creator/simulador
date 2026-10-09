module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { amount, bank, type } = req.query;

        const bancoSeleccionado = bank ? bank : "BancoDeVenezuela";
        const tipoOperacion = type ? type.toUpperCase() : "SELL"; 
        const montoFiltro = amount ? String(amount) : "";

        const response = await fetch('https://p2p.binance.com/bapi/c2c/v1/friendly/c2c/adv/search', {
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
                "rows": 10,
                "tradeType": tipoOperacion,
                "transAmount": montoFiltro,
                "payTypes": [bancoSeleccionado]
            })
        });

        // Si Binance responde con error, evitamos el crash y devolvemos un respaldo
        if (!response.ok) {
            return res.status(200).json({ precio_binance_p2p: 0 });
        }

        const data = await response.json();

        let precioReal = 0;
        if (data && data.data && data.data.length > 0) {
            // Si se envió un monto, intentamos buscar un anuncio cuyo rango de límites lo incluya
            const montoNum = parseFloat(amount) || 0;
            let encontrado = false;

            if (montoNum > 0) {
                for (let item of data.data) {
                    const minSingleTrans = parseFloat(item.adv.minSingleTransAmount) || 0;
                    const maxSingleTrans = parseFloat(item.adv.maxSingleTransAmount) || 0;
                    if (montoNum >= minSingleTrans && montoNum <= maxSingleTrans) {
                        precioReal = parseFloat(item.adv.price);
                        encontrado = true;
                        break;
                    }
                }
            }

            // Si no encontró por rango estricto o no venía monto, toma el primer precio disponible
            if (!encontrado) {
                precioReal = parseFloat(data.data[0].adv.price);
            }
        }

        return res.status(200).json({ precio_binance_p2p: precioReal });

    } catch (error) {
        // En caso de cualquier fallo de red o parseo, devolvemos 0 asegurando estado 200 para Excel
        return res.status(200).json({ precio_binance_p2p: 0 });
    }
};
