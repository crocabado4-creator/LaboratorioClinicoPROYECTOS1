import { useEffect, useMemo, useState } from "react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import "./SuperAdminModules.css";

function SuperAdminUsuarios({
  volver,
}) {
  const [usuarios, setUsuarios] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    const cargarUsuarios =
      async () => {
        try {
          setCargando(true);

          const snapshot =
            await getDocs(
              collection(
                db,
                "usuarios"
              )
            );

          const datos =
            snapshot.docs.map(
              (documento) => ({
                id: documento.id,
                ...documento.data(),
              })
            );

          setUsuarios(datos);

        } catch (errorConsulta) {
          console.error(
            "Error cargando usuarios:",
            errorConsulta
          );

          setError(
            "No se pudieron cargar los usuarios."
          );

        } finally {
          setCargando(false);
        }
      };

    cargarUsuarios();

  }, []);


  const usuariosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      if (!texto) {
        return usuarios;
      }

      return usuarios.filter(
        (usuario) =>
          [
            usuario.nombre,
            usuario.apellido,
            usuario.email,
            usuario.rol,
            usuario.laboratorioId,
          ].some((campo) =>
            String(
              campo || ""
            )
              .toLowerCase()
              .includes(texto)
          )
      );

    }, [
      usuarios,
      busqueda,
    ]);


  const nombreRol = (
    rol
  ) => {
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
  };


  return (
    <div className="sam-page">

      <header className="sam-header">

        <div>

          <button
            type="button"
            className="sam-back"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <span className="sam-eyebrow">
            SUPER ADMINISTRACIÓN
          </span>

          <h1>
            Usuarios del Sistema
          </h1>

          <p>
            Consulta los usuarios registrados
            en la plataforma.
          </p>

        </div>

      </header>


      {error && (
        <div className="sam-message error">
          ⚠ {error}
        </div>
      )}


      <section className="sam-toolbar">

        <div className="sam-search">
          🔎

          <input
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(
                evento.target.value
              )
            }
            placeholder="Buscar por nombre, apellido, correo, rol o laboratorio..."
          />
        </div>


        <div className="sam-counter">
          {usuariosFiltrados.length}{" "}
          usuario(s)
        </div>

      </section>


      {cargando ? (
        <div className="sam-empty">
          Cargando usuarios...
        </div>
      ) : usuariosFiltrados.length ===
        0 ? (
        <div className="sam-empty">
          <div className="sam-empty-icon">
            👥
          </div>

          <h3>
            No hay usuarios
          </h3>
        </div>
      ) : (
        <div className="sam-grid">

          {usuariosFiltrados.map(
            (usuario) => (
              <article
                key={usuario.id}
                className="sam-card"
              >

                <div className="sam-card-top">

                  <div className="sam-card-icon teal">
                    👥
                  </div>

                  <span
                    className={
                      usuario.activo
                        ? "sam-status active"
                        : "sam-status inactive"
                    }
                  >
                    ●{" "}
                    {usuario.activo
                      ? "Activo"
                      : "Inactivo"}
                  </span>

                </div>


                <h3>
                  {usuario.nombre}{" "}
                  {usuario.apellido}
                </h3>


                <div className="sam-info">

                  <p>
                    <span>✉</span>
                    {usuario.email ||
                      "Sin correo"}
                  </p>

                  <p>
                    <span>🛡️</span>
                    {nombreRol(
                      usuario.rol
                    )}
                  </p>

                  <p>
                    <span>🏥</span>
                    {usuario.laboratorioId ||
                      "Acceso global"}
                  </p>

                </div>

              </article>
            )
          )}

        </div>
      )}

    </div>
  );
}

export default SuperAdminUsuarios;