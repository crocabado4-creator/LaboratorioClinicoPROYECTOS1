import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// =============================================
// HU-29 - VALIDACION FINAL DE RESULTADOS
// =============================================

export async function listarResultadosValidacion(laboratorioId) {
  if (!laboratorioId) {
    throw new Error("No se identificó el laboratorio.");
  }

  const consulta = query(
    collection(db, "resultados"),
    where("laboratorioId", "==", laboratorioId)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// Obtener los valores de los parámetros registrados
export async function obtenerValoresValidacion(resultadoId) {
  const respuesta = await getDocs(
    collection(db, "resultados", resultadoId, "valores")
  );

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// Validar resultado
export async function validarResultadoFinal({
  resultadoId,
  laboratorioId,
}) {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión nuevamente.");
  }

  if (!resultadoId || !laboratorioId) {
    throw new Error("Faltan datos para validar el resultado.");
  }

  const referencia = doc(db, "resultados", resultadoId);

  await runTransaction(db, async (transaccion) => {
    const documento = await transaccion.get(referencia);

    if (!documento.exists()) {
      throw new Error("El resultado no existe.");
    }

    const resultado = documento.data();

    if (resultado.laboratorioId !== laboratorioId) {
      throw new Error("El resultado pertenece a otro laboratorio.");
    }

    if (resultado.estado !== "borrador") {
      throw new Error("El resultado ya fue validado.");
    }

    if (resultado.validado === true) {
      throw new Error("Este resultado ya está validado.");
    }

    transaccion.update(referencia, {
      estado: "validado",
      validado: true,
      validadoPor: usuario.uid,
      fechaValidacion: serverTimestamp(),
    });
  });

  return true;
}