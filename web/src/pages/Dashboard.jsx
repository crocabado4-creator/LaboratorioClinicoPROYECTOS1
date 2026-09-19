import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";

import { auth } from "../firebase/firebase";

import { obtenerPermisosRol } from "../services/rolesService";
import { obtenerPersonalizacion } from "../services/personalizacionService";

import GestionRoles from "./GestionRoles";
import GestionLaboratorios from "./GestionLaboratorios";
import ConfiguracionLaboratorio from "./ConfiguracionLaboratorio";
import PersonalizacionLaboratorio from "./PersonalizacionLaboratorio";

function Dashboard({
  usuario,
  onLogout,
}) {
  const [permisos, setPermisos] = useState([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(true);
  const [vista, setVista] = useState("dashboard");

  const [laboratorio, setLaboratorio] = useState(null);

  // =========================================
  // CARGAR PERMISOS
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
  // CARGAR DATOS VISIBLES DEL LABORATORIO
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
  // VALIDAR PERMISOS
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
  // CARGANDO
  // =========================================

  if (cargandoPermisos) {
    return (
      <p>
        Cargando permisos...
      </p>
    );
  }

  // =========================================
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
  // VISTA LABORATORIOS
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
  // VISTA CONFIGURACIÓN
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
  // DASHBOARD
  // =========================================

  return (
    <div>

      {/* LOGO DEL LABORATORIO */}

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

      {/* NOMBRE PERSONALIZADO */}

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
          ADMINISTRADOR - CONFIGURACIÓN
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
          ADMINISTRADOR - PERSONALIZACIÓN
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
          ADMINISTRADOR - ROLES
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
          PERSONAL
      ===================================== */}

      {tieneAlgunPermiso([
        "empleados.crear",
        "empleados.editar",
      ]) && (
        <button>
          Gestión de personal
        </button>
      )}

      {/* =====================================
          PACIENTES
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
          ANÁLISIS
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