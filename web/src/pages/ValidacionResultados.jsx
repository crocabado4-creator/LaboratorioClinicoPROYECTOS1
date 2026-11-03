import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  validarResultadoFinal,
} from "../services/validacionResultadosService";

import "./ValidacionResultados.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function limpiar(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor) {
  return limpiar(valor).toLowerCase();
}

function obtenerFecha(valor) {
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

function obtenerNombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  const nombres = limpiar(
    paciente.nombres ||
      paciente.nombre ||
      paciente.primerNombre
  );

  const apellidos = limpiar(
    paciente.apellidos ||
      paciente.apellido ||
      [
        paciente.apellidoPaterno,
        paciente.apellidoMaterno,
      ]
        .filter(Boolean)
        .join(" ")
  );

  return (
    [nombres, apellidos].filter(Boolean).join(" ") ||
    limpiar(paciente.nombreCompleto) ||
    "Paciente no identificado"
  );
}

function obtenerCI(paciente) {
  return (
    paciente?.ci ||
    paciente?.carnet ||
    paciente?.carnetIdentidad ||
    paciente?.numeroDocumento ||
    "Sin CI"
  );
}

function estaValidado(resultado) {
  return (
    normalizar(resultado?.estado) === "validado" ||
    resultado?.validado === true
  );
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Verifica los permisos del Bioquímico."
    );
  }

  if (error?.code === "unavailable") {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión."
    );
  }

  return (
    error?.message ||
    "Ocurrió un error inesperado."
  );
}

function obtenerRol(usuario) {
  const rol = usuario?.rol;

  if (typeof rol === "object" && rol !== null) {
    return normalizar(
      rol.nombre ||
        rol.nombreRol ||
        rol.id
    );
  }

  return normalizar(rol);
}

function resultadoTieneValor(resultado) {
  const valor =
    resultado?.valorResultado ??
    resultado?.valor;

  return (
    valor !== null &&
    valor !== undefined &&
    limpiar(valor) !== ""
  );
}

