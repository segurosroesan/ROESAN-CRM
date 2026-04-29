const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'apps/backend/.env') });

async function fetchAllPages(url, endpoint, headers) {
    let results = [];
    let page = 1;
    let hasMore = true;
    while(hasMore) {
        console.log(`Fetching ${endpoint} page ${page}...`);
        try {
            const res = await axios.get(url + endpoint, { headers, params: { page, limit: 100 } });
            const data = res.data.results || res.data;
            if (Array.isArray(data)) {
                results = results.concat(data);
            }
            hasMore = !!res.data.next;
            page++;
        } catch (e) {
            console.error(`Error fetching ${endpoint} page ${page}:`, e.message);
            hasMore = false;
        }
    }
    return results;
}

async function run() {
  const url = 'https://app.softseguros.com';
  const user = process.env.SOFT_SEGUROS_USERNAME || 'carmene.estrada';
  const pass = process.env.SOFT_SEGUROS_PASSWORD || '670618';
  
  try {
    console.log('Authenticating...');
    const auth = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = auth.data.token;
    const headers = { Authorization: `Token ${token}` };

    const catalogs = [
        { name: 'aseguradoras', endpoint: '/api/aseguradora/' },
        { name: 'vendedores', endpoint: '/api/vendedor/' },
        { name: 'sedes', endpoint: '/api/sede/' },
        { name: 'coberturas', endpoint: '/api/cobertura/' }
    ];

    const outDir = path.join(__dirname, 'apps/backend/src/lib/soft-catalogs');

    for (const cat of catalogs) {
        const data = await fetchAllPages(url, cat.endpoint, headers);
        
        // Extract useful fields to keep the JSON small (e.g., id, name)
        const mapped = data.map(item => {
            return {
                id: item.id,
                nombre: item.nombre || item.name || item.nombre_vendedor || 'Sin nombre',
                nit: item.nit || undefined,
                codigo: item.codigo || undefined,
            };
        });

        const filePath = path.join(outDir, `${cat.name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(mapped, null, 2));
        console.log(`✅ Saved ${mapped.length} records to ${filePath}`);
    }
    
    console.log('All catalogs fetched successfully!');

  } catch(e) {
    console.error('Fatal Error:', e.message);
  }
}

run();
