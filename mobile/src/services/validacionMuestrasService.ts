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

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

export type MuestraValidacion = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  tipo: string;
  codigoEtiqueta: string;
  estado: string;
  estadoValidacion: string;
  aceptada: boolean;
  motivoRechazo: string;
  fechaToma: unknown;
};

// =====================================================
// SESIÓN DEL BIOQUÍMICO
// =====================================================

async function obtenerSesion() {
  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error("No existe una sesión iniciada.");
  }

  const referencia = doc(db, "usuarios", usuario.uid);
  const resultado = await getDoc(referencia);

  if (!resultado.exists()) {
    throw new Error("El usuario no existe en Firestore.");
  }

  const datos = resultado.data();

  if (datos.activo !== true) {
    throw new Error("El usuario está inactivo.");
  }

  if (datos.rol !== "bioquimico") {
    throw new Error("Esta operación requiere el rol Bioquímico.");
  }

  if (!datos.laboratorioId) {
    throw new Error("El usuario no tiene laboratorio asignado.");
  }

  return {
    uid: usuario.uid,
    laboratorioId: String(datos.laboratorioId),
  };
}

// =====================================================
// CONVERTIR MUESTRA
// =====================================================

function convertirMuestra(
  id: string,
  datos: Record<string, any>
): MuestraValidacion {
  return {
    id,
    muestraId: datos.muestraId || id,
    laboratorioId: datos.laboratorioId || "",
    pacienteId: datos.pacienteId || "",
    ordenId: datos.ordenId || "",
    analisisId: datos.analisisId || "",
    analisisNombre: datos.analisisNombre || "Análisis",
    tipo: datos.tipo || datos.tipoMuestra || "",
    codigoEtiqueta: datos.codigoEtiqueta || "",
    estado: datos.estado || "tomada",
    estadoValidacion: datos.estadoValidacion || "pendiente",
    aceptada: datos.aceptada === true,
    motivoRechazo: datos.motivoRechazo || "",
    fechaToma: datos.fechaToma || null,
  };
}

// =====================================================
// LISTAR MUESTRAS DEL LABORATORIO
// =====================================================

export async function listarMuestrasValidacion():
  Promise<MuestraValidacion[]> {

  const sesion = await obtenerSesion();

  const consulta = query(
    collection(db, "muestras"),
    where("laboratorioId", "==", sesion.laboratorioId)
  );

  const resultado = await getDocs(consulta);

  return resultado.docs.map((documento) =>
    convertirMuestra(documento.id, documento.data())
  );
}

// =====================================================
// ACEPTAR MUESTRA
// =====================================================

export async function aceptarMuestra(
  muestraId: string
): Promise<void> {

  const sesion = await obtenerSesion();

  const referencia = doc(db, "muestras", muestraId);

  await runTransaction(db, async (transaction) => {
    const resultado = await transaction.get(referencia);

    if (!resultado.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = resultado.data();

    if (muestra.laboratorioId !== sesion.laboratorioId) {
      throw new Error("La muestra pertenece a otro laboratorio.");
    }

    if (muestra.estado !== "tomada") {
      throw new Error(
        "Solo se pueden aceptar muestras pendientes."
      );
    }

    transaction.update(referencia, {
      estado: "aceptada",
      estadoValidacion: "aceptada",
      aceptada: true,
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

  const sesion = await obtenerSesion();

  if (!motivo.trim()) {
    throw new Error("Debes indicar el motivo del rechazo.");
  }

  const referencia = doc(db, "muestras", muestraId);

  await runTransaction(db, async (transaction) => {
    const resultado = await transaction.get(referencia);

    if (!resultado.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = resultado.data();

    if (muestra.laboratorioId !== sesion.laboratorioId) {
      throw new Error("La muestra pertenece a otro laboratorio.");
    }

    if (muestra.estado !== "tomada") {
      throw new Error(
        "Solo se pueden rechazar muestras pendientes."
      );
    }

    transaction.update(referencia, {
      estado: "rechazada",
      estadoValidacion: "rechazada",
      aceptada: false,
      motivoRechazo: motivo.trim(),
      validadoPor: sesion.uid,
      fechaValidacion: serverTimestamp(),
    });
  });
}