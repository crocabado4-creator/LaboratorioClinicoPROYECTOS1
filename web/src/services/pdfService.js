import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// ======================================================
// UTILIDADES GENERALES
// ======================================================

function texto(valor, defecto = "") {
  if (valor === null || valor === undefined) {
    return defecto;
  }

  return String(valor).trim() || defecto;
}

function primero(...valores) {
  for (const valor of valores) {
    if (
      valor !== null &&
      valor !== undefined &&
      valor !== ""
    ) {
      return valor;
    }
  }

  return "";
}

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : 0;
}

function moneda(valor) {
  return convertirNumero(valor).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ======================================================
// FECHAS
// ======================================================

function formatearFecha(valor) {
  if (!valor) {
    return "Sin fecha";
  }

  try {
    let fecha;

    if (typeof valor.toDate === "function") {
      fecha = valor.toDate();
    } else if (typeof valor.seconds === "number") {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor);
    }

    if (Number.isNaN(fecha.getTime())) {
      return "Sin fecha";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "Sin fecha";
  }
}

// ======================================================
// DATOS DEL PACIENTE
// ======================================================

function obtenerNombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no registrado";
  }

  const nombreCompleto = primero(
    paciente.nombreCompleto,
    paciente.nombrePaciente
  );

  if (nombreCompleto) {
    return texto(nombreCompleto);
  }

  const nombres = texto(
    primero(
      paciente.nombres,
      paciente.nombre
    )
  );

  const apellidos = texto(
    primero(
      paciente.apellidos,
      paciente.apellido
    )
  );

  return (
    `${nombres} ${apellidos}`.trim() ||
    "Paciente no registrado"
  );
}

function obtenerCI(paciente) {
  return texto(
    primero(
      paciente?.ci,
      paciente?.carnet,
      paciente?.numeroDocumento
    ),
    "No registrado"
  );
}

// ======================================================
// CONFIGURACIÓN DE COLORES
// ======================================================

function obtenerColor(color) {
  const valor = texto(color);

  if (!/^#[0-9a-fA-F]{6}$/.test(valor)) {
    return [37, 99, 235];
  }

  return [
    parseInt(valor.substring(1, 3), 16),
    parseInt(valor.substring(3, 5), 16),
    parseInt(valor.substring(5, 7), 16),
  ];
}

// ======================================================
// CONSULTAR DATOS DEL LABORATORIO EN FIRESTORE
// ======================================================

async function obtenerDatosLaboratorio(
  venta,
  laboratorioInicial
) {
  const laboratorioId = texto(
    primero(
      venta?.laboratorioId,
      laboratorioInicial?.laboratorioId,
      laboratorioInicial?.id
    )
  );

  if (!laboratorioId) {
    return laboratorioInicial || {};
  }

  try {
    const referencia = doc(
      db,
      "laboratorios",
      laboratorioId
    );

    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      return laboratorioInicial || {};
    }

    return {
      ...(laboratorioInicial || {}),
      ...documento.data(),
      id: documento.id,
    };
  } catch (error) {
    console.error(
      "Error consultando los datos del laboratorio:",
      error
    );

    return laboratorioInicial || {};
  }
}

// ======================================================
// CARGAR LOGO DEL LABORATORIO
// ======================================================

async function cargarLogo(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  return new Promise((resolve) => {
    const imagen = new Image();

    imagen.crossOrigin = "anonymous";

    imagen.onload = () => {
      try {
        const canvas =
          document.createElement("canvas");

        canvas.width = imagen.naturalWidth;
        canvas.height = imagen.naturalHeight;

        const contexto = canvas.getContext("2d");

        if (!contexto) {
          resolve(null);
          return;
        }

        contexto.drawImage(imagen, 0, 0);

        resolve({
          data: canvas.toDataURL("image/png"),
          ancho: imagen.naturalWidth,
          alto: imagen.naturalHeight,
        });
      } catch (error) {
        console.error(
          "Error procesando el logo:",
          error
        );

        resolve(null);
      }
    };

    imagen.onerror = () => {
      console.warn(
        "El logo no pudo cargarse para el PDF."
      );

      resolve(null);
    };

    imagen.src = url;
  });
}

// ======================================================
// DIBUJAR ENCABEZADO INSTITUCIONAL
// ======================================================

