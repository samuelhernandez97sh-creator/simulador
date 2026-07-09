export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    // Consulta directa a la sección oficial que tienes abierta en tu navegador
    const response = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error('El BCV no respondió');
    const html = await response.text();

    // Localiza el contenedor específico del USD y extrae los números
    const usdRegex = /id=["']dolar["'][\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/i;
    const match = html.match(usdRegex);

    if (match && match[1]) {
      // Quitamos puntos de miles y pasamos la coma decimal a punto para JavaScript
      const tasaLimpia = match[1].trim().replace(/\./g, '').replace(',', '.');
      
      return res.status(200).json({
        success: true,
        bcv: parseFloat(tasaLimpia)
      });
    } else {
      return res.status(500).json({ success: false, error: 'No se encontró la tasa' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
