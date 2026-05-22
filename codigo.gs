// Google Apps Script — IZ REP Lector de Facturas v2.0
// Pegar este código en script.google.com → reemplazar el script existente → guardar → desplegar nueva versión

const SHEET_ID = '10T4OzsoxeJOdkYtEqFkhRiFyk2zBOrwNzUoxyrNq1sI';
const VENTAS_SHEET = 'VENTAS';
const CLIENTES_SHEET = 'CLIENTES';
const PROVEEDORES_SHEET = 'PROVEEDORES';

function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === 'verificarDuplicado') {
      return handleVerificarDuplicado(e);
    }
    return jsonResponse({ error: 'Acción no reconocida' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const action = body.action || e.parameter.action;

  try {
    if (action === 'cargarFactura') {
      return handleCargarFactura(body);
    }
    return jsonResponse({ error: 'Acción no reconocida' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ─── VERIFICAR DUPLICADO ──────────────────────────────────────────
function handleVerificarDuplicado(e) {
  const nro = e.parameter.nro || '';
  const empresa = e.parameter.empresa || '';

  if (!nro) return jsonResponse({ duplicado: false });

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(VENTAS_SHEET);
  const data = sheet.getDataRange().getValues();

  // Columna T (índice 19) = NRO COMPROBANTE
  // Columna E (índice 4) = EMPRESA
  for (let i = 1; i < data.length; i++) {
    const rowNro = (data[i][19] || '').toString().trim();
    const rowEmpresa = (data[i][4] || '').toString().trim().toUpperCase();
    if (rowNro === nro && rowEmpresa === empresa.toUpperCase()) {
      return jsonResponse({ duplicado: true, entry: i + 1 });
    }
  }

  return jsonResponse({ duplicado: false });
}

// ─── CARGAR FACTURA ───────────────────────────────────────────────
function handleCargarFactura(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(VENTAS_SHEET);

  // Obtener días de plazo y descuento del proveedor
  const provInfo = getProveedorInfo(ss, data.empresa);
  const diasPlazo = provInfo.dias || 0;
  const dtoFin = data.dto > 0 ? data.dto : (provInfo.dto || 0);

  // Calcular fechas
  const fechaCompra = parseDate(data.fecha);
  const fechaVto = new Date(fechaCompra);
  fechaVto.setDate(fechaVto.getDate() + diasPlazo);

  const fechaCompraStr = formatDate(fechaCompra);
  const fechaVtoStr = formatDate(fechaVto);

  // Calcular importes
  const importeOrig = parseFloat(data.importeOrig) || 0;
  const ncnd = parseFloat(data.ncnd) || 0;
  const importeFinal = importeOrig - ncnd - (importeOrig * dtoFin / 100);
  const tipo = data.tipo || 'B';
  const netoSinIva = tipo === 'A' ? importeFinal / 1.21 : importeFinal;

  // Obtener último ENTRY
  const lastRow = sheet.getLastRow();
  const entry = lastRow; // ENTRY es fórmula en col A, dejamos vacío para que la fórmula calcule

  // Construir fila (24 columnas: A a X)
  const newRow = [
    '',                          // A: ENTRY (fórmula automática)
    data.ingresadoPor || 'IA',   // B: INGRESADO POR
    data.vendedor || '',         // C: VENDEDOR
    data.razonSocial || '',      // D: RAZON SOCIAL
    data.empresa || '',          // E: EMPRESA
    fechaCompraStr,              // F: FECHA COMPRA
    diasPlazo,                   // G: DIAS PLAZO
    fechaVtoStr,                 // H: FECHA VTO
    tipo,                        // I: TIPO
    importeOrig,                 // J: IMPORTE ORIG
    ncnd,                        // K: NC/ND
    dtoFin,                      // L: DTO %
    importeFinal,                // M: IMPORTE FINAL
    netoSinIva,                  // N: NETO SIN IVA
    'PENDIENTE',                 // O: ESTADO AUTO
    'PENDIENTE',                 // P: STATUS
    '',                          // Q: FECHA PAGO
    'NO',                        // R: NOTIFICADO
    data.observaciones || '',    // S: OBSERVACIONES
    data.nroComprobante || '',   // T: NRO COMPROBANTE
    '',                          // U: CONTACTO COMPRAS (fórmula)
    '',                          // V: TEL COMPRAS (fórmula)
    '',                          // W: CONTACTO COBRANZA (fórmula)
    ''                           // X: TEL COBRANZA (fórmula)
  ];

  sheet.appendRow(newRow);

  return jsonResponse({ success: true, fila: lastRow + 1 });
}

// ─── HELPERS ──────────────────────────────────────────────────────
function getProveedorInfo(ss, empresa) {
  if (!empresa) return { dias: 0, dto: 0 };
  try {
    const sheet = ss.getSheetByName(PROVEEDORES_SHEET);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const nombre = (data[i][0] || '').toString().trim().toUpperCase();
      if (nombre === empresa.toUpperCase()) {
        return {
          dias: parseInt(data[i][1]) || 0,
          dto: parseFloat(data[i][2]) || 0
        };
      }
    }
  } catch (e) {}
  return { dias: 0, dto: 0 };
}

function parseDate(str) {
  if (!str) return new Date();
  // dd/mm/yyyy
  const parts = str.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  // yyyy-mm-dd
  return new Date(str);
}

function formatDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
