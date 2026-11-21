import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ======================================================
// LABORATORIO CLÍNICO
// GENERACIÓN DE INFORMES CLÍNICOS EN PDF
// ======================================================

// ======================================================
// COLORES INSTITUCIONALES
// ======================================================

const COLORES = {
  principal: [25, 56, 95],
  oscuro: [15, 39, 71],
  azul: [37, 99, 235],
  celeste: [14, 165, 233],

  fondo: [248, 250, 252],
  fondoAzul: [239, 246, 255],

  blanco: [255, 255, 255],

  texto: [30, 41, 59],
  secundario: [100, 116, 139],

  borde: [226, 232, 240],

  verde: [22, 163, 74],
  fondoVerde: [220, 252, 231],
};

// ======================================================
// CONFIGURACIÓN DEL DOCUMENTO
// ======================================================

const PAGINA = {
  ancho: 210,
  alto: 297,

  margenIzquierdo: 16,
  margenDerecho: 16,

  anchoContenido: 178,

  limiteInferior: 270,
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor, defecto = "-") {
  const resultado = String(valor ?? "").trim();

  return resultado || defecto;
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  const nombreCompleto = texto(
    paciente.nombreCompleto,
    ""
  );

  if (nombreCompleto) {
    return nombreCompleto;
  }

  const nombres = texto(
    paciente.nombres ?? paciente.nombre,
    ""
  );

  const apellidos = texto(
    paciente.apellidos ?? paciente.apellido,
    ""
  );

  return (
    `${nombres} ${apellidos}`.trim() ||
    "Paciente no identificado"
  );
}

function ciPaciente(paciente) {
  return texto(
    paciente?.ci ??
      paciente?.carnet ??
      paciente?.documentoIdentidad
  );
}

