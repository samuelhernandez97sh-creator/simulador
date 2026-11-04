// api/canal.js — lee los últimos mensajes de un canal PÚBLICO de Telegram (vista web t.me/s/<canal>)
// Uso: /api/canal            (canal E_positivo por defecto)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const canal = String(req.query.canal || 'E_positivo').replace(/[^A-Za-z0-9_]/g, '');
  const decodificar = (t) => t
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&([aeiouAEIOU])acute;/g, (_, v) => ({a:'á',e:'é',i:'í',o:'ó',u:'ú',A:'Á',E:'É',I:'Í',O:'Ó',U:'Ú'})[v])
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

  try {
    const r = await fetch(`https://t.me/s/${canal}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('Telegram HTTP ' + r.status);
    const html = await r.text();

    const mensajes = html.split('tgme_widget_message_wrap').slice(1).map(b => {
      const id = parseInt((b.match(/data-post="[^"\/]+\/(\d+)"/) || [])[1], 10);
      const t = b.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (!id || !t) return null; // encuestas, fotos sin texto, etc.
      const texto = decodificar(t[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
      const fecha = (b.match(/<time[^>]*datetime="([^"]+)"/) || [])[1] || null;
      return texto ? { id, texto, fecha } : null;
    }).filter(Boolean).slice(-15);

    if (!mensajes.length) {
      return res.status(200).json({ ok: false, mensajes: [], error: 'No se pudieron leer mensajes (¿canal sin vista pública?)' });
    }
    return res.status(200).json({ ok: true, canal, mensajes });
  } catch (e) {
    return res.status(500).json({ ok: false, mensajes: [], error: e.message });
  }
};
