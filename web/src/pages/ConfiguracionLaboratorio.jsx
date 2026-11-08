import { useEffect, useState } from "react";

import {
  actualizarConfiguracionLaboratorio,
  obtenerLaboratorio,
} from "../services/configuracionLaboratorioService";

import ConfiguracionPagosQR from "./ConfiguracionPagosQR";

import "./ConfiguracionLaboratorio.css";

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

function ConfiguracionLaboratorio({ usuario, volver }) {
  // =====================================================
  // LABORATORIO
  // =====================================================

  const [laboratorio, setLaboratorio] = useState(null);

  // =====================================================
  // FORMULARIO
  // =====================================================

  const [formulario, setFormulario] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
  });

  // =====================================================
  // ESTADOS
  // =====================================================

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // =====================================================
  // MODALES
  // =====================================================

  const [mostrarVer, setMostrarVer] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  // =====================================================
  // MENSAJES
  // =====================================================

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({
      tipo,
      texto,
    });

    window.setTimeout(() => {
      setMensaje(null);
    }, 3500);
  };

  // =====================================================
  // CARGAR LABORATORIO
  // =====================================================

  const cargarLaboratorio = async () => {
    try {
      setCargando(true);

      const datos = await obtenerLaboratorio();

      setLaboratorio(datos);

      setFormulario({
        nombre: datos.nombre || "",
        direccion: datos.direccion || "",
        telefono: datos.telefono || "",
        email: datos.email || "",
      });
    } catch (error) {
      console.error(
        "Error al cargar configuración:",
        error
      );

      mostrarMensaje(
        "error",
        error?.message ||
          "No se pudo cargar la información del laboratorio."
      );
    } finally {
      setCargando(false);
    }
  };

  // =====================================================
  // CARGAR AL INICIAR
  // =====================================================

  useEffect(() => {
    if (usuario?.rol === "administrador") {
      cargarLaboratorio();
    } else {
      setCargando(false);
    }
  }, [usuario?.rol, usuario?.laboratorioId]);

  // =====================================================
  // CAMBIAR CAMPOS
  // =====================================================

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  // =====================================================
  // INICIAR EDICIÓN
  // =====================================================

  const iniciarEdicion = () => {
    if (!laboratorio) {
      return;
    }

    setFormulario({
      nombre: laboratorio.nombre || "",
      direccion: laboratorio.direccion || "",
      telefono: laboratorio.telefono || "",
      email: laboratorio.email || "",
    });

    setEditando(true);
    setMensaje(null);
  };

  // =====================================================
  // CANCELAR EDICIÓN
  // =====================================================

  const cancelarEdicion = () => {
    if (laboratorio) {
      setFormulario({
        nombre: laboratorio.nombre || "",
        direccion: laboratorio.direccion || "",
        telefono: laboratorio.telefono || "",
        email: laboratorio.email || "",
      });
    }

    setEditando(false);
  };

  // =====================================================
  // VALIDAR FORMULARIO
  // =====================================================

  const validarFormulario = () => {
    if (formulario.nombre.trim() === "") {
      return "Ingrese el nombre del laboratorio.";
    }

    if (formulario.direccion.trim() === "") {
      return "Ingrese la dirección.";
    }

    if (formulario.telefono.trim() === "") {
      return "Ingrese el teléfono.";
    }

    if (formulario.email.trim() === "") {
      return "Ingrese el correo electrónico.";
    }

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!correoValido.test(formulario.email.trim())) {
      return "Ingrese un correo electrónico válido.";
    }

    return "";
  };

  // =====================================================
  // GUARDAR CONFIGURACIÓN
  // =====================================================

  const guardar = async (evento) => {
    evento.preventDefault();

    const errorValidacion = validarFormulario();

    if (errorValidacion) {
      mostrarMensaje("error", errorValidacion);
      return;
    }

    try {
      setGuardando(true);

      await actualizarConfiguracionLaboratorio({
        nombre: formulario.nombre.trim(),
        direccion: formulario.direccion.trim(),
        telefono: formulario.telefono.trim(),
        email: formulario.email.trim(),
      });

      await cargarLaboratorio();

      setEditando(false);

      mostrarMensaje(
        "exito",
        "La información del laboratorio fue actualizada correctamente."
      );
    } catch (error) {
      console.error(
        "Error actualizando laboratorio:",
        error
      );

      if (error?.code === "permission-denied") {
        mostrarMensaje(
          "error",
          "No tiene permisos para modificar este laboratorio."
        );
      } else {
        mostrarMensaje(
          "error",
          error?.message ||
            "No se pudo actualizar el laboratorio."
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  // =====================================================
  // FORMATEAR FECHA
  // =====================================================

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "No registrada";
    }

    try {
      if (typeof fecha.toDate === "function") {
        return fecha.toDate().toLocaleString("es-BO");
      }

      if (fecha.seconds) {
        return new Date(
          fecha.seconds * 1000
        ).toLocaleString("es-BO");
      }

      const fechaConvertida = new Date(fecha);

      if (Number.isNaN(fechaConvertida.getTime())) {
        return "No registrada";
      }

      return fechaConvertida.toLocaleString("es-BO");
    } catch {
      return "No registrada";
    }
  };

  // =====================================================
  // SOLO ADMINISTRADOR
  // =====================================================

  if (usuario?.rol !== "administrador") {
    return (
      <main className="config-page">
        <section className="config-access">
          <div className="config-access-icon">
            🔒
          </div>

          <h1>Acceso restringido</h1>

          <p>
            La configuración general del laboratorio
            corresponde únicamente al Administrador
            del Laboratorio.
          </p>

          <button
            type="button"
            className="config-primary"
            onClick={volver}
          >
            ← Volver
          </button>
        </section>
      </main>
    );
  }

  // =====================================================
  // CARGANDO
  // =====================================================

  if (cargando) {
    return (
      <main className="config-page">
        <section className="config-loading">
          <div className="config-spinner" />

          <h2>Cargando laboratorio</h2>

          <p>
            Obteniendo información institucional...
          </p>
        </section>
      </main>
    );
  }

  // =====================================================
  // LABORATORIO NO DISPONIBLE
  // =====================================================

  if (!laboratorio) {
    return (
      <main className="config-page">
        <section className="config-access">
          <div className="config-access-icon warning">
            ⚠️
          </div>

          <h1>Laboratorio no disponible</h1>

          <p>
            No se encontró el laboratorio asociado
            a este Administrador.
          </p>

          <button
            type="button"
            className="config-primary"
            onClick={volver}
          >
            ← Volver
          </button>
        </section>
      </main>
    );
  }

  // =====================================================
  // INTERFAZ PRINCIPAL
  // =====================================================

  return (
    <main className="config-page">
      {/* =================================================
          ENCABEZADO
      ================================================= */}

      <header className="config-header">
        <div>
          <button
            type="button"
            className="config-back"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <span className="config-eyebrow">
            HU-05 · ADMINISTRACIÓN
          </span>

          <h1>Configuración del laboratorio</h1>

          <p>
            Mantén actualizados los datos
            institucionales del laboratorio
            al que pertenece tu cuenta.
          </p>
        </div>

        {!editando && (
          <button
            type="button"
            className="config-primary"
            onClick={iniciarEdicion}
          >
            ✎ Editar información
          </button>
        )}
      </header>

      {/* =================================================
          MENSAJES
      ================================================= */}

      {mensaje && (
        <div
          className={`config-message ${mensaje.tipo}`}
          role="alert"
        >
          <span>
            {mensaje.tipo === "exito" ? "✓" : "!"}
          </span>

          {mensaje.texto}
        </div>
      )}

      {/* =================================================
          AVISO DE SEGURIDAD
      ================================================= */}

      <section className="config-security">
        <div className="config-security-icon">
          🛡️
        </div>

        <div>
          <strong>
            Configuración protegida por laboratorio
          </strong>

          <p>
            Solo puedes consultar y modificar el
            laboratorio vinculado a tu cuenta.
            No puedes seleccionar otro laboratorio.
          </p>
        </div>
      </section>

      {/* =================================================
          TARJETA PRINCIPAL
      ================================================= */}

      <section className="config-card">
        {/* ENCABEZADO DEL LABORATORIO */}

        <div className="config-card-header">
          <div className="config-lab-title">
            <div className="config-lab-icon">
              {laboratorio.logoUrl ? (
                <img
                  src={laboratorio.logoUrl}
                  alt="Logo"
                  onError={(evento) => {
                    evento.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <span>🏥</span>
              )}
            </div>

            <div>
              <span>LABORATORIO ASIGNADO</span>

              <h2>{laboratorio.nombre}</h2>

              <small>
                ID: {laboratorio.laboratorioId}
              </small>
            </div>
          </div>

          <span
            className={
              laboratorio.activo
                ? "config-status active"
                : "config-status inactive"
            }
          >
            ● {laboratorio.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        {/* =================================================
            ACCIONES
        ================================================= */}

        <div className="config-actions-bar">
          <button
            type="button"
            className="config-action view"
            onClick={() => setMostrarVer(true)}
          >
            👁 Ver
          </button>

          <button
            type="button"
            className="config-action detail"
            onClick={() => setMostrarDetalle(true)}
          >
            📄 Ver detalle
          </button>

          {!editando && (
            <button
              type="button"
              className="config-action edit"
              onClick={iniciarEdicion}
            >
              ✎ Editar
            </button>
          )}
        </div>

        {/* =================================================
            FORMULARIO
        ================================================= */}

        <form
          className="config-form"
          onSubmit={guardar}
        >
          {/* NOMBRE */}

          <div className="config-field">
            <label htmlFor="config-nombre">
              Nombre del laboratorio
            </label>

            <input
              id="config-nombre"
              type="text"
              name="nombre"
              value={formulario.nombre}
              onChange={manejarCambio}
              disabled={!editando}
              placeholder="Nombre del laboratorio"
            />
          </div>

          {/* DIRECCIÓN */}

          <div className="config-field">
            <label htmlFor="config-direccion">
              Dirección
            </label>

            <input
              id="config-direccion"
              type="text"
              name="direccion"
              value={formulario.direccion}
              onChange={manejarCambio}
              disabled={!editando}
              placeholder="Dirección"
            />
          </div>

          {/* TELÉFONO */}

          <div className="config-field">
            <label htmlFor="config-telefono">
              Teléfono
            </label>

            <input
              id="config-telefono"
              type="text"
              name="telefono"
              value={formulario.telefono}
              onChange={manejarCambio}
              disabled={!editando}
              placeholder="Teléfono"
            />
          </div>

          {/* CORREO */}

          <div className="config-field">
            <label htmlFor="config-email">
              Correo electrónico
            </label>

            <input
              id="config-email"
              type="email"
              name="email"
              value={formulario.email}
              onChange={manejarCambio}
              disabled={!editando}
              placeholder="correo@laboratorio.com"
            />
          </div>

          {/* =================================================
              LABORATORIO ID
              SOLO LECTURA
          ================================================= */}

          <div className="config-field config-full">
            <label>Laboratorio ID</label>

            <div className="config-readonly">
              🔒 {laboratorio.laboratorioId}
            </div>

            <small>
              Este identificador no puede modificarse.
            </small>
          </div>

          {/* =================================================
              BOTONES DE EDICIÓN
          ================================================= */}

          {editando && (
            <div className="config-form-actions">
              <button
                type="button"
                className="config-secondary"
                onClick={cancelarEdicion}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="config-primary"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* =================================================
          PERSONALIZACIÓN DEL LABORATORIO
          SOLO LECTURA
      ================================================= */}

      <section className="config-visual-card">
        <div className="config-visual-header">
          <div>
            <span>IDENTIDAD VISUAL</span>

            <h2>
              Personalización del laboratorio
            </h2>

            <p>
              Esta información es definida por el
              Super Administrador y no puede ser
              modificada desde esta pantalla.
            </p>
          </div>

          <div className="config-lock">
            🔒
          </div>
        </div>

        <div className="config-visual-grid">
          <VisualItem
            titulo="Nombre visible"
            valor={
              laboratorio.nombreVisible ||
              "No configurado"
            }
          />

          <VisualItem
            titulo="Logo"
            valor={
              laboratorio.logoUrl
                ? "Configurado"
                : "No configurado"
            }
          />

          <VisualItem
            titulo="Color principal"
            valor={
              laboratorio.colorPrimario ||
              "No configurado"
            }
          />

          <VisualItem
            titulo="Color secundario"
            valor={
              laboratorio.colorSecundario ||
              "No configurado"
            }
          />
        </div>
      </section>

      {/* =================================================
          NUEVO MÓDULO
          CONFIGURACIÓN DE PAGOS QR
      ================================================= */}

      <ConfiguracionPagosQR />

      {/* =================================================
          MODAL VER
      ================================================= */}

      {mostrarVer && (
        <div className="config-modal-overlay">
          <section className="config-modal small">
            <div className="config-modal-header">
              <div>
                <span>VISTA RÁPIDA</span>

                <h2>Laboratorio</h2>
              </div>

              <button
                type="button"
                className="config-close"
                onClick={() => setMostrarVer(false)}
              >
                ×
              </button>
            </div>

            <div className="config-quick">
              <div className="config-quick-icon">
                🏥
              </div>

              <h3>{laboratorio.nombre}</h3>

              <p>{laboratorio.email}</p>

              <span
                className={
                  laboratorio.activo
                    ? "config-status active"
                    : "config-status inactive"
                }
              >
                ●{" "}
                {laboratorio.activo
                  ? "Activo"
                  : "Inactivo"}
              </span>

              <div className="config-quick-data">
                <p>
                  📍 {laboratorio.direccion}
                </p>

                <p>
                  ☎ {laboratorio.telefono}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="config-primary full"
              onClick={() => setMostrarVer(false)}
            >
              Cerrar
            </button>
          </section>
        </div>
      )}

      {/* =================================================
          MODAL VER DETALLE
      ================================================= */}

      {mostrarDetalle && (
        <div className="config-modal-overlay">
          <section className="config-modal">
            <div className="config-modal-header">
              <div>
                <span>INFORMACIÓN COMPLETA</span>

                <h2>
                  Detalle del laboratorio
                </h2>
              </div>

              <button
                type="button"
                className="config-close"
                onClick={() => setMostrarDetalle(false)}
              >
                ×
              </button>
            </div>

            <div className="config-detail-grid">
              <Detalle
                titulo="Nombre"
                valor={laboratorio.nombre}
              />

              <Detalle
                titulo="Correo"
                valor={laboratorio.email}
              />

              <Detalle
                titulo="Teléfono"
                valor={laboratorio.telefono}
              />

              <Detalle
                titulo="Estado"
                valor={
                  laboratorio.activo
                    ? "Activo"
                    : "Inactivo"
                }
              />

              <Detalle
                titulo="Dirección"
                valor={laboratorio.direccion}
                completo
              />

              <Detalle
                titulo="Fecha de registro"
                valor={formatearFecha(
                  laboratorio.fechaRegistro
                )}
              />

              <Detalle
                titulo="Laboratorio ID"
                valor={laboratorio.laboratorioId}
                completo
              />
            </div>

            {/* PERSONALIZACIÓN HEREDADA */}

            <div className="config-detail-visual">
              <span>
                PERSONALIZACIÓN HEREDADA
              </span>

              <div className="config-detail-grid">
                <Detalle
                  titulo="Nombre visible"
                  valor={
                    laboratorio.nombreVisible ||
                    "No configurado"
                  }
                />

                <Detalle
                  titulo="Logo"
                  valor={
                    laboratorio.logoUrl
                      ? "Configurado"
                      : "No configurado"
                  }
                />

                <Detalle
                  titulo="Color principal"
                  valor={
                    laboratorio.colorPrimario ||
                    "No configurado"
                  }
                />

                <Detalle
                  titulo="Color secundario"
                  valor={
                    laboratorio.colorSecundario ||
                    "No configurado"
                  }
                />
              </div>
            </div>

            {/* ESTADO DE PAGOS QR */}

            <div className="config-detail-visual">
              <span>
                CONFIGURACIÓN DE PAGOS
              </span>

              <div className="config-detail-grid">
                <Detalle
                  titulo="Método de pago QR"
                  valor={
                    laboratorio.configuracionPagos?.qrUrl
                      ? "Configurado"
                      : "No configurado"
                  }
                />
              </div>
            </div>

            <div className="config-modal-footer">
              <button
                type="button"
                className="config-secondary"
                onClick={() =>
                  setMostrarDetalle(false)
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
// COMPONENTE VISUAL ITEM
// =====================================================

function VisualItem({ titulo, valor }) {
  return (
    <div className="config-visual-item">
      <span>{titulo}</span>

      <strong>{valor}</strong>
    </div>
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
          ? "config-detail-item full"
          : "config-detail-item"
      }
    >
      <span>{titulo}</span>

      <strong>
        {valor || "No registrado"}
      </strong>
    </div>
  );
}

export default ConfiguracionLaboratorio;