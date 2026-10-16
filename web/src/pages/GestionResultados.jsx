import { useEffect, useMemo, useState } from "react";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import "./GestionResultados.css";

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function obtenerTexto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function obtenerFecha(valor) {
  if (!valor) {
    return "Sin fecha";
  }

  try {
    let fecha;

    if (typeof valor.toDate === "function") {
      fecha = valor.toDate();
    } else if (typeof valor.seconds === "number") {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor);
    }

    if (Number.isNaN(fecha.getTime())) {
      return "Sin fecha";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "Sin fecha";
  }
}

function obtenerNombrePaciente(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  if (paciente.nombreCompleto) {
    return paciente.nombreCompleto;
  }

  return [
    paciente.nombres || paciente.nombre,
    paciente.apellidos || paciente.apellido,
  ]
    .filter(Boolean)
    .join(" ") || "Paciente no identificado";
}

function obtenerEstadoResultado(resultado) {
  if (!resultado) {
    return "pendiente";
  }

  return obtenerTexto(resultado.estado).toLowerCase() || "borrador";
}

function obtenerNombreAnalisis(muestra, analisis) {
  if (muestra.analisisNombre) {
    return muestra.analisisNombre;
  }

  const encontrado = analisis.find(
    (item) => item.id === muestra.analisisId
  );

  return (
    encontrado?.nombre ||
    encontrado?.nombreAnalisis ||
    "Análisis"
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function GestionResultados({
  usuario,
  onVolver,
}) {
  const laboratorioId = usuario?.laboratorioId || "";

  const bioquimicoId =
    usuario?.uid ||
    usuario?.id ||
    "";

  const [muestras, setMuestras] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [muestraSeleccionada, setMuestraSeleccionada] =
    useState(null);

  const [resultadoSeleccionado, setResultadoSeleccionado] =
    useState(null);

  const [valorResultado, setValorResultado] = useState("");
  const [unidad, setUnidad] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // ========================================
  // CARGAR INFORMACIÓN
  // ========================================

  const cargarDatos = async () => {
    if (!laboratorioId) {
      setError(
        "El usuario no tiene un laboratorio asignado."
      );
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const [
        muestrasSnap,
        resultadosSnap,
        pacientesSnap,
        analisisSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, "muestras"),
            where("laboratorioId", "==", laboratorioId)
          )
        ),

        getDocs(
          query(
            collection(db, "resultados"),
            where("laboratorioId", "==", laboratorioId)
          )
        ),

        getDocs(
          query(
            collection(db, "pacientes"),
            where("laboratorioId", "==", laboratorioId)
          )
        ),

        getDocs(
          query(
            collection(db, "analisis"),
            where("laboratorioId", "==", laboratorioId)
          )
        ),
      ]);

      setMuestras(
        muestrasSnap.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }))
      );

      setResultados(
        resultadosSnap.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }))
      );

      setPacientes(
        pacientesSnap.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }))
      );

      setAnalisis(
        analisisSnap.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
        }))
      );
    } catch (err) {
      console.error("Error cargando resultados:", err);

      setError(
        err?.message ||
        "No se pudo cargar la información."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [laboratorioId]);

  // ========================================
  // OBTENER PACIENTE
  // ========================================

  const buscarPaciente = (pacienteId) => {
    return pacientes.find(
      (paciente) => paciente.id === pacienteId
    );
  };

  // ========================================
  // OBTENER RESULTADO DE UNA MUESTRA
  // ========================================

  const buscarResultado = (muestraId) => {
    return resultados.find(
      (resultado) =>
        obtenerTexto(resultado.muestraId) ===
        obtenerTexto(muestraId)
    );
  };

  // ========================================
  // MUESTRAS PROCESADAS
  // ========================================

  const muestrasProcesadas = useMemo(() => {
    return muestras.filter(
      (muestra) =>
        obtenerTexto(muestra.estado).toLowerCase() ===
        "procesada"
    );
  }, [muestras]);

  // ========================================
  // FILTRO DE BÚSQUEDA
  // ========================================

  const muestrasFiltradas = useMemo(() => {
    const buscar = busqueda.trim().toLowerCase();

    return muestrasProcesadas.filter((muestra) => {
      const paciente = buscarPaciente(muestra.pacienteId);

      const nombre = obtenerNombrePaciente(paciente);

      const ci =
        paciente?.ci ||
        paciente?.carnet ||
        paciente?.carnetIdentidad ||
        "";

      const analisisNombre = obtenerNombreAnalisis(
        muestra,
        analisis
      );

      const codigo =
        muestra.codigoEtiqueta ||
        muestra.codigoMuestra ||
        muestra.id;

      const contenido = [
        nombre,
        ci,
        analisisNombre,
        codigo,
        muestra.ordenId,
      ]
        .map(obtenerTexto)
        .join(" ")
        .toLowerCase();

      return contenido.includes(buscar);
    });
  }, [
    muestrasProcesadas,
    busqueda,
    pacientes,
    analisis,
  ]);

  // ========================================
  // ESTADÍSTICAS
  // ========================================

  const totalProcesadas = muestrasProcesadas.length;

  const totalRegistrados = muestrasProcesadas.filter(
    (muestra) => Boolean(buscarResultado(muestra.id))
  ).length;

  const totalPendientes =
    totalProcesadas - totalRegistrados;

  // ========================================
  // ABRIR FORMULARIO
  // ========================================

  const abrirFormulario = (muestra) => {
    const resultado = buscarResultado(muestra.id);

    if (obtenerEstadoResultado(resultado) === "validado") {
      setError(
        "Este resultado ya está validado y no puede editarse."
      );
      return;
    }

    setError("");
    setMensaje("");

    setMuestraSeleccionada(muestra);
    setResultadoSeleccionado(resultado || null);

    setValorResultado(
      obtenerTexto(resultado?.valorResultado)
    );

    setUnidad(
      obtenerTexto(resultado?.unidad) || "g/dl"
    );

    setObservaciones(
      obtenerTexto(resultado?.observaciones)
    );
  };

  // ========================================
  // CERRAR FORMULARIO
  // ========================================

  const cerrarFormulario = () => {
    setMuestraSeleccionada(null);
    setResultadoSeleccionado(null);

    setValorResultado("");
    setUnidad("");
    setObservaciones("");
  };

  // ========================================
  // GUARDAR RESULTADO
  // ========================================

  const guardarResultado = async (evento) => {
    evento.preventDefault();

    if (!muestraSeleccionada) {
      return;
    }

    if (!valorResultado.trim()) {
      setError("Debe ingresar el valor del resultado.");
      return;
    }

    if (!bioquimicoId) {
      setError(
        "No se pudo identificar al bioquímico."
      );
      return;
    }

    try {
      setGuardando(true);
      setError("");

      if (resultadoSeleccionado) {
        await updateDoc(
          doc(
            db,
            "resultados",
            resultadoSeleccionado.id
          ),
          {
            valorResultado: valorResultado.trim(),
            unidad: unidad.trim(),
            observaciones: observaciones.trim(),
            actualizadoPor: bioquimicoId,
            fechaActualizacion: serverTimestamp(),
          }
        );

        setMensaje(
          "Resultado actualizado correctamente."
        );
      } else {
        await addDoc(
          collection(db, "resultados"),
          {
            laboratorioId,
            muestraId: muestraSeleccionada.id,
            ordenId: muestraSeleccionada.ordenId || "",
            solicitudId:
              muestraSeleccionada.solicitudId || "",
            pacienteId:
              muestraSeleccionada.pacienteId || "",
            analisisId:
              muestraSeleccionada.analisisId || "",

            analisisNombre: obtenerNombreAnalisis(
              muestraSeleccionada,
              analisis
            ),

            valorResultado: valorResultado.trim(),
            unidad: unidad.trim(),
            observaciones: observaciones.trim(),

            estado: "borrador",

            bioquimicoId,
            registradoPor: bioquimicoId,

            fechaRegistro: serverTimestamp(),
          }
        );

        setMensaje(
          "Resultado registrado correctamente."
        );
      }

      cerrarFormulario();

      await cargarDatos();
    } catch (err) {
      console.error("Error guardando resultado:", err);

      setError(
        err?.message ||
        "No se pudo guardar el resultado."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="gr-page">

      {/* ENCABEZADO */}

      <header className="gr-header">
        <div>
          <h1>Registro de resultados</h1>

          <p>
            Registra y administra los resultados
            de las muestras que finalizaron
            su procesamiento.
          </p>
        </div>

        {onVolver && (
          <button
            type="button"
            className="gr-btn-back"
            onClick={onVolver}
          >
            Volver
          </button>
        )}
      </header>

      {/* MENSAJES */}

      {error && (
        <div className="gr-alert gr-alert-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="gr-alert gr-alert-success">
          {mensaje}
        </div>
      )}

      {/* ESTADÍSTICAS */}

      <section className="gr-stats">

        <article className="gr-stat">
          <span>Muestras procesadas</span>
          <strong>{totalProcesadas}</strong>
        </article>

        <article className="gr-stat">
          <span>Resultados registrados</span>
          <strong>{totalRegistrados}</strong>
        </article>

        <article className="gr-stat">
          <span>Resultados pendientes</span>
          <strong>{totalPendientes}</strong>
        </article>

      </section>

      {/* BUSCADOR */}

      <section className="gr-card">

        <div className="gr-section-header">
          <h2>Buscar muestra procesada</h2>

          <p>
            Busca por nombre del paciente,
            CI, análisis o código de muestra.
          </p>
        </div>

        <div className="gr-search-row">
          <input
            type="text"
            placeholder="Buscar paciente, CI, análisis o etiqueta..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

          <button
            type="button"
            className="gr-btn-primary"
            onClick={cargarDatos}
            disabled={cargando}
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

      </section>

      {/* MUESTRAS */}

      <section className="gr-card">

        <div className="gr-section-header">
          <h2>Muestras disponibles</h2>

          <p>
            Selecciona una muestra procesada
            para registrar o editar su resultado.
          </p>
        </div>

        {cargando ? (
          <p>Cargando muestras...</p>
        ) : muestrasFiltradas.length === 0 ? (
          <div className="gr-empty">
            No se encontraron muestras procesadas.
          </div>
        ) : (

          <div className="gr-list">

            {muestrasFiltradas.map((muestra) => {
              const paciente = buscarPaciente(
                muestra.pacienteId
              );

              const resultado = buscarResultado(
                muestra.id
              );

              const estado = obtenerEstadoResultado(
                resultado
              );

              const nombreAnalisis = obtenerNombreAnalisis(
                muestra,
                analisis
              );

              const codigo =
                muestra.codigoEtiqueta ||
                muestra.codigoMuestra ||
                muestra.id;

              return (
                <article
                  key={muestra.id}
                  className="gr-result-card"
                >

                  <div className="gr-result-top">

                    <div>
                      <h3>{nombreAnalisis}</h3>

                      <p>
                        <strong>Paciente:</strong>{" "}
                        {obtenerNombrePaciente(paciente)}
                      </p>

                      <p>
                        <strong>CI:</strong>{" "}
                        {paciente?.ci ||
                          paciente?.carnet ||
                          "Sin CI"}
                      </p>

                      <p>
                        <strong>Etiqueta:</strong>{" "}
                        {codigo}
                      </p>

                      <p>
                        <strong>Estado de muestra:</strong>{" "}
                        Procesada
                      </p>

                      <p>
                        <strong>Fecha de procesamiento:</strong>{" "}
                        {obtenerFecha(
                          muestra.fechaFinProcesamiento
                        )}
                      </p>
                    </div>

                    <span
                      className={`gr-badge gr-badge-${estado}`}
                    >
                      {estado === "validado"
                        ? "Validado"
                        : estado === "borrador"
                        ? "Borrador"
                        : "Pendiente"}
                    </span>

                  </div>

                  {resultado && (
                    <div className="gr-result-value">
                      <span>Resultado principal</span>

                      <strong>
                        {resultado.valorResultado ||
                          "Sin valor"}
                        {" "}
                        {resultado.unidad || ""}
                      </strong>
                    </div>
                  )}

                  <div className="gr-actions">

                    {!resultado && (
                      <button
                        type="button"
                        className="gr-btn-primary"
                        onClick={() =>
                          abrirFormulario(muestra)
                        }
                      >
                        + Nuevo resultado
                      </button>
                    )}

                    {resultado && estado !== "validado" && (
                      <button
                        type="button"
                        className="gr-btn-primary"
                        onClick={() =>
                          abrirFormulario(muestra)
                        }
                      >
                        Editar resultado
                      </button>
                    )}

                    {resultado && estado === "validado" && (
                      <div className="gr-validated">
                        Resultado validado
                      </div>
                    )}

                  </div>

                </article>
              );
            })}

          </div>
        )}

      </section>

      {/* MODAL DE REGISTRO */}

      {muestraSeleccionada && (
        <div className="gr-modal-overlay">

          <div className="gr-modal">

            <div className="gr-modal-header">
              <h2>
                {resultadoSeleccionado
                  ? "Editar resultado"
                  : "Nuevo resultado"}
              </h2>

              <button
                type="button"
                className="gr-close"
                onClick={cerrarFormulario}
              >
                ×
              </button>
            </div>

            <div className="gr-modal-info">

              <p>
                <strong>Análisis:</strong>{" "}
                {obtenerNombreAnalisis(
                  muestraSeleccionada,
                  analisis
                )}
              </p>

              <p>
                <strong>Paciente:</strong>{" "}
                {obtenerNombrePaciente(
                  buscarPaciente(
                    muestraSeleccionada.pacienteId
                  )
                )}
              </p>

              <p>
                <strong>Muestra:</strong>{" "}
                {muestraSeleccionada.codigoEtiqueta ||
                  muestraSeleccionada.id}
              </p>

            </div>

            <form onSubmit={guardarResultado}>

              <div className="gr-field">
                <label>Valor del resultado</label>

                <input
                  type="text"
                  placeholder="Ingrese el resultado"
                  value={valorResultado}
                  onChange={(evento) =>
                    setValorResultado(
                      evento.target.value
                    )
                  }
                  required
                />
              </div>

              <div className="gr-field">
                <label>Unidad</label>

                <input
                  type="text"
                  placeholder="Ejemplo: g/dl"
                  value={unidad}
                  onChange={(evento) =>
                    setUnidad(evento.target.value)
                  }
                />
              </div>

              <div className="gr-field">
                <label>Observaciones</label>

                <textarea
                  placeholder="Observaciones del resultado"
                  value={observaciones}
                  onChange={(evento) =>
                    setObservaciones(
                      evento.target.value
                    )
                  }
                  rows={4}
                />
              </div>

              <div className="gr-modal-actions">

                <button
                  type="button"
                  className="gr-btn-back"
                  onClick={cerrarFormulario}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="gr-btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : resultadoSeleccionado
                    ? "Guardar cambios"
                    : "Registrar resultado"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}