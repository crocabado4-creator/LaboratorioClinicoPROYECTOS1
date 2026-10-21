
import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";

const opciones = [
  {
    nombre: "Registro de resultados",
    descripcion: "HU-26: Registrar resultados clínicos",
    ruta: "/registro-resultados",
  },
  {
    nombre: "Valores por parámetros",
    descripcion: "HU-27: Valores, unidades y referencias",
    ruta: "/valores-parametros",
  },
  {
    nombre: "Estado de análisis",
    descripcion: "HU-28: Seguimiento de análisis",
    ruta: "/estado-analisis",
  },
  {
    nombre: "Validación de resultados",
    descripcion: "HU-29: Validar resultados clínicos",
    ruta: "/validacion-resultados",
  },
  {
    nombre: "Informes clínicos y PDF",
    descripcion: "HU-30 y HU-31: Consultar y generar informes",
    ruta: "/informe-resultados",
  },
  {
    nombre: "Historial de resultados",
    descripcion: "HU-32: Consultar resultados anteriores",
    ruta: "/historial-resultados",
  },
];

export default function Resultados() {
  return (
    <View style={styles.fondo}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.titulo}>
          Resultados clínicos
        </Text>

        <Text style={styles.subtitulo}>
          Selecciona la funcionalidad que necesitas.
        </Text>

        {opciones.map((opcion) => (
          <Pressable
            key={opcion.ruta}
            style={styles.tarjeta}
            onPress={() => router.push(opcion.ruta as any)}
          >
            <Text style={styles.nombre}>
              {opcion.nombre}
            </Text>

            <Text style={styles.descripcion}>
              {opcion.descripcion}
            </Text>

            <Text style={styles.abrir}>
              Abrir módulo →
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.volver}
          onPress={() => router.back()}
        >
          <Text style={styles.textoVolver}>
            Volver
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  titulo: {
    fontSize: 27,
    fontWeight: "bold",
    color: "#19385F",
  },
  subtitulo: {
    fontSize: 15,
    color: "#64748B",
    marginBottom: 8,
  },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  nombre: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#19385F",
  },
  descripcion: {
    color: "#64748B",
    marginTop: 8,
  },
  abrir: {
    color: "#2563EB",
    fontWeight: "bold",
    marginTop: 14,
  },
  volver: {
    backgroundColor: "#475569",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  textoVolver: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
});
