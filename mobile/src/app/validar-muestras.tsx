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

import { router } from "expo-router";

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

// ======================================================
// TIPOS
// ======================================================

type EstadoMuestra =
  | "tomada"
  | "aceptada"
  | "rechazada"
  | "procesada"
  | "en_proceso"
  | string;

type Muestra = {
  id: string;
  codigo: string;
  pacienteId: string;
  paciente: string;
  ordenId: string;
  analisisId: string;
  analisis: string;
  tipoMuestra: string;
  estado: EstadoMuestra;
  laboratorioId: string;
  fechaToma: string;
  motivoRechazo: string;
};

type Filtro =
  | "todas"
  | "pendientes"
  | "aceptadas"
  | "rechazadas";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor);
}

function obtenerFecha(valor: any): string {
  if (!valor) return "-";

  try {
    if (typeof valor.toDate === "function") {
      return valor.toDate().toLocaleString("es-BO");
    }

    if (valor instanceof Date) {
      return valor.toLocaleString("es-BO");
    }

    if (typeof valor === "string") {
      const fecha = new Date(valor);

      if (!isNaN(fecha.getTime())) {
        return fecha.toLocaleString("es-BO");
      }

      return valor;
    }

    return "-";
  } catch {
    return "-";
  }
}

function normalizarEstado(estado: string): string {
  return estado
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function mostrarAviso(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }
  } else {
    Alert.alert(titulo, mensaje);
  }
}

// ======================================================
// PANTALLA
// ======================================================

