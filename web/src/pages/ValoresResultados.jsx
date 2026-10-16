import { useEffect, useMemo, useState } from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import "./ValoresResultados.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor).trim();
}

function mostrar(valor, defecto = "No registrado") {
  const contenido = texto(valor);

  return contenido !== "" ? contenido : defecto;
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

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  if (paciente.nombreCompleto) {
    return paciente.nombreCompleto;
  }

  const nombre = paciente.nombres || paciente.nombre || "";
  const apellido = paciente.apellidos || paciente.apellido || "";

  return (
    `${nombre} ${apellido}`.trim() ||
    "Paciente no identificado"
  );
}

function ciPaciente(paciente) {
  return (
    paciente?.ci ||
    paciente?.carnet ||
    paciente?.carnetIdentidad ||
    "Sin CI"
  );
}

function referenciaTexto(referencia) {
  if (
    referencia === null ||
    referencia === undefined ||
    referencia === ""
  ) {
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
    maximo !== undefined &&
    minimo !== "" &&
    maximo !== ""
  ) {
    return `${minimo} - ${maximo}`;
  }

  return (
    referencia.texto ||
    referencia.descripcion ||
    referencia.valor ||
    "No configurada"
  );
}

function obtenerParametros(analisis) {
  if (!analisis || !Array.isArray(analisis.parametros)) {
    return [];
  }

  return analisis.parametros
    .filter((parametro) => parametro.activo !== false)
    .map((parametro, indice) => ({
      ...parametro,

      id:
        parametro.parametroId ||
        parametro.id ||
        `parametro-${indice}`,

      nombre:
        parametro.nombre ||
        parametro.nombreParametro ||
        `Parámetro ${indice + 1}`,

      unidad: parametro.unidad || "",

      descripcion: parametro.descripcion || "",

      referencia:
        parametro.rangoReferencia ??
        parametro.referencia ??
        null,
    }));
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ValoresResultados({
  usuario,
  onVolver,
  volver,
}) {
  const laboratorioId = usuario?.laboratorioId || "";

  // ====================================================
  // ESTADOS
  // ====================================================

  const [muestras, setMuestras] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [resultados, setResultados] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [detalle, setDetalle] = useState(null);

  const [valoresRegistrados, setValoresRegistrados] =
    useState([]);

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] = useState(false);

  const [cargandoValores, setCargandoValores] =
    useState(false);

  const [error, setError] = useState("");

  const [errorValores, setErrorValores] = useState("");

  // ====================================================
  // CARGAR INFORMACIÓN
  // ====================================================

  async function cargarDatos() {
    if (!laboratorioId) {
      setError(
        "No se encontró el laboratorio del usuario."
      );

      setCargando(false);
      setActualizando(false);

      return;
    }

    try {
      setError("");

      const [
        muestrasSnap,
        pacientesSnap,
        analisisSnap,
        resultadosSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, "muestras"),
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

        getDocs(
          query(
            collection(db, "resultados"),
            where("laboratorioId", "==", laboratorioId)
          )
        ),
      ]);

      setMuestras(
        muestrasSnap.docs.map((documento) => ({
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

      setResultados(
        resultadosSnap.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }))
      );
    } catch (errorConsulta) {
      console.error(
        "Error cargando valores por parámetros:",
        errorConsulta
      );

      setError(
        errorConsulta.message ||
        "No se pudieron cargar los datos."
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }

  useEffect(() => {
    setCargando(true);

    cargarDatos();
  }, [laboratorioId]);

  // ====================================================
  // BUSCAR PACIENTE
  // ====================================================

  function buscarPaciente(pacienteId) {
    return pacientes.find(
      (paciente) =>
        texto(paciente.id) === texto(pacienteId)
    );
  }

  // ====================================================
  // BUSCAR ANÁLISIS
  // ====================================================

  function buscarAnalisis(analisisId) {
    return analisis.find(
      (item) =>
        texto(item.id) === texto(analisisId)
    );
  }

  // ====================================================
  // BUSCAR RESULTADO
  // ====================================================

  function buscarResultado(muestraId) {
    return resultados.find(
      (resultado) =>
        texto(resultado.muestraId) === texto(muestraId) ||
        texto(resultado.id) === texto(muestraId)
    );
  }

  // ====================================================
  // NOMBRE DEL ANÁLISIS
  // ====================================================

  function nombreAnalisis(muestra) {
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
  }

  // ====================================================
  // MUESTRAS PROCESADAS
  // ====================================================

  const muestrasProcesadas = useMemo(() => {
    return muestras.filter(
      (muestra) =>
        texto(muestra.estado).toLowerCase() ===
        "procesada"
    );
  }, [muestras]);

  // ====================================================
  // FILTRO DE BÚSQUEDA
  // ====================================================

  const muestrasFiltradas = useMemo(() => {
    const buscar = busqueda.trim().toLowerCase();

    return muestrasProcesadas.filter((muestra) => {
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

      return contenido.includes(buscar);
    });
  }, [
    muestrasProcesadas,
    busqueda,
    pacientes,
    analisis,
  ]);

  // ====================================================
  // CARGAR VALORES REALES DE FIRESTORE
  // ====================================================

  async function cargarValoresResultado(resultadoId) {
    if (!resultadoId) {
      return [];
    }

    const referenciaValores = collection(
      db,
      "resultados",
      resultadoId,
      "valores"
    );

    const consulta = await getDocs(
      referenciaValores
    );

    return consulta.docs.map((documento) => ({
      ...documento.data(),
      id: documento.id,
    }));
  }

  // ====================================================
  // ABRIR DETALLE
  // ====================================================

  async function abrirDetalle(muestra) {
    const paciente = buscarPaciente(
      muestra.pacienteId
    );

    const analisisEncontrado = buscarAnalisis(
      muestra.analisisId
    );

    const resultado = buscarResultado(
      muestra.id
    );

    const parametros = obtenerParametros(
      analisisEncontrado
    );

    setDetalle({
      muestra,
      paciente,
      analisis: analisisEncontrado,
      resultado,
      parametros,
    });

    setValoresRegistrados([]);
    setErrorValores("");

    if (!resultado) {
      return;
    }

    try {
      setCargandoValores(true);

      const valores = await cargarValoresResultado(
        resultado.id
      );

      setValoresRegistrados(valores);
    } catch (errorConsulta) {
      console.error(
        "Error consultando valores registrados:",
        errorConsulta
      );

      setErrorValores(
        "No se pudieron consultar los valores individuales del resultado."
      );
    } finally {
      setCargandoValores(false);
    }
  }

  // ====================================================
  // BUSCAR VALOR DE UN PARÁMETRO
  // ====================================================

  function buscarValorParametro(parametro) {
    if (!detalle?.resultado) {
      return null;
    }

    const resultado = detalle.resultado;

    const parametrosEnResultado = Array.isArray(
      resultado.parametros
    )
      ? resultado.parametros
      : [];

    // Primero buscar en la subcolección de Firestore.

    const valorSubcoleccion =
      valoresRegistrados.find((valor) => {
        return (
          texto(valor.parametroId) ===
            texto(parametro.id) ||
          texto(valor.id) === texto(parametro.id)
        );
      });

    if (valorSubcoleccion) {
      return valorSubcoleccion;
    }

    // Compatibilidad con resultados que guardan
    // los parámetros directamente en un arreglo.

    const valorEnResultado =
      parametrosEnResultado.find((valor) => {
        return (
          texto(valor.parametroId || valor.id) ===
          texto(parametro.id)
        );
      });

    if (valorEnResultado) {
      return valorEnResultado;
    }

    // Compatibilidad con documentos antiguos que
    // no tenían un identificador de parámetro.

    const nombreBuscado = texto(
      parametro.nombre
    ).toLowerCase();

    const valorPorNombre =
      valoresRegistrados.find((valor) => {
        return (
          texto(
            valor.nombreParametro ||
              valor.nombre
          ).toLowerCase() === nombreBuscado
        );
      });

    if (valorPorNombre) {
      return valorPorNombre;
    }

    return (
      parametrosEnResultado.find((valor) => {
        return (
          texto(
            valor.nombreParametro ||
              valor.nombre
          ).toLowerCase() === nombreBuscado
        );
      }) || null
    );
  }

  // ====================================================
  // ACTUALIZAR
  // ====================================================

  async function actualizar() {
    setActualizando(true);

    await cargarDatos();
  }

  // ====================================================
  // CERRAR DETALLE
  // ====================================================

  function cerrarDetalle() {
    setDetalle(null);
    setValoresRegistrados([]);
    setErrorValores("");
  }

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
            Consulta los parámetros configurados,
            sus rangos de referencia y los valores
            registrados de cada análisis.
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
        <div className="vr-error">
          {error}
        </div>
      )}

      {/* BUSCADOR */}

      <section className="vr-card">

        <div className="vr-card-header">
          <h2>Buscar muestra procesada</h2>

          <p>
            Busca por nombre del paciente, CI,
            análisis o código de muestra.
          </p>
        </div>

        <div className="vr-search">

          <input
            type="text"
            placeholder="Paciente, CI, análisis o etiqueta..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

          <button
            type="button"
            className="vr-btn-primary"
            onClick={actualizar}
            disabled={actualizando}
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>

        </div>

      </section>

      {/* MUESTRAS */}

      <section className="vr-card">

        <div className="vr-card-header">
          <h2>Muestras disponibles</h2>

          <p>
            Selecciona una muestra para consultar
            sus parámetros y resultados.
          </p>
        </div>

        {cargando ? (
          <div className="vr-empty">
            Cargando muestras...
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

              const analisisEncontrado =
                buscarAnalisis(
                  muestra.analisisId
                );

              const parametros =
                obtenerParametros(
                  analisisEncontrado
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
                        <strong>Etiqueta:</strong>{" "}
                        {mostrar(
                          muestra.codigoEtiqueta ||
                            muestra.codigoMuestra ||
                            muestra.id
                        )}
                      </p>
                    </div>

                    <span className="vr-badge">
                      {parametros.length} parámetros
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

                  <button
                    type="button"
                    className="vr-btn-primary vr-btn-full"
                    onClick={() =>
                      abrirDetalle(muestra)
                    }
                  >
                    Ver parámetros
                  </button>

                </article>
              );
            })}

          </div>
        )}

      </section>

      {/* MODAL DE DETALLE */}

      {detalle && (
        <div
          className="vr-overlay"
          onClick={cerrarDetalle}
        >

          <div
            className="vr-modal"
            onClick={(evento) =>
              evento.stopPropagation()
            }
          >

            {/* ENCABEZADO DEL MODAL */}

            <div className="vr-modal-header">

              <div>
                <h2>
                  Valores de parámetros
                </h2>

                <p>
                  Detalle completo del análisis
                  y sus resultados registrados.
                </p>
              </div>

              <button
                type="button"
                className="vr-close"
                onClick={cerrarDetalle}
              >
                ×
              </button>

            </div>

            {/* INFORMACIÓN DEL ANÁLISIS */}

            <div className="vr-summary">

              <h3>
                {nombreAnalisis(
                  detalle.muestra
                )}
              </h3>

              <div className="vr-summary-grid">

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
                  <strong>Código:</strong>{" "}
                  {mostrar(
                    detalle.muestra.codigoEtiqueta ||
                      detalle.muestra.id
                  )}
                </p>

                <p>
                  <strong>Total de parámetros:</strong>{" "}
                  {detalle.parametros.length}
                </p>

                <p>
                  <strong>Estado de muestra:</strong>{" "}
                  {mostrar(
                    detalle.muestra.estado
                  )}
                </p>

                <p>
                  <strong>Estado del resultado:</strong>{" "}
                  {detalle.resultado
                    ? mostrar(
                        detalle.resultado.estado
                      )
                    : "Sin resultado"}
                </p>

              </div>

            </div>

            {/* RESULTADO PRINCIPAL */}

            {detalle.resultado && (
              <div className="vr-main-result">

                <h3>
                  Resultado principal
                </h3>

                <p>
                  <strong>Valor:</strong>{" "}
                  {mostrar(
                    detalle.resultado.valorResultado
                  )}
                </p>

                <p>
                  <strong>Unidad:</strong>{" "}
                  {mostrar(
                    detalle.resultado.unidad,
                    "Sin unidad"
                  )}
                </p>

                <p>
                  <strong>Observaciones:</strong>{" "}
                  {mostrar(
                    detalle.resultado.observaciones,
                    "Sin observaciones"
                  )}
                </p>

                <p>
                  <strong>Fecha de registro:</strong>{" "}
                  {fechaTexto(
                    detalle.resultado.fechaRegistro
                  )}
                </p>

              </div>
            )}

            {/* PARÁMETROS */}

            <h3 className="vr-parameters-title">
              Parámetros del análisis
            </h3>

            {cargandoValores && (
              <div className="vr-empty">
                Consultando valores registrados...
              </div>
            )}

            {errorValores && (
              <div className="vr-error">
                {errorValores}
              </div>
            )}

            {detalle.parametros.length === 0 ? (
              <div className="vr-empty">
                Este análisis no tiene parámetros
                configurados.
              </div>
            ) : (
              <div className="vr-parameters">

                {detalle.parametros.map(
                  (parametro, indice) => {
                    const valorRegistrado =
                      buscarValorParametro(
                        parametro
                      );

                    const valor =
                      valorRegistrado?.valor ??
                      valorRegistrado?.valorResultado ??
                      valorRegistrado?.resultado;

                    const observacion =
                      valorRegistrado?.observacion ??
                      valorRegistrado?.observaciones;

                    return (
                      <div
                        key={parametro.id}
                        className="vr-parameter"
                      >

                        {/* NOMBRE */}

                        <div className="vr-parameter-header">

                          <h4>
                            {indice + 1}.{" "}
                            {parametro.nombre}
                          </h4>

                          <span>
                            {mostrar(
                              parametro.unidad,
                              "Sin unidad"
                            )}
                          </span>

                        </div>

                        {/* DATOS */}

                        <div className="vr-parameter-grid">

                          <div>
                            <label>
                              Referencia
                            </label>

                            <strong>
                              {referenciaTexto(
                                parametro.referencia
                              )}
                            </strong>
                          </div>

                          <div>
                            <label>
                              Unidad
                            </label>

                            <strong>
                              {mostrar(
                                parametro.unidad,
                                "No configurada"
                              )}
                            </strong>
                          </div>

                          <div>
                            <label>
                              Valor registrado
                            </label>

                            <strong>
                              {cargandoValores
                                ? "Consultando..."
                                : mostrar(
                                    valor,
                                    "Sin valor registrado"
                                  )}
                            </strong>
                          </div>

                          <div>
                            <label>
                              Observación
                            </label>

                            <strong>
                              {cargandoValores
                                ? "Consultando..."
                                : mostrar(
                                    observacion,
                                    "Sin observación"
                                  )}
                            </strong>
                          </div>

                        </div>

                        {/* DESCRIPCIÓN */}

                        {parametro.descripcion && (
                          <p className="vr-description">
                            {parametro.descripcion}
                          </p>
                        )}

                        {/* FECHA DEL VALOR */}

                        {valorRegistrado?.fechaRegistro && (
                          <p className="vr-description">
                            <strong>
                              Fecha de registro:
                            </strong>{" "}
                            {fechaTexto(
                              valorRegistrado.fechaRegistro
                            )}
                          </p>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            )}

            {/* CERRAR */}

            <div className="vr-modal-footer">

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