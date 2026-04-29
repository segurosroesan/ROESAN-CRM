const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    console.log('Login OK');

    console.log('Fetching policies...');
    const resPol = await axios.get(url + '/api/poliza/?page_size=1', {
      headers: { Authorization: `Token ${token}` }
    });
    
    if (resPol.data.results && resPol.data.results.length > 0) {
        const pol = resPol.data.results[0];
        console.log('Policy ID:', pol.id);
        const clientId = typeof pol.cliente === 'object' ? pol.cliente.id : pol.cliente;
        console.log('Client ID:', clientId);
        
        if (clientId) {
            console.log('Fetching full client details for ID:', clientId);
            const resCli = await axios.get(url + `/api/cliente/${clientId}/`, {
                headers: { Authorization: `Token ${token}` }
            });
            console.log('Full Client Details:', JSON.stringify(resCli.data, null, 2));
        }
    } else {
        console.log('No policies found.');
    }
  } catch(e) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}
test();
