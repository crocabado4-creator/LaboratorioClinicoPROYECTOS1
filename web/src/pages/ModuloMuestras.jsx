import { useState } from "react";

import GestionMuestras from "./GestionMuestras";
import ValidacionMuestras from "./ValidacionMuestras";
import SeguimientoMuestras from "./SeguimientoMuestras";

import MuestrasDisponibles from "./MuestrasDisponibles";
import GestionResultados from "./GestionResultados";
import EstadoAnalisis from "./EstadoAnalisis";
import ValidacionResultados from "./ValidacionResultados";
import InformeResultados from "./InformeResultados";
import HistorialResultados from "./HistorialResultados";

// ======================================================
// OPCIONES DEL MÓDULO DE MUESTRAS
// ======================================================

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

// ======================================================
// OPCIONES DEL MÓDULO DE RESULTADOS
// ======================================================

const OPCIONES_RESULTADOS = [
  {
    id: "disponibles",
    titulo: "Muestras disponibles",
  },
  {
    id: "resultados",
    titulo: "Registro de resultados",
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

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ModuloMuestras({
  usuario,
  onVolver,
  tipo = "muestras",
}) {
  const esResultados = tipo === "resultados";

  // Pantalla inicial del módulo.
  // Resultados abre directamente Muestras disponibles.

  const [seccion, setSeccion] = useState(
    esResultados ? "disponibles" : "registro"
  );

  const [menuAbierto, setMenuAbierto] = useState(false);

  const opciones = esResultados
    ? OPCIONES_RESULTADOS
    : OPCIONES_MUESTRAS;

  const tituloModulo = esResultados
    ? "Menú de Resultados"
    : "Menú Bioquímico";

  // ======================================================
  // NAVEGACIÓN
  // ======================================================

  const cambiarSeccion = (nuevaSeccion) => {
    setSeccion(nuevaSeccion);
    setMenuAbierto(false);
  };

  const volverDashboard = () => {
    setMenuAbierto(false);

    if (typeof onVolver === "function") {
      onVolver();
    }
  };

  // ======================================================
  // ESTILOS DEL CONTENEDOR
  // ======================================================

  const estilos = {
    contenedor: {
      minHeight: "100vh",
      background: "#f3f7fc",
      fontFamily:
        'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    },

    barraSuperior: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      padding: "13px 20px",
      background: "#ffffff",
      borderBottom: "1px solid #e2e8f0",
      boxShadow: "0 2px 12px rgba(15, 23, 42, 0.035)",
    },

    izquierda: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    botonMenu: {
      width: "40px",
      height: "40px",
      borderRadius: "10px",
      border: "none",
      background: "#19385f",
      color: "#ffffff",
      fontSize: "22px",
      fontWeight: "bold",
      cursor: "pointer",
    },

    titulo: {
      margin: 0,
      fontSize: "14px",
      color: "#19385f",
      fontWeight: 800,
    },

    botonVolver: {
      padding: "11px 17px",
      background: "#e8eef6",
      border: "1px solid #dce5f0",
      borderRadius: "10px",
      color: "#19385f",
      fontSize: "12px",
      fontWeight: 700,
      cursor: "pointer",
    },

    menu: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      padding: "15px 20px",
      background: "#ffffff",
      borderBottom: "1px solid #e2e8f0",
    },

    contenido: {
      minHeight: "calc(100vh - 68px)",
    },
  };

  // ======================================================
  // RENDERIZAR OPCIONES
  // ======================================================

  const renderizarOpcion = (opcion) => {
    const activo = seccion === opcion.id;

    return (
      <button
        key={opcion.id}
        type="button"
        onClick={() => cambiarSeccion(opcion.id)}
        style={{
          padding: "11px 17px",
          borderRadius: "10px",
          border: activo
            ? "1px solid #19385f"
            : "1px solid #dce5f0",
          background: activo
            ? "#19385f"
            : "#f4f7fb",
          color: activo
            ? "#ffffff"
            : "#19385f",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        {opcion.titulo}
      </button>
    );
  };

  // ======================================================
  // INTERFAZ PRINCIPAL
  // ======================================================

  return (
    <div style={estilos.contenedor}>
      {/* BARRA SUPERIOR */}

      <header style={estilos.barraSuperior}>
        <div style={estilos.izquierda}>
          <button
            type="button"
            style={estilos.botonMenu}
            onClick={() =>
              setMenuAbierto((anterior) => !anterior)
            }
            aria-label="Abrir o cerrar menú"
            aria-expanded={menuAbierto}
          >
            ☰
          </button>

          <h2 style={estilos.titulo}>
            {tituloModulo}
          </h2>
        </div>

        <button
          type="button"
          style={estilos.botonVolver}
          onClick={volverDashboard}
        >
          ← Volver
        </button>
      </header>

      {/* MENÚ DESPLEGABLE */}

      {menuAbierto && (
        <nav style={estilos.menu}>
          {opciones.map(renderizarOpcion)}
        </nav>
      )}

      {/* CONTENIDO */}

      <div style={estilos.contenido}>
        {/* ==========================================
            MÓDULO DE MUESTRAS
        ========================================== */}

        {!esResultados && seccion === "registro" && (
          <GestionMuestras
            usuario={usuario}
            onVolver={volverDashboard}
          />
        )}

        {!esResultados && seccion === "validacion" && (
          <ValidacionMuestras
            usuario={usuario}
            onVolver={volverDashboard}
          />
        )}

        {!esResultados && seccion === "seguimiento" && (
          <SeguimientoMuestras
            usuario={usuario}
            onVolver={volverDashboard}
          />
        )}

        {/* ==========================================
            MÓDULO DE RESULTADOS
        ========================================== */}

        {esResultados && seccion === "disponibles" && (
          <MuestrasDisponibles
            usuario={usuario}
            onVolver={volverDashboard}
          />
        )}

        {esResultados && seccion === "resultados" && (
          <GestionResultados
            usuario={usuario}
            onVolver={volverDashboard}
          />
        )}

        {esResultados && seccion === "estadoAnalisis" && (
          <EstadoAnalisis
            usuario={usuario}
            onVolver={volverDashboard}
          />
        )}

        {esResultados &&
          seccion === "validacionResultados" && (
            <ValidacionResultados
              usuario={usuario}
              onVolver={volverDashboard}
              volver={volverDashboard}
            />
          )}

        {esResultados &&
          seccion === "informeResultados" && (
            <InformeResultados
              usuario={usuario}
              onVolver={volverDashboard}
            />
          )}

        {esResultados &&
          seccion === "historialResultados" && (
            <HistorialResultados
              usuario={usuario}
              onVolver={volverDashboard}
            />
          )}
      </div>
    </div>
  );
}