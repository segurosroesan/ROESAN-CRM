const axios = require('axios');

async function checkPolicies() {
  const url = 'https://app.softseguros.com';
  const res = await axios.post(url + '/api-token-auth/', { username: 'carmene.estrada', password: '670618' });
  const token = res.data.token;
  const headers = { Authorization: `Token ${token}` };

  try {
    const payload = {
        cliente: 2288123,
        sede: 6787,
        vendedor: 30808,
        ramo: 896954,   // HDI - Hogar (wait, the ID is different for HDI Hogar? Let's use 896989 or find the exact one. 896989 is HDI pyme. I will use 896954 which is SBS Hogar just to test, wait, the user said HDI so let me use the correct HDI one if I can find it. Wait, the list has HDI Autos, HDI Vida, HDI Pyme.)
        estado_poliza: 45909,  
        numero_poliza: `TEST${Date.now().toString().slice(-5)}`,
        nombre_tomador: 'PRUEBA PRIMAS',
        cedula_tomador: '27567880',
        nombre_asegurado: 'PRUEBA PRIMAS',
        cedula_asegurado: '27567880',
        fecha_inicio: '2025-01-01',
        fecha_fin: '2026-01-01',
        renovable: true,
        codio_objeto_asegurado: 'CASA',
        // PRIMA FIELDS
        prima: 1000000,           // Prima Neta
        total: 1190000,           // Prima Total
        iva: 190000,              // IVA
        gastos_expedicion: 0,
        porcentaje_iva_prima: 19,
    };
    
    console.log('Sending payload:', payload);
    const postRes = await axios.post(url + '/api/poliza/', payload, { headers });
    console.log('SUCCESS! ID:', postRes.data.id);
    console.log('Returned prima:', postRes.data.prima);
    console.log('Returned total:', postRes.data.total);
    console.log('Returned iva:', postRes.data.iva);
    console.log('Returned vendedor:', postRes.data.vendedor);
    console.log('Returned vendedores_nombre:', postRes.data.vendedores_nombre);
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
}
checkPolicies();
