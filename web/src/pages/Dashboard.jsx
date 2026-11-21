import { useEffect, useState } from "react";

import { obtenerPermisosRol } from "../services/rolesService";
import { obtenerPersonalizacion } from "../services/personalizacionService";
import { cerrarSesionFirebase } from "../services/sessionService";

// =====================================================
// MÓDULOS DEL LABORATORIO
// =====================================================

import GestionRoles from "./GestionRoles";
import ConfiguracionLaboratorio from "./ConfiguracionLaboratorio";
import GestionPersonal from "./GestionPersonal";
import GestionPacientes from "./GestionPacientes";
import GestionAnalisis from "./GestionAnalisis";
import GestionSolicitudes from "./GestionSolicitudes";
import GestionVentas from "./GestionVentas";

import ModuloMuestras from "./ModuloMuestras";
import ModuloAdministracionSprint3 from "./ModuloAdministracionSprint3";
import NotificacionesRecepcion from "./NotificacionesRecepcion";

// =====================================================
// MÓDULOS DE RECEPCIÓN
// =====================================================

import HistorialPacientes from "./HistorialPacientes";
import ResultadosRecepcion from "./ResultadosRecepcion";

// =====================================================
// MÓDULOS DEL SUPERADMINISTRADOR
// =====================================================

import SuperAdminDashboard from "./SuperAdminDashboard";
import SuperAdminLaboratorios from "./SuperAdminLaboratorios";
import SuperAdminPersonalizacion from "./SuperAdminPersonalizacion";
import SuperAdminAdministradores from "./SuperAdminAdministradores";
import SuperAdminUsuarios from "./SuperAdminUsuarios";
import SuperAdminRoles from "./SuperAdminRoles";
import SuperAdminAuditoria from "./SuperAdminAuditoria";

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

