const axios = require('axios');

async function testEndpoints() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    const endpoints = ['/api/aseguradora/', '/api/vendedor/', '/api/sede/'];
    
    for (const ep of endpoints) {
        try {
            const r = await axios.get(url + ep, { headers, params: { limit: 5 } });
            console.log(`[OK] ${ep}: ${(r.data.results || r.data).length} items found.`);
        } catch (err) {
            console.log(`[FAIL] ${ep}: ${err.response?.status} - ${err.message}`);
        }
    }
  } catch(e) {
    console.error('Error in Login:', e.message);
  }
}
testEndpoints();
