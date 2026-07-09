export default async function handler(req, res) {
  // Destruir la caché a nivel de navegador y CDN de Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Opciones de fetch para forzar datos frescos en el servidor
  const fetchOptions = {
    method: 'GET',
    cache: 'no-store', // Rompe la caché nativa de la API fetch
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    next: { revalidate: 0 } // Desactiva la caché si Vercel usa Next.js internamente
  };

  const fetchBCV = async () => {
    const response = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', fetchOptions);
    if (!response.ok) throw new Error('BCV no disponible');
    const html = await response.text();
    const match = html.match(/id=["']dolar["'][\s\S]*?([\d,.]+)/i);
    if (match && match[1]) {
      return { bcv: parseFloat(match[1].trim().replace(/\./g, '').replace(',', '.')), source: 'bcv_oficial' };
    }
    throw new Error('HTML BCV inválido');
  };

  const fetchExchangeMonitor = async () => {
    const response = await fetch('https://p2p.exchangemonitor.net/api/v1/ve/dolar', fetchOptions);
    if (!response.ok) throw new Error('ExchangeMonitor no disponible');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'exchange_monitor' };
    }
    throw new Error('Datos ExchangeMonitor inválidos');
  };

  const fetchMonitorVenezuela = async () => {
    const response = await fetch('https://api.monitordolarvenezuela.com/bcv', fetchOptions);
    if (!response.ok) throw new Error('Monitor Venezuela no disponible');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'monitor_venezuela' };
    }
    throw new Error('Datos Monitor Venezuela inválidos');
  };

  const fetchDolarApi = async () => {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', fetchOptions);
    if (!response.ok) throw new Error('DolarApi no disponible');
    const data = await response.json();
    if (data && data.promedio) {
      return { bcv: parseFloat(data.promedio), source: 'dolar_api' };
    }
    throw new Error('Datos DolarApi inválidos');
  };

  try {
    // Ejecución simultánea en paralelo
    const resultados = await Promise.allSettled([
      fetchBCV(),
      fetchExchangeMonitor(),
      fetchMonitorVenezuela(),
      fetchDolarApi()
    ]);

    const exitosos = resultados
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (exitosos.length === 0) {
      throw new Error('Todas las fuentes fallaron o devolvieron datos vacíos');
    }

    // Buscamos la tasa más alta registrada en tiempo real para evitar quedarnos con datos viejos
    const mejorTasa = exitosos.reduce((max, actual) => actual.bcv > max.bcv ? actual : max, exitosos[0]);

    return res.status(200).json({
      success: true,
      bcv: mejorTasa.bcv,
      source: mejorTasa.source,
      fresco: true
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
