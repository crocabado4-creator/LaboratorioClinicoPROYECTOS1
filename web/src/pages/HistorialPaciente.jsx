import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerHistorialPaciente,
} from "../services/historialPacienteService";

import "./HistorialPaciente.css";


function HistorialPaciente({
  paciente,
  usuario,
  permisos = [],
  volver,
}) {

  // ===================================================
  // PERMISOS
  // ===================================================

  const puedeVerHistorial =
    permisos.includes(
      "resultados.ver"
    );


  // ===================================================
  // ESTADOS
  // ===================================================

  const [
    solicitudes,
    setSolicitudes,
  ] = useState([]);


  const [
    resultados,
    setResultados,
  ] = useState([]);


  const [
    cargando,
    setCargando,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  // ===================================================
  // CARGAR
  // ===================================================

  useEffect(() => {

    cargarHistorial();

  }, [
    paciente?.id,
    usuario?.laboratorioId,
  ]);


  const cargarHistorial =
    async () => {

      try {

        setCargando(true);

        setError("");


        if (!paciente?.id) {
          throw new Error(
            "No se pudo identificar al paciente."
          );
        }


        if (
          !usuario?.laboratorioId
        ) {
          throw new Error(
            "No se pudo identificar el laboratorio."
          );
        }


        if (
          !puedeVerHistorial
        ) {
          throw new Error(
            "No tienes permiso para consultar el historial clínico."
          );
        }


        const historial =
          await obtenerHistorialPaciente(
            usuario.laboratorioId,
            paciente.id
          );


        setSolicitudes(
          historial.solicitudes ||
          []
        );


        setResultados(
          historial.resultados ||
          []
        );

      } catch (error) {

        console.error(
          "Error cargando historial:",
          error
        );


        setError(
          error?.message ||
          "No se pudo cargar el historial del paciente."
        );

      } finally {

        setCargando(false);
      }
    };


  // ===================================================
  // TOTAL DE ANÁLISIS
  // ===================================================

  const totalAnalisis =
    useMemo(
      () =>
        solicitudes.reduce(
          (
            total,
            solicitud
          ) =>
            total +
            (
              Array.isArray(
                solicitud.analisis
              )
                ? solicitud
                    .analisis
                    .reduce(
                      (
                        acumulado,
                        analisis
                      ) =>
                        acumulado +
                        Number(
                          analisis.cantidad ||
                          1
                        ),
                      0
                    )
                : 0
            ),
          0
        ),
      [solicitudes]
    );


  // ===================================================
  // UI CARGANDO
  // ===================================================

  if (cargando) {

    return (
      <main className="hp-page">

        <div className="hp-loading">

          <div className="hp-spinner" />

          <h2>
            Historial del paciente
          </h2>

          <p>
            Consultando solicitudes y resultados...
          </p>

        </div>

      </main>
    );
  }


  // ===================================================
  // UI
  // ===================================================

  return (
    <main className="hp-page">

      <div className="hp-container">

        {/* =============================================
            VOLVER
        ============================================= */}

        <button
          type="button"
          className="hp-back"
          onClick={() => {
            if (
              typeof volver ===
              "function"
            ) {
              volver();
            }
          }}
        >
          ← Volver a pacientes
        </button>


        {/* =============================================
            CABECERA
        ============================================= */}

        <section className="hp-header">

          <div>

            <span className="hp-eyebrow">
              HISTORIAL CLÍNICO
            </span>


            <h1>
              Historial del paciente
            </h1>


            <p>
              Consulta las solicitudes, análisis y resultados anteriores asociados al paciente.
            </p>

          </div>


          <div className="hp-header-icon">
            📋
          </div>

        </section>


        {/* =============================================
            PACIENTE
        ============================================= */}

        <section className="hp-patient">

          <div className="hp-avatar">

            {obtenerIniciales(
              paciente
            )}

          </div>


          <div className="hp-patient-info">

            <span>
              PACIENTE
            </span>

            <h2>

              {paciente.nombres}{" "}
              {paciente.apellidos}

            </h2>

            <p>
              CI:{" "}
              <strong>
                {paciente.ci}
              </strong>

              {" · "}

              Fecha de nacimiento:{" "}

              <strong>
                {formatearFechaSimple(
                  paciente.fechaNacimiento
                )}
              </strong>
            </p>

          </div>

        </section>


        {/* =============================================
            ERROR
        ============================================= */}

        {error && (
          <div className="hp-error">
            ⚠ {error}
          </div>
        )}


        {/* =============================================
            ESTADÍSTICAS
        ============================================= */}

        {!error && (
          <section className="hp-stats">

            <Stat
              icono="📝"
              titulo="Solicitudes"
              valor={
                solicitudes.length
              }
            />


            <Stat
              icono="🧪"
              titulo="Análisis solicitados"
              valor={
                totalAnalisis
              }
            />


            <Stat
              icono="📊"
              titulo="Resultados"
              valor={
                resultados.length
              }
            />

          </section>
        )}


        {/* =============================================
            SIN HISTORIAL
        ============================================= */}

        {!error &&
          solicitudes.length ===
            0 &&
          resultados.length ===
            0 && (

            <section className="hp-empty">

              <div>
                🗂️
              </div>

              <h3>
                El paciente todavía no tiene historial
              </h3>

              <p>
                Cuando se registren solicitudes y resultados aparecerán en esta sección.
              </p>

            </section>
          )}


        {/* =============================================
            SOLICITUDES
        ============================================= */}

        {!error &&
          solicitudes.length >
            0 && (

            <section className="hp-section">

              <div className="hp-section-title">

                <div>

                  <span>
                    REGISTROS ANTERIORES
                  </span>

                  <h2>
                    Solicitudes de análisis
                  </h2>

                </div>


                <strong>
                  {
                    solicitudes.length
                  }
                </strong>

              </div>


              <div className="hp-timeline">

                {solicitudes.map(
                  (
                    solicitud,
                    indice
                  ) => {

                    const resultadosSolicitud =
                      resultados.filter(
                        (
                          resultado
                        ) =>
                          resultado
                            .solicitudId ===
                          solicitud
                            .solicitudId
                      );


                    return (
                      <article
                        key={
                          solicitud.id
                        }
                        className="hp-history-card"
                      >

                        {/* CABECERA */}

                        <div className="hp-card-header">

                          <div className="hp-card-number">
                            {indice + 1}
                          </div>


                          <div className="hp-card-header-info">

                            <h3>
                              Solicitud{" "}
                              {acortarId(
                                solicitud
                                  .solicitudId
                              )}
                            </h3>

                            <span>
                              {formatearFecha(
                                solicitud.fecha
                              )}
                            </span>

                          </div>


                          <Estado
                            estado={
                              solicitud.estado
                            }
                          />

                        </div>


                        {/* INFORMACIÓN */}

                        <div className="hp-request-info">

                          <div>

                            <span>
                              Total
                            </span>

                            <strong>
                              Bs{" "}
                              {Number(
                                solicitud.total ||
                                0
                              ).toFixed(
                                2
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Análisis
                            </span>

                            <strong>
                              {
                                solicitud
                                  .analisis
                                  .length
                              }
                            </strong>

                          </div>


                          <div>

                            <span>
                              Resultados
                            </span>

                            <strong>
                              {
                                resultadosSolicitud
                                  .length
                              }
                            </strong>

                          </div>

                        </div>


                        {/* ANÁLISIS */}

                        <div className="hp-analysis-section">

                          <h4>
                            Análisis solicitados
                          </h4>


                          {solicitud
                            .analisis
                            .length ===
                          0 ? (

                            <p className="hp-muted">
                              Esta solicitud no contiene análisis registrados.
                            </p>

                          ) : (

                            <div className="hp-analysis-list">

                              {solicitud.analisis.map(
                                (
                                  analisis,
                                  index
                                ) => {

                                  const resultado =
                                    resultadosSolicitud.find(
                                      (
                                        item
                                      ) =>
                                        item.analisisId ===
                                        analisis.analisisId
                                    );


                                  return (
                                    <div
                                      key={
                                        analisis.analisisId ||
                                        index
                                      }
                                      className="hp-analysis-row"
                                    >

                                      <div>

                                        <strong>
                                          {
                                            analisis.nombre ||
                                            "Análisis clínico"
                                          }
                                        </strong>

                                        <span>

                                          Cantidad:{" "}

                                          {
                                            analisis.cantidad ||
                                            1
                                          }

                                          {" · "}

                                          Bs{" "}

                                          {Number(
                                            analisis.subtotal ??
                                            analisis.precio ??
                                            0
                                          ).toFixed(
                                            2
                                          )}

                                        </span>

                                      </div>


                                      {resultado ? (

                                        <span className="hp-result-available">
                                          Resultado disponible
                                        </span>

                                      ) : (

                                        <span className="hp-result-pending">
                                          Sin resultado
                                        </span>

                                      )}

                                    </div>
                                  );
                                }
                              )}

                            </div>
                          )}

                        </div>


                        {/* RESULTADOS */}

                        {resultadosSolicitud
                          .length >
                          0 && (

                          <div className="hp-results-section">

                            <h4>
                              Resultados registrados
                            </h4>


                            {resultadosSolicitud.map(
                              (
                                resultado
                              ) => (

                                <Resultado
                                  key={
                                    resultado.id
                                  }
                                  resultado={
                                    resultado
                                  }
                                  solicitud={
                                    solicitud
                                  }
                                />

                              )
                            )}

                          </div>
                        )}

                      </article>
                    );
                  }
                )}

              </div>

            </section>
          )}


        {/* =============================================
            RESULTADOS SIN SOLICITUD ENCONTRADA
        ============================================= */}

        {!error && (
          <ResultadosSinSolicitud
            solicitudes={
              solicitudes
            }
            resultados={
              resultados
            }
          />
        )}

      </div>

    </main>
  );
}


// =====================================================
// RESULTADO
// =====================================================

function Resultado({
  resultado,
  solicitud,
}) {

  const analisis =
    solicitud.analisis.find(
      (item) =>
        item.analisisId ===
        resultado.analisisId
    );


  return (
    <div className="hp-result-card">

      <div className="hp-result-header">

        <div>

          <span>
            ANÁLISIS
          </span>

          <strong>
            {analisis?.nombre ||
              resultado.analisisId ||
              "Resultado clínico"}
          </strong>

        </div>


        <Estado
          estado={
            resultado.estado
          }
        />

      </div>


      <div className="hp-values">

        {resultado.valores.length >
        0 ? (

          resultado.valores.map(
            (
              valor,
              indice
            ) => (

              <div
                key={indice}
                className="hp-value"
              >

                <span>
                  {obtenerNombreValor(
                    valor,
                    indice
                  )}
                </span>

                <strong>
                  {obtenerValor(
                    valor
                  )}
                </strong>

              </div>

            )
          )

        ) : (

          <p className="hp-muted">
            No existen valores registrados.
          </p>
        )}

      </div>


      {resultado.observaciones && (

        <div className="hp-observation">

          <span>
            Observaciones
          </span>

          <p>
            {
              resultado.observaciones
            }
          </p>

        </div>
      )}


      <small className="hp-result-date">
        Registrado:{" "}
        {formatearFecha(
          resultado.fechaRegistro
        )}
      </small>

    </div>
  );
}


// =====================================================
// RESULTADOS HUÉRFANOS
// =====================================================

function ResultadosSinSolicitud({
  solicitudes,
  resultados,
}) {

  const ids =
    solicitudes.map(
      (item) =>
        item.solicitudId
    );


  const sinSolicitud =
    resultados.filter(
      (resultado) =>
        !ids.includes(
          resultado.solicitudId
        )
    );


  if (
    sinSolicitud.length ===
    0
  ) {
    return null;
  }


  return (
    <section className="hp-section">

      <div className="hp-section-title">

        <div>

          <span>
            RESULTADOS
          </span>

          <h2>
            Otros resultados asociados
          </h2>

        </div>

      </div>


      <div className="hp-orphan-results">

        {sinSolicitud.map(
          (resultado) => (

            <div
              key={
                resultado.id
              }
              className="hp-result-card"
            >

              <strong>
                {resultado.analisisId ||
                  "Resultado clínico"}
              </strong>


              <Estado
                estado={
                  resultado.estado
                }
              />


              <small>
                {formatearFecha(
                  resultado.fechaRegistro
                )}
              </small>

            </div>

          )
        )}

      </div>

    </section>
  );
}


// =====================================================
// STAT
// =====================================================

function Stat({
  icono,
  titulo,
  valor,
}) {

  return (
    <article className="hp-stat">

      <div>
        {icono}
      </div>

      <section>

        <span>
          {titulo}
        </span>

        <strong>
          {valor}
        </strong>

      </section>

    </article>
  );
}


// =====================================================
// ESTADO
// =====================================================

function Estado({
  estado,
}) {

  const texto =
    String(
      estado ||
      "pendiente"
    );


  const normalizado =
    texto.toLowerCase();


  let clase =
    "hp-status-pending";


  if (
    normalizado.includes(
      "final"
    ) ||
    normalizado.includes(
      "complet"
    ) ||
    normalizado.includes(
      "entreg"
    )
  ) {
    clase =
      "hp-status-success";
  }


  if (
    normalizado.includes(
      "proceso"
    )
  ) {
    clase =
      "hp-status-process";
  }


  if (
    normalizado.includes(
      "rechaz"
    ) ||
    normalizado.includes(
      "cancel"
    )
  ) {
    clase =
      "hp-status-error";
  }


  return (
    <span
      className={`hp-status ${clase}`}
    >
      {texto}
    </span>
  );
}


// =====================================================
// VALORES
// =====================================================

function obtenerNombreValor(
  valor,
  indice
) {

  if (
    valor &&
    typeof valor ===
    "object"
  ) {

    return (
      valor.nombre ||
      valor.parametro ||
      valor.descripcion ||
      `Parámetro ${indice + 1}`
    );
  }


  return `Valor ${indice + 1}`;
}


function obtenerValor(
  valor
) {

  if (
    valor === null ||
    valor === undefined
  ) {
    return "Sin valor";
  }


  if (
    typeof valor !==
    "object"
  ) {
    return String(
      valor
    );
  }


  const dato =
    valor.valor ??
    valor.resultado ??
    valor.value ??
    "";


  const unidad =
    valor.unidad ||
    "";


  if (
    dato === ""
  ) {
    return "Sin valor";
  }


  return `${dato}${
    unidad
      ? ` ${unidad}`
      : ""
  }`;
}


// =====================================================
// FORMATEAR FECHA
// =====================================================

function formatearFecha(
  valor
) {

  if (!valor) {
    return "Sin fecha";
  }


  try {

    if (
      typeof valor.toDate ===
      "function"
    ) {

      return valor
        .toDate()
        .toLocaleString(
          "es-BO"
        );
    }


    if (
      valor.seconds
    ) {

      return new Date(
        valor.seconds *
        1000
      ).toLocaleString(
        "es-BO"
      );
    }


    return new Date(
      valor
    ).toLocaleString(
      "es-BO"
    );

  } catch {

    return "Sin fecha";
  }
}


function formatearFechaSimple(
  fecha
) {

  if (!fecha) {
    return "Sin información";
  }


  const partes =
    String(
      fecha
    ).split("-");


  if (
    partes.length !==
    3
  ) {
    return fecha;
  }


  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}


// =====================================================
// ID
// =====================================================

function acortarId(
  id
) {

  if (!id) {
    return "";
  }


  if (
    id.length <=
    10
  ) {
    return id;
  }


  return `${id.slice(
    0,
    8
  )}...`;
}


// =====================================================
// INICIALES
// =====================================================

function obtenerIniciales(
  paciente
) {

  const nombre =
    paciente?.nombres
      ?.trim()
      ?.charAt(0) ||
    "";


  const apellido =
    paciente?.apellidos
      ?.trim()
      ?.charAt(0) ||
    "";


  return (
    `${nombre}${apellido}`
      .toUpperCase() ||
    "P"
  );
}


export default HistorialPaciente;