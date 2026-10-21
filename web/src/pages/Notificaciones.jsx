import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  TIPOS_NOTIFICACION,
} from "../services/notificacionesService";

import "./Notificaciones.css";

const TIPOS = {
  [TIPOS_NOTIFICACION.MUESTRA_REGISTRADA]: {
    icono: "🧪",
    etiqueta: "Muestra registrada",
    clase: "muestra",
  },
  [TIPOS_NOTIFICACION.MUESTRA_ACEPTADA]: {
    icono: "✓",
    etiqueta: "Muestra aceptada",
    clase: "aceptada",
  },
  [TIPOS_NOTIFICACION.MUESTRA_RECHAZADA]: {
    icono: "!",
    etiqueta: "Muestra rechazada",
    clase: "rechazada",
  },
  [TIPOS_NOTIFICACION.MUESTRA_PROCESADA]: {
    icono: "⚙",
    etiqueta: "Muestra procesada",
    clase: "procesada",
  },
  [TIPOS_NOTIFICACION.RESULTADO_REGISTRADO]: {
    icono: "📋",
    etiqueta: "Resultado registrado",
    clase: "resultado",
  },
  [TIPOS_NOTIFICACION.RESULTADO_VALIDADO]: {
    icono: "✓",
    etiqueta: "Resultado validado",
    clase: "validada",
  },
  [TIPOS_NOTIFICACION.GENERAL]: {
    icono: "i",
    etiqueta: "General",
    clase: "general",
  },
};

function limpiar(valor) {
  return String(valor ?? "").trim();
}

function obtenerTipo(tipo) {
  return TIPOS[tipo] || TIPOS[TIPOS_NOTIFICACION.GENERAL];
}

function estaLeida(notificacion) {
  return notificacion.leida === true || notificacion.leido === true;
}

