import { useCallback, useEffect, useState } from "react";

import {
  listarResultadosParaParametros,
  listarParametrosAnalisis,
  listarValoresResultado,
  guardarValorParametro,
} from "../services/valoresResultadosService";

import "./ValoresResultados.css";

export default function ValoresResultados({ usuario, onVolver }) {
  const [resultados, setResultados] = useState([]);
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState(null);

  const [parametros, setParametros] = useState([]);
  const [valores, setValores] = useState({});

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const laboratorioId = String(usuario?.laboratorioId ?? "").trim();
  const puedeEditar = usuario?.rol === "bioquimico";

  // =====================================================
  // CARGAR RESULTADOS
  // =====================================================

  const cargarResultados = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const datos = await listarResultadosParaParametros(
        laboratorioId
      );

      setResultados(datos);
    } catch (err) {
      console.error("HU-27 - Cargar resultados:", err);

      setError(
        err.code === "permission-denied"
          ? "Firestore rechazó la consulta de resultados. Revisa los permisos de la colección resultados."
          : err.message || "No se pudieron cargar los resultados."
      );
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargarResultados();
  }, [cargarResultados]);

  // =====================================================
  // SELECCIONAR RESULTADO
  // =====================================================

  async function seleccionarResultado(resultado) {
    try {
      setCargando(true);
      setError("");
      setMensaje("");

      if (!resultado.analisisId) {
        throw new Error(
          "Este resultado no tiene un analisisId registrado."
        );
      }

      const listaParametros = await listarParametrosAnalisis(
        resultado.analisisId,
        laboratorioId
      );

      const listaValores = await listarValoresResultado(
        resultado.id
      );

      const mapa = {};

      listaParametros.forEach((parametro) => {
        const existente = listaValores.find(
          (item) => item.parametroId === parametro.id
        );

        mapa[parametro.id] = {
          valor: existente?.valor ?? "",
          observacion: existente?.observacion ?? "",
        };
      });

      setParametros(listaParametros);
      setValores(mapa);
      setResultadoSeleccionado(resultado);
    } catch (err) {
      console.error("HU-27 - Ver parámetros:", err);

      setError(
        err.code === "permission-denied"
          ? "Firestore no permite consultar los parámetros o valores de este análisis."
          : err.message || "No se pudieron cargar los parámetros."
      );
    } finally {
      setCargando(false);
    }
  }

  // =====================================================
  // MODIFICAR CAMPOS
  // =====================================================

  function cambiarValor(parametroId, campo, valor) {
    setValores((anterior) => ({
      ...anterior,
      [parametroId]: {
        ...anterior[parametroId],
        [campo]: valor,
      },
    }));
  }

  // =====================================================
  // GUARDAR PARÁMETRO
  // =====================================================

  async function guardarParametro(parametro) {
    if (!resultadoSeleccionado) return;

    const datos = valores[parametro.id] || {};

    try {
      setGuardando(parametro.id);
      setError("");
      setMensaje("");

      await guardarValorParametro({
        resultadoId: resultadoSeleccionado.id,
        laboratorioId,
        parametroId: parametro.id,
        nombreParametro:
          parametro.nombre ||
          parametro.nombreParametro ||
          parametro.id,
        valor: datos.valor,
        unidad: parametro.unidad || "",
        rangoReferencia:
          parametro.rangoReferencia ||
          parametro.valorReferencia ||
          "",
        observacion: datos.observacion || "",
      });

      setMensaje("Parámetro guardado correctamente.");
    } catch (err) {
      console.error("HU-27 - Guardar parámetro:", err);

      setError(
        err.code === "permission-denied"
          ? "Firestore rechazó el guardado del parámetro. Revisa los permisos de resultados/valores."
          : err.message || "No se pudo guardar el parámetro."
      );
    } finally {
      setGuardando("");
    }
  }

  // =====================================================
  // FILTRAR RESULTADOS
  // =====================================================

  const resultadosFiltrados = resultados.filter((resultado) => {
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

  // =====================================================
  // VOLVER A LISTA
  // =====================================================

  function volverLista() {
    setResultadoSeleccionado(null);
    setParametros([]);
    setValores({});
    setError("");
    setMensaje("");
  }

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <div className="vr-contenedor">
      <header className="vr-encabezado">
        <div>
          <h1>Valores por parámetros</h1>
          <p>
            Registro detallado de los resultados de cada análisis.
          </p>
        </div>

        {onVolver && (
          <button type="button" onClick={onVolver}>
            Volver
          </button>
        )}
      </header>

      {mensaje && (
        <div className="vr-exito">{mensaje}</div>
      )}

      {error && (
        <div className="vr-error">{error}</div>
      )}

      {!resultadoSeleccionado ? (
        <>
          <div className="vr-buscador">
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
              {cargando ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div className="vr-tabla-contenedor">
            <table className="vr-tabla">
              <thead>
                <tr>
                  <th>Análisis</th>
                  <th>Paciente ID</th>
                  <th>Muestra</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="5">Cargando resultados...</td>
                  </tr>
                ) : resultadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      No hay resultados disponibles.
                    </td>
                  </tr>
                ) : (
                  resultadosFiltrados.map((resultado) => (
                    <tr key={resultado.id}>
                      <td>
                        {resultado.analisisNombre ||
                          resultado.analisisId ||
                          "-"}
                      </td>

                      <td>{resultado.pacienteId || "-"}</td>

                      <td>{resultado.muestraId || "-"}</td>

                      <td>{resultado.estado || "-"}</td>

                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            seleccionarResultado(resultado)
                          }
                          disabled={cargando}
                        >
                          Ver parámetros
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="vr-panel">
          <button
            type="button"
            className="vr-volver-lista"
            onClick={volverLista}
          >
            Volver a resultados
          </button>

          <h2>
            {resultadoSeleccionado.analisisNombre ||
              resultadoSeleccionado.analisisId}
          </h2>

          <p>
            Estado:{" "}
            <strong>{resultadoSeleccionado.estado}</strong>
          </p>

          {parametros.length === 0 ? (
            <p>
              Este análisis no tiene parámetros configurados.
              Debes agregarlos desde la configuración de análisis.
            </p>
          ) : (
            <div className="vr-parametros">
              {parametros.map((parametro) => (
                <div
                  className="vr-parametro"
                  key={parametro.id}
                >
                  <h3>
                    {parametro.nombre ||
                      parametro.nombreParametro ||
                      parametro.id}
                  </h3>

                  <p>
                    Unidad:{" "}
                    <strong>{parametro.unidad || "-"}</strong>
                  </p>

                  <p>
                    Rango de referencia:{" "}
                    <strong>
                      {parametro.rangoReferencia ||
                        parametro.valorReferencia ||
                        "-"}
                    </strong>
                  </p>

                  <label>Valor obtenido *</label>

                  <input
                    type="text"
                    value={valores[parametro.id]?.valor || ""}
                    onChange={(e) =>
                      cambiarValor(
                        parametro.id,
                        "valor",
                        e.target.value
                      )
                    }
                    disabled={
                      !puedeEditar ||
                      resultadoSeleccionado.estado !== "borrador"
                    }
                  />

                  <label>Observaciones</label>

                  <textarea
                    rows={3}
                    value={
                      valores[parametro.id]?.observacion || ""
                    }
                    onChange={(e) =>
                      cambiarValor(
                        parametro.id,
                        "observacion",
                        e.target.value
                      )
                    }
                    disabled={
                      !puedeEditar ||
                      resultadoSeleccionado.estado !== "borrador"
                    }
                  />

                  {puedeEditar &&
                    resultadoSeleccionado.estado === "borrador" && (
                      <button
                        type="button"
                        disabled={guardando === parametro.id}
                        onClick={() =>
                          guardarParametro(parametro)
                        }
                      >
                        {guardando === parametro.id
                          ? "Guardando..."
                          : "Guardar parámetro"}
                      </button>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}