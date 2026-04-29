const axios = require('axios');

async function testPoliza() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing POST /api/poliza/ with ID ramo 90828 (Autos from Excel)...');
    const payload = {
        cliente: 2288123,
        numero_poliza: "TEST123456",
        sede: 6787,
        vendedor: 27931,
        renovable: true,
        estado_poliza: { codigo_generico: '01' },
        nombre_tomador: "TEST",
        cedula_tomador: "999999",
        nombre_asegurado: "TEST",
        cedula_asegurado: "999999",
        codio_objeto_asegurado: "TEST",
        ramo: 90828,
        fecha_inicio: "2026-04-27",
        fecha_fin: "2027-04-27",
        prima: 1000
    };
    try {
      const res4 = await axios.post(url + '/api/poliza/', payload, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('POST Poliza Response Status:', res4.status);
      console.log('Poliza ID:', res4.data.id);
      
      await axios.delete(url + '/api/poliza/' + res4.data.id + '/', {
          headers: { Authorization: `Token ${token}` }
      });
      console.log('Deleted test policy.');
    } catch(err4) {
      console.error('Error in POST Poliza:', err4.response?.status, err4.response?.data || err4.message);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testPoliza();
