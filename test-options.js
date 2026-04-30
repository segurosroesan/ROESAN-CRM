/**
 * Use OPTIONS request to find out the allowed values for tipo_cliente
 */
const axios = require('axios');
require('dotenv').config({ path: './apps/backend/.env' });

const BASE = 'https://app.softseguros.com';
const USER = process.env.SOFT_SEGUROS_USERNAME;
const PASS = process.env.SOFT_SEGUROS_PASSWORD;

async function main() {
  if (!USER || !PASS) {
      console.error('Credentials not found in .env');
      return;
  }
  // Auth
  try {
    const auth = await axios.post(`${BASE}/api-token-auth/`, { username: USER, password: PASS });
    const token = auth.data.token;
    const headers = { Authorization: `Token ${token}` };

    console.log('--- Sending OPTIONS to /api/cliente/ ---');
    const res = await axios({
        method: 'OPTIONS',
        url: `${BASE}/api/cliente/`,
        headers
    });
    
    const tipoClienteField = res.data.actions?.POST?.tipo_cliente;
    if (tipoClienteField) {
        console.log('tipo_cliente metadata:', JSON.stringify(tipoClienteField, null, 2));
    } else {
        console.log('tipo_cliente field not found in OPTIONS response.');
        // Log the whole actions object to see what fields are there
        console.log('Available POST fields:', Object.keys(res.data.actions?.POST || {}));
    }
    
    const tipoDocField = res.data.actions?.POST?.tipo_documento;
    if (tipoDocField) {
        console.log('tipo_documento metadata:', JSON.stringify(tipoDocField, null, 2));
    }

  } catch (e) {
      console.error('Status:', e.response?.status);
      console.error('Error Data:', JSON.stringify(e.response?.data, null, 2));
      console.error('Error Message:', e.message);
  }
}

main();
