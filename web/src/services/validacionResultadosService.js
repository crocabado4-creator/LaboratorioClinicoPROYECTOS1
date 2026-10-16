import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// =====================================================
// LISTAR RESULTADOS
// =====================================================

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

// =====================================================
// OBTENER VALORES
// =====================================================

export async function obtenerValoresValidacion(resultadoId) {
  if (!resultadoId) {
    return [];
  }

  const respuesta = await getDocs(
    collection(db, "resultados", resultadoId, "valores")
  );

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// =====================================================
// VERIFICAR AUTORIZACIÓN PARA VALIDAR
// =====================================================

export async function verificarPermisoValidacion(laboratorioId) {
  const usuarioAuth = getAuth().currentUser;

  if (!usuarioAuth) {
    throw new Error(
      "No existe una sesión activa. Inicia sesión nuevamente."
    );
  }

  const referenciaUsuario = doc(
    db,
    "usuarios",
    usuarioAuth.uid
  );

  const documentoUsuario = await getDoc(referenciaUsuario);

  if (!documentoUsuario.exists()) {
    throw new Error(
      "El usuario autenticado no tiene un registro en Firestore."
    );
  }

  const datosUsuario = documentoUsuario.data();

  if (datosUsuario.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  if (datosUsuario.laboratorioId !== laboratorioId) {
    throw new Error(
      "Tu usuario no pertenece al laboratorio de este resultado."
    );
  }

  if (datosUsuario.rol !== "bioquimico") {
    throw new Error(
      "Tu cuenta tiene el rol '" +
        datosUsuario.rol +
        "'. Las reglas actuales solo permiten validar resultados al bioquímico."
    );
  }

  return {
    uid: usuarioAuth.uid,
    nombre: [
      datosUsuario.nombre || datosUsuario.nombres || "",
      datosUsuario.apellido || datosUsuario.apellidos || "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

// =====================================================
// VALIDAR RESULTADO
// =====================================================

export async function validarResultadoFinal({
  resultadoId,
  laboratorioId,
}) {
  if (!resultadoId) {
    throw new Error("No se identificó el resultado.");
  }

  if (!laboratorioId) {
    throw new Error("No se identificó el laboratorio.");
  }

  const usuario = await verificarPermisoValidacion(laboratorioId);

  const referenciaResultado = doc(
    db,
    "resultados",
    resultadoId
  );

  await runTransaction(db, async (transaccion) => {
    const documento = await transaccion.get(referenciaResultado);

    if (!documento.exists()) {
      throw new Error("El resultado no existe.");
    }

    const resultado = documento.data();

    if (resultado.laboratorioId !== laboratorioId) {
      throw new Error(
        "El resultado pertenece a otro laboratorio."
      );
    }

    if (
      resultado.estado === "validado" ||
      resultado.validado === true
    ) {
      throw new Error(
        "Este resultado ya fue validado."
      );
    }

    if (resultado.estado !== "borrador") {
      throw new Error(
        "Solo se pueden validar resultados en estado borrador."
      );
    }

    transaccion.update(referenciaResultado, {
      estado: "validado",
      validado: true,
      validadoPor: usuario.uid,
      validadoPorNombre: usuario.nombre,
      fechaValidacion: serverTimestamp(),
    });
  });

  return true;
}