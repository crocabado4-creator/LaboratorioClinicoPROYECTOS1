import { getAuth } from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

export type EstadoValidacion =
  | "pendiente"
  | "aceptada"
  | "rechazada";

export interface MuestraValidacion {
  id: string;
  codigo: string;
  ordenId: string;
  pacienteId: string;
  analisisId: string;
  tipoMuestra: string;
  laboratorioId: string;
  estado: string;
  estadoValidacion: EstadoValidacion;
  motivoRechazo: string;
  fechaToma: string;
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor);
}

function obtenerFecha(valor: any): string {
  if (!valor) return "";

  if (typeof valor.toDate === "function") {
    return valor.toDate().toLocaleString();
  }

  if (typeof valor === "string") {
    return valor;
  }

  return "";
}

function obtenerEstado(
  estado: unknown,
  estadoValidacion: unknown
): EstadoValidacion {
  const validacion = texto(estadoValidacion).toLowerCase();

  if (validacion === "aceptada") return "aceptada";
  if (validacion === "rechazada") return "rechazada";

  const actual = texto(estado).toLowerCase();

  if (actual === "aceptada") return "aceptada";
  if (actual === "rechazada") return "rechazada";

  return "pendiente";
}

// =====================================================
// USUARIO Y LABORATORIO ACTUAL
// =====================================================

async function obtenerUsuarioActual() {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión.");
  }

  const referencia = doc(db, "usuarios", usuario.uid);
  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error("No se encontró tu usuario en Firestore.");
  }

  const datos = documento.data();

  if (datos.activo === false) {
    throw new Error("Tu cuenta está desactivada.");
  }

  const laboratorioId = texto(datos.laboratorioId);

  if (!laboratorioId) {
    throw new Error("Tu usuario no tiene un laboratorio asignado.");
  }

  const rol = texto(datos.rol).toLowerCase();

  if (rol !== "bioquimico" && rol !== "bioquímico") {
    throw new Error(
      "Solo el Bioquímico puede validar muestras."
    );
  }

  return {
    uid: usuario.uid,
    laboratorioId,
  };
}

// =====================================================
// LISTAR MUESTRAS
// =====================================================

export async function listarMuestrasValidacion():
  Promise<MuestraValidacion[]> {

  const sesion = await obtenerUsuarioActual();

  const referencia = collection(db, "muestras");
  const consulta = await getDocs(referencia);

  const muestras: MuestraValidacion[] = [];

  consulta.forEach((documento) => {
    const datos = documento.data();

    if (
      texto(datos.laboratorioId) !== sesion.laboratorioId
    ) {
      return;
    }

    muestras.push({
      id: documento.id,

      codigo: texto(
        datos.codigo || datos.codigoMuestra || documento.id
      ),

      ordenId: texto(datos.ordenId),

      pacienteId: texto(datos.pacienteId),

      analisisId: texto(datos.analisisId),

      tipoMuestra: texto(datos.tipoMuestra),

      laboratorioId: texto(datos.laboratorioId),

      estado: texto(datos.estado || "tomada"),

      estadoValidacion: obtenerEstado(
        datos.estado,
        datos.estadoValidacion
      ),

      motivoRechazo: texto(datos.motivoRechazo),

      fechaToma: obtenerFecha(datos.fechaToma),
    });
  });

  return muestras;
}

// =====================================================
// ACEPTAR MUESTRA
// =====================================================

export async function aceptarMuestra(
  muestraId: string
): Promise<void> {

  const sesion = await obtenerUsuarioActual();

  if (!muestraId.trim()) {
    throw new Error("No se seleccionó una muestra.");
  }

  const referencia = doc(db, "muestras", muestraId);

  await runTransaction(db, async (transaction) => {
    const documento = await transaction.get(referencia);

    if (!documento.exists()) {
      throw new Error("La muestra no existe.");
    }

    const datos = documento.data();

    if (
      texto(datos.laboratorioId) !== sesion.laboratorioId
    ) {
      throw new Error(
        "No tienes permiso para modificar esta muestra."
      );
    }

    const estado = obtenerEstado(
      datos.estado,
      datos.estadoValidacion
    );

    const estadoActual = texto(datos.estado).toLowerCase();

    if (
      estado !== "pendiente" ||
      !["tomada", "pendiente"].includes(estadoActual)
    ) {
      throw new Error(
        "Solo se pueden aceptar muestras pendientes."
      );
    }

    transaction.update(referencia, {
      estado: "aceptada",
      estadoValidacion: "aceptada",
      motivoRechazo: "",
      validadoPor: sesion.uid,
      fechaValidacion: serverTimestamp(),
    });
  });
}

// =====================================================
// RECHAZAR MUESTRA
// =====================================================

export async function rechazarMuestra(
  muestraId: string,
  motivo: string
): Promise<void> {

  const sesion = await obtenerUsuarioActual();

  if (!muestraId.trim()) {
    throw new Error("No se seleccionó una muestra.");
  }

  if (!motivo.trim()) {
    throw new Error(
      "Debes ingresar el motivo del rechazo."
    );
  }

  const referencia = doc(db, "muestras", muestraId);

  await runTransaction(db, async (transaction) => {
    const documento = await transaction.get(referencia);

    if (!documento.exists()) {
      throw new Error("La muestra no existe.");
    }

    const datos = documento.data();

    if (
      texto(datos.laboratorioId) !== sesion.laboratorioId
    ) {
      throw new Error(
        "No tienes permiso para modificar esta muestra."
      );
    }

    const estado = obtenerEstado(
      datos.estado,
      datos.estadoValidacion
    );

    const estadoActual = texto(datos.estado).toLowerCase();

    if (
      estado !== "pendiente" ||
      !["tomada", "pendiente"].includes(estadoActual)
    ) {
      throw new Error(
        "Solo se pueden rechazar muestras pendientes."
      );
    }

    transaction.update(referencia, {
      estado: "rechazada",
      estadoValidacion: "rechazada",
      motivoRechazo: motivo.trim(),
      validadoPor: sesion.uid,
      fechaValidacion: serverTimestamp(),
    });
  });
}