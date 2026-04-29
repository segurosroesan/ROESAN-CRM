const axios = require('axios');

async function test() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '081294';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    console.log('Testing POST /api/cliente/ with occupation 4 (INDEPENDIENTE)...');
    const payload = {
        numero_documento: "999999997",
        nombres: "PRUEBA",
        apellidos: "SOFT",
        email: "prueba_soft@test.com",
        celular: "+57 3000000000",
        telefono: "+57 3000000000",
        tipo_documento: "01", 
        genero: "MASCULINO",
        fecha_nacimiento: "1990-01-01",
        ocupacion: 4, // INDEPENDIENTE
        direccion: "Calle Falsa 123",
        ciudad: "BOGOTÁ",
        provincia: "BOGOTÁ",
        pais: "CO",
        tipo_cliente: "F", // Persona Física
        sede: 6787,
        marca: 6751
    };
    
    try {
      const res4 = await axios.post(url + '/api/cliente/', payload, {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('POST Client Response Status:', res4.status);
      console.log('POST Client Response Data ID:', res4.data.id);
    } catch(err4) {
      console.error('Error in POST Client:', err4.response?.status, err4.response?.data || err4.message);
    }
    
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
test();
