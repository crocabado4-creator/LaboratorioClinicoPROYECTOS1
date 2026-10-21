
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { generarPDFResultado } from "../services/pdfResultadosService";

import {
  InformeClinico,
  listarInformesFinalizados,
  obtenerInformeFinalizado,
} from "../services/informeResultadosService";

export default function InformeResultados() {
  const [informes, setInformes] = useState<InformeClinico[]>([]);
  const [seleccionado, setSeleccionado] =
    useState<InformeClinico | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [error, setError] = useState("");
  

  const cargarInformes = async () => {
    try {
      setCargando(true);
      setError("");

      const datos = await listarInformesFinalizados();
      setInformes(datos);
    } catch (e: any) {
      const mensaje =
        e?.message || "No se pudieron cargar los informes.";

      setError(mensaje);
      setInformes([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInformes();
  }, []);

  const abrirInforme = async (resultadoId: string) => {
    try {
      setCargandoDetalle(true);

      const detalle = await obtenerInformeFinalizado(resultadoId);

      setSeleccionado(detalle);
      setModalVisible(true);
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message || "No se pudo obtener el informe."
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

const descargarPDF = async () => {
  if (!seleccionado || generandoPDF) {
    return;
  }

  try {
    setGenerandoPDF(true);

    await generarPDFResultado(seleccionado);
  } catch (error: any) {
    const mensaje =
      error?.message || "No se pudo generar el PDF.";

    Alert.alert("Error al generar PDF", mensaje);
  } finally {
    setGenerandoPDF(false);
  }
};

  const informesFiltrados = informes.filter((informe) => {
    const contenido = [
      informe.pacienteNombre,
      informe.pacienteCI,
      informe.analisisNombre,
      informe.ordenId,
      informe.id,
    ]
      .join(" ")
      .toLowerCase();

    return contenido.includes(busqueda.trim().toLowerCase());
  });

  return (
    <View style={styles.contenedor}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>
              Informes clínicos
            </Text>

            <Text style={styles.subtitulo}>
              Consulta los resultados validados del laboratorio.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() => router.back()}
          >
            <Text style={styles.textoBlanco}>
              Volver
            </Text>
          </Pressable>
        </View>

        <View style={styles.resumen}>
          <Text style={styles.resumenEtiqueta}>
            Resultados disponibles
          </Text>

          <Text style={styles.resumenNumero}>
            {informes.length}
          </Text>

          <Text style={styles.resumenDescripcion}>
            Solo se muestran resultados validados o finalizados.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.etiqueta}>
            Buscar informe
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Paciente, CI, análisis u orden"
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <Pressable
            style={styles.botonActualizar}
            onPress={cargarInformes}
            disabled={cargando}
          >
            <Text style={styles.textoActualizar}>
              Actualizar informes
            </Text>
          </Pressable>
        </View>

        {cargando ? (
          <View style={styles.centrado}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.mensaje}>
              Cargando informes clínicos...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.error}>
            <Text style={styles.textoError}>
              {error}
            </Text>
          </View>
        ) : informesFiltrados.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.mensaje}>
              No se encontraron informes validados.
            </Text>
          </View>
        ) : (
          informesFiltrados.map((informe) => (
            <View key={informe.id} style={styles.tarjeta}>
              <Text style={styles.nombreAnalisis}>
                {informe.analisisNombre}
              </Text>

              <Text style={styles.dato}>
                Paciente: {informe.pacienteNombre}
              </Text>

              <Text style={styles.dato}>
                CI: {informe.pacienteCI}
              </Text>

              <Text style={styles.dato}>
                Orden: {informe.ordenId || "Sin identificar"}
              </Text>

              <Text style={styles.dato}>
                Validación: {informe.fechaValidacion}
              </Text>

              <Text style={styles.estado}>
                Resultado validado
              </Text>

              <Pressable
                style={styles.botonPrincipal}
                disabled={cargandoDetalle}
                onPress={() => abrirInforme(informe.id)}
              >
                <Text style={styles.textoBlanco}>
                  {cargandoDetalle
                    ? "Cargando..."
                    : "Ver informe"}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView
              contentContainerStyle={styles.contenidoModal}
            >
              <Text style={styles.tituloModal}>
                Informe de resultados
              </Text>

              {seleccionado && (
                <>
                  <Text style={styles.nombreLaboratorio}>
                    {seleccionado.laboratorioNombre}
                  </Text>

                  <View style={styles.seccion}>
                    <Text style={styles.seccionTitulo}>
                      Datos del paciente
                    </Text>

                    <Text style={styles.dato}>
                      Nombre: {seleccionado.pacienteNombre}
                    </Text>

                    <Text style={styles.dato}>
                      CI: {seleccionado.pacienteCI}
                    </Text>

                    <Text style={styles.dato}>
                      Orden: {seleccionado.ordenId || "-"}
                    </Text>
                  </View>

                  <View style={styles.seccion}>
                    <Text style={styles.seccionTitulo}>
                      Resultado clínico
                    </Text>

                    <Text style={styles.dato}>
                      Análisis: {seleccionado.analisisNombre}
                    </Text>

                    <Text style={styles.dato}>
                      Valor: {seleccionado.valorResultado || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Unidad: {seleccionado.unidad || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Observaciones:{" "}
                      {seleccionado.observaciones ||
                        "Sin observaciones"}
                    </Text>
                  </View>

                  <View style={styles.seccion}>
                    <Text style={styles.seccionTitulo}>
                      Valores por parámetros
                    </Text>

                    {seleccionado.parametros.length === 0 ? (
                      <Text style={styles.mensaje}>
                        No se registraron valores individuales.
                      </Text>
                    ) : (
                      seleccionado.parametros.map((parametro) => (
                        <View
                          key={parametro.id}
                          style={styles.parametro}
                        >
                          <Text style={styles.parametroNombre}>
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

                          {Boolean(parametro.observacion) && (
                            <Text style={styles.dato}>
                              Observación: {parametro.observacion}
                            </Text>
                          )}
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.seccion}>
                    <Text style={styles.seccionTitulo}>
                      Validación
                    </Text>

                    <Text style={styles.dato}>
                      Fecha: {seleccionado.fechaValidacion}
                    </Text>

                    <Text style={styles.dato}>
                      Bioquímico:{" "}
                      {seleccionado.validadoPorNombre ||
                        "No registrado"}
                    </Text>
                  </View>
                </>
              )}
              {seleccionado && (
                <Pressable
                  style={[
                    styles.botonPrincipal,
                    generandoPDF && { opacity: 0.6 },
                  ]}
                  onPress={descargarPDF}
                  disabled={generandoPDF}
                >
                  <Text style={styles.textoBlanco}>
                    {generandoPDF
                      ? "Generando PDF..."
                      : "Generar PDF clínico"}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={styles.botonCerrar}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.textoBlanco}>
                  Cerrar informe
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
  contenedor: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  contenido: {
    padding: 18,
    paddingBottom: 45,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  titulo: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#19385F",
  },
  subtitulo: {
    color: "#64748B",
    marginTop: 6,
    lineHeight: 20,
  },
  botonVolver: {
    backgroundColor: "#475569",
    padding: 12,
    borderRadius: 9,
  },
  textoBlanco: {
    color: "#FFFFFF",
    fontWeight: "bold",
    textAlign: "center",
  },
  resumen: {
    backgroundColor: "#19385F",
    padding: 20,
    borderRadius: 15,
    marginBottom: 18,
  },
  resumenEtiqueta: {
    color: "#DBEAFE",
    fontSize: 14,
  },
  resumenNumero: {
    fontSize: 35,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginVertical: 5,
  },
  resumenDescripcion: {
    color: "#E2E8F0",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    padding: 17,
    borderRadius: 14,
    marginBottom: 15,
  },
  etiqueta: {
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 9,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    borderRadius: 9,
    marginBottom: 12,
    color: "#0F172A",
  },
  botonActualizar: {
    backgroundColor: "#E2E8F0",
    padding: 12,
    borderRadius: 9,
    alignSelf: "flex-start",
  },
  textoActualizar: {
    color: "#19385F",
    fontWeight: "bold",
  },
  centrado: {
    padding: 30,
    alignItems: "center",
  },
  mensaje: {
    color: "#64748B",
    marginTop: 10,
  },
  error: {
    padding: 17,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    marginBottom: 16,
  },
  textoError: {
    color: "#B91C1C",
  },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  nombreAnalisis: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 12,
  },
  dato: {
    color: "#475569",
    marginBottom: 8,
    lineHeight: 20,
  },
  estado: {
    color: "#059669",
    fontWeight: "bold",
    marginVertical: 10,
  },
  botonPrincipal: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 14,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    maxHeight: "90%",
    overflow: "hidden",
  },
  contenidoModal: {
    padding: 20,
    paddingBottom: 30,
  },
  tituloModal: {
    fontSize: 23,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 12,
  },
  nombreLaboratorio: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
    marginBottom: 18,
  },
  seccion: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  seccionTitulo: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 13,
  },
  parametro: {
    borderTopWidth: 1,
    borderTopColor: "#CBD5E1",
    paddingTop: 12,
    marginTop: 10,
  },
  parametroNombre: {
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 8,
  },
  botonCerrar: {
    backgroundColor: "#475569",
    padding: 15,
    borderRadius: 10,
  },
});