function dibujarEncabezado(
  pdf,
  laboratorio,
  logo,
  titulo
) {
  const anchoPagina =
    pdf.internal.pageSize.getWidth();

  const color = obtenerColor(
    laboratorio?.colorPrimario
  );

  // Línea superior.

  pdf.setFillColor(...color);

  pdf.rect(
    0,
    0,
    anchoPagina,
    5,
    "F"
  );

  // Fondo del encabezado.

  pdf.setFillColor(247, 250, 253);

  pdf.roundedRect(
    12,
    11,
    186,
    39,
    2,
    2,
    "F"
  );

  pdf.setDrawColor(218, 227, 236);

  pdf.roundedRect(
    12,
    11,
    186,
    39,
    2,
    2,
    "S"
  );

  // ====================================================
  // LOGO
  // ====================================================

  if (logo) {
    try {
      const maxAncho = 30;
      const maxAlto = 30;

      const escala = Math.min(
        maxAncho / logo.ancho,
        maxAlto / logo.alto
      );

      const anchoLogo = logo.ancho * escala;
      const altoLogo = logo.alto * escala;

      const posicionX =
        17 + (30 - anchoLogo) / 2;

      const posicionY =
        15 + (30 - altoLogo) / 2;

      pdf.addImage(
        logo.data,
        "PNG",
        posicionX,
        posicionY,
        anchoLogo,
        altoLogo
      );
    } catch (error) {
      console.error(
        "No se pudo insertar el logo:",
        error
      );
    }
  }

  // ====================================================
  // NOMBRE DEL LABORATORIO
  // ====================================================

  const nombreLaboratorio = texto(
    primero(
      laboratorio?.nombreVisible,
      laboratorio?.nombre,
      laboratorio?.nombreLaboratorio
    ),
    "LABORATORIO CLÍNICO"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...color);

  const lineasNombre = pdf
    .splitTextToSize(
      nombreLaboratorio.toUpperCase(),
      140
    )
    .slice(0, 2);

  pdf.text(
    lineasNombre,
    52,
    19
  );

  // ====================================================
  // DATOS DEL LABORATORIO
  // ====================================================

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);

  pdf.setTextColor(65, 78, 91);

  let posicionY =
    lineasNombre.length > 1 ? 30 : 25;

  const direccion = texto(
    primero(
      laboratorio?.direccion,
      laboratorio?.ubicacion,
      laboratorio?.ciudad
    )
  );

  const telefono = texto(
    primero(
      laboratorio?.telefono,
      laboratorio?.celular
    )
  );

  const correo = texto(
    primero(
      laboratorio?.email,
      laboratorio?.correo,
      laboratorio?.correoElectronico
    )
  );

  const datos = [
    direccion,
    telefono ? `Tel.: ${telefono}` : "",
    correo,
  ].filter(Boolean);

  datos.forEach((dato) => {
    const lineas = pdf
      .splitTextToSize(dato, 140)
      .slice(0, 2);

    pdf.text(
      lineas,
      52,
      posicionY
    );

    posicionY += lineas.length * 3.5;
  });

  // ====================================================
  // TÍTULO DEL COMPROBANTE
  // ====================================================

  pdf.setFillColor(...color);

  pdf.roundedRect(
    12,
    54,
    186,
    12,
    2,
    2,
    "F"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);

  pdf.text(
    titulo,
    anchoPagina / 2,
    61.5,
    {
      align: "center",
    }
  );
}

// ======================================================
// INFORMACIÓN DEL PACIENTE
// ======================================================

function dibujarPaciente(
  pdf,
  paciente,
  fecha
) {
  autoTable(pdf, {
    startY: 74,

    margin: {
      left: 12,
      right: 12,
      bottom: 25,
    },

    theme: "grid",

    body: [
      [
        "PACIENTE",
        obtenerNombrePaciente(paciente),
        "FECHA",
        fecha,
      ],

      [
        "CI",
        obtenerCI(paciente),
        "TELÉFONO",
        texto(
          paciente?.telefono,
          "No registrado"
        ),
      ],
    ],

    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3.5,
      textColor: [40, 55, 70],
      lineColor: [215, 225, 235],
      lineWidth: 0.2,
      valign: "middle",
    },

    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: [242, 246, 250],
        cellWidth: 26,
      },

      1: {
        cellWidth: 70,
      },

      2: {
        fontStyle: "bold",
        fillColor: [242, 246, 250],
        cellWidth: 24,
      },

      3: {
        cellWidth: 66,
      },
    },
  });

  return pdf.lastAutoTable.finalY;
}

// ======================================================
// TÍTULO DE SECCIÓN
// ======================================================

function dibujarTituloSeccion(
  pdf,
  titulo,
  posicionY,
  color
) {
  let y = posicionY;

  if (y + 16 > 270) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFillColor(235, 242, 248);

  pdf.roundedRect(
    12,
    y,
    186,
    10,
    2,
    2,
    "F"
  );

  pdf.setFillColor(...color);

  pdf.rect(
    12,
    y,
    3,
    10,
    "F"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...color);

  pdf.text(
    titulo,
    19,
    y + 6.5
  );

  return y + 14;
}

