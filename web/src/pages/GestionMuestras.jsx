import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerPacientes,
} from "../services/pacientesService";

import {
  obtenerMuestras,
  obtenerOrdenesParaMuestras,
  registrarMuestra,
} from "../services/muestrasService";

import "./GestionMuestras.css";

function GestionMuestras({
  usuario,
  onVolver,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const bioquimicoId =
    usuario?.id ||
    usuario?.uid ||
    "";

  const [pacientes, setPacientes] =
    useState([]);

  const [ordenes, setOrdenes] =
    useState([]);

  const [muestras, setMuestras] =
    useState([]);

  const [ordenId, setOrdenId] =
    useState("");

  const [analisisId, setAnalisisId] =
    useState("");

  const [tipo, setTipo] =
    useState("");

  const [detalle, setDetalle] =
    useState(null);

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [error, setError] =
    useState("");

  const tiposMuestra = [
    "Sangre",
    "Suero",
    "Plasma",
    "Orina",
    "Heces",
    "Hisopado",
    "Otro",
  ];

  const formatearFecha =
    (fecha) => {
      if (!fecha) {
        return "Sin fecha";
      }

      if (
        typeof fecha.toDate ===
        "function"
      ) {
        return fecha
          .toDate()
          .toLocaleString(
            "es-BO"
          );
      }

      if (
        typeof fecha.seconds ===
        "number"
      ) {
        return new Date(
          fecha.seconds * 1000
        ).toLocaleString(
          "es-BO"
        );
      }

      return "Registrada";
    };

  const obtenerNombrePaciente =
    (idPaciente) => {
      const paciente =
        pacientes.find(
          (item) =>
            item.id === idPaciente ||
            item.pacienteId ===
              idPaciente
        );

      if (!paciente) {
        return idPaciente ||
          "Paciente";
      }

      return [
        paciente.nombres,
        paciente.apellidos,
      ]
        .filter(Boolean)
        .join(" ");
    };

  const cargarDatos =
    async () => {
      if (!laboratorioId) {
        setError(
          "El usuario no está asociado a un laboratorio."
        );

        setCargando(false);

        return;
      }

      try {
        setCargando(true);
        setError("");

        const [
          pacientesResultado,
          ordenesResultado,
          muestrasResultado,
        ] = await Promise.all([
          obtenerPacientes(
            laboratorioId
          ),

          obtenerOrdenesParaMuestras(
            laboratorioId
          ),

          obtenerMuestras(
            laboratorioId
          ),
        ]);

        setPacientes(
          Array.isArray(
            pacientesResultado
          )
            ? pacientesResultado
            : []
        );

        setOrdenes(
          Array.isArray(
            ordenesResultado
          )
            ? ordenesResultado
            : []
        );

        setMuestras(
          Array.isArray(
            muestrasResultado
          )
            ? muestrasResultado
            : []
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo cargar la información de muestras."
        );
      } finally {
        setCargando(false);
      }
    };

  useEffect(() => {
    cargarDatos();
  }, [laboratorioId]);

  const ordenSeleccionada =
    useMemo(() => {
      return ordenes.find(
        (orden) =>
          orden.id === ordenId ||
          orden.ordenId === ordenId
      ) || null;
    }, [
      ordenes,
      ordenId,
    ]);

  const analisisDisponibles =
    useMemo(() => {
      if (!ordenSeleccionada) {
        return [];
      }

      return (
        ordenSeleccionada.analisis ||
        []
      ).filter(
        (analisis) =>
          !muestras.some(
            (muestra) =>
              muestra.ordenId ===
                ordenSeleccionada.id &&
              muestra.analisisId ===
                analisis.analisisId
          )
      );
    }, [
      ordenSeleccionada,
      muestras,
    ]);

  useEffect(() => {
    setAnalisisId("");
    setTipo("");
  }, [ordenId]);

  const registrar =
    async () => {
      setMensaje("");
      setError("");

      if (!ordenId) {
        setError(
          "Debe seleccionar una orden."
        );

        return;
      }

      if (!analisisId) {
        setError(
          "Debe seleccionar un análisis."
        );

        return;
      }

      if (!tipo) {
        setError(
          "Debe seleccionar el tipo de muestra."
        );

        return;
      }

      try {
        setGuardando(true);

        const nueva =
          await registrarMuestra({
            laboratorioId,
            bioquimicoId,
            ordenId,
            analisisId,
            tipo,
          });

        await cargarDatos();

        setDetalle(
          nueva
        );

        setAnalisisId("");
        setTipo("");

        setMensaje(
          "Toma de muestra registrada y etiqueta generada correctamente."
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo registrar la muestra."
        );
      } finally {
        setGuardando(false);
      }
    };

  if (cargando) {
    return (
      <main className="gm-page">
        <section className="gm-card">
          <h2>
            Gestión de muestras
          </h2>
          <p>
            Cargando información...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="gm-page">
      <header className="gm-header">
        <div>
          {onVolver && (
            <button
              type="button"
              className="gm-back"
              onClick={onVolver}
            >
              ← Volver
            </button>
          )}

          <span className="gm-eyebrow">
            TOMA E IDENTIFICACIÓN
          </span>

          <h1>
            Gestión de muestras
          </h1>

          <p>
            Registra la toma de una muestra a partir de una orden existente
            y genera un identificador para su etiquetado.
          </p>
        </div>

        <div className="gm-header-icon">
          🧪
        </div>
      </header>

      {mensaje && (
        <div className="gm-message gm-success">
          ✓ {mensaje}
        </div>
      )}

      {error && (
        <div className="gm-message gm-error">
          ! {error}
        </div>
      )}

      <section className="gm-stats">
        <article>
          <span>
            ÓRDENES
          </span>
          <strong>
            {ordenes.length}
          </strong>
        </article>

        <article>
          <span>
            MUESTRAS TOMADAS
          </span>
          <strong>
            {muestras.length}
          </strong>
        </article>

        <article>
          <span>
            ANÁLISIS PENDIENTES EN ORDEN
          </span>
          <strong>
            {analisisDisponibles.length}
          </strong>
        </article>
      </section>

      <section className="gm-card">
        <div className="gm-card-head">
          <span>
            HU-22
          </span>

          <h2>
            Registrar toma de muestra
          </h2>

          <p>
            La muestra se asocia directamente a una orden,
            al paciente de esa orden y al análisis seleccionado.
          </p>
        </div>

        <div className="gm-grid">
          <div className="gm-field">
            <label>
              Orden de análisis
            </label>

            <select
              value={ordenId}
              onChange={(e) =>
                setOrdenId(
                  e.target.value
                )
              }
            >
              <option value="">
                Seleccione una orden
              </option>

              {ordenes.map(
                (orden) => (
                  <option
                    key={orden.id}
                    value={orden.id}
                  >
                    {orden.ordenId}
                    {" - "}
                    {obtenerNombrePaciente(
                      orden.pacienteId
                    )}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="gm-field">
            <label>
              Paciente
            </label>

            <input
              type="text"
              value={
                ordenSeleccionada
                  ? obtenerNombrePaciente(
                      ordenSeleccionada.pacienteId
                    )
                  : ""
              }
              placeholder="Se obtiene desde la orden"
              disabled
            />
          </div>

          <div className="gm-field">
            <label>
              Análisis
            </label>

            <select
              value={analisisId}
              disabled={
                !ordenSeleccionada
              }
              onChange={(e) =>
                setAnalisisId(
                  e.target.value
                )
              }
            >
              <option value="">
                Seleccione un análisis
              </option>

              {analisisDisponibles.map(
                (analisis) => (
                  <option
                    key={
                      analisis.analisisId
                    }
                    value={
                      analisis.analisisId
                    }
                  >
                    {analisis.nombre}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="gm-field">
            <label>
              Tipo de muestra
            </label>

            <select
              value={tipo}
              onChange={(e) =>
                setTipo(
                  e.target.value
                )
              }
            >
              <option value="">
                Seleccione el tipo
              </option>

              {tiposMuestra.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {ordenSeleccionada && (
          <div className="gm-order-summary">
            <div>
              <span>
                ORDEN
              </span>
              <strong>
                {ordenSeleccionada.ordenId}
              </strong>
            </div>

            <div>
              <span>
                SOLICITUD
              </span>
              <strong>
                {ordenSeleccionada.solicitudId}
              </strong>
            </div>

            <div>
              <span>
                PACIENTE
              </span>
              <strong>
                {obtenerNombrePaciente(
                  ordenSeleccionada.pacienteId
                )}
              </strong>
            </div>
          </div>
        )}

        <div className="gm-actions">
          <button
            type="button"
            className="gm-primary"
            disabled={
              guardando ||
              !ordenId ||
              !analisisId ||
              !tipo
            }
            onClick={registrar}
          >
            {guardando
              ? "Registrando..."
              : "Registrar toma y generar etiqueta"}
          </button>
        </div>
      </section>

      <section className="gm-card">
        <div className="gm-card-head">
          <span>
            HU-23
          </span>

          <h2>
            Muestras identificadas
          </h2>

          <p>
            Cada etiqueta permite reconocer al paciente,
            la orden y el análisis relacionado.
          </p>
        </div>

        {muestras.length === 0 ? (
          <div className="gm-empty">
            Todavía no existen muestras registradas.
          </div>
        ) : (
          <div className="gm-table-wrap">
            <table className="gm-table">
              <thead>
                <tr>
                  <th>
                    ETIQUETA
                  </th>
                  <th>
                    PACIENTE
                  </th>
                  <th>
                    ANÁLISIS
                  </th>
                  <th>
                    TIPO
                  </th>
                  <th>
                    FECHA
                  </th>
                  <th>
                    ACCIÓN
                  </th>
                </tr>
              </thead>

              <tbody>
                {muestras.map(
                  (muestra) => (
                    <tr
                      key={muestra.id}
                    >
                      <td>
                        <strong>
                          {muestra.codigoEtiqueta}
                        </strong>
                      </td>

                      <td>
                        {obtenerNombrePaciente(
                          muestra.pacienteId
                        )}
                      </td>

                      <td>
                        {muestra.analisisNombre}
                      </td>

                      <td>
                        {muestra.tipo}
                      </td>

                      <td>
                        {formatearFecha(
                          muestra.fechaToma
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="gm-detail-btn"
                          onClick={() =>
                            setDetalle(
                              muestra
                            )
                          }
                        >
                          Ver etiqueta
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalle && (
        <section className="gm-label">
          <div className="gm-label-head">
            <div>
              <span>
                ETIQUETA DE MUESTRA
              </span>

              <h2>
                {detalle.codigoEtiqueta}
              </h2>
            </div>

            <button
              type="button"
              className="gm-close"
              onClick={() =>
                setDetalle(null)
              }
            >
              Cerrar
            </button>
          </div>

          <div className="gm-label-code">
            {detalle.codigoEtiqueta}
          </div>

          <div className="gm-label-grid">
            <div>
              <span>
                PACIENTE
              </span>
              <strong>
                {obtenerNombrePaciente(
                  detalle.pacienteId
                )}
              </strong>
            </div>

            <div>
              <span>
                ORDEN
              </span>
              <strong>
                {detalle.ordenId}
              </strong>
            </div>

            <div>
              <span>
                ANÁLISIS
              </span>
              <strong>
                {detalle.analisisNombre}
              </strong>
            </div>

            <div>
              <span>
                TIPO
              </span>
              <strong>
                {detalle.tipo}
              </strong>
            </div>

            <div>
              <span>
                FECHA DE TOMA
              </span>
              <strong>
                {formatearFecha(
                  detalle.fechaToma
                )}
              </strong>
            </div>

            <div>
              <span>
                ESTADO
              </span>
              <strong>
                {detalle.estado}
              </strong>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default GestionMuestras;