function convertirFecha(valor) {
  if (!valor) return null;

  if (typeof valor.toDate === "function") {
    return valor.toDate();
  }

  if (typeof valor.seconds === "number") {
    return new Date(valor.seconds * 1000);
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function obtenerFechaCompleta(valor) {
  const fecha = convertirFecha(valor);

  if (!fecha) return "Fecha no disponible";

  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obtenerFechaRelativa(valor) {
  const fecha = convertirFecha(valor);

  if (!fecha) return "Sin fecha";

  const diferencia = Date.now() - fecha.getTime();

  if (diferencia < 0) {
    return obtenerFechaCompleta(valor);
  }

  const minutos = Math.floor(diferencia / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (minutos < 1) return "Hace un momento";
  if (minutos < 60) return `Hace ${minutos} min`;
  if (horas < 24) return `Hace ${horas} h`;
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;

  return fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return "No tienes permisos de Firestore para consultar o actualizar notificaciones.";
  }

  if (error?.code === "unavailable") {
    return "No se pudo conectar con Firebase. Verifica tu conexión a Internet.";
  }

  return error?.message || "Ocurrió un error inesperado.";
}

export default function Notificaciones({ usuario, onVolver, volver }) {
  const laboratorioId = limpiar(usuario?.laboratorioId);
  const rol = limpiar(usuario?.rol).toLowerCase();

  const esAdministrador = rol === "administrador" && usuario?.activo === true;

  const [notificaciones, setNotificaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [tipoFiltro, setTipoFiltro] = useState("todos");

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [procesandoId, setProcesandoId] = useState("");
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [detalle, setDetalle] = useState(null);

  const cargarNotificaciones = useCallback(
    async (mostrarCarga = false) => {
      if (!laboratorioId || !esAdministrador) {
        setNotificaciones([]);
        setCargando(false);
        setActualizando(false);
        return;
      }

      try {
        if (mostrarCarga) {
          setActualizando(true);
        }

        const datos = await listarNotificaciones(laboratorioId);

        setNotificaciones(Array.isArray(datos) ? datos : []);
        setError("");
      } catch (err) {
        console.error("Error consultando notificaciones:", err);
        setError(obtenerMensajeError(err));
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [laboratorioId, esAdministrador]
  );

  useEffect(() => {
    cargarNotificaciones();

    if (!esAdministrador || !laboratorioId) return undefined;

    const intervalo = setInterval(() => {
      cargarNotificaciones();
    }, 30000);

    return () => clearInterval(intervalo);
  }, [cargarNotificaciones, esAdministrador, laboratorioId]);

  const estadisticas = useMemo(() => {
    const noLeidas = notificaciones.filter((item) => !estaLeida(item));
    const leidas = notificaciones.filter(estaLeida);

    return {
      total: notificaciones.length,
      noLeidas: noLeidas.length,
      leidas: leidas.length,
      recientes: notificaciones.filter((item) => {
        const fecha = convertirFecha(item.fechaCreacion);
        return fecha && Date.now() - fecha.getTime() < 86400000;
      }).length,
    };
  }, [notificaciones]);

  const notificacionesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return notificaciones.filter((item) => {
      const coincideEstado =
        filtro === "todas" ||
        (filtro === "no_leidas" && !estaLeida(item)) ||
        (filtro === "leidas" && estaLeida(item));

      const coincideTipo = tipoFiltro === "todos" || item.tipo === tipoFiltro;

      const contenido = [
        item.titulo,
        item.mensaje,
        item.tipo,
        item.referenciaId,
        item.creadoPorNombre,
      ]
        .map(limpiar)
        .join(" ")
        .toLowerCase();

      return coincideEstado && coincideTipo && contenido.includes(termino);
    });
  }, [notificaciones, busqueda, filtro, tipoFiltro]);

  const marcarLeida = async (notificacion) => {
    if (estaLeida(notificacion) || procesandoId || marcandoTodas) return;

    try {
      setProcesandoId(notificacion.id);
      setError("");
      setMensaje("");

      await marcarNotificacionLeida({
        notificacionId: notificacion.id,
        laboratorioId,
      });

      setNotificaciones((anteriores) =>
        anteriores.map((item) =>
          item.id === notificacion.id
            ? { ...item, leida: true, leido: true }
            : item
        )
      );

      setDetalle((anterior) =>
        anterior?.id === notificacion.id
          ? { ...anterior, leida: true, leido: true }
          : anterior
      );

      setMensaje("Notificación marcada como leída.");
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setProcesandoId("");
    }
  };

  const marcarTodas = async () => {
    if (marcandoTodas || estadisticas.noLeidas === 0) return;

    const confirmar = window.confirm(
      `¿Deseas marcar las ${estadisticas.noLeidas} notificaciones pendientes como leídas?`
    );

    if (!confirmar) return;

    try {
      setMarcandoTodas(true);
      setError("");
      setMensaje("");

      const cantidad = await marcarTodasNotificacionesLeidas(laboratorioId);

      await cargarNotificaciones();

      setMensaje(`${cantidad} notificación(es) marcadas como leídas.`);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setMarcandoTodas(false);
    }
  };

  const actualizar = async () => {
    setMensaje("");
    await cargarNotificaciones(true);
  };

  const abrirDetalle = (notificacion) => {
    setDetalle(notificacion);
  };

  if (!esAdministrador) {
    return (
      <main className="ntf-page">
        <section className="ntf-access-denied">
          <div className="ntf-access-icon">!</div>
          <h2>Acceso restringido</h2>
          <p>
            Este módulo está disponible únicamente para el Administrador activo
            del laboratorio.
          </p>
          {(onVolver || volver) && (
            <button className="ntf-btn ntf-btn-primary" onClick={onVolver || volver}>
              Volver
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="ntf-page">
      <div className="ntf-container">
        <header className="ntf-header">
          <div className="ntf-header-left">
            <div className="ntf-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <span className="ntf-eyebrow">PANEL ADMINISTRATIVO</span>
              <h1>Centro de notificaciones</h1>
              <p>Supervisa los eventos y movimientos de tu laboratorio.</p>
            </div>
          </div>

          <div className="ntf-header-actions">
            {(onVolver || volver) && (
              <button className="ntf-btn ntf-btn-outline" onClick={onVolver || volver}>
                <span aria-hidden="true">←</span> Volver
              </button>
            )}
            <button
              className="ntf-btn ntf-btn-primary"
              onClick={actualizar}
              disabled={actualizando || marcandoTodas}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" />
              </svg>
              {actualizando ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <section className="ntf-stats">
          <article className="ntf-stat-card">
            <div className="ntf-stat-top">
              <span>Total de notificaciones</span>
              <span className="ntf-stat-symbol ntf-symbol-blue">▤</span>
            </div>
            <strong>{estadisticas.total}</strong>
            <small>Actividad registrada</small>
          </article>

          <article className="ntf-stat-card ntf-stat-highlight">
            <div className="ntf-stat-top">
              <span>Pendientes de lectura</span>
              <span className="ntf-stat-symbol ntf-symbol-orange">●</span>
            </div>
            <strong>{estadisticas.noLeidas}</strong>
            <small>Requieren tu atención</small>
          </article>

          <article className="ntf-stat-card">
            <div className="ntf-stat-top">
              <span>Notificaciones leídas</span>
              <span className="ntf-stat-symbol ntf-symbol-green">✓</span>
            </div>
            <strong>{estadisticas.leidas}</strong>
            <small>Eventos revisados</small>
          </article>

          <article className="ntf-stat-card">
            <div className="ntf-stat-top">
              <span>Actividad de hoy</span>
              <span className="ntf-stat-symbol ntf-symbol-purple">◷</span>
            </div>
            <strong>{estadisticas.recientes}</strong>
            <small>Últimas 24 horas</small>
          </article>
        </section>

        {error && (
          <div className="ntf-alert ntf-alert-error" role="alert">
            <span>!</span>
            <p>{error}</p>
            <button onClick={() => setError("")} aria-label="Cerrar error">×</button>
          </div>
        )}

        {mensaje && (
          <div className="ntf-alert ntf-alert-success" role="status">
            <span>✓</span>
            <p>{mensaje}</p>
            <button onClick={() => setMensaje("")} aria-label="Cerrar mensaje">×</button>
          </div>
        )}

        <section className="ntf-panel">
          <div className="ntf-panel-heading">
            <div>
              <span className="ntf-section-label">GESTIÓN DE ACTIVIDAD</span>
              <h2>Bandeja de notificaciones</h2>
              <p>Consulta las novedades registradas en tu laboratorio.</p>
            </div>

            <button
              className="ntf-btn ntf-btn-mark-all"
              onClick={marcarTodas}
              disabled={marcandoTodas || estadisticas.noLeidas === 0 || Boolean(procesandoId)}
            >
              <span aria-hidden="true">✓✓</span>
              {marcandoTodas ? "Marcando..." : "Marcar todas como leídas"}
            </button>
          </div>

          <div className="ntf-toolbar">
            <div className="ntf-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                type="search"
                placeholder="Buscar por título, mensaje o referencia..."
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
              />
            </div>

            <select
              className="ntf-select"
              value={tipoFiltro}
              onChange={(evento) => setTipoFiltro(evento.target.value)}
              aria-label="Filtrar por tipo de notificación"
            >
              <option value="todos">Todos los eventos</option>
              <option value={TIPOS_NOTIFICACION.MUESTRA_REGISTRADA}>Muestra registrada</option>
              <option value={TIPOS_NOTIFICACION.MUESTRA_ACEPTADA}>Muestra aceptada</option>
              <option value={TIPOS_NOTIFICACION.MUESTRA_RECHAZADA}>Muestra rechazada</option>
              <option value={TIPOS_NOTIFICACION.MUESTRA_PROCESADA}>Muestra procesada</option>
              <option value={TIPOS_NOTIFICACION.RESULTADO_REGISTRADO}>Resultado registrado</option>
              <option value={TIPOS_NOTIFICACION.RESULTADO_VALIDADO}>Resultado validado</option>
              <option value={TIPOS_NOTIFICACION.GENERAL}>General</option>
            </select>
          </div>

          <div className="ntf-tabs">
            <button
              className={`ntf-tab ${filtro === "todas" ? "ntf-tab-active" : ""}`}
              onClick={() => setFiltro("todas")}
            >
              Todas <span>{estadisticas.total}</span>
            </button>
            <button
              className={`ntf-tab ${filtro === "no_leidas" ? "ntf-tab-active" : ""}`}
              onClick={() => setFiltro("no_leidas")}
            >
              No leídas <span>{estadisticas.noLeidas}</span>
            </button>
            <button
              className={`ntf-tab ${filtro === "leidas" ? "ntf-tab-active" : ""}`}
              onClick={() => setFiltro("leidas")}
            >
              Leídas <span>{estadisticas.leidas}</span>
            </button>
          </div>

          <div className="ntf-list">
            {cargando ? (
              <div className="ntf-empty">
                <div className="ntf-spinner" />
                <h3>Cargando notificaciones</h3>
                <p>Consultando los eventos del laboratorio...</p>
              </div>
            ) : notificacionesFiltradas.length === 0 ? (
              <div className="ntf-empty">
                <div className="ntf-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M10 21h4" />
                  </svg>
                </div>
                <h3>No hay notificaciones</h3>
                <p>
                  {busqueda || filtro !== "todas" || tipoFiltro !== "todos"
                    ? "No encontramos eventos que coincidan con los filtros seleccionados."
                    : "Cuando se registren eventos en el laboratorio, aparecerán aquí."}
                </p>
                {(busqueda || filtro !== "todas" || tipoFiltro !== "todos") && (
                  <button
                    className="ntf-btn ntf-btn-outline"
                    onClick={() => {
                      setBusqueda("");
                      setFiltro("todas");
                      setTipoFiltro("todos");
                    }}
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              notificacionesFiltradas.map((notificacion) => {
                const tipo = obtenerTipo(notificacion.tipo);
                const leida = estaLeida(notificacion);

                return (
                  <article
                    key={notificacion.id}
                    className={`ntf-item ${!leida ? "ntf-item-unread" : ""}`}
                  >
                    <div className={`ntf-item-icon ntf-type-${tipo.clase}`}>
                      {tipo.icono}
                    </div>

                    <div className="ntf-item-content">
                      <div className="ntf-item-heading">
                        <h3>{notificacion.titulo || "Notificación"}</h3>
                        {!leida && <span className="ntf-unread-dot" title="No leída" />}
                      </div>

                      <p>{notificacion.mensaje || "Sin descripción disponible."}</p>

                      <div className="ntf-item-meta">
                        <span className={`ntf-type-label ntf-type-${tipo.clase}`}>
                          {tipo.etiqueta}
                        </span>
                        <span className="ntf-meta-divider">•</span>
                        <span title={obtenerFechaCompleta(notificacion.fechaCreacion)}>
                          {obtenerFechaRelativa(notificacion.fechaCreacion)}
                        </span>
                        {notificacion.creadoPorNombre && (
                          <>
                            <span className="ntf-meta-divider">•</span>
                            <span>Por {notificacion.creadoPorNombre}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="ntf-item-actions">
                      <button
                        className="ntf-action-view"
                        onClick={() => abrirDetalle(notificacion)}
                      >
                        Ver detalle
                      </button>

                      {!leida && (
                        <button
                          className="ntf-action-read"
                          onClick={() => marcarLeida(notificacion)}
                          disabled={procesandoId === notificacion.id || marcandoTodas}
                        >
                          {procesandoId === notificacion.id ? "Marcando..." : "Marcar leída"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {!cargando && notificacionesFiltradas.length > 0 && (
            <footer className="ntf-list-footer">
              Mostrando {notificacionesFiltradas.length} de {notificaciones.length} notificaciones
            </footer>
          )}
        </section>
      </div>

      {detalle && (
        <div
          className="ntf-overlay"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setDetalle(null);
          }}
        >
          <section className="ntf-modal" role="dialog" aria-modal="true" aria-labelledby="ntf-modal-title">
            <div className="ntf-modal-header">
              <div className={`ntf-modal-icon ntf-type-${obtenerTipo(detalle.tipo).clase}`}>
                {obtenerTipo(detalle.tipo).icono}
              </div>
              <button className="ntf-modal-close" onClick={() => setDetalle(null)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="ntf-modal-body">
              <span className={`ntf-type-label ntf-type-${obtenerTipo(detalle.tipo).clase}`}>
                {obtenerTipo(detalle.tipo).etiqueta}
              </span>

              <h2 id="ntf-modal-title">{detalle.titulo || "Notificación"}</h2>
              <p className="ntf-modal-message">{detalle.mensaje}</p>

              <div className="ntf-modal-info">
                <div>
                  <span>Fecha del evento</span>
                  <strong>{obtenerFechaCompleta(detalle.fechaCreacion)}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>{estaLeida(detalle) ? "Leída" : "Pendiente de lectura"}</strong>
                </div>
                {detalle.creadoPorNombre && (
                  <div>
                    <span>Registrado por</span>
                    <strong>{detalle.creadoPorNombre}</strong>
                  </div>
                )}
                {detalle.referenciaId && (
                  <div>
                    <span>Referencia</span>
                    <strong>{detalle.referenciaId}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="ntf-modal-footer">
              <button className="ntf-btn ntf-btn-outline" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
              {!estaLeida(detalle) && (
                <button
                  className="ntf-btn ntf-btn-primary"
                  onClick={() => marcarLeida(detalle)}
                  disabled={Boolean(procesandoId) || marcandoTodas}
                >
                  {procesandoId === detalle.id ? "Marcando..." : "Marcar como leída"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}