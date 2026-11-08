import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// =====================================================
// TIPOS
// =====================================================

export type AnalisisPDF = {
  nombre?: string;
  tipo?: string;
  cantidad?: number | string;
  precio?: number | string;
};

export type DatosVentaPDF = {
  codigo?: string;
  fecha?: string;

  laboratorio?: string;
  laboratorioLogo?: string;
  laboratorioDireccion?: string;
  laboratorioTelefono?: string;
  laboratorioCorreo?: string;

  paciente?: string;
  ci?: string;
  edad?: string;
  sexo?: string;
  correo?: string;

  ordenId?: string;
  solicitudId?: string;

  metodoPago?: string;
  estado?: string;

  analisis?: AnalisisPDF[];
  total?: number | string;
};

export type DatosAnalisisPDF = {
  codigo?: string;
  fecha?: string;

  laboratorio?: string;
  laboratorioLogo?: string;
  laboratorioDireccion?: string;
  laboratorioTelefono?: string;
  laboratorioCorreo?: string;

  paciente?: string;
  ci?: string;
  estado?: string;

  analisis?: AnalisisPDF[];
};

// =====================================================
// UTILIDADES
// =====================================================

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function escapar(valor: unknown): string {
  return texto(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mostrar(valor: unknown): string {
  return escapar(texto(valor) || "-");
}

function dinero(valor: unknown): string {
  const numero = Number(valor ?? 0);

  if (!Number.isFinite(numero)) {
    return "0,00";
  }

  return numero.toFixed(2).replace(".", ",");
}

function cantidad(valor: unknown): number {
  const numero = Number(valor ?? 1);

  return Number.isFinite(numero) && numero > 0
    ? numero
    : 1;
}

function crearLogo(logo?: string): string {
  const imagen = texto(logo);

  if (
    !/^https:\/\//i.test(imagen) &&
    !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imagen)
  ) {
    return "";
  }

  return `
    <div class="logo">
      <img src="${escapar(imagen)}" />
    </div>
  `;
}

// =====================================================
// ESTILOS DEL DOCUMENTO
// =====================================================

const estilos = `

@page {
  size: A4;
  margin: 12mm 13mm 14mm 13mm;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: white;
  color: #334155;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  line-height: 1.45;

  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* BARRA SUPERIOR */

.barra-superior {
  height: 10px;
  background: #2563eb;
  margin-bottom: 22px;
}

/* ENCABEZADO */

.encabezado {
  background: #f5f7fa;
  border: 1px solid #dbe4ef;

  min-height: 115px;

  padding: 15px 25px;

  display: flex;
  align-items: flex-start;
}

.logo {
  width: 95px;
  height: 95px;

  margin-right: 25px;

  display: flex;
  align-items: center;
  justify-content: center;
}

.logo img {
  max-width: 95px;
  max-height: 95px;
  object-fit: contain;
}

.datos-laboratorio {
  flex: 1;
}

.nombre-laboratorio {
  color: #2563eb;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 7px;
}

.detalle-laboratorio {
  font-size: 10px;
  color: #475569;
  line-height: 1.4;
}

/* TÍTULO */

.titulo-principal {
  margin-top: 12px;
  margin-bottom: 18px;

  background: #2563eb;
  color: white;

  border-radius: 7px;

  padding: 14px;

  text-align: center;

  font-size: 15px;
  font-weight: bold;
}

/* TABLAS DE DATOS */

.tabla-datos {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.tabla-datos td {
  border: 1px solid #dce5f0;
  padding: 10px 12px;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.tabla-datos .etiqueta {
  background: #eef1f7;
  color: #263445;
  font-weight: bold;
}

.tabla-datos .valor {
  background: white;
}

/* TÍTULOS DE SECCIÓN */

.titulo-seccion {
  background: #eaf2f8;

  border-left: 9px solid #2563eb;

  color: #2563eb;

  font-size: 12px;
  font-weight: bold;

  padding: 11px 15px;

  margin-top: 22px;
  margin-bottom: 14px;

  border-radius: 0 6px 6px 0;
}

/* TABLA DE ANÁLISIS */

.tabla-analisis {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.tabla-analisis th {
  background: #2563eb;
  color: white;

  text-align: left;

  padding: 12px 9px;

  font-size: 9px;

  border: 1px solid #dce5f0;
}

.tabla-analisis td {
  padding: 11px 9px;

  border: 1px solid #dce5f0;

  font-size: 10px;
  overflow-wrap: anywhere;
}

.tabla-analisis tbody tr:nth-child(odd) {
  background: #f4f7fb;
}

.centro {
  text-align: center;
}

.derecha {
  text-align: right;
}

/* TOTAL */

.total-contenedor {
  display: flex;
  justify-content: flex-end;
  margin-top: 35px;
}

.total {
  background: #eaf2f8;

  color: #2563eb;

  font-size: 17px;
  font-weight: bold;

  padding: 18px 24px;

  border-radius: 8px;

  min-width: 230px;

  text-align: right;
}

/* AGRADECIMIENTO */

.agradecimiento {
  margin-top: 35px;

  text-align: center;

  color: #64748b;

  font-size: 11px;
}

/* PIE */

.pie {
  border-top: 1px solid #dce5f0;

  margin-top: 100px;

  padding-top: 12px;

  display: flex;

  justify-content: space-between;

  font-size: 9px;

  color: #64748b;
}

.pie-final {
  text-align: center;

  margin-top: 8px;

  font-size: 8px;

  color: #64748b;
}

tr {
  page-break-inside: avoid;
}

thead {
  display: table-header-group;
}

`;

// =====================================================
// ENCABEZADO
// =====================================================

function encabezado(
  nombre: string,
  logo?: string,
  direccion?: string,
  telefono?: string,
  correo?: string
): string {
  return `

<div class="encabezado">

  ${crearLogo(logo)}

  <div class="datos-laboratorio">

    <div class="nombre-laboratorio">
      ${mostrar(nombre)}
    </div>

    <div class="detalle-laboratorio">
      ${mostrar(direccion)}
    </div>

    <div class="detalle-laboratorio">
      Tel.: ${mostrar(telefono)}
    </div>

    <div class="detalle-laboratorio">
      ${mostrar(correo)}
    </div>

  </div>

</div>

`;
}

// =====================================================
// PIE
// =====================================================

function pie(laboratorio: string): string {
  const fecha = new Date().toLocaleString("es-BO");

  return `

<div class="pie">

  <span>
    ${mostrar(laboratorio)}
  </span>

  <span>
    Impreso: ${escapar(fecha)}
  </span>

</div>

<div class="pie-final">
  Documento generado con la información registrada en el sistema.
</div>

`;
}

// =====================================================
// GENERAR PDF
// =====================================================

async function generarDocumento(
  html: string,
  titulo: string
): Promise<void> {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }

  const archivo = await Print.printToFileAsync({
    html,
  });

  const disponible = await Sharing.isAvailableAsync();

  if (!disponible) {
    throw new Error(
      "El dispositivo no permite compartir archivos PDF."
    );
  }

  await Sharing.shareAsync(archivo.uri, {
    mimeType: "application/pdf",
    dialogTitle: titulo,
    UTI: "com.adobe.pdf",
  });
}

