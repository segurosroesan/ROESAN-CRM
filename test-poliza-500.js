const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    const headers = { Authorization: `Token ${token}` };

    const policyPayload = {
      cliente: 4004944, // Some existing client ID
      sede: 6099, // From /api/sede/
      numero_poliza: 'POR ASIGNAR',
      fecha_inicio: '2026-04-29',
      fecha_fin: '2027-04-29',
      renovable: true,
      estado_poliza: { codigo_generico: '01' },
      nombre_tomador: 'TEST TOMADOR',
      cedula_tomador: '123456789',
      nombre_asegurado: 'TEST ASEGURADO',
      cedula_asegurado: '123456789',
      codio_objeto_asegurado: 'N/A', 
      ramo: 896927, // Autos Allianz
      vendedores: [
        {
          vendedor: 27931,
          porcentaje_comision: 100
        }
      ]
    };


    console.log('Sending payload:', policyPayload);
    const r = await axios.post(url + '/api/poliza/', policyPayload, { headers });
    console.log('Success:', r.data);
  } catch(e) {
    if (e.response) {
      console.error(`Error ${e.response.status}:`, e.response.data);
      if (e.response.status === 500) {
        console.error('500 Internal Server Error Response text:', e.response.statusText);
      }
    } else {
      console.error('Error:', e.message);
    }
  }
}

test();
