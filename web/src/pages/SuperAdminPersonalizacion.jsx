import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  actualizarPersonalizacion,
  obtenerLaboratoriosPersonalizacion,
  PERSONALIZACION_DEFAULT,
} from "../services/personalizacionService";

import "./SuperAdminPersonalizacion.css";


// =====================================================
// PALETAS PREDEFINIDAS
// =====================================================

const PALETAS = [
  {
    nombre: "Clínico",
    primario: "#2563EB",
    secundario: "#14B8A6",
  },
  {
    nombre: "Violeta",
    primario: "#7C3AED",
    secundario: "#0EA5E9",
  },
  {
    nombre: "Esmeralda",
    primario: "#059669",
    secundario: "#14B8A6",
  },
  {
    nombre: "Naranja",
    primario: "#EA580C",
    secundario: "#F59E0B",
  },
];


function SuperAdminPersonalizacion({
  permisos = [],
  volver,
}) {
  const inputArchivoRef =
    useRef(null);

  // =====================================================
  // DATOS
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
    mensaje,
    setMensaje,
  ] = useState(null);

  // =====================================================
  // BÚSQUEDA / FILTROS
  // =====================================================

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
    filtroConfiguracion,
    setFiltroConfiguracion,
  ] = useState("todos");

  // =====================================================
  // MODAL
  // =====================================================

  const [
    modal,
    setModal,
  ] = useState(null);

  const [
    laboratorioSeleccionado,
    setLaboratorioSeleccionado,
  ] = useState(null);

  // =====================================================
  // FORMULARIO
  // =====================================================

  const [
    nombreVisible,
    setNombreVisible,
  ] = useState("");

  const [
    logoUrl,
    setLogoUrl,
  ] = useState("");

  const [
    nombreArchivo,
    setNombreArchivo,
  ] = useState("");

  const [
    tamanoArchivo,
    setTamanoArchivo,
  ] = useState(0);

  const [
    colorPrimario,
    setColorPrimario,
  ] = useState(
    PERSONALIZACION_DEFAULT.colorPrimario
  );

  const [
    colorSecundario,
    setColorSecundario,
  ] = useState(
    PERSONALIZACION_DEFAULT.colorSecundario
  );

  const [
    procesandoImagen,
    setProcesandoImagen,
  ] = useState(false);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    logoError,
    setLogoError,
  ] = useState(false);


  // =====================================================
  // PERMISO
  // =====================================================

  const puedeEditar =
    permisos.includes(
      "laboratorios.editar"
    );


  // =====================================================
  // CARGAR LABORATORIOS
  // =====================================================

  const cargarLaboratorios =
    async (
      mostrarCarga = true
    ) => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

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

        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudieron cargar los laboratorios.",
        });

      } finally {
        if (mostrarCarga) {
          setCargando(false);
        }
      }
    };


  useEffect(() => {
    cargarLaboratorios();
  }, []);


  // =====================================================
  // OCULTAR MENSAJE AUTOMÁTICAMENTE
  // =====================================================

  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const temporizador =
      window.setTimeout(
        () => {
          setMensaje(null);
        },
        5000
      );

    return () => {
      window.clearTimeout(
        temporizador
      );
    };

  }, [mensaje]);


  // =====================================================
  // ESTADÍSTICAS
  // =====================================================

  const totalLaboratorios =
    laboratorios.length;


  const totalPersonalizados =
    laboratorios.filter(
      (laboratorio) =>
        estaPersonalizado(
          laboratorio
        )
    ).length;


  const totalPendientes =
    totalLaboratorios -
    totalPersonalizados;


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
          const coincideTexto =
            !texto ||
            [
              laboratorio.nombre,
              laboratorio.nombreVisible,
              laboratorio.email,
              laboratorio.direccion,
              laboratorio.telefono,
            ].some(
              (valor) =>
                String(
                  valor || ""
                )
                  .toLowerCase()
                  .includes(
                    texto
                  )
            );


          const coincideEstado =
            filtroEstado ===
              "todos" ||
            (
              filtroEstado ===
                "activo" &&
              laboratorio.activo ===
                true
            ) ||
            (
              filtroEstado ===
                "inactivo" &&
              laboratorio.activo !==
                true
            );


          const personalizado =
            estaPersonalizado(
              laboratorio
            );


          const coincideConfiguracion =
            filtroConfiguracion ===
              "todos" ||
            (
              filtroConfiguracion ===
                "personalizado" &&
              personalizado
            ) ||
            (
              filtroConfiguracion ===
                "pendiente" &&
              !personalizado
            );


          return (
            coincideTexto &&
            coincideEstado &&
            coincideConfiguracion
          );
        }
      );

    }, [
      laboratorios,
      busqueda,
      filtroEstado,
      filtroConfiguracion,
    ]);


  // =====================================================
  // LIMPIAR FILTROS
  // =====================================================

  const limpiarFiltros =
    () => {
      setFiltroEstado(
        "todos"
      );

      setFiltroConfiguracion(
        "todos"
      );

      setBusqueda("");
    };


  // =====================================================
  // MODAL - PREVISUALIZAR
  // =====================================================

  const abrirVistaPrevia =
    (
      laboratorio
    ) => {
      setLaboratorioSeleccionado(
        laboratorio
      );

      setLogoError(false);

      setModal(
        "preview"
      );
    };


  // =====================================================
  // MODAL - DETALLE
  // =====================================================

  const abrirDetalle =
    (
      laboratorio
    ) => {
      setLaboratorioSeleccionado(
        laboratorio
      );

      setLogoError(false);

      setModal(
        "detalle"
      );
    };


  // =====================================================
  // MODAL - EDITAR
  // =====================================================

  const abrirEditor =
    (
      laboratorio
    ) => {
      if (!puedeEditar) {
        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para editar la personalización.",
        });

        return;
      }

      setLaboratorioSeleccionado(
        laboratorio
      );

      setNombreVisible(
        laboratorio.nombreVisible ||
        laboratorio.nombre ||
        ""
      );

      setLogoUrl(
        laboratorio.logoUrl ||
        ""
      );

      setNombreArchivo("");

      setTamanoArchivo(0);

      setColorPrimario(
        validarColor(
          laboratorio.colorPrimario
        )
          ? laboratorio.colorPrimario.toUpperCase()
          : PERSONALIZACION_DEFAULT.colorPrimario
      );

      setColorSecundario(
        validarColor(
          laboratorio.colorSecundario
        )
          ? laboratorio.colorSecundario.toUpperCase()
          : PERSONALIZACION_DEFAULT.colorSecundario
      );

      setLogoError(false);

      setModal(
        "editar"
      );
    };


  // =====================================================
  // CERRAR MODAL
  // =====================================================

  const cerrarModal =
    () => {
      if (
        guardando ||
        procesandoImagen
      ) {
        return;
      }

      setModal(null);

      setLaboratorioSeleccionado(
        null
      );

      setNombreArchivo("");

      setTamanoArchivo(0);

      setLogoError(false);
    };


  // =====================================================
  // ABRIR EXPLORADOR DE ARCHIVOS
  // =====================================================

  const abrirSelectorLogo =
    () => {
      if (
        procesandoImagen ||
        guardando
      ) {
        return;
      }

      inputArchivoRef.current?.click();
    };


  // =====================================================
  // SELECCIONAR LOGO
  // =====================================================

  const seleccionarLogo =
    async (
      evento
    ) => {
      const archivo =
        evento.target.files?.[0];

      // Permite seleccionar otra vez
      // el mismo archivo.
      evento.target.value = "";

      if (!archivo) {
        return;
      }

      const tiposPermitidos = [
        "image/png",
        "image/jpeg",
        "image/webp",
      ];


      if (
        !tiposPermitidos.includes(
          archivo.type
        )
      ) {
        setMensaje({
          tipo: "error",
          texto:
            "El logo debe ser PNG, JPG, JPEG o WEBP.",
        });

        return;
      }


      if (
        archivo.size >
        5 * 1024 * 1024
      ) {
        setMensaje({
          tipo: "error",
          texto:
            "La imagen original no puede superar los 5 MB.",
        });

        return;
      }


      try {
        setProcesandoImagen(
          true
        );

        setLogoError(false);


        const dataUrl =
          await convertirLogoADataUrl(
            archivo
          );


        // Firestore tiene límite por documento.
        // Dejamos un margen amplio para los
        // demás campos del laboratorio.
        if (
          dataUrl.length >
          600000
        ) {
          throw new Error(
            "El logo continúa siendo demasiado pesado. Selecciona una imagen más pequeña."
          );
        }


        setLogoUrl(
          dataUrl
        );

        setNombreArchivo(
          archivo.name
        );

        setTamanoArchivo(
          archivo.size
        );


        setMensaje({
          tipo: "exito",
          texto:
            "Logo seleccionado correctamente. Presiona Guardar cambios para almacenarlo en Firestore.",
        });

      } catch (error) {
        console.error(
          "Error procesando logo:",
          error
        );

        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo procesar la imagen.",
        });

      } finally {
        setProcesandoImagen(
          false
        );
      }
    };


  // =====================================================
  // QUITAR LOGO
  // =====================================================

  const quitarLogo =
    () => {
      if (
        procesandoImagen ||
        guardando
      ) {
        return;
      }

      setLogoUrl("");

      setNombreArchivo("");

      setTamanoArchivo(0);

      setLogoError(false);

      setMensaje({
        tipo: "exito",
        texto:
          "El logo se quitará cuando guardes los cambios.",
      });
    };


  // =====================================================
  // PALETA
  // =====================================================

  const seleccionarPaleta =
    (
      paleta
    ) => {
      setColorPrimario(
        paleta.primario
      );

      setColorSecundario(
        paleta.secundario
      );
    };


  const restaurarColores =
    () => {
      setColorPrimario(
        PERSONALIZACION_DEFAULT.colorPrimario
      );

      setColorSecundario(
        PERSONALIZACION_DEFAULT.colorSecundario
      );
    };


  // =====================================================
  // GUARDAR PERSONALIZACIÓN
  // =====================================================

  const guardarPersonalizacion =
    async (
      evento
    ) => {
      evento.preventDefault();

      if (
        !laboratorioSeleccionado
      ) {
        return;
      }


      const nombre =
        nombreVisible.trim();


      if (
        nombre.length < 2
      ) {
        setMensaje({
          tipo: "error",
          texto:
            "Ingresa un nombre visible válido.",
        });

        return;
      }


      const primario =
        normalizarColor(
          colorPrimario
        );

      const secundario =
        normalizarColor(
          colorSecundario
        );


      if (
        !validarColor(
          primario
        )
      ) {
        setMensaje({
          tipo: "error",
          texto:
            "El color principal debe tener formato #RRGGBB.",
        });

        return;
      }


      if (
        !validarColor(
          secundario
        )
      ) {
        setMensaje({
          tipo: "error",
          texto:
            "El color secundario debe tener formato #RRGGBB.",
        });

        return;
      }


      if (
        logoUrl &&
        !logoUrl.startsWith(
          "data:image/"
        ) &&
        !/^https?:\/\//i.test(
          logoUrl
        )
      ) {
        setMensaje({
          tipo: "error",
          texto:
            "El formato del logo no es válido.",
        });

        return;
      }


      try {
        setGuardando(
          true
        );


        await actualizarPersonalizacion(
          laboratorioSeleccionado.id,
          {
            nombreVisible:
              nombre,

            logoUrl,

            colorPrimario:
              primario,

            colorSecundario:
              secundario,
          }
        );


        setLaboratorios(
          (actuales) =>
            actuales.map(
              (
                laboratorio
              ) =>
                laboratorio.id ===
                laboratorioSeleccionado.id
                  ? {
                      ...laboratorio,

                      nombreVisible:
                        nombre,

                      logoUrl,

                      colorPrimario:
                        primario,

                      colorSecundario:
                        secundario,
                    }
                  : laboratorio
            )
        );


        setMensaje({
          tipo: "exito",
          texto:
            "Personalización guardada correctamente en Firestore.",
        });


        setModal(
          null
        );

        setLaboratorioSeleccionado(
          null
        );

        setNombreArchivo("");

        setTamanoArchivo(0);


        // Actualización adicional desde Firestore.
        await cargarLaboratorios(
          false
        );

      } catch (error) {
        console.error(
          "Error al guardar personalización:",
          error
        );

        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo guardar la personalización.",
        });

      } finally {
        setGuardando(
          false
        );
      }
    };


  // =====================================================
  // CARGANDO
  // =====================================================

  if (cargando) {
    return (
      <main className="personalizacion-page">
        <div className="personalizacion-empty">
          <div className="personalizacion-spinner" />

          <h3>
            Cargando personalización
          </h3>

          <p>
            Obteniendo los laboratorios registrados...
          </p>
        </div>
      </main>
    );
  }


  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <main className="personalizacion-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="personalizacion-header">
        <div>
          <button
            type="button"
            className="personalizacion-back"
            onClick={() => {
              if (
                typeof volver ===
                "function"
              ) {
                volver();
              }
            }}
          >
            ← Volver
          </button>

          <h1>
            Personalización de laboratorios
          </h1>

          <p>
            Configura la identidad visual que heredarán los usuarios de cada laboratorio.
          </p>
        </div>

        <div className="personalizacion-header-icon">
          🎨
        </div>
      </header>


      {/* =================================================
          MENSAJE
      ================================================= */}

      {mensaje && (
        <div
          className={`personalizacion-message ${mensaje.tipo}`}
        >
          <span>
            {mensaje.tipo ===
            "error"
              ? "!"
              : "✓"}
          </span>

          {mensaje.texto}
        </div>
      )}


      {/* =================================================
          ESTADÍSTICAS
      ================================================= */}

      <section className="personalizacion-stats">

        <div className="resumen-card">
          <div className="resumen-icon azul">
            🏥
          </div>

          <div>
            <span>
              LABORATORIOS
            </span>

            <strong>
              {totalLaboratorios}
            </strong>
          </div>
        </div>


        <div className="resumen-card">
          <div className="resumen-icon morado">
            🎨
          </div>

          <div>
            <span>
              PERSONALIZADOS
            </span>

            <strong>
              {totalPersonalizados}
            </strong>
          </div>
        </div>


        <div className="resumen-card">
          <div className="resumen-icon amarillo">
            ⏳
          </div>

          <div>
            <span>
              PENDIENTES
            </span>

            <strong>
              {totalPendientes}
            </strong>
          </div>
        </div>

      </section>


      {/* =================================================
          BÚSQUEDA
      ================================================= */}

      <section className="personalizacion-toolbar">

        <div className="personalizacion-search">
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
            placeholder="Buscar por laboratorio, correo o dirección..."
          />
        </div>


        <button
          type="button"
          className={`personalizacion-filter ${
            mostrarFiltros ||
            filtroEstado !==
              "todos" ||
            filtroConfiguracion !==
              "todos"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setMostrarFiltros(
              !mostrarFiltros
            )
          }
        >
          ⚙ Filtros

          {(
            filtroEstado !==
              "todos" ||
            filtroConfiguracion !==
              "todos"
          ) && (
            <span className="filter-indicator" />
          )}
        </button>

      </section>


      {/* =================================================
          FILTROS AVANZADOS
      ================================================= */}

      {mostrarFiltros && (
        <section className="personalizacion-filters">

          <div className="filter-title">
            <h3>
              Filtros
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


          <div className="filter-grid">

            <div className="personalizacion-field">
              <label>
                Estado del laboratorio
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

              <small>
                Filtra por estado operativo.
              </small>
            </div>


            <div className="personalizacion-field">
              <label>
                Personalización
              </label>

              <select
                value={
                  filtroConfiguracion
                }
                onChange={(
                  evento
                ) =>
                  setFiltroConfiguracion(
                    evento.target.value
                  )
                }
              >
                <option value="todos">
                  Todos
                </option>

                <option value="personalizado">
                  Personalizados
                </option>

                <option value="pendiente">
                  Pendientes
                </option>
              </select>

              <small>
                Filtra según la identidad visual configurada.
              </small>
            </div>

          </div>
        </section>
      )}


      {/* =================================================
          TABLA
      ================================================= */}

      <section className="personalizacion-table-card">

        <div className="table-card-header">
          <div>
            <h2>
              Laboratorios registrados
            </h2>

            <p>
              Consulta y configura la identidad visual de cada laboratorio.
            </p>
          </div>

          <span className="result-count">
            {
              laboratoriosFiltrados.length
            } resultado
            {
              laboratoriosFiltrados.length !==
              1
                ? "s"
                : ""
            }
          </span>
        </div>


        {laboratoriosFiltrados.length ===
        0 ? (
          <div className="personalizacion-empty">
            <div className="empty-icon">
              🔎
            </div>

            <h3>
              No se encontraron laboratorios
            </h3>

            <p>
              Cambia la búsqueda o limpia los filtros.
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
                  (
                    laboratorio
                  ) => {
                    const personalizado =
                      estaPersonalizado(
                        laboratorio
                      );

                    return (
                      <tr
                        key={
                          laboratorio.id
                        }
                      >

                        {/* LABORATORIO */}

                        <td>
                          <div className="laboratorio-cell">

                            <div className="laboratorio-logo">

                              {laboratorio.logoUrl ? (
                                <img
                                  src={
                                    laboratorio.logoUrl
                                  }
                                  alt={`Logo de ${laboratorio.nombre}`}
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
                              <strong>
                                {
                                  laboratorio.nombre ||
                                  "Sin nombre"
                                }
                              </strong>

                              <span>
                                {
                                  laboratorio.email ||
                                  "Sin correo"
                                }
                              </span>
                            </div>

                          </div>
                        </td>


                        {/* NOMBRE VISIBLE */}

                        <td>
                          <span className="nombre-visible">
                            {
                              laboratorio.nombreVisible ||
                              "Sin personalizar"
                            }
                          </span>
                        </td>


                        {/* COLORES */}

                        <td>
                          <div className="color-list">

                            <span
                              title={
                                laboratorio.colorPrimario
                              }
                              style={{
                                background:
                                  validarColor(
                                    laboratorio.colorPrimario
                                  )
                                    ? laboratorio.colorPrimario
                                    : PERSONALIZACION_DEFAULT.colorPrimario,
                              }}
                            />

                            <span
                              title={
                                laboratorio.colorSecundario
                              }
                              style={{
                                background:
                                  validarColor(
                                    laboratorio.colorSecundario
                                  )
                                    ? laboratorio.colorSecundario
                                    : PERSONALIZACION_DEFAULT.colorSecundario,
                              }}
                            />

                          </div>
                        </td>


                        {/* ESTADO */}

                        <td>
                          <span
                            className={`estado-chip ${
                              laboratorio.activo
                                ? "activo"
                                : "inactivo"
                            }`}
                          >
                            {laboratorio.activo
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </td>


                        {/* CONFIGURACIÓN */}

                        <td>
                          <span
                            className={`config-chip ${
                              personalizado
                                ? "completo"
                                : "pendiente"
                            }`}
                          >
                            {personalizado
                              ? "Personalizado"
                              : "Pendiente"}
                          </span>
                        </td>


                        {/* ACCIONES */}

                        <td>
                          <div className="personalizacion-actions">

                            <button
                              type="button"
                              className="action-button view"
                              onClick={() =>
                                abrirVistaPrevia(
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
                                abrirDetalle(
                                  laboratorio
                                )
                              }
                            >
                              Ver detalle
                            </button>


                            {puedeEditar && (
                              <button
                                type="button"
                                className="action-button edit"
                                onClick={() =>
                                  abrirEditor(
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
                    );
                  }
                )}
              </tbody>
            </table>

          </div>
        )}

      </section>


      {/* =================================================
          MODAL - VISTA PREVIA
      ================================================= */}

      {modal ===
        "preview" &&
        laboratorioSeleccionado && (
          <div
            className="personalizacion-modal-overlay"
            onMouseDown={(
              evento
            ) => {
              if (
                evento.target ===
                evento.currentTarget
              ) {
                cerrarModal();
              }
            }}
          >
            <div className="personalizacion-modal preview-modal">

              <div className="modal-header">
                <div>
                  <h2>
                    Vista previa
                  </h2>

                  <p>
                    Así se mostrará la identidad visual del laboratorio.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={
                    cerrarModal
                  }
                >
                  ×
                </button>
              </div>


              <VistaMarca
                laboratorio={
                  laboratorioSeleccionado
                }
                logoError={
                  logoError
                }
                setLogoError={
                  setLogoError
                }
              />


              <div className="modal-footer">

                <button
                  type="button"
                  className="button-secondary"
                  onClick={
                    cerrarModal
                  }
                >
                  Cerrar
                </button>


                {puedeEditar && (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() =>
                      abrirEditor(
                        laboratorioSeleccionado
                      )
                    }
                  >
                    Personalizar
                  </button>
                )}

              </div>
            </div>
          </div>
        )}


      {/* =================================================
          MODAL - DETALLE
      ================================================= */}

      {modal ===
        "detalle" &&
        laboratorioSeleccionado && (
          <div
            className="personalizacion-modal-overlay"
            onMouseDown={(
              evento
            ) => {
              if (
                evento.target ===
                evento.currentTarget
              ) {
                cerrarModal();
              }
            }}
          >
            <div className="personalizacion-modal">

              <div className="modal-header">
                <div>
                  <h2>
                    Detalle de personalización
                  </h2>

                  <p>
                    Información actual del laboratorio.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={
                    cerrarModal
                  }
                >
                  ×
                </button>
              </div>


              <div className="detail-grid">

                <Detalle
                  titulo="Laboratorio"
                  valor={
                    laboratorioSeleccionado.nombre ||
                    "Sin información"
                  }
                />


                <Detalle
                  titulo="Nombre visible"
                  valor={
                    laboratorioSeleccionado.nombreVisible ||
                    "Sin personalizar"
                  }
                />


                <Detalle
                  titulo="Correo"
                  valor={
                    laboratorioSeleccionado.email ||
                    "Sin información"
                  }
                />


                <Detalle
                  titulo="Teléfono"
                  valor={
                    laboratorioSeleccionado.telefono ||
                    "Sin información"
                  }
                />


                <Detalle
                  titulo="Color principal"
                  valor={
                    laboratorioSeleccionado.colorPrimario ||
                    PERSONALIZACION_DEFAULT.colorPrimario
                  }
                />


                <Detalle
                  titulo="Color secundario"
                  valor={
                    laboratorioSeleccionado.colorSecundario ||
                    PERSONALIZACION_DEFAULT.colorSecundario
                  }
                />


                <Detalle
                  titulo="Estado"
                  valor={
                    laboratorioSeleccionado.activo
                      ? "Activo"
                      : "Inactivo"
                  }
                />


                <Detalle
                  titulo="Logo"
                  valor={
                    descripcionLogo(
                      laboratorioSeleccionado.logoUrl
                    )
                  }
                />


                <Detalle
                  titulo="Dirección"
                  valor={
                    laboratorioSeleccionado.direccion ||
                    "Sin información"
                  }
                  full
                />

              </div>


              <div className="modal-footer">

                <button
                  type="button"
                  className="button-secondary"
                  onClick={
                    cerrarModal
                  }
                >
                  Cerrar
                </button>


                {puedeEditar && (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() =>
                      abrirEditor(
                        laboratorioSeleccionado
                      )
                    }
                  >
                    Personalizar
                  </button>
                )}

              </div>
            </div>
          </div>
        )}


      {/* =================================================
          MODAL - EDITAR
      ================================================= */}

      {modal ===
        "editar" &&
        laboratorioSeleccionado && (
          <div
            className="personalizacion-modal-overlay"
            onMouseDown={(
              evento
            ) => {
              if (
                evento.target ===
                evento.currentTarget &&
                !guardando &&
                !procesandoImagen
              ) {
                cerrarModal();
              }
            }}
          >
            <div className="personalizacion-modal editor-modal">

              {/* HEADER */}

              <div className="modal-header">
                <div>
                  <h2>
                    Personalizar laboratorio
                  </h2>

                  <p>
                    {
                      laboratorioSeleccionado.nombre
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={
                    cerrarModal
                  }
                  disabled={
                    guardando ||
                    procesandoImagen
                  }
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

                {/* =========================================
                    IDENTIDAD
                ========================================= */}

                <section className="form-section">

                  <div className="form-section-title">

                    <div className="form-section-icon">
                      🏷️
                    </div>

                    <div>
                      <h3>
                        Identidad
                      </h3>

                      <p>
                        Define el nombre que verán los usuarios.
                      </p>
                    </div>

                  </div>


                  <div className="personalizacion-field">
                    <label>
                      Nombre del laboratorio
                    </label>

                    <input
                      type="text"
                      value={
                        laboratorioSeleccionado.nombre ||
                        ""
                      }
                      disabled
                    />

                    <small>
                      El nombre legal se administra desde Gestión de Laboratorios.
                    </small>
                  </div>


                  <div className="personalizacion-field">
                    <label>
                      Nombre visible
                    </label>

                    <input
                      type="text"
                      value={
                        nombreVisible
                      }
                      onChange={(
                        evento
                      ) =>
                        setNombreVisible(
                          evento.target.value
                        )
                      }
                      maxLength={
                        80
                      }
                      placeholder="Ej. Laboratorio Central"
                      disabled={
                        guardando
                      }
                    />

                    <small>
                      Este nombre se mostrará en el Dashboard del Administrador, Recepcionista y Bioquímico.
                    </small>
                  </div>

                </section>


                {/* =========================================
                    LOGO DESDE ARCHIVO
                ========================================= */}

                <section className="form-section">

                  <div className="form-section-title">

                    <div className="form-section-icon purple">
                      🖼️
                    </div>

                    <div>
                      <h3>
                        Logo del laboratorio
                      </h3>

                      <p>
                        Selecciona una imagen desde tu computadora.
                      </p>
                    </div>

                  </div>


                  <div className="logo-editor">

                    {/* PREVIEW */}

                    <div
                      className={`logo-editor-preview ${
                        logoUrl &&
                        !logoError
                          ? "has-logo"
                          : "no-logo"
                      }`}
                    >

                      {logoUrl &&
                      !logoError ? (
                        <img
                          src={
                            logoUrl
                          }
                          alt="Logo del laboratorio"
                          onError={() =>
                            setLogoError(
                              true
                            )
                          }
                        />
                      ) : (
                        <span>
                          🧪
                        </span>
                      )}

                    </div>


                    {/* CONTROLES */}

                    <div className="logo-editor-controls">

                      <input
                        ref={
                          inputArchivoRef
                        }
                        type="file"
                        className="logo-file-input"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        onChange={
                          seleccionarLogo
                        }
                      />


                      <div className="logo-upload-area">

                        <strong className="logo-upload-title">
                          Archivo del logo
                        </strong>

                        <p className="logo-upload-description">
                          Selecciona PNG, JPG, JPEG o WEBP. La imagen se optimiza antes de guardarse.
                        </p>


                        <div className="logo-buttons">

                          <button
                            type="button"
                            className="upload-logo-button"
                            onClick={
                              abrirSelectorLogo
                            }
                            disabled={
                              procesandoImagen ||
                              guardando
                            }
                          >
                            {procesandoImagen
                              ? "Procesando..."
                              : "📁 Subir logo"}
                          </button>


                          {logoUrl && (
                            <button
                              type="button"
                              className="remove-logo-button"
                              onClick={
                                quitarLogo
                              }
                              disabled={
                                procesandoImagen ||
                                guardando
                              }
                            >
                              Quitar logo
                            </button>
                          )}

                        </div>


                        {procesandoImagen && (
                          <div className="logo-processing">
                            <span className="logo-processing-spinner" />

                            Optimizando imagen...
                          </div>
                        )}


                        {nombreArchivo && (
                          <div className="logo-file-info">

                            <div className="logo-file-icon">
                              🖼️
                            </div>

                            <div className="logo-file-data">

                              <strong>
                                {
                                  nombreArchivo
                                }
                              </strong>

                              <span>
                                {
                                  formatearBytes(
                                    tamanoArchivo
                                  )
                                }
                              </span>

                            </div>

                          </div>
                        )}


                        {!nombreArchivo &&
                          logoUrl && (
                            <span className="logo-file-name">
                              Logo guardado actualmente
                            </span>
                          )}


                        <p className="logo-file-help">
                          El archivo no se sube a Firebase Storage. Se convierte a Data URL y se guarda en el campo logoUrl del documento del laboratorio en Firestore.
                        </p>

                      </div>

                    </div>
                  </div>


                  {logoError && (
                    <div className="logo-error">
                      No se pudo mostrar el logo actual. Puedes seleccionar un nuevo archivo.
                    </div>
                  )}

                </section>


                {/* =========================================
                    COLORES
                ========================================= */}

                <section className="form-section">

                  <div className="form-section-title">

                    <div className="form-section-icon green">
                      🎨
                    </div>

                    <div>
                      <h3>
                        Colores institucionales
                      </h3>

                      <p>
                        Define los colores principales del Dashboard.
                      </p>
                    </div>

                  </div>


                  <div className="color-form-grid">

                    {/* PRIMARIO */}

                    <div className="personalizacion-field">
                      <label>
                        Color principal
                      </label>

                      <div className="color-control">

                        <input
                          type="color"
                          value={
                            validarColor(
                              colorPrimario
                            )
                              ? colorPrimario
                              : PERSONALIZACION_DEFAULT.colorPrimario
                          }
                          onChange={(
                            evento
                          ) =>
                            setColorPrimario(
                              evento.target.value.toUpperCase()
                            )
                          }
                          disabled={
                            guardando
                          }
                        />

                        <input
                          type="text"
                          value={
                            colorPrimario
                          }
                          onChange={(
                            evento
                          ) =>
                            setColorPrimario(
                              evento.target.value.toUpperCase()
                            )
                          }
                          maxLength={
                            7
                          }
                          placeholder="#2563EB"
                          disabled={
                            guardando
                          }
                        />

                      </div>
                    </div>


                    {/* SECUNDARIO */}

                    <div className="personalizacion-field">
                      <label>
                        Color secundario
                      </label>

                      <div className="color-control">

                        <input
                          type="color"
                          value={
                            validarColor(
                              colorSecundario
                            )
                              ? colorSecundario
                              : PERSONALIZACION_DEFAULT.colorSecundario
                          }
                          onChange={(
                            evento
                          ) =>
                            setColorSecundario(
                              evento.target.value.toUpperCase()
                            )
                          }
                          disabled={
                            guardando
                          }
                        />

                        <input
                          type="text"
                          value={
                            colorSecundario
                          }
                          onChange={(
                            evento
                          ) =>
                            setColorSecundario(
                              evento.target.value.toUpperCase()
                            )
                          }
                          maxLength={
                            7
                          }
                          placeholder="#14B8A6"
                          disabled={
                            guardando
                          }
                        />

                      </div>
                    </div>

                  </div>


                  {/* PALETAS */}

                  <div className="palette-area">

                    <div className="palette-header">

                      <span>
                        Paletas rápidas
                      </span>

                      <button
                        type="button"
                        onClick={
                          restaurarColores
                        }
                        disabled={
                          guardando
                        }
                      >
                        Restaurar predeterminado
                      </button>

                    </div>


                    <div className="palette-grid">

                      {PALETAS.map(
                        (
                          paleta
                        ) => (
                          <button
                            type="button"
                            key={
                              paleta.nombre
                            }
                            className="palette-button"
                            onClick={() =>
                              seleccionarPaleta(
                                paleta
                              )
                            }
                            disabled={
                              guardando
                            }
                          >

                            <div className="palette-colors">

                              <span
                                style={{
                                  background:
                                    paleta.primario,
                                }}
                              />

                              <span
                                style={{
                                  background:
                                    paleta.secundario,
                                }}
                              />

                            </div>

                            <strong>
                              {
                                paleta.nombre
                              }
                            </strong>

                          </button>
                        )
                      )}

                    </div>
                  </div>

                </section>


                {/* =========================================
                    VISTA PREVIA
                ========================================= */}

                <section className="form-section">

                  <div className="form-section-title">

                    <div className="form-section-icon purple">
                      👁️
                    </div>

                    <div>
                      <h3>
                        Vista previa
                      </h3>

                      <p>
                        Visualiza cómo se verá la identidad del laboratorio.
                      </p>
                    </div>

                  </div>


                  <div
                    className="brand-preview"
                    style={{
                      background:
                        `linear-gradient(
                          125deg,
                          ${
                            validarColor(
                              colorPrimario
                            )
                              ? colorPrimario
                              : PERSONALIZACION_DEFAULT.colorPrimario
                          } 0%,
                          ${
                            validarColor(
                              colorSecundario
                            )
                              ? colorSecundario
                              : PERSONALIZACION_DEFAULT.colorSecundario
                          } 100%
                        )`,
                    }}
                  >

                    <div className="brand-preview-top">

                      <div className="brand-logo">

                        {logoUrl &&
                        !logoError ? (
                          <img
                            src={
                              logoUrl
                            }
                            alt="Vista previa del logo"
                            onError={() =>
                              setLogoError(
                                true
                              )
                            }
                          />
                        ) : (
                          <span>
                            🧪
                          </span>
                        )}

                      </div>


                      <div>
                        <h3>
                          {
                            nombreVisible.trim() ||
                            laboratorioSeleccionado.nombre ||
                            "Laboratorio Clínico"
                          }
                        </h3>

                        <p>
                          Sistema de Laboratorio Clínico
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
                          Solicitudes
                        </span>

                        <strong>
                          34
                        </strong>
                      </div>


                      <div>
                        <span>
                          Resultados
                        </span>

                        <strong>
                          21
                        </strong>
                      </div>

                    </div>


                    <button
                      type="button"
                      className="preview-example-button"
                      style={{
                        color:
                          validarColor(
                            colorPrimario
                          )
                            ? colorPrimario
                            : PERSONALIZACION_DEFAULT.colorPrimario,
                      }}
                    >
                      Abrir módulo
                    </button>

                  </div>

                </section>


                {/* =========================================
                    ACCIONES
                ========================================= */}

                <div className="form-actions">

                  <button
                    type="button"
                    className="button-secondary"
                    onClick={
                      cerrarModal
                    }
                    disabled={
                      guardando ||
                      procesandoImagen
                    }
                  >
                    Cancelar
                  </button>


                  <button
                    type="submit"
                    className="button-primary"
                    disabled={
                      guardando ||
                      procesandoImagen
                    }
                  >
                    {guardando
                      ? "Guardando..."
                      : "Guardar cambios"}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

    </main>
  );
}


// =====================================================
// COMPONENTE VISTA DE MARCA
// =====================================================

function VistaMarca({
  laboratorio,
  logoError,
  setLogoError,
}) {
  const primario =
    validarColor(
      laboratorio.colorPrimario
    )
      ? laboratorio.colorPrimario
      : PERSONALIZACION_DEFAULT.colorPrimario;


  const secundario =
    validarColor(
      laboratorio.colorSecundario
    )
      ? laboratorio.colorSecundario
      : PERSONALIZACION_DEFAULT.colorSecundario;


  return (
    <div
      className="brand-preview"
      style={{
        background:
          `linear-gradient(
            125deg,
            ${primario} 0%,
            ${secundario} 100%
          )`,
      }}
    >

      <div className="brand-preview-top">

        <div className="brand-logo">

          {laboratorio.logoUrl &&
          !logoError ? (
            <img
              src={
                laboratorio.logoUrl
              }
              alt="Logo del laboratorio"
              onError={() =>
                setLogoError(
                  true
                )
              }
            />
          ) : (
            <span>
              🧪
            </span>
          )}

        </div>


        <div>
          <h3>
            {
              laboratorio.nombreVisible ||
              laboratorio.nombre ||
              "Laboratorio Clínico"
            }
          </h3>

          <p>
            Sistema de Laboratorio Clínico
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
            Solicitudes
          </span>

          <strong>
            34
          </strong>
        </div>


        <div>
          <span>
            Resultados
          </span>

          <strong>
            21
          </strong>
        </div>

      </div>


      <button
        type="button"
        className="preview-example-button"
        style={{
          color:
            primario,
        }}
      >
        Abrir módulo
      </button>

    </div>
  );
}


// =====================================================
// COMPONENTE DETALLE
// =====================================================

function Detalle({
  titulo,
  valor,
  full = false,
}) {
  return (
    <div
      className={`detail-item ${
        full ? "full" : ""
      }`}
    >
      <span>
        {titulo}
      </span>

      <strong>
        {valor}
      </strong>
    </div>
  );
}


// =====================================================
// DETERMINAR SI TIENE PERSONALIZACIÓN
// =====================================================

function estaPersonalizado(
  laboratorio
) {
  return Boolean(
    String(
      laboratorio?.nombreVisible ||
      ""
    ).trim() ||
    String(
      laboratorio?.logoUrl ||
      ""
    ).trim()
  );
}


// =====================================================
// DESCRIPCIÓN DEL LOGO
// =====================================================

function descripcionLogo(
  logoUrl
) {
  if (!logoUrl) {
    return "Sin logo";
  }

  if (
    logoUrl.startsWith(
      "data:image/"
    )
  ) {
    return "Archivo guardado directamente en Firestore";
  }

  if (
    /^https?:\/\//i.test(
      logoUrl
    )
  ) {
    return "URL externa";
  }

  return "Logo configurado";
}


// =====================================================
// VALIDAR COLOR
// =====================================================

function validarColor(
  color
) {
  return (
    typeof color ===
      "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(
      color
    )
  );
}


// =====================================================
// NORMALIZAR COLOR
// =====================================================

function normalizarColor(
  color
) {
  return String(
    color || ""
  )
    .trim()
    .toUpperCase();
}


// =====================================================
// FORMATEAR TAMAÑO
// =====================================================

function formatearBytes(
  bytes
) {
  if (!bytes) {
    return "";
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(2)} MB`;
}


