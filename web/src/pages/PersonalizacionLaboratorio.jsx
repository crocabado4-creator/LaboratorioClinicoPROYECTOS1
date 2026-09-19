import {
  useEffect,
  useState,
} from "react";

import {
  actualizarPersonalizacion,
  obtenerPersonalizacion,
} from "../services/personalizacionService";

function PersonalizacionLaboratorio({
  usuario,
  volver,
}) {
  const [nombre, setNombre] =
    useState("");

  const [logoUrl, setLogoUrl] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  useEffect(() => {
    cargarPersonalizacion();
  }, []);

  const cargarPersonalizacion =
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
          await obtenerPersonalizacion(
            usuario.laboratorioId
          );

        setNombre(
          laboratorio.nombre || ""
        );

        setLogoUrl(
          laboratorio.logoUrl || ""
        );

      } catch (error) {
        console.error(
          "Error al cargar personalización:",
          error
        );

        if (
          error.code ===
          "permission-denied"
        ) {
          setMensaje(
            "No tiene permiso para consultar la personalización."
          );
        } else {
          setMensaje(
            "No se pudo cargar la personalización."
          );
        }

      } finally {
        setCargando(false);
      }
    };

  const guardar = async (e) => {
    e.preventDefault();

    setMensaje("");

    if (
      nombre.trim() === ""
    ) {
      setMensaje(
        "El nombre del laboratorio es obligatorio."
      );

      return;
    }

    try {
      setGuardando(true);

      await actualizarPersonalizacion(
        usuario.laboratorioId,
        {
          nombre,
          logoUrl,
        }
      );

      setMensaje(
        "Personalización guardada correctamente."
      );

    } catch (error) {
      console.error(
        "Error al guardar personalización:",
        error
      );

      if (
        error.code ===
        "permission-denied"
      ) {
        setMensaje(
          "No tiene permiso para modificar la personalización."
        );
      } else {
        setMensaje(
          "No se pudo guardar la personalización."
        );
      }

    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <p>
        Cargando personalización...
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
        Personalización del sistema
      </h1>

      {mensaje && (
        <p>
          {mensaje}
        </p>
      )}

      <form
        onSubmit={guardar}
      >

        <div>
          <label>
            Nombre visible del laboratorio
          </label>

          <br />

          <input
            type="text"
            value={nombre}
            onChange={(e) =>
              setNombre(
                e.target.value
              )
            }
          />
        </div>

        <br />

        <div>
          <label>
            URL del logo
          </label>

          <br />

          <input
            type="text"
            value={logoUrl}
            onChange={(e) =>
              setLogoUrl(
                e.target.value
              )
            }
            placeholder="https://..."
          />
        </div>

        <br />

        <h3>
          Vista previa
        </h3>

        {logoUrl && (
          <div>

            <img
              src={logoUrl}
              alt="Logo del laboratorio"
              width="120"
              onError={(e) => {
                e.currentTarget.style.display =
                  "none";
              }}
            />

          </div>
        )}

        <h2>
          {nombre ||
            "Nombre del laboratorio"}
        </h2>

        <button
          type="submit"
          disabled={guardando}
        >
          {guardando
            ? "Guardando..."
            : "Guardar personalización"}
        </button>

      </form>

    </div>
  );
}

export default PersonalizacionLaboratorio;