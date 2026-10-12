import { useCallback, useEffect, useMemo, useState } from "react";

import {
  actualizarPersonal,
  cambiarEstadoPersonal,
  crearPersonal,
  obtenerLaboratorioPersonal,
  obtenerPersonal,
  passwordSeguro,
  restablecerPasswordPersonal,
} from "../services/personalService";

import "./GestionPersonal.css";

const formularioInicial = {
  nombre: "",
  apellido: "",
  email: "",
  rol: "",
  password: "",
  confirmarPassword: "",
  requiereVerificacionEmail: true,
};

function nombreRol(rol) {
  if (rol === "bioquimico") return "Bioquímico";
  if (rol === "recepcionista") return "Recepcionista";
  return rol || "Sin rol";
}

function GestionPersonal({ usuario, permisos = [], volver }) {
  const puedeVer = permisos.includes("empleados.ver");
  const puedeCrear = permisos.includes("empleados.crear");
  const puedeEditar = permisos.includes("empleados.editar");
  const puedeCambiarEstado = permisos.includes("empleados.desactivar");

  const [personal, setPersonal] = useState([]);
  const [laboratorio, setLaboratorio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [modoFormulario, setModoFormulario] = useState(null);
  const [empleadoEditar, setEmpleadoEditar] = useState(null);
  const [empleadoVer, setEmpleadoVer] = useState(null);
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  // NUEVO: Estados para cambiar contraseña
  const [empleadoPassword, setEmpleadoPassword] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarNuevaPassword, setConfirmarNuevaPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [verNuevaPassword, setVerNuevaPassword] = useState(false);
  const [verConfirmarPassword, setVerConfirmarPassword] = useState(false);

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
  };

  useEffect(() => {
    if (!mensaje) return;

    const temporizador = window.setTimeout(() => {
      setMensaje(null);
    }, 4000);

    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  const cargarDatos = useCallback(async () => {
    if (usuario?.rol !== "administrador") {
      setCargando(false);
      return;
    }

    if (!usuario?.laboratorioId) {
      setCargando(false);
      setMensaje({
        tipo: "error",
        texto: "Tu cuenta no tiene un laboratorio asociado.",
      });
      return;
    }

    if (!puedeVer) {
      setCargando(false);
      return;
    }

    try {
      setCargando(true);

      const [resultadoPersonal, resultadoLaboratorio] = await Promise.all([
        obtenerPersonal(usuario.laboratorioId),
        obtenerLaboratorioPersonal(),
      ]);

      setPersonal(
        Array.isArray(resultadoPersonal) ? resultadoPersonal : []
      );

      setLaboratorio(resultadoLaboratorio || null);
    } catch (error) {
      console.error("Error al cargar personal:", error);

      setMensaje({
        tipo: "error",
        texto: error?.message || "No se pudo cargar el personal.",
      });
    } finally {
      setCargando(false);
    }
  }, [puedeVer, usuario?.laboratorioId, usuario?.rol]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const personalFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return personal.filter((empleado) => {
      const coincideBusqueda =
        texto === "" ||
        [
          empleado.nombre,
          empleado.apellido,
          empleado.email,
          nombreRol(empleado.rol),
        ].some((valor) =>
          String(valor || "").toLowerCase().includes(texto)
        );

      const coincideRol =
        filtroRol === "todos" || empleado.rol === filtroRol;

      const coincideEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "activo" && empleado.activo === true) ||
        (filtroEstado === "inactivo" && empleado.activo !== true);

      return coincideBusqueda && coincideRol && coincideEstado;
    });
  }, [personal, busqueda, filtroRol, filtroEstado]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroRol("todos");
    setFiltroEstado("todos");
  };

  const abrirCrear = () => {
    setFormulario({ ...formularioInicial });
    setEmpleadoEditar(null);
    setModoFormulario("crear");
    setMostrarPassword(false);
    setMostrarConfirmacion(false);
    setMensaje(null);
  };

  const abrirEditar = (empleado) => {
    if (!puedeEditar) return;

    setEmpleadoEditar(empleado);

    setFormulario({
      nombre: empleado.nombre || "",
      apellido: empleado.apellido || "",
      email: empleado.email || "",
      rol: empleado.rol || "",
      password: "",
      confirmarPassword: "",
      requiereVerificacionEmail:
        empleado.requiereVerificacionEmail === true,
    });

    setModoFormulario("editar");
    setMensaje(null);
  };

  const cerrarFormularioForzado = () => {
    setModoFormulario(null);
    setEmpleadoEditar(null);
    setFormulario({ ...formularioInicial });
    setMostrarPassword(false);
    setMostrarConfirmacion(false);
  };

  const cerrarFormulario = () => {
    if (guardando) return;
    cerrarFormularioForzado();
  };

  const manejarCambio = (evento) => {
    const { name, value, type, checked } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validarFormulario = () => {
    if (!formulario.nombre.trim()) {
      return "Ingresa el nombre.";
    }

    if (!formulario.apellido.trim()) {
      return "Ingresa el apellido.";
    }

    if (
      formulario.rol !== "recepcionista" &&
      formulario.rol !== "bioquimico"
    ) {
      return "Selecciona un rol válido.";
    }

    if (modoFormulario === "crear") {
      const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!correoValido.test(formulario.email.trim())) {
        return "Ingresa un correo electrónico válido.";
      }

      if (!passwordSeguro(formulario.password)) {
        return "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.";
      }

      if (formulario.password !== formulario.confirmarPassword) {
        return "Las contraseñas no coinciden.";
      }
    }

    return "";
  };

  const guardar = async (evento) => {
    evento.preventDefault();

    const validacion = validarFormulario();

    if (validacion) {
      mostrarMensaje("error", validacion);
      return;
    }

    try {
      setGuardando(true);

      if (modoFormulario === "crear") {
        if (!puedeCrear) {
          throw new Error("No tienes permiso para registrar personal.");
        }

        const resultado = await crearPersonal({
          nombre: formulario.nombre,
          apellido: formulario.apellido,
          email: formulario.email,
          rol: formulario.rol,
          password: formulario.password,
          requiereVerificacionEmail:
            formulario.requiereVerificacionEmail,
          laboratorioId: usuario.laboratorioId,
        });

        cerrarFormularioForzado();
        await cargarDatos();

        mostrarMensaje(
          "exito",
          resultado?.verificacionEnviada
            ? "El integrante fue registrado correctamente. Se envió un correo de verificación."
            : "El integrante fue registrado correctamente."
        );
      } else {
        if (!empleadoEditar) return;

        if (!puedeEditar) {
          throw new Error("No tienes permiso para editar personal.");
        }

        await actualizarPersonal(empleadoEditar.id, {
          nombre: formulario.nombre,
          apellido: formulario.apellido,
          rol: formulario.rol,
        });

        cerrarFormularioForzado();
        await cargarDatos();

        mostrarMensaje(
          "exito",
          "La información del integrante fue actualizada correctamente."
        );
      }
    } catch (error) {
      console.error("Error guardando personal:", error);

      mostrarMensaje(
        "error",
        error?.code === "permission-denied"
          ? "No tienes permisos para realizar esta operación."
          : error?.message || "No se pudo guardar la información."
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (empleado) => {
    if (!puedeCambiarEstado) return;

    const nuevoEstado = !empleado.activo;

    const confirmar = window.confirm(
      nuevoEstado
        ? `¿Deseas activar la cuenta de ${empleado.nombre} ${empleado.apellido}?`
        : `¿Deseas desactivar la cuenta de ${empleado.nombre} ${empleado.apellido}?`
    );

    if (!confirmar) return;

    try {
      await cambiarEstadoPersonal(empleado.id, nuevoEstado);
      await cargarDatos();

      mostrarMensaje(
        "exito",
        nuevoEstado
          ? "La cuenta fue activada correctamente."
          : "La cuenta fue desactivada correctamente."
      );
    } catch (error) {
      console.error("Error cambiando estado:", error);

      mostrarMensaje(
        "error",
        error?.message || "No se pudo cambiar el estado de la cuenta."
      );
    }
  };

  // NUEVO: Abrir formulario de cambio de contraseña
  const abrirCambiarPassword = (empleado) => {
    if (!puedeEditar) return;

    setEmpleadoPassword(empleado);
    setNuevaPassword("");
    setConfirmarNuevaPassword("");
    setVerNuevaPassword(false);
    setVerConfirmarPassword(false);
    setMensaje(null);
  };

  // NUEVO: Cerrar formulario de cambio de contraseña
  const cerrarCambiarPassword = () => {
    if (guardandoPassword) return;

    setEmpleadoPassword(null);
    setNuevaPassword("");
    setConfirmarNuevaPassword("");
    setVerNuevaPassword(false);
    setVerConfirmarPassword(false);
  };

  // NUEVO: Guardar nueva contraseña
  const cambiarPassword = async (evento) => {
    evento.preventDefault();

    if (!puedeEditar || !empleadoPassword) {
      mostrarMensaje(
        "error",
        "No tienes permiso para cambiar esta contraseña."
      );
      return;
    }

    if (
      empleadoPassword.rol !== "recepcionista" &&
      empleadoPassword.rol !== "bioquimico"
    ) {
      mostrarMensaje(
        "error",
        "Solo puedes cambiar contraseñas de recepcionistas y bioquímicos."
      );
      return;
    }

    if (!passwordSeguro(nuevaPassword)) {
      mostrarMensaje(
        "error",
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
      );
      return;
    }

    if (nuevaPassword !== confirmarNuevaPassword) {
      mostrarMensaje("error", "Las contraseñas no coinciden.");
      return;
    }

    try {
      setGuardandoPassword(true);

      await restablecerPasswordPersonal(
        empleadoPassword.id,
        nuevaPassword
      );

      setEmpleadoPassword(null);
      setNuevaPassword("");
      setConfirmarNuevaPassword("");
      setVerNuevaPassword(false);
      setVerConfirmarPassword(false);

      mostrarMensaje(
        "exito",
        "La contraseña del empleado fue actualizada correctamente."
      );
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);

      mostrarMensaje(
        "error",
        error?.message || "No se pudo cambiar la contraseña."
      );
    } finally {
      setGuardandoPassword(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "No registrada";

    try {
      if (typeof fecha.toDate === "function") {
        return fecha.toDate().toLocaleString("es-BO");
      }

      if (fecha.seconds) {
        return new Date(fecha.seconds * 1000).toLocaleString("es-BO");
      }

      return new Date(fecha).toLocaleString("es-BO");
    } catch {
      return "No registrada";
    }
  };

  const cantidadActivos = personal.filter(
    (item) => item.activo
  ).length;

  const cantidadRecepcionistas = personal.filter(
    (item) => item.rol === "recepcionista"
  ).length;

  const cantidadBioquimicos = personal.filter(
    (item) => item.rol === "bioquimico"
  ).length;

  if (usuario?.rol !== "administrador") {
    return (
      <main className="personal-page">
        <section className="personal-access">
          <div className="personal-access-icon">🔒</div>
          <h1>Acceso restringido</h1>
          <p>No tienes autorización para administrar el personal.</p>
          <button
            type="button"
            className="personal-primary"
            onClick={volver}
          >
            ← Volver
          </button>
        </section>
      </main>
    );
  }

  if (!puedeVer) {
    return (
      <main className="personal-page">
        <section className="personal-access">
          <div className="personal-access-icon">🔒</div>
          <h1>Acceso restringido</h1>
          <p>Tu cuenta no tiene permiso para consultar el personal.</p>
          <button
            type="button"
            className="personal-primary"
            onClick={volver}
          >
            ← Volver
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="personal-page">
      <header className="personal-header">
        <div>
          <button
            type="button"
            className="personal-back"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <h1>Gestión de personal</h1>

          <p>
            Administra las cuentas de Recepcionistas y Bioquímicos
            de tu laboratorio.
          </p>
        </div>

        {puedeCrear && (
          <button
            type="button"
            className="personal-primary"
            onClick={abrirCrear}
          >
            + Nuevo integrante
          </button>
        )}
      </header>

      {mensaje && (
        <div className={`personal-message ${mensaje.tipo}`}>
          <span>{mensaje.tipo === "exito" ? "✓" : "!"}</span>
          {" "}
          {mensaje.texto}
        </div>
      )}

      {laboratorio && (
        <section className="personal-lab-bar">
          <div className="personal-lab-logo">
            {laboratorio.logoUrl ? (
              <img
                src={laboratorio.logoUrl}
                alt="Logo del laboratorio"
                onError={(evento) => {
                  evento.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span>🧪</span>
            )}
          </div>

          <div>
            <small>Laboratorio</small>

            <strong>
              {laboratorio.nombreVisible || laboratorio.nombre}
            </strong>

            <span>
              El personal nuevo se asociará automáticamente
              a este laboratorio.
            </span>
          </div>
        </section>
      )}

      <section className="personal-stats">
        <Resumen
          icono="👥"
          titulo="Personal"
          valor={personal.length}
          texto="Total registrado"
          clase="blue"
        />

        <Resumen
          icono="✓"
          titulo="Activos"
          valor={cantidadActivos}
          texto="Cuentas habilitadas"
          clase="green"
        />

        <Resumen
          icono="💼"
          titulo="Recepcionistas"
          valor={cantidadRecepcionistas}
          texto="Personal de recepción"
          clase="cyan"
        />

        <Resumen
          icono="🧪"
          titulo="Bioquímicos"
          valor={cantidadBioquimicos}
          texto="Personal bioquímico"
          clase="purple"
        />
      </section>

      <section className="personal-toolbar">
        <div className="personal-search">
          <span>🔎</span>

          <input
            type="text"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre, apellido o correo..."
          />
        </div>

        <button
          type="button"
          className={
            mostrarFiltros
              ? "personal-filter active"
              : "personal-filter"
          }
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
        >
          Filtros

          {(filtroRol !== "todos" ||
            filtroEstado !== "todos") && (
            <span className="personal-filter-dot" />
          )}
        </button>
      </section>

      {mostrarFiltros && (
        <section className="personal-filters">
          <div className="personal-filter-header">
            <h3>Filtrar resultados</h3>

            <button type="button" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>

          <div className="personal-filter-grid">
            <div className="personal-field">
              <label>Rol</label>

              <select
                value={filtroRol}
                onChange={(evento) =>
                  setFiltroRol(evento.target.value)
                }
              >
                <option value="todos">Todos los roles</option>
                <option value="recepcionista">Recepcionistas</option>
                <option value="bioquimico">Bioquímicos</option>
              </select>
            </div>

            <div className="personal-field">
              <label>Estado</label>

              <select
                value={filtroEstado}
                onChange={(evento) =>
                  setFiltroEstado(evento.target.value)
                }
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>
        </section>
      )}

      <section className="personal-list">
        <div className="personal-list-header">
          <div>
            <h2>Personal registrado</h2>

            <p>
              Consulta y administra las cuentas vinculadas
              a tu laboratorio.
            </p>
          </div>

          <span>{personalFiltrado.length} resultado(s)</span>
        </div>

        {cargando ? (
          <div className="personal-empty">
            <div className="personal-spinner" />
            <p>Cargando personal...</p>
          </div>
        ) : personalFiltrado.length === 0 ? (
          <div className="personal-empty">
            <div className="personal-empty-icon">🔎</div>

            <h3>No se encontraron resultados</h3>

            <p>
              Prueba con otra búsqueda o modifica los filtros.
            </p>

            <button type="button" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="personal-table-wrapper">
            <table className="personal-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {personalFiltrado.map((empleado) => (
                  <tr key={empleado.id}>
                    <td>
                      <div className="personal-user">
                        <div className="personal-avatar">
                          {(empleado.nombre || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {empleado.nombre} {empleado.apellido}
                          </strong>

                          <span>Personal del laboratorio</span>
                        </div>
                      </div>
                    </td>

                    <td>{empleado.email}</td>

                    <td>
                      <span
                        className={`personal-role ${empleado.rol}`}
                      >
                        {nombreRol(empleado.rol)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          empleado.activo
                            ? "personal-status active"
                            : "personal-status inactive"
                        }
                      >
                        ● {empleado.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="personal-actions">
                        <button
                          type="button"
                          className="personal-action view"
                          onClick={() => setEmpleadoVer(empleado)}
                        >
                          👁 Ver
                        </button>

                        <button
                          type="button"
                          className="personal-action detail"
                          onClick={() => setEmpleadoDetalle(empleado)}
                        >
                          📄 Detalle
                        </button>

                        {puedeEditar && (
                          <>
                            <button
                              type="button"
                              className="personal-action edit"
                              onClick={() => abrirEditar(empleado)}
                            >
                              ✎ Editar
                            </button>

                            <button
                              type="button"
                              className="personal-action edit"
                              onClick={() =>
                                abrirCambiarPassword(empleado)
                              }
                            >
                              🔐 Cambiar contraseña
                            </button>
                          </>
                        )}

                        {puedeCambiarEstado && (
                          <button
                            type="button"
                            className={
                              empleado.activo
                                ? "personal-action disable"
                                : "personal-action enable"
                            }
                            onClick={() => cambiarEstado(empleado)}
                          >
                            {empleado.activo
                              ? "Desactivar"
                              : "Activar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* FORMULARIO DE REGISTRO Y EDICIÓN */}

      {modoFormulario && (
        <div className="personal-modal-overlay">
          <section className="personal-modal personal-form-modal">
            <div className="personal-modal-header">
              <div>
                <h2>
                  {modoFormulario === "crear"
                    ? "Nuevo integrante"
                    : "Editar integrante"}
                </h2>

                <p>
                  {modoFormulario === "crear"
                    ? "Registra una nueva cuenta para el personal de tu laboratorio."
                    : "Actualiza los datos y el rol del usuario."}
                </p>
              </div>

              <button
                type="button"
                className="personal-close"
                onClick={cerrarFormulario}
                disabled={guardando}
              >
                ×
              </button>
            </div>

            <form className="personal-form" onSubmit={guardar}>
              <div className="personal-form-section">
                <div className="personal-section-title">
                  <div className="personal-section-icon">👤</div>

                  <div>
                    <h3>Información personal</h3>
                    <p>Datos principales del integrante.</p>
                  </div>
                </div>

                <div className="personal-form-grid">
                  <div className="personal-field">
                    <label>Nombre *</label>

                    <input
                      type="text"
                      name="nombre"
                      value={formulario.nombre}
                      onChange={manejarCambio}
                      placeholder="Nombre"
                      required
                    />
                  </div>

                  <div className="personal-field">
                    <label>Apellido *</label>

                    <input
                      type="text"
                      name="apellido"
                      value={formulario.apellido}
                      onChange={manejarCambio}
                      placeholder="Apellido"
                      required
                    />
                  </div>

                  <div className="personal-field personal-full">
                    <label>Correo electrónico *</label>

                    <input
                      type="email"
                      name="email"
                      value={formulario.email}
                      onChange={manejarCambio}
                      disabled={modoFormulario === "editar"}
                      placeholder="usuario@correo.com"
                      required
                    />

                    {modoFormulario === "editar" && (
                      <small>
                        El correo de acceso no se modifica
                        desde esta pantalla.
                      </small>
                    )}
                  </div>

                  <div className="personal-field personal-full">
                    <label>Rol *</label>

                    <select
                      name="rol"
                      value={formulario.rol}
                      onChange={manejarCambio}
                      required
                    >
                      <option value="">Selecciona un rol</option>
                      <option value="recepcionista">
                        Recepcionista
                      </option>
                      <option value="bioquimico">
                        Bioquímico
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="personal-form-section">
                <div className="personal-section-title">
                  <div className="personal-section-icon purple">
                    🏥
                  </div>

                  <div>
                    <h3>Laboratorio</h3>

                    <p>
                      La cuenta quedará asociada automáticamente
                      a tu laboratorio.
                    </p>
                  </div>
                </div>

                <LaboratorioAsignado laboratorio={laboratorio} />
              </div>

              {modoFormulario === "crear" && (
                <div className="personal-form-section">
                  <div className="personal-section-title">
                    <div className="personal-section-icon green">
                      🔐
                    </div>

                    <div>
                      <h3>Acceso a la cuenta</h3>
                      <p>Define las credenciales iniciales.</p>
                    </div>
                  </div>

                  <div className="personal-form-grid">
                    <div className="personal-field">
                      <label>Contraseña *</label>

                      <div className="personal-password">
                        <input
                          type={
                            mostrarPassword ? "text" : "password"
                          }
                          name="password"
                          value={formulario.password}
                          onChange={manejarCambio}
                          placeholder="Contraseña segura"
                          required
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setMostrarPassword(!mostrarPassword)
                          }
                        >
                          {mostrarPassword ? "Ocultar" : "Ver"}
                        </button>
                      </div>
                    </div>

                    <div className="personal-field">
                      <label>Confirmar contraseña *</label>

                      <div className="personal-password">
                        <input
                          type={
                            mostrarConfirmacion
                              ? "text"
                              : "password"
                          }
                          name="confirmarPassword"
                          value={formulario.confirmarPassword}
                          onChange={manejarCambio}
                          placeholder="Repite la contraseña"
                          required
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

                  <div className="personal-password-rules">
                    <strong>La contraseña debe contener:</strong>

                    <div>
                      <ReglaPassword
                        correcta={formulario.password.length >= 8}
                        texto="8 caracteres como mínimo"
                      />

                      <ReglaPassword
                        correcta={/[A-Z]/.test(formulario.password)}
                        texto="Una letra mayúscula"
                      />

                      <ReglaPassword
                        correcta={/[a-z]/.test(formulario.password)}
                        texto="Una letra minúscula"
                      />

                      <ReglaPassword
                        correcta={/[0-9]/.test(formulario.password)}
                        texto="Un número"
                      />

                      <ReglaPassword
                        correcta={/[^A-Za-z0-9]/.test(
                          formulario.password
                        )}
                        texto="Un carácter especial"
                      />
                    </div>
                  </div>

                  <label className="personal-checkbox">
                    <input
                      type="checkbox"
                      name="requiereVerificacionEmail"
                      checked={
                        formulario.requiereVerificacionEmail
                      }
                      onChange={manejarCambio}
                    />

                    <span>
                      <strong>
                        Solicitar verificación de correo
                      </strong>

                      <small>
                        El usuario deberá verificar su correo
                        antes de iniciar sesión.
                      </small>
                    </span>
                  </label>
                </div>
              )}

              <div className="personal-form-actions">
                <button
                  type="button"
                  className="personal-secondary"
                  onClick={cerrarFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="personal-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : modoFormulario === "crear"
                    ? "Registrar integrante"
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* NUEVO: FORMULARIO PARA CAMBIAR CONTRASEÑA */}

      {empleadoPassword && (
        <div className="personal-modal-overlay">
          <section className="personal-modal personal-form-modal">
            <div className="personal-modal-header">
              <div>
                <h2>Cambiar contraseña</h2>

                <p>
                  Establece una nueva contraseña para este empleado.
                </p>
              </div>

              <button
                type="button"
                className="personal-close"
                onClick={cerrarCambiarPassword}
                disabled={guardandoPassword}
              >
                ×
              </button>
            </div>

            <form
              className="personal-form"
              onSubmit={cambiarPassword}
            >
              <div className="personal-form-section">
                <div className="personal-section-title">
                  <div className="personal-section-icon green">
                    🔐
                  </div>

                  <div>
                    <h3>
                      {empleadoPassword.nombre}{" "}
                      {empleadoPassword.apellido}
                    </h3>

                    <p>{empleadoPassword.email}</p>
                  </div>
                </div>

                <div className="personal-form-grid">
                  <div className="personal-field">
                    <label>Nueva contraseña *</label>

                    <div className="personal-password">
                      <input
                        type={
                          verNuevaPassword ? "text" : "password"
                        }
                        value={nuevaPassword}
                        onChange={(evento) =>
                          setNuevaPassword(evento.target.value)
                        }
                        placeholder="Nueva contraseña"
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setVerNuevaPassword(!verNuevaPassword)
                        }
                      >
                        {verNuevaPassword ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>

                  <div className="personal-field">
                    <label>Confirmar nueva contraseña *</label>

                    <div className="personal-password">
                      <input
                        type={
                          verConfirmarPassword ? "text" : "password"
                        }
                        value={confirmarNuevaPassword}
                        onChange={(evento) =>
                          setConfirmarNuevaPassword(
                            evento.target.value
                          )
                        }
                        placeholder="Confirmar contraseña"
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setVerConfirmarPassword(
                            !verConfirmarPassword
                          )
                        }
                      >
                        {verConfirmarPassword ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="personal-password-rules">
                  <strong>La contraseña debe contener:</strong>

                  <div>
                    <ReglaPassword
                      correcta={nuevaPassword.length >= 8}
                      texto="8 caracteres como mínimo"
                    />

                    <ReglaPassword
                      correcta={/[A-Z]/.test(nuevaPassword)}
                      texto="Una letra mayúscula"
                    />

                    <ReglaPassword
                      correcta={/[a-z]/.test(nuevaPassword)}
                      texto="Una letra minúscula"
                    />

                    <ReglaPassword
                      correcta={/[0-9]/.test(nuevaPassword)}
                      texto="Un número"
                    />

                    <ReglaPassword
                      correcta={/[^A-Za-z0-9]/.test(nuevaPassword)}
                      texto="Un carácter especial"
                    />

                    <ReglaPassword
                      correcta={
                        nuevaPassword.length > 0 &&
                        nuevaPassword === confirmarNuevaPassword
                      }
                      texto="Las contraseñas coinciden"
                    />
                  </div>
                </div>
              </div>

              <div className="personal-form-actions">
                <button
                  type="button"
                  className="personal-secondary"
                  onClick={cerrarCambiarPassword}
                  disabled={guardandoPassword}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="personal-primary"
                  disabled={guardandoPassword}
                >
                  {guardandoPassword
                    ? "Actualizando..."
                    : "Guardar nueva contraseña"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* VER PERFIL */}

      {empleadoVer && (
        <div className="personal-modal-overlay">
          <section className="personal-modal personal-small">
            <div className="personal-modal-header">
              <div>
                <h2>Perfil del usuario</h2>
              </div>

              <button
                type="button"
                className="personal-close"
                onClick={() => setEmpleadoVer(null)}
              >
                ×
              </button>
            </div>

            <div className="personal-profile">
              <div className="personal-profile-avatar">
                {(empleadoVer.nombre || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <h3>
                {empleadoVer.nombre} {empleadoVer.apellido}
              </h3>

              <p>{empleadoVer.email}</p>

              <span
                className={`personal-role ${empleadoVer.rol}`}
              >
                {nombreRol(empleadoVer.rol)}
              </span>

              <span
                className={
                  empleadoVer.activo
                    ? "personal-status active"
                    : "personal-status inactive"
                }
              >
                ● {empleadoVer.activo ? "Activo" : "Inactivo"}
              </span>

              <div className="personal-profile-lab">
                <span>🏥</span>

                <div>
                  <small>Laboratorio</small>

                  <strong>
                    {laboratorio?.nombreVisible ||
                      laboratorio?.nombre ||
                      "Laboratorio"}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="personal-primary personal-full-button"
              onClick={() => setEmpleadoVer(null)}
            >
              Cerrar
            </button>
          </section>
        </div>
      )}

      {/* DETALLE DEL USUARIO */}

      {empleadoDetalle && (
        <div className="personal-modal-overlay">
          <section className="personal-modal">
            <div className="personal-modal-header">
              <div>
                <h2>Detalle del usuario</h2>

                <p>Información completa de la cuenta.</p>
              </div>

              <button
                type="button"
                className="personal-close"
                onClick={() => setEmpleadoDetalle(null)}
              >
                ×
              </button>
            </div>

            <div className="personal-detail-grid">
              <Detalle
                titulo="Nombre"
                valor={empleadoDetalle.nombre}
              />

              <Detalle
                titulo="Apellido"
                valor={empleadoDetalle.apellido}
              />

              <Detalle
                titulo="Correo electrónico"
                valor={empleadoDetalle.email}
              />

              <Detalle
                titulo="Rol"
                valor={nombreRol(empleadoDetalle.rol)}
              />

              <Detalle
                titulo="Estado"
                valor={
                  empleadoDetalle.activo ? "Activo" : "Inactivo"
                }
              />

              <Detalle
                titulo="Laboratorio"
                valor={
                  laboratorio?.nombreVisible ||
                  laboratorio?.nombre
                }
              />

              <Detalle
                titulo="Verificación de correo"
                valor={
                  empleadoDetalle.requiereVerificacionEmail
                    ? "Requerida"
                    : "No requerida"
                }
              />

              <Detalle
                titulo="Fecha de registro"
                valor={formatearFecha(
                  empleadoDetalle.fechaRegistro
                )}
              />

              <Detalle
                titulo="UID"
                valor={empleadoDetalle.id}
                completo
              />
            </div>

            <IdentidadLaboratorio laboratorio={laboratorio} />

            <div className="personal-modal-footer">
              <button
                type="button"
                className="personal-secondary"
                onClick={() => setEmpleadoDetalle(null)}
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

function Resumen({ icono, titulo, valor, texto, clase }) {
  return (
    <article className="personal-stat">
      <div className={`personal-stat-icon ${clase}`}>
        {icono}
      </div>

      <div>
        <span>{titulo}</span>
        <strong>{valor}</strong>
        <small>{texto}</small>
      </div>
    </article>
  );
}

function ReglaPassword({ correcta, texto }) {
  return (
    <span
      className={
        correcta
          ? "personal-password-rule valid"
          : "personal-password-rule"
      }
    >
      {correcta ? "✓" : "○"} {texto}
    </span>
  );
}

function LaboratorioAsignado({ laboratorio }) {
  if (!laboratorio) {
    return (
      <div className="personal-selected-lab">
        <div className="personal-selected-logo">🧪</div>

        <div>
          <small>Laboratorio asignado</small>
          <strong>Cargando información...</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-selected-lab">
      <div className="personal-selected-logo">
        {laboratorio.logoUrl ? (
          <img
            src={laboratorio.logoUrl}
            alt="Logo"
            onError={(evento) => {
              evento.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span>🧪</span>
        )}
      </div>

      <div>
        <small>Laboratorio asignado</small>

        <strong>
          {laboratorio.nombreVisible || laboratorio.nombre}
        </strong>

        <span>La asociación se realiza automáticamente.</span>
      </div>
    </div>
  );
}

function IdentidadLaboratorio({ laboratorio }) {
  if (!laboratorio) return null;

  const colorPrimario = /^#[0-9A-Fa-f]{6}$/.test(
    laboratorio.colorPrimario
  )
    ? laboratorio.colorPrimario
    : "#2563EB";

  const colorSecundario = /^#[0-9A-Fa-f]{6}$/.test(
    laboratorio.colorSecundario
  )
    ? laboratorio.colorSecundario
    : "#14B8A6";

  return (
    <section className="personal-identity">
      <div>
        <h3>Identidad del laboratorio</h3>

        <p>
          Esta apariencia estará disponible para el usuario
          al ingresar al sistema.
        </p>
      </div>

      <div
        className="personal-identity-preview"
        style={{
          background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})`,
        }}
      >
        <div className="personal-identity-logo">
          {laboratorio.logoUrl ? (
            <img
              src={laboratorio.logoUrl}
              alt="Logo"
            />
          ) : (
            <span>🧪</span>
          )}
        </div>

        <div>
          <strong>
            {laboratorio.nombreVisible || laboratorio.nombre}
          </strong>

          <span>{laboratorio.nombre}</span>
        </div>
      </div>
    </section>
  );
}

function Detalle({ titulo, valor, completo = false }) {
  return (
    <div
      className={
        completo
          ? "personal-detail-item full"
          : "personal-detail-item"
      }
    >
      <span>{titulo}</span>
      <strong>{valor || "No registrado"}</strong>
    </div>
  );
}

export default GestionPersonal;