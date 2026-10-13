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
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type EstadoMuestra =
  | "tomada"
  | "aceptada"
  | "rechazada"
  | "en_proceso"
  | "procesada";

type Muestra = {
  id: string;
  codigo: string;
  pacienteId: string;
  paciente: string;
  analisisId: string;
  analisis: string;
  ordenId: string;
  tipo: string;
  laboratorioId: string;
  estado: EstadoMuestra;
  fechaToma: string;
  fechaInicioProceso: string;
  fechaProcesamiento: string;
  motivoRechazo: string;
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
    return valor;
  }

  return "";
}

function normalizarEstado(valor: unknown): EstadoMuestra {
  const estado = texto(valor).toLowerCase().trim();

  if (estado === "aceptada" || estado === "aceptado") {
    return "aceptada";
  }

  if (estado === "rechazada" || estado === "rechazado") {
    return "rechazada";
  }

  if (
    estado === "en_proceso" ||
    estado === "en proceso" ||
    estado === "procesando"
  ) {
    return "en_proceso";
  }

  if (estado === "procesada" || estado === "procesado") {
    return "procesada";
  }

  return "tomada";
}

function nombreEstado(estado: EstadoMuestra): string {
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
  }
}

function coloresEstado(estado: EstadoMuestra) {
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
  }
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

