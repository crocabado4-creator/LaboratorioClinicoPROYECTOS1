import React from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  router,
  Stack,
} from "expo-router";

import MenuBioquimico from "../../components/MenuBioquimico";

export default function BioquimicoLayout() {
  return (
    <View style={styles.contenedor}>
      {/* MENÚ SUPERIOR */}

      <MenuBioquimico />

      {/* BOTÓN VOLVER */}

      <View style={styles.barraVolver}>
        <Pressable
          style={styles.botonVolver}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.textoVolver}>
            Volver
          </Text>
        </Pressable>
      </View>

      {/* PANTALLAS */}

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

  barraVolver: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 5,
    alignItems: "flex-end",
  },

  botonVolver: {
    backgroundColor: "#334155",
    paddingHorizontal: 19,
    paddingVertical: 11,
    borderRadius: 8,
  },

  textoVolver: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  contenido: {
    flex: 1,
  },
});