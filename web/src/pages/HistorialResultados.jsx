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
  return (
    texto(
      paciente?.nombreCompleto
    ) ||
    `${texto(
      paciente?.nombres ??
        paciente?.nombre
    )} ${texto(
      paciente?.apellidos ??
        paciente?.apellido
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

export default function HistorialResultados({
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
    pacienteId,
    setPacienteId,
  ] = useState("");

  const [
    seleccionado,
    setSeleccionado,
  ] = useState(null);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const cargar = async () => {
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
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "No se pudo cargar el historial."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (laboratorioId) {
      cargar();
    }
  }, [laboratorioId]);

  const pacientes =
    useMemo(() => {
      const mapa =
        new Map();

      informes.forEach(
        (informe) => {
          if (
            informe.pacienteId &&
            informe.paciente
          ) {
            mapa.set(
              informe.pacienteId,
              informe.paciente
            );
          }
        }
      );

      return Array.from(
        mapa.entries()
      )
        .map(
          ([
            id,
            paciente,
          ]) => ({
            id,
            paciente,
          })
        )
        .sort(
          (a, b) =>
            nombrePaciente(
              a.paciente
            ).localeCompare(
              nombrePaciente(
                b.paciente
              ),
              "es"
            )
        );
    }, [informes]);

  const historial =
    useMemo(() => {
      if (!pacienteId) {
        return [];
      }

      const termino =
        texto(
          busqueda
        ).toLowerCase();

      return informes.filter(
        (informe) => {
          if (
            informe.pacienteId !==
            pacienteId
          ) {
            return false;
          }

          if (!termino) {
            return true;
          }

          return [
            informe.ordenId,
            ...informe.resultados.map(
              (resultado) =>
                resultado.analisisNombre
            ),
          ]
            .join(" ")
            .toLowerCase()
            .includes(termino);
        }
      );
    }, [
      informes,
      pacienteId,
      busqueda,
    ]);

  return (
    <div className="s3-page">
      <div className="s3-header">
        <div>
          <h1>
            Historial de resultados
          </h1>

          <p>
            HU-32: resultados
            finalizados anteriores
            del paciente.
          </p>
        </div>

        <button
          className="s3-button secondary"
          type="button"
          onClick={onVolver}
        >
          Volver
        </button>
      </div>

      {error && (
        <div className="s3-error">
          {error}
        </div>
      )}

      <div className="s3-toolbar">
        <select
          value={pacienteId}
          onChange={(e) => {
            setPacienteId(
              e.target.value
            );
            setSeleccionado(
              null
            );
          }}
        >
          <option value="">
            Selecciona un paciente
          </option>

          {pacientes.map(
            ({
              id,
              paciente,
            }) => (
              <option
                key={id}
                value={id}
              >
                {nombrePaciente(
                  paciente
                )}{" "}
                - CI{" "}
                {ciPaciente(
                  paciente
                )}
              </option>
            )
          )}
        </select>

        <input
          value={busqueda}
          onChange={(e) =>
            setBusqueda(
              e.target.value
            )
          }
          placeholder="Filtrar por orden o análisis"
        />
      </div>

      {cargando ? (
        <div className="s3-empty">
          Cargando historial...
        </div>
      ) : !pacienteId ? (
        <div className="s3-empty">
          Selecciona un paciente.
        </div>
      ) : historial.length ===
        0 ? (
        <div className="s3-empty">
          El paciente no tiene
          resultados finalizados.
        </div>
      ) : (
        <div className="s3-layout">
          <div className="s3-list">
            {historial.map(
              (informe) => (
                <div
                  className="s3-card"
                  key={
                    informe.ordenId
                  }
                >
                  <h3>
                    Orden{" "}
                    {informe.ordenId}
                  </h3>

                  <p>
                    {informe.resultados
                      .map(
                        (resultado) =>
                          resultado
                            .analisisNombre
                      )
                      .join(", ")}
                  </p>

                  <p className="s3-muted">
                    {fechaVisible(
                      informe.fechaValidacion
                    )}
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
                    Consultar informe
                  </button>
                </div>
              )
            )}
          </div>

          <div className="s3-detail">
            {!seleccionado ? (
              <div className="s3-empty">
                Selecciona un
                registro del historial.
              </div>
            ) : (
              <>
                <div className="s3-header">
                  <div>
                    <h2>
                      {nombrePaciente(
                        seleccionado
                          .paciente
                      )}
                    </h2>

                    <p>
                      Orden{" "}
                      {
                        seleccionado
                          .ordenId
                      }
                    </p>
                  </div>

                  <button
                    className="s3-button"
                    type="button"
                    onClick={() =>
                      generarPDFResultados(
                        {
                          laboratorio,
                          informe:
                            seleccionado,
                        }
                      )
                    }
                  >
                    PDF
                  </button>
                </div>

                {seleccionado.resultados.map(
                  (resultado) => (
                    <div
                      className="s3-card"
                      key={
                        resultado.id
                      }
                    >
                      <h3>
                        {
                          resultado
                            .analisisNombre
                        }
                      </h3>

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
                                    indice
                                  }
                                >
                                  <td>
                                    {
                                      parametro
                                        .nombreParametro
                                    }
                                  </td>
                                  <td>
                                    {
                                      parametro
                                        .valor
                                    }
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
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
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
