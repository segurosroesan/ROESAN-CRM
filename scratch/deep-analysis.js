require('dotenv').config();
const { SoftSegurosApi } = require('../apps/backend/dist/lib/soft-seguros-api');

async function analyzeSoftSegurosData() {
  const url = process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com';
  const user = process.env.SOFT_SEGUROS_USERNAME;
  const pass = process.env.SOFT_SEGUROS_PASSWORD;
  const api = new SoftSegurosApi(url, user, pass);

  console.log('Analyzing ALL active policies in Soft Seguros...');
  
  let page = 1;
  let hasMore = true;
  const stats = {};
  const juneDetails = [];

  while (hasMore && page <= 300) { // Analysis of first 3000 active policies
    process.stdout.write(`Page ${page}... `);
    try {
      const response = await api.request('GET', '/api/poliza/', undefined, {
        estado_poliza: 45909,
        page,
        page_size: 100,
      });

      const items = response.results || (Array.isArray(response) ? response : []);
      items.forEach(p => {
        if (!p.fecha_fin) return;
        const date = new Date(p.fecha_fin);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!stats[monthYear]) stats[monthYear] = { total: 0, renovable: 0, noRenovable: 0 };
        stats[monthYear].total++;
        if (p.renovable === true || p.renovable === 1) stats[monthYear].renovable++;
        else stats[monthYear].noRenovable++;

        if (monthYear === '2026-06') {
          juneDetails.push({ id: p.id, renovable: p.renovable, fecha: p.fecha_fin });
        }
      });

      hasMore = !!response.next;
      page++;
      if (page % 10 === 0) console.log(`Processed ${page * 10} items...`);
    } catch (err) {
      console.log('\nError:', err.message);
      break;
    }
  }

  console.log('\n\n--- STATISTICS BY MONTH ---');
  Object.keys(stats).sort().forEach(my => {
    const s = stats[my];
    console.log(`${my}: Total: ${s.total}, Renovable: ${s.renovable}, No-Renovable: ${s.noRenovable}`);
  });

  if (juneDetails.length > 0) {
    console.log('\n--- JUNE 2026 SAMPLES ---');
    juneDetails.slice(0, 10).forEach(d => console.log(d));
  } else {
    console.log('\nWARNING: No policies found expiring in June 2026 in the analyzed sample.');
  }
}

analyzeSoftSegurosData();
