import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const COLECCION_MUESTRAS = "muestras";
const COLECCION_USUARIOS = "usuarios";

const ESTADOS = {
  TOMADA: "tomada",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
  EN_PROCESO: "en_proceso",
  PROCESADA: "procesada",
};

// =====================================================
// AUXILIARES
// =====================================================

function limpiar(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(estado) {
  return limpiar(estado).toLowerCase();
}

function fechaMilisegundos(fecha) {
  if (!fecha) return 0;

  if (typeof fecha.toMillis === "function") {
    return fecha.toMillis();
  }

  if (typeof fecha.seconds === "number") {
    return fecha.seconds * 1000;
  }

  const fechaConvertida = new Date(fecha);

  return Number.isNaN(fechaConvertida.getTime())
    ? 0
    : fechaConvertida.getTime();
}

function convertirDocumento(documento) {
  const datos = documento.data();

  return {
    ...datos,

    id: documento.id,

    muestraId:
      limpiar(datos.muestraId) || documento.id,

    laboratorioId: limpiar(datos.laboratorioId),

    ordenId: limpiar(datos.ordenId),

    pacienteId: limpiar(datos.pacienteId),

    analisisId: limpiar(datos.analisisId),

    analisisNombre: limpiar(datos.analisisNombre),

    tipo:
      limpiar(datos.tipo) ||
      limpiar(datos.tipoMuestra),

    codigoEtiqueta: limpiar(datos.codigoEtiqueta),

    estado:
      normalizarEstado(datos.estado) ||
      ESTADOS.TOMADA,

    aceptada: datos.aceptada === true,

    estadoValidacion: limpiar(
      datos.estadoValidacion
    ),

    historialEstados: Array.isArray(
      datos.historialEstados
    )
      ? datos.historialEstados
      : [],
  };
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. Revisa " +
      "los permisos de muestras y notificaciones."
    );
  }

  if (error?.code === "unavailable") {
    return "No se pudo conectar con Firebase.";
  }

  return error?.message || "Ocurrió un error.";
}

// =====================================================
// OBTENER USUARIO
// =====================================================