function fechaVisible(valor) {
  if (!valor) {
    return "-";
  }

  let fecha;

  if (typeof valor?.toDate === "function") {
    fecha = valor.toDate();
  } else if (
    valor?.seconds !== undefined &&
    typeof valor.seconds === "number"
  ) {
    fecha = new Date(valor.seconds * 1000);
  } else {
    fecha = new Date(valor);
  }

  if (Number.isNaN(fecha.getTime())) {
    return "-";
  }

  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obtenerNombreLaboratorio(laboratorio) {
  return (
    texto(laboratorio?.nombreVisible, "") ||
    texto(laboratorio?.nombre, "") ||
    texto(laboratorio?.nombreLaboratorio, "") ||
    "Laboratorio Clínico"
  );
}

function obtenerColorPrincipal(laboratorio) {
  const color = laboratorio?.colorPrimario;

  if (
    typeof color !== "string" ||
    !/^#[0-9a-fA-F]{6}$/.test(color)
  ) {
    return COLORES.principal;
  }

  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function nombreSeguroArchivo(valor) {
  return texto(valor, "paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 55);
}

// ======================================================
// TEXTO AJUSTADO AL ANCHO DISPONIBLE
// ======================================================

function escribirTexto(
  pdf,
  contenido,
  x,
  y,
  ancho,
  opciones = {}
) {
  const {
    tamanio = 10,
    color = COLORES.texto,
    negrita = false,
    interlineado = 1.35,
  } = opciones;

  pdf.setFont("helvetica", negrita ? "bold" : "normal");
  pdf.setFontSize(tamanio);
  pdf.setTextColor(...color);

  const lineas = pdf.splitTextToSize(
    texto(contenido),
    ancho
  );

  pdf.text(lineas, x, y);

  const altura =
    (lineas.length * tamanio * interlineado) / 2.83465;

  return Math.max(altura, 5);
}

// ======================================================
// ENCABEZADO DEL PDF
// ======================================================

function dibujarEncabezado(
  pdf,
  laboratorio,
  colorPrincipal
) {
  const nombre = obtenerNombreLaboratorio(laboratorio);

  // Banda institucional superior

  pdf.setFillColor(...colorPrincipal);
  pdf.rect(0, 0, PAGINA.ancho, 37, "F");

  // Línea decorativa

  pdf.setFillColor(...COLORES.celeste);
  pdf.rect(0, 37, PAGINA.ancho, 2, "F");

  // Símbolo institucional

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(16, 9, 18, 18, 4, 4, "F");

  pdf.setDrawColor(...colorPrincipal);
  pdf.setLineWidth(1.7);

  pdf.line(25, 13, 25, 23);
  pdf.line(20, 18, 30, 18);

  // Nombre del laboratorio

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);

  const nombreLineas = pdf.splitTextToSize(
    nombre,
    133
  ).slice(0, 2);

  pdf.text(nombreLineas, 40, 16);

  // Identificación secundaria

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(220, 234, 250);

  pdf.text(
    "INFORME DE LABORATORIO CLÍNICO",
    40,
    nombreLineas.length > 1 ? 32 : 23
  );

  // Subtítulo del documento

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...colorPrincipal);

  pdf.text(
    "INFORME DE RESULTADOS",
    PAGINA.margenIzquierdo,
    52
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORES.secundario);

  pdf.text(
    "Resultados clínicos registrados y validados",
    PAGINA.margenIzquierdo,
    58
  );

  // Separador

  pdf.setDrawColor(...COLORES.borde);
  pdf.setLineWidth(0.3);

  pdf.line(16, 63, 194, 63);

  return 70;
}

// ======================================================
// DATOS DEL LABORATORIO
// ======================================================

function dibujarDatosLaboratorio(pdf, laboratorio, y) {
  const datos = [
    laboratorio?.direccion
      ? `Dirección: ${laboratorio.direccion}`
      : null,

    laboratorio?.telefono
      ? `Teléfono: ${laboratorio.telefono}`
      : null,

    laboratorio?.email
      ? `Correo electrónico: ${laboratorio.email}`
      : null,
  ].filter(Boolean);

  if (datos.length === 0) {
    return y;
  }

  pdf.setFillColor(...COLORES.fondo);

  const alturas = datos.map((dato) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    const lineas = pdf.splitTextToSize(dato, 165);

    return Math.max(5, lineas.length * 4.5);
  });

  const alturaTotal =
    alturas.reduce((a, b) => a + b, 0) + 10;

  pdf.roundedRect(
    16,
    y,
    178,
    alturaTotal,
    3,
    3,
    "F"
  );

  let posicion = y + 7;

  datos.forEach((dato, indice) => {
    const altura = escribirTexto(
      pdf,
      dato,
      22,
      posicion,
      165,
      {
        tamanio: 9,
        color: COLORES.secundario,
      }
    );

    posicion += Math.max(alturas[indice], altura);
  });

  return y + alturaTotal + 9;
}

// ======================================================
// TÍTULO DE SECCIÓN
// ======================================================

function dibujarTituloSeccion(
  pdf,
  titulo,
  y,
  colorPrincipal
) {
  pdf.setFillColor(...colorPrincipal);
  pdf.roundedRect(16, y - 4, 3, 8, 1, 1, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...colorPrincipal);

  pdf.text(titulo, 23, y + 1);

  return y + 9;
}

// ======================================================
// INFORMACIÓN DEL PACIENTE
// ======================================================

