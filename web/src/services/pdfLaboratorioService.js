import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  doc,
  getDoc
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor, defecto = "") {
  if (valor === null || valor === undefined) {
    return defecto;
  }

  const resultado = String(valor).trim();

  return resultado || defecto;
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

function numero(valor) {
  const resultado = Number(valor);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}

function moneda(valor) {
  return numero(valor).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function convertirFecha(valor) {
  if (!valor) {
    return null;
  }

  let fecha;

  if (typeof valor.toDate === "function") {
    fecha = valor.toDate();
  } else if (typeof valor.seconds === "number") {
    fecha = new Date(valor.seconds * 1000);
  } else {
    fecha = new Date(valor);
  }

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
}

function fechaTexto(valor) {
  const fecha = convertirFecha(valor);

  return fecha
    ? fecha.toLocaleDateString("es-BO")
    : "No registrada";
}

function fechaHoraTexto(valor) {
  const fecha = convertirFecha(valor);

  return fecha
    ? fecha.toLocaleString("es-BO")
    : "No registrada";
}

function nombrePaciente(paciente) {
  return texto(
    primero(
      paciente?.nombreCompleto,
      [
        primero(
          paciente?.nombres,
          paciente?.nombre
        ),
        primero(
          paciente?.apellidos,
          paciente?.apellido
        )
      ].filter(Boolean).join(" ")
    ),
    "Paciente no identificado"
  );
}

function calcularEdad(paciente) {
  const edadRegistrada = primero(
    paciente?.edad,
    paciente?.edadAnios
  );

  if (edadRegistrada !== "") {
    return `${edadRegistrada} años`;
  }

  const nacimiento = convertirFecha(
    paciente?.fechaNacimiento
  );

  if (!nacimiento) {
    return "No registrada";
  }

  const hoy = new Date();

  let edad =
    hoy.getFullYear() -
    nacimiento.getFullYear();

  const diferenciaMes =
    hoy.getMonth() -
    nacimiento.getMonth();

  if (
    diferenciaMes < 0 ||
    (
      diferenciaMes === 0 &&
      hoy.getDate() < nacimiento.getDate()
    )
  ) {
    edad--;
  }

  return edad >= 0
    ? `${edad} años`
    : "No registrada";
}

function colorLaboratorio(valor) {
  const color = texto(valor);

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return [35, 55, 82];
  }

  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16)
  ];
}

// ======================================================
// CONSULTAR DATOS DEL LABORATORIO
// ======================================================

export async function obtenerDatosLaboratorioPDF(
  laboratorioId
) {
  if (!laboratorioId) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const referencia = doc(
    db,
    "laboratorios",
    laboratorioId
  );

  const respuesta = await getDoc(referencia);

  if (!respuesta.exists()) {
    throw new Error(
      "No se encontró el laboratorio."
    );
  }

  const datos = respuesta.data();

  return {
    id: respuesta.id,

    nombre: texto(
      primero(
        datos.nombreVisible,
        datos.nombre
      ),
      "LABORATORIO CLÍNICO"
    ),

    direccion: texto(
      datos.direccion,
      "Dirección no registrada"
    ),

    telefono: texto(
      datos.telefono,
      "Teléfono no registrado"
    ),

    email: texto(
      datos.email,
      ""
    ),

    logoUrl: texto(
      primero(
        datos.logoUrl,
        datos.imagenURL,
        datos.logo
      )
    ),

    colorPrimario: colorLaboratorio(
      datos.colorPrimario
    )
  };
}

// ======================================================
// CONVERTIR IMAGEN A FORMATO COMPATIBLE CON JSPDF
// ======================================================

async function prepararImagen(url) {
  if (!url) {
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

        const contexto =
          canvas.getContext("2d");

        contexto.drawImage(
          imagen,
          0,
          0
        );

        resolve({
          data: canvas.toDataURL(
            "image/png"
          ),
          ancho: imagen.naturalWidth,
          alto: imagen.naturalHeight
        });
      } catch (error) {
        console.warn(
          "No se pudo convertir el logo:",
          error
        );

        resolve(null);
      }
    };

    imagen.onerror = () => {
      console.warn(
        "No se pudo cargar el logo del laboratorio."
      );

      resolve(null);
    };

    imagen.src = url;
  });
}

// ======================================================
// ENCABEZADO INSTITUCIONAL
// ======================================================

