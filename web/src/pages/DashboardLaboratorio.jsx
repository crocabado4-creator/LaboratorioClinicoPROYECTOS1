import {
  useEffect,
  useState,
} from "react";

import {
  cargarDashboardLaboratorio,
  obtenerLaboratorioAdmin,
} from "../services/adminSprint3Service";

import "./Sprint3.css";

export default function DashboardLaboratorio({
  usuario,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const [datos, setDatos] =
    useState(null);

  const [
    laboratorio,
    setLaboratorio,
  ] = useState(null);

  const [error, setError] =
    useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const cargar = async () => {
    try {
      setCargando(true);
      setError("");

      const [
        metricas,
        lab,
      ] = await Promise.all([
        cargarDashboardLaboratorio(
          laboratorioId
        ),
        obtenerLaboratorioAdmin(
          laboratorioId
        ),
      ]);

      setDatos(metricas);
      setLaboratorio(lab);
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "No se pudo cargar el dashboard."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (laboratorioId) {
      cargar();
    }
  }, [laboratorioId]);

  if (cargando) {
    return (
      <div className="s3-empty">
        Cargando indicadores...
      </div>
    );
  }

  return (
    <div>
      <div className="s3-header">
        <div>
          <h2>
            Dashboard del laboratorio
          </h2>

          <p>
            {laboratorio?.nombreVisible ||
              laboratorio?.nombre ||
              "Laboratorio"}
          </p>
        </div>

        <button
          className="s3-button secondary"
          type="button"
          onClick={cargar}
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="s3-error">
          {error}
        </div>
      )}

      {datos && (
        <>
          <div className="s3-grid">
            <div className="s3-stat">
              <span>
                Pacientes
              </span>
              <strong>
                {
                  datos.pacientes
                }
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Análisis
              </span>
              <strong>
                {
                  datos.analisis
                }
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Ventas
              </span>
              <strong>
                {
                  datos.ventas
                }
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Total vendido
              </span>
              <strong>
                Bs.{" "}
                {datos.totalVentas.toFixed(
                  2
                )}
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Órdenes
              </span>
              <strong>
                {
                  datos.ordenes
                }
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Resultados finalizados
              </span>
              <strong>
                {
                  datos
                    .resultadosFinalizados
                }
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Resultados pendientes
              </span>
              <strong>
                {
                  datos
                    .resultadosPendientes
                }
              </strong>
            </div>

            <div className="s3-stat">
              <span>
                Muestras pendientes
              </span>
              <strong>
                {
                  datos
                    .muestrasPendientes
                }
              </strong>
            </div>
          </div>

          <div className="s3-section">
            <h3>
              Órdenes recientes
            </h3>

            {datos.ordenesRecientes
              .length === 0 ? (
              <div className="s3-empty">
                No hay órdenes
                registradas.
              </div>
            ) : (
              datos.ordenesRecientes.map(
                (orden) => (
                  <div
                    className="s3-card"
                    key={orden.id}
                  >
                    <p>
                      <strong>
                        Orden:
                      </strong>{" "}
                      {orden.ordenId ||
                        orden.id}
                    </p>

                    <p>
                      <strong>
                        Paciente:
                      </strong>{" "}
                      {orden.pacienteId ||
                        "-"}
                    </p>

                    <p>
                      <strong>
                        Estado:
                      </strong>{" "}
                      {orden.estado ||
                        "-"}
                    </p>

                    <p>
                      <strong>
                        Total:
                      </strong>{" "}
                      Bs.{" "}
                      {Number(
                        orden.total ||
                          0
                      ).toFixed(
                        2
                      )}
                    </p>
                  </div>
                )
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
