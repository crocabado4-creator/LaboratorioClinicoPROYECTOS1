import { useEffect, useState } from "react";

import {
  actualizarLaboratorio,
  cambiarEstadoLaboratorio,
  crearLaboratorio,
  obtenerLaboratorios,
} from "../services/laboratoriosService";

const formularioInicial = {
  nombre: "",
  direccion: "",
  telefono: "",
  email: "",
};

function GestionLaboratorios({
  permisos,
  volver,
}) {
  // =========================================
  // PERMISOS
  // =========================================

  const puedeCrear =
    permisos.includes(
      "laboratorios.crear"
    );

  const puedeVer =
    permisos.includes(
      "laboratorios.ver"
    );

  const puedeEditar =
    permisos.includes(
      "laboratorios.editar"
    );

  const puedeCambiarEstado =
    permisos.includes(
      "laboratorios.desactivar"
    );

  // =========================================
  // ESTADOS
  // =========================================

  const [laboratorios, setLaboratorios] =
    useState([]);

  const [formulario, setFormulario] =
    useState(formularioInicial);

  const [editandoId, setEditandoId] =
    useState(null);

  const [mensaje, setMensaje] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  // =========================================
  // CARGAR LABORATORIOS
  // =========================================

  useEffect(() => {
    if (puedeVer) {
      cargarLaboratorios();
    } else {
      setCargando(false);
    }
  }, [puedeVer]);

  const cargarLaboratorios = async () => {
    try {
      setCargando(true);

      const datos =
        await obtenerLaboratorios();

      setLaboratorios(datos);

    } catch (error) {
      console.error(
        "Error al cargar laboratorios:",
        error
      );

      if (
        error.code ===
        "permission-denied"
      ) {
        setMensaje(
          "No tiene permisos para consultar laboratorios."
        );
      } else {
        setMensaje(
          "No se pudieron cargar los laboratorios."
        );
      }

    } finally {
      setCargando(false);
    }
  };

  // =========================================
  // FORMULARIO
  // =========================================

  const manejarCambio = (e) => {
    const {
      name,
      value,
    } = e.target;

    setFormulario({
      ...formulario,
      [name]: value,
    });
  };

  // =========================================
  // GUARDAR / ACTUALIZAR
  // =========================================

  const guardarLaboratorio =
    async (e) => {
      e.preventDefault();

      setMensaje("");

      // Si está editando, debe tener permiso editar
      if (
        editandoId &&
        !puedeEditar
      ) {
        setMensaje(
          "No tiene permiso para editar laboratorios."
        );

        return;
      }

      // Si está creando, debe tener permiso crear
      if (
        !editandoId &&
        !puedeCrear
      ) {
        setMensaje(
          "No tiene permiso para registrar laboratorios."
        );

        return;
      }

      if (
        formulario.nombre.trim() === "" ||
        formulario.direccion.trim() === "" ||
        formulario.telefono.trim() === "" ||
        formulario.email.trim() === ""
      ) {
        setMensaje(
          "Debe completar todos los campos."
        );

        return;
      }

      try {
        if (editandoId) {
          await actualizarLaboratorio(
            editandoId,
            formulario
          );

          setMensaje(
            "Laboratorio actualizado correctamente."
          );

        } else {
          await crearLaboratorio(
            formulario
          );

          setMensaje(
            "Laboratorio registrado correctamente."
          );
        }

        setFormulario(
          formularioInicial
        );

        setEditandoId(null);

        if (puedeVer) {
          await cargarLaboratorios();
        }

      } catch (error) {
        console.error(
          "Error al guardar laboratorio:",
          error
        );

        if (
          error.code ===
          "permission-denied"
        ) {
          setMensaje(
            "No tiene permisos para realizar esta operación."
          );
        } else {
          setMensaje(
            "No se pudo guardar el laboratorio."
          );
        }
      }
    };

  // =========================================
  // EDITAR
  // =========================================

  const editarLaboratorio = (
    laboratorio
  ) => {
    if (!puedeEditar) {
      setMensaje(
        "No tiene permiso para editar laboratorios."
      );

      return;
    }

    setEditandoId(
      laboratorio.id
    );

    setFormulario({
      nombre:
        laboratorio.nombre || "",

      direccion:
        laboratorio.direccion || "",

      telefono:
        laboratorio.telefono || "",

      email:
        laboratorio.email || "",
    });

    setMensaje("");
  };

  // =========================================
  // CANCELAR EDICIÓN
  // =========================================

  const cancelarEdicion = () => {
    setEditandoId(null);

    setFormulario(
      formularioInicial
    );

    setMensaje("");
  };

  // =========================================
  // ACTIVAR / DESACTIVAR
  // =========================================

  const cambiarEstado = async (
    laboratorio
  ) => {
    if (!puedeCambiarEstado) {
      setMensaje(
        "No tiene permiso para cambiar el estado del laboratorio."
      );

      return;
    }

    try {
      await cambiarEstadoLaboratorio(
        laboratorio.id,
        !laboratorio.activo
      );

      setMensaje(
        laboratorio.activo
          ? "Laboratorio desactivado correctamente."
          : "Laboratorio activado correctamente."
      );

      if (puedeVer) {
        await cargarLaboratorios();
      }

    } catch (error) {
      console.error(
        "Error al cambiar estado:",
        error
      );

      if (
        error.code ===
        "permission-denied"
      ) {
        setMensaje(
          "No tiene permisos para cambiar el estado del laboratorio."
        );
      } else {
        setMensaje(
          "No se pudo cambiar el estado del laboratorio."
        );
      }
    }
  };

  // =========================================
  // INTERFAZ
  // =========================================

  return (
    <div>

      <button onClick={volver}>
        Volver al Dashboard
      </button>

      <h1>
        Gestión de laboratorios
      </h1>

      {mensaje && (
        <p>
          {mensaje}
        </p>
      )}

      {/* ===================================
          FORMULARIO CREAR / EDITAR
      =================================== */}

      {(
        (!editandoId &&
          puedeCrear) ||
        (editandoId &&
          puedeEditar)
      ) && (
        <>
          <h2>
            {editandoId
              ? "Editar laboratorio"
              : "Registrar laboratorio"}
          </h2>

          <form
            onSubmit={
              guardarLaboratorio
            }
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
                Dirección
              </label>

              <br />

              <input
                type="text"
                name="direccion"
                value={
                  formulario.direccion
                }
                onChange={
                  manejarCambio
                }
              />
            </div>

            <br />

            <div>
              <label>
                Teléfono
              </label>

              <br />

              <input
                type="text"
                name="telefono"
                value={
                  formulario.telefono
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
              />
            </div>

            <br />

            <button
              type="submit"
            >
              {editandoId
                ? "Guardar cambios"
                : "Registrar laboratorio"}
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

      {/* ===================================
          LISTADO
      =================================== */}

      <h2>
        Laboratorios registrados
      </h2>

      {!puedeVer ? (
        <p>
          No tiene permiso para consultar laboratorios.
        </p>

      ) : cargando ? (
        <p>
          Cargando laboratorios...
        </p>

      ) : laboratorios.length === 0 ? (
        <p>
          No existen laboratorios registrados.
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
                Dirección
              </th>

              <th>
                Teléfono
              </th>

              <th>
                Correo
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

            {laboratorios.map(
              (laboratorio) => (
                <tr
                  key={
                    laboratorio.id
                  }
                >

                  <td>
                    {
                      laboratorio.nombre
                    }
                  </td>

                  <td>
                    {
                      laboratorio.direccion
                    }
                  </td>

                  <td>
                    {
                      laboratorio.telefono
                    }
                  </td>

                  <td>
                    {
                      laboratorio.email
                    }
                  </td>

                  <td>
                    {laboratorio.activo
                      ? "Activo"
                      : "Inactivo"}
                  </td>

                  <td>

                    {puedeEditar && (
                      <button
                        onClick={() =>
                          editarLaboratorio(
                            laboratorio
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
                            laboratorio
                          )
                        }
                      >
                        {laboratorio.activo
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    )}

                    {!puedeEditar &&
                      !puedeCambiarEstado && (
                        <span>
                          Sin acciones disponibles
                        </span>
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

export default GestionLaboratorios;