const axios = require('axios');

async function findRamos() {
  const url = 'https://app.softseguros.com';
  const res = await axios.post(url + '/api-token-auth/', { username: 'carmene.estrada', password: '670618' });
  const token = res.data.token;
  const headers = { Authorization: `Token ${token}` };

  try {
    const r1 = await axios.get(url + '/api/ramo/?search=HDI', { headers });
    console.log('HDI Ramos:');
    r1.data.results.forEach(r => {
      console.log(`- ID: ${r.id}, Nombre: ${r.nombre}, Aseguradora: ${r.aseguradora_nombre}`);
    });
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
}
findRamos();
