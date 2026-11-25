import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  listarMuestrasProcesadas,
} from "../services/resultadosService";

import "./MuestrasDisponibles.css";

// ======================================================
// UTILIDADES
// ======================================================

function texto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === "object"
  ) {
    return "";
  }

  return String(valor).trim();
}

function primero(...valores) {
  for (const valor of valores) {
    if (texto(valor)) {
      return texto(valor);
    }
  }

  return "";
}

function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nombrePaciente(paciente) {
  if (!paciente) {
    return "";
  }

  const nombre = primero(
    paciente.nombres,
    paciente.nombre,
    paciente.primerNombre
  );

  const apellidos = primero(
    paciente.apellidos,
    paciente.apellido,
    [
      paciente.apellidoPaterno,
      paciente.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    primero(
      paciente.nombreCompleto,
      paciente.nombrePaciente,
      `${nombre} ${apellidos}`.trim()
    ) || ""
  );
}

function ciPaciente(paciente) {
  return primero(
    paciente?.ci,
    paciente?.carnet,
    paciente?.carnetIdentidad,
    paciente?.numeroDocumento,
    paciente?.documento
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function MuestrasDisponibles({
  usuario,
  onVolver,
}) {
  const laboratorioId = texto(
    usuario?.laboratorioId
  );

  const [muestras, setMuestras] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [ordenes, setOrdenes] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] =
    useState(false);

  const [error, setError] = useState("");

  // ======================================================
  // CONSULTAR DATOS
  // ======================================================

  const cargarDatos = useCallback(
    async (recargar = false) => {
      if (!laboratorioId) {
        setError(
          "El usuario no tiene un laboratorio asignado."
        );

        setCargando(false);
        setActualizando(false);

        return;
      }

      try {
        if (recargar) {
          setActualizando(true);
        } else {
          setCargando(true);
        }

        setError("");

        const [
          resultadoMuestras,
          resultadoPacientes,
          resultadoAnalisis,
        ] = await Promise.all([
          listarMuestrasProcesadas(laboratorioId),

          getDocs(
            query(
              collection(db, "pacientes"),
              where(
                "laboratorioId",
                "==",
                laboratorioId
              )
            )
          ),

          getDocs(
            query(
              collection(db, "analisis"),
              where(
                "laboratorioId",
                "==",
                laboratorioId
              )
            )
          ),
        ]);

        const listaMuestras = Array.isArray(
          resultadoMuestras
        )
          ? resultadoMuestras
          : [];

        const listaPacientes =
          resultadoPacientes.docs.map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }));

        const listaAnalisis =
          resultadoAnalisis.docs.map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }));

        // Las órdenes permiten relacionar muestras
        // que no contienen pacienteId directamente.
        // Si no existe permiso para consultarlas,
        // se mantienen las muestras disponibles.

        let listaOrdenes = [];

        try {
          const resultadoOrdenes = await getDocs(
            query(
              collection(db, "ordenes"),
              where(
                "laboratorioId",
                "==",
                laboratorioId
              )
            )
          );

          listaOrdenes =
            resultadoOrdenes.docs.map((documento) => ({
              ...documento.data(),
              id: documento.id,
            }));
        } catch (errorOrdenes) {
          console.warn(
            "No se pudieron consultar las órdenes:",
            errorOrdenes
          );
        }

        setMuestras(listaMuestras);
        setPacientes(listaPacientes);
        setAnalisis(listaAnalisis);
        setOrdenes(listaOrdenes);
      } catch (err) {
        console.error(
          "Error cargando muestras disponibles:",
          err
        );

        setError(
          err?.code === "permission-denied"
            ? "No tienes permisos para consultar las muestras."
            : err?.message ||
                "No se pudieron cargar las muestras."
        );
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [laboratorioId]
  );

  // ======================================================
  // CARGA INICIAL
  // ======================================================

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ======================================================
  // MAPA DE PACIENTES
  // ======================================================

  const pacientesPorId = useMemo(() => {
    const mapa = new Map();

    pacientes.forEach((paciente) => {
      mapa.set(
        texto(paciente.id),
        paciente
      );

      if (paciente.pacienteId) {
        mapa.set(
          texto(paciente.pacienteId),
          paciente
        );
      }
    });

    return mapa;
  }, [pacientes]);

  // ======================================================
  // MAPA DE ANÁLISIS
  // ======================================================

  const analisisPorId = useMemo(() => {
    const mapa = new Map();

    analisis.forEach((item) => {
      mapa.set(texto(item.id), item);

      if (item.analisisId) {
        mapa.set(
          texto(item.analisisId),
          item
        );
      }
    });

    return mapa;
  }, [analisis]);

  // ======================================================
  // MAPA DE ÓRDENES
  // ======================================================

  const ordenesPorId = useMemo(() => {
    const mapa = new Map();

    ordenes.forEach((orden) => {
      mapa.set(
        texto(orden.id),
        orden
      );

      if (orden.ordenId) {
        mapa.set(
          texto(orden.ordenId),
          orden
        );
      }
    });

    return mapa;
  }, [ordenes]);

  // ======================================================
  // PREPARAR MUESTRAS PARA LA INTERFAZ
  // ======================================================

  const muestrasDisponibles = useMemo(() => {
    return muestras.map((muestra) => {
      const ordenId = primero(
        muestra.ordenId,
        muestra.idOrden
      );

      const orden = ordenesPorId.get(ordenId);

      const pacienteId = primero(
        muestra.pacienteId,
        muestra.idPaciente,
        muestra.paciente?.id,
        orden?.pacienteId,
        orden?.idPaciente
      );

      const paciente =
        pacientesPorId.get(pacienteId);

      const analisisId = primero(
        muestra.analisisId,
        muestra.idAnalisis
      );

      const estudio =
        analisisPorId.get(analisisId);

      const nombre = primero(
        nombrePaciente(paciente),
        nombrePaciente(muestra.paciente),
        muestra.nombrePaciente,
        muestra.pacienteNombre,
        nombrePaciente(orden?.paciente),
        orden?.nombrePaciente,
        "Paciente no identificado"
      );

      const ci = primero(
        ciPaciente(paciente),
        ciPaciente(muestra.paciente),
        muestra.ciPaciente,
        muestra.carnetPaciente,
        ciPaciente(orden?.paciente),
        orden?.ciPaciente,
        "Sin CI"
      );

      const nombreAnalisis = primero(
        muestra.analisisNombre,
        muestra.nombreAnalisis,
        muestra.analisis?.nombre,
        estudio?.nombre,
        estudio?.nombreAnalisis,
        "Análisis no identificado"
      );

      const etiqueta = primero(
        muestra.codigoEtiqueta,
        muestra.codigoMuestra,
        muestra.codigo,
        muestra.id,
        "Sin etiqueta"
      );

      return {
        id: texto(muestra.id),
        paciente: nombre,
        ci,
        nombreAnalisis,
        etiqueta,
        orden: ordenId || "Sin orden",
        estado: "Procesada",
      };
    });
  }, [
    muestras,
    pacientesPorId,
    analisisPorId,
    ordenesPorId,
  ]);

  // ======================================================
  // BUSCADOR
  // ======================================================

  const muestrasFiltradas = useMemo(() => {
    const termino = normalizar(busqueda);

    if (!termino) {
      return muestrasDisponibles;
    }

    return muestrasDisponibles.filter(
      (muestra) => {
        const contenido = [
          muestra.paciente,
          muestra.ci,
          muestra.nombreAnalisis,
          muestra.etiqueta,
          muestra.orden,
          muestra.estado,
        ]
          .join(" ");

        return normalizar(contenido).includes(
          termino
        );
      }
    );
  }, [muestrasDisponibles, busqueda]);

  // ======================================================
  // VOLVER
  // ======================================================

  const volver = () => {
    if (typeof onVolver === "function") {
      onVolver();
    }
  };

  // ======================================================
  // INTERFAZ PRINCIPAL
  // ======================================================

  return (
    <main className="md-page">
      {/* ENCABEZADO */}

      <header className="md-heading">
        <div className="md-heading-content">
          <span className="md-eyebrow">
            RESULTADOS CLÍNICOS
          </span>

          <h1>Muestras disponibles</h1>

          <p>
            Consulta las muestras procesadas de tu
            laboratorio (solo lectura).
          </p>
        </div>

        <button
          type="button"
          className="md-back"
          onClick={volver}
        >
          Volver
        </button>
      </header>

      {/* MENSAJES */}

      {error && (
        <div
          className="md-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* BUSCADOR */}

      <section className="md-box md-search-section">
        <div className="md-search-heading">
          <div>
            <span className="md-section-label">
              BÚSQUEDA DE MUESTRAS
            </span>

            <h2>Buscar muestra procesada</h2>

            <p>
              Busca por paciente, CI, análisis,
              orden o etiqueta.
            </p>
          </div>

          <span className="md-counter">
            {muestrasFiltradas.length} encontradas
          </span>
        </div>

        <div className="md-search-container">
          <input
            id="md-busqueda"
            type="search"
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
            placeholder="Paciente, CI, análisis, orden o etiqueta"
            aria-label="Buscar muestra procesada"
          />
        </div>

        <div className="md-search-actions">
          <button
            type="button"
            className="md-refresh"
            onClick={() => cargarDatos(true)}
            disabled={cargando || actualizando}
          >
            {actualizando
              ? "Actualizando..."
              : "Actualizar"}
          </button>

          {busqueda && (
            <button
              type="button"
              className="md-clear"
              onClick={() => setBusqueda("")}
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      </section>

      {/* LISTADO */}

      <section className="md-box md-results-section">
        <div className="md-results-heading">
          <div>
            <span className="md-section-label">
              LABORATORIO
            </span>

            <h2>Muestras disponibles</h2>

            <p>
              Muestras que finalizaron su
              procesamiento.
            </p>
          </div>

          <span className="md-total">
            {muestrasFiltradas.length}
            {" "}
            {muestrasFiltradas.length === 1
              ? "muestra"
              : "muestras"}
          </span>
        </div>

        {cargando ? (
          <div className="md-empty">
            <div className="md-spinner" />

            <h3>Cargando muestras</h3>

            <p>
              Consultando información del laboratorio...
            </p>
          </div>
        ) : muestrasFiltradas.length === 0 ? (
          <div className="md-empty">
            <div className="md-empty-icon">
              ◇
            </div>

            <h3>
              No se encontraron muestras
            </h3>

            <p>
              No existen muestras procesadas que
              coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <div className="md-list">
            {muestrasFiltradas.map((muestra) => (
              <article
                key={muestra.id}
                className="md-sample"
              >
                <div className="md-sample-header">
                  <div className="md-sample-icon">
                    +
                  </div>

                  <div className="md-sample-title">
                    <span className="md-sample-label">
                      ANÁLISIS CLÍNICO
                    </span>

                    <h3>
                      {muestra.nombreAnalisis}
                    </h3>
                  </div>

                  <span className="md-status">
                    Procesada
                  </span>
                </div>

                <div className="md-sample-grid">
                  <div className="md-data">
                    <span>Paciente</span>
                    <strong>
                      {muestra.paciente}
                    </strong>
                  </div>

                  <div className="md-data">
                    <span>Carnet de identidad</span>
                    <strong>
                      {muestra.ci}
                    </strong>
                  </div>

                  <div className="md-data">
                    <span>Etiqueta</span>
                    <strong>
                      {muestra.etiqueta}
                    </strong>
                  </div>

                  <div className="md-data">
                    <span>Orden</span>
                    <strong>
                      {muestra.orden}
                    </strong>
                  </div>
                </div>

                <div className="md-sample-footer">
                  <span className="md-status-dot" />

                  Estado de muestra:
                  <strong>
                    {muestra.estado}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}