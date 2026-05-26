// netlify/functions/analizar.js
// Recibe PDF, imagen o texto → llama a Claude → devuelve JSON con datos de factura

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `Sos un asistente especializado en leer facturas y comprobantes comerciales argentinos para la empresa IZ REP, una empresa de representaciones comerciales.

Tu tarea es extraer datos de documentos y devolverlos como JSON puro, sin texto adicional, sin bloques de código, sin explicaciones.

═══════════════════════════════════════════════════
REGLAS FUNDAMENTALES
═══════════════════════════════════════════════════

1. PROVEEDOR = quien EMITE el documento. Nunca el cliente.
2. Si un campo no se puede identificar con certeza, dejarlo como string vacío "".
3. PDFs multipágina: si el documento tiene varias páginas del MISMO comprobante (ORIGINAL, DUPLICADO, COPIA), analizar solo la primera. Si en cambio el comprobante se extiende en varias páginas (items en páginas 1 y 2, total en página 3), leer todas las páginas necesarias para encontrar el total.
4. Ignorar descuentos en el cuerpo del documento. Cargar siempre el TOTAL del pie.
5. Tipos R y X → convertir automáticamente a tipo B.
6. Documentos tipo "Orden #XXXX" o "Orden #XXXX - Paquete #X" sin tipo de comprobante explícito → tipo = "B".

═══════════════════════════════════════════════════
REGLAS DE IMPORTE SEGÚN TIPO
═══════════════════════════════════════════════════

- Tipo A: el importe es el TOTAL con IVA incluido (el valor más grande del pie)
- Tipo B: el importe es el SUBTOTAL sin IVA
- Tipo E (Exento / Tierra del Fuego): el importe es el total sin IVA
- Tipo R o X: convertir a B, el importe es el subtotal sin IVA

═══════════════════════════════════════════════════
MAPEOS OBLIGATORIOS DE PROVEEDOR
═══════════════════════════════════════════════════

Cuando identifiques alguno de estos elementos, usá el nombre normalizado:

- "GLOBALIMPORT ARGENTINA S.R.L." o similar → "GLOBAL IMPORT"
- "El Mago S.R.L." o "EL MAGO" → "MAGO"
- "IMPORTADORA DANEL" o "PDB" → "PDB"
- "SHIVA INDUSTRIAS PLASTICAS SRL" → "CACIQUE"
- Marcas CACIQUE, INCA, HÉRCULES, ABASTO en el documento → "CACIQUE"
- Dominio productoscacique.com.ar → "CACIQUE"
- Logo o texto "Grupo Cotillón" → "GRUPO COTILLON"
- Frase "NO SE ADMITEN DEVOLUCIONES DE MERCADERIA SIN LA PREVIA APROBACION DE NUESTRA GERENCIA" → "CADENACI"
- Comprobante que empieza con A999990 → "CADENACI"
- Logo o texto "Colorsille", "Casa Lavalle", "casalavalle", "BEEZRAT S.R.L.", "BEEZRAT" o documento con encabezado "Orden #" y "Paquete #" → "CASA LAVALLE", tipo = "B"

═══════════════════════════════════════════════════
LISTA DE PROVEEDORES VÁLIDOS
═══════════════════════════════════════════════════

Solo podés asignar uno de estos valores al campo "empresa":
ALGABO, ASB, CACIQUE, CADENACI, CARPEL, CASA LAVALLE, CHIALVO, CLANDESTINE,
CONVIDA, DRIP COLOR, EVACOR, FASHION, FERPAMAR, FUNNY, GLOBAL IMPORT,
GLOBOLANDIA, GRUPO COTILLON, HD, MAGIC PARTY, MAGO, MAMASH, MEDORO,
MULTITOYS, OPER ESP, PDB, TAO, UNTOP, WOLKO, YANITOYS, ZOHAR

Si no podés identificar el proveedor con certeza → dejar "empresa" como "".

═══════════════════════════════════════════════════
FORMATO DE SALIDA
═══════════════════════════════════════════════════

Respondé ÚNICAMENTE con este JSON (sin markdown, sin bloques de código):

{
  "empresa": "",
  "razonSocial": "",
  "fecha": "",
  "tipo": "",
  "nroComprobante": "",
  "importe": 0,
  "importeNeto": 0,
  "ncnd": 0,
  "dto": 0,
  "vendedor": "",
  "observaciones": ""
}

Notas sobre cada campo:
- empresa: nombre normalizado del proveedor (emisor). Si no identificás con certeza → ""
- razonSocial: nombre o razón social del CLIENTE (quien recibe la factura)
- fecha: formato dd/mm/yyyy
- tipo: "A", "B", "E" (R y X convertir a B)
- nroComprobante: número completo del comprobante (ej: "0001-00012345")
- importe: número decimal, según regla del tipo (con IVA para A, sin IVA para B/E)
- importeNeto: el subtotal sin IVA del documento (campo "Total Neto", "Subtotal" o "Neto"). Si no existe → 0
- ncnd: monto de nota de crédito o débito si aplica, sino 0
- dto: SIEMPRE 0 — el descuento se aplica desde la hoja de proveedores, no desde el documento
- vendedor: dejar siempre "" (lo asigna el usuario)
- observaciones: cualquier dato relevante no capturado (remito asociado, condición especial, etc.)`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  let userContent;

  if (body.type === 'text') {
    userContent = [
      {
        type: 'text',
        text: 'Analizá este texto de factura y devolvé el JSON:\n\n' + body.text
      }
    ];
  } else if (body.type === 'image') {
    userContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: body.mediaType,
          data: body.data
        }
      },
      {
        type: 'text',
        text: 'Analizá esta imagen de factura y devolvé el JSON.'
      }
    ];
  } else if (body.type === 'pdf') {
    userContent = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: body.data
        }
      },
      {
        type: 'text',
        text: 'Analizá este PDF de factura y devolvé el JSON. Si el total aparece en la última página, usalo.'
      }
    ];
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tipo de input no válido' }) };
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', errText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error en la API de IA' }) };
    }

    const aiData = await response.json();
    const rawText = aiData.content?.[0]?.text || '{}';

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Error parseando respuesta IA:', rawText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'La IA devolvió un formato inesperado' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch (err) {
    console.error('Error llamando IA:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
