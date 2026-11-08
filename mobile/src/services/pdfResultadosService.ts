import { Platform } from "react-native";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  getDownloadURL,
  getStorage,
  ref,
} from "firebase/storage";

import type {
  InformeClinico,
  ParametroInforme,
} from "./informeResultadosService";

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

function estaValidado(
  informe: InformeClinico
): boolean {
  return [
    "validado",
    "finalizado",
    "completado",
    "entregado",
  ].includes(
    texto(informe.estado).toLowerCase()
  );
}

// =====================================================
// RESOLVER LOGOTIPO
// =====================================================

async function resolverLogo(
  logoOriginal: string
): Promise<string> {
  const logo = texto(logoOriginal);

  if (!logo) {
    return "";
  }

  if (
    logo.startsWith("data:image/")
  ) {
    return logo;
  }

  if (
    logo.startsWith("gs://")
  ) {
    try {
      const storage = getStorage();

      return await getDownloadURL(
        ref(storage, logo)
      );
    } catch (error) {
      console.warn(
        "No se pudo obtener el logo de Firebase Storage:",
        error
      );

      return "";
    }
  }

  if (
    /^https?:\/\//i.test(logo)
  ) {
    return logo;
  }

  // Ruta relativa dentro de Firebase Storage.
  try {
    const storage = getStorage();

    return await getDownloadURL(
      ref(storage, logo)
    );
  } catch {
    return "";
  }
}

async function convertirLogoBase64(
  logoOriginal: string
): Promise<string> {
  const url = await resolverLogo(
    logoOriginal
  );

  if (!url) {
    return "";
  }

  if (
    url.startsWith("data:image/")
  ) {
    return url;
  }

  try {
    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      return url;
    }

    const blob = await respuesta.blob();

    // En Web se puede utilizar FileReader.
    if (Platform.OS === "web") {
      return await new Promise<string>(
        (resolve) => {
          const lector = new FileReader();

          lector.onload = () => {
            resolve(
              String(lector.result || url)
            );
          };

          lector.onerror = () => {
            resolve(url);
          };

          lector.readAsDataURL(blob);
        }
      );
    }

    // En Mobile, expo-print puede utilizar
    // URLs HTTPS, aunque Base64 es más fiable.
    // Se conserva la URL si no existe una
    // conversión compatible disponible.
    return url;
  } catch {
    return url;
  }
}

function crearLogo(
  logo: string
): string {
  if (!logo) {
    return "";
  }

  return `
    <div class="logo">
      <img
        src="${escapar(logo)}"
        alt="Logo del laboratorio"
      />
    </div>
  `;
}

// =====================================================
// PARÁMETROS
// =====================================================

function obtenerParametros(
  informe: InformeClinico
): ParametroInforme[] {
  const parametros = Array.isArray(
    informe.parametros
  )
    ? [...informe.parametros]
    : [];

  if (
    parametros.length === 0 &&
    texto(informe.valorResultado)
  ) {
    parametros.push({
      id: `general-${informe.id}`,

      nombre: informe.analisisNombre,

      valor: informe.valorResultado,

      unidad: informe.unidad,

      referencia: informe.referencia,

      observacion:
        informe.observaciones,
    });
  }

  return parametros;
}

function crearFilas(
  informe: InformeClinico
): string {
  const parametros = obtenerParametros(
    informe
  );

  if (!parametros.length) {
    return `
      <tr>
        <td colspan="5" class="sin-datos">
          Sin parámetros registrados.
        </td>
      </tr>
    `;
  }

  return parametros
    .map((parametro) => {
      const valor =
        texto(parametro.valor) ||
        "Sin resultado registrado";

      return `
        <tr>
          <td>
            ${mostrar(parametro.nombre)}
          </td>

          <td class="resultado">
            ${escapar(valor)}
          </td>

          <td class="centro">
            ${mostrar(parametro.unidad)}
          </td>

          <td class="centro">
            ${mostrar(parametro.referencia)}
          </td>

          <td class="centro">
            ${mostrar(parametro.observacion)}
          </td>
        </tr>
      `;
    })
    .join("");
}