function resultadoEsBorrador(resultado) {
  return (
    normalizar(resultado?.estado) === "borrador" &&
    !estaValidado(resultado)
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ValidacionResultados({
  usuario,
  onVolver,
  volver,
}) {
  const laboratorioId = limpiar(
    usuario?.laboratorioId
  );

  const rol = obtenerRol(usuario);

  const puedeValidar =
    rol === "bioquimico" &&
    usuario?.activo === true;

  // ====================================================
  // ESTADOS
  // ====================================================

  const [resultados, setResultados] = useState([]);

  const [pacientes, setPacientes] = useState([]);

  const [analisis, setAnalisis] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [filtro, setFiltro] = useState("todos");

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [
    resultadoSeleccionado,
    setResultadoSeleccionado,
  ] = useState(null);

  const [errorDetalle, setErrorDetalle] = useState("");

  const [validando, setValidando] = useState(false);

  // ====================================================
  // CARGAR DATOS
  // ====================================================

  const cargarDatos = useCallback(
    async (mostrarActualizacion = false) => {
      if (!laboratorioId) {
        setError(
          "No se encontró el laboratorio asignado."
        );

        setCargando(false);
        setActualizando(false);

        return;
      }

      try {
        if (mostrarActualizacion) {
          setActualizando(true);
        } else {
          setCargando(true);
        }

        setError("");

        const [
          resultadosSnap,
          pacientesSnap,
          analisisSnap,
        ] = await Promise.all([
          getDocs(
            query(
              collection(db, "resultados"),
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

        setResultados(
          resultadosSnap.docs.map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }))
        );

        setPacientes(
          pacientesSnap.docs.map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }))
        );

        setAnalisis(
          analisisSnap.docs.map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }))
        );
      } catch (err) {
        console.error(
          "Error cargando resultados:",
          err
        );

        setError(obtenerMensajeError(err));
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [laboratorioId]
  );

  // ====================================================
  // CARGA AUTOMÁTICA
  // ====================================================

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ====================================================
  // PACIENTES POR ID
  // ====================================================

  const pacientesPorId = useMemo(() => {
    return new Map(
      pacientes.map((paciente) => [
        limpiar(paciente.id),
        paciente,
      ])
    );
  }, [pacientes]);

  // ====================================================
  // ANÁLISIS POR ID
  // ====================================================

  const analisisPorId = useMemo(() => {
    return new Map(
      analisis.map((item) => [
        limpiar(item.id),
        item,
      ])
    );
  }, [analisis]);

  // ====================================================
  // BUSCAR PACIENTE
  // ====================================================

  const buscarPaciente = useCallback(
    (pacienteId) => {
      return pacientesPorId.get(
        limpiar(pacienteId)
      );
    },
    [pacientesPorId]
  );

  // ====================================================
  // BUSCAR ANÁLISIS
  // ====================================================

  const buscarAnalisis = useCallback(
    (analisisId) => {
      return analisisPorId.get(
        limpiar(analisisId)
      );
    },
    [analisisPorId]
  );

  // ====================================================
  // NOMBRE DEL ANÁLISIS
  // ====================================================

  const obtenerNombreAnalisis = useCallback(
    (resultado) => {
      const encontrado = buscarAnalisis(
        resultado?.analisisId
      );

      return (
        resultado?.analisisNombre ||
        encontrado?.nombre ||
        encontrado?.nombreAnalisis ||
        "Análisis no identificado"
      );
    },
    [buscarAnalisis]
  );

  // ====================================================
  // ESTADÍSTICAS
  // ====================================================

  const estadisticas = useMemo(() => {
    const validados = resultados.filter(
      estaValidado
    ).length;

    return {
      total: resultados.length,
      pendientes: resultados.length - validados,
      validados,
    };
  }, [resultados]);

  // ====================================================
  // FILTRAR RESULTADOS
  // ====================================================

  const resultadosFiltrados = useMemo(() => {
    const termino = normalizar(busqueda);

    return resultados.filter((resultado) => {
      const paciente = buscarPaciente(
        resultado.pacienteId
      );

      const contenido = [
        obtenerNombrePaciente(paciente),
        obtenerCI(paciente),
        obtenerNombreAnalisis(resultado),
        resultado.valorResultado,
        resultado.muestraId,
        resultado.ordenId,
        resultado.id,
      ]
        .map(limpiar)
        .join(" ")
        .toLowerCase();

      const validado = estaValidado(resultado);

      const coincideFiltro =
        filtro === "todos" ||
        (filtro === "validados" && validado) ||
        (filtro === "pendientes" && !validado);

      return (
        contenido.includes(termino) &&
        coincideFiltro
      );
    });
  }, [
    resultados,
    busqueda,
    filtro,
    buscarPaciente,
    obtenerNombreAnalisis,
  ]);

  // ====================================================
  // NOMBRE DEL BIOQUÍMICO
  // ====================================================

  const obtenerNombreBioquimico = (resultado) => {
    return (
      resultado.validadoPorNombre ||
      resultado.nombreValidador ||
      resultado.validadoPor ||
      "Nombre no registrado"
    );
  };

  // ====================================================
  // ABRIR DETALLE
  // ====================================================

  const abrirDetalle = (resultado) => {
    setResultadoSeleccionado(resultado);

    setErrorDetalle("");
    setMensaje("");
  };

  // ====================================================
  // CERRAR DETALLE
  // ====================================================

  const cerrarDetalle = () => {
    if (validando) {
      return;
    }

    setResultadoSeleccionado(null);
    setErrorDetalle("");
  };

  // ====================================================
  // COMPROBAR SI PUEDE VALIDARSE
  // ====================================================

  const resultadoPuedeValidarse = useMemo(() => {
    if (!resultadoSeleccionado) {
      return false;
    }

    return (
      puedeValidar &&
      !validando &&
      resultadoEsBorrador(resultadoSeleccionado) &&
      resultadoTieneValor(resultadoSeleccionado)
    );
  }, [
    resultadoSeleccionado,
    puedeValidar,
    validando,
  ]);

  // ====================================================
  // VALIDAR RESULTADO
  // ====================================================

  const validarResultado = async () => {
    if (!resultadoSeleccionado || validando) {
      return;
    }

    if (!resultadoPuedeValidarse) {
      setErrorDetalle(
        "El resultado no cumple las condiciones para validarse. " +
          "Verifica que esté en borrador y tenga un valor registrado."
      );

      return;
    }

    const confirmar = window.confirm(
      "¿Confirmas que revisaste el resultado registrado?\n\n" +
        "Después de validar, el resultado no deberá modificarse."
    );

    if (!confirmar) {
      return;
    }

    try {
      setValidando(true);

      setErrorDetalle("");
      setError("");
      setMensaje("");

      await validarResultadoFinal({
        resultadoId: resultadoSeleccionado.id,
        laboratorioId,
      });

      setResultadoSeleccionado(null);

      await cargarDatos(true);

      setMensaje(
        "El resultado fue validado correctamente."
      );
    } catch (err) {
      console.error(
        "Error validando resultado:",
        err
      );

      setErrorDetalle(
        obtenerMensajeError(err)
      );
    } finally {
      setValidando(false);
    }
  };

  // ====================================================
  // INTERFAZ PRINCIPAL
  // ====================================================

  return (
    <div className="vdr-page">

      {/* ================================================
          ENCABEZADO
      ================================================ */}

      <div className="vdr-header">
        <div>
          <h1>
            Validación de resultados
          </h1>

          <p>
            Revisa, consulta y valida los resultados
            registrados.
          </p>
        </div>

        {(onVolver || volver) && (
          <button
            type="button"
            className="vdr-btn-secondary"
            onClick={onVolver || volver}
          >
            Volver
          </button>
        )}
      </div>

      {/* ================================================
          ESTADÍSTICAS
      ================================================ */}

      <div className="vdr-stats">

        <div className="vdr-stat">
          <span>
            Total de resultados
          </span>

          <strong>
            {estadisticas.total}
          </strong>
        </div>

        <div className="vdr-stat">
          <span>
            Pendientes
          </span>

          <strong>
            {estadisticas.pendientes}
          </strong>
        </div>

        <div className="vdr-stat">
          <span>
            Validados
          </span>

          <strong>
            {estadisticas.validados}
          </strong>
        </div>

      </div>

      {/* ================================================
          MENSAJES
      ================================================ */}

      {error && (
        <div
          className="vdr-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          className="vdr-success"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {!puedeValidar && (
        <div className="vdr-error">
          Solo el Bioquímico activo puede validar
          resultados.
        </div>
      )}

      {/* ================================================
          BUSCADOR
      ================================================ */}

      <div className="vdr-card">

        <div className="vdr-card-title">
          <h2>
            Buscar resultado
          </h2>

          <p>
            Busca por paciente, CI o análisis.
          </p>
        </div>

        <div className="vdr-search">

          <input
            type="text"
            placeholder="Paciente, CI o análisis..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

          <button
            type="button"
            className="vdr-btn-primary"
            onClick={() => cargarDatos(true)}
            disabled={
              actualizando ||
              cargando
            }
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>

        </div>

        {/* FILTROS */}

        <div className="vdr-filters">

          <button
            type="button"
            className={
              filtro === "todos"
                ? "vdr-filter active"
                : "vdr-filter"
            }
            onClick={() =>
              setFiltro("todos")
            }
          >
            Todos
          </button>

          <button
            type="button"
            className={
              filtro === "pendientes"
                ? "vdr-filter active"
                : "vdr-filter"
            }
            onClick={() =>
              setFiltro("pendientes")
            }
          >
            Pendientes
          </button>

          <button
            type="button"
            className={
              filtro === "validados"
                ? "vdr-filter active"
                : "vdr-filter"
            }
            onClick={() =>
              setFiltro("validados")
            }
          >
            Validados
          </button>

        </div>

      </div>

      {/* ================================================
          RESULTADOS REGISTRADOS
      ================================================ */}

      <div className="vdr-card">

        <div className="vdr-card-title">

          <h2>
            Resultados registrados
          </h2>

          <p>
            {resultadosFiltrados.length} resultados
            encontrados.
          </p>

        </div>

        {cargando ? (

          <div className="vdr-empty">
            Cargando resultados...
          </div>

        ) : resultadosFiltrados.length === 0 ? (

          <div className="vdr-empty">
            No se encontraron resultados.
          </div>

        ) : (

          <div className="vdr-results">

            {resultadosFiltrados.map((resultado) => {

              const paciente = buscarPaciente(
                resultado.pacienteId
              );

              const validado = estaValidado(resultado);

              return (
                <div
                  key={resultado.id}
                  className="vdr-result"
                >

                  <div className="vdr-result-top">

                    <div>

                      <h3>
                        {obtenerNombreAnalisis(resultado)}
                      </h3>

                      <p>
                        <strong>
                          Paciente:
                        </strong>{" "}
                        {obtenerNombrePaciente(paciente)}
                      </p>

                      <p>
                        <strong>
                          CI:
                        </strong>{" "}
                        {obtenerCI(paciente)}
                      </p>

                      <p>
                        <strong>
                          Valor:
                        </strong>{" "}
                        {limpiar(resultado.valorResultado) ||
                          "Sin valor"}
                      </p>

                      <p>
                        <strong>
                          Fecha:
                        </strong>{" "}
                        {obtenerFecha(
                          resultado.fechaRegistro
                        )}
                      </p>

                    </div>

                    <span
                      className={
                        validado
                          ? "vdr-badge validated"
                          : "vdr-badge pending"
                      }
                    >
                      {validado
                        ? "Validado"
                        : "Pendiente"}
                    </span>

                  </div>

                  <button
                    type="button"
                    className={
                      validado
                        ? "vdr-btn-view"
                        : "vdr-btn-primary"
                    }
                    onClick={() =>
                      abrirDetalle(resultado)
                    }
                  >
                    {validado
                      ? "Ver resultado"
                      : "Revisar y validar"}
                  </button>

                </div>
              );
            })}

          </div>

        )}

      </div>

      {/* ================================================
          VENTANA DE DETALLE
      ================================================ */}

      {resultadoSeleccionado && (

        <div
          className="vdr-overlay"
          onMouseDown={(evento) => {
            if (
              evento.target === evento.currentTarget
            ) {
              cerrarDetalle();
            }
          }}
        >

          <div
            className="vdr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vdr-titulo-modal"
          >

            {/* ENCABEZADO */}

            <div className="vdr-modal-header">

              <div>

                <h2 id="vdr-titulo-modal">
                  Detalle del resultado
                </h2>

                <p>
                  Información del análisis y validación.
                </p>

              </div>

              <button
                type="button"
                className="vdr-modal-close"
                onClick={cerrarDetalle}
                disabled={validando}
                aria-label="Cerrar detalle"
              >
                ×
              </button>

            </div>

            {/* INFORMACIÓN DEL PACIENTE */}

            <div className="vdr-summary">

              <h3>
                {obtenerNombreAnalisis(
                  resultadoSeleccionado
                )}
              </h3>

              <p>
                <strong>
                  Paciente:
                </strong>{" "}
                {obtenerNombrePaciente(
                  buscarPaciente(
                    resultadoSeleccionado.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>
                  CI:
                </strong>{" "}
                {obtenerCI(
                  buscarPaciente(
                    resultadoSeleccionado.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>
                  Estado:
                </strong>{" "}
                {estaValidado(resultadoSeleccionado)
                  ? "Validado"
                  : "Pendiente de validación"}
              </p>

            </div>

            {/* ==========================================
                RESULTADO REGISTRADO
            ========================================== */}

            <div className="vdr-modal-section">

              <h3>
                Resultado registrado
              </h3>

              <div className="vdr-detail-grid">

                <div>

                  <label>
                    Valor del resultado
                  </label>

                  <strong>
                    {limpiar(
                      resultadoSeleccionado.valorResultado
                    ) || "Sin valor registrado"}
                  </strong>

                </div>

                <div>

                  <label>
                    Unidad
                  </label>

                  <strong>
                    {limpiar(
                      resultadoSeleccionado.unidad
                    ) || "Sin unidad"}
                  </strong>

                </div>

                <div>

                  <label>
                    Fecha de registro
                  </label>

                  <strong>
                    {obtenerFecha(
                      resultadoSeleccionado.fechaRegistro
                    )}
                  </strong>

                </div>

                <div>

                  <label>
                    Observaciones
                  </label>

                  <strong>
                    {limpiar(
                      resultadoSeleccionado.observaciones ??
                      resultadoSeleccionado.observacion
                    ) || "Sin observaciones"}
                  </strong>

                </div>

              </div>

            </div>

            {/* ==========================================
                INFORMACIÓN DE VALIDACIÓN
            ========================================== */}

            {!estaValidado(resultadoSeleccionado) &&
              !resultadoTieneValor(resultadoSeleccionado) && (

                <div
                  className="vdr-error"
                  role="alert"
                >
                  Este resultado no tiene un valor registrado.

                  Debes completar el registro antes
                  de validarlo.
                </div>

              )}

            {!estaValidado(resultadoSeleccionado) &&
              resultadoTieneValor(resultadoSeleccionado) && (

                <div className="vdr-success">
                  El resultado tiene un valor registrado
                  y está disponible para revisión.

                  Verifica que los datos sean correctos
                  antes de validar.
                </div>

              )}

            {/* RESULTADO VALIDADO */}

            {estaValidado(resultadoSeleccionado) && (

              <div className="vdr-validated-box">

                <h3>
                  Resultado validado
                </h3>

                <p>
                  <strong>
                    Fecha:
                  </strong>{" "}
                  {obtenerFecha(
                    resultadoSeleccionado.fechaValidacion
                  )}
                </p>

                <p>
                  <strong>
                    Validado por:
                  </strong>{" "}
                  {obtenerNombreBioquimico(
                    resultadoSeleccionado
                  )}
                </p>

              </div>

            )}

            {/* ==========================================
                BOTONES
            ========================================== */}

            <div className="vdr-modal-footer">

              <button
                type="button"
                className="vdr-btn-secondary"
                onClick={cerrarDetalle}
                disabled={validando}
              >
                Cerrar
              </button>

              {!estaValidado(resultadoSeleccionado) &&
                puedeValidar && (

                  <button
                    type="button"
                    className="vdr-btn-primary"
                    onClick={validarResultado}
                    disabled={!resultadoPuedeValidarse}
                  >
                    {validando
                      ? "Validando..."
                      : "Validar resultado"}
                  </button>

                )}

            </div>

          </div>

        </div>

      )}

    </div>
  );
}