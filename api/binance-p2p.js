export default async function handler(req, res) {
    // Permitir CORS por seguridad si lo consultas desde Excel u otros lados
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Recibimos amount, bank y type por parámetros URL (Ej: ?amount=500000&bank=Banesco&type=BUY)
        const { amount, bank, type } = req.query;

        // Por defecto: BancoDeVenezuela y tipo BUY si no se especifican
        const bancoSeleccionado = bank ? bank : "BancoDeVenezuela";
        const tipoOperacion = type ? type.toUpperCase() : "BUY"; 

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
                "rows": 5,
                "tradeType": tipoOperacion, // Dinámico: BUY o SELL
                "transAmount": amount ? String(amount) : "",
                "payTypes": [bancoSeleccionado] // Dinámico: BancoDeVenezuela, Banesco, etc.
            })
        });

        if (!response.ok) throw new Error('Binance no respondió correctamente');
        const data = await response.json();

        let precioReal = 0;
        if (data && data.data && data.data.length > 0) {
            precioReal = parseFloat(data.data[0].adv.price);
        }

        return res.status(200).json({ 
            banco: bancoSeleccionado,
            tipo: tipoOperacion,
            monto: amount || "General",
            precio_binance_p2p: precioReal 
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
