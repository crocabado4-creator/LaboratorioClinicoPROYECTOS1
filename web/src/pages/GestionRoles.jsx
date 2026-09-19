import { useEffect, useState } from "react";

import { auth } from "../firebase/firebase";

import {
  actualizarRolUsuario,
  obtenerRolesAsignables,
  obtenerUsuariosLaboratorio,
} from "../services/rolesService";

function GestionRoles({ usuario, volver }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setMensaje("");

      const usuariosLaboratorio =
        await obtenerUsuariosLaboratorio(
          usuario.laboratorioId
        );

      const rolesDisponibles =
        await obtenerRolesAsignables();

      setUsuarios(usuariosLaboratorio);
      setRoles(rolesDisponibles);

    } catch (error) {
      console.error(
        "Error al cargar usuarios y roles:",
        error
      );

      setMensaje(
        "No se pudieron cargar los usuarios y roles."
      );

    } finally {
      setCargando(false);
    }
  };

  const cambiarRol = async (
    uid,
    nuevoRol,
    rolActual
  ) => {
    // Evitar valor vacío
    if (!nuevoRol) {
      return;
    }

    // Evitar actualización innecesaria
    if (nuevoRol === rolActual) {
      return;
    }

    try {
      setMensaje("");

      await actualizarRolUsuario(
        uid,
        nuevoRol
      );

      // Actualizamos la tabla sin recargar la página
      setUsuarios((usuariosActuales) =>
        usuariosActuales.map((u) =>
          u.id === uid
            ? {
                ...u,
                rol: nuevoRol,
              }
            : u
        )
      );

      setMensaje(
        "Rol actualizado correctamente."
      );

    } catch (error) {
      console.error(
        "Error al actualizar rol:",
        error
      );

      if (
        error.code === "permission-denied"
      ) {
        setMensaje(
          "No tiene permisos para actualizar este rol."
        );
      } else {
        setMensaje(
          "No se pudo actualizar el rol."
        );
      }
    }
  };

  if (cargando) {
    return (
      <div>
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div>

      <button onClick={volver}>
        Volver al Dashboard
      </button>

      <h1>
        Roles y permisos
      </h1>

      <p>
        Laboratorio:{" "}
        {usuario.laboratorioId}
      </p>

      {mensaje && (
        <p>{mensaje}</p>
      )}

      <table
        border="1"
        cellPadding="10"
        cellSpacing="0"
      >
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol actual</th>
            <th>Estado</th>
            <th>Asignar rol</th>
          </tr>
        </thead>

        <tbody>

          {usuarios.map((u) => {

            const esMismoUsuario =
              auth.currentUser?.uid === u.id;

            const esAdministrador =
              u.rol === "administrador";

            const esSuperAdmin =
              u.rol === "super_admin";

            const puedeEditar =
              !esMismoUsuario &&
              !esAdministrador &&
              !esSuperAdmin;

            return (
              <tr key={u.id}>

                <td>
                  {u.nombre}{" "}
                  {u.apellido}
                </td>

                <td>
                  {u.email}
                </td>

                <td>
                  {u.rol}
                </td>

                <td>
                  {u.activo
                    ? "Activo"
                    : "Inactivo"}
                </td>

                <td>

                  {puedeEditar ? (

                    <select
                      value={u.rol}
                      onChange={(e) =>
                        cambiarRol(
                          u.id,
                          e.target.value,
                          u.rol
                        )
                      }
                    >

                      {roles.map((rol) => (
                        <option
                          key={rol.id}
                          value={rol.id}
                        >
                          {rol.nombre}
                        </option>
                      ))}

                    </select>

                  ) : (

                    <span>
                      No modificable
                    </span>

                  )}

                </td>

              </tr>
            );
          })}

        </tbody>
      </table>

      {usuarios.length === 0 && (
        <p>
          No existen usuarios registrados
          en este laboratorio.
        </p>
      )}

    </div>
  );
}

export default GestionRoles;