// ======================================================
// OBTENER ANÁLISIS REGISTRADOS
// ======================================================

function obtenerAnalisis(documento) {
  const origen = primero(
    documento?.analisis,
    documento?.detalles,
    documento?.detalleVenta,
    documento?.detallesVenta,
    documento?.items,
    documento?.analisisVendidos
  );

  if (Array.isArray(origen)) {
    return origen;
  }

  if (
    origen &&
    typeof origen === "object"
  ) {
    return Object.values(origen);
  }

  return [];
}

// ======================================================
// PIE DE PÁGINA
// ======================================================

function dibujarPiePagina(
  pdf,
  laboratorio
) {
  const paginas =
    pdf.internal.getNumberOfPages();

  const ancho =
    pdf.internal.pageSize.getWidth();

  const alto =
    pdf.internal.pageSize.getHeight();

  const nombreLaboratorio = texto(
    primero(
      laboratorio?.nombreVisible,
      laboratorio?.nombre
    ),
    "Laboratorio Clínico"
  );

  for (
    let pagina = 1;
    pagina <= paginas;
    pagina++
  ) {
    pdf.setPage(pagina);

    pdf.setDrawColor(215, 225, 235);

    pdf.line(
      12,
      alto - 20,
      ancho - 12,
      alto - 20
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);

    pdf.text(
      nombreLaboratorio.substring(0, 35),
      12,
      alto - 14
    );

    pdf.text(
      `Página ${pagina} de ${paginas}`,
      ancho - 12,
      alto - 14,
      {
        align: "right",
      }
    );

    pdf.setFontSize(6.5);

    pdf.text(
      "Documento generado por el Sistema de Laboratorio Clínico",
      ancho / 2,
      alto - 9,
      {
        align: "center",
      }
    );
  }
}

// ======================================================
// GENERAR COMPROBANTE DE VENTA
// ======================================================

