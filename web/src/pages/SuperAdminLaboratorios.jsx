import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  actualizarLaboratorio,
  cambiarEstadoLaboratorio,
  crearLaboratorio,
  obtenerLaboratorios,
} from "../services/laboratoriosService";

import "./SuperAdminLaboratorios.css";


const formularioInicial = {
  nombre: "",
  direccion: "",
  telefono: "",
  email: "",
};


function SuperAdminLaboratorios({
  permisos = [],
  volver,
}) {
  // =====================================================
  // PERMISOS
  // =====================================================

  const puedeVer =
    permisos.includes(
      "laboratorios.ver"
    );

  const puedeCrear =
    permisos.includes(
      "laboratorios.crear"
    );

  const puedeEditar =
    permisos.includes(
      "laboratorios.editar"
    );

  const puedeCambiarEstado =
    permisos.includes(
      "laboratorios.desactivar"
    );


  // =====================================================
  // ESTADOS
  // =====================================================

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
    filtroEstado,
    setFiltroEstado,
  ] = useState("todos");


  // =====================================================
  // FORMULARIO
  // =====================================================

  const [
    mostrarFormulario,
    setMostrarFormulario,
  ] = useState(false);


  const [
    editandoId,
    setEditandoId,
  ] = useState(null);


  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );


  // =====================================================
  // VER
  // =====================================================

  const [
    laboratorioVer,
    setLaboratorioVer,
  ] = useState(null);


  // =====================================================
  // VER DETALLE
  // =====================================================

  const [
    laboratorioDetalle,
    setLaboratorioDetalle,
  ] = useState(null);


  // =====================================================
  // MENSAJES
  // =====================================================

  const mostrarMensaje = (
    tipo,
    texto
  ) => {
    setMensaje({
      tipo,
      texto,
    });


    window.setTimeout(
      () => {
        setMensaje(
          null
        );
      },
      3500
    );
  };


  // =====================================================
  // CARGAR
  // =====================================================

  const cargarLaboratorios =
    async () => {
      if (!puedeVer) {
        setLaboratorios([]);
        setCargando(false);
        return;
      }


      try {
        setCargando(true);


        const resultado =
          await obtenerLaboratorios();


        setLaboratorios(
          Array.isArray(
            resultado
          )
            ? resultado
            : []
        );


      } catch (error) {
        console.error(
          "Error al cargar laboratorios:",
          error
        );


        mostrarMensaje(
          "error",
          error?.message ||
            "No se pudieron cargar los laboratorios."
        );


      } finally {
        setCargando(false);
      }
    };


  useEffect(() => {
    cargarLaboratorios();
  }, []);


  // =====================================================
  // CAMBIAR FORMULARIO
  // =====================================================

  const manejarCambio = (
    evento
  ) => {
    const {
      name,
      value,
    } = evento.target;


    setFormulario(
      (anterior) => ({
        ...anterior,

        [name]:
          value,
      })
    );
  };


  // =====================================================
  // NUEVO
  // =====================================================

  const abrirNuevo =
    () => {
      setEditandoId(null);

      setFormulario(
        formularioInicial
      );

      setMostrarFormulario(
        true
      );

      setMensaje(null);
    };


  // =====================================================
  // EDITAR
  // =====================================================

  const abrirEditar = (
    laboratorio
  ) => {
    if (!puedeEditar) {
      return;
    }


    setEditandoId(
      laboratorio.id
    );


    setFormulario({
      nombre:
        laboratorio.nombre ||
        "",

      direccion:
        laboratorio.direccion ||
        "",

      telefono:
        laboratorio.telefono ||
        "",

      email:
        laboratorio.email ||
        "",
    });


    setMostrarFormulario(
      true
    );


    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  // =====================================================
  // CANCELAR
  // =====================================================

  const cancelarFormulario =
    () => {
      setMostrarFormulario(
        false
      );

      setEditandoId(
        null
      );

      setFormulario(
        formularioInicial
      );
    };


  // =====================================================
  // VALIDAR
  // =====================================================

  const validarFormulario =
    () => {
      if (
        formulario.nombre.trim() ===
        ""
      ) {
        return "Ingrese el nombre del laboratorio.";
      }


      if (
        formulario.direccion.trim() ===
        ""
      ) {
        return "Ingrese la dirección.";
      }


      if (
        formulario.telefono.trim() ===
        ""
      ) {
        return "Ingrese el teléfono.";
      }


      if (
        formulario.email.trim() ===
        ""
      ) {
        return "Ingrese el correo electrónico.";
      }


      const correoValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (
        !correoValido.test(
          formulario.email.trim()
        )
      ) {
        return "Ingrese un correo electrónico válido.";
      }


      return "";
    };


  // =====================================================
  // GUARDAR
  // =====================================================

  const guardar = async (
    evento
  ) => {
    evento.preventDefault();


    const errorValidacion =
      validarFormulario();


    if (errorValidacion) {
      mostrarMensaje(
        "error",
        errorValidacion
      );

      return;
    }


    try {
      setGuardando(true);


      if (editandoId) {
        if (!puedeEditar) {
          mostrarMensaje(
            "error",
            "No tiene permiso para editar laboratorios."
          );

          return;
        }


        await actualizarLaboratorio(
          editandoId,
          formulario
        );


        mostrarMensaje(
          "exito",
          "Laboratorio actualizado correctamente."
        );


      } else {
        if (!puedeCrear) {
          mostrarMensaje(
            "error",
            "No tiene permiso para registrar laboratorios."
          );

          return;
        }


        await crearLaboratorio(
          formulario
        );


        mostrarMensaje(
          "exito",
          "Laboratorio registrado correctamente."
        );
      }


      cancelarFormulario();


      await cargarLaboratorios();


    } catch (error) {
      console.error(
        "Error al guardar laboratorio:",
        error
      );


      mostrarMensaje(
        "error",
        error?.message ||
          "No se pudo guardar el laboratorio."
      );


    } finally {
      setGuardando(false);
    }
  };


  // =====================================================
  // CAMBIAR ESTADO
  // =====================================================

  const cambiarEstado =
    async (
      laboratorio
    ) => {
      if (
        !puedeCambiarEstado
      ) {
        return;
      }


      const nuevoEstado =
        !laboratorio.activo;


      const confirmar =
        window.confirm(
          nuevoEstado
            ? `¿Desea activar el laboratorio "${laboratorio.nombre}"?`
            : `¿Desea desactivar el laboratorio "${laboratorio.nombre}"?`
        );


      if (!confirmar) {
        return;
      }


      try {
        await cambiarEstadoLaboratorio(
          laboratorio.id,
          nuevoEstado
        );


        mostrarMensaje(
          "exito",
          nuevoEstado
            ? "Laboratorio activado correctamente."
            : "Laboratorio desactivado correctamente."
        );


        await cargarLaboratorios();


      } catch (error) {
        console.error(
          "Error al cambiar estado:",
          error
        );


        mostrarMensaje(
          "error",
          error?.message ||
            "No se pudo cambiar el estado."
        );
      }
    };


  // =====================================================
  // FILTRAR
  // =====================================================

  const laboratoriosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();


      return laboratorios.filter(
        (laboratorio) => {
          const coincideBusqueda =
            texto === "" ||
            [
              laboratorio.nombre,
              laboratorio.direccion,
              laboratorio.telefono,
              laboratorio.email,
              laboratorio.laboratorioId,
            ].some(
              (valor) =>
                String(
                  valor ||
                  ""
                )
                  .toLowerCase()
                  .includes(
                    texto
                  )
            );


          let coincideEstado =
            true;


          if (
            filtroEstado ===
            "activo"
          ) {
            coincideEstado =
              laboratorio.activo ===
              true;
          }


          if (
            filtroEstado ===
            "inactivo"
          ) {
            coincideEstado =
              laboratorio.activo !==
              true;
          }


          return (
            coincideBusqueda &&
            coincideEstado
          );
        }
      );

    }, [
      laboratorios,
      busqueda,
      filtroEstado,
    ]);


  // =====================================================
  // LIMPIAR FILTROS
  // =====================================================

  const limpiarFiltros =
    () => {
      setBusqueda("");

      setFiltroEstado(
        "todos"
      );
    };


  // =====================================================
  // FECHA
  // =====================================================

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return "Sin fecha";
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


      if (
        fecha.seconds
      ) {
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
      return "Sin fecha";
    }
  };


  // =====================================================
  // ACCESO
  // =====================================================

  if (!puedeVer) {
    return (
      <main className="lab-page">

        <section className="lab-access">

          <div className="lab-access-icon">
            🔒
          </div>

          <h1>
            Acceso restringido
          </h1>

          <p>
            No tiene permiso para consultar laboratorios.
          </p>

          <button
            type="button"
            className="lab-primary"
            onClick={
              volver
            }
          >
            ← Volver
          </button>

        </section>

      </main>
    );
  }


  return (
    <main className="lab-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="lab-header">

        <div>

          <button
            type="button"
            className="lab-back"
            onClick={
              volver
            }
          >
            ← Dashboard
          </button>


          <span className="lab-eyebrow">
            HU-04 · SUPER ADMINISTRACIÓN
          </span>


          <h1>
            Gestión de laboratorios
          </h1>


          <p>
            Registra, consulta, modifica y controla los
            laboratorios que utilizan la plataforma.
          </p>

        </div>


        {puedeCrear && (
          <button
            type="button"
            className="lab-primary"
            onClick={
              abrirNuevo
            }
          >
            + Registrar laboratorio
          </button>
        )}

      </header>


      {/* =================================================
          MENSAJE
      ================================================= */}

      {mensaje && (
        <div
          className={`lab-message ${mensaje.tipo}`}
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


      {/* =================================================
          RESUMEN
      ================================================= */}

      <section className="lab-stats">

        <article>
          <div className="lab-stat-icon blue">
            🏥
          </div>

          <div>
            <span>
              Laboratorios
            </span>

            <strong>
              {laboratorios.length}
            </strong>

            <small>
              Total registrado
            </small>
          </div>
        </article>


        <article>
          <div className="lab-stat-icon green">
            ✓
          </div>

          <div>
            <span>
              Activos
            </span>

            <strong>
              {
                laboratorios.filter(
                  (item) =>
                    item.activo
                ).length
              }
            </strong>

            <small>
              En funcionamiento
            </small>
          </div>
        </article>


        <article>
          <div className="lab-stat-icon red">
            ×
          </div>

          <div>
            <span>
              Inactivos
            </span>

            <strong>
              {
                laboratorios.filter(
                  (item) =>
                    !item.activo
                ).length
              }
            </strong>

            <small>
              Deshabilitados
            </small>
          </div>
        </article>

      </section>


      {/* =================================================
          FORMULARIO
      ================================================= */}

      {mostrarFormulario && (
        <section className="lab-form-card">

          <div className="lab-section-title">

            <div>

              <span>
                {editandoId
                  ? "EDITAR REGISTRO"
                  : "NUEVO REGISTRO"}
              </span>

              <h2>
                {editandoId
                  ? "Editar laboratorio"
                  : "Registrar laboratorio"}
              </h2>

            </div>


            <button
              type="button"
              className="lab-close"
              onClick={
                cancelarFormulario
              }
            >
              ×
            </button>

          </div>


          <form
            className="lab-form"
            onSubmit={
              guardar
            }
          >

            <div className="lab-field">

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
                placeholder="Ej. Laboratorio Central"
              />

            </div>


            <div className="lab-field">

              <label>
                Dirección *
              </label>

              <input
                type="text"
                name="direccion"
                value={
                  formulario.direccion
                }
                onChange={
                  manejarCambio
                }
                placeholder="Dirección del laboratorio"
              />

            </div>


            <div className="lab-field">

              <label>
                Teléfono *
              </label>

              <input
                type="text"
                name="telefono"
                value={
                  formulario.telefono
                }
                onChange={
                  manejarCambio
                }
                placeholder="Ej. 44556677"
              />

            </div>


            <div className="lab-field">

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
                placeholder="laboratorio@correo.com"
              />

            </div>


            <div className="lab-form-actions">

              <button
                type="button"
                className="lab-secondary"
                onClick={
                  cancelarFormulario
                }
                disabled={
                  guardando
                }
              >
                Cancelar
              </button>


              <button
                type="submit"
                className="lab-primary"
                disabled={
                  guardando
                }
              >
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Guardar cambios"
                    : "Registrar laboratorio"}
              </button>

            </div>

          </form>

        </section>
      )}


      {/* =================================================
          BUSCAR + FILTROS
      ================================================= */}

      <section className="lab-toolbar">

        <div className="lab-search">

          <span>
            🔎
          </span>

          <input
            type="text"
            value={
              busqueda
            }
            onChange={(
              evento
            ) =>
              setBusqueda(
                evento.target.value
              )
            }
            placeholder="Buscar por nombre, dirección, teléfono o correo..."
          />

        </div>


        <button
          type="button"
          className={
            mostrarFiltros
              ? "lab-filter active"
              : "lab-filter"
          }
          onClick={() =>
            setMostrarFiltros(
              !mostrarFiltros
            )
          }
        >
          ⚙ Filtros

          {filtroEstado !==
            "todos" && (
            <span className="lab-filter-dot" />
          )}

        </button>

      </section>


      {/* =================================================
          PANEL FILTROS
      ================================================= */}

      {mostrarFiltros && (
        <section className="lab-filters">

          <div className="lab-filter-header">

            <div>
              <span>
                FILTROS
              </span>

              <h3>
                Filtrar laboratorios
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


          <div className="lab-filter-grid">

            <div className="lab-field">

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
                  Todos
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


      {/* =================================================
          TABLA
      ================================================= */}

      <section className="lab-table-card">

        <div className="lab-table-header">

          <div>

            <span>
              LABORATORIOS
            </span>

            <h2>
              Laboratorios registrados
            </h2>

          </div>


          <div className="lab-count">
            {laboratoriosFiltrados.length} resultado(s)
          </div>

        </div>


        {cargando ? (
          <div className="lab-empty">

            <div className="lab-spinner" />

            <p>
              Cargando laboratorios...
            </p>

          </div>

        ) : laboratoriosFiltrados.length ===
          0 ? (
          <div className="lab-empty">

            <div className="lab-empty-icon">
              🔎
            </div>

            <h3>
              Sin resultados
            </h3>

            <p>
              No existen laboratorios que coincidan con
              la búsqueda o filtros seleccionados.
            </p>

          </div>

        ) : (
          <div className="lab-table-wrapper">

            <table className="lab-table">

              <thead>

                <tr>

                  <th>
                    Laboratorio
                  </th>

                  <th>
                    Correo
                  </th>

                  <th>
                    Teléfono
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

                {laboratoriosFiltrados.map(
                  (laboratorio) => (
                    <tr
                      key={
                        laboratorio.id
                      }
                    >

                      <td>

                        <div className="lab-name-cell">

                          <div className="lab-avatar">
                            🏥
                          </div>


                          <div>

                            <strong>
                              {laboratorio.nombre}
                            </strong>

                            <span>
                              {laboratorio.direccion ||
                                "Sin dirección"}
                            </span>

                          </div>

                        </div>

                      </td>


                      <td>
                        {laboratorio.email ||
                          "Sin correo"}
                      </td>


                      <td>
                        {laboratorio.telefono ||
                          "Sin teléfono"}
                      </td>


                      <td>

                        <span
                          className={
                            laboratorio.activo
                              ? "lab-status active"
                              : "lab-status inactive"
                          }
                        >
                          ●{" "}
                          {laboratorio.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>

                      </td>


                      <td>

                        <div className="lab-actions">

                          {/* VER */}

                          <button
                            type="button"
                            className="lab-action view"
                            onClick={() =>
                              setLaboratorioVer(
                                laboratorio
                              )
                            }
                          >
                            👁 Ver
                          </button>


                          {/* VER DETALLE */}

                          <button
                            type="button"
                            className="lab-action detail"
                            onClick={() =>
                              setLaboratorioDetalle(
                                laboratorio
                              )
                            }
                          >
                            📄 Ver detalle
                          </button>


                          {/* EDITAR */}

                          {puedeEditar && (
                            <button
                              type="button"
                              className="lab-action edit"
                              onClick={() =>
                                abrirEditar(
                                  laboratorio
                                )
                              }
                            >
                              ✎ Editar
                            </button>
                          )}


                          {/* ACTIVAR / DESACTIVAR */}

                          {puedeCambiarEstado && (
                            <button
                              type="button"
                              className={
                                laboratorio.activo
                                  ? "lab-action disable"
                                  : "lab-action enable"
                              }
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


      {/* =================================================
          MODAL VER
      ================================================= */}

      {laboratorioVer && (
        <div className="lab-modal-overlay">

          <section className="lab-modal small">

            <div className="lab-modal-header">

              <div>
                <span>
                  VISTA RÁPIDA
                </span>

                <h2>
                  Laboratorio
                </h2>
              </div>


              <button
                type="button"
                className="lab-close"
                onClick={() =>
                  setLaboratorioVer(
                    null
                  )
                }
              >
                ×
              </button>

            </div>


            <div className="lab-quick">

              <div className="lab-quick-icon">
                🏥
              </div>


              <h3>
                {laboratorioVer.nombre}
              </h3>


              <p>
                {laboratorioVer.email}
              </p>


              <span
                className={
                  laboratorioVer.activo
                    ? "lab-status active"
                    : "lab-status inactive"
                }
              >
                ●{" "}
                {laboratorioVer.activo
                  ? "Activo"
                  : "Inactivo"}
              </span>


              <div className="lab-quick-info">

                <p>
                  📍 {laboratorioVer.direccion}
                </p>

                <p>
                  ☎ {laboratorioVer.telefono}
                </p>

              </div>

            </div>


            <button
              type="button"
              className="lab-primary full"
              onClick={() =>
                setLaboratorioVer(
                  null
                )
              }
            >
              Cerrar
            </button>

          </section>

        </div>
      )}


      {/* =================================================
          MODAL VER DETALLE
      ================================================= */}

      {laboratorioDetalle && (
        <div className="lab-modal-overlay">

          <section className="lab-modal">

            <div className="lab-modal-header">

              <div>

                <span>
                  INFORMACIÓN COMPLETA
                </span>

                <h2>
                  Detalle del laboratorio
                </h2>

              </div>


              <button
                type="button"
                className="lab-close"
                onClick={() =>
                  setLaboratorioDetalle(
                    null
                  )
                }
              >
                ×
              </button>

            </div>


            <div className="lab-detail-grid">

              <Detalle
                titulo="Nombre"
                valor={
                  laboratorioDetalle.nombre
                }
              />


              <Detalle
                titulo="Estado"
                valor={
                  laboratorioDetalle.activo
                    ? "Activo"
                    : "Inactivo"
                }
              />


              <Detalle
                titulo="Correo electrónico"
                valor={
                  laboratorioDetalle.email
                }
              />


              <Detalle
                titulo="Teléfono"
                valor={
                  laboratorioDetalle.telefono
                }
              />


              <Detalle
                titulo="Dirección"
                valor={
                  laboratorioDetalle.direccion
                }
                completo
              />


              <Detalle
                titulo="Fecha de registro"
                valor={
                  formatearFecha(
                    laboratorioDetalle.fechaRegistro
                  )
                }
              />


              <Detalle
                titulo="ID del laboratorio"
                valor={
                  laboratorioDetalle.laboratorioId ||
                  laboratorioDetalle.id
                }
                completo
              />

            </div>


            {/* ===========================================
                PERSONALIZACIÓN
                SOLO CONSULTA EN HU-04
            =========================================== */}

            <div className="lab-extra">

              <span>
                IDENTIDAD VISUAL
              </span>

              <h3>
                Personalización asociada
              </h3>


              <div className="lab-extra-grid">

                <Detalle
                  titulo="Nombre visible"
                  valor={
                    laboratorioDetalle.nombreVisible ||
                    "No configurado"
                  }
                />


                <Detalle
                  titulo="Logo"
                  valor={
                    laboratorioDetalle.logoUrl
                      ? "Configurado"
                      : "No configurado"
                  }
                />


                <Detalle
                  titulo="Color principal"
                  valor={
                    laboratorioDetalle.colorPrimario ||
                    "No configurado"
                  }
                />


                <Detalle
                  titulo="Color secundario"
                  valor={
                    laboratorioDetalle.colorSecundario ||
                    "No configurado"
                  }
                />

              </div>


              <small>
                La identidad visual se administra en HU-06.
              </small>

            </div>


            <div className="lab-modal-footer">

              <button
                type="button"
                className="lab-secondary"
                onClick={() =>
                  setLaboratorioDetalle(
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


// =====================================================
// COMPONENTE DETALLE
// =====================================================

function Detalle({
  titulo,
  valor,
  completo = false,
}) {
  return (
    <div
      className={
        completo
          ? "lab-detail-item full"
          : "lab-detail-item"
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


export default SuperAdminLaboratorios;