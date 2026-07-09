export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const response = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error('El BCV no respondió');
    const html = await response.text();

    // Opción 1 limpia: Busca el contenedor 'dolar' y extrae el primer número decimal largo cercano
    const usdRegex = /id=["']dolar["'][\s\S]*?([\d,.]+)/i;
    const match = html.match(usdRegex);

    if (match && match[1]) {
      let tasaLimpia = match[1].trim().replace(/\./g, '').replace(',', '.');
      
      return res.status(200).json({
        success: true,
        bcv: parseFloat(tasaLimpia)
      });
    } else {
      return res.status(500).json({ success: false, error: 'No se encontró la tasa en el HTML' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
