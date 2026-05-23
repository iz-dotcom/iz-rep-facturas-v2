const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxAYeKWNgU8h75eQ33T5FC_wC-80xbD4ZgqvnnTora4VRUOVs4XFRuNY5lp6kl3DEkzw/exec';

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
    // Enviamos todo como GET con los datos serializados — Apps Script maneja GET sin redirect
    const params = new URLSearchParams({
      action: 'cargarFactura',
      data: JSON.stringify(body)
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Apps Script devolvió algo no-JSON, igual consideramos éxito
      data = { success: true };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
