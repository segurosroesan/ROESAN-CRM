const axios = require('axios');

async function testVendedor() {
  const url = 'https://app.softseguros.com';
  const res = await axios.post(url + '/api-token-auth/', { username: 'carmene.estrada', password: '670618' });
  const token = res.data.token;
  const headers = { Authorization: `Token ${token}` };

  try {
    const payload = {
        cliente: 2288123,
        sede: 6787,
        vendedor: 27931, // ORGANIZACION DE SEGUROS ROESAN LIMITADA
        ramo: 896954, 
        estado_poliza: 45909,  
        numero_poliza: `TEST${Date.now().toString().slice(-5)}`,
        nombre_tomador: 'PRUEBA VENDEDOR',
        cedula_tomador: '27567880',
        nombre_asegurado: 'PRUEBA VENDEDOR',
        cedula_asegurado: '27567880',
        fecha_inicio: '2025-01-01',
        fecha_fin: '2026-01-01',
        renovable: true,
        codio_objeto_asegurado: 'CASA',
        prima: 1000000,
        total: 1190000,
    };
    
    console.log('Sending payload with vendedor 27931:', payload);
    const postRes = await axios.post(url + '/api/poliza/', payload, { headers });
    console.log('SUCCESS! ID:', postRes.data.id);
    console.log('Returned vendedor:', postRes.data.vendedor);
    console.log('Returned vendedores_nombre:', postRes.data.vendedores_nombre);
  } catch (err) {
    console.error('Error with vendedor 27931:', err.response?.status, err.response?.data);
  }
}
testVendedor();
