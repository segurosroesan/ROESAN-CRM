const axios = require('axios');

async function main() {
  // Auth
  const auth = await axios.post('https://app.softseguros.com/api-token-auth/', {
    username: 'carmene.estrada',
    password: '670618',
  });
  const token = auth.data.token;
  console.log('Token OK');

  // Attempt 1: dedicated endpoint (same as getClientByDocument)
  try {
    const r1 = await axios.get('https://app.softseguros.com/api/cliente/listar_cliente_por_documento/', {
      params: { numero_documento: '27567880' },
      headers: { Authorization: `Token ${token}` },
    });
    console.log('Attempt 1 status:', r1.status);
    console.log('Attempt 1 typeof data:', typeof r1.data);
    console.log('Attempt 1 has .results?:', r1.data?.results !== undefined);
    console.log('Attempt 1 results[0]?:', !!r1.data?.results?.[0]);
    console.log('Attempt 1 .id?:', r1.data?.id);
    console.log('Attempt 1 data preview:', JSON.stringify(r1.data).substring(0, 300));
  } catch (e) {
    console.log('Attempt 1 FAILED - status:', e.response?.status);
    console.log('Attempt 1 error:', JSON.stringify(e.response?.data));
  }

  // Attempt 2: main endpoint with filter
  try {
    const r2 = await axios.get('https://app.softseguros.com/api/cliente/', {
      params: { numero_documento: '27567880', page_size: 10 },
      headers: { Authorization: `Token ${token}` },
    });
    console.log('Attempt 2 status:', r2.status);
    console.log('Attempt 2 count:', r2.data?.count);
    console.log('Attempt 2 results length:', r2.data?.results?.length);
  } catch (e) {
    console.log('Attempt 2 FAILED - status:', e.response?.status);
    console.log('Attempt 2 error:', JSON.stringify(e.response?.data));
  }
}

main().catch(console.error);