function dibujarPaciente(
  pdf,
  informe,
  y,
  colorPrincipal
) {
  y = dibujarTituloSeccion(
    pdf,
    "INFORMACIÓN DEL PACIENTE",
    y,
    colorPrincipal
  );

  const paciente = informe.paciente || {};

  const datos = [
    [
      "PACIENTE",
      nombrePaciente(paciente),
    ],
    [
      "DOCUMENTO DE IDENTIDAD",
      ciPaciente(paciente),
    ],
    [
      "FECHA DE VALIDACIÓN",
      fechaVisible(informe.fechaValidacion),
    ],
    [
      "ESTADO DEL INFORME",
      "Validado",
    ],
  ];

  const alturaCaja = 43;

  pdf.setFillColor(...COLORES.fondo);
  pdf.setDrawColor(...COLORES.borde);
  pdf.setLineWidth(0.25);

  pdf.roundedRect(
    16,
    y,
    178,
    alturaCaja,
    4,
    4,
    "FD"
  );

  const posiciones = [
    { x: 22, y: y + 9 },
    { x: 110, y: y + 9 },
    { x: 22, y: y + 29 },
    { x: 110, y: y + 29 },
  ];

  datos.forEach(([etiqueta, valor], indice) => {
    const posicion = posiciones[indice];

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORES.secundario);

    pdf.text(
      etiqueta,
      posicion.x,
      posicion.y
    );

    escribirTexto(
      pdf,
      valor,
      posicion.x,
      posicion.y + 6,
      78,
      {
        tamanio: 9,
        color: COLORES.texto,
        negrita: true,
      }
    );
  });

  return y + alturaCaja + 12;
}

// ======================================================
// COMPROBAR ESPACIO DISPONIBLE
// ======================================================

function asegurarEspacio(
  pdf,
  y,
  espacioNecesario,
  laboratorio,
  colorPrincipal
) {
  if (
    y + espacioNecesario <=
    PAGINA.limiteInferior
  ) {
    return y;
  }

  pdf.addPage();

  return dibujarEncabezado(
    pdf,
    laboratorio,
    colorPrincipal
  );
}

// ======================================================
// TARJETA DEL ANÁLISIS
// ======================================================

function dibujarTituloAnalisis(
  pdf,
  resultado,
  y,
  colorPrincipal,
  indice
) {
  const nombre = texto(
    resultado.analisisNombre,
    "Análisis clínico"
  );

  const lineas = pdf.splitTextToSize(
    nombre,
    145
  );

  const altura =
    Math.max(15, 9 + lineas.length * 5);

  pdf.setFillColor(...COLORES.fondoAzul);
  pdf.setDrawColor(...COLORES.borde);
  pdf.setLineWidth(0.25);

  pdf.roundedRect(
    16,
    y,
    178,
    altura,
    3,
    3,
    "FD"
  );

  // Número de análisis

  pdf.setFillColor(...colorPrincipal);
  pdf.roundedRect(
    20,
    y + 3,
    12,
    9,
    2,
    2,
    "F"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);

  pdf.text(
    String(indice + 1).padStart(2, "0"),
    26,
    y + 9,
    { align: "center" }
  );

  // Nombre del análisis

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...colorPrincipal);

  pdf.text(
    lineas,
    37,
    y + 9
  );

  return y + altura + 3;
}

// ======================================================
// TABLA DE PARÁMETROS CLÍNICOS
// ======================================================

