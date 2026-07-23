export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const fetchOptions = {
    method: 'GET',
    cache: 'no-store',
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  // FUENTE PRIORITARIA ACTUALIZADA SEGÚN EL INSPECTOR
  const fetchTCambio = async () => {
    const response = await fetch('https://tcambio.app/', fetchOptions);
    if (!response.ok) throw new Error('tcambio.app no disponible');
    const html = await response.text();
    
    // Selector corregido para buscar dentro del id="mount" o la etiqueta strong directa
    const match = html.match(/id=["']mount["'][\s\S]*?<strong>([\d,.]+)<\/strong>/i) || html.match(/Bs\.S\s*<strong>([\d,.]+)<\/strong>/i);
    
    if (match && match[1]) {
      return { bcv: parseFloat(match[1].trim().replace(/\./g, '').replace(',', '.')), source: 'tcambio_app' };
    }
    throw new Error('Estructura tcambio.app no encontrada');
  };

  const fetchBCV = async () => {
    const response = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', fetchOptions);
    if (!response.ok) throw new Error('BCV no disponible');
    const html = await response.text();
    const match = html.match(/class=["']strong-tb["']>([\d,.]+)</i) || html.match(/id=["']dolar["'][\s\S]*?([\d,.]+)/i);
    if (match && match[1]) {
      return { bcv: parseFloat(match[1].trim().replace(/\./g, '').replace(',', '.')), source: 'bcv_oficial' };
    }
    throw new Error('Estructura BCV no encontrada');
  };

  const fetchExchangeMonitor = async () => {
    const response = await fetch('https://p2p.exchangemonitor.net/api/v1/ve/dolar', fetchOptions);
    if (!response.ok) throw new Error('ExchangeMonitor falló');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'exchange_monitor' };
    }
    throw new Error('Datos inválidos en ExchangeMonitor');
  };

  const fetchDolarApi = async () => {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', fetchOptions);
    if (!response.ok) throw new Error('DolarApi falló');
    const data = await response.json();
    if (data && data.promedio) {
      return { bcv: parseFloat(data.promedio), source: 'dolar_api' };
    }
    throw new Error('Datos inválidos en DolarApi');
  };

  try {
    const resultados = await Promise.allSettled([
      fetchTCambio(), 
      fetchBCV(), 
      fetchExchangeMonitor(), 
      fetchDolarApi()
    ]);
    
    const exitosos = resultados.filter(r => r.status === 'fulfilled').map(r => r.value);

    if (exitosos.length === 0) {
      throw new Error('Todas las fuentes fallaron');
    }

    const mejorTasa = exitosos.find(r => r.source === 'tcambio_app') || 
                      exitosos.reduce((max, actual) => actual.bcv > max.bcv ? actual : max, exitosos[0]);

    return res.status(200).json({
      success: true,
      bcv: mejorTasa.bcv,
      source: mejorTasa.source
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
