const axios = require('axios');

async function testCoberturas() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing GET /api/cobertura/ ...');
    try {
      const resCob = await axios.get(url + '/api/cobertura/', {
        headers: { Authorization: `Token ${token}` },
        params: { limit: 100 }
      });
      console.log('GET Cobertura Response Status:', resCob.status);
      const coberturas = resCob.data.results || resCob.data;
      console.log('Coberturas encontradas:', coberturas.length);
      coberturas.slice(0, 5).forEach(c => {
        console.log(`ID: ${c.id}, Nombre: ${c.nombre || c.name || JSON.stringify(c)}`);
      });
    } catch(err) {
      console.error('Error in GET Cobertura:', err.response?.status, err.response?.data || err.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testCoberturas();