export default function EstadoAnalisisScreen() {
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [error, setError] = useState("");

  const [seleccionada, setSeleccionada] =
    useState<Muestra | null>(null);

  const [nuevoEstado, setNuevoEstado] =
    useState<EstadoMuestra | null>(null);

  // ===================================================
  // OBTENER PACIENTE
  // ===================================================

  async function obtenerPaciente(pacienteId: string) {
    if (!pacienteId) return "Sin paciente";

    try {
      const documento = await getDoc(
        doc(db, "pacientes", pacienteId)
      );

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

  async function obtenerAnalisis(analisisId: string) {
    if (!analisisId) return "Sin análisis";

    try {
      const documento = await getDoc(
        doc(db, "analisis", analisisId)
      );

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
  }

  // ===================================================
  // CARGAR MUESTRAS
  // ===================================================

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      const usuarioDoc = await getDoc(
        doc(db, "usuarios", usuario.uid)
      );

      if (!usuarioDoc.exists()) {
        throw new Error("No se encontró tu usuario.");
      }

      const datosUsuario = usuarioDoc.data();

      if (datosUsuario.activo === false) {
        throw new Error("Tu cuenta está desactivada.");
      }

      const laboratorioId = texto(datosUsuario.laboratorioId);

      if (!laboratorioId) {
        throw new Error("No tienes laboratorio asignado.");
      }

      const consulta = query(
        collection(db, "muestras"),
        where("laboratorioId", "==", laboratorioId)
      );

      const resultado = await getDocs(consulta);

      const lista = await Promise.all(
        resultado.docs.map(async (documento) => {
          const datos = documento.data();

          const pacienteId = texto(datos.pacienteId);
          const analisisId = texto(datos.analisisId);

          const paciente =
            texto(datos.pacienteNombre || datos.nombrePaciente) ||
            (await obtenerPaciente(pacienteId));

          const analisis =
            texto(datos.analisisNombre || datos.nombreAnalisis) ||
            (await obtenerAnalisis(analisisId));

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
              datos.tipoMuestra || datos.tipo || "-"
            ),

            laboratorioId,

            estado: normalizarEstado(datos.estado),

            fechaToma: fecha(datos.fechaToma),

            fechaInicioProceso: fecha(
              datos.fechaInicioProceso
            ),

            fechaProcesamiento: fecha(
              datos.fechaProcesamiento
            ),

            motivoRechazo: texto(datos.motivoRechazo),
          };

          return muestra;
        })
      );

      setMuestras(lista);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar las muestras."
      );

      setMuestras([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ===================================================
  // CAMBIAR ESTADO
  // ===================================================

  const actualizarEstado = async () => {
    if (!seleccionada || !nuevoEstado || guardando) return;

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      const referencia = doc(
        db,
        "muestras",
        seleccionada.id
      );

      await runTransaction(db, async (transaction) => {
        const documento = await transaction.get(referencia);

        if (!documento.exists()) {
          throw new Error("La muestra ya no existe.");
        }

        const datos = documento.data();

        if (
          texto(datos.laboratorioId) !==
          seleccionada.laboratorioId
        ) {
          throw new Error(
            "No tienes permiso para modificar esta muestra."
          );
        }

        const estadoActual = normalizarEstado(
          datos.estado
        );

        if (
          nuevoEstado === "en_proceso" &&
          estadoActual !== "aceptada"
        ) {
          throw new Error(
            "Solo una muestra aceptada puede iniciar su procesamiento."
          );
        }

        if (
          nuevoEstado === "procesada" &&
          estadoActual !== "en_proceso"
        ) {
          throw new Error(
            "Solo una muestra en proceso puede marcarse como procesada."
          );
        }

        if (
          nuevoEstado !== "en_proceso" &&
          nuevoEstado !== "procesada"
        ) {
          throw new Error(
            "No se permite realizar este cambio de estado."
          );
        }

        const cambios: Record<string, unknown> = {
          estado: nuevoEstado,
          actualizadoPor: usuario.uid,
          fechaActualizacion: serverTimestamp(),
        };

        if (nuevoEstado === "en_proceso") {
          cambios.fechaInicioProceso = serverTimestamp();
        }

        if (nuevoEstado === "procesada") {
          cambios.fechaProcesamiento = serverTimestamp();
        }

        transaction.update(referencia, cambios);
      });

      setSeleccionada(null);
      setNuevoEstado(null);

      await cargar();

      aviso(
        "Correcto",
        "El estado de la muestra se actualizó correctamente."
      );
    } catch (e: unknown) {
      aviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el estado."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // CONTADORES
  // ===================================================

  const contar = (estado: EstadoMuestra) =>
    muestras.filter((muestra) => muestra.estado === estado)
      .length;

  const filtradas = muestras.filter((muestra) => {
    const contenido = [
      muestra.codigo,
      muestra.paciente,
      muestra.analisis,
      muestra.ordenId,
      muestra.tipo,
    ]
      .join(" ")
      .toLowerCase();

    const coincideBusqueda = contenido.includes(
      busqueda.trim().toLowerCase()
    );

    const coincideEstado =
      filtro === "todas" || muestra.estado === filtro;

    return coincideBusqueda && coincideEstado;
  });

  // ===================================================
  // ABRIR CAMBIO DE ESTADO
  // ===================================================

  const abrirCambio = (
    muestra: Muestra,
    estado: EstadoMuestra
  ) => {
    setSeleccionada(muestra);
    setNuevoEstado(estado);
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.titulo}>
          Estado de análisis
        </Text>

        <Text style={styles.subtitulo}>
          Controla el procesamiento de las muestras del laboratorio.
        </Text>

        {/* CONTADORES */}

        <View style={styles.contadores}>
          {[
            ["Tomadas", contar("tomada")],
            ["Aceptadas", contar("aceptada")],
            ["Rechazadas", contar("rechazada")],
            ["En proceso", contar("en_proceso")],
            ["Procesadas", contar("procesada")],
          ].map(([titulo, cantidad]) => (
            <View
              style={styles.contador}
              key={String(titulo)}
            >
              <Text style={styles.contadorTitulo}>
                {titulo}
              </Text>

              <Text style={styles.contadorNumero}>
                {cantidad}
              </Text>
            </View>
          ))}
        </View>

        {/* BUSCADOR */}

        <View style={styles.panel}>
          <View style={styles.barra}>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por paciente, muestra, orden o análisis..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable
              style={styles.botonActualizar}
              onPress={cargar}
            >
              <Text style={styles.textoBlanco}>
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

          {error !== "" && (
            <Text style={styles.error}>{error}</Text>
          )}

          {/* TABLA */}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#17365D"
              style={{ marginTop: 30 }}
            />
          ) : (
            <ScrollView horizontal>
              <View style={styles.tabla}>
                <View style={styles.cabecera}>
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
                      styles.colAcciones,
                    ]}
                  >
                    Acciones
                  </Text>
                </View>

                {filtradas.map((muestra) => {
                  const colores = coloresEstado(
                    muestra.estado
                  );

                  return (
                    <View
                      style={styles.fila}
                      key={muestra.id}
                    >
                      <Text
                        style={[
                          styles.celda,
                          styles.colCodigo,
                        ]}
                      >
                        {muestra.codigo}
                      </Text>

                      <Text
                        style={[
                          styles.celda,
                          styles.colPaciente,
                        ]}
                      >
                        {muestra.paciente}
                      </Text>

                      <Text
                        style={[
                          styles.celda,
                          styles.colAnalisis,
                        ]}
                      >
                        {muestra.analisis}
                      </Text>

                      <Text
                        style={[
                          styles.celda,
                          styles.colTipo,
                        ]}
                      >
                        {muestra.tipo}
                      </Text>

                      <View style={styles.colEstado}>
                        <View
                          style={[
                            styles.estadoBadge,
                            {
                              backgroundColor:
                                colores.fondo,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.estadoTexto,
                              {
                                color:
                                  colores.texto,
                              },
                            ]}
                          >
                            {nombreEstado(
                              muestra.estado
                            )}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.colAcciones}>
                        {muestra.estado ===
                          "aceptada" && (
                          <Pressable
                            style={styles.botonIniciar}
                            onPress={() =>
                              abrirCambio(
                                muestra,
                                "en_proceso"
                              )
                            }
                          >
                            <Text
                              style={styles.textoBlanco}
                            >
                              Iniciar proceso
                            </Text>
                          </Pressable>
                        )}

                        {muestra.estado ===
                          "en_proceso" && (
                          <Pressable
                            style={styles.botonFinalizar}
                            onPress={() =>
                              abrirCambio(
                                muestra,
                                "procesada"
                              )
                            }
                          >
                            <Text
                              style={styles.textoBlanco}
                            >
                              Finalizar proceso
                            </Text>
                          </Pressable>
                        )}

                        {muestra.estado ===
                          "tomada" && (
                          <Text
                            style={styles.textoPendiente}
                          >
                            Pendiente de validación
                          </Text>
                        )}

                        {muestra.estado ===
                          "rechazada" && (
                          <Text
                            style={styles.textoRechazada}
                          >
                            No habilitada
                          </Text>
                        )}

                        {muestra.estado ===
                          "procesada" && (
                          <Text
                            style={styles.textoProcesada}
                          >
                            Finalizada
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}

                {filtradas.length === 0 && (
                  <Text style={styles.sinDatos}>
                    No se encontraron muestras.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* CONFIRMACIÓN */}

      <Modal
        visible={seleccionada !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!guardando) {
            setSeleccionada(null);
            setNuevoEstado(null);
          }
        }}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>
              Confirmar cambio de estado
            </Text>

            <Text style={styles.modalDato}>
              Muestra: {seleccionada?.codigo}
            </Text>

            <Text style={styles.modalDato}>
              Paciente: {seleccionada?.paciente}
            </Text>

            <Text style={styles.modalDato}>
              Análisis: {seleccionada?.analisis}
            </Text>

            <Text style={styles.modalDato}>
              Estado actual:{" "}
              {seleccionada
                ? nombreEstado(seleccionada.estado)
                : ""}
            </Text>

            <Text style={styles.modalNuevoEstado}>
              Nuevo estado:{" "}
              {nuevoEstado
                ? nombreEstado(nuevoEstado)
                : ""}
            </Text>

            <View style={styles.botones}>
              <Pressable
                style={styles.botonCancelar}
                disabled={guardando}
                onPress={() => {
                  setSeleccionada(null);
                  setNuevoEstado(null);
                }}
              >
                <Text style={styles.textoCancelar}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={styles.botonConfirmar}
                disabled={guardando}
                onPress={actualizarEstado}
              >
                {guardando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.textoBlanco}>
                    Confirmar
                  </Text>
                )}
              </Pressable>
            </View>
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
    marginBottom: 22,
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },

  contador: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    borderRadius: 12,
    padding: 16,
  },

  barra: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
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

  textoBlanco: {
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
    minWidth: 1050,
  },

  cabecera: {
    flexDirection: "row",
    backgroundColor: "#17365D",
    padding: 12,
  },

  cabeceraTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
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

  colCodigo: {
    width: 180,
  },

  colPaciente: {
    width: 200,
  },

  colAnalisis: {
    width: 200,
  },

  colTipo: {
    width: 110,
  },

  colEstado: {
    width: 140,
  },

  colAcciones: {
    width: 190,
    alignItems: "center",
  },

  estadoBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },

  estadoTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  botonIniciar: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },

  botonFinalizar: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },

  textoPendiente: {
    fontSize: 12,
    color: "#92400E",
  },

  textoRechazada: {
    fontSize: 12,
    color: "#DC2626",
  },

  textoProcesada: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "700",
  },

  sinDatos: {
    padding: 25,
    textAlign: "center",
    color: "#64748B",
  },

  error: {
    color: "#DC2626",
    marginBottom: 12,
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
    padding: 22,
  },

  modalTitulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 16,
  },

  modalDato: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 9,
  },

  modalNuevoEstado: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
    marginTop: 10,
  },

  botones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  botonCancelar: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
  },

  textoCancelar: {
    color: "#334155",
    fontWeight: "700",
  },

  botonConfirmar: {
    flex: 1,
    backgroundColor: "#17365D",
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
  },
});