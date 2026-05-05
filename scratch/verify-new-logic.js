require('dotenv').config();
const { SoftSegurosApi } = require('../apps/backend/dist/lib/soft-seguros-api');

async function testNewImportLogic() {
  const url = process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com';
  const user = process.env.SOFT_SEGUROS_USERNAME;
  const pass = process.env.SOFT_SEGUROS_PASSWORD;
  const api = new SoftSegurosApi(url, user, pass);

  console.log('Testing NEW import logic (Vigente filter + all pages)...');
  
  const inicioJunio = new Date(2026, 5, 1);
  const finJunio = new Date(2026, 6, 0, 23, 59, 59, 999);
  console.log(`Target: June 2026 (${inicioJunio.toLocaleDateString()} - ${finJunio.toLocaleDateString()})`);

  let page = 1;
  let hasMore = true;
  const allPolizas = [];

  while (hasMore && page <= 200) { // Fetch up to 200 pages for the test
    process.stdout.write(`Fetching page ${page}... `);
    try {
      const response = await api.request('GET', '/api/poliza/', undefined, {
        order_by: 'id',
        sort_by: 'desc',
        estado_poliza: 45909,
        page,
        page_size: 100,
      });

      const items = response.results || (Array.isArray(response) ? response : []);
      allPolizas.push(...items);
      console.log(`got ${items.length} items. Total: ${allPolizas.length}`);

      hasMore = !!response.next;
      page++;
    } catch (err) {
      console.log('Error:', err.message);
      break;
    }
  }

  console.log('\nProcessing results...');
  const inJune = allPolizas.filter(p => {
    const f = p.fecha_fin ? new Date(p.fecha_fin) : null;
    return f && f >= inicioJunio && f <= finJunio;
  });

  const matching = inJune.filter(p => p.renovable === true || p.renovable === 1);

  console.log(`- Total Vigentes fetched: ${allPolizas.length}`);
  console.log(`- Expiring in June: ${inJune.length}`);
  console.log(`- Expiring in June AND Renovable: ${matching.length}`);

  if (matching.length > 0) {
    console.log('\nSample matching policies:');
    matching.slice(0, 5).forEach(p => {
      console.log(`- ID: ${p.id}, Numero: ${p.numero_poliza}, Fecha Fin: ${p.fecha_fin}, Cliente: ${p.nombre_tomador}`);
    });
  } else {
    console.log('\nWARNING: Still found 0 matching records for June.');
    console.log('Let\'s check why June policies were skipped:');
    const nonRenovableJune = inJune.filter(p => !(p.renovable === true || p.renovable === 1));
    console.log(`- June policies skipped because renovable=false: ${nonRenovableJune.length}`);
  }
}

testNewImportLogic();
