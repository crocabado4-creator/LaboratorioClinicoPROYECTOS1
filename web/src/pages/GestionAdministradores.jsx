import {
  useEffect,
  useState,
} from "react";

import {
  actualizarAdministrador,
  cambiarEstadoAdministrador,
  crearAdministrador,
  obtenerAdministradores,
} from "../services/administradoresService";

import {
  obtenerLaboratorios,
} from "../services/laboratoriosService";

const formularioInicial = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  laboratorioId: "",
};

function GestionAdministradores({
  permisos,
  volver,
}) {
  const puedeCrear =
    permisos.includes(
      "administradores.crear"
    );

  const puedeVer =
    permisos.includes(
      "administradores.ver"
    );

  const puedeEditar =
    permisos.includes(
      "administradores.editar"
    );

  const puedeCambiarEstado =
    permisos.includes(
      "administradores.desactivar"
    );

  const [
    administradores,
    setAdministradores,
  ] = useState([]);

  const [
    laboratorios,
    setLaboratorios,
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
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos =
    async () => {
      try {
        setCargando(true);

        const listaLaboratorios =
          await obtenerLaboratorios();

        setLaboratorios(
          listaLaboratorios
        );

        if (puedeVer) {
          const listaAdministradores =
            await obtenerAdministradores();

          setAdministradores(
            listaAdministradores
          );
        }

      } catch (error) {
        console.error(
          "Error al cargar datos:",
          error
        );

        setMensaje(
          "No se pudieron cargar los datos."
        );

      } finally {
        setCargando(false);
      }
    };

  const manejarCambio =
    (e) => {
      const {
        name,
        value,
      } = e.target;

      setFormulario({
        ...formulario,
        [name]: value,
      });
    };

  const guardar =
    async (e) => {
      e.preventDefault();

      setMensaje("");

      if (
        formulario.nombre.trim() === "" ||
        formulario.apellido.trim() === "" ||
        formulario.laboratorioId === ""
      ) {
        setMensaje(
          "Debe completar todos los campos obligatorios."
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
          await actualizarAdministrador(
            editandoId,
            formulario
          );

          setMensaje(
            "Administrador actualizado correctamente."
          );

        } else {
          await crearAdministrador(
            formulario
          );

          setMensaje(
            "Administrador registrado correctamente."
          );
        }

        setFormulario(
          formularioInicial
        );

        setEditandoId(null);

        await cargarDatos();

      } catch (error) {
        console.error(
          "Error al guardar administrador:",
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
          "auth/weak-password"
        ) {
          setMensaje(
            "La contraseña es demasiado débil."
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
            "No se pudo guardar el administrador."
          );
        }

      } finally {
        setGuardando(false);
      }
    };

  const editar =
    (administrador) => {
      setEditandoId(
        administrador.id
      );

      setFormulario({
        nombre:
          administrador.nombre || "",

        apellido:
          administrador.apellido || "",

        email:
          administrador.email || "",

        password: "",

        laboratorioId:
          administrador.laboratorioId || "",
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
      administrador
    ) => {
      try {
        await cambiarEstadoAdministrador(
          administrador.id,
          !administrador.activo
        );

        setMensaje(
          administrador.activo
            ? "Administrador desactivado correctamente."
            : "Administrador activado correctamente."
        );

        await cargarDatos();

      } catch (error) {
        console.error(
          "Error al cambiar estado:",
          error
        );

        setMensaje(
          "No se pudo cambiar el estado del administrador."
        );
      }
    };

  const nombreLaboratorio =
    (laboratorioId) => {
      const laboratorio =
        laboratorios.find(
          (item) =>
            item.id ===
            laboratorioId
        );

      return laboratorio
        ? laboratorio.nombre
        : laboratorioId;
    };

  return (
    <div>

      <button onClick={volver}>
        Volver al Dashboard
      </button>

      <h1>
        Gestión de administradores
      </h1>

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
              ? "Editar administrador"
              : "Registrar administrador"}
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
                Laboratorio
              </label>

              <br />

              <select
                name="laboratorioId"
                value={
                  formulario.laboratorioId
                }
                onChange={
                  manejarCambio
                }
              >
                <option value="">
                  Seleccione un laboratorio
                </option>

                {laboratorios
                  .filter(
                    (laboratorio) =>
                      laboratorio.activo
                  )
                  .map(
                    (laboratorio) => (
                      <option
                        key={
                          laboratorio.id
                        }
                        value={
                          laboratorio.id
                        }
                      >
                        {
                          laboratorio.nombre
                        }
                      </option>
                    )
                  )}
              </select>
            </div>

            <br />

            <button
              type="submit"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : editandoId
                  ? "Guardar cambios"
                  : "Registrar administrador"}
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
        Administradores registrados
      </h2>

      {!puedeVer ? (
        <p>
          No tiene permiso para consultar administradores.
        </p>

      ) : cargando ? (
        <p>
          Cargando administradores...
        </p>

      ) : administradores.length === 0 ? (
        <p>
          No existen administradores registrados.
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
                Laboratorio
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
            {administradores.map(
              (administrador) => (
                <tr
                  key={
                    administrador.id
                  }
                >
                  <td>
                    {
                      administrador.nombre
                    }{" "}
                    {
                      administrador.apellido
                    }
                  </td>

                  <td>
                    {
                      administrador.email
                    }
                  </td>

                  <td>
                    {nombreLaboratorio(
                      administrador.laboratorioId
                    )}
                  </td>

                  <td>
                    {
                      administrador.activo
                        ? "Activo"
                        : "Inactivo"
                    }
                  </td>

                  <td>

                    {puedeEditar && (
                      <button
                        onClick={() =>
                          editar(
                            administrador
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
                            administrador
                          )
                        }
                      >
                        {administrador.activo
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

export default GestionAdministradores;