import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { db } from "../firebase/firebase";

import {
  listarMuestrasProcesadas,
  listarResultados,
  registrarResultado,
  muestraPuedeRegistrarResultado,
} from "../services/resultadosService";

import "./GestionResultados.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function obtenerTexto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor).trim();
}

function normalizarTexto(valor) {
  return obtenerTexto(valor).toLowerCase();
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
    } else if (valor instanceof Date) {
      fecha = valor;
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

  const nombreCompleto = [
    nombre,
    apellido,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    nombreCompleto ||
    "Paciente no identificado"
  );
}

function obtenerEstadoResultado(resultado) {
  if (!resultado) {
    return "pendiente";
  }

  if (resultado.validado === true) {
    return "validado";
  }

  return (
    normalizarTexto(resultado.estado) ||
    "borrador"
  );
}

function obtenerNombreAnalisis(muestra, analisis) {
  if (!muestra) {
    return "Análisis";
  }

  if (muestra.analisisNombre) {
    return muestra.analisisNombre;
  }

  const encontrado = analisis.find(
    (item) =>
      obtenerTexto(item.id) ===
      obtenerTexto(muestra.analisisId)
  );

  return (
    encontrado?.nombre ||
    encontrado?.nombreAnalisis ||
    muestra.analisisId ||
    "Análisis"
  );
}

