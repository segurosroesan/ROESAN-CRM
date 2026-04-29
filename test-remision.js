const axios = require('axios');
const URL = 'https://app.softseguros.com';

async function testFull() {
  const auth = await axios.post(`${URL}/api-token-auth/`, { username: 'carmene.estrada', password: '670618' });
  const headers = { Authorization: `Token ${auth.data.token}` };
  console.log('✓ Auth OK\n');

  console.log('--- SYNC-4 Final Test (estado_poliza=45909 + vendedor=30808) ---');
  const payload = {
    cliente: 2288123,
    sede: 6787,
    vendedor: 30808,
    ramo: 896949,   // Hogar - Bolivar
    estado_poliza: 45909,  // Vigente (ID correcto)
    numero_poliza: `TEST${Date.now().toString().slice(-6)}`,
    nombre_tomador: 'CLIENTE DE PRUEBA',
    cedula_tomador: '27567880',
    nombre_asegurado: 'CLIENTE DE PRUEBA',
    cedula_asegurado: '27567880',
    fecha_inicio: '2025-01-01',
    fecha_fin: '2026-01-01',
    prima: 1500000,
    renovable: true,
    codio_objeto_asegurado: 'CASA PRUEBA CRM',
  };
  console.log('Payload:', JSON.stringify(payload, null, 2));
  try {
    const res = await axios.post(`${URL}/api/poliza/`, payload, { headers });
    console.log('\n✓ ¡PÓLIZA CREADA EXITOSAMENTE!');
    console.log('  ID Póliza:', res.data.id);
    console.log('  Número:', res.data.numero_poliza);
    console.log('  Estado:', res.data.estado_poliza);
    console.log('  Cliente:', res.data.cliente);

    // Cleanup: si quieres borrar el registro de prueba
    // await axios.delete(`${URL}/api/poliza/${res.data.id}/`, { headers });
  } catch (e) {
    console.error('\n✗ ERROR:', e.response?.status, JSON.stringify(e.response?.data));
  }
}

testFull().catch(console.error);
