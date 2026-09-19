import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


// ========================================
// OBTENER LABORATORIO
// ========================================

export const obtenerLaboratorio = async (
  laboratorioId
) => {
  const laboratorioRef = doc(
    db,
    "laboratorios",
    laboratorioId
  );

  const laboratorioSnap =
    await getDoc(laboratorioRef);

  if (!laboratorioSnap.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  return {
    id: laboratorioSnap.id,
    ...laboratorioSnap.data(),
  };
};


// ========================================
// ACTUALIZAR CONFIGURACIÓN
// ========================================

export const actualizarConfiguracionLaboratorio =
  async (
    laboratorioId,
    datos
  ) => {
    const laboratorioRef = doc(
      db,
      "laboratorios",
      laboratorioId
    );

    await updateDoc(
      laboratorioRef,
      {
        nombre: datos.nombre.trim(),
        direccion:
          datos.direccion.trim(),
        telefono:
          datos.telefono.trim(),
        email:
          datos.email.trim(),
      }
    );
  };