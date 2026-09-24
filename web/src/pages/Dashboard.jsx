import { useEffect, useState } from "react";

import {
  obtenerPermisosRol,
} from "../services/rolesService";

import {
  obtenerPersonalizacion,
} from "../services/personalizacionService";

import {
  cerrarSesionFirebase,
} from "../services/sessionService";

import GestionRoles from "./GestionRoles";
import ConfiguracionLaboratorio from "./ConfiguracionLaboratorio";
import GestionPersonal from "./GestionPersonal";

import SuperAdminDashboard from "./SuperAdminDashboard";
import SuperAdminLaboratorios from "./SuperAdminLaboratorios";
import SuperAdminPersonalizacion from "./SuperAdminPersonalizacion";
import SuperAdminAdministradores from "./SuperAdminAdministradores";
import SuperAdminUsuarios from "./SuperAdminUsuarios";
import SuperAdminRoles from "./SuperAdminRoles";
import SuperAdminAuditoria from "./SuperAdminAuditoria";


function Dashboard({
  usuario,
  onLogout,
}) {
  const [
    permisos,
    setPermisos,
  ] = useState([]);

  const [
    cargandoPermisos,
    setCargandoPermisos,
  ] = useState(true);

  const [
    vista,
    setVista,
  ] = useState("dashboard");

  const [
    laboratorio,
    setLaboratorio,
  ] = useState(null);


  useEffect(() => {
    const cargarPermisos =
      async () => {
        if (!usuario?.rol) {
          setPermisos([]);
          setCargandoPermisos(false);
          return;
        }

        try {
          setCargandoPermisos(true);

          const resultado =
            await obtenerPermisosRol(
              usuario.rol
            );

          setPermisos(
            Array.isArray(resultado)
              ? resultado
              : []
          );

        } catch (error) {
          console.error(
            "Error al cargar permisos:",
            error
          );

          setPermisos([]);

        } finally {
          setCargandoPermisos(false);
        }
      };

    cargarPermisos();

  }, [usuario?.rol]);


  useEffect(() => {
    const cargarLaboratorio =
      async () => {
        if (!usuario?.laboratorioId) {
          setLaboratorio(null);
          return;
        }

        try {
          const datos =
            await obtenerPersonalizacion(
              usuario.laboratorioId
            );

          setLaboratorio(
            datos || null
          );

        } catch (error) {
          console.error(
            "Error al cargar laboratorio:",
            error
          );

          setLaboratorio(null);
        }
      };

    cargarLaboratorio();

  }, [
    usuario?.laboratorioId,
    vista,
  ]);


  const tienePermiso = (
    permiso
  ) => {
    return permisos.includes(
      permiso
    );
  };


  const tieneAlgunPermiso = (
    lista
  ) => {
    return lista.some(
      (permiso) =>
        permisos.includes(
          permiso
        )
    );
  };


  const cerrarSesion =
    async () => {
      const confirmar =
        window.confirm(
          "¿Deseas cerrar sesión?"
        );

      if (!confirmar) {
        return;
      }

      try {
        await cerrarSesionFirebase();

        if (
          typeof onLogout ===
          "function"
        ) {
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


  if (
    usuario.rol === "super_admin" &&
    vista === "laboratorios"
  ) {
    return (
      <SuperAdminLaboratorios
        permisos={permisos}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "super_admin" &&
    vista === "personalizacion"
  ) {
    return (
      <SuperAdminPersonalizacion
        permisos={permisos}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "super_admin" &&
    vista === "administradores"
  ) {
    return (
      <SuperAdminAdministradores
        permisos={permisos}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "super_admin" &&
    vista === "usuarios"
  ) {
    return (
      <SuperAdminUsuarios
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "super_admin" &&
    vista === "roles"
  ) {
    return (
      <SuperAdminRoles
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "super_admin" &&
    vista === "auditoria"
  ) {
    return (
      <SuperAdminAuditoria
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "super_admin"
  ) {
    return (
      <SuperAdminDashboard
        usuario={usuario}
        onLogout={cerrarSesion}
        onNavigate={(modulo) =>
          setVista(modulo)
        }
      />
    );
  }


  if (
    usuario.rol === "administrador" &&
    vista === "roles" &&
    tienePermiso(
      "roles.asignar"
    )
  ) {
    return (
      <GestionRoles
        usuario={usuario}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "administrador" &&
    vista === "configuracion" &&
    tienePermiso(
      "configuracion.editar"
    )
  ) {
    return (
      <ConfiguracionLaboratorio
        usuario={usuario}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  if (
    usuario.rol === "administrador" &&
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
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }


  const colorPrimario =
    validarColor(
      laboratorio?.colorPrimario
    )
      ? laboratorio.colorPrimario
      : "#2563EB";

  const colorSecundario =
    validarColor(
      laboratorio?.colorSecundario
    )
      ? laboratorio.colorSecundario
      : "#0EA5E9";

  const nombreLaboratorio =
    laboratorio?.nombreVisible ||
    laboratorio?.nombre ||
    "Laboratorio Clínico";


  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        color: "#0f172a",
        fontFamily:
          "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1450px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "30px",
            minHeight: "250px",
            padding: "38px 42px",
            borderRadius: "26px",
            background:
              `linear-gradient(
                125deg,
                ${colorPrimario} 0%,
                ${colorSecundario} 100%
              )`,
            color: "#ffffff",
            boxShadow:
              `0 24px 55px ${hexToRgba(
                colorPrimario,
                0.22
              )}`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "350px",
              height: "350px",
              right: "-100px",
              top: "-150px",
              borderRadius: "50%",
              background:
                "rgba(255,255,255,.08)",
            }}
          />

          <div
            style={{
              position: "absolute",
              width: "200px",
              height: "200px",
              right: "240px",
              bottom: "-130px",
              borderRadius: "50%",
              background:
                "rgba(255,255,255,.06)",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              maxWidth: "720px",
            }}
          >
            <span
              style={{
                display:
                  "inline-flex",
                padding: "7px 11px",
                marginBottom: "15px",
                border:
                  "1px solid rgba(255,255,255,.15)",
                borderRadius: "30px",
                background:
                  "rgba(255,255,255,.12)",
                fontSize: "10px",
                fontWeight: "800",
                letterSpacing: "1px",
              }}
            >
              Panel principal
            </span>

            <h1
              style={{
                margin: 0,
                fontSize:
                  "clamp(30px, 4vw, 48px)",
                letterSpacing: "-1px",
              }}
            >
              {nombreLaboratorio}
            </h1>

            <p
              style={{
                margin:
                  "14px 0 0",
                color:
                  "rgba(255,255,255,.9)",
                fontSize: "14px",
              }}
            >
              Bienvenido,{" "}
              <strong>
                {usuario.nombre}{" "}
                {usuario.apellido}
              </strong>
            </p>

            <p
              style={{
                margin:
                  "5px 0 0",
                color:
                  "rgba(255,255,255,.72)",
                fontSize: "11px",
              }}
            >
              {nombreRol(
                usuario.rol
              )}
            </p>
          </div>

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
              border:
                "1px solid rgba(255,255,255,.2)",
              borderRadius: "30px",
              background:
                "rgba(255,255,255,.16)",
              backdropFilter:
                "blur(10px)",
            }}
          >
            {laboratorio?.logoUrl ? (
              <img
                src={
                  laboratorio.logoUrl
                }
                alt="Logo del laboratorio"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  padding: "13px",
                  background:
                    "rgba(255,255,255,.93)",
                }}
                onError={(
                  evento
                ) => {
                  evento.currentTarget.style.display =
                    "none";
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
            valor={
              `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim()
            }
            icono="👤"
            color={colorPrimario}
          />

          <InfoCard
            titulo="Correo"
            valor={
              usuario.email ||
              "Sin correo"
            }
            icono="✉️"
            color={colorPrimario}
          />

          <InfoCard
            titulo="Rol"
            valor={
              nombreRol(
                usuario.rol
              )
            }
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
                color:
                  colorPrimario,
                fontSize: "10px",
                fontWeight: "900",
                letterSpacing: "1.2px",
                textTransform:
                  "uppercase",
              }}
            >
              Área de trabajo
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
                margin: 0,
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              Accede a las funciones disponibles para tu cuenta.
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
            {usuario.rol ===
              "administrador" &&
              tienePermiso(
                "roles.asignar"
              ) && (
                <ModuloCard
                  icono="🛡️"
                  titulo="Roles y permisos"
                  descripcion="Gestiona los roles asignados al personal de tu laboratorio."
                  fondo="#EEF2FF"
                  color="#4338CA"
                  onClick={() =>
                    setVista("roles")
                  }
                />
              )}


            {usuario.rol ===
              "administrador" &&
              tienePermiso(
                "configuracion.editar"
              ) && (
                <ModuloCard
                  icono="⚙️"
                  titulo="Configuración"
                  descripcion="Actualiza los datos generales e institucionales del laboratorio."
                  fondo="#E0F2FE"
                  color="#0369A1"
                  onClick={() =>
                    setVista(
                      "configuracion"
                    )
                  }
                />
              )}


            {usuario.rol ===
              "administrador" &&
              tieneAlgunPermiso([
                "empleados.crear",
                "empleados.ver",
                "empleados.editar",
                "empleados.desactivar",
              ]) && (
                <ModuloCard
                  icono="👥"
                  titulo="Personal"
                  descripcion="Administra Recepcionistas y Bioquímicos de tu laboratorio."
                  fondo="#CCFBF1"
                  color="#0F766E"
                  onClick={() =>
                    setVista(
                      "personal"
                    )
                  }
                />
              )}


            {tieneAlgunPermiso([
              "pacientes.crear",
              "pacientes.editar",
              "pacientes.ver",
            ]) && (
              <ModuloCard
                icono="🧑‍⚕️"
                titulo="Pacientes"
                descripcion="Gestiona los datos de los pacientes del laboratorio."
                fondo="#DCFCE7"
                color="#15803D"
                onClick={() =>
                  window.alert(
                    "Este módulo estará disponible próximamente."
                  )
                }
              />
            )}


            {tieneAlgunPermiso([
              "analisis.crear",
              "analisis.editar",
              "analisis.ver",
            ]) && (
              <ModuloCard
                icono="🔬"
                titulo="Análisis clínicos"
                descripcion="Consulta y administra los análisis disponibles."
                fondo="#CFFAFE"
                color="#0E7490"
                onClick={() =>
                  window.alert(
                    "Este módulo estará disponible próximamente."
                  )
                }
              />
            )}


            {tienePermiso(
              "ventas.ver"
            ) && (
              <ModuloCard
                icono="💳"
                titulo="Ventas"
                descripcion="Consulta y administra las operaciones registradas."
                fondo="#FEF3C7"
                color="#A16207"
                onClick={() =>
                  window.alert(
                    "Este módulo estará disponible próximamente."
                  )
                }
              />
            )}


            {tienePermiso(
              "resultados.ver"
            ) && (
              <ModuloCard
                icono="📊"
                titulo="Resultados"
                descripcion="Consulta los resultados clínicos registrados."
                fondo="#DBEAFE"
                color="#1D4ED8"
                onClick={() =>
                  window.alert(
                    "Este módulo estará disponible próximamente."
                  )
                }
              />
            )}
          </div>
        </section>


        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            flexWrap: "wrap",
            gap: "15px",
            marginTop: "35px",
            padding: "20px",
            border:
              "1px solid #e2e8f0",
            borderRadius: "16px",
            background: "#ffffff",
            boxShadow:
              "0 5px 20px rgba(15,23,42,.04)",
          }}
        >
          <div>
            <strong
              style={{
                display: "block",
                color: "#0f172a",
                fontSize: "12px",
              }}
            >
              {usuario.email}
            </strong>

            <small
              style={{
                display: "block",
                marginTop: "4px",
                color: "#64748b",
              }}
            >
              Sesión activa
            </small>
          </div>

          <button
            type="button"
            onClick={
              cerrarSesion
            }
            style={{
              padding:
                "11px 17px",
              border:
                "1px solid #fecaca",
              borderRadius:
                "10px",
              background:
                "#fff1f2",
              color: "#dc2626",
              fontSize: "10px",
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
        border:
          "1px solid #e2e8f0",
        borderRadius: "18px",
        background: "#ffffff",
        boxShadow:
          "0 7px 24px rgba(15,23,42,.05)",
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
          color: "#0f172a",
          fontSize: "17px",
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
          padding:
            "11px 12px",
          border: "none",
          borderRadius: "10px",
          background: fondo,
          color,
          fontSize: "10px",
          fontWeight: "900",
          cursor: "pointer",
        }}
      >
        Abrir módulo →
      </button>
    </article>
  );
}


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
        border:
          "1px solid #e2e8f0",
        borderRadius: "15px",
        background: "#ffffff",
        boxShadow:
          "0 5px 20px rgba(15,23,42,.04)",
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
          background:
            hexToRgba(
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
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontSize: "8px",
            fontWeight: "900",
            textTransform:
              "uppercase",
            letterSpacing: ".8px",
          }}
        >
          {titulo}
        </span>

        <strong
          style={{
            marginTop: "3px",
            color: valorColor,
            fontSize: "11px",
            overflowWrap:
              "anywhere",
          }}
        >
          {valor}
        </strong>
      </div>
    </article>
  );
}


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
          "Inter, Arial, sans-serif",
      }}
    >
      <section
        style={{
          width:
            "min(430px, 100%)",
          padding: "38px",
          borderRadius: "22px",
          background: "#ffffff",
          textAlign: "center",
          boxShadow:
            "0 25px 70px rgba(0,0,0,.25)",
        }}
      >
        <div
          style={{
            width: "65px",
            height: "65px",
            display: "grid",
            placeItems: "center",
            margin:
              "0 auto 15px",
            borderRadius: "18px",
            background: "#eff6ff",
            fontSize: "30px",
          }}
        >
          {icono}
        </div>

        <h2
          style={{
            margin: "0 0 7px",
          }}
        >
          {titulo}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#64748b",
            fontSize: "12px",
          }}
        >
          {texto}
        </p>
      </section>
    </main>
  );
}


function nombreRol(
  rol
) {
  switch (rol) {
    case "super_admin":
      return "Super Administrador";

    case "administrador":
      return "Administrador";

    case "recepcionista":
      return "Recepcionista";

    case "bioquimico":
      return "Bioquímico";

    default:
      return rol || "Sin rol";
  }
}


function validarColor(
  color
) {
  return (
    typeof color ===
      "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(
      color
    )
  );
}


function hexToRgba(
  hex,
  alpha = 1
) {
  if (!validarColor(hex)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const r =
    parseInt(
      hex.slice(1, 3),
      16
    );

  const g =
    parseInt(
      hex.slice(3, 5),
      16
    );

  const b =
    parseInt(
      hex.slice(5, 7),
      16
    );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


export default Dashboard;