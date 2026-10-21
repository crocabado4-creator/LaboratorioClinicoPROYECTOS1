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
  listarResultadosParaParametros,
  listarParametrosAnalisis,
  listarValoresResultado,
  guardarValorParametro,
  resultadoPermiteEditarValores,
} from "../services/valoresResultadosService";

import "./ValoresResultados.css";

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

function mostrar(valor, defecto = "No registrado") {
  return texto(valor) || defecto;
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
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
  return (
    paciente?.ci ||
    paciente?.carnet ||
    paciente?.carnetIdentidad ||
    paciente?.numeroDocumento ||
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

function obtenerReferenciaParametro(parametro) {
  const referencia =
    parametro.rangoReferencia ??
    parametro.referencia ??
    parametro.rango;

  if (
    referencia !== undefined &&
    referencia !== null &&
    referencia !== ""
  ) {
    return referenciaTexto(referencia);
  }

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

function obtenerParametros(analisis) {
  return normalizarParametros(
    analisis?.parametros
  );
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. Verifica los " +
      "permisos sobre análisis, resultados y parámetros."
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

function buscarValorEnLista(
  parametro,
  valores,
  resultado
) {
  const parametrosResultado = Array.isArray(
    resultado?.parametros
  )
    ? resultado.parametros
    : [];

  const registros = [
    ...valores,
    ...parametrosResultado,
  ];

  const parametroId = texto(parametro.id);

  const coincidenciaId = registros.find(
    (registro) =>
      texto(
        registro.parametroId ||
          registro.id
      ) === parametroId
  );

  if (coincidenciaId) {
    return coincidenciaId;
  }

  const nombreBuscado = normalizar(
    parametro.nombre
  );

  return (
    registros.find(
      (registro) =>
        normalizar(
          registro.nombreParametro ||
            registro.nombre
        ) === nombreBuscado
    ) || null
  );
}

function valorRegistradoTexto(registro) {
  return texto(
    registro?.valor ??
      registro?.valorResultado ??
      registro?.resultado
  );
}

const estiloBotonesTarjeta = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  width: "100%",
  marginTop: "12px",
};

const estiloBotonSecundario = {
  background: "#17365D",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "7px",
  padding: "12px",
  cursor: "pointer",
  fontWeight: 600,
  width: "100%",
};

const estiloBotonRegistrar = {
  background: "#16A34A",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "7px",
  padding: "12px",
  cursor: "pointer",
  fontWeight: 600,
  width: "100%",
};

const estiloBotonDeshabilitado = {
  background: "#94A3B8",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "7px",
  padding: "12px",
  cursor: "not-allowed",
  fontWeight: 600,
  width: "100%",
};

const estiloCampo = {
  width: "100%",
  padding: "12px",
  border: "1px solid #CBD5E1",
  borderRadius: "8px",
  boxSizing: "border-box",
};

const estiloEtiqueta = {
  display: "block",
  marginBottom: "8px",
  fontWeight: 600,
};

export default function ValoresResultados({
  usuario,
  onVolver,
  volver,
}) {
  const laboratorioId = texto(
    usuario?.laboratorioId
  );

  const rolUsuario = normalizar(
    usuario?.rol
  );

  const puedeRegistrar =
    rolUsuario === "bioquimico" &&
    usuario?.activo === true;

  const [muestras, setMuestras] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [resultados, setResultados] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [detalle, setDetalle] = useState(null);

  const [
    valoresRegistrados,
    setValoresRegistrados,
  ] = useState([]);

  const [cargando, setCargando] = useState(true);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [
    cargandoValores,
    setCargandoValores,
  ] = useState(false);

  const [
    guardandoParametro,
    setGuardandoParametro,
  ] = useState("");

  const [
    parametroEditando,
    setParametroEditando,
  ] = useState(null);

  const [
    valorFormulario,
    setValorFormulario,
  ] = useState("");

  const [
    unidadFormulario,
    setUnidadFormulario,
  ] = useState("");

  const [
    observacionFormulario,
    setObservacionFormulario,
  ] = useState("");

  const [error, setError] = useState("");

  const [
    errorValores,
    setErrorValores,
  ] = useState("");

  const [
    mensajeValores,
    setMensajeValores,
  ] = useState("");

  const cargarDatos = useCallback(
    async (mostrarCarga = true) => {
      if (!laboratorioId) {
        setError(
          "No se encontró el laboratorio del usuario."
        );

        setCargando(false);
        setActualizando(false);

        return;
      }

      try {
        if (mostrarCarga) {
          setCargando(true);
        } else {
          setActualizando(true);
        }

        setError("");

        const [
          muestrasSnap,
          pacientesSnap,
          analisisSnap,
          listaResultados,
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

          listarResultadosParaParametros(
            laboratorioId
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
          Array.isArray(listaResultados)
            ? listaResultados
            : []
        );
      } catch (errorConsulta) {
        console.error(
          "Error cargando valores por parámetros:",
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

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const pacientesPorId = useMemo(() => {
    const mapa = new Map();

    pacientes.forEach((paciente) => {
      mapa.set(
        texto(paciente.id),
        paciente
      );

      if (paciente.pacienteId) {
        mapa.set(
          texto(paciente.pacienteId),
          paciente
        );
      }
    });

    return mapa;
  }, [pacientes]);

  const buscarPaciente = useCallback(
    (pacienteId) =>
      pacientesPorId.get(texto(pacienteId)),
    [pacientesPorId]
  );

  const analisisPorId = useMemo(() => {
    const mapa = new Map();

    analisis.forEach((item) => {
      mapa.set(
        texto(item.id),
        item
      );
    });

    return mapa;
  }, [analisis]);

  const buscarAnalisis = useCallback(
    (analisisId) =>
      analisisPorId.get(texto(analisisId)),
    [analisisPorId]
  );

  const resultadosPorMuestra = useMemo(() => {
    const mapa = new Map();

    resultados.forEach((resultado) => {
      const muestraId = texto(
        resultado.muestraId
      );

      if (muestraId) {
        mapa.set(muestraId, resultado);
      }

      if (resultado.id) {
        mapa.set(
          texto(resultado.id),
          resultado
        );
      }
    });

    return mapa;
  }, [resultados]);

  const buscarResultado = useCallback(
    (muestraId) =>
      resultadosPorMuestra.get(
        texto(muestraId)
      ),
    [resultadosPorMuestra]
  );

  const nombreAnalisis = useCallback(
    (muestra) => {
      if (muestra?.analisisNombre) {
        return muestra.analisisNombre;
      }

      const encontrado = buscarAnalisis(
        muestra?.analisisId
      );

      return (
        encontrado?.nombre ||
        encontrado?.nombreAnalisis ||
        "Análisis no identificado"
      );
    },
    [buscarAnalisis]
  );

  const muestrasProcesadas = useMemo(() => {
    return muestras.filter(
      (muestra) =>
        normalizar(muestra.estado) ===
          "procesada" &&
        muestra.aceptada === true
    );
  }, [muestras]);

  const muestrasFiltradas = useMemo(() => {
    const buscar = normalizar(busqueda);

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
          muestra.ordenId,
        ]
          .map(texto)
          .join(" ")
          .toLowerCase();

        return contenido.includes(buscar);
      }
    );
  }, [
    muestrasProcesadas,
    busqueda,
    buscarPaciente,
    nombreAnalisis,
  ]);

  const cargarValores = async (resultadoId) => {
    if (!resultadoId) {
      setValoresRegistrados([]);
      return [];
    }

    try {
      setCargandoValores(true);
      setErrorValores("");

      const valores = await listarValoresResultado(
        resultadoId
      );

      const lista = Array.isArray(valores)
        ? valores
        : [];

      setValoresRegistrados(lista);

      return lista;
    } catch (errorConsulta) {
      console.error(
        "Error consultando valores:",
        errorConsulta
      );

      setErrorValores(
        obtenerMensajeError(errorConsulta)
      );

      throw errorConsulta;
    } finally {
      setCargandoValores(false);
    }
  };

  const cargarParametros = async (
    analisisEncontrado
  ) => {
    if (!analisisEncontrado) {
      return [];
    }

    const parametrosSubcoleccion =
      await listarParametrosAnalisis(
        analisisEncontrado.id,
        laboratorioId
      );

    if (
      Array.isArray(parametrosSubcoleccion) &&
      parametrosSubcoleccion.length > 0
    ) {
      return normalizarParametros(
        parametrosSubcoleccion
      );
    }

    return obtenerParametros(
      analisisEncontrado
    );
  };

  const prepararFormulario = (
    parametro,
    valores,
    resultado
  ) => {
    const registro = buscarValorEnLista(
      parametro,
      valores,
      resultado
    );

    setParametroEditando(parametro);

    setValorFormulario(
      valorRegistradoTexto(registro)
    );

    setUnidadFormulario(
      texto(
        registro?.unidad ??
          parametro.unidad
      )
    );

    setObservacionFormulario(
      texto(
        registro?.observacion ??
          registro?.observaciones
      )
    );

    setErrorValores("");
    setMensajeValores("");
  };

  const abrirDetalle = async (
    muestra,
    abrirRegistro = false
  ) => {
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
      parametros: [],
    });

    setValoresRegistrados([]);
    setErrorValores("");
    setMensajeValores("");
    setParametroEditando(null);

    try {
      setCargandoValores(true);

      const parametros = await cargarParametros(
        analisisEncontrado
      );

      let valores = [];

      if (resultado) {
        valores = await listarValoresResultado(
          resultado.id
        );

        if (!Array.isArray(valores)) {
          valores = [];
        }
      }

      setDetalle({
        muestra,
        paciente,
        analisis: analisisEncontrado,
        resultado,
        parametros,
      });

      setValoresRegistrados(valores);

      if (abrirRegistro) {
        if (!puedeRegistrar) {
          setErrorValores(
            "Solo el Bioquímico puede registrar valores."
          );

          return;
        }

        if (!resultado) {
          setErrorValores(
            "Primero debes registrar el resultado general del análisis."
          );

          return;
        }

        if (
          !resultadoPermiteEditarValores(
            resultado
          )
        ) {
          setErrorValores(
            "Este resultado ya fue validado o no está en borrador."
          );

          return;
        }

        if (parametros.length === 0) {
          setErrorValores(
            "Este análisis no tiene parámetros configurados."
          );

          return;
        }

        const pendiente = parametros.find(
          (parametro) => {
            const registro = buscarValorEnLista(
              parametro,
              valores,
              resultado
            );

            return (
              valorRegistradoTexto(registro) === ""
            );
          }
        );

        const parametroInicial =
          pendiente || parametros[0];

        prepararFormulario(
          parametroInicial,
          valores,
          resultado
        );
      }
    } catch (errorConsulta) {
      console.error(
        "Error abriendo detalle:",
        errorConsulta
      );

      setErrorValores(
        obtenerMensajeError(errorConsulta)
      );
    } finally {
      setCargandoValores(false);
    }
  };

  const buscarValorParametro = (parametro) => {
    return buscarValorEnLista(
      parametro,
      valoresRegistrados,
      detalle?.resultado
    );
  };

  const editarParametro = (parametro) => {
    if (!puedeRegistrar) {
      setErrorValores(
        "Solo el Bioquímico puede registrar valores."
      );

      return;
    }

    if (!detalle?.resultado) {
      setErrorValores(
        "Primero debes registrar el resultado general del análisis."
      );

      return;
    }

    if (
      !resultadoPermiteEditarValores(
        detalle.resultado
      )
    ) {
      setErrorValores(
        "El resultado ya está validado o no se encuentra en borrador."
      );

      return;
    }

    prepararFormulario(
      parametro,
      valoresRegistrados,
      detalle.resultado
    );
  };

  const cerrarFormulario = () => {
    if (guardandoParametro) {
      return;
    }

    setParametroEditando(null);
    setValorFormulario("");
    setUnidadFormulario("");
    setObservacionFormulario("");
  };

  const guardarValor = async (evento) => {
    evento.preventDefault();

    if (
      guardandoParametro ||
      !parametroEditando ||
      !detalle?.resultado
    ) {
      return;
    }

    if (!puedeRegistrar) {
      setErrorValores(
        "Solo el Bioquímico puede registrar valores."
      );

      return;
    }

    const valorIngresado = texto(
      valorFormulario
    );

    if (!valorIngresado) {
      setErrorValores(
        "Debes ingresar el valor del parámetro."
      );

      return;
    }

    const resultadoId = detalle.resultado.id;
    const parametroId = parametroEditando.id;

    try {
      setGuardandoParametro(parametroId);
      setErrorValores("");
      setMensajeValores("");

      await guardarValorParametro({
        resultadoId,
        laboratorioId,
        parametroId,

        nombreParametro:
          parametroEditando.nombre,

        valor: valorIngresado,

        unidad: unidadFormulario,

        rangoReferencia:
          obtenerReferenciaParametro(
            parametroEditando
          ),

        observacion:
          observacionFormulario,
      });

      await cargarValores(resultadoId);

      setParametroEditando(null);
      setValorFormulario("");
      setUnidadFormulario("");
      setObservacionFormulario("");

      setMensajeValores(
        "Valor del parámetro guardado correctamente."
      );
    } catch (errorGuardado) {
      console.error(
        "Error guardando parámetro:",
        errorGuardado
      );

      setErrorValores(
        obtenerMensajeError(errorGuardado)
      );
    } finally {
      setGuardandoParametro("");
    }
  };

  const actualizar = async () => {
    await cargarDatos(false);
  };

  const cerrarDetalle = () => {
    if (guardandoParametro) {
      return;
    }

    setDetalle(null);
    setValoresRegistrados([]);
    setErrorValores("");
    setMensajeValores("");
    setParametroEditando(null);
    setValorFormulario("");
    setUnidadFormulario("");
    setObservacionFormulario("");
  };

  return (
    <div className="vr-page">
      <header className="vr-header">
        <div>
          <h1>Valores por parámetros</h1>

          <p>
            Consulta los parámetros configurados,
            sus rangos de referencia y registra
            los valores individuales de cada análisis.
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

      <section className="vr-stats">
        <article>
          <span>Muestras procesadas</span>

          <strong>
            {muestrasProcesadas.length}
          </strong>
        </article>

        <article>
          <span>Análisis configurados</span>

          <strong>{analisis.length}</strong>
        </article>

        <article>
          <span>Resultados registrados</span>

          <strong>{resultados.length}</strong>
        </article>
      </section>

      {error && (
        <div
          className="vr-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!puedeRegistrar && (
        <div className="vr-error">
          Solo el Bioquímico puede registrar
          o modificar valores individuales.
        </div>
      )}

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
            disabled={
              actualizando ||
              cargando ||
              Boolean(guardandoParametro)
            }
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>
      </section>

      <section className="vr-card">
        <div className="vr-card-header">
          <h2>Muestras disponibles</h2>

          <p>
            Selecciona una muestra para consultar
            o registrar sus parámetros y resultados.
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

              const parametros = obtenerParametros(
                analisisEncontrado
              );

              const resultado = buscarResultado(
                muestra.id
              );

              const permiteRegistrar =
                puedeRegistrar &&
                Boolean(resultado) &&
                resultadoPermiteEditarValores(
                  resultado
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

                  <div
                    className="vr-item-actions"
                    style={estiloBotonesTarjeta}
                  >
                    <button
                      type="button"
                      className="vr-btn-primary"
                      style={estiloBotonSecundario}
                      onClick={() =>
                        abrirDetalle(
                          muestra,
                          false
                        )
                      }
                    >
                      Ver parámetros
                    </button>

                    <button
                      type="button"
                      className="vr-btn-primary"
                      style={
                        permiteRegistrar
                          ? estiloBotonRegistrar
                          : estiloBotonDeshabilitado
                      }
                      disabled={
                        !permiteRegistrar ||
                        Boolean(guardandoParametro)
                      }
                      onClick={() =>
                        abrirDetalle(
                          muestra,
                          true
                        )
                      }
                      title={
                        !resultado
                          ? "Primero registra el resultado general."
                          : !permiteRegistrar
                          ? "Este resultado no permite registrar valores."
                          : "Registrar un valor individual."
                      }
                    >
                      Registrar valor
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
            <div className="vr-modal-header">
              <div>
                <h2 id="vr-titulo-modal">
                  Valores de parámetros
                </h2>

                <p>
                  Detalle completo del análisis
                  y sus valores registrados.
                </p>
              </div>

              <button
                type="button"
                className="vr-close"
                onClick={cerrarDetalle}
                disabled={
                  Boolean(guardandoParametro)
                }
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>

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
                      detalle.muestra.codigoMuestra ||
                      detalle.muestra.id
                  )}
                </p>

                <p>
                  <strong>
                    Total de parámetros:
                  </strong>{" "}
                  {detalle.parametros.length}
                </p>

                <p>
                  <strong>
                    Estado de muestra:
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
            </div>

            {detalle.resultado ? (
              <div className="vr-main-result">
                <h3>Resultado principal</h3>

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
                  <strong>
                    Observaciones:
                  </strong>{" "}
                  {mostrar(
                    detalle.resultado.observaciones,
                    "Sin observaciones"
                  )}
                </p>

                <p>
                  <strong>
                    Fecha de registro:
                  </strong>{" "}
                  {fechaTexto(
                    detalle.resultado.fechaRegistro
                  )}
                </p>
              </div>
            ) : (
              <div className="vr-error">
                Esta muestra todavía no tiene
                un resultado general registrado.
                Primero debes registrarlo desde
                el módulo Registro de resultados.
              </div>
            )}

            {errorValores && (
              <div
                className="vr-error"
                role="alert"
              >
                {errorValores}
              </div>
            )}

            {mensajeValores && (
              <div
                className="vr-main-result"
                role="status"
              >
                {mensajeValores}
              </div>
            )}

            <h3 className="vr-parameters-title">
              Parámetros del análisis
            </h3>

            {cargandoValores && (
              <div className="vr-empty">
                Consultando parámetros y valores...
              </div>
            )}

            {!cargandoValores &&
              detalle.parametros.length === 0 && (
                <div className="vr-empty">
                  Este análisis no tiene parámetros
                  configurados.
                </div>
              )}

            {!cargandoValores &&
              detalle.parametros.length > 0 && (
                <div className="vr-parameters">
                  {detalle.parametros.map(
                    (parametro, indice) => {
                      const valorRegistrado =
                        buscarValorParametro(
                          parametro
                        );

                      const valor =
                        valorRegistradoTexto(
                          valorRegistrado
                        );

                      const observacion =
                        valorRegistrado?.observacion ??
                        valorRegistrado?.observaciones;

                      const puedeEditar =
                        puedeRegistrar &&
                        Boolean(
                          detalle.resultado
                        ) &&
                        resultadoPermiteEditarValores(
                          detalle.resultado
                        );

                      return (
                        <div
                          key={parametro.id}
                          className="vr-parameter"
                        >
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

                          <div className="vr-parameter-grid">
                            <div>
                              <label>
                                Referencia
                              </label>

                              <strong>
                                {obtenerReferenciaParametro(
                                  parametro
                                )}
                              </strong>
                            </div>

                            <div>
                              <label>
                                Unidad
                              </label>

                              <strong>
                                {mostrar(
                                  valorRegistrado?.unidad ??
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
                                {mostrar(
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
                                {mostrar(
                                  observacion,
                                  "Sin observación"
                                )}
                              </strong>
                            </div>
                          </div>

                          {parametro.descripcion && (
                            <p className="vr-description">
                              {parametro.descripcion}
                            </p>
                          )}

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

                          {puedeEditar && (
                            <button
                              type="button"
                              className="vr-btn-primary"
                              style={{
                                marginTop: "14px",
                              }}
                              disabled={
                                Boolean(
                                  guardandoParametro
                                )
                              }
                              onClick={() =>
                                editarParametro(
                                  parametro
                                )
                              }
                            >
                              {valor
                                ? "Editar valor"
                                : "Registrar valor"}
                            </button>
                          )}

                          {detalle.resultado &&
                            !resultadoPermiteEditarValores(
                              detalle.resultado
                            ) && (
                              <p className="vr-description">
                                Este resultado ya no
                                permite modificaciones.
                              </p>
                            )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}

            {parametroEditando && (
              <div
                className="vr-main-result"
                style={{
                  marginTop: "20px",
                }}
              >
                <h3>
                  Registrar valor:{" "}
                  {parametroEditando.nombre}
                </h3>

                <form onSubmit={guardarValor}>
                  <div
                    style={{
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    <div>
                      <label
                        htmlFor="vr-valor"
                        style={estiloEtiqueta}
                      >
                        Valor del parámetro
                      </label>

                      <input
                        id="vr-valor"
                        type="text"
                        value={valorFormulario}
                        onChange={(evento) =>
                          setValorFormulario(
                            evento.target.value
                          )
                        }
                        placeholder="Ingrese el valor"
                        disabled={
                          Boolean(
                            guardandoParametro
                          )
                        }
                        required
                        style={estiloCampo}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vr-unidad"
                        style={estiloEtiqueta}
                      >
                        Unidad
                      </label>

                      <input
                        id="vr-unidad"
                        type="text"
                        value={unidadFormulario}
                        onChange={(evento) =>
                          setUnidadFormulario(
                            evento.target.value
                          )
                        }
                        disabled={
                          Boolean(
                            guardandoParametro
                          )
                        }
                        style={estiloCampo}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vr-observacion"
                        style={estiloEtiqueta}
                      >
                        Observación
                      </label>

                      <textarea
                        id="vr-observacion"
                        rows={3}
                        value={
                          observacionFormulario
                        }
                        onChange={(evento) =>
                          setObservacionFormulario(
                            evento.target.value
                          )
                        }
                        disabled={
                          Boolean(
                            guardandoParametro
                          )
                        }
                        style={estiloCampo}
                      />
                    </div>
                  </div>

                  <div
                    className="vr-modal-footer"
                    style={{
                      marginTop: "18px",
                    }}
                  >
                    <button
                      type="button"
                      className="vr-btn-back"
                      onClick={
                        cerrarFormulario
                      }
                      disabled={
                        Boolean(
                          guardandoParametro
                        )
                      }
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="vr-btn-primary"
                      disabled={
                        Boolean(
                          guardandoParametro
                        ) ||
                        !valorFormulario.trim()
                      }
                    >
                      {guardandoParametro
                        ? "Guardando..."
                        : "Guardar valor"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="vr-modal-footer">
              <button
                type="button"
                className="vr-btn-back"
                onClick={cerrarDetalle}
                disabled={
                  Boolean(
                    guardandoParametro
                  )
                }
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