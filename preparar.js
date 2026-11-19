const fs = require('fs');
const path = require('path');

const CARPETA_ENTRADA = '.';
const CARPETA_SALIDA = './salida';

if (!fs.existsSync(CARPETA_SALIDA)) {
  fs.mkdirSync(CARPETA_SALIDA);
}

const archivos = fs.readdirSync(CARPETA_ENTRADA).filter(f => 
  f.endsWith('.xls') && !f.includes('limpio')
);

if (archivos.length === 0) {
  console.log('ERROR: No hay archivos .xls');
  process.exit(1);
}

const archivoEntrada = archivos[0];
console.log('Leyendo: ' + archivoEntrada);

const contenido = fs.readFileSync(archivoEntrada).toString('latin1');

function parseTSV(texto) {
  const registros = [];
  let registroActual = [];
  let campoActual = '';
  let dentroComillas = false;
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];
    const next = texto[i + 1];

    if (c === '"') {
      if (dentroComillas && next === '"') {
        campoActual += '"';
        i += 2;
        continue;
      }
      dentroComillas = !dentroComillas;
      i++;
      continue;
    }

    if (c === '\t' && !dentroComillas) {
      registroActual.push(campoActual);
      campoActual = '';
      i++;
      continue;
    }

    if ((c === '\n' || c === '\r') && !dentroComillas) {
      if (c === '\r' && next === '\n') { i++; }
      registroActual.push(campoActual);
      if (registroActual.some(x => x.trim() !== '')) {
        registros.push(registroActual);
      }
      registroActual = [];
      campoActual = '';
      i++;
      continue;
    }

    campoActual += c;
    i++;
  }

  if (campoActual !== '' || registroActual.length > 0) {
    registroActual.push(campoActual);
    if (registroActual.some(x => x.trim() !== '')) {
      registros.push(registroActual);
    }
  }

  return registros;
}

console.log('Parseando...');
const registros = parseTSV(contenido);
console.log('Registros parseados: ' + registros.length);

const productos = [];
let errores = 0;

for (let idx = 1; idx < registros.length; idx++) {
  const campos = registros[idx].map(c => c.trim());
  if (campos.length < 7) {
    errores++;
    continue;
  }

  const codigo = campos[0];
  const codigoFab = campos[1];
  const descripcion = campos[2];
  const rubro = campos[3] || '';
  const marca = campos[4] || '';
  const stockTexto = campos[5] || '';
  const precioTexto = campos[6] || '';

  let precio = 0;
  const precioLimpio = precioTexto.replace(/[^\d.,]/g, '').replace(',', '.');
  if (precioLimpio) {
    precio = parseFloat(precioLimpio);
  }

  if (!codigo || !descripcion || isNaN(precio) || precio === 0) {
    errores++;
    continue;
  }

  productos.push({
    codigo: codigo,
    codigoFab: codigoFab,
    descripcion: descripcion,
    rubro: rubro,
    marca: marca,
    precio: precio,
    stock: stockTexto.toLowerCase().includes('si')
  });
}

console.log('Productos validos: ' + productos.length);
console.log('Productos con error: ' + errores);

const preciosMap = {};
productos.forEach(p => {
  preciosMap[p.codigo] = {
    precio: p.precio,
    stock: p.stock,
    marca: p.marca
  };
});

const jsonSalida = path.join(CARPETA_SALIDA, 'precios.json');
fs.writeFileSync(jsonSalida, JSON.stringify(preciosMap, null, 2), 'utf8');
console.log('JSON generado: ' + jsonSalida);
console.log('LISTO: ' + productos.length + ' productos');
