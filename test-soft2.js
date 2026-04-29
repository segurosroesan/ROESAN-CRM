const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing POST /api/cliente/...');
    const payload = {
        numero_documento: "999999999",
        nombres: "PRUEBA",
        apellidos: "API",
        correo: "prueba@test.com",
        celular: "3000000000",
        tipo_identificacion: "C", 
        tipo_cliente: "F", 
        direccion: "Sin dirección",
        ciudad: "Bogotá", 
    };
    try {
      const res4 = await axios.post(url + '/api/cliente/', payload, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('POST Client Response Status:', res4.status);
      console.log('POST Client Response Data:', res4.data);
    } catch(err4) {
      console.error('Error in POST Client:', err4.response?.status, err4.response?.data || err4.message);
    }
    
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
test();
