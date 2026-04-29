const axios = require('axios');

async function testRamoEndpoint() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing GET /api/ramo/ ...');
    try {
      const r = await axios.get(url + '/api/ramo/', {
        headers: { Authorization: `Token ${token}` },
        params: { limit: 10 }
      });
      console.log('GET Ramo Status:', r.status);
      console.log('Ramo data:', JSON.stringify(r.data.results || r.data, null, 2));
    } catch(err) {
      console.error('Error in GET Ramo:', err.response?.status, err.response?.data || err.message);
    }

    console.log('\nTesting GET /api/subramo/ ...');
    try {
      const r2 = await axios.get(url + '/api/subramo/', {
        headers: { Authorization: `Token ${token}` },
        params: { limit: 10 }
      });
      console.log('GET Subramo Status:', r2.status);
      console.log('Subramo data:', JSON.stringify(r2.data.results || r2.data, null, 2));
    } catch(err) {
      console.error('Error in GET Subramo:', err.response?.status, err.response?.data || err.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.message);
  }
}
testRamoEndpoint();