// =====================================================
// ANÁLISIS
// =====================================================

function crearAnalisis(
  informe: InformeClinico
): string {
  return `
    <section class="analisis">

      <div class="titulo-seccion">
        ${mostrar(
          informe.analisisNombre.toUpperCase()
        )}
      </div>

      <table class="tabla-muestra">
        <tr>
          <td>
            Muestra:
            ${mostrar(informe.tipoMuestra)}
          </td>

          <td>
            N.º:
            ${mostrar(informe.numeroMuestra)}
          </td>

          <td>
            Fecha:
            ${mostrar(informe.fechaToma)}
          </td>
        </tr>
      </table>

      <table class="tabla-resultados">
        <thead>
          <tr>
            <th>PARÁMETRO</th>
            <th>RESULTADO</th>
            <th>UNIDAD</th>
            <th>REFERENCIA</th>
            <th>OBS.</th>
          </tr>
        </thead>

        <tbody>
          ${crearFilas(informe)}
        </tbody>
      </table>

      <div class="observaciones">
        <strong>
          OBSERVACIONES:
        </strong>

        <p>
          ${mostrar(informe.observaciones)}
        </p>
      </div>

      <div class="validacion">
        <span>
          Validado por:
          ${mostrar(informe.validadoPorNombre)}
        </span>

        <span>
          Fecha:
          ${mostrar(informe.fechaValidacion)}
        </span>
      </div>

    </section>
  `;
}

// =====================================================
// HTML COMPLETO
// =====================================================

