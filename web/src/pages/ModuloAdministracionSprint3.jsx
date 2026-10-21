import {
  useState,
} from "react";

import DashboardLaboratorio from "./DashboardLaboratorio";
import ReportesLaboratorio from "./ReportesLaboratorio";
import ControlOperaciones from "./ControlOperaciones";

import "./Sprint3.css";

export default function ModuloAdministracionSprint3({
  usuario,
  onVolver,
}) {
  const [
    seccion,
    setSeccion,
  ] = useState(
    "dashboard"
  );

  if (
    usuario?.rol !==
    "administrador"
  ) {
    return (
      <div className="s3-page">
        <div className="s3-error">
          Este módulo es
          exclusivo del
          Administrador del
          Laboratorio.
        </div>

        <button
          type="button"
          className="s3-button secondary"
          onClick={onVolver}
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="s3-page">
      <div className="s3-header">
        <div>
          <h1>
            Administración del
            laboratorio
          </h1>

          <p>
            Dashboard, reportes,
            notificaciones y
            auditoría.
          </p>
        </div>

        <button
          type="button"
          className="s3-button secondary"
          onClick={onVolver}
        >
          Volver al inicio
        </button>
      </div>

      <div className="s3-tabs">
        <button
          className={`s3-button ${
            seccion ===
            "dashboard"
              ? ""
              : "secondary"
          }`}
          onClick={() =>
            setSeccion(
              "dashboard"
            )
          }
          type="button"
        >
          Dashboard
        </button>

        <button
          className={`s3-button ${
            seccion ===
            "reportes"
              ? ""
              : "secondary"
          }`}
          onClick={() =>
            setSeccion(
              "reportes"
            )
          }
          type="button"
        >
          Reportes
        </button>

        <button
          className={`s3-button ${
            seccion ===
            "control"
              ? ""
              : "secondary"
          }`}
          onClick={() =>
            setSeccion(
              "control"
            )
          }
          type="button"
        >
          Notificaciones y
          auditoría
        </button>
      </div>

      <div className="s3-section">
        {seccion ===
          "dashboard" && (
          <DashboardLaboratorio
            usuario={usuario}
          />
        )}

        {seccion ===
          "reportes" && (
          <ReportesLaboratorio
            usuario={usuario}
          />
        )}

        {seccion ===
          "control" && (
          <ControlOperaciones
            usuario={usuario}
          />
        )}
      </div>
    </div>
  );
}
