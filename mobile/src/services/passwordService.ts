import { getAuth } from "firebase/auth";
import { Platform } from "react-native";

export type ResultadoCambioPassword = {
  ok: boolean;
  mensaje: string;
};

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

// =====================================
// DIRECCIÓN DEL BACKEND
// =====================================

// Android Emulator:
// http://10.0.2.2:3001
//
// Navegador Web:
// http://localhost:3001
//
// Celular físico:
// Usar la IP local de tu computadora.

const API_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:3001"
    : "http://localhost:3001";

// =====================================
// CAMBIAR CONTRASEÑA
// =====================================

export async function cambiarPasswordUsuario(
  uidObjetivo: string,
  nuevaPassword: string
): Promise<ResultadoCambioPassword> {

  if (!uidObjetivo || !uidObjetivo.trim()) {
    throw new Error("Selecciona un usuario.");
  }

  if (!validarPasswordNueva(nuevaPassword)) {
    throw new Error(
      "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo."
    );
  }

  const usuarioActual = getAuth().currentUser;

  if (!usuarioActual) {
    throw new Error("Debes iniciar sesión.");
  }

  const token = await usuarioActual.getIdToken();

  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/cambiar-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        usuarioId: uidObjetivo.trim(),
        nuevaPassword
      })
    });
  } catch (error) {
    console.error("Error de conexión:", error);

    throw new Error(
      `No se pudo conectar con el backend (${API_URL}). Verifica que esté ejecutándose en el puerto 3001.`
    );
  }

  let datos: {
    ok?: boolean;
    correcto?: boolean;
    mensaje?: string;
    error?: string;
  };

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }

  if (!respuesta.ok) {
    throw new Error(
      datos.error ||
      datos.mensaje ||
      "No se pudo cambiar la contraseña."
    );
  }

  if (datos.ok !== true && datos.correcto !== true) {
    throw new Error("El servidor no confirmó el cambio de contraseña.");
  }

  return {
    ok: true,
    mensaje: datos.mensaje || "Contraseña cambiada correctamente."
  };
}