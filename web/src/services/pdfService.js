import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Convertir fecha de Firebase a formato normal
function formatearFecha(fecha) {
  if (!fecha) {
    return new Date().toLocaleString("es-BO");
  }

  if (typeof fecha.toDate === "function") {
    return fecha.toDate().toLocaleString("es-BO");
  }

  if (typeof fecha.seconds === "number") {
    return new Date(fecha.seconds * 1000).toLocaleString("es-BO");
  }

  if (fecha instanceof Date) {
    return fecha.toLocaleString("es-BO");
  }

  const fechaConvertida = new Date(fecha);

  if (!isNaN(fechaConvertida.getTime())) {
    return fechaConvertida.toLocaleString("es-BO");
  }

  return "Sin fecha";
}

// Obtener nombre completo del paciente
function obtenerNombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no registrado";
  }

  const nombre = [
    paciente.nombres,
    paciente.apellidos
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return nombre || "Paciente no registrado";
}

// Convertir valores a números
function convertirNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

// Generar documento PDF
function generarDocumentoPDF(tipo, documento, paciente, laboratorio) {
  if (!documento) {
    throw new Error("No existen datos para generar el PDF.");
  }

  const pdf = new jsPDF();

  const esVenta = tipo === "venta";

  const nombreLaboratorio =
    laboratorio?.nombreVisible ||
    laboratorio?.nombre ||
    "Laboratorio Clínico";

  const titulo = esVenta
    ? "COMPROBANTE DE VENTA"
    : "SOLICITUD DE ANÁLISIS";

  const codigo = esVenta
    ? documento.ventaId || documento.id || "Sin código"
    : documento.solicitudId || documento.id || "Sin código";

  const nombrePaciente = obtenerNombrePaciente(paciente);

  const carnet = paciente?.ci || "No registrado";

  const fecha = formatearFecha(documento.fecha);

  const total = convertirNumero(documento.total);

  // Encabezado
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(30, 64, 175);

  const nombreLineas = pdf.splitTextToSize(
    String(nombreLaboratorio),
    180
  );

  pdf.text(nombreLineas, 105, 20, {
    align: "center"
  });

  const alturaNombre = nombreLineas.length * 8;

  const tituloY = 20 + alturaNombre + 5;

  pdf.setFontSize(14);
  pdf.setTextColor(0, 0, 0);

  pdf.text(titulo, 105, tituloY, {
    align: "center"
  });

  // Línea divisoria
  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.5);
  pdf.line(14, tituloY + 5, 196, tituloY + 5);

  // Información general
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  let posicionY = tituloY + 15;

  pdf.text(`Código: ${codigo}`, 14, posicionY);
  posicionY += 7;

  pdf.text(`Fecha: ${fecha}`, 14, posicionY);
  posicionY += 7;

  const pacienteLineas = pdf.splitTextToSize(
    `Paciente: ${nombrePaciente}`,
    180
  );

  pdf.text(pacienteLineas, 14, posicionY);

  posicionY += pacienteLineas.length * 6 + 2;

  pdf.text(`Carnet de identidad: ${carnet}`, 14, posicionY);
  posicionY += 7;

  if (esVenta) {
    pdf.text(
      `Método de pago: ${documento.metodoPago || "No registrado"}`,
      14,
      posicionY
    );

    posicionY += 7;

    pdf.text(
      `Solicitud: ${documento.solicitudId || "No registrada"}`,
      14,
      posicionY
    );

    posicionY += 7;
  }

  // Obtener análisis
  const analisis = Array.isArray(documento.analisis)
    ? documento.analisis
    : [];

  // Crear filas de la tabla
  const filas = analisis.map((item) => {
    const precio = convertirNumero(item.precio);

    const cantidad = Math.max(
      1,
      convertirNumero(item.cantidad || 1)
    );

    const subtotal = convertirNumero(
      item.subtotal ?? precio * cantidad
    );

    return [
      item.nombre || "Análisis",
      `Bs ${precio.toFixed(2)}`,
      cantidad.toString(),
      `Bs ${subtotal.toFixed(2)}`
    ];
  });

  // Tabla de análisis
  autoTable(pdf, {
    startY: posicionY + 5,

    head: [
      ["ANÁLISIS", "PRECIO", "CANTIDAD", "SUBTOTAL"]
    ],

    body: filas,

    theme: "grid",

    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },

    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak"
    },

    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 42 }
    },

    margin: {
      left: 14,
      right: 14,
      bottom: 25
    }
  });

  // Posición final de la tabla
  let posicionFinal = pdf.lastAutoTable?.finalY || posicionY + 20;

  // Crear una página adicional si no existe espacio
  if (posicionFinal + 25 > 275) {
    pdf.addPage();
    posicionFinal = 20;
  }

  // Total
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);

  pdf.text(
    `TOTAL: Bs ${total.toFixed(2)}`,
    196,
    posicionFinal + 12,
    {
      align: "right"
    }
  );

  // Pie de página
  const totalPaginas = pdf.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    pdf.setPage(pagina);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);

    pdf.text(
      "Documento generado por el Sistema de Laboratorio Clínico",
      105,
      285,
      {
        align: "center"
      }
    );

    pdf.text(
      `Página ${pagina} de ${totalPaginas}`,
      196,
      290,
      {
        align: "right"
      }
    );
  }

  // Nombre del archivo
  const codigoSeguro = String(codigo)
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const nombreArchivo = esVenta
    ? `Venta_${codigoSeguro}.pdf`
    : `Solicitud_${codigoSeguro}.pdf`;

  // Descargar PDF
  pdf.save(nombreArchivo);
}

// Generar PDF de venta
export function generarPDFVenta(venta, paciente, laboratorio) {
  generarDocumentoPDF(
    "venta",
    venta,
    paciente,
    laboratorio
  );
}

// Generar PDF de solicitud de análisis
export function generarPDFSolicitud(solicitud, paciente, laboratorio) {
  generarDocumentoPDF(
    "solicitud",
    solicitud,
    paciente,
    laboratorio
  );
}