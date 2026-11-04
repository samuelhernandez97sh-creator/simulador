// api/send-telegram.js — el token vive en Vercel (Environment Variables), NO en el HTML
// Variables necesarias: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = process.env.TELEGRAM_BOT_TOKEN; 8946597702:AAFQs-oWSXOyEMqZoc7c2hkO7SpIvaVBp-g
  const chat_id = process.env.TELEGRAM_CHAT_ID; @Alertas_bcv_bot
  if (!token || !chat_id) return res.status(500).json({ ok: false, error: 'Faltan variables de entorno' });

  const text = (req.body && req.body.text) || '';
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text })
  });
  return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
