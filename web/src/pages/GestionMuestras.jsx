import { useCallback, useEffect, useMemo, useState } from "react";

import { obtenerPacientes } from "../services/pacientesService";

import {
  obtenerMuestras,
  obtenerOrdenesParaMuestras,
  registrarMuestra,
} from "../services/muestrasService";

import "./GestionMuestras.css";

const TIPOS_MUESTRA = [
  "Sangre",
  "Suero",
  "Plasma",
  "Orina",
  "Heces",
  "Hisopado",
  "Otro",
];

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "Sin fecha";
  }

  try {
    if (typeof fecha.toDate === "function") {
      return fecha.toDate().toLocaleString("es-BO");
    }

    if (typeof fecha.seconds === "number") {
      return new Date(
        fecha.seconds * 1000
      ).toLocaleString("es-BO");
    }

    if (fecha instanceof Date) {
      return fecha.toLocaleString("es-BO");
    }

    const fechaConvertida = new Date(fecha);

    if (!Number.isNaN(fechaConvertida.getTime())) {
      return fechaConvertida.toLocaleString("es-BO");
    }

    return "Sin fecha";
  } catch {
    return "Sin fecha";
  }
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
    "Sin tipo"
  );
}

function obtenerMensajeError(error) {
  const codigo = limpiarTexto(error?.code);

  if (codigo === "permission-denied") {
    return (
      "Firestore rechazó la operación. Verifica que el usuario " +
      "esté activo, tenga el rol correspondiente y pertenezca " +
      "al laboratorio seleccionado."
    );
  }

  if (codigo === "unavailable") {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
  }

  if (codigo === "unauthenticated") {
    return "Tu sesión ha expirado. Inicia sesión nuevamente.";
  }

  return (
    error?.message ||
    "Ocurrió un error al realizar la operación."
  );
}

