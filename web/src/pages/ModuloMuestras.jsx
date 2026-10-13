import { useState } from "react";

import GestionMuestras from "./GestionMuestras";
import ValidacionMuestras from "./ValidacionMuestras";
import SeguimientoMuestras from "./SeguimientoMuestras";
import GestionResultados from "./GestionResultados";
import ValoresResultados from "./ValoresResultados";
import EstadoAnalisis from "./EstadoAnalisis";
import ValidacionResultados from "./ValidacionResultados";

export default function ModuloMuestras({ usuario, onVolver }) {
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
      {/* MENÚ DE MÓDULOS */}
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
        {/* HU-22 Y HU-23 */}
        <button
          type="button"
          style={estiloBoton(seccion === "registro")}
          onClick={() => setSeccion("registro")}
        >
          Registro de muestras
        </button>

        {/* HU-24 */}
        <button
          type="button"
          style={estiloBoton(seccion === "validacion")}
          onClick={() => setSeccion("validacion")}
        >
          Recepción y validación
        </button>

        {/* HU-25 */}
        <button
          type="button"
          style={estiloBoton(seccion === "seguimiento")}
          onClick={() => setSeccion("seguimiento")}
        >
          Seguimiento de muestras
        </button>

        {/* HU-26 */}
        <button
          type="button"
          style={estiloBoton(seccion === "resultados")}
          onClick={() => setSeccion("resultados")}
        >
          Registro de resultados
        </button>

        {/* HU-27 */}
        <button
          type="button"
          style={estiloBoton(seccion === "parametros")}
          onClick={() => setSeccion("parametros")}
        >
          Valores por parámetros
        </button>
        {/* HU-28 */}
        <button
  type="button"
  style={estiloBoton(seccion === "estadoAnalisis")}
  onClick={() => setSeccion("estadoAnalisis")}
>
  Estado de análisis
</button>

        {/* HU-29 */}
        <button
  type="button"
  style={estiloBoton(seccion === "validacionResultados")}
  onClick={() => setSeccion("validacionResultados")}
>
  Validación de resultados
</button>

      </div>

      {/* HU-22 Y HU-23: REGISTRO DE MUESTRAS */}
      {seccion === "registro" && (
        <GestionMuestras
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {/* HU-24: RECEPCIÓN Y VALIDACIÓN */}
      {seccion === "validacion" && (
        <ValidacionMuestras
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {/* HU-25: SEGUIMIENTO DE MUESTRAS */}
      {seccion === "seguimiento" && (
        <SeguimientoMuestras
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {/* HU-26: REGISTRO DE RESULTADOS */}
      {seccion === "resultados" && (
        <GestionResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {/* HU-27: VALORES POR PARÁMETROS */}
      {seccion === "parametros" && (
        <ValoresResultados
          usuario={usuario}
          onVolver={onVolver}
        />
      )}

      {/* HU-28: ESTADO DE ANÁLISIS */}
      {seccion === "estadoAnalisis" && (
  <EstadoAnalisis
    usuario={usuario}
    onVolver={onVolver}
  />
)}
      {/* HU-29: VALIDACIÓN DE RESULTADOS */}
      {seccion === "validacionResultados" && (
  <ValidacionResultados
    usuario={usuario}
    onVolver={onVolver}
  />
)}
    </div>
  );
}