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
// NUEVOS MÓDULOS PARA RECEPCIONISTA
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
// DASHBOARD PRINCIPAL
// =====================================================

function Dashboard({ usuario, onLogout }) {
  const [permisos, setPermisos] = useState([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(true);

  const [vista, setVista] = useState("dashboard");

  const [laboratorio, setLaboratorio] = useState(null);

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

        const resultado = await obtenerPermisosRol(usuario.rol);

        if (!activo) return;

        setPermisos(
          Array.isArray(resultado) ? resultado : []
        );
      } catch (error) {
        console.error("Error al cargar permisos:", error);

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
  }, [usuario?.laboratorioId, vista]);

  // =====================================================
  // PERMISOS
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
  // ROLES
  // =====================================================

  const esSuperAdmin = usuario?.rol === "super_admin";

  const esAdministrador = usuario?.rol === "administrador";

  const esRecepcionista = usuario?.rol === "recepcionista";

  const esBioquimico = usuario?.rol === "bioquimico";

  // =====================================================
  // NAVEGACIÓN
  // =====================================================

  const irDashboard = () => {
    setVista("dashboard");
  };

  const navegar = (modulo) => {
    setVista(modulo);
  };

  // =====================================================
  // CERRAR SESIÓN
  // =====================================================

  const cerrarSesion = async () => {
    const confirmar = window.confirm(
      "¿Deseas cerrar sesión?"
    );

    if (!confirmar) return;

    try {
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
    }
  };

  // =====================================================
  // VALIDAR SESIÓN
  // =====================================================

  if (!usuario) {
    return (
      <PantallaEstado
        icono="⚠️"
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
  // ADMINISTRADOR - ROLES
  // =====================================================

  if (
    esAdministrador &&
    vista === "roles" &&
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
  // ADMINISTRADOR - CONFIGURACIÓN
  // =====================================================

  if (
    esAdministrador &&
    vista === "configuracion" &&
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
  // ADMINISTRADOR - PERSONAL
  // =====================================================

  if (
    esAdministrador &&
    vista === "personal" &&
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
  // ANÁLISIS CLÍNICOS
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
  // SOLICITUDES - RECEPCIONISTA
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
  // VENTAS
  // =====================================================

  if (vista === "ventas") {
    return (
      <GestionVentas
        usuario={usuario}
        onVolver={irDashboard}
      />
    );
  }

  // =====================================================
  // MUESTRAS - BIOQUÍMICO
  // =====================================================

  if (
    vista === "muestras" &&
    esBioquimico
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
  // NOTIFICACIONES - RECEPCIONISTA
  // =====================================================

  if (
    vista === "notificaciones_recepcion" &&
    esRecepcionista
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "30px",
          background: "#f1f5f9",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <button
            type="button"
            onClick={irDashboard}
            style={{
              padding: "12px 20px",
              marginBottom: "20px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ← Volver al Dashboard
          </button>

          <NotificacionesRecepcion
            laboratorioId={usuario.laboratorioId}
            usuarioId={usuario.uid}
          />
        </div>
      </div>
    );
  }

  // =====================================================
  // NUEVO MÓDULO: HISTORIAL DE PACIENTES
  // RECEPCIONISTA
  // =====================================================

  if (
    vista === "historial_pacientes" &&
    esRecepcionista
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f1f5f9",
          padding: "25px",
        }}
      >
        <div
          style={{
            maxWidth: "1450px",
            margin: "0 auto",
          }}
        >
          <BotonVolver
            onClick={irDashboard}
          />

          <HistorialPacientes
            usuario={usuario}
          />
        </div>
      </div>
    );
  }

  // =====================================================
  // NUEVO MÓDULO: RESULTADOS DE RECEPCIÓN
  // =====================================================

  if (
    vista === "resultados_recepcion" &&
    esRecepcionista
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f1f5f9",
          padding: "25px",
        }}
      >
        <div
          style={{
            maxWidth: "1450px",
            margin: "0 auto",
          }}
        >
          <BotonVolver
            onClick={irDashboard}
          />

          <ResultadosRecepcion
            usuario={usuario}
          />
        </div>
      </div>
    );
  }

  // =====================================================
  // PANEL ADMINISTRADOR - SPRINT 3
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
  // RESULTADOS - ADMINISTRADOR
  // =====================================================

  if (
    vista === "resultados" &&
    esAdministrador &&
    tienePermiso("resultados.ver")
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
  // RESULTADOS - BIOQUÍMICO
  // =====================================================

  if (
    vista === "resultados" &&
    esBioquimico &&
    tienePermiso("resultados.ver")
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
  // PERSONALIZACIÓN DEL LABORATORIO
  // =====================================================

  const colorPrimario = validarColor(
    laboratorio?.colorPrimario
  )
    ? laboratorio.colorPrimario
    : "#2563EB";

  const colorSecundario = validarColor(
    laboratorio?.colorSecundario
  )
    ? laboratorio.colorSecundario
    : "#0EA5E9";

  const nombreLaboratorio =
    laboratorio?.nombreVisible ||
    laboratorio?.nombre ||
    "Laboratorio Clínico";

  // =====================================================
  // DASHBOARD PRINCIPAL
  // =====================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        color: "#0f172a",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1450px",
          margin: "0 auto",
        }}
      >
        {/* ==========================================
            CABECERA
        ========================================== */}

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "30px",
            minHeight: "250px",
            padding: "38px 42px",
            borderRadius: "26px",
            background: `linear-gradient(
              125deg,
              ${colorPrimario} 0%,
              ${colorSecundario} 100%
            )`,
            color: "#ffffff",
            boxShadow: `0 24px 55px ${hexToRgba(
              colorPrimario,
              0.22
            )}`,
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 2,
              maxWidth: "720px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                padding: "7px 11px",
                marginBottom: "15px",
                borderRadius: "30px",
                background: "rgba(255,255,255,.12)",
                fontSize: "10px",
                fontWeight: "800",
                letterSpacing: "1px",
              }}
            >
              PANEL PRINCIPAL
            </span>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(30px, 4vw, 48px)",
                lineHeight: 1.15,
              }}
            >
              {nombreLaboratorio}
            </h1>

            <p
              style={{
                margin: "14px 0 0",
                fontSize: "14px",
              }}
            >
              Bienvenido,{" "}
              <strong>
                {usuario.nombre} {usuario.apellido}
              </strong>
            </p>

            <p
              style={{
                margin: "5px 0 0",
                fontSize: "11px",
              }}
            >
              {nombreRol(usuario.rol)}
            </p>

            {/* NOTIFICACIONES RECEPCIONISTA */}

            {esRecepcionista && (
              <button
                type="button"
                onClick={() =>
                  navegar("notificaciones_recepcion")
                }
                style={{
                  marginTop: "20px",
                  padding: "12px 18px",
                  border:
                    "1px solid rgba(255,255,255,.4)",
                  borderRadius: "12px",
                  background:
                    "rgba(255,255,255,.2)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🔔 Ver notificaciones
              </button>
            )}
          </div>

          {/* LOGOTIPO */}

          <div
            style={{
              position: "relative",
              zIndex: 2,
              width: "135px",
              height: "135px",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              borderRadius: "30px",
              background:
                "rgba(255,255,255,.16)",
            }}
          >
            {laboratorio?.logoUrl ? (
              <img
                src={laboratorio.logoUrl}
                alt="Logo del laboratorio"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  padding: "13px",
                  boxSizing: "border-box",
                  background:
                    "rgba(255,255,255,.93)",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: "58px",
                }}
              >
                🧪
              </span>
            )}
          </div>
        </section>

        {/* ==========================================
            INFORMACIÓN DEL USUARIO
        ========================================== */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "14px",
            marginTop: "22px",
          }}
        >
          <InfoCard
            titulo="Usuario"
            valor={`${usuario.nombre || ""} ${
              usuario.apellido || ""
            }`.trim()}
            icono="👤"
            color={colorPrimario}
          />

          <InfoCard
            titulo="Correo"
            valor={usuario.email || "Sin correo"}
            icono="✉️"
            color={colorPrimario}
          />

          <InfoCard
            titulo="Rol"
            valor={nombreRol(usuario.rol)}
            icono="🛡️"
            color={colorPrimario}
          />

          <InfoCard
            titulo="Estado"
            valor="Activo"
            icono="●"
            valorColor="#059669"
            color={colorPrimario}
          />
        </section>

        {/* ==========================================
            MÓDULOS DISPONIBLES
        ========================================== */}

        <section
          style={{
            marginTop: "36px",
          }}
        >
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                color: colorPrimario,
                fontSize: "10px",
                fontWeight: "900",
                letterSpacing: "1.2px",
              }}
            >
              ÁREA DE TRABAJO
            </span>

            <h2
              style={{
                margin: "5px 0 5px",
                fontSize: "25px",
              }}
            >
              Módulos disponibles
            </h2>

            <p
              style={{
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              Accede a las funciones disponibles
              para tu cuenta.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {/* ======================================
                ROLES Y PERMISOS
            ====================================== */}

            {esAdministrador &&
              tienePermiso("roles.asignar") && (
                <ModuloCard
                  icono="🛡️"
                  titulo="Roles y permisos"
                  descripcion="Gestiona los roles asignados al personal de tu laboratorio."
                  fondo="#EEF2FF"
                  color="#4338CA"
                  onClick={() => navegar("roles")}
                />
              )}

            {/* ======================================
                CONFIGURACIÓN
            ====================================== */}

            {esAdministrador &&
              tienePermiso(
                "configuracion.editar"
              ) && (
                <ModuloCard
                  icono="⚙️"
                  titulo="Configuración"
                  descripcion="Actualiza los datos generales del laboratorio."
                  fondo="#E0F2FE"
                  color="#0369A1"
                  onClick={() =>
                    navegar("configuracion")
                  }
                />
              )}

            {/* ======================================
                PERSONAL
            ====================================== */}

            {esAdministrador &&
              tieneAlgunPermiso([
                "empleados.crear",
                "empleados.ver",
                "empleados.editar",
                "empleados.desactivar",
              ]) && (
                <ModuloCard
                  icono="👥"
                  titulo="Personal"
                  descripcion="Administra Recepcionistas y Bioquímicos."
                  fondo="#CCFBF1"
                  color="#0F766E"
                  onClick={() => navegar("personal")}
                />
              )}

            {/* ======================================
                PACIENTES
            ====================================== */}

            {tieneAlgunPermiso([
              "pacientes.crear",
              "pacientes.editar",
              "pacientes.ver",
            ]) && (
              <ModuloCard
                icono="🧑‍⚕️"
                titulo="Pacientes"
                descripcion="Gestiona los pacientes del laboratorio."
                fondo="#DCFCE7"
                color="#15803D"
                onClick={() => navegar("pacientes")}
              />
            )}

            {/* ======================================
                ANÁLISIS CLÍNICOS
            ====================================== */}

            {tieneAlgunPermiso([
              "analisis.crear",
              "analisis.editar",
              "analisis.ver",
            ]) && (
              <ModuloCard
                icono="🔬"
                titulo="Análisis clínicos"
                descripcion="Consulta y administra los análisis clínicos."
                fondo="#CFFAFE"
                color="#0E7490"
                onClick={() => navegar("analisis")}
              />
            )}

            {/* ======================================
                SOLICITUDES DE ANÁLISIS
            ====================================== */}

            {esRecepcionista && (
              <ModuloCard
                icono="📋"
                titulo="Solicitudes de análisis"
                descripcion="Registra y consulta solicitudes de análisis."
                fondo="#EDE9FE"
                color="#6D28D9"
                onClick={() =>
                  navegar("solicitudes")
                }
              />
            )}

            {/* ======================================
                VENTAS
            ====================================== */}

            {tienePermiso("ventas.ver") && (
              <ModuloCard
                icono="💳"
                titulo="Ventas"
                descripcion="Consulta y administra las ventas registradas."
                fondo="#FEF3C7"
                color="#A16207"
                onClick={() => navegar("ventas")}
              />
            )}

            {/* ======================================
                MUESTRAS - BIOQUÍMICO
            ====================================== */}

            {esBioquimico && (
              <ModuloCard
                icono="🧪"
                titulo="Muestras"
                descripcion="Registra, acepta, rechaza y procesa muestras."
                fondo="#CCFBF1"
                color="#0F766E"
                onClick={() => navegar("muestras")}
              />
            )}

            {/* ======================================
                NOTIFICACIONES - RECEPCIONISTA
            ====================================== */}

            {esRecepcionista && (
              <ModuloCard
                icono="🔔"
                titulo="Notificaciones"
                descripcion="Consulta muestras rechazadas, contaminadas y procesadas. Coordina nuevas tomas cuando sea necesario."
                fondo="#FEE2E2"
                color="#B91C1C"
                onClick={() =>
                  navegar(
                    "notificaciones_recepcion"
                  )
                }
              />
            )}

            {/* ======================================
                NUEVO: HISTORIAL DE PACIENTES
            ====================================== */}

            {esRecepcionista && (
              <ModuloCard
                icono="📚"
                titulo="Historial de pacientes"
                descripcion="Busca pacientes, consulta su historial de solicitudes, órdenes, muestras, ventas y resultados. Descarga el historial en PDF."
                fondo="#E0F2FE"
                color="#0369A1"
                onClick={() =>
                  navegar("historial_pacientes")
                }
              />
            )}

            {/* ======================================
                NUEVO: RESULTADOS DE RECEPCIÓN
            ====================================== */}

            {esRecepcionista && (
              <ModuloCard
                icono="📄"
                titulo="Resultados y notas de venta"
                descripcion="Busca pacientes, consulta los resultados clínicos disponibles y descarga sus notas de venta."
                fondo="#DCFCE7"
                color="#15803D"
                onClick={() =>
                  navegar("resultados_recepcion")
                }
              />
            )}

            {/* ======================================
                PANEL DEL ADMINISTRADOR
            ====================================== */}

            {esAdministrador && (
              <ModuloCard
                icono="📈"
                titulo="Panel del laboratorio"
                descripcion="Dashboard, reportes, notificaciones y auditoría."
                fondo="#EDE9FE"
                color="#7C3AED"
                onClick={() =>
                  navegar("sprint3Admin")
                }
              />
            )}

            {/* ======================================
                RESULTADOS ADMINISTRADOR/BIOQUÍMICO
            ====================================== */}

            {!esRecepcionista &&
              tienePermiso("resultados.ver") && (
                <ModuloCard
                  icono="📊"
                  titulo="Resultados"
                  descripcion={
                    esAdministrador
                      ? "Consulta los resultados clínicos."
                      : "Registra, consulta y valida los resultados clínicos."
                  }
                  fondo="#DBEAFE"
                  color="#1D4ED8"
                  onClick={() =>
                    navegar("resultados")
                  }
                />
              )}
          </div>
        </section>

        {/* ==========================================
            CERRAR SESIÓN
        ========================================== */}

        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
            marginTop: "35px",
            padding: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            background: "#ffffff",
          }}
        >
          <div>
            <strong>
              {usuario.email}
            </strong>

            <p
              style={{
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              Sesión activa
            </p>
          </div>

          <button
            type="button"
            onClick={cerrarSesion}
            style={{
              padding: "11px 17px",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              background: "#fff1f2",
              color: "#dc2626",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </section>
      </div>
    </main>
  );
}

// =====================================================
// BOTÓN VOLVER
// =====================================================

function BotonVolver({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 20px",
        marginBottom: "20px",
        background: "#2563eb",
        color: "#ffffff",
        border: "none",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: "700",
        cursor: "pointer",
        boxShadow:
          "0 4px 12px rgba(37,99,235,.15)",
      }}
    >
      ← Volver al Dashboard
    </button>
  );
}

