import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  eliminarRangoReferencia,
  guardarRangoReferencia,
  obtenerRangoReferencia,
} from "../services/rangosReferenciaService";

import "./RangosReferencia.css";


const formularioInicial = {
  tipo: "numerico",
  minimo: "",
  maximo: "",
  textoReferencia: "",
  observaciones: "",
};


function RangosReferencia({
  analisis,
  parametro,
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
  // IDENTIFICADORES
  // =====================================================

  const analisisId =
    analisis?.id ||
    analisis?.analisisId ||
    "";


  const parametroId =
    parametro?.parametroId ||
    "";


  // =====================================================
  // ESTADOS
  // =====================================================

  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );


  const [
    cargando,
    setCargando,
  ] = useState(true);


  const [
    guardando,
    setGuardando,
  ] = useState(false);


  const [
    eliminando,
    setEliminando,
  ] = useState(false);


  const [
    existeRango,
    setExisteRango,
  ] = useState(false);


  const [
    mensaje,
    setMensaje,
  ] = useState(null);


  // =====================================================
  // CARGAR RANGO
  // =====================================================

  const cargarRango =
    useCallback(
      async () => {

        try {

          setCargando(true);
          setMensaje(null);


          if (!analisisId) {

            setMensaje({
              tipo: "error",
              texto:
                "No se pudo identificar el análisis.",
            });

            return;
          }


          if (!parametroId) {

            setMensaje({
              tipo: "error",
              texto:
                "No se pudo identificar el parámetro.",
            });

            return;
          }


          if (
            !usuario?.laboratorioId
          ) {

            setMensaje({
              tipo: "error",
              texto:
                "No se pudo identificar el laboratorio.",
            });

            return;
          }


          const resultado =
            await obtenerRangoReferencia(
              analisisId,
              usuario.laboratorioId,
              parametroId
            );


          const tieneRango =
            resultado.minimo !== "" ||
            resultado.maximo !== "" ||
            resultado.textoReferencia !== "" ||
            resultado.observaciones !== "";


          setExisteRango(
            tieneRango
          );


          setFormulario({

            tipo:
              resultado.tipo ||
              "numerico",

            minimo:
              resultado.minimo ??
              "",

            maximo:
              resultado.maximo ??
              "",

            textoReferencia:
              resultado.textoReferencia ||
              "",

            observaciones:
              resultado.observaciones ||
              "",
          });

        } catch (error) {

          console.error(
            "Error cargando rango:",
            error
          );


          setMensaje({
            tipo: "error",
            texto:
              error?.message ||
              "No se pudo cargar el rango de referencia.",
          });

        } finally {

          setCargando(false);
        }
      },
      [
        analisisId,
        parametroId,
        usuario?.laboratorioId,
      ]
    );


  useEffect(() => {
    cargarRango();
  }, [cargarRango]);


  // =====================================================
  // OCULTAR MENSAJES
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
  // CAMBIO DE CAMPOS
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
  // CAMBIAR TIPO
  // =====================================================

  const cambiarTipo =
    (evento) => {

      const nuevoTipo =
        evento.target.value;


      setFormulario(
        (actual) => ({
          ...actual,

          tipo:
            nuevoTipo,

          minimo:
            nuevoTipo ===
            "numerico"
              ? actual.minimo
              : "",

          maximo:
            nuevoTipo ===
            "numerico"
              ? actual.maximo
              : "",

          textoReferencia:
            nuevoTipo ===
            "texto"
              ? actual.textoReferencia
              : "",
        })
      );
    };


  // =====================================================
  // VALIDAR
  // =====================================================

  const validarFormulario =
    () => {

      if (
        formulario.tipo ===
        "numerico"
      ) {

        if (
          formulario.minimo ===
            "" ||
          formulario.maximo ===
            ""
        ) {
          return "Debes ingresar el valor mínimo y máximo.";
        }


        const minimo =
          Number(
            formulario.minimo
          );


        const maximo =
          Number(
            formulario.maximo
          );


        if (
          Number.isNaN(minimo) ||
          Number.isNaN(maximo)
        ) {
          return "El mínimo y máximo deben ser números válidos.";
        }


        if (
          minimo >
          maximo
        ) {
          return "El valor mínimo no puede ser mayor al máximo.";
        }
      }


      if (
        formulario.tipo ===
          "texto" &&
        formulario.textoReferencia.trim() ===
          ""
      ) {
        return "Debes ingresar el valor o texto de referencia.";
      }


      return "";
    };


  // =====================================================
  // GUARDAR
  // =====================================================

  const guardarRango =
    async (evento) => {

      evento.preventDefault();

      setMensaje(null);


      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para modificar rangos de referencia.",
        });

        return;
      }


      const error =
        validarFormulario();


      if (error) {

        setMensaje({
          tipo: "error",
          texto: error,
        });

        return;
      }


      try {

        setGuardando(true);


        await guardarRangoReferencia(
          analisisId,
          usuario.laboratorioId,
          parametroId,
          formulario
        );


        setExisteRango(
          true
        );


        setMensaje({
          tipo: "exito",
          texto:
            "Rango de referencia guardado correctamente.",
        });


        await cargarRango();

      } catch (error) {

        console.error(
          "Error guardando rango:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo guardar el rango de referencia.",
        });

      } finally {

        setGuardando(false);
      }
    };


  // =====================================================
  // ELIMINAR
  // =====================================================

  const eliminarRango =
    async () => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para eliminar rangos de referencia.",
        });

        return;
      }


      if (!existeRango) {
        return;
      }


      const confirmar =
        window.confirm(
          `¿Deseas eliminar el rango de referencia de "${parametro?.nombre || "este parámetro"}"?`
        );


      if (!confirmar) {
        return;
      }


      try {

        setEliminando(true);


        await eliminarRangoReferencia(
          analisisId,
          usuario.laboratorioId,
          parametroId
        );


        setFormulario(
          formularioInicial
        );


        setExisteRango(
          false
        );


        setMensaje({
          tipo: "exito",
          texto:
            "Rango de referencia eliminado correctamente.",
        });

      } catch (error) {

        console.error(
          "Error eliminando rango:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo eliminar el rango de referencia.",
        });

      } finally {

        setEliminando(false);
      }
    };


  // =====================================================
  // TEXTO DEL RANGO ACTUAL
  // =====================================================

  const obtenerVistaRango =
    () => {

      if (!existeRango) {
        return "Sin rango registrado";
      }


      if (
        formulario.tipo ===
        "numerico"
      ) {
        return `${
          formulario.minimo
        } - ${
          formulario.maximo
        } ${
          parametro?.unidad ||
          ""
        }`.trim();
      }


      return (
        formulario.textoReferencia ||
        "Sin referencia"
      );
    };


  // =====================================================
  // CARGANDO
  // =====================================================

  if (cargando) {

    return (
      <main className="rr-page rr-loading-page">

        <div className="rr-loading-card">

          <div className="rr-spinner" />

          <h2>
            Rangos de referencia
          </h2>

          <p>
            Cargando información...
          </p>

        </div>

      </main>
    );
  }


  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="rr-page">

      {/* ===============================================
          CABECERA
      =============================================== */}

      <header className="rr-header">

        <div className="rr-header-info">

          <button
            type="button"
            className="rr-back-button"
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


          <span className="rr-eyebrow">
            REFERENCIAS CLÍNICAS
          </span>


          <h1>
            Rango de referencia
          </h1>


          <p>
            Define los valores considerados de referencia para el parámetro seleccionado.
          </p>

        </div>


        <div className="rr-header-icon">
          📊
        </div>

      </header>


      {/* ===============================================
          INFORMACIÓN DEL ANÁLISIS
      =============================================== */}

      <section className="rr-info-grid">

        <article className="rr-info-card">

          <div className="rr-info-icon rr-info-cyan">
            🔬
          </div>


          <div>

            <span>
              ANÁLISIS
            </span>

            <strong>
              {analisis?.nombre ||
                "Sin información"}
            </strong>

            <small>
              {analisis?.tipo ||
                "Análisis clínico"}
            </small>

          </div>

        </article>


        <article className="rr-info-card">

          <div className="rr-info-icon rr-info-purple">
            🧪
          </div>


          <div>

            <span>
              PARÁMETRO
            </span>

            <strong>
              {parametro?.nombre ||
                "Sin información"}
            </strong>

            <small>
              Unidad:{" "}
              {parametro?.unidad ||
                "No definida"}
            </small>

          </div>

        </article>


        <article className="rr-info-card">

          <div className="rr-info-icon rr-info-green">
            ✓
          </div>


          <div>

            <span>
              RANGO ACTUAL
            </span>

            <strong>
              {obtenerVistaRango()}
            </strong>

            <small>
              {existeRango
                ? "Referencia configurada"
                : "Pendiente de configurar"}
            </small>

          </div>

        </article>

      </section>


      {/* ===============================================
          MENSAJE
      =============================================== */}

      {mensaje && (
        <div
          className={`rr-message ${
            mensaje.tipo ===
            "error"
              ? "rr-message-error"
              : "rr-message-success"
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
          FORMULARIO
      =============================================== */}

      <section className="rr-form-card">

        <div className="rr-form-header">

          <div>

            <span>
              CONFIGURACIÓN
            </span>

            <h2>
              Valores de referencia
            </h2>

            <p>
              Selecciona el tipo de referencia y registra sus valores.
            </p>

          </div>


          <span
            className={`rr-state ${
              existeRango
                ? "rr-state-ready"
                : "rr-state-empty"
            }`}
          >
            {existeRango
              ? "Configurado"
              : "Sin configurar"}
          </span>

        </div>


        <form
          className="rr-form"
          onSubmit={
            guardarRango
          }
        >

          {/* TIPO */}

          <div className="rr-field rr-field-full">

            <label>
              Tipo de rango
              <span className="rr-required">
                *
              </span>
            </label>


            <select
              name="tipo"
              value={
                formulario.tipo
              }
              onChange={
                cambiarTipo
              }
              disabled={
                !puedeEditar ||
                guardando
              }
            >

              <option value="numerico">
                Numérico
              </option>

              <option value="texto">
                Texto / Cualitativo
              </option>

            </select>


            <small>
              Usa rango numérico para resultados medibles y texto para resultados cualitativos.
            </small>

          </div>


          {/* NUMÉRICO */}

          {formulario.tipo ===
            "numerico" && (
            <div className="rr-numeric-grid">

              <div className="rr-field">

                <label>
                  Valor mínimo
                  <span className="rr-required">
                    *
                  </span>
                </label>


                <div className="rr-input-unit">

                  <input
                    type="number"
                    name="minimo"
                    value={
                      formulario.minimo
                    }
                    onChange={
                      manejarCambio
                    }
                    step="any"
                    placeholder="Ej. 12"
                    disabled={
                      !puedeEditar ||
                      guardando
                    }
                  />

                  <span>
                    {parametro?.unidad ||
                      "Unidad"}
                  </span>

                </div>

              </div>


              <div className="rr-field">

                <label>
                  Valor máximo
                  <span className="rr-required">
                    *
                  </span>
                </label>


                <div className="rr-input-unit">

                  <input
                    type="number"
                    name="maximo"
                    value={
                      formulario.maximo
                    }
                    onChange={
                      manejarCambio
                    }
                    step="any"
                    placeholder="Ej. 16"
                    disabled={
                      !puedeEditar ||
                      guardando
                    }
                  />

                  <span>
                    {parametro?.unidad ||
                      "Unidad"}
                  </span>

                </div>

              </div>

            </div>
          )}


          {/* TEXTO */}

          {formulario.tipo ===
            "texto" && (
            <div className="rr-field rr-field-full">

              <label>
                Valor de referencia
                <span className="rr-required">
                  *
                </span>
              </label>


              <input
                type="text"
                name="textoReferencia"
                value={
                  formulario.textoReferencia
                }
                onChange={
                  manejarCambio
                }
                placeholder="Ej. Negativo, Amarillo claro, Ausente..."
                maxLength="150"
                disabled={
                  !puedeEditar ||
                  guardando
                }
              />


              <small>
                Ejemplo: Negativo, Ausente, Normal, Amarillo claro.
              </small>

            </div>
          )}


          {/* OBSERVACIONES */}

          <div className="rr-field rr-field-full">

            <label>
              Observaciones
            </label>


            <textarea
              name="observaciones"
              value={
                formulario.observaciones
              }
              onChange={
                manejarCambio
              }
              rows="5"
              maxLength="500"
              placeholder="Ej. Valores de referencia para pacientes adultos."
              disabled={
                !puedeEditar ||
                guardando
              }
            />

          </div>


          {/* VISTA PREVIA */}

          <div className="rr-preview">

            <div className="rr-preview-icon">
              📋
            </div>


            <div>

              <span>
                VISTA PREVIA
              </span>

              <strong>
                {formulario.tipo ===
                "numerico"
                  ? `${
                      formulario.minimo ||
                      "Mín."
                    } - ${
                      formulario.maximo ||
                      "Máx."
                    } ${
                      parametro?.unidad ||
                      ""
                    }`
                  : formulario.textoReferencia ||
                    "Valor cualitativo"}
              </strong>

              <small>
                {
                  parametro?.nombre ||
                  "Parámetro"
                }
              </small>

            </div>

          </div>


          {/* BOTONES */}

          {puedeEditar && (
            <div className="rr-actions">

              {existeRango && (
                <button
                  type="button"
                  className="rr-delete-button"
                  onClick={
                    eliminarRango
                  }
                  disabled={
                    eliminando ||
                    guardando
                  }
                >
                  {eliminando
                    ? "Eliminando..."
                    : "Eliminar rango"}
                </button>
              )}


              <div className="rr-actions-right">

                <button
                  type="button"
                  className="rr-secondary-button"
                  onClick={() => {

                    if (
                      typeof volver ===
                      "function"
                    ) {
                      volver();
                    }
                  }}
                  disabled={
                    guardando ||
                    eliminando
                  }
                >
                  Cancelar
                </button>


                <button
                  type="submit"
                  className="rr-primary-button"
                  disabled={
                    guardando ||
                    eliminando
                  }
                >
                  {guardando
                    ? "Guardando..."
                    : existeRango
                      ? "Guardar cambios"
                      : "Guardar rango"}
                </button>

              </div>

            </div>
          )}

        </form>

      </section>

    </main>
  );
}


export default RangosReferencia;