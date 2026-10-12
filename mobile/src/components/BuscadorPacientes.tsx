import React, { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type PacienteBuscador = {
  id?: string;
  pacienteId?: string;
  nombres?: string;
  apellidos?: string;
  ci?: string;
};

type Props = {
  pacientes: PacienteBuscador[];
  pacienteId: string;
  onSeleccionar: (id: string) => void;
};

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function obtenerId(paciente: PacienteBuscador): string {
  return String(paciente.pacienteId || paciente.id || "");
}

export default function BuscadorPacientes({
  pacientes,
  pacienteId,
  onSeleccionar,
}: Props) {
  const [busqueda, setBusqueda] = useState("");

  const pacientesFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);

    if (!texto) return pacientes;

    return pacientes.filter((paciente) => {
      const nombre = normalizar(paciente.nombres);
      const apellido = normalizar(paciente.apellidos);
      const ci = normalizar(paciente.ci);
      const completo = `${nombre} ${apellido}`;

      return (
        nombre.includes(texto) ||
        apellido.includes(texto) ||
        completo.includes(texto) ||
        ci.includes(texto)
      );
    });
  }, [pacientes, busqueda]);

  const seleccionado = pacientes.find(
    (paciente) => obtenerId(paciente) === pacienteId
  );

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Buscar paciente</Text>

      <TextInput
        style={styles.input}
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Nombre, apellido o carnet..."
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
      />

      {seleccionado && (
        <View style={styles.seleccionado}>
          <Text style={styles.seleccionadoTitulo}>
            Paciente seleccionado
          </Text>

          <Text style={styles.seleccionadoTexto}>
            {seleccionado.nombres} {seleccionado.apellidos}
          </Text>

          <Text style={styles.ci}>
            CI: {seleccionado.ci || "Sin registrar"}
          </Text>
        </View>
      )}

      <FlatList
        data={pacientesFiltrados}
        keyExtractor={(item, index) =>
          obtenerId(item) || String(index)
        }
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            No se encontraron pacientes.
          </Text>
        }
        renderItem={({ item }) => {
          const id = obtenerId(item);
          const activo = id === pacienteId;

          return (
            <TouchableOpacity
              style={[
                styles.paciente,
                activo && styles.pacienteActivo,
              ]}
              onPress={() => onSeleccionar(id)}
              disabled={!id}
            >
              <View style={styles.datos}>
                <Text style={styles.nombre}>
                  {item.nombres} {item.apellidos}
                </Text>

                <Text style={styles.ci}>
                  CI: {item.ci || "Sin registrar"}
                </Text>
              </View>

              <Text style={styles.accion}>
                {activo ? "Seleccionado" : "Seleccionar"}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  titulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 12,
  },
  seleccionado: {
    backgroundColor: "#DCFCE7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  seleccionadoTitulo: {
    color: "#166534",
    fontWeight: "700",
    marginBottom: 4,
  },
  seleccionadoTexto: {
    color: "#14532D",
    fontSize: 15,
    fontWeight: "600",
  },
  lista: {
    maxHeight: 280,
  },
  paciente: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pacienteActivo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  datos: {
    flex: 1,
    marginRight: 8,
  },
  nombre: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  ci: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  accion: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 12,
  },
  vacio: {
    textAlign: "center",
    color: "#64748B",
    padding: 20,
  },
});