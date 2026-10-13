import { useCallback, useEffect, useMemo, useState } from "react";

import { listarEstadosAnalisis } from "../services/estadoAnalisisService";
import { listarMuestrasValidacion } from "../services/validacionMuestrasService";

import "./EstadoAnalisis.css";

export default function EstadoAnalisis({ usuario, onVolver }) {
  const [analisis, setAnalisis] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const laboratorioId = usuario?.laboratorioId;

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const [estados, muestrasConPacientes] = await Promise.all([
        listarEstadosAnalisis(laboratorioId),
        listarMuestrasValidacion(laboratorioId),
      ]);

      const datos = estados.map((item) => {
        const muestra = muestrasConPacientes.find(
          (m) => m.id === item.id
        );

        return {
          ...item,
          nombrePaciente:
            muestra?.nombrePaciente ||
            item.nombrePaciente ||
            "Paciente no encontrado",
        };
      });

      setAnalisis(datos);
    } catch (err) {
      console.error("HU-28:", err);
      setError(err.message || "No se pudieron cargar los análisis.");
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const datosFiltrados = useMemo(() => {
    return analisis.filter((item) => {
      const texto = [
        item.nombrePaciente,
        item.pacienteId,
        item.codigoEtiqueta,
        item.analisisNombre,
        item.analisisId,
        item.ordenId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = texto.includes(
        busqueda.trim().toLowerCase()
      );

      const coincideEstado =
        filtro === "todos" || item.estadoGeneral === filtro;

      return coincideBusqueda && coincideEstado;
    });
  }, [analisis, busqueda, filtro]);

  const estados = [
    "Muestra tomada",
    "Muestra aceptada",
    "Muestra rechazada",
    "En proceso",
    "Procesada",
    "Resultado registrado",
    "Resultado validado",
  ];

  return (
    <main className="ea-contenedor">
      <header className="ea-encabezado">
        <div>
          <h1>Estado de los análisis</h1>
          <p>Consulta el avance de los análisis clínicos.</p>
        </div>

        {onVolver && (
          <button type="button" onClick={onVolver}>
            Volver
          </button>
        )}
      </header>

      {error && <div className="ea-error">{error}</div>}

      <section className="ea-resumen">
        <div>
          <span>Total de muestras</span>
          <strong>{analisis.length}</strong>
        </div>

        <div>
          <span>En proceso</span>
          <strong>
            {
              analisis.filter(
                (item) => item.estadoGeneral === "En proceso"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Resultados registrados</span>
          <strong>
            {
              analisis.filter(
                (item) =>
                  item.estadoGeneral === "Resultado registrado"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Resultados validados</span>
          <strong>
            {
              analisis.filter(
                (item) =>
                  item.estadoGeneral === "Resultado validado"
              ).length
            }
          </strong>
        </div>
      </section>

      <section className="ea-panel">
        <div className="ea-filtros">
          <input
            type="text"
            placeholder="Buscar paciente, muestra, orden o análisis..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="todos">Todos los estados</option>

            {estados.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
          >
            Actualizar
          </button>
        </div>

        <div className="ea-tabla-contenedor">
          <table className="ea-tabla">
            <thead>
              <tr>
                <th>Muestra</th>
                <th>Paciente</th>
                <th>Análisis</th>
                <th>Orden</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="5">Cargando...</td>
                </tr>
              ) : datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5">No hay análisis disponibles.</td>
                </tr>
              ) : (
                datosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>{item.codigoEtiqueta || item.id}</td>
                    <td>{item.nombrePaciente}</td>
                    <td>
                      {item.analisisNombre ||
                        item.analisisId ||
                        "-"}
                    </td>
                    <td>{item.ordenId || "-"}</td>
                    <td>
                      <span
                        className={`ea-estado ${item.estadoGeneral
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {item.estadoGeneral}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}