async function crearComprobanteVenta(
  venta,
  paciente,
  laboratorioInicial
) {
  if (!venta) {
    throw new Error(
      "No existen datos de la venta."
    );
  }

  // ====================================================
  // OBTENER DATOS REALES DEL LABORATORIO
  // ====================================================

  const laboratorio =
    await obtenerDatosLaboratorio(
      venta,
      laboratorioInicial
    );

  // ====================================================
  // CARGAR LOGO
  // ====================================================

  const logoUrl = primero(
    laboratorio.logoUrl,
    laboratorio.imagenURL,
    laboratorio.logo
  );

  const logo = await cargarLogo(logoUrl);

  // ====================================================
  // CREAR PDF
  // ====================================================

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const color = obtenerColor(
    laboratorio.colorPrimario
  );

  // ====================================================
  // ENCABEZADO
  // ====================================================

  dibujarEncabezado(
    pdf,
    laboratorio,
    logo,
    "COMPROBANTE DE VENTA"
  );

  // ====================================================
  // FECHA
  // ====================================================

  const fecha = formatearFecha(
    primero(
      venta.fecha,
      venta.fechaVenta,
      venta.fechaCreacion,
      venta.createdAt
    )
  );

  // ====================================================
  // DATOS DEL PACIENTE
  // ====================================================

  let y = dibujarPaciente(
    pdf,
    paciente,
    fecha
  );

  // ====================================================
  // INFORMACIÓN DE LA VENTA
  //
  // NO MOSTRAR CÓDIGO
  // NO MOSTRAR SOLICITUD
  // ====================================================

  y = dibujarTituloSeccion(
    pdf,
    "INFORMACIÓN DE LA VENTA",
    y + 8,
    color
  );

  autoTable(pdf, {
    startY: y,

    margin: {
      left: 12,
      right: 12,
      bottom: 25,
    },

    theme: "grid",

    body: [
      [
        "MÉTODO DE PAGO",
        texto(
          venta.metodoPago,
          "No registrado"
        ).toUpperCase(),
      ],

      [
        "ESTADO",
        texto(
          venta.estado,
          "No registrado"
        ).toUpperCase(),
      ],

      [
        "FECHA",
        fecha,
      ],
    ],

    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3.5,
      lineColor: [215, 225, 235],
      lineWidth: 0.2,
      textColor: [40, 55, 70],
    },

    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: [242, 246, 250],
        cellWidth: 45,
      },

      1: {
        cellWidth: 141,
      },
    },
  });

  // ====================================================
  // DETALLE DE ANÁLISIS
  // ====================================================

  y = dibujarTituloSeccion(
    pdf,
    "DETALLE DE ANÁLISIS",
    pdf.lastAutoTable.finalY + 10,
    color
  );

  const analisis = obtenerAnalisis(venta);

  const filas = analisis.map((item) => {
    const dato =
      item && typeof item === "object"
        ? item
        : { nombre: String(item) };

    const precio = convertirNumero(
      primero(
        dato.precio,
        dato.precioUnitario,
        dato.costo
      )
    );

    const cantidad = Math.max(
      1,
      convertirNumero(
        primero(dato.cantidad, 1)
      )
    );

    const subtotal = convertirNumero(
      primero(
        dato.subtotal,
        precio * cantidad
      )
    );

    const nombre = texto(
      primero(
        dato.nombre,
        dato.nombreAnalisis,
        dato.analisisNombre
      ),
      "Análisis"
    );

    return [
      nombre,
      `Bs ${moneda(precio)}`,
      String(cantidad),
      `Bs ${moneda(subtotal)}`,
    ];
  });

  if (filas.length === 0) {
    filas.push([
      "Detalle no disponible",
      "-",
      "-",
      "-",
    ]);
  }

  // ====================================================
  // TABLA DE ANÁLISIS
  // ====================================================

  autoTable(pdf, {
    startY: y,

    margin: {
      left: 12,
      right: 12,
      top: 20,
      bottom: 25,
    },

    tableWidth: 186,

    head: [
      [
        "ANÁLISIS",
        "PRECIO",
        "CANTIDAD",
        "SUBTOTAL",
      ],
    ],

    body: filas,

    theme: "grid",

    headStyles: {
      fillColor: color,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },

    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [40, 55, 70],
      lineColor: [215, 225, 235],
      lineWidth: 0.2,
      overflow: "linebreak",
    },

    alternateRowStyles: {
      fillColor: [248, 250, 253],
    },

    columnStyles: {
      0: {
        cellWidth: 75,
      },

      1: {
        cellWidth: 37,
        halign: "right",
      },

      2: {
        cellWidth: 30,
        halign: "center",
      },

      3: {
        cellWidth: 44,
        halign: "right",
      },
    },
  });

  // ====================================================
  // TOTAL DE LA VENTA
  // ====================================================

  let posicionFinal =
    pdf.lastAutoTable.finalY + 12;

  if (posicionFinal + 25 > 270) {
    pdf.addPage();
    posicionFinal = 22;
  }

  const total = convertirNumero(
    primero(
      venta.total,
      venta.montoTotal,
      venta.totalVenta
    )
  );

  // Recuadro del total.

  pdf.setFillColor(237, 245, 251);

  pdf.roundedRect(
    110,
    posicionFinal,
    88,
    18,
    3,
    3,
    "F"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...color);

  pdf.text(
    `TOTAL: Bs ${moneda(total)}`,
    193,
    posicionFinal + 11,
    {
      align: "right",
    }
  );

  // ====================================================
  // PIE DE PÁGINA
  // ====================================================

  dibujarPiePagina(
    pdf,
    laboratorio
  );

  // ====================================================
  // NOMBRE DEL ARCHIVO
  // ====================================================

  // El identificador se utiliza únicamente
  // para nombrar el archivo descargado.
  // No aparece dentro del comprobante.

  const codigo = texto(
    primero(
      venta.ventaId,
      venta.id,
      "venta"
    )
  ).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );

  pdf.save(
    `Venta_${codigo}.pdf`
  );
}

// ======================================================
// GENERAR PDF DE SOLICITUD
// SE CONSERVA SU FUNCIONALIDAD ORIGINAL
// ======================================================

