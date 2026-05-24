const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgFRS-wv_FNhqWBBUDVI26z0bSwtJv4rf8nvfocfGnvySQiOfW-vkYBa_Rgd6YFa4vpw/exec';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  try {
    const params = new URLSearchParams({
      action: 'cargarFactura',
      ingresadoPor: body.ingresadoPor || '',
      vendedor: body.vendedor || '',
      razonSocial: body.razonSocial || '',
      empresa: body.empresa || '',
      fecha: body.fecha || '',
      tipo: body.tipo || '',
      importeOrig: body.importeOrig || 0,
      ncnd: body.ncnd || 0,
      observaciones: body.observaciones || '',
      nroComprobante: body.nroComprobante || ''
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { success: true }; }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
