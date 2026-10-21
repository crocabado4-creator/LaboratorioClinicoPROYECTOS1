import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listarInformesFinalizados,
  obtenerLaboratorioInforme,
} from "../services/informeResultadosService";

import {
  generarPDFResultados,
} from "../services/pdfResultadosService";

import "./Sprint3.css";

function texto(valor) {
  return String(valor ?? "").trim();
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  return (
    texto(paciente.nombreCompleto) ||
    `${texto(
      paciente.nombres ??
        paciente.nombre
    )} ${texto(
      paciente.apellidos ??
        paciente.apellido
    )}`.trim() ||
    "Paciente no identificado"
  );
}

function ciPaciente(paciente) {
  return (
    texto(
      paciente?.ci ??
        paciente?.carnet
    ) || "-"
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
      : typeof valor ===
          "number"
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

export default function InformeResultados({
  usuario,
  onVolver,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const [
    informes,
    setInformes,
  ] = useState([]);

  const [
    laboratorio,
    setLaboratorio,
  ] = useState(null);

  const [
    seleccionado,
    setSeleccionado,
  ] = useState(null);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const cargar = async () => {
    if (!laboratorioId) {
      setError(
        "No se identificó el laboratorio."
      );
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const [
        lista,
        datosLaboratorio,
      ] = await Promise.all([
        listarInformesFinalizados(
          laboratorioId
        ),
        obtenerLaboratorioInforme(
          laboratorioId
        ),
      ]);

      setInformes(lista);
      setLaboratorio(
        datosLaboratorio
      );

      setSeleccionado(
        (actual) => {
          if (!actual) {
            return null;
          }

          return (
            lista.find(
              (item) =>
                item.ordenId ===
                actual.ordenId
            ) || null
          );
        }
      );
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "No se pudieron cargar los informes."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [laboratorioId]);

  const filtrados =
    useMemo(() => {
      const termino =
        texto(
          busqueda
        ).toLowerCase();

      if (!termino) {
        return informes;
      }

      return informes.filter(
        (informe) => {
          const contenido = [
            nombrePaciente(
              informe.paciente
            ),
            ciPaciente(
              informe.paciente
            ),
            informe.ordenId,
            ...informe.resultados.map(
              (resultado) =>
                resultado.analisisNombre
            ),
          ]
            .join(" ")
            .toLowerCase();

          return contenido.includes(
            termino
          );
        }
      );
    }, [
      informes,
      busqueda,
    ]);

  const descargarPDF = () => {
    try {
      generarPDFResultados({
        laboratorio,
        informe:
          seleccionado,
      });
    } catch (e) {
      setError(
        e?.message ||
          "No se pudo generar el PDF."
      );
    }
  };

  return (
    <div className="s3-page">
      <div className="s3-header">
        <div>
          <h1>
            Informe de resultados
          </h1>

          <p>
            HU-30 y HU-31:
            informe clínico y PDF
            de resultados finalizados.
          </p>
        </div>

        <div className="s3-actions">
          <button
            className="s3-button secondary"
            type="button"
            onClick={cargar}
          >
            Actualizar
          </button>

          <button
            className="s3-button secondary"
            type="button"
            onClick={onVolver}
          >
            Volver
          </button>
        </div>
      </div>

      {error && (
        <div className="s3-error">
          {error}
        </div>
      )}

      <div className="s3-toolbar">
        <input
          value={busqueda}
          onChange={(e) =>
            setBusqueda(
              e.target.value
            )
          }
          placeholder="Paciente, CI, orden o análisis"
        />

        <span className="s3-muted">
          {filtrados.length} orden(es)
          con resultados finalizados
        </span>
      </div>

      {cargando ? (
        <div className="s3-empty">
          Cargando informes...
        </div>
      ) : filtrados.length ===
        0 ? (
        <div className="s3-empty">
          No existen resultados
          finalizados disponibles.
        </div>
      ) : (
        <div className="s3-layout">
          <div className="s3-list">
            {filtrados.map(
              (informe) => (
                <div
                  className="s3-card"
                  key={
                    informe.ordenId
                  }
                >
                  <h3>
                    {nombrePaciente(
                      informe.paciente
                    )}
                  </h3>

                  <p>
                    <strong>
                      CI:
                    </strong>{" "}
                    {ciPaciente(
                      informe.paciente
                    )}
                  </p>

                  <p>
                    <strong>
                      Orden:
                    </strong>{" "}
                    {informe.ordenId}
                  </p>

                  <p>
                    <strong>
                      Análisis:
                    </strong>{" "}
                    {
                      informe
                        .resultados
                        .length
                    }
                  </p>

                  <button
                    className="s3-button"
                    type="button"
                    onClick={() =>
                      setSeleccionado(
                        informe
                      )
                    }
                  >
                    Ver informe
                  </button>
                </div>
              )
            )}
          </div>

          <div className="s3-detail">
            {!seleccionado ? (
              <div className="s3-empty">
                Selecciona una orden
                para ver su informe.
              </div>
            ) : (
              <>
                <div className="s3-header">
                  <div>
                    <h2>
                      Informe clínico
                    </h2>

                    <p>
                      Orden{" "}
                      {
                        seleccionado
                          .ordenId
                      }
                    </p>
                  </div>

                  <div className="s3-actions">
                    <span className="s3-badge">
                      FINALIZADO
                    </span>

                    <button
                      className="s3-button"
                      type="button"
                      onClick={
                        descargarPDF
                      }
                    >
                      Generar PDF
                    </button>
                  </div>
                </div>

                <div className="s3-card">
                  <p>
                    <strong>
                      Paciente:
                    </strong>{" "}
                    {nombrePaciente(
                      seleccionado
                        .paciente
                    )}
                  </p>

                  <p>
                    <strong>
                      CI:
                    </strong>{" "}
                    {ciPaciente(
                      seleccionado
                        .paciente
                    )}
                  </p>

                  <p>
                    <strong>
                      Orden:
                    </strong>{" "}
                    {
                      seleccionado
                        .ordenId
                    }
                  </p>

                  <p>
                    <strong>
                      Última validación:
                    </strong>{" "}
                    {fechaVisible(
                      seleccionado
                        .fechaValidacion
                    )}
                  </p>
                </div>

                {seleccionado.resultados.map(
                  (resultado) => (
                    <div
                      className="s3-card"
                      key={
                        resultado.id
                      }
                    >
                      <div className="s3-header">
                        <div>
                          <h3>
                            {
                              resultado
                                .analisisNombre
                            }
                          </h3>
                        </div>

                        <span className="s3-badge">
                          Validado
                        </span>
                      </div>

                      <div className="s3-table-wrap">
                        <table className="s3-table">
                          <thead>
                            <tr>
                              <th>
                                Parámetro
                              </th>
                              <th>
                                Resultado
                              </th>
                              <th>
                                Unidad
                              </th>
                              <th>
                                Rango
                              </th>
                              <th>
                                Observación
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {resultado.parametros.map(
                              (
                                parametro,
                                indice
                              ) => (
                                <tr
                                  key={
                                    parametro
                                      .parametroId ||
                                    `${resultado.id}-${indice}`
                                  }
                                >
                                  <td>
                                    {
                                      parametro
                                        .nombreParametro
                                    }
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        parametro
                                          .valor
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {
                                      parametro
                                        .unidad
                                    }
                                  </td>

                                  <td>
                                    {
                                      parametro
                                        .rangoReferencia
                                    }
                                  </td>

                                  <td>
                                    {parametro.observacion ||
                                      "-"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      <p className="s3-muted">
                        Validado por:{" "}
                        {resultado.validadoPorNombre ||
                          resultado.validadoPor ||
                          "-"}{" "}
                        |{" "}
                        {fechaVisible(
                          resultado
                            .fechaValidacion
                        )}
                      </p>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
