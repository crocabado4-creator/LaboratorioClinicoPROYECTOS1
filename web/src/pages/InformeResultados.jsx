
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listarInformesFinalizados,
  obtenerLaboratorioInforme,
} from "../services/informeResultadosService";

import {
  generarPDFResultados,
} from "../services/pdfResultadosService";

import "./InformesResultados.css";

function texto(valor) {
  return String(valor ?? "").trim();
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  const nombreCompleto = texto(
    paciente.nombreCompleto
  );

  if (nombreCompleto) {
    return nombreCompleto;
  }

  const nombres = texto(
    paciente.nombres ?? paciente.nombre
  );

  const apellidos = texto(
    paciente.apellidos ?? paciente.apellido
  );

  return (
    [nombres, apellidos].filter(Boolean).join(" ") ||
    "Paciente no identificado"
  );
}

function ciPaciente(paciente) {
  return (
    texto(paciente?.ci ?? paciente?.carnet) ||
    "No registrado"
  );
}

function fechaVisible(valor) {
  if (!valor) {
    return "Sin fecha";
  }

  const fecha =
    typeof valor.toDate === "function"
      ? valor.toDate()
      : typeof valor.seconds === "number"
      ? new Date(valor.seconds * 1000)
      : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Sin fecha";
  }

  return fecha.toLocaleString("es-BO");
}

function mensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firebase rechazó una lectura necesaria. " +
      "Verifica los permisos de Firestore para " +
      "este laboratorio y tu rol."
    );
  }

  return (
    error?.message ||
    "No se pudieron cargar los informes de resultados."
  );
}

