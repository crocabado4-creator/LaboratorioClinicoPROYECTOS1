import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  escucharNotificacionesRecepcion,
  solicitarNuevaToma,
} from "../services/notificacionesRecepcionService";

// ======================================================
// FORMATEAR FECHA
// ======================================================

function mostrarFecha(fecha) {
  if (!fecha) {
    return "Sin fecha";
  }

  let fechaFinal;

  if (typeof fecha.toDate === "function") {
    fechaFinal = fecha.toDate();
  } else if (
    typeof fecha.seconds === "number"
  ) {
    fechaFinal = new Date(
      fecha.seconds * 1000
    );
  } else {
    fechaFinal = new Date(fecha);
  }

  if (
    Number.isNaN(fechaFinal.getTime())
  ) {
    return "Sin fecha";
  }

  return fechaFinal.toLocaleString(
    "es-BO"
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function NotificacionesRecepcion({
  laboratorioId,
  usuarioId,
}) {
  const [notificaciones, setNotificaciones] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [filtro, setFiltro] =
    useState("todas");

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  const [procesando, setProcesando] =
    useState("");

  // ====================================================
  // CARGAR DATOS
  // ====================================================

  useEffect(() => {
    if (!laboratorioId || !usuarioId) {
      setError(
        "No se identificó el laboratorio o usuario."
      );

      setCargando(false);

      return;
    }

    setCargando(true);
    setError("");

    const cancelar =
      escucharNotificacionesRecepcion(
        laboratorioId,

        usuarioId,

        (datos) => {
          setNotificaciones(datos);
          setCargando(false);
          setError("");
        },

        (errorFirebase) => {
          console.error(errorFirebase);

          setError(
            errorFirebase.message ||
            "Error consultando Firestore."
          );

          setCargando(false);
        }
      );

    return () => cancelar();
  }, [laboratorioId, usuarioId]);

  // ====================================================
  // CONTADORES
  // ====================================================

  const pendientes = useMemo(
    () =>
      notificaciones.filter(
        (item) =>
          item.tipo === "muestra_pendiente"
      ),
    [notificaciones]
  );

  const rechazadas = useMemo(
    () =>
      notificaciones.filter(
        (item) =>
          item.tipo === "muestra_rechazada"
      ),
    [notificaciones]
  );

  const procesadas = useMemo(
    () =>
      notificaciones.filter(
        (item) =>
          item.tipo === "muestra_procesada"
      ),
    [notificaciones]
  );

  const nuevasTomasPendientes = useMemo(
    () =>
      rechazadas.filter(
        (item) =>
          item.solicitudNuevaToma !== null
      ),
    [rechazadas]
  );

  // ====================================================
  // BUSCADOR Y FILTROS
  // ====================================================

  const listaFiltrada = useMemo(() => {
    let lista = [...notificaciones];

    if (filtro === "pendientes") {
      lista = pendientes;
    }

    if (filtro === "rechazadas") {
      lista = rechazadas;
    }

    if (filtro === "procesadas") {
      lista = procesadas;
    }

    if (filtro === "nuevas_tomas") {
      lista = nuevasTomasPendientes;
    }

    const palabra = busqueda
      .trim()
      .toLowerCase();

    if (palabra) {
      lista = lista.filter((item) => {
        const contenido = [
          item.nombrePaciente,
          item.ciPaciente,
          item.nombreAnalisis,
          item.codigoMuestra,
          item.motivoRechazo,
          item.estadoMuestra,
          item.titulo,
        ]
          .join(" ")
          .toLowerCase();

        return contenido.includes(palabra);
      });
    }

    return lista;
  }, [
    notificaciones,
    pendientes,
    rechazadas,
    procesadas,
    nuevasTomasPendientes,
    filtro,
    busqueda,
  ]);

  // ====================================================
  // SOLICITAR NUEVA TOMA
  // ====================================================

  async function reanudarMuestra(muestra) {
    if (muestra.solicitudNuevaToma) {
      setError(
        "Ya existe una solicitud de nueva toma para esta muestra."
      );

      return;
    }

    const confirmar = window.confirm(
      `¿Solicitar una nueva toma para ${muestra.nombrePaciente}?\n\n` +
      `Análisis: ${muestra.nombreAnalisis}\n` +
      `Motivo: ${muestra.motivoRechazo}`
    );

    if (!confirmar) return;

    try {
      setProcesando(muestra.id);

      setError("");
      setMensaje("");

      await solicitarNuevaToma(muestra);

      setMensaje(
        "Nueva toma solicitada correctamente. " +
        "El Bioquímico deberá registrar la nueva muestra."
      );
    } catch (errorFirebase) {
      console.error(errorFirebase);

      setError(
        errorFirebase.message ||
        "No se pudo solicitar la nueva toma."
      );
    } finally {
      setProcesando("");
    }
  }

  // ====================================================
  // ESTILOS
  // ====================================================

  const estilos = {
    principal: {
      background: "#ffffff",
      padding: "30px",
      borderRadius: "18px",
      fontFamily: "Arial, sans-serif",
    },

    titulo: {
      fontSize: "28px",
      color: "#1e293b",
      marginBottom: "10px",
    },

    descripcion: {
      color: "#64748b",
      fontSize: "15px",
    },

    resumen: {
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "15px",
      marginTop: "25px",
      marginBottom: "25px",
    },

    resumenTarjeta: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "20px",
    },

    buscador: {
      width: "100%",
      boxSizing: "border-box",
      padding: "14px",
      fontSize: "15px",
      border: "1px solid #cbd5e1",
      borderRadius: "10px",
      marginBottom: "18px",
    },

    filtros: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
      marginBottom: "25px",
    },

    botonFiltro: {
      padding: "10px 15px",
      border: "1px solid #cbd5e1",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "bold",
    },

    tarjeta: {
      borderRadius: "12px",
      padding: "22px",
      marginBottom: "15px",
    },

    botonReanudar: {
      background: "#2563eb",
      color: "#ffffff",
      padding: "12px 20px",
      border: "none",
      borderRadius: "9px",
      cursor: "pointer",
      fontWeight: "bold",
      marginTop: "12px",
    },
  };

  // ====================================================
  // TARJETA DE RESUMEN
  // ====================================================

  function TarjetaResumen({
    titulo,
    cantidad,
    color,
  }) {
    return (
      <div style={estilos.resumenTarjeta}>
        <p style={{ color: "#64748b" }}>
          {titulo}
        </p>

        <h2
          style={{
            fontSize: "32px",
            color,
            marginBottom: 0,
          }}
        >
          {cantidad}
        </h2>
      </div>
    );
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div style={estilos.principal}>

      {/* TÍTULO */}

      <h2 style={estilos.titulo}>
        🔔 Notificaciones de Recepción
      </h2>

      <p style={estilos.descripcion}>
        Seguimiento de muestras, pacientes,
        análisis clínicos y nuevas tomas.
      </p>

      {/* RESUMEN */}

      <div style={estilos.resumen}>

        <TarjetaResumen
          titulo="Pendientes"
          cantidad={pendientes.length}
          color="#2563eb"
        />

        <TarjetaResumen
          titulo="Rechazadas"
          cantidad={rechazadas.length}
          color="#dc2626"
        />

        <TarjetaResumen
          titulo="Procesadas"
          cantidad={procesadas.length}
          color="#16a34a"
        />

        <TarjetaResumen
          titulo="Nuevas tomas solicitadas"
          cantidad={nuevasTomasPendientes.length}
          color="#9333ea"
        />

      </div>

      {/* BUSCADOR */}

      <input
        type="text"
        placeholder={
          "Buscar por nombre, apellido, CI, " +
          "análisis, código o motivo..."
        }
        value={busqueda}
        onChange={(e) =>
          setBusqueda(e.target.value)
        }
        style={estilos.buscador}
      />

      {/* FILTROS */}

      <div style={estilos.filtros}>

        {[
          ["todas", "Todas"],
          ["pendientes", "Pendientes"],
          ["rechazadas", "Rechazadas"],
          ["procesadas", "Procesadas"],
          ["nuevas_tomas", "Nuevas tomas"],
        ].map(([valor, nombre]) => (

          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            style={{
              ...estilos.botonFiltro,

              background:
                filtro === valor
                  ? "#2563eb"
                  : "#ffffff",

              color:
                filtro === valor
                  ? "#ffffff"
                  : "#334155",
            }}
          >
            {nombre}
          </button>

        ))}

      </div>

      {/* MENSAJE CORRECTO */}

      {mensaje && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "15px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          {mensaje}
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "15px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* CARGANDO */}

      {cargando && (
        <p>Cargando muestras...</p>
      )}

      {/* SIN RESULTADOS */}

      {!cargando &&
        !error &&
        listaFiltrada.length === 0 && (

          <div
            style={{
              background: "#f8fafc",
              padding: "35px",
              textAlign: "center",
              borderRadius: "12px",
            }}
          >
            <h3>No se encontraron registros</h3>

            <p>
              Intenta utilizar otro filtro
              o término de búsqueda.
            </p>
          </div>

        )}

      {/* LISTA */}

      {!cargando &&
        listaFiltrada.map((item) => {

          const rechazada =
            item.tipo === "muestra_rechazada";

          const procesada =
            item.tipo === "muestra_procesada";

          const color = rechazada
            ? "#dc2626"
            : procesada
            ? "#16a34a"
            : "#2563eb";

          const fondo = rechazada
            ? "#fff1f2"
            : procesada
            ? "#f0fdf4"
            : "#eff6ff";

          return (
            <div
              key={item.id}
              style={{
                ...estilos.tarjeta,
                background: fondo,
                border: `1px solid ${color}`,
              }}
            >

              {/* TÍTULO */}

              <h3
                style={{
                  color,
                  marginTop: 0,
                }}
              >
                {rechazada
                  ? "⚠️ "
                  : procesada
                  ? "✅ "
                  : "📋 "}

                {item.titulo}
              </h3>

              {/* DATOS DEL PACIENTE */}

              <div
                style={{
                  background: "#ffffff",
                  padding: "15px",
                  borderRadius: "9px",
                  marginBottom: "15px",
                }}
              >
                <p>
                  <strong>Paciente:</strong>{" "}
                  {item.nombrePaciente}
                </p>

                <p>
                  <strong>CI:</strong>{" "}
                  {item.ciPaciente || "No registrado"}
                </p>

                <p>
                  <strong>Análisis clínico:</strong>{" "}
                  {item.nombreAnalisis}
                </p>

                <p>
                  <strong>Código de muestra:</strong>{" "}
                  {item.codigoMuestra}
                </p>

                <p>
                  <strong>Fecha:</strong>{" "}
                  {mostrarFecha(
                    item.fechaCreacion
                  )}
                </p>
              </div>

              {/* MENSAJE */}

              <p
                style={{
                  color: "#334155",
                  lineHeight: "1.7",
                }}
              >
                {item.mensaje}
              </p>

              {/* MUESTRA RECHAZADA */}

              {rechazada && (
                <div
                  style={{
                    background: "#ffffff",
                    padding: "15px",
                    borderRadius: "9px",
                    color: "#991b1b",
                  }}
                >
                  <p>
                    <strong>
                      Motivo del rechazo:
                    </strong>{" "}
                    {item.motivoRechazo ||
                      "No especificado"}
                  </p>

                  <p>
                    <strong>
                      Nueva toma requerida
                    </strong>
                  </p>

                  <p>
                    Recepción debe contactar
                    al paciente y coordinar
                    una nueva muestra.
                  </p>

                  {item.solicitudNuevaToma ? (

                    <div
                      style={{
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "12px",
                        borderRadius: "8px",
                      }}
                    >
                      Nueva toma solicitada.
                      Pendiente de atención
                      por el Bioquímico.
                    </div>

                  ) : (

                    <button
                      type="button"

                      disabled={
                        procesando === item.id
                      }

                      onClick={() =>
                        reanudarMuestra(item)
                      }

                      style={{
                        ...estilos.botonReanudar,

                        opacity:
                          procesando === item.id
                            ? 0.6
                            : 1,
                      }}
                    >
                      {procesando === item.id
                        ? "Solicitando..."
                        : "Reanudar muestra / Nueva toma"}
                    </button>

                  )}
                </div>
              )}

              {/* PROCESADA */}

              {procesada && (
                <div
                  style={{
                    background: "#ffffff",
                    padding: "15px",
                    borderRadius: "9px",
                    color: "#166534",
                  }}
                >
                  <strong>
                    Procesamiento finalizado correctamente.
                  </strong>
                </div>
              )}

            </div>
          );
        })}

    </div>
  );
}