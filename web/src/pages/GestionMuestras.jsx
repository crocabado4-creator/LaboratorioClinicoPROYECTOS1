import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import "./GestionMuestras.css";


function limpiarTexto(
  valor
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(
    valor
  ).trim();
}


function normalizarClaveOrden(
  valor
) {
  let texto =
    limpiarTexto(
      valor
    ).toLowerCase();


  if (
    texto.startsWith(
      "ordenes_"
    )
  ) {
    texto =
      texto.replace(
        "ordenes_",
        "orden_"
      );
  }


  return texto;
}


function normalizarAnalisis(
  valor
) {
  if (
    !Array.isArray(
      valor
    )
  ) {
    return [];
  }


  return valor
    .map(
      (
        item
      ) => {
        if (
          !item ||
          typeof item !==
            "object"
        ) {
          return null;
        }


        const analisisId =
          limpiarTexto(
            item.analisisId
          ) ||
          limpiarTexto(
            item.id
          );


        if (
          !analisisId
        ) {
          return null;
        }


        return {
          analisisId,

          nombre:
            limpiarTexto(
              item.nombre
            ) ||
            limpiarTexto(
              item.analisisNombre
            ) ||
            analisisId,

          estado:
            limpiarTexto(
              item.estado
            ) ||
            "pendiente",

          precio:
            Number(
              item.precio ||
              0
            ),

          cantidad:
            Number(
              item.cantidad ||
              1
            ),

          subtotal:
            Number(
              item.subtotal ||
              0
            ),
        };
      }
    )
    .filter(Boolean);
}


function normalizarOrden(
  documento
) {
  const datos =
    documento.data();


  return {
    id:
      documento.id,

    ordenId:
      limpiarTexto(
        datos.ordenId
      ) ||
      documento.id,

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    ventaId:
      limpiarTexto(
        datos.ventaId
      ),

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ),

    empleadoId:
      limpiarTexto(
        datos.empleadoId
      ),

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "pendiente",

    fecha:
      datos.fecha ||
      datos.fechaGeneracion ||
      null,

    total:
      Number(
        datos.total ||
        0
      ),

    analisis:
      normalizarAnalisis(
        datos.analisis
      ),
  };
}


function normalizarPaciente(
  documento
) {
  const datos =
    documento.data();


  return {
    id:
      documento.id,

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ) ||
      documento.id,

    nombres:
      limpiarTexto(
        datos.nombres
      ) ||
      limpiarTexto(
        datos.nombre
      ),

    apellidos:
      limpiarTexto(
        datos.apellidos
      ) ||
      limpiarTexto(
        datos.apellido
      ),

    nombreCompleto:
      limpiarTexto(
        datos.nombreCompleto
      ),

    ci:
      limpiarTexto(
        datos.ci
      ),

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),
  };
}


function normalizarMuestra(
  documento
) {
  const datos =
    documento.data();


  return {
    id:
      documento.id,

    muestraId:
      limpiarTexto(
        datos.muestraId
      ) ||
      documento.id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    ordenId:
      limpiarTexto(
        datos.ordenId
      ),

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ),

    analisisId:
      limpiarTexto(
        datos.analisisId
      ),

    analisisNombre:
      limpiarTexto(
        datos.analisisNombre
      ),

    tipo:
      limpiarTexto(
        datos.tipo
      ) ||
      limpiarTexto(
        datos.tipoMuestra
      ),

    tipoMuestra:
      limpiarTexto(
        datos.tipoMuestra
      ) ||
      limpiarTexto(
        datos.tipo
      ),

    codigoEtiqueta:
      limpiarTexto(
        datos.codigoEtiqueta
      ) ||
      limpiarTexto(
        datos.codigoMuestra
      ) ||
      limpiarTexto(
        datos.muestraId
      ) ||
      documento.id,

    codigoMuestra:
      limpiarTexto(
        datos.codigoMuestra
      ) ||
      limpiarTexto(
        datos.codigoEtiqueta
      ),

    bioquimicoId:
      limpiarTexto(
        datos.bioquimicoId
      ),

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "tomada",

    aceptada:
      datos.aceptada ===
      true,

    motivoRechazo:
      limpiarTexto(
        datos.motivoRechazo
      ),

    fechaToma:
      datos.fechaToma ||
      null,
  };
}


