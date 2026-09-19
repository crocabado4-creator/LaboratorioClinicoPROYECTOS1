import {
  useEffect,
  useState,
} from "react";

import {
  actualizarConfiguracionLaboratorio,
  obtenerLaboratorio,
} from "../services/configuracionLaboratorioService";


const formularioInicial = {
  nombre: "",
  direccion: "",
  telefono: "",
  email: "",
};


function ConfiguracionLaboratorio({
  usuario,
  volver,
}) {
  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

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
    cargarLaboratorio();
  }, []);


  const cargarLaboratorio =
    async () => {
      try {
        setCargando(true);
        setMensaje("");

        if (
          !usuario.laboratorioId
        ) {
          setMensaje(
            "El usuario no está asociado a un laboratorio."
          );

          return;
        }

        const laboratorio =
          await obtenerLaboratorio(
            usuario.laboratorioId
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

      } catch (error) {
        console.error(
          "Error al cargar laboratorio:",
          error
        );

        if (
          error.code ===
          "permission-denied"
        ) {
          setMensaje(
            "No tiene permiso para consultar este laboratorio."
          );
        } else {
          setMensaje(
            "No se pudo cargar la información del laboratorio."
          );
        }

      } finally {
        setCargando(false);
      }
    };


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


  const guardarCambios =
    async (e) => {
      e.preventDefault();

      setMensaje("");

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
        setGuardando(true);

        await actualizarConfiguracionLaboratorio(
          usuario.laboratorioId,
          formulario
        );

        setMensaje(
          "Configuración actualizada correctamente."
        );

      } catch (error) {
        console.error(
          "Error al actualizar laboratorio:",
          error
        );

        if (
          error.code ===
          "permission-denied"
        ) {
          setMensaje(
            "No tiene permiso para modificar este laboratorio."
          );
        } else {
          setMensaje(
            "No se pudo actualizar la configuración."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  if (cargando) {
    return (
      <p>
        Cargando información del laboratorio...
      </p>
    );
  }


  return (
    <div>

      <button
        onClick={volver}
      >
        Volver al Dashboard
      </button>

      <h1>
        Configuración del laboratorio
      </h1>

      <p>
        Laboratorio:
        {" "}
        {usuario.laboratorioId}
      </p>

      {mensaje && (
        <p>
          {mensaje}
        </p>
      )}

      <form
        onSubmit={
          guardarCambios
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
          disabled={
            guardando
          }
        >
          {guardando
            ? "Guardando..."
            : "Guardar cambios"}
        </button>

      </form>

    </div>
  );
}

export default ConfiguracionLaboratorio;