export default function ValidarMuestrasScreen() {
  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const [muestraSeleccionada, setMuestraSeleccionada] =
    useState<Muestra | null>(null);

  const [mostrarRechazo, setMostrarRechazo] =
    useState(false);

  const [motivoRechazo, setMotivoRechazo] =
    useState("");

  const [mostrarFiltros, setMostrarFiltros] =
    useState(false);

  // ====================================================
  // CARGAR MUESTRAS DEL LABORATORIO
  // ====================================================

  const cargarMuestras = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error(
          "Debes iniciar sesión para consultar las muestras."
        );
      }

      // OBTENER LABORATORIO DEL USUARIO

      const usuarioRef = doc(
        db,
        "usuarios",
        usuario.uid
      );

      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        throw new Error(
          "No se encontró tu usuario en Firestore."
        );
      }

      const datosUsuario = usuarioSnap.data();

      if (datosUsuario.activo === false) {
        throw new Error(
          "Tu cuenta está desactivada."
        );
      }

      const laboratorioId = texto(
        datosUsuario.laboratorioId
      );

      if (!laboratorioId) {
        throw new Error(
          "Tu usuario no tiene un laboratorio asignado."
        );
      }

      // CONSULTAR SOLAMENTE LAS MUESTRAS
      // DEL LABORATORIO DEL USUARIO

      const muestrasConsulta = query(
        collection(db, "muestras"),
        where(
          "laboratorioId",
          "==",
          laboratorioId
        )
      );

      const muestrasSnap = await getDocs(
        muestrasConsulta
      );

      // CACHÉ PARA EVITAR CONSULTAS REPETIDAS

      const pacientesCache: Record<string, string> = {};
      const analisisCache: Record<string, string> = {};

      // OBTENER NOMBRE DEL PACIENTE

      const obtenerPaciente = async (
        pacienteId: string
      ): Promise<string> => {
        if (!pacienteId) {
          return "Sin paciente";
        }

        if (pacientesCache[pacienteId]) {
          return pacientesCache[pacienteId];
        }

        try {
          const pacienteSnap = await getDoc(
            doc(db, "pacientes", pacienteId)
          );

          if (!pacienteSnap.exists()) {
            return pacienteId;
          }

          const datos = pacienteSnap.data();

          const nombre = texto(
            datos.nombre || datos.nombres
          );

          const apellido = texto(
            datos.apellido || datos.apellidos
          );

          const nombreCompleto =
            `${nombre} ${apellido}`.trim() ||
            pacienteId;

          pacientesCache[pacienteId] = nombreCompleto;

          return nombreCompleto;
        } catch {
          return pacienteId;
        }
      };

      // OBTENER NOMBRE DEL ANÁLISIS

      const obtenerAnalisis = async (
        analisisId: string
      ): Promise<string> => {
        if (!analisisId) {
          return "Sin análisis";
        }

        if (analisisCache[analisisId]) {
          return analisisCache[analisisId];
        }

        try {
          const analisisSnap = await getDoc(
            doc(db, "analisis", analisisId)
          );

          if (!analisisSnap.exists()) {
            return analisisId;
          }

          const datos = analisisSnap.data();

          const nombre = texto(
            datos.nombre ||
              datos.nombreAnalisis ||
              datos.descripcion ||
              analisisId
          );

          analisisCache[analisisId] = nombre;

          return nombre;
        } catch {
          return analisisId;
        }
      };

      // CONSTRUIR LISTA DE MUESTRAS

      const lista: Muestra[] = await Promise.all(
        muestrasSnap.docs.map(async (documento) => {
          const datos = documento.data();

          const pacienteId = texto(
            datos.pacienteId
          );

          const analisisId = texto(
            datos.analisisId
          );

          const nombrePaciente =
            texto(
              datos.pacienteNombre ||
                datos.nombrePaciente ||
                datos.paciente
            ) ||
            (await obtenerPaciente(pacienteId));

          const nombreAnalisis =
            texto(
              datos.analisisNombre ||
                datos.nombreAnalisis
            ) ||
            (await obtenerAnalisis(analisisId));

          return {
            id: documento.id,

            codigo: texto(
              datos.codigo ||
                datos.codigoMuestra ||
                documento.id
            ),

            pacienteId,

            paciente: nombrePaciente,

            ordenId: texto(
              datos.ordenId
            ),

            analisisId,

            analisis: nombreAnalisis,

            tipoMuestra: texto(
              datos.tipoMuestra ||
                datos.tipo ||
                "-"
            ),

            estado: texto(
              datos.estado || "tomada"
            ),

            laboratorioId,

            fechaToma: obtenerFecha(
              datos.fechaToma ||
                datos.fechaRegistro
            ),

            motivoRechazo: texto(
              datos.motivoRechazo
            ),
          };
        })
      );

      // ORDENAR POR CÓDIGO

      lista.sort((a, b) =>
        b.codigo.localeCompare(a.codigo)
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

  // ====================================================
  // CONTADORES
  // ====================================================

  const total = muestras.length;

  const pendientes = muestras.filter(
    (muestra) =>
      normalizarEstado(muestra.estado) ===
      "tomada"
  ).length;

  const aceptadas = muestras.filter(
    (muestra) =>
      normalizarEstado(muestra.estado) ===
      "aceptada"
  ).length;

  const rechazadas = muestras.filter(
    (muestra) =>
      normalizarEstado(muestra.estado) ===
      "rechazada"
  ).length;

  // ====================================================
  // BUSCADOR Y FILTROS
  // ====================================================

  const muestrasFiltradas = muestras.filter(
    (muestra) => {
      const contenido = [
        muestra.codigo,
        muestra.paciente,
        muestra.pacienteId,
        muestra.ordenId,
        muestra.analisis,
        muestra.analisisId,
        muestra.tipoMuestra,
      ]
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = contenido.includes(
        busqueda.trim().toLowerCase()
      );

      const estado = normalizarEstado(
        muestra.estado
      );

      let coincideFiltro = true;

      if (filtro === "pendientes") {
        coincideFiltro = estado === "tomada";
      }

      if (filtro === "aceptadas") {
        coincideFiltro = estado === "aceptada";
      }

      if (filtro === "rechazadas") {
        coincideFiltro = estado === "rechazada";
      }

      return coincideBusqueda && coincideFiltro;
    }
  );

  // ====================================================
  // ACEPTAR MUESTRA
  // ====================================================

  const aceptarMuestra = async (
    muestra: Muestra
  ) => {
    if (guardando) return;

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error(
          "Debes iniciar sesión."
        );
      }

      const muestraRef = doc(
        db,
        "muestras",
        muestra.id
      );

      await runTransaction(
        db,
        async (transaction) => {
          const muestraSnap =
            await transaction.get(muestraRef);

          if (!muestraSnap.exists()) {
            throw new Error(
              "La muestra ya no existe."
            );
          }

          const datos = muestraSnap.data();

          const estadoActual =
            normalizarEstado(
              texto(datos.estado)
            );

          if (estadoActual !== "tomada") {
            throw new Error(
              "Solo puedes aceptar muestras en estado tomada."
            );
          }

          transaction.update(muestraRef, {
            estado: "aceptada",
            estadoValidacion: "aceptada",
            validadoPor: usuario.uid,
            fechaValidacion: serverTimestamp(),
            fechaActualizacion: serverTimestamp(),
            motivoRechazo: "",
          });
        }
      );

      await cargarMuestras();

      mostrarAviso(
        "Correcto",
        "La muestra fue aceptada correctamente."
      );
    } catch (e: unknown) {
      mostrarAviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudo aceptar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ====================================================
  // ABRIR RECHAZO
  // ====================================================

  const abrirRechazo = (muestra: Muestra) => {
    setMuestraSeleccionada(muestra);
    setMotivoRechazo("");
    setMostrarRechazo(true);
  };

  // ====================================================
  // RECHAZAR MUESTRA
  // ====================================================

  const rechazarMuestra = async () => {
    if (!muestraSeleccionada || guardando) {
      return;
    }

    if (!motivoRechazo.trim()) {
      mostrarAviso(
        "Motivo obligatorio",
        "Debes indicar el motivo del rechazo."
      );
      return;
    }

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error(
          "Debes iniciar sesión."
        );
      }

      const muestraRef = doc(
        db,
        "muestras",
        muestraSeleccionada.id
      );

      await runTransaction(
        db,
        async (transaction) => {
          const muestraSnap =
            await transaction.get(muestraRef);

          if (!muestraSnap.exists()) {
            throw new Error(
              "La muestra ya no existe."
            );
          }

          const datos = muestraSnap.data();

          const estadoActual =
            normalizarEstado(
              texto(datos.estado)
            );

          if (estadoActual !== "tomada") {
            throw new Error(
              "Solo puedes rechazar muestras en estado tomada."
            );
          }

          transaction.update(muestraRef, {
            estado: "rechazada",
            estadoValidacion: "rechazada",
            motivoRechazo: motivoRechazo.trim(),
            validadoPor: usuario.uid,
            fechaValidacion: serverTimestamp(),
            fechaActualizacion: serverTimestamp(),
          });
        }
      );

      setMostrarRechazo(false);
      setMuestraSeleccionada(null);
      setMotivoRechazo("");

      await cargarMuestras();

      mostrarAviso(
        "Correcto",
        "La muestra fue rechazada correctamente."
      );
    } catch (e: unknown) {
      mostrarAviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudo rechazar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ====================================================
  // MOSTRAR ESTADO
  // ====================================================

  const mostrarEstado = (estado: string) => {
    const valor = normalizarEstado(estado);

    if (valor === "tomada") {
      return (
        <View style={styles.estadoTomada}>
          <Text style={styles.textoTomada}>
            tomada
          </Text>
        </View>
      );
    }

    if (valor === "aceptada") {
      return (
        <View style={styles.estadoAceptada}>
          <Text style={styles.textoAceptada}>
            aceptada
          </Text>
        </View>
      );
    }

    if (valor === "rechazada") {
      return (
        <View style={styles.estadoRechazada}>
          <Text style={styles.textoRechazada}>
            rechazada
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.estadoProcesada}>
        <Text style={styles.textoProcesada}>
          {estado}
        </Text>
      </View>
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
      >
        {/* ENCABEZADO SIN SPRINT NI HU */}

        <View style={styles.encabezado}>
          <View style={styles.encabezadoTexto}>
            <Text style={styles.titulo}>
              Recepción y validación de muestras
            </Text>

            <Text style={styles.subtitulo}>
              Verifica que las muestras recibidas sean
              aptas antes de realizar el análisis.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() => router.replace("/muestras")}
          >
            <Text style={styles.textoVolver}>
              Volver
            </Text>
          </Pressable>
        </View>

        {/* CONTADORES */}

        <View style={styles.contadores}>
          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Total de muestras
            </Text>

            <Text style={styles.contadorNumero}>
              {total}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Pendientes
            </Text>

            <Text style={styles.contadorNumero}>
              {pendientes}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Aceptadas
            </Text>

            <Text style={styles.contadorNumero}>
              {aceptadas}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Rechazadas
            </Text>

            <Text style={styles.contadorNumero}>
              {rechazadas}
            </Text>
          </View>
        </View>

        {/* PANEL PRINCIPAL */}

        <View style={styles.panel}>
          {/* BUSCADOR Y FILTROS */}

          <View style={styles.barraHerramientas}>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por código, paciente, orden o análisis..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable
              style={styles.selectorFiltro}
              onPress={() =>
                setMostrarFiltros(true)
              }
            >
              <Text style={styles.textoFiltro}>
                {filtro === "todas"
                  ? "Todas las muestras"
                  : filtro === "pendientes"
                  ? "Pendientes"
                  : filtro === "aceptadas"
                  ? "Aceptadas"
                  : "Rechazadas"}
              </Text>

              <Text style={styles.flechaFiltro}>
                ⌄
              </Text>
            </Pressable>

            <Pressable
              style={styles.botonActualizar}
              onPress={cargarMuestras}
              disabled={cargando}
            >
              <Text style={styles.textoBlanco}>
                Actualizar
              </Text>
            </Pressable>
          </View>

          {/* ERRORES */}

          {error !== "" && (
            <View style={styles.errorCaja}>
              <Text style={styles.errorTexto}>
                {error}
              </Text>

              <Pressable
                style={styles.botonReintentar}
                onPress={cargarMuestras}
              >
                <Text style={styles.textoBlanco}>
                  Reintentar
                </Text>
              </Pressable>
            </View>
          )}

          {/* TABLA */}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#2563EB"
              style={{ marginVertical: 30 }}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
            >
              <View style={styles.tabla}>
                {/* CABECERA */}

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
                      styles.colOrden,
                    ]}
                  >
                    Orden
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
                      styles.colFecha,
                    ]}
                  >
                    Fecha
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
                      styles.colProcesamiento,
                    ]}
                  >
                    Procesamiento
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

                {/* FILAS */}

                {muestrasFiltradas.map(
                  (muestra) => {
                    const estado =
                      normalizarEstado(
                        muestra.estado
                      );

                    const puedeValidar =
                      estado === "tomada";

                    return (
                      <View
                        key={muestra.id}
                        style={styles.fila}
                      >
                        <Text
                          style={[
                            styles.celda,
                            styles.codigo,
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
                            styles.colOrden,
                          ]}
                        >
                          {muestra.ordenId}
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
                          {muestra.tipoMuestra}
                        </Text>

                        <Text
                          style={[
                            styles.celda,
                            styles.colFecha,
                          ]}
                        >
                          {muestra.fechaToma}
                        </Text>

                        <View style={styles.colEstado}>
                          {mostrarEstado(
                            muestra.estado
                          )}
                        </View>

                        <Text
                          style={[
                            styles.celda,
                            styles.procesamiento,
                            styles.colProcesamiento,
                          ]}
                        >
                          No habilitada
                        </Text>

                        <View
                          style={[
                            styles.colAcciones,
                            styles.acciones,
                          ]}
                        >
                          {puedeValidar ? (
                            <>
                              <Pressable
                                style={
                                  styles.botonAceptar
                                }
                                disabled={guardando}
                                onPress={() =>
                                  aceptarMuestra(
                                    muestra
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.textoBlanco
                                  }
                                >
                                  Aceptar
                                </Text>
                              </Pressable>

                              <Pressable
                                style={
                                  styles.botonRechazar
                                }
                                disabled={guardando}
                                onPress={() =>
                                  abrirRechazo(
                                    muestra
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.textoBlanco
                                  }
                                >
                                  Rechazar
                                </Text>
                              </Pressable>
                            </>
                          ) : estado ===
                            "rechazada" ? (
                            <Text
                              style={
                                styles.motivoTexto
                              }
                            >
                              {muestra.motivoRechazo ||
                                "Rechazada"}
                            </Text>
                          ) : (
                            <Text
                              style={
                                styles.sinAcciones
                              }
                            >
                              Sin acciones
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  }
                )}

                {muestrasFiltradas.length === 0 && (
                  <Text style={styles.sinDatos}>
                    No se encontraron muestras.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* MODAL DE FILTROS */}

      <Modal
        visible={mostrarFiltros}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarFiltros(false)
        }
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>
              Filtrar muestras
            </Text>

            {(
              [
                ["todas", "Todas las muestras"],
                ["pendientes", "Pendientes"],
                ["aceptadas", "Aceptadas"],
                ["rechazadas", "Rechazadas"],
              ] as [Filtro, string][]
            ).map(([valor, nombre]) => (
              <Pressable
                key={valor}
                style={styles.opcionFiltro}
                onPress={() => {
                  setFiltro(valor);
                  setMostrarFiltros(false);
                }}
              >
                <Text style={styles.opcionTexto}>
                  {nombre}
                </Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.botonCerrar}
              onPress={() =>
                setMostrarFiltros(false)
              }
            >
              <Text style={styles.textoBlanco}>
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL RECHAZAR */}

      <Modal
        visible={mostrarRechazo}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarRechazo(false)
        }
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>
              Rechazar muestra
            </Text>

            <Text style={styles.modalDescripcion}>
              Código:{" "}
              {muestraSeleccionada?.codigo}
            </Text>

            <Text style={styles.modalDescripcion}>
              Paciente:{" "}
              {muestraSeleccionada?.paciente}
            </Text>

            <Text style={styles.label}>
              Motivo del rechazo
            </Text>

            <TextInput
              style={styles.inputMotivo}
              placeholder="Escribe el motivo del rechazo..."
              placeholderTextColor="#94A3B8"
              multiline
              value={motivoRechazo}
              onChangeText={setMotivoRechazo}
            />

            <View style={styles.botonesModal}>
              <Pressable
                style={styles.botonCancelar}
                disabled={guardando}
                onPress={() =>
                  setMostrarRechazo(false)
                }
              >
                <Text style={styles.textoCancelar}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={styles.botonRechazar}
                disabled={guardando}
                onPress={rechazarMuestra}
              >
                {guardando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.textoBlanco}>
                    Confirmar rechazo
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

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    padding: 18,
    paddingBottom: 40,
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  encabezadoTexto: {
    flex: 1,
    paddingRight: 15,
  },

  titulo: {
    fontSize: 25,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 7,
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
  },

  botonVolver: {
    backgroundColor: "#334155",
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 8,
  },

  textoVolver: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 22,
  },

  contador: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 8,
  },

  contadorNumero: {
    color: "#17365D",
    fontSize: 28,
    fontWeight: "800",
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  barraHerramientas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },

  buscador: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },

  selectorFiltro: {
    minWidth: 160,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  textoFiltro: {
    fontSize: 12,
    color: "#0F172A",
  },

  flechaFiltro: {
    color: "#334155",
    fontSize: 20,
  },

  botonActualizar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 43,
  },

  textoBlanco: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  tabla: {
    minWidth: 1650,
  },

  cabeceraTabla: {
    flexDirection: "row",
    backgroundColor: "#17365D",
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  cabeceraTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    minHeight: 62,
  },

  celda: {
    fontSize: 12,
    color: "#0F172A",
  },

  codigo: {
    fontWeight: "800",
  },

  colCodigo: {
    width: 195,
  },

  colPaciente: {
    width: 215,
  },

  colOrden: {
    width: 205,
  },

  colAnalisis: {
    width: 210,
  },

  colTipo: {
    width: 100,
  },

  colFecha: {
    width: 190,
  },

  colEstado: {
    width: 135,
  },

  colProcesamiento: {
    width: 150,
  },

  colAcciones: {
    width: 225,
  },

  acciones: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  estadoTomada: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  textoTomada: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 11,
  },

  estadoAceptada: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  textoAceptada: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 11,
  },

  estadoRechazada: {
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  textoRechazada: {
    color: "#991B1B",
    fontWeight: "800",
    fontSize: 11,
  },

  estadoProcesada: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  textoProcesada: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 11,
  },

  procesamiento: {
    color: "#DC2626",
    fontWeight: "700",
  },

  botonAceptar: {
    backgroundColor: "#16A34A",
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  botonRechazar: {
    backgroundColor: "#DC2626",
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  motivoTexto: {
    color: "#DC2626",
    fontSize: 11,
  },

  sinAcciones: {
    color: "#94A3B8",
    fontSize: 12,
  },

  sinDatos: {
    textAlign: "center",
    padding: 25,
    color: "#64748B",
    fontSize: 13,
  },

  errorCaja: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 9,
    padding: 13,
    marginBottom: 15,
  },

  errorTexto: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 10,
  },

  botonReintentar: {
    backgroundColor: "#2563EB",
    padding: 11,
    borderRadius: 7,
    alignItems: "center",
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    maxHeight: "85%",
  },

  modalTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 16,
  },

  modalDescripcion: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 9,
  },

  opcionFiltro: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  opcionTexto: {
    color: "#0F172A",
    fontSize: 14,
  },

  botonCerrar: {
    backgroundColor: "#334155",
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
    marginTop: 15,
  },

  label: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 14,
    marginBottom: 8,
  },

  inputMotivo: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    minHeight: 110,
    padding: 12,
    textAlignVertical: "top",
    color: "#0F172A",
  },

  botonesModal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  botonCancelar: {
    backgroundColor: "#E2E8F0",
    borderRadius: 7,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },

  textoCancelar: {
    color: "#334155",
    fontWeight: "700",
  },
});