function fechaMilisegundos(
  fecha
) {
  if (
    !fecha
  ) {
    return 0;
  }


  if (
    typeof fecha.toMillis ===
    "function"
  ) {
    return fecha.toMillis();
  }


  if (
    typeof fecha.seconds ===
    "number"
  ) {
    return (
      fecha.seconds *
      1000
    );
  }


  if (
    fecha instanceof Date
  ) {
    return fecha.getTime();
  }


  return 0;
}


function generarCodigoMuestra() {
  const fecha =
    new Date();


  const anio =
    fecha.getFullYear();


  const mes =
    String(
      fecha.getMonth() +
      1
    ).padStart(
      2,
      "0"
    );


  const dia =
    String(
      fecha.getDate()
    ).padStart(
      2,
      "0"
    );


  const aleatorio =
    Math.floor(
      1000 +
      Math.random() *
      9000
    );


  return `MUE-${anio}${mes}${dia}-${aleatorio}`;
}


function GestionMuestras({
  usuario,
  onVolver,
}) {
  const laboratorioId =
    limpiarTexto(
      usuario?.laboratorioId
    );


  const bioquimicoId =
    limpiarTexto(
      usuario?.id
    ) ||
    limpiarTexto(
      usuario?.uid
    );


  const [
    pacientes,
    setPacientes,
  ] =
    useState([]);


  const [
    ordenes,
    setOrdenes,
  ] =
    useState([]);


  const [
    muestras,
    setMuestras,
  ] =
    useState([]);


  const [
    ordenId,
    setOrdenId,
  ] =
    useState("");


  const [
    analisisId,
    setAnalisisId,
  ] =
    useState("");


  const [
    tipo,
    setTipo,
  ] =
    useState("");


  const [
    detalle,
    setDetalle,
  ] =
    useState(null);


  const [
    cargando,
    setCargando,
  ] =
    useState(true);


  const [
    guardando,
    setGuardando,
  ] =
    useState(false);


  const [
    mensaje,
    setMensaje,
  ] =
    useState("");


  const [
    error,
    setError,
  ] =
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
    (
      fecha
    ) => {
      if (
        !fecha
      ) {
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
          fecha.seconds *
          1000
        ).toLocaleString(
          "es-BO"
        );
      }


      if (
        fecha instanceof Date
      ) {
        return fecha
          .toLocaleString(
            "es-BO"
          );
      }


      return "Registrada";
    };


  const obtenerNombrePaciente =
    (
      pacienteId
    ) => {
      const id =
        limpiarTexto(
          pacienteId
        );


      if (
        !id
      ) {
        return "Sin paciente";
      }


      const paciente =
        pacientes.find(
          (
            item
          ) =>
            item.id ===
              id ||
            item.pacienteId ===
              id
        );


      if (
        !paciente
      ) {
        /*
         * Nunca dejamos el campo vacío.
         * Si todavía no encuentra el documento,
         * mostramos el ID real de la orden.
         */
        return id;
      }


      if (
        paciente.nombreCompleto
      ) {
        return paciente
          .nombreCompleto;
      }


      const nombre =
        [
          paciente.nombres,
          paciente.apellidos,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();


      return (
        nombre ||
        id
      );
    };


  const mismaOrden =
    (
      muestra,
      orden
    ) => {
      if (
        !muestra ||
        !orden
      ) {
        return false;
      }


      const claveMuestra =
        normalizarClaveOrden(
          muestra.ordenId
        );


      const claveDocumento =
        normalizarClaveOrden(
          orden.id
        );


      const claveOrden =
        normalizarClaveOrden(
          orden.ordenId
        );


      return (
        claveMuestra !== "" &&
        (
          claveMuestra ===
            claveDocumento ||
          claveMuestra ===
            claveOrden
        )
      );
    };


  const cargarDatos =
    async () => {
      if (
        !laboratorioId
      ) {
        setError(
          "El usuario no está asociado a un laboratorio."
        );

        setCargando(
          false
        );

        return;
      }


      try {
        setCargando(
          true
        );

        setError(
          ""
        );


        const consultaPacientes =
          query(
            collection(
              db,
              "pacientes"
            ),
            where(
              "laboratorioId",
              "==",
              laboratorioId
            )
          );


        const consultaOrdenes =
          query(
            collection(
              db,
              "ordenes"
            ),
            where(
              "laboratorioId",
              "==",
              laboratorioId
            )
          );


        const consultaMuestras =
          query(
            collection(
              db,
              "muestras"
            ),
            where(
              "laboratorioId",
              "==",
              laboratorioId
            )
          );


        const [
          pacientesSnapshot,
          ordenesSnapshot,
          muestrasSnapshot,
        ] =
          await Promise.all([
            getDocs(
              consultaPacientes
            ),

            getDocs(
              consultaOrdenes
            ),

            getDocs(
              consultaMuestras
            ),
          ]);


        const listaPacientes =
          pacientesSnapshot.docs
            .map(
              normalizarPaciente
            );


        const listaOrdenes =
          ordenesSnapshot.docs
            .map(
              normalizarOrden
            )
            .sort(
              (
                a,
                b
              ) =>
                fechaMilisegundos(
                  b.fecha
                ) -
                fechaMilisegundos(
                  a.fecha
                )
            );


        const listaMuestras =
          muestrasSnapshot.docs
            .map(
              normalizarMuestra
            )
            .sort(
              (
                a,
                b
              ) =>
                fechaMilisegundos(
                  b.fechaToma
                ) -
                fechaMilisegundos(
                  a.fechaToma
                )
            );


        setPacientes(
          listaPacientes
        );


        setOrdenes(
          listaOrdenes
        );


        setMuestras(
          listaMuestras
        );

      } catch (
        err
      ) {
        console.error(
          "Error cargando Gestión de Muestras:",
          err
        );


        setError(
          err?.message ||
          "No se pudo cargar la información de muestras."
        );

      } finally {
        setCargando(
          false
        );
      }
    };


  useEffect(
    () => {
      cargarDatos();
    },
    [
      laboratorioId,
    ]
  );


  const ordenSeleccionada =
    useMemo(
      () => {
        return (
          ordenes.find(
            (
              orden
            ) =>
              orden.id ===
                ordenId ||
              orden.ordenId ===
                ordenId
          ) ||
          null
        );
      },
      [
        ordenes,
        ordenId,
      ]
    );


  const analisisOrden =
    useMemo(
      () => {
        if (
          !ordenSeleccionada
        ) {
          return [];
        }


        return Array.isArray(
          ordenSeleccionada
            .analisis
        )
          ? ordenSeleccionada
              .analisis
          : [];
      },
      [
        ordenSeleccionada,
      ]
    );


  const muestraYaTomada =
    (
      idAnalisis
    ) => {
      if (
        !ordenSeleccionada
      ) {
        return false;
      }


      return muestras.some(
        (
          muestra
        ) =>
          mismaOrden(
            muestra,
            ordenSeleccionada
          ) &&
          muestra.analisisId ===
            idAnalisis
      );
    };


  const analisisDisponibles =
    useMemo(
      () => {
        if (
          !ordenSeleccionada
        ) {
          return [];
        }


        return analisisOrden.filter(
          (
            analisis
          ) =>
            !muestras.some(
              (
                muestra
              ) =>
                mismaOrden(
                  muestra,
                  ordenSeleccionada
                ) &&
                muestra.analisisId ===
                  analisis.analisisId
            )
        );
      },
      [
        analisisOrden,
        muestras,
        ordenSeleccionada,
      ]
    );


  useEffect(
    () => {
      setAnalisisId(
        ""
      );

      setTipo(
        ""
      );
    },
    [
      ordenId,
    ]
  );


  const obtenerNombreAnalisisMuestra =
    (
      muestra
    ) => {
      if (
        muestra
          .analisisNombre
      ) {
        return muestra
          .analisisNombre;
      }


      const orden =
        ordenes.find(
          (
            item
          ) =>
            mismaOrden(
              muestra,
              item
            )
        );


      if (
        orden
      ) {
        const analisis =
          orden.analisis.find(
            (
              item
            ) =>
              item.analisisId ===
              muestra.analisisId
          );


        if (
          analisis
        ) {
          return analisis.nombre;
        }
      }


      return (
        muestra.analisisId ||
        "Análisis"
      );
    };


  const registrar =
    async () => {
      setMensaje(
        ""
      );

      setError(
        ""
      );


      if (
        !ordenSeleccionada
      ) {
        setError(
          "Debe seleccionar una orden."
        );

        return;
      }


      if (
        !analisisId
      ) {
        setError(
          "Debe seleccionar un análisis."
        );

        return;
      }


      if (
        muestraYaTomada(
          analisisId
        )
      ) {
        setError(
          "Este análisis ya tiene una muestra registrada."
        );

        return;
      }


      if (
        !tipo
      ) {
        setError(
          "Debe seleccionar el tipo de muestra."
        );

        return;
      }


      if (
        !ordenSeleccionada
          .pacienteId
      ) {
        setError(
          "La orden seleccionada no tiene paciente."
        );

        return;
      }


      if (
        !bioquimicoId
      ) {
        setError(
          "No se pudo identificar al Bioquímico."
        );

        return;
      }


      const analisis =
        analisisOrden.find(
          (
            item
          ) =>
            item.analisisId ===
            analisisId
        );


      if (
        !analisis
      ) {
        setError(
          "El análisis seleccionado no pertenece a la orden."
        );

        return;
      }


      try {
        setGuardando(
          true
        );


        const referencia =
          doc(
            collection(
              db,
              "muestras"
            )
          );


        const codigo =
          generarCodigoMuestra();


        /*
         * Guardamos tanto los nombres nuevos como
         * los nombres antiguos de tu base.
         *
         * Esto permite compatibilidad con:
         *
         * codigoEtiqueta / codigoMuestra
         * tipo / tipoMuestra
         */
        await setDoc(
          referencia,
          {
            muestraId:
              referencia.id,

            laboratorioId,

            solicitudId:
              ordenSeleccionada
                .solicitudId,

            ordenId:
              ordenSeleccionada.id,

            pacienteId:
              ordenSeleccionada
                .pacienteId,

            analisisId:
              analisis.analisisId,

            analisisNombre:
              analisis.nombre,

            bioquimicoId,

            tipo,

            tipoMuestra:
              tipo,

            codigoEtiqueta:
              codigo,

            codigoMuestra:
              codigo,

            estado:
              "tomada",

            aceptada:
              true,

            motivoRechazo:
              "",

            fechaToma:
              serverTimestamp(),
          }
        );


        setMensaje(
          "Toma de muestra registrada correctamente."
        );


        setAnalisisId(
          ""
        );

        setTipo(
          ""
        );


        await cargarDatos();


        setDetalle({
          id:
            referencia.id,

          muestraId:
            referencia.id,

          laboratorioId,

          solicitudId:
            ordenSeleccionada
              .solicitudId,

          ordenId:
            ordenSeleccionada.id,

          pacienteId:
            ordenSeleccionada
              .pacienteId,

          analisisId:
            analisis.analisisId,

          analisisNombre:
            analisis.nombre,

          tipo,

          tipoMuestra:
            tipo,

          codigoEtiqueta:
            codigo,

          codigoMuestra:
            codigo,

          estado:
            "tomada",

          fechaToma:
            new Date(),
        });

      } catch (
        err
      ) {
        console.error(
          "Error registrando muestra:",
          err
        );


        setError(
          err?.message ||
          "No se pudo registrar la muestra."
        );

      } finally {
        setGuardando(
          false
        );
      }
    };


  if (
    cargando
  ) {
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
              onClick={
                onVolver
              }
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
            MUESTRAS
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
              value={
                ordenId
              }
              onChange={(
                evento
              ) =>
                setOrdenId(
                  evento
                    .target
                    .value
                )
              }
            >

              <option value="">
                Seleccione una orden
              </option>


              {ordenes.map(
                (
                  orden
                ) => (
                  <option
                    key={
                      orden.id
                    }
                    value={
                      orden.id
                    }
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
                      ordenSeleccionada
                        .pacienteId
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
              value={
                analisisId
              }
              disabled={
                !ordenSeleccionada
              }
              onChange={(
                evento
              ) =>
                setAnalisisId(
                  evento
                    .target
                    .value
                )
              }
            >

              <option value="">
                Seleccione un análisis
              </option>


              {analisisOrden.map(
                (
                  analisis
                ) => {
                  const tomada =
                    muestraYaTomada(
                      analisis
                        .analisisId
                    );


                  return (
                    <option
                      key={
                        analisis
                          .analisisId
                      }
                      value={
                        analisis
                          .analisisId
                      }
                      disabled={
                        tomada
                      }
                    >
                      {analisis.nombre}
                      {tomada
                        ? " - Muestra ya tomada"
                        : " - Pendiente"}
                    </option>
                  );
                }
              )}

            </select>

          </div>


          <div className="gm-field">

            <label>
              Tipo de muestra
            </label>


            <select
              value={
                tipo
              }
              onChange={(
                evento
              ) =>
                setTipo(
                  evento
                    .target
                    .value
                )
              }
            >

              <option value="">
                Seleccione el tipo
              </option>


              {tiposMuestra.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
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
                {ordenSeleccionada
                  .ordenId}
              </strong>

            </div>


            <div>

              <span>
                SOLICITUD
              </span>

              <strong>
                {ordenSeleccionada
                  .solicitudId ||
                  "Sin solicitud"}
              </strong>

            </div>


            <div>

              <span>
                PACIENTE
              </span>

              <strong>
                {obtenerNombrePaciente(
                  ordenSeleccionada
                    .pacienteId
                )}
              </strong>

            </div>

          </div>

        )}


        {ordenSeleccionada &&
          analisisOrden.length ===
            0 && (

            <div className="gm-message gm-error">

              La orden seleccionada no contiene análisis.

            </div>

          )}


        <div className="gm-actions">

          <button
            type="button"
            className="gm-primary"
            disabled={
              guardando ||
              !ordenSeleccionada ||
              !analisisId ||
              !tipo
            }
            onClick={
              registrar
            }
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
            IDENTIFICACIÓN
          </span>

          <h2>
            Muestras identificadas
          </h2>

          <p>
            Cada etiqueta permite reconocer al paciente,
            la orden y el análisis relacionado.
          </p>

        </div>


        {muestras.length ===
        0 ? (

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
                    ESTADO
                  </th>

                  <th>
                    ACCIÓN
                  </th>

                </tr>

              </thead>


              <tbody>

                {muestras.map(
                  (
                    muestra
                  ) => (

                    <tr
                      key={
                        muestra.id
                      }
                    >

                      <td>

                        <strong>
                          {muestra
                            .codigoEtiqueta}
                        </strong>

                      </td>


                      <td>
                        {obtenerNombrePaciente(
                          muestra
                            .pacienteId
                        )}
                      </td>


                      <td>
                        {obtenerNombreAnalisisMuestra(
                          muestra
                        )}
                      </td>


                      <td>
                        {muestra.tipo ||
                          "Sin tipo"}
                      </td>


                      <td>
                        {formatearFecha(
                          muestra
                            .fechaToma
                        )}
                      </td>


                      <td>
                        {muestra.estado}
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
                {detalle
                  .codigoEtiqueta}
              </h2>

            </div>


            <button
              type="button"
              className="gm-close"
              onClick={() =>
                setDetalle(
                  null
                )
              }
            >
              Cerrar
            </button>

          </div>


          <div className="gm-label-code">
            {detalle
              .codigoEtiqueta}
          </div>


          <div className="gm-label-grid">

            <div>

              <span>
                PACIENTE
              </span>

              <strong>
                {obtenerNombrePaciente(
                  detalle
                    .pacienteId
                )}
              </strong>

            </div>


            <div>

              <span>
                ORDEN
              </span>

              <strong>
                {detalle
                  .ordenId}
              </strong>

            </div>


            <div>

              <span>
                ANÁLISIS
              </span>

              <strong>
                {obtenerNombreAnalisisMuestra(
                  detalle
                )}
              </strong>

            </div>


            <div>

              <span>
                TIPO
              </span>

              <strong>
                {detalle.tipo ||
                  detalle
                    .tipoMuestra ||
                  "Sin tipo"}
              </strong>

            </div>


            <div>

              <span>
                FECHA DE TOMA
              </span>

              <strong>
                {formatearFecha(
                  detalle
                    .fechaToma
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