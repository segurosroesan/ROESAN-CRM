const axios = require('axios');

async function testPolizas() {
  const url = 'https://app.softseguros.com';
  const user = 'carmene.estrada';
  const pass = '670618';
  try {
    const res = await axios.post(url + '/api-token-auth/', { username: user, password: pass });
    const token = res.data.token;
    
    // We try to request the options for poliza, this sometimes gives the choices
    try {
      const resOpt = await axios.options(url + '/api/poliza/', {
        headers: { Authorization: `Token ${token}` }
      });
      console.log('OPTIONS Response Status:', resOpt.status);
      if (resOpt.data && resOpt.data.actions && resOpt.data.actions.POST) {
        const ramoField = resOpt.data.actions.POST.ramo;
        if (ramoField && ramoField.choices) {
            console.log("Ramos Choices:", ramoField.choices);
        } else {
            console.log("Ramo Field spec:", ramoField);
        }
      } else {
        console.log(JSON.stringify(resOpt.data).substring(0, 500));
      }
    } catch(err) {
      console.log("OPTIONS Error", err.response?.status);
    }
  } catch(e) {
    console.error('Error in Login:', e.response?.status, e.response?.data || e.message);
  }
}
testPolizas();
