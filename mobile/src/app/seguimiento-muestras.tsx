import React, { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
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
  tipo: string;
  estado: string;
  fechaToma: string;
  fechaValidacion: string;
  fechaProcesamiento: string;
  motivoRechazo: string;
  validadoPor: string;
};

type Filtro =
  | "todas"
  | "tomada"
  | "aceptada"
  | "rechazada"
  | "en_proceso"
  | "procesada";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor);
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
    const convertido = new Date(valor);

    if (!isNaN(convertido.getTime())) {
      return convertido.toLocaleString("es-BO");
    }

    return valor;
  }

  return "";
}

function normalizarEstado(valor: unknown): string {
  const estado = texto(valor).toLowerCase().trim();

  if (estado === "pendiente") return "tomada";
  if (estado === "tomado") return "tomada";

  if (estado === "aceptado") return "aceptada";
  if (estado === "rechazado") return "rechazada";

  if (
    estado === "en proceso" ||
    estado === "en_proceso" ||
    estado === "procesando"
  ) {
    return "en_proceso";
  }

  if (estado === "procesado") return "procesada";

  return estado || "tomada";
}

function nombreEstado(estado: string): string {
  switch (estado) {
    case "tomada":
      return "Tomada";

    case "aceptada":
      return "Aceptada";

    case "rechazada":
      return "Rechazada";

    case "en_proceso":
      return "En proceso";

    case "procesada":
      return "Procesada";

    default:
      return estado;
  }
}

function colorEstado(estado: string) {
  switch (estado) {
    case "tomada":
      return {
        fondo: "#FEF3C7",
        texto: "#92400E",
      };

    case "aceptada":
      return {
        fondo: "#DCFCE7",
        texto: "#166534",
      };

    case "rechazada":
      return {
        fondo: "#FEE2E2",
        texto: "#B91C1C",
      };

    case "en_proceso":
      return {
        fondo: "#DBEAFE",
        texto: "#1D4ED8",
      };

    case "procesada":
      return {
        fondo: "#CCFBF1",
        texto: "#0F766E",
      };

    default:
      return {
        fondo: "#E2E8F0",
        texto: "#334155",
      };
  }
}

