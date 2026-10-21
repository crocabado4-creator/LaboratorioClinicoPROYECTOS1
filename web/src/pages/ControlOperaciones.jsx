import {
  useEffect,
  useState,
} from "react";

import {
  listarAuditoriaLaboratorio,
  listarNotificacionesLaboratorio,
  marcarNotificacionLeida,
} from "../services/adminSprint3Service";

import "./Sprint3.css";

function fechaVisible(valor) {
  if (!valor) {
    return "-";
  }

  const fecha =
    typeof valor?.toDate ===
    "function"
      ? valor.toDate()
      : typeof valor?.seconds ===
          "number"
        ? new Date(
            valor.seconds *
              1000
          )
        : new Date(valor);

  return Number.isNaN(
    fecha.getTime()
  )
    ? "-"
    : fecha.toLocaleString(
        "es-BO"
      );
}

export default function ControlOperaciones({
  usuario,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const [
    seccion,
    setSeccion,
  ] = useState(
    "notificaciones"
  );

  const [
    notificaciones,
    setNotificaciones,
  ] = useState([]);

  const [
    auditoria,
    setAuditoria,
  ] = useState([]);

  const [
    error,
    setError,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const cargar = async () => {
    try {
      setCargando(true);
      setError("");

      const [
        avisos,
        acciones,
      ] = await Promise.all([
        listarNotificacionesLaboratorio(
          laboratorioId
        ),
        listarAuditoriaLaboratorio(
          laboratorioId
        ),
      ]);

      setNotificaciones(
        avisos
      );

      setAuditoria(
        acciones
      );
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "No se pudo cargar el control de operaciones."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (laboratorioId) {
      cargar();
    }
  }, [laboratorioId]);

  const leer = async (
    id
  ) => {
    try {
      await marcarNotificacionLeida(
        id
      );

      await cargar();
    } catch (e) {
      setError(
        e?.message ||
          "No se pudo marcar la notificación."
      );
    }
  };

  return (
    <div>
      <div className="s3-header">
        <div>
          <h2>
            Notificaciones y
            auditoría
          </h2>

          <p>
            HU-35: seguimiento de
            eventos y acciones.
          </p>
        </div>

        <button
          className="s3-button secondary"
          type="button"
          onClick={cargar}
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="s3-error">
          {error}
        </div>
      )}

      <div className="s3-tabs">
        <button
          className={`s3-button ${
            seccion ===
            "notificaciones"
              ? ""
              : "secondary"
          }`}
          type="button"
          onClick={() =>
            setSeccion(
              "notificaciones"
            )
          }
        >
          Notificaciones
        </button>

        <button
          className={`s3-button ${
            seccion ===
            "auditoria"
              ? ""
              : "secondary"
          }`}
          type="button"
          onClick={() =>
            setSeccion(
              "auditoria"
            )
          }
        >
          Auditoría
        </button>
      </div>

      <div className="s3-section">
        {cargando ? (
          <div className="s3-empty">
            Cargando...
          </div>
        ) : seccion ===
          "notificaciones" ? (
          notificaciones.length ===
          0 ? (
            <div className="s3-empty">
              No existen
              notificaciones.
            </div>
          ) : (
            notificaciones.map(
              (item) => (
                <div
                  className="s3-card"
                  key={item.id}
                >
                  <div className="s3-header">
                    <div>
                      <h3>
                        {item.titulo ||
                          "Evento del laboratorio"}
                      </h3>

                      <p>
                        {item.mensaje ||
                          item.detalle ||
                          "-"}
                      </p>
                    </div>

                    <span
                      className={
                        item.leida
                          ? "s3-muted"
                          : "s3-badge"
                      }
                    >
                      {item.leida
                        ? "Leída"
                        : "Nueva"}
                    </span>
                  </div>

                  <p className="s3-muted">
                    {fechaVisible(
                      item.fecha ??
                        item.fechaRegistro
                    )}
                  </p>

                  {!item.leida && (
                    <button
                      className="s3-button secondary"
                      type="button"
                      onClick={() =>
                        leer(
                          item.id
                        )
                      }
                    >
                      Marcar como
                      leída
                    </button>
                  )}
                </div>
              )
            )
          )
        ) : auditoria.length ===
          0 ? (
          <div className="s3-empty">
            No existen registros
            de auditoría.
          </div>
        ) : (
          auditoria.map(
            (item) => (
              <div
                className="s3-card"
                key={item.id}
              >
                <h3>
                  {item.accion ||
                    "Acción"}
                </h3>

                <p>
                  <strong>
                    Usuario:
                  </strong>{" "}
                  {item.usuarioNombre ||
                    item.usuarioId ||
                    "-"}
                </p>

                <p>
                  <strong>
                    Entidad:
                  </strong>{" "}
                  {item.entidad ||
                    "-"}{" "}
                  {item.entidadId
                    ? `(${item.entidadId})`
                    : ""}
                </p>

                <p>
                  <strong>
                    Detalle:
                  </strong>{" "}
                  {item.detalle ||
                    "-"}
                </p>

                <p className="s3-muted">
                  {fechaVisible(
                    item.fecha ??
                      item.fechaRegistro
                  )}
                </p>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
