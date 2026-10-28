
import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";

import { router, usePathname } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// TODAS LAS RUTAS DE RESULTADOS

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

// COMPROBAR SI ES UNA RUTA DE RESULTADOS

export function esRutaResultados(pathname: string) {
  return RUTAS_RESULTADOS.some(
    (opcion) => opcion.ruta === pathname
  );
}

// NORMALIZAR EL ROL

function normalizarRol(valor: unknown): string {
  if (typeof valor !== "string") return "";

  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// COMPONENTE PRINCIPAL

export default function BarraResultados() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const [rol, setRol] = useState("");
  const [cargando, setCargando] = useState(true);

  // OBTENER EL ROL DEL USUARIO EN FIRESTORE

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
          const referencia = doc(
            db,
            "usuarios",
            usuarioActual.uid
          );

          const documento = await getDoc(referencia);

          if (!activo) return;

          if (documento.exists()) {
            const datos = documento.data();

            if (datos.activo === true) {
              const rolUsuario =
                datos.rolNombre ||
                datos.rol ||
                datos.role ||
                "";

              setRol(normalizarRol(rolUsuario));
            }
          }
        } catch (error) {
          console.error(
            "Error al consultar el rol:",
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

  // VERIFICAR EL ROL

  const esBioquimico = rol === "bioquimico";

  const esAdministrador =
    rol === "administrador" ||
    rol === "administrador del laboratorio" ||
    rol === "admin";

  // OPCIONES SEGÚN EL ROL

  const opcionesVisibles = RUTAS_RESULTADOS
    .filter((opcion) => {
      // El Bioquímico ve todas las opciones
      if (esBioquimico) {
        return true;
      }

      // El Administrador solo ve consultas
      if (esAdministrador) {
        return (
          opcion.ruta === "/registro-resultados" ||
          opcion.ruta === "/informe-resultados" ||
          opcion.ruta === "/historial-resultados"
        );
      }

      // Otros roles no ven estas opciones
      return false;
    })
    .map((opcion) => {
      // Cambiar el nombre para el Administrador
      if (
        esAdministrador &&
        opcion.ruta === "/registro-resultados"
      ) {
        return {
          ...opcion,
          nombre: "Muestras disponibles",
        };
      }

      return opcion;
    });

  // DISEÑO RESPONSIVO

  const columnas =
    width < 560 ? 2 : width < 1050 ? 3 : 6;

  const totalColumnas = Math.min(
    columnas,
    Math.max(opcionesVisibles.length, 1)
  );

  const ancho =
    totalColumnas === 1
      ? "100%"
      : totalColumnas === 2
        ? "48%"
        : totalColumnas === 3
          ? "31%"
          : "15%";

  // CARGANDO ROL

  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator
          color="#19385F"
          size="small"
        />
        <Text style={styles.textoCargando}>
          Cargando menú...
        </Text>
      </View>
    );
  }

  // SI NO TIENE PERMISOS, NO MOSTRAR BOTONES

  if (opcionesVisibles.length === 0) {
    return null;
  }

  // MOSTRAR SOLO LAS OPCIONES PERMITIDAS

  return (
    <View style={styles.contenedor}>
      {opcionesVisibles.map((opcion) => {
        const activo = pathname === opcion.ruta;

        return (
          <Pressable
            key={opcion.ruta}
            accessibilityRole="button"
            accessibilityState={{
              selected: activo,
            }}
            onPress={() => {
              if (!activo) {
                router.replace(opcion.ruta as any);
              }
            }}
            style={({ pressed }) => [
              styles.boton,
              { width: ancho as any },
              activo && styles.botonActivo,
              pressed &&
                !activo &&
                styles.botonPresionado,
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

// ESTILOS

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

  cargando: {
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F1F5F9",
  },

  textoCargando: {
    color: "#19385F",
    fontSize: 13,
  },
});
