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

import { db } from "../firebase/firebase";

import {
  validarResultadoFinal,
} from "../services/validacionResultadosService";

import {
  listarParametrosAnalisis,
  listarValoresResultado,
} from "../services/valoresResultadosService";

import "./ValidacionResultados.css";

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
    return "Firestore rechazó la operación. Verifica los permisos del Bioquímico.";
  }

  if (error?.code === "unavailable") {
    return "No se pudo conectar con Firebase. Comprueba tu conexión.";
  }

  return error?.message || "Ocurrió un error inesperado.";
}

function obtenerIdParametro(parametro) {
  return limpiar(
    parametro?.parametroId ||
      parametro?.id
  );
}

function obtenerNombreParametro(parametro, indice = 0) {
  return (
    limpiar(
      parametro?.nombre ||
        parametro?.nombreParametro
    ) || `Parámetro ${indice + 1}`
  );
}

function obtenerValorRegistro(registro) {
  if (!registro) {
    return "";
  }

  return limpiar(
    registro.valor ??
      registro.valorResultado ??
      registro.resultado
  );
}

function obtenerValoresAntiguos(resultado) {
  const posibles = [
    resultado?.valoresParametros,
    resultado?.valores,
    resultado?.parametros,
    resultado?.resultadosParametros,
  ];

  for (const valores of posibles) {
    if (Array.isArray(valores)) {
      return valores;
    }

    if (valores && typeof valores === "object") {
      return Object.entries(valores).map(([id, dato]) => {
        if (dato && typeof dato === "object") {
          return {
            id,
            ...dato,
          };
        }

        return {
          id,
          valor: dato,
        };
      });
    }
  }

  return [];
}

function buscarValorParametro(
  parametro,
  valoresFirestore,
  resultado
) {
  const idParametro = obtenerIdParametro(parametro);

  const nombreParametro = normalizar(
    obtenerNombreParametro(parametro)
  );

  const valores = [
    ...valoresFirestore,
    ...obtenerValoresAntiguos(resultado),
  ];

  const coincidenciaPorId = valores.find((registro) => {
    const idRegistro = limpiar(
      registro.parametroId ||
        registro.id
    );

    return (
      idParametro &&
      idRegistro === idParametro
    );
  });

  if (coincidenciaPorId) {
    return coincidenciaPorId;
  }

  return (
    valores.find((registro) => {
      const nombreRegistro = normalizar(
        registro.nombreParametro ||
          registro.nombre
      );

      return (
        nombreParametro &&
        nombreRegistro === nombreParametro
      );
    }) || null
  );
}

function obtenerReferencia(parametro) {
  const referencia =
    parametro?.rangoReferencia ??
    parametro?.referencia ??
    parametro?.rango;

  if (
    referencia !== undefined &&
    referencia !== null &&
    typeof referencia !== "object" &&
    limpiar(referencia)
  ) {
    return String(referencia);
  }

  const minimo =
    parametro?.valorMinimo ??
    parametro?.minimo ??
    parametro?.min ??
    referencia?.min ??
    referencia?.minimo;

  const maximo =
    parametro?.valorMaximo ??
    parametro?.maximo ??
    parametro?.max ??
    referencia?.max ??
    referencia?.maximo;

  if (
    minimo !== undefined &&
    maximo !== undefined
  ) {
    return `${minimo} - ${maximo}`;
  }

  return (
    referencia?.descripcion ||
    referencia?.texto ||
    "No configurada"
  );
}

function esParametroObligatorio(parametro) {
  return (
    parametro.activo !== false &&
    parametro.obligatorio !== false
  );
}

function normalizarParametros(parametros) {
  if (!Array.isArray(parametros)) {
    return [];
  }

  return parametros
    .filter(
      (parametro) =>
        parametro &&
        parametro.activo !== false
    )
    .map((parametro, indice) => ({
      ...parametro,
      id:
        parametro.parametroId ||
        parametro.id ||
        `parametro-${indice}`,
      nombre: obtenerNombreParametro(parametro, indice),
    }));
}