function dibujarTablaResultados(
  pdf,
  resultado,
  y,
  laboratorio,
  colorPrincipal
) {
  const parametros = Array.isArray(resultado.parametros)
    ? resultado.parametros
    : [];

  const filas = parametros.map((parametro) => [
    texto(parametro.nombreParametro),
    texto(parametro.valor),
    texto(parametro.unidad),
    texto(parametro.rangoReferencia),
    texto(parametro.observacion),
  ]);

  if (filas.length === 0) {
    filas.push([
      "Sin parámetros registrados",
      "-",
      "-",
      "-",
      "-",
    ]);
  }

  autoTable(pdf, {
    startY: y,

    margin: {
      left: 16,
      right: 16,
      top: 69,
      bottom: 28,
    },

    tableWidth: 178,

    theme: "grid",

    head: [
      [
        "PARÁMETRO",
        "RESULTADO",
        "UNIDAD",
        "REFERENCIA",
        "OBSERVACIÓN",
      ],
    ],

    body: filas,

    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3.3,

      textColor: COLORES.texto,

      lineColor: COLORES.borde,
      lineWidth: 0.15,

      valign: "middle",

      overflow: "linebreak",
    },

    headStyles: {
      fillColor: colorPrincipal,
      textColor: COLORES.blanco,

      fontStyle: "bold",
      fontSize: 7.6,

      minCellHeight: 11,
    },

    bodyStyles: {
      minCellHeight: 10,
    },

    alternateRowStyles: {
      fillColor: COLORES.fondo,
    },

    columnStyles: {
      0: {
        cellWidth: 43,
        fontStyle: "bold",
      },

      1: {
        cellWidth: 28,
        halign: "center",
      },

      2: {
        cellWidth: 25,
        halign: "center",
      },

      3: {
        cellWidth: 35,
        halign: "center",
      },

      4: {
        cellWidth: 47,
      },
    },

    // Encabezado institucional en páginas adicionales.

    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        const paginaActual = pdf.internal.getCurrentPageInfo()
          .pageNumber;

        if (!pdf.__paginasConEncabezado) {
          pdf.__paginasConEncabezado = new Set();
        }

        if (
          !pdf.__paginasConEncabezado.has(paginaActual)
        ) {
          dibujarEncabezado(
            pdf,
            laboratorio,
            colorPrincipal
          );

          pdf.__paginasConEncabezado.add(
            paginaActual
          );
        }
      }
    },
  });

  return (
    pdf.lastAutoTable?.finalY ?? y
  ) + 6;
}

// ======================================================
// DATOS DE VALIDACIÓN DEL ANÁLISIS
// ======================================================

function dibujarValidacion(
  pdf,
  resultado,
  y
) {
  const profesional = texto(
    resultado.validadoPorNombre ??
      resultado.validadoPor,
    "No registrado"
  );

  const fecha = fechaVisible(
    resultado.fechaValidacion
  );

  const altura = 19;

  pdf.setFillColor(...COLORES.fondoVerde);

  pdf.roundedRect(
    16,
    y,
    178,
    altura,
    3,
    3,
    "F"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORES.verde);

  pdf.text(
    "RESULTADO VALIDADO",
    21,
    y + 6
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORES.texto);

  const profesionalTexto = pdf.splitTextToSize(
    `Validado por: ${profesional}`,
    160
  );

  pdf.text(
    profesionalTexto.slice(0, 2),
    21,
    y + 11
  );

  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORES.secundario);

  pdf.text(
    `Fecha: ${fecha}`,
    21,
    y + 16
  );

  return y + altura + 12;
}

// ======================================================
// PIE DE PÁGINA
// ======================================================

function dibujarPiePagina(
  pdf,
  laboratorio,
  numeroPagina,
  totalPaginas,
  colorPrincipal
) {
  const nombreLaboratorio =
    obtenerNombreLaboratorio(laboratorio);

  const fechaImpresion =
    new Date().toLocaleDateString("es-BO");

  pdf.setDrawColor(...COLORES.borde);
  pdf.setLineWidth(0.3);

  pdf.line(
    16,
    277,
    194,
    277
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...colorPrincipal);

  const nombreCorto =
    pdf.splitTextToSize(
      nombreLaboratorio,
      110
    )[0] || "Laboratorio Clínico";

  pdf.text(
    nombreCorto,
    16,
    283
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORES.secundario);

  pdf.text(
    `Página ${numeroPagina} de ${totalPaginas}`,
    194,
    283,
    { align: "right" }
  );

  pdf.text(
    "Documento generado por el sistema de gestión clínica.",
    16,
    289
  );

  pdf.text(
    `Emisión: ${fechaImpresion}`,
    194,
    289,
    { align: "right" }
  );
}

// ======================================================
// GENERAR PDF DE RESULTADOS
// ======================================================

