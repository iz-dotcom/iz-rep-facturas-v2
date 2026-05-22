// IZ REP — Lector de Facturas v2.0
// app.js

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz-tJdwpa9IVfjMuv8HVgXlFW8BCPbiXDwGLF9p34bJLIga05GytWq1_ywsP1SN55m4-A/exec';

// ─── ESTADO GLOBAL ────────────────────────────────────────────────
let currentTab = 'archivo';
let selectedFile = null;
let formReady = false;

// ─── TABS ─────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    currentTab = tab;

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');

    // Tab manual: mostrar formulario directo
    if (tab === 'manual') {
      showForm('manual');
    } else {
      hideForm();
    }
  });
});

// ─── UPLOAD / DRAG & DROP ─────────────────────────────────────────
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name-display');
const btnAnalyzeFile = document.getElementById('btn-analyze-file');

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

function handleFile(file) {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(file.type)) {
    showStatus('error', 'Formato no soportado. Usá PDF, JPG, PNG o WEBP.');
    return;
  }
  selectedFile = file;
  fileNameDisplay.textContent = file.name;
  dropzone.classList.add('has-file');
  btnAnalyzeFile.disabled = false;
}

// ─── ANALIZAR ARCHIVO ─────────────────────────────────────────────
btnAnalyzeFile.addEventListener('click', async () => {
  if (!selectedFile) return;

  const loader = document.getElementById('loader-file');
  btnAnalyzeFile.disabled = true;
  loader.classList.add('visible');
  hideForm();

  try {
    const base64 = await fileToBase64(selectedFile);
    const mediaType = selectedFile.type;
    const isImage = mediaType.startsWith('image/');

    const payload = isImage
      ? { type: 'image', data: base64, mediaType }
      : { type: 'pdf', data: base64 };

    const result = await callAnalyzeAPI(payload);
    populateForm(result, 'IA');
    showForm('ia');
  } catch (err) {
    showStatus('error', 'Error al analizar: ' + err.message);
  } finally {
    loader.classList.remove('visible');
    btnAnalyzeFile.disabled = false;
  }
});

// ─── ANALIZAR TEXTO ───────────────────────────────────────────────
document.getElementById('btn-analyze-text').addEventListener('click', async () => {
  const text = document.getElementById('text-input').value.trim();
  if (!text) {
    showStatus('error', 'Pegá el texto de la factura primero.');
    return;
  }

  const loader = document.getElementById('loader-text');
  document.getElementById('btn-analyze-text').disabled = true;
  loader.classList.add('visible');
  hideForm();

  try {
    const result = await callAnalyzeAPI({ type: 'text', text });
    populateForm(result, 'IA');
    showForm('ia');
  } catch (err) {
    showStatus('error', 'Error al analizar: ' + err.message);
  } finally {
    loader.classList.remove('visible');
    document.getElementById('btn-analyze-text').disabled = false;
  }
});

// ─── LLAMADA A NETLIFY FUNCTION ───────────────────────────────────
async function callAnalyzeAPI(payload) {
  const response = await fetch('/api/analizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Error en el servidor (' + response.status + ')');
  }

  return response.json();
}

// ─── FORMULARIO ───────────────────────────────────────────────────
function showForm(mode) {
  document.getElementById('form-divider').style.display = 'block';
  document.getElementById('form-section').classList.add('visible');

  const ingresadoSelect = document.getElementById('f-ingresado');

  if (mode === 'manual') {
    ingresadoSelect.value = 'IZ';
    ingresadoSelect.disabled = false;
    // En manual no hay datos de IA
    clearFormFields();
    // Remover clase ia-filled de todos
    document.querySelectorAll('.ia-filled').forEach(el => el.classList.remove('ia-filled'));
  } else {
    // IA
    ingresadoSelect.value = 'IA';
    ingresadoSelect.disabled = true;
  }

  formReady = true;
  validateForm();
}

function hideForm() {
  document.getElementById('form-divider').style.display = 'none';
  document.getElementById('form-section').classList.remove('visible');
  document.getElementById('status-bar').classList.remove('visible');
  document.getElementById('validation-msg').classList.remove('visible');
  formReady = false;
}

function clearFormFields() {
  const ids = ['f-vendedor', 'f-tipo', 'f-razon-social', 'f-empresa', 'f-fecha', 'f-nro-comprobante', 'f-importe', 'f-ncnd', 'f-dto', 'f-obs'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      el.classList.remove('invalid', 'filled', 'ia-filled');
    }
  });
}

function populateForm(data, source) {
  // Mapeamos los campos del JSON al formulario
  const mapping = {
    'f-vendedor': data.vendedor || '',
    'f-tipo': normalizeTipo(data.tipo),
    'f-razon-social': data.razonSocial || '',
    'f-empresa': data.empresa || '',
    'f-fecha': formatDateInput(data.fecha),
    'f-nro-comprobante': data.nroComprobante || '',
    'f-importe': data.importe || '',
    'f-ncnd': data.ncnd || '',
    'f-dto': data.dto || '',
    'f-obs': data.observaciones || ''
  };

  Object.entries(mapping).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val;
    el.classList.remove('invalid', 'filled', 'ia-filled');
    if (val && source === 'IA') el.classList.add('ia-filled');
    else if (val) el.classList.add('filled');
  });
}