export default function InformeResultados({
  usuario,
  onVolver,
}) {
  const laboratorioId = texto(
    usuario?.laboratorioId
  );

  const [informes, setInformes] = useState([]);
  const [laboratorio, setLaboratorio] = useState(null);

  const [
    ordenSeleccionada,
    setOrdenSeleccionada,
  ] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "No se identificó el laboratorio del usuario."
      );

      setInformes([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [lista, datosLaboratorio] =
        await Promise.all([
          listarInformesFinalizados(laboratorioId),
          obtenerLaboratorioInforme(laboratorioId),
        ]);

      setInformes(lista);
      setLaboratorio(datosLaboratorio);

      setOrdenSeleccionada((actual) =>
        lista.some(
          (informe) => informe.ordenId === actual
        )
          ? actual
          : ""
      );
    } catch (e) {
      console.error(
        "Error al cargar informes:",
        e
      );

      setError(mensajeError(e));
      setInformes([]);
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const termino = texto(busqueda)
      .toLocaleLowerCase("es");

    if (!termino) {
      return informes;
    }

    return informes.filter((informe) => {
      const contenido = [
        nombrePaciente(informe.paciente),
        ciPaciente(informe.paciente),
        texto(informe.ordenId),
        ...(informe.resultados ?? []).map(
          (resultado) =>
            texto(resultado.analisisNombre)
        ),
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return contenido.includes(termino);
    });
  }, [informes, busqueda]);

  const seleccionado =
    informes.find(
      (informe) =>
        informe.ordenId === ordenSeleccionada
    ) ?? null;

  const totalAnalisis = informes.reduce(
    (suma, informe) =>
      suma + (informe.resultados?.length ?? 0),
    0
  );

  const descargarPDF = async () => {
    if (!seleccionado || generandoPDF) {
      return;
    }

    setError("");
    setGenerandoPDF(true);

    try {
      await generarPDFResultados({
        laboratorio,
        informe: seleccionado,
      });
    } catch (e) {
      console.error(
        "Error al generar PDF:",
        e
      );

      setError(
        e?.message ||
        "No se pudo generar el PDF."
      );
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <main className="ir-page">
      {/* ENCABEZADO */}

      <header className="ir-page-header">
        <div>
          <div className="ir-eyebrow">
            RESULTADOS CLÍNICOS
          </div>

          <h1>Informe de resultados</h1>

          <p>
            Consulta informes finalizados y genera
            el PDF para su entrega al paciente.
          </p>
        </div>

        <div className="ir-actions">
          <button
            type="button"
            className="ir-btn ir-btn-secondary"
            onClick={cargar}
            disabled={cargando}
          >
            {cargando
              ? "Actualizando..."
              : "Actualizar"}
          </button>

          <button
            type="button"
            className="ir-btn ir-btn-secondary"
            onClick={onVolver}
          >
            Volver
          </button>
        </div>
      </header>

      {/* ERRORES */}

      {error && (
        <div className="ir-alert" role="alert">
          {error}
        </div>
      )}

      {/* INDICADORES */}

      <section
        className="ir-summary"
        aria-label="Resumen de informes"
      >
        <div className="ir-summary-card">
          <span>Órdenes finalizadas</span>
          <strong>{informes.length}</strong>
        </div>

        <div className="ir-summary-card">
          <span>Análisis incluidos</span>
          <strong>{totalAnalisis}</strong>
        </div>
      </section>

      {/* BUSCADOR */}

      <section className="ir-panel ir-filters">
        <label htmlFor="ir-buscar-informe">
          Buscar informe
        </label>

        <div className="ir-filter-row">
          <input
            id="ir-buscar-informe"
            type="search"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            placeholder="Nombre, CI, orden o análisis"
          />

          <span className="ir-counter">
            {filtrados.length} informe(s)
          </span>
        </div>
      </section>

      {/* RESULTADOS */}

      {cargando ? (
        <div
          className="ir-panel ir-empty"
          role="status"
        >
          Cargando informes clínicos...
        </div>
      ) : error ? null : filtrados.length === 0 ? (
        <div className="ir-panel ir-empty">
          {informes.length === 0
            ? "No hay informes finalizados disponibles para este laboratorio."
            : "No se encontraron informes con esa búsqueda."}
        </div>
      ) : (
        <section className="ir-layout">
          {/* LISTADO DE INFORMES */}

          <div
            className="ir-list"
            aria-label="Informes disponibles"
          >
            {filtrados.map((informe) => (
              <article
                className={
                  "ir-panel ir-list-card " +
                  (ordenSeleccionada ===
                  informe.ordenId
                    ? "ir-selected"
                    : "")
                }
                key={informe.ordenId}
              >
                <div className="ir-card-top">
                  <h2>
                    {nombrePaciente(
                      informe.paciente
                    )}
                  </h2>

                  <span className="ir-status">
                    Finalizado
                  </span>
                </div>

                <p>
                  <strong>CI:</strong>{" "}
                  {ciPaciente(informe.paciente)}
                </p>

                <p>
                  <strong>Orden:</strong>{" "}
                  {informe.ordenId}
                </p>

                <p>
                  <strong>Análisis:</strong>{" "}
                  {informe.resultados?.length ?? 0}
                </p>

                <p className="ir-muted">
                  {fechaVisible(
                    informe.fechaValidacion
                  )}
                </p>

                <button
                  type="button"
                  className="ir-btn ir-btn-primary"
                  onClick={() =>
                    setOrdenSeleccionada(
                      informe.ordenId
                    )
                  }
                  aria-pressed={
                    ordenSeleccionada ===
                    informe.ordenId
                  }
                >
                  Ver informe
                </button>
              </article>
            ))}
          </div>

          {/* DETALLE DEL INFORME */}

          <div className="ir-panel ir-detail">
            {!seleccionado ? (
              <div className="ir-empty">
                Selecciona una orden para consultar
                su informe clínico.
              </div>
            ) : (
              <>
                <div className="ir-detail-header">
                  <div>
                    <div className="ir-eyebrow">
                      INFORME CLÍNICO
                    </div>

                    <h2>
                      {nombrePaciente(
                        seleccionado.paciente
                      )}
                    </h2>

                    <p className="ir-muted">
                      Orden: {seleccionado.ordenId}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="ir-btn ir-btn-primary"
                    onClick={descargarPDF}
                    disabled={generandoPDF}
                  >
                    {generandoPDF
                      ? "Generando..."
                      : "Generar PDF"}
                  </button>
                </div>

                {/* DATOS CLÍNICOS */}

                <div className="ir-patient-grid">
                  <div>
                    <span>Paciente</span>
                    <strong>
                      {nombrePaciente(
                        seleccionado.paciente
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Documento de identidad
                    </span>

                    <strong>
                      {ciPaciente(
                        seleccionado.paciente
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Fecha de validación
                    </span>

                    <strong>
                      {fechaVisible(
                        seleccionado.fechaValidacion
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Laboratorio</span>

                    <strong>
                      {texto(
                        laboratorio?.nombre ??
                        laboratorio?.nombreLaboratorio
                      ) || "Laboratorio clínico"}
                    </strong>
                  </div>
                </div>

                {/* ANÁLISIS */}

                {(seleccionado.resultados ?? []).map(
                  (resultado) => (
                    <section
                      className="ir-result"
                      key={resultado.id}
                    >
                      <div className="ir-result-header">
                        <h3>
                          {texto(
                            resultado.analisisNombre
                          ) || "Análisis clínico"}
                        </h3>

                        <span className="ir-status">
                          Validado
                        </span>
                      </div>

                      <div className="ir-table-scroll">
                        <table className="ir-table">
                          <thead>
                            <tr>
                              <th>Parámetro</th>
                              <th>Resultado</th>
                              <th>Unidad</th>
                              <th>Referencia</th>
                              <th>Observación</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(resultado.parametros ?? [])
                              .map((parametro, indice) => (
                                <tr
                                  key={
                                    resultado.id +
                                    "-" +
                                    (parametro.parametroId ??
                                    indice)
                                  }
                                >
                                  <td>
                                    {parametro.nombreParametro}
                                  </td>

                                  <td>
                                    <strong>
                                      {parametro.valor}
                                    </strong>
                                  </td>

                                  <td>
                                    {parametro.unidad}
                                  </td>

                                  <td>
                                    {parametro.rangoReferencia}
                                  </td>

                                  <td>
                                    {parametro.observacion ||
                                      "-"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="ir-muted ir-result-footer">
                        Validado por:{" "}
                        {texto(
                          resultado.validadoPorNombre ??
                          resultado.validadoPor
                        ) || "No especificado"}
                        {" · "}
                        {fechaVisible(
                          resultado.fechaValidacion
                        )}
                      </p>
                    </section>
                  )
                )}
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
