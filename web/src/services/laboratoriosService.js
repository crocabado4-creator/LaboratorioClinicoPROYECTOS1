import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


// ========================================
// OBTENER LABORATORIOS
// ========================================

export const obtenerLaboratorios = async () => {
  const resultado = await getDocs(
    collection(db, "laboratorios")
  );

  return resultado.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  }));
};


// ========================================
// CREAR LABORATORIO
// ========================================

export const crearLaboratorio = async (datos) => {

  const laboratorioRef = doc(
    collection(db, "laboratorios")
  );

  const nuevoLaboratorio = {
    laboratorioId: laboratorioRef.id,

    nombre: datos.nombre.trim(),

    direccion: datos.direccion.trim(),

    telefono: datos.telefono.trim(),

    email: datos.email.trim(),

    logoUrl: "",

    activo: true,

    fechaRegistro: serverTimestamp(),
  };

  await setDoc(
    laboratorioRef,
    nuevoLaboratorio
  );

  return {
    id: laboratorioRef.id,
    ...nuevoLaboratorio,
  };
};


// ========================================
// EDITAR LABORATORIO
// ========================================

export const actualizarLaboratorio = async (
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
      direccion: datos.direccion.trim(),
      telefono: datos.telefono.trim(),
      email: datos.email.trim(),
    }
  );
};


// ========================================
// ACTIVAR / DESACTIVAR
// ========================================

export const cambiarEstadoLaboratorio = async (
  laboratorioId,
  activo
) => {

  const laboratorioRef = doc(
    db,
    "laboratorios",
    laboratorioId
  );

  await updateDoc(
    laboratorioRef,
    {
      activo: activo,
    }
  );
};