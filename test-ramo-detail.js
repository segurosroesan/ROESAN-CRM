const axios = require('axios');

async function testRamoDetail() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing GET /api/ramo/896927/ ...');
    try {
      const r = await axios.get(url + '/api/ramo/896927/', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('GET Ramo 896927 Status:', r.status);
      console.log('Data:', r.data);
    } catch(err) {
      console.error('Error in GET 896927:', err.response?.status);
    }

    console.log('\nTesting GET /api/ramo/90828/ ...');
    try {
      const r2 = await axios.get(url + '/api/ramo/90828/', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('GET Ramo 90828 Status:', r2.status);
      console.log('Data:', r2.data);
    } catch(err) {
      console.error('Error in GET 90828:', err.response?.status);
    }
  } catch(e) {
    console.error('Error in Login:', e.message);
  }
}
testRamoDetail();
