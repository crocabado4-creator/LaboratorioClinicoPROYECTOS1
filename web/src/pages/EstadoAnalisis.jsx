import { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import "./EstadoAnalisis.css";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const texto = (valor) => {
  return String(valor ?? "").trim();
};

const obtenerNombrePaciente = (paciente) => {
  if (!paciente) {
    return "Paciente no identificado";
  }

  if (paciente.nombreCompleto) {
    return paciente.nombreCompleto;
  }

  const nombre =
    paciente.nombres ||
    paciente.nombre ||
    "";

  const apellido =
    paciente.apellidos ||
    paciente.apellido ||
    "";

  return (
    `${nombre} ${apellido}`.trim() ||
    "Paciente no identificado"
  );
};

const obtenerCI = (paciente) => {
  return (
    paciente?.ci ||
    paciente?.carnet ||
    paciente?.carnetIdentidad ||
    "No registrado"
  );
};

const formatearFecha = (valor) => {
  if (!valor) {
    return "No registrada";
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
      return "No registrada";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "No registrada";
  }
};

const nombreEstado = (estado) => {
  switch (estado) {
    case "tomada":
      return "Tomada";

    case "aceptada":
      return "Aceptada";

    case "rechazada":
      return "Rechazada";

    case "en_proceso":
      return "En proceso";

    case "procesada":
      return "Procesada";

    default:
      return estado || "Sin estado";
  }
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function EstadoAnalisis({
  usuario,
  onVolver,
  volver,
}) {
  const laboratorioId = usuario?.laboratorioId || "";

  // ===================================================
  // ESTADOS
  // ===================================================

  const [muestras, setMuestras] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [muestraSeleccionada, setMuestraSeleccionada] =
    useState(null);

  const [procesandoId, setProcesandoId] = useState("");

  // ===================================================
  // CARGAR DATOS
  // ===================================================

  const cargarDatos = async () => {
    if (!laboratorioId) {
      setError(
        "No se encontró el laboratorio asignado."
      );

      setCargando(false);
      setActualizando(false);

      return;
    }

    try {
      setError("");

      const [
        respuestaMuestras,
        respuestaPacientes,
        respuestaAnalisis,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, "muestras"),
            where(
              "laboratorioId",
              "==",
              laboratorioId
            )
          )
        ),

        getDocs(
          query(
            collection(db, "pacientes"),
            where(
              "laboratorioId",
              "==",
              laboratorioId
            )
          )
        ),

        getDocs(
          query(
            collection(db, "analisis"),
            where(
              "laboratorioId",
              "==",
              laboratorioId
            )
          )
        ),
      ]);

      const listaMuestras =
        respuestaMuestras.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }));

      const listaPacientes =
        respuestaPacientes.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }));

      const listaAnalisis =
        respuestaAnalisis.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }));

      setMuestras(listaMuestras);
      setPacientes(listaPacientes);
      setAnalisis(listaAnalisis);
    } catch (err) {
      console.error(
        "Error cargando estado de análisis:",
        err
      );

      setError(
        err.message ||
        "No se pudieron cargar los datos."
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  };

  useEffect(() => {
    setCargando(true);
    cargarDatos();
  }, [laboratorioId]);

  // ===================================================
  // BUSCAR PACIENTE
  // ===================================================

  const buscarPaciente = (pacienteId) => {
    return pacientes.find(
      (paciente) =>
        texto(paciente.id) === texto(pacienteId)
    );
  };

  // ===================================================
  // BUSCAR ANÁLISIS
  // ===================================================

  const buscarAnalisis = (analisisId) => {
    return analisis.find(
      (item) =>
        texto(item.id) === texto(analisisId)
    );
  };

  // ===================================================
  // OBTENER NOMBRE DEL ANÁLISIS
  // ===================================================

  const obtenerNombreAnalisis = (muestra) => {
    if (muestra.analisisNombre) {
      return muestra.analisisNombre;
    }

    const encontrado = buscarAnalisis(
      muestra.analisisId
    );

    return (
      encontrado?.nombre ||
      encontrado?.nombreAnalisis ||
      "Análisis no identificado"
    );
  };

  // ===================================================
  // ESTADÍSTICAS
  // ===================================================

  const estadisticas = useMemo(() => {
    return {
      total: muestras.length,

      tomadas: muestras.filter(
        (muestra) => muestra.estado === "tomada"
      ).length,

      aceptadas: muestras.filter(
        (muestra) => muestra.estado === "aceptada"
      ).length,

      rechazadas: muestras.filter(
        (muestra) => muestra.estado === "rechazada"
      ).length,

      enProceso: muestras.filter(
        (muestra) => muestra.estado === "en_proceso"
      ).length,

      procesadas: muestras.filter(
        (muestra) => muestra.estado === "procesada"
      ).length,
    };
  }, [muestras]);

  // ===================================================
  // FILTRAR MUESTRAS
  // ===================================================

  const muestrasFiltradas = useMemo(() => {
    const buscar = busqueda
      .trim()
      .toLowerCase();

    return muestras.filter((muestra) => {
      const paciente = buscarPaciente(
        muestra.pacienteId
      );

      const contenido = [
        muestra.codigoEtiqueta,
        muestra.codigoMuestra,
        muestra.id,
        muestra.ordenId,
        obtenerNombrePaciente(paciente),
        obtenerCI(paciente),
        obtenerNombreAnalisis(muestra),
        muestra.tipo,
        muestra.tipoMuestra,
      ]
        .map(texto)
        .join(" ")
        .toLowerCase();

      const coincideBusqueda =
        contenido.includes(buscar);

      const coincideFiltro =
        filtro === "todas" ||
        muestra.estado === filtro;

      return coincideBusqueda && coincideFiltro;
    });
  }, [
    muestras,
    pacientes,
    analisis,
    busqueda,
    filtro,
  ]);

  // ===================================================
  // INICIAR PROCESAMIENTO
  // ===================================================

  const iniciarProceso = async (muestra) => {
    if (muestra.estado !== "aceptada") {
      setError(
        "Solo se pueden procesar muestras aceptadas."
      );

      return;
    }

    if (muestra.aceptada === false) {
      setError(
        "Esta muestra fue rechazada y no puede procesarse."
      );

      return;
    }

    const confirmar = window.confirm(
      `¿Deseas iniciar el procesamiento de la muestra ${muestra.codigoEtiqueta || muestra.id}?`
    );

    if (!confirmar) {
      return;
    }

    try {
      setProcesandoId(muestra.id);

      setError("");
      setMensaje("");

      await updateDoc(
        doc(db, "muestras", muestra.id),
        {
          estado: "en_proceso",
          fechaInicioProcesamiento:
            serverTimestamp(),
          fechaActualizacion:
            serverTimestamp(),
        }
      );

      setMensaje(
        "El procesamiento de la muestra se inició correctamente."
      );

      setMuestraSeleccionada(null);

      await cargarDatos();
    } catch (err) {
      console.error(
        "Error iniciando procesamiento:",
        err
      );

      setError(
        err.message ||
        "No se pudo iniciar el procesamiento."
      );
    } finally {
      setProcesandoId("");
    }
  };

  // ===================================================
  // ACTUALIZAR
  // ===================================================

  const actualizar = async () => {
    setActualizando(true);
    setMensaje("");

    await cargarDatos();
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <div className="ea-page">

      {/* ENCABEZADO */}

      <div className="ea-header">

        <div>
          <h1>Estado de análisis</h1>

          <p>
            Consulta y controla el procesamiento
            de las muestras del laboratorio.
          </p>
        </div>

        {(onVolver || volver) && (
          <button
            type="button"
            className="ea-btn-back"
            onClick={onVolver || volver}
          >
            Volver
          </button>
        )}

      </div>

      {/* ESTADÍSTICAS */}

      <div className="ea-stats">

        <div className="ea-stat">
          <span>Total</span>
          <strong>{estadisticas.total}</strong>
        </div>

        <div className="ea-stat">
          <span>Tomadas</span>
          <strong>{estadisticas.tomadas}</strong>
        </div>

        <div className="ea-stat">
          <span>Aceptadas</span>
          <strong>{estadisticas.aceptadas}</strong>
        </div>

        <div className="ea-stat">
          <span>Rechazadas</span>
          <strong>{estadisticas.rechazadas}</strong>
        </div>

        <div className="ea-stat">
          <span>En proceso</span>
          <strong>{estadisticas.enProceso}</strong>
        </div>

        <div className="ea-stat">
          <span>Procesadas</span>
          <strong>{estadisticas.procesadas}</strong>
        </div>

      </div>

      {/* MENSAJES */}

      {error && (
        <div className="ea-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="ea-success">
          {mensaje}
        </div>
      )}

      {/* BUSCADOR */}

      <div className="ea-card">

        <div className="ea-card-header">

          <h2>Buscar muestra</h2>

          <p>
            Busca por paciente, CI, análisis,
            código u orden.
          </p>

        </div>

        <div className="ea-search">

          <input
            type="text"
            placeholder="Buscar paciente, CI, muestra, orden o análisis..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

          <button
            type="button"
            className="ea-btn-primary"
            onClick={actualizar}
            disabled={actualizando}
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>

        </div>

        {/* FILTROS */}

        <div className="ea-filters">

          {[
            ["todas", "Todas"],
            ["tomada", "Tomadas"],
            ["aceptada", "Aceptadas"],
            ["rechazada", "Rechazadas"],
            ["en_proceso", "En proceso"],
            ["procesada", "Procesadas"],
          ].map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              className={
                filtro === valor
                  ? "ea-filter active"
                  : "ea-filter"
              }
              onClick={() => setFiltro(valor)}
            >
              {etiqueta}
            </button>
          ))}

        </div>

      </div>

      {/* TABLA */}

      <div className="ea-card">

        <div className="ea-card-header">

          <h2>Muestras del laboratorio</h2>

          <p>
            {muestrasFiltradas.length} muestras
            encontradas.
          </p>

        </div>

        {cargando ? (
          <div className="ea-empty">
            Cargando muestras...
          </div>
        ) : muestrasFiltradas.length === 0 ? (
          <div className="ea-empty">
            No se encontraron muestras.
          </div>
        ) : (
          <div className="ea-table-container">

            <table className="ea-table">

              <thead>
                <tr>
                  <th>Código</th>
                  <th>Paciente</th>
                  <th>Análisis</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>

                {muestrasFiltradas.map((muestra) => {
                  const paciente = buscarPaciente(
                    muestra.pacienteId
                  );

                  return (
                    <tr key={muestra.id}>

                      <td>
                        <strong>
                          {muestra.codigoEtiqueta ||
                            muestra.id}
                        </strong>
                      </td>

                      <td>
                        {obtenerNombrePaciente(
                          paciente
                        )}
                      </td>

                      <td>
                        {obtenerNombreAnalisis(
                          muestra
                        )}
                      </td>

                      <td>
                        {muestra.tipo ||
                          muestra.tipoMuestra ||
                          "No registrado"}
                      </td>

                      <td>
                        <span
                          className={`ea-badge ea-${muestra.estado}`}
                        >
                          {nombreEstado(
                            muestra.estado
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="ea-actions">

                          <button
                            type="button"
                            className="ea-btn-detail"
                            onClick={() =>
                              setMuestraSeleccionada(
                                muestra
                              )
                            }
                          >
                            Ver detalle
                          </button>

                          {muestra.estado ===
                            "aceptada" && (
                            <button
                              type="button"
                              className="ea-btn-primary"
                              disabled={
                                procesandoId ===
                                muestra.id
                              }
                              onClick={() =>
                                iniciarProceso(
                                  muestra
                                )
                              }
                            >
                              {procesandoId ===
                              muestra.id
                                ? "Procesando..."
                                : "Iniciar proceso"}
                            </button>
                          )}

                          {muestra.estado ===
                            "procesada" && (
                            <span className="ea-finished">
                              Finalizada
                            </span>
                          )}

                          {muestra.estado ===
                            "rechazada" && (
                            <span className="ea-disabled">
                              No habilitada
                            </span>
                          )}

                          {muestra.estado ===
                            "en_proceso" && (
                            <span className="ea-processing">
                              En procesamiento
                            </span>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* MODAL DETALLE */}

      {muestraSeleccionada && (
        <div
          className="ea-overlay"
          onClick={() =>
            setMuestraSeleccionada(null)
          }
        >

          <div
            className="ea-modal"
            onClick={(evento) =>
              evento.stopPropagation()
            }
          >

            <div className="ea-modal-header">

              <h2>
                Detalle de la muestra
              </h2>

              <button
                type="button"
                className="ea-modal-close"
                onClick={() =>
                  setMuestraSeleccionada(null)
                }
              >
                ×
              </button>

            </div>

            <div className="ea-modal-summary">

              <h3>
                {obtenerNombreAnalisis(
                  muestraSeleccionada
                )}
              </h3>

              <p>
                <strong>Paciente:</strong>{" "}
                {obtenerNombrePaciente(
                  buscarPaciente(
                    muestraSeleccionada.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>CI:</strong>{" "}
                {obtenerCI(
                  buscarPaciente(
                    muestraSeleccionada.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>Estado:</strong>{" "}
                {nombreEstado(
                  muestraSeleccionada.estado
                )}
              </p>

            </div>

            <div className="ea-modal-section">

              <h3>
                Información de la muestra
              </h3>

              <div className="ea-modal-grid">

                <p>
                  <strong>Código:</strong>{" "}
                  {muestraSeleccionada.codigoEtiqueta ||
                    muestraSeleccionada.id}
                </p>

                <p>
                  <strong>ID:</strong>{" "}
                  {muestraSeleccionada.id}
                </p>

                <p>
                  <strong>Tipo:</strong>{" "}
                  {muestraSeleccionada.tipo ||
                    muestraSeleccionada.tipoMuestra ||
                    "No registrado"}
                </p>

                <p>
                  <strong>Orden:</strong>{" "}
                  {muestraSeleccionada.ordenId ||
                    "No registrada"}
                </p>

                <p>
                  <strong>Solicitud:</strong>{" "}
                  {muestraSeleccionada.solicitudId ||
                    "No registrada"}
                </p>

                <p>
                  <strong>Aceptada:</strong>{" "}
                  {muestraSeleccionada.aceptada === true
                    ? "Sí"
                    : muestraSeleccionada.aceptada === false
                    ? "No"
                    : "Sin información"}
                </p>

              </div>

            </div>

            <div className="ea-modal-section">

              <h3>
                Seguimiento del procesamiento
              </h3>

              <div className="ea-modal-grid">

                <p>
                  <strong>Fecha de toma:</strong>{" "}
                  {formatearFecha(
                    muestraSeleccionada.fechaToma
                  )}
                </p>

                <p>
                  <strong>Fecha de validación:</strong>{" "}
                  {formatearFecha(
                    muestraSeleccionada.fechaValidacion
                  )}
                </p>

                <p>
                  <strong>Inicio del proceso:</strong>{" "}
                  {formatearFecha(
                    muestraSeleccionada.fechaInicioProcesamiento
                  )}
                </p>

                <p>
                  <strong>Fin del proceso:</strong>{" "}
                  {formatearFecha(
                    muestraSeleccionada.fechaFinProcesamiento
                  )}
                </p>

              </div>

            </div>

            <div className="ea-modal-footer">

              <button
                type="button"
                className="ea-btn-back"
                onClick={() =>
                  setMuestraSeleccionada(null)
                }
              >
                Cerrar
              </button>

              {muestraSeleccionada.estado ===
                "aceptada" && (
                <button
                  type="button"
                  className="ea-btn-primary"
                  disabled={
                    procesandoId ===
                    muestraSeleccionada.id
                  }
                  onClick={() =>
                    iniciarProceso(
                      muestraSeleccionada
                    )
                  }
                >
                  Iniciar proceso
                </button>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}