export function generarPDFResultados({
  laboratorio,
  informe,
}) {
  // ====================================================
  // VALIDACIONES INICIALES
  // ====================================================

  if (!informe) {
    throw new Error(
      "Selecciona un informe clínico."
    );
  }

  const resultados = Array.isArray(informe.resultados)
    ? informe.resultados
    : [];

  if (resultados.length === 0) {
    throw new Error(
      "El informe no contiene resultados clínicos."
    );
  }

  // ====================================================
  // CREAR DOCUMENTO
  // ====================================================

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  pdf.setProperties({
    title: "Informe de resultados clínicos",
    subject: "Resultados de laboratorio clínico",
    author: obtenerNombreLaboratorio(laboratorio),
    creator: "Sistema de Gestión de Laboratorio Clínico",
  });

  const colorPrincipal =
    obtenerColorPrincipal(laboratorio);

  // ====================================================
  // ENCABEZADO
  // ====================================================

  let y = dibujarEncabezado(
    pdf,
    laboratorio,
    colorPrincipal
  );

  // ====================================================
  // DATOS INSTITUCIONALES
  // ====================================================

  y = dibujarDatosLaboratorio(
    pdf,
    laboratorio,
    y
  );

  // ====================================================
  // DATOS DEL PACIENTE
  // ====================================================

  y = dibujarPaciente(
    pdf,
    informe,
    y,
    colorPrincipal
  );

  // ====================================================
  // RESULTADOS CLÍNICOS
  // ====================================================

  y = dibujarTituloSeccion(
    pdf,
    "RESULTADOS DE LOS ANÁLISIS",
    y,
    colorPrincipal
  );

  // ====================================================
  // RECORRER ANÁLISIS
  // ====================================================

  resultados.forEach((resultado, indice) => {
    y = asegurarEspacio(
      pdf,
      y,
      36,
      laboratorio,
      colorPrincipal
    );

    // Título del análisis

    y = dibujarTituloAnalisis(
      pdf,
      resultado,
      y,
      colorPrincipal,
      indice
    );

    // Tabla de parámetros

    y = dibujarTablaResultados(
      pdf,
      resultado,
      y,
      laboratorio,
      colorPrincipal
    );

    // Validación del profesional

    y = asegurarEspacio(
      pdf,
      y,
      27,
      laboratorio,
      colorPrincipal
    );

    y = dibujarValidacion(
      pdf,
      resultado,
      y
    );
  });

  // ====================================================
  // MENSAJE FINAL
  // ====================================================

  y = asegurarEspacio(
    pdf,
    y,
    17,
    laboratorio,
    colorPrincipal
  );

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORES.secundario);

  const notaFinal = pdf.splitTextToSize(
    "Este documento presenta los resultados clínicos " +
      "registrados y validados en el sistema del laboratorio.",
    178
  );

  pdf.text(
    notaFinal,
    16,
    y
  );

  // ====================================================
  // NUMERACIÓN DE TODAS LAS PÁGINAS
  // ====================================================

  const totalPaginas =
    pdf.internal.getNumberOfPages();

  for (
    let numeroPagina = 1;
    numeroPagina <= totalPaginas;
    numeroPagina++
  ) {
    pdf.setPage(numeroPagina);

    dibujarPiePagina(
      pdf,
      laboratorio,
      numeroPagina,
      totalPaginas,
      colorPrincipal
    );
  }

  // ====================================================
  // NOMBRE DEL ARCHIVO
  // SIN NÚMERO DE ORDEN
  // ====================================================

  const paciente = nombreSeguroArchivo(
    nombrePaciente(informe.paciente)
  );

  const fechaActual =
    new Date()
      .toISOString()
      .slice(0, 10);

  const nombreArchivo =
    `Informe_Resultados_${paciente}_${fechaActual}.pdf`;

  // ====================================================
  // GUARDAR PDF
  // ====================================================

  pdf.save(nombreArchivo);

  return nombreArchivo;
}