function Dashboard({ usuario, onLogout }) {

  const [permisos, setPermisos] = useState([]);

  const [cargandoPermisos, setCargandoPermisos] =
    useState(true);

  const [vista, setVista] = useState("dashboard");

  const [laboratorio, setLaboratorio] = useState(null);

  const [cerrandoSesion, setCerrandoSesion] =
    useState(false);

  // =====================================================
  // IDENTIFICAR ROLES
  // =====================================================

  const rolOriginal =
    typeof usuario?.rol === "object"
      ? usuario.rol?.id ||
        usuario.rol?.nombre ||
        usuario.rol?.nombreRol ||
        ""
      : usuario?.rol || "";

  const rol = String(rolOriginal)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const esSuperAdmin = rol === "super_admin";

  const esAdministrador = rol === "administrador";

  const esRecepcionista = rol === "recepcionista";

  const esBioquimico = rol === "bioquimico";

  // =====================================================
  // CARGAR PERMISOS
  // =====================================================

  useEffect(() => {

    let activo = true;

    async function cargarPermisos() {

      if (!usuario?.rol) {

        setPermisos([]);
        setCargandoPermisos(false);

        return;
      }

      try {

        setCargandoPermisos(true);

        const resultado = await obtenerPermisosRol(
          usuario.rol
        );

        if (!activo) return;

        if (Array.isArray(resultado)) {

          setPermisos(resultado);

        } else if (
          resultado &&
          Array.isArray(resultado.permisos)
        ) {

          setPermisos(resultado.permisos);

        } else {

          setPermisos([]);
        }

      } catch (error) {

        console.error(
          "Error al cargar permisos:",
          error
        );

        if (activo) {
          setPermisos([]);
        }

      } finally {

        if (activo) {
          setCargandoPermisos(false);
        }
      }
    }

    cargarPermisos();

    return () => {
      activo = false;
    };

  }, [usuario?.rol]);

  // =====================================================
  // CARGAR PERSONALIZACIÓN
  // =====================================================

  useEffect(() => {

    let activo = true;

    async function cargarLaboratorio() {

      if (!usuario?.laboratorioId) {

        setLaboratorio(null);
        return;
      }

      try {

        const datos = await obtenerPersonalizacion(
          usuario.laboratorioId
        );

        if (activo) {
          setLaboratorio(datos || null);
        }

      } catch (error) {

        console.error(
          "Error al cargar laboratorio:",
          error
        );

        if (activo) {
          setLaboratorio(null);
        }
      }
    }

    cargarLaboratorio();

    return () => {
      activo = false;
    };

  }, [usuario?.laboratorioId]);

  // =====================================================
  // VERIFICAR PERMISOS
  // =====================================================

  const tienePermiso = (permiso) => {
    return permisos.includes(permiso);
  };

  const tieneAlgunPermiso = (lista) => {
    return lista.some((permiso) =>
      permisos.includes(permiso)
    );
  };

  // =====================================================
  // NAVEGACIÓN
  // =====================================================

  const irDashboard = () => {
    setVista("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const navegar = (modulo) => {

    setVista(modulo);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =====================================================
  // CERRAR SESIÓN
  // =====================================================

  const cerrarSesion = async () => {

    if (cerrandoSesion) return;

    const confirmar = window.confirm(
      "¿Deseas cerrar sesión?"
    );

    if (!confirmar) return;

    try {

      setCerrandoSesion(true);

      await cerrarSesionFirebase();

      if (typeof onLogout === "function") {
        onLogout();
      }

    } catch (error) {

      console.error(
        "Error al cerrar sesión:",
        error
      );

      window.alert(
        "No se pudo cerrar la sesión."
      );

    } finally {

      setCerrandoSesion(false);
    }
  };

  // =====================================================
  // VALIDAR USUARIO
  // =====================================================

  if (!usuario) {

    return (
      <PantallaEstado
        icono="!"
        titulo="Sesión no disponible"
        texto="No fue posible cargar la información de tu cuenta."
      />
    );
  }

  if (cargandoPermisos) {

    return (
      <PantallaEstado
        icono="🧪"
        titulo="Laboratorio Clínico"
        texto="Preparando tu espacio de trabajo..."
      />
    );
  }

  // =====================================================
  // SUPERADMINISTRADOR
  // =====================================================

  if (esSuperAdmin) {

    if (vista === "laboratorios") {

      return (
        <SuperAdminLaboratorios
          permisos={permisos}
          volver={irDashboard}
        />
      );
    }

    if (vista === "personalizacion") {

      return (
        <SuperAdminPersonalizacion
          permisos={permisos}
          volver={irDashboard}
        />
      );
    }

    if (vista === "administradores") {

      return (
        <SuperAdminAdministradores
          permisos={permisos}
          volver={irDashboard}
        />
      );
    }

    if (vista === "usuarios") {

      return (
        <SuperAdminUsuarios
          volver={irDashboard}
        />
      );
    }

    if (vista === "roles") {

      return (
        <SuperAdminRoles
          volver={irDashboard}
        />
      );
    }

    if (vista === "auditoria") {

      return (
        <SuperAdminAuditoria
          volver={irDashboard}
        />
      );
    }

    return (
      <SuperAdminDashboard
        usuario={usuario}
        onLogout={cerrarSesion}
        onNavigate={navegar}
      />
    );
  }

  // =====================================================
  // GESTIÓN DE ROLES
  // =====================================================

  if (
    vista === "roles" &&
    esAdministrador &&
    tienePermiso("roles.asignar")
  ) {

    return (
      <GestionRoles
        usuario={usuario}
        volver={irDashboard}
      />
    );
  }

  // =====================================================
  // CONFIGURACIÓN DEL LABORATORIO
  // =====================================================

  if (
    vista === "configuracion" &&
    esAdministrador &&
    tienePermiso("configuracion.editar")
  ) {

    return (
      <ConfiguracionLaboratorio
        usuario={usuario}
        volver={irDashboard}
      />
    );
  }

  // =====================================================
  // GESTIÓN DE PERSONAL
  // =====================================================

  if (
    vista === "personal" &&
    esAdministrador &&
    tieneAlgunPermiso([
      "empleados.crear",
      "empleados.ver",
      "empleados.editar",
      "empleados.desactivar",
    ])
  ) {

    return (
      <GestionPersonal
        usuario={usuario}
        permisos={permisos}
        volver={irDashboard}
      />
    );
  }

  // =====================================================
  // GESTIÓN DE PACIENTES
  // =====================================================

  if (
    vista === "pacientes" &&
    tieneAlgunPermiso([
      "pacientes.crear",
      "pacientes.editar",
      "pacientes.ver",
    ])
  ) {

    return (
      <GestionPacientes
        usuario={usuario}
        permisos={permisos}
        volver={irDashboard}
      />
    );
  }

  // =====================================================
  // GESTIÓN DE ANÁLISIS
  // =====================================================

  if (
    vista === "analisis" &&
    tieneAlgunPermiso([
      "analisis.crear",
      "analisis.editar",
      "analisis.ver",
    ])
  ) {

    return (
      <GestionAnalisis
        usuario={usuario}
        permisos={permisos}
        volver={irDashboard}
      />
    );
  }

  // =====================================================
  // SOLICITUDES DE ANÁLISIS
  // =====================================================

  if (
    vista === "solicitudes" &&
    esRecepcionista
  ) {

    return (
      <GestionSolicitudes
        usuario={usuario}
        onVolver={irDashboard}
      />
    );
  }

  // =====================================================
  // GESTIÓN DE VENTAS
  // =====================================================

  if (
    vista === "ventas" &&
    tienePermiso("ventas.ver")
  ) {

    return (
      <GestionVentas
        usuario={usuario}
        onVolver={irDashboard}
      />
    );
  }

  // =====================================================
  // MÓDULO DE MUESTRAS
  // =====================================================

  if (
    vista === "muestras" &&
    (
      esBioquimico ||
      esRecepcionista
    )
  ) {

    return (
      <ModuloMuestras
        usuario={usuario}
        tipo="muestras"
        onVolver={irDashboard}
      />
    );
  }

  // =====================================================
  // MÓDULO DE RESULTADOS
  // =====================================================

  if (
    vista === "resultados" &&
    (
      esRecepcionista ||
      (
        (esAdministrador || esBioquimico) &&
        tienePermiso("resultados.ver")
      )
    )
  ) {

    return (
      <ModuloMuestras
        usuario={usuario}
        tipo="resultados"
        onVolver={irDashboard}
      />
    );
  }

  // =====================================================
  // NOTIFICACIONES
  // =====================================================

  if (
    vista === "notificaciones_recepcion" &&
    esRecepcionista
  ) {

    return (
      <ContenedorModulo onVolver={irDashboard}>

        <NotificacionesRecepcion
          laboratorioId={usuario.laboratorioId}
          usuarioId={usuario.uid}
        />

      </ContenedorModulo>
    );
  }

  // =====================================================
  // HISTORIAL DE PACIENTES
  // =====================================================

  if (
    vista === "historial_pacientes" &&
    esRecepcionista
  ) {

    return (
      <ContenedorModulo onVolver={irDashboard}>

        <HistorialPacientes
          usuario={usuario}
        />

      </ContenedorModulo>
    );
  }

  // =====================================================
  // RESULTADOS DE RECEPCIÓN
  // =====================================================

  if (
    vista === "resultados_recepcion" &&
    esRecepcionista
  ) {

    return (
      <ContenedorModulo onVolver={irDashboard}>

        <ResultadosRecepcion
          usuario={usuario}
        />

      </ContenedorModulo>
    );
  }

  // =====================================================
  // PANEL ADMINISTRATIVO
  // =====================================================

  if (
    vista === "sprint3Admin" &&
    esAdministrador
  ) {

    return (
      <ModuloAdministracionSprint3
        usuario={usuario}
        permisos={permisos}
        onVolver={irDashboard}
        volver={irDashboard}
      />
    );
  }

  // =====================================================
  // PERSONALIZACIÓN
  // =====================================================

  const colorPrimario = validarColor(
    laboratorio?.colorPrimario
  )
    ? laboratorio.colorPrimario
    : "#2563eb";

  const colorSecundario = validarColor(
    laboratorio?.colorSecundario
  )
    ? laboratorio.colorSecundario
    : "#0ea5e9";

  const nombreLaboratorio =
    laboratorio?.nombreVisible ||
    laboratorio?.nombre ||
    "Laboratorio Clínico";

  const nombreUsuario = [
    usuario?.nombre,
    usuario?.apellido,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  // =====================================================
  // MÓDULOS DISPONIBLES
  // =====================================================

  const modulosDisponibles = [];

  // ROLES

  if (
    esAdministrador &&
    tienePermiso("roles.asignar")
  ) {

    modulosDisponibles.push({
      id: "roles",
      icono: "🛡️",
      titulo: "Roles y permisos",
      descripcion:
        "Gestiona los roles y permisos del personal del laboratorio.",
      fondo: "#eef2ff",
      color: "#4338ca",
      categoria: "Administración",
    });
  }

  // CONFIGURACIÓN

  if (
    esAdministrador &&
    tienePermiso("configuracion.editar")
  ) {

    modulosDisponibles.push({
      id: "configuracion",
      icono: "⚙️",
      titulo: "Configuración",
      descripcion:
        "Administra la información y configuración institucional.",
      fondo: "#e0f2fe",
      color: "#0369a1",
      categoria: "Administración",
    });
  }

  // PERSONAL

  if (
    esAdministrador &&
    tieneAlgunPermiso([
      "empleados.crear",
      "empleados.ver",
      "empleados.editar",
      "empleados.desactivar",
    ])
  ) {

    modulosDisponibles.push({
      id: "personal",
      icono: "👥",
      titulo: "Personal",
      descripcion:
        "Gestiona administrativamente al personal del laboratorio.",
      fondo: "#ccfbf1",
      color: "#0f766e",
      categoria: "Administración",
    });
  }

  // PACIENTES

  if (
    tieneAlgunPermiso([
      "pacientes.crear",
      "pacientes.editar",
      "pacientes.ver",
    ])
  ) {

    modulosDisponibles.push({
      id: "pacientes",
      icono: "🧑‍⚕️",
      titulo: "Pacientes",
      descripcion:
        "Registra, consulta y administra la información de los pacientes.",
      fondo: "#dcfce7",
      color: "#15803d",
      categoria: "Gestión clínica",
    });
  }

  // ANÁLISIS

  if (
    tieneAlgunPermiso([
      "analisis.crear",
      "analisis.editar",
      "analisis.ver",
    ])
  ) {

    modulosDisponibles.push({
      id: "analisis",
      icono: "🔬",
      titulo: "Análisis clínicos",
      descripcion:
        "Consulta y administra el catálogo de análisis clínicos.",
      fondo: "#cffafe",
      color: "#0e7490",
      categoria: "Gestión clínica",
    });
  }

  // SOLICITUDES

  if (esRecepcionista) {

    modulosDisponibles.push({
      id: "solicitudes",
      icono: "📋",
      titulo: "Solicitudes de análisis",
      descripcion:
        "Registra y consulta las solicitudes de análisis clínicos.",
      fondo: "#ede9fe",
      color: "#6d28d9",
      categoria: "Recepción",
    });
  }

  // VENTAS

  if (tienePermiso("ventas.ver")) {

    modulosDisponibles.push({
      id: "ventas",
      icono: "💳",
      titulo: "Ventas",
      descripcion:
        "Consulta las ventas, órdenes y pagos registrados.",
      fondo: "#fef3c7",
      color: "#a16207",
      categoria: "Recepción",
    });
  }

  // MUESTRAS

  if (
    esBioquimico ||
    esRecepcionista
  ) {

    modulosDisponibles.push({
      id: "muestras",
      icono: "🧪",
      titulo: "Muestras",
      descripcion:
        "Registro, recepción, validación y seguimiento de muestras clínicas.",
      fondo: "#ccfbf1",
      color: "#0f766e",
      categoria: "Laboratorio",
      destacado: true,
    });
  }

  // RESULTADOS

  if (
    esRecepcionista ||
    (
      (esAdministrador || esBioquimico) &&
      tienePermiso("resultados.ver")
    )
  ) {

    modulosDisponibles.push({
      id: "resultados",
      icono: "📊",
      titulo: "Resultados",
      descripcion:
        "Registro, estado, validación, informes e historial de resultados clínicos.",
      fondo: "#dbeafe",
      color: "#1d4ed8",
      categoria: "Laboratorio",
      destacado: true,
    });
  }

  // NOTIFICACIONES

  if (esRecepcionista) {

    modulosDisponibles.push({
      id: "notificaciones_recepcion",
      icono: "🔔",
      titulo: "Notificaciones",
      descripcion:
        "Consulta las notificaciones relacionadas con el laboratorio.",
      fondo: "#fee2e2",
      color: "#b91c1c",
      categoria: "Recepción",
    });
  }

  // HISTORIAL DE PACIENTES

  if (esRecepcionista) {

    modulosDisponibles.push({
      id: "historial_pacientes",
      icono: "📚",
      titulo: "Historial de pacientes",
      descripcion:
        "Consulta los antecedentes y registros clínicos de los pacientes.",
      fondo: "#e0f2fe",
      color: "#0369a1",
      categoria: "Recepción",
    });
  }

  // RESULTADOS DE RECEPCIÓN

  if (esRecepcionista) {

    modulosDisponibles.push({
      id: "resultados_recepcion",
      icono: "📄",
      titulo: "Resultados y notas de venta",
      descripcion:
        "Consulta resultados disponibles y documentos de los pacientes.",
      fondo: "#dcfce7",
      color: "#15803d",
      categoria: "Recepción",
    });
  }

  // ADMINISTRACIÓN

  if (esAdministrador) {

    modulosDisponibles.push({
      id: "sprint3Admin",
      icono: "📈",
      titulo: "Panel del laboratorio",
      descripcion:
        "Consulta estadísticas, reportes y funciones administrativas.",
      fondo: "#ede9fe",
      color: "#7c3aed",
      categoria: "Administración",
    });
  }

  // =====================================================
  // INTERFAZ PRINCIPAL SIN BARRA SUPERIOR
  // =====================================================

  return (
    <main className="dashboard-page">

      <style>
        {`

          .dashboard-page {
            --dash-primary: #19385f;
            --dash-blue: #2563eb;
            --dash-border: #e2e8f0;

            min-height: 100vh;

            padding:
              30px
              clamp(16px, 4vw, 55px)
              55px;

            background:
              linear-gradient(
                180deg,
                #f8fafc,
                #eef3f9
              );

            font-family:
              Inter,
              system-ui,
              -apple-system,
              "Segoe UI",
              sans-serif;

            color: #0f172a;
          }

          .dashboard-page *,
          .dashboard-page *::before,
          .dashboard-page *::after {
            box-sizing: border-box;
          }

          .dashboard-container {
            width: 100%;
            max-width: 1500px;
            margin: 0 auto;
          }

          /* ==========================================
             PRESENTACIÓN PRINCIPAL
          ========================================== */

          .dashboard-hero {
            position: relative;

            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 25px;
            flex-wrap: wrap;

            min-height: 240px;

            padding: 35px;

            border-radius: 23px;

            color: #ffffff;

            overflow: hidden;
          }

          .dashboard-hero-content {
            position: relative;
            z-index: 2;

            flex: 1 1 300px;
            max-width: 750px;
          }

          .dashboard-hero-label {
            display: inline-block;

            padding: 8px 13px;

            background: rgba(255,255,255,0.15);

            border: 1px solid rgba(255,255,255,0.20);
            border-radius: 25px;

            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.4px;
          }

          .dashboard-hero h1 {
            margin: 19px 0 13px;

            color: #ffffff;

            font-size: clamp(27px, 4vw, 43px);
            font-weight: 850;

            letter-spacing: -1px;
          }

          .dashboard-hero p {
            margin: 0;

            font-size: 14px;
            line-height: 1.8;

            color: #f1f5f9;
          }

          .dashboard-hero-icon {
            position: relative;
            z-index: 2;

            width: 130px;
            height: 130px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 28px;

            background: rgba(255,255,255,0.15);

            font-size: 62px;

            overflow: hidden;
          }

          .dashboard-hero-badges {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;

            margin-top: 23px;
          }

          .dashboard-hero-badges span {
            padding: 9px 14px;

            background: rgba(255,255,255,0.15);

            border-radius: 25px;

            font-size: 12px;
            font-weight: 700;
          }

          /* ==========================================
             INFORMACIÓN DEL USUARIO
          ========================================== */

          .dashboard-information {
            display: grid;

            grid-template-columns:
              repeat(
                auto-fit,
                minmax(210px, 1fr)
              );

            gap: 15px;
            margin-top: 23px;
          }

          .dashboard-info-card {
            display: flex;
            align-items: center;

            gap: 13px;

            min-width: 0;

            padding: 20px;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 16px;

            box-shadow:
              0 4px 15px rgba(15,23,42,0.035);
          }

          .dashboard-info-icon {
            width: 48px;
            height: 48px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            background: #eff6ff;
            border-radius: 13px;

            font-size: 22px;
          }

          .dashboard-info-text {
            min-width: 0;
          }

          .dashboard-info-text span {
            display: block;

            margin-bottom: 6px;

            color: #64748b;

            font-size: 10px;
            font-weight: 800;

            letter-spacing: 0.5px;
          }

          .dashboard-info-text strong {
            display: block;

            color: #19385f;

            font-size: 13px;
            font-weight: 800;

            overflow-wrap: anywhere;
          }

          /* ==========================================
             ENCABEZADO DE MÓDULOS
          ========================================== */

          .dashboard-section {
            margin-top: 38px;
          }

          .dashboard-section-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;

            gap: 15px;
            flex-wrap: wrap;

            margin-bottom: 23px;
          }

          .dashboard-section-label {
            display: block;

            color: #2563eb;

            font-size: 10px;
            font-weight: 900;

            letter-spacing: 1.5px;
          }

          .dashboard-section h2 {
            margin: 8px 0;

            color: #19385f;

            font-size: 27px;
            font-weight: 850;
          }

          .dashboard-section-description {
            margin: 0;

            color: #64748b;

            font-size: 13px;
            line-height: 1.7;
          }

          .dashboard-count {
            padding: 10px 15px;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 12px;

            color: #475569;

            font-size: 12px;
            font-weight: 800;
          }

          /* ==========================================
             TARJETAS DE MÓDULOS
          ========================================== */

          .dashboard-modules {
            display: grid;

            grid-template-columns:
              repeat(
                auto-fit,
                minmax(260px, 1fr)
              );

            gap: 19px;
          }

          .dashboard-module {
            display: flex;
            flex-direction: column;

            min-height: 270px;

            padding: 24px;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 20px;

            box-shadow:
              0 5px 23px rgba(15,23,42,0.04);

            transition:
              transform 0.2s,
              box-shadow 0.2s,
              border-color 0.2s;
          }

          .dashboard-module:hover {
            transform: translateY(-4px);

            border-color: #bfdbfe;

            box-shadow:
              0 18px 40px rgba(15,23,42,0.09);
          }

          .dashboard-module-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 10px;
          }

          .dashboard-module-icon {
            width: 60px;
            height: 60px;

            display: grid;
            place-items: center;

            border-radius: 16px;

            font-size: 28px;
          }

          .dashboard-module-category {
            padding: 7px 11px;

            background: #f8fafc;
            border-radius: 20px;

            color: #64748b;

            font-size: 10px;
            font-weight: 800;
          }

          .dashboard-module h3 {
            margin: 20px 0 10px;

            color: #19385f;

            font-size: 20px;
            font-weight: 850;
          }

          .dashboard-module p {
            margin: 0 0 24px;

            color: #64748b;

            font-size: 13px;
            line-height: 1.7;

            flex-grow: 1;
          }

          .dashboard-module-button {
            width: 100%;
            min-height: 46px;

            border: none;
            border-radius: 11px;

            font-size: 12px;
            font-weight: 850;

            cursor: pointer;

            transition: 0.2s;
          }

          .dashboard-module-button:hover {
            filter: brightness(0.95);
          }

          /* ==========================================
             PIE DE PÁGINA
          ========================================== */

          .dashboard-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 15px;
            flex-wrap: wrap;

            margin-top: 40px;
            padding: 23px;

            background: #ffffff;

            border: 1px solid #e2e8f0;
            border-radius: 18px;
          }

          .dashboard-footer strong {
            display: block;

            color: #19385f;

            font-size: 14px;
          }

          .dashboard-footer span {
            display: block;

            margin-top: 6px;

            color: #64748b;

            font-size: 12px;
          }

          .dashboard-logout {
            padding: 12px 19px;

            border: 1px solid #fecaca;
            border-radius: 11px;

            background: #fff1f2;

            color: #dc2626;

            font-size: 12px;
            font-weight: 800;

            cursor: pointer;
          }

          .dashboard-logout:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          /* ==========================================
             RESPONSIVE
          ========================================== */

          @media (max-width: 768px) {

            .dashboard-page {
              padding: 18px 13px 40px;
            }

            .dashboard-hero {
              padding: 25px;
            }

            .dashboard-hero-icon {
              width: 85px;
              height: 85px;

              font-size: 40px;
            }

            .dashboard-modules {
              grid-template-columns:
                repeat(
                  auto-fit,
                  minmax(230px, 1fr)
                );
            }
          }

          @media (max-width: 500px) {

            .dashboard-hero h1 {
              font-size: 27px;
            }

            .dashboard-hero-icon {
              display: none;
            }

            .dashboard-modules {
              grid-template-columns: 1fr;
            }

            .dashboard-footer {
              flex-direction: column;
              align-items: stretch;
            }

            .dashboard-logout {
              width: 100%;
            }
          }

        `}
      </style>

      <div className="dashboard-container">

        {/* ================================================
            ENCABEZADO PRINCIPAL

            AQUÍ YA NO EXISTEN:
            - ClinicalLab
            - Sistema activo
            - Botón Menú
            - Barra Inicio / Pacientes / Muestras / Resultados
        ================================================ */}

        <section
          className="dashboard-hero"
          style={{
            background: `linear-gradient(
              120deg,
              ${colorPrimario},
              ${colorSecundario}
            )`,

            boxShadow:
              `0 20px 45px ${hexToRgba(
                colorPrimario,
                0.16
              )}`,
          }}
        >

          <div className="dashboard-hero-content">

            <span className="dashboard-hero-label">
              PANEL PRINCIPAL
            </span>

            <h1>
              {nombreLaboratorio}
            </h1>

            <p>
              Bienvenido,{" "}
              <strong>
                {nombreUsuario || "Usuario"}
              </strong>.
              <br />

              Administra las actividades y consulta
              la información de tu laboratorio desde
              un espacio de trabajo centralizado.
            </p>

            <div className="dashboard-hero-badges">

              <span>
                {nombreRol(rol)}
              </span>

              <span>
                {modulosDisponibles.length} módulos
              </span>

            </div>

          </div>

          <div className="dashboard-hero-icon">

            {laboratorio?.logoUrl ? (

              <img
                src={laboratorio.logoUrl}
                alt="Logo del laboratorio"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  padding: "12px",
                  background: "rgba(255,255,255,0.9)",
                }}
              />

            ) : (

              <span>🧬</span>

            )}

          </div>

        </section>

        {/* ================================================
            INFORMACIÓN DEL USUARIO
        ================================================ */}

        <section className="dashboard-information">

          <InfoCard
            titulo="USUARIO"
            valor={nombreUsuario || "Sin nombre"}
            icono="👤"
          />

          <InfoCard
            titulo="CORREO ELECTRÓNICO"
            valor={usuario.email || "No registrado"}
            icono="✉️"
          />

          <InfoCard
            titulo="ROL ASIGNADO"
            valor={nombreRol(rol)}
            icono="🛡️"
          />

          <InfoCard
            titulo="ESTADO DE CUENTA"
            valor="Activo"
            icono="●"
            valorColor="#059669"
          />

        </section>

        {/* ================================================
            MÓDULOS DISPONIBLES
        ================================================ */}

        <section className="dashboard-section">

          <div className="dashboard-section-header">

            <div>

              <span className="dashboard-section-label">
                ÁREA DE TRABAJO
              </span>

              <h2>
                Módulos disponibles
              </h2>

              <p className="dashboard-section-description">
                Selecciona el módulo que deseas utilizar.
                Las operaciones están protegidas según
                los permisos de tu cuenta.
              </p>

            </div>

            <span className="dashboard-count">
              {modulosDisponibles.length} módulos
            </span>

          </div>

          <div className="dashboard-modules">

            {modulosDisponibles.map((modulo) => (

              <ModuloCard
                key={modulo.id}
                modulo={modulo}
                onClick={() => navegar(modulo.id)}
              />

            ))}

          </div>

          {modulosDisponibles.length === 0 && (

            <div
              style={{
                padding: "40px",
                marginTop: "15px",

                textAlign: "center",

                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
              }}
            >

              <div style={{ fontSize: "40px" }}>
                🔒
              </div>

              <h3 style={{ color: "#19385f" }}>
                No hay módulos disponibles
              </h3>

              <p style={{ color: "#64748b" }}>
                Tu usuario no tiene permisos asignados
                para acceder a los módulos del sistema.
              </p>

            </div>

          )}

        </section>

        {/* ================================================
            PIE DE PÁGINA
        ================================================ */}

        <footer className="dashboard-footer">

          <div>

            <strong>
              {usuario.email || "Usuario activo"}
            </strong>

            <span>
              Sesión activa · {nombreRol(rol)}
            </span>

          </div>

          <button
            type="button"
            className="dashboard-logout"
            onClick={cerrarSesion}
            disabled={cerrandoSesion}
          >

            {cerrandoSesion
              ? "Cerrando sesión..."
              : "↪ Cerrar sesión"}

          </button>

        </footer>

      </div>

    </main>
  );
}

// =====================================================
// TARJETA DE MÓDULO
// =====================================================

function ModuloCard({ modulo, onClick }) {

  return (
    <article className="dashboard-module">

      <div className="dashboard-module-top">

        <div
          className="dashboard-module-icon"
          style={{
            background: modulo.fondo,
          }}
        >
          {modulo.icono}
        </div>

        <span className="dashboard-module-category">
          {modulo.categoria}
        </span>

      </div>

      <h3>
        {modulo.titulo}
      </h3>

      <p>
        {modulo.descripcion}
      </p>

      <button
        type="button"
        className="dashboard-module-button"
        onClick={onClick}
        style={{
          background: modulo.fondo,
          color: modulo.color,
        }}
      >
        Abrir módulo →
      </button>

    </article>
  );
}

// =====================================================
// TARJETA DE INFORMACIÓN
// =====================================================

function InfoCard({
  titulo,
  valor,
  icono,
  valorColor = "#19385f",
}) {

  return (
    <article className="dashboard-info-card">

      <div className="dashboard-info-icon">
        {icono}
      </div>

      <div className="dashboard-info-text">

        <span>
          {titulo}
        </span>

        <strong style={{ color: valorColor }}>
          {valor}
        </strong>

      </div>

    </article>
  );
}

// =====================================================
// CONTENEDOR DE MÓDULOS
// =====================================================

function ContenedorModulo({
  children,
  onVolver,
}) {

  return (
    <main
      style={{
        minHeight: "100vh",

        padding: "25px",

        background: "#f1f5f9",

        fontFamily:
          'Inter, system-ui, "Segoe UI", sans-serif',
      }}
    >

      <div
        style={{
          maxWidth: "1450px",
          margin: "0 auto",
        }}
      >

        <button
          type="button"
          onClick={onVolver}
          style={{
            marginBottom: "20px",
            padding: "12px 20px",

            background: "#19385f",
            color: "#ffffff",

            border: "none",
            borderRadius: "11px",

            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Volver al Dashboard
        </button>

        {children}

      </div>

    </main>
  );
}

// =====================================================
// PANTALLA DE ESTADO
// =====================================================

function PantallaEstado({
  icono,
  titulo,
  texto,
}) {

  return (
    <main
      style={{
        minHeight: "100vh",

        display: "grid",
        placeItems: "center",

        padding: "20px",

        background:
          "linear-gradient(135deg, #0f172a, #172554, #2563eb)",

        fontFamily:
          'Inter, system-ui, "Segoe UI", sans-serif',
      }}
    >

      <section
        style={{
          width: "min(430px, 100%)",

          padding: "40px",

          borderRadius: "22px",

          background: "#ffffff",

          textAlign: "center",
        }}
      >

        <div
          style={{
            fontSize: "45px",
            marginBottom: "15px",
          }}
        >
          {icono}
        </div>

        <h2 style={{ color: "#19385f" }}>
          {titulo}
        </h2>

        <p
          style={{
            color: "#64748b",
            lineHeight: 1.8,
          }}
        >
          {texto}
        </p>

      </section>

    </main>
  );
}

// =====================================================
// OBTENER NOMBRE DEL ROL
// =====================================================

function nombreRol(rol) {

  switch (rol) {

    case "super_admin":
      return "Super Administrador";

    case "administrador":
      return "Administrador";

    case "recepcionista":
      return "Recepcionista";

    case "bioquimico":
      return "Bioquímico";

    case "paciente":
      return "Paciente";

    default:
      return rol || "Sin rol";
  }
}

// =====================================================
// VALIDAR COLOR HEXADECIMAL
// =====================================================

function validarColor(color) {

  return (
    typeof color === "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(color)
  );
}

// =====================================================
// CONVERTIR COLOR A RGBA
// =====================================================

function hexToRgba(hex, alpha = 1) {

  if (!validarColor(hex)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =====================================================
// EXPORTAR DASHBOARD
// =====================================================

export default Dashboard;