function dibujarEncabezado(
  pdf,
  laboratorio,
  logo,
  titulo
) {
  const anchoPagina =
    pdf.internal.pageSize.getWidth();

  const margen = 12;

  const color =
    laboratorio.colorPrimario;

  // Marco superior

  pdf.setDrawColor(75, 85, 99);
  pdf.setLineWidth(0.35);

  pdf.rect(
    margen,
    10,
    anchoPagina - margen * 2,
    34
  );

  // Espacio del logo

  pdf.setDrawColor(180, 185, 195);

  pdf.rect(
    14,
    12,
    42,
    29
  );

  if (logo) {
    try {
      const proporcion =
        logo.ancho / logo.alto;

      let anchoLogo = 38;
      let altoLogo = anchoLogo / proporcion;

      if (altoLogo > 25) {
        altoLogo = 25;
        anchoLogo = altoLogo * proporcion;
      }

      pdf.addImage(
        logo.data,
        "PNG",
        14 + (42 - anchoLogo) / 2,
        12 + (29 - altoLogo) / 2,
        anchoLogo,
        altoLogo
      );
    } catch (error) {
      console.warn(
        "No se pudo insertar el logo:",
        error
      );
    }
  } else {
    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(9);

    pdf.setTextColor(
      ...color
    );

    pdf.text(
      "LABORATORIO",
      35,
      25,
      {
        align: "center"
      }
    );

    pdf.text(
      "CLÍNICO",
      35,
      31,
      {
        align: "center"
      }
    );
  }

  // Nombre del laboratorio

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(12);

  pdf.setTextColor(
    ...color
  );

  const nombre = pdf.splitTextToSize(
    laboratorio.nombre.toUpperCase(),
    90
  );

  pdf.text(
    nombre.slice(0, 2),
    61,
    18
  );

  // Información institucional

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(7);

  pdf.setTextColor(
    55,
    65,
    81
  );

  const informacion = [
    laboratorio.direccion,
    `Tel: ${laboratorio.telefono}`,
    laboratorio.email
  ].filter(Boolean);

  let posicionY =
    nombre.length > 1
      ? 30
      : 25;

  informacion.forEach((linea) => {
    const partes =
      pdf.splitTextToSize(
        linea,
        95
      );

    pdf.text(
      partes.slice(0, 2),
      61,
      posicionY
    );

    posicionY +=
      Math.min(partes.length, 2) * 3.2;
  });

  // Título del documento

  pdf.setFillColor(
    ...color
  );

  pdf.rect(
    12,
    46,
    anchoPagina - 24,
    9,
    "F"
  );

  pdf.setTextColor(
    255,
    255,
    255
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(10);

  pdf.text(
    titulo,
    anchoPagina / 2,
    52,
    {
      align: "center"
    }
  );
}

// ======================================================
// PIE DE PÁGINA
// ======================================================

function dibujarPie(
  pdf,
  laboratorio
) {
  const totalPaginas =
    pdf.internal.getNumberOfPages();

  const anchoPagina =
    pdf.internal.pageSize.getWidth();

  const altoPagina =
    pdf.internal.pageSize.getHeight();

  for (
    let pagina = 1;
    pagina <= totalPaginas;
    pagina++
  ) {
    pdf.setPage(pagina);

    pdf.setDrawColor(
      130,
      140,
      150
    );

    pdf.line(
      12,
      altoPagina - 17,
      anchoPagina - 12,
      altoPagina - 17
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      90,
      100,
      110
    );

    pdf.text(
      laboratorio.nombre,
      12,
      altoPagina - 12
    );

    pdf.text(
      `Impresión: ${fechaHoraTexto(new Date())}`,
      anchoPagina / 2,
      altoPagina - 12,
      {
        align: "center"
      }
    );

    pdf.text(
      `Pág. ${pagina}/${totalPaginas}`,
      anchoPagina - 12,
      altoPagina - 12,
      {
        align: "right"
      }
    );
  }
}

// ======================================================
// SECCIÓN DE INFORMACIÓN DEL PACIENTE
// ======================================================

function dibujarPaciente(
  pdf,
  paciente,
  datosAdicionales = {}
) {
  const filas = [
    [
      "PACIENTE",
      nombrePaciente(paciente),
      "EDAD",
      calcularEdad(paciente)
    ],

    [
      "CI",
      texto(
        primero(
          paciente?.ci,
          paciente?.carnet,
          paciente?.numeroDocumento
        ),
        "No registrado"
      ),
      "SEXO",
      texto(
        paciente?.sexo,
        "No registrado"
      )
    ],

    [
      "MÉDICO",
      texto(
        datosAdicionales.medico,
        "No registrado"
      ),
      "FECHA",
      texto(
        datosAdicionales.fecha,
        fechaTexto(new Date())
      )
    ]
  ];

  autoTable(pdf, {
    startY: 58,

    margin: {
      left: 12,
      right: 12
    },

    theme: "grid",

    body: filas,

    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [
        140,
        150,
        160
      ],
      lineWidth: 0.2,
      textColor: [
        30,
        40,
        50
      ]
    },

    columnStyles: {
      0: {
        fontStyle: "bold",
        cellWidth: 22
      },

      1: {
        cellWidth: 75
      },

      2: {
        fontStyle: "bold",
        cellWidth: 20
      }
    }
  });

  return pdf.lastAutoTable.finalY;
}

