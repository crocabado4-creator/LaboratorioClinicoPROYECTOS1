import {
  useEffect,
  useState,
} from "react";

import {
  actualizarAnalisis,
  cambiarEstadoAnalisis,
  crearAnalisis,
  obtenerAnalisis,
} from "../services/analisisService";

import ConfiguracionAnalisis from "./ConfiguracionAnalisis";
import ParametrosAnalisis from "./ParametrosAnalisis";

import "./GestionAnalisis.css";


// =====================================================
// FORMULARIO INICIAL
// =====================================================

const formularioInicial = {
  nombre: "",
  descripcion: "",
  precio: "",
  unidad: "",
  tipo: "",
  activo: true,
};


// =====================================================
// COMPONENTE
// =====================================================

function GestionAnalisis({
  usuario,
  permisos = [],
  volver,
}) {

  // ===================================================
  // PERMISOS
  // ===================================================

  const puedeCrear =
    permisos.includes(
      "analisis.crear"
    );

  const puedeEditar =
    permisos.includes(
      "analisis.editar"
    );

  const puedeVer =
    permisos.includes(
      "analisis.ver"
    ) ||
    puedeCrear ||
    puedeEditar;


  // ===================================================
  // ESTADOS
  // ===================================================

  const [
    analisis,
    setAnalisis,
  ] = useState([]);


  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );


  const [
    analisisSeleccionado,
    setAnalisisSeleccionado,
  ] = useState(null);


  const [
    editandoId,
    setEditandoId,
  ] = useState(null);


  const [
    modalFormulario,
    setModalFormulario,
  ] = useState(false);


  const [
    modalDetalle,
    setModalDetalle,
  ] = useState(false);


  const [
    cargando,
    setCargando,
  ] = useState(true);


  const [
    guardando,
    setGuardando,
  ] = useState(false);


  const [
    procesandoEstado,
    setProcesandoEstado,
  ] = useState("");


  const [
    mensaje,
    setMensaje,
  ] = useState(null);


  const [
    analisisConfiguracion,
    setAnalisisConfiguracion,
  ] = useState(null);


  const [
    analisisParametros,
    setAnalisisParametros,
  ] = useState(null);


  const [
    busqueda,
    setBusqueda,
  ] = useState("");


  const [
    categoriaFiltro,
    setCategoriaFiltro,
  ] = useState("todas");


  const [
    estadoFiltro,
    setEstadoFiltro,
  ] = useState("disponibles");


  // ===================================================
  // CARGAR ANÁLISIS
  // ===================================================

  const cargarAnalisis =
    async () => {

      try {

        setCargando(true);


        if (
          !usuario?.laboratorioId
        ) {

          setAnalisis([]);

          setMensaje({
            tipo: "error",
            texto:
              "El usuario no está asociado a un laboratorio.",
          });

          return;
        }


        if (!puedeVer) {

          setAnalisis([]);

          setMensaje({
            tipo: "error",
            texto:
              "No tienes permiso para consultar análisis clínicos.",
          });

          return;
        }


        const resultado =
          await obtenerAnalisis(
            usuario.laboratorioId
          );


        setAnalisis(
          Array.isArray(resultado)
            ? resultado
            : []
        );

      } catch (error) {

        console.error(
          "Error cargando análisis:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudieron cargar los análisis clínicos.",
        });

      } finally {

        setCargando(false);
      }
    };


  useEffect(() => {
    cargarAnalisis();
  }, [
    usuario?.laboratorioId,
  ]);


  // ===================================================
  // OCULTAR MENSAJE
  // ===================================================

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


  // ===================================================
  // ESTADÍSTICAS
  // ===================================================

  const totalActivos =
    analisis.filter(
      (item) =>
        item.activo === true
    ).length;


  const totalInactivos =
    analisis.length -
    totalActivos;


  // ===================================================
  // BÚSQUEDA Y FILTROS
  // ===================================================

  const categoriasDisponibles =
    Array.from(
      new Set(
        analisis
          .map(
            (item) =>
              String(
                item.categoria ||
                item.tipo ||
                ""
              ).trim()
          )
          .filter(Boolean)
      )
    ).sort(
      (a, b) =>
        a.localeCompare(
          b,
          "es"
        )
    );


  const textoBusqueda =
    normalizarTexto(
      busqueda
    );


  const analisisFiltrados =
    analisis.filter(
      (item) => {

        const nombre =
          normalizarTexto(
            item.nombre
          );


        const codigo =
          normalizarTexto(
            item.codigo
          );


        const categoria =
          String(
            item.categoria ||
            item.tipo ||
            ""
          ).trim();


        const coincideBusqueda =
          textoBusqueda === "" ||
          nombre.includes(
            textoBusqueda
          ) ||
          codigo.includes(
            textoBusqueda
          );


        const coincideCategoria =
          categoriaFiltro ===
            "todas" ||
          normalizarTexto(
            categoria
          ) ===
            normalizarTexto(
              categoriaFiltro
            );


        let coincideEstado = true;


        if (
          estadoFiltro ===
          "disponibles"
        ) {
          coincideEstado =
            item.activo === true;
        }


        if (
          estadoFiltro ===
          "inactivos"
        ) {
          coincideEstado =
            item.activo === false;
        }


        return (
          coincideBusqueda &&
          coincideCategoria &&
          coincideEstado
        );
      }
    );


  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoriaFiltro("todas");
    setEstadoFiltro("disponibles");
  };


  // ===================================================
  // CAMBIO FORMULARIO
  // ===================================================

  const manejarCambio =
    (evento) => {

      const {
        name,
        value,
        type,
        checked,
      } = evento.target;


      setFormulario(
        (actual) => ({
          ...actual,

          [name]:
            type === "checkbox"
              ? checked
              : value,
        })
      );
    };


  // ===================================================
  // NUEVO
  // ===================================================

  const abrirNuevo =
    () => {

      if (!puedeCrear) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para registrar análisis clínicos.",
        });

        return;
      }


      setFormulario(
        formularioInicial
      );

      setEditandoId(
        null
      );

      setAnalisisSeleccionado(
        null
      );

      setModalFormulario(
        true
      );
    };


  // ===================================================
  // EDITAR
  // ===================================================

  const abrirEditar =
    (item) => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para modificar análisis clínicos.",
        });

        return;
      }


      setEditandoId(
        item.id
      );


      setAnalisisSeleccionado(
        item
      );


      setFormulario({
        nombre:
          item.nombre ||
          "",

        descripcion:
          item.descripcion ||
          "",

        precio:
          item.precio !==
            undefined &&
          item.precio !==
            null
            ? String(
                item.precio
              )
            : "",

        unidad:
          item.unidad ||
          "",

        tipo:
          item.tipo ||
          "",

        activo:
          item.activo !==
          false,
      });


      setModalFormulario(
        true
      );
    };


  // ===================================================
  // DETALLE
  // ===================================================

  const abrirDetalle =
    (item) => {

      setAnalisisSeleccionado(
        item
      );

      setModalDetalle(
        true
      );
    };


  // ===================================================
  // CERRAR FORMULARIO
  // ===================================================

  const cerrarFormulario =
    () => {

      if (guardando) {
        return;
      }


      setModalFormulario(
        false
      );

      setEditandoId(
        null
      );

      setAnalisisSeleccionado(
        null
      );

      setFormulario(
        formularioInicial
      );
    };


  // ===================================================
  // CERRAR DETALLE
  // ===================================================

  const cerrarDetalle =
    () => {

      setModalDetalle(
        false
      );

      setAnalisisSeleccionado(
        null
      );
    };


  // ===================================================
  // VALIDAR
  // ===================================================

  const validarFormulario =
    () => {

      if (
        formulario.nombre.trim() ===
        ""
      ) {
        return "El nombre del análisis es obligatorio.";
      }


      if (
        formulario.descripcion.trim() ===
        ""
      ) {
        return "La descripción es obligatoria.";
      }


      if (
        formulario.tipo.trim() ===
        ""
      ) {
        return "El tipo de análisis es obligatorio.";
      }


      if (
        formulario.precio ===
        ""
      ) {
        return "El precio es obligatorio.";
      }


      const precio =
        Number(
          formulario.precio
        );


      if (
        Number.isNaN(precio) ||
        precio < 0
      ) {
        return "El precio no es válido.";
      }


      return "";
    };


  // ===================================================
  // GUARDAR
  // ===================================================

  const guardarAnalisis =
    async (evento) => {

      evento.preventDefault();

      setMensaje(null);


      const error =
        validarFormulario();


      if (error) {

        setMensaje({
          tipo: "error",
          texto: error,
        });

        return;
      }


      const datos = {

        nombre:
          formulario.nombre,

        descripcion:
          formulario.descripcion,

        precio:
          Number(
            formulario.precio
          ),

        unidad:
          formulario.unidad,

        tipo:
          formulario.tipo,

        activo:
          formulario.activo,
      };


      try {

        setGuardando(true);


        if (editandoId) {

          if (!puedeEditar) {
            throw new Error(
              "No tienes permiso para editar análisis clínicos."
            );
          }


          await actualizarAnalisis(
            editandoId,
            usuario.laboratorioId,
            datos
          );


          setMensaje({
            tipo: "exito",
            texto:
              "Análisis actualizado correctamente.",
          });

        } else {

          if (!puedeCrear) {
            throw new Error(
              "No tienes permiso para registrar análisis clínicos."
            );
          }


          await crearAnalisis(
            usuario.laboratorioId,
            datos
          );


          setMensaje({
            tipo: "exito",
            texto:
              "Análisis registrado correctamente.",
          });
        }


        setModalFormulario(
          false
        );

        setEditandoId(
          null
        );

        setAnalisisSeleccionado(
          null
        );

        setFormulario(
          formularioInicial
        );


        await cargarAnalisis();

      } catch (error) {

        console.error(
          "Error guardando análisis:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo guardar el análisis.",
        });

      } finally {

        setGuardando(false);
      }
    };


  // ===================================================
  // ACTIVAR / DESACTIVAR
  // ===================================================

  const cambiarEstado =
    async (item) => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para modificar análisis clínicos.",
        });

        return;
      }


      const nuevoEstado =
        !item.activo;


      const accion =
        nuevoEstado
          ? "activar"
          : "desactivar";


      const confirmar =
        window.confirm(
          `¿Deseas ${accion} el análisis "${item.nombre}"?`
        );


      if (!confirmar) {
        return;
      }


      try {

        setProcesandoEstado(
          item.id
        );


        await cambiarEstadoAnalisis(
          item.id,
          usuario.laboratorioId,
          nuevoEstado
        );


        setMensaje({
          tipo: "exito",
          texto:
            nuevoEstado
              ? "Análisis activado correctamente."
              : "Análisis desactivado correctamente.",
        });


        await cargarAnalisis();

      } catch (error) {

        console.error(
          "Error cambiando estado:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo cambiar el estado del análisis.",
        });

      } finally {

        setProcesandoEstado("");
      }
    };


  // ===================================================
  // CARGANDO
  // ===================================================

  if (cargando) {

    return (
      <main className="ga-page ga-loading-page">

        <div className="ga-loading-card">

          <div className="ga-spinner" />

          <h2>
            Análisis clínicos
          </h2>

          <p>
            Cargando catálogo del laboratorio...
          </p>

        </div>

      </main>
    );
  }


  // ===================================================
  // CONFIGURACIÓN DEL ANÁLISIS
  // ===================================================

  if (analisisConfiguracion) {
    return (
      <ConfiguracionAnalisis
        analisis={analisisConfiguracion}
        usuario={usuario}
        volver={() =>
          setAnalisisConfiguracion(null)
        }
      />
    );
  }


  // ===================================================
  // PARÁMETROS DEL ANÁLISIS
  // ===================================================

  if (analisisParametros) {
    return (
      <ParametrosAnalisis
        analisis={analisisParametros}
        usuario={usuario}
        permisos={permisos}
        volver={() =>
          setAnalisisParametros(null)
        }
      />
    );
  }


  // ===================================================
  // UI
  // ===================================================

  return (
    <main className="ga-page">

      {/* ===============================================
          CABECERA
      =============================================== */}

      <header className="ga-header">

        <div className="ga-header-info">

          <button
            type="button"
            className="ga-back-button"
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


          <span className="ga-eyebrow">
            CATÁLOGO
          </span>


          <h1>
            Análisis clínicos
          </h1>


          <p>
            Administra los análisis y servicios disponibles en tu laboratorio.
          </p>

        </div>


        <div className="ga-header-actions">

          <div className="ga-header-icon">
            🔬
          </div>


          {puedeCrear && (
            <button
              type="button"
              className="ga-new-button"
              onClick={
                abrirNuevo
              }
            >
              <span>
                +
              </span>

              Nuevo análisis
            </button>
          )}

        </div>

      </header>


      {/* ===============================================
          MENSAJE
      =============================================== */}

      {mensaje && (
        <div
          className={`ga-message ${
            mensaje.tipo ===
            "error"
              ? "ga-message-error"
              : "ga-message-success"
          }`}
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


      {/* ===============================================
          ESTADÍSTICAS
      =============================================== */}

      <section className="ga-stats">

        <article className="ga-stat-card">

          <div className="ga-stat-icon ga-stat-blue">
            🧪
          </div>

          <div>

            <span>
              TOTAL ANÁLISIS
            </span>

            <strong>
              {analisis.length}
            </strong>

          </div>

        </article>


        <article className="ga-stat-card">

          <div className="ga-stat-icon ga-stat-green">
            ✓
          </div>

          <div>

            <span>
              ACTIVOS
            </span>

            <strong>
              {totalActivos}
            </strong>

          </div>

        </article>


        <article className="ga-stat-card">

          <div className="ga-stat-icon ga-stat-red">
            ⏸
          </div>

          <div>

            <span>
              INACTIVOS
            </span>

            <strong>
              {totalInactivos}
            </strong>

          </div>

        </article>

      </section>


      {/* ===============================================
          BÚSQUEDA Y FILTROS
      =============================================== */}

      <section className="ga-filter-card">

        <div className="ga-filter-header">

          <div>

            <span className="ga-filter-eyebrow">
              BÚSQUEDA
            </span>

            <h2>
              Buscar análisis
            </h2>

            <p>
              Localiza rápidamente los análisis disponibles del catálogo.
            </p>

          </div>


          <span className="ga-filter-result">
            {analisisFiltrados.length}{" "}
            {analisisFiltrados.length === 1
              ? "análisis encontrado"
              : "análisis encontrados"}
          </span>

        </div>


        <div className="ga-filter-grid">

          <div className="ga-filter-field ga-filter-search">

            <label htmlFor="ga-busqueda">
              Buscar
            </label>

            <div className="ga-search-input">

              <span>
                🔍
              </span>

              <input
                id="ga-busqueda"
                type="text"
                value={busqueda}
                onChange={(evento) =>
                  setBusqueda(
                    evento.target.value
                  )
                }
                placeholder="Nombre o código..."
                autoComplete="off"
              />

            </div>

          </div>


          <div className="ga-filter-field">

            <label htmlFor="ga-categoria">
              Categoría
            </label>

            <select
              id="ga-categoria"
              value={categoriaFiltro}
              onChange={(evento) =>
                setCategoriaFiltro(
                  evento.target.value
                )
              }
            >

              <option value="todas">
                Todas
              </option>

              {categoriasDisponibles.map(
                (categoria) => (
                  <option
                    key={categoria}
                    value={categoria}
                  >
                    {categoria}
                  </option>
                )
              )}

            </select>

          </div>


          <div className="ga-filter-field">

            <label htmlFor="ga-estado">
              Estado
            </label>

            <select
              id="ga-estado"
              value={estadoFiltro}
              onChange={(evento) =>
                setEstadoFiltro(
                  evento.target.value
                )
              }
            >

              <option value="disponibles">
                Disponibles
              </option>

              <option value="inactivos">
                Inactivos
              </option>

              <option value="todos">
                Todos
              </option>

            </select>

          </div>


          <div className="ga-filter-clear-wrapper">

            <button
              type="button"
              className="ga-filter-clear"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>

          </div>

        </div>

      </section>


      {/* ===============================================
          TABLA
      =============================================== */}

      <section className="ga-table-card">

        <div className="ga-table-header">

          <div>

            <h2>
              Catálogo de análisis
            </h2>

            <p>
              Consulta los servicios clínicos registrados en este laboratorio.
            </p>

          </div>


          <span className="ga-result-count">

            {analisisFiltrados.length}{" "}

            {analisisFiltrados.length === 1
              ? "análisis"
              : "análisis"}

          </span>

        </div>


        {analisis.length ===
        0 ? (

          <div className="ga-empty">

            <div className="ga-empty-icon">
              🔬
            </div>

            <h3>
              No existen análisis registrados
            </h3>

            <p>
              Registra el primer análisis clínico del laboratorio.
            </p>


            {puedeCrear && (
              <button
                type="button"
                className="ga-new-button"
                onClick={
                  abrirNuevo
                }
              >
                + Nuevo análisis
              </button>
            )}

          </div>

        ) : analisisFiltrados.length ===
        0 ? (

          <div className="ga-empty">

            <div className="ga-empty-icon">
              🔍
            </div>

            <h3>
              No se encontraron coincidencias
            </h3>

            <p>
              No existen análisis que coincidan con la búsqueda o los filtros seleccionados.
            </p>

            <button
              type="button"
              className="ga-filter-clear ga-empty-clear"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>

          </div>

        ) : (

          <div className="ga-table-wrapper">

            <table className="ga-table">

              <thead>

                <tr>

                  <th>
                    Análisis
                  </th>

                  <th>
                    Tipo
                  </th>

                  <th>
                    Precio
                  </th>

                  <th>
                    Unidad
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

                {analisisFiltrados.map(
                  (item) => (

                    <tr
                      key={
                        item.id
                      }
                    >

                      {/* ANÁLISIS */}

                      <td>

                        <div className="ga-analysis-cell">

                          <div className="ga-analysis-icon">
                            🧪
                          </div>


                          <div className="ga-analysis-name">

                            <strong>
                              {item.nombre}
                            </strong>

                            <span>
                              {acortarTexto(
                                item.descripcion,
                                55
                              )}
                            </span>

                          </div>

                        </div>

                      </td>


                      {/* TIPO */}

                      <td>

                        <span className="ga-type">
                          {item.tipo ||
                            "Sin tipo"}
                        </span>

                      </td>


                      {/* PRECIO */}

                      <td>

                        <strong className="ga-price">

                          Bs{" "}

                          {Number(
                            item.precio ||
                            0
                          ).toFixed(2)}

                        </strong>

                      </td>


                      {/* UNIDAD */}

                      <td>

                        {item.unidad ||
                          "No definida"}

                      </td>


                      {/* ESTADO */}

                      <td>

                        <span
                          className={`ga-status ${
                            item.activo
                              ? "ga-status-active"
                              : "ga-status-inactive"
                          }`}
                        >
                          {item.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>

                      </td>


                      {/* ACCIONES */}

                      <td>

                        <div className="ga-actions">

                          <button
                            type="button"
                            className="ga-action ga-detail-button"
                            onClick={() =>
                              abrirDetalle(
                                item
                              )
                            }
                          >
                            Ver detalle
                          </button>


                          {puedeEditar && (
                            <button
                              type="button"
                              className="ga-action ga-config-button"
                              onClick={() =>
                                setAnalisisConfiguracion(
                                  item
                                )
                              }
                            >
                              Configurar
                            </button>
                          )}


                          {puedeEditar && (
                            <button
                              type="button"
                              className="ga-action ga-parameters-button"
                              onClick={() =>
                                setAnalisisParametros(
                                  item
                                )
                              }
                            >
                              Parámetros
                            </button>
                          )}


                          {puedeEditar && (
                            <button
                              type="button"
                              className="ga-action ga-edit-button"
                              onClick={() =>
                                abrirEditar(
                                  item
                                )
                              }
                            >
                              Editar
                            </button>
                          )}


                          {puedeEditar && (
                            <button
                              type="button"
                              className={`ga-action ${
                                item.activo
                                  ? "ga-disable-button"
                                  : "ga-enable-button"
                              }`}
                              onClick={() =>
                                cambiarEstado(
                                  item
                                )
                              }
                              disabled={
                                procesandoEstado ===
                                item.id
                              }
                            >

                              {procesandoEstado ===
                              item.id
                                ? "Procesando..."
                                : item.activo
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


      {/* ===============================================
          MODAL CREAR / EDITAR
      =============================================== */}

      {modalFormulario && (

        <div
          className="ga-modal-overlay"
          onMouseDown={(
            evento
          ) => {

            if (
              evento.target ===
                evento.currentTarget &&
              !guardando
            ) {
              cerrarFormulario();
            }
          }}
        >

          <div className="ga-modal ga-form-modal">

            {/* HEADER */}

            <div className="ga-modal-header">

              <div>

                <span className="ga-modal-eyebrow">

                  {editandoId
                    ? "ACTUALIZAR"
                    : "NUEVO REGISTRO"}

                </span>


                <h2>

                  {editandoId
                    ? "Editar análisis"
                    : "Registrar análisis"}

                </h2>


                <p>
                  Completa la información del análisis clínico.
                </p>

              </div>


              <button
                type="button"
                className="ga-modal-close"
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


            {/* FORMULARIO */}

            <form
              className="ga-form"
              onSubmit={
                guardarAnalisis
              }
            >

              <section className="ga-form-section">

                <div className="ga-form-section-title">

                  <div className="ga-section-icon ga-section-blue">
                    🔬
                  </div>


                  <div>

                    <h3>
                      Información general
                    </h3>

                    <p>
                      Datos principales del análisis.
                    </p>

                  </div>

                </div>


                <div className="ga-form-grid">

                  <Campo
                    label="Nombre del análisis"
                    obligatorio
                    full
                  >

                    <input
                      type="text"
                      name="nombre"
                      value={
                        formulario.nombre
                      }
                      onChange={
                        manejarCambio
                      }
                      placeholder="Ej. Hemograma completo"
                      maxLength="120"
                      disabled={
                        guardando
                      }
                    />

                  </Campo>


                  <Campo
                    label="Tipo"
                    obligatorio
                  >

                    <input
                      type="text"
                      name="tipo"
                      value={
                        formulario.tipo
                      }
                      onChange={
                        manejarCambio
                      }
                      placeholder="Ej. Hematología"
                      maxLength="80"
                      disabled={
                        guardando
                      }
                    />

                  </Campo>


                  <Campo
                    label="Unidad"
                  >

                    <input
                      type="text"
                      name="unidad"
                      value={
                        formulario.unidad
                      }
                      onChange={
                        manejarCambio
                      }
                      placeholder="Ej. mg/dL"
                      maxLength="50"
                      disabled={
                        guardando
                      }
                    />

                  </Campo>


                  <Campo
                    label="Precio (Bs)"
                    obligatorio
                  >

                    <input
                      type="number"
                      name="precio"
                      value={
                        formulario.precio
                      }
                      onChange={
                        manejarCambio
                      }
                      min="0"
                      step="0.01"
                      placeholder="Ej. 80"
                      disabled={
                        guardando
                      }
                    />

                  </Campo>


                  <Campo
                    label="Estado"
                  >

                    <label className="ga-switch-field">

                      <input
                        type="checkbox"
                        name="activo"
                        checked={
                          formulario.activo
                        }
                        onChange={
                          manejarCambio
                        }
                        disabled={
                          guardando
                        }
                      />

                      <span
                        className={`ga-switch ${
                          formulario.activo
                            ? "ga-switch-on"
                            : ""
                        }`}
                      >
                        <span />
                      </span>


                      <strong>

                        {formulario.activo
                          ? "Activo"
                          : "Inactivo"}

                      </strong>

                    </label>

                  </Campo>


                  <Campo
                    label="Descripción"
                    obligatorio
                    full
                  >

                    <textarea
                      name="descripcion"
                      value={
                        formulario.descripcion
                      }
                      onChange={
                        manejarCambio
                      }
                      rows="5"
                      maxLength="500"
                      placeholder="Describe brevemente el análisis clínico..."
                      disabled={
                        guardando
                      }
                    />

                  </Campo>

                </div>

              </section>


              <div className="ga-form-actions">

                <button
                  type="button"
                  className="ga-secondary-button"
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
                  className="ga-primary-button"
                  disabled={
                    guardando
                  }
                >

                  {guardando
                    ? "Guardando..."
                    : editandoId
                      ? "Guardar cambios"
                      : "Registrar análisis"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ===============================================
          MODAL DETALLE
      =============================================== */}

      {modalDetalle &&
        analisisSeleccionado && (

          <div
            className="ga-modal-overlay"
            onMouseDown={(
              evento
            ) => {

              if (
                evento.target ===
                evento.currentTarget
              ) {
                cerrarDetalle();
              }
            }}
          >

            <div className="ga-modal ga-detail-modal">

              <div className="ga-modal-header">

                <div>

                  <span className="ga-modal-eyebrow">
                    INFORMACIÓN COMPLETA
                  </span>

                  <h2>
                    Detalle del análisis
                  </h2>

                  <p>
                    Consulta los datos registrados del servicio clínico.
                  </p>

                </div>


                <button
                  type="button"
                  className="ga-modal-close"
                  onClick={
                    cerrarDetalle
                  }
                >
                  ×
                </button>

              </div>


              <div className="ga-detail-profile">

                <div className="ga-detail-icon">
                  🔬
                </div>


                <div>

                  <h3>
                    {
                      analisisSeleccionado.nombre
                    }
                  </h3>

                  <span>
                    {
                      analisisSeleccionado.tipo ||
                      "Sin tipo"
                    }
                  </span>

                </div>


                <span
                  className={`ga-status ga-detail-status ${
                    analisisSeleccionado.activo
                      ? "ga-status-active"
                      : "ga-status-inactive"
                  }`}
                >

                  {
                    analisisSeleccionado.activo
                      ? "Activo"
                      : "Inactivo"
                  }

                </span>

              </div>


              <div className="ga-detail-grid">

                <DetalleItem
                  titulo="Nombre"
                  valor={
                    analisisSeleccionado.nombre
                  }
                />


                <DetalleItem
                  titulo="Tipo"
                  valor={
                    analisisSeleccionado.tipo
                  }
                />


                <DetalleItem
                  titulo="Precio"
                  valor={`Bs ${Number(
                    analisisSeleccionado.precio ||
                    0
                  ).toFixed(2)}`}
                />


                <DetalleItem
                  titulo="Unidad"
                  valor={
                    analisisSeleccionado.unidad ||
                    "No definida"
                  }
                />


                <DetalleItem
                  titulo="Estado"
                  valor={
                    analisisSeleccionado.activo
                      ? "Activo"
                      : "Inactivo"
                  }
                />


                <DetalleItem
                  titulo="Identificador"
                  valor={
                    analisisSeleccionado.analisisId ||
                    analisisSeleccionado.id
                  }
                />


                <DetalleItem
                  titulo="Descripción"
                  valor={
                    analisisSeleccionado.descripcion
                  }
                  full
                />


                <DetalleItem
                  titulo="Fecha de registro"
                  valor={
                    formatearTimestamp(
                      analisisSeleccionado.fechaRegistro
                    )
                  }
                  full
                />

              </div>


              <div className="ga-modal-footer">

                <button
                  type="button"
                  className="ga-secondary-button"
                  onClick={
                    cerrarDetalle
                  }
                >
                  Cerrar
                </button>


                {puedeEditar && (
                  <button
                    type="button"
                    className="ga-primary-button"
                    onClick={() => {

                      const item =
                        analisisSeleccionado;


                      setModalDetalle(
                        false
                      );


                      abrirEditar(
                        item
                      );
                    }}
                  >
                    Editar análisis
                  </button>
                )}

              </div>

            </div>

          </div>
        )}

    </main>
  );
}


// =====================================================
// CAMPO
// =====================================================

function Campo({
  label,
  obligatorio = false,
  full = false,
  children,
}) {

  return (
    <div
      className={`ga-field ${
        full
          ? "ga-field-full"
          : ""
      }`}
    >

      <label className="ga-field-label">

        {label}

        {obligatorio && (
          <span className="ga-required">
            *
          </span>
        )}

      </label>

      {children}

    </div>
  );
}


// =====================================================
// DETALLE
// =====================================================

function DetalleItem({
  titulo,
  valor,
  full = false,
}) {

  return (
    <div
      className={`ga-detail-item ${
        full
          ? "ga-detail-full"
          : ""
      }`}
    >

      <span>
        {titulo}
      </span>

      <strong>
        {valor ||
          "Sin información"}
      </strong>

    </div>
  );
}


// =====================================================
// NORMALIZAR TEXTO PARA BÚSQUEDA
// =====================================================

function normalizarTexto(
  valor
) {

  return String(
    valor ||
    ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


// =====================================================
// ACORTAR TEXTO
// =====================================================

function acortarTexto(
  texto,
  maximo
) {

  const valor =
    String(
      texto ||
      ""
    );


  if (
    valor.length <=
    maximo
  ) {
    return valor;
  }


  return `${valor.slice(
    0,
    maximo
  )}...`;
}


// =====================================================
// TIMESTAMP
// =====================================================

function formatearTimestamp(
  valor
) {

  if (!valor) {
    return "Sin información";
  }


  try {

    if (
      typeof valor.toDate ===
      "function"
    ) {

      return valor
        .toDate()
        .toLocaleString(
          "es-BO"
        );
    }


    if (
      valor.seconds
    ) {

      return new Date(
        valor.seconds *
        1000
      ).toLocaleString(
        "es-BO"
      );
    }


    return new Date(
      valor
    ).toLocaleString(
      "es-BO"
    );

  } catch {

    return "Sin información";
  }
}


export default GestionAnalisis;