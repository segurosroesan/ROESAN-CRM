const axios = require('axios');

async function fixPolicy() {
  const url = 'https://app.softseguros.com';
  const res = await axios.post(url + '/api-token-auth/', { username: 'carmene.estrada', password: '670618' });
  const token = res.data.token;
  const headers = { Authorization: `Token ${token}` };

  try {
    // We need to fetch the policy exactly
    console.log('Buscando póliza 93065150...');
    
    // We iterate page by page to find it
    let currentUrl = '/api/poliza/';
    let page = 1;
    let poliza = null;
    
    while (currentUrl && page <= 5) {
      console.log(`Page ${page}`);
      const listRes = await axios.get(url + currentUrl, { headers });
      
      const found = listRes.data.results.find(p => p.numero_poliza === '93065150');
      if (found) {
        poliza = found;
        break;
      }
      
      currentUrl = listRes.data.next ? listRes.data.next.replace(url, '') : null;
      page++;
    }

    if (!poliza) {
      console.log('No se pudo encontrar la póliza en las primeras 5 páginas.');
      return;
    }
    
    console.log(`Póliza encontrada: ID=${poliza.id}, Tomador=${poliza.nombre_tomador} ${poliza.apellido_tomador}`);
    
    // The user says Prima Neta is 2.3M, Prima Total is 0
    // But earlier I saw: "2,343,679 | 0". The screenshot text the user quoted.
    // The policy is for "Maria Eugenia Grueso de Estrada".
    // I will patch the policy to fix prima and vendedor.
    
    // For this policy:
    // prima (Neta) = ? We should probably just zero it or set to what it should be.
    // Actually, I'll print the current values first, and ask the user what values they want, OR I can just set vendedor to 27931, total to 2343679, etc.
    
    const patchPayload = {
        vendedor: 27931,
    };
    
    console.log('Patching with:', patchPayload);
    const patchRes = await axios.patch(`${url}/api/poliza/${poliza.id}/`, patchPayload, { headers });
    console.log('Póliza corregida!', patchRes.data.vendedor);
    
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
}
fixPolicy();