// =====================================================
// LEER ARCHIVO COMO DATA URL
// =====================================================

function leerArchivo(
  archivo
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const lector =
        new FileReader();

      lector.onerror =
        () => {
          reject(
            new Error(
              "No se pudo leer el archivo seleccionado."
            )
          );
        };

      lector.onload =
        () => {
          resolve(
            lector.result
          );
        };

      lector.readAsDataURL(
        archivo
      );
    }
  );
}


// =====================================================
// CARGAR IMAGEN
// =====================================================

function cargarImagen(
  origen
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const imagen =
        new Image();

      imagen.onload =
        () => {
          resolve(
            imagen
          );
        };

      imagen.onerror =
        () => {
          reject(
            new Error(
              "El archivo seleccionado no contiene una imagen válida."
            )
          );
        };

      imagen.src =
        origen;
    }
  );
}


// =====================================================
// CONVERTIR LOGO A DATA URL OPTIMIZADA
//
// NO FIREBASE STORAGE.
//
// Archivo
// ↓
// Canvas
// ↓
// WEBP
// ↓
// data:image/webp;base64,...
// ↓
// Firestore -> logoUrl
// =====================================================

async function convertirLogoADataUrl(
  archivo
) {
  const lectura =
    await leerArchivo(
      archivo
    );


  if (
    typeof lectura !==
    "string"
  ) {
    throw new Error(
      "No se pudo leer la imagen."
    );
  }


  const imagen =
    await cargarImagen(
      lectura
    );


  let maximo =
    360;

  let calidad =
    0.80;

  let resultado =
    "";


  // Intentamos varias reducciones
  // hasta mantener un tamaño seguro.
  for (
    let intento = 0;
    intento < 6;
    intento++
  ) {
    let ancho =
      imagen.naturalWidth ||
      imagen.width;

    let alto =
      imagen.naturalHeight ||
      imagen.height;


    if (
      ancho <= 0 ||
      alto <= 0
    ) {
      throw new Error(
        "La imagen no tiene dimensiones válidas."
      );
    }


    const escala =
      Math.min(
        1,
        maximo / ancho,
        maximo / alto
      );


    ancho =
      Math.max(
        1,
        Math.round(
          ancho *
          escala
        )
      );


    alto =
      Math.max(
        1,
        Math.round(
          alto *
          escala
        )
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      ancho;

    canvas.height =
      alto;


    const contexto =
      canvas.getContext(
        "2d"
      );


    if (!contexto) {
      throw new Error(
        "El navegador no pudo procesar la imagen."
      );
    }


    contexto.clearRect(
      0,
      0,
      ancho,
      alto
    );


    contexto.drawImage(
      imagen,
      0,
      0,
      ancho,
      alto
    );


    resultado =
      canvas.toDataURL(
        "image/webp",
        calidad
      );


    if (
      resultado.length <=
      550000
    ) {
      return resultado;
    }


    maximo =
      Math.max(
        140,
        Math.round(
          maximo *
          0.78
        )
      );


    calidad =
      Math.max(
        0.55,
        calidad -
        0.07
      );
  }


  if (
    resultado.length >
    600000
  ) {
    throw new Error(
      "La imagen continúa siendo demasiado pesada. Usa un logo más pequeño."
    );
  }


  return resultado;
}


export default SuperAdminPersonalizacion;