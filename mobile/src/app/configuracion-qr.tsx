import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import ConfiguracionQRMobile from
  "../components/ConfiguracionQRMobile";

type Usuario = {
  uid: string;
  rol: string;
  laboratorioId: string;
};

export default function ConfiguracionQRScreen() {
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const cancelar = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          setError(
            "Debes iniciar sesión."
          );

          setCargando(false);
          return;
        }

        try {
          setCargando(true);
          setError("");

          const referencia = doc(
            db,
            "usuarios",
            firebaseUser.uid
          );

          const snapshot =
            await getDoc(referencia);

          if (!snapshot.exists()) {
            throw new Error(
              "Usuario no encontrado."
            );
          }

          const datos = snapshot.data();

          if (datos.activo !== true) {
            throw new Error(
              "El usuario está inactivo."
            );
          }

          const rol = String(
            datos.rol || ""
          )
            .trim()
            .toLowerCase();

          if (
            rol !== "administrador"
          ) {
            throw new Error(
              "Solo el administrador puede configurar el QR."
            );
          }

          const laboratorioId = String(
            datos.laboratorioId || ""
          ).trim();

          if (!laboratorioId) {
            throw new Error(
              "No tienes un laboratorio asignado."
            );
          }

          setUsuario({
            uid: firebaseUser.uid,
            rol,
            laboratorioId,
          });
        } catch (error: any) {
          setError(
            error?.message ||
              "No se pudo cargar la configuración."
          );
        } finally {
          setCargando(false);
        }
      }
    );

    return cancelar;
  }, []);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#0284C7"
        />

        <Text style={styles.descripcion}>
          Cargando configuración...
        </Text>
      </View>
    );
  }

  if (error || !usuario) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.error}>
          {error ||
            "No se encontró el usuario."}
        </Text>

        <Pressable
          style={styles.botonVolver}
          onPress={() => router.back()}
        >
          <Text style={styles.botonTexto}>
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
    >
      <Pressable
        onPress={() => router.back()}
      >
        <Text style={styles.volver}>
          ← Volver
        </Text>
      </Pressable>

      <View style={styles.encabezado}>
        <Text style={styles.etiqueta}>
          ADMINISTRACIÓN
        </Text>

        <Text style={styles.titulo}>
          Configuración de QR
        </Text>

        <Text style={styles.descripcion}>
          Administra el código QR
          utilizado para los cobros
          del laboratorio.
        </Text>
      </View>

      <ConfiguracionQRMobile
        laboratorioId={
          usuario.laboratorioId
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F3F7FB",
  },

  contenido: {
    padding: 16,
    paddingBottom: 40,
  },

  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F7FB",
    padding: 20,
  },

  volver: {
    color: "#0369A1",
    fontWeight: "800",
    marginBottom: 15,
  },

  encabezado: {
    backgroundColor: "#EFF9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
  },

  etiqueta: {
    color: "#0369A1",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
  },

  titulo: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },

  descripcion: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },

  error: {
    color: "#DC2626",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 20,
  },

  botonVolver: {
    backgroundColor: "#0284C7",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 25,
  },

  botonTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
