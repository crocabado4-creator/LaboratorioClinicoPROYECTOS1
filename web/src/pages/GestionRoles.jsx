import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  actualizarRolUsuario,
  obtenerRolesAsignables,
  obtenerUsuariosLaboratorio,
} from "../services/rolesService";

import "./GestionRoles.css";


function nombreRol(rolId) {
  if (rolId === "bioquimico") {
    return "Bioquímico";
  }

  if (rolId === "recepcionista") {
    return "Recepcionista";
  }

  if (rolId === "administrador") {
    return "Administrador";
  }

  if (rolId === "super_admin") {
    return "Super Administrador";
  }

  return rolId || "Sin rol";
}


function GestionRoles({
  usuario,
  volver,
}) {
  const [
    usuarios,
    setUsuarios,
  ] = useState([]);

  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    mostrarFiltros,
    setMostrarFiltros,
  ] = useState(false);

  const [
    filtroRol,
    setFiltroRol,
  ] = useState("todos");

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState("todos");

  const [
    mensaje,
    setMensaje,
  ] = useState(null);

  const [
    usuarioVer,
    setUsuarioVer,
  ] = useState(null);

  const [
    usuarioDetalle,
    setUsuarioDetalle,
  ] = useState(null);

  const [
    usuarioEditar,
    setUsuarioEditar,
  ] = useState(null);

  const [
    rolSeleccionado,
    setRolSeleccionado,
  ] = useState("");


  const mostrarMensaje = (
    tipo,
    texto
  ) => {
    setMensaje({
      tipo,
      texto,
    });
  };


  useEffect(() => {
    if (!mensaje) {
      return undefined;
    }

    const temporizador =
      window.setTimeout(
        () => {
          setMensaje(null);
        },
        3500
      );

    return () => {
      window.clearTimeout(
        temporizador
      );
    };
  }, [mensaje]);


  const cargarDatos =
    useCallback(
      async () => {
        if (
          usuario?.rol !==
          "administrador"
        ) {
          setUsuarios([]);
          setRoles([]);
          setCargando(false);
          return;
        }

        if (
          !usuario?.laboratorioId
        ) {
          setUsuarios([]);
          setRoles([]);
          setCargando(false);

          mostrarMensaje(
            "error",
            "Tu cuenta no tiene un laboratorio asociado."
          );

          return;
        }

        try {
          setCargando(true);

          const [
            resultadoUsuarios,
            resultadoRoles,
          ] = await Promise.all([
            obtenerUsuariosLaboratorio(
              usuario.laboratorioId
            ),

            obtenerRolesAsignables(),
          ]);

          setUsuarios(
            Array.isArray(
              resultadoUsuarios
            )
              ? resultadoUsuarios
              : []
          );

          setRoles(
            Array.isArray(
              resultadoRoles
            )
              ? resultadoRoles
              : []
          );

        } catch (error) {
          console.error(
            "Error al cargar roles:",
            error
          );

          setUsuarios([]);
          setRoles([]);

          if (
            error?.code ===
            "permission-denied"
          ) {
            mostrarMensaje(
              "error",
              "No tienes permisos para consultar esta información."
            );

          } else {
            mostrarMensaje(
              "error",
              error?.message ||
                "No fue posible cargar los usuarios y roles."
            );
          }

        } finally {
          setCargando(false);
        }
      },
      [
        usuario?.laboratorioId,
        usuario?.rol,
      ]
    );


  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);


  const obtenerRol = (
    rolId
  ) => {
    return roles.find(
      (rol) =>
        rol.id === rolId
    );
  };


  const usuariosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return usuarios.filter(
        (item) => {
          const coincideBusqueda =
            texto === "" ||
            [
              item.nombre,
              item.apellido,
              item.email,
              nombreRol(
                item.rol
              ),
            ].some(
              (valor) =>
                String(
                  valor || ""
                )
                  .toLowerCase()
                  .includes(texto)
            );

          const coincideRol =
            filtroRol ===
              "todos" ||
            item.rol ===
              filtroRol;

          let coincideEstado =
            true;

          if (
            filtroEstado ===
            "activo"
          ) {
            coincideEstado =
              item.activo === true;
          }

          if (
            filtroEstado ===
            "inactivo"
          ) {
            coincideEstado =
              item.activo !== true;
          }

          return (
            coincideBusqueda &&
            coincideRol &&
            coincideEstado
          );
        }
      );
    }, [
      usuarios,
      busqueda,
      filtroRol,
      filtroEstado,
    ]);


  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFiltroRol("todos");
      setFiltroEstado("todos");
    };


  const abrirCambioRol = (
    item
  ) => {
    setUsuarioEditar(item);

    setRolSeleccionado(
      item.rol || ""
    );

    setMensaje(null);
  };


  const cerrarCambioRol =
    () => {
      if (guardando) {
        return;
      }

      setUsuarioEditar(null);
      setRolSeleccionado("");
    };


  const guardarRol =
    async () => {
      if (!usuarioEditar) {
        return;
      }

      if (!rolSeleccionado) {
        mostrarMensaje(
          "error",
          "Selecciona un rol."
        );

        return;
      }

      if (
        rolSeleccionado ===
        usuarioEditar.rol
      ) {
        mostrarMensaje(
          "info",
          "El usuario ya tiene asignado ese rol."
        );

        cerrarCambioRol();

        return;
      }

      const rolExiste =
        roles.some(
          (rol) =>
            rol.id ===
            rolSeleccionado
        );

      if (!rolExiste) {
        mostrarMensaje(
          "error",
          "El rol seleccionado no es válido."
        );

        return;
      }

      try {
        setGuardando(true);

        await actualizarRolUsuario(
          usuarioEditar.id,
          rolSeleccionado
        );

        const nombreUsuario =
          `${usuarioEditar.nombre || ""} ${usuarioEditar.apellido || ""}`.trim();

        setUsuarioEditar(null);
        setRolSeleccionado("");

        await cargarDatos();

        mostrarMensaje(
          "exito",
          `El rol de ${nombreUsuario || "el usuario"} fue actualizado correctamente.`
        );

      } catch (error) {
        console.error(
          "Error al actualizar rol:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          mostrarMensaje(
            "error",
            "No tienes permisos para cambiar el rol de este usuario."
          );

        } else {
          mostrarMensaje(
            "error",
            error?.message ||
              "No fue posible actualizar el rol."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  const datosRolSeleccionado =
    obtenerRol(
      rolSeleccionado
    );


  const cantidadActivos =
    usuarios.filter(
      (item) =>
        item.activo === true
    ).length;


  const cantidadBioquimicos =
    usuarios.filter(
      (item) =>
        item.rol ===
        "bioquimico"
    ).length;


  const cantidadRecepcionistas =
    usuarios.filter(
      (item) =>
        item.rol ===
        "recepcionista"
    ).length;


  if (
    usuario?.rol !==
    "administrador"
  ) {
    return (
      <main className="roles-page">
        <section className="roles-access-denied">
          <div className="access-icon">
            🔒
          </div>

          <h1>
            Acceso restringido
          </h1>

          <p>
            No tienes autorización para administrar los roles del personal.
          </p>

          <button
            type="button"
            className="roles-primary-button"
            onClick={volver}
          >
            ← Volver
          </button>
        </section>
      </main>
    );
  }


  return (
    <main className="roles-page">

      <header className="roles-header">
        <div>
          <button
            type="button"
            className="roles-back-button"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <h1>
            Roles y permisos
          </h1>

          <p>
            Gestiona los roles asignados al personal de tu laboratorio.
          </p>
        </div>

        <div className="roles-header-badge">
          <div>
            👥
          </div>

          <span>
            <strong>
              Personal registrado
            </strong>

            {usuarios.length} usuario(s)
          </span>
        </div>
      </header>


      {mensaje && (
        <div
          className={`roles-message ${mensaje.tipo}`}
        >
          <span>
            {mensaje.tipo ===
            "exito"
              ? "✓"
              : mensaje.tipo ===
                  "info"
                ? "i"
                : "!"}
          </span>

          {mensaje.texto}
        </div>
      )}


      <section className="roles-summary">

        <div className="roles-summary-card">
          <div className="summary-icon blue">
            👥
          </div>

          <div>
            <span>
              Personal
            </span>

            <strong>
              {usuarios.length}
            </strong>

            <small>
              Total registrado
            </small>
          </div>
        </div>


        <div className="roles-summary-card">
          <div className="summary-icon green">
            ●
          </div>

          <div>
            <span>
              Activos
            </span>

            <strong>
              {cantidadActivos}
            </strong>

            <small>
              Cuentas habilitadas
            </small>
          </div>
        </div>


        <div className="roles-summary-card">
          <div className="summary-icon purple">
            🧪
          </div>

          <div>
            <span>
              Bioquímicos
            </span>

            <strong>
              {cantidadBioquimicos}
            </strong>

            <small>
              Personal bioquímico
            </small>
          </div>
        </div>


        <div className="roles-summary-card">
          <div className="summary-icon cyan">
            💼
          </div>

          <div>
            <span>
              Recepcionistas
            </span>

            <strong>
              {cantidadRecepcionistas}
            </strong>

            <small>
              Personal de recepción
            </small>
          </div>
        </div>

      </section>


      <section className="roles-toolbar">

        <div className="roles-search">
          <span>
            🔎
          </span>

          <input
            type="text"
            value={busqueda}
            onChange={(
              evento
            ) =>
              setBusqueda(
                evento.target.value
              )
            }
            placeholder="Buscar por nombre, apellido, correo o rol..."
          />
        </div>


        <button
          type="button"
          className={
            mostrarFiltros
              ? "roles-filter-button active"
              : "roles-filter-button"
          }
          onClick={() =>
            setMostrarFiltros(
              !mostrarFiltros
            )
          }
        >
          ⚙ Filtros

          {(
            filtroRol !==
              "todos" ||
            filtroEstado !==
              "todos"
          ) && (
            <span className="filter-dot" />
          )}
        </button>

      </section>


      {mostrarFiltros && (
        <section className="roles-filters">

          <div className="filter-title">
            <div>
              <h3>
                Filtrar personal
              </h3>
            </div>

            <button
              type="button"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar filtros
            </button>
          </div>


          <div className="filter-grid">

            <div className="filter-field">
              <label>
                Rol
              </label>

              <select
                value={filtroRol}
                onChange={(
                  evento
                ) =>
                  setFiltroRol(
                    evento.target.value
                  )
                }
              >
                <option value="todos">
                  Todos los roles
                </option>

                <option value="recepcionista">
                  Recepcionista
                </option>

                <option value="bioquimico">
                  Bioquímico
                </option>
              </select>
            </div>


            <div className="filter-field">
              <label>
                Estado
              </label>

              <select
                value={
                  filtroEstado
                }
                onChange={(
                  evento
                ) =>
                  setFiltroEstado(
                    evento.target.value
                  )
                }
              >
                <option value="todos">
                  Todos los estados
                </option>

                <option value="activo">
                  Activos
                </option>

                <option value="inactivo">
                  Inactivos
                </option>
              </select>
            </div>

          </div>

        </section>
      )}


      <section className="roles-list-section">

        <div className="roles-list-header">
          <div>
            <h2>
              Personal del laboratorio
            </h2>

            <p
              style={{
                margin:
                  "5px 0 0",
                color:
                  "#64748b",
                fontSize:
                  "9px",
              }}
            >
              Consulta y administra los roles asignados.
            </p>
          </div>

          <div className="roles-result-count">
            {usuariosFiltrados.length} resultado(s)
          </div>
        </div>


        {cargando ? (
          <div className="roles-loading">
            <div className="roles-spinner" />

            <p>
              Cargando personal...
            </p>
          </div>

        ) : usuariosFiltrados.length ===
          0 ? (
          <div className="roles-empty">
            <div>
              🔎
            </div>

            <h3>
              No se encontraron resultados
            </h3>

            <p>
              Prueba con otra búsqueda o modifica los filtros seleccionados.
            </p>

            <button
              type="button"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar filtros
            </button>
          </div>

        ) : (
          <div className="roles-table-container">

            <table className="roles-table">

              <thead>
                <tr>
                  <th>
                    Usuario
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
                {usuariosFiltrados.map(
                  (item) => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        <div className="roles-user-cell">

                          <div className="roles-avatar">
                            {(
                              item.nombre ||
                              "U"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>


                          <div>
                            <strong>
                              {item.nombre || "Sin nombre"}{" "}
                              {item.apellido || ""}
                            </strong>

                            <span>
                              Personal del laboratorio
                            </span>
                          </div>

                        </div>
                      </td>


                      <td>
                        {item.email ||
                          "Sin correo"}
                      </td>


                      <td>
                        <span
                          className={`role-badge ${item.rol}`}
                        >
                          {nombreRol(
                            item.rol
                          )}
                        </span>
                      </td>


                      <td>
                        <span
                          className={
                            item.activo
                              ? "status-badge active"
                              : "status-badge inactive"
                          }
                        >
                          ●{" "}
                          {item.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>


                      <td>
                        <div className="roles-actions">

                          <button
                            type="button"
                            className="roles-action view"
                            onClick={() =>
                              setUsuarioVer(
                                item
                              )
                            }
                          >
                            👁 Ver
                          </button>


                          <button
                            type="button"
                            className="roles-action detail"
                            onClick={() =>
                              setUsuarioDetalle(
                                item
                              )
                            }
                          >
                            📄 Detalle
                          </button>


                          <button
                            type="button"
                            className="roles-action edit"
                            onClick={() =>
                              abrirCambioRol(
                                item
                              )
                            }
                          >
                            ✎ Cambiar rol
                          </button>

                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>
        )}

      </section>


      {usuarioVer && (
        <div className="roles-modal-overlay">

          <section className="roles-modal small">

            <div className="roles-modal-header">
              <div>
                <h2>
                  Perfil del usuario
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setUsuarioVer(
                    null
                  )
                }
              >
                ×
              </button>
            </div>


            <div className="quick-profile">

              <div className="quick-avatar">
                {(
                  usuarioVer.nombre ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>


              <h3>
                {usuarioVer.nombre}{" "}
                {usuarioVer.apellido}
              </h3>


              <p>
                {usuarioVer.email ||
                  "Sin correo"}
              </p>


              <span
                className={`role-badge ${usuarioVer.rol}`}
              >
                {nombreRol(
                  usuarioVer.rol
                )}
              </span>


              <span
                className={
                  usuarioVer.activo
                    ? "status-badge active"
                    : "status-badge inactive"
                }
              >
                ●{" "}
                {usuarioVer.activo
                  ? "Activo"
                  : "Inactivo"}
              </span>

            </div>


            <button
              type="button"
              className="roles-primary-button full"
              onClick={() =>
                setUsuarioVer(
                  null
                )
              }
            >
              Cerrar
            </button>

          </section>

        </div>
      )}


      {usuarioDetalle && (
        <div className="roles-modal-overlay">

          <section className="roles-modal">

            <div className="roles-modal-header">

              <div>
                <h2>
                  Detalle del usuario
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "#64748b",
                    fontSize:
                      "9px",
                  }}
                >
                  Información de la cuenta y permisos asignados.
                </p>
              </div>


              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setUsuarioDetalle(
                    null
                  )
                }
              >
                ×
              </button>

            </div>


            <div className="detail-grid">

              <div className="detail-item">
                <span>
                  Nombre
                </span>

                <strong>
                  {usuarioDetalle.nombre ||
                    "No registrado"}
                </strong>
              </div>


              <div className="detail-item">
                <span>
                  Apellido
                </span>

                <strong>
                  {usuarioDetalle.apellido ||
                    "No registrado"}
                </strong>
              </div>


              <div className="detail-item">
                <span>
                  Correo electrónico
                </span>

                <strong>
                  {usuarioDetalle.email ||
                    "No registrado"}
                </strong>
              </div>


              <div className="detail-item">
                <span>
                  Rol
                </span>

                <strong>
                  {nombreRol(
                    usuarioDetalle.rol
                  )}
                </strong>
              </div>


              <div className="detail-item">
                <span>
                  Estado
                </span>

                <strong>
                  {usuarioDetalle.activo
                    ? "Activo"
                    : "Inactivo"}
                </strong>
              </div>


              <div className="detail-item">
                <span>
                  Laboratorio
                </span>

                <strong>
                  {usuarioDetalle.laboratorioId ||
                    "No registrado"}
                </strong>
              </div>


              <div className="detail-item detail-full">
                <span>
                  Identificador del usuario
                </span>

                <strong className="detail-id">
                  {usuarioDetalle.id}
                </strong>
              </div>

            </div>


            <div className="detail-permissions">

              <span className="permissions-title">
                Permisos del rol
              </span>


              {obtenerRol(
                usuarioDetalle.rol
              )?.permisos?.length >
              0 ? (
                <div className="permission-list">

                  {obtenerRol(
                    usuarioDetalle.rol
                  ).permisos.map(
                    (permiso) => (
                      <span
                        key={
                          permiso
                        }
                        className="permission-tag"
                      >
                        ✓ {permiso}
                      </span>
                    )
                  )}

                </div>

              ) : (
                <p className="no-permissions">
                  Este rol no tiene permisos registrados.
                </p>
              )}

            </div>


            <div className="roles-modal-footer">

              <button
                type="button"
                className="roles-secondary-button"
                onClick={() =>
                  setUsuarioDetalle(
                    null
                  )
                }
              >
                Cerrar
              </button>

            </div>

          </section>

        </div>
      )}


      {usuarioEditar && (
        <div className="roles-modal-overlay">

          <section className="roles-modal">

            <div className="roles-modal-header">

              <div>
                <h2>
                  Cambiar rol
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "#64748b",
                    fontSize:
                      "9px",
                  }}
                >
                  Selecciona el rol que tendrá este usuario.
                </p>
              </div>


              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarCambioRol
                }
                disabled={
                  guardando
                }
              >
                ×
              </button>

            </div>


            <div className="change-user">

              <div className="roles-avatar big">
                {(
                  usuarioEditar.nombre ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>


              <div>
                <strong>
                  {usuarioEditar.nombre}{" "}
                  {usuarioEditar.apellido}
                </strong>

                <span>
                  {usuarioEditar.email}
                </span>
              </div>

            </div>


            <div className="change-role-field">

              <label>
                Rol
              </label>


              <select
                value={
                  rolSeleccionado
                }
                onChange={(
                  evento
                ) =>
                  setRolSeleccionado(
                    evento.target.value
                  )
                }
                disabled={
                  guardando
                }
              >
                <option value="">
                  Selecciona un rol
                </option>

                {roles.map(
                  (rol) => (
                    <option
                      key={rol.id}
                      value={rol.id}
                    >
                      {rol.nombre ||
                        nombreRol(
                          rol.id
                        )}
                    </option>
                  )
                )}
              </select>

            </div>


            <div className="selected-role-info">

              <div className="selected-role-header">

                <div>
                  <span>
                    Permisos
                  </span>

                  <h3>
                    {datosRolSeleccionado?.nombre ||
                      "Selecciona un rol"}
                  </h3>
                </div>

                <div className="shield">
                  🛡️
                </div>

              </div>


              {datosRolSeleccionado?.descripcion && (
                <p>
                  {datosRolSeleccionado.descripcion}
                </p>
              )}


              {datosRolSeleccionado?.permisos?.length >
              0 ? (
                <div className="permission-list">

                  {datosRolSeleccionado.permisos.map(
                    (permiso) => (
                      <span
                        key={
                          permiso
                        }
                        className="permission-tag"
                      >
                        ✓ {permiso}
                      </span>
                    )
                  )}

                </div>

              ) : (
                <p className="no-permissions">
                  Selecciona un rol para consultar sus permisos.
                </p>
              )}

            </div>


            <div className="roles-modal-footer">

              <button
                type="button"
                className="roles-secondary-button"
                onClick={
                  cerrarCambioRol
                }
                disabled={
                  guardando
                }
              >
                Cancelar
              </button>


              <button
                type="button"
                className="roles-primary-button"
                onClick={
                  guardarRol
                }
                disabled={
                  guardando ||
                  !rolSeleccionado
                }
              >
                {guardando
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>

            </div>

          </section>

        </div>
      )}

    </main>
  );
}


export default GestionRoles;