// =====================================================
// GENERAR NOTA DE VENTA
// =====================================================

export async function generarPDFVenta(
  datos: DatosVentaPDF
): Promise<void> {
  const lista = Array.isArray(datos.analisis)
    ? datos.analisis
    : [];

  const filas = lista
    .map((item) => {
      const cant = cantidad(item.cantidad);

      const precio = Number(item.precio ?? 0);

      const precioValido =
        Number.isFinite(precio) ? precio : 0;

      const subtotal = cant * precioValido;

      return `

<tr>

<td>
  ${mostrar(item.nombre || item.tipo)}
</td>

<td class="centro">
  ${cant}
</td>

<td class="derecha">
  Bs ${dinero(precioValido)}
</td>

<td class="derecha">
  Bs ${dinero(subtotal)}
</td>

</tr>

`;
    })
    .join("");

  const totalCalculado = lista.reduce(
    (acumulado, item) => {
      const precio = Number(item.precio ?? 0);

      return (
        acumulado +
        cantidad(item.cantidad) *
          (Number.isFinite(precio) ? precio : 0)
      );
    },
    0
  );

  const total =
    datos.total !== undefined &&
    datos.total !== null &&
    texto(datos.total) !== ""
      ? datos.total
      : totalCalculado;

  const html = `

<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<style>
${estilos}
</style>

</head>

<body>

<div class="barra-superior"></div>

<!-- ENCABEZADO -->

${encabezado(
  datos.laboratorio || "Laboratorio Clínico",
  datos.laboratorioLogo,
  datos.laboratorioDireccion,
  datos.laboratorioTelefono,
  datos.laboratorioCorreo
)}

<!-- TÍTULO -->

<div class="titulo-principal">
  NOTA DE VENTA
</div>

<!-- DATOS DEL PACIENTE -->

<table class="tabla-datos">

<colgroup>
  <col style="width:12%">
  <col style="width:40%">
  <col style="width:11%">
  <col style="width:37%">
</colgroup>

<tr>

<td class="etiqueta">PACIENTE</td>

<td class="valor">
  ${mostrar(datos.paciente)}
</td>

<td class="etiqueta">EDAD</td>

<td class="valor">
  ${mostrar(datos.edad)}
</td>

</tr>

<tr>

<td class="etiqueta">CI</td>

<td class="valor">
  ${mostrar(datos.ci)}
</td>

<td class="etiqueta">SEXO</td>

<td class="valor">
  ${mostrar(datos.sexo)}
</td>

</tr>

<tr>

<td class="etiqueta">CORREO</td>

<td class="valor">
  ${mostrar(datos.correo)}
</td>

<td class="etiqueta">FECHA</td>

<td class="valor">
  ${mostrar(datos.fecha)}
</td>

</tr>

</table>

<!-- INFORMACIÓN DE VENTA -->

<div class="titulo-seccion">
  INFORMACIÓN DE LA VENTA
</div>

<table class="tabla-datos">

<colgroup>
  <col style="width:24%">
  <col style="width:76%">
</colgroup>

<tr>

<td class="etiqueta">N.º VENTA</td>

<td class="valor">
  ${mostrar(datos.codigo)}
</td>

</tr>

<tr>

<td class="etiqueta">N.º ORDEN</td>

<td class="valor">
  ${mostrar(datos.ordenId)}
</td>

</tr>

<tr>

<td class="etiqueta">N.º SOLICITUD</td>

<td class="valor">
  ${mostrar(datos.solicitudId)}
</td>

</tr>

<tr>

<td class="etiqueta">MÉTODO DE PAGO</td>

<td class="valor">
  ${mostrar(datos.metodoPago)}
</td>

</tr>

<tr>

<td class="etiqueta">ESTADO</td>

<td class="valor">
  ${mostrar(datos.estado)}
</td>

</tr>

<tr>

<td class="etiqueta">FECHA</td>

<td class="valor">
  ${mostrar(datos.fecha)}
</td>

</tr>

</table>

<!-- DETALLE -->

<div class="titulo-seccion">
  DETALLE DE ANÁLISIS
</div>

<table class="tabla-analisis">

<colgroup>
  <col style="width:47%">
  <col style="width:18%">
  <col style="width:15%">
  <col style="width:20%">
</colgroup>

<thead>

<tr>

<th>ANÁLISIS</th>
<th>CANTIDAD</th>
<th>PRECIO</th>
<th>SUBTOTAL</th>

</tr>

</thead>

<tbody>

${
  filas ||
  `
  <tr>
    <td colspan="4" class="centro">
      Sin análisis registrados.
    </td>
  </tr>
  `
}

</tbody>

</table>

<!-- TOTAL -->

<div class="total-contenedor">

  <div class="total">
    TOTAL: Bs ${dinero(total)}
  </div>

</div>

<!-- AGRADECIMIENTO -->

<div class="agradecimiento">
  Gracias por confiar en nuestros servicios.
</div>

<!-- PIE -->

${pie(
  datos.laboratorio || "Laboratorio Clínico"
)}

</body>

</html>

`;

  await generarDocumento(
    html,
    "Nota de venta"
  );
}

