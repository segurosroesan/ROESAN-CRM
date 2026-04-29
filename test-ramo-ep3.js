const axios = require('axios');

async function testEndpoints() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    const eps = ['/api/ramos/', '/api/ramo/', '/api/tipospoliza/', '/api/ramoaseguradora/'];
    
    for (const ep of eps) {
        try {
            const r = await axios.get(url + ep, { headers, params: { limit: 1 } });
            if (typeof r.data === 'string' && r.data.includes('HTML')) {
                console.log(`[FAIL] ${ep}: returns HTML`);
            } else {
                console.log(`[OK] ${ep}:`, r.status, JSON.stringify(r.data.results?.[0] || r.data?.[0] || 'No data').substring(0, 100));
            }
        } catch(e) {
            console.log(`[FAIL] ${ep}:`, e.response?.status);
        }
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}
testEndpoints();
