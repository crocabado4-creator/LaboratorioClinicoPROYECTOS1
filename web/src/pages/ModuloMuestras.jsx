import { useEffect, useRef, useState } from "react";

// ======================================================
// LABORATORIO CLÍNICO
// MÓDULO DE MUESTRAS Y RESULTADOS
// DISEÑO HORIZONTAL CON TARJETAS
// ======================================================

// COMPONENTES DE MUESTRAS

import GestionMuestras from "./GestionMuestras";
import ValidacionMuestras from "./ValidacionMuestras";
import SeguimientoMuestras from "./SeguimientoMuestras";

// COMPONENTES DE RESULTADOS

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
    numero: "01",
    icono: "🧪",
    titulo: "Registro de muestras",
    descripcion:
      "Registra y administra las muestras clínicas de los pacientes.",
    acceso: "bioquimico",
    color: "#2563eb",
    fondo: "#dbeafe",
  },
  {
    id: "validacion",
    numero: "02",
    icono: "✅",
    titulo: "Recepción y validación",
    descripcion:
      "Gestiona la recepción, aceptación y rechazo de muestras.",
    acceso: "bioquimico",
    color: "#059669",
    fondo: "#d1fae5",
  },
  {
    id: "seguimiento",
    numero: "03",
    icono: "🔬",
    titulo: "Seguimiento de muestras",
    descripcion:
      "Consulta el estado y procesamiento de las muestras clínicas.",
    acceso: "consulta",
    color: "#7c3aed",
    fondo: "#ede9fe",
  },
];

// ======================================================
// OPCIONES DEL MÓDULO DE RESULTADOS
// ======================================================

