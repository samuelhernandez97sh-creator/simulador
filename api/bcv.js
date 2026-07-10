export default async function handler(req, res) {
  // 1. Destrucción absoluta de caché para obligar a Vercel a pedir datos en vivo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const fetchOptions = {
    method: 'GET',
    cache: 'no-store',
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    next: { revalidate: 0 }
  };

  // --- DEFINICIÓN DE LAS FUENTES ---

  // Fuente 1: BCV Oficial vía Scraping con la nueva clase "strong-tb"
  const fetchBCV = async () => {
    const response = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', fetchOptions);
    if (!response.ok) throw new Error('BCV bloqueado o caído');
    const html = await response.text();
    const match = html.match(/class=["']strong-tb["']>([\d,.]+)</i) || html.match(/id=["']dolar["'][\s\S]*?([\d,.]+)/i);
    if (match && match[1]) {
      return { bcv: parseFloat(match[1].trim().replace(/\./g, '').replace(',', '.')), source: 'bcv_oficial' };
    }
    throw new Error('Estructura HTML de BCV no reconocible');
  };

  // Fuente 2: ExchangeMonitor (Cazando el JSON nativo)
  const fetchExchangeMonitor = async () => {
    const response = await fetch('https://p2p.exchangemonitor.net/api/v1/ve/dolar', fetchOptions);
    if (!response.ok) throw new Error('ExchangeMonitor no disponible');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'exchange_monitor' };
    }
    throw new Error('Formato ExchangeMonitor inválido');
  };

  // Fuente 3: Monitor Venezuela (Usando su endpoint público de tasas)
  const fetchMonitorVenezuela = async () => {
    const response = await fetch('https://api.monitordolarvenezuela.com/bcv', fetchOptions);
    if (!response.ok) throw new Error('Monitor Venezuela no disponible');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'monitor_venezuela' };
    }
    throw new Error('Formato Monitor Venezuela inválido');
  };

  // Fuente 4: DolarApi (Tu salvavidas final)
  const fetchDolarApi = async () => {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', fetchOptions);
    if (!response.ok) throw new Error('DolarApi no disponible');
    const data = await response.json();
    if (data && data.promedio) {
      return { bcv: parseFloat(data.promedio), source: 'dolar_api' };
    }
    throw new Error('Formato DolarApi inválido');
  };

  try {
    // 2. PROMISE RACE / ALLSETTLED: Ejecuta las 4 peticiones estrictamente al mismo tiempo
    const resultados = await Promise.allSettled([
      fetchBCV(),
      fetchExchangeMonitor(),
      fetchMonitorVenezuela(),
      fetchDolarApi()
    ]);

    // Extraemos los éxitos
    const exitosos = resultados
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (exitosos.length === 0) {
      throw new Error('Todas las fuentes fallaron simultáneamente');
    }

    // 3. ESTRATEGIA DE ACTUALIZACIÓN: Nos quedamos con la tasa del BCV más alta reportada en tiempo real.
    // Como las páginas se actualizan de menor a mayor en los saltos de tasa, el valor más alto es siempre el más reciente.
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