async function obtenerUsuarioAutenticado() {
  const usuarioFirebase = getAuth().currentUser;

  if (!usuarioFirebase) {
    throw new Error("Debes iniciar sesión.");
  }

  const referencia = doc(
    db,
    COLECCION_USUARIOS,
    usuarioFirebase.uid
  );

  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error(
      "El usuario no está registrado en Firestore."
    );
  }

  const datos = documento.data();

  if (datos.activo !== true) {
    throw new Error("Tu cuenta está inactiva.");
  }

  return {
    uid: usuarioFirebase.uid,

    rol: limpiar(datos.rol).toLowerCase(),

    laboratorioId: limpiar(datos.laboratorioId),

    nombre: [
      datos.nombre || datos.nombres || "",
      datos.apellido || datos.apellidos || "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

// =====================================================
// VERIFICAR ACCESO
// =====================================================

async function verificarAccesoLaboratorio(
  laboratorioId,
  requiereBioquimico = false
) {
  const usuario = await obtenerUsuarioAutenticado();

  if (!laboratorioId) {
    throw new Error("No se identificó el laboratorio.");
  }

  if (usuario.laboratorioId !== laboratorioId) {
    throw new Error(
      "No perteneces al laboratorio solicitado."
    );
  }

  const permitidos = [
    "administrador",
    "recepcionista",
    "bioquimico",
  ];

  if (!permitidos.includes(usuario.rol)) {
    throw new Error("No tienes autorización.");
  }

  if (
    requiereBioquimico &&
    usuario.rol !== "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede procesar muestras."
    );
  }

  return usuario;
}

// =====================================================
// LISTAR MUESTRAS
// =====================================================

export async function obtenerMuestrasSeguimiento(
  laboratorioId
) {
  const idLaboratorio = limpiar(laboratorioId);

  await verificarAccesoLaboratorio(idLaboratorio);

  const consulta = query(
    collection(db, COLECCION_MUESTRAS),
    where("laboratorioId", "==", idLaboratorio)
  );

  const resultado = await getDocs(consulta);

  return resultado.docs
    .map(convertirDocumento)
    .sort(
      (a, b) =>
        fechaMilisegundos(b.fechaToma) -
        fechaMilisegundos(a.fechaToma)
    );
}

// =====================================================
// HISTORIAL
// =====================================================

export function obtenerHistorialMuestra(muestra) {
  if (!muestra) return [];

  const historial = Array.isArray(
    muestra.historialEstados
  )
    ? muestra.historialEstados
    : [];

  return [...historial].sort(
    (a, b) =>
      fechaMilisegundos(a.fecha) -
      fechaMilisegundos(b.fecha)
  );
}

// =====================================================
// INICIAR PROCESAMIENTO
// =====================================================

export function puedeIniciarProcesamiento(muestra) {
  if (!muestra) return false;

  return (
    normalizarEstado(muestra.estado) ===
      ESTADOS.ACEPTADA &&
    muestra.aceptada === true &&
    normalizarEstado(muestra.estadoValidacion) !==
      ESTADOS.RECHAZADA
  );
}

// =====================================================
// FINALIZAR PROCESAMIENTO
// =====================================================

export function puedeFinalizarProcesamiento(muestra) {
  if (!muestra) return false;

  return (
    normalizarEstado(muestra.estado) ===
      ESTADOS.EN_PROCESO &&
    muestra.aceptada === true &&
    normalizarEstado(muestra.estadoValidacion) !==
      ESTADOS.RECHAZADA
  );
}

// =====================================================
// ESTADO ACTUAL
// =====================================================

export function obtenerEstadoMuestra(muestra) {
  if (!muestra) return ESTADOS.TOMADA;

  return (
    normalizarEstado(muestra.estado) ||
    ESTADOS.TOMADA
  );
}

// =====================================================
// DESCRIPCIÓN
// =====================================================

export function obtenerDescripcionEstadoMuestra(estado) {
  const descripciones = {
    tomada: "Muestra tomada",
    aceptada: "Muestra aceptada",
    rechazada: "Muestra rechazada",
    en_proceso: "En procesamiento",
    procesada: "Procesamiento finalizado",
  };

  return (
    descripciones[normalizarEstado(estado)] ||
    "Estado desconocido"
  );
}

// =====================================================
// CAMBIAR ESTADO + NOTIFICAR
// =====================================================

export async function cambiarEstadoMuestra({
  muestraId,
  laboratorioId,
  usuarioId,
  nuevoEstado,
  observacion = "",
}) {
  const idMuestra = limpiar(muestraId);
  const idLaboratorio = limpiar(laboratorioId);
  const idUsuario = limpiar(usuarioId);
  const estadoNuevo = normalizarEstado(nuevoEstado);
  const comentario = limpiar(observacion);

  if (!idMuestra) {
    throw new Error("No se identificó la muestra.");
  }

  if (!idLaboratorio) {
    throw new Error("No se identificó el laboratorio.");
  }

  if (!idUsuario) {
    throw new Error("No se identificó al usuario.");
  }

  if (
    estadoNuevo !== ESTADOS.EN_PROCESO &&
    estadoNuevo !== ESTADOS.PROCESADA
  ) {
    throw new Error("Estado no válido.");
  }

  const usuario = await verificarAccesoLaboratorio(
    idLaboratorio,
    true
  );

  if (usuario.uid !== idUsuario) {
    throw new Error(
      "El usuario no coincide con la sesión."
    );
  }

  const referenciaMuestra = doc(
    db,
    COLECCION_MUESTRAS,
    idMuestra
  );

  const referenciaNotificacion = doc(
    db,
    "notificaciones",
    `procesada_${idMuestra}`
  );

  try {
    await runTransaction(db, async (transaccion) => {
      const documento = await transaccion.get(
        referenciaMuestra
      );

      if (!documento.exists()) {
        throw new Error("La muestra no existe.");
      }

      const muestra = documento.data();

      if (muestra.laboratorioId !== idLaboratorio) {
        throw new Error(
          "La muestra pertenece a otro laboratorio."
        );
      }

      if (muestra.aceptada !== true) {
        throw new Error(
          "La muestra no fue aceptada."
        );
      }

      if (
        normalizarEstado(muestra.estadoValidacion) ===
        ESTADOS.RECHAZADA
      ) {
        throw new Error(
          "La muestra está rechazada."
        );
      }

      const estadoActual = normalizarEstado(
        muestra.estado
      );

      if (
        estadoNuevo === ESTADOS.EN_PROCESO &&
        estadoActual !== ESTADOS.ACEPTADA
      ) {
        throw new Error(
          "La muestra debe estar aceptada."
        );
      }

      if (
        estadoNuevo === ESTADOS.PROCESADA &&
        estadoActual !== ESTADOS.EN_PROCESO
      ) {
        throw new Error(
          "La muestra debe estar en proceso."
        );
      }

      const historial = Array.isArray(
        muestra.historialEstados
      )
        ? muestra.historialEstados
        : [];

      const cambios = {
        estado: estadoNuevo,

        actualizadoPor: usuario.uid,

        fechaActualizacion: serverTimestamp(),

        historialEstados: [
          ...historial,
          {
            estadoAnterior: estadoActual,
            estadoNuevo,
            usuarioId: usuario.uid,
            observacion: comentario,
            fecha: new Date().toISOString(),
          },
        ],
      };

      // ===============================================
      // INICIAR
      // ===============================================

      if (estadoNuevo === ESTADOS.EN_PROCESO) {
        cambios.fechaInicioProcesamiento =
          serverTimestamp();
      }

      // ===============================================
      // FINALIZAR
      // ===============================================

      if (estadoNuevo === ESTADOS.PROCESADA) {
        cambios.fechaFinProcesamiento =
          serverTimestamp();
      }

      transaccion.update(referenciaMuestra, cambios);

      // ===============================================
      // NOTIFICACIÓN DE FINALIZACIÓN
      // ===============================================

      if (estadoNuevo === ESTADOS.PROCESADA) {
        const codigo =
          muestra.codigoEtiqueta ||
          muestra.codigoMuestra ||
          idMuestra;

        transaccion.set(referenciaNotificacion, {
          laboratorioId: idLaboratorio,

          destinatarioRol: "recepcionista",

          tipo: "muestra_procesada",

          titulo: "Procesamiento de muestra finalizado",

          mensaje:
            `La muestra ${codigo} terminó su procesamiento. ` +
            "Los resultados estarán disponibles " +
            "cuando sean validados.",

          muestraId: idMuestra,
          codigoMuestra: codigo,

          pacienteId: muestra.pacienteId || "",
          ordenId: muestra.ordenId || "",

          referenciaId: idMuestra,
          referenciaTipo: "muestra",

          requiereNuevaToma: false,

          leida: false,
          leido: false,

          creadoPor: usuario.uid,
          creadoPorNombre: usuario.nombre,

          fechaCreacion: serverTimestamp(),
          fechaLectura: null,
        });
      }
    });

    return true;
  } catch (error) {
    console.error(
      "Error cambiando estado de muestra:",
      error
    );

    throw new Error(obtenerMensajeError(error));
  }
}