import { getAuth } from "firebase/auth";
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

import { db } from "../firebase/firebase";

export type EstadoValidacion =
  | "pendiente"
  | "aceptada"
  | "rechazada";

export type Muestra = {
  id: string;
  laboratorioId: string;
  ordenId: string;
  pacienteId: string;
  analisisId: string;
  tipoMuestra: string;
  estadoValidacion: EstadoValidacion;
  motivoRechazo: string;
  validadoPor?: string;
  fechaValidacion?: unknown;
};

async function obtenerSesionBioquimico() {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión.");
  }

  const referencia = doc(db, "usuarios", usuario.uid);
  const resultado = await getDoc(referencia);

  if (!resultado.exists()) {
    throw new Error("No se encontró tu usuario.");
  }

  const datos = resultado.data();

  if (datos.activo !== true) {
    throw new Error("Tu cuenta está inactiva.");
  }

  const rol = String(datos.rol || "")
    .trim()
    .toLowerCase();

  if (rol !== "bioquimico" && rol !== "bioquímico") {
    throw new Error(
      "Solo el Bioquímico puede validar muestras."
    );
  }

  const laboratorioId = String(
    datos.laboratorioId || ""
  );

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene laboratorio asignado."
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

export async function obtenerMuestras(): Promise<Muestra[]> {
  const sesion = await obtenerSesionBioquimico();

  const consulta = query(
    collection(db, "muestras"),
    where("laboratorioId", "==", sesion.laboratorioId)
  );

  const resultado = await getDocs(consulta);

  return resultado.docs.map((documento) => {
    const datos = documento.data();

    return {
      id: documento.id,
      laboratorioId: String(datos.laboratorioId || ""),
      ordenId: String(datos.ordenId || ""),
      pacienteId: String(datos.pacienteId || ""),
      analisisId: String(datos.analisisId || ""),
      tipoMuestra: String(datos.tipoMuestra || ""),
      estadoValidacion:
        datos.estadoValidacion === "aceptada" ||
        datos.estadoValidacion === "rechazada"
          ? datos.estadoValidacion
          : "pendiente",
      motivoRechazo: String(datos.motivoRechazo || ""),
      validadoPor: datos.validadoPor,
      fechaValidacion: datos.fechaValidacion,
    };
  });
}

// =====================================================
// ACEPTAR MUESTRA
// =====================================================

export async function aceptarMuestra(
  muestraId: string
): Promise<void> {
  const sesion = await obtenerSesionBioquimico();

  if (!muestraId.trim()) {
    throw new Error("Selecciona una muestra.");
  }

  const referencia = doc(db, "muestras", muestraId);

  await runTransaction(db, async (transaccion) => {
    const documento = await transaccion.get(referencia);

    if (!documento.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = documento.data();

    if (muestra.laboratorioId !== sesion.laboratorioId) {
      throw new Error(
        "La muestra pertenece a otro laboratorio."
      );
    }

    if (
      muestra.estadoValidacion === "aceptada" ||
      muestra.estadoValidacion === "rechazada"
    ) {
      throw new Error(
        "Esta muestra ya fue validada."
      );
    }

    transaccion.update(referencia, {
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
  const sesion = await obtenerSesionBioquimico();

  const motivoLimpio = motivo.trim();

  if (!muestraId.trim()) {
    throw new Error("Selecciona una muestra.");
  }

  if (!motivoLimpio) {
    throw new Error(
      "Debes ingresar el motivo del rechazo."
    );
  }

  const referencia = doc(db, "muestras", muestraId);

  await runTransaction(db, async (transaccion) => {
    const documento = await transaccion.get(referencia);

    if (!documento.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = documento.data();

    if (muestra.laboratorioId !== sesion.laboratorioId) {
      throw new Error(
        "La muestra pertenece a otro laboratorio."
      );
    }

    if (
      muestra.estadoValidacion === "aceptada" ||
      muestra.estadoValidacion === "rechazada"
    ) {
      throw new Error(
        "Esta muestra ya fue validada."
      );
    }

    transaccion.update(referencia, {
      estadoValidacion: "rechazada",
      motivoRechazo: motivoLimpio,
      validadoPor: sesion.uid,
      fechaValidacion: serverTimestamp(),
    });
  });
}

// =====================================================
// VERIFICAR PROCESAMIENTO
// =====================================================

export async function validarMuestraParaProcesar(
  muestraId: string
): Promise<boolean> {
  const sesion = await obtenerSesionBioquimico();

  const documento = await getDoc(
    doc(db, "muestras", muestraId)
  );

  if (!documento.exists()) {
    throw new Error("La muestra no existe.");
  }

  const muestra = documento.data();

  if (muestra.laboratorioId !== sesion.laboratorioId) {
    throw new Error(
      "La muestra pertenece a otro laboratorio."
    );
  }

  if (muestra.estadoValidacion !== "aceptada") {
    throw new Error(
      "Solo las muestras aceptadas pueden procesarse."
    );
  }

  return true;
}