function mostrarError(error: unknown) {
  const mensaje =
    error instanceof Error
      ? error.message
      : "Ocurrió un error inesperado.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(mensaje);
    }
  } else {
    Alert.alert("Error", mensaje);
  }
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function SeguimientoMuestrasScreen() {
  const { width } = useWindowDimensions();

  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const [seleccionada, setSeleccionada] =
    useState<Muestra | null>(null);

  const [error, setError] = useState("");

  // ===================================================
  // OBTENER NOMBRE DEL PACIENTE
  // ===================================================

  const obtenerPaciente = async (
    pacienteId: string
  ): Promise<string> => {
    if (!pacienteId) return "Sin paciente";

    try {
      const referencia = doc(db, "pacientes", pacienteId);
      const documento = await getDoc(referencia);

      if (!documento.exists()) return pacienteId;

      const datos = documento.data();

      const nombre = texto(
        datos.nombre || datos.nombres
      );

      const apellido = texto(
        datos.apellido || datos.apellidos
      );

      const completo = `${nombre} ${apellido}`.trim();

      return completo || pacienteId;
    } catch {
      return pacienteId;
    }
  };

  // ===================================================
  // OBTENER NOMBRE DEL ANÁLISIS
  // ===================================================

  const obtenerAnalisis = async (
    analisisId: string
  ): Promise<string> => {
    if (!analisisId) return "Sin análisis";

    try {
      const referencia = doc(db, "analisis", analisisId);
      const documento = await getDoc(referencia);

      if (!documento.exists()) return analisisId;

      const datos = documento.data();

      return texto(
        datos.nombre ||
        datos.nombreAnalisis ||
        datos.descripcion ||
        analisisId
      );
    } catch {
      return analisisId;
    }
  };

  // ===================================================
  // CARGAR MUESTRAS DE FIRESTORE
  // ===================================================

  const cargarMuestras = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      const referenciaUsuario = doc(
        db,
        "usuarios",
        usuario.uid
      );

      const documentoUsuario = await getDoc(
        referenciaUsuario
      );

      if (!documentoUsuario.exists()) {
        throw new Error(
          "No se encontró tu usuario en Firestore."
        );
      }

      const datosUsuario = documentoUsuario.data();

      if (datosUsuario.activo === false) {
        throw new Error("Tu usuario está desactivado.");
      }

      const laboratorioId = texto(
        datosUsuario.laboratorioId
      );

      if (!laboratorioId) {
        throw new Error(
          "Tu usuario no tiene laboratorio asignado."
        );
      }

      const consulta = query(
        collection(db, "muestras"),
        where("laboratorioId", "==", laboratorioId)
      );

      const resultado = await getDocs(consulta);

      const lista = await Promise.all(
        resultado.docs.map(async (documento) => {
          const datos = documento.data();

          const pacienteId = texto(
            datos.pacienteId
          );

          const analisisId = texto(
            datos.analisisId
          );

          let paciente = texto(
            datos.pacienteNombre ||
            datos.nombrePaciente ||
            datos.paciente
          );

          let analisis = texto(
            datos.analisisNombre ||
            datos.nombreAnalisis
          );

          if (!paciente) {
            paciente = await obtenerPaciente(
              pacienteId
            );
          }

          if (!analisis) {
            analisis = await obtenerAnalisis(
              analisisId
            );
          }

          const estado = normalizarEstado(
            datos.estado
          );

          const muestra: Muestra = {
            id: documento.id,

            codigo: texto(
              datos.codigo ||
              datos.codigoMuestra ||
              documento.id
            ),

            pacienteId,
            paciente,

            analisisId,
            analisis,

            ordenId: texto(datos.ordenId),

            tipo: texto(
              datos.tipoMuestra ||
              datos.tipo ||
              "-"
            ),

            estado,

            fechaToma: fecha(
              datos.fechaToma ||
              datos.fecha
            ),

            fechaValidacion: fecha(
              datos.fechaValidacion
            ),

            fechaProcesamiento: fecha(
              datos.fechaProcesamiento
            ),

            motivoRechazo: texto(
              datos.motivoRechazo
            ),

            validadoPor: texto(
              datos.validadoPor
            ),
          };

          return muestra;
        })
      );

      lista.sort((a, b) =>
        b.fechaToma.localeCompare(a.fechaToma)
      );

      setMuestras(lista);
    } catch (e: unknown) {
      const mensaje =
        e instanceof Error
          ? e.message
          : "No se pudieron cargar las muestras.";

      setError(mensaje);
      setMuestras([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMuestras();
  }, [cargarMuestras]);

  // ===================================================
  // CONTADORES
  // ===================================================

  const tomadas = muestras.filter(
    (m) => m.estado === "tomada"
  ).length;

  const aceptadas = muestras.filter(
    (m) => m.estado === "aceptada"
  ).length;

  const rechazadas = muestras.filter(
    (m) => m.estado === "rechazada"
  ).length;

  const enProceso = muestras.filter(
    (m) => m.estado === "en_proceso"
  ).length;

  const procesadas = muestras.filter(
    (m) => m.estado === "procesada"
  ).length;

  // ===================================================
  // BUSCADOR Y FILTROS
  // ===================================================

  const muestrasFiltradas = muestras.filter(
    (muestra) => {
      const buscar = busqueda.toLowerCase().trim();

      const contenido = [
        muestra.codigo,
        muestra.paciente,
        muestra.pacienteId,
        muestra.ordenId,
        muestra.analisis,
        muestra.analisisId,
        muestra.tipo,
      ]
        .join(" ")
        .toLowerCase();

      const coincideBusqueda =
        contenido.includes(buscar);

      const coincideEstado =
        filtro === "todas" ||
        muestra.estado === filtro;

      return coincideBusqueda && coincideEstado;
    }
  );

  // ===================================================
  // CONTADORES VISUALES
  // ===================================================

  const Contador = ({
    titulo,
    cantidad,
  }: {
    titulo: string;
    cantidad: number;
  }) => (
    <View
      style={[
        styles.contador,
        {
          width:
            width > 900
              ? "19%"
              : width > 600
              ? "31%"
              : "48%",
        },
      ]}
    >
      <Text style={styles.contadorTitulo}>
        {titulo}
      </Text>

      <Text style={styles.contadorNumero}>
        {cantidad}
      </Text>
    </View>
  );

  // ===================================================
  // FILA DE TABLA
  // ===================================================

  const renderFila = ({
    item,
  }: {
    item: Muestra;
  }) => {
    const colores = colorEstado(item.estado);

    return (
      <View style={styles.fila}>
        <Text style={[styles.celda, styles.colCodigo]}>
          {item.codigo}
        </Text>

        <Text style={[styles.celda, styles.colPaciente]}>
          {item.paciente}
        </Text>

        <Text style={[styles.celda, styles.colAnalisis]}>
          {item.analisis}
        </Text>

        <Text style={[styles.celda, styles.colTipo]}>
          {item.tipo}
        </Text>

        <View style={styles.colEstado}>
          <View
            style={[
              styles.estadoBadge,
              {
                backgroundColor: colores.fondo,
              },
            ]}
          >
            <Text
              style={[
                styles.estadoTexto,
                {
                  color: colores.texto,
                },
              ]}
            >
              {nombreEstado(item.estado)}
            </Text>
          </View>
        </View>

        <Text style={[styles.celda, styles.colFecha]}>
          {item.fechaToma || "-"}
        </Text>

        <View style={styles.colAcciones}>
          <Pressable
            style={styles.botonHistorial}
            onPress={() => setSeleccionada(item)}
          >
            <Text style={styles.botonHistorialTexto}>
              Historial
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
      >
        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <Text style={styles.titulo}>
            Seguimiento de muestras
          </Text>
        </View>

        {/* CONTADORES */}

        <View style={styles.contadores}>
          <Contador
            titulo="Tomadas"
            cantidad={tomadas}
          />

          <Contador
            titulo="Aceptadas"
            cantidad={aceptadas}
          />

          <Contador
            titulo="Rechazadas"
            cantidad={rechazadas}
          />

          <Contador
            titulo="En proceso"
            cantidad={enProceso}
          />

          <Contador
            titulo="Procesadas"
            cantidad={procesadas}
          />
        </View>

        {/* BUSCADOR */}

        <View style={styles.panel}>
          <View style={styles.barraBusqueda}>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por paciente, código, orden o análisis..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable
              style={styles.botonActualizar}
              onPress={cargarMuestras}
            >
              <Text style={styles.botonTexto}>
                Actualizar
              </Text>
            </Pressable>
          </View>

          {/* FILTROS */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtros}
          >
            {(
              [
                ["todas", "Todas"],
                ["tomada", "Tomadas"],
                ["aceptada", "Aceptadas"],
                ["rechazada", "Rechazadas"],
                ["en_proceso", "En proceso"],
                ["procesada", "Procesadas"],
              ] as [Filtro, string][]
            ).map(([valor, nombre]) => (
              <Pressable
                key={valor}
                style={[
                  styles.filtro,
                  filtro === valor &&
                    styles.filtroActivo,
                ]}
                onPress={() => setFiltro(valor)}
              >
                <Text
                  style={[
                    styles.filtroTexto,
                    filtro === valor &&
                      styles.filtroTextoActivo,
                  ]}
                >
                  {nombre}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ERRORES */}

          {error !== "" && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          {/* TABLA */}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#17365D"
              style={{ marginTop: 30 }}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
            >
              <View style={styles.tabla}>
                <View style={styles.cabeceraTabla}>
                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colCodigo,
                    ]}
                  >
                    Código
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colPaciente,
                    ]}
                  >
                    Paciente
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colAnalisis,
                    ]}
                  >
                    Análisis
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colTipo,
                    ]}
                  >
                    Tipo
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colEstado,
                    ]}
                  >
                    Estado
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colFecha,
                    ]}
                  >
                    Fecha de toma
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colAcciones,
                    ]}
                  >
                    Acciones
                  </Text>
                </View>

                <FlatList
                  data={muestrasFiltradas}
                  keyExtractor={(item) => item.id}
                  renderItem={renderFila}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <Text style={styles.sinDatos}>
                      No se encontraron muestras.
                    </Text>
                  }
                />
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* MODAL DE HISTORIAL */}

      <Modal
        visible={seleccionada !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSeleccionada(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitulo}>
                Historial de muestra
              </Text>

              <Text style={styles.modalCodigo}>
                {seleccionada?.codigo}
              </Text>

              <Text style={styles.modalDato}>
                Paciente: {seleccionada?.paciente}
              </Text>

              <Text style={styles.modalDato}>
                Análisis: {seleccionada?.analisis}
              </Text>

              <Text style={styles.modalDato}>
                Orden: {seleccionada?.ordenId}
              </Text>

              <View style={styles.separador} />

              <Text style={styles.historialTitulo}>
                1. Toma de muestra
              </Text>

              <Text style={styles.modalDato}>
                Fecha: {seleccionada?.fechaToma || "No registrada"}
              </Text>

              <Text style={styles.historialTitulo}>
                2. Recepción y validación
              </Text>

              <Text style={styles.modalDato}>
                Estado: {nombreEstado(seleccionada?.estado || "")}
              </Text>

              <Text style={styles.modalDato}>
                Fecha: {seleccionada?.fechaValidacion || "No registrada"}
              </Text>

              <Text style={styles.modalDato}>
                Responsable: {seleccionada?.validadoPor || "No registrado"}
              </Text>

              {seleccionada?.estado === "rechazada" && (
                <Text style={styles.motivo}>
                  Motivo de rechazo: {seleccionada.motivoRechazo}
                </Text>
              )}

              <Text style={styles.historialTitulo}>
                3. Procesamiento
              </Text>

              <Text style={styles.modalDato}>
                Fecha: {seleccionada?.fechaProcesamiento || "No registrada"}
              </Text>

              <Pressable
                style={styles.botonCerrar}
                onPress={() => setSeleccionada(null)}
              >
                <Text style={styles.botonTexto}>
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

  encabezado: {
    marginBottom: 20,
  },

  titulo: {
    fontSize: 27,
    fontWeight: "800",
    color: "#17365D",
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 22,
  },

  contador: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    minHeight: 95,
  },

  contadorTitulo: {
    fontSize: 13,
    color: "#64748B",
  },

  contadorNumero: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17365D",
    marginTop: 8,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
  },

  barraBusqueda: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  buscador: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#0F172A",
  },

  botonActualizar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: "center",
  },

  botonTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  filtros: {
    marginBottom: 15,
  },

  filtro: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },

  filtroActivo: {
    backgroundColor: "#17365D",
  },

  filtroTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },

  filtroTextoActivo: {
    color: "#FFFFFF",
  },

  tabla: {
    minWidth: 1150,
  },

  cabeceraTabla: {
    flexDirection: "row",
    backgroundColor: "#17365D",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  cabeceraTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  celda: {
    fontSize: 12,
    color: "#0F172A",
  },

  colCodigo: {
    width: 180,
  },

  colPaciente: {
    width: 220,
  },

  colAnalisis: {
    width: 200,
  },

  colTipo: {
    width: 110,
  },

  colEstado: {
    width: 130,
  },

  colFecha: {
    width: 190,
  },

  colAcciones: {
    width: 110,
    alignItems: "center",
  },

  estadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  estadoTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  botonHistorial: {
    backgroundColor: "#64748B",
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },

  botonHistorialTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  sinDatos: {
    padding: 25,
    color: "#64748B",
    textAlign: "center",
  },

  error: {
    color: "#DC2626",
    marginBottom: 15,
    fontSize: 13,
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 22,
    maxHeight: "85%",
  },

  modalTitulo: {
    fontSize: 21,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 12,
  },

  modalCodigo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },

  modalDato: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
  },

  historialTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17365D",
    marginTop: 16,
    marginBottom: 8,
  },

  separador: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },

  motivo: {
    fontSize: 13,
    color: "#B91C1C",
    marginTop: 7,
  },

  botonCerrar: {
    backgroundColor: "#17365D",
    borderRadius: 9,
    padding: 13,
    alignItems: "center",
    marginTop: 20,
  },
});