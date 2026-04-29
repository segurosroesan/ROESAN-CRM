const axios = require('axios');

async function testRamoQuery() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing GET /api/ramo/?aseguradora=136211 ...');
    try {
      const r = await axios.get(url + '/api/ramo/', {
        headers: { Authorization: `Token ${token}` },
        params: { aseguradora: 136211 }
      });
      console.log('GET Ramo Status:', r.status);
      console.log('Count:', r.data.count);
      console.log('First result ID:', r.data.results?.[0]?.id, r.data.results?.[0]?.nombre);
    } catch(err) {
      console.error('Error in GET:', err.response?.status, err.response?.data);
    }
  } catch(e) {
    console.error('Error in Login:', e.message);
  }
}
testRamoQuery();
