import { useEffect, useMemo, useState } from "react";

import { obtenerPacientes } from "../services/pacientesService";

import {
  obtenerMuestras,
  obtenerOrdenesParaMuestras,
  registrarMuestra,
} from "../services/muestrasService";

import "./GestionMuestras.css";

function GestionMuestras({ usuario, onVolver }) {
  const laboratorioId = usuario?.laboratorioId || "";

  const bioquimicoId =
    usuario?.uid ||
    usuario?.id ||
    "";

  const [pacientes, setPacientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [muestras, setMuestras] = useState([]);

  const [ordenId, setOrdenId] = useState("");
  const [analisisId, setAnalisisId] = useState("");
  const [tipo, setTipo] = useState("");

  const [detalle, setDetalle] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const tiposMuestra = [
    "Sangre",
    "Suero",
    "Plasma",
    "Orina",
    "Heces",
    "Hisopado",
    "Otro",
  ];

  // -----------------------------------
  // FUNCIONES AUXILIARES
  // -----------------------------------

  const texto = (valor) => {
    return String(valor ?? "").trim();
  };

  const formatearFecha = (fecha) => {
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

      if (!isNaN(fechaConvertida.getTime())) {
        return fechaConvertida.toLocaleString("es-BO");
      }

      return "Sin fecha";
    } catch {
      return "Sin fecha";
    }
  };

  const obtenerNombrePaciente = (pacienteId) => {
    const paciente = pacientes.find(
      (item) =>
        texto(item.id) === texto(pacienteId) ||
        texto(item.pacienteId) === texto(pacienteId)
    );

    if (!paciente) {
      return pacienteId || "Paciente";
    }

    const nombre = [
      paciente.nombres || paciente.nombre,
      paciente.apellidos || paciente.apellido,
    ]
      .filter(Boolean)
      .join(" ");

    return nombre || "Paciente";
  };

  const obtenerCodigoMuestra = (muestra) => {
    return (
      muestra.codigoEtiqueta ||
      muestra.codigoMuestra ||
      muestra.muestraId ||
      muestra.id ||
      "Sin código"
    );
  };

  const obtenerTipoMuestra = (muestra) => {
    return (
      muestra.tipo ||
      muestra.tipoMuestra ||
      "Sin tipo"
    );
  };

  const obtenerNombreAnalisis = (muestra) => {
    if (muestra.analisisNombre) {
      return muestra.analisisNombre;
    }

    const orden = ordenes.find(
      (item) =>
        texto(item.id) === texto(muestra.ordenId) ||
        texto(item.ordenId) === texto(muestra.ordenId)
    );

    if (orden && Array.isArray(orden.analisis)) {
      const analisis = orden.analisis.find(
        (item) =>
          texto(item.analisisId || item.id) ===
          texto(muestra.analisisId)
      );

      if (analisis) {
        return analisis.nombre || "Análisis";
      }
    }

    return muestra.analisisId || "Análisis";
  };

  // -----------------------------------
  // CARGAR DATOS
  // -----------------------------------

  const cargarDatos = async () => {
    if (!laboratorioId) {
      setError(
        "El usuario no está asociado a un laboratorio."
      );

      setCargando(false);
      return;
    }

    try {
      setCargando(true);
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
    } catch (err) {
      console.error("Error cargando muestras:", err);

      setError(
        err?.message ||
          "No se pudo cargar la información."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [laboratorioId]);

  // -----------------------------------
  // VERIFICAR SI UN ANÁLISIS YA TIENE MUESTRA
  // -----------------------------------

  const tieneMuestraRegistrada = (
    orden,
    analisis
  ) => {
    const idOrden = texto(orden.id);
    const codigoOrden = texto(orden.ordenId);

    const idAnalisis = texto(
      analisis.analisisId || analisis.id
    );

    return muestras.some((muestra) => {
      const ordenCoincide =
        texto(muestra.ordenId) === idOrden ||
        texto(muestra.ordenId) === codigoOrden;

      const analisisCoincide =
        texto(muestra.analisisId) === idAnalisis;

      return ordenCoincide && analisisCoincide;
    });
  };

  // -----------------------------------
  // ANÁLISIS FALTANTES DE CADA ORDEN
  // -----------------------------------

  const obtenerAnalisisPendientes = (orden) => {
    if (!orden || !Array.isArray(orden.analisis)) {
      return [];
    }

    return orden.analisis.filter((analisis) => {
      const idAnalisis =
        analisis.analisisId || analisis.id;

      if (!idAnalisis) {
        return false;
      }

      return !tieneMuestraRegistrada(
        orden,
        analisis
      );
    });
  };

  // -----------------------------------
  // MOSTRAR SOLO ÓRDENES PENDIENTES
  // -----------------------------------

  const ordenesPendientes = useMemo(() => {
    return ordenes
      .filter((orden) => {
        return obtenerAnalisisPendientes(orden).length > 0;
      })
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
          { sensitivity: "base" }
        );
      });
  }, [ordenes, muestras, pacientes]);

  // -----------------------------------
  // ORDEN SELECCIONADA
  // -----------------------------------

  const ordenSeleccionada = useMemo(() => {
    return (
      ordenesPendientes.find(
        (orden) =>
          texto(orden.id) === texto(ordenId) ||
          texto(orden.ordenId) === texto(ordenId)
      ) || null
    );
  }, [ordenesPendientes, ordenId]);

  // -----------------------------------
  // SOLO ANÁLISIS FALTANTES
  // -----------------------------------

  const analisisDisponibles = useMemo(() => {
    if (!ordenSeleccionada) {
      return [];
    }

    return obtenerAnalisisPendientes(
      ordenSeleccionada
    );
  }, [ordenSeleccionada, muestras]);

  useEffect(() => {
    setAnalisisId("");
    setTipo("");
  }, [ordenId]);

  // Si una orden ya no tiene pendientes,
  // se elimina automáticamente de la selección.

  useEffect(() => {
    if (!ordenId) {
      return;
    }

    const siguePendiente = ordenesPendientes.some(
      (orden) =>
        texto(orden.id) === texto(ordenId) ||
        texto(orden.ordenId) === texto(ordenId)
    );

    if (!siguePendiente) {
      setOrdenId("");
      setAnalisisId("");
      setTipo("");
    }
  }, [ordenesPendientes, ordenId]);

  // -----------------------------------
  // TOTAL DE ANÁLISIS FALTANTES
  // -----------------------------------

  const totalPendientes = useMemo(() => {
    return ordenesPendientes.reduce(
      (total, orden) =>
        total +
        obtenerAnalisisPendientes(orden).length,
      0
    );
  }, [ordenesPendientes, muestras]);

  // -----------------------------------
  // REGISTRAR MUESTRA
  // -----------------------------------

  const registrar = async (evento) => {
    if (evento) {
      evento.preventDefault();
    }

    setError("");
    setMensaje("");

    if (!ordenSeleccionada) {
      setError("Debe seleccionar una orden.");
      return;
    }

    if (!analisisId) {
      setError("Debe seleccionar un análisis.");
      return;
    }

    if (!tipo) {
      setError("Debe seleccionar el tipo de muestra.");
      return;
    }

    if (!bioquimicoId) {
      setError(
        "No se pudo identificar al bioquímico."
      );
      return;
    }

    const analisisSeleccionado =
      analisisDisponibles.find(
        (analisis) =>
          texto(analisis.analisisId || analisis.id) ===
          texto(analisisId)
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

      setMensaje(
        "Muestra registrada correctamente."
      );

      setAnalisisId("");
      setTipo("");

      await cargarDatos();

      if (nuevaMuestra) {
        setDetalle(nuevaMuestra);
      }
    } catch (err) {
      console.error(
        "Error registrando muestra:",
        err
      );

      setError(
        err?.message ||
          "No se pudo registrar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  };

  // -----------------------------------
  // PANTALLA DE CARGA
  // -----------------------------------

  if (cargando && ordenes.length === 0 && muestras.length === 0) {
    return (
      <main className="gm-page">
        <section className="gm-card">
          <h2>Registro de muestras</h2>
          <p>Cargando información...</p>
        </section>
      </main>
    );
  }

  // -----------------------------------
  // PANTALLA PRINCIPAL
  // -----------------------------------

  return (
    <main className="gm-page">

      {/* ENCABEZADO */}

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
      </header>

      {/* MENSAJES */}

      {mensaje && (
        <div className="gm-message gm-success">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="gm-message gm-error">
          {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}

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

      {/* REGISTRAR MUESTRA */}

      <section className="gm-card">

        <div className="gm-card-head">
          <h2>Registrar toma de muestra</h2>

          <p>
            Selecciona una orden, un análisis
            pendiente y el tipo de muestra.
          </p>
        </div>

        {ordenesPendientes.length === 0 ? (
          <div className="gm-message gm-success">
            No existen órdenes con análisis
            pendientes de toma de muestra.
          </div>
        ) : (

          <form onSubmit={registrar}>

            <div className="gm-grid">

              {/* ORDEN */}

              <div className="gm-field">
                <label>
                  Orden
                </label>

                <select
                  value={ordenId}
                  onChange={(e) =>
                    setOrdenId(e.target.value)
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

              {/* PACIENTE */}

              {ordenSeleccionada && (
                <div className="gm-field">
                  <label>
                    Paciente
                  </label>

                  <input
                    type="text"
                    value={obtenerNombrePaciente(
                      ordenSeleccionada.pacienteId
                    )}
                    readOnly
                  />
                </div>
              )}

              {/* ANÁLISIS */}

              <div className="gm-field">
                <label>
                  Análisis pendiente
                </label>

                <select
                  value={analisisId}
                  onChange={(e) =>
                    setAnalisisId(e.target.value)
                  }
                  disabled={!ordenSeleccionada}
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

              {/* TIPO */}

              <div className="gm-field">
                <label>
                  Tipo de muestra
                </label>

                <select
                  value={tipo}
                  onChange={(e) =>
                    setTipo(e.target.value)
                  }
                  disabled={!analisisId}
                  required
                >
                  <option value="">
                    Seleccionar tipo
                  </option>

                  {tiposMuestra.map(
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

      {/* MUESTRAS REGISTRADAS */}

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
                key={muestra.id || muestra.muestraId}
                className="gm-item"
              >

                <div>
                  <h3>
                    {obtenerCodigoMuestra(muestra)}
                  </h3>

                  <p>
                    <strong>Paciente:</strong>{" "}
                    {obtenerNombrePaciente(
                      muestra.pacienteId
                    )}
                  </p>

                  <p>
                    <strong>Análisis:</strong>{" "}
                    {obtenerNombreAnalisis(muestra)}
                  </p>

                  <p>
                    <strong>Tipo:</strong>{" "}
                    {obtenerTipoMuestra(muestra)}
                  </p>

                  <p>
                    <strong>Estado:</strong>{" "}
                    {muestra.estado || "tomada"}
                  </p>

                  <p>
                    <strong>Fecha de toma:</strong>{" "}
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

      {/* MODAL DE DETALLE */}

      {detalle && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >

          <div
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

            <h2>
              Detalle de la muestra
            </h2>

            <p>
              <strong>Código:</strong>{" "}
              {obtenerCodigoMuestra(detalle)}
            </p>

            <p>
              <strong>Paciente:</strong>{" "}
              {obtenerNombrePaciente(
                detalle.pacienteId
              )}
            </p>

            <p>
              <strong>Análisis:</strong>{" "}
              {obtenerNombreAnalisis(detalle)}
            </p>

            <p>
              <strong>Tipo:</strong>{" "}
              {obtenerTipoMuestra(detalle)}
            </p>

            <p>
              <strong>Estado:</strong>{" "}
              {detalle.estado || "tomada"}
            </p>

            <p>
              <strong>Orden:</strong>{" "}
              {detalle.ordenId || "Sin orden"}
            </p>

            <p>
              <strong>Fecha de toma:</strong>{" "}
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