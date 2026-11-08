import { useEffect, useRef, useState } from "react";

import {
  obtenerConfiguracionQR,
  guardarImagenQR,
  eliminarImagenQR,
} from "../services/pagosQRService";

import "./ConfiguracionPagosQR.css";

const MAX_MB = 2;

export default function ConfiguracionPagosQR() {
  const inputRef = useRef(null);

  const [configuracion, setConfiguracion] = useState({
    laboratorioId: "",
    nombre: "",
    qrUrl: "",
  });

  const [archivo, setArchivo] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const [mensaje, setMensaje] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const qrActual = configuracion.qrUrl;
  const imagenMostrada = vistaPrevia || qrActual;

  // =====================================================
  // CARGAR CONFIGURACIÓN
  // =====================================================

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        setCargando(true);

        const datos = await obtenerConfiguracionQR();

        if (!activo) return;

        setConfiguracion(datos);
      } catch (error) {
        if (!activo) return;

        setMensaje({
          tipo: "error",
          texto:
            error.message ||
            "No se pudo cargar la configuración QR.",
        });
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  // =====================================================
  // LIMPIAR VISTA PREVIA
  // =====================================================

  useEffect(() => {
    return () => {
      if (vistaPrevia) {
        URL.revokeObjectURL(vistaPrevia);
      }
    };
  }, [vistaPrevia]);

  // =====================================================
  // MENSAJES
  // =====================================================

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
  };

  // =====================================================
  // SELECCIONAR IMAGEN
  // =====================================================

  const seleccionarImagen = (evento) => {
    const imagen = evento.target.files?.[0];

    if (!imagen) return;

    setMensaje(null);

    if (
      !["image/png", "image/jpeg"].includes(imagen.type)
    ) {
      mostrarMensaje(
        "error",
        "Solo se permiten imágenes PNG o JPG."
      );

      evento.target.value = "";
      return;
    }

    if (imagen.size > MAX_MB * 1024 * 1024) {
      mostrarMensaje(
        "error",
        `La imagen no puede superar los ${MAX_MB} MB.`
      );

      evento.target.value = "";
      return;
    }

    const urlTemporal = URL.createObjectURL(imagen);

    setArchivo(imagen);
    setVistaPrevia(urlTemporal);
  };

  // =====================================================
  // CANCELAR SELECCIÓN
  // =====================================================

  const cancelarSeleccion = () => {
    setArchivo(null);
    setVistaPrevia("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setMensaje(null);
  };

  // =====================================================
  // GUARDAR QR
  // =====================================================

  const guardarQR = async () => {
    if (!archivo || guardando || eliminando) return;

    try {
      setGuardando(true);
      setMensaje(null);

      const url = await guardarImagenQR(archivo);

      setConfiguracion((anterior) => ({
        ...anterior,
        qrUrl: url,
      }));

      setArchivo(null);
      setVistaPrevia("");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      mostrarMensaje(
        "exito",
        "El código QR se guardó correctamente. Ya está disponible para Recepción."
      );
    } catch (error) {
      console.error("Error guardando QR:", error);

      mostrarMensaje(
        "error",
        error.message ||
          "No se pudo guardar el código QR."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =====================================================
  // ELIMINAR QR
  // =====================================================

  const quitarQR = async () => {
    if (eliminando || guardando) return;

    try {
      setEliminando(true);
      setMensaje(null);

      await eliminarImagenQR();

      setConfiguracion((anterior) => ({
        ...anterior,
        qrUrl: "",
      }));

      setArchivo(null);
      setVistaPrevia("");
      setConfirmarEliminar(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      mostrarMensaje(
        "exito",
        "El código QR fue retirado de la configuración de pagos."
      );
    } catch (error) {
      console.error("Error quitando QR:", error);

      mostrarMensaje(
        "error",
        error.message ||
          "No se pudo quitar el código QR."
      );
    } finally {
      setEliminando(false);
    }
  };

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <section className="pagosqr">
      {/* ENCABEZADO */}

      <div className="pagosqr-header">
        <div className="pagosqr-header-icon">
          <span>▦</span>
        </div>

        <div className="pagosqr-header-info">
          <span className="pagosqr-eyebrow">
            ADMINISTRACIÓN DE PAGOS
          </span>

          <h2>Configuración de pagos QR</h2>

          <p>
            Administra el código QR que utilizará
            Recepción para procesar los pagos de
            los pacientes.
          </p>
        </div>

        <span
          className={`pagosqr-status ${
            qrActual ? "activo" : "inactivo"
          }`}
        >
          <span className="pagosqr-status-dot" />

          {qrActual
            ? "QR configurado"
            : "Sin configurar"}
        </span>
      </div>

      {/* MENSAJES */}

      {mensaje && (
        <div
          className={`pagosqr-alert pagosqr-alert-${mensaje.tipo}`}
          role="alert"
        >
          <span className="pagosqr-alert-icon">
            {mensaje.tipo === "exito" ? "✓" : "!"}
          </span>

          <span>{mensaje.texto}</span>

          <button
            type="button"
            onClick={() => setMensaje(null)}
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {cargando ? (
        <div className="pagosqr-loading">
          <div className="pagosqr-spinner" />

          <h3>Cargando configuración</h3>

          <p>
            Consultando la información de pagos
            del laboratorio...
          </p>
        </div>
      ) : (
        <>
          {/* INFORMACIÓN DEL LABORATORIO */}

          <div className="pagosqr-laboratorio">
            <div className="pagosqr-laboratorio-icon">
              +
            </div>

            <div>
              <span>LABORATORIO ASOCIADO</span>

              <h3>
                {configuracion.nombre ||
                  "Laboratorio Clínico"}
              </h3>

              <p>
                La configuración pertenece
                exclusivamente a este laboratorio.
              </p>
            </div>

            <span className="pagosqr-badge">
              Administrador
            </span>
          </div>

          {/* CONTENIDO PRINCIPAL */}

          <div className="pagosqr-grid">
            {/* VISTA PREVIA */}

            <div className="pagosqr-preview-card">
              <div className="pagosqr-card-heading">
                <div>
                  <h3>Vista previa del QR</h3>

                  <p>
                    Imagen que visualizará
                    el personal de Recepción.
                  </p>
                </div>
              </div>

              <div className="pagosqr-preview">
                {imagenMostrada ? (
                  <img
                    src={imagenMostrada}
                    alt="Código QR para pagos"
                    className="pagosqr-image"
                  />
                ) : (
                  <div className="pagosqr-empty">
                    <div className="pagosqr-empty-icon">
                      ▦
                    </div>

                    <h4>No hay un QR registrado</h4>

                    <p>
                      Sube una imagen para
                      habilitar los pagos QR.
                    </p>
                  </div>
                )}
              </div>

              <div className="pagosqr-preview-footer">
                <span
                  className={`pagosqr-indicator ${
                    qrActual ? "activo" : ""
                  }`}
                >
                  ●
                </span>

                <span>
                  {archivo
                    ? "Vista previa de la nueva imagen"
                    : qrActual
                      ? "Código QR actualmente registrado"
                      : "Esperando configuración"}
                </span>
              </div>
            </div>

            {/* CONFIGURACIÓN */}

            <div className="pagosqr-form-card">
              <div className="pagosqr-card-heading">
                <div>
                  <h3>
                    {qrActual
                      ? "Actualizar código QR"
                      : "Registrar código QR"}
                  </h3>

                  <p>
                    Selecciona la imagen del
                    QR bancario de tu laboratorio.
                  </p>
                </div>
              </div>

              {/* SUBIR ARCHIVO */}

              <div className="pagosqr-upload">
                <div className="pagosqr-upload-icon">
                  ↑
                </div>

                <h4>Seleccionar imagen QR</h4>

                <p>
                  Puedes utilizar una imagen
                  PNG o JPG.
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={seleccionarImagen}
                  disabled={guardando || eliminando}
                  className="pagosqr-file-input"
                  id="pagosqr-archivo"
                />

                <label
                  htmlFor="pagosqr-archivo"
                  className="pagosqr-select-button"
                >
                  Examinar archivos
                </label>

                <small>
                  Tamaño máximo permitido: 2 MB
                </small>
              </div>

              {/* ARCHIVO SELECCIONADO */}

              {archivo && (
                <div className="pagosqr-selected">
                  <div className="pagosqr-selected-icon">
                    ▣
                  </div>

                  <div className="pagosqr-selected-info">
                    <strong>{archivo.name}</strong>

                    <span>
                      {(archivo.size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={cancelarSeleccion}
                    disabled={guardando}
                    title="Cancelar selección"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* ACCIONES */}

              <div className="pagosqr-actions">
                <button
                  type="button"
                  className="pagosqr-primary-button"
                  onClick={guardarQR}
                  disabled={
                    !archivo ||
                    guardando ||
                    eliminando
                  }
                >
                  {guardando
                    ? "Guardando imagen..."
                    : qrActual
                      ? "Actualizar código QR"
                      : "Guardar código QR"}
                </button>

                {qrActual && (
                  <button
                    type="button"
                    className="pagosqr-danger-button"
                    onClick={() =>
                      setConfirmarEliminar(true)
                    }
                    disabled={guardando || eliminando}
                  >
                    Quitar QR
                  </button>
                )}
              </div>

              {/* INFORMACIÓN */}

              <div className="pagosqr-info">
                <div className="pagosqr-info-icon">
                  i
                </div>

                <div>
                  <strong>
                    ¿Dónde aparecerá este QR?
                  </strong>

                  <p>
                    Cuando la Recepcionista
                    seleccione el método de pago
                    QR en Gestión de ventas,
                    podrá mostrar esta imagen
                    al paciente.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SEGURIDAD */}

          <div className="pagosqr-security">
            <div className="pagosqr-security-icon">
              ✓
            </div>

            <div>
              <strong>
                Configuración protegida por laboratorio
              </strong>

              <p>
                Únicamente el Administrador autorizado
                puede modificar el código QR de su
                laboratorio. Los demás usuarios
                solamente podrán visualizarlo
                cuando corresponda.
              </p>
            </div>
          </div>
        </>
      )}

      {/* MODAL DE CONFIRMACIÓN */}

      {confirmarEliminar && (
        <div
          className="pagosqr-modal-overlay"
          onClick={() => {
            if (!eliminando) {
              setConfirmarEliminar(false);
            }
          }}
        >
          <div
            className="pagosqr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pagosqr-modal-title"
            onClick={(evento) =>
              evento.stopPropagation()
            }
          >
            <div className="pagosqr-modal-icon">
              !
            </div>

            <h3 id="pagosqr-modal-title">
              ¿Quitar código QR?
            </h3>

            <p>
              El código QR dejará de estar
              disponible para las nuevas ventas
              hasta que registres otro.
            </p>

            <div className="pagosqr-modal-actions">
              <button
                type="button"
                className="pagosqr-cancel-button"
                onClick={() =>
                  setConfirmarEliminar(false)
                }
                disabled={eliminando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="pagosqr-confirm-button"
                onClick={quitarQR}
                disabled={eliminando}
              >
                {eliminando
                  ? "Quitando..."
                  : "Sí, quitar QR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}