const axios = require('axios');
const fs = require('fs');
const path = require('path');

// From our working example we know:
// ramo 896927 = { nombre: 'Autos', aseguradora: 136211 (ALLIANZ), ramo_marca: 90828, ramo_global: 11 }
// ramo_marca 90828 = AUTOS/VEHÍCULOS global
// The real "ramo" IDs for the API are in the 800000-900000+ range.
// We need to find the ramo_marca -> [ramo_id] mapping for each aseguradora.

// Strategy: Scan a wide range of IDs around 896927 to find all valid ramos.
// We already know 896927 works. Let's scan 895000-900000 + 800000-900000 in chunks.

async function scanRamoIds() {
  const url = process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com';
  const user = process.env.SOFT_SEGUROS_USERNAME;
  const pass = process.env.SOFT_SEGUROS_PASSWORD;
  if (!user || !pass) { console.error('Error: SOFT_SEGUROS_USERNAME y SOFT_SEGUROS_PASSWORD son requeridos'); process.exit(1); }
  
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    const found = [];
    
    // We know 896927 works. Let's scan nearby IDs first, then expand range.
    // Batches to scan (from, to, step)
    const ranges = [
      [896800, 897200, 1],  // Tight range around known good
      [895000, 896800, 5],  // Broader nearby
      [897200, 899000, 5],  // Broader nearby
    ];
    
    console.log('Scanning ramo IDs...');
    
    for (const [from, to, step] of ranges) {
      for (let id = from; id <= to; id += step) {
        try {
          const r = await axios.get(url + `/api/ramo/${id}/`, { headers, timeout: 3000 });
          if (r.status === 200 && r.data && r.data.id) {
            found.push({
              id: r.data.id,
              nombre: r.data.nombre,
              aseguradora_id: r.data.aseguradora,
              aseguradora_nombre: r.data.aseguradora_nombre,
              ramo_marca: r.data.ramo_marca,
              ramo_global: r.data.ramo_global,
            });
            console.log(`✅ FOUND: ID=${r.data.id} | ${r.data.nombre} | ${r.data.aseguradora_nombre} | ramo_marca=${r.data.ramo_marca}`);
          }
        } catch(e) {
          // 404 = not found, skip
          if (e.response?.status !== 404) {
            console.log(`  ${id}: ${e.response?.status || e.code}`);
          }
        }
      }
      console.log(`Range ${from}-${to} done. Found so far: ${found.length}`);
    }
    
    // Save results
    const outFile = path.join(__dirname, 'apps/backend/src/lib/soft-catalogs/ramos.json');
    fs.writeFileSync(outFile, JSON.stringify(found, null, 2));
    
    console.log(`\n✅ Done! Saved ${found.length} ramos`);
    
    // Group by ramo_marca (tipo de ramo)
    const byMarca = {};
    for (const r of found) {
      const marca = r.ramo_marca || 'UNKNOWN';
      if (!byMarca[marca]) byMarca[marca] = [];
      byMarca[marca].push(`  ID=${r.id} | ${r.nombre} | ${r.aseguradora_nombre}`);
    }
    console.log('\n===== GROUPED BY RAMO MARCA =====');
    for (const [marca, items] of Object.entries(byMarca)) {
      console.log(`\nRamo Marca ${marca}:`);
      items.forEach(i => console.log(i));
    }

  } catch(e) {
    console.error('Fatal Error:', e.message);
  }
}

scanRamoIds();
