const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;

    console.log('Fetching occupations...');
    const resOcc = await axios.get(url + '/api/ocupacion/', {
      headers: { Authorization: `Token ${token}` }
    });
    console.log('Occupations:', JSON.stringify(resOcc.data, null, 2));
  } catch(e) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}
test();
