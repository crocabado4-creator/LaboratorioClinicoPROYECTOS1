
import {
  useCallback,
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

import "./InformesResultados.css";

function texto(valor) {
  return String(valor ?? "").trim();
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  const completo = texto(
    paciente.nombreCompleto
  );

  if (completo) {
    return completo;
  }

  const nombres = texto(
    paciente.nombres ?? paciente.nombre
  );

  const apellidos = texto(
    paciente.apellidos ?? paciente.apellido
  );

  return (
    [nombres, apellidos]
      .filter(Boolean)
      .join(" ") ||
    "Paciente no identificado"
  );
}

function ciPaciente(paciente) {
  return (
    texto(paciente?.ci ?? paciente?.carnet) ||
    "No registrado"
  );
}

function fechaVisible(valor) {
  if (!valor) {
    return "Sin fecha";
  }

  const fecha =
    typeof valor.toDate === "function"
      ? valor.toDate()
      : typeof valor.seconds === "number"
      ? new Date(valor.seconds * 1000)
      : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Sin fecha";
  }

  return fecha.toLocaleString("es-BO");
}

function mensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firebase rechazó una lectura necesaria. " +
      "Verifica los permisos de Firestore " +
      "para este laboratorio y tu rol."
    );
  }

  return (
    error?.message ||
    "No se pudo cargar el historial de resultados."
  );
}

