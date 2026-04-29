const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    console.log('Authenticating...');
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    console.log('Login OK. Token obtained.');
    
    console.log('Testing GET /api/cliente/listar_cliente_por_documento/?numero_documento=123456789...');
    try {
      const res2 = await axios.get(url + '/api/cliente/listar_cliente_por_documento/?numero_documento=123456789', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('GET Client Response Status:', res2.status);
      console.log('GET Client Response Data:', res2.data);
    } catch(err2) {
      console.error('Error in GET Client:', err2.response?.status, err2.response?.data || err2.message);
    }
    
    console.log('\nTesting GET /api/cliente/ (Base endpoint)...');
    try {
      const res3 = await axios.get(url + '/api/cliente/?page_size=1', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('GET Base Client Response Status:', res3.status);
      console.log('GET Base Client Response Data:', res3.data.count ? `Found ${res3.data.count} clients` : res3.data);
    } catch(err3) {
      console.error('Error in GET Base Client:', err3.response?.status, err3.response?.data || err3.message);
    }
    
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
test();
