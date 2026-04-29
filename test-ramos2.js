const axios = require('axios');

async function testPolizas() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing GET /api/poliza/ ...');
    try {
      const resPolizas = await axios.get(url + '/api/poliza/', {
        headers: { Authorization: `Token ${token}` },
        params: { limit: 100 }
      });
      const polizas = resPolizas.data.results || resPolizas.data;
      
      const ramosMap = new Map();
      polizas.forEach(p => {
        if (p.ramo && !ramosMap.has(p.ramo)) {
          ramosMap.set(p.ramo, p); // Guardar un ejemplo de poliza de este ramo
        }
      });
      
      console.log('Ramos únicos encontrados:', ramosMap.size);
      ramosMap.forEach((p, ramo) => {
        console.log(`Ramo ID: ${ramo}`);
        // Imprimir algunos campos útiles para deducir qué ramo es
        console.log(`  Poliza Ej: ${p.numero_poliza}, Placa: ${p.placa}, Objeto: ${p.objeto_asegurado}, Prima: ${p.prima}`);
      });
      
      // Let's also check if there's a specific endpoint for Ramos that we can read from
      // Sometimes it's /api/ramo_compania/ or similar
    } catch(err4) {
      console.error('Error in GET Poliza:', err4.response?.status, err4.response?.data || err4.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testPolizas();
