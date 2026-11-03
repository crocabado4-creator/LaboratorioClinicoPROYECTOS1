import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import { obtenerPacientes } from "../services/pacientesService";

import {
  obtenerMuestras,
  obtenerOrdenesParaMuestras,
  registrarMuestra,
} from "../services/muestrasService";

import "./GestionMuestras.css";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const TIPOS_MUESTRA = [
  "Sangre",
  "Suero",
  "Plasma",
  "Orina",
  "Heces",
  "Hisopado",
  "Saliva",
  "Otro",
];

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
}

function obtenerId(registro) {
  return texto(registro?.id || registro?.muestraId);
}

function convertirFecha(valor) {
  if (!valor) return null;

  try {
    if (typeof valor.toDate === "function") {
      return valor.toDate();
    }

    if (typeof valor.seconds === "number") {
      return new Date(valor.seconds * 1000);
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
      return null;
    }

    return fecha;
  } catch {
    return null;
  }
}

function mostrarFecha(valor) {
  const fecha = convertirFecha(valor);

  if (!fecha) {
    return "Sin fecha";
  }

  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obtenerMensajeError(error) {
  console.error("ERROR GESTIÓN DE MUESTRAS:", error);

  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "El usuario o alguno de los documentos relacionados " +
      "no cumple las reglas de seguridad."
    );
  }

  if (error?.code === "unavailable") {
    return "No se pudo conectar con Firestore.";
  }

  return error?.message || "Ocurrió un error inesperado.";
}

function obtenerNombreCompleto(paciente) {
  if (!paciente) {
    return "Paciente no identificado";
  }

  const nombres = texto(
    paciente.nombres ||
    paciente.nombre ||
    paciente.nombreCompleto
  );

  const apellidos = texto(
    paciente.apellidos ||
    paciente.apellido
  );

  const nombre = `${nombres} ${apellidos}`.trim();

  return nombre || "Paciente no identificado";
}

function obtenerMotivoRechazo(registro, original) {
  return (
    texto(registro?.motivoRechazo) ||
    texto(registro?.motivo) ||
    texto(registro?.observacionRechazo) ||
    texto(registro?.observacionesRechazo) ||
    texto(original?.motivoRechazo) ||
    texto(original?.motivo) ||
    texto(original?.observacionRechazo) ||
    "No indicado"
  );
}

function obtenerFechaSolicitud(registro, original) {
  return (
    registro?.fechaSolicitud ||
    registro?.fechaSolicitudNuevaToma ||
    registro?.fechaReanudacion ||
    registro?.reanudadaEn ||
    original?.fechaSolicitudNuevaToma ||
    original?.fechaReanudacion ||
    null
  );
}

