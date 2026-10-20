import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cargarReportesLaboratorio,
} from "../services/adminSprint3Service";

import "./Sprint3.css";

function texto(valor) {
  return String(
    valor ?? ""
  ).trim();
}

function nombrePaciente(
  item
) {
  return (
    `${texto(
      item.nombres ??
        item.nombre
    )} ${texto(
      item.apellidos ??
        item.apellido
    )}`.trim() || "-"
  );
}

function columnas(tipo) {
  if (
    tipo === "pacientes"
  ) {
    return [
      "Paciente",
      "CI",
      "Teléfono",
      "Email",
    ];
  }

  if (
    tipo === "analisis"
  ) {
    return [
      "Análisis",
      "Tipo",
      "Precio",
      "Estado",
    ];
  }

  if (
    tipo === "ventas"
  ) {
    return [
      "Venta",
      "Paciente",
      "Total",
      "Estado",
    ];
  }

  if (
    tipo === "ordenes"
  ) {
    return [
      "Orden",
      "Paciente",
      "Total",
      "Estado",
    ];
  }

  return [
    "Resultado",
    "Paciente",
    "Análisis",
    "Estado",
  ];
}

function celdas(
  tipo,
  item
) {
  if (
    tipo === "pacientes"
  ) {
    return [
      nombrePaciente(
        item
      ),
      texto(
        item.ci
      ) || "-",
      texto(
        item.telefono
      ) || "-",
      texto(
        item.email
      ) || "-",
    ];
  }

  if (
    tipo === "analisis"
  ) {
    return [
      texto(
        item.nombre
      ) || "-",
      texto(
        item.tipo
      ) || "-",
      `Bs. ${Number(
        item.precio || 0
      ).toFixed(2)}`,
      item.activo === false
        ? "Inactivo"
        : "Activo",
    ];
  }

  if (
    tipo === "ventas"
  ) {
    return [
      item.ventaId ||
        item.id,
      item.pacienteId ||
        "-",
      `Bs. ${Number(
        item.total || 0
      ).toFixed(2)}`,
      item.estado ||
        "-",
    ];
  }

  if (
    tipo === "ordenes"
  ) {
    return [
      item.ordenId ||
        item.id,
      item.pacienteId ||
        "-",
      `Bs. ${Number(
        item.total || 0
      ).toFixed(2)}`,
      item.estado ||
        "-",
    ];
  }

  return [
    item.resultadoId ||
      item.id,
    item.pacienteId ||
      "-",
    item.analisisNombre ||
      item.analisisId ||
      "-",
    item.validado === true
      ? "validado"
      : item.estado ||
        "-",
  ];
}

export default function ReportesLaboratorio({
  usuario,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const [
    datos,
    setDatos,
  ] = useState({
    pacientes: [],
    analisis: [],
    ventas: [],
    ordenes: [],
    resultados: [],
  });

  const [
    tipo,
    setTipo,
  ] = useState(
    "pacientes"
  );

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    estado,
    setEstado,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const cargar = async () => {
    try {
      setCargando(true);
      setError("");

      setDatos(
        await cargarReportesLaboratorio(
          laboratorioId
        )
      );
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "No se pudieron cargar los reportes."
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

  const lista =
    useMemo(() => {
      const origen =
        datos[tipo] || [];

      const termino =
        texto(
          busqueda
        ).toLowerCase();

      const estadoFiltro =
        texto(
          estado
        ).toLowerCase();

      return origen.filter(
        (item) => {
          const contenido =
            JSON.stringify(
              item
            ).toLowerCase();

          if (
            termino &&
            !contenido.includes(
              termino
            )
          ) {
            return false;
          }

          if (
            estadoFiltro &&
            texto(
              item.estado
            ).toLowerCase() !==
              estadoFiltro
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      datos,
      tipo,
      busqueda,
      estado,
    ]);

  return (
    <div>
      <div className="s3-header">
        <div>
          <h2>
            Reportes del laboratorio
          </h2>

          <p>
            HU-34: pacientes,
            análisis, ventas, órdenes
            y resultados.
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

      <div className="s3-toolbar">
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(
              e.target.value
            );
            setEstado("");
          }}
        >
          <option value="pacientes">
            Pacientes
          </option>
          <option value="analisis">
            Análisis
          </option>
          <option value="ventas">
            Ventas
          </option>
          <option value="ordenes">
            Órdenes
          </option>
          <option value="resultados">
            Resultados
          </option>
        </select>

        <input
          value={busqueda}
          onChange={(e) =>
            setBusqueda(
              e.target.value
            )
          }
          placeholder="Buscar dentro del reporte"
        />

        {[
          "ventas",
          "ordenes",
          "resultados",
        ].includes(tipo) && (
          <input
            value={estado}
            onChange={(e) =>
              setEstado(
                e.target.value
              )
            }
            placeholder="Filtrar por estado exacto"
          />
        )}

        <span className="s3-muted">
          {lista.length} registro(s)
        </span>
      </div>

      {cargando ? (
        <div className="s3-empty">
          Cargando reporte...
        </div>
      ) : lista.length ===
        0 ? (
        <div className="s3-empty">
          No hay registros con
          los filtros actuales.
        </div>
      ) : (
        <div className="s3-table-wrap">
          <table className="s3-table">
            <thead>
              <tr>
                {columnas(
                  tipo
                ).map(
                  (columna) => (
                    <th
                      key={
                        columna
                      }
                    >
                      {columna}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {lista.map(
                (item) => (
                  <tr
                    key={
                      item.id
                    }
                  >
                    {celdas(
                      tipo,
                      item
                    ).map(
                      (
                        celda,
                        indice
                      ) => (
                        <td
                          key={
                            indice
                          }
                        >
                          {celda}
                        </td>
                      )
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
