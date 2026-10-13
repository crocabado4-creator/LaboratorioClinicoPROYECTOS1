import React from "react";
import { View, StyleSheet } from "react-native";
import { Stack, usePathname } from "expo-router";

import MenuBioquimico from "../components/MenuBioquimico";

const rutasBioquimico = [
  "/muestras",
  "/validar-muestras",
  "/seguimiento-muestras",
  "/registro-resultados",
  "/valores-parametros",
  "/estado-analisis",
  "/validacion-resultados",
];

export default function RootLayout() {
  const pathname = usePathname();

  const mostrarMenu = rutasBioquimico.includes(pathname);

  return (
    <View style={styles.contenedor}>
      {mostrarMenu && <MenuBioquimico />}

      <View style={styles.contenido}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "#F1F5F9",
            },
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    flex: 1,
  },
});