// =====================================================
// TARJETA DE MÓDULO
// =====================================================

function ModuloCard({
  icono,
  titulo,
  descripcion,
  fondo,
  color,
  onClick,
}) {
  return (
    <article
      style={{
        minHeight: "215px",
        display: "flex",
        flexDirection: "column",
        padding: "22px",
        border: "1px solid #e2e8f0",
        borderRadius: "18px",
        background: "#ffffff",
        boxShadow:
          "0 7px 24px rgba(15,23,42,.05)",
        transition:
          "transform .2s, box-shadow .2s",
      }}
    >
      <div
        style={{
          width: "50px",
          height: "50px",
          display: "grid",
          placeItems: "center",
          borderRadius: "14px",
          background: fondo,
          fontSize: "23px",
        }}
      >
        {icono}
      </div>

      <h3
        style={{
          margin: "18px 0 7px",
          fontSize: "17px",
          color: "#0f172a",
        }}
      >
        {titulo}
      </h3>

      <p
        style={{
          margin: "0 0 18px",
          color: "#64748b",
          fontSize: "11px",
          lineHeight: 1.6,
        }}
      >
        {descripcion}
      </p>

      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          marginTop: "auto",
          padding: "11px 12px",
          border: "none",
          borderRadius: "10px",
          background: fondo,
          color,
          fontWeight: "900",
          cursor: "pointer",
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
  valorColor = "#0f172a",
  color = "#2563EB",
}) {
  return (
    <article
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "17px",
        border: "1px solid #e2e8f0",
        borderRadius: "15px",
        background: "#ffffff",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "12px",
          background: hexToRgba(
            color,
            0.1
          ),
          fontSize: "18px",
        }}
      >
        {icono}
      </div>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontSize: "10px",
          }}
        >
          {titulo}
        </span>

        <strong
          style={{
            display: "block",
            marginTop: "3px",
            color: valorColor,
            fontSize: "12px",
            overflowWrap: "anywhere",
          }}
        >
          {valor}
        </strong>
      </div>
    </article>
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
      }}
    >
      <section
        style={{
          width: "min(430px, 100%)",
          padding: "38px",
          borderRadius: "22px",
          background: "#ffffff",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "40px",
          }}
        >
          {icono}
        </div>

        <h2>
          {titulo}
        </h2>

        <p>
          {texto}
        </p>
      </section>
    </main>
  );
}

// =====================================================
// NOMBRE DEL ROL
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
// VALIDAR COLOR
// =====================================================

function validarColor(color) {
  return (
    typeof color === "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(color)
  );
}

// =====================================================
// CONVERTIR HEX A RGBA
// =====================================================

function hexToRgba(hex, alpha = 1) {
  if (!validarColor(hex)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const r = parseInt(
    hex.slice(1, 3),
    16
  );

  const g = parseInt(
    hex.slice(3, 5),
    16
  );

  const b = parseInt(
    hex.slice(5, 7),
    16
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =====================================================
// EXPORTAR DASHBOARD
// =====================================================

export default Dashboard;