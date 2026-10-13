import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listarMuestrasValidacion,
  validarMuestra,
  muestraPuedeProcesarse,
} from "../services/validacionMuestrasService";

import "./ValidacionMuestras.css";

export default function ValidacionMuestras({ usuario, onVolver }) {
  const [muestras, setMuestras] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");

  const [muestraSeleccionada, setMuestraSeleccionada] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const laboratorioId = String(
    usuario?.laboratorioId ?? ""
  ).trim();

  const usuarioId = String(
    usuario?.uid ?? usuario?.id ?? ""
  ).trim();

  const rol = String(usuario?.rol ?? "")
    .trim()
    .toLowerCase();

  const puedeValidar =
    rol === "bioquimico" ||
    rol === "bioquímico";

  // ==============================================
  // CARGAR MUESTRAS
  // ==============================================

  const cargarMuestras = useCallback(async () => {
    if (!laboratorioId) {
      setError("El usuario no tiene laboratorio asignado.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const datos = await listarMuestrasValidacion(
        laboratorioId
      );

      setMuestras(datos);
    } catch (err) {
      console.error(err);

      setError(
        err.message || "No se pudieron cargar las muestras."
      );
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargarMuestras();
  }, [cargarMuestras]);

  // ==============================================
  // ESTADOS
  // ==============================================

  function obtenerEstado(muestra) {
    return String(muestra?.estado ?? "tomada")
      .trim()
      .toLowerCase();
  }

  function pendienteValidacion(muestra) {
    const estado = obtenerEstado(muestra);

    return [
      "tomada",
      "pendiente",
      "registrada",
    ].includes(estado);
  }

  function formatearFecha(fecha) {
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

  // ==============================================
  // ACEPTAR MUESTRA
  // ==============================================

  async function aceptarMuestra(muestra) {
    if (!puedeValidar) {
      setError("Solo el Bioquímico puede validar muestras.");
      return;
    }

    if (!usuarioId) {
      setError("No se identificó al usuario.");
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas que la muestra ${
        muestra.codigoEtiqueta || muestra.id
      } es apta para el análisis?`
    );

    if (!confirmar) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await validarMuestra({
        muestraId: muestra.id,
        laboratorioId,
        usuarioId,
        accion: "aceptar",
      });

      setMensaje("La muestra fue aceptada correctamente.");

      await cargarMuestras();
    } catch (err) {
      console.error(err);

      setError(
        err.message || "No se pudo aceptar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ==============================================
  // ABRIR FORMULARIO DE RECHAZO
  // ==============================================

  function abrirRechazo(muestra) {
    if (!puedeValidar) {
      setError("Solo el Bioquímico puede validar muestras.");
      return;
    }

    setMuestraSeleccionada(muestra);
    setMotivoRechazo("");
    setError("");
    setMensaje("");
  }

  // ==============================================
  // RECHAZAR MUESTRA
  // ==============================================

  async function rechazarMuestra() {
    if (!muestraSeleccionada) return;

    if (!motivoRechazo.trim()) {
      setError("Debes escribir el motivo del rechazo.");
      return;
    }

    if (!usuarioId) {
      setError("No se identificó al usuario.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await validarMuestra({
        muestraId: muestraSeleccionada.id,
        laboratorioId,
        usuarioId,
        accion: "rechazar",
        motivoRechazo,
      });

      setMuestraSeleccionada(null);
      setMotivoRechazo("");

      setMensaje("La muestra fue rechazada correctamente.");

      await cargarMuestras();
    } catch (err) {
      console.error(err);

      setError(
        err.message || "No se pudo rechazar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ==============================================
  // BUSCADOR Y FILTROS
  // ==============================================

  const muestrasFiltradas = useMemo(() => {
    return muestras.filter((muestra) => {
      const contenido = [
  muestra.codigoEtiqueta,
  muestra.muestraId,
  muestra.nombrePaciente,
  muestra.pacienteId,
  muestra.ordenId,
  muestra.analisisNombre,
  muestra.analisisId,
  muestra.tipo,
]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = contenido.includes(
        busqueda.trim().toLowerCase()
      );

      const estado = obtenerEstado(muestra);

      const coincideFiltro =
        filtro === "todas" ||
        (filtro === "pendientes"
          ? pendienteValidacion(muestra)
          : estado === filtro);

      return coincideBusqueda && coincideFiltro;
    });
  }, [muestras, busqueda, filtro]);

  const total = muestras.length;

  const pendientes = muestras.filter(
    pendienteValidacion
  ).length;

  const aceptadas = muestras.filter(
    (muestra) => obtenerEstado(muestra) === "aceptada"
  ).length;

  const rechazadas = muestras.filter(
    (muestra) => obtenerEstado(muestra) === "rechazada"
  ).length;

  // ==============================================
  // INTERFAZ
  // ==============================================

  return (
    <main className="vm-contenedor">
      <header className="vm-encabezado">
        <div>
          <h1>Recepción y validación de muestras</h1>

          <p>
            Verifica que las muestras recibidas sean aptas
            antes de realizar el análisis.
          </p>
        </div>

        {onVolver && (
          <button
            type="button"
            className="vm-volver"
            onClick={onVolver}
          >
            Volver
          </button>
        )}
      </header>

      {!puedeValidar && (
        <div className="vm-aviso">
          Solo el Bioquímico puede aceptar o rechazar muestras.
        </div>
      )}

      {mensaje && (
        <div className="vm-exito">{mensaje}</div>
      )}

      {error && (
        <div className="vm-error">{error}</div>
      )}

      <section className="vm-resumen">
        <div className="vm-tarjeta">
          <span>Total de muestras</span>
          <strong>{total}</strong>
        </div>

        <div className="vm-tarjeta">
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
        </div>

        <div className="vm-tarjeta">
          <span>Aceptadas</span>
          <strong>{aceptadas}</strong>
        </div>

        <div className="vm-tarjeta">
          <span>Rechazadas</span>
          <strong>{rechazadas}</strong>
        </div>
      </section>

      <section className="vm-panel">
        <div className="vm-filtros">
          <input
            type="text"
            placeholder="Buscar por código, paciente, orden o análisis..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="todas">
              Todas las muestras
            </option>

            <option value="pendientes">
              Pendientes
            </option>

            <option value="aceptada">
              Aceptadas
            </option>

            <option value="rechazada">
              Rechazadas
            </option>
          </select>

          <button
            type="button"
            className="vm-actualizar"
            onClick={cargarMuestras}
            disabled={cargando}
          >
            Actualizar
          </button>
        </div>

        <div className="vm-tabla-contenedor">
          <table className="vm-tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Paciente</th>
                <th>Orden</th>
                <th>Análisis</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Procesamiento</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="9" className="vm-vacio">
                    Cargando muestras...
                  </td>
                </tr>
              ) : muestrasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="vm-vacio">
                    No se encontraron muestras.
                  </td>
                </tr>
              ) : (
                muestrasFiltradas.map((muestra) => (
                  <tr key={muestra.id}>
                    <td>
                      <strong>
                        {muestra.codigoEtiqueta ||
                          muestra.muestraId ||
                          muestra.id}
                      </strong>
                    </td>

                    <td>{muestra.nombrePaciente || "Paciente no encontrado"}</td>

                    <td>{muestra.ordenId || "-"}</td>

                    <td>
                      {muestra.analisisNombre ||
                        muestra.analisisId ||
                        "-"}
                    </td>

                    <td>{muestra.tipo || "-"}</td>

                    <td>
                      {formatearFecha(muestra.fechaToma)}
                    </td>

                    <td>
                      <span
                        className={`vm-estado vm-${obtenerEstado(
                          muestra
                        )}`}
                      >
                        {obtenerEstado(muestra)}
                      </span>
                    </td>

                    <td>
                      {muestraPuedeProcesarse(muestra) ? (
                        <span className="vm-permitido">
                          Apta para procesar
                        </span>
                      ) : (
                        <span className="vm-bloqueado">
                          No habilitada
                        </span>
                      )}
                    </td>

                    <td>
                      {pendienteValidacion(muestra) &&
                      puedeValidar ? (
                        <div className="vm-acciones">
                          <button
                            type="button"
                            className="vm-aceptar"
                            disabled={guardando}
                            onClick={() =>
                              aceptarMuestra(muestra)
                            }
                          >
                            Aceptar
                          </button>

                          <button
                            type="button"
                            className="vm-rechazar"
                            disabled={guardando}
                            onClick={() =>
                              abrirRechazo(muestra)
                            }
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : obtenerEstado(muestra) ===
                        "rechazada" ? (
                        <span
                          className="vm-motivo"
                          title={muestra.motivoRechazo || ""}
                        >
                          {muestra.motivoRechazo ||
                            "Muestra rechazada"}
                        </span>
                      ) : (
                        <span className="vm-sin-acciones">
                          Sin acciones
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {muestraSeleccionada && (
        <div className="vm-modal-fondo">
          <div className="vm-modal">
            <h2>Rechazar muestra</h2>

            <p>
              Código:{" "}
              <strong>
                {muestraSeleccionada.codigoEtiqueta ||
                  muestraSeleccionada.id}
              </strong>
            </p>

            <label htmlFor="motivoRechazo">
              Motivo del rechazo *
            </label>

            <textarea
              id="motivoRechazo"
              rows={4}
              placeholder="Ejemplo: muestra insuficiente, contaminada o mal identificada..."
              value={motivoRechazo}
              onChange={(e) =>
                setMotivoRechazo(e.target.value)
              }
            />

            <div className="vm-modal-acciones">
              <button
                type="button"
                className="vm-cancelar"
                disabled={guardando}
                onClick={() => {
                  setMuestraSeleccionada(null);
                  setMotivoRechazo("");
                  setError("");
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="vm-rechazar"
                disabled={
                  guardando || !motivoRechazo.trim()
                }
                onClick={rechazarMuestra}
              >
                {guardando
                  ? "Guardando..."
                  : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}