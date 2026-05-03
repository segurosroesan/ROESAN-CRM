const axios = require('axios');

async function testPoliza() {
  const url = process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com';
  const user = process.env.SOFT_SEGUROS_USERNAME;
  const pass = process.env.SOFT_SEGUROS_PASSWORD;
  if (!user || !pass) { console.error('Error: SOFT_SEGUROS_USERNAME y SOFT_SEGUROS_PASSWORD son requeridos'); process.exit(1); }
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing POST /api/poliza/ with string ramo...');
    const payload = {
        id_cliente: 2288123, // Maria Eugenia
        renovable: true,
        estado_poliza: { codigo_generico: '01' },
        nombre_tomador: "TEST",
        cedula_tomador: "999999",
        nombre_asegurado: "TEST",
        cedula_asegurado: "999999",
        codio_objeto_asegurado: "TEST",
        ramo: "hogar",
        fecha_inicio: "2026-04-27",
        fecha_fin: "2027-04-27",
        prima: 1000
    };
    try {
      const res4 = await axios.post(url + '/api/poliza/', payload, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('POST Poliza Response Status:', res4.status);
    } catch(err4) {
      console.error('Error in POST Poliza:', err4.response?.status, err4.response?.data || err4.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testPoliza();
