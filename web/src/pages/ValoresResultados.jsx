import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import { db } from "../firebase/firebase";

import {
  listarResultadosParaParametros,
  listarParametrosAnalisis,
  listarValoresResultado,
} from "../services/valoresResultadosService";

import "./ValoresResultados.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === "object"
  ) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
}

function mostrar(valor, defecto = "No registrado") {
  return texto(valor) || defecto;
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  const nombres = texto(
    paciente.nombres ||
      paciente.nombre ||
      paciente.primerNombre
  );

  const apellidos = texto(
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
    texto(paciente.nombreCompleto) ||
    "Paciente no identificado"
  );
}

function ciPaciente(paciente) {
  return mostrar(
    paciente?.ci ||
      paciente?.carnet ||
      paciente?.carnetIdentidad ||
      paciente?.numeroDocumento,
    "Sin CI"
  );
}

function fechaTexto(valor) {
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

// ======================================================
// OBTENER RANGO DE REFERENCIA
// ======================================================

function obtenerReferencia(parametro, registro = null) {
  if (!parametro && !registro) {
    return "No configurada";
  }

  const referencia =
    parametro?.rangoReferencia ??
    parametro?.referencia ??
    parametro?.rango ??
    registro?.rangoReferencia ??
    registro?.referencia ??
    null;

  const unidad = texto(
    parametro?.unidad || registro?.unidad
  );

  const agregarUnidad = (valor) => {
    const contenido = texto(valor);

    if (!contenido) {
      return "";
    }

    return unidad
      ? `${contenido} ${unidad}`
      : contenido;
  };

  const formatearLimites = (minimo, maximo) => {
    const tieneMinimo =
      minimo !== undefined &&
      minimo !== null &&
      minimo !== "";

    const tieneMaximo =
      maximo !== undefined &&
      maximo !== null &&
      maximo !== "";

    if (tieneMinimo && tieneMaximo) {
      return agregarUnidad(`${minimo} - ${maximo}`);
    }

    if (tieneMinimo) {
      return agregarUnidad(`≥ ${minimo}`);
    }

    if (tieneMaximo) {
      return agregarUnidad(`≤ ${maximo}`);
    }

    return "";
  };

  if (
    referencia !== null &&
    referencia !== undefined &&
    referencia !== ""
  ) {
    if (
      typeof referencia === "string" ||
      typeof referencia === "number"
    ) {
      return texto(referencia) || "No configurada";
    }

    if (
      typeof referencia === "object" &&
      !Array.isArray(referencia)
    ) {
      const tipo = normalizar(referencia.tipo);

      if (tipo === "texto") {
        return (
          texto(referencia.textoReferencia) ||
          texto(referencia.texto) ||
          texto(referencia.descripcion) ||
          texto(referencia.valor) ||
          "No configurada"
        );
      }

      const minimo =
        referencia.minimo ??
        referencia.min ??
        referencia.valorMinimo;

      const maximo =
        referencia.maximo ??
        referencia.max ??
        referencia.valorMaximo;

      const limites = formatearLimites(minimo, maximo);

      if (limites) {
        return limites;
      }

      const referenciaTexto =
        texto(referencia.textoReferencia) ||
        texto(referencia.texto) ||
        texto(referencia.descripcion) ||
        texto(referencia.valor);

      if (referenciaTexto) {
        return referenciaTexto;
      }
    }
  }

  const minimo =
    parametro?.valorMinimo ??
    parametro?.minimo ??
    parametro?.min;

  const maximo =
    parametro?.valorMaximo ??
    parametro?.maximo ??
    parametro?.max;

  return (
    formatearLimites(minimo, maximo) ||
    "No configurada"
  );
}

// ======================================================
// ESTADO DEL PARÁMETRO
// ======================================================

function obtenerEstadoParametro(parametro, registro) {
  if (!registro) {
    return "Pendiente";
  }

  const estadoGuardado =
    registro.estadoParametro ??
    registro.estado ??
    null;

  if (texto(estadoGuardado)) {
    return texto(estadoGuardado);
  }

  const valor =
    registro.valor ??
    registro.valorResultado ??
    registro.resultado;

  if (
    valor !== undefined &&
    valor !== null &&
    texto(valor) !== ""
  ) {
    return "Registrado";
  }

  return (
    texto(parametro?.estadoParametro) ||
    "Pendiente"
  );
}

// ======================================================
// VALOR REGISTRADO
// ======================================================

function obtenerValorRegistrado(registro) {
  if (!registro) {
    return "Sin registrar";
  }

  const valor =
    registro.valor ??
    registro.valorResultado ??
    registro.resultado;

  if (
    valor === undefined ||
    valor === null ||
    texto(valor) === ""
  ) {
    return "Sin registrar";
  }

  const unidad = texto(registro.unidad);

  return unidad
    ? `${valor} ${unidad}`
    : String(valor);
}

// ======================================================
// MENSAJES DE ERROR
// ======================================================

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la consulta. " +
      "Verifica los permisos de lectura del Bioquímico."
    );
  }

  if (error?.code === "unavailable") {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
  }

  return (
    error?.message ||
    "Ocurrió un error inesperado."
  );
}

