
import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router, usePathname } from "expo-router";

export const RUTAS_RESULTADOS = [
  {
    nombre: "Registro de resultados",
    ruta: "/registro-resultados",
  },
  {
    nombre: "Valores por parámetros",
    ruta: "/valores-parametros",
  },
  {
    nombre: "Estado de análisis",
    ruta: "/estado-analisis",
  },
  {
    nombre: "Validación de resultados",
    ruta: "/validacion-resultados",
  },
  {
    nombre: "Informe de resultados",
    ruta: "/informe-resultados",
  },
  {
    nombre: "Historial de resultados",
    ruta: "/historial-resultados",
  },
] as const;

export function esRutaResultados(pathname: string) {
  return RUTAS_RESULTADOS.some(
    (opcion) => opcion.ruta === pathname
  );
}

export default function BarraResultados() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const columnas =
    width < 560 ? 2 : width < 1050 ? 3 : 6;

  const ancho =
    columnas === 2
      ? "48%"
      : columnas === 3
        ? "31%"
        : "15%";

  return (
    <View style={styles.contenedor}>
      {RUTAS_RESULTADOS.map((opcion) => {
        const activo = pathname === opcion.ruta;

        return (
          <Pressable
            key={opcion.ruta}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => {
              if (!activo) {
                router.replace(opcion.ruta as any);
              }
            }}
            style={({ pressed }) => [
              styles.boton,
              { width: ancho as any },
              activo && styles.botonActivo,
              pressed && !activo && styles.botonPresionado,
            ]}
          >
            <Text
              style={[
                styles.texto,
                activo && styles.textoActivo,
              ]}
            >
              {opcion.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 14,
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#DFE6EF",
  },

  boton: {
    flexGrow: 1,
    minHeight: 48,
    paddingVertical: 11,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
  },

  botonActivo: {
    backgroundColor: "#19385F",
  },

  botonPresionado: {
    backgroundColor: "#CBD5E1",
  },

  texto: {
    color: "#19385F",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  textoActivo: {
    color: "#FFFFFF",
  },
});