function crearHTML(
  informes: InformeClinico[],
  logo: string
): string {
  const principal = informes[0];

  const fechaImpresion =
    new Date().toLocaleString("es-BO");

  return `
<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8" />

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

<style>

@page {
  size: A4;
  margin: 12mm 13mm 16mm 13mm;
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
  font-family: Arial, Helvetica, sans-serif;
  color: #334155;
  background: #ffffff;
  font-size: 10px;
  line-height: 1.45;

  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.barra-superior {
  background: #2563eb;
  height: 10px;
  margin-bottom: 14px;
}

.encabezado {
  background: #f5f7fa;
  border: 1px solid #dce5f0;
  padding: 14px 20px;
  min-height: 112px;
}

.tabla-encabezado {
  width: 100%;
  border-collapse: collapse;
}

.tabla-encabezado td {
  border: none;
  vertical-align: middle;
}

.celda-logo {
  width: 120px;
}

.logo {
  width: 95px;
  height: 95px;
  text-align: center;
}

.logo img {
  max-width: 95px;
  max-height: 95px;
  object-fit: contain;
}

.nombre-laboratorio {
  color: #2563eb;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 7px;
}

.dato-laboratorio {
  font-size: 10px;
  color: #475569;
  line-height: 1.6;
}

.titulo-principal {
  background: #2563eb;
  color: white;
  border-radius: 7px;
  text-align: center;
  font-size: 15px;
  font-weight: bold;
  padding: 13px;
  margin: 12px 0 17px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

.tabla-datos {
  table-layout: fixed;
}

.tabla-datos td {
  border: 1px solid #dce5f0;
  padding: 9px;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.etiqueta {
  background: #eef1f7;
  color: #263445;
  font-weight: bold;
}

.valor {
  background: white;
}

.titulo-seccion {
  background: #eaf2f8;
  border-left: 8px solid #2563eb;
  border-radius: 0 5px 5px 0;
  color: #2563eb;
  font-size: 11px;
  font-weight: bold;
  padding: 11px 13px;
  margin-top: 20px;
  margin-bottom: 12px;

  page-break-after: avoid;
  break-after: avoid;
}

.tabla-muestra {
  margin: 9px 0;
}

.tabla-muestra td {
  width: 33.33%;
  padding: 8px;
  color: #64748b;
  font-size: 9px;
}

.tabla-resultados {
  table-layout: fixed;
}

.tabla-resultados thead {
  display: table-header-group;
}

.tabla-resultados th {
  background: #2563eb;
  color: #ffffff;
  border: 1px solid #dce5f0;
  padding: 11px 6px;
  font-size: 9px;
  text-align: center;
}

.tabla-resultados td {
  border: 1px solid #dce5f0;
  padding: 10px 7px;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.tabla-resultados tbody tr:nth-child(odd) {
  background: #f4f7fb;
}

.tabla-resultados tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

.tabla-resultados th:nth-child(1) {
  width: 30%;
}

.tabla-resultados th:nth-child(2) {
  width: 17%;
}

.tabla-resultados th:nth-child(3) {
  width: 13%;
}

.tabla-resultados th:nth-child(4) {
  width: 23%;
}

.tabla-resultados th:nth-child(5) {
  width: 17%;
}

.resultado {
  text-align: center;
  font-weight: bold;
}

.centro {
  text-align: center;
}

.sin-datos {
  text-align: center;
  color: #64748b;
}

.observaciones {
  margin-top: 14px;
  margin-bottom: 30px;
}

.observaciones strong {
  color: #2563eb;
  font-size: 10px;
}

.observaciones p {
  color: #475569;
  margin-top: 5px;
}

.validacion {
  border-top: 1px solid #dce5f0;
  padding-top: 12px;
  margin-top: 15px;

  display: flex;
  justify-content: space-between;
  gap: 20px;

  color: #64748b;
  font-size: 9px;
}

.fin-informe {
  border-top: 2px solid #2563eb;
  margin-top: 42px;
  padding-top: 18px;
  text-align: center;
  color: #2563eb;
  font-weight: bold;
  font-size: 10px;
}

.mensaje-final {
  text-align: center;
  color: #64748b;
  font-size: 9px;
  margin-top: 9px;
}

.pie {
  border-top: 1px solid #dce5f0;
  margin-top: 65px;
  padding-top: 11px;

  display: flex;
  justify-content: space-between;

  color: #64748b;
  font-size: 9px;
}

.pie-final {
  text-align: center;
  color: #94a3b8;
  font-size: 8px;
  margin-top: 7px;
}

@media print {
  .encabezado {
    page-break-inside: avoid;
  }

  .tabla-datos {
    page-break-inside: avoid;
  }

  .titulo-seccion {
    page-break-after: avoid;
  }
}

</style>

</head>

<body>

<div class="barra-superior"></div>

<!-- LABORATORIO -->

<div class="encabezado">

  <table class="tabla-encabezado">
    <tr>

      <td class="celda-logo">
        ${crearLogo(logo)}
      </td>

      <td>

        <div class="nombre-laboratorio">
          ${mostrar(principal.laboratorioNombre)}
        </div>

        <div class="dato-laboratorio">
          ${mostrar(principal.laboratorioDireccion)}
        </div>

        <div class="dato-laboratorio">
          Tel.: ${mostrar(principal.laboratorioTelefono)}
        </div>

        <div class="dato-laboratorio">
          ${mostrar(principal.laboratorioCorreo)}
        </div>

      </td>

    </tr>
  </table>

</div>

<!-- TÍTULO -->

<div class="titulo-principal">
  INFORME DE RESULTADOS CLÍNICOS
</div>

<!-- PACIENTE -->

<table class="tabla-datos">

  <colgroup>
    <col style="width:13%">
    <col style="width:40%">
    <col style="width:11%">
    <col style="width:36%">
  </colgroup>

  <tr>
    <td class="etiqueta">
      PACIENTE
    </td>

    <td class="valor">
      ${mostrar(principal.pacienteNombre)}
    </td>

    <td class="etiqueta">
      EDAD
    </td>

    <td class="valor">
      ${mostrar(principal.pacienteEdad)}
    </td>
  </tr>

  <tr>
    <td class="etiqueta">
      CI
    </td>

    <td class="valor">
      ${mostrar(principal.pacienteCI)}
    </td>

    <td class="etiqueta">
      SEXO
    </td>

    <td class="valor">
      ${mostrar(principal.pacienteSexo)}
    </td>
  </tr>

  <tr>
    <td class="etiqueta">
      CORREO
    </td>

    <td class="valor">
      ${mostrar(principal.pacienteCorreo)}
    </td>

    <td class="etiqueta">
      FECHA
    </td>

    <td class="valor">
      ${mostrar(principal.fechaRegistro)}
    </td>
  </tr>

</table>

<!-- ORDEN -->

<div class="titulo-seccion">
  INFORMACIÓN DE LA ORDEN
</div>

<table class="tabla-datos">

  <colgroup>
    <col style="width:21%">
    <col style="width:32%">
    <col style="width:17%">
    <col style="width:30%">
  </colgroup>

  <tr>
    <td class="etiqueta">
      N.º ORDEN
    </td>

    <td class="valor">
      ${mostrar(principal.numeroOrden)}
    </td>

    <td class="etiqueta">
      N.º MUESTRA
    </td>

    <td class="valor">
      ${mostrar(principal.numeroMuestra)}
    </td>
  </tr>

  <tr>
    <td class="etiqueta">
      REGISTRO
    </td>

    <td class="valor">
      ${mostrar(principal.fechaRegistro)}
    </td>

    <td class="etiqueta">
      VALIDACIÓN
    </td>

    <td class="valor">
      ${mostrar(principal.fechaValidacion)}
    </td>
  </tr>

  <tr>
    <td class="etiqueta">
      ESTADO
    </td>

    <td class="valor">
      ${mostrar(principal.estado)}
    </td>

    <td class="etiqueta">
      ANÁLISIS
    </td>

    <td class="valor">
      ${informes.length}
    </td>
  </tr>

</table>

<!-- ANÁLISIS -->

${informes.map(crearAnalisis).join("")}

<!-- FIN -->

<div class="fin-informe">
  FIN DEL INFORME
</div>

<div class="mensaje-final">
  Los resultados corresponden a los registros
  validados disponibles.
</div>

<!-- PIE -->

<div class="pie">

  <span>
    ${mostrar(principal.laboratorioNombre)}
  </span>

  <span>
    Impreso:
    ${escapar(fechaImpresion)}
  </span>

</div>

<div class="pie-final">
  Documento generado con la información
  registrada en el sistema.
</div>

</body>

</html>
`;
}

