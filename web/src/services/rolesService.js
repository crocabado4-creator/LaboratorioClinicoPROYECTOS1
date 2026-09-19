import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


// ========================================
// OBTENER PERMISOS DEL ROL
// ========================================

export const obtenerPermisosRol = async (rolId) => {
  const rolRef = doc(
    db,
    "roles",
    rolId
  );

  const rolSnap = await getDoc(rolRef);

  if (!rolSnap.exists()) {
    console.log(
      "No existe el rol:",
      rolId
    );

    return [];
  }

  const rol = rolSnap.data();

  if (rol.activo !== true) {
    return [];
  }

  if (!Array.isArray(rol.permisos)) {
    return [];
  }

  return rol.permisos;
};


// ========================================
// OBTENER ROLES ASIGNABLES
// ========================================

export const obtenerRolesAsignables = async () => {
  const resultado = await getDocs(
    collection(db, "roles")
  );

  const roles = resultado.docs.map(
    (documento) => ({
      id: documento.id,
      ...documento.data(),
    })
  );

  return roles.filter(
    (rol) =>
      rol.activo === true &&
      (
        rol.id === "recepcionista" ||
        rol.id === "bioquimico"
      )
  );
};


// ========================================
// USUARIOS DEL LABORATORIO
// ========================================

export const obtenerUsuariosLaboratorio =
  async (laboratorioId) => {

    const consulta = query(
      collection(db, "usuarios"),
      where(
        "laboratorioId",
        "==",
        laboratorioId
      )
    );

    const resultado =
      await getDocs(consulta);

    return resultado.docs.map(
      (documento) => ({
        id: documento.id,
        ...documento.data(),
      })
    );
  };


// ========================================
// CAMBIAR ROL DEL USUARIO
// ========================================

export const actualizarRolUsuario =
  async (uid, nuevoRol) => {

    const usuarioRef = doc(
      db,
      "usuarios",
      uid
    );

    await updateDoc(
      usuarioRef,
      {
        rol: nuevoRol,
      }
    );
  };