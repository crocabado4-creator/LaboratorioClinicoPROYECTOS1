import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";

import { auth } from "../firebase/firebase";

import { obtenerPermisosRol } from "../services/rolesService";
import { obtenerPersonalizacion } from "../services/personalizacionService";

import GestionRoles from "./GestionRoles";
import GestionLaboratorios from "./GestionLaboratorios";
import ConfiguracionLaboratorio from "./ConfiguracionLaboratorio";
import PersonalizacionLaboratorio from "./PersonalizacionLaboratorio";
import GestionAdministradores from "./GestionAdministradores";
import GestionPersonal from "./GestionPersonal";

function Dashboard({
  usuario,
  onLogout,
}) {
  const [permisos, setPermisos] = useState([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(true);
  const [vista, setVista] = useState("dashboard");
  const [laboratorio, setLaboratorio] = useState(null);

  // =========================================
  // CARGAR PERMISOS DEL ROL
  // =========================================

  useEffect(() => {
    cargarPermisos();
  }, [usuario.rol]);

  const cargarPermisos = async () => {
    try {
      setCargandoPermisos(true);

      const resultado =
        await obtenerPermisosRol(
          usuario.rol
        );

      setPermisos(resultado);

      console.log(
        "Permisos del usuario:",
        resultado
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

  // =========================================
  // CARGAR INFORMACIÓN DEL LABORATORIO
  // =========================================

  useEffect(() => {
    const cargarLaboratorio =
      async () => {
        if (
          !usuario.laboratorioId
        ) {
          setLaboratorio(null);
          return;
        }

        try {
          const datos =
            await obtenerPersonalizacion(
              usuario.laboratorioId
            );

          setLaboratorio(datos);

        } catch (error) {
          console.error(
            "Error al cargar datos visibles del laboratorio:",
            error
          );

          setLaboratorio(null);
        }
      };

    cargarLaboratorio();

  }, [
    usuario.laboratorioId,
    vista,
  ]);

  // =========================================
  // FUNCIONES DE PERMISOS
  // =========================================

  const tienePermiso = (
    permiso
  ) => {
    return permisos.includes(
      permiso
    );
  };

  const tieneAlgunPermiso = (
    permisosNecesarios
  ) => {
    return permisosNecesarios.some(
      (permiso) =>
        permisos.includes(
          permiso
        )
    );
  };

  // =========================================
  // CERRAR SESIÓN
  // =========================================

  const cerrarSesion = async () => {
    try {
      await signOut(auth);

      localStorage.removeItem(
        "usuario"
      );

      onLogout();

    } catch (error) {
      console.error(
        "Error al cerrar sesión:",
        error
      );
    }
  };

  // =========================================
  // CARGANDO PERMISOS
  // =========================================

  if (cargandoPermisos) {
    return (
      <p>
        Cargando permisos...
      </p>
    );
  }

  // =========================================
  // HU-02
  // VISTA ROLES Y PERMISOS
  // =========================================

  if (
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

  // =========================================
  // HU-04
  // VISTA GESTIÓN DE LABORATORIOS
  // =========================================

  if (
    vista === "laboratorios" &&
    tieneAlgunPermiso([
      "laboratorios.crear",
      "laboratorios.ver",
      "laboratorios.editar",
      "laboratorios.desactivar",
    ])
  ) {
    return (
      <GestionLaboratorios
        permisos={permisos}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }

  // =========================================
  // HU-05
  // VISTA CONFIGURACIÓN DEL LABORATORIO
  // =========================================

  if (
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

  // =========================================
  // HU-06
  // VISTA PERSONALIZACIÓN
  // =========================================

  if (
    vista === "personalizacion" &&
    tienePermiso(
      "personalizacion.editar"
    )
  ) {
    return (
      <PersonalizacionLaboratorio
        usuario={usuario}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }

  // =========================================
  // HU-07
  // VISTA GESTIÓN DE ADMINISTRADORES
  // =========================================

  if (
    vista === "administradores" &&
    tieneAlgunPermiso([
      "administradores.crear",
      "administradores.ver",
      "administradores.editar",
      "administradores.desactivar",
    ])
  ) {
    return (
      <GestionAdministradores
        permisos={permisos}
        volver={() =>
          setVista("dashboard")
        }
      />
    );
  }

  // =========================================
  // HU-08
  // VISTA GESTIÓN DE PERSONAL
  // =========================================

  if (
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

  // =========================================
  // DASHBOARD PRINCIPAL
  // =========================================

  return (
    <div>

      {/* =====================================
          LOGO DEL LABORATORIO
      ===================================== */}

      {laboratorio?.logoUrl && (
        <img
          src={
            laboratorio.logoUrl
          }
          alt="Logo del laboratorio"
          width="100"
          onError={(e) => {
            e.currentTarget.style.display =
              "none";
          }}
        />
      )}

      {/* =====================================
          NOMBRE DEL LABORATORIO
      ===================================== */}

      <h1>
        {laboratorio?.nombre ||
          "Laboratorio Clínico"}
      </h1>

      <h2>
        Dashboard
      </h2>

      <p>
        Bienvenido:{" "}
        {usuario.nombre}{" "}
        {usuario.apellido}
      </p>

      <p>
        Correo:{" "}
        {usuario.email}
      </p>

      <p>
        Rol:{" "}
        {usuario.rol}
      </p>

      {usuario.laboratorioId && (
        <p>
          Laboratorio:{" "}
          {usuario.laboratorioId}
        </p>
      )}

      <hr />

      <h2>
        Módulos disponibles
      </h2>

      {/* =====================================
          HU-04
          SUPER ADMIN - LABORATORIOS
      ===================================== */}

      {tieneAlgunPermiso([
        "laboratorios.crear",
        "laboratorios.ver",
        "laboratorios.editar",
        "laboratorios.desactivar",
      ]) && (
        <button
          onClick={() =>
            setVista(
              "laboratorios"
            )
          }
        >
          Gestión de laboratorios
        </button>
      )}

      {/* =====================================
          HU-07
          SUPER ADMIN - ADMINISTRADORES
      ===================================== */}

      {tieneAlgunPermiso([
        "administradores.crear",
        "administradores.ver",
        "administradores.editar",
        "administradores.desactivar",
      ]) && (
        <button
          onClick={() =>
            setVista(
              "administradores"
            )
          }
        >
          Gestión de administradores
        </button>
      )}

      {/* =====================================
          HU-05
          CONFIGURACIÓN
      ===================================== */}

      {tienePermiso(
        "configuracion.editar"
      ) && (
        <button
          onClick={() =>
            setVista(
              "configuracion"
            )
          }
        >
          Configuración del laboratorio
        </button>
      )}

      {/* =====================================
          HU-06
          PERSONALIZACIÓN
      ===================================== */}

      {tienePermiso(
        "personalizacion.editar"
      ) && (
        <button
          onClick={() =>
            setVista(
              "personalizacion"
            )
          }
        >
          Personalización
        </button>
      )}

      {/* =====================================
          HU-02
          ROLES Y PERMISOS
      ===================================== */}

      {tienePermiso(
        "roles.asignar"
      ) && (
        <button
          onClick={() =>
            setVista(
              "roles"
            )
          }
        >
          Roles y permisos
        </button>
      )}

      {/* =====================================
          HU-08
          GESTIÓN DE PERSONAL
      ===================================== */}

      {tieneAlgunPermiso([
        "empleados.crear",
        "empleados.ver",
        "empleados.editar",
        "empleados.desactivar",
      ]) && (
        <button
          onClick={() =>
            setVista(
              "personal"
            )
          }
        >
          Gestión de personal
        </button>
      )}

      {/* =====================================
          GESTIÓN DE PACIENTES
      ===================================== */}

      {tieneAlgunPermiso([
        "pacientes.crear",
        "pacientes.editar",
        "pacientes.ver",
      ]) && (
        <button>
          Gestión de pacientes
        </button>
      )}

      {/* =====================================
          GESTIÓN DE ANÁLISIS
      ===================================== */}

      {tieneAlgunPermiso([
        "analisis.crear",
        "analisis.editar",
        "analisis.ver",
      ]) && (
        <button>
          Gestión de análisis
        </button>
      )}

      {/* =====================================
          VENTAS
      ===================================== */}

      {tienePermiso(
        "ventas.ver"
      ) && (
        <button>
          Ventas
        </button>
      )}

      {/* =====================================
          RESULTADOS
      ===================================== */}

      {tienePermiso(
        "resultados.ver"
      ) && (
        <button>
          Resultados
        </button>
      )}

      {/* =====================================
          AUDITORÍA GLOBAL
      ===================================== */}

      {tienePermiso(
        "auditoria.ver_global"
      ) && (
        <button>
          Auditoría global
        </button>
      )}

      <br />
      <br />

      {/* =====================================
          CERRAR SESIÓN
      ===================================== */}

      <button
        onClick={
          cerrarSesion
        }
      >
        Cerrar sesión
      </button>

    </div>
  );
}

export default Dashboard;