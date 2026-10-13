import { Platform } from "react-native";

const PUERTO = 3001;

// Solo para probar en celular físico:
// reemplaza esta IP por la IPv4 real de tu computadora.
const IP_PC = "192.168.1.100";

export const API_URL =
  Platform.OS === "web"
    ? `http://localhost:${PUERTO}`
    : Platform.OS === "android"
    ? `http://10.0.2.2:${PUERTO}`
    : `http://${IP_PC}:${PUERTO}`;