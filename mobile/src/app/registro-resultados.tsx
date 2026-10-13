import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Muestra = {
  id: string;
  codigo: string;
  pacienteId: string;
  paciente: string;
  analisisId: string;
  analisis: string;
  ordenId: string;
  laboratorioId: string;
  fechaProcesamiento: string;
};

type Resultado = {
  id: string;
  muestraId: string;
  estado: string;
  valor: string;
  unidad: string;
};

type Fila = Muestra & {
  resultado?: Resultado;
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor);
}

function fecha(valor: any): string {
  if (!valor) return "";

  if (typeof valor.toDate === "function") {
    return valor.toDate().toLocaleString("es-BO");
  }

  if (valor instanceof Date) {
    return valor.toLocaleString("es-BO");
  }

  if (typeof valor === "string") {
    return valor;
  }

  return "";
}

function aviso(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }
  } else {
    Alert.alert(titulo, mensaje);
  }
}

// =====================================================
// PANTALLA
// =====================================================

export default function RegistroResultadosScreen() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  const [seleccionada, setSeleccionada] = useState<Fila | null>(null);
  const [valor, setValor] = useState("");
  const [unidad, setUnidad] = useState("");
  const [observacion, setObservacion] = useState("");

  // ===================================================
  // OBTENER PACIENTE
  // ===================================================

  async function obtenerPaciente(pacienteId: string): Promise<string> {
    if (!pacienteId) return "Sin paciente";

    try {
      const documento = await getDoc(doc(db, "pacientes", pacienteId));

      if (!documento.exists()) return pacienteId;

      const datos = documento.data();

      const nombre = texto(datos.nombre || datos.nombres);
      const apellido = texto(datos.apellido || datos.apellidos);

      return `${nombre} ${apellido}`.trim() || pacienteId;
    } catch {
      return pacienteId;
    }
  }

  // ===================================================
  // OBTENER ANÁLISIS
  // ===================================================

  async function obtenerAnalisis(analisisId: string): Promise<string> {
    if (!analisisId) return "Sin análisis";

    try {
      const documento = await getDoc(doc(db, "analisis", analisisId));

      if (!documento.exists()) return analisisId;

      const datos = documento.data();

      return texto(
        datos.nombre || datos.nombreAnalisis || datos.descripcion || analisisId
      );
    } catch {
      return analisisId;
    }
  }

  // ===================================================
  // CARGAR RESULTADOS
  // ===================================================

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      const usuarioDoc = await getDoc(doc(db, "usuarios", usuario.uid));

      if (!usuarioDoc.exists()) {
        throw new Error("No se encontró tu usuario.");
      }

      const datosUsuario = usuarioDoc.data();

      if (datosUsuario.activo === false) {
        throw new Error("Tu usuario está desactivado.");
      }

      const laboratorioId = texto(datosUsuario.laboratorioId);

      if (!laboratorioId) {
        throw new Error("Tu usuario no tiene laboratorio asignado.");
      }

      const consultaMuestras = query(
        collection(db, "muestras"),
        where("laboratorioId", "==", laboratorioId)
      );

      const consultaResultados = query(
        collection(db, "resultados"),
        where("laboratorioId", "==", laboratorioId)
      );

      const [muestrasSnap, resultadosSnap] = await Promise.all([
        getDocs(consultaMuestras),
        getDocs(consultaResultados),
      ]);

      const resultados: Resultado[] = resultadosSnap.docs.map((documento) => {
        const datos = documento.data();

        return {
          id: documento.id,
          muestraId: texto(datos.muestraId),
          estado: texto(datos.estado || "registrado"),
          valor: texto(datos.valor || datos.resultado),
          unidad: texto(datos.unidad),
        };
      });

      const lista = await Promise.all(
        muestrasSnap.docs
          .filter((documento) => {
            const estado = texto(documento.data().estado).toLowerCase();
            return estado === "procesada" || estado === "procesado";
          })
          .map(async (documento) => {
            const datos = documento.data();

            const pacienteId = texto(datos.pacienteId);
            const analisisId = texto(datos.analisisId);

            const paciente =
              texto(datos.pacienteNombre || datos.nombrePaciente) ||
              (await obtenerPaciente(pacienteId));

            const analisis =
              texto(datos.analisisNombre || datos.nombreAnalisis) ||
              (await obtenerAnalisis(analisisId));

            const resultado = resultados.find(
              (r) => r.muestraId === documento.id
            );

            const fila: Fila = {
              id: documento.id,
              codigo: texto(datos.codigo || datos.codigoMuestra || documento.id),
              pacienteId,
              paciente,
              analisisId,
              analisis,
              ordenId: texto(datos.ordenId),
              laboratorioId,
              fechaProcesamiento: fecha(datos.fechaProcesamiento),
              resultado,
            };

            return fila;
          })
      );

      setFilas(lista);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los resultados."
      );
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ===================================================
  // GUARDAR RESULTADO
  // ===================================================

  const guardar = async () => {
    if (!seleccionada || guardando) return;

    if (!valor.trim()) {
      aviso("Dato obligatorio", "Debes ingresar el resultado.");
      return;
    }

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      if (seleccionada.resultado) {
        throw new Error("Esta muestra ya tiene un resultado registrado.");
      }

      await addDoc(collection(db, "resultados"), {
        laboratorioId: seleccionada.laboratorioId,
        muestraId: seleccionada.id,
        ordenId: seleccionada.ordenId,
        pacienteId: seleccionada.pacienteId,
        analisisId: seleccionada.analisisId,
        valor: valor.trim(),
        unidad: unidad.trim(),
        observacion: observacion.trim(),
        estado: "registrado",
        registradoPor: usuario.uid,
        fechaRegistro: serverTimestamp(),
      });

      setSeleccionada(null);
      setValor("");
      setUnidad("");
      setObservacion("");

      await cargar();

      aviso("Correcto", "Resultado registrado correctamente.");
    } catch (e: unknown) {
      aviso(
        "Error",
        e instanceof Error ? e.message : "No se pudo registrar el resultado."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // CONTADORES
  // ===================================================

  const procesadas = filas.length;
  const registradas = filas.filter((f) => !!f.resultado).length;
  const pendientes = filas.filter((f) => !f.resultado).length;

  const filtradas = filas.filter((fila) => {
    const contenido = [
      fila.codigo,
      fila.paciente,
      fila.pacienteId,
      fila.analisis,
      fila.analisisId,
      fila.ordenId,
    ]
      .join(" ")
      .toLowerCase();

    return contenido.includes(busqueda.trim().toLowerCase());
  });

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.titulo}>Registro de resultados</Text>

        <Text style={styles.subtitulo}>
          Registra los resultados de las muestras que finalizaron su procesamiento.
        </Text>

        <View style={styles.contadores}>
          {[
            ["Muestras procesadas", procesadas],
            ["Resultados registrados", registradas],
            ["Pendientes de registro", pendientes],
          ].map(([nombre, cantidad]) => (
            <View style={styles.contador} key={String(nombre)}>
              <Text style={styles.contadorTitulo}>{nombre}</Text>
              <Text style={styles.contadorNumero}>{cantidad}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.barra}>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por paciente, muestra, orden o análisis..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable style={styles.botonActualizar} onPress={cargar}>
              <Text style={styles.textoBlanco}>Actualizar</Text>
            </Pressable>
          </View>

          {error !== "" && <Text style={styles.error}>{error}</Text>}

          {cargando ? (
            <ActivityIndicator size="large" color="#17365D" />
          ) : (
            <ScrollView horizontal>
              <View style={styles.tabla}>
                <View style={styles.cabecera}>
                  <Text style={[styles.cabeceraTexto, styles.colMuestra]}>
                    Muestra
                  </Text>
                  <Text style={[styles.cabeceraTexto, styles.colPaciente]}>
                    Paciente
                  </Text>
                  <Text style={[styles.cabeceraTexto, styles.colAnalisis]}>
                    Análisis
                  </Text>
                  <Text style={[styles.cabeceraTexto, styles.colFecha]}>
                    Fecha de procesamiento
                  </Text>
                  <Text style={[styles.cabeceraTexto, styles.colResultado]}>
                    Resultado
                  </Text>
                  <Text style={[styles.cabeceraTexto, styles.colEstado]}>
                    Estado
                  </Text>
                  <Text style={[styles.cabeceraTexto, styles.colAcciones]}>
                    Acciones
                  </Text>
                </View>

                {filtradas.map((fila) => (
                  <View style={styles.fila} key={fila.id}>
                    <Text style={[styles.celda, styles.colMuestra]}>
                      {fila.codigo}
                    </Text>

                    <Text style={[styles.celda, styles.colPaciente]}>
                      {fila.paciente}
                    </Text>

                    <Text style={[styles.celda, styles.colAnalisis]}>
                      {fila.analisis}
                    </Text>

                    <Text style={[styles.celda, styles.colFecha]}>
                      {fila.fechaProcesamiento || "-"}
                    </Text>

                    <Text style={[styles.celda, styles.colResultado]}>
                      {fila.resultado
                        ? `${fila.resultado.valor} ${fila.resultado.unidad}`.trim()
                        : "Pendiente"}
                    </Text>

                    <Text style={[styles.celda, styles.colEstado]}>
                      {fila.resultado?.estado || "pendiente"}
                    </Text>

                    <View style={styles.colAcciones}>
                      {fila.resultado ? (
                        <Text style={styles.registrado}>Registrado</Text>
                      ) : (
                        <Pressable
                          style={styles.botonRegistrar}
                          onPress={() => setSeleccionada(fila)}
                        >
                          <Text style={styles.textoBlanco}>Registrar</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}

                {filtradas.length === 0 && (
                  <Text style={styles.sinDatos}>
                    No se encontraron muestras procesadas.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={seleccionada !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSeleccionada(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitulo}>Registrar resultado</Text>

              <Text style={styles.modalDato}>
                Muestra: {seleccionada?.codigo}
              </Text>

              <Text style={styles.modalDato}>
                Paciente: {seleccionada?.paciente}
              </Text>

              <Text style={styles.modalDato}>
                Análisis: {seleccionada?.analisis}
              </Text>

              <Text style={styles.etiqueta}>Resultado *</Text>

              <TextInput
                style={styles.input}
                placeholder="Ejemplo: 13.5 o Positivo"
                value={valor}
                onChangeText={setValor}
                editable={!guardando}
              />

              <Text style={styles.etiqueta}>Unidad</Text>

              <TextInput
                style={styles.input}
                placeholder="Ejemplo: g/dL"
                value={unidad}
                onChangeText={setUnidad}
                editable={!guardando}
              />

              <Text style={styles.etiqueta}>Observación</Text>

              <TextInput
                style={[styles.input, styles.inputGrande]}
                placeholder="Observaciones del análisis"
                value={observacion}
                onChangeText={setObservacion}
                editable={!guardando}
                multiline
              />

              <View style={styles.botones}>
                <Pressable
                  style={styles.botonCancelar}
                  disabled={guardando}
                  onPress={() => setSeleccionada(null)}
                >
                  <Text style={styles.textoCancelar}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={styles.botonRegistrar}
                  disabled={guardando}
                  onPress={guardar}
                >
                  {guardando ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.textoBlanco}>Guardar resultado</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  titulo: {
    fontSize: 27,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 24,
  },
  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  contador: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  contadorTitulo: {
    fontSize: 13,
    color: "#64748B",
  },
  contadorNumero: {
    fontSize: 25,
    fontWeight: "800",
    color: "#17365D",
    marginTop: 8,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  barra: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  buscador: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0F172A",
  },
  botonActualizar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: "center",
  },
  textoBlanco: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  tabla: {
    minWidth: 1200,
  },
  cabecera: {
    flexDirection: "row",
    backgroundColor: "#17365D",
    padding: 12,
  },
  cabeceraTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  celda: {
    fontSize: 12,
    color: "#0F172A",
  },
  colMuestra: {
    width: 190,
  },
  colPaciente: {
    width: 190,
  },
  colAnalisis: {
    width: 190,
  },
  colFecha: {
    width: 190,
  },
  colResultado: {
    width: 150,
  },
  colEstado: {
    width: 130,
  },
  colAcciones: {
    width: 120,
    alignItems: "center",
  },
  botonRegistrar: {
    backgroundColor: "#2563EB",
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  registrado: {
    color: "#15803D",
    fontWeight: "800",
    fontSize: 12,
  },
  sinDatos: {
    textAlign: "center",
    padding: 25,
    color: "#64748B",
  },
  error: {
    color: "#DC2626",
    marginBottom: 14,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    maxHeight: "85%",
  },
  modalTitulo: {
    fontSize: 21,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 15,
  },
  modalDato: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 13,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 12,
    color: "#0F172A",
  },
  inputGrande: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  botones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  botonCancelar: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  textoCancelar: {
    color: "#334155",
    fontWeight: "700",
  },
});