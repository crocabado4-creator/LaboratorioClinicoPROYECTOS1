import { useEffect, useMemo, useState } from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { validarResultadoFinal } from "../services/validacionResultadosService";
import { db } from "../firebase/firebase";

import "./ValidacionResultados.css";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const obtenerTexto = (valor, defecto = "") => {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return defecto;
  }

  if (typeof valor === "object") {
    return defecto;
  }

  return String(valor);
};

const obtenerFecha = (valor) => {
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
    "Sin CI"
  );
};

const obtenerReferencia = (parametro) => {
  const referencia =
    parametro.rangoReferencia ??
    parametro.referencia ??
    parametro.rango;

  if (
    referencia === undefined ||
    referencia === null ||
    referencia === ""
  ) {
    const minimo =
      parametro.valorMinimo ??
      parametro.minimo ??
      parametro.min;

    const maximo =
      parametro.valorMaximo ??
      parametro.maximo ??
      parametro.max;

    if (
      minimo !== undefined &&
      maximo !== undefined
    ) {
      return `${minimo} - ${maximo}`;
    }

    return "No configurada";
  }

  if (typeof referencia !== "object") {
    return String(referencia);
  }

  const minimo =
    referencia.min ??
    referencia.minimo ??
    referencia.valorMinimo;

  const maximo =
    referencia.max ??
    referencia.maximo ??
    referencia.valorMaximo;

  if (
    minimo !== undefined &&
    maximo !== undefined
  ) {
    return `${minimo} - ${maximo}`;
  }

  return (
    referencia.descripcion ||
    referencia.texto ||
    "No configurada"
  );
};

// =====================================================
// COMPONENTE
// =====================================================

