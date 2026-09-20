import {
  useEffect,
  useState,
} from "react";

import {
  actualizarPersonal,
  cambiarEstadoPersonal,
  crearPersonal,
  obtenerPersonal,
} from "../services/personalService";

const formularioInicial = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  rol: "",
};

function GestionPersonal({
  usuario,
  permisos,
  volver,
}) {
  const puedeCrear =
    permisos.includes(
      "empleados.crear"
    );

  const puedeVer =
    permisos.includes(
      "empleados.ver"
    );

  const puedeEditar =
    permisos.includes(
      "empleados.editar"
    );

  const puedeCambiarEstado =
    permisos.includes(
      "empleados.desactivar"
    );

  const [
    personal,
    setPersonal,
  ] = useState([]);

  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

  const [
    editandoId,
    setEditandoId,
  ] = useState(null);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  useEffect(() => {
    cargarPersonal();
  }, []);

  const cargarPersonal =
    async () => {
      try {
        setCargando(true);

        if (
          !usuario.laboratorioId
        ) {
          setMensaje(
            "El administrador no está asociado a un laboratorio."
          );

          return;
        }

        if (!puedeVer) {
          return;
        }

        const resultado =
          await obtenerPersonal(
            usuario.laboratorioId
          );

        setPersonal(resultado);

      } catch (error) {
        console.error(
          "Error al cargar personal:",
          error
        );

        setMensaje(
          "No se pudo cargar el personal."
        );

      } finally {
        setCargando(false);
      }
    };

  const manejarCambio = (
    e
  ) => {
    const {
      name,
      value,
    } = e.target;

    setFormulario({
      ...formulario,
      [name]: value,
    });
  };

  const guardar = async (
    e
  ) => {
    e.preventDefault();

    setMensaje("");

    if (
      formulario.nombre.trim() === "" ||
      formulario.apellido.trim() === "" ||
      formulario.rol === ""
    ) {
      setMensaje(
        "Debe completar los campos obligatorios."
      );

      return;
    }

    if (
      formulario.rol !==
        "recepcionista" &&
      formulario.rol !==
        "bioquimico"
    ) {
      setMensaje(
        "Debe seleccionar un rol válido."
      );

      return;
    }

    if (
      !editandoId &&
      (
        formulario.email.trim() === "" ||
        formulario.password === ""
      )
    ) {
      setMensaje(
        "Correo y contraseña son obligatorios."
      );

      return;
    }

    if (
      !editandoId &&
      formulario.password.length < 6
    ) {
      setMensaje(
        "La contraseña debe tener al menos 6 caracteres."
      );

      return;
    }

    try {
      setGuardando(true);

      if (editandoId) {
        if (!puedeEditar) {
          setMensaje(
            "No tiene permiso para editar personal."
          );

          return;
        }

        await actualizarPersonal(
          editandoId,
          formulario
        );

        setMensaje(
          "Personal actualizado correctamente."
        );

      } else {
        if (!puedeCrear) {
          setMensaje(
            "No tiene permiso para registrar personal."
          );

          return;
        }

        await crearPersonal({
          ...formulario,

          laboratorioId:
            usuario.laboratorioId,
        });

        setMensaje(
          "Personal registrado correctamente."
        );
      }

      setFormulario(
        formularioInicial
      );

      setEditandoId(null);

      await cargarPersonal();

    } catch (error) {
      console.error(
        "Error al guardar personal:",
        error
      );

      if (
        error.code ===
        "auth/email-already-in-use"
      ) {
        setMensaje(
          "El correo ya está registrado."
        );

      } else if (
        error.code ===
        "auth/invalid-email"
      ) {
        setMensaje(
          "El correo ingresado no es válido."
        );

      } else if (
        error.code ===
        "permission-denied"
      ) {
        setMensaje(
          "No tiene permisos para realizar esta operación."
        );

      } else {
        setMensaje(
          "No se pudo guardar el personal."
        );
      }

    } finally {
      setGuardando(false);
    }
  };

  const editar = (
    empleado
  ) => {
    if (!puedeEditar) {
      return;
    }

    setEditandoId(
      empleado.id
    );

    setFormulario({
      nombre:
        empleado.nombre || "",

      apellido:
        empleado.apellido || "",

      email:
        empleado.email || "",

      password: "",

      rol:
        empleado.rol || "",
    });

    setMensaje("");
  };

  const cancelarEdicion =
    () => {
      setEditandoId(null);

      setFormulario(
        formularioInicial
      );

      setMensaje("");
    };

  const cambiarEstado =
    async (
      empleado
    ) => {
      if (
        !puedeCambiarEstado
      ) {
        return;
      }

      try {
        await cambiarEstadoPersonal(
          empleado.id,
          !empleado.activo
        );

        setMensaje(
          empleado.activo
            ? "Integrante desactivado correctamente."
            : "Integrante activado correctamente."
        );

        await cargarPersonal();

      } catch (error) {
        console.error(
          "Error al cambiar estado:",
          error
        );

        setMensaje(
          "No se pudo cambiar el estado del integrante."
        );
      }
    };

  return (
    <div>

      <button
        onClick={volver}
      >
        Volver al Dashboard
      </button>

      <h1>
        Gestión de personal
      </h1>

      <p>
        Laboratorio:{" "}
        {usuario.laboratorioId}
      </p>

      {mensaje && (
        <p>
          {mensaje}
        </p>
      )}

      {(
        (!editandoId &&
          puedeCrear) ||
        (editandoId &&
          puedeEditar)
      ) && (
        <>
          <h2>
            {editandoId
              ? "Editar integrante"
              : "Registrar integrante"}
          </h2>

          <form
            onSubmit={guardar}
          >

            <div>
              <label>
                Nombre
              </label>

              <br />

              <input
                type="text"
                name="nombre"
                value={
                  formulario.nombre
                }
                onChange={
                  manejarCambio
                }
              />
            </div>

            <br />

            <div>
              <label>
                Apellido
              </label>

              <br />

              <input
                type="text"
                name="apellido"
                value={
                  formulario.apellido
                }
                onChange={
                  manejarCambio
                }
              />
            </div>

            <br />

            <div>
              <label>
                Correo
              </label>

              <br />

              <input
                type="email"
                name="email"
                value={
                  formulario.email
                }
                onChange={
                  manejarCambio
                }
                disabled={
                  editandoId !== null
                }
              />
            </div>

            {!editandoId && (
              <>
                <br />

                <div>
                  <label>
                    Contraseña inicial
                  </label>

                  <br />

                  <input
                    type="password"
                    name="password"
                    value={
                      formulario.password
                    }
                    onChange={
                      manejarCambio
                    }
                  />
                </div>
              </>
            )}

            <br />

            <div>
              <label>
                Rol
              </label>

              <br />

              <select
                name="rol"
                value={
                  formulario.rol
                }
                onChange={
                  manejarCambio
                }
              >
                <option value="">
                  Seleccione un rol
                </option>

                <option
                  value="recepcionista"
                >
                  Recepcionista
                </option>

                <option
                  value="bioquimico"
                >
                  Bioquímico
                </option>
              </select>
            </div>

            <br />

            <button
              type="submit"
              disabled={
                guardando
              }
            >
              {guardando
                ? "Guardando..."
                : editandoId
                  ? "Guardar cambios"
                  : "Registrar integrante"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={
                  cancelarEdicion
                }
              >
                Cancelar
              </button>
            )}

          </form>

          <hr />
        </>
      )}

      <h2>
        Personal registrado
      </h2>

      {!puedeVer ? (
        <p>
          No tiene permiso para consultar personal.
        </p>

      ) : cargando ? (
        <p>
          Cargando personal...
        </p>

      ) : personal.length === 0 ? (
        <p>
          No existe personal registrado.
        </p>

      ) : (
        <table
          border="1"
          cellPadding="10"
          cellSpacing="0"
        >

          <thead>
            <tr>
              <th>
                Nombre
              </th>

              <th>
                Correo
              </th>

              <th>
                Rol
              </th>

              <th>
                Estado
              </th>

              <th>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>

            {personal.map(
              (empleado) => (
                <tr
                  key={
                    empleado.id
                  }
                >

                  <td>
                    {empleado.nombre}{" "}
                    {empleado.apellido}
                  </td>

                  <td>
                    {empleado.email}
                  </td>

                  <td>
                    {empleado.rol ===
                    "bioquimico"
                      ? "Bioquímico"
                      : "Recepcionista"}
                  </td>

                  <td>
                    {empleado.activo
                      ? "Activo"
                      : "Inactivo"}
                  </td>

                  <td>

                    {puedeEditar && (
                      <button
                        onClick={() =>
                          editar(
                            empleado
                          )
                        }
                      >
                        Editar
                      </button>
                    )}

                    {puedeCambiarEstado && (
                      <button
                        onClick={() =>
                          cambiarEstado(
                            empleado
                          )
                        }
                      >
                        {empleado.activo
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    )}

                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>
      )}

    </div>
  );
}

export default GestionPersonal;