function obtenerCodigoMuestra(muestra) {
  return (
    muestra?.codigoEtiqueta ||
    muestra?.codigoMuestra ||
    muestra?.codigo ||
    muestra?.id ||
    "Sin código"
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

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Verifica los permisos del Bioquímico " +
      "sobre las colecciones de muestras y resultados."
    );
  }

  if (error?.code === "unavailable") {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
  }

  if (error?.code === "unauthenticated") {
    return (
      "No existe una sesión activa. " +
      "Inicia sesión nuevamente."
    );
  }

  return (
    error?.message ||
    "Ocurrió un error inesperado."
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function GestionResultados({
  usuario,
  onVolver,
}) {
  // ====================================================
  // DATOS DEL USUARIO
  // ====================================================

  const laboratorioId = obtenerTexto(
    usuario?.laboratorioId
  );

  const rolUsuario = normalizarTexto(
    usuario?.rol
  );

  const puedeRegistrar =
    rolUsuario === "bioquimico" &&
    usuario?.activo !== false;

  // ====================================================
  // ESTADOS
  // ====================================================

  const [muestras, setMuestras] = useState([]);

  const [resultados, setResultados] = useState([]);

  const [pacientes, setPacientes] = useState([]);

  const [analisis, setAnalisis] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [
    muestraSeleccionada,
    setMuestraSeleccionada,
  ] = useState(null);

  const [
    resultadoSeleccionado,
    setResultadoSeleccionado,
  ] = useState(null);

  const [
    valorResultado,
    setValorResultado,
  ] = useState("");

  const [unidad, setUnidad] = useState("");

  const [
    observaciones,
    setObservaciones,
  ] = useState("");

  // ====================================================
  // CARGAR INFORMACIÓN
  // ====================================================

  const cargarDatos = useCallback(
    async (mostrarCarga = true) => {
      if (!laboratorioId) {
        setError(
          "El usuario no tiene un laboratorio asignado."
        );

        setCargando(false);
        setActualizando(false);

        return false;
      }

      try {
        if (mostrarCarga) {
          setCargando(true);
        } else {
          setActualizando(true);
        }

        setError("");

        const consultaPacientes = query(
          collection(db, "pacientes"),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

        const consultaAnalisis = query(
          collection(db, "analisis"),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

        const [
          listaMuestras,
          listaResultados,
          pacientesSnap,
          analisisSnap,
        ] = await Promise.all([
          listarMuestrasProcesadas(
            laboratorioId
          ),

          listarResultados(
            laboratorioId
          ),

          getDocs(consultaPacientes),

          getDocs(consultaAnalisis),
        ]);

        setMuestras(
          Array.isArray(listaMuestras)
            ? listaMuestras
            : []
        );

        setResultados(
          Array.isArray(listaResultados)
            ? listaResultados
            : []
        );

        setPacientes(
          pacientesSnap.docs.map(
            (documento) => ({
              ...documento.data(),
              id: documento.id,
            })
          )
        );

        setAnalisis(
          analisisSnap.docs.map(
            (documento) => ({
              ...documento.data(),
              id: documento.id,
            })
          )
        );

        return true;
      } catch (err) {
        console.error(
          "Error cargando resultados:",
          err
        );

        setError(
          obtenerMensajeError(err)
        );

        return false;
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [laboratorioId]
  );

  // ====================================================
  // CARGAR AL ABRIR EL MÓDULO
  // ====================================================

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ====================================================
  // OBTENER PACIENTE
  // ====================================================

  const pacientesPorId = useMemo(() => {
    const mapa = new Map();

    pacientes.forEach((paciente) => {
      mapa.set(
        obtenerTexto(paciente.id),
        paciente
      );

      if (paciente.pacienteId) {
        mapa.set(
          obtenerTexto(paciente.pacienteId),
          paciente
        );
      }
    });

    return mapa;
  }, [pacientes]);

  const buscarPaciente = useCallback(
    (pacienteId) => {
      return pacientesPorId.get(
        obtenerTexto(pacienteId)
      );
    },
    [pacientesPorId]
  );

  // ====================================================
  // OBTENER RESULTADO DE UNA MUESTRA
  // ====================================================

  const resultadosPorMuestra = useMemo(() => {
    const mapa = new Map();

    resultados.forEach((resultado) => {
      const idMuestra = obtenerTexto(
        resultado.muestraId
      );

      if (idMuestra) {
        mapa.set(
          idMuestra,
          resultado
        );
      }
    });

    return mapa;
  }, [resultados]);

  const buscarResultado = useCallback(
    (muestraId) => {
      return resultadosPorMuestra.get(
        obtenerTexto(muestraId)
      );
    },
    [resultadosPorMuestra]
  );

  // ====================================================
  // MUESTRAS PROCESADAS
  // ====================================================

  const muestrasProcesadas = useMemo(() => {
    return muestras.filter(
      (muestra) =>
        muestraPuedeRegistrarResultado(
          muestra
        )
    );
  }, [muestras]);

  // ====================================================
  // FILTRO DE BÚSQUEDA
  // ====================================================

  const muestrasFiltradas = useMemo(() => {
    const textoBusqueda =
      normalizarTexto(busqueda);

    return muestrasProcesadas.filter(
      (muestra) => {
        const paciente = buscarPaciente(
          muestra.pacienteId
        );

        const nombre =
          obtenerNombrePaciente(
            paciente
          );

        const ci = obtenerCI(
          paciente
        );

        const nombreAnalisis =
          obtenerNombreAnalisis(
            muestra,
            analisis
          );

        const codigo =
          obtenerCodigoMuestra(
            muestra
          );

        const contenido = [
          nombre,
          ci,
          nombreAnalisis,
          codigo,
          muestra.ordenId,
          muestra.solicitudId,
          muestra.analisisId,
        ]
          .map(obtenerTexto)
          .join(" ")
          .toLowerCase();

        return contenido.includes(
          textoBusqueda
        );
      }
    );
  }, [
    muestrasProcesadas,
    busqueda,
    buscarPaciente,
    analisis,
  ]);

  // ====================================================
  // ESTADÍSTICAS
  // ====================================================

  const totalProcesadas =
    muestrasProcesadas.length;

  const totalRegistrados =
    muestrasProcesadas.filter(
      (muestra) =>
        Boolean(
          buscarResultado(
            muestra.id
          )
        )
    ).length;

  const totalPendientes = Math.max(
    0,
    totalProcesadas - totalRegistrados
  );

  // ====================================================
  // ABRIR FORMULARIO
  // ====================================================

  const abrirFormulario = (muestra) => {
    if (!puedeRegistrar) {
      setError(
        "Solo el Bioquímico puede registrar o editar resultados."
      );

      return;
    }

    if (
      !muestraPuedeRegistrarResultado(
        muestra
      )
    ) {
      setError(
        "La muestra debe estar aceptada y procesada."
      );

      return;
    }

    const resultado = buscarResultado(
      muestra.id
    );

    if (
      obtenerEstadoResultado(
        resultado
      ) === "validado"
    ) {
      setError(
        "Este resultado ya está validado y no puede editarse."
      );

      return;
    }

    setError("");
    setMensaje("");

    setMuestraSeleccionada(
      muestra
    );

    setResultadoSeleccionado(
      resultado || null
    );

    setValorResultado(
      obtenerTexto(
        resultado?.valorResultado
      )
    );

    setUnidad(
      obtenerTexto(
        resultado?.unidad
      )
    );

    setObservaciones(
      obtenerTexto(
        resultado?.observaciones
      )
    );
  };

  // ====================================================
  // CERRAR FORMULARIO
  // ====================================================

  const cerrarFormulario = () => {
    if (guardando) {
      return;
    }

    setMuestraSeleccionada(null);

    setResultadoSeleccionado(null);

    setValorResultado("");

    setUnidad("");

    setObservaciones("");
  };

  // ====================================================
  // EDITAR RESULTADO EN BORRADOR
  // ====================================================

  const actualizarResultadoBorrador = async ({
    resultadoId,
    muestraId,
    valor,
    unidadResultado,
    comentario,
    usuarioId,
  }) => {
    const idResultado = obtenerTexto(
      resultadoId
    );

    const idMuestra = obtenerTexto(
      muestraId
    );

    if (!idResultado) {
      throw new Error(
        "No se identificó el resultado."
      );
    }

    if (!idMuestra) {
      throw new Error(
        "No se identificó la muestra."
      );
    }

    if (!usuarioId) {
      throw new Error(
        "No se identificó al Bioquímico."
      );
    }

    const usuarioAuth = getAuth().currentUser;

    if (!usuarioAuth) {
      throw new Error(
        "Debes iniciar sesión nuevamente."
      );
    }

    if (usuarioAuth.uid !== usuarioId) {
      throw new Error(
        "El usuario autenticado no coincide con el responsable."
      );
    }

    const referenciaResultado = doc(
      db,
      "resultados",
      idResultado
    );

    const referenciaMuestra = doc(
      db,
      "muestras",
      idMuestra
    );

    const referenciaUsuario = doc(
      db,
      "usuarios",
      usuarioAuth.uid
    );

    await runTransaction(
      db,
      async (transaccion) => {
        const documentoUsuario =
          await transaccion.get(
            referenciaUsuario
          );

        const documentoMuestra =
          await transaccion.get(
            referenciaMuestra
          );

        const documentoResultado =
          await transaccion.get(
            referenciaResultado
          );

        if (!documentoUsuario.exists()) {
          throw new Error(
            "No se encontró el usuario en Firestore."
          );
        }

        const datosUsuario =
          documentoUsuario.data();

        if (
          datosUsuario.activo !== true ||
          normalizarTexto(
            datosUsuario.rol
          ) !== "bioquimico"
        ) {
          throw new Error(
            "No tienes autorización para editar resultados."
          );
        }

        if (
          obtenerTexto(
            datosUsuario.laboratorioId
          ) !== laboratorioId
        ) {
          throw new Error(
            "Tu usuario no pertenece a este laboratorio."
          );
        }

        if (!documentoMuestra.exists()) {
          throw new Error(
            "La muestra ya no existe."
          );
        }

        const muestra =
          documentoMuestra.data();

        if (
          obtenerTexto(
            muestra.laboratorioId
          ) !== laboratorioId
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (
          !muestraPuedeRegistrarResultado(
            muestra
          )
        ) {
          throw new Error(
            "La muestra ya no está habilitada para registrar resultados."
          );
        }

        if (!documentoResultado.exists()) {
          throw new Error(
            "El resultado ya no existe."
          );
        }

        const resultado =
          documentoResultado.data();

        if (
          obtenerTexto(
            resultado.laboratorioId
          ) !== laboratorioId
        ) {
          throw new Error(
            "El resultado pertenece a otro laboratorio."
          );
        }

        if (
          obtenerTexto(
            resultado.muestraId
          ) !== idMuestra
        ) {
          throw new Error(
            "El resultado no corresponde a la muestra seleccionada."
          );
        }

        if (
          resultado.validado === true ||
          normalizarTexto(
            resultado.estado
          ) === "validado"
        ) {
          throw new Error(
            "El resultado ya fue validado y no puede modificarse."
          );
        }

        if (
          normalizarTexto(
            resultado.estado
          ) !== "borrador"
        ) {
          throw new Error(
            "Solo se pueden editar resultados en borrador."
          );
        }

        transaccion.update(
          referenciaResultado,
          {
            valorResultado:
              valor,

            unidad:
              unidadResultado,

            observaciones:
              comentario,

            actualizadoPor:
              usuarioAuth.uid,

            fechaActualizacion:
              serverTimestamp(),
          }
        );
      }
    );

    return true;
  };

  // ====================================================
  // GUARDAR RESULTADO
  // ====================================================

  const guardarResultado = async (evento) => {
    evento.preventDefault();

    if (guardando) {
      return;
    }

    if (!muestraSeleccionada) {
      return;
    }

    if (!puedeRegistrar) {
      setError(
        "Solo el Bioquímico puede registrar resultados."
      );

      return;
    }

    const valor =
      obtenerTexto(
        valorResultado
      );

    const unidadResultado =
      obtenerTexto(
        unidad
      );

    const comentario =
      obtenerTexto(
        observaciones
      );

    if (!valor) {
      setError(
        "Debe ingresar el valor del resultado."
      );

      return;
    }

    const usuarioAuth = getAuth().currentUser;

    if (!usuarioAuth) {
      setError(
        "Debes iniciar sesión nuevamente."
      );

      return;
    }

    const bioquimicoId =
      usuarioAuth.uid;

    try {
      setGuardando(true);

      setError("");
      setMensaje("");

      if (resultadoSeleccionado) {
        await actualizarResultadoBorrador({
          resultadoId:
            resultadoSeleccionado.id,

          muestraId:
            muestraSeleccionada.id,

          valor,

          unidadResultado,

          comentario,

          usuarioId:
            bioquimicoId,
        });

        setMensaje(
          "Resultado actualizado correctamente."
        );
      } else {
        await registrarResultado({
          muestraId:
            muestraSeleccionada.id,

          laboratorioId,

          usuarioId:
            bioquimicoId,

          valorResultado:
            valor,

          unidad:
            unidadResultado,

          observaciones:
            comentario,
        });

        setMensaje(
          "Resultado registrado correctamente."
        );
      }

      setMuestraSeleccionada(null);

      setResultadoSeleccionado(null);

      setValorResultado("");

      setUnidad("");

      setObservaciones("");

      const actualizado =
        await cargarDatos(false);

      if (!actualizado) {
        setMensaje(
          "El resultado se guardó, pero no se pudo actualizar el listado. " +
          "Presiona Actualizar para consultar los cambios."
        );
      }
    } catch (err) {
      console.error(
        "Error guardando resultado:",
        err
      );

      setError(
        obtenerMensajeError(err)
      );
    } finally {
      setGuardando(false);
    }
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div className="gr-page">
      {/* ENCABEZADO */}

      <header className="gr-header">
        <div>
          <h1>
            Registro de resultados
          </h1>

          <p>
            Registra y administra los resultados
            de las muestras que finalizaron
            su procesamiento.
          </p>
        </div>

        {onVolver && (
          <button
            type="button"
            className="gr-btn-back"
            onClick={onVolver}
          >
            Volver
          </button>
        )}
      </header>

      {/* AVISO DE PERMISOS */}

      {!puedeRegistrar && (
        <div className="gr-alert gr-alert-error">
          Solo el Bioquímico puede registrar
          o editar resultados de análisis.
        </div>
      )}

      {/* MENSAJES */}

      {error && (
        <div
          className="gr-alert gr-alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          className="gr-alert gr-alert-success"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {/* ESTADÍSTICAS */}

      <section className="gr-stats">
        <article className="gr-stat">
          <span>
            Muestras procesadas
          </span>

          <strong>
            {totalProcesadas}
          </strong>
        </article>

        <article className="gr-stat">
          <span>
            Resultados registrados
          </span>

          <strong>
            {totalRegistrados}
          </strong>
        </article>

        <article className="gr-stat">
          <span>
            Resultados pendientes
          </span>

          <strong>
            {totalPendientes}
          </strong>
        </article>
      </section>

      {/* BUSCADOR */}

      <section className="gr-card">
        <div className="gr-section-header">
          <h2>
            Buscar muestra procesada
          </h2>

          <p>
            Busca por nombre del paciente,
            CI, análisis o código de muestra.
          </p>
        </div>

        <div className="gr-search-row">
          <input
            type="text"
            placeholder="Buscar paciente, CI, análisis o etiqueta..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(
                evento.target.value
              )
            }
          />

          <button
            type="button"
            className="gr-btn-primary"
            onClick={() =>
              cargarDatos(false)
            }
            disabled={
              cargando ||
              actualizando ||
              guardando
            }
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>
      </section>

      {/* MUESTRAS */}

      <section className="gr-card">
        <div className="gr-section-header">
          <h2>
            Muestras disponibles
          </h2>

          <p>
            Selecciona una muestra procesada
            para registrar o editar su resultado.
          </p>
        </div>

        {cargando ? (
          <p>
            Cargando muestras...
          </p>
        ) : muestrasFiltradas.length === 0 ? (
          <div className="gr-empty">
            No se encontraron muestras procesadas.
          </div>
        ) : (
          <div className="gr-list">
            {muestrasFiltradas.map(
              (muestra) => {
                const paciente =
                  buscarPaciente(
                    muestra.pacienteId
                  );

                const resultado =
                  buscarResultado(
                    muestra.id
                  );

                const estado =
                  obtenerEstadoResultado(
                    resultado
                  );

                const nombreAnalisis =
                  obtenerNombreAnalisis(
                    muestra,
                    analisis
                  );

                const codigo =
                  obtenerCodigoMuestra(
                    muestra
                  );

                return (
                  <article
                    key={muestra.id}
                    className="gr-result-card"
                  >
                    <div className="gr-result-top">
                      <div>
                        <h3>
                          {nombreAnalisis}
                        </h3>

                        <p>
                          <strong>
                            Paciente:
                          </strong>{" "}
                          {obtenerNombrePaciente(
                            paciente
                          )}
                        </p>

                        <p>
                          <strong>
                            CI:
                          </strong>{" "}
                          {obtenerCI(
                            paciente
                          )}
                        </p>

                        <p>
                          <strong>
                            Etiqueta:
                          </strong>{" "}
                          {codigo}
                        </p>

                        <p>
                          <strong>
                            Estado de muestra:
                          </strong>{" "}
                          Procesada
                        </p>

                        <p>
                          <strong>
                            Fecha de procesamiento:
                          </strong>{" "}
                          {obtenerFecha(
                            muestra.fechaFinProcesamiento
                          )}
                        </p>
                      </div>

                      <span
                        className={`gr-badge gr-badge-${estado}`}
                      >
                        {estado === "validado"
                          ? "Validado"
                          : estado === "borrador"
                          ? "Borrador"
                          : "Pendiente"}
                      </span>
                    </div>

                    {resultado && (
                      <div className="gr-result-value">
                        <span>
                          Resultado principal
                        </span>

                        <strong>
                          {resultado.valorResultado ||
                            "Sin valor"}{" "}
                          {resultado.unidad ||
                            ""}
                        </strong>
                      </div>
                    )}

                    <div className="gr-actions">
                      {!resultado &&
                        puedeRegistrar && (
                          <button
                            type="button"
                            className="gr-btn-primary"
                            disabled={
                              guardando ||
                              actualizando
                            }
                            onClick={() =>
                              abrirFormulario(
                                muestra
                              )
                            }
                          >
                            + Nuevo resultado
                          </button>
                        )}

                      {resultado &&
                        estado === "borrador" &&
                        puedeRegistrar && (
                          <button
                            type="button"
                            className="gr-btn-primary"
                            disabled={
                              guardando ||
                              actualizando
                            }
                            onClick={() =>
                              abrirFormulario(
                                muestra
                              )
                            }
                          >
                            Editar resultado
                          </button>
                        )}

                      {resultado &&
                        estado === "validado" && (
                          <div className="gr-validated">
                            Resultado validado
                          </div>
                        )}

                      {resultado &&
                        estado !== "borrador" &&
                        estado !== "validado" && (
                          <div className="gr-validated">
                            Resultado no editable
                          </div>
                        )}

                      {!puedeRegistrar &&
                        !resultado && (
                          <div className="gr-validated">
                            Solo consulta
                          </div>
                        )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* MODAL DE REGISTRO */}

      {muestraSeleccionada && (
        <div
          className="gr-modal-overlay"
          onMouseDown={(evento) => {
            if (
              evento.target ===
                evento.currentTarget &&
              !guardando
            ) {
              cerrarFormulario();
            }
          }}
        >
          <div
            className="gr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gr-titulo-modal"
          >
            <div className="gr-modal-header">
              <h2 id="gr-titulo-modal">
                {resultadoSeleccionado
                  ? "Editar resultado"
                  : "Nuevo resultado"}
              </h2>

              <button
                type="button"
                className="gr-close"
                disabled={guardando}
                onClick={
                  cerrarFormulario
                }
                aria-label="Cerrar formulario"
              >
                ×
              </button>
            </div>

            <div className="gr-modal-info">
              <p>
                <strong>
                  Análisis:
                </strong>{" "}
                {obtenerNombreAnalisis(
                  muestraSeleccionada,
                  analisis
                )}
              </p>

              <p>
                <strong>
                  Paciente:
                </strong>{" "}
                {obtenerNombrePaciente(
                  buscarPaciente(
                    muestraSeleccionada.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>
                  Muestra:
                </strong>{" "}
                {obtenerCodigoMuestra(
                  muestraSeleccionada
                )}
              </p>
            </div>

            <form onSubmit={guardarResultado}>
              <div className="gr-field">
                <label htmlFor="gr-valor-resultado">
                  Valor del resultado
                </label>

                <input
                  id="gr-valor-resultado"
                  type="text"
                  placeholder="Ingrese el resultado"
                  value={valorResultado}
                  onChange={(evento) =>
                    setValorResultado(
                      evento.target.value
                    )
                  }
                  disabled={guardando}
                  required
                />
              </div>

              <div className="gr-field">
                <label htmlFor="gr-unidad">
                  Unidad
                </label>

                <input
                  id="gr-unidad"
                  type="text"
                  placeholder="Ejemplo: g/dl"
                  value={unidad}
                  onChange={(evento) =>
                    setUnidad(
                      evento.target.value
                    )
                  }
                  disabled={guardando}
                />
              </div>

              <div className="gr-field">
                <label htmlFor="gr-observaciones">
                  Observaciones
                </label>

                <textarea
                  id="gr-observaciones"
                  placeholder="Observaciones del resultado"
                  value={observaciones}
                  onChange={(evento) =>
                    setObservaciones(
                      evento.target.value
                    )
                  }
                  disabled={guardando}
                  rows={4}
                />
              </div>

              <div className="gr-modal-actions">
                <button
                  type="button"
                  className="gr-btn-back"
                  disabled={guardando}
                  onClick={
                    cerrarFormulario
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="gr-btn-primary"
                  disabled={
                    guardando ||
                    !puedeRegistrar ||
                    !valorResultado.trim()
                  }
                >
                  {guardando
                    ? "Guardando..."
                    : resultadoSeleccionado
                    ? "Guardar cambios"
                    : "Registrar resultado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}