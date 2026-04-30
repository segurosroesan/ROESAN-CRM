const axios = require('axios');
const url = 'https://app.softseguros.com';
const user = 'carmene.estrada';
const pass = '670618';

async function test() {
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    console.log('--- Fetching Client to see structure ---');
    const clients = await axios.get(url + '/api/cliente/', { headers, params: { page_size: 1 } });
    if (clients.data.results && clients.data.results[0]) {
        console.log('Client structure:', JSON.stringify(clients.data.results[0], null, 2));
    } else {
        console.log('No clients found');
    }
  } catch(e) {
    console.error('Error:', e.response?.data || e.message);
  }
}
test();
