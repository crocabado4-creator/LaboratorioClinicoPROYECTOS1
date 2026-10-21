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
  listarMuestrasValidacion,
  aceptarMuestra as aceptarMuestraServicio,
  rechazarMuestra as rechazarMuestraServicio,
} from "../services/validacionMuestrasService";

import "./ValidacionMuestras.css";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function obtenerEstado(muestra) {
  return limpiarTexto(
    muestra?.estado || "tomada"
  ).toLowerCase();
}

function pendienteValidacion(muestra) {
  return obtenerEstado(muestra) === "tomada";
}

function muestraPuedeProcesarse(muestra) {
  const estado = obtenerEstado(muestra);

  return (
    (estado === "aceptada" ||
      estado === "en_proceso" ||
      estado === "procesada") &&
    muestra?.aceptada !== false &&
    limpiarTexto(
      muestra?.estadoValidacion || "aceptada"
    ).toLowerCase() !== "rechazada"
  );
}

function obtenerCodigoMuestra(muestra) {
  return (
    muestra?.codigoEtiqueta ||
    muestra?.codigoMuestra ||
    muestra?.muestraId ||
    muestra?.id ||
    "Sin código"
  );
}

function obtenerTipoMuestra(muestra) {
  return (
    muestra?.tipo ||
    muestra?.tipoMuestra ||
    "-"
  );
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "Sin fecha";
  }

  try {
    let valor;

    if (typeof fecha.toDate === "function") {
      valor = fecha.toDate();
    } else if (
      typeof fecha.seconds === "number"
    ) {
      valor = new Date(
        fecha.seconds * 1000
      );
    } else if (fecha instanceof Date) {
      valor = fecha;
    } else {
      valor = new Date(fecha);
    }

    if (Number.isNaN(valor.getTime())) {
      return "Sin fecha";
    }

    return valor.toLocaleString("es-BO");
  } catch {
    return "Sin fecha";
  }
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Verifica los permisos del Bioquímico y el laboratorio."
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

// =====================================================
// OBTENER NOMBRE COMPLETO DEL PACIENTE
// =====================================================

