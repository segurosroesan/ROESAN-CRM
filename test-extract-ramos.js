const axios = require('axios');

async function testRamosFromPolizas() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Fetching policies to extract Ramo IDs...');
    const resPolizas = await axios.get(url + '/api/poliza/', {
      headers: { Authorization: `Token ${token}` },
      params: { limit: 100 }
    });
    
    const polizas = resPolizas.data.results || resPolizas.data;
    const ramosSet = new Map();
    
    // We only get basic info from the list endpoint, we might need to fetch single poliza
    // But let's see what's in the list endpoint.
    for (const p of polizas.slice(0, 50)) {
       try {
           const d = await axios.get(url + `/api/poliza/${p.id}/`, {
               headers: { Authorization: `Token ${token}` }
           });
           const pol = d.data;
           if (pol.ramo && !ramosSet.has(pol.ramo)) {
               ramosSet.set(pol.ramo, {
                   nombre: pol.ramo_nombre,
                   global: pol.ramo_global_nombre,
                   aseguradora: pol.ramo_aseguradora_nombre
               });
               console.log(`Found Ramo: ${pol.ramo} => ${pol.ramo_nombre} | ${pol.ramo_global_nombre} | ${pol.ramo_aseguradora_nombre}`);
           }
       } catch (e) { }
    }
    
    console.log('\nFinal Map:', ramosSet);
    
  } catch(e) {
    console.error('Error:', e.message);
  }
}
testRamosFromPolizas();
