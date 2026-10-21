
import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type {
  InformeClinico,
} from "./informeResultadosService";

function seguro(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mostrar(valor: unknown): string {
  const contenido = String(valor ?? "").trim();
  return seguro(contenido || "-");
}

function crearHTML(informe: InformeClinico): string {
  const filas = informe.parametros.length
    ? informe.parametros
        .map(
          (parametro) => `
            <tr>
              <td>${mostrar(parametro.nombre)}</td>
              <td>${mostrar(parametro.valor)}</td>
              <td>${mostrar(parametro.unidad)}</td>
              <td>${mostrar(parametro.referencia)}</td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>${mostrar(informe.analisisNombre)}</td>
          <td>${mostrar(informe.valorResultado)}</td>
          <td>${mostrar(informe.unidad)}</td>
          <td>-</td>
        </tr>
      `;

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Informe de resultados clínicos</title>
        <style>
          @page {
            size: A4;
            margin: 18mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            color: #243447;
            font-size: 12px;
          }

          .encabezado {
            background: #19385f;
            color: white;
            padding: 24px;
            border-radius: 10px;
          }

          h1 {
            font-size: 21px;
            margin: 0 0 8px;
          }

          h2 {
            font-size: 15px;
            color: #19385f;
            margin-top: 22px;
          }

          .laboratorio {
            font-size: 15px;
          }

          .estado {
            color: #047857;
            font-weight: bold;
          }

          .datos {
            padding: 15px;
            background: #f1f5f9;
            border-radius: 8px;
          }

          .datos p {
            margin: 8px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }

          th {
            background: #dbeafe;
            color: #19385f;
            text-align: left;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 10px;
            word-break: break-word;
          }

          tr {
            break-inside: avoid;
          }

          .pie {
            margin-top: 35px;
            padding-top: 15px;
            border-top: 1px solid #cbd5e1;
          }
        </style>
      </head>

      <body>
        <div class="encabezado">
          <h1>INFORME DE RESULTADOS CLÍNICOS</h1>
          <div class="laboratorio">
            ${mostrar(informe.laboratorioNombre)}
          </div>
        </div>

        <h2>Datos del paciente</h2>
        <div class="datos">
          <p><strong>Nombre:</strong>
            ${mostrar(informe.pacienteNombre)}
          </p>
          <p><strong>CI:</strong>
            ${mostrar(informe.pacienteCI)}
          </p>
          <p><strong>Orden:</strong>
            ${mostrar(informe.ordenId)}
          </p>
          <p><strong>Fecha de registro:</strong>
            ${mostrar(informe.fechaRegistro)}
          </p>
        </div>

        <h2>Resultado clínico</h2>
        <div class="datos">
          <p><strong>Análisis:</strong>
            ${mostrar(informe.analisisNombre)}
          </p>
          <p><strong>Estado:</strong>
            <span class="estado">VALIDADO</span>
          </p>
          <p><strong>Observaciones:</strong>
            ${mostrar(informe.observaciones)}
          </p>
        </div>

        <h2>Valores y rangos de referencia</h2>
        <table>
          <thead>
            <tr>
              <th>Parámetro</th>
              <th>Resultado</th>
              <th>Unidad</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>

        <div class="pie">
          <p><strong>Validado por:</strong>
            ${mostrar(informe.validadoPorNombre)}
          </p>
          <p><strong>Fecha de validación:</strong>
            ${mostrar(informe.fechaValidacion)}
          </p>
          <p><strong>ID de resultado:</strong>
            ${mostrar(informe.id)}
          </p>
        </div>
      </body>
    </html>
  `;
}

export async function generarPDFResultado(
  informe: InformeClinico
): Promise<void> {
  if (
    informe.estado !== "validado" &&
    informe.estado !== "finalizado"
  ) {
    throw new Error(
      "Solo se pueden generar PDF de resultados validados."
    );
  }

  const html = crearHTML(informe);

  if (Platform.OS === "web") {
    const ventana = window.open("", "_blank");

    if (!ventana) {
      throw new Error(
        "El navegador bloqueó la ventana del PDF."
      );
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();

    setTimeout(() => {
      ventana.focus();
      ventana.print();
    }, 400);

    return;
  }

  const disponible = await Sharing.isAvailableAsync();

  if (!disponible) {
    throw new Error(
      "Este dispositivo no permite compartir archivos."
    );
  }

  const archivo = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
  });

  await Sharing.shareAsync(archivo.uri, {
    mimeType: "application/pdf",
    UTI: ".pdf",
    dialogTitle: "Compartir informe clínico",
  });
}
