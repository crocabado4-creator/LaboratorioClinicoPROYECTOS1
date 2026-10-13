import { getAuth } from "firebase/auth";
import { API_URL } from "../config/api";

export function validarPasswordNueva(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export async function cambiarPasswordUsuario(
  usuarioId: string,
  nuevaPassword: string
): Promise<string> {
  const usuarioActual = getAuth().currentUser;

  if (!usuarioActual) {
    throw new Error("Tu sesión ha terminado. Inicia sesión nuevamente.");
  }

  if (!usuarioId?.trim()) {
    throw new Error("No se recibió el UID del empleado.");
  }

  if (!validarPasswordNueva(nuevaPassword)) {
    throw new Error(
      "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial."
    );
  }

  const token = await usuarioActual.getIdToken(true);

  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/cambiar-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        usuarioId: usuarioId.trim(),
        nuevaPassword
      })
    });
  } catch {
    throw new Error(
      `No se pudo conectar al backend en ${API_URL}.`
    );
  }

  let datos: {
    correcto?: boolean;
    mensaje?: string;
    error?: string;
  };

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      `El backend devolvió una respuesta inválida. Código: ${respuesta.status}`
    );
  }

  if (!respuesta.ok) {
    throw new Error(
      datos.error || `Error del backend: ${respuesta.status}`
    );
  }

  if (datos.correcto !== true) {
    throw new Error(
      "Firebase no confirmó el cambio de contraseña."
    );
  }

  return datos.mensaje || "Contraseña actualizada correctamente.";
}

export const restablecerPasswordUsuario = cambiarPasswordUsuario;