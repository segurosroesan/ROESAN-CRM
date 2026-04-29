const axios = require('axios');

async function testRamos() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing GET /api/ramo/ ...');
    try {
      const resRamo = await axios.get(url + '/api/ramo/', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('GET Ramo Response Status:', resRamo.status);
      console.log('Ramos:', JSON.stringify(resRamo.data, null, 2).substring(0, 1500));
    } catch(err4) {
      console.error('Error in GET Ramo:', err4.response?.status, err4.response?.data || err4.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testRamos();
