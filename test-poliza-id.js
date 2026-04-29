const axios = require('axios');

async function testPolizaId() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    try {
      const res4 = await axios.get(url + '/api/poliza/3584191/', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('Poliza data:', JSON.stringify(res4.data, null, 2));
    } catch(err4) {
      console.error('Error:', err4.response?.status, err4.response?.data || err4.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testPolizaId();
