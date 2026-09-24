import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  actualizarPersonalizacion,
  obtenerLaboratoriosPersonalizacion,
  PERSONALIZACION_DEFAULT,
} from "../services/personalizacionService";

import "./SuperAdminPersonalizacion.css";


const formularioInicial = {
  nombreVisible: "",
  logoUrl: "",
  colorPrimario:
    PERSONALIZACION_DEFAULT.colorPrimario,
  colorSecundario:
    PERSONALIZACION_DEFAULT.colorSecundario,
};


const combinaciones = [
  {
    nombre: "Azul profesional",
    primario: "#2563EB",
    secundario: "#0EA5E9",
  },
  {
    nombre: "Turquesa clínico",
    primario: "#0F766E",
    secundario: "#14B8A6",
  },
  {
    nombre: "Índigo",
    primario: "#4338CA",
    secundario: "#7C3AED",
  },
  {
    nombre: "Esmeralda",
    primario: "#059669",
    secundario: "#10B981",
  },
];


function SuperAdminPersonalizacion({
  permisos = [],
  volver,
}) {
  const puedeEditar =
    permisos.includes(
      "laboratorios.editar"
    );

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

  const [
    filtroPersonalizacion,
    setFiltroPersonalizacion,
  ] = useState("todos");

  const [
    laboratorioVer,
    setLaboratorioVer,
  ] = useState(null);

  const [
    laboratorioDetalle,
    setLaboratorioDetalle,
  ] = useState(null);

  const [
    laboratorioEditar,
    setLaboratorioEditar,
  ] = useState(null);

  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

  const [
    logoConError,
    setLogoConError,
  ] = useState(false);


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
        setMensaje(null);
      },
      3500
    );
  };


  const cargarLaboratorios =
    async () => {
      try {
        setCargando(true);

        const resultado =
          await obtenerLaboratoriosPersonalizacion();

        setLaboratorios(
          Array.isArray(resultado)
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
              laboratorio.nombreVisible,
              laboratorio.email,
              laboratorio.direccion,
              laboratorio.telefono,
              laboratorio.laboratorioId,
            ].some(
              (valor) =>
                String(
                  valor || ""
                )
                  .toLowerCase()
                  .includes(texto)
            );

          const coincideEstado =
            filtroEstado ===
            "todos" ||
            (
              filtroEstado ===
                "activo" &&
              laboratorio.activo
            ) ||
            (
              filtroEstado ===
                "inactivo" &&
              !laboratorio.activo
            );

          const coincideConfiguracion =
            filtroPersonalizacion ===
            "todos" ||
            (
              filtroPersonalizacion ===
                "configurado" &&
              laboratorio.personalizado
            ) ||
            (
              filtroPersonalizacion ===
                "sin_configurar" &&
              !laboratorio.personalizado
            );

          return (
            coincideBusqueda &&
            coincideEstado &&
            coincideConfiguracion
          );
        }
      );

    }, [
      laboratorios,
      busqueda,
      filtroEstado,
      filtroPersonalizacion,
    ]);


  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFiltroEstado("todos");
      setFiltroPersonalizacion(
        "todos"
      );
    };


  const abrirPersonalizacion =
    (
      laboratorio
    ) => {
      if (!puedeEditar) {
        mostrarMensaje(
          "error",
          "No tienes permiso para modificar la personalización."
        );

        return;
      }

      setLogoConError(false);

      setLaboratorioEditar(
        laboratorio
      );

      setFormulario({
        nombreVisible:
          laboratorio.nombreVisible ||
          laboratorio.nombre ||
          "",

        logoUrl:
          laboratorio.logoUrl ||
          "",

        colorPrimario:
          laboratorio.colorPrimario ||
          PERSONALIZACION_DEFAULT.colorPrimario,

        colorSecundario:
          laboratorio.colorSecundario ||
          PERSONALIZACION_DEFAULT.colorSecundario,
      });
    };


  const cerrarPersonalizacion =
    () => {
      if (guardando) {
        return;
      }

      setLaboratorioEditar(null);
      setFormulario(
        formularioInicial
      );
      setLogoConError(false);
    };


  const manejarCambio =
    (
      evento
    ) => {
      const {
        name,
        value,
      } = evento.target;

      if (name === "logoUrl") {
        setLogoConError(false);
      }

      setFormulario(
        (anterior) => ({
          ...anterior,
          [name]: value,
        })
      );
    };


  const quitarLogo =
    () => {
      setFormulario(
        (anterior) => ({
          ...anterior,
          logoUrl: "",
        })
      );

      setLogoConError(false);
    };


  const restaurarColores =
    () => {
      setFormulario(
        (anterior) => ({
          ...anterior,

          colorPrimario:
            PERSONALIZACION_DEFAULT.colorPrimario,

          colorSecundario:
            PERSONALIZACION_DEFAULT.colorSecundario,
        })
      );
    };


  const seleccionarCombinacion =
    (
      combinacion
    ) => {
      setFormulario(
        (anterior) => ({
          ...anterior,

          colorPrimario:
            combinacion.primario,

          colorSecundario:
            combinacion.secundario,
        })
      );
    };


  const guardarPersonalizacion =
    async (
      evento
    ) => {
      evento.preventDefault();

      if (!laboratorioEditar) {
        return;
      }

      if (
        formulario.nombreVisible
          .trim() === ""
      ) {
        mostrarMensaje(
          "error",
          "Ingresa el nombre visible del laboratorio."
        );

        return;
      }

      const patronColor =
        /^#[0-9A-Fa-f]{6}$/;

      if (
        !patronColor.test(
          formulario.colorPrimario
        ) ||
        !patronColor.test(
          formulario.colorSecundario
        )
      ) {
        mostrarMensaje(
          "error",
          "Los colores deben tener un formato hexadecimal válido."
        );

        return;
      }

      try {
        setGuardando(true);

        await actualizarPersonalizacion(
          laboratorioEditar.id,
          {
            nombreVisible:
              formulario.nombreVisible,

            logoUrl:
              formulario.logoUrl,

            colorPrimario:
              formulario.colorPrimario,

            colorSecundario:
              formulario.colorSecundario,
          }
        );

        await cargarLaboratorios();

        setLaboratorioEditar(
          null
        );

        mostrarMensaje(
          "exito",
          "La identidad visual fue actualizada correctamente."
        );

      } catch (error) {
        console.error(
          "Error al guardar:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          mostrarMensaje(
            "error",
            "No tienes permiso para realizar esta operación."
          );

        } else {
          mostrarMensaje(
            "error",
            error?.message ||
              "No se pudo guardar la personalización."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  const formatearFecha =
    (
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


  return (
    <main className="personalizacion-page">
      <header className="personalizacion-header">
        <div>
          <button
            type="button"
            className="personalizacion-back"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <h1>
            Personalización
          </h1>

          <p>
            Configura la identidad visual de cada laboratorio.
          </p>
        </div>

        <div className="personalizacion-header-icon">
          🎨
        </div>
      </header>


      {mensaje && (
        <div
          className={`personalizacion-message ${mensaje.tipo}`}
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


      <section className="personalizacion-stats">
        <ResumenCard
          icono="🏥"
          titulo="Laboratorios"
          valor={
            laboratorios.length
          }
          clase="azul"
        />

        <ResumenCard
          icono="🎨"
          titulo="Configurados"
          valor={
            laboratorios.filter(
              (item) =>
                item.personalizado
            ).length
          }
          clase="morado"
        />

        <ResumenCard
          icono="○"
          titulo="Pendientes"
          valor={
            laboratorios.filter(
              (item) =>
                !item.personalizado
            ).length
          }
          clase="amarillo"
        />
      </section>


      <section className="personalizacion-toolbar">
        <div className="personalizacion-search">
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
            placeholder="Buscar laboratorio..."
          />
        </div>

        <button
          type="button"
          className={
            mostrarFiltros
              ? "personalizacion-filter active"
              : "personalizacion-filter"
          }
          onClick={() =>
            setMostrarFiltros(
              !mostrarFiltros
            )
          }
        >
          Filtros

          {(
            filtroEstado !==
              "todos" ||
            filtroPersonalizacion !==
              "todos"
          ) && (
            <span className="filter-indicator" />
          )}
        </button>
      </section>


      {mostrarFiltros && (
        <section className="personalizacion-filters">
          <div className="filter-title">
            <h3>
              Filtrar resultados
            </h3>

            <button
              type="button"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar
            </button>
          </div>

          <div className="filter-grid">
            <div className="personalizacion-field">
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

            <div className="personalizacion-field">
              <label>
                Identidad visual
              </label>

              <select
                value={
                  filtroPersonalizacion
                }
                onChange={(
                  evento
                ) =>
                  setFiltroPersonalizacion(
                    evento.target.value
                  )
                }
              >
                <option value="todos">
                  Todos
                </option>

                <option value="configurado">
                  Configurados
                </option>

                <option value="sin_configurar">
                  Sin configurar
                </option>
              </select>
            </div>
          </div>
        </section>
      )}


      <section className="personalizacion-table-card">
        <div className="table-card-header">
          <div>
            <h2>
              Laboratorios
            </h2>

            <p>
              Gestiona la identidad visual de cada establecimiento.
            </p>
          </div>

          <span className="result-count">
            {laboratoriosFiltrados.length} resultado(s)
          </span>
        </div>


        {cargando ? (
          <div className="personalizacion-empty">
            <div className="personalizacion-spinner" />

            <p>
              Cargando laboratorios...
            </p>
          </div>

        ) : laboratoriosFiltrados.length ===
          0 ? (
          <div className="personalizacion-empty">
            <div className="empty-icon">
              🔎
            </div>

            <h3>
              No se encontraron resultados
            </h3>

            <p>
              Prueba con otra búsqueda o cambia los filtros.
            </p>
          </div>

        ) : (
          <div className="personalizacion-table-wrapper">
            <table className="personalizacion-table">
              <thead>
                <tr>
                  <th>
                    Laboratorio
                  </th>

                  <th>
                    Nombre visible
                  </th>

                  <th>
                    Colores
                  </th>

                  <th>
                    Estado
                  </th>

                  <th>
                    Configuración
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
                        <div className="laboratorio-cell">
                          <LogoLaboratorio
                            laboratorio={
                              laboratorio
                            }
                          />

                          <div>
                            <strong>
                              {laboratorio.nombre}
                            </strong>

                            <span>
                              {laboratorio.email ||
                                "Sin correo"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong className="nombre-visible">
                          {laboratorio.nombreVisible ||
                            "Sin configurar"}
                        </strong>
                      </td>

                      <td>
                        <div className="color-list">
                          <span
                            style={{
                              background:
                                laboratorio.colorPrimario,
                            }}
                            title={
                              laboratorio.colorPrimario
                            }
                          />

                          <span
                            style={{
                              background:
                                laboratorio.colorSecundario,
                            }}
                            title={
                              laboratorio.colorSecundario
                            }
                          />
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            laboratorio.activo
                              ? "estado-chip activo"
                              : "estado-chip inactivo"
                          }
                        >
                          {laboratorio.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            laboratorio.personalizado
                              ? "config-chip completo"
                              : "config-chip pendiente"
                          }
                        >
                          {laboratorio.personalizado
                            ? "Configurado"
                            : "Pendiente"}
                        </span>
                      </td>

                      <td>
                        <div className="personalizacion-actions">
                          <button
                            type="button"
                            className="action-button view"
                            onClick={() =>
                              setLaboratorioVer(
                                laboratorio
                              )
                            }
                          >
                            Ver
                          </button>

                          <button
                            type="button"
                            className="action-button detail"
                            onClick={() =>
                              setLaboratorioDetalle(
                                laboratorio
                              )
                            }
                          >
                            Detalle
                          </button>

                          {puedeEditar && (
                            <button
                              type="button"
                              className="action-button edit"
                              onClick={() =>
                                abrirPersonalizacion(
                                  laboratorio
                                )
                              }
                            >
                              Personalizar
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


      {laboratorioVer && (
        <div className="personalizacion-modal-overlay">
          <section className="personalizacion-modal preview-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {laboratorioVer.nombreVisible ||
                    laboratorioVer.nombre}
                </h2>

                <p>
                  Vista previa
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setLaboratorioVer(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <VistaPrevia
              nombre={
                laboratorioVer.nombreVisible ||
                laboratorioVer.nombre
              }
              logoUrl={
                laboratorioVer.logoUrl
              }
              colorPrimario={
                laboratorioVer.colorPrimario
              }
              colorSecundario={
                laboratorioVer.colorSecundario
              }
            />

            <button
              type="button"
              className="button-primary full"
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


      {laboratorioDetalle && (
        <div className="personalizacion-modal-overlay">
          <section className="personalizacion-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Información del laboratorio
                </h2>

                <p>
                  Datos e identidad visual
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setLaboratorioDetalle(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <DetalleItem
                titulo="Laboratorio"
                valor={
                  laboratorioDetalle.nombre
                }
              />

              <DetalleItem
                titulo="Nombre visible"
                valor={
                  laboratorioDetalle.nombreVisible ||
                  "No configurado"
                }
              />

              <DetalleItem
                titulo="Correo"
                valor={
                  laboratorioDetalle.email
                }
              />

              <DetalleItem
                titulo="Teléfono"
                valor={
                  laboratorioDetalle.telefono
                }
              />

              <DetalleItem
                titulo="Dirección"
                valor={
                  laboratorioDetalle.direccion
                }
                completo
              />

              <DetalleItem
                titulo="Color principal"
                valor={
                  laboratorioDetalle.colorPrimario
                }
              />

              <DetalleItem
                titulo="Color secundario"
                valor={
                  laboratorioDetalle.colorSecundario
                }
              />

              <DetalleItem
                titulo="Estado"
                valor={
                  laboratorioDetalle.activo
                    ? "Activo"
                    : "Inactivo"
                }
              />

              <DetalleItem
                titulo="ID del laboratorio"
                valor={
                  laboratorioDetalle.laboratorioId
                }
                completo
              />

              <DetalleItem
                titulo="Fecha de registro"
                valor={
                  formatearFecha(
                    laboratorioDetalle.fechaRegistro
                  )
                }
                completo
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button-secondary"
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


      {laboratorioEditar && (
        <div className="personalizacion-modal-overlay">
          <section className="personalizacion-modal editor-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Personalizar laboratorio
                </h2>

                <p>
                  {laboratorioEditar.nombre}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarPersonalizacion
                }
                disabled={guardando}
              >
                ×
              </button>
            </div>


            <form
              className="personalizacion-form"
              onSubmit={
                guardarPersonalizacion
              }
            >
              <section className="form-section">
                <div className="form-section-title">
                  <span className="form-section-icon">
                    🏥
                  </span>

                  <div>
                    <h3>
                      Identidad
                    </h3>

                    <p>
                      Nombre y logotipo que identificarán al laboratorio.
                    </p>
                  </div>
                </div>


                <div className="personalizacion-field">
                  <label>
                    Nombre visible
                  </label>

                  <input
                    type="text"
                    name="nombreVisible"
                    value={
                      formulario.nombreVisible
                    }
                    onChange={
                      manejarCambio
                    }
                    maxLength="100"
                    placeholder="Nombre que se mostrará en el sistema"
                  />
                </div>


                <div className="personalizacion-field">
                  <label>
                    Logo del laboratorio
                  </label>

                  <input
                    type="url"
                    name="logoUrl"
                    value={
                      formulario.logoUrl
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="https://ejemplo.com/logo.png"
                  />

                  <small>
                    Ingresa la dirección pública de la imagen del logo.
                  </small>
                </div>


                {formulario.logoUrl && (
                  <div className="logo-editor">
                    {!logoConError ? (
                      <div className="logo-editor-preview">
                        <img
                          src={
                            formulario.logoUrl
                          }
                          alt="Vista previa del logo"
                          onError={() =>
                            setLogoConError(
                              true
                            )
                          }
                        />
                      </div>
                    ) : (
                      <div className="logo-error">
                        No se pudo cargar esta imagen.
                      </div>
                    )}

                    <button
                      type="button"
                      className="remove-logo-button"
                      onClick={
                        quitarLogo
                      }
                    >
                      Quitar logo
                    </button>
                  </div>
                )}
              </section>


              <section className="form-section">
                <div className="form-section-title">
                  <span className="form-section-icon purple">
                    🎨
                  </span>

                  <div>
                    <h3>
                      Colores
                    </h3>

                    <p>
                      Define los colores principales de la interfaz.
                    </p>
                  </div>
                </div>


                <div className="color-form-grid">
                  <div className="personalizacion-field">
                    <label>
                      Color principal
                    </label>

                    <div className="color-control">
                      <input
                        type="color"
                        name="colorPrimario"
                        value={
                          formulario.colorPrimario
                        }
                        onChange={
                          manejarCambio
                        }
                      />

                      <input
                        type="text"
                        name="colorPrimario"
                        value={
                          formulario.colorPrimario
                        }
                        onChange={
                          manejarCambio
                        }
                        maxLength="7"
                      />
                    </div>
                  </div>


                  <div className="personalizacion-field">
                    <label>
                      Color secundario
                    </label>

                    <div className="color-control">
                      <input
                        type="color"
                        name="colorSecundario"
                        value={
                          formulario.colorSecundario
                        }
                        onChange={
                          manejarCambio
                        }
                      />

                      <input
                        type="text"
                        name="colorSecundario"
                        value={
                          formulario.colorSecundario
                        }
                        onChange={
                          manejarCambio
                        }
                        maxLength="7"
                      />
                    </div>
                  </div>
                </div>


                <div className="palette-area">
                  <div className="palette-header">
                    <span>
                      Combinaciones
                    </span>

                    <button
                      type="button"
                      onClick={
                        restaurarColores
                      }
                    >
                      Restaurar
                    </button>
                  </div>

                  <div className="palette-grid">
                    {combinaciones.map(
                      (
                        combinacion
                      ) => (
                        <button
                          type="button"
                          key={
                            combinacion.nombre
                          }
                          className="palette-button"
                          onClick={() =>
                            seleccionarCombinacion(
                              combinacion
                            )
                          }
                        >
                          <div className="palette-colors">
                            <span
                              style={{
                                background:
                                  combinacion.primario,
                              }}
                            />

                            <span
                              style={{
                                background:
                                  combinacion.secundario,
                              }}
                            />
                          </div>

                          <strong>
                            {combinacion.nombre}
                          </strong>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </section>


              <section className="form-section preview-section">
                <div className="form-section-title">
                  <span className="form-section-icon green">
                    👁
                  </span>

                  <div>
                    <h3>
                      Vista previa
                    </h3>

                    <p>
                      Así se verá la identidad del laboratorio.
                    </p>
                  </div>
                </div>

                <VistaPrevia
                  nombre={
                    formulario.nombreVisible ||
                    laboratorioEditar.nombre
                  }
                  logoUrl={
                    formulario.logoUrl
                  }
                  colorPrimario={
                    formulario.colorPrimario
                  }
                  colorSecundario={
                    formulario.colorSecundario
                  }
                  logoConError={
                    logoConError
                  }
                />
              </section>


              <div className="form-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={
                    cerrarPersonalizacion
                  }
                  disabled={
                    guardando
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="button-primary"
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}


function VistaPrevia({
  nombre,
  logoUrl,
  colorPrimario,
  colorSecundario,
  logoConError = false,
}) {
  return (
    <div
      className="brand-preview"
      style={{
        background:
          `linear-gradient(
            125deg,
            ${colorPrimario},
            ${colorSecundario}
          )`,
      }}
    >
      <div className="brand-preview-top">
        <div className="brand-logo">
          {logoUrl &&
          !logoConError ? (
            <img
              src={logoUrl}
              alt="Logo"
            />
          ) : (
            <span>
              🧪
            </span>
          )}
        </div>

        <div>
          <h3>
            {nombre}
          </h3>

          <p>
            Laboratorio Clínico
          </p>
        </div>
      </div>

      <div className="brand-preview-body">
        <div>
          <span>
            Pacientes
          </span>

          <strong>
            128
          </strong>
        </div>

        <div>
          <span>
            Análisis
          </span>

          <strong>
            36
          </strong>
        </div>

        <div>
          <span>
            Resultados
          </span>

          <strong>
            94
          </strong>
        </div>
      </div>

      <button
        type="button"
        className="preview-example-button"
        style={{
          color:
            colorPrimario,
        }}
      >
        Abrir módulo
      </button>
    </div>
  );
}


function LogoLaboratorio({
  laboratorio,
}) {
  return (
    <div className="laboratorio-logo">
      {laboratorio?.logoUrl ? (
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
  );
}


function ResumenCard({
  icono,
  titulo,
  valor,
  clase,
}) {
  return (
    <article className="resumen-card">
      <div
        className={`resumen-icon ${clase}`}
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
      </div>
    </article>
  );
}


function DetalleItem({
  titulo,
  valor,
  completo = false,
}) {
  return (
    <div
      className={
        completo
          ? "detail-item full"
          : "detail-item"
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


export default SuperAdminPersonalizacion;