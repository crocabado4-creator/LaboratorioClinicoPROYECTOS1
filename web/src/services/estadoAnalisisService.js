import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// HU-28 - SEGUIMIENTO DE ESTADO DE ANALISIS
// =====================================================

export async function listarEstadosAnalisis(laboratorioId) {
  if (!laboratorioId) {
    throw new Error("No se identificó el laboratorio.");
  }

  const consultaMuestras = query(
    collection(db, "muestras"),
    where("laboratorioId", "==", laboratorioId)
  );

  const consultaResultados = query(
    collection(db, "resultados"),
    where("laboratorioId", "==", laboratorioId)
  );

  const [respuestaMuestras, respuestaResultados] =
    await Promise.all([
      getDocs(consultaMuestras),
      getDocs(consultaResultados),
    ]);

  const muestras = respuestaMuestras.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));

  const resultados = respuestaResultados.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));

  return muestras.map((muestra) => {
    const resultado = resultados.find(
      (item) => item.muestraId === muestra.id
    );

    let estadoGeneral = "Muestra tomada";

    if (muestra.estado === "rechazada") {
      estadoGeneral = "Muestra rechazada";
    } else if (muestra.estado === "aceptada") {
      estadoGeneral = "Muestra aceptada";
    } else if (muestra.estado === "en_proceso") {
      estadoGeneral = "En proceso";
    } else if (muestra.estado === "procesada") {
      estadoGeneral = "Procesada";
    }

    if (resultado) {
      estadoGeneral =
        resultado.validado === true
          ? "Resultado validado"
          : "Resultado registrado";
    }

    return {
      ...muestra,
      resultadoId: resultado?.id || null,
      estadoResultado: resultado?.estado || null,
      estadoGeneral,
    };
  });
}