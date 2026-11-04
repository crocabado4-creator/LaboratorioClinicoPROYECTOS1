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

type RespuestaBackend = {
  correcto?: boolean;
  success?: boolean;
  mensaje?: string;
  error?: string;
};

export async function cambiarPasswordUsuario(
  usuarioId: string,
  nuevaPassword: string
): Promise<string> {
  const auth = getAuth();
  const usuarioActual = auth.currentUser;

  if (!usuarioActual) {
    throw new Error(
      "Tu sesión ha terminado. Inicia sesión nuevamente."
    );
  }

  if (!usuarioId || !usuarioId.trim()) {
    throw new Error("No se recibió el UID del usuario.");
  }

  if (!validarPasswordNueva(nuevaPassword)) {
    throw new Error(
      "La contraseña debe tener mínimo 8 caracteres, " +
        "una mayúscula, una minúscula, un número " +
        "y un carácter especial."
    );
  }

  const token = await usuarioActual.getIdToken(true);

  const url = `${API_URL.replace(/\/+$/, "")}/cambiar-password`;

  console.log("Conectando al backend:", url);

  let respuesta: Response;

  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        usuarioId: usuarioId.trim(),
        nuevaPassword,
      }),
    });
  } catch (error) {
    console.error("Error de conexión con backend:", error);

    throw new Error(
      `No se pudo conectar al backend en ${API_URL}. ` +
        "Comprueba que el servidor esté encendido " +
        "y que permita conexiones desde Expo."
    );
  }

  let datos: RespuestaBackend;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      `El backend devolvió una respuesta inválida. ` +
        `Código HTTP: ${respuesta.status}`
    );
  }

  if (!respuesta.ok) {
    throw new Error(
      datos.error ||
        datos.mensaje ||
        `Error del backend: ${respuesta.status}`
    );
  }

  if (datos.correcto === false || datos.success === false) {
    throw new Error(
      datos.error ||
        datos.mensaje ||
        "No se pudo actualizar la contraseña."
    );
  }

  return (
    datos.mensaje ||
    "Contraseña actualizada correctamente."
  );
}

export const restablecerPasswordUsuario =
  cambiarPasswordUsuario;