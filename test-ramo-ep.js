const axios = require('axios');

async function testRamoEndpoints2() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    const eps = [
        '/api/ramo_aseguradora/',
        '/api/ramo-aseguradora/',
        '/api/ramo_global/',
        '/api/ramoglobal/',
        '/api/tipo_poliza/'
    ];

    for (const ep of eps) {
        try {
            const r = await axios.get(url + ep, { headers, params: { limit: 1 } });
            console.log(`[OK] ${ep}:`, r.status);
        } catch(e) {
            console.log(`[FAIL] ${ep}:`, e.response?.status);
        }
    }

  } catch(e) {
    console.error('Error in Login:', e.message);
  }
}
testRamoEndpoints2();
