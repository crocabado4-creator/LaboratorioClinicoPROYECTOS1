import { Platform } from "react-native";
import Constants from "expo-constants";

const PUERTO = 3001;

// IP de respaldo para dispositivos físicos.
// Cambiar por la IPv4 real de tu computadora si es necesario.
const IP_PC = "192.168.1.100";

function obtenerAPIURL(): string {
  // Navegador web
  if (Platform.OS === "web") {
    return `http://localhost:${PUERTO}`;
  }

  // Obtener la dirección de Expo
  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(":")[0];

    // Si Expo utiliza una IP local
    if (
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.")
    ) {
      return `http://${ip}:${PUERTO}`;
    }
  }

  // Emulador Android
  if (Platform.OS === "android") {
    return `http://10.0.2.2:${PUERTO}`;
  }

  // Dispositivo físico
  return `http://${IP_PC}:${PUERTO}`;
}

export const API_URL = obtenerAPIURL();

console.log("BACKEND CONFIGURADO:", API_URL);