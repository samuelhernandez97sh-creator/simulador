export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // URL principal (Página Oficial del BCV)
  const PRIMARY_URL = 'https://www.bcv.org.ve/glosario/cambio-oficial';
  // URL de contingencia (API pública externa que procesa la tasa oficial)
  const FALLBACK_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

  try {
    console.log("Intentando consultar fuente oficial BCV...");
    const response = await fetch(PRIMARY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error('El servidor oficial del BCV rechazó la conexión');
    
    const html = await response.text();
    const usdRegex = /id=["']dolar["'][\s\S]*?([\d,.]+)/i;
    const match = html.match(usdRegex);

    if (match && match[1]) {
      let tasaLimpia = match[1].trim().replace(/\./g, '').replace(',', '.');
      console.log("Tasa obtenida con éxito de la página oficial.");
      return res.status(200).json({ success: true, bcv: parseFloat(tasaLimpia) });
    }
    
    throw new Error('Estructura HTML modificada en el sitio oficial');

  } catch (primaryError) {
    console.warn(`Fuente oficial falló (${primaryError.message}). Activando plan de contingencia...`);

    // === PLAN DE CONTINGENCIA: Consumir la API espejo ===
    try {
      const fallbackResponse = await fetch(FALLBACK_URL);
      if (!fallbackResponse.ok) throw new Error('La API de contingencia tampoco respondió');
      
      const data = await fallbackResponse.json();
      
      // DolarApi devuelve la tasa en el campo "promedio"
      if (data && data.promedio) {
        console.log(`Tasa recuperada con éxito desde el Fallback: ${data.promedio}`);
        return res.status(200).json({ 
          success: true, 
          bcv: parseFloat(data.promedio),
          source: 'fallback' 
        });
      } else {
        throw new Error('Formato inesperado en la API de contingencia');
      }

    } catch (fallbackError) {
      console.error("Ambas fuentes de datos han fallado.");
      return res.status(500).json({ 
        success: false, 
        error: 'Error crítico: No se pudo obtener la tasa de ninguna fuente',
        details: fallbackError.message 
      });
    }
  }
}
