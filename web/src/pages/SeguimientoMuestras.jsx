import { useEffect, useMemo, useState } from "react";

import {
  obtenerMuestrasSeguimiento,
  obtenerHistorialMuestra,
  cambiarEstadoMuestra,
  puedeIniciarProcesamiento,
  puedeFinalizarProcesamiento,
} from "../services/seguimientoMuestrasService";

import { listarMuestrasValidacion } from "../services/validacionMuestrasService";

import "./SeguimientoMuestras.css";

export default function SeguimientoMuestras({ usuario, onVolver }) {
  const [muestras, setMuestras] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");

  const [muestraSeleccionada, setMuestraSeleccionada] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [accion, setAccion] = useState("");

  const [historialSeleccionado, setHistorialSeleccionado] = useState(null);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const laboratorioId = usuario?.laboratorioId;
  const usuarioId = usuario?.uid || usuario?.id;

  const rol = String(usuario?.rol || "").toLowerCase();

  const puedeModificar = rol === "bioquimico";

  // ======================================================
  // CARGAR MUESTRAS
  // ======================================================

  async function cargarMuestras() {
    if (!laboratorioId) {
      setError("No se identificó el laboratorio.");
      return;
    }

    try {
      setCargando(true);
      setError("");

      // Utilizamos el servicio de HU-24 porque ya
      // devuelve los nombres completos de pacientes.
      const datos = await listarMuestrasValidacion(laboratorioId);

      setMuestras(datos);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar muestras.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarMuestras();
  }, [laboratorioId]);

  // ======================================================
  // FECHAS
  // ======================================================

  function mostrarFecha(fecha) {
    if (!fecha) return "Sin fecha";

    let valor;

    if (typeof fecha.toDate === "function") {
      valor = fecha.toDate();
    } else if (typeof fecha.seconds === "number") {
      valor = new Date(fecha.seconds * 1000);
    } else {
      valor = new Date(fecha);
    }

    if (Number.isNaN(valor.getTime())) {
      return "Sin fecha";
    }

    return valor.toLocaleString("es-BO");
  }

  // ======================================================
  // ESTADOS
  // ======================================================

  function mostrarEstado(estado) {
    switch (estado) {
      case "tomada":
        return "Tomada";

      case "aceptada":
        return "Aceptada";

      case "rechazada":
        return "Rechazada";

      case "en_proceso":
        return "En proceso";

      case "procesada":
        return "Procesada";

      default:
        return estado || "Sin estado";
    }
  }

  // ======================================================
  // ABRIR CAMBIO DE ESTADO
  // ======================================================

  function abrirCambio(muestra, nuevoEstado) {
    if (!puedeModificar) {
      setError("Solo el Bioquímico puede actualizar muestras.");
      return;
    }

    setMuestraSeleccionada(muestra);
    setAccion(nuevoEstado);
    setObservacion("");
    setError("");
    setMensaje("");
  }

  // ======================================================
  // GUARDAR CAMBIO
  // ======================================================

  async function guardarCambio() {
    if (!muestraSeleccionada || !accion) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await cambiarEstadoMuestra({
        muestraId: muestraSeleccionada.id,
        laboratorioId,
        usuarioId,
        nuevoEstado: accion,
        observacion,
      });

      setMuestraSeleccionada(null);
      setAccion("");
      setObservacion("");

      setMensaje("Estado actualizado correctamente.");

      await cargarMuestras();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al actualizar estado.");
    } finally {
      setGuardando(false);
    }
  }

  // ======================================================
  // BUSCADOR
  // ======================================================

  const muestrasFiltradas = useMemo(() => {
    return muestras.filter((muestra) => {
      const texto = [
        muestra.codigoEtiqueta,
        muestra.nombrePaciente,
        muestra.pacienteId,
        muestra.ordenId,
        muestra.analisisNombre,
        muestra.tipo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = texto.includes(
        busqueda.toLowerCase().trim()
      );

      const coincideFiltro =
        filtro === "todas" ||
        muestra.estado === filtro;

      return coincideBusqueda && coincideFiltro;
    });
  }, [muestras, busqueda, filtro]);

  // ======================================================
  // CONTADORES
  // ======================================================

  const tomadas = muestras.filter(
    (m) => m.estado === "tomada"
  ).length;

  const aceptadas = muestras.filter(
    (m) => m.estado === "aceptada"
  ).length;

  const rechazadas = muestras.filter(
    (m) => m.estado === "rechazada"
  ).length;

  const enProceso = muestras.filter(
    (m) => m.estado === "en_proceso"
  ).length;

  const procesadas = muestras.filter(
    (m) => m.estado === "procesada"
  ).length;

  // ======================================================
  // INTERFAZ
  // ======================================================

  return (
    <div className="sm-contenedor">
      <div className="sm-encabezado">
        <div>
          <h1>Seguimiento de muestras</h1>
        </div>

        {onVolver && (
          <button className="sm-volver" onClick={onVolver}>
            Volver
          </button>
        )}
      </div>

      {mensaje && (
        <div className="sm-exito">{mensaje}</div>
      )}

      {error && (
        <div className="sm-error">{error}</div>
      )}

      <div className="sm-resumen">
        <div className="sm-tarjeta">
          <span>Tomadas</span>
          <strong>{tomadas}</strong>
        </div>

        <div className="sm-tarjeta">
          <span>Aceptadas</span>
          <strong>{aceptadas}</strong>
        </div>

        <div className="sm-tarjeta">
          <span>Rechazadas</span>
          <strong>{rechazadas}</strong>
        </div>

        <div className="sm-tarjeta">
          <span>En proceso</span>
          <strong>{enProceso}</strong>
        </div>

        <div className="sm-tarjeta">
          <span>Procesadas</span>
          <strong>{procesadas}</strong>
        </div>
      </div>

      <div className="sm-filtros">
        <input
          type="text"
          placeholder="Buscar por paciente, código, orden o análisis..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        >
          <option value="todas">Todas</option>
          <option value="tomada">Tomadas</option>
          <option value="aceptada">Aceptadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="en_proceso">En proceso</option>
          <option value="procesada">Procesadas</option>
        </select>

        <button onClick={cargarMuestras}>
          Actualizar
        </button>
      </div>

      <div className="sm-tabla-contenedor">
        <table className="sm-tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Paciente</th>
              <th>Análisis</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha de toma</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="7" className="sm-vacio">
                  Cargando muestras...
                </td>
              </tr>
            ) : muestrasFiltradas.length === 0 ? (
              <tr>
                <td colSpan="7" className="sm-vacio">
                  No se encontraron muestras.
                </td>
              </tr>
            ) : (
              muestrasFiltradas.map((muestra) => (
                <tr key={muestra.id}>
                  <td>
                    {muestra.codigoEtiqueta || muestra.id}
                  </td>

                  <td>
                    {muestra.nombrePaciente || "Sin nombre"}
                  </td>

                  <td>
                    {muestra.analisisNombre ||
                      muestra.analisisId ||
                      "-"}
                  </td>

                  <td>
                    {muestra.tipo || "-"}
                  </td>

                  <td>
                    <span
                      className={`sm-estado sm-${muestra.estado}`}
                    >
                      {mostrarEstado(muestra.estado)}
                    </span>
                  </td>

                  <td>
                    {mostrarFecha(muestra.fechaToma)}
                  </td>

                  <td>
                    <div className="sm-acciones">
                      {puedeModificar &&
                        puedeIniciarProcesamiento(muestra) && (
                          <button
                            className="sm-iniciar"
                            onClick={() =>
                              abrirCambio(
                                muestra,
                                "en_proceso"
                              )
                            }
                          >
                            Iniciar proceso
                          </button>
                        )}

                      {puedeModificar &&
                        puedeFinalizarProcesamiento(muestra) && (
                          <button
                            className="sm-finalizar"
                            onClick={() =>
                              abrirCambio(
                                muestra,
                                "procesada"
                              )
                            }
                          >
                            Finalizar
                          </button>
                        )}

                      <button
                        className="sm-historial"
                        onClick={() =>
                          setHistorialSeleccionado(muestra)
                        }
                      >
                        Historial
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CAMBIO DE ESTADO */}

      {muestraSeleccionada && (
        <div className="sm-modal-fondo">
          <div className="sm-modal">
            <h2>
              {accion === "en_proceso"
                ? "Iniciar procesamiento"
                : "Finalizar procesamiento"}
            </h2>

            <p>
              Muestra:{" "}
              <strong>
                {muestraSeleccionada.codigoEtiqueta ||
                  muestraSeleccionada.id}
              </strong>
            </p>

            <label>Observación (opcional)</label>

            <textarea
              rows={4}
              value={observacion}
              onChange={(e) =>
                setObservacion(e.target.value)
              }
              placeholder="Escribe una observación..."
            />

            <div className="sm-modal-acciones">
              <button
                className="sm-cancelar"
                onClick={() =>
                  setMuestraSeleccionada(null)
                }
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                className="sm-confirmar"
                onClick={guardarCambio}
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL */}

      {historialSeleccionado && (
        <div className="sm-modal-fondo">
          <div className="sm-modal">
            <h2>Historial de estados</h2>

            <p>
              Muestra:{" "}
              <strong>
                {historialSeleccionado.codigoEtiqueta ||
                  historialSeleccionado.id}
              </strong>
            </p>

            {obtenerHistorialMuestra(
              historialSeleccionado
            ).length === 0 ? (
              <p>No existen cambios registrados.</p>
            ) : (
              <div className="sm-lista-historial">
                {obtenerHistorialMuestra(
                  historialSeleccionado
                ).map((registro, index) => (
                  <div
                    className="sm-item-historial"
                    key={index}
                  >
                    <strong>
                      {mostrarEstado(
                        registro.estadoAnterior
                      )}
                      {" → "}
                      {mostrarEstado(
                        registro.estadoNuevo
                      )}
                    </strong>

                    <p>
                      Fecha: {mostrarFecha(registro.fecha)}
                    </p>

                    <p>
                      Usuario: {registro.usuarioId}
                    </p>

                    {registro.observacion && (
                      <p>
                        Observación: {registro.observacion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              className="sm-cancelar"
              onClick={() =>
                setHistorialSeleccionado(null)
              }
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}