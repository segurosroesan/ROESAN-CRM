const axios = require('axios');

async function main() {
  // Auth
  const auth = await axios.post('https://app.softseguros.com/api-token-auth/', {
    username: 'carmene.estrada',
    password: '670618',
  });
  const token = auth.data.token;
  console.log('Token OK');

  // Try creating a policy with the same data the frontend sends
  const policyPayload = {
    cliente: 2288123, // Maria Eugenia's ID
    renovable: true,
    estado_poliza: { codigo_generico: '01' },
    sede: 6787,
    vendedor: 27931,
    // ramo is missing - the frontend sends "hogar" as string, not a Soft Seguros ramo ID
    numero_poliza: '12345TEST',
    fecha_inicio: '2026-04-27',
    fecha_fin: '2027-04-27',
    prima: 2343679,
  };

  console.log('Payload:', JSON.stringify(policyPayload, null, 2));

  try {
    const r = await axios.post('https://app.softseguros.com/api/poliza/', policyPayload, {
      headers: { Authorization: `Token ${token}` },
    });
    console.log('SUCCESS:', JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log('FAILED - status:', e.response?.status);
    console.log('FAILED - data:', JSON.stringify(e.response?.data, null, 2));
  }
}

main().catch(console.error);
