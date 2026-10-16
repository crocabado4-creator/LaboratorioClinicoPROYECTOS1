import React, { useEffect, useState, useCallback } from "react";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../firebase/firebase";

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

function mostrarFecha(valor) {
  if (!valor) {
    return "No registrada";
  }

  try {
    let fecha;

    if (typeof valor.toDate === "function") {
      fecha = valor.toDate();
    } else if (valor.seconds) {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor);
    }

    if (isNaN(fecha.getTime())) {
      return "No registrada";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "No registrada";
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

  const completo = `${nombre} ${apellido}`.trim();

  return completo || "Paciente no identificado";
}

function obtenerAnalisis(muestra) {
  return (
    muestra.analisisNombre ||
    muestra.nombreAnalisis ||
    muestra.analisis?.nombre ||
    "Análisis no identificado"
  );
}

function obtenerCodigo(muestra) {
  return (
    muestra.codigoEtiqueta ||
    muestra.codigoMuestra ||
    muestra.codigo ||
    muestra.id
  );
}

function obtenerTipo(muestra) {
  return (
    muestra.tipoMuestra ||
    muestra.tipo ||
    "No especificado"
  );
}

function mostrarEstado(estado) {
  const estados = {
    tomada: "Tomada",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    en_proceso: "En proceso",
    procesada: "Procesada",
  };

  return estados[estado] || estado || "Sin estado";
}

function colorEstado(estado) {
  switch (estado) {
    case "tomada":
      return "#D97706";

    case "aceptada":
      return "#2563EB";

    case "rechazada":
      return "#DC2626";

    case "en_proceso":
      return "#7C3AED";

    case "procesada":
      return "#059669";

    default:
      return "#64748B";
  }
}

// ======================================================
// ESTILOS
// ======================================================

const styles = {
  container: {
    padding: "24px",
    background: "#F4F7FB",
    minHeight: "100%",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "24px",
  },

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#19385F",
    margin: 0,
  },

  subtitle: {
    color: "#64748B",
    fontSize: "14px",
    marginTop: "10px",
  },

  stats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },

  statCard: {
    background: "#FFFFFF",
    border: "1px solid #DFE7F0",
    borderRadius: "12px",
    padding: "20px",
  },

  statLabel: {
    color: "#64748B",
    fontSize: "13px",
    marginBottom: "12px",
  },

  statValue: {
    color: "#19385F",
    fontSize: "28px",
    fontWeight: "bold",
  },

  section: {
    background: "#FFFFFF",
    border: "1px solid #DFE7F0",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "20px",
  },

  sectionTitle: {
    color: "#19385F",
    fontSize: "17px",
    fontWeight: "bold",
    marginTop: 0,
    marginBottom: "16px",
  },

  input: {
    width: "100%",
    padding: "14px",
    fontSize: "14px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
  },

  button: {
    background: "#2563EB",
    color: "#FFFFFF",
    border: "none",
    padding: "12px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "13px",
  },

  buttonDark: {
    background: "#19385F",
  },

  buttonGray: {
    background: "#64748B",
  },

  sampleCard: {
    border: "1px solid #DFE7F0",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "12px",
    background: "#FFFFFF",
  },

  sampleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },

  sampleTitle: {
    fontSize: "16px",
    color: "#19385F",
    fontWeight: "bold",
    margin: 0,
  },

  sampleText: {
    color: "#64748B",
    fontSize: "14px",
    margin: "10px 0",
    overflowWrap: "anywhere",
  },

  badge: {
    color: "#FFFFFF",
    padding: "7px 14px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },

  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "18px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: "15px",
    boxSizing: "border-box",
  },

  modal: {
    width: "100%",
    maxWidth: "720px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#FFFFFF",
    padding: "24px",
    borderRadius: "14px",
    boxSizing: "border-box",
  },

  modalTitle: {
    color: "#19385F",
    fontSize: "24px",
    marginTop: 0,
    marginBottom: "20px",
  },

  detailBox: {
    background: "#F1F5F9",
    padding: "20px",
    borderRadius: "12px",
    marginBottom: "16px",
  },

  detailSection: {
    border: "1px solid #DFE7F0",
    padding: "20px",
    borderRadius: "12px",
    marginBottom: "16px",
  },

  detailTitle: {
    color: "#19385F",
    fontSize: "18px",
    marginTop: 0,
  },

  detailText: {
    color: "#52637C",
    fontSize: "14px",
    lineHeight: "1.7",
    margin: "8px 0",
    overflowWrap: "anywhere",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "25px",
    flexWrap: "wrap",
  },
};

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function SeguimientoMuestras({
  onVolver,
  volver,
  onBack,
}) {
  // ====================================================
  // ESTADOS
  // ====================================================

  const [usuarioActual, setUsuarioActual] =
    useState(null);

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [muestras, setMuestras] = useState([]);

  const [pacientes, setPacientes] = useState({});

  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [procesandoId, setProcesandoId] =
    useState(null);

  const [muestraDetalle, setMuestraDetalle] =
    useState(null);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  // ====================================================
  // CARGAR DATOS
  // ====================================================

  const cargarDatos = useCallback(async (idLaboratorio) => {
    if (!idLaboratorio) {
      return;
    }

    const muestrasRef = collection(db, "muestras");

    const pacientesRef = collection(db, "pacientes");

    const consultaMuestras = query(
      muestrasRef,
      where("laboratorioId", "==", idLaboratorio)
    );

    const consultaPacientes = query(
      pacientesRef,
      where("laboratorioId", "==", idLaboratorio)
    );

    const [muestrasSnap, pacientesSnap] =
      await Promise.all([
        getDocs(consultaMuestras),
        getDocs(consultaPacientes),
      ]);

    const listaMuestras = muestrasSnap.docs.map(
      (documento) => ({
        id: documento.id,
        ...documento.data(),
      })
    );

    const mapaPacientes = {};

    pacientesSnap.docs.forEach((documento) => {
      mapaPacientes[documento.id] = {
        id: documento.id,
        ...documento.data(),
      };
    });

    listaMuestras.sort((a, b) => {
      const fechaA =
        a.fechaToma?.seconds ||
        a.fechaRegistro?.seconds ||
        0;

      const fechaB =
        b.fechaToma?.seconds ||
        b.fechaRegistro?.seconds ||
        0;

      return fechaB - fechaA;
    });

    setMuestras(listaMuestras);
    setPacientes(mapaPacientes);
  }, []);

  // ====================================================
  // IDENTIFICAR USUARIO
  // ====================================================

  useEffect(() => {
    const cancelar = onAuthStateChanged(
      auth,
      async (usuario) => {
        try {
          setCargando(true);
          setError("");

          if (!usuario) {
            throw new Error(
              "Debes iniciar sesión para consultar las muestras."
            );
          }

          const usuarioRef = doc(
            db,
            "usuarios",
            usuario.uid
          );

          const usuarioSnap = await getDoc(usuarioRef);

          if (!usuarioSnap.exists()) {
            throw new Error(
              "No se encontró el usuario en Firestore."
            );
          }

          const datosUsuario = usuarioSnap.data();

          if (datosUsuario.activo !== true) {
            throw new Error(
              "El usuario está inactivo."
            );
          }

          const idLaboratorio =
            datosUsuario.laboratorioId;

          if (!idLaboratorio) {
            throw new Error(
              "El usuario no tiene laboratorio asignado."
            );
          }

          setUsuarioActual(usuario);
          setLaboratorioId(idLaboratorio);

          await cargarDatos(idLaboratorio);
        } catch (e) {
          console.error(
            "Error cargando seguimiento:",
            e
          );

          setError(
            e.message ||
            "No se pudo cargar el seguimiento de muestras."
          );
        } finally {
          setCargando(false);
        }
      }
    );

    return () => cancelar();
  }, [cargarDatos]);

  // ====================================================
  // ACTUALIZAR MUESTRAS
  // ====================================================

  const actualizarMuestras = async () => {
    try {
      setActualizando(true);
      setError("");
      setMensaje("");

      await cargarDatos(laboratorioId);

      setMensaje(
        "Muestras actualizadas correctamente."
      );
    } catch (e) {
      console.error(e);

      setError(
        e.message ||
        "No se pudieron actualizar las muestras."
      );
    } finally {
      setActualizando(false);
    }
  };

  // ====================================================
  // VER DETALLE
  // ====================================================

  const verDetalle = async (muestra) => {
    try {
      setError("");

      const muestraRef = doc(
        db,
        "muestras",
        muestra.id
      );

      const muestraSnap = await getDoc(muestraRef);

      if (!muestraSnap.exists()) {
        throw new Error(
          "La muestra ya no existe."
        );
      }

      const datos = muestraSnap.data();

      if (datos.laboratorioId !== laboratorioId) {
        throw new Error(
          "La muestra no pertenece a tu laboratorio."
        );
      }

      setMuestraDetalle({
        id: muestraSnap.id,
        ...datos,
      });
    } catch (e) {
      console.error(e);

      setError(
        e.message ||
        "No se pudo consultar el detalle de la muestra."
      );
    }
  };

  // ====================================================
  // INICIAR PROCESO
  // ====================================================

  const iniciarProceso = async (muestra) => {
    if (procesandoId) {
      return;
    }

    try {
      setProcesandoId(muestra.id);
      setError("");
      setMensaje("");

      if (!usuarioActual) {
        throw new Error(
          "Debes iniciar sesión."
        );
      }

      const muestraRef = doc(
        db,
        "muestras",
        muestra.id
      );

      const muestraSnap = await getDoc(muestraRef);

      if (!muestraSnap.exists()) {
        throw new Error(
          "La muestra no existe."
        );
      }

      const datos = muestraSnap.data();

      if (datos.laboratorioId !== laboratorioId) {
        throw new Error(
          "No puedes modificar esta muestra."
        );
      }

      if (datos.estado !== "aceptada") {
        throw new Error(
          "Solo se puede iniciar el proceso de una muestra aceptada."
        );
      }

      await updateDoc(muestraRef, {
        estado: "en_proceso",

        aceptada: true,

        fechaInicioProcesamiento: serverTimestamp(),

        fechaActualizacion: serverTimestamp(),

        actualizadoPor: usuarioActual.uid,

        historialEstados: arrayUnion({
          estado: "en_proceso",
          fecha: new Date(),
          usuarioId: usuarioActual.uid,
        }),
      });

      await cargarDatos(laboratorioId);

      if (muestraDetalle?.id === muestra.id) {
        await verDetalle(muestra);
      }

      setMensaje(
        "El procesamiento de la muestra se inició correctamente."
      );
    } catch (e) {
      console.error(
        "Error iniciando proceso:",
        e
      );

      setError(
        e.message ||
        "No se pudo iniciar el procesamiento."
      );
    } finally {
      setProcesandoId(null);
    }
  };

  // ====================================================
  // FINALIZAR PROCESO
  // ====================================================

  const finalizarProceso = async (muestra) => {
    if (procesandoId) {
      return;
    }

    try {
      setProcesandoId(muestra.id);
      setError("");
      setMensaje("");

      if (!usuarioActual) {
        throw new Error(
          "Debes iniciar sesión."
        );
      }

      const muestraRef = doc(
        db,
        "muestras",
        muestra.id
      );

      const muestraSnap = await getDoc(muestraRef);

      if (!muestraSnap.exists()) {
        throw new Error(
          "La muestra no existe."
        );
      }

      const datos = muestraSnap.data();

      if (datos.laboratorioId !== laboratorioId) {
        throw new Error(
          "No puedes modificar esta muestra."
        );
      }

      if (datos.estado !== "en_proceso") {
        throw new Error(
          "Solo se puede finalizar una muestra en proceso."
        );
      }

      await updateDoc(muestraRef, {
        estado: "procesada",

        aceptada: true,

        fechaFinProcesamiento: serverTimestamp(),

        fechaActualizacion: serverTimestamp(),

        actualizadoPor: usuarioActual.uid,

        historialEstados: arrayUnion({
          estado: "procesada",
          fecha: new Date(),
          usuarioId: usuarioActual.uid,
        }),
      });

      await cargarDatos(laboratorioId);

      if (muestraDetalle?.id === muestra.id) {
        await verDetalle(muestra);
      }

      setMensaje(
        "La muestra fue procesada correctamente."
      );
    } catch (e) {
      console.error(
        "Error finalizando proceso:",
        e
      );

      setError(
        e.message ||
        "No se pudo finalizar el procesamiento."
      );
    } finally {
      setProcesandoId(null);
    }
  };

  // ====================================================
  // CONTADORES
  // ====================================================

  const total = muestras.length;

  const tomadas = muestras.filter(
    (muestra) => muestra.estado === "tomada"
  ).length;

  const aceptadas = muestras.filter(
    (muestra) => muestra.estado === "aceptada"
  ).length;

  const enProceso = muestras.filter(
    (muestra) => muestra.estado === "en_proceso"
  ).length;

  const procesadas = muestras.filter(
    (muestra) => muestra.estado === "procesada"
  ).length;

  // ====================================================
  // BUSCADOR
  // ====================================================

  const muestrasFiltradas = muestras.filter(
    (muestra) => {
      const paciente =
        pacientes[muestra.pacienteId];

      const contenido = [
        obtenerNombrePaciente(paciente),
        paciente?.ci,
        paciente?.carnet,
        obtenerAnalisis(muestra),
        obtenerCodigo(muestra),
        muestra.ordenId,
        muestra.solicitudId,
      ]
        .map(obtenerTexto)
        .join(" ")
        .toLowerCase();

      return contenido.includes(
        busqueda.trim().toLowerCase()
      );
    }
  );

  // ====================================================
  // BOTONES SEGÚN ESTADO
  // ====================================================

  const mostrarBotonProceso = (muestra) => {
    if (muestra.estado === "aceptada") {
      return (
        <button
          type="button"
          style={styles.button}
          disabled={procesandoId !== null}
          onClick={() => iniciarProceso(muestra)}
        >
          {procesandoId === muestra.id
            ? "Iniciando..."
            : "Iniciar proceso"}
        </button>
      );
    }

    if (muestra.estado === "en_proceso") {
      return (
        <button
          type="button"
          style={styles.button}
          disabled={procesandoId !== null}
          onClick={() => finalizarProceso(muestra)}
        >
          {procesandoId === muestra.id
            ? "Finalizando..."
            : "Finalizar proceso"}
        </button>
      );
    }

    return null;
  };

  // ====================================================
  // BOTÓN VOLVER
  // ====================================================

  const regresar = () => {
    if (typeof onVolver === "function") {
      onVolver();
      return;
    }

    if (typeof volver === "function") {
      volver();
      return;
    }

    if (typeof onBack === "function") {
      onBack();
      return;
    }

    window.history.back();
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div style={styles.container}>

      {/* ================================================
          ENCABEZADO
      ================================================ */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            Seguimiento de muestras
          </h1>

          <p style={styles.subtitle}>
            Consulta el estado y controla el procesamiento
            de las muestras.
          </p>
        </div>

        <button
          type="button"
          style={{
            ...styles.button,
            ...styles.buttonGray,
          }}
          onClick={regresar}
        >
          Volver
        </button>
      </div>

      {/* ================================================
          MENSAJES
      ================================================ */}

      {error && (
        <div
          style={{
            padding: "14px",
            marginBottom: "18px",
            borderRadius: "8px",
            background: "#FEE2E2",
            color: "#991B1B",
          }}
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          style={{
            padding: "14px",
            marginBottom: "18px",
            borderRadius: "8px",
            background: "#DCFCE7",
            color: "#166534",
          }}
        >
          {mensaje}
        </div>
      )}

      {/* ================================================
          CONTADORES
      ================================================ */}

      <div style={styles.stats}>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            Total
          </div>

          <div style={styles.statValue}>
            {total}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            Tomadas
          </div>

          <div style={styles.statValue}>
            {tomadas}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            Aceptadas
          </div>

          <div style={styles.statValue}>
            {aceptadas}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            En proceso
          </div>

          <div style={styles.statValue}>
            {enProceso}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            Procesadas
          </div>

          <div style={styles.statValue}>
            {procesadas}
          </div>
        </div>

      </div>

      {/* ================================================
          BUSCADOR
      ================================================ */}

      <div style={styles.section}>

        <h3 style={styles.sectionTitle}>
          Buscar muestra
        </h3>

        <input
          type="text"
          style={styles.input}
          placeholder="Paciente, CI, análisis o código"
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
        />

        <button
          type="button"
          style={{
            ...styles.button,
            marginTop: "12px",
          }}
          onClick={actualizarMuestras}
          disabled={actualizando}
        >
          {actualizando
            ? "Actualizando..."
            : "Actualizar"}
        </button>

      </div>

      {/* ================================================
          MUESTRAS REGISTRADAS
      ================================================ */}

      <div style={styles.section}>

        <h3 style={styles.sectionTitle}>
          Muestras registradas
        </h3>

        {cargando ? (
          <p>Cargando muestras...</p>
        ) : muestrasFiltradas.length === 0 ? (
          <p style={{ color: "#64748B" }}>
            No se encontraron muestras registradas.
          </p>
        ) : (
          muestrasFiltradas.map((muestra) => {
            const paciente =
              pacientes[muestra.pacienteId];

            return (
              <div
                key={muestra.id}
                style={styles.sampleCard}
              >

                {/* TÍTULO Y ESTADO */}

                <div style={styles.sampleHeader}>

                  <h3 style={styles.sampleTitle}>
                    {obtenerAnalisis(muestra)}
                  </h3>

                  <span
                    style={{
                      ...styles.badge,
                      background: colorEstado(
                        muestra.estado
                      ),
                    }}
                  >
                    {mostrarEstado(muestra.estado)}
                  </span>

                </div>

                {/* INFORMACIÓN */}

                <p style={styles.sampleText}>
                  Código: {obtenerCodigo(muestra)}
                </p>

                <p style={styles.sampleText}>
                  Paciente:{" "}
                  {obtenerNombrePaciente(paciente)}
                </p>

                <p style={styles.sampleText}>
                  CI:{" "}
                  {paciente?.ci ||
                    paciente?.carnet ||
                    "No registrado"}
                </p>

                <p style={styles.sampleText}>
                  Tipo: {obtenerTipo(muestra)}
                </p>

                <p style={styles.sampleText}>
                  Orden: {muestra.ordenId || "-"}
                </p>

                <p style={styles.sampleText}>
                  Fecha de toma:{" "}
                  {mostrarFecha(muestra.fechaToma)}
                </p>

                {/* BOTONES */}

                <div style={styles.actions}>

                  <button
                    type="button"
                    style={{
                      ...styles.button,
                      ...styles.buttonDark,
                    }}
                    onClick={() => verDetalle(muestra)}
                  >
                    Ver detalle
                  </button>

                  {mostrarBotonProceso(muestra)}

                </div>

              </div>
            );
          })
        )}

      </div>

      {/* ================================================
          MODAL DETALLE DE MUESTRA
      ================================================ */}

      {muestraDetalle && (
        <div
          style={styles.modalOverlay}
          onClick={() => setMuestraDetalle(null)}
        >
          <div
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >

            <h2 style={styles.modalTitle}>
              Detalle de la muestra
            </h2>

            {/* DATOS DEL PACIENTE */}

            <div style={styles.detailBox}>

              <h3
                style={{
                  ...styles.detailTitle,
                  marginBottom: "8px",
                }}
              >
                {obtenerAnalisis(muestraDetalle)}
              </h3>

              <p style={styles.detailText}>
                Paciente:{" "}
                {obtenerNombrePaciente(
                  pacientes[muestraDetalle.pacienteId]
                )}
              </p>

              <p style={styles.detailText}>
                CI:{" "}
                {pacientes[muestraDetalle.pacienteId]
                  ?.ci ||
                  pacientes[muestraDetalle.pacienteId]
                    ?.carnet ||
                  "No registrado"}
              </p>

              <p style={styles.detailText}>
                Estado:{" "}
                {mostrarEstado(muestraDetalle.estado)}
              </p>

            </div>

            {/* INFORMACIÓN DE LA MUESTRA */}

            <div style={styles.detailSection}>

              <h3 style={styles.detailTitle}>
                Información de la muestra
              </h3>

              <p style={styles.detailText}>
                Código: {obtenerCodigo(muestraDetalle)}
              </p>

              <p style={styles.detailText}>
                ID de muestra: {muestraDetalle.id}
              </p>

              <p style={styles.detailText}>
                Orden: {muestraDetalle.ordenId || "-"}
              </p>

              <p style={styles.detailText}>
                Solicitud:{" "}
                {muestraDetalle.solicitudId || "-"}
              </p>

              <p style={styles.detailText}>
                Tipo de muestra:{" "}
                {obtenerTipo(muestraDetalle)}
              </p>

              <p style={styles.detailText}>
                Aceptada:{" "}
                {muestraDetalle.aceptada === true ||
                [
                  "aceptada",
                  "en_proceso",
                  "procesada",
                ].includes(muestraDetalle.estado)
                  ? "Sí"
                  : "No"}
              </p>

              {muestraDetalle.motivoRechazo && (
                <p style={styles.detailText}>
                  Motivo de rechazo:{" "}
                  {muestraDetalle.motivoRechazo}
                </p>
              )}

            </div>

            {/* SEGUIMIENTO DEL PROCESAMIENTO */}

            <div style={styles.detailSection}>

              <h3 style={styles.detailTitle}>
                Seguimiento del procesamiento
              </h3>

              <p style={styles.detailText}>
                Fecha de toma:{" "}
                {mostrarFecha(
                  muestraDetalle.fechaToma
                )}
              </p>

              <p style={styles.detailText}>
                Fecha de validación:{" "}
                {mostrarFecha(
                  muestraDetalle.fechaValidacion
                )}
              </p>

              <p style={styles.detailText}>
                Inicio del proceso:{" "}
                {mostrarFecha(
                  muestraDetalle.fechaInicioProcesamiento
                )}
              </p>

              <p style={styles.detailText}>
                Fin del proceso:{" "}
                {mostrarFecha(
                  muestraDetalle.fechaFinProcesamiento
                )}
              </p>

            </div>

            {/* BOTONES DEL MODAL */}

            <div style={styles.modalActions}>

              <button
                type="button"
                style={{
                  ...styles.button,
                  ...styles.buttonGray,
                }}
                onClick={() => setMuestraDetalle(null)}
              >
                Cerrar
              </button>

              <button
                type="button"
                style={styles.button}
                onClick={() =>
                  verDetalle(muestraDetalle)
                }
              >
                Actualizar detalle
              </button>

              {mostrarBotonProceso(muestraDetalle)}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}