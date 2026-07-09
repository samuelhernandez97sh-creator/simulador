export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // --- CONFIGURACIÓN DE LAS 4 OPCIONES EN CADENA ---
  const BCV_URL = 'https://www.bcv.org.ve/glosario/cambio-oficial';
  const EXCHANGE_MONITOR_API = 'https://p2p.exchangemonitor.net/api/v1/ve/dolar';
  const MONITOR_VENEZUELA_API = 'https://api.monitorvenezuela.com/v1/tasas'; // Reemplazar si tienes su endpoint exacto, o usamos su API pública estándar
  const DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

  // ========================================================
  // OPCIÓN 1: Página Oficial del BCV
  // ========================================================
  try {
    console.log("Intentando Opción 1: BCV Oficial...");
    const response = await fetch(BCV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!response.ok) throw new Error('Bloqueo o caída en BCV');
    
    const html = await response.text();
    const usdRegex = /id=["']dolar["'][\s\S]*?([\d,.]+)/i;
    const match = html.match(usdRegex);

    if (match && match[1]) {
      let tasa = parseFloat(match[1].trim().replace(/\./g, '').replace(',', '.'));
      return res.status(200).json({ success: true, bcv: tasa, source: '1_bcv_oficial' });
    }
    throw new Error('HTML del BCV cambió');

  } catch (error1) {
    console.warn(`Opción 1 falló. Saltando a Opción 2 (ExchangeMonitor)...`);

    // ========================================================
    // OPCIÓN 2: ExchangeMonitor
    // ========================================================
    try {
      const response2 = await fetch(EXCHANGE_MONITOR_API);
      if (!response2.ok) throw new Error('ExchangeMonitor no disponible');
      const data2 = await response2.json();
      
      // Buscamos específicamente el objeto del BCV dentro de ExchangeMonitor
      if (data2 && data2.bcv && data2.bcv.precio) {
        return res.status(200).json({ success: true, bcv: parseFloat(data2.bcv.precio), source: '2_exchange_monitor' });
      }
      throw new Error('Estructura inesperada en ExchangeMonitor');

    } catch (error2) {
      console.warn(`Opción 2 falló. Saltando a Opción 3 (Monitor Venezuela)...`);

      // ========================================================
      // OPCIÓN 3: Monitor Venezuela
      // ========================================================
      try {
        // Consultamos la API optimizada de Monitor Venezuela para desarrolladores
        const response3 = await fetch('https://api.monitordolarvenezuela.com/bcv'); 
        if (!response3.ok) throw new Error('Monitor Venezuela no disponible');
        const data3 = await response3.json();

        if (data3 && data3.bcv && data3.bcv.precio) {
          return res.status(200).json({ success: true, bcv: parseFloat(data3.bcv.precio), source: '3_monitor_venezuela' });
        }
        throw new Error('Estructura inesperada en Monitor Venezuela');

      } catch (error3) {
        console.warn(`Opción 3 falló. Saltando a Opción 4 de Respaldo Absoluto (DolarApi)...`);

        // ========================================================
        // OPCIÓN 4: DolarApi (Salvavidas definitivo)
        // ========================================================
        try {
          const response4 = await fetch(DOLAR_API_URL);
          if (!response4.ok) throw new Error('DolarApi no disponible');
          const data4 = await response4.json();
          
          if (data4 && data4.promedio) {
            return res.status(200).json({ success: true, bcv: parseFloat(data4.promedio), source: '4_dolar_api' });
          }
          throw new Error('Estructura inesperada en DolarApi');

        } catch (error4) {
          // Si las 4 opciones fallan simultáneamente
          return res.status(500).json({ 
            success: false, 
            error: 'Fallo general: Ninguna de las 4 opciones respondió.',
            details: error4.message 
          });
        }
      }
    }
  }
}
