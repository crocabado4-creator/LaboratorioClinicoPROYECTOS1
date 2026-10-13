import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listarMuestrasProcesadas,
  listarResultados,
  registrarResultado,
} from "../services/resultadosService";

import { listarMuestrasValidacion } from "../services/validacionMuestrasService";

import "./GestionResultados.css";

export default function GestionResultados({ usuario, onVolver }) {
  const [muestras, setMuestras] = useState([]);
  const [resultados, setResultados] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [muestraSeleccionada, setMuestraSeleccionada] = useState(null);

  const [valorResultado, setValorResultado] = useState("");
  const [unidad, setUnidad] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const laboratorioId = String(
    usuario?.laboratorioId ?? ""
  ).trim();

  const usuarioId = String(
    usuario?.uid ?? usuario?.id ?? ""
  ).trim();

  const rol = String(usuario?.rol ?? "").toLowerCase();

  const puedeRegistrar = rol === "bioquimico";

  // =============================================
  // CARGAR DATOS
  // =============================================

  const cargarDatos = useCallback(async () => {
    if (!laboratorioId) {
      setError("El usuario no tiene laboratorio asignado.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const [datosMuestras, datosResultados] = await Promise.all([
        listarMuestrasValidacion(laboratorioId),
        listarResultados(laboratorioId),
      ]);

      const procesadas = datosMuestras.filter(
        (muestra) =>
          muestra.estado === "procesada" &&
          muestra.aceptada === true
      );

      setMuestras(procesadas);
      setResultados(datosResultados);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // =============================================
  // FORMATEAR FECHA
  // =============================================

  function mostrarFecha(fecha) {
    if (!fecha) return "Sin fecha";

    const valor =
      typeof fecha.toDate === "function"
        ? fecha.toDate()
        : new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      return "Sin fecha";
    }

    return valor.toLocaleString("es-BO");
  }

  // =============================================
  // RESULTADO EXISTENTE
  // =============================================

  function buscarResultado(muestraId) {
    return resultados.find(
      (resultado) => resultado.muestraId === muestraId
    );
  }

  // =============================================
  // ABRIR FORMULARIO
  // =============================================

  function abrirRegistro(muestra) {
    if (!puedeRegistrar) {
      setError("Solo el Bioquímico puede registrar resultados.");
      return;
    }

    if (buscarResultado(muestra.id)) {
      setError("Esta muestra ya tiene un resultado registrado.");
      return;
    }

    setMuestraSeleccionada(muestra);
    setValorResultado("");
    setUnidad("");
    setObservaciones("");
    setMensaje("");
    setError("");
  }

  // =============================================
  // GUARDAR RESULTADO
  // =============================================

  async function guardarResultado() {
    if (!muestraSeleccionada) return;

    if (!valorResultado.trim()) {
      setError("Debes ingresar el resultado del análisis.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await registrarResultado({
        muestraId: muestraSeleccionada.id,
        laboratorioId,
        usuarioId,
        valorResultado,
        unidad,
        observaciones,
      });

      setMuestraSeleccionada(null);
      setValorResultado("");
      setUnidad("");
      setObservaciones("");

      setMensaje("Resultado registrado correctamente.");

      await cargarDatos();
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo registrar el resultado.");
    } finally {
      setGuardando(false);
    }
  }

  // =============================================
  // BUSCADOR
  // =============================================

  const muestrasFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    return muestras.filter((muestra) => {
      const contenido = [
        muestra.codigoEtiqueta,
        muestra.nombrePaciente,
        muestra.pacienteId,
        muestra.ordenId,
        muestra.analisisNombre,
        muestra.analisisId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return contenido.includes(textoBusqueda);
    });
  }, [muestras, busqueda]);

  // =============================================
  // INTERFAZ
  // =============================================

  return (
    <main className="gr-contenedor">
      <header className="gr-encabezado">
        <div>
          <h1>Registro de resultados</h1>
          <p>
            Registra los resultados de las muestras que
            finalizaron su procesamiento.
          </p>
        </div>

        {onVolver && (
          <button
            className="gr-volver"
            onClick={onVolver}
            type="button"
          >
            Volver
          </button>
        )}
      </header>

      {mensaje && <div className="gr-exito">{mensaje}</div>}

      {error && <div className="gr-error">{error}</div>}

      <section className="gr-resumen">
        <div>
          <span>Muestras procesadas</span>
          <strong>{muestras.length}</strong>
        </div>

        <div>
          <span>Resultados registrados</span>
          <strong>{resultados.length}</strong>
        </div>

        <div>
          <span>Pendientes de registro</span>
          <strong>
            {
              muestras.filter(
                (muestra) => !buscarResultado(muestra.id)
              ).length
            }
          </strong>
        </div>
      </section>

      <section className="gr-panel">
        <div className="gr-filtros">
          <input
            type="text"
            placeholder="Buscar por paciente, muestra, orden o análisis..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
          >
            Actualizar
          </button>
        </div>

        <div className="gr-tabla-contenedor">
          <table className="gr-tabla">
            <thead>
              <tr>
                <th>Muestra</th>
                <th>Paciente</th>
                <th>Análisis</th>
                <th>Fecha de procesamiento</th>
                <th>Resultado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="7" className="gr-vacio">
                    Cargando...
                  </td>
                </tr>
              ) : muestrasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="gr-vacio">
                    No hay muestras procesadas.
                  </td>
                </tr>
              ) : (
                muestrasFiltradas.map((muestra) => {
                  const resultado = buscarResultado(muestra.id);

                  return (
                    <tr key={muestra.id}>
                      <td>
                        {muestra.codigoEtiqueta || muestra.id}
                      </td>

                      <td>
                        {muestra.nombrePaciente ||
                          "Paciente no encontrado"}
                      </td>

                      <td>
                        {muestra.analisisNombre ||
                          muestra.analisisId ||
                          "-"}
                      </td>

                      <td>
                        {mostrarFecha(
                          muestra.fechaFinProcesamiento
                        )}
                      </td>

                      <td>
                        {resultado
                          ? `${resultado.valorResultado} ${
                              resultado.unidad || ""
                            }`
                          : "Pendiente"}
                      </td>

                      <td>
                        {resultado
                          ? resultado.estado
                          : "Sin resultado"}
                      </td>

                      <td>
                        {resultado ? (
                          <span className="gr-registrado">
                            Registrado
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="gr-registrar"
                            disabled={!puedeRegistrar}
                            onClick={() => abrirRegistro(muestra)}
                          >
                            Registrar resultado
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {muestraSeleccionada && (
        <div className="gr-modal-fondo">
          <div className="gr-modal">
            <h2>Registrar resultado</h2>

            <p>
              Paciente:{" "}
              <strong>
                {muestraSeleccionada.nombrePaciente ||
                  "Paciente no encontrado"}
              </strong>
            </p>

            <p>
              Análisis:{" "}
              <strong>
                {muestraSeleccionada.analisisNombre ||
                  muestraSeleccionada.analisisId}
              </strong>
            </p>

            <label htmlFor="valorResultado">
              Resultado *
            </label>

            <input
              id="valorResultado"
              type="text"
              placeholder="Ingresa el valor obtenido"
              value={valorResultado}
              onChange={(e) => setValorResultado(e.target.value)}
            />

            <label htmlFor="unidad">
              Unidad de medida
            </label>

            <input
              id="unidad"
              type="text"
              placeholder="Ejemplo: mg/dL, g/dL, positivo, negativo..."
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
            />

            <label htmlFor="observaciones">
              Observaciones
            </label>

            <textarea
              id="observaciones"
              rows={4}
              placeholder="Observaciones del Bioquímico"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />

            <div className="gr-modal-acciones">
              <button
                type="button"
                className="gr-cancelar"
                disabled={guardando}
                onClick={() => setMuestraSeleccionada(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="gr-registrar"
                disabled={guardando || !valorResultado.trim()}
                onClick={guardarResultado}
              >
                {guardando ? "Guardando..." : "Guardar resultado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}