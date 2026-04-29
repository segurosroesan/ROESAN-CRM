const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;

    console.log('Fetching tipo_cliente...');
    try {
        const resTC = await axios.get(url + '/api/tipocliente/', {
          headers: { Authorization: `Token ${token}` }
        });
        console.log('Tipo Cliente:', JSON.stringify(resTC.data, null, 2));
    } catch(e) {
        console.log('Failed to fetch tipocliente, trying tipoclientes...');
        const resTC2 = await axios.get(url + '/api/tipoclientes/', {
            headers: { Authorization: `Token ${token}` }
        });
        console.log('Tipo Cliente:', JSON.stringify(resTC2.data, null, 2));
    }
  } catch(e) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}
test();
