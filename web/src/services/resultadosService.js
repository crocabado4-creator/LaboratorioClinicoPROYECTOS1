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
import {
  registrarEventoSprint3,
} from "./eventosSprint3Service";

// =============================================
// HU-26 - REGISTRO DE RESULTADOS
// =============================================

function limpiar(valor) {
  return String(valor ?? "").trim();
}

// =============================================
// LISTAR MUESTRAS PROCESADAS
// =============================================

export async function listarMuestrasProcesadas(laboratorioId) {
  const idLaboratorio = limpiar(laboratorioId);

  if (!idLaboratorio) {
    throw new Error("No se identificó el laboratorio.");
  }

  const consulta = query(
    collection(db, "muestras"),
    where("laboratorioId", "==", idLaboratorio)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs
    .map((documento) => ({
      ...documento.data(),
      id: documento.id,
    }))
    .filter(
      (muestra) =>
        muestra.estado === "procesada" &&
        muestra.aceptada === true
    );
}

// =============================================
// LISTAR RESULTADOS DEL LABORATORIO
// =============================================

export async function listarResultados(laboratorioId) {
  const idLaboratorio = limpiar(laboratorioId);

  if (!idLaboratorio) {
    throw new Error("No se identificó el laboratorio.");
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

// =============================================
// REGISTRAR RESULTADO
// =============================================

export async function registrarResultado({
  muestraId,
  laboratorioId,
  usuarioId,
  valorResultado,
  unidad,
  observaciones,
}) {
  const idMuestra = limpiar(muestraId);
  const idLaboratorio = limpiar(laboratorioId);
  const idUsuario = limpiar(usuarioId);
  const valor = limpiar(valorResultado);
  const unidadResultado = limpiar(unidad);
  const comentario = limpiar(observaciones);

  if (!idMuestra || !idLaboratorio || !idUsuario) {
    throw new Error("Faltan datos para registrar el resultado.");
  }

  if (!valor) {
    throw new Error("El resultado es obligatorio.");
  }

  const referenciaMuestra = doc(db, "muestras", idMuestra);

  // Un resultado por muestra para HU-26.
  // HU-27 ampliará el registro a parámetros individuales.
  const referenciaResultado = doc(db, "resultados", idMuestra);

  await runTransaction(db, async (transaccion) => {
    const documentoMuestra = await transaccion.get(
      referenciaMuestra
    );

    const documentoResultado = await transaccion.get(
      referenciaResultado
    );

    if (!documentoMuestra.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = documentoMuestra.data();

    if (muestra.laboratorioId !== idLaboratorio) {
      throw new Error(
        "La muestra pertenece a otro laboratorio."
      );
    }

    if (
      muestra.estado !== "procesada" ||
      muestra.aceptada !== true
    ) {
      throw new Error(
        "Solo se pueden registrar resultados de muestras procesadas y aceptadas."
      );
    }

    if (documentoResultado.exists()) {
      throw new Error(
        "Esta muestra ya tiene un resultado registrado."
      );
    }

    transaccion.set(referenciaResultado, {
      laboratorioId: idLaboratorio,

      muestraId: idMuestra,
      pacienteId: muestra.pacienteId || "",
      ordenId: muestra.ordenId || "",
      analisisId: muestra.analisisId || "",
      analisisNombre: muestra.analisisNombre || "",

      valorResultado: valor,
      unidad: unidadResultado,
      observaciones: comentario,

      estado: "borrador",
      validado: false,

      registradoPor: idUsuario,
      fechaRegistro: serverTimestamp(),

      validadoPor: null,
      fechaValidacion: null,
    });
  });
  await registrarEventoSprint3({
    laboratorioId: idLaboratorio,
    accion: "Resultado registrado",
    entidad: "resultados",
    entidadId: idMuestra,
    detalle:
      "Se registró un nuevo resultado clínico en borrador.",
    notificarAdministrador: true,
  });

  return true;
}