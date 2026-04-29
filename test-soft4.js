const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing POST /api/cliente/ with full fields...');
    const payload = {
        numero_documento: "999999998",
        nombres: "PRUEBA",
        apellidos: "API",
        correo: "prueba@test.com",
        email: "prueba@test.com",
        celular: "3000000000",
        telefono: "3000000000",
        tipo_identificacion: "C", 
        tipo_documento: 1, 
        tipo_cliente: "F", 
        genero: "M",
        fecha_nacimiento: "1990-01-01",
        ocupacion: "Independiente",
        direccion: "Sin dirección",
        ciudad: "Bogotá", 
    };
    try {
      const res4 = await axios.post(url + '/api/cliente/', payload, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('POST Client Response Status:', res4.status);
      console.log('POST Client Response Data:', res4.data.id || res4.data);
    } catch(err4) {
      console.error('Error in POST Client:', err4.response?.status, err4.response?.data || err4.message);
    }
    
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
test();