// ======================================================
// DETECTAR RESULTADOS FUERA DE RANGO
// ======================================================

function fueraDeRango(
  valor,
  rango
) {
  const valorNumerico =
    Number(
      String(valor)
        .replace(",", ".")
        .trim()
    );

  if (!Number.isFinite(valorNumerico)) {
    return false;
  }

  if (
    rango &&
    typeof rango === "object"
  ) {
    const minimo = Number(
      primero(
        rango.minimo,
        rango.min,
        rango.valorMinimo
      )
    );

    const maximo = Number(
      primero(
        rango.maximo,
        rango.max,
        rango.valorMaximo
      )
    );

    if (
      Number.isFinite(minimo) &&
      Number.isFinite(maximo)
    ) {
      return (
        valorNumerico < minimo ||
        valorNumerico > maximo
      );
    }
  }

  const coincidencia =
    String(rango || "")
      .replace(/,/g, ".")
      .match(
        /(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/
      );

  if (!coincidencia) {
    return false;
  }

  const minimo =
    Number(coincidencia[1]);

  const maximo =
    Number(coincidencia[2]);

  return (
    valorNumerico < minimo ||
    valorNumerico > maximo
  );
}

// ======================================================
// PDF DE RESULTADOS CLÍNICOS
// ======================================================

export async function generarPDFResultado({
  laboratorioId,
  paciente,
  resultado,
  analisis,
  muestra,
  parametros = []
}) {
  if (!resultado) {
    throw new Error(
      "No se seleccionó un resultado."
    );
  }

  const laboratorio =
    await obtenerDatosLaboratorioPDF(
      laboratorioId
    );

  const logo =
    await prepararImagen(
      laboratorio.logoUrl
    );

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  dibujarEncabezado(
    pdf,
    laboratorio,
    logo,
    "INFORME DE RESULTADOS CLÍNICOS"
  );

  const fecha = primero(
    resultado.fechaValidacion,
    resultado.fechaRegistro
  );

  const posicionPaciente =
    dibujarPaciente(
      pdf,
      paciente,
      {
        medico: primero(
          resultado.medico,
          resultado.medicoSolicitante,
          muestra?.medico
        ),

        fecha: fechaTexto(fecha)
      }
    );

  const nombreAnalisis = texto(
    primero(
      resultado.nombreAnalisis,
      resultado.analisisNombre,
      analisis?.nombre,
      analisis?.nombreAnalisis
    ),
    "ANÁLISIS CLÍNICO"
  );

  const tipoMuestra = texto(
    primero(
      muestra?.tipoMuestra,
      muestra?.tipo,
      resultado.tipoMuestra
    ),
    "No registrado"
  );

  const filas = [];

  // Encabezado del análisis

  filas.push([
    {
      content: nombreAnalisis.toUpperCase(),

      colSpan: 4,

      styles: {
        fontStyle: "bold",
        fillColor: [
          238,
          242,
          247
        ]
      }
    }
  ]);

  // Parámetros registrados

  parametros.forEach((parametro) => {
    const valor = primero(
      parametro.valor,
      parametro.valorResultado,
      parametro.resultado,
      parametro.valorRegistrado
    );

    const unidad = texto(
      parametro.unidad
    );

    const rango = primero(
      parametro.rango,
      parametro.rangoReferencia,
      parametro.rangoNormal
    );

    const resultadoTexto =
      valor === ""
        ? "No registrado"
        : `${valor}${unidad ? ` ${unidad}` : ""}`;

    const rangoTexto =
      typeof rango === "object"
        ? texto(
            primero(
              rango.texto,
              rango.descripcion,
              rango.minimo !== undefined &&
              rango.maximo !== undefined
                ? `${rango.minimo} - ${rango.maximo}`
                : ""
            ),
            "No configurado"
          )
        : texto(
            rango,
            "No configurado"
          );

    const anormal =
      fueraDeRango(
        valor,
        rango
      );

    filas.push([
      texto(
        primero(
          parametro.nombre,
          parametro.nombreParametro
        ),
        "Parámetro"
      ),

      tipoMuestra,

      {
        content: resultadoTexto,

        styles: {
          textColor: anormal
            ? [200, 30, 30]
            : [30, 40, 50],

          fontStyle: anormal
            ? "bold"
            : "normal"
        }
      },

      rangoTexto
    ]);
  });

  // Si no existen parámetros individuales,
  // mostrar el resultado principal.

  if (parametros.length === 0) {
    const unidad = texto(
      resultado.unidad
    );

    const valor = texto(
      primero(
        resultado.valorResultado,
        resultado.valor
      ),
      "No registrado"
    );

    const rango = primero(
      resultado.rangoReferencia,
      analisis?.rangoReferencia
    );

    filas.push([
      nombreAnalisis,
      tipoMuestra,
      `${valor}${unidad ? ` ${unidad}` : ""}`,
      texto(rango, "No configurado")
    ]);
  }

  autoTable(pdf, {
    startY: posicionPaciente + 8,

    margin: {
      left: 12,
      right: 12,
      bottom: 23
    },

    head: [[
      "ANÁLISIS",
      "MUESTRA",
      "RESULTADO",
      "RANGO DE REFERENCIA"
    ]],

    body: filas,

    theme: "grid",

    headStyles: {
      fillColor: [
        220,
        226,
        235
      ],

      textColor: [
        25,
        35,
        45
      ],

      fontStyle: "bold",

      halign: "center"
    },

    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineWidth: 0.2,
      lineColor: [
        160,
        170,
        180
      ],
      valign: "middle"
    },

    columnStyles: {
      0: {
        cellWidth: 65
      },

      1: {
        cellWidth: 25
      },

      2: {
        cellWidth: 45
      }
    }
  });

  let posicion =
    pdf.lastAutoTable.finalY + 10;

  // Observaciones

  const observaciones = texto(
    primero(
      resultado.observaciones,
      resultado.observacion
    )
  );

  if (observaciones) {
    if (posicion > 250) {
      pdf.addPage();
      posicion = 25;
    }

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(9);

    pdf.text(
      "OBSERVACIONES:",
      12,
      posicion
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(8);

    const lineas =
      pdf.splitTextToSize(
        observaciones,
        180
      );

    pdf.text(
      lineas,
      12,
      posicion + 5
    );

    posicion +=
      lineas.length * 4 + 12;
  }

  // Validación del bioquímico

  if (posicion > 250) {
    pdf.addPage();
    posicion = 25;
  }

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(9);

  pdf.text(
    "VALIDACIÓN DEL RESULTADO",
    12,
    posicion
  );

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(8);

  pdf.text(
    `Bioquímico: ${texto(
      primero(
        resultado.validadoPorNombre,
        resultado.nombreValidador
      ),
      "No registrado"
    )}`,
    12,
    posicion + 6
  );

  pdf.text(
    `Fecha de validación: ${fechaHoraTexto(
      resultado.fechaValidacion
    )}`,
    12,
    posicion + 12
  );

  dibujarPie(
    pdf,
    laboratorio
  );

  pdf.save(
    `Resultado_${texto(resultado.id, "clinico")}.pdf`
  );
}

// ======================================================
// OBTENER DETALLES DE VENTA
// ======================================================

function obtenerDetallesVenta(venta) {
  const origen = primero(
    venta?.analisis,
    venta?.detalles,
    venta?.detalleVenta,
    venta?.detallesVenta,
    venta?.items,
    venta?.productos,
    venta?.analisisVendidos
  );

  const lista = Array.isArray(origen)
    ? origen
    : origen && typeof origen === "object"
      ? Object.values(origen)
      : [];

  return lista.map((item) => {
    const cantidad = numero(
      primero(
        item.cantidad,
        1
      )
    );

    const precio = numero(
      primero(
        item.precioUnitario,
        item.precio,
        item.costo
      )
    );

    return {
      nombre: texto(
        primero(
          item.nombre,
          item.nombreAnalisis,
          item.analisisNombre
        ),
        "Análisis clínico"
      ),

      cantidad,

      precio,

      subtotal: numero(
        primero(
          item.subtotal,
          cantidad * precio
        )
      )
    };
  });
}

// ======================================================
// PDF DE NOTA DE VENTA
// ======================================================

export async function generarPDFVenta({
  laboratorioId,
  paciente,
  venta
}) {
  if (!venta) {
    throw new Error(
      "No se seleccionó una venta."
    );
  }

  const laboratorio =
    await obtenerDatosLaboratorioPDF(
      laboratorioId
    );

  const logo =
    await prepararImagen(
      laboratorio.logoUrl
    );

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  dibujarEncabezado(
    pdf,
    laboratorio,
    logo,
    "NOTA DE VENTA - SERVICIOS DE LABORATORIO"
  );

  const posicionPaciente =
    dibujarPaciente(
      pdf,
      paciente,
      {
        fecha: fechaTexto(
          primero(
            venta.fecha,
            venta.fechaVenta,
            venta.createdAt
          )
        )
      }
    );

  const color =
    laboratorio.colorPrimario;

  const datosVenta = [
    [
      "N.º VENTA",
      texto(
        primero(
          venta.ventaId,
          venta.id
        ),
        "No registrado"
      )
    ],

    [
      "N.º ORDEN",
      texto(
        venta.ordenId,
        "No registrado"
      )
    ],

    [
      "MÉTODO DE PAGO",
      texto(
        venta.metodoPago,
        "No registrado"
      ).toUpperCase()
    ],

    [
      "ESTADO",
      texto(
        venta.estado,
        "Pagada"
      ).toUpperCase()
    ]
  ];

  autoTable(pdf, {
    startY: posicionPaciente + 7,

    margin: {
      left: 12,
      right: 12
    },

    head: [[
      "INFORMACIÓN",
      "DETALLE"
    ]],

    body: datosVenta,

    theme: "grid",

    headStyles: {
      fillColor: color
    },

    styles: {
      fontSize: 8,
      cellPadding: 3
    }
  });

  const detalles =
    obtenerDetallesVenta(venta);

  const filas = detalles.map(
    (item) => [
      item.nombre,
      String(item.cantidad),
      `Bs ${moneda(item.precio)}`,
      `Bs ${moneda(item.subtotal)}`
    ]
  );

  if (filas.length === 0) {
    filas.push([
      "Detalle no disponible",
      "-",
      "-",
      "-"
    ]);
  }

  autoTable(pdf, {
    startY:
      pdf.lastAutoTable.finalY + 9,

    margin: {
      left: 12,
      right: 12,
      bottom: 25
    },

    head: [[
      "ANÁLISIS",
      "CANTIDAD",
      "PRECIO UNITARIO",
      "SUBTOTAL"
    ]],

    body: filas,

    theme: "grid",

    headStyles: {
      fillColor: color
    },

    styles: {
      fontSize: 8,
      cellPadding: 3
    },

    columnStyles: {
      1: {
        halign: "center"
      },

      2: {
        halign: "right"
      },

      3: {
        halign: "right"
      }
    }
  });

  const total = numero(
    primero(
      venta.total,
      venta.montoTotal,
      venta.totalVenta
    )
  );

  let posicion =
    pdf.lastAutoTable.finalY + 12;

  if (posicion > 260) {
    pdf.addPage();
    posicion = 30;
  }

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(14);

  pdf.setTextColor(
    ...color
  );

  pdf.text(
    `TOTAL PAGADO: Bs ${moneda(total)}`,
    198,
    posicion,
    {
      align: "right"
    }
  );

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(8);

  pdf.setTextColor(
    75,
    85,
    95
  );

  pdf.text(
    "Gracias por confiar en nuestros servicios.",
    105,
    posicion + 12,
    {
      align: "center"
    }
  );

  dibujarPie(
    pdf,
    laboratorio
  );

  pdf.save(
    `Nota_Venta_${texto(
      primero(
        venta.ventaId,
        venta.id
      ),
      "laboratorio"
    )}.pdf`
  );
}