import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export const obtenerPersonalizacion = async (
  laboratorioId
) => {
  const referencia = doc(
    db,
    "laboratorios",
    laboratorioId
  );

  const resultado =
    await getDoc(referencia);

  if (!resultado.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  return {
    id: resultado.id,
    ...resultado.data(),
  };
};

export const actualizarPersonalizacion = async (
  laboratorioId,
  datos
) => {
  const referencia = doc(
    db,
    "laboratorios",
    laboratorioId
  );

  await updateDoc(
    referencia,
    {
      nombre: datos.nombre.trim(),
      logoUrl: datos.logoUrl.trim(),
    }
  );
};