export default function ValidacionResultados({
  usuario,
  onVolver,
  volver,
}) {
  const laboratorioId = usuario?.laboratorioId || "";

  // ===================================================
  // ESTADOS
  // ===================================================

  const [resultados, setResultados] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [resultadoSeleccionado, setResultadoSeleccionado] =
    useState(null);

  const [validando, setValidando] = useState(false);

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
        resultadosSnap.docs.map((item) => ({
          ...item.data(),
          id: item.id,
        }))
      );

      setPacientes(
        pacientesSnap.docs.map((item) => ({
          ...item.data(),
          id: item.id,
        }))
      );

      setAnalisis(
        analisisSnap.docs.map((item) => ({
          ...item.data(),
          id: item.id,
        }))
      );
    } catch (err) {
      console.error(
        "Error cargando resultados:",
        err
      );

      setError(
        err.message ||
        "No se pudieron cargar los resultados."
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
        paciente.id === pacienteId
    );
  };

  // ===================================================
  // BUSCAR ANÁLISIS
  // ===================================================

  const buscarAnalisis = (analisisId) => {
    return analisis.find(
      (item) =>
        item.id === analisisId
    );
  };

  // ===================================================
  // NOMBRE DEL ANÁLISIS
  // ===================================================

  const obtenerNombreAnalisis = (resultado) => {
    if (resultado.analisisNombre) {
      return resultado.analisisNombre;
    }

    const encontrado = buscarAnalisis(
      resultado.analisisId
    );

    return (
      encontrado?.nombre ||
      encontrado?.nombreAnalisis ||
      "Análisis no identificado"
    );
  };

  // ===================================================
  // ESTADO
  // ===================================================

  const estaValidado = (resultado) => {
    return (
      obtenerTexto(resultado.estado)
        .toLowerCase() === "validado"
    );
  };

  // ===================================================
  // ESTADÍSTICAS
  // ===================================================

  const estadisticas = useMemo(() => {
    const validados = resultados.filter(
      (resultado) => estaValidado(resultado)
    ).length;

    return {
      total: resultados.length,
      pendientes: resultados.length - validados,
      validados,
    };
  }, [resultados]);

  // ===================================================
  // FILTRAR RESULTADOS
  // ===================================================

  const resultadosFiltrados = useMemo(() => {
    const buscar = busqueda
      .trim()
      .toLowerCase();

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
      ]
        .map((valor) => obtenerTexto(valor))
        .join(" ")
        .toLowerCase();

      const coincideBusqueda =
        contenido.includes(buscar);

      const validado = estaValidado(resultado);

      const coincideFiltro =
        filtro === "todos" ||
        (filtro === "validados" && validado) ||
        (filtro === "pendientes" && !validado);

      return coincideBusqueda && coincideFiltro;
    });
  }, [
    resultados,
    pacientes,
    analisis,
    busqueda,
    filtro,
  ]);

  // ===================================================
  // OBTENER PARÁMETROS
  // ===================================================

  const obtenerParametros = (resultado) => {
    const analisisEncontrado = buscarAnalisis(
      resultado.analisisId
    );

    const parametros =
      analisisEncontrado?.parametros;

    if (!Array.isArray(parametros)) {
      return [];
    }

    return parametros.map((parametro, indice) => {
      return {
        ...parametro,

        id:
          parametro.parametroId ||
          parametro.id ||
          `parametro-${indice}`,

        nombre:
          parametro.nombre ||
          parametro.nombreParametro ||
          `Parámetro ${indice + 1}`,
      };
    });
  };

  // ===================================================
  // OBTENER VALORES GUARDADOS
  // ===================================================

  const obtenerValores = (resultado) => {
    const posiblesValores = [
      resultado.valoresParametros,
      resultado.valores,
      resultado.parametros,
      resultado.resultadosParametros,
    ];

    for (const valores of posiblesValores) {
      if (Array.isArray(valores)) {
        return valores;
      }

      if (
        valores &&
        typeof valores === "object"
      ) {
        return Object.entries(valores).map(
          ([id, dato]) => {
            if (
              dato &&
              typeof dato === "object"
            ) {
              return {
                id,
                ...dato,
              };
            }

            return {
              id,
              valor: dato,
            };
          }
        );
      }
    }

    return [];
  };

  // ===================================================
  // BUSCAR VALOR DE PARÁMETRO
  // ===================================================

  const buscarValorParametro = (
    resultado,
    parametro
  ) => {
    const valores = obtenerValores(resultado);

    const idParametro = obtenerTexto(
      parametro.id
    );

    const nombreParametro = obtenerTexto(
      parametro.nombre
    ).toLowerCase();

    return (
      valores.find((valor) => {
        const id =
          valor.parametroId ||
          valor.id ||
          "";

        const nombre =
          valor.nombreParametro ||
          valor.nombre ||
          "";

        return (
          obtenerTexto(id) === idParametro ||
          obtenerTexto(nombre).toLowerCase() ===
            nombreParametro
        );
      }) || null
    );
  };

  // ===================================================
  // NOMBRE DEL BIOQUÍMICO
  // ===================================================

  const obtenerNombreBioquimico = (resultado) => {
    return (
      resultado.validadoPorNombre ||
      resultado.nombreValidador ||
      resultado.bioquimicoNombre ||
      resultado.nombreBioquimico ||
      "Nombre no registrado"
    );
  };

  // ===================================================
  // ABRIR DETALLE
  // ===================================================

  const abrirDetalle = (resultado) => {
    setError("");
    setResultadoSeleccionado(resultado);
  };

  // ===================================================
  // VALIDAR RESULTADO
  // ===================================================

  const validarResultado = async () => {
    if (!resultadoSeleccionado) {
      return;
    }

    if (estaValidado(resultadoSeleccionado)) {
      return;
    }

    const confirmar = window.confirm(
      "¿Confirmas que revisaste el resultado y deseas validarlo?"
    );

    if (!confirmar) {
      return;
    }

    try {
      setValidando(true);
      setError("");
      setMensaje("");

      await validarResultadoFinal({
        resultadoId: resultadoSeleccionado.id,
        laboratorioId,
      });

      setMensaje(
        "El resultado fue validado correctamente."
      );

      setResultadoSeleccionado(null);

      await cargarDatos();
    } catch (err) {
      console.error(
        "Error validando resultado:",
        err
      );

      setError(
        err.message ||
        "No se pudo validar el resultado."
      );
    } finally {
      setValidando(false);
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
    <div className="vdr-page">

      {/* ENCABEZADO */}

      <div className="vdr-header">

        <div>
          <h1>
            Validación de resultados
          </h1>

          <p>
            Revisa, consulta y valida los
            resultados registrados.
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

      {/* ESTADÍSTICAS */}

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

      {/* MENSAJES */}

      {error && (
        <div className="vdr-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="vdr-success">
          {mensaje}
        </div>
      )}

      {/* BUSCADOR */}

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
            onClick={actualizar}
            disabled={actualizando}
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

      {/* RESULTADOS */}

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

            {resultadosFiltrados.map(
              (resultado) => {
                const paciente = buscarPaciente(
                  resultado.pacienteId
                );

                const validado =
                  estaValidado(resultado);

                return (
                  <div
                    key={resultado.id}
                    className="vdr-result"
                  >

                    <div className="vdr-result-top">

                      <div>

                        <h3>
                          {obtenerNombreAnalisis(
                            resultado
                          )}
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
                          {obtenerCI(paciente)}
                        </p>

                        <p>
                          <strong>
                            Valor:
                          </strong>{" "}
                          {obtenerTexto(
                            resultado.valorResultado,
                            "Sin valor"
                          )}
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
              }
            )}

          </div>
        )}

      </div>

      {/* MODAL */}

      {resultadoSeleccionado && (
        <div
          className="vdr-overlay"
          onClick={() =>
            setResultadoSeleccionado(null)
          }
        >

          <div
            className="vdr-modal"
            onClick={(evento) =>
              evento.stopPropagation()
            }
          >

            {/* ENCABEZADO */}

            <div className="vdr-modal-header">

              <div>
                <h2>
                  Detalle del resultado
                </h2>

                <p>
                  Información del análisis
                  y validación.
                </p>
              </div>

              <button
                type="button"
                className="vdr-modal-close"
                onClick={() =>
                  setResultadoSeleccionado(null)
                }
              >
                ×
              </button>

            </div>

            {/* INFORMACIÓN GENERAL */}

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
                {estaValidado(
                  resultadoSeleccionado
                )
                  ? "Validado"
                  : "Pendiente de validación"}
              </p>

            </div>

            {/* RESULTADO PRINCIPAL */}

            <div className="vdr-modal-section">

              <h3>
                Resultado principal
              </h3>

              <div className="vdr-detail-grid">

                <div>
                  <label>
                    Valor
                  </label>

                  <strong>
                    {obtenerTexto(
                      resultadoSeleccionado.valorResultado,
                      "Sin valor registrado"
                    )}
                  </strong>
                </div>

                <div>
                  <label>
                    Unidad
                  </label>

                  <strong>
                    {obtenerTexto(
                      resultadoSeleccionado.unidad,
                      "Sin unidad"
                    )}
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
                    {obtenerTexto(
                      resultadoSeleccionado.observaciones,
                      "Sin observaciones"
                    )}
                  </strong>
                </div>

              </div>

            </div>

            {/* VALORES POR PARÁMETROS */}

            <div className="vdr-modal-section">

              <h3>
                Valores por parámetros
              </h3>

              {obtenerParametros(
                resultadoSeleccionado
              ).length === 0 ? (
                <p>
                  No hay parámetros configurados
                  para este análisis.
                </p>
              ) : (
                <div className="vdr-parameters">

                  {obtenerParametros(
                    resultadoSeleccionado
                  ).map((parametro, indice) => {
                    const registro =
                      buscarValorParametro(
                        resultadoSeleccionado,
                        parametro
                      );

                    const valor =
                      registro?.valor ??
                      registro?.valorResultado ??
                      registro?.resultado;

                    return (
                      <div
                        key={parametro.id}
                        className="vdr-parameter"
                      >

                        <h4>
                          {indice + 1}.{" "}
                          {parametro.nombre}
                        </h4>

                        <div className="vdr-detail-grid">

                          <div>
                            <label>
                              Valor
                            </label>

                            <strong>
                              {obtenerTexto(
                                valor,
                                "Sin valor registrado"
                              )}
                            </strong>
                          </div>

                          <div>
                            <label>
                              Unidad
                            </label>

                            <strong>
                              {obtenerTexto(
                                registro?.unidad ??
                                  parametro.unidad,
                                "Sin unidad"
                              )}
                            </strong>
                          </div>

                          <div>
                            <label>
                              Referencia
                            </label>

                            <strong>
                              {obtenerReferencia(
                                parametro
                              )}
                            </strong>
                          </div>

                          <div>
                            <label>
                              Observación
                            </label>

                            <strong>
                              {obtenerTexto(
                                registro?.observacion ??
                                  registro?.observaciones,
                                "Sin observaciones"
                              )}
                            </strong>
                          </div>

                        </div>

                      </div>
                    );
                  })}

                </div>
              )}

            </div>

            {/* RESULTADO VALIDADO */}

            {estaValidado(
              resultadoSeleccionado
            ) && (
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

            {/* BOTONES */}

            <div className="vdr-modal-footer">

              <button
                type="button"
                className="vdr-btn-secondary"
                onClick={() =>
                  setResultadoSeleccionado(null)
                }
              >
                Cerrar
              </button>

              {!estaValidado(
                resultadoSeleccionado
              ) && (
                <button
                  type="button"
                  className="vdr-btn-primary"
                  onClick={validarResultado}
                  disabled={validando}
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