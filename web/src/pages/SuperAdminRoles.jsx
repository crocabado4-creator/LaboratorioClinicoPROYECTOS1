import {
  useEffect,
  useState,
} from "react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import "./SuperAdminModules.css";

function SuperAdminRoles({
  volver,
}) {
  const [roles, setRoles] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    const cargarRoles =
      async () => {
        try {
          setCargando(true);

          const snapshot =
            await getDocs(
              collection(
                db,
                "roles"
              )
            );

          setRoles(
            snapshot.docs.map(
              (documento) => ({
                id: documento.id,
                ...documento.data(),
              })
            )
          );

        } catch (errorConsulta) {
          console.error(
            "Error cargando roles:",
            errorConsulta
          );

          setError(
            "No se pudieron cargar los roles."
          );

        } finally {
          setCargando(false);
        }
      };

    cargarRoles();

  }, []);


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
            SEGURIDAD
          </span>

          <h1>
            Roles del Sistema
          </h1>

          <p>
            Consulta los roles y permisos
            configurados en la plataforma.
          </p>

        </div>

      </header>


      {error && (
        <div className="sam-message error">
          ⚠ {error}
        </div>
      )}


      {cargando ? (
        <div className="sam-empty">
          Cargando roles...
        </div>
      ) : (
        <div className="sam-grid">

          {roles.map(
            (rol) => (
              <article
                key={rol.id}
                className="sam-card"
              >

                <div className="sam-card-top">

                  <div className="sam-card-icon indigo">
                    🛡️
                  </div>

                  <span
                    className={
                      rol.activo
                        ? "sam-status active"
                        : "sam-status inactive"
                    }
                  >
                    ●{" "}
                    {rol.activo
                      ? "Activo"
                      : "Inactivo"}
                  </span>

                </div>


                <h3>
                  {rol.nombre ||
                    rol.id}
                </h3>


                <p className="sam-description">
                  {rol.descripcion ||
                    "Sin descripción"}
                </p>


                <div className="sam-permissions">

                  <strong>
                    Permisos
                  </strong>

                  {Array.isArray(
                    rol.permisos
                  ) &&
                  rol.permisos.length >
                    0 ? (
                    rol.permisos.map(
                      (permiso) => (
                        <span
                          key={permiso}
                        >
                          ✓ {permiso}
                        </span>
                      )
                    )
                  ) : (
                    <small>
                      Sin permisos registrados
                    </small>
                  )}

                </div>

              </article>
            )
          )}

        </div>
      )}

    </div>
  );
}

export default SuperAdminRoles;