function crearPDFSolicitud(
  solicitud,
  paciente,
  laboratorio
) {
  if (!solicitud) {
    throw new Error(
      "No existen datos de la solicitud."
    );
  }

  const pdf = new jsPDF();

  const nombreLaboratorio = texto(
    primero(
      laboratorio?.nombreVisible,
      laboratorio?.nombre
    ),
    "Laboratorio Clínico"
  );

  const codigo = primero(
    solicitud.solicitudId,
    solicitud.id,
    "Sin código"
  );

  const nombrePaciente =
    obtenerNombrePaciente(paciente);

  const carnet = obtenerCI(paciente);

  const fecha = formatearFecha(
    solicitud.fecha
  );

  const total = convertirNumero(
    solicitud.total
  );

  // ====================================================
  // ENCABEZADO
  // ====================================================

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(30, 64, 175);

  const nombreLineas =
    pdf.splitTextToSize(
      nombreLaboratorio,
      180
    );

  pdf.text(
    nombreLineas,
    105,
    20,
    {
      align: "center",
    }
  );

  const alturaNombre =
    nombreLineas.length * 8;

  const tituloY =
    20 + alturaNombre + 5;

  pdf.setFontSize(14);
  pdf.setTextColor(0, 0, 0);

  pdf.text(
    "SOLICITUD DE ANÁLISIS",
    105,
    tituloY,
    {
      align: "center",
    }
  );

  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.5);

  pdf.line(
    14,
    tituloY + 5,
    196,
    tituloY + 5
  );

  // ====================================================
  // INFORMACIÓN GENERAL
  // ====================================================

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  let posicionY = tituloY + 15;

  pdf.text(
    `Código: ${codigo}`,
    14,
    posicionY
  );

  posicionY += 7;

  pdf.text(
    `Fecha: ${fecha}`,
    14,
    posicionY
  );

  posicionY += 7;

  const pacienteLineas =
    pdf.splitTextToSize(
      `Paciente: ${nombrePaciente}`,
      180
    );

  pdf.text(
    pacienteLineas,
    14,
    posicionY
  );

  posicionY +=
    pacienteLineas.length * 6 + 2;

  pdf.text(
    `Carnet de identidad: ${carnet}`,
    14,
    posicionY
  );

  posicionY += 7;

  // ====================================================
  // DETALLE DE ANÁLISIS
  // ====================================================

  const analisis = obtenerAnalisis(
    solicitud
  );

  const filas = analisis.map((item) => {
    const dato =
      item && typeof item === "object"
        ? item
        : { nombre: String(item) };

    const precio = convertirNumero(
      primero(
        dato.precio,
        dato.precioUnitario
      )
    );

    const cantidad = Math.max(
      1,
      convertirNumero(
        primero(dato.cantidad, 1)
      )
    );

    const subtotal = convertirNumero(
      primero(
        dato.subtotal,
        precio * cantidad
      )
    );

    return [
      texto(
        primero(
          dato.nombre,
          dato.nombreAnalisis,
          dato.analisisNombre
        ),
        "Análisis"
      ),

      `Bs ${moneda(precio)}`,

      String(cantidad),

      `Bs ${moneda(subtotal)}`,
    ];
  });

  autoTable(pdf, {
    startY: posicionY + 5,

    head: [
      [
        "ANÁLISIS",
        "PRECIO",
        "CANTIDAD",
        "SUBTOTAL",
      ],
    ],

    body: filas,

    theme: "grid",

    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },

    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },

    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 42 },
    },

    margin: {
      left: 14,
      right: 14,
      bottom: 25,
    },
  });

  // ====================================================
  // TOTAL
  // ====================================================

  let posicionFinal =
    pdf.lastAutoTable?.finalY ||
    posicionY + 20;

  if (posicionFinal + 25 > 275) {
    pdf.addPage();
    posicionFinal = 20;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);

  pdf.text(
    `TOTAL: Bs ${moneda(total)}`,
    196,
    posicionFinal + 12,
    {
      align: "right",
    }
  );

  // ====================================================
  // PIE DE PÁGINA
  // ====================================================

  const totalPaginas =
    pdf.getNumberOfPages();

  for (
    let pagina = 1;
    pagina <= totalPaginas;
    pagina++
  ) {
    pdf.setPage(pagina);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);

    pdf.text(
      "Documento generado por el Sistema de Laboratorio Clínico",
      105,
      285,
      {
        align: "center",
      }
    );

    pdf.text(
      `Página ${pagina} de ${totalPaginas}`,
      196,
      290,
      {
        align: "right",
      }
    );
  }

  const codigoSeguro = texto(
    codigo
  ).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );

  pdf.save(
    `Solicitud_${codigoSeguro}.pdf`
  );
}

// ======================================================
// EXPORTAR FUNCIONES
// ======================================================

// ======================================================
// PDF DE VENTA
// ======================================================

export async function generarPDFVenta(
  venta,
  paciente,
  laboratorio
) {
  try {
    await crearComprobanteVenta(
      venta,
      paciente,
      laboratorio
    );
  } catch (error) {
    console.error(
      "Error generando comprobante:",
      error
    );

    alert(
      "No se pudo generar el comprobante de venta."
    );
  }
}

// ======================================================
// PDF DE SOLICITUD
// ======================================================

export function generarPDFSolicitud(
  solicitud,
  paciente,
  laboratorio
) {
  try {
    crearPDFSolicitud(
      solicitud,
      paciente,
      laboratorio
    );
  } catch (error) {
    console.error(
      "Error generando solicitud:",
      error
    );

    alert(
      "No se pudo generar el PDF de solicitud."
    );
  }
}