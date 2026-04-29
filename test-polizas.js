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
        params: { limit: 5 }
      });
      console.log('GET Poliza Response Status:', resPolizas.status);
      const polizas = resPolizas.data.results || resPolizas.data;
      console.log('Polizas encontradas:', polizas.length);
      polizas.slice(0, 5).forEach(p => {
        console.log(`Poliza ID: ${p.id}, Numero: ${p.numero_poliza}, Ramo:`, p.ramo, `Aseguradora:`, p.aseguradora);
      });
    } catch(err4) {
      console.error('Error in GET Poliza:', err4.response?.status, err4.response?.data || err4.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testPolizas();