// Normalizar tipo: R y X → B
function normalizeTipo(tipo) {
  if (!tipo) return '';
  const t = tipo.toString().toUpperCase().trim();
  if (t === 'R' || t === 'X') return 'B';
  if (['A', 'B', 'E'].includes(t)) return t;
  return '';
}

// Fecha de dd/mm/yyyy o similar a formato input date (yyyy-mm-dd)
function formatDateInput(raw) {
  if (!raw) return '';
  // Si ya viene en formato yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // dd/mm/yyyy
  const match = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return '';
}

// ─── VALIDACIÓN ───────────────────────────────────────────────────
const REQUIRED_FIELDS = ['f-vendedor', 'f-tipo', 'f-razon-social', 'f-empresa', 'f-fecha', 'f-nro-comprobante', 'f-importe'];

function validateForm() {
  if (!formReady) return;

  let allOk = true;
  REQUIRED_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const ok = el.value.trim() !== '';
    el.classList.toggle('invalid', !ok);
    if (!ok) allOk = false;
  });

  document.getElementById('btn-submit').disabled = !allOk;
  document.getElementById('validation-msg').classList.toggle('visible', !allOk);
  return allOk;
}

// Escuchar cambios en todos los campos requeridos
REQUIRED_FIELDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', validateForm);
    el.addEventListener('change', validateForm);
  }
});

// ─── SUBMIT ───────────────────────────────────────────────────────
document.getElementById('btn-submit').addEventListener('click', async () => {
  if (!validateForm()) return;

  // 1. Verificar duplicado
  const nroComp = document.getElementById('f-nro-comprobante').value.trim();
  const empresa = document.getElementById('f-empresa').value.trim();

  showStatus('info', 'Verificando duplicados...');

  try {
    const dupResult = await checkDuplicado(nroComp, empresa);
    if (dupResult.duplicado) {
      showDuplicadoModal(nroComp, empresa, dupResult.entry);
      return;
    }
  } catch (e) {
    // Si falla la verificación, seguimos igual (mejor cargar que bloquear)
    console.warn('Verificación duplicado fallida:', e);
  }

  await cargarFactura();
});

async function checkDuplicado(nroComp, empresa) {
  const res = await fetch(`/api/verificar-duplicado?nro=${encodeURIComponent(nroComp)}&empresa=${encodeURIComponent(empresa)}`);
  if (!res.ok) throw new Error('Error verificando duplicado');
  return res.json();
}

function showDuplicadoModal(nro, empresa, entry) {
  document.getElementById('modal-body').innerHTML =
    `El comprobante <strong>${nro}</strong> de <strong>${empresa}</strong> ya existe en el sheet (fila ${entry || '?'}).<br/><br/>¿Querés cargarlo igual?`;
  document.getElementById('modal-duplicado').classList.add('visible');
  document.getElementById('status-bar').classList.remove('visible');
}

document.getElementById('modal-cancelar').addEventListener('click', () => {
  document.getElementById('modal-duplicado').classList.remove('visible');
  showStatus('info', 'Carga cancelada.');
});

document.getElementById('modal-confirmar').addEventListener('click', async () => {
  document.getElementById('modal-duplicado').classList.remove('visible');
  await cargarFactura();
});

// ─── CARGAR AL SHEET ──────────────────────────────────────────────
async function cargarFactura() {
  document.getElementById('btn-submit').disabled = true;
  showStatus('info', 'Cargando al sheet...');

  const tipo = document.getElementById('f-tipo').value;
  const importe = parseFloat(document.getElementById('f-importe').value) || 0;

  const payload = {
    action: 'cargarFactura',
    ingresadoPor: document.getElementById('f-ingresado').value,
    vendedor: document.getElementById('f-vendedor').value,
    razonSocial: document.getElementById('f-razon-social').value.trim(),
    empresa: document.getElementById('f-empresa').value,
    fecha: formatDateSheet(document.getElementById('f-fecha').value),
    tipo: tipo,
    importeOrig: importe,
    ncnd: parseFloat(document.getElementById('f-ncnd').value) || 0,
    dto: parseFloat(document.getElementById('f-dto').value) || 0,
    observaciones: document.getElementById('f-obs').value.trim(),
    nroComprobante: document.getElementById('f-nro-comprobante').value.trim()
  };

  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=cargarFactura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors' // Apps Script requiere esto
    });

    // no-cors no devuelve body, asumimos éxito si no hay error
    showStatus('success', '✓ Factura cargada correctamente.');
    document.getElementById('btn-nueva').style.display = 'inline-block';

  } catch (err) {
    showStatus('error', 'Error al cargar: ' + err.message);
    document.getElementById('btn-submit').disabled = false;
  }
}

// Fecha yyyy-mm-dd → dd/mm/yyyy para el sheet
function formatDateSheet(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── NUEVA FACTURA ────────────────────────────────────────────────
document.getElementById('btn-nueva').addEventListener('click', () => {
  // Limpiar todo
  clearFormFields();
  hideForm();

  // Reset upload
  selectedFile = null;
  fileInput.value = '';
  fileNameDisplay.textContent = '';
  dropzone.classList.remove('has-file');
  btnAnalyzeFile.disabled = true;

  // Reset texto
  document.getElementById('text-input').value = '';

  // Volver al tab actual activo
  if (currentTab === 'manual') {
    showForm('manual');
  }
});

// ─── STATUS BAR ───────────────────────────────────────────────────
function showStatus(type, msg) {
  const bar = document.getElementById('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar visible ' + type;
}

// ─── UTIL: FILE → BASE64 ──────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