export default function ValidacionResultados({
  usuario,
  onVolver,
  volver,
}) {
  const laboratorioId = limpiar(
    usuario?.laboratorioId
  );

  const rol = normalizar(usuario?.rol);

  const puedeValidar =
    rol === "bioquimico" &&
    usuario?.activo === true;

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

  const [
    parametrosDetalle,
    setParametrosDetalle,
  ] = useState([]);

  const [
    valoresDetalle,
    setValoresDetalle,
  ] = useState([]);

  const [
    cargandoDetalle,
    setCargandoDetalle,
  ] = useState(false);

  const [
    errorDetalle,
    setErrorDetalle,
  ] = useState("");

  const [validando, setValidando] = useState(false);

  const cargarDatos = useCallback(
    async (mostrarActualizacion = false) => {
      if (!laboratorioId) {
        setError("No se encontró el laboratorio asignado.");
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
              where("laboratorioId", "==", laboratorioId)
            )
          ),
          getDocs(
            query(
              collection(db, "pacientes"),
              where("laboratorioId", "==", laboratorioId)
            )
          ),
          getDocs(
            query(
              collection(db, "analisis"),
              where("laboratorioId", "==", laboratorioId)
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
        console.error("Error cargando resultados:", err);
        setError(obtenerMensajeError(err));
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [laboratorioId]
  );

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const pacientesPorId = useMemo(() => {
    return new Map(
      pacientes.map((paciente) => [
        limpiar(paciente.id),
        paciente,
      ])
    );
  }, [pacientes]);

  const analisisPorId = useMemo(() => {
    return new Map(
      analisis.map((item) => [
        limpiar(item.id),
        item,
      ])
    );
  }, [analisis]);

  const buscarPaciente = useCallback(
    (pacienteId) =>
      pacientesPorId.get(limpiar(pacienteId)),
    [pacientesPorId]
  );

  const buscarAnalisis = useCallback(
    (analisisId) =>
      analisisPorId.get(limpiar(analisisId)),
    [analisisPorId]
  );

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

      return contenido.includes(termino) && coincideFiltro;
    });
  }, [
    resultados,
    busqueda,
    filtro,
    buscarPaciente,
    obtenerNombreAnalisis,
  ]);

  const obtenerNombreBioquimico = (resultado) => {
    return (
      resultado.validadoPorNombre ||
      resultado.nombreValidador ||
      resultado.validadoPor ||
      "Nombre no registrado"
    );
  };

  const cargarDetalle = useCallback(
    async (resultado) => {
      setCargandoDetalle(true);
      setErrorDetalle("");
      setParametrosDetalle([]);
      setValoresDetalle([]);

      try {
        const analisisEncontrado = buscarAnalisis(
          resultado.analisisId
        );

        let parametros = [];

        if (resultado.analisisId) {
          parametros = await listarParametrosAnalisis(
            resultado.analisisId,
            laboratorioId
          );
        }

        if (
          (!Array.isArray(parametros) ||
            parametros.length === 0) &&
          Array.isArray(analisisEncontrado?.parametros)
        ) {
          parametros = analisisEncontrado.parametros;
        }

        setParametrosDetalle(
          normalizarParametros(parametros)
        );

        const valores = await listarValoresResultado(
          resultado.id
        );

        setValoresDetalle(
          Array.isArray(valores) ? valores : []
        );
      } catch (err) {
        console.error("Error cargando detalle:", err);
        setErrorDetalle(obtenerMensajeError(err));
      } finally {
        setCargandoDetalle(false);
      }
    },
    [buscarAnalisis, laboratorioId]
  );

  const abrirDetalle = async (resultado) => {
    setResultadoSeleccionado(resultado);
    setMensaje("");
    await cargarDetalle(resultado);
  };

  const cerrarDetalle = () => {
    if (validando) {
      return;
    }

    setResultadoSeleccionado(null);
    setParametrosDetalle([]);
    setValoresDetalle([]);
    setErrorDetalle("");
  };

  const parametrosConValores = useMemo(() => {
    if (!resultadoSeleccionado) {
      return [];
    }

    return parametrosDetalle.map((parametro) => {
      const registro = buscarValorParametro(
        parametro,
        valoresDetalle,
        resultadoSeleccionado
      );

      const valor = obtenerValorRegistro(registro);

      return {
        ...parametro,
        registro,
        valor,
        completo: valor !== "",
        obligatorio: esParametroObligatorio(parametro),
      };
    });
  }, [
    parametrosDetalle,
    valoresDetalle,
    resultadoSeleccionado,
  ]);

  const parametrosFaltantes = useMemo(() => {
    return parametrosConValores.filter(
      (parametro) =>
        parametro.obligatorio &&
        !parametro.completo
    );
  }, [parametrosConValores]);

  const resultadoPuedeValidarse = useMemo(() => {
    if (!resultadoSeleccionado) {
      return false;
    }

    return (
      puedeValidar &&
      !cargandoDetalle &&
      !validando &&
      !errorDetalle &&
      !estaValidado(resultadoSeleccionado) &&
      normalizar(resultadoSeleccionado.estado) ===
        "borrador" &&
      limpiar(resultadoSeleccionado.valorResultado) !== "" &&
      parametrosFaltantes.length === 0
    );
  }, [
    resultadoSeleccionado,
    puedeValidar,
    cargandoDetalle,
    validando,
    errorDetalle,
    parametrosFaltantes,
  ]);

  const validarResultado = async () => {
    if (!resultadoSeleccionado || validando) {
      return;
    }

    if (!resultadoPuedeValidarse) {
      setErrorDetalle(
        parametrosFaltantes.length > 0
          ? "No puedes validar el resultado porque faltan valores en: " +
              parametrosFaltantes
                .map((parametro) => parametro.nombre)
                .join(", ")
          : "El resultado todavía no cumple las condiciones para validarse."
      );
      return;
    }

    const confirmar = window.confirm(
      "¿Confirmas que revisaste el resultado principal y todos sus parámetros?\n\n" +
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

      cerrarDetalle();
      setResultadoSeleccionado(null);

      await cargarDatos(true);

      setMensaje(
        "El resultado fue validado correctamente."
      );
    } catch (err) {
      console.error("Error validando resultado:", err);
      setErrorDetalle(obtenerMensajeError(err));
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="vdr-page">
      <div className="vdr-header">
        <div>
          <h1>Validación de resultados</h1>
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

      <div className="vdr-stats">
        <div className="vdr-stat">
          <span>Total de resultados</span>
          <strong>{estadisticas.total}</strong>
        </div>

        <div className="vdr-stat">
          <span>Pendientes</span>
          <strong>{estadisticas.pendientes}</strong>
        </div>

        <div className="vdr-stat">
          <span>Validados</span>
          <strong>{estadisticas.validados}</strong>
        </div>
      </div>

      {error && (
        <div className="vdr-error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="vdr-success" role="status">
          {mensaje}
        </div>
      )}

      {!puedeValidar && (
        <div className="vdr-error">
          Solo el Bioquímico activo puede validar resultados.
        </div>
      )}

      <div className="vdr-card">
        <div className="vdr-card-title">
          <h2>Buscar resultado</h2>
          <p>Busca por paciente, CI o análisis.</p>
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
            disabled={actualizando || cargando}
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>

        <div className="vdr-filters">
          <button
            type="button"
            className={
              filtro === "todos"
                ? "vdr-filter active"
                : "vdr-filter"
            }
            onClick={() => setFiltro("todos")}
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
            onClick={() => setFiltro("pendientes")}
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
            onClick={() => setFiltro("validados")}
          >
            Validados
          </button>
        </div>
      </div>

      <div className="vdr-card">
        <div className="vdr-card-title">
          <h2>Resultados registrados</h2>
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
                        <strong>Paciente:</strong>{" "}
                        {obtenerNombrePaciente(paciente)}
                      </p>

                      <p>
                        <strong>CI:</strong>{" "}
                        {obtenerCI(paciente)}
                      </p>

                      <p>
                        <strong>Valor:</strong>{" "}
                        {limpiar(resultado.valorResultado) ||
                          "Sin valor"}
                      </p>

                      <p>
                        <strong>Fecha:</strong>{" "}
                        {obtenerFecha(resultado.fechaRegistro)}
                      </p>
                    </div>

                    <span
                      className={
                        validado
                          ? "vdr-badge validated"
                          : "vdr-badge pending"
                      }
                    >
                      {validado ? "Validado" : "Pendiente"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={
                      validado
                        ? "vdr-btn-view"
                        : "vdr-btn-primary"
                    }
                    onClick={() => abrirDetalle(resultado)}
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

      {resultadoSeleccionado && (
        <div
          className="vdr-overlay"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) {
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

            <div className="vdr-summary">
              <h3>
                {obtenerNombreAnalisis(
                  resultadoSeleccionado
                )}
              </h3>

              <p>
                <strong>Paciente:</strong>{" "}
                {obtenerNombrePaciente(
                  buscarPaciente(
                    resultadoSeleccionado.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>CI:</strong>{" "}
                {obtenerCI(
                  buscarPaciente(
                    resultadoSeleccionado.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>Estado:</strong>{" "}
                {estaValidado(resultadoSeleccionado)
                  ? "Validado"
                  : "Pendiente de validación"}
              </p>
            </div>

            <div className="vdr-modal-section">
              <h3>Resultado principal</h3>

              <div className="vdr-detail-grid">
                <div>
                  <label>Valor</label>
                  <strong>
                    {limpiar(
                      resultadoSeleccionado.valorResultado
                    ) || "Sin valor registrado"}
                  </strong>
                </div>

                <div>
                  <label>Unidad</label>
                  <strong>
                    {limpiar(resultadoSeleccionado.unidad) ||
                      "Sin unidad"}
                  </strong>
                </div>

                <div>
                  <label>Fecha de registro</label>
                  <strong>
                    {obtenerFecha(
                      resultadoSeleccionado.fechaRegistro
                    )}
                  </strong>
                </div>

                <div>
                  <label>Observaciones</label>
                  <strong>
                    {limpiar(
                      resultadoSeleccionado.observaciones
                    ) || "Sin observaciones"}
                  </strong>
                </div>
              </div>
            </div>

            {errorDetalle && (
              <div className="vdr-error" role="alert">
                {errorDetalle}
              </div>
            )}

            {!cargandoDetalle &&
              !estaValidado(resultadoSeleccionado) &&
              parametrosFaltantes.length > 0 &&
              !errorDetalle && (
                <div className="vdr-error" role="alert">
                  No puedes validar el resultado porque
                  faltan valores en{" "}
                  {parametrosFaltantes.length} parámetro(s):{" "}
                  {parametrosFaltantes
                    .map((parametro) => parametro.nombre)
                    .join(", ")}
                  . Regístralos en la sección
                  "Valores por parámetros".
                </div>
              )}

            {!cargandoDetalle &&
              !estaValidado(resultadoSeleccionado) &&
              parametrosFaltantes.length === 0 &&
              parametrosConValores.length > 0 &&
              !errorDetalle && (
                <div className="vdr-success">
                  Todos los parámetros obligatorios tienen
                  valores registrados.
                </div>
              )}

            <div className="vdr-modal-section">
              <h3>Valores por parámetros</h3>

              {cargandoDetalle ? (
                <div className="vdr-empty">
                  Consultando parámetros y valores...
                </div>
              ) : parametrosConValores.length === 0 ? (
                <p>
                  Este análisis no tiene parámetros
                  configurados.
                </p>
              ) : (
                <div className="vdr-parameters">
                  {parametrosConValores.map(
                    (parametro, indice) => (
                      <div
                        key={parametro.id}
                        className="vdr-parameter"
                      >
                        <h4>
                          {indice + 1}. {parametro.nombre}
                        </h4>

                        <div className="vdr-detail-grid">
                          <div>
                            <label>Valor</label>
                            <strong>
                              {parametro.valor ||
                                "Sin valor registrado"}
                            </strong>
                          </div>

                          <div>
                            <label>Unidad</label>
                            <strong>
                              {limpiar(
                                parametro.registro?.unidad ??
                                  parametro.unidad
                              ) || "Sin unidad"}
                            </strong>
                          </div>

                          <div>
                            <label>Referencia</label>
                            <strong>
                              {obtenerReferencia(parametro)}
                            </strong>
                          </div>

                          <div>
                            <label>Observación</label>
                            <strong>
                              {limpiar(
                                parametro.registro?.observacion ??
                                  parametro.registro?.observaciones
                              ) || "Sin observaciones"}
                            </strong>
                          </div>
                        </div>

                        {!parametro.completo && (
                          <p
                            style={{
                              marginTop: "10px",
                              color: "#dc2626",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {parametro.obligatorio
                              ? "Parámetro obligatorio pendiente."
                              : "Parámetro opcional sin valor."}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {estaValidado(resultadoSeleccionado) && (
              <div className="vdr-validated-box">
                <h3>Resultado validado</h3>

                <p>
                  <strong>Fecha:</strong>{" "}
                  {obtenerFecha(
                    resultadoSeleccionado.fechaValidacion
                  )}
                </p>

                <p>
                  <strong>Validado por:</strong>{" "}
                  {obtenerNombreBioquimico(
                    resultadoSeleccionado
                  )}
                </p>
              </div>
            )}

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
                      : parametrosFaltantes.length > 0
                      ? "Faltan parámetros"
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