const axios = require('axios');

async function checkPolicies() {
  const url = 'https://app.softseguros.com';
  const res = await axios.post(url + '/api-token-auth/', { username: 'carmene.estrada', password: '670618' });
  const token = res.data.token;
  const headers = { Authorization: `Token ${token}` };

  try {
    const p1 = await axios.get(url + '/api/poliza/?search=58206756', { headers });
    console.log('Search 58206756 results:', p1.data.results.length);
    if(p1.data.results.length > 0) {
        const poliza = p1.data.results[0];
        console.log(`Numero: ${poliza.numero_poliza}`);
        console.log(`Vendedor: ${poliza.vendedor}`);
        console.log(`Prima: ${poliza.prima}`);
        console.log(`Total: ${poliza.total}`);
    }

    const p2 = await axios.get(url + '/api/poliza/?search=93065150', { headers });
    console.log('\nSearch 93065150 results:', p2.data.results.length);
    if(p2.data.results.length > 0) {
        const poliza = p2.data.results[0];
        console.log(`Numero: ${poliza.numero_poliza}`);
        console.log(`Vendedor: ${poliza.vendedor}`);
        console.log(`Prima: ${poliza.prima}`);
        console.log(`Total: ${poliza.total}`);
    }
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
}
checkPolicies();
