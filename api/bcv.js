export default async function handler(req, res) {
  // Habilitar CORS para que tu GitHub Pages pueda consultar la API sin bloqueos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const response = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Error al conectar con el BCV: ${response.status}`);
    }

    const html = await response.text();

    // === AQUÍ COLOCAMOS LA OPCIÓN 1 (Expresión regular más flexible) ===
    const usdRegex = /id=["']dolar["'][\s\S]*?([\d,.]+)/i;
    const match = html.match(usdRegex);

    if (match && match[1]) {
      // Limpiamos el texto: quitamos espacios y convertimos la coma decimal de Venezuela en punto
      let tasaTexto = match[1].trim();
      let tasaLimpia = tasaTexto.replace(/\./g, '').replace(',', '.');
      const tasaNumero = parseFloat(tasaLimpia);

      if (!isNaN(tasaNumero) && tasaNumero > 0) {
        return res.status(200).json({ success: true, bcv: tasaNumero });
      }
    }

    // Si la expresión regular no encuentra nada, lanzamos un error para ir al bloque catch
    throw new Error("No se pudo extraer el valor numérico con la nueva expresión regular.");

  } catch (error) {
    console.error("Error en API BCV:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: "Error al obtener la tasa oficial",
      details: error.message 
    });
  }
}
