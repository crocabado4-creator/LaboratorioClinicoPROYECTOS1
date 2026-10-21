
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  type InformeClinico,
  listarInformesFinalizados,
  obtenerInformeFinalizado,
} from "../services/informeResultadosService";

import {
  generarPDFResultado,
} from "../services/pdfResultadosService";

export default function HistorialResultados() {
  const [informes, setInformes] = useState<InformeClinico[]>([]);
  const [seleccionado, setSeleccionado] =
    useState<InformeClinico | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  const cargar = async () => {
    try {
      setCargando(true);
      setError("");

      const datos = await listarInformesFinalizados();
      setInformes(datos);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrir = async (id: string) => {
    try {
      setProcesando(true);
      setError("");

      const informe = await obtenerInformeFinalizado(id);
      setSeleccionado(informe);
    } catch (e: any) {
      setError(e?.message || "No se pudo abrir el informe.");
    } finally {
      setProcesando(false);
    }
  };

  const generarPDF = async () => {
    if (!seleccionado) return;

    try {
      setProcesando(true);
      setError("");

      await generarPDFResultado(seleccionado);
    } catch (e: any) {
      setError(e?.message || "No se pudo generar el PDF.");
    } finally {
      setProcesando(false);
    }
  };

  const filtrados = informes.filter((informe) =>
    [
      informe.pacienteNombre,
      informe.pacienteCI,
      informe.analisisNombre,
      informe.ordenId,
      informe.id,
    ]
      .join(" ")
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase())
  );

  return (
    <View style={styles.fondo}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.titulo}>
          Historial de resultados
        </Text>

        <Text style={styles.subtitulo}>
          Consulta informes clínicos validados de tu laboratorio.
        </Text>

        <View style={styles.panel}>
          <Text style={styles.etiqueta}>
            Buscar paciente, CI, análisis u orden
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Escribe para buscar"
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <Pressable
            style={styles.botonGris}
            onPress={cargar}
            disabled={cargando}
          >
            <Text style={styles.textoGris}>
              Actualizar historial
            </Text>
          </Pressable>
        </View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        {cargando ? (
          <ActivityIndicator size="large" color="#2563EB" />
        ) : (
          <>
            <Text style={styles.contador}>
              {filtrados.length} informe(s)
            </Text>

            {filtrados.map((informe) => (
              <View key={informe.id} style={styles.tarjeta}>
                <Text style={styles.nombre}>
                  {informe.analisisNombre}
                </Text>

                <Text style={styles.dato}>
                  Paciente: {informe.pacienteNombre}
                </Text>

                <Text style={styles.dato}>
                  CI: {informe.pacienteCI}
                </Text>

                <Text style={styles.dato}>
                  Orden: {informe.ordenId || "-"}
                </Text>

                <Text style={styles.dato}>
                  Validación: {informe.fechaValidacion}
                </Text>

                <Text style={styles.validado}>
                  Resultado validado
                </Text>

                <Pressable
                  style={styles.botonAzul}
                  disabled={procesando}
                  onPress={() => abrir(informe.id)}
                >
                  <Text style={styles.textoBlanco}>
                    Ver historial
                  </Text>
                </Pressable>
              </View>
            ))}

            {filtrados.length === 0 && (
              <Text style={styles.subtitulo}>
                No se encontraron informes.
              </Text>
            )}
          </>
        )}

        <Pressable
          style={styles.botonGris}
          onPress={() => router.back()}
        >
          <Text style={styles.textoGris}>Volver</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={seleccionado !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSeleccionado(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView contentContainerStyle={styles.contenido}>
              <Text style={styles.titulo}>
                Informe histórico
              </Text>

              {seleccionado && (
                <>
                  <Text style={styles.nombre}>
                    {seleccionado.laboratorioNombre}
                  </Text>

                  <Text style={styles.dato}>
                    Paciente: {seleccionado.pacienteNombre}
                  </Text>

                  <Text style={styles.dato}>
                    CI: {seleccionado.pacienteCI}
                  </Text>

                  <Text style={styles.dato}>
                    Orden: {seleccionado.ordenId || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Análisis: {seleccionado.analisisNombre}
                  </Text>

                  <Text style={styles.dato}>
                    Resultado: {seleccionado.valorResultado || "-"}
                    {" "}{seleccionado.unidad}
                  </Text>

                  <Text style={styles.dato}>
                    Bioquímico: {seleccionado.validadoPorNombre || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Validación: {seleccionado.fechaValidacion}
                  </Text>

                  <Text style={styles.nombre}>
                    Valores por parámetros
                  </Text>

                  {seleccionado.parametros.map((parametro) => (
                    <View
                      key={parametro.id}
                      style={styles.parametro}
                    >
                      <Text style={styles.nombre}>
                        {parametro.nombre}
                      </Text>

                      <Text style={styles.dato}>
                        Valor: {parametro.valor || "-"}
                      </Text>

                      <Text style={styles.dato}>
                        Unidad: {parametro.unidad || "-"}
                      </Text>

                      <Text style={styles.dato}>
                        Referencia: {parametro.referencia || "-"}
                      </Text>
                    </View>
                  ))}

                  <Pressable
                    style={styles.botonAzul}
                    disabled={procesando}
                    onPress={generarPDF}
                  >
                    <Text style={styles.textoBlanco}>
                      {procesando ? "Procesando..." : "Generar PDF"}
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                style={styles.botonGris}
                onPress={() => setSeleccionado(null)}
              >
                <Text style={styles.textoGris}>
                  Cerrar
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  contenido: {
    padding: 18,
    paddingBottom: 35,
    gap: 12,
  },
  titulo: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#19385F",
  },
  subtitulo: {
    color: "#64748B",
    lineHeight: 21,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    padding: 17,
    borderRadius: 13,
    gap: 10,
  },
  etiqueta: {
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 12,
    color: "#0F172A",
  },
  tarjeta: {
    padding: 17,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  nombre: {
    fontWeight: "bold",
    fontSize: 17,
    color: "#19385F",
  },
  dato: {
    fontSize: 14,
    color: "#475569",
  },
  contador: {
    fontWeight: "bold",
    color: "#19385F",
  },
  validado: {
    fontWeight: "bold",
    color: "#059669",
  },
  botonAzul: {
    padding: 14,
    borderRadius: 9,
    backgroundColor: "#2563EB",
  },
  textoBlanco: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  botonGris: {
    padding: 13,
    borderRadius: 9,
    backgroundColor: "#E2E8F0",
  },
  textoGris: {
    color: "#19385F",
    textAlign: "center",
    fontWeight: "bold",
  },
  error: {
    padding: 12,
    color: "#B91C1C",
    backgroundColor: "#FEE2E2",
    borderRadius: 9,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 12,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    maxHeight: "90%",
  },
  parametro: {
    borderTopWidth: 1,
    borderColor: "#CBD5E1",
    paddingTop: 10,
  },
});
