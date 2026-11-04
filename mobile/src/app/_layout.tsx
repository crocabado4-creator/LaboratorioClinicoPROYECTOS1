import React, { useState, useEffect } from "react";

import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

import {
  Stack,
  usePathname,
  router,
} from "expo-router";

// ======================================================
// RUTAS DEL BIOQUÍMICO
// ======================================================
// Se conserva toda la navegación.
// Se elimina únicamente Valores por parámetros.
// ======================================================

const rutasBioquimico = [
  "/muestras",
  "/validar-muestras",
  "/seguimiento-muestras",
  "/registro-resultados",
  "/estado-analisis",
  "/validacion-resultados",
  "/informe-resultados",
  "/historial-resultados",
  "/resultados",
];

// ======================================================
// OPCIONES DEL MENÚ BIOQUÍMICO
// ======================================================

const opcionesBioquimico = [
  {
    nombre: "Registro de muestras",
    ruta: "/muestras",
  },
  {
    nombre: "Recepción y validación",
    ruta: "/validar-muestras",
  },
  {
    nombre: "Seguimiento de muestras",
    ruta: "/seguimiento-muestras",
  },
  {
    nombre: "Registro de resultados",
    ruta: "/registro-resultados",
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
    nombre: "Informes clínicos",
    ruta: "/informe-resultados",
  },
  {
    nombre: "Historial de resultados",
    ruta: "/historial-resultados",
  },
];

// ======================================================
// MENÚ BIOQUÍMICO
// ======================================================

function MenuBioquimico() {
  const pathname = usePathname();

  const [abierto, setAbierto] = useState(false);

  // Cerrar el menú al cambiar de pantalla.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  // NAVEGAR A UNA OPCIÓN
  const navegar = (ruta: string) => {
    setAbierto(false);

    if (pathname === ruta) {
      return;
    }

    router.push(ruta as any);
  };

  // VOLVER
  const volver = () => {
    setAbierto(false);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View style={styles.menuContenedor}>
      {/* BARRA SUPERIOR */}

      <View style={styles.barraSuperior}>
        {/* BOTÓN DE LAS TRES BARRAS */}

        <Pressable
          style={styles.botonMenu}
          onPress={() => setAbierto(!abierto)}
        >
          <Text style={styles.iconoMenu}>
            {abierto ? "✕" : "☰"}
          </Text>
        </Pressable>

        {/* TÍTULO */}

        <Text style={styles.tituloMenu}>
          Menú Bioquímico
        </Text>

        {/* BOTÓN VOLVER */}

        <Pressable
          style={styles.botonVolver}
          onPress={volver}
        >
          <Text style={styles.textoVolver}>
            ← Volver
          </Text>
        </Pressable>
      </View>

      {/* MENÚ DESPLEGABLE */}

      {abierto && (
        <ScrollView
          style={styles.listaOpciones}
          contentContainerStyle={
            styles.contenidoOpciones
          }
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {opcionesBioquimico.map((opcion) => {
            const activo =
              pathname === opcion.ruta;

            return (
              <Pressable
                key={opcion.ruta}
                style={[
                  styles.opcion,
                  activo && styles.opcionActiva,
                ]}
                onPress={() =>
                  navegar(opcion.ruta)
                }
              >
                <Text
                  style={[
                    styles.textoOpcion,
                    activo &&
                      styles.textoOpcionActiva,
                  ]}
                >
                  {opcion.nombre}
                </Text>

                <Text
                  style={[
                    styles.flecha,
                    activo &&
                      styles.textoOpcionActiva,
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ======================================================
// LAYOUT PRINCIPAL
// ======================================================

export default function RootLayout() {
  const pathname = usePathname();

  const mostrarMenu =
    rutasBioquimico.includes(pathname);

  return (
    <View style={styles.contenedor}>
      {/* MENÚ DEL BIOQUÍMICO */}

      {mostrarMenu && <MenuBioquimico />}

      {/* PANTALLAS DE LA APLICACIÓN */}

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

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  // CONTENEDOR GENERAL

  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    flex: 1,
  },

  // MENÚ

  menuContenedor: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    zIndex: 10,
  },

  // BARRA SUPERIOR

  barraSuperior: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    minHeight: 64,
  },

  // BOTÓN HAMBURGUESA

  botonMenu: {
    width: 42,
    height: 42,
    backgroundColor: "#19385F",
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  iconoMenu: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 30,
  },

  // TÍTULO

  tituloMenu: {
    flex: 1,
    marginLeft: 12,
    color: "#19385F",
    fontSize: 15,
    fontWeight: "700",
  },

  // BOTÓN VOLVER

  botonVolver: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
  },

  textoVolver: {
    color: "#19385F",
    fontSize: 12,
    fontWeight: "700",
  },

  // LISTA DESPLEGABLE

  listaOpciones: {
    maxHeight: 440,
    backgroundColor: "#FFFFFF",
  },

  contenidoOpciones: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },

  // OPCIONES

  opcion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  opcionActiva: {
    backgroundColor: "#DBEAFE",
    borderColor: "#2563EB",
  },

  textoOpcion: {
    color: "#19385F",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },

  textoOpcionActiva: {
    color: "#1D4ED8",
  },

  flecha: {
    color: "#64748B",
    fontSize: 24,
    fontWeight: "500",
    marginLeft: 10,
  },
});