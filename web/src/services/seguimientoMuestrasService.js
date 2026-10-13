import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// ======================================================
// HU-25 - SEGUIMIENTO DEL ESTADO DE MUESTRAS
// ======================================================

const ESTADOS = {
  TOMADA: "tomada",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
  EN_PROCESO: "en_proceso",
  PROCESADA: "procesada",
};

function limpiar(valor) {
  return String(valor ?? "").trim();
}

// ======================================================
// OBTENER MUESTRAS DEL LABORATORIO
// ======================================================

export async function obtenerMuestrasSeguimiento(laboratorioId) {
  const idLaboratorio = limpiar(laboratorioId);

  if (!idLaboratorio) {
    throw new Error("No se identificó el laboratorio.");
  }

  const consulta = query(
    collection(db, "muestras"),
    where("laboratorioId", "==", idLaboratorio)
  );

  const resultado = await getDocs(consulta);

  return resultado.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// ======================================================
// OBTENER HISTORIAL DE UNA MUESTRA
// ======================================================

export function obtenerHistorialMuestra(muestra) {
  if (!muestra) return [];

  return Array.isArray(muestra.historialEstados)
    ? muestra.historialEstados
    : [];
}

// ======================================================
// VERIFICAR SI PUEDE PROCESARSE
// ======================================================

export function puedeIniciarProcesamiento(muestra) {
  if (!muestra) return false;

  return (
    muestra.estado === ESTADOS.ACEPTADA &&
    muestra.aceptada === true
  );
}

// ======================================================
// VERIFICAR SI PUEDE FINALIZARSE
// ======================================================

export function puedeFinalizarProcesamiento(muestra) {
  if (!muestra) return false;

  return (
    muestra.estado === ESTADOS.EN_PROCESO &&
    muestra.aceptada === true
  );
}

// ======================================================
// CAMBIAR ESTADO DE UNA MUESTRA
// ======================================================

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
  const comentario = limpiar(observacion);

  if (!idMuestra || !idLaboratorio || !idUsuario) {
    throw new Error("Faltan datos para actualizar la muestra.");
  }

  if (
    nuevoEstado !== ESTADOS.EN_PROCESO &&
    nuevoEstado !== ESTADOS.PROCESADA
  ) {
    throw new Error("El estado seleccionado no es válido.");
  }

  const referencia = doc(db, "muestras", idMuestra);

  await runTransaction(db, async (transaccion) => {
    const documento = await transaccion.get(referencia);

    if (!documento.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = documento.data();

    if (muestra.laboratorioId !== idLaboratorio) {
      throw new Error(
        "No puedes modificar muestras de otro laboratorio."
      );
    }

    if (muestra.aceptada !== true) {
      throw new Error(
        "La muestra no fue aceptada. No puede procesarse."
      );
    }

    const estadoActual = limpiar(muestra.estado);

    if (nuevoEstado === ESTADOS.EN_PROCESO) {
      if (estadoActual !== ESTADOS.ACEPTADA) {
        throw new Error(
          "Solo una muestra aceptada puede iniciar procesamiento."
        );
      }
    }

    if (nuevoEstado === ESTADOS.PROCESADA) {
      if (estadoActual !== ESTADOS.EN_PROCESO) {
        throw new Error(
          "La muestra debe estar en proceso antes de finalizar."
        );
      }
    }

    const historialAnterior = Array.isArray(
      muestra.historialEstados
    )
      ? muestra.historialEstados
      : [];

    const nuevoRegistro = {
      estadoAnterior: estadoActual,
      estadoNuevo: nuevoEstado,
      usuarioId: idUsuario,
      observacion: comentario,
      fecha: new Date().toISOString(),
    };

    const cambios = {
      estado: nuevoEstado,
      historialEstados: [
        ...historialAnterior,
        nuevoRegistro,
      ],
      actualizadoPor: idUsuario,
      fechaActualizacion: serverTimestamp(),
    };

    if (nuevoEstado === ESTADOS.EN_PROCESO) {
      cambios.fechaInicioProcesamiento = serverTimestamp();
    }

    if (nuevoEstado === ESTADOS.PROCESADA) {
      cambios.fechaFinProcesamiento = serverTimestamp();
    }

    transaccion.update(referencia, cambios);
  });

  return true;
}