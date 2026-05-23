// netlify/functions/verificar-duplicado.js
// Consulta al Apps Script si ya existe un comprobante con ese número y empresa

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxAYeKWNgU8h75eQ33T5FC_wC-80xbD4ZgqvnnTora4VRUOVs4XFRuNY5lp6kl3DEkzw/exec';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { nro, empresa } = event.queryStringParameters || {};

  if (!nro) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta nro' }) };
  }

  try {
    const url = `${APPS_SCRIPT_URL}?action=verificarDuplicado&nro=${encodeURIComponent(nro)}&empresa=${encodeURIComponent(empresa || '')}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error('Error consultando Apps Script');

    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    // Si falla, devolvemos duplicado: false para no bloquear la carga
    console.error('verificarDuplicado error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ duplicado: false }) };
  }
};
