import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

function limpiar(valor) {
  return String(valor ?? "").trim();
}

// =====================================================
// OBTENER RESULTADOS
// =====================================================

export async function listarResultadosParaParametros(laboratorioId) {
  const idLaboratorio = limpiar(laboratorioId);

  if (!idLaboratorio) {
    throw new Error("No tienes un laboratorio asignado.");
  }

  const consulta = query(
    collection(db, "resultados"),
    where("laboratorioId", "==", idLaboratorio)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// =====================================================
// OBTENER PARÁMETROS
// =====================================================

export async function listarParametrosAnalisis(analisisId, laboratorioId) {
  const idAnalisis = limpiar(analisisId);
  const idLaboratorio = limpiar(laboratorioId);

  if (!idAnalisis) {
    throw new Error("El resultado no tiene un análisis asignado.");
  }

  const referencia = doc(db, "analisis", idAnalisis);
  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error(
      "No existe el análisis con ID: " + idAnalisis
    );
  }

  if (documento.data().laboratorioId !== idLaboratorio) {
    throw new Error("El análisis pertenece a otro laboratorio.");
  }

  const respuesta = await getDocs(
    collection(db, "analisis", idAnalisis, "parametros")
  );

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// =====================================================
// OBTENER VALORES GUARDADOS
// =====================================================

export async function listarValoresResultado(resultadoId) {
  const idResultado = limpiar(resultadoId);

  if (!idResultado) return [];

  const respuesta = await getDocs(
    collection(db, "resultados", idResultado, "valores")
  );

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// =====================================================
// GUARDAR VALOR
// =====================================================

export async function guardarValorParametro({
  resultadoId,
  laboratorioId,
  parametroId,
  nombreParametro,
  valor,
  unidad,
  rangoReferencia,
  observacion,
}) {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión nuevamente.");
  }

  const idResultado = limpiar(resultadoId);
  const idLaboratorio = limpiar(laboratorioId);
  const idParametro = limpiar(parametroId);
  const valorIngresado = limpiar(valor);

  if (!idResultado || !idLaboratorio || !idParametro) {
    throw new Error("Faltan datos obligatorios.");
  }

  if (!valorIngresado) {
    throw new Error("Ingresa el valor del parámetro.");
  }

  const referenciaResultado = doc(
    db,
    "resultados",
    idResultado
  );

  const referenciaValor = doc(
    db,
    "resultados",
    idResultado,
    "valores",
    idParametro
  );

  await runTransaction(db, async (transaccion) => {
    const documentoResultado = await transaccion.get(
      referenciaResultado
    );

    const documentoValor = await transaccion.get(
      referenciaValor
    );

    if (!documentoResultado.exists()) {
      throw new Error("El resultado no existe.");
    }

    const resultado = documentoResultado.data();

    if (resultado.laboratorioId !== idLaboratorio) {
      throw new Error("El resultado pertenece a otro laboratorio.");
    }

    if (
      resultado.estado !== "borrador" ||
      resultado.validado === true
    ) {
      throw new Error("Este resultado ya no puede modificarse.");
    }

    const datos = {
      parametroId: idParametro,
      nombreParametro: limpiar(nombreParametro),
      valor: valorIngresado,
      unidad: limpiar(unidad),
      rangoReferencia: limpiar(rangoReferencia),
      observacion: limpiar(observacion),
      registradoPor: usuario.uid,
      fechaActualizacion: serverTimestamp(),
    };

    if (documentoValor.exists()) {
      transaccion.update(referenciaValor, datos);
    } else {
      transaccion.set(referenciaValor, {
        ...datos,
        fechaRegistro: serverTimestamp(),
      });
    }
  });

  return true;
}