function esSolicitudPendiente(registro) {
  const estado = normalizar(
    registro.estadoNuevaToma ||
    registro.estadoReposicion ||
    registro.estado
  );

  return [
    "pendiente",
    "solicitada",
    "reanudada",
    "nueva toma solicitada",
    "nueva_toma_solicitada",
  ].includes(estado);
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function GestionMuestras({
  usuario,
  onVolver,
  onIrValidacion,
}) {
  // ====================================================
  // USUARIO Y LABORATORIO
  // ====================================================

  const laboratorioId = texto(usuario?.laboratorioId);

  const bioquimicoId = texto(
    usuario?.uid ||
    usuario?.id ||
    usuario?.usuarioId
  );

  const rol = normalizar(
    usuario?.rol?.nombre ||
    usuario?.rol
  );

  const puedeRegistrar =
    rol === "bioquimico" ||
    rol === "bioquímico";

  // ====================================================
  // ESTADOS
  // ====================================================

  const [pacientes, setPacientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [muestras, setMuestras] = useState([]);

  const [solicitudes, setSolicitudes] = useState([]);

  const [ordenId, setOrdenId] = useState("");
  const [analisisId, setAnalisisId] = useState("");
  const [tipo, setTipo] = useState("");

  const [busqueda, setBusqueda] = useState("");

  const [tiposNuevas, setTiposNuevas] = useState({});

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [creandoNueva, setCreandoNueva] = useState("");

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ====================================================
  // CARGAR DATOS
  // ====================================================

  const cargarDatos = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "No se encontró el laboratorio del usuario."
      );

      setCargando(false);
      return;
    }

    try {
      setCargando(true);

      const [
        resultadoPacientes,
        resultadoOrdenes,
        resultadoMuestras,
      ] = await Promise.all([
        obtenerPacientes(laboratorioId),
        obtenerOrdenesParaMuestras(laboratorioId),
        obtenerMuestras(laboratorioId),
      ]);

      setPacientes(
        Array.isArray(resultadoPacientes)
          ? resultadoPacientes
          : []
      );

      setOrdenes(
        Array.isArray(resultadoOrdenes)
          ? resultadoOrdenes
          : []
      );

      setMuestras(
        Array.isArray(resultadoMuestras)
          ? resultadoMuestras
          : []
      );
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ====================================================
  // CONSULTAR SOLICITUDES DE NUEVA TOMA
  // ====================================================

  useEffect(() => {
    if (!laboratorioId) {
      setSolicitudes([]);
      return;
    }

    const consulta = query(
      collection(db, "solicitudesNuevaToma"),
      where("laboratorioId", "==", laboratorioId)
    );

    const cancelar = onSnapshot(
      consulta,

      (resultado) => {
        const lista = resultado.docs.map((documento) => ({
          ...documento.data(),
          id: documento.id,
          origen: "solicitud",
        }));

        setSolicitudes(lista);
      },

      (err) => {
        console.error(
          "Error consultando nuevas tomas:",
          err
        );

        setError(obtenerMensajeError(err));
      }
    );

    return () => cancelar();
  }, [laboratorioId]);

  // ====================================================
  // BUSCAR PACIENTE
  // ====================================================

  const obtenerPaciente = useCallback(
    (id) => {
      return pacientes.find(
        (paciente) =>
          texto(paciente.id) === texto(id) ||
          texto(paciente.pacienteId) === texto(id)
      );
    },
    [pacientes]
  );

  const nombrePaciente = useCallback(
    (id) => {
      const paciente = obtenerPaciente(id);

      return obtenerNombreCompleto(paciente);
    },
    [obtenerPaciente]
  );

  // ====================================================
  // BUSCAR ORDEN
  // ====================================================

  const obtenerOrden = useCallback(
    (id) => {
      return ordenes.find(
        (orden) =>
          texto(orden.id) === texto(id) ||
          texto(orden.ordenId) === texto(id)
      );
    },
    [ordenes]
  );

  // ====================================================
  // NOMBRE DEL ANÁLISIS
  // ====================================================

  const nombreAnalisis = useCallback(
    (registro) => {
      const nombreDirecto = texto(
        registro?.analisisNombre ||
        registro?.nombreAnalisis ||
        registro?.nombreEstudio
      );

      if (nombreDirecto) {
        return nombreDirecto;
      }

      const orden = obtenerOrden(registro?.ordenId);

      const listaAnalisis =
        orden?.analisis ||
        orden?.analisisSolicitados ||
        orden?.detalles ||
        [];

      if (Array.isArray(listaAnalisis)) {
        const encontrado = listaAnalisis.find(
          (item) =>
            texto(item.analisisId || item.id) ===
            texto(registro?.analisisId)
        );

        if (encontrado) {
          return (
            encontrado.nombre ||
            encontrado.nombreAnalisis ||
            encontrado.analisisNombre ||
            "Análisis clínico"
          );
        }
      }

      return "Análisis clínico";
    },
    [obtenerOrden]
  );

  // ====================================================
  // ANÁLISIS PENDIENTES
  // ====================================================

  const obtenerAnalisisPendientes = useCallback(
    (orden) => {
      const lista =
        orden?.analisis ||
        orden?.analisisSolicitados ||
        [];

      if (!Array.isArray(lista)) {
        return [];
      }

      return lista.filter((analisis) => {
        const idAnalisis = texto(
          analisis.analisisId || analisis.id
        );

        const idOrden = texto(
          orden.id || orden.ordenId
        );

        const yaRegistrada = muestras.some(
          (muestra) =>
            texto(muestra.ordenId) === idOrden &&
            texto(muestra.analisisId) === idAnalisis
        );

        return !yaRegistrada;
      });
    },
    [muestras]
  );

  const ordenesPendientes = useMemo(() => {
    return ordenes.filter(
      (orden) =>
        obtenerAnalisisPendientes(orden).length > 0
    );
  }, [ordenes, obtenerAnalisisPendientes]);

  const ordenSeleccionada = useMemo(() => {
    return ordenesPendientes.find(
      (orden) =>
        texto(orden.id || orden.ordenId) ===
        texto(ordenId)
    );
  }, [ordenesPendientes, ordenId]);

  const analisisDisponibles = useMemo(() => {
    if (!ordenSeleccionada) {
      return [];
    }

    return obtenerAnalisisPendientes(
      ordenSeleccionada
    );
  }, [
    ordenSeleccionada,
    obtenerAnalisisPendientes,
  ]);

  const totalAnalisisPendientes = useMemo(() => {
    return ordenesPendientes.reduce(
      (total, orden) =>
        total +
        obtenerAnalisisPendientes(orden).length,
      0
    );
  }, [
    ordenesPendientes,
    obtenerAnalisisPendientes,
  ]);

  // ====================================================
  // REGISTRO NORMAL
  // ====================================================

  const registrar = async (evento) => {
    evento.preventDefault();

    if (!puedeRegistrar) {
      setError(
        "Solo el Bioquímico puede registrar muestras."
      );
      return;
    }

    if (!ordenSeleccionada) {
      setError("Selecciona una orden.");
      return;
    }

    if (!analisisId) {
      setError("Selecciona un análisis.");
      return;
    }

    if (!tipo) {
      setError("Selecciona el tipo de muestra.");
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      await registrarMuestra({
        laboratorioId,
        bioquimicoId,

        ordenId: texto(
          ordenSeleccionada.id ||
          ordenSeleccionada.ordenId
        ),

        pacienteId: texto(
          ordenSeleccionada.pacienteId
        ),

        analisisId,

        tipo,
        tipoMuestra: tipo,
      });

      setOrdenId("");
      setAnalisisId("");
      setTipo("");

      await cargarDatos();

      setMensaje(
        "Muestra registrada correctamente."
      );
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  // ====================================================
  // IDENTIFICAR REANUDACIONES DE RECEPCIÓN
  // ====================================================

  const nuevasTomas = useMemo(() => {
    const mapa = new Map();

    // Solicitudes creadas por Recepción.
    solicitudes.forEach((solicitud) => {
      if (!esSolicitudPendiente(solicitud)) {
        return;
      }

      const originalId = texto(
        solicitud.muestraOriginalId ||
        solicitud.muestraId
      );

      if (!originalId) {
        return;
      }

      mapa.set(originalId, {
        ...solicitud,
        muestraOriginalId: originalId,
        origen: "solicitud",
      });
    });

    // Compatibilidad con versiones anteriores,
    // donde Recepción marcaba directamente la muestra.
    muestras.forEach((muestra) => {
      const reanudada =
        muestra.nuevaTomaSolicitada === true ||
        muestra.reanudadaPorRecepcion === true ||
        Boolean(
          texto(muestra.solicitudNuevaTomaId)
        ) ||
        Boolean(
          texto(muestra.reanudadoPor)
        );

      if (!reanudada) {
        return;
      }

      const estadoNueva = normalizar(
        muestra.estadoNuevaToma ||
        muestra.estadoReposicion
      );

      if (
        [
          "atendida",
          "completada",
          "cancelada",
        ].includes(estadoNueva)
      ) {
        return;
      }

      const id = obtenerId(muestra);

      if (!id || mapa.has(id)) {
        return;
      }

      mapa.set(id, {
        ...muestra,
        muestraOriginalId: id,
        origen: "muestra",
      });
    });

    return Array.from(mapa.values())
      .filter((solicitud) => {
        const originalId = texto(
          solicitud.muestraOriginalId
        );

        const yaRegistrada = muestras.some(
          (muestra) =>
            texto(muestra.muestraOriginalId) ===
            originalId
        );

        return !yaRegistrada;
      })
      .filter((solicitud) => {
        const paciente = obtenerPaciente(
          solicitud.pacienteId
        );

        const contenido = [
          nombrePaciente(solicitud.pacienteId),
          paciente?.ci,
          nombreAnalisis(solicitud),
          solicitud.codigoMuestra,
          solicitud.codigoEtiqueta,
          solicitud.motivoRechazo,
        ]
          .join(" ")
          .toLowerCase();

        return contenido.includes(
          busqueda.trim().toLowerCase()
        );
      });
  }, [
    solicitudes,
    muestras,
    busqueda,
    obtenerPaciente,
    nombrePaciente,
    nombreAnalisis,
  ]);

  // ====================================================
  // CREAR NUEVA MUESTRA
  // ====================================================

  const crearNuevaMuestra = async (solicitud) => {
    const originalId = texto(
      solicitud.muestraOriginalId ||
      solicitud.muestraId
    );

    const tipoElegido = texto(
      tiposNuevas[originalId] ||
      solicitud.tipoMuestra ||
      solicitud.tipo
    );

    if (!puedeRegistrar) {
      setError(
        "Solo el Bioquímico puede registrar nuevas muestras."
      );
      return;
    }

    if (!laboratorioId || !bioquimicoId) {
      setError(
        "No se identificó al Bioquímico o su laboratorio."
      );
      return;
    }

    if (!originalId) {
      setError(
        "No se encontró la muestra original."
      );
      return;
    }

    if (!tipoElegido) {
      setError(
        "Selecciona el tipo de nueva muestra."
      );
      return;
    }

    setCreandoNueva(originalId);
    setError("");
    setMensaje("");

    try {
      // ----------------------------------------------
      // 1. CONSULTAR MUESTRA ORIGINAL
      // ----------------------------------------------

      const originalRef = doc(
        db,
        "muestras",
        originalId
      );

      const originalSnap = await getDoc(
        originalRef
      );

      if (!originalSnap.exists()) {
        throw new Error(
          "La muestra original no existe."
        );
      }

      const original = originalSnap.data();

      if (
        texto(original.laboratorioId) !==
        laboratorioId
      ) {
        throw new Error(
          "La muestra pertenece a otro laboratorio."
        );
      }

      // ----------------------------------------------
      // 2. COMPROBAR REANUDACIÓN
      // ----------------------------------------------

      const reanudacionRegistrada =
        solicitud.origen === "solicitud" &&
        esSolicitudPendiente(solicitud);

      const reanudacionEnMuestra =
        original.nuevaTomaSolicitada === true ||
        original.reanudadaPorRecepcion === true ||
        Boolean(
          texto(original.solicitudNuevaTomaId)
        ) ||
        Boolean(
          texto(original.reanudadoPor)
        );

      if (
        !reanudacionRegistrada &&
        !reanudacionEnMuestra
      ) {
        throw new Error(
          "Esta muestra no tiene una nueva toma " +
          "solicitada por Recepción."
        );
      }

      // No exigimos que el estado actual de la muestra
      // original sea exactamente "rechazada".
      //
      // La autorización para repetirla proviene
      // de una reanudación registrada por Recepción.

      // ----------------------------------------------
      // 3. RECUPERAR DATOS
      // ----------------------------------------------

      const pacienteId = texto(
        solicitud.pacienteId ||
        original.pacienteId
      );

      const analisisIdNueva = texto(
        solicitud.analisisId ||
        original.analisisId
      );

      const ordenIdOriginal = texto(
        solicitud.ordenId ||
        original.ordenId
      );

      if (!pacienteId) {
        throw new Error(
          "No se encontró el paciente."
        );
      }

      if (!analisisIdNueva) {
        throw new Error(
          "No se encontró el análisis clínico."
        );
      }

      if (!ordenIdOriginal) {
        throw new Error(
          "La muestra no tiene una orden asociada."
        );
      }

      // ----------------------------------------------
      // 4. VALIDAR ORDEN
      // ----------------------------------------------

      const ordenLocal = obtenerOrden(
        ordenIdOriginal
      );

      const ordenRealId = texto(
        ordenLocal?.id ||
        ordenIdOriginal
      );

      const ordenRef = doc(
        db,
        "ordenes",
        ordenRealId
      );

      const ordenSnap = await getDoc(
        ordenRef
      );

      if (!ordenSnap.exists()) {
        throw new Error(
          "No existe la orden asociada a la muestra."
        );
      }

      const datosOrden = ordenSnap.data();

      if (
        texto(datosOrden.laboratorioId) !==
        laboratorioId
      ) {
        throw new Error(
          "La orden pertenece a otro laboratorio."
        );
      }

      // ----------------------------------------------
      // 5. VERIFICAR REPETICIONES EXISTENTES
      // ----------------------------------------------

      const consultaRepeticiones = query(
        collection(db, "muestras"),
        where(
          "laboratorioId",
          "==",
          laboratorioId
        ),
        where(
          "muestraOriginalId",
          "==",
          originalId
        )
      );

      const repeticiones = await getDocs(
        consultaRepeticiones
      );

      if (!repeticiones.empty) {
        throw new Error(
          "Ya existe una nueva muestra registrada " +
          "para esta muestra original."
        );
      }

      // ----------------------------------------------
      // 6. PREPARAR NUEVA MUESTRA
      // ----------------------------------------------

      const nuevaRef = doc(
        collection(db, "muestras")
      );

      const codigo = `MUE-${Date.now()}-${nuevaRef.id
        .slice(0, 5)
        .toUpperCase()}`;

      const datosNuevaMuestra = {
        muestraId: nuevaRef.id,

        laboratorioId,

        ordenId: ordenRealId,

        pacienteId,

        analisisId: analisisIdNueva,

        solicitudId: texto(
          solicitud.solicitudId ||
          original.solicitudId
        ),

        analisisNombre: nombreAnalisis({
          ...original,
          ...solicitud,
          ordenId: ordenRealId,
        }),

        tipo: tipoElegido,

        tipoMuestra: tipoElegido,

        codigoEtiqueta: codigo,

        estado: "tomada",

        estadoValidacion: "pendiente",

        aceptada: false,

        motivoRechazo: "",

        requiereNuevaToma: false,

        nuevaTomaSolicitada: false,

        muestraOriginalId: originalId,

        bioquimicoId,

        registradoPor: bioquimicoId,

        fechaToma: serverTimestamp(),

        fechaRegistro: serverTimestamp(),
      };

      // ----------------------------------------------
      // 7. CREAR MUESTRA
      // ----------------------------------------------

      // La transacción crea únicamente la muestra.
      // No modifica la muestra rechazada original.

      await runTransaction(
        db,
        async (transaccion) => {
          const actual = await transaccion.get(
            originalRef
          );

          if (!actual.exists()) {
            throw new Error(
              "La muestra original ya no existe."
            );
          }

          if (
            texto(actual.data().laboratorioId) !==
            laboratorioId
          ) {
            throw new Error(
              "La muestra original pertenece a otro laboratorio."
            );
          }

          transaccion.set(
            nuevaRef,
            datosNuevaMuestra
          );
        }
      );

      // ----------------------------------------------
      // 8. CONFIRMAR REGISTRO
      // ----------------------------------------------

      setMensaje(
        "Nueva muestra registrada correctamente. " +
        "Ahora puedes validarla."
      );

      await cargarDatos();

      // ----------------------------------------------
      // 9. CAMBIAR A RECEPCIÓN Y VALIDACIÓN
      // ----------------------------------------------

      if (
        typeof onIrValidacion === "function"
      ) {
        onIrValidacion();
      }
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setCreandoNueva("");
    }
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="gm-page">

      {/* ENCABEZADO */}

      <div className="gm-header">

        {typeof onVolver === "function" && (
          <button
            type="button"
            className="gm-back"
            onClick={onVolver}
          >
            ← Volver
          </button>
        )}

        <div>
          <h2>Registro de muestras</h2>

          <p>
            Registra únicamente las muestras
            pendientes de cada orden.
          </p>
        </div>

        <button
          type="button"
          className="gm-btn gm-btn-primary"
          onClick={cargarDatos}
          disabled={cargando}
        >
          Actualizar
        </button>

      </div>

      {/* MENSAJES */}

      {error && (
        <div className="gm-alert gm-alert-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="gm-alert gm-alert-success">
          {mensaje}
        </div>
      )}

      {/* CONTADORES */}

      <div className="gm-stats">

        <article className="gm-stat gm-stat-blue">
          <span>ÓRDENES PENDIENTES</span>

          <strong>
            {ordenesPendientes.length}
          </strong>
        </article>

        <article className="gm-stat gm-stat-green">
          <span>MUESTRAS</span>

          <strong>
            {muestras.length}
          </strong>
        </article>

        <article className="gm-stat gm-stat-purple">
          <span>ANÁLISIS PENDIENTES</span>

          <strong>
            {totalAnalisisPendientes}
          </strong>
        </article>

      </div>

      {/* REGISTRO NORMAL */}

      <section className="gm-card">

        <div className="gm-card-header">
          <h3>Registrar toma de muestra</h3>

          <p>
            Selecciona una orden, un análisis
            pendiente y el tipo de muestra.
          </p>
        </div>

        <form
          onSubmit={registrar}
          className="gm-form"
        >

          <div className="gm-form-grid">

            {/* ORDEN */}

            <div className="gm-field">

              <label>Orden</label>

              <select
                value={ordenId}
                onChange={(evento) => {
                  setOrdenId(evento.target.value);
                  setAnalisisId("");
                  setTipo("");
                }}
                disabled={!puedeRegistrar}
              >

                <option value="">
                  Seleccionar paciente
                </option>

                {ordenesPendientes.map((orden) => {
                  const id = texto(
                    orden.id || orden.ordenId
                  );

                  return (
                    <option
                      key={id}
                      value={id}
                    >
                      {nombrePaciente(
                        orden.pacienteId
                      )}
                    </option>
                  );
                })}

              </select>

            </div>

            {/* ANÁLISIS */}

            <div className="gm-field">

              <label>Análisis pendiente</label>

              <select
                value={analisisId}
                onChange={(evento) => {
                  setAnalisisId(
                    evento.target.value
                  );
                  setTipo("");
                }}
                disabled={
                  !puedeRegistrar ||
                  !ordenSeleccionada
                }
              >

                <option value="">
                  Seleccionar análisis
                </option>

                {analisisDisponibles.map((analisis) => {
                  const id = texto(
                    analisis.analisisId ||
                    analisis.id
                  );

                  return (
                    <option
                      key={id}
                      value={id}
                    >
                      {analisis.nombre ||
                        analisis.nombreAnalisis ||
                        analisis.analisisNombre ||
                        "Análisis clínico"}
                    </option>
                  );
                })}

              </select>

            </div>

            {/* TIPO */}

            <div className="gm-field">

              <label>Tipo de muestra</label>

              <select
                value={tipo}
                onChange={(evento) =>
                  setTipo(evento.target.value)
                }
                disabled={
                  !puedeRegistrar ||
                  !analisisId
                }
              >

                <option value="">
                  Seleccionar tipo
                </option>

                {TIPOS_MUESTRA.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}

              </select>

            </div>

          </div>

          <button
            type="submit"
            className="gm-btn gm-btn-primary gm-btn-full"
            disabled={
              guardando ||
              !puedeRegistrar ||
              !ordenSeleccionada ||
              !analisisId ||
              !tipo
            }
          >
            {guardando
              ? "Registrando..."
              : "Registrar muestra"}
          </button>

        </form>

      </section>

      {/* NUEVAS TOMAS */}

      <section className="gm-card">

        <div className="gm-card-header">

          <h3>Nuevas tomas solicitadas</h3>

          <p>
            Solo solicitudes reanudadas por Recepción.
          </p>

        </div>

        <div className="gm-field">

          <label>
            Buscar paciente o análisis
          </label>

          <input
            type="text"
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
            placeholder="Nombre, CI, análisis o código de muestra"
          />

        </div>

        <div className="gm-list">

          {nuevasTomas.map((solicitud) => {
            const originalId = texto(
              solicitud.muestraOriginalId
            );

            const original = muestras.find(
              (muestra) =>
                obtenerId(muestra) ===
                originalId
            );

            const pacienteId = texto(
              solicitud.pacienteId ||
              original?.pacienteId
            );

            const paciente = obtenerPaciente(
              pacienteId
            );

            const tipoSeleccionado =
              tiposNuevas[originalId] ||
              solicitud.tipoMuestra ||
              solicitud.tipo ||
              original?.tipoMuestra ||
              original?.tipo ||
              "";

            return (
              <article
                key={originalId}
                className="gm-item"
              >

                <h4>
                  {nombrePaciente(pacienteId)}
                </h4>

                <p>
                  <strong>CI:</strong>{" "}
                  {paciente?.ci ||
                    "No registrado"}
                </p>

                <p>
                  <strong>Análisis:</strong>{" "}
                  {nombreAnalisis({
                    ...original,
                    ...solicitud,
                  })}
                </p>

                <p>
                  <strong>Código:</strong>{" "}
                  {solicitud.codigoMuestra ||
                    solicitud.codigoEtiqueta ||
                    original?.codigoEtiqueta ||
                    originalId}
                </p>

                <p>
                  <strong>
                    Motivo del rechazo:
                  </strong>{" "}
                  {obtenerMotivoRechazo(
                    solicitud,
                    original
                  )}
                </p>

                <p>
                  <strong>Estado:</strong>{" "}
                  Nueva toma solicitada
                </p>

                <p>
                  <strong>
                    Fecha de solicitud:
                  </strong>{" "}
                  {mostrarFecha(
                    obtenerFechaSolicitud(
                      solicitud,
                      original
                    )
                  )}
                </p>

                <div className="gm-field">

                  <label>
                    Tipo de nueva muestra
                  </label>

                  <select
                    value={tipoSeleccionado}
                    onChange={(evento) => {
                      setTiposNuevas(
                        (anterior) => ({
                          ...anterior,
                          [originalId]:
                            evento.target.value,
                        })
                      );
                    }}
                  >

                    <option value="">
                      Seleccionar tipo
                    </option>

                    {TIPOS_MUESTRA.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}

                  </select>

                </div>

                <button
                  type="button"
                  className="gm-btn gm-btn-primary gm-btn-full"
                  onClick={() =>
                    crearNuevaMuestra(solicitud)
                  }
                  disabled={
                    Boolean(creandoNueva) ||
                    !puedeRegistrar ||
                    !tipoSeleccionado
                  }
                >

                  {creandoNueva === originalId
                    ? "Registrando nueva muestra..."
                    : "Nueva muestra"}

                </button>

              </article>
            );
          })}

        </div>

        {!cargando &&
          nuevasTomas.length === 0 && (
            <p className="gm-empty">
              No hay nuevas tomas reanudadas
              por Recepción.
            </p>
          )}

      </section>

      {/* HISTORIAL */}

      <section className="gm-card">

        <div className="gm-card-header">

          <h3>Muestras registradas</h3>

          <p>
            Historial de muestras tomadas
            en el laboratorio.
          </p>

        </div>

        <div className="gm-list">

          {muestras.map((muestra) => (
            <article
              key={obtenerId(muestra)}
              className="gm-item"
            >

              <h4>
                {nombrePaciente(
                  muestra.pacienteId
                )}
              </h4>

              <p>
                <strong>Análisis:</strong>{" "}
                {nombreAnalisis(muestra)}
              </p>

              <p>
                <strong>Tipo:</strong>{" "}
                {muestra.tipoMuestra ||
                  muestra.tipo ||
                  "No indicado"}
              </p>

              <p>
                <strong>Estado:</strong>{" "}
                {muestra.estado ||
                  "No indicado"}
              </p>

              <p>
                <strong>
                  Fecha de toma:
                </strong>{" "}
                {mostrarFecha(
                  muestra.fechaToma ||
                  muestra.fechaRegistro
                )}
              </p>

            </article>
          ))}

        </div>

      </section>

    </main>
  );
}