export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Definimos las 4 funciones de obtención de datos
  const fetchBCV = async () => {
    const response = await fetch('https://www.bcv.org.ve/glosario/cambio-oficial', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!response.ok) throw new Error('BCV no disponible');
    const html = await response.text();
    const match = html.match(/id=["']dolar["'][\s\S]*?([\d,.]+)/i);
    if (match && match[1]) {
      return { bcv: parseFloat(match[1].trim().replace(/\./g, '').replace(',', '.')), source: 'bcv_oficial' };
    }
    throw new Error('HTML BCV inválido');
  };

  const fetchExchangeMonitor = async () => {
    const response = await fetch('https://p2p.exchangemonitor.net/api/v1/ve/dolar');
    if (!response.ok) throw new Error('ExchangeMonitor no disponible');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'exchange_monitor' };
    }
    throw new Error('Datos ExchangeMonitor inválidos');
  };

  const fetchMonitorVenezuela = async () => {
    const response = await fetch('https://api.monitordolarvenezuela.com/bcv');
    if (!response.ok) throw new Error('Monitor Venezuela no disponible');
    const data = await response.json();
    if (data && data.bcv && data.bcv.precio) {
      return { bcv: parseFloat(data.bcv.precio), source: 'monitor_venezuela' };
    }
    throw new Error('Datos Monitor Venezuela inválidos');
  };

  const fetchDolarApi = async () => {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!response.ok) throw new Error('DolarApi no disponible');
    const data = await response.json();
    if (data && data.promedio) {
      return { bcv: parseFloat(data.promedio), source: 'dolar_api' };
    }
    throw new Error('Datos DolarApi inválidos');
  };

  try {
    // Promise.allSettled lanza las 4 consultas estrictamente al mismo tiempo
    const resultados = await Promise.allSettled([
      fetchBCV(),
      fetchExchangeMonitor(),
      fetchMonitorVenezuela(),
      fetchDolarApi()
    ]);

    // Filtramos solo las respuestas que tuvieron éxito
    const exitosos = resultados
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (exitosos.length === 0) {
      throw new Error('Ninguna de las 4 fuentes respondió con éxito');
    }

    // Buscamos la tasa más alta reportada entre las que respondieron en paralelo
    // Esto asegura que si una fuente ya se actualizó a la tasa nueva y otra sigue en la vieja, gane la nueva.
    const mejorTasa = exitosos.reduce((max, actual) => actual.bcv > max.bcv ? actual : max, exitosos[0]);

    return res.status(200).json({
      success: true,
      bcv: mejorTasa.bcv,
      source: mejorTasa.source,
      competidores_activos: exitosos.length
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
