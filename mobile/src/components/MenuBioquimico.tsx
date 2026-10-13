import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { router, usePathname } from "expo-router";

const opciones = [
  { nombre: "Registro de muestras", ruta: "/muestras" },
  { nombre: "Recepción y validación", ruta: "/validar-muestras" },
  { nombre: "Seguimiento de muestras", ruta: "/seguimiento-muestras" },
  { nombre: "Registro de resultados", ruta: "/registro-resultados" },
  { nombre: "Valores por parámetros", ruta: "/valores-parametros" },
  { nombre: "Estado de análisis", ruta: "/estado-analisis" },
  { nombre: "Validación de resultados", ruta: "/validacion-resultados" },
];

export default function MenuBioquimico() {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const navegar = (ruta: string) => {
    setAbierto(false);
    router.push(ruta as any);
  };

  const volver = () => {
    setAbierto(false);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View style={styles.contenedor}>
      <View style={styles.barra}>
        <Pressable
          style={styles.botonMenu}
          onPress={() => setAbierto(!abierto)}
        >
          <Text style={styles.icono}>
            {abierto ? "✕" : "☰"}
          </Text>
        </Pressable>

        <Text style={styles.titulo}>
          Menú Bioquímico
        </Text>

        <Pressable
          style={styles.botonVolver}
          onPress={volver}
        >
          <Text style={styles.textoVolver}>
            ← Volver
          </Text>
        </Pressable>
      </View>

      {abierto && (
        <ScrollView
          style={styles.lista}
          nestedScrollEnabled
        >
          {opciones.map((opcion) => {
            const activo = pathname === opcion.ruta;

            return (
              <Pressable
                key={opcion.ruta}
                style={[
                  styles.opcion,
                  activo && styles.opcionActiva,
                ]}
                onPress={() => navegar(opcion.ruta)}
              >
                <Text
                  style={[
                    styles.textoOpcion,
                    activo && styles.textoActivo,
                  ]}
                >
                  {opcion.nombre}
                </Text>

                <Text
                  style={[
                    styles.flecha,
                    activo && styles.textoActivo,
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            style={styles.opcionVolver}
            onPress={volver}
          >
            <Text style={styles.textoOpcion}>
              ← Volver atrás
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    zIndex: 10,
  },

  barra: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },

  botonMenu: {
    width: 48,
    height: 48,
    backgroundColor: "#17365D",
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  icono: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "700",
  },

  titulo: {
    flex: 1,
    color: "#17365D",
    fontSize: 16,
    fontWeight: "800",
  },

  botonVolver: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 13,
    paddingVertical: 14,
    borderRadius: 8,
  },

  textoVolver: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },

  lista: {
    maxHeight: 470,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },

  opcion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 8,
  },

  opcionActiva: {
    backgroundColor: "#17365D",
  },

  textoOpcion: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },

  textoActivo: {
    color: "#FFFFFF",
  },

  flecha: {
    color: "#64748B",
    fontSize: 23,
  },

  opcionVolver: {
    backgroundColor: "#E2E8F0",
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 16,
    marginBottom: 15,
  },
});