const OPCIONES_RESULTADOS = [
  {
    id: "disponibles",
    numero: "01",
    icono: "📋",
    titulo: "Muestras disponibles",
    descripcion:
      "Consulta las muestras disponibles para el procesamiento clínico.",
    acceso: "consulta",
    color: "#2563eb",
    fondo: "#dbeafe",
  },
  {
    id: "registroResultados",
    numero: "02",
    icono: "📝",
    titulo: "Registro de resultados",
    descripcion:
      "Registra los valores obtenidos en los análisis clínicos.",
    acceso: "bioquimico",
    color: "#0891b2",
    fondo: "#cffafe",
  },
  {
    id: "estadoAnalisis",
    numero: "03",
    icono: "📊",
    titulo: "Estado de análisis",
    descripcion:
      "Consulta y supervisa el estado de los análisis realizados.",
    acceso: "consulta",
    color: "#7c3aed",
    fondo: "#ede9fe",
  },
  {
    id: "validacionResultados",
    numero: "04",
    icono: "✔️",
    titulo: "Validación de resultados",
    descripcion:
      "Revisa y valida profesionalmente los resultados clínicos.",
    acceso: "bioquimico",
    color: "#059669",
    fondo: "#d1fae5",
  },
  {
    id: "informeResultados",
    numero: "05",
    icono: "📄",
    titulo: "Informes clínicos",
    descripcion:
      "Consulta y genera informes de resultados para los pacientes.",
    acceso: "consulta",
    color: "#d97706",
    fondo: "#fef3c7",
  },
  {
    id: "historialResultados",
    numero: "06",
    icono: "📚",
    titulo: "Historial de resultados",
    descripcion:
      "Consulta los resultados clínicos registrados anteriormente.",
    acceso: "consulta",
    color: "#db2777",
    fondo: "#fce7f3",
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
  // ====================================================
  // IDENTIFICAR MÓDULO
  // ====================================================

  const esResultados = tipo === "resultados";

  const opciones = esResultados
    ? OPCIONES_RESULTADOS
    : OPCIONES_MUESTRAS;

  // ====================================================
  // ESTADOS
  // ====================================================

  const [seccion, setSeccion] = useState(null);

  const contenidoRef = useRef(null);

  // ====================================================
  // IDENTIFICAR ROL
  // ====================================================

  const rolOriginal = usuario?.rol;

  const rol = String(
    typeof rolOriginal === "object"
      ? rolOriginal?.id ||
          rolOriginal?.nombre ||
          rolOriginal?.nombreRol ||
          ""
      : rolOriginal || ""
  )
    .trim()
    .toLowerCase();

  const rolNormalizado = rol
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const esBioquimico = rolNormalizado === "bioquimico";

  const esAdministrador = rolNormalizado === "administrador";

  const esRecepcionista = rolNormalizado === "recepcionista";

  // ====================================================
  // REINICIAR SECCIÓN
  // ====================================================

  useEffect(() => {
    setSeccion(null);
  }, [tipo]);

  // ====================================================
  // NAVEGACIÓN
  // ====================================================

  const cambiarSeccion = (id) => {
    if (seccion === id) {
      setSeccion(null);
      return;
    }

    setSeccion(id);

    window.setTimeout(() => {
      contenidoRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const volverDashboard = () => {
    if (typeof onVolver === "function") {
      onVolver();
    }
  };

  // ====================================================
  // OPCIÓN SELECCIONADA
  // ====================================================

  const opcionActual = opciones.find(
    (opcion) => opcion.id === seccion
  );

  // ====================================================
  // PERMISOS
  // ====================================================

  const tieneAcceso = (opcion) => {
    if (!opcion) {
      return false;
    }

    if (opcion.acceso === "bioquimico") {
      return esBioquimico;
    }

    return (
      esBioquimico ||
      esAdministrador ||
      esRecepcionista
    );
  };

  // ====================================================
  // MOSTRAR COMPONENTES ORIGINALES
  // ====================================================

  const renderizarContenido = () => {
    if (!opcionActual) {
      return null;
    }

    if (!usuario?.laboratorioId) {
      return (
        <MensajeEstado
          icono="⚠️"
          titulo="Laboratorio no identificado"
          descripcion="Tu cuenta no tiene un laboratorio asociado. Comunícate con el administrador del sistema."
        />
      );
    }

    if (!tieneAcceso(opcionActual)) {
      return (
        <MensajeEstado
          icono="🔒"
          titulo="Acceso restringido"
          descripcion="Esta operación está reservada al personal bioquímico autorizado. Puedes visualizar las opciones, pero no realizar operaciones clínicas restringidas."
        />
      );
    }

    // ==================================================
    // MUESTRAS
    // ==================================================

    if (!esResultados) {
      switch (seccion) {
        case "registro":
          return (
            <GestionMuestras
              usuario={usuario}
              onVolver={volverDashboard}
            />
          );

        case "validacion":
          return (
            <ValidacionMuestras
              usuario={usuario}
              onVolver={volverDashboard}
            />
          );

        case "seguimiento":
          return (
            <SeguimientoMuestras
              usuario={usuario}
              onVolver={volverDashboard}
            />
          );

        default:
          return null;
      }
    }

    // ==================================================
    // RESULTADOS
    // ==================================================

    switch (seccion) {
      case "disponibles":
        return (
          <MuestrasDisponibles
            usuario={usuario}
            onVolver={volverDashboard}
          />
        );

      case "registroResultados":
        return (
          <GestionResultados
            usuario={usuario}
            onVolver={volverDashboard}
          />
        );

      case "estadoAnalisis":
        return (
          <EstadoAnalisis
            usuario={usuario}
            onVolver={volverDashboard}
            volver={volverDashboard}
          />
        );

      case "validacionResultados":
        return (
          <ValidacionResultados
            usuario={usuario}
            onVolver={volverDashboard}
            volver={volverDashboard}
          />
        );

      case "informeResultados":
        return (
          <InformeResultados
            usuario={usuario}
            onVolver={volverDashboard}
          />
        );

      case "historialResultados":
        return (
          <HistorialResultados
            usuario={usuario}
            onVolver={volverDashboard}
          />
        );

      default:
        return null;
    }
  };

  // ====================================================
  // INFORMACIÓN DEL MÓDULO
  // ====================================================

  const tituloModulo = esResultados
    ? "Gestión de resultados"
    : "Gestión de muestras";

  const descripcionModulo = esResultados
    ? "Consulta, registro y seguimiento de resultados clínicos."
    : "Registro, recepción, validación y seguimiento de muestras clínicas.";

  const iconoModulo = esResultados ? "📊" : "🧪";

  const nombreRol = esBioquimico
    ? "Bioquímico"
    : esAdministrador
      ? "Administrador"
      : esRecepcionista
        ? "Recepcionista"
        : "Usuario";

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="mm-page">

      {/* ==================================================
          ESTILOS DEL MÓDULO
      ================================================== */}

      <style>
        {`

          /* =================================================
             CONFIGURACIÓN GENERAL
          ================================================= */

          .mm-page {
            --mm-navy: #19385f;
            --mm-navy-dark: #102b4b;
            --mm-blue: #2563eb;
            --mm-cyan: #0891b2;
            --mm-background: #f1f5f9;
            --mm-border: #dfe6ef;
            --mm-text: #20334d;
            --mm-muted: #64748b;

            width: 100%;
            min-height: 100vh;

            background: var(--mm-background);
            color: var(--mm-text);

            font-family:
              Inter,
              system-ui,
              -apple-system,
              "Segoe UI",
              sans-serif;
          }

          .mm-page *,
          .mm-page *::before,
          .mm-page *::after {
            box-sizing: border-box;
          }

          /* =================================================
             ENCABEZADO PRINCIPAL
          ================================================= */

          .mm-header {
            width: 100%;
            padding: 35px 25px 40px;

            background:
              linear-gradient(
                125deg,
                #102b4b 0%,
                #19385f 55%,
                #256c9b 100%
              );

            color: #ffffff;
          }

          .mm-header-inner {
            width: 100%;
            max-width: 1400px;
            margin: 0 auto;
          }

          .mm-topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 20px;
            flex-wrap: wrap;

            margin-bottom: 30px;
          }

          .mm-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .mm-brand-icon {
            width: 45px;
            height: 45px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 13px;

            background: rgba(255,255,255,0.13);
            border: 1px solid rgba(255,255,255,0.20);

            font-size: 23px;
          }

          .mm-brand-text {
            color: #ffffff;

            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1.6px;
          }

          .mm-back {
            padding: 12px 19px;

            background: rgba(255,255,255,0.13);
            border: 1px solid rgba(255,255,255,0.25);

            border-radius: 11px;

            color: #ffffff;

            font-family: inherit;
            font-size: 13px;
            font-weight: 700;

            cursor: pointer;
            transition: 0.2s;
          }

          .mm-back:hover {
            background: rgba(255,255,255,0.24);
          }

          /* =================================================
             TÍTULO DEL MÓDULO
          ================================================= */

          .mm-heading {
            display: flex;
            align-items: center;
            gap: 22px;
          }

          .mm-heading-icon {
            width: 78px;
            height: 78px;

            flex-shrink: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            background: rgba(255,255,255,0.13);
            border: 1px solid rgba(255,255,255,0.20);
            border-radius: 21px;

            font-size: 38px;
          }

          .mm-heading h1 {
            margin: 0 0 10px;

            color: #ffffff;

            font-size: clamp(27px, 4vw, 38px);
            font-weight: 800;
            letter-spacing: -0.8px;
            line-height: 1.2;
          }

          .mm-heading p {
            margin: 0;

            color: #dbeafe;

            font-size: 14px;
            line-height: 1.7;
          }

          /* =================================================
             CONTENEDOR PRINCIPAL
          ================================================= */

          .mm-container {
            width: 100%;
            max-width: 1400px;

            margin: 0 auto;
            padding: 28px 22px 60px;
          }

          /* =================================================
             MENÚ DE OPCIONES
          ================================================= */

          .mm-menu {
            width: 100%;

            padding: 27px;

            background: #ffffff;

            border: 1px solid #dfe6ef;
            border-radius: 21px;

            box-shadow:
              0 8px 30px rgba(15,23,42,0.045);
          }

          .mm-menu-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 18px;
            flex-wrap: wrap;

            margin-bottom: 26px;
          }

          .mm-menu-label {
            display: block;

            margin-bottom: 8px;

            color: #2563eb;

            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.3px;
          }

          .mm-menu-heading h2 {
            margin: 0;

            color: #19385f;

            font-size: 25px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }

          .mm-menu-heading p {
            margin: 9px 0 0;

            color: #64748b;

            font-size: 13px;
            line-height: 1.6;
          }

          .mm-counter {
            padding: 10px 16px;

            background: #eff6ff;
            border: 1px solid #dbeafe;

            border-radius: 25px;

            color: #1d4ed8;

            font-size: 12px;
            font-weight: 800;
          }

          /* =================================================
             CUADRÍCULA HORIZONTAL
             3 TARJETAS POR FILA
          ================================================= */

          .mm-page .mm-options {
            display: grid !important;

            grid-template-columns:
              repeat(3, minmax(0, 1fr)) !important;

            grid-auto-flow: row !important;

            gap: 19px !important;

            width: 100% !important;

            align-items: stretch !important;
          }

          /* =================================================
             TARJETAS DE OPCIONES
          ================================================= */

          .mm-page .mm-option {
            appearance: none;

            position: relative;

            display: flex !important;
            flex-direction: column !important;

            align-items: flex-start !important;
            justify-content: flex-start !important;

            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;

            min-height: 285px;

            margin: 0 !important;
            padding: 23px !important;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 18px;

            color: #19385f;

            font-family: inherit;

            text-align: left !important;

            cursor: pointer;

            box-shadow:
              0 4px 15px rgba(15,23,42,0.025);

            transition:
              transform 0.2s ease,
              box-shadow 0.2s ease,
              border-color 0.2s ease,
              background 0.2s ease;
          }

          .mm-page .mm-option:hover {
            transform: translateY(-4px);

            border-color: #93c5fd;

            box-shadow:
              0 15px 35px rgba(15,23,42,0.09);
          }

          .mm-page .mm-option.active {
            background: #f8fbff;

            border-color: #2563eb;

            box-shadow:
              0 10px 30px rgba(37,99,235,0.10);
          }

          .mm-option::before {
            content: "";

            position: absolute;

            top: 0;
            left: 0;
            right: 0;

            height: 4px;

            background: var(--opcion-color);

            opacity: 0;

            border-radius: 18px 18px 0 0;

            transition: opacity 0.2s;
          }

          .mm-option:hover::before,
          .mm-option.active::before {
            opacity: 1;
          }

          /* =================================================
             PARTE SUPERIOR DE TARJETA
          ================================================= */

          .mm-option-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 14px;

            width: 100%;

            margin-bottom: 21px;
          }

          .mm-option-icon {
            width: 60px;
            height: 60px;

            flex: 0 0 60px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 16px;

            background: var(--opcion-fondo);

            font-size: 28px;
          }

          .mm-option-number {
            padding: 7px 11px;

            border-radius: 25px;

            background: #f1f5f9;

            color: #64748b;

            font-size: 10px;
            font-weight: 800;

            letter-spacing: 0.8px;
          }

          /* =================================================
             INFORMACIÓN DE TARJETA
          ================================================= */

          .mm-option-body {
            display: flex;
            flex-direction: column;

            align-items: flex-start;

            width: 100%;
            min-width: 0;

            flex: 1;
          }

          .mm-option-title {
            display: block;

            margin-bottom: 11px;

            color: #19385f;

            font-size: 19px;
            font-weight: 800;

            line-height: 1.3;
            letter-spacing: -0.3px;
          }

          .mm-option-description {
            display: block;

            color: #64748b;

            font-size: 13px;
            font-weight: 400;

            line-height: 1.7;
          }

          .mm-option-lock {
            display: inline-flex;
            align-items: center;

            gap: 6px;

            margin-top: 13px;
            padding: 6px 9px;

            background: #fef3c7;

            color: #92400e;

            border-radius: 8px;

            font-size: 10px;
            font-weight: 800;
          }

          /* =================================================
             PARTE INFERIOR DE TARJETA
          ================================================= */

          .mm-option-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 10px;

            width: 100%;

            margin-top: 24px;
            padding-top: 17px;

            border-top: 1px solid #e2e8f0;
          }

          .mm-option-action {
            display: flex;
            align-items: center;

            gap: 8px;

            color: var(--opcion-color);

            font-size: 12px;
            font-weight: 800;
          }

          .mm-option-arrow {
            width: 33px;
            height: 33px;

            display: flex;
            align-items: center;
            justify-content: center;

            background: var(--opcion-fondo);

            color: var(--opcion-color);

            border-radius: 10px;

            font-size: 22px;

            transition: 0.2s;
          }

          .mm-option:hover .mm-option-arrow {
            transform: translateX(3px);
          }

          .mm-option.active .mm-option-arrow {
            background: var(--opcion-color);
            color: #ffffff;
          }

          /* =================================================
             PERFIL DEL USUARIO
          ================================================= */

          .mm-profile {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 15px;
            flex-wrap: wrap;

            margin-top: 23px;
            padding: 17px 20px;

            background: #f8fafc;

            border: 1px solid #e2e8f0;
            border-radius: 13px;
          }

          .mm-profile-info {
            display: flex;
            align-items: center;

            gap: 12px;
          }

          .mm-profile-icon {
            width: 43px;
            height: 43px;

            display: flex;
            align-items: center;
            justify-content: center;

            background: #dbeafe;

            border-radius: 12px;

            font-size: 20px;
          }

          .mm-profile-info span {
            display: block;

            color: #64748b;

            font-size: 11px;
          }

          .mm-profile-info strong {
            display: block;

            margin-top: 4px;

            color: #19385f;

            font-size: 13px;
          }

          .mm-profile-status {
            padding: 8px 12px;

            background: #ecfdf5;

            color: #047857;

            border-radius: 25px;

            font-size: 11px;
            font-weight: 800;
          }

          /* =================================================
             CONTENIDO SELECCIONADO
          ================================================= */

          .mm-content {
            width: 100%;

            margin-top: 27px;

            scroll-margin-top: 20px;
          }

          .mm-content-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 20px;
            flex-wrap: wrap;

            padding: 23px 27px;

            margin-bottom: 17px;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 18px;

            box-shadow:
              0 5px 20px rgba(15,23,42,0.035);
          }

          .mm-content-title {
            display: flex;
            align-items: center;

            gap: 16px;
          }

          .mm-content-icon {
            width: 58px;
            height: 58px;

            flex-shrink: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            background: #eff6ff;

            border-radius: 15px;

            font-size: 27px;
          }

          .mm-content-label {
            display: block;

            margin-bottom: 7px;

            color: #2563eb;

            font-size: 10px;
            font-weight: 800;

            letter-spacing: 1.1px;
          }

          .mm-content-heading h2 {
            margin: 0 0 6px;

            color: #19385f;

            font-size: 22px;
            font-weight: 800;
          }

          .mm-content-heading p {
            margin: 0;

            color: #64748b;

            font-size: 13px;
            line-height: 1.5;
          }

          .mm-close {
            padding: 11px 17px;

            background: #e2e8f0;

            color: #19385f;

            border: none;
            border-radius: 10px;

            font-size: 12px;
            font-weight: 800;

            cursor: pointer;
          }

          .mm-close:hover {
            background: #cbd5e1;
          }

          .mm-content-panel {
            width: 100%;
            min-width: 0;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 19px;

            overflow: visible;

            box-shadow:
              0 5px 25px rgba(15,23,42,0.035);
          }

          /* =================================================
             MENSAJES
          ================================================= */

          .mm-message {
            display: flex;
            justify-content: center;
            align-items: center;

            min-height: 350px;
            padding: 30px;
          }

          .mm-message-card {
            width: 100%;
            max-width: 500px;

            padding: 38px;

            background: #f8fafc;

            border: 1px solid #e2e8f0;
            border-radius: 19px;

            text-align: center;
          }

          .mm-message-icon {
            font-size: 43px;
            margin-bottom: 18px;
          }

          .mm-message-card h2 {
            margin: 0 0 13px;

            color: #19385f;

            font-size: 23px;
            font-weight: 800;
          }

          .mm-message-card p {
            margin: 0;

            color: #64748b;

            font-size: 14px;
            line-height: 1.8;
          }

          /* =================================================
             PIE DE PÁGINA
          ================================================= */

          .mm-footer {
            margin-top: 33px;

            text-align: center;

            color: #94a3b8;

            font-size: 12px;
          }

          /* =================================================
             RESPONSIVE - COMPUTADORAS MEDIANAS
          ================================================= */

          @media (max-width: 1100px) {
            .mm-page .mm-options {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
            }
          }

          /* =================================================
             RESPONSIVE - TABLETAS
          ================================================= */

          @media (max-width: 768px) {
            .mm-header {
              padding: 28px 20px;
            }

            .mm-container {
              padding: 22px 15px 45px;
            }

            .mm-menu {
              padding: 20px;
            }

            .mm-option-title {
              font-size: 17px;
            }

            .mm-page .mm-option {
              min-height: 270px;
            }
          }

          /* =================================================
             RESPONSIVE - CELULARES
          ================================================= */

          @media (max-width: 600px) {
            .mm-header {
              padding: 24px 16px;
            }

            .mm-topbar {
              margin-bottom: 22px;
            }

            .mm-back {
              width: 100%;
            }

            .mm-heading {
              align-items: flex-start;
              gap: 13px;
            }

            .mm-heading-icon {
              width: 55px;
              height: 55px;

              font-size: 27px;

              border-radius: 14px;
            }

            .mm-heading h1 {
              font-size: 26px;
            }

            .mm-heading p {
              font-size: 12px;
            }

            .mm-container {
              padding: 16px 11px 35px;
            }

            .mm-menu {
              padding: 16px;

              border-radius: 15px;
            }

            .mm-menu-heading h2 {
              font-size: 21px;
            }

            .mm-page .mm-options {
              grid-template-columns: 1fr !important;

              gap: 13px !important;
            }

            .mm-page .mm-option {
              min-height: 230px;

              padding: 19px !important;
            }

            .mm-option-icon {
              width: 53px;
              height: 53px;

              flex-basis: 53px;

              font-size: 24px;
            }

            .mm-option-title {
              font-size: 17px;
            }

            .mm-option-description {
              font-size: 12px;
            }

            .mm-profile {
              align-items: flex-start;
            }

            .mm-content-heading {
              padding: 17px;
            }

            .mm-content-heading h2 {
              font-size: 18px;
            }

            .mm-content-icon {
              width: 45px;
              height: 45px;

              font-size: 21px;
            }

            .mm-close {
              width: 100%;
            }
          }

        `}
      </style>

      {/* ==================================================
          ENCABEZADO
      ================================================== */}

      <header className="mm-header">
        <div className="mm-header-inner">

          <div className="mm-topbar">

            <div className="mm-brand">

              <div className="mm-brand-icon">
                ✚
              </div>

              <span className="mm-brand-text">
                LABORATORIO CLÍNICO
              </span>

            </div>

            <button
              type="button"
              className="mm-back"
              onClick={volverDashboard}
            >
              ← Volver al Dashboard
            </button>

          </div>

          <div className="mm-heading">

            <div className="mm-heading-icon">
              {iconoModulo}
            </div>

            <div>

              <h1>
                {tituloModulo}
              </h1>

              <p>
                {descripcionModulo}
              </p>

            </div>

          </div>

        </div>
      </header>

      {/* ==================================================
          CONTENIDO PRINCIPAL
      ================================================== */}

      <div className="mm-container">

        {/* ==================================================
            MENÚ HORIZONTAL
        ================================================== */}

        <section className="mm-menu">

          <div className="mm-menu-heading">

            <div>

              <span className="mm-menu-label">
                NAVEGACIÓN DEL MÓDULO
              </span>

              <h2>
                Selecciona una opción
              </h2>

              <p>
                Selecciona la función que deseas utilizar.
              </p>

            </div>

            <span className="mm-counter">
              {opciones.length} opciones
            </span>

          </div>

          {/* ==============================================
              TARJETAS HORIZONTALES
              TRES COLUMNAS
          ============================================== */}

          <nav
            className="mm-options"
            aria-label={`Opciones de ${tituloModulo}`}
          >

            {opciones.map((opcion) => {

              const activa =
                seccion === opcion.id;

              const restringida =
                opcion.acceso === "bioquimico" &&
                !esBioquimico;

              return (
                <button
                  key={opcion.id}
                  type="button"

                  className={
                    activa
                      ? "mm-option active"
                      : "mm-option"
                  }

                  style={{
                    "--opcion-color": opcion.color,
                    "--opcion-fondo": opcion.fondo,
                  }}

                  onClick={() =>
                    cambiarSeccion(opcion.id)
                  }

                  aria-expanded={activa}

                  aria-controls={
                    activa
                      ? "mm-panel-contenido"
                      : undefined
                  }
                >

                  {/* PARTE SUPERIOR */}

                  <span className="mm-option-top">

                    <span className="mm-option-icon">
                      {opcion.icono}
                    </span>

                    <span className="mm-option-number">
                      OPCIÓN {opcion.numero}
                    </span>

                  </span>

                  {/* INFORMACIÓN */}

                  <span className="mm-option-body">

                    <strong className="mm-option-title">
                      {opcion.titulo}
                    </strong>

                    <span className="mm-option-description">
                      {opcion.descripcion}
                    </span>

                    {restringida && (
                      <span className="mm-option-lock">
                        🔒 Operación restringida
                      </span>
                    )}

                  </span>

                  {/* PARTE INFERIOR */}

                  <span className="mm-option-bottom">

                    <span className="mm-option-action">
                      {activa
                        ? "Sección seleccionada"
                        : "Abrir módulo"}
                    </span>

                    <span className="mm-option-arrow">
                      {activa ? "✓" : "→"}
                    </span>

                  </span>

                </button>
              );
            })}

          </nav>

          {/* ==============================================
              INFORMACIÓN DEL PERFIL
          ============================================== */}

          <div className="mm-profile">

            <div className="mm-profile-info">

              <div className="mm-profile-icon">
                👤
              </div>

              <div>

                <span>
                  Perfil de usuario
                </span>

                <strong>
                  {nombreRol}
                </strong>

              </div>

            </div>

            <span className="mm-profile-status">
              ● Sesión activa
            </span>

          </div>

        </section>

        {/* ==================================================
            CONTENIDO SELECCIONADO
        ================================================== */}

        {opcionActual && (
          <section
            className="mm-content"
            id="mm-panel-contenido"
            ref={contenidoRef}
          >

            {/* ENCABEZADO */}

            <div className="mm-content-heading">

              <div className="mm-content-title">

                <div className="mm-content-icon">
                  {opcionActual.icono}
                </div>

                <div>

                  <span className="mm-content-label">
                    SECCIÓN SELECCIONADA
                  </span>

                  <h2>
                    {opcionActual.titulo}
                  </h2>

                  <p>
                    {opcionActual.descripcion}
                  </p>

                </div>

              </div>

              <button
                type="button"
                className="mm-close"
                onClick={() => {
                  setSeccion(null);

                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              >
                ✕ Cerrar sección
              </button>

            </div>

            {/* COMPONENTE ORIGINAL */}

            <div className="mm-content-panel">
              {renderizarContenido()}
            </div>

          </section>
        )}

        {/* ==================================================
            PIE DE PÁGINA
        ================================================== */}

        <footer className="mm-footer">
          Laboratorio Clínico · Sistema de gestión
          de muestras y resultados
        </footer>

      </div>

    </main>
  );
}

// ======================================================
// COMPONENTE DE MENSAJES
// ======================================================

function MensajeEstado({
  icono,
  titulo,
  descripcion,
}) {
  return (
    <div className="mm-message">

      <div className="mm-message-card">

        <div className="mm-message-icon">
          {icono}
        </div>

        <h2>
          {titulo}
        </h2>

        <p>
          {descripcion}
        </p>

      </div>

    </div>
  );
}