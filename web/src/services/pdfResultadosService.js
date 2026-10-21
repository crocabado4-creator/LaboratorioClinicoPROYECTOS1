import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function texto(valor, defecto = "-") {
  const resultado =
    String(valor ?? "").trim();

  return resultado || defecto;
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  return (
    texto(
      paciente.nombreCompleto,
      ""
    ) ||
    `${texto(
      paciente.nombres ??
        paciente.nombre,
      ""
    )} ${texto(
      paciente.apellidos ??
        paciente.apellido,
      ""
    )}`.trim() ||
    "Paciente no identificado"
  );
}

function fechaVisible(valor) {
  if (!valor) {
    return "-";
  }

  const fecha =
    typeof valor?.toDate ===
    "function"
      ? valor.toDate()
      : typeof valor === "number"
        ? new Date(valor)
        : new Date(valor);

  return Number.isNaN(
    fecha.getTime()
  )
    ? "-"
    : fecha.toLocaleString(
        "es-BO"
      );
}

export function generarPDFResultados({
  laboratorio,
  informe,
}) {
  if (!informe) {
    throw new Error(
      "Selecciona un informe."
    );
  }

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const nombreLaboratorio =
    texto(
      laboratorio?.nombreVisible,
      ""
    ) ||
    texto(
      laboratorio?.nombre,
      ""
    ) ||
    "Laboratorio Clínico";

  let y = 16;

  pdf.setFontSize(17);
  pdf.text(
    nombreLaboratorio,
    14,
    y
  );

  y += 7;
  pdf.setFontSize(9);

  const datosLaboratorio = [
    laboratorio?.direccion
      ? `Dirección: ${laboratorio.direccion}`
      : "",
    laboratorio?.telefono
      ? `Teléfono: ${laboratorio.telefono}`
      : "",
    laboratorio?.email
      ? `Correo: ${laboratorio.email}`
      : "",
  ].filter(Boolean);

  datosLaboratorio.forEach(
    (linea) => {
      pdf.text(linea, 14, y);
      y += 5;
    }
  );

  y += 3;
  pdf.setFontSize(14);
  pdf.text(
    "Informe de resultados",
    14,
    y
  );

  y += 8;
  pdf.setFontSize(10);

  pdf.text(
    `Paciente: ${nombrePaciente(
      informe.paciente
    )}`,
    14,
    y
  );

  y += 5;

  pdf.text(
    `CI: ${texto(
      informe.paciente?.ci ??
        informe.paciente?.carnet
    )}`,
    14,
    y
  );

  y += 5;

  pdf.text(
    `Orden: ${texto(
      informe.ordenId
    )}`,
    14,
    y
  );

  y += 5;

  pdf.text(
    `Fecha de validación: ${fechaVisible(
      informe.fechaValidacion
    )}`,
    14,
    y
  );

  y += 7;

  informe.resultados.forEach(
    (resultado, indice) => {
      if (
        indice > 0 &&
        y > 235
      ) {
        pdf.addPage();
        y = 16;
      }

      pdf.setFontSize(12);

      pdf.text(
        texto(
          resultado.analisisNombre,
          "Análisis clínico"
        ),
        14,
        y
      );

      y += 4;

      autoTable(pdf, {
        startY: y,
        head: [
          [
            "Parámetro",
            "Resultado",
            "Unidad",
            "Rango",
            "Observación",
          ],
        ],
        body: (
          resultado.parametros ||
          []
        ).map(
          (parametro) => [
            texto(
              parametro.nombreParametro
            ),
            texto(
              parametro.valor
            ),
            texto(
              parametro.unidad
            ),
            texto(
              parametro.rangoReferencia
            ),
            texto(
              parametro.observacion
            ),
          ]
        ),
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [
            23,
            54,
            93,
          ],
        },
        margin: {
          left: 14,
          right: 14,
        },
      });

      y =
        (pdf.lastAutoTable
          ?.finalY || y) + 7;

      pdf.setFontSize(8);

      pdf.text(
        `Validado por: ${texto(
          resultado.validadoPorNombre ??
            resultado.validadoPor
        )}`,
        14,
        y
      );

      y += 4;

      pdf.text(
        `Fecha: ${fechaVisible(
          resultado.fechaValidacion
        )}`,
        14,
        y
      );

      y += 7;
    }
  );

  const nombreArchivo =
    `resultados_${String(
      informe.ordenId
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      )
      .slice(0, 60)}.pdf`;

  pdf.save(nombreArchivo);

  return nombreArchivo;
}
