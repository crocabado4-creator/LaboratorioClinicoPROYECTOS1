
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { Redirect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// NORMALIZAR EL ROL
function normalizarRol(valor: unknown): string {
  if (typeof valor !== "string") {
    return "";
  }

  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Resultados() {
  const [rol, setRol] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    const cancelar = onAuthStateChanged(
      auth,
      async (usuarioActual) => {
        if (!activo) return;

        setCargando(true);
        setRol("");

        if (!usuarioActual) {
          setCargando(false);
          return;
        }

        try {
          // BUSCAR EL USUARIO EN FIRESTORE
          const usuarioRef = doc(
            db,
            "usuarios",
            usuarioActual.uid
          );

          const usuarioSnap = await getDoc(usuarioRef);

          if (!activo) return;

          if (!usuarioSnap.exists()) {
            setRol("");
            return;
          }

          const datos = usuarioSnap.data();

          // COMPROBAR QUE EL USUARIO ESTÉ ACTIVO
          if (datos.activo !== true) {
            setRol("");
            return;
          }

          const rolUsuario =
            datos.rolNombre ||
            datos.rol ||
            datos.role ||
            "";

          setRol(normalizarRol(rolUsuario));
        } catch (error) {
          console.error(
            "Error al obtener el rol:",
            error
          );

          if (activo) {
            setRol("");
          }
        } finally {
          if (activo) {
            setCargando(false);
          }
        }
      }
    );

    return () => {
      activo = false;
      cancelar();
    };
  }, []);

  // ESPERAR MIENTRAS CARGA EL ROL
  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <ActivityIndicator
          size="large"
          color="#19385F"
        />

        <Text style={styles.texto}>
          Cargando resultados...
        </Text>
      </View>
    );
  }

  // BIOQUÍMICO: REGISTRO DE RESULTADOS
  if (rol === "bioquimico") {
    return (
      <Redirect href="/registro-resultados" />
    );
  }

  // ADMINISTRADOR: CONSULTA DE MUESTRAS
  if (
    rol === "administrador" ||
    rol === "administrador del laboratorio" ||
    rol === "admin"
  ) {
    return (
      <Redirect href="/registro-resultados" />
    );
  }

  // OTROS ROLES
  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    gap: 15,
  },

  texto: {
    color: "#19385F",
    fontSize: 15,
    fontWeight: "600",
  },
});