// =====================================================
// GENERAR SOLICITUD DE ANÁLISIS
// =====================================================

export async function generarPDFAnalisis(
  datos: DatosAnalisisPDF
): Promise<void> {
  const lista = Array.isArray(datos.analisis)
    ? datos.analisis
    : [];

  const filas = lista
    .map(
      (item, indice) => `

<tr>

<td class="centro">
  ${indice + 1}
</td>

<td>
  ${mostrar(item.nombre)}
</td>

<td>
  ${mostrar(item.tipo)}
</td>

</tr>

`
    )
    .join("");

  const html = `

<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<style>
${estilos}
</style>

</head>

<body>

<div class="barra-superior"></div>

${encabezado(
  datos.laboratorio || "Laboratorio Clínico",
  datos.laboratorioLogo,
  datos.laboratorioDireccion,
  datos.laboratorioTelefono,
  datos.laboratorioCorreo
)}

<div class="titulo-principal">
  SOLICITUD DE ANÁLISIS
</div>

<table class="tabla-datos">

<tr>

<td class="etiqueta">PACIENTE</td>

<td class="valor">
  ${mostrar(datos.paciente)}
</td>

</tr>

<tr>

<td class="etiqueta">CI</td>

<td class="valor">
  ${mostrar(datos.ci)}
</td>

</tr>

<tr>

<td class="etiqueta">N.º SOLICITUD</td>

<td class="valor">
  ${mostrar(datos.codigo)}
</td>

</tr>

<tr>

<td class="etiqueta">FECHA</td>

<td class="valor">
  ${mostrar(datos.fecha)}
</td>

</tr>

<tr>

<td class="etiqueta">ESTADO</td>

<td class="valor">
  ${mostrar(datos.estado)}
</td>

</tr>

</table>

<div class="titulo-seccion">
  ANÁLISIS SOLICITADOS
</div>

<table class="tabla-analisis">

<thead>

<tr>
  <th>N.º</th>
  <th>ANÁLISIS</th>
  <th>TIPO</th>
</tr>

</thead>

<tbody>

${
  filas ||
  `
  <tr>
    <td colspan="3" class="centro">
      Sin análisis registrados.
    </td>
  </tr>
  `
}

</tbody>

</table>

${pie(
  datos.laboratorio || "Laboratorio Clínico"
)}

</body>

</html>

`;

  await generarDocumento(
    html,
    "Solicitud de análisis"
  );
}