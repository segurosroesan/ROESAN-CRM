require('dotenv').config();
process.env.SOFT_SEGUROS_USERNAME = process.env.SOFT_SEGUROS_USERNAME || 'carmene.estrada';
process.env.SOFT_SEGUROS_PASSWORD = process.env.SOFT_SEGUROS_PASSWORD || '670618';
const { SoftSegurosApi } = require('./apps/backend/dist/lib/soft-seguros-api');

async function testImport() {
  const url = process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com';
  const user = process.env.SOFT_SEGUROS_USERNAME;
  const pass = process.env.SOFT_SEGUROS_PASSWORD;
  const api = new SoftSegurosApi(url, user, pass);
  const allPolizas = [];
  let page = 1;
  let hasMore = true;
  
  console.log('Fetching polizas...');
  
  // We'll just fetch a few pages to see what the data looks like
  while (hasMore && page <= 100) {
    try {
      const response = await api.request('GET', '/api/poliza/', undefined, {
        order_by: 'id',
        sort_by: 'desc', // order desc to see latest
        page,
        page_size: 100,
      });

      const items = response.results || response;
      if (Array.isArray(items)) {
        allPolizas.push(...items);
        console.log(`Page ${page}: got ${items.length} items`);
      } else {
        console.log(`Page ${page}: response is not an array`, items);
      }

      hasMore = !!response.next;
      page++;
    } catch (err) {
      console.error('Error fetching page', page, err.message);
      break;
    }
  }

  console.log(`Fetched ${allPolizas.length} total polizas so far.`);
  if (allPolizas.length === 0) return;

  // Let's inspect the first 5
  console.log('Sample polizas:');
  for (let i = 0; i < Math.min(5, allPolizas.length); i++) {
    const p = allPolizas[i];
    console.log(`- ID: ${p.id}, Fecha Fin: ${p.fecha_fin}, Renovable: ${p.renovable}, Estado:`, p.estado_poliza);
  }

  // Now apply filter logic
  const diasRango = 60;
  const hoy = new Date();
  const limiteFecha = new Date();
  limiteFecha.setDate(limiteFecha.getDate() + diasRango);

  const polizasAVencer = allPolizas.filter((poliza) => {
    const fechaFin = poliza.fecha_fin ? new Date(poliza.fecha_fin) : null;
    if (!fechaFin) return false;

    const esVigente = poliza.estado_poliza?.codigo_generico === '01' || poliza.estado_poliza === 'Vigente' || poliza.estado_poliza === 45909;
    const esRenovable = poliza.renovable === true;
    const dentroDelRango = fechaFin >= hoy && fechaFin <= limiteFecha;

    return esVigente && esRenovable && dentroDelRango;
  });

  console.log(`\nFiltered polizas a vencer (next 60 days, vigente, renovable): ${polizasAVencer.length}`);
  
  // Let's see what failed the filter
  let failedRango = 0;
  let failedVigente = 0;
  let failedRenovable = 0;
  let missingFecha = 0;
  
  for (const poliza of allPolizas) {
    const fechaFin = poliza.fecha_fin ? new Date(poliza.fecha_fin) : null;
    if (!fechaFin) {
      missingFecha++;
      continue;
    }
    
    const esVigente = poliza.estado_poliza?.codigo_generico === '01' || poliza.estado_poliza === 'Vigente' || poliza.estado_poliza === 45909;
    const esRenovable = poliza.renovable === true;
    const dentroDelRango = fechaFin >= hoy && fechaFin <= limiteFecha;
    
    if (!dentroDelRango) failedRango++;
    if (!esVigente) failedVigente++;
    if (!esRenovable) failedRenovable++;
  }
  
  console.log(`Filter stats:`);
  console.log(`- Missing fecha_fin: ${missingFecha}`);
  console.log(`- Failed rango (not between now and +60 days): ${failedRango}`);
  console.log(`- Failed vigente (not 01, Vigente, or 45909): ${failedVigente}`);
  console.log(`- Failed renovable (renovable != true): ${failedRenovable}`);

  // Let's print out some policies that are expiring soon to see their status and renovable flags
  console.log(`\nPolicies expiring in next 60 days (regardless of other flags):`);
  const upcoming = allPolizas.filter((poliza) => {
    const fechaFin = poliza.fecha_fin ? new Date(poliza.fecha_fin) : null;
    return fechaFin && fechaFin >= hoy && fechaFin <= limiteFecha;
  });
  
  for (const p of upcoming.slice(0, 5)) {
    console.log(`- ID: ${p.id}, Fecha Fin: ${p.fecha_fin}, Renovable: ${p.renovable}, Estado:`, p.estado_poliza);
  }
}

testImport();