function obtenerNombreCompletoPaciente(paciente) {
  if (!paciente) {
    return "";
  }

  const nombres = limpiarTexto(
    paciente.nombres ||
    paciente.nombre ||
    paciente.primerNombre ||
    ""
  );

  const apellidos = limpiarTexto(
    paciente.apellidos ||
    paciente.apellido ||
    [
      paciente.apellidoPaterno,
      paciente.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const nombreCompleto = [
    nombres,
    apellidos,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    nombreCompleto ||
    limpiarTexto(paciente.nombreCompleto)
  );
}

// =====================================================
// OBTENER CARNET DEL PACIENTE
// =====================================================

function obtenerCarnetPaciente(paciente) {
  return limpiarTexto(
    paciente?.ci ||
    paciente?.carnet ||
    paciente?.carnetIdentidad ||
    paciente?.numeroDocumento ||
    paciente?.documento ||
    ""
  );
}

// =====================================================
// CONSULTAR PACIENTES DE FIRESTORE
// =====================================================

async function cargarPacientesLaboratorio(
  laboratorioId
) {
  if (!laboratorioId) {
    return {};
  }

  const consulta = query(
    collection(db, "pacientes"),
    where(
      "laboratorioId",
      "==",
      laboratorioId
    )
  );

  const respuesta = await getDocs(consulta);

  const pacientes = {};

  respuesta.docs.forEach((documento) => {
    pacientes[documento.id] = {
      id: documento.id,
      ...documento.data(),
    };
  });

  return pacientes;
}

// =====================================================
// OBTENER IDENTIFICADOR DEL PACIENTE
// =====================================================

function obtenerPacienteId(muestra) {
  return limpiarTexto(
    muestra?.pacienteId ||
    muestra?.idPaciente ||
    muestra?.paciente?.id ||
    muestra?.paciente?.pacienteId ||
    ""
  );
}

// =====================================================
// OBTENER IDENTIFICADOR DE ORDEN
// =====================================================

function obtenerOrdenId(muestra) {
  return limpiarTexto(
    muestra?.ordenId ||
    muestra?.idOrden ||
    muestra?.orden?.id ||
    ""
  );
}

// =====================================================
// BUSCAR PACIENTES A TRAVÉS DE LAS ÓRDENES
// =====================================================

async function cargarPacientesDesdeOrdenes(
  muestras,
  laboratorioId
) {
  const relaciones = {};

  const ordenesIds = [
    ...new Set(
      muestras
        .filter(
          (muestra) =>
            !obtenerPacienteId(muestra)
        )
        .map(obtenerOrdenId)
        .filter(Boolean)
    ),
  ];

  if (ordenesIds.length === 0) {
    return relaciones;
  }

  const resultados = await Promise.allSettled(
    ordenesIds.map(async (ordenId) => {
      const referencia = doc(
        db,
        "ordenes",
        ordenId
      );

      const documento = await getDoc(
        referencia
      );

      if (!documento.exists()) {
        return null;
      }

      const orden = documento.data();

      if (
        limpiarTexto(orden.laboratorioId) !==
        laboratorioId
      ) {
        return null;
      }

      return {
        ordenId,
        pacienteId: limpiarTexto(
          orden.pacienteId ||
          orden.idPaciente ||
          ""
        ),
      };
    })
  );

  resultados.forEach((resultado) => {
    if (
      resultado.status === "fulfilled" &&
      resultado.value?.pacienteId
    ) {
      relaciones[
        resultado.value.ordenId
      ] = resultado.value.pacienteId;
    }
  });

  return relaciones;
}

// =====================================================
// RESOLVER PACIENTE DE UNA MUESTRA
// =====================================================

function resolverPaciente(
  muestra,
  pacientes,
  relacionesOrdenes
) {
  const pacienteIdDirecto =
    obtenerPacienteId(muestra);

  const ordenId = obtenerOrdenId(muestra);

  const pacienteId =
    pacienteIdDirecto ||
    relacionesOrdenes[ordenId] ||
    "";

  if (pacienteId && pacientes[pacienteId]) {
    const paciente = pacientes[pacienteId];

    return {
      pacienteId,
      nombreCompleto:
        obtenerNombreCompletoPaciente(
          paciente
        ),
      carnet:
        obtenerCarnetPaciente(
          paciente
        ),
    };
  }

  if (muestra?.paciente) {
    const nombre = obtenerNombreCompletoPaciente(
      muestra.paciente
    );

    if (nombre) {
      return {
        pacienteId,
        nombreCompleto: nombre,
        carnet: obtenerCarnetPaciente(
          muestra.paciente
        ),
      };
    }
  }

  const nombreGuardado = limpiarTexto(
    muestra?.nombrePaciente ||
    muestra?.pacienteNombre ||
    ""
  );

  if (
    nombreGuardado &&
    nombreGuardado !== pacienteId
  ) {
    return {
      pacienteId,
      nombreCompleto: nombreGuardado,
      carnet: limpiarTexto(
        muestra?.ciPaciente ||
        muestra?.carnetPaciente
      ),
    };
  }

  return {
    pacienteId,
    nombreCompleto:
      "Paciente no encontrado",
    carnet: "",
  };
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function ValidacionMuestras({
  usuario,
  onVolver,
}) {
  const laboratorioId = limpiarTexto(
    usuario?.laboratorioId
  );

  const rol = limpiarTexto(
    usuario?.rol
  ).toLowerCase();

  const puedeValidar =
    rol === "bioquimico";

  // ===================================================
  // ESTADOS
  // ===================================================

  const [muestras, setMuestras] =
    useState([]);

  const [pacientes, setPacientes] =
    useState({});

  const [
    relacionesOrdenes,
    setRelacionesOrdenes,
  ] = useState({});

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [busqueda, setBusqueda] =
    useState("");

  const [filtro, setFiltro] =
    useState("todas");

  const [
    muestraSeleccionada,
    setMuestraSeleccionada,
  ] = useState(null);

  const [
    motivoRechazo,
    setMotivoRechazo,
  ] = useState("");

  const [mensaje, setMensaje] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    advertenciaPacientes,
    setAdvertenciaPacientes,
  ] = useState("");

  // ===================================================
  // CARGAR MUESTRAS Y PACIENTES
  // ===================================================

  const cargarMuestras = useCallback(
    async (mostrarCarga = true) => {
      if (!laboratorioId) {
        setError(
          "El usuario no tiene laboratorio asignado."
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
        setAdvertenciaPacientes("");

        // ---------------------------------------------
        // 1. OBTENER MUESTRAS
        // ---------------------------------------------

        const datos =
          await listarMuestrasValidacion(
            laboratorioId
          );

        const listaMuestras =
          Array.isArray(datos)
            ? datos
            : [];

        setMuestras(listaMuestras);

        // ---------------------------------------------
        // 2. OBTENER PACIENTES
        // ---------------------------------------------

        const resultadoPacientes =
          await Promise.allSettled([
            cargarPacientesLaboratorio(
              laboratorioId
            ),
            cargarPacientesDesdeOrdenes(
              listaMuestras,
              laboratorioId
            ),
          ]);

        if (
          resultadoPacientes[0].status ===
          "fulfilled"
        ) {
          setPacientes(
            resultadoPacientes[0].value
          );
        } else {
          console.error(
            "Error consultando pacientes:",
            resultadoPacientes[0].reason
          );

          setPacientes({});

          setAdvertenciaPacientes(
            "Las muestras se cargaron, pero no se pudieron consultar los pacientes. Verifica los permisos de lectura de la colección pacientes."
          );
        }

        if (
          resultadoPacientes[1].status ===
          "fulfilled"
        ) {
          setRelacionesOrdenes(
            resultadoPacientes[1].value
          );
        } else {
          console.error(
            "Error consultando órdenes:",
            resultadoPacientes[1].reason
          );

          setRelacionesOrdenes({});
        }

        return true;
      } catch (err) {
        console.error(
          "Error cargando muestras:",
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

  useEffect(() => {
    cargarMuestras();
  }, [cargarMuestras]);

  // ===================================================
  // MUESTRAS CON DATOS DEL PACIENTE
  // ===================================================

  const muestrasConPacientes = useMemo(
    () =>
      muestras.map((muestra) => {
        const datosPaciente =
          resolverPaciente(
            muestra,
            pacientes,
            relacionesOrdenes
          );

        return {
          ...muestra,

          pacienteIdResuelto:
            datosPaciente.pacienteId,

          pacienteNombreCompleto:
            datosPaciente.nombreCompleto,

          pacienteCarnet:
            datosPaciente.carnet,
        };
      }),
    [
      muestras,
      pacientes,
      relacionesOrdenes,
    ]
  );

  // ===================================================
  // ACEPTAR MUESTRA
  // ===================================================

  async function aceptarMuestra(muestra) {
    if (guardando) {
      return;
    }

    if (!puedeValidar) {
      setError(
        "Solo el Bioquímico puede validar muestras."
      );
      return;
    }

    if (!pendienteValidacion(muestra)) {
      setError(
        "Esta muestra ya fue validada o no está pendiente."
      );
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas que la muestra ${obtenerCodigoMuestra(
        muestra
      )} es apta para el análisis?`
    );

    if (!confirmar) {
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await aceptarMuestraServicio({
        muestraId: muestra.id,
        laboratorioId,
      });

      setMuestras((anteriores) =>
        anteriores.map((item) =>
          item.id === muestra.id
            ? {
                ...item,
                estado: "aceptada",
                estadoValidacion:
                  "aceptada",
                aceptada: true,
                motivoRechazo: "",
              }
            : item
        )
      );

      setMensaje(
        "La muestra fue aceptada correctamente."
      );

      const actualizado =
        await cargarMuestras(false);

      if (actualizado) {
        setMensaje(
          "La muestra fue aceptada correctamente."
        );
      } else {
        setMensaje(
          "La muestra fue aceptada. " +
            "No se pudo actualizar el listado; utiliza el botón Actualizar."
        );
      }
    } catch (err) {
      console.error(
        "Error aceptando muestra:",
        err
      );

      setError(
        obtenerMensajeError(err)
      );
    } finally {
      setGuardando(false);
    }
  }

  // ===================================================
  // ABRIR FORMULARIO DE RECHAZO
  // ===================================================

  function abrirRechazo(muestra) {
    if (!puedeValidar) {
      setError(
        "Solo el Bioquímico puede validar muestras."
      );
      return;
    }

    if (!pendienteValidacion(muestra)) {
      setError(
        "Esta muestra ya fue validada o no está pendiente."
      );
      return;
    }

    setMuestraSeleccionada(muestra);
    setMotivoRechazo("");
    setError("");
    setMensaje("");
  }

  // ===================================================
  // RECHAZAR MUESTRA
  // ===================================================

  async function confirmarRechazo() {
    if (guardando) {
      return;
    }

    if (!muestraSeleccionada) {
      return;
    }

    if (!puedeValidar) {
      setError(
        "Solo el Bioquímico puede rechazar muestras."
      );
      return;
    }

    const motivo =
      motivoRechazo.trim();

    if (!motivo) {
      setError(
        "Debes escribir el motivo del rechazo."
      );
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await rechazarMuestraServicio({
        muestraId:
          muestraSeleccionada.id,

        laboratorioId,

        motivoRechazo: motivo,
      });

      const idMuestra =
        muestraSeleccionada.id;

      setMuestras((anteriores) =>
        anteriores.map((item) =>
          item.id === idMuestra
            ? {
                ...item,
                estado: "rechazada",
                estadoValidacion:
                  "rechazada",
                aceptada: false,
                motivoRechazo: motivo,
              }
            : item
        )
      );

      setMuestraSeleccionada(null);
      setMotivoRechazo("");

      setMensaje(
        "La muestra fue rechazada correctamente."
      );

      const actualizado =
        await cargarMuestras(false);

      if (actualizado) {
        setMensaje(
          "La muestra fue rechazada correctamente."
        );
      } else {
        setMensaje(
          "La muestra fue rechazada. " +
            "No se pudo actualizar el listado; utiliza el botón Actualizar."
        );
      }
    } catch (err) {
      console.error(
        "Error rechazando muestra:",
        err
      );

      setError(
        obtenerMensajeError(err)
      );
    } finally {
      setGuardando(false);
    }
  }

  // ===================================================
  // BUSCADOR Y FILTROS
  // ===================================================

  const muestrasFiltradas = useMemo(() => {
    const textoBusqueda =
      busqueda.trim().toLowerCase();

    return muestrasConPacientes.filter(
      (muestra) => {
        const contenido = [
          muestra.codigoEtiqueta,
          muestra.codigoMuestra,
          muestra.muestraId,

          muestra.pacienteNombreCompleto,
          muestra.pacienteCarnet,
          muestra.pacienteIdResuelto,

          muestra.nombrePaciente,
          muestra.pacienteId,

          muestra.ordenId,
          muestra.analisisNombre,
          muestra.analisisId,

          muestra.tipo,
          muestra.tipoMuestra,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const coincideBusqueda =
          contenido.includes(
            textoBusqueda
          );

        const estado =
          obtenerEstado(muestra);

        const coincideFiltro =
          filtro === "todas" ||
          (filtro === "pendientes"
            ? pendienteValidacion(
                muestra
              )
            : estado === filtro);

        return (
          coincideBusqueda &&
          coincideFiltro
        );
      }
    );
  }, [
    muestrasConPacientes,
    busqueda,
    filtro,
  ]);

  // ===================================================
  // ESTADÍSTICAS
  // ===================================================

  const estadisticas = useMemo(() => {
    return {
      total: muestras.length,

      pendientes: muestras.filter(
        pendienteValidacion
      ).length,

      aceptadas: muestras.filter(
        (muestra) =>
          obtenerEstado(muestra) ===
          "aceptada"
      ).length,

      rechazadas: muestras.filter(
        (muestra) =>
          obtenerEstado(muestra) ===
          "rechazada"
      ).length,
    };
  }, [muestras]);

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <main className="vm-contenedor">
      <header className="vm-encabezado">
        <div>
          <h1>
            Recepción y validación de muestras
          </h1>

          <p>
            Verifica que las muestras recibidas
            sean aptas antes de realizar el análisis.
          </p>
        </div>

        {onVolver && (
          <button
            type="button"
            className="vm-volver"
            onClick={onVolver}
          >
            Volver
          </button>
        )}
      </header>

      {!puedeValidar && (
        <div className="vm-aviso">
          Solo el Bioquímico puede aceptar
          o rechazar muestras.
        </div>
      )}

      {mensaje && (
        <div
          className="vm-exito"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          className="vm-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {advertenciaPacientes && (
        <div
          className="vm-aviso"
          role="status"
        >
          {advertenciaPacientes}
        </div>
      )}

      {/* =============================================
          ESTADÍSTICAS
      ============================================= */}

      <section className="vm-resumen">
        <div className="vm-tarjeta">
          <span>
            Total de muestras
          </span>

          <strong>
            {estadisticas.total}
          </strong>
        </div>

        <div className="vm-tarjeta">
          <span>
            Pendientes
          </span>

          <strong>
            {estadisticas.pendientes}
          </strong>
        </div>

        <div className="vm-tarjeta">
          <span>
            Aceptadas
          </span>

          <strong>
            {estadisticas.aceptadas}
          </strong>
        </div>

        <div className="vm-tarjeta">
          <span>
            Rechazadas
          </span>

          <strong>
            {estadisticas.rechazadas}
          </strong>
        </div>
      </section>

      {/* =============================================
          PANEL DE MUESTRAS
      ============================================= */}

      <section className="vm-panel">
        <div className="vm-filtros">
          <input
            type="text"
            placeholder="Buscar por código, nombre, apellido, carnet, orden o análisis..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
            }
          />

          <select
            value={filtro}
            onChange={(e) =>
              setFiltro(
                e.target.value
              )
            }
          >
            <option value="todas">
              Todas las muestras
            </option>

            <option value="pendientes">
              Pendientes
            </option>

            <option value="aceptada">
              Aceptadas
            </option>

            <option value="rechazada">
              Rechazadas
            </option>
          </select>

          <button
            type="button"
            className="vm-actualizar"
            onClick={() =>
              cargarMuestras(false)
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

        {/* ===========================================
            TABLA
        =========================================== */}

        <div className="vm-tabla-contenedor">
          <table className="vm-tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Paciente</th>
                <th>Orden</th>
                <th>Análisis</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Procesamiento</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan="9"
                    className="vm-vacio"
                  >
                    Cargando muestras y pacientes...
                  </td>
                </tr>
              ) : muestrasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="vm-vacio"
                  >
                    No se encontraron muestras.
                  </td>
                </tr>
              ) : (
                muestrasFiltradas.map(
                  (muestra) => (
                    <tr key={muestra.id}>

                      {/* CÓDIGO */}

                      <td>
                        <strong>
                          {obtenerCodigoMuestra(
                            muestra
                          )}
                        </strong>
                      </td>

                      {/* PACIENTE */}

                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <strong
                            style={{
                              color: "#17365d",
                              fontWeight: 600,
                            }}
                          >
                            {
                              muestra.pacienteNombreCompleto
                            }
                          </strong>

                          {muestra.pacienteCarnet && (
                            <small
                              style={{
                                color: "#64748b",
                                fontSize: "12px",
                              }}
                            >
                              CI: {
                                muestra.pacienteCarnet
                              }
                            </small>
                          )}
                        </div>
                      </td>

                      {/* ORDEN */}

                      <td>
                        {muestra.ordenId || "-"}
                      </td>

                      {/* ANÁLISIS */}

                      <td>
                        {muestra.analisisNombre ||
                          muestra.analisisId ||
                          "-"}
                      </td>

                      {/* TIPO */}

                      <td>
                        {obtenerTipoMuestra(
                          muestra
                        )}
                      </td>

                      {/* FECHA */}

                      <td>
                        {formatearFecha(
                          muestra.fechaToma
                        )}
                      </td>

                      {/* ESTADO */}

                      <td>
                        <span
                          className={`vm-estado vm-${obtenerEstado(
                            muestra
                          )}`}
                        >
                          {obtenerEstado(
                            muestra
                          )}
                        </span>
                      </td>

                      {/* PROCESAMIENTO */}

                      <td>
                        {muestraPuedeProcesarse(
                          muestra
                        ) ? (
                          <span className="vm-permitido">
                            Apta para procesar
                          </span>
                        ) : (
                          <span className="vm-bloqueado">
                            No habilitada
                          </span>
                        )}
                      </td>

                      {/* ACCIONES */}

                      <td>
                        {pendienteValidacion(
                          muestra
                        ) && puedeValidar ? (
                          <div className="vm-acciones">
                            <button
                              type="button"
                              className="vm-aceptar"
                              disabled={
                                guardando ||
                                actualizando
                              }
                              onClick={() =>
                                aceptarMuestra(
                                  muestra
                                )
                              }
                            >
                              Aceptar
                            </button>

                            <button
                              type="button"
                              className="vm-rechazar"
                              disabled={
                                guardando ||
                                actualizando
                              }
                              onClick={() =>
                                abrirRechazo(
                                  muestra
                                )
                              }
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : obtenerEstado(
                            muestra
                          ) === "rechazada" ? (
                          <span
                            className="vm-motivo"
                            title={
                              muestra.motivoRechazo ||
                              ""
                            }
                          >
                            {muestra.motivoRechazo ||
                              "Muestra rechazada"}
                          </span>
                        ) : (
                          <span className="vm-sin-acciones">
                            Sin acciones
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =============================================
          MODAL DE RECHAZO
      ============================================= */}

      {muestraSeleccionada && (
        <div
          className="vm-modal-fondo"
          role="presentation"
          onMouseDown={(evento) => {
            if (
              !guardando &&
              evento.target ===
                evento.currentTarget
            ) {
              setMuestraSeleccionada(null);
              setMotivoRechazo("");
            }
          }}
        >
          <div
            className="vm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vm-modal-titulo"
          >
            <h2 id="vm-modal-titulo">
              Rechazar muestra
            </h2>

            <p>
              Código:{" "}
              <strong>
                {obtenerCodigoMuestra(
                  muestraSeleccionada
                )}
              </strong>
            </p>

            <p>
              Paciente:{" "}
              <strong>
                {
                  muestraSeleccionada
                    .pacienteNombreCompleto
                }
              </strong>
            </p>

            <label htmlFor="motivoRechazo">
              Motivo del rechazo *
            </label>

            <textarea
              id="motivoRechazo"
              rows={4}
              placeholder="Ejemplo: muestra insuficiente, contaminada o mal identificada..."
              value={motivoRechazo}
              disabled={guardando}
              onChange={(e) =>
                setMotivoRechazo(
                  e.target.value
                )
              }
            />

            <div className="vm-modal-acciones">
              <button
                type="button"
                className="vm-cancelar"
                disabled={guardando}
                onClick={() => {
                  setMuestraSeleccionada(null);
                  setMotivoRechazo("");
                  setError("");
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="vm-rechazar"
                disabled={
                  guardando ||
                  !motivoRechazo.trim()
                }
                onClick={
                  confirmarRechazo
                }
              >
                {guardando
                  ? "Guardando..."
                  : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}