function GestionMuestras({ usuario, onVolver }) {
  const laboratorioId = limpiarTexto(
    usuario?.laboratorioId
  );

  const bioquimicoId = limpiarTexto(
    usuario?.uid || usuario?.id
  );

  const rolUsuario = limpiarTexto(
    usuario?.rol
  ).toLowerCase();

  const puedeRegistrar = rolUsuario === "bioquimico";

  const [pacientes, setPacientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [muestras, setMuestras] = useState([]);

  const [ordenId, setOrdenId] = useState("");
  const [analisisId, setAnalisisId] = useState("");
  const [tipo, setTipo] = useState("");

  const [detalle, setDetalle] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const pacientesPorId = useMemo(() => {
    const mapa = new Map();

    pacientes.forEach((paciente) => {
      const id = limpiarTexto(
        paciente.id || paciente.pacienteId
      );

      const pacienteId = limpiarTexto(
        paciente.pacienteId
      );

      if (id) {
        mapa.set(id, paciente);
      }

      if (pacienteId) {
        mapa.set(pacienteId, paciente);
      }
    });

    return mapa;
  }, [pacientes]);

  const obtenerNombrePaciente = useCallback(
    (pacienteId) => {
      const id = limpiarTexto(pacienteId);

      const paciente = pacientesPorId.get(id);

      if (!paciente) {
        return id || "Paciente";
      }

      const nombre = [
        paciente.nombres || paciente.nombre,
        paciente.apellidos || paciente.apellido,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      return nombre || id || "Paciente";
    },
    [pacientesPorId]
  );

  const ordenesPorId = useMemo(() => {
    const mapa = new Map();

    ordenes.forEach((orden) => {
      const id = limpiarTexto(orden.id);
      const codigo = limpiarTexto(orden.ordenId);

      if (id) {
        mapa.set(id, orden);
      }

      if (codigo) {
        mapa.set(codigo, orden);
      }
    });

    return mapa;
  }, [ordenes]);

  const obtenerNombreAnalisis = useCallback(
    (muestra) => {
      if (muestra?.analisisNombre) {
        return muestra.analisisNombre;
      }

      const orden = ordenesPorId.get(
        limpiarTexto(muestra?.ordenId)
      );

      if (orden && Array.isArray(orden.analisis)) {
        const analisis = orden.analisis.find(
          (item) =>
            limpiarTexto(
              item.analisisId || item.id
            ) === limpiarTexto(muestra?.analisisId)
        );

        if (analisis) {
          return analisis.nombre || "Análisis";
        }
      }

      return muestra?.analisisId || "Análisis";
    },
    [ordenesPorId]
  );

  const cargarDatos = useCallback(
    async ({ mostrarCarga = true } = {}) => {
      if (!laboratorioId) {
        setError(
          "El usuario no está asociado a un laboratorio."
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

        const [
          pacientesResultado,
          ordenesResultado,
          muestrasResultado,
        ] = await Promise.all([
          obtenerPacientes(laboratorioId),
          obtenerOrdenesParaMuestras(laboratorioId),
          obtenerMuestras(laboratorioId),
        ]);

        setPacientes(
          Array.isArray(pacientesResultado)
            ? pacientesResultado
            : []
        );

        setOrdenes(
          Array.isArray(ordenesResultado)
            ? ordenesResultado
            : []
        );

        setMuestras(
          Array.isArray(muestrasResultado)
            ? muestrasResultado
            : []
        );

        return true;
      } catch (err) {
        console.error(
          "Error cargando gestión de muestras:",
          err
        );

        setError(obtenerMensajeError(err));

        return false;
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

  const muestrasRegistradas = useMemo(() => {
    const registros = new Set();

    muestras.forEach((muestra) => {
      const idOrden = limpiarTexto(
        muestra.ordenId
      );

      const idAnalisis = limpiarTexto(
        muestra.analisisId
      );

      if (idOrden && idAnalisis) {
        registros.add(
          `${idOrden}::${idAnalisis}`
        );
      }
    });

    return registros;
  }, [muestras]);

  const tieneMuestraRegistrada = useCallback(
    (orden, analisis) => {
      const idOrden = limpiarTexto(
        orden?.id
      );

      const codigoOrden = limpiarTexto(
        orden?.ordenId
      );

      const idAnalisis = limpiarTexto(
        analisis?.analisisId || analisis?.id
      );

      if (!idAnalisis) {
        return false;
      }

      return (
        muestrasRegistradas.has(
          `${idOrden}::${idAnalisis}`
        ) ||
        muestrasRegistradas.has(
          `${codigoOrden}::${idAnalisis}`
        )
      );
    },
    [muestrasRegistradas]
  );

  const obtenerAnalisisPendientes = useCallback(
    (orden) => {
      if (
        !orden ||
        !Array.isArray(orden.analisis)
      ) {
        return [];
      }

      return orden.analisis.filter((analisis) => {
        const idAnalisis = limpiarTexto(
          analisis.analisisId || analisis.id
        );

        if (!idAnalisis) {
          return false;
        }

        return !tieneMuestraRegistrada(
          orden,
          analisis
        );
      });
    },
    [tieneMuestraRegistrada]
  );

  const ordenesPendientes = useMemo(() => {
    return ordenes
      .filter(
        (orden) =>
          obtenerAnalisisPendientes(orden).length > 0
      )
      .sort((a, b) => {
        const nombreA = obtenerNombrePaciente(
          a.pacienteId
        );

        const nombreB = obtenerNombrePaciente(
          b.pacienteId
        );

        return nombreA.localeCompare(
          nombreB,
          "es",
          {
            sensitivity: "base",
          }
        );
      });
  }, [
    ordenes,
    obtenerAnalisisPendientes,
    obtenerNombrePaciente,
  ]);

  const ordenSeleccionada = useMemo(() => {
    return (
      ordenesPendientes.find(
        (orden) =>
          limpiarTexto(orden.id) ===
            limpiarTexto(ordenId) ||
          limpiarTexto(orden.ordenId) ===
            limpiarTexto(ordenId)
      ) || null
    );
  }, [ordenesPendientes, ordenId]);

  const analisisDisponibles = useMemo(() => {
    if (!ordenSeleccionada) {
      return [];
    }

    return obtenerAnalisisPendientes(
      ordenSeleccionada
    );
  }, [
    ordenSeleccionada,
    obtenerAnalisisPendientes,
  ]);

  useEffect(() => {
    setAnalisisId("");
    setTipo("");
  }, [ordenId]);

  useEffect(() => {
    if (!ordenId) {
      return;
    }

    const siguePendiente = ordenesPendientes.some(
      (orden) =>
        limpiarTexto(orden.id) ===
          limpiarTexto(ordenId) ||
        limpiarTexto(orden.ordenId) ===
          limpiarTexto(ordenId)
    );

    if (!siguePendiente) {
      setOrdenId("");
      setAnalisisId("");
      setTipo("");
    }
  }, [ordenesPendientes, ordenId]);

  const totalPendientes = useMemo(() => {
    return ordenesPendientes.reduce(
      (total, orden) =>
        total +
        obtenerAnalisisPendientes(orden).length,
      0
    );
  }, [
    ordenesPendientes,
    obtenerAnalisisPendientes,
  ]);

  const registrar = async (evento) => {
    evento?.preventDefault();

    if (guardando) {
      return;
    }

    setError("");
    setMensaje("");

    if (!puedeRegistrar) {
      setError(
        "Solo el Bioquímico puede registrar muestras."
      );
      return;
    }

    if (!laboratorioId) {
      setError(
        "No se pudo identificar el laboratorio."
      );
      return;
    }

    if (!bioquimicoId) {
      setError(
        "No se pudo identificar al Bioquímico."
      );
      return;
    }

    if (!ordenSeleccionada) {
      setError(
        "Debe seleccionar una orden."
      );
      return;
    }

    if (!analisisId) {
      setError(
        "Debe seleccionar un análisis."
      );
      return;
    }

    if (!tipo) {
      setError(
        "Debe seleccionar el tipo de muestra."
      );
      return;
    }

    const analisisSeleccionado =
      analisisDisponibles.find(
        (analisis) =>
          limpiarTexto(
            analisis.analisisId || analisis.id
          ) === limpiarTexto(analisisId)
      );

    if (!analisisSeleccionado) {
      setError(
        "Este análisis ya tiene una muestra registrada o no está disponible."
      );
      return;
    }

    try {
      setGuardando(true);

      const nuevaMuestra = await registrarMuestra({
        laboratorioId,
        bioquimicoId,
        ordenId: ordenSeleccionada.id,
        analisisId,
        tipo,
      });

      setAnalisisId("");
      setTipo("");

      const datosActualizados = await cargarDatos({
        mostrarCarga: false,
      });

      if (nuevaMuestra) {
        setDetalle(nuevaMuestra);
      }

      if (datosActualizados) {
        setMensaje(
          "Muestra registrada correctamente."
        );
      } else {
        setMensaje(
          "La muestra se registró, pero no se pudo actualizar el listado. Utiliza el botón Actualizar."
        );
      }
    } catch (err) {
      console.error(
        "Error registrando muestra:",
        err
      );

      setError(obtenerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  if (
    cargando &&
    ordenes.length === 0 &&
    muestras.length === 0
  ) {
    return (
      <main className="gm-page">
        <section className="gm-card">
          <h2>Registro de muestras</h2>
          <p>Cargando información...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="gm-page">
      <header className="gm-header">
        <div>
          {onVolver && (
            <button
              type="button"
              className="gm-back"
              onClick={onVolver}
            >
              ← Volver
            </button>
          )}

          <h1>Registro de muestras</h1>

          <p>
            Registra únicamente las muestras
            pendientes de cada orden.
          </p>
        </div>

        <button
          type="button"
          className="gm-btn-secondary"
          onClick={() =>
            cargarDatos({
              mostrarCarga: false,
            })
          }
          disabled={
            actualizando ||
            cargando ||
            guardando
          }
        >
          {actualizando
            ? "Actualizando..."
            : "Actualizar"}
        </button>
      </header>

      {mensaje && (
        <div
          className="gm-message gm-success"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          className="gm-message gm-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="gm-stats">
        <article>
          <span>ÓRDENES PENDIENTES</span>
          <strong>
            {ordenesPendientes.length}
          </strong>
        </article>

        <article>
          <span>MUESTRAS</span>
          <strong>
            {muestras.length}
          </strong>
        </article>

        <article>
          <span>ANÁLISIS PENDIENTES</span>
          <strong>
            {totalPendientes}
          </strong>
        </article>
      </section>

      <section className="gm-card">
        <div className="gm-card-head">
          <h2>Registrar toma de muestra</h2>

          <p>
            Selecciona una orden, un análisis
            pendiente y el tipo de muestra.
          </p>
        </div>

        {!puedeRegistrar && (
          <div
            className="gm-message gm-error"
            role="alert"
          >
            Tu usuario tiene acceso de consulta.
            El registro de muestras está
            reservado al Bioquímico.
          </div>
        )}

        {ordenesPendientes.length === 0 ? (
          <div className="gm-message gm-success">
            No existen órdenes con análisis
            pendientes de toma de muestra.
          </div>
        ) : (
          <form onSubmit={registrar}>
            <div className="gm-grid">
              <div className="gm-field">
                <label htmlFor="gm-orden">
                  Orden
                </label>

                <select
                  id="gm-orden"
                  value={ordenId}
                  onChange={(e) =>
                    setOrdenId(e.target.value)
                  }
                  disabled={
                    !puedeRegistrar ||
                    guardando ||
                    actualizando
                  }
                  required
                >
                  <option value="">
                    Seleccionar orden pendiente
                  </option>

                  {ordenesPendientes.map(
                    (orden) => (
                      <option
                        key={orden.id}
                        value={orden.id}
                      >
                        {orden.ordenId || orden.id}
                        {" - "}
                        {obtenerNombrePaciente(
                          orden.pacienteId
                        )}
                        {" ("}
                        {obtenerAnalisisPendientes(
                          orden
                        ).length}
                        {" pendiente/s)"}
                      </option>
                    )
                  )}
                </select>
              </div>

              {ordenSeleccionada && (
                <div className="gm-field">
                  <label htmlFor="gm-paciente">
                    Paciente
                  </label>

                  <input
                    id="gm-paciente"
                    type="text"
                    value={obtenerNombrePaciente(
                      ordenSeleccionada.pacienteId
                    )}
                    readOnly
                  />
                </div>
              )}

              <div className="gm-field">
                <label htmlFor="gm-analisis">
                  Análisis pendiente
                </label>

                <select
                  id="gm-analisis"
                  value={analisisId}
                  onChange={(e) =>
                    setAnalisisId(e.target.value)
                  }
                  disabled={
                    !puedeRegistrar ||
                    !ordenSeleccionada ||
                    guardando ||
                    actualizando
                  }
                  required
                >
                  <option value="">
                    Seleccionar análisis
                  </option>

                  {analisisDisponibles.map(
                    (analisis) => (
                      <option
                        key={
                          analisis.analisisId ||
                          analisis.id
                        }
                        value={
                          analisis.analisisId ||
                          analisis.id
                        }
                      >
                        {analisis.nombre}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="gm-field">
                <label htmlFor="gm-tipo">
                  Tipo de muestra
                </label>

                <select
                  id="gm-tipo"
                  value={tipo}
                  onChange={(e) =>
                    setTipo(e.target.value)
                  }
                  disabled={
                    !puedeRegistrar ||
                    !analisisId ||
                    guardando ||
                    actualizando
                  }
                  required
                >
                  <option value="">
                    Seleccionar tipo
                  </option>

                  {TIPOS_MUESTRA.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="gm-btn-primary"
              disabled={
                guardando ||
                actualizando ||
                !puedeRegistrar ||
                !ordenSeleccionada ||
                !analisisId ||
                !tipo
              }
            >
              {guardando
                ? "Registrando..."
                : "Registrar muestra"}
            </button>
          </form>
        )}
      </section>

      <section className="gm-card">
        <div className="gm-card-head">
          <h2>Muestras registradas</h2>

          <p>
            Historial de muestras tomadas
            en el laboratorio.
          </p>
        </div>

        {muestras.length === 0 ? (
          <p>
            Todavía no existen muestras registradas.
          </p>
        ) : (
          <div className="gm-list">
            {muestras.map((muestra) => (
              <article
                key={
                  muestra.id ||
                  muestra.muestraId
                }
                className="gm-item"
              >
                <div>
                  <h3>
                    {obtenerCodigoMuestra(
                      muestra
                    )}
                  </h3>

                  <p>
                    <strong>
                      Paciente:
                    </strong>{" "}
                    {obtenerNombrePaciente(
                      muestra.pacienteId
                    )}
                  </p>

                  <p>
                    <strong>
                      Análisis:
                    </strong>{" "}
                    {obtenerNombreAnalisis(
                      muestra
                    )}
                  </p>

                  <p>
                    <strong>
                      Tipo:
                    </strong>{" "}
                    {obtenerTipoMuestra(
                      muestra
                    )}
                  </p>

                  <p>
                    <strong>
                      Estado:
                    </strong>{" "}
                    {muestra.estado || "tomada"}
                  </p>

                  <p>
                    <strong>
                      Fecha de toma:
                    </strong>{" "}
                    {formatearFecha(
                      muestra.fechaToma
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="gm-btn-secondary"
                  onClick={() =>
                    setDetalle(muestra)
                  }
                >
                  Ver detalle
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {detalle && (
        <div
          role="presentation"
          onMouseDown={(evento) => {
            if (
              evento.target ===
              evento.currentTarget
            ) {
              setDetalle(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gm-detalle-titulo"
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 25,
              width: "100%",
              maxWidth: 550,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 id="gm-detalle-titulo">
              Detalle de la muestra
            </h2>

            <p>
              <strong>
                Código:
              </strong>{" "}
              {obtenerCodigoMuestra(
                detalle
              )}
            </p>

            <p>
              <strong>
                Paciente:
              </strong>{" "}
              {obtenerNombrePaciente(
                detalle.pacienteId
              )}
            </p>

            <p>
              <strong>
                Análisis:
              </strong>{" "}
              {obtenerNombreAnalisis(
                detalle
              )}
            </p>

            <p>
              <strong>
                Tipo:
              </strong>{" "}
              {obtenerTipoMuestra(
                detalle
              )}
            </p>

            <p>
              <strong>
                Estado:
              </strong>{" "}
              {detalle.estado || "tomada"}
            </p>

            <p>
              <strong>
                Orden:
              </strong>{" "}
              {detalle.ordenId || "Sin orden"}
            </p>

            <p>
              <strong>
                Fecha de toma:
              </strong>{" "}
              {formatearFecha(
                detalle.fechaToma
              )}
            </p>

            <button
              type="button"
              className="gm-btn-secondary"
              onClick={() =>
                setDetalle(null)
              }
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default GestionMuestras;