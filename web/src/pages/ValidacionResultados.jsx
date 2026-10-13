import { useCallback, useEffect, useState } from "react";

import {
  listarResultadosValidacion,
  obtenerValoresValidacion,
  validarResultadoFinal,
} from "../services/validacionResultadosService";

import "./ValidacionResultados.css";

export default function ValidacionResultados({ usuario, onVolver }) {
  const [resultados, setResultados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [valores, setValores] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [validando, setValidando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const laboratorioId = usuario?.laboratorioId;
  const puedeValidar = usuario?.rol === "bioquimico";

  // =============================================
  // CARGAR RESULTADOS
  // =============================================

  const cargarResultados = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const datos = await listarResultadosValidacion(laboratorioId);
      setResultados(datos);
    } catch (err) {
      console.error("HU-29:", err);
      setError(err.message || "No se pudieron cargar los resultados.");
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargarResultados();
  }, [cargarResultados]);

  // =============================================
  // REVISAR RESULTADO
  // =============================================

  async function revisarResultado(resultado) {
    try {
      setCargando(true);
      setError("");
      setMensaje("");

      const datos = await obtenerValoresValidacion(resultado.id);

      setValores(datos);
      setSeleccionado(resultado);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudieron consultar los valores.");
    } finally {
      setCargando(false);
    }
  }

  // =============================================
  // VALIDAR
  // =============================================

  async function confirmarValidacion() {
    if (!seleccionado) return;

    if (!puedeValidar) {
      setError("Solo el Bioquímico puede validar resultados.");
      return;
    }

    if (
      !window.confirm(
        "¿Estás seguro de validar este resultado? Después no podrá modificarse."
      )
    ) {
      return;
    }

    try {
      setValidando(true);
      setError("");
      setMensaje("");

      await validarResultadoFinal({
        resultadoId: seleccionado.id,
        laboratorioId,
      });

      setMensaje("Resultado validado correctamente.");
      setSeleccionado(null);
      setValores([]);

      await cargarResultados();
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo validar el resultado.");
    } finally {
      setValidando(false);
    }
  }

  const filtrados = resultados.filter((resultado) => {
    const texto = [
      resultado.analisisNombre,
      resultado.analisisId,
      resultado.pacienteId,
      resultado.muestraId,
      resultado.ordenId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return texto.includes(busqueda.toLowerCase().trim());
  });

  return (
    <main className="vfr-contenedor">
      <header className="vfr-encabezado">
        <div>
          <h1>Validación de resultados</h1>
          <p>
            Revisión y aprobación final de los resultados clínicos.
          </p>
        </div>

        {onVolver && (
          <button type="button" onClick={onVolver}>
            Volver
          </button>
        )}
      </header>

      {mensaje && <div className="vfr-exito">{mensaje}</div>}
      {error && <div className="vfr-error">{error}</div>}

      <section className="vfr-resumen">
        <div>
          <span>Total de resultados</span>
          <strong>{resultados.length}</strong>
        </div>

        <div>
          <span>Pendientes</span>
          <strong>
            {resultados.filter((r) => r.estado === "borrador").length}
          </strong>
        </div>

        <div>
          <span>Validados</span>
          <strong>
            {resultados.filter((r) => r.estado === "validado").length}
          </strong>
        </div>
      </section>

      <section className="vfr-panel">
        <div className="vfr-filtros">
          <input
            type="text"
            placeholder="Buscar por análisis, paciente, muestra u orden..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <button
            type="button"
            onClick={cargarResultados}
            disabled={cargando}
          >
            Actualizar
          </button>
        </div>

        <div className="vfr-tabla-contenedor">
          <table className="vfr-tabla">
            <thead>
              <tr>
                <th>Análisis</th>
                <th>Paciente</th>
                <th>Muestra</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="5">Cargando...</td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="5">No hay resultados disponibles.</td>
                </tr>
              ) : (
                filtrados.map((resultado) => (
                  <tr key={resultado.id}>
                    <td>
                      {resultado.analisisNombre ||
                        resultado.analisisId ||
                        "-"}
                    </td>

                    <td>{resultado.pacienteId || "-"}</td>

                    <td>{resultado.muestraId || "-"}</td>

                    <td>
                      <span
                        className={
                          resultado.estado === "validado"
                            ? "vfr-validado"
                            : "vfr-borrador"
                        }
                      >
                        {resultado.estado}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => revisarResultado(resultado)}
                      >
                        {resultado.estado === "validado"
                          ? "Ver resultado"
                          : "Revisar y validar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {seleccionado && (
        <div className="vfr-modal-fondo">
          <div className="vfr-modal">
            <h2>Revisión del resultado</h2>

            <p>
              Análisis:{" "}
              <strong>
                {seleccionado.analisisNombre ||
                  seleccionado.analisisId}
              </strong>
            </p>

            <p>
              Estado: <strong>{seleccionado.estado}</strong>
            </p>

            <h3>Valores registrados</h3>

            {valores.length === 0 ? (
              <p>
                No hay valores por parámetros registrados.
              </p>
            ) : (
              <div className="vfr-valores">
                {valores.map((valor) => (
                  <div key={valor.id} className="vfr-valor">
                    <strong>
                      {valor.nombreParametro || valor.parametroId}
                    </strong>

                    <span>
                      {valor.valor} {valor.unidad || ""}
                    </span>

                    <small>
                      Referencia: {valor.rangoReferencia || "-"}
                    </small>

                    {valor.observacion && (
                      <small>
                        Observación: {valor.observacion}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="vfr-modal-acciones">
              <button
                type="button"
                className="vfr-cancelar"
                onClick={() => setSeleccionado(null)}
              >
                Cerrar
              </button>

              {puedeValidar && seleccionado.estado === "borrador" && (
                <button
                  type="button"
                  className="vfr-confirmar"
                  onClick={confirmarValidacion}
                  disabled={validando}
                >
                  {validando ? "Validando..." : "Validar resultado"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}