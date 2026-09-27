import { useEffect, useState } from "react";

import {
  guardarConfiguracionAnalisis,
  obtenerConfiguracionAnalisis,
} from "../services/configuracionAnalisisService";

import "./ConfiguracionAnalisis.css";


const formularioInicial = {
  tipoMuestra: "",
  preparacionPaciente: "",
  requiereAyuno: false,
  horasAyuno: "",
  tiempoEntrega: "",
  instrucciones: "",
};


function ConfiguracionAnalisis({
  analisis,
  usuario,
  volver,
}) {
  const [formulario, setFormulario] =
    useState(formularioInicial);

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState(null);


  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        setCargando(true);
        setMensaje(null);

        if (!analisis?.id) {
          throw new Error(
            "No se pudo identificar el análisis seleccionado."
          );
        }

        if (!usuario?.laboratorioId) {
          throw new Error(
            "No se pudo identificar el laboratorio."
          );
        }

        const resultado =
          await obtenerConfiguracionAnalisis(
            analisis.id,
            usuario.laboratorioId
          );

        setFormulario({
          tipoMuestra:
            resultado?.tipoMuestra || "",
          preparacionPaciente:
            resultado?.preparacionPaciente || "",
          requiereAyuno:
            resultado?.requiereAyuno === true,
          horasAyuno:
            resultado?.requiereAyuno
              ? String(resultado?.horasAyuno || "")
              : "",
          tiempoEntrega:
            resultado?.tiempoEntrega || "",
          instrucciones:
            resultado?.instrucciones || "",
        });
      } catch (error) {
        console.error(
          "Error cargando configuración del análisis:",
          error
        );

        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo cargar la configuración del análisis.",
        });
      } finally {
        setCargando(false);
      }
    };

    cargarConfiguracion();
  }, [
    analisis?.id,
    usuario?.laboratorioId,
  ]);


  useEffect(() => {
    if (!mensaje) return;

    const temporizador = window.setTimeout(
      () => setMensaje(null),
      5000
    );

    return () =>
      window.clearTimeout(temporizador);
  }, [mensaje]);


  const manejarCambio = (evento) => {
    const {
      name,
      value,
      type,
      checked,
    } = evento.target;

    setFormulario((actual) => ({
      ...actual,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    if (
      name === "requiereAyuno" &&
      !checked
    ) {
      setFormulario((actual) => ({
        ...actual,
        requiereAyuno: false,
        horasAyuno: "",
      }));
    }
  };


  const validarFormulario = () => {
    if (!formulario.tipoMuestra.trim()) {
      return "El tipo de muestra es obligatorio.";
    }

    if (!formulario.tiempoEntrega.trim()) {
      return "El tiempo de entrega es obligatorio.";
    }

    if (formulario.requiereAyuno) {
      const horas = Number(
        formulario.horasAyuno
      );

      if (
        formulario.horasAyuno === "" ||
        Number.isNaN(horas) ||
        horas <= 0 ||
        horas > 48
      ) {
        return "Las horas de ayuno deben ser mayores a 0 y menores o iguales a 48.";
      }
    }

    return "";
  };


  const guardar = async (evento) => {
    evento.preventDefault();
    setMensaje(null);

    const error = validarFormulario();

    if (error) {
      setMensaje({
        tipo: "error",
        texto: error,
      });
      return;
    }

    try {
      setGuardando(true);

      await guardarConfiguracionAnalisis(
        analisis.id,
        usuario.laboratorioId,
        {
          tipoMuestra:
            formulario.tipoMuestra,
          preparacionPaciente:
            formulario.preparacionPaciente,
          requiereAyuno:
            formulario.requiereAyuno,
          horasAyuno:
            formulario.requiereAyuno
              ? Number(formulario.horasAyuno)
              : 0,
          tiempoEntrega:
            formulario.tiempoEntrega,
          instrucciones:
            formulario.instrucciones,
        }
      );

      setMensaje({
        tipo: "exito",
        texto:
          "Configuración guardada correctamente.",
      });
    } catch (error) {
      console.error(
        "Error guardando configuración:",
        error
      );

      setMensaje({
        tipo: "error",
        texto:
          error?.message ||
          "No se pudo guardar la configuración.",
      });
    } finally {
      setGuardando(false);
    }
  };


  if (cargando) {
    return (
      <main className="ca-page ca-loading-page">
        <div className="ca-loading-card">
          <div className="ca-spinner" />
          <h2>Configuración del análisis</h2>
          <p>Cargando configuración...</p>
        </div>
      </main>
    );
  }


  return (
    <main className="ca-page">
      <div className="ca-container">
        <button
          type="button"
          className="ca-back-button"
          onClick={() => {
            if (typeof volver === "function") {
              volver();
            }
          }}
        >
          ← Volver a análisis
        </button>

        <header className="ca-header">
          <div>
            <span className="ca-eyebrow">
              CONFIGURACIÓN
            </span>

            <h1>
              Configuración del análisis
            </h1>

            <p>
              Define la información necesaria para el procesamiento del análisis seleccionado.
            </p>
          </div>

          <div className="ca-header-icon">
            ⚙️
          </div>
        </header>

        <section className="ca-analysis-card">
          <div className="ca-analysis-icon">
            🔬
          </div>

          <div>
            <span>ANÁLISIS SELECCIONADO</span>
            <h2>{analisis?.nombre}</h2>
            <p>
              {analisis?.tipo || "Sin tipo"} · Bs{" "}
              {Number(
                analisis?.precio || 0
              ).toFixed(2)}
            </p>
          </div>
        </section>

        {mensaje && (
          <div
            className={`ca-message ${
              mensaje.tipo === "error"
                ? "ca-message-error"
                : "ca-message-success"
            }`}
          >
            <span>
              {mensaje.tipo === "error"
                ? "!"
                : "✓"}
            </span>

            {mensaje.texto}
          </div>
        )}

        <form
          className="ca-form-card"
          onSubmit={guardar}
        >
          <div className="ca-section-title">
            <div className="ca-section-icon">
              🧪
            </div>

            <div>
              <h3>
                Procesamiento y preparación
              </h3>
              <p>
                Configura los datos operativos del análisis.
              </p>
            </div>
          </div>

          <div className="ca-grid">
            <Campo
              label="Tipo de muestra"
              obligatorio
            >
              <select
                name="tipoMuestra"
                value={formulario.tipoMuestra}
                onChange={manejarCambio}
                disabled={guardando}
              >
                <option value="">
                  Seleccionar
                </option>
                <option value="Sangre">
                  Sangre
                </option>
                <option value="Orina">
                  Orina
                </option>
                <option value="Heces">
                  Heces
                </option>
                <option value="Suero">
                  Suero
                </option>
                <option value="Plasma">
                  Plasma
                </option>
                <option value="Saliva">
                  Saliva
                </option>
                <option value="Hisopado">
                  Hisopado
                </option>
                <option value="Otro">
                  Otro
                </option>
              </select>
            </Campo>

            <Campo
              label="Tiempo de entrega"
              obligatorio
            >
              <input
                type="text"
                name="tiempoEntrega"
                value={formulario.tiempoEntrega}
                onChange={manejarCambio}
                maxLength="80"
                placeholder="Ej. 24 horas"
                disabled={guardando}
              />
            </Campo>

            <Campo
              label="Preparación del paciente"
              full
            >
              <textarea
                name="preparacionPaciente"
                value={
                  formulario.preparacionPaciente
                }
                onChange={manejarCambio}
                rows="4"
                maxLength="500"
                placeholder="Ej. Evitar ejercicio intenso antes de la toma de muestra."
                disabled={guardando}
              />
            </Campo>

            <div className="ca-field ca-field-full">
              <label className="ca-field-label">
                Ayuno
              </label>

              <label className="ca-switch-row">
                <input
                  type="checkbox"
                  name="requiereAyuno"
                  checked={
                    formulario.requiereAyuno
                  }
                  onChange={manejarCambio}
                  disabled={guardando}
                />

                <span
                  className={`ca-switch ${
                    formulario.requiereAyuno
                      ? "ca-switch-on"
                      : ""
                  }`}
                >
                  <span />
                </span>

                <strong>
                  {formulario.requiereAyuno
                    ? "Requiere ayuno"
                    : "No requiere ayuno"}
                </strong>
              </label>
            </div>

            {formulario.requiereAyuno && (
              <Campo
                label="Horas de ayuno"
                obligatorio
              >
                <input
                  type="number"
                  name="horasAyuno"
                  value={formulario.horasAyuno}
                  onChange={manejarCambio}
                  min="1"
                  max="48"
                  step="1"
                  placeholder="Ej. 8"
                  disabled={guardando}
                />
              </Campo>
            )}

            <Campo
              label="Instrucciones adicionales"
              full
            >
              <textarea
                name="instrucciones"
                value={formulario.instrucciones}
                onChange={manejarCambio}
                rows="5"
                maxLength="700"
                placeholder="Ej. Presentarse por la mañana y traer la orden médica cuando corresponda."
                disabled={guardando}
              />
            </Campo>
          </div>

          <div className="ca-actions">
            <button
              type="button"
              className="ca-secondary-button"
              onClick={() => {
                if (typeof volver === "function") {
                  volver();
                }
              }}
              disabled={guardando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="ca-primary-button"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : "Guardar configuración"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}


function Campo({
  label,
  obligatorio = false,
  full = false,
  children,
}) {
  return (
    <div
      className={`ca-field ${
        full ? "ca-field-full" : ""
      }`}
    >
      <label className="ca-field-label">
        {label}
        {obligatorio && (
          <span className="ca-required">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}


export default ConfiguracionAnalisis;
