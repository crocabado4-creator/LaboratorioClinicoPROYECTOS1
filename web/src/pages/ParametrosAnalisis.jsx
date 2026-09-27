import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  actualizarParametroAnalisis,
  crearParametroAnalisis,
  eliminarParametroAnalisis,
  obtenerParametrosAnalisis,
} from "../services/parametrosAnalisisService";

import RangosReferencia from "./RangosReferencia";

import "./ParametrosAnalisis.css";


const formularioInicial = {
  nombre: "",
  unidad: "",
  descripcion: "",
};


function ParametrosAnalisis({
  analisis,
  usuario,
  permisos = [],
  volver,
}) {

  // =====================================================
  // PERMISOS
  // =====================================================

  const puedeEditar =
    permisos.includes(
      "analisis.editar"
    );


  // =====================================================
  // IDENTIFICADOR DEL ANÁLISIS
  // =====================================================

  const analisisId =
    analisis?.id ||
    analisis?.analisisId ||
    "";


  // =====================================================
  // ESTADOS
  // =====================================================

  const [
    parametros,
    setParametros,
  ] = useState([]);


  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );


  const [
    editandoId,
    setEditandoId,
  ] = useState(null);


  const [
    modalFormulario,
    setModalFormulario,
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
    eliminandoId,
    setEliminandoId,
  ] = useState("");


  const [
    mensaje,
    setMensaje,
  ] = useState(null);


  // =====================================================
  // PARÁMETRO PARA RANGO DE REFERENCIA
  // =====================================================

  const [
    parametroRango,
    setParametroRango,
  ] = useState(null);


  // =====================================================
  // CARGAR PARÁMETROS
  // =====================================================

  const cargarParametros =
    useCallback(
      async () => {

        try {

          setCargando(true);


          if (!analisisId) {

            setParametros([]);

            setMensaje({
              tipo: "error",
              texto:
                "No se pudo identificar el análisis.",
            });

            return;
          }


          if (
            !usuario?.laboratorioId
          ) {

            setParametros([]);

            setMensaje({
              tipo: "error",
              texto:
                "No se pudo identificar el laboratorio.",
            });

            return;
          }


          const resultado =
            await obtenerParametrosAnalisis(
              analisisId,
              usuario.laboratorioId
            );


          setParametros(
            Array.isArray(resultado)
              ? resultado
              : []
          );

        } catch (error) {

          console.error(
            "Error cargando parámetros:",
            error
          );


          setMensaje({
            tipo: "error",
            texto:
              error?.message ||
              "No se pudieron cargar los parámetros.",
          });

        } finally {

          setCargando(false);
        }
      },
      [
        analisisId,
        usuario?.laboratorioId,
      ]
    );


  useEffect(() => {

    cargarParametros();

  }, [cargarParametros]);


  // =====================================================
  // OCULTAR MENSAJE
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
  // CAMBIAR FORMULARIO
  // =====================================================

  const manejarCambio =
    (evento) => {

      const {
        name,
        value,
      } = evento.target;


      setFormulario(
        (actual) => ({
          ...actual,
          [name]: value,
        })
      );
    };


  // =====================================================
  // NUEVO PARÁMETRO
  // =====================================================

  const abrirNuevoParametro =
    () => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para administrar parámetros.",
        });

        return;
      }


      setFormulario(
        formularioInicial
      );


      setEditandoId(
        null
      );


      setModalFormulario(
        true
      );
    };


  // =====================================================
  // EDITAR PARÁMETRO
  // =====================================================

  const abrirEditarParametro =
    (parametro) => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para modificar parámetros.",
        });

        return;
      }


      setEditandoId(
        parametro.parametroId
      );


      setFormulario({

        nombre:
          parametro.nombre ||
          "",

        unidad:
          parametro.unidad ||
          "",

        descripcion:
          parametro.descripcion ||
          "",
      });


      setModalFormulario(
        true
      );
    };


  // =====================================================
  // ABRIR RANGO DE REFERENCIA
  // =====================================================

  const abrirRangoReferencia =
    (parametro) => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para administrar rangos de referencia.",
        });

        return;
      }


      setParametroRango(
        parametro
      );
    };


  // =====================================================
  // CERRAR FORMULARIO
  // =====================================================

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


      setFormulario(
        formularioInicial
      );
    };


  // =====================================================
  // VALIDAR FORMULARIO
  // =====================================================

  const validarFormulario =
    () => {

      if (
        formulario.nombre.trim() ===
        ""
      ) {
        return "El nombre del parámetro es obligatorio.";
      }


      if (
        formulario.unidad.trim() ===
        ""
      ) {
        return "La unidad del parámetro es obligatoria.";
      }


      return "";
    };


  // =====================================================
  // GUARDAR PARÁMETRO
  // =====================================================

  const guardarParametro =
    async (evento) => {

      evento.preventDefault();

      setMensaje(null);


      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para administrar parámetros.",
        });

        return;
      }


      const error =
        validarFormulario();


      if (error) {

        setMensaje({
          tipo: "error",
          texto:
            error,
        });

        return;
      }


      const datos = {

        nombre:
          formulario.nombre,

        unidad:
          formulario.unidad,

        descripcion:
          formulario.descripcion,

        activo:
          true,
      };


      try {

        setGuardando(true);


        if (editandoId) {

          await actualizarParametroAnalisis(
            analisisId,
            usuario.laboratorioId,
            editandoId,
            datos
          );


          setMensaje({
            tipo: "exito",
            texto:
              "Parámetro actualizado correctamente.",
          });

        } else {

          await crearParametroAnalisis(
            analisisId,
            usuario.laboratorioId,
            datos
          );


          setMensaje({
            tipo: "exito",
            texto:
              "Parámetro registrado correctamente.",
          });
        }


        setModalFormulario(
          false
        );


        setEditandoId(
          null
        );


        setFormulario(
          formularioInicial
        );


        await cargarParametros();

      } catch (error) {

        console.error(
          "Error guardando parámetro:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo guardar el parámetro.",
        });

      } finally {

        setGuardando(false);
      }
    };


  // =====================================================
  // ELIMINAR PARÁMETRO
  // =====================================================

  const eliminarParametro =
    async (parametro) => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para eliminar parámetros.",
        });

        return;
      }


      const confirmar =
        window.confirm(
          `¿Deseas eliminar el parámetro "${parametro.nombre}"?`
        );


      if (!confirmar) {
        return;
      }


      try {

        setEliminandoId(
          parametro.parametroId
        );


        await eliminarParametroAnalisis(
          analisisId,
          usuario.laboratorioId,
          parametro.parametroId
        );


        setMensaje({
          tipo: "exito",
          texto:
            "Parámetro eliminado correctamente.",
        });


        await cargarParametros();

      } catch (error) {

        console.error(
          "Error eliminando parámetro:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo eliminar el parámetro.",
        });

      } finally {

        setEliminandoId("");
      }
    };


  // =====================================================
  // MOSTRAR RANGO DE REFERENCIA
  // =====================================================

  const mostrarRango =
    (parametro) => {

      const rango =
        parametro?.rangoReferencia;


      if (!rango) {
        return "Sin configurar";
      }


      if (
        rango.tipo ===
        "texto"
      ) {

        return (
          rango.textoReferencia ||
          "Sin configurar"
        );
      }


      if (
        rango.minimo !== null &&
        rango.minimo !== undefined &&
        rango.maximo !== null &&
        rango.maximo !== undefined
      ) {

        return `${rango.minimo} - ${rango.maximo} ${parametro.unidad || ""}`;
      }


      return "Sin configurar";
    };


  // =====================================================
  // CARGANDO
  // =====================================================

  if (cargando) {

    return (
      <main className="pa-page pa-loading-page">

        <div className="pa-loading-card">

          <div className="pa-spinner" />

          <h2>
            Parámetros del análisis
          </h2>

          <p>
            Cargando parámetros...
          </p>

        </div>

      </main>
    );
  }


  // =====================================================
  // RANGO DE REFERENCIA
  // =====================================================

  if (parametroRango) {

    return (
      <RangosReferencia
        analisis={analisis}
        parametro={parametroRango}
        usuario={usuario}
        permisos={permisos}
        volver={async () => {

          setParametroRango(
            null
          );


          await cargarParametros();
        }}
      />
    );
  }


  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <main className="pa-page">

      {/* ===============================================
          CABECERA
      =============================================== */}

      <header className="pa-header">

        <div className="pa-header-info">

          <button
            type="button"
            className="pa-back-button"
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


          <span className="pa-eyebrow">
            PARÁMETROS
          </span>


          <h1>
            Parámetros del análisis
          </h1>


          <p>
            Define los parámetros y valores utilizados posteriormente durante el registro de resultados.
          </p>

        </div>


        <div className="pa-header-actions">

          <div className="pa-header-icon">
            📋
          </div>


          {puedeEditar && (
            <button
              type="button"
              className="pa-new-button"
              onClick={
                abrirNuevoParametro
              }
            >
              <span>
                +
              </span>

              Nuevo parámetro
            </button>
          )}

        </div>

      </header>


      {/* ===============================================
          ANÁLISIS SELECCIONADO
      =============================================== */}

      <section className="pa-analysis-card">

        <div className="pa-analysis-icon">
          🔬
        </div>


        <div className="pa-analysis-info">

          <span>
            ANÁLISIS SELECCIONADO
          </span>


          <h2>
            {analisis?.nombre ||
              "Análisis clínico"}
          </h2>


          <p>
            {analisis?.descripcion ||
              "Sin descripción registrada."}
          </p>

        </div>


        <div className="pa-analysis-total">

          <span>
            PARÁMETROS
          </span>

          <strong>
            {parametros.length}
          </strong>

        </div>

      </section>


      {/* ===============================================
          MENSAJE
      =============================================== */}

      {mensaje && (
        <div
          className={`pa-message ${
            mensaje.tipo ===
            "error"
              ? "pa-message-error"
              : "pa-message-success"
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
          TABLA
      =============================================== */}

      <section className="pa-table-card">

        <div className="pa-table-header">

          <div>

            <h2>
              Parámetros registrados
            </h2>


            <p>
              Cada parámetro pertenece al análisis seleccionado y puede tener su propio rango de referencia.
            </p>

          </div>


          <span className="pa-result-count">

            {parametros.length}{" "}

            {parametros.length === 1
              ? "parámetro"
              : "parámetros"}

          </span>

        </div>


        {parametros.length ===
        0 ? (

          <div className="pa-empty">

            <div className="pa-empty-icon">
              📋
            </div>


            <h3>
              No existen parámetros registrados
            </h3>


            <p>
              Agrega el primer parámetro para este análisis clínico.
            </p>


            {puedeEditar && (
              <button
                type="button"
                className="pa-new-button"
                onClick={
                  abrirNuevoParametro
                }
              >
                + Nuevo parámetro
              </button>
            )}

          </div>

        ) : (

          <div className="pa-table-wrapper">

            <table className="pa-table">

              <thead>

                <tr>

                  <th>
                    Parámetro
                  </th>

                  <th>
                    Unidad
                  </th>

                  <th>
                    Descripción
                  </th>

                  <th>
                    Rango de referencia
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

                {parametros.map(
                  (parametro) => (

                    <tr
                      key={
                        parametro.parametroId
                      }
                    >

                      {/* PARÁMETRO */}

                      <td>

                        <div className="pa-parameter-cell">

                          <div className="pa-parameter-icon">
                            🧪
                          </div>


                          <div>

                            <strong>
                              {parametro.nombre}
                            </strong>


                            <span>
                              {parametro.parametroId}
                            </span>

                          </div>

                        </div>

                      </td>


                      {/* UNIDAD */}

                      <td>

                        <span className="pa-unit">

                          {parametro.unidad ||
                            "No definida"}

                        </span>

                      </td>


                      {/* DESCRIPCIÓN */}

                      <td>

                        <span className="pa-description">

                          {parametro.descripcion ||
                            "Sin descripción"}

                        </span>

                      </td>


                      {/* RANGO */}

                      <td>

                        <span
                          className={
                            parametro.rangoReferencia
                              ? "pa-range-value pa-range-configured"
                              : "pa-range-value pa-range-empty"
                          }
                        >
                          {mostrarRango(
                            parametro
                          )}
                        </span>

                      </td>


                      {/* ESTADO */}

                      <td>

                        <span
                          className={`pa-status ${
                            parametro.activo !==
                            false
                              ? "pa-status-active"
                              : "pa-status-inactive"
                          }`}
                        >

                          {parametro.activo !==
                          false
                            ? "Activo"
                            : "Inactivo"}

                        </span>

                      </td>


                      {/* ACCIONES */}

                      <td>

                        <div className="pa-actions">

                          {puedeEditar && (
                            <button
                              type="button"
                              className="pa-action pa-edit-button"
                              onClick={() =>
                                abrirEditarParametro(
                                  parametro
                                )
                              }
                            >
                              Editar
                            </button>
                          )}


                          {puedeEditar && (
                            <button
                              type="button"
                              className="pa-action pa-range-button"
                              onClick={() =>
                                abrirRangoReferencia(
                                  parametro
                                )
                              }
                            >
                              Rango de referencia
                            </button>
                          )}


                          {puedeEditar && (
                            <button
                              type="button"
                              className="pa-action pa-delete-button"
                              onClick={() =>
                                eliminarParametro(
                                  parametro
                                )
                              }
                              disabled={
                                eliminandoId ===
                                parametro.parametroId
                              }
                            >

                              {eliminandoId ===
                              parametro.parametroId
                                ? "Eliminando..."
                                : "Eliminar"}

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
          className="pa-modal-overlay"
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

          <div className="pa-modal">

            <div className="pa-modal-header">

              <div>

                <span className="pa-modal-eyebrow">

                  {editandoId
                    ? "ACTUALIZAR"
                    : "NUEVO PARÁMETRO"}

                </span>


                <h2>

                  {editandoId
                    ? "Editar parámetro"
                    : "Registrar parámetro"}

                </h2>


                <p>
                  Define el nombre, unidad y descripción del parámetro.
                </p>

              </div>


              <button
                type="button"
                className="pa-modal-close"
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
              className="pa-form"
              onSubmit={
                guardarParametro
              }
            >

              <div className="pa-form-grid">

                <Campo
                  label="Nombre del parámetro"
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
                    placeholder="Ej. Hemoglobina"
                    maxLength="100"
                    disabled={
                      guardando
                    }
                  />

                </Campo>


                <Campo
                  label="Unidad"
                  obligatorio
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
                    placeholder="Ej. g/dL"
                    maxLength="50"
                    disabled={
                      guardando
                    }
                  />

                </Campo>


                <div className="pa-example-card">

                  <span>
                    EJEMPLO
                  </span>

                  <strong>
                    Hemoglobina
                  </strong>

                  <small>
                    Unidad: g/dL
                  </small>

                </div>


                <Campo
                  label="Descripción"
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
                    maxLength="400"
                    placeholder="Ej. Concentración de hemoglobina presente en la sangre."
                    disabled={
                      guardando
                    }
                  />

                </Campo>

              </div>


              <div className="pa-form-actions">

                <button
                  type="button"
                  className="pa-secondary-button"
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
                  className="pa-primary-button"
                  disabled={
                    guardando
                  }
                >

                  {guardando
                    ? "Guardando..."
                    : editandoId
                      ? "Guardar cambios"
                      : "Registrar parámetro"}

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
      className={`pa-field ${
        full
          ? "pa-field-full"
          : ""
      }`}
    >

      <label>

        {label}

        {obligatorio && (
          <span className="pa-required">
            *
          </span>
        )}

      </label>


      {children}

    </div>
  );
}


export default ParametrosAnalisis;