// =====================================================
// GENERAR DOCUMENTO
// =====================================================

async function generarDocumento(
  informes: InformeClinico[]
): Promise<void> {
  if (!informes.length) {
    throw new Error(
      "No existen informes clínicos."
    );
  }

  const logo = await convertirLogoBase64(
    informes[0].laboratorioLogo
  );

  const html = crearHTML(
    informes,
    logo
  );

  if (Platform.OS === "web") {
    await Print.printAsync({
      html,
    });

    return;
  }

  const archivo = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
  });

  const disponible =
    await Sharing.isAvailableAsync();

  if (!disponible) {
    throw new Error(
      "El dispositivo no permite compartir archivos PDF."
    );
  }

  await Sharing.shareAsync(archivo.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Informe de resultados clínicos",
    UTI: "com.adobe.pdf",
  });
}

// =====================================================
// PDF INDIVIDUAL
// =====================================================

export async function generarPDFResultado(
  informe: InformeClinico
): Promise<void> {
  if (!estaValidado(informe)) {
    throw new Error(
      "El resultado todavía no está validado."
    );
  }

  await generarDocumento([informe]);
}

// =====================================================
// PDF DE ORDEN COMPLETA
// =====================================================

export async function generarPDFResultadosOrden(
  informes: InformeClinico[]
): Promise<void> {
  if (!informes.length) {
    throw new Error(
      "No existen resultados para esta orden."
    );
  }

  const principal = informes[0];

  const mismaOrden = informes.every(
    (informe) =>
      informe.ordenId === principal.ordenId &&
      informe.pacienteId === principal.pacienteId &&
      informe.laboratorioId === principal.laboratorioId
  );

  if (!principal.ordenId || !mismaOrden) {
    throw new Error(
      "Los resultados no pertenecen a la misma orden."
    );
  }

  if (!informes.every(estaValidado)) {
    throw new Error(
      "Existen resultados sin validar."
    );
  }

  await generarDocumento(informes);
}