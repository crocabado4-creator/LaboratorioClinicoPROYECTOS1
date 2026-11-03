import {
  useEffect,
  useState,
} from "react";

import {
  escucharNuevasTomas,
  obtenerDatosNuevaToma,
  registrarNuevaToma,
} from "../services/nuevasTomasService";

export default function NuevasTomasBioquimico({
  laboratorioId,
}) {
  const [solicitudes, setSolicitudes] =
    useState([]);

  const [seleccionada, setSeleccionada] =
    useState("");

  const [tipoMuestra, setTipoMuestra] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  // ===================================================
  // CARGAR SOLICITUDES
  // ===================================================

  useEffect(() => {
    if (!laboratorioId) {
      setCargando(false);

      setError(
        "No se identificó el laboratorio."
      );

      return;
    }

    let activo = true;

    const cancelar = escucharNuevasTomas(
      laboratorioId,

      async (datos) => {
        try {
          const completas = await Promise.all(
            datos.map(obtenerDatosNuevaToma)
          );

          if (!activo) return;

          setSolicitudes(completas);
          setCargando(false);
          setError("");
        } catch (errorFirebase) {
          if (!activo) return;

          setError(errorFirebase.message);
          setCargando(false);
        }
      },

      (errorFirebase) => {
        if (!activo) return;

        setError(errorFirebase.message);
        setCargando(false);
      }
    );

    return () => {
      activo = false;
      cancelar();
    };
  }, [laboratorioId]);

  // ===================================================
  // SOLICITUD SELECCIONADA
  // ===================================================

  const solicitudActual = solicitudes.find(
    (item) => item.id === seleccionada
  );

  // ===================================================
  // REGISTRAR
  // ===================================================

  async function guardarMuestra(evento) {
    evento.preventDefault();

    if (!solicitudActual) {
      setError(
        "Selecciona una solicitud."
      );

      return;
    }

    if (!tipoMuestra) {
      setError(
        "Selecciona el tipo de muestra."
      );

      return;
    }

    const confirmar = window.confirm(
      `¿Registrar nueva muestra para ${solicitudActual.nombrePaciente}?\n\n` +
      `Análisis: ${solicitudActual.nombreAnalisis}`
    );

    if (!confirmar) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await registrarNuevaToma(
        solicitudActual,
        tipoMuestra
      );

      setMensaje(
        `Nueva muestra registrada correctamente. Código: ${resultado.codigo}`
      );

      setSeleccionada("");
      setTipoMuestra("");
    } catch (errorFirebase) {
      console.error(errorFirebase);

      setError(
        errorFirebase.message ||
        "No se pudo registrar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <div
      style={{
        padding: "25px",
        background: "#ffffff",
        borderRadius: "16px",
      }}
    >
      <h2>
        Nuevas tomas solicitadas
      </h2>

      <p>
        Registra las muestras que Recepción
        solicitó repetir después de un rechazo.
      </p>

      <div
        style={{
          background: "#eff6ff",
          padding: "18px",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <strong>
          Solicitudes pendientes: {solicitudes.length}
        </strong>
      </div>

      {cargando && (
        <p>Cargando solicitudes...</p>
      )}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "15px",
          }}
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "15px",
          }}
        >
          {mensaje}
        </div>
      )}

      {!cargando &&
        solicitudes.length === 0 && (
          <p>
            No existen solicitudes de nueva toma pendientes.
          </p>
        )}

      <form onSubmit={guardarMuestra}>

        <label>
          <strong>
            Seleccionar paciente
          </strong>
        </label>

        <select
          value={seleccionada}
          onChange={(evento) => {
            setSeleccionada(evento.target.value);
            setTipoMuestra("");
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        >
          <option value="">
            Seleccionar solicitud pendiente
          </option>

          {solicitudes.map((solicitud) => (
            <option
              key={solicitud.id}
              value={solicitud.id}
            >
              {solicitud.nombrePaciente}
              {" - "}
              {solicitud.nombreAnalisis}
            </option>
          ))}
        </select>

        {solicitudActual && (
          <div
            style={{
              background: "#f8fafc",
              padding: "20px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            <h3>
              Información del paciente
            </h3>

            <p>
              <strong>Paciente:</strong>{" "}
              {solicitudActual.nombrePaciente}
            </p>

            <p>
              <strong>CI:</strong>{" "}
              {solicitudActual.ciPaciente}
            </p>

            <p>
              <strong>Análisis:</strong>{" "}
              {solicitudActual.nombreAnalisis}
            </p>

            <p>
              <strong>Motivo del rechazo:</strong>{" "}
              {solicitudActual.motivoRechazo}
            </p>

            <p>
              <strong>Muestra original:</strong>{" "}
              {solicitudActual.codigoMuestra}
            </p>
          </div>
        )}

        <label>
          <strong>
            Tipo de muestra
          </strong>
        </label>

        <select
          value={tipoMuestra}
          onChange={(evento) =>
            setTipoMuestra(evento.target.value)
          }
          disabled={!solicitudActual}
          style={{
            display: "block",
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        >
          <option value="">
            Seleccionar tipo
          </option>

          <option value="Sangre">
            Sangre
          </option>

          <option value="Orina">
            Orina
          </option>

          <option value="Heces">
            Heces
          </option>

          <option value="Saliva">
            Saliva
          </option>

          <option value="Hisopado">
            Hisopado
          </option>

          <option value="Otro">
            Otro
          </option>
        </select>

        <button
          type="submit"
          disabled={
            guardando ||
            !solicitudActual ||
            !tipoMuestra
          }
          style={{
            width: "100%",
            background: "#2563eb",
            color: "#ffffff",
            padding: "14px",
            border: "none",
            borderRadius: "10px",
            fontWeight: "bold",
            cursor: "pointer",
            opacity:
              guardando ||
              !solicitudActual ||
              !tipoMuestra
                ? 0.5
                : 1,
          }}
        >
          {guardando
            ? "Registrando..."
            : "Registrar nueva muestra"}
        </button>

      </form>
    </div>
  );
}