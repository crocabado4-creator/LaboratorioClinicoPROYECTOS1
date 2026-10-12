import { Platform } from "react-native";

export type AnalisisPDF = {
  nombre?: string;
  tipo?: string;
  precio?: number | string;
  cantidad?: number | string;
};

export type DatosVentaPDF = {
  codigo?: string;
  fecha?: string;
  laboratorio?: string;
  paciente?: string;
  ci?: string;
  metodoPago?: string;
  analisis?: AnalisisPDF[];
  total?: number | string;
};

export type DatosAnalisisPDF = {
  codigo?: string;
  fecha?: string;
  laboratorio?: string;
  paciente?: string;
  ci?: string;
  estado?: string;
  analisis?: AnalisisPDF[];
};

function dinero(valor: unknown): string {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero.toFixed(2) : "0.00";
}

function cantidad(valor: unknown): number {
  const numero = Number(valor ?? 1);
  return Number.isFinite(numero) && numero > 0 ? numero : 1;
}

function limpiarNombre(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

// Convierte texto a caracteres compatibles con la fuente
// Helvetica estándar de PDF.
function textoPDF(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// Generador PDF A4 sin dependencias.
// Usa los objetos básicos del formato PDF.
function crearPDF(
  titulo: string,
  codigo: string,
  informacion: string[],
  encabezados: string[],
  filas: string[][],
  total?: string
): Uint8Array {
  const ancho = 595;
  const alto = 842;
  const margen = 42;
  const contenido: string[] = [];
  const paginas: string[] = [];

  let y = 790;

  function comando(valor: string) {
    contenido.push(valor);
  }

  function texto(
    valor: string,
    x: number,
    posicionY: number,
    tamano = 10,
    negrita = false
  ) {
    comando(
      `BT /${negrita ? "F2" : "F1"} ${tamano} Tf ` +
      `${x} ${posicionY} Td (${textoPDF(valor)}) Tj ET`
    );
  }

  function linea(x1: number, y1: number, x2: number, y2: number) {
    comando(`0.82 0.87 0.91 RG ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function rectangulo(
    x: number,
    posicionY: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number
  ) {
    comando(`${r} ${g} ${b} rg ${x} ${posicionY} ${w} ${h} re f`);
  }

  function nuevaPagina() {
    if (contenido.length > 0) {
      paginas.push(contenido.join("\n"));
      contenido.length = 0;
    }

    y = 790;
  }

  function verificarEspacio(alturaNecesaria: number) {
    if (y - alturaNecesaria < 65) {
      nuevaPagina();
    }
  }

  function dividirTexto(valor: string, maximo: number): string[] {
    const palabras = String(valor).split(/\s+/);
    const resultado: string[] = [];
    let actual = "";

    for (const palabra of palabras) {
      const candidato = actual ? `${actual} ${palabra}` : palabra;

      if (candidato.length <= maximo) {
        actual = candidato;
      } else {
        if (actual) resultado.push(actual);

        if (palabra.length <= maximo) {
          actual = palabra;
        } else {
          for (let i = 0; i < palabra.length; i += maximo) {
            resultado.push(palabra.slice(i, i + maximo));
          }
          actual = "";
        }
      }
    }

    if (actual) resultado.push(actual);

    return resultado.length ? resultado : [""];
  }

  // CABECERA

  rectangulo(margen, y - 75, ancho - margen * 2, 85, 0.06, 0.46, 0.43);

  comando("1 1 1 rg");
  texto(titulo, margen + 15, y - 23, 18, true);

  const codigoLineas = dividirTexto(`Codigo: ${codigo}`, 65);

  codigoLineas.forEach((lineaCodigo, indice) => {
    texto(lineaCodigo, margen + 15, y - 45 - indice * 12, 10);
  });

  comando("0 0 0 rg");

  y -= 105;

  // INFORMACIÓN GENERAL

  texto("INFORMACION GENERAL", margen, y, 13, true);
  y -= 23;

  for (const dato of informacion) {
    const lineas = dividirTexto(dato, 90);

    verificarEspacio(lineas.length * 15 + 5);

    for (const parte of lineas) {
      texto(parte, margen, y, 10);
      y -= 15;
    }

    y -= 4;
  }

  y -= 15;
  verificarEspacio(55);

  texto("DETALLE", margen, y, 13, true);
  y -= 24;

  // TABLA

  const columnas = encabezados.length;

  const anchos =
    columnas === 5
      ? [30, 220, 55, 100, 105]
      : [40, 310, 160];

  const posiciones: number[] = [];
  let posicion = margen;

  for (const anchoColumna of anchos) {
    posiciones.push(posicion);
    posicion += anchoColumna;
  }

  function dibujarCabeceraTabla() {
    verificarEspacio(40);

    rectangulo(
      margen,
      y - 8,
      ancho - margen * 2,
      25,
      0.89,
      0.93,
      0.96
    );

    encabezados.forEach((encabezado, indice) => {
      texto(encabezado, posiciones[indice] + 4, y, 9, true);
    });

    y -= 28;
  }

  dibujarCabeceraTabla();

  const filasFinales =
    filas.length > 0
      ? filas
      : [encabezados.map((_, indice) =>
          indice === 1 ? "Sin detalles registrados" : ""
        )];

  for (const fila of filasFinales) {
    const celdas = fila.map((valor, indice) => {
      const maximo = Math.max(
        4,
        Math.floor(((anchos[indice] || 80) - 8) / 5)
      );

      return dividirTexto(String(valor ?? ""), maximo);
    });

    const maxLineas = Math.max(
      1,
      ...celdas.map((celda) => celda.length)
    );

    const alturaFila = maxLineas * 13 + 12;

    if (y - alturaFila < 65) {
      nuevaPagina();
      dibujarCabeceraTabla();
    }

    celdas.forEach((celda, indice) => {
      celda.forEach((parte, numeroLinea) => {
        texto(
          parte,
          posiciones[indice] + 4,
          y - numeroLinea * 13,
          9
        );
      });
    });

    y -= alturaFila;
    linea(margen, y + 5, ancho - margen, y + 5);
  }

  // TOTAL

  if (total) {
    verificarEspacio(45);
    y -= 25;
    texto(total, margen, y, 14, true);
  }

  nuevaPagina();

  // OBJETOS PDF

  const objetos: string[] = [];

  function agregarObjeto(valor: string): number {
    objetos.push(valor);
    return objetos.length;
  }

  const catalogoId = agregarObjeto("");
  const paginasId = agregarObjeto("");

  const fuenteNormalId = agregarObjeto(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );

  const fuenteNegritaId = agregarObjeto(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );

  const paginaIds: number[] = [];

  for (const contenidoPagina of paginas) {
    const bytesContenido = new TextEncoder().encode(contenidoPagina);

    const contenidoId = agregarObjeto(
      `<< /Length ${bytesContenido.length} >>\nstream\n${contenidoPagina}\nendstream`
    );

    const paginaId = agregarObjeto(
      `<< /Type /Page /Parent ${paginasId} 0 R ` +
      `/MediaBox [0 0 ${ancho} ${alto}] ` +
      `/Resources << /Font << /F1 ${fuenteNormalId} 0 R /F2 ${fuenteNegritaId} 0 R >> >> ` +
      `/Contents ${contenidoId} 0 R >>`
    );

    paginaIds.push(paginaId);
  }

  objetos[catalogoId - 1] =
    `<< /Type /Catalog /Pages ${paginasId} 0 R >>`;

  objetos[paginasId - 1] =
    `<< /Type /Pages /Kids [${paginaIds.map(id => `${id} 0 R`).join(" ")}] /Count ${paginaIds.length} >>`;

  // CONSTRUIR PDF BINARIO

  const partes: Uint8Array[] = [];
  const codificador = new TextEncoder();

  let longitud = 0;

  function agregar(valor: string) {
    const bytes = codificador.encode(valor);
    partes.push(bytes);
    longitud += bytes.length;
  }

  agregar("%PDF-1.4\n");

  const offsets = [0];

  objetos.forEach((objeto, indice) => {
    offsets.push(longitud);
    agregar(`${indice + 1} 0 obj\n${objeto}\nendobj\n`);
  });

  const inicioXref = longitud;

  agregar(`xref\n0 ${objetos.length + 1}\n`);
  agregar("0000000000 65535 f \n");

  for (let i = 1; i < offsets.length; i++) {
    agregar(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }

  agregar(
    `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogoId} 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF`
  );

  const resultado = new Uint8Array(longitud);
  let desplazamiento = 0;

  for (const parte of partes) {
    resultado.set(parte, desplazamiento);
    desplazamiento += parte.length;
  }

  return resultado;
}

// DESCARGA DIRECTA EN EL NAVEGADOR

function descargarPDF(
  bytes: Uint8Array,
  nombre: string
) {
  if (typeof document === "undefined") {
    throw new Error("La descarga requiere un navegador.");
  }

  const blob = new Blob(
    [bytes as BlobPart],
    { type: "application/pdf" }
  );

  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ======================================================
// PDF DE VENTA
// ======================================================

export async function generarPDFVenta(
  datos: DatosVentaPDF
): Promise<void> {
  if (Platform.OS !== "web") {
    throw new Error(
      "Este generador de descarga directa está configurado para Expo Web."
    );
  }

  const lista = Array.isArray(datos.analisis)
    ? datos.analisis
    : [];

  const filas = lista.map((item, indice) => {
    const cantidadItem = cantidad(item.cantidad);
    const precio = Number(item.precio ?? 0);
    const precioValido = Number.isFinite(precio) ? precio : 0;

    return [
      String(indice + 1),
      item.nombre || item.tipo || "Análisis",
      String(cantidadItem),
      `Bs ${dinero(precioValido)}`,
      `Bs ${dinero(cantidadItem * precioValido)}`,
    ];
  });

  const codigo = datos.codigo || "SIN_CODIGO";

  const pdf = crearPDF(
    "COMPROBANTE DE VENTA",
    codigo,
    [
      `Laboratorio: ${datos.laboratorio || "Laboratorio Clínico"}`,
      `Fecha: ${datos.fecha || new Date().toLocaleString("es-BO")}`,
      `Paciente: ${datos.paciente || "No registrado"}`,
      `CI: ${datos.ci || "No registrado"}`,
      `Metodo de pago: ${datos.metodoPago || "No registrado"}`,
      "Estado: PAGADA",
    ],
    ["N.", "Analisis", "Cant.", "Precio", "Subtotal"],
    filas,
    `TOTAL PAGADO: Bs ${dinero(datos.total)}`
  );

  descargarPDF(
    pdf,
    `Venta_${limpiarNombre(codigo)}.pdf`
  );
}

// ======================================================
// PDF DE SOLICITUD DE ANÁLISIS
// ======================================================

export async function generarPDFAnalisis(
  datos: DatosAnalisisPDF
): Promise<void> {
  if (Platform.OS !== "web") {
    throw new Error(
      "Este generador de descarga directa está configurado para Expo Web."
    );
  }

  const codigo = datos.codigo || "SIN_CODIGO";

  const lista = Array.isArray(datos.analisis)
    ? datos.analisis
    : [];

  const filas = lista.map((item, indice) => [
    String(indice + 1),
    item.nombre || "Análisis",
    item.tipo || "-",
  ]);

  const pdf = crearPDF(
    "SOLICITUD DE ANALISIS",
    codigo,
    [
      `Laboratorio: ${datos.laboratorio || "Laboratorio Clínico"}`,
      `Fecha: ${datos.fecha || new Date().toLocaleString("es-BO")}`,
      `Paciente: ${datos.paciente || "No registrado"}`,
      `CI: ${datos.ci || "No registrado"}`,
      `Estado: ${datos.estado || "Pendiente"}`,
    ],
    ["N.", "Analisis", "Tipo"],
    filas
  );

  descargarPDF(
    pdf,
    `Solicitud_${limpiarNombre(codigo)}.pdf`
  );
}