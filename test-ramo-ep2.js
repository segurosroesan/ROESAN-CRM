const axios = require('axios');

async function checkRamos() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    const r1 = await axios.get(url + '/api/ramo_aseguradora/', { headers, params: { limit: 3 } });
    console.log('ramo_aseguradora:', JSON.stringify(r1.data.results || r1.data, null, 2));

    const r2 = await axios.get(url + '/api/ramo_global/', { headers, params: { limit: 3 } });
    console.log('ramo_global:', JSON.stringify(r2.data.results || r2.data, null, 2));

  } catch(e) {
    console.error('Error:', e.message);
  }
}
checkRamos();