export default function HistorialResultados({
  usuario,
  onVolver,
}) {
  const laboratorioId = texto(
    usuario?.laboratorioId
  );

  const [informes, setInformes] = useState([]);
  const [laboratorio, setLaboratorio] = useState(null);

  const [pacienteId, setPacienteId] = useState("");

  const [
    ordenSeleccionada,
    setOrdenSeleccionada,
  ] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "No se identificó el laboratorio del usuario."
      );

      setInformes([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [lista, datosLaboratorio] =
        await Promise.all([
          listarInformesFinalizados(laboratorioId),
          obtenerLaboratorioInforme(laboratorioId),
        ]);

      setInformes(lista);
      setLaboratorio(datosLaboratorio);

      setPacienteId((actual) =>
        lista.some(
          (informe) => informe.pacienteId === actual
        )
          ? actual
          : ""
      );

      setOrdenSeleccionada((actual) =>
        lista.some(
          (informe) => informe.ordenId === actual
        )
          ? actual
          : ""
      );
    } catch (e) {
      console.error(
        "Error al cargar historial:",
        e
      );

      setError(mensajeError(e));
      setInformes([]);
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // PACIENTES CON INFORMES

  const pacientes = useMemo(() => {
    const mapa = new Map();

    informes.forEach((informe) => {
      if (
        informe.pacienteId &&
        informe.paciente
      ) {
        mapa.set(
          informe.pacienteId,
          informe.paciente
        );
      }
    });

    return Array.from(
      mapa,
      ([id, paciente]) => ({
        id,
        paciente,
      })
    ).sort((a, b) =>
      nombrePaciente(a.paciente).localeCompare(
        nombrePaciente(b.paciente),
        "es"
      )
    );
  }, [informes]);

  // HISTORIAL FILTRADO

  const historial = useMemo(() => {
    if (!pacienteId) {
      return [];
    }

    const termino = texto(busqueda)
      .toLocaleLowerCase("es");

    return informes.filter((informe) => {
      if (informe.pacienteId !== pacienteId) {
        return false;
      }

      if (!termino) {
        return true;
      }

      const contenido = [
        texto(informe.ordenId),
        ...(informe.resultados ?? []).map(
          (resultado) =>
            texto(resultado.analisisNombre)
        ),
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return contenido.includes(termino);
    });
  }, [
    informes,
    pacienteId,
    busqueda,
  ]);

  const seleccionado =
    historial.find(
      (informe) =>
        informe.ordenId === ordenSeleccionada
    ) ?? null;

  // GENERACIÓN DE PDF

  const descargarPDF = async () => {
    if (!seleccionado || generandoPDF) {
      return;
    }

    setError("");
    setGenerandoPDF(true);

    try {
      await generarPDFResultados({
        laboratorio,
        informe: seleccionado,
      });
    } catch (e) {
      console.error(
        "Error al generar PDF histórico:",
        e
      );

      setError(
        e?.message ||
        "No se pudo generar el PDF del historial."
      );
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <main className="ir-page">
      {/* ENCABEZADO */}

      <header className="ir-page-header">
        <div>
          <div className="ir-eyebrow">
            RESULTADOS CLÍNICOS
          </div>

          <h1>Historial de resultados</h1>

          <p>
            Consulta los análisis finalizados
            anteriormente y recupera sus informes.
          </p>
        </div>

        <div className="ir-actions">
          <button
            type="button"
            className="ir-btn ir-btn-secondary"
            onClick={cargar}
            disabled={cargando}
          >
            {cargando
              ? "Actualizando..."
              : "Actualizar"}
          </button>

          <button
            type="button"
            className="ir-btn ir-btn-secondary"
            onClick={onVolver}
          >
            Volver
          </button>
        </div>
      </header>

      {/* MENSAJE DE ERROR */}

      {error && (
        <div className="ir-alert" role="alert">
          {error}
        </div>
      )}

      {/* BUSCADORES */}

      <section className="ir-panel ir-filters ir-history-filters">
        <div className="ir-filter-field">
          <label htmlFor="ir-paciente-historial">
            Paciente
          </label>

          <select
            id="ir-paciente-historial"
            value={pacienteId}
            onChange={(e) => {
              setPacienteId(e.target.value);
              setOrdenSeleccionada("");
              setBusqueda("");
            }}
          >
            <option value="">
              Selecciona un paciente
            </option>

            {pacientes.map(
              ({ id, paciente }) => (
                <option
                  key={id}
                  value={id}
                >
                  {nombrePaciente(paciente)}
                  {" · CI "}
                  {ciPaciente(paciente)}
                </option>
              )
            )}
          </select>
        </div>

        <div className="ir-filter-field">
          <label htmlFor="ir-buscar-historial">
            Buscar en el historial
          </label>

          <input
            id="ir-buscar-historial"
            type="search"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            placeholder="Orden o nombre del análisis"
            disabled={!pacienteId}
          />
        </div>
      </section>

      {/* HISTORIAL */}

      {cargando ? (
        <div
          className="ir-panel ir-empty"
          role="status"
        >
          Cargando historial de resultados...
        </div>
      ) : error ? null : !pacienteId ? (
        <div className="ir-panel ir-empty">
          {pacientes.length === 0
            ? "No hay pacientes con resultados finalizados disponibles."
            : "Selecciona un paciente para consultar sus resultados anteriores."}
        </div>
      ) : historial.length === 0 ? (
        <div className="ir-panel ir-empty">
          {busqueda.trim()
            ? "No se encontraron resultados para esa búsqueda."
            : "Este paciente no tiene resultados finalizados disponibles."}
        </div>
      ) : (
        <section className="ir-layout">
          {/* LISTA DE ÓRDENES */}

          <div
            className="ir-list"
            aria-label="Resultados anteriores"
          >
            <div className="ir-list-heading">
              {historial.length} orden(es) encontradas
            </div>

            {historial.map((informe) => (
              <article
                className={
                  "ir-panel ir-list-card " +
                  (ordenSeleccionada ===
                  informe.ordenId
                    ? "ir-selected"
                    : "")
                }
                key={informe.ordenId}
              >
                <div className="ir-card-top">
                  <h2>
                    Orden {informe.ordenId}
                  </h2>

                  <span className="ir-status">
                    Finalizado
                  </span>
                </div>

                <p>
                  {(informe.resultados ?? [])
                    .map(
                      (resultado) =>
                        resultado.analisisNombre
                    )
                    .join(", ") ||
                    "Análisis clínico"}
                </p>

                <p className="ir-muted">
                  {fechaVisible(
                    informe.fechaValidacion
                  )}
                </p>

                <button
                  type="button"
                  className="ir-btn ir-btn-primary"
                  onClick={() =>
                    setOrdenSeleccionada(
                      informe.ordenId
                    )
                  }
                  aria-pressed={
                    ordenSeleccionada ===
                    informe.ordenId
                  }
                >
                  Consultar informe
                </button>
              </article>
            ))}
          </div>

          {/* DETALLE DEL HISTORIAL */}

          <div className="ir-panel ir-detail">
            {!seleccionado ? (
              <div className="ir-empty">
                Selecciona una orden del historial
                para ver el detalle.
              </div>
            ) : (
              <>
                <div className="ir-detail-header">
                  <div>
                    <div className="ir-eyebrow">
                      HISTORIAL CLÍNICO
                    </div>

                    <h2>
                      {nombrePaciente(
                        seleccionado.paciente
                      )}
                    </h2>

                    <p className="ir-muted">
                      Orden: {seleccionado.ordenId}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="ir-btn ir-btn-primary"
                    onClick={descargarPDF}
                    disabled={generandoPDF}
                  >
                    {generandoPDF
                      ? "Generando..."
                      : "Generar PDF"}
                  </button>
                </div>

                {/* INFORMACIÓN DEL PACIENTE */}

                <div className="ir-patient-grid">
                  <div>
                    <span>Paciente</span>

                    <strong>
                      {nombrePaciente(
                        seleccionado.paciente
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>CI</span>

                    <strong>
                      {ciPaciente(
                        seleccionado.paciente
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Fecha de validación
                    </span>

                    <strong>
                      {fechaVisible(
                        seleccionado.fechaValidacion
                      )}
                    </strong>
                  </div>
                </div>

                {/* RESULTADOS ANTERIORES */}

                {(seleccionado.resultados ?? []).map(
                  (resultado) => (
                    <section
                      className="ir-result"
                      key={resultado.id}
                    >
                      <div className="ir-result-header">
                        <h3>
                          {texto(
                            resultado.analisisNombre
                          ) || "Análisis clínico"}
                        </h3>

                        <span className="ir-status">
                          Validado
                        </span>
                      </div>

                      <div className="ir-table-scroll">
                        <table className="ir-table">
                          <thead>
                            <tr>
                              <th>Parámetro</th>
                              <th>Resultado</th>
                              <th>Unidad</th>
                              <th>Referencia</th>
                              <th>Observación</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(resultado.parametros ?? [])
                              .map(
                                (parametro, indice) => (
                                  <tr
                                    key={
                                      resultado.id +
                                      "-" +
                                      (parametro.parametroId ??
                                      indice)
                                    }
                                  >
                                    <td>
                                      {parametro.nombreParametro}
                                    </td>

                                    <td>
                                      <strong>
                                        {parametro.valor}
                                      </strong>
                                    </td>

                                    <td>
                                      {parametro.unidad}
                                    </td>

                                    <td>
                                      {parametro.rangoReferencia}
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
                    </section>
                  )
                )}
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
