const cheerio = require('cheerio');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const response = await fetch('https://t.me/s/E_positivo', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('No se pudo conectar con la vista pública de Telegram');
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        let mensajes = [];

        $('.tgme_widget_message_text').each((i, element) => {
            const texto = $(element).text().trim();
            if (texto) mensajes.push(texto);
        });

        const ultimoMensaje = mensajes.length > 0 ? mensajes[mensajes.length - 1] : "Esperando datos del canal...";

        return res.status(200).json({
            success: true,
            ultimo_mensaje_canal: ultimoMensaje,
            todos_los_mensajes: mensajes.slice(-10) // Últimos 10 mensajes por si los necesitas en tu historial
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}
