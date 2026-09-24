import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "../firebase/firebase";


// =====================================================
// CERRAR SESIÓN
// =====================================================

export async function cerrarSesionFirebase() {
  try {
    await signOut(auth);

    localStorage.removeItem("usuario");
    sessionStorage.clear();

    return true;

  } catch (error) {
    console.error(
      "Error al cerrar sesión:",
      error
    );

    throw error;
  }
}


// =====================================================
// OBTENER USUARIO AUTENTICADO
// =====================================================

export function obtenerUsuarioAutenticado() {
  return auth.currentUser;
}


// =====================================================
// VERIFICAR SI EXISTE SESIÓN
// =====================================================

export function existeSesion() {
  return auth.currentUser !== null;
}