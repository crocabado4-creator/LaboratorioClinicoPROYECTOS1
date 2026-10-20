import { useState } from "react";

import GestionMuestras from "./GestionMuestras";
import ValidacionMuestras from "./ValidacionMuestras";
import SeguimientoMuestras from "./SeguimientoMuestras";
import GestionResultados from "./GestionResultados";
import ValoresResultados from "./ValoresResultados";
import EstadoAnalisis from "./EstadoAnalisis";
import ValidacionResultados from "./ValidacionResultados";
import InformeResultados from "./InformeResultados";
import HistorialResultados from "./HistorialResultados";

export default function ModuloMuestras({
  usuario,
  onVolver,
}) {
  const [seccion, setSeccion] = useState("registro");

  const estiloBoton = (activo) => ({
    padding: "12px 20px",
    border: "none",
    borderRadius: "8px",
    background: activo ? "#17365d" : "#e2e8f0",
    color: activo ? "white" : "#334155",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background 0.2s",
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "20px",
          background: "#f4f7fb",
          flexWrap: "wrap",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          type="button"
          style={estiloBoton(seccion === "registro")}
          onClick={() => setSeccion("registro")}
        >
          Registro de muestras
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "validacion")}
          onClick={() => setSeccion("validacion")}
        >
          Recepción y validación
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "seguimiento")}
          onClick={() => setSeccion("seguimiento")}
        >
          Seguimiento de muestras
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "resultados")}
          onClick={() => setSeccion("resultados")}
        >
          Registro de resultados
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "parametros")}
          onClick={() => setSeccion("parametros")}
        >
          Valores por parámetros
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "estadoAnalisis")}
          onClick={() => setSeccion("estadoAnalisis")}
        >
          Estado de análisis
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "validacionResultados")}
          onClick={() => setSeccion("validacionResultados")}
        >
          Validación de resultados
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "informeResultados")}
          onClick={() => setSeccion("informeResultados")}
        >
          Informe de resultados
        </button>

        <button
          type="button"
          style={estiloBoton(seccion === "historialResultados")}
          onClick={() => setSeccion("historialResultados")}
        >
          Historial de resultados
        </button>
      </div>

      {seccion === "registro" && (
        <GestionMuestras
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "validacion" && (
        <ValidacionMuestras
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "seguimiento" && (
        <SeguimientoMuestras
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "resultados" && (
        <GestionResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "parametros" && (
        <ValoresResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "estadoAnalisis" && (
        <EstadoAnalisis
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "validacionResultados" && (
        <ValidacionResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "informeResultados" && (
        <InformeResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {seccion === "historialResultados" && (
        <HistorialResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}
    </div>
  );
}
