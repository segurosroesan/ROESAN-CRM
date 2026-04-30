const axios = require('axios');
require('dotenv').config({ path: './apps/backend/.env' });

const BASE = 'https://app.softseguros.com';
const USER = process.env.SOFT_SEGUROS_USERNAME;
const PASS = process.env.SOFT_SEGUROS_PASSWORD;

async function main() {
  const auth = await axios.post(`${BASE}/api-token-auth/`, { username: USER, password: PASS });
  const token = auth.data.token;
  const headers = { Authorization: `Token ${token}` };

  const res = await axios({ method: 'OPTIONS', url: `${BASE}/api/cliente/`, headers });
  
  const fields = res.data.actions?.POST;
  if (fields) {
      // Find any field that looks like "tipo" or has choices like "Persona/Empresa"
      Object.keys(fields).forEach(key => {
          const f = fields[key];
          if (f.choices || key.includes('tipo') || key.includes('persona')) {
              console.log(`${key}:`, JSON.stringify(f, null, 2));
          }
      });
  }
}
main();
