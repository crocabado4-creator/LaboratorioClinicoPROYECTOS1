import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  actualizarAdministrador,
  cambiarEstadoAdministrador,
  crearAdministrador,
  obtenerAdministradores,
  obtenerLaboratoriosAdministradores,
  passwordSeguro,
} from "../services/administradoresService";

import "./SuperAdminAdministradores.css";


const formularioInicial = {
  nombre: "",
  apellido: "",
  email: "",
  laboratorioId: "",
  password: "",
  confirmarPassword: "",
  requiereVerificacionEmail: true,
};


function SuperAdminAdministradores({
  permisos = [],
  volver,
}) {
  const puedeVer =
    permisos.includes(
      "administradores.ver"
    );

  const puedeCrear =
    permisos.includes(
      "administradores.crear"
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
  ] = useState(null);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    mostrarFiltros,
    setMostrarFiltros,
  ] = useState(false);

  const [
    filtroLaboratorio,
    setFiltroLaboratorio,
  ] = useState("todos");

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState("todos");

  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

  const [
    modoFormulario,
    setModoFormulario,
  ] = useState(null);

  const [
    administradorEditar,
    setAdministradorEditar,
  ] = useState(null);

  const [
    administradorVer,
    setAdministradorVer,
  ] = useState(null);

  const [
    administradorDetalle,
    setAdministradorDetalle,
  ] = useState(null);

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  const [
    mostrarConfirmacion,
    setMostrarConfirmacion,
  ] = useState(false);


  useEffect(() => {
    if (!mensaje) {
      return undefined;
    }

    const temporizador =
      window.setTimeout(
        () => {
          setMensaje(null);
        },
        4000
      );

    return () => {
      window.clearTimeout(
        temporizador
      );
    };
  }, [mensaje]);


  const mostrarMensaje = (
    tipo,
    texto
  ) => {
    setMensaje({
      tipo,
      texto,
    });
  };


  const cargarDatos =
    useCallback(
      async () => {
        if (!puedeVer) {
          setCargando(false);
          return;
        }

        try {
          setCargando(true);

          const [
            resultadoAdministradores,
            resultadoLaboratorios,
          ] = await Promise.all([
            obtenerAdministradores(),
            obtenerLaboratoriosAdministradores(),
          ]);

          setAdministradores(
            Array.isArray(
              resultadoAdministradores
            )
              ? resultadoAdministradores
              : []
          );

          setLaboratorios(
            Array.isArray(
              resultadoLaboratorios
            )
              ? resultadoLaboratorios
              : []
          );

        } catch (error) {
          console.error(
            "Error cargando administradores:",
            error
          );

          mostrarMensaje(
            "error",
            error?.message ||
              "No se pudo cargar la información."
          );

        } finally {
          setCargando(false);
        }
      },
      [puedeVer]
    );


  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);


  const mapaLaboratorios =
    useMemo(
      () => {
        return new Map(
          laboratorios.map(
            (laboratorio) => [
              laboratorio.id,
              laboratorio,
            ]
          )
        );
      },
      [laboratorios]
    );


  const nombreLaboratorio = (
    laboratorioId
  ) => {
    const laboratorio =
      mapaLaboratorios.get(
        laboratorioId
      );

    return (
      laboratorio?.nombre ||
      "Laboratorio no disponible"
    );
  };


  const administradoresFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return administradores.filter(
        (administrador) => {
          const laboratorio =
            mapaLaboratorios.get(
              administrador.laboratorioId
            );

          const coincideBusqueda =
            texto === "" ||
            [
              administrador.nombre,
              administrador.apellido,
              administrador.email,
              laboratorio?.nombre,
              laboratorio?.nombreVisible,
            ].some(
              (valor) =>
                String(
                  valor || ""
                )
                  .toLowerCase()
                  .includes(texto)
            );

          const coincideLaboratorio =
            filtroLaboratorio ===
              "todos" ||
            administrador.laboratorioId ===
              filtroLaboratorio;

          let coincideEstado =
            true;

          if (
            filtroEstado ===
            "activo"
          ) {
            coincideEstado =
              administrador.activo ===
              true;
          }

          if (
            filtroEstado ===
            "inactivo"
          ) {
            coincideEstado =
              administrador.activo !==
              true;
          }

          return (
            coincideBusqueda &&
            coincideLaboratorio &&
            coincideEstado
          );
        }
      );
    }, [
      administradores,
      busqueda,
      filtroLaboratorio,
      filtroEstado,
      mapaLaboratorios,
    ]);


  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFiltroLaboratorio(
        "todos"
      );
      setFiltroEstado(
        "todos"
      );
    };


  const abrirCrear =
    () => {
      setFormulario(
        formularioInicial
      );

      setAdministradorEditar(
        null
      );

      setMostrarPassword(false);
      setMostrarConfirmacion(false);
      setModoFormulario("crear");
      setMensaje(null);
    };


  const abrirEditar = (
    administrador
  ) => {
    setAdministradorEditar(
      administrador
    );

    setFormulario({
      nombre:
        administrador.nombre ||
        "",

      apellido:
        administrador.apellido ||
        "",

      email:
        administrador.email ||
        "",

      laboratorioId:
        administrador.laboratorioId ||
        "",

      password:
        "",

      confirmarPassword:
        "",

      requiereVerificacionEmail:
        administrador.requiereVerificacionEmail ===
        true,
    });

    setModoFormulario(
      "editar"
    );

    setMensaje(null);
  };


  const cerrarFormulario =
    () => {
      if (guardando) {
        return;
      }

      setModoFormulario(null);
      setAdministradorEditar(null);

      setFormulario(
        formularioInicial
      );

      setMostrarPassword(false);
      setMostrarConfirmacion(false);
    };


  const manejarCambio = (
    evento
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = evento.target;

    setFormulario(
      (anterior) => ({
        ...anterior,

        [name]:
          type === "checkbox"
            ? checked
            : value,
      })
    );
  };


  const validarFormulario =
    () => {
      if (
        formulario.nombre.trim() ===
        ""
      ) {
        return "Ingresa el nombre.";
      }

      if (
        formulario.apellido.trim() ===
        ""
      ) {
        return "Ingresa el apellido.";
      }

      if (
        formulario.laboratorioId ===
        ""
      ) {
        return "Selecciona un laboratorio.";
      }

      if (
        modoFormulario ===
        "crear"
      ) {
        const correoValido =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
          !correoValido.test(
            formulario.email
              .trim()
          )
        ) {
          return "Ingresa un correo electrónico válido.";
        }

        if (
          !passwordSeguro(
            formulario.password
          )
        ) {
          return "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.";
        }

        if (
          formulario.password !==
          formulario.confirmarPassword
        ) {
          return "Las contraseñas no coinciden.";
        }
      }

      return "";
    };


  const guardar =
    async (
      evento
    ) => {
      evento.preventDefault();

      const validacion =
        validarFormulario();

      if (validacion) {
        mostrarMensaje(
          "error",
          validacion
        );

        return;
      }

      try {
        setGuardando(true);

        if (
          modoFormulario ===
          "crear"
        ) {
          if (!puedeCrear) {
            throw new Error(
              "No tienes permiso para registrar administradores."
            );
          }

          const resultado =
            await crearAdministrador({
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              email:
                formulario.email,

              password:
                formulario.password,

              laboratorioId:
                formulario.laboratorioId,

              requiereVerificacionEmail:
                formulario.requiereVerificacionEmail,
            });

          cerrarFormularioForzado();

          await cargarDatos();

          mostrarMensaje(
            "exito",
            resultado.verificacionEnviada
              ? "Administrador registrado correctamente. Se envió un correo de verificación."
              : "Administrador registrado correctamente."
          );

        } else {
          if (
            !administradorEditar
          ) {
            return;
          }

          if (!puedeEditar) {
            throw new Error(
              "No tienes permiso para modificar administradores."
            );
          }

          await actualizarAdministrador(
            administradorEditar.id,
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              laboratorioId:
                formulario.laboratorioId,
            }
          );

          cerrarFormularioForzado();

          await cargarDatos();

          mostrarMensaje(
            "exito",
            "Administrador actualizado correctamente."
          );
        }

      } catch (error) {
        console.error(
          "Error guardando administrador:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          mostrarMensaje(
            "error",
            "No tienes permisos para realizar esta operación."
          );

        } else {
          mostrarMensaje(
            "error",
            error?.message ||
              "No se pudo guardar la información."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  const cerrarFormularioForzado =
    () => {
      setModoFormulario(null);
      setAdministradorEditar(null);
      setFormulario(
        formularioInicial
      );
      setMostrarPassword(false);
      setMostrarConfirmacion(false);
    };


  const cambiarEstado =
    async (
      administrador
    ) => {
      if (
        !puedeCambiarEstado
      ) {
        return;
      }

      const nuevoEstado =
        !administrador.activo;

      const confirmar =
        window.confirm(
          nuevoEstado
            ? `¿Deseas activar la cuenta de ${administrador.nombre} ${administrador.apellido}?`
            : `¿Deseas desactivar la cuenta de ${administrador.nombre} ${administrador.apellido}?`
        );

      if (!confirmar) {
        return;
      }

      try {
        await cambiarEstadoAdministrador(
          administrador.id,
          nuevoEstado
        );

        await cargarDatos();

        mostrarMensaje(
          "exito",
          nuevoEstado
            ? "Administrador activado correctamente."
            : "Administrador desactivado correctamente."
        );

      } catch (error) {
        console.error(
          "Error cambiando estado:",
          error
        );

        mostrarMensaje(
          "error",
          error?.message ||
            "No se pudo cambiar el estado."
        );
      }
    };


  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return "No registrada";
    }

    try {
      if (
        typeof fecha.toDate ===
        "function"
      ) {
        return fecha
          .toDate()
          .toLocaleString(
            "es-BO"
          );
      }

      if (fecha.seconds) {
        return new Date(
          fecha.seconds *
            1000
        ).toLocaleString(
          "es-BO"
        );
      }

      return new Date(
        fecha
      ).toLocaleString(
        "es-BO"
      );

    } catch {
      return "No registrada";
    }
  };


  if (!puedeVer) {
    return (
      <main className="admins-page">
        <section className="admins-access">
          <div className="admins-access-icon">
            🔒
          </div>

          <h1>
            Acceso restringido
          </h1>

          <p>
            No tienes autorización para consultar los administradores.
          </p>

          <button
            type="button"
            className="admins-primary"
            onClick={volver}
          >
            ← Volver
          </button>
        </section>
      </main>
    );
  }


  return (
    <main className="admins-page">

      <header className="admins-header">
        <div>
          <button
            type="button"
            className="admins-back"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <h1>
            Administradores
          </h1>

          <p>
            Gestiona los responsables asignados a los laboratorios de la plataforma.
          </p>
        </div>

        {puedeCrear && (
          <button
            type="button"
            className="admins-primary"
            onClick={
              abrirCrear
            }
          >
            + Nuevo administrador
          </button>
        )}
      </header>


      {mensaje && (
        <div
          className={`admins-message ${mensaje.tipo}`}
        >
          <span>
            {mensaje.tipo ===
            "exito"
              ? "✓"
              : "!"}
          </span>

          {mensaje.texto}
        </div>
      )}


      <section className="admins-stats">
        <Resumen
          icono="👤"
          titulo="Administradores"
          valor={
            administradores.length
          }
          texto="Total registrado"
          clase="blue"
        />

        <Resumen
          icono="✓"
          titulo="Activos"
          valor={
            administradores.filter(
              (item) =>
                item.activo
            ).length
          }
          texto="Cuentas habilitadas"
          clase="green"
        />

        <Resumen
          icono="○"
          titulo="Inactivos"
          valor={
            administradores.filter(
              (item) =>
                !item.activo
            ).length
          }
          texto="Cuentas deshabilitadas"
          clase="red"
        />

        <Resumen
          icono="🏥"
          titulo="Laboratorios"
          valor={
            laboratorios.length
          }
          texto="Establecimientos"
          clase="purple"
        />
      </section>


      <section className="admins-toolbar">
        <div className="admins-search">
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
            placeholder="Buscar por nombre, apellido, correo o laboratorio..."
          />
        </div>

        <button
          type="button"
          className={
            mostrarFiltros
              ? "admins-filter active"
              : "admins-filter"
          }
          onClick={() =>
            setMostrarFiltros(
              !mostrarFiltros
            )
          }
        >
          Filtros

          {(
            filtroLaboratorio !==
              "todos" ||
            filtroEstado !==
              "todos"
          ) && (
            <span className="admins-filter-dot" />
          )}
        </button>
      </section>


      {mostrarFiltros && (
        <section className="admins-filters">
          <div className="admins-filter-header">
            <h3>
              Filtrar resultados
            </h3>

            <button
              type="button"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar filtros
            </button>
          </div>

          <div className="admins-filter-grid">
            <div className="admins-field">
              <label>
                Laboratorio
              </label>

              <select
                value={
                  filtroLaboratorio
                }
                onChange={(
                  evento
                ) =>
                  setFiltroLaboratorio(
                    evento.target.value
                  )
                }
              >
                <option value="todos">
                  Todos los laboratorios
                </option>

                {laboratorios.map(
                  (laboratorio) => (
                    <option
                      key={
                        laboratorio.id
                      }
                      value={
                        laboratorio.id
                      }
                    >
                      {laboratorio.nombre}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="admins-field">
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


      <section className="admins-list">
        <div className="admins-list-header">
          <div>
            <h2>
              Responsables registrados
            </h2>

            <p>
              Consulta y administra las cuentas responsables de cada laboratorio.
            </p>
          </div>

          <span>
            {administradoresFiltrados.length} resultado(s)
          </span>
        </div>


        {cargando ? (
          <div className="admins-empty">
            <div className="admins-spinner" />

            <p>
              Cargando administradores...
            </p>
          </div>

        ) : administradoresFiltrados.length ===
          0 ? (
          <div className="admins-empty">
            <div className="admins-empty-icon">
              🔎
            </div>

            <h3>
              No se encontraron resultados
            </h3>

            <p>
              Prueba con otra búsqueda o modifica los filtros.
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
          <div className="admins-table-wrapper">
            <table className="admins-table">

              <thead>
                <tr>
                  <th>
                    Administrador
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
                {administradoresFiltrados.map(
                  (administrador) => (
                    <tr
                      key={
                        administrador.id
                      }
                    >
                      <td>
                        <div className="admins-user">
                          <div className="admins-avatar">
                            {(
                              administrador.nombre ||
                              "A"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {administrador.nombre}{" "}
                              {administrador.apellido}
                            </strong>

                            <span>
                              Administrador
                            </span>
                          </div>
                        </div>
                      </td>


                      <td>
                        {administrador.email}
                      </td>


                      <td>
                        <div className="admins-lab-cell">
                          <span className="admins-lab-icon">
                            🏥
                          </span>

                          <span>
                            {nombreLaboratorio(
                              administrador.laboratorioId
                            )}
                          </span>
                        </div>
                      </td>


                      <td>
                        <span
                          className={
                            administrador.activo
                              ? "admins-status active"
                              : "admins-status inactive"
                          }
                        >
                          ●{" "}
                          {administrador.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>


                      <td>
                        <div className="admins-actions">
                          <button
                            type="button"
                            className="admins-action view"
                            onClick={() =>
                              setAdministradorVer(
                                administrador
                              )
                            }
                          >
                            👁 Ver
                          </button>

                          <button
                            type="button"
                            className="admins-action detail"
                            onClick={() =>
                              setAdministradorDetalle(
                                administrador
                              )
                            }
                          >
                            📄 Detalle
                          </button>

                          {puedeEditar && (
                            <button
                              type="button"
                              className="admins-action edit"
                              onClick={() =>
                                abrirEditar(
                                  administrador
                                )
                              }
                            >
                              ✎ Editar
                            </button>
                          )}

                          {puedeCambiarEstado && (
                            <button
                              type="button"
                              className={
                                administrador.activo
                                  ? "admins-action disable"
                                  : "admins-action enable"
                              }
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


      {modoFormulario && (
        <div className="admins-modal-overlay">
          <section className="admins-modal admins-form-modal">

            <div className="admins-modal-header">
              <div>
                <h2>
                  {modoFormulario ===
                  "crear"
                    ? "Nuevo administrador"
                    : "Editar administrador"}
                </h2>

                <p>
                  {modoFormulario ===
                  "crear"
                    ? "Registra una nueva cuenta responsable de laboratorio."
                    : "Actualiza los datos y laboratorio asignado."}
                </p>
              </div>

              <button
                type="button"
                className="admins-close"
                onClick={
                  cerrarFormulario
                }
                disabled={
                  guardando
                }
              >
                ×
              </button>
            </div>


            <form
              className="admins-form"
              onSubmit={guardar}
            >
              <div className="admins-form-section">
                <div className="admins-section-title">
                  <div className="admins-section-icon">
                    👤
                  </div>

                  <div>
                    <h3>
                      Información personal
                    </h3>

                    <p>
                      Datos principales del responsable.
                    </p>
                  </div>
                </div>

                <div className="admins-form-grid">
                  <div className="admins-field">
                    <label>
                      Nombre *
                    </label>

                    <input
                      type="text"
                      name="nombre"
                      value={
                        formulario.nombre
                      }
                      onChange={
                        manejarCambio
                      }
                      placeholder="Nombre"
                    />
                  </div>

                  <div className="admins-field">
                    <label>
                      Apellido *
                    </label>

                    <input
                      type="text"
                      name="apellido"
                      value={
                        formulario.apellido
                      }
                      onChange={
                        manejarCambio
                      }
                      placeholder="Apellido"
                    />
                  </div>

                  <div className="admins-field admins-full">
                    <label>
                      Correo electrónico *
                    </label>

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
                        modoFormulario ===
                        "editar"
                      }
                      placeholder="administrador@correo.com"
                    />

                    {modoFormulario ===
                      "editar" && (
                      <small>
                        El correo de autenticación no se modifica desde esta pantalla.
                      </small>
                    )}
                  </div>
                </div>
              </div>


              <div className="admins-form-section">
                <div className="admins-section-title">
                  <div className="admins-section-icon purple">
                    🏥
                  </div>

                  <div>
                    <h3>
                      Laboratorio asignado
                    </h3>

                    <p>
                      El administrador trabajará con la información de este laboratorio.
                    </p>
                  </div>
                </div>

                <div className="admins-field">
                  <label>
                    Laboratorio *
                  </label>

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
                      Selecciona un laboratorio
                    </option>

                    {laboratorios.map(
                      (laboratorio) => {
                        const disponible =
                          laboratorio.activo ||
                          laboratorio.id ===
                            formulario.laboratorioId;

                        return (
                          <option
                            key={
                              laboratorio.id
                            }
                            value={
                              laboratorio.id
                            }
                            disabled={
                              !disponible
                            }
                          >
                            {laboratorio.nombre}
                            {!laboratorio.activo
                              ? " (Inactivo)"
                              : ""}
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>

                {formulario.laboratorioId && (
                  <LaboratorioAsignado
                    laboratorio={
                      mapaLaboratorios.get(
                        formulario.laboratorioId
                      )
                    }
                  />
                )}
              </div>


              {modoFormulario ===
                "crear" && (
                <div className="admins-form-section">
                  <div className="admins-section-title">
                    <div className="admins-section-icon green">
                      🔐
                    </div>

                    <div>
                      <h3>
                        Acceso a la cuenta
                      </h3>

                      <p>
                        Define las credenciales iniciales del administrador.
                      </p>
                    </div>
                  </div>

                  <div className="admins-form-grid">
                    <div className="admins-field">
                      <label>
                        Contraseña *
                      </label>

                      <div className="admins-password">
                        <input
                          type={
                            mostrarPassword
                              ? "text"
                              : "password"
                          }
                          name="password"
                          value={
                            formulario.password
                          }
                          onChange={
                            manejarCambio
                          }
                          placeholder="Contraseña segura"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setMostrarPassword(
                              !mostrarPassword
                            )
                          }
                        >
                          {mostrarPassword
                            ? "Ocultar"
                            : "Ver"}
                        </button>
                      </div>
                    </div>

                    <div className="admins-field">
                      <label>
                        Confirmar contraseña *
                      </label>

                      <div className="admins-password">
                        <input
                          type={
                            mostrarConfirmacion
                              ? "text"
                              : "password"
                          }
                          name="confirmarPassword"
                          value={
                            formulario.confirmarPassword
                          }
                          onChange={
                            manejarCambio
                          }
                          placeholder="Repite la contraseña"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setMostrarConfirmacion(
                              !mostrarConfirmacion
                            )
                          }
                        >
                          {mostrarConfirmacion
                            ? "Ocultar"
                            : "Ver"}
                        </button>
                      </div>
                    </div>
                  </div>


                  <div className="admins-password-rules">
                    <strong>
                      La contraseña debe contener:
                    </strong>

                    <div>
                      <ReglaPassword
                        correcta={
                          formulario.password.length >=
                          8
                        }
                        texto="8 caracteres como mínimo"
                      />

                      <ReglaPassword
                        correcta={
                          /[A-Z]/.test(
                            formulario.password
                          )
                        }
                        texto="Una letra mayúscula"
                      />

                      <ReglaPassword
                        correcta={
                          /[a-z]/.test(
                            formulario.password
                          )
                        }
                        texto="Una letra minúscula"
                      />

                      <ReglaPassword
                        correcta={
                          /[0-9]/.test(
                            formulario.password
                          )
                        }
                        texto="Un número"
                      />

                      <ReglaPassword
                        correcta={
                          /[^A-Za-z0-9]/.test(
                            formulario.password
                          )
                        }
                        texto="Un carácter especial"
                      />
                    </div>
                  </div>


                  <label className="admins-checkbox">
                    <input
                      type="checkbox"
                      name="requiereVerificacionEmail"
                      checked={
                        formulario.requiereVerificacionEmail
                      }
                      onChange={
                        manejarCambio
                      }
                    />

                    <span>
                      <strong>
                        Solicitar verificación de correo
                      </strong>

                      <small>
                        El usuario deberá verificar su dirección de correo antes de ingresar.
                      </small>
                    </span>
                  </label>
                </div>
              )}


              <div className="admins-form-actions">
                <button
                  type="button"
                  className="admins-secondary"
                  onClick={
                    cerrarFormulario
                  }
                  disabled={
                    guardando
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="admins-primary"
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? "Guardando..."
                    : modoFormulario ===
                        "crear"
                      ? "Registrar administrador"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>

          </section>
        </div>
      )}


      {administradorVer && (
        <div className="admins-modal-overlay">
          <section className="admins-modal admins-small">

            <div className="admins-modal-header">
              <div>
                <h2>
                  Perfil del administrador
                </h2>
              </div>

              <button
                type="button"
                className="admins-close"
                onClick={() =>
                  setAdministradorVer(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="admins-profile">
              <div className="admins-profile-avatar">
                {(
                  administradorVer.nombre ||
                  "A"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <h3>
                {administradorVer.nombre}{" "}
                {administradorVer.apellido}
              </h3>

              <p>
                {administradorVer.email}
              </p>

              <span
                className={
                  administradorVer.activo
                    ? "admins-status active"
                    : "admins-status inactive"
                }
              >
                ●{" "}
                {administradorVer.activo
                  ? "Activo"
                  : "Inactivo"}
              </span>

              <div className="admins-profile-lab">
                <span>
                  🏥
                </span>

                <div>
                  <small>
                    Laboratorio
                  </small>

                  <strong>
                    {nombreLaboratorio(
                      administradorVer.laboratorioId
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="admins-primary admins-full-button"
              onClick={() =>
                setAdministradorVer(
                  null
                )
              }
            >
              Cerrar
            </button>

          </section>
        </div>
      )}


      {administradorDetalle && (
        <div className="admins-modal-overlay">
          <section className="admins-modal">

            <div className="admins-modal-header">
              <div>
                <h2>
                  Detalle del administrador
                </h2>

                <p>
                  Información de la cuenta y laboratorio asignado.
                </p>
              </div>

              <button
                type="button"
                className="admins-close"
                onClick={() =>
                  setAdministradorDetalle(
                    null
                  )
                }
              >
                ×
              </button>
            </div>


            <div className="admins-detail-grid">
              <Detalle
                titulo="Nombre"
                valor={
                  administradorDetalle.nombre
                }
              />

              <Detalle
                titulo="Apellido"
                valor={
                  administradorDetalle.apellido
                }
              />

              <Detalle
                titulo="Correo electrónico"
                valor={
                  administradorDetalle.email
                }
              />

              <Detalle
                titulo="Estado"
                valor={
                  administradorDetalle.activo
                    ? "Activo"
                    : "Inactivo"
                }
              />

              <Detalle
                titulo="Laboratorio"
                valor={
                  nombreLaboratorio(
                    administradorDetalle.laboratorioId
                  )
                }
              />

              <Detalle
                titulo="Verificación de correo"
                valor={
                  administradorDetalle.requiereVerificacionEmail
                    ? "Requerida"
                    : "No requerida"
                }
              />

              <Detalle
                titulo="Fecha de registro"
                valor={
                  formatearFecha(
                    administradorDetalle.fechaRegistro
                  )
                }
              />

              <Detalle
                titulo="UID"
                valor={
                  administradorDetalle.id
                }
                completo
              />
            </div>


            <IdentidadLaboratorio
              laboratorio={
                mapaLaboratorios.get(
                  administradorDetalle.laboratorioId
                )
              }
            />


            <div className="admins-modal-footer">
              <button
                type="button"
                className="admins-secondary"
                onClick={() =>
                  setAdministradorDetalle(
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

    </main>
  );
}


function Resumen({
  icono,
  titulo,
  valor,
  texto,
  clase,
}) {
  return (
    <article className="admins-stat">
      <div
        className={`admins-stat-icon ${clase}`}
      >
        {icono}
      </div>

      <div>
        <span>
          {titulo}
        </span>

        <strong>
          {valor}
        </strong>

        <small>
          {texto}
        </small>
      </div>
    </article>
  );
}


function ReglaPassword({
  correcta,
  texto,
}) {
  return (
    <span
      className={
        correcta
          ? "password-rule valid"
          : "password-rule"
      }
    >
      {correcta
        ? "✓"
        : "○"}{" "}
      {texto}
    </span>
  );
}


function LaboratorioAsignado({
  laboratorio,
}) {
  if (!laboratorio) {
    return null;
  }

  return (
    <div className="admins-selected-lab">
      <div className="admins-selected-logo">
        {laboratorio.logoUrl ? (
          <img
            src={
              laboratorio.logoUrl
            }
            alt="Logo"
            onError={(
              evento
            ) => {
              evento.currentTarget.style.display =
                "none";
            }}
          />
        ) : (
          <span>
            🧪
          </span>
        )}
      </div>

      <div>
        <small>
          Laboratorio seleccionado
        </small>

        <strong>
          {laboratorio.nombre}
        </strong>

        <span>
          {laboratorio.nombreVisible ||
            laboratorio.direccion ||
            "Sin información adicional"}
        </span>
      </div>
    </div>
  );
}


function IdentidadLaboratorio({
  laboratorio,
}) {
  if (!laboratorio) {
    return null;
  }

  const colorPrimario =
    /^#[0-9A-Fa-f]{6}$/.test(
      laboratorio.colorPrimario
    )
      ? laboratorio.colorPrimario
      : "#2563EB";

  const colorSecundario =
    /^#[0-9A-Fa-f]{6}$/.test(
      laboratorio.colorSecundario
    )
      ? laboratorio.colorSecundario
      : "#0EA5E9";

  return (
    <section className="admins-identity">
      <div>
        <h3>
          Identidad del laboratorio
        </h3>

        <p>
          Esta apariencia estará disponible para el administrador al ingresar al sistema.
        </p>
      </div>

      <div
        className="admins-identity-preview"
        style={{
          background:
            `linear-gradient(
              135deg,
              ${colorPrimario},
              ${colorSecundario}
            )`,
        }}
      >
        <div className="admins-identity-logo">
          {laboratorio.logoUrl ? (
            <img
              src={
                laboratorio.logoUrl
              }
              alt="Logo"
            />
          ) : (
            <span>
              🧪
            </span>
          )}
        </div>

        <div>
          <strong>
            {laboratorio.nombreVisible ||
              laboratorio.nombre}
          </strong>

          <span>
            {laboratorio.nombre}
          </span>
        </div>
      </div>
    </section>
  );
}


function Detalle({
  titulo,
  valor,
  completo = false,
}) {
  return (
    <div
      className={
        completo
          ? "admins-detail-item full"
          : "admins-detail-item"
      }
    >
      <span>
        {titulo}
      </span>

      <strong>
        {valor ||
          "No registrado"}
      </strong>
    </div>
  );
}


export default SuperAdminAdministradores;