// ======================================================
// IDENTIFICADORES DE PARÁMETROS
// ======================================================

function obtenerIdParametro(parametro, indice) {
  return texto(
    parametro?.parametroId ||
      parametro?.id ||
      `parametro-${indice}`
  );
}

function obtenerNombreParametro(parametro, indice) {
  return mostrar(
    parametro?.nombre ||
      parametro?.nombreParametro,
    `Parámetro ${indice + 1}`
  );
}

// ======================================================
// BUSCAR VALOR DE UN PARÁMETRO
// ======================================================

function buscarValorParametro(
  valores,
  parametro,
  indice
) {
  if (!Array.isArray(valores)) {
    return null;
  }

  const parametroId = obtenerIdParametro(
    parametro,
    indice
  );

  const encontradoPorId = valores.find((valor) => {
    const idValor = texto(
      valor.parametroId || valor.id
    );

    return idValor === parametroId;
  });

  if (encontradoPorId) {
    return encontradoPorId;
  }

  const nombre = normalizar(
    obtenerNombreParametro(parametro, indice)
  );

  return (
    valores.find(
      (valor) =>
        normalizar(
          valor.nombreParametro ||
            valor.nombre
        ) === nombre
    ) || null
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ValoresResultados({
  usuario,
  laboratorioId: laboratorioIdProp,
  onVolver,
  volver,
}) {
  // ====================================================
  // ESTADOS
  // ====================================================

  const [laboratorioId, setLaboratorioId] =
    useState(
      texto(
        usuario?.laboratorioId ||
          laboratorioIdProp
      )
    );

  const [
    verificandoLaboratorio,
    setVerificandoLaboratorio,
  ] = useState(true);

  const [muestras, setMuestras] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [resultados, setResultados] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");

  const [detalle, setDetalle] = useState(null);

  const [parametrosDetalle, setParametrosDetalle] =
    useState([]);

  const [valoresDetalle, setValoresDetalle] =
    useState([]);

  const [cargandoDetalle, setCargandoDetalle] =
    useState(false);

  const [errorDetalle, setErrorDetalle] =
    useState("");

  // ====================================================
  // IDENTIFICAR LABORATORIO
  // ====================================================

  useEffect(() => {
    let activo = true;

    const identificarLaboratorio = async () => {
      setVerificandoLaboratorio(true);

      try {
        const laboratorioDesdeUsuario = texto(
          usuario?.laboratorioId ||
            laboratorioIdProp
        );

        if (laboratorioDesdeUsuario) {
          if (activo) {
            setLaboratorioId(
              laboratorioDesdeUsuario
            );

            setError("");
          }

          return;
        }

        const auth = getAuth();

        let usuarioActual = auth.currentUser;

        if (!usuarioActual) {
          usuarioActual = await new Promise(
            (resolver) => {
              const cancelar = onAuthStateChanged(
                auth,
                (usuarioFirebase) => {
                  cancelar();
                  resolver(usuarioFirebase);
                }
              );
            }
          );
        }

        if (!usuarioActual) {
          throw new Error(
            "No existe una sesión activa. " +
              "Inicia sesión nuevamente."
          );
        }

        const referenciaUsuario = doc(
          db,
          "usuarios",
          usuarioActual.uid
        );

        const documentoUsuario = await getDoc(
          referenciaUsuario
        );

        if (!documentoUsuario.exists()) {
          throw new Error(
            "No se encontró el usuario en Firestore."
          );
        }

        const datosUsuario =
          documentoUsuario.data();

        const laboratorioEncontrado = texto(
          datosUsuario.laboratorioId
        );

        if (!laboratorioEncontrado) {
          throw new Error(
            "Tu usuario no tiene un laboratorio asignado. " +
              "Verifica el campo laboratorioId en Firestore."
          );
        }

        if (activo) {
          setLaboratorioId(
            laboratorioEncontrado
          );

          setError("");
        }
      } catch (errorLaboratorio) {
        console.error(
          "Error identificando laboratorio:",
          errorLaboratorio
        );

        if (activo) {
          setLaboratorioId("");

          setError(
            obtenerMensajeError(
              errorLaboratorio
            )
          );
        }
      } finally {
        if (activo) {
          setVerificandoLaboratorio(false);
        }
      }
    };

    identificarLaboratorio();

    return () => {
      activo = false;
    };
  }, [
    usuario?.laboratorioId,
    laboratorioIdProp,
  ]);

  // ====================================================
  // CARGAR DATOS
  // ====================================================

  const cargarDatos = useCallback(
    async (primeraCarga = false) => {
      if (!laboratorioId) {
        return;
      }

      try {
        if (primeraCarga) {
          setCargando(true);
        } else {
          setActualizando(true);
        }

        setError("");

        const consultaMuestras = query(
          collection(db, "muestras"),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

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
          respuestaMuestras,
          respuestaPacientes,
          respuestaAnalisis,
          respuestaResultados,
        ] = await Promise.all([
          getDocs(consultaMuestras),
          getDocs(consultaPacientes),
          getDocs(consultaAnalisis),
          listarResultadosParaParametros(
            laboratorioId
          ),
        ]);

        setMuestras(
          respuestaMuestras.docs.map(
            (documento) => ({
              ...documento.data(),
              id: documento.id,
            })
          )
        );

        setPacientes(
          respuestaPacientes.docs.map(
            (documento) => ({
              ...documento.data(),
              id: documento.id,
            })
          )
        );

        setAnalisis(
          respuestaAnalisis.docs.map(
            (documento) => ({
              ...documento.data(),
              id: documento.id,
            })
          )
        );

        setResultados(
          Array.isArray(respuestaResultados)
            ? respuestaResultados
            : []
        );
      } catch (errorConsulta) {
        console.error(
          "Error cargando información:",
          errorConsulta
        );

        setError(
          obtenerMensajeError(errorConsulta)
        );
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
    if (
      verificandoLaboratorio ||
      !laboratorioId
    ) {
      return;
    }

    cargarDatos(true);
  }, [
    laboratorioId,
    verificandoLaboratorio,
    cargarDatos,
  ]);

  // ====================================================
  // BUSCAR PACIENTE
  // ====================================================

  const buscarPaciente = useCallback(
    (pacienteId) => {
      return (
        pacientes.find(
          (paciente) =>
            paciente.id === pacienteId ||
            paciente.pacienteId === pacienteId
        ) || null
      );
    },
    [pacientes]
  );

  // ====================================================
  // BUSCAR ANÁLISIS
  // ====================================================

  const buscarAnalisis = useCallback(
    (analisisId) => {
      return (
        analisis.find(
          (item) =>
            item.id === analisisId ||
            item.analisisId === analisisId
        ) || null
      );
    },
    [analisis]
  );

  // ====================================================
  // BUSCAR RESULTADO
  // ====================================================

  const buscarResultado = useCallback(
    (muestraId) => {
      return (
        resultados.find(
          (resultado) =>
            resultado.muestraId === muestraId ||
            resultado.id === muestraId
        ) || null
      );
    },
    [resultados]
  );

  // ====================================================
  // NOMBRE DEL ANÁLISIS
  // ====================================================

  const nombreAnalisis = useCallback(
    (muestra) => {
      const encontrado = buscarAnalisis(
        muestra.analisisId
      );

      return mostrar(
        encontrado?.nombre ||
          encontrado?.nombreAnalisis ||
          muestra.analisisNombre ||
          muestra.nombreAnalisis,
        "Análisis clínico"
      );
    },
    [buscarAnalisis]
  );

  // ====================================================
  // MUESTRAS PROCESADAS
  // ====================================================

  const muestrasProcesadas = useMemo(() => {
    return muestras.filter(
      (muestra) =>
        normalizar(muestra.estado) ===
          "procesada" &&
        muestra.aceptada === true
    );
  }, [muestras]);

  // ====================================================
  // FILTRAR MUESTRAS
  // ====================================================

  const muestrasFiltradas = useMemo(() => {
    const filtro = normalizar(busqueda);

    if (!filtro) {
      return muestrasProcesadas;
    }

    return muestrasProcesadas.filter(
      (muestra) => {
        const paciente = buscarPaciente(
          muestra.pacienteId
        );

        const contenido = [
          nombrePaciente(paciente),
          ciPaciente(paciente),
          nombreAnalisis(muestra),
          muestra.codigoEtiqueta,
          muestra.codigoMuestra,
          muestra.id,
        ]
          .map(texto)
          .join(" ")
          .toLowerCase();

        return contenido.includes(filtro);
      }
    );
  }, [
    muestrasProcesadas,
    busqueda,
    buscarPaciente,
    nombreAnalisis,
  ]);

  // ====================================================
  // ABRIR DETALLE
  // ====================================================

  const abrirDetalle = async (muestra) => {
    const paciente = buscarPaciente(
      muestra.pacienteId
    );

    const analisisEncontrado = buscarAnalisis(
      muestra.analisisId
    );

    const resultado = buscarResultado(
      muestra.id
    );

    setDetalle({
      muestra,
      paciente,
      analisis: analisisEncontrado,
      resultado,
    });

    setParametrosDetalle([]);
    setValoresDetalle([]);
    setErrorDetalle("");
    setCargandoDetalle(true);

    try {
      let parametros = [];

      if (analisisEncontrado) {
        parametros =
          await listarParametrosAnalisis(
            analisisEncontrado.id,
            laboratorioId
          );
      }

      if (
        (!Array.isArray(parametros) ||
          parametros.length === 0) &&
        Array.isArray(
          analisisEncontrado?.parametros
        )
      ) {
        parametros =
          analisisEncontrado.parametros;
      }

      const listaParametros = Array.isArray(
        parametros
      )
        ? parametros
        : [];

      setParametrosDetalle(
        listaParametros.filter(
          (parametro) =>
            parametro &&
            parametro.activo !== false
        )
      );

      if (resultado?.id) {
        const valores =
          await listarValoresResultado(
            resultado.id
          );

        setValoresDetalle(
          Array.isArray(valores)
            ? valores
            : []
        );
      }
    } catch (errorConsulta) {
      console.error(
        "Error cargando parámetros:",
        errorConsulta
      );

      setErrorDetalle(
        obtenerMensajeError(errorConsulta)
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ====================================================
  // CERRAR DETALLE
  // ====================================================

  const cerrarDetalle = () => {
    setDetalle(null);
    setParametrosDetalle([]);
    setValoresDetalle([]);
    setErrorDetalle("");
  };

  // ====================================================
  // ACTUALIZAR
  // ====================================================

  const actualizar = async () => {
    await cargarDatos(false);
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div className="vr-page">
      {/* ENCABEZADO */}

      <header className="vr-header">
        <div>
          <h1>Valores por parámetros</h1>

          <p>
            Consulta los parámetros configurados
            y los resultados de las muestras
            procesadas.
          </p>
        </div>

        {(onVolver || volver) && (
          <button
            type="button"
            className="vr-btn-back"
            onClick={onVolver || volver}
          >
            Volver
          </button>
        )}
      </header>

      {/* VERIFICACIÓN DEL LABORATORIO */}

      {verificandoLaboratorio && (
        <div className="vr-empty">
          Identificando laboratorio...
        </div>
      )}

      {/* ESTADÍSTICAS */}

      <section className="vr-stats">
        <article>
          <span>Muestras procesadas</span>

          <strong>
            {muestrasProcesadas.length}
          </strong>
        </article>

        <article>
          <span>Análisis configurados</span>

          <strong>
            {analisis.length}
          </strong>
        </article>

        <article>
          <span>Resultados registrados</span>

          <strong>
            {resultados.length}
          </strong>
        </article>
      </section>

      {/* ERRORES */}

      {error && (
        <div
          className="vr-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* BUSCADOR */}

      <section className="vr-card">
        <div className="vr-card-header">
          <h2>
            Buscar muestra procesada
          </h2>

          <p>
            Busca por nombre del paciente,
            CI o análisis clínico.
          </p>
        </div>

        <div className="vr-search">
          <input
            type="text"
            placeholder="Buscar paciente, CI o análisis..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

          <button
            type="button"
            className="vr-btn-primary"
            onClick={actualizar}
            disabled={
              verificandoLaboratorio ||
              cargando ||
              actualizando ||
              !laboratorioId
            }
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>
      </section>

      {/* MUESTRAS DISPONIBLES */}

      <section className="vr-card">
        <div className="vr-card-header">
          <h2>Muestras disponibles</h2>

          <p>
            Selecciona una muestra procesada
            para consultar sus parámetros.
          </p>
        </div>

        {verificandoLaboratorio || cargando ? (
          <div className="vr-empty">
            Cargando muestras...
          </div>
        ) : !laboratorioId ? (
          <div className="vr-empty">
            No se pudo identificar el laboratorio
            del usuario.
          </div>
        ) : muestrasFiltradas.length === 0 ? (
          <div className="vr-empty">
            No se encontraron muestras procesadas.
          </div>
        ) : (
          <div className="vr-list">
            {muestrasFiltradas.map((muestra) => {
              const paciente = buscarPaciente(
                muestra.pacienteId
              );

              const resultado = buscarResultado(
                muestra.id
              );

              return (
                <article
                  key={muestra.id}
                  className="vr-item"
                >
                  <div className="vr-item-top">
                    <div>
                      <h3>
                        {nombreAnalisis(muestra)}
                      </h3>

                      <p>
                        <strong>Paciente:</strong>{" "}
                        {nombrePaciente(paciente)}
                      </p>

                      <p>
                        <strong>CI:</strong>{" "}
                        {ciPaciente(paciente)}
                      </p>

                      <p>
                        <strong>
                          Estado de muestra:
                        </strong>{" "}
                        {mostrar(muestra.estado)}
                      </p>

                      <p>
                        <strong>
                          Fecha de procesamiento:
                        </strong>{" "}
                        {fechaTexto(
                          muestra.fechaFinProcesamiento ||
                            muestra.fechaProcesamiento
                        )}
                      </p>
                    </div>

                    <span className="vr-badge">
                      Procesada
                    </span>
                  </div>

                  <div className="vr-result-status">
                    Estado del resultado:{" "}

                    <strong>
                      {resultado
                        ? mostrar(
                            resultado.estado,
                            "Registrado"
                          )
                        : "Sin resultado"}
                    </strong>
                  </div>

                  <div className="vr-item-actions">
                    <button
                      type="button"
                      className="vr-btn-primary"
                      onClick={() =>
                        abrirDetalle(muestra)
                      }
                    >
                      Ver parámetros
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* VENTANA DE DETALLE */}

      {detalle && (
        <div
          className="vr-overlay"
          onMouseDown={(evento) => {
            if (
              evento.target ===
              evento.currentTarget
            ) {
              cerrarDetalle();
            }
          }}
        >
          <div
            className="vr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vr-titulo-modal"
          >
            {/* ENCABEZADO */}

            <div className="vr-modal-header">
              <div>
                <h2 id="vr-titulo-modal">
                  Parámetros del análisis
                </h2>

                <p>
                  Consulta los parámetros
                  configurados del análisis.
                </p>
              </div>

              <button
                type="button"
                className="vr-close"
                onClick={cerrarDetalle}
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>

            {/* INFORMACIÓN DEL PACIENTE */}

            <div className="vr-summary">
              <h3>
                {nombreAnalisis(
                  detalle.muestra
                )}
              </h3>

              <p>
                <strong>Paciente:</strong>{" "}
                {nombrePaciente(
                  detalle.paciente
                )}
              </p>

              <p>
                <strong>CI:</strong>{" "}
                {ciPaciente(
                  detalle.paciente
                )}
              </p>

              <p>
                <strong>
                  Estado de la muestra:
                </strong>{" "}
                {mostrar(
                  detalle.muestra.estado
                )}
              </p>

              <p>
                <strong>
                  Estado del resultado:
                </strong>{" "}
                {detalle.resultado
                  ? mostrar(
                      detalle.resultado.estado
                    )
                  : "Sin resultado"}
              </p>
            </div>

            {/* ERROR DE DETALLE */}

            {errorDetalle && (
              <div
                className="vr-error"
                role="alert"
              >
                {errorDetalle}
              </div>
            )}

            {/* LISTA DE PARÁMETROS */}

            {cargandoDetalle ? (
              <div className="vr-empty">
                Cargando parámetros...
              </div>
            ) : parametrosDetalle.length === 0 ? (
              <div className="vr-empty">
                Este análisis no tiene
                parámetros configurados.
              </div>
            ) : (
              <div className="vr-parameters">
                {parametrosDetalle.map(
                  (parametro, indice) => {
                    const parametroId =
                      obtenerIdParametro(
                        parametro,
                        indice
                      );

                    const registro =
                      buscarValorParametro(
                        valoresDetalle,
                        parametro,
                        indice
                      );

                    const referencia =
                      obtenerReferencia(
                        parametro,
                        registro
                      );

                    const estadoParametro =
                      obtenerEstadoParametro(
                        parametro,
                        registro
                      );

                    const valorRegistrado =
                      obtenerValorRegistrado(
                        registro
                      );

                    return (
                      <div
                        key={parametroId}
                        className="vr-parameter"
                      >
                        <h3>
                          {indice + 1}.{" "}
                          {obtenerNombreParametro(
                            parametro,
                            indice
                          )}
                        </h3>

                        {parametro.descripcion && (
                          <p className="vr-description">
                            {parametro.descripcion}
                          </p>
                        )}

                        <div className="vr-detail-grid">
                          {/* RANGO DE REFERENCIA */}

                          <div>
                            <label>
                              Rango de referencia
                            </label>

                            <strong>
                              {referencia}
                            </strong>
                          </div>

                          {/* ESTADO DEL PARÁMETRO */}

                          <div>
                            <label>
                              Estado del parámetro
                            </label>

                            <strong>
                              {estadoParametro}
                            </strong>
                          </div>

                          {/* VALOR REGISTRADO */}

                          <div>
                            <label>
                              Valor registrado
                            </label>

                            <strong>
                              {valorRegistrado}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {/* CERRAR */}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "24px",
              }}
            >
              <button
                type="button"
                className="vr-btn-back"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}