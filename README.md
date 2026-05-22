# IZ REP — Lector de Facturas v2.0

## Archivos del proyecto

```
iz-rep-facturas-v2/
├── index.html                    ← Frontend principal
├── app.js                        ← Lógica frontend
├── netlify.toml                  ← Config Netlify + redirects
├── netlify/
│   └── functions/
│       ├── analizar.js           ← IA: analiza PDF/imagen/texto
│       └── verificar-duplicado.js ← Consulta duplicados al sheet
└── apps-script/
    └── codigo.gs                 ← Código para Google Apps Script
```

## Setup paso a paso

### 1. Google Apps Script
1. Ir a script.google.com
2. Abrir el proyecto existente de IZ REP
3. Reemplazar TODO el código con el contenido de `apps-script/codigo.gs`
4. Guardar (Ctrl+S)
5. Desplegar → Administrar implementaciones → Nueva implementación
6. Tipo: Aplicación web / Ejecutar como: yo / Acceso: Cualquier usuario
7. Copiar la nueva URL y reemplazar en `netlify/functions/verificar-duplicado.js` y `app.js`

### 2. GitHub
1. Crear repositorio nuevo: `iz-rep-facturas-v2`
2. Subir todos los archivos (sin la carpeta apps-script)

### 3. Netlify
1. Crear nuevo sitio desde GitHub
2. Build command: (vacío)
3. Publish directory: `.`
4. En Environment variables agregar:
   - `ANTHROPIC_API_KEY` = (la clave de platform.claude.com)
5. Deploy

## Funcionalidades v2.0 (base)
- [x] Tab Archivo: subir PDF o imagen → IA extrae datos → formulario editable
- [x] Tab Texto: pegar texto → IA extrae datos → formulario editable
- [x] Tab Manual: ingreso manual directo
- [x] Validación de campos obligatorios (resaltado rojo)
- [x] Botón deshabilitado hasta completar todos los campos
- [x] Detección de duplicados con modal
- [x] Botón "Nueva factura" para limpiar sin recargar
- [x] Soporte R y X → convierte a tipo B automáticamente
- [x] Prompt IA con todos los mapeos de proveedores

## Próximas versiones (beta separada)
- [ ] Operaciones al 50% (EVACOR / CLANDESTINE)
- [ ] Panel de alta de proveedores
- [ ] Verificación de cliente por vendedor
- [ ] Condiciones comerciales por proveedor
