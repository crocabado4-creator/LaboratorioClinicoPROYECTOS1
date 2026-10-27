
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

// ===============================================
// OPCIONES DE CADA MODULO
// ===============================================

const OPCIONES_MUESTRAS = [
  {
    id: "registro",
    titulo: "Registro de muestras",
  },
  {
    id: "validacion",
    titulo: "Recepción y validación",
  },
  {
    id: "seguimiento",
    titulo: "Seguimiento de muestras",
  },
];

const OPCIONES_RESULTADOS = [
  {
    id: "resultados",
    titulo: "Registro de resultados",
  },
  {
    id: "parametros",
    titulo: "Valores por parámetros",
  },
  {
    id: "estadoAnalisis",
    titulo: "Estado de análisis",
  },
  {
    id: "validacionResultados",
    titulo: "Validación de resultados",
  },
  {
    id: "informeResultados",
    titulo: "Informe de resultados",
  },
  {
    id: "historialResultados",
    titulo: "Historial de resultados",
  },
];

// ===============================================
// COMPONENTE PRINCIPAL
// ===============================================

export default function ModuloMuestras({
  usuario,
  onVolver,
  tipo = "muestras",
}) {
  const esResultados = tipo === "resultados";

  const [seccion, setSeccion] = useState(
    esResultados ? "resultados" : "registro"
  );

  const opciones = esResultados
    ? OPCIONES_RESULTADOS
    : OPCIONES_MUESTRAS;

  const estiloBoton = (activo) => ({
    padding: "12px 20px",
    border: "none",
    borderRadius: "9px",

    background: activo
      ? "#19385f"
      : "#e2e8f0",

    color: activo
      ? "#ffffff"
      : "#19385f",

    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

    fontSize: "14px",
    fontWeight: 700,

    cursor: "pointer",
    transition: "background 0.2s",
  });

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#f1f5f9",
      }}
    >
      {/* =======================================
          MENU SEGUN MODULO SELECCIONADO
      ======================================= */}

      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "20px",
          background: "#f1f5f9",
          flexWrap: "wrap",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {opciones.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            style={estiloBoton(
              seccion === opcion.id
            )}
            onClick={() =>
              setSeccion(opcion.id)
            }
          >
            {opcion.titulo}
          </button>
        ))}
      </div>

      {/* =======================================
          FUNCIONALIDADES DE MUESTRAS
      ======================================= */}

      {!esResultados &&
        seccion === "registro" && (
          <GestionMuestras
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {!esResultados &&
        seccion === "validacion" && (
          <ValidacionMuestras
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {!esResultados &&
        seccion === "seguimiento" && (
          <SeguimientoMuestras
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {/* =======================================
          FUNCIONALIDADES DE RESULTADOS
      ======================================= */}

      {esResultados &&
        seccion === "resultados" && (
          <GestionResultados
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {esResultados &&
        seccion === "parametros" && (
          <ValoresResultados
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {esResultados &&
        seccion === "estadoAnalisis" && (
          <EstadoAnalisis
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {esResultados &&
        seccion === "validacionResultados" && (
          <ValidacionResultados
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {esResultados &&
        seccion === "informeResultados" && (
          <InformeResultados
            usuario={usuario}
            onVolver={onVolver}
          />
        )}

      {esResultados &&
        seccion === "historialResultados" && (
          <HistorialResultados
            usuario={usuario}
            onVolver={onVolver}
          />
        )}
    </div>
  );
}
