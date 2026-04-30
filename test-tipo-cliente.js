/**
 * Quick test: fetch an existing client from Soft Seguros to see what
 * tipo_cliente value looks like (string? int? object?)
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

    // Fetch first page of clients to see tipo_cliente field
    console.log('--- Fetching clients page 1 ---');
    const res = await axios.get(`${BASE}/api/cliente/`, { headers, params: { page_size: 5 } });
    
    for (const c of res.data.results) {
      console.log(`\nCliente ID=${c.id} | ${c.nombres} ${c.apellidos}`);
      console.log(`  tipo_documento: ${JSON.stringify(c.tipo_documento)}`);
      console.log(`  tipo_cliente:   ${JSON.stringify(c.tipo_cliente)}`);
      console.log(`  numero_documento: ${c.numero_documento}`);
    }

    // Also try searching for a juridica client (NIT) specifically
    console.log('\n\n--- Searching for NIT clients ---');
    const res2 = await axios.get(`${BASE}/api/cliente/`, { 
      headers, 
      params: { page_size: 50 } 
    });
    
    const juridicos = res2.data.results.filter(c => {
      const td = c.tipo_documento;
      // Check various possible formats
      return (td && typeof td === 'object' && (td.codigo === '02' || td.nombre?.includes('NIT'))) ||
             td === '02' || td === 2 || td === 'NIT';
    });
    
    if (juridicos.length > 0) {
      console.log(`Found ${juridicos.length} juridica clients:`);
      for (const c of juridicos.slice(0, 5)) {
        console.log(`\n  ID=${c.id} | ${c.nombres} ${c.apellidos}`);
        console.log(`    tipo_documento: ${JSON.stringify(c.tipo_documento)}`);
        console.log(`    tipo_cliente:   ${JSON.stringify(c.tipo_cliente)}`);
        console.log(`    numero_doc:     ${c.numero_documento}`);
      }
    } else {
      console.log('No juridica clients found in first 50 results');
      // Show all unique tipo_cliente values
      const uniqueTypes = [...new Set(res2.data.results.map(c => JSON.stringify(c.tipo_cliente)))];
      console.log('\nAll unique tipo_cliente values found:');
      uniqueTypes.forEach(t => console.log(`  ${t}`));
      
      const uniqueDocTypes = [...new Set(res2.data.results.map(c => JSON.stringify(c.tipo_documento)))];
      console.log('\nAll unique tipo_documento values found:');
      uniqueDocTypes.forEach(t => console.log(`  ${t}`));
    }
  } catch (e) {
      console.error('Status:', e.response?.status);
      console.error('Error Data:', JSON.stringify(e.response?.data, null, 2));
      console.error('Error Message:', e.message);
  }
}

main().catch(e => {
  console.error('Fatal Error:', e);
});
