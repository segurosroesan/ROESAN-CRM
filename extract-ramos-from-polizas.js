const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function extractRamosFromPolizas() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    // First, get total count
    const first = await axios.get(url + '/api/poliza/', { headers, params: { limit: 1 } });
    const total = first.data.count;
    console.log(`Total policies: ${total}`);

    const ramosMap = new Map(); // key: ramo_id, value: { id, nombre, aseguradora_id, aseguradora_nombre, ramo_marca, ramo_global }

    let page = 1;
    let fetched = 0;
    const pageSize = 100;

    while (fetched < total) {
      try {
        const r = await axios.get(url + '/api/poliza/', {
          headers,
          params: { limit: pageSize, page }
        });
        const polizas = r.data.results || [];
        
        for (const p of polizas) {
          if (p.ramo && !ramosMap.has(p.ramo)) {
            // Fetch full detail to get ramo metadata
            try {
              const det = await axios.get(url + `/api/poliza/${p.id}/`, { headers });
              const pol = det.data;
              if (pol.ramo && !ramosMap.has(pol.ramo)) {
                ramosMap.set(pol.ramo, {
                  id: pol.ramo,
                  nombre: pol.ramo_nombre,
                  aseguradora_id: pol.ramo_aseguradora || pol.aseguradora,
                  aseguradora_nombre: pol.ramo_aseguradora_nombre || pol.aseguradora_nombre,
                  ramo_marca: pol.ramo_marca,
                  ramo_global: pol.ramo_global,
                  ramo_global_nombre: pol.ramo_global_nombre,
                });
                console.log(`Found new ramo: ID=${pol.ramo} | Nombre=${pol.ramo_nombre} | Aseguradora=${pol.ramo_aseguradora_nombre} | ramo_marca=${pol.ramo_marca}`);
              }
            } catch (e) { /* skip */ }
          }
        }

        fetched += polizas.length;
        console.log(`Progress: ${fetched}/${total} polizas scanned | ${ramosMap.size} unique ramos found`);

        if (!r.data.next || polizas.length === 0) break;
        page++;
      } catch (e) {
        console.error(`Error on page ${page}:`, e.message);
        break;
      }
    }

    const ramosArray = Array.from(ramosMap.values()).sort((a, b) => {
      const nameA = a.ramo_global_nombre || a.nombre || '';
      const nameB = b.ramo_global_nombre || b.nombre || '';
      return nameA.localeCompare(nameB);
    });

    const outFile = path.join(__dirname, 'apps/backend/src/lib/soft-catalogs/ramos.json');
    fs.writeFileSync(outFile, JSON.stringify(ramosArray, null, 2));
    console.log(`\n✅ Saved ${ramosArray.length} ramos to ${outFile}`);
    
    // Print summary grouped by ramo_global_nombre
    const byGlobal = {};
    for (const r of ramosArray) {
      const key = r.ramo_global_nombre || 'SIN CLASIFICAR';
      if (!byGlobal[key]) byGlobal[key] = [];
      byGlobal[key].push(`  ID=${r.id} | ${r.nombre} | ${r.aseguradora_nombre} | ramo_marca=${r.ramo_marca}`);
    }
    
    console.log('\n========== RAMOS ENCONTRADOS POR TIPO ==========');
    for (const [tipo, items] of Object.entries(byGlobal)) {
      console.log(`\n[${tipo}]`);
      items.forEach(i => console.log(i));
    }
    console.log('================================================');

  } catch(e) {
    console.error('Fatal Error:', e.response?.data || e.message);
  }
}

extractRamosFromPolizas();
