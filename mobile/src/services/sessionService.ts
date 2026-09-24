import {
  signOut,
  type User,
} from "firebase/auth";

import {
  auth,
} from "../firebase/firebase";


export async function cerrarSesionFirebase(): Promise<void> {
  await signOut(auth);
}


export function obtenerUsuarioAutenticado(): User | null {
  return auth.currentUser;
}


export function existeSesion(): boolean {
  return auth.currentUser !== null;
}