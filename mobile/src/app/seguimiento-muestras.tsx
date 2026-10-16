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

import { useRouter } from "expo-router";

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

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Muestra = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  ordenId: string;
  solicitudId: string;
  pacienteId: string;
  analisisId: string;
  analisisNombre: string;
  codigoEtiqueta: string;
  tipo: string;
  estado: string;
  aceptada: boolean;
  motivoRechazo: string;
  fechaToma: any;
  fechaValidacion: any;
  fechaInicioProcesamiento: any;
  fechaFinProcesamiento: any;
  historialEstados: any[];
};

type Paciente = {
  nombre: string;
  ci: string;
};

type Usuario = {
  uid: string;
  laboratorioId: string;
  rol: string;
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: any): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function mostrarMensaje(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

function confirmar(
  titulo: string,
  mensaje: string,
  accion: () => void
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) {
      accion();
    }
  } else {
    Alert.alert(titulo, mensaje, [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Confirmar",
        onPress: accion,
      },
    ]);
  }
}

function obtenerError(error: any): string {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Comprueba que la muestra pertenece a tu laboratorio " +
      "y que tiene el estado correcto."
    );
  }

  return error?.message || "Ocurrió un error inesperado.";
}

function mostrarFecha(valor: any): string {
  if (!valor) {
    return "No registrada";
  }

  try {
    if (typeof valor.toDate === "function") {
      return valor.toDate().toLocaleString("es-BO");
    }

    const fecha = new Date(valor);

    if (isNaN(fecha.getTime())) {
      return "No registrada";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "No registrada";
  }
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
      return estado || "Sin estado";
  }
}

function colorEstado(estado: string): string {
  switch (estado) {
    case "tomada":
      return "#D97706";

    case "aceptada":
      return "#2563EB";

    case "rechazada":
      return "#DC2626";

    case "en_proceso":
      return "#7C3AED";

    case "procesada":
      return "#059669";

    default:
      return "#64748B";
  }
}

function convertirMuestra(
  id: string,
  datos: any
): Muestra {
  return {
    id,

    muestraId: texto(datos.muestraId) || id,

    laboratorioId: texto(datos.laboratorioId),

    ordenId: texto(datos.ordenId),

    solicitudId: texto(datos.solicitudId),

    pacienteId: texto(datos.pacienteId),

    analisisId: texto(datos.analisisId),

    analisisNombre:
      texto(datos.analisisNombre) || "Análisis",

    codigoEtiqueta:
      texto(datos.codigoEtiqueta) || id,

    tipo:
      texto(datos.tipoMuestra) ||
      texto(datos.tipo) ||
      "No especificado",

    estado: texto(datos.estado) || "tomada",

    aceptada:
      datos.aceptada === true ||
      (
        datos.aceptada === undefined &&
        ["aceptada", "en_proceso", "procesada"].includes(
          texto(datos.estado)
        )
      ),

    motivoRechazo: texto(datos.motivoRechazo),

    fechaToma:
      datos.fechaToma ||
      datos.fechaRegistro ||
      null,

    fechaValidacion:
      datos.fechaValidacion || null,

    fechaInicioProcesamiento:
      datos.fechaInicioProcesamiento || null,

    fechaFinProcesamiento:
      datos.fechaFinProcesamiento || null,

    historialEstados: Array.isArray(datos.historialEstados)
      ? datos.historialEstados
      : [],
  };
}

// =====================================================
// COMPONENTE
// =====================================================

export default function SeguimientoMuestras() {
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [muestras, setMuestras] =
    useState<Muestra[]>([]);

  const [pacientes, setPacientes] = useState<
    Record<string, Paciente>
  >({});

  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] = useState(false);

  const [procesandoId, setProcesandoId] = useState("");

  const [detalle, setDetalle] =
    useState<Muestra | null>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const [cargandoDetalle, setCargandoDetalle] =
    useState(false);

  // ===================================================
  // OBTENER USUARIO
  // ===================================================

  const obtenerUsuario = async (): Promise<Usuario> => {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      throw new Error("Debes iniciar sesión.");
    }

    const usuarioSnap = await getDoc(
      doc(db, "usuarios", firebaseUser.uid)
    );

    if (!usuarioSnap.exists()) {
      throw new Error(
        "No existe tu usuario en Firestore."
      );
    }

    const datos = usuarioSnap.data();

    if (datos.activo !== true) {
      throw new Error("Tu usuario está inactivo.");
    }

    if (datos.rol !== "bioquimico") {
      throw new Error(
        "Esta pantalla corresponde al bioquímico."
      );
    }

    const laboratorioId = texto(datos.laboratorioId);

    if (!laboratorioId) {
      throw new Error(
        "Tu usuario no tiene laboratorio asignado."
      );
    }

    return {
      uid: firebaseUser.uid,
      laboratorioId,
      rol: texto(datos.rol),
    };
  };

  // ===================================================
  // CARGAR MUESTRAS
  // ===================================================

  const cargarDatos = useCallback(
    async (mostrarCarga = true) => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        const usuarioActual = await obtenerUsuario();

        setUsuario(usuarioActual);

        const consultaMuestras = query(
          collection(db, "muestras"),
          where(
            "laboratorioId",
            "==",
            usuarioActual.laboratorioId
          )
        );

        const consultaPacientes = query(
          collection(db, "pacientes"),
          where(
            "laboratorioId",
            "==",
            usuarioActual.laboratorioId
          )
        );

        const [muestrasSnap, pacientesSnap] =
          await Promise.all([
            getDocs(consultaMuestras),
            getDocs(consultaPacientes),
          ]);

        const listaMuestras = muestrasSnap.docs.map(
          (documento) =>
            convertirMuestra(
              documento.id,
              documento.data()
            )
        );

        listaMuestras.sort((a, b) => {
          const orden = [
            "aceptada",
            "en_proceso",
            "tomada",
            "procesada",
            "rechazada",
          ];

          return (
            orden.indexOf(a.estado) -
            orden.indexOf(b.estado)
          );
        });

        const mapaPacientes: Record<string, Paciente> = {};

        pacientesSnap.docs.forEach((documento) => {
          const datos = documento.data();

          const nombres = texto(
            datos.nombres || datos.nombre
          );

          const apellidos = texto(
            datos.apellidos || datos.apellido
          );

          mapaPacientes[documento.id] = {
            nombre:
              [nombres, apellidos]
                .filter(Boolean)
                .join(" ") || "Paciente",

            ci: texto(datos.ci),
          };
        });

        setMuestras(listaMuestras);
        setPacientes(mapaPacientes);

        // Si el detalle está abierto, actualizarlo también.
        setDetalle((anterior) => {
          if (!anterior) {
            return null;
          }

          return (
            listaMuestras.find(
              (muestra) => muestra.id === anterior.id
            ) || anterior
          );
        });
      } catch (error: any) {
        console.error(
          "Error cargando seguimiento:",
          error
        );

        mostrarMensaje(
          "Error",
          obtenerError(error)
        );
      } finally {
        setCargando(false);
      }
    },
    []
  );

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // BOTÓN ACTUALIZAR
  // ===================================================

  const actualizar = async () => {
    if (actualizando) {
      return;
    }

    try {
      setActualizando(true);

      await cargarDatos(false);
    } finally {
      setActualizando(false);
    }
  };

  // ===================================================
  // BOTÓN VER DETALLE
  // ===================================================

  const verDetalle = async (muestra: Muestra) => {
    try {
      setCargandoDetalle(true);

      const usuarioActual =
        usuario || (await obtenerUsuario());

      const muestraSnap = await getDoc(
        doc(db, "muestras", muestra.id)
      );

      if (!muestraSnap.exists()) {
        throw new Error(
          "Esta muestra ya no existe."
        );
      }

      const datos = muestraSnap.data();

      if (
        texto(datos.laboratorioId) !==
        usuarioActual.laboratorioId
      ) {
        throw new Error(
          "La muestra pertenece a otro laboratorio."
        );
      }

      const muestraActualizada = convertirMuestra(
        muestraSnap.id,
        datos
      );

      setDetalle(muestraActualizada);
      setModalVisible(true);
    } catch (error: any) {
      console.error(
        "Error consultando detalle:",
        error
      );

      mostrarMensaje(
        "No se pudo abrir el detalle",
        obtenerError(error)
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ===================================================
  // CAMBIAR ESTADO
  // ===================================================

  const cambiarEstado = async (
    muestra: Muestra,
    nuevoEstado: "en_proceso" | "procesada"
  ) => {
    try {
      if (procesandoId) {
        return;
      }

      const usuarioActual =
        usuario || (await obtenerUsuario());

      setProcesandoId(muestra.id);

      const muestraRef = doc(
        db,
        "muestras",
        muestra.id
      );

      await runTransaction(db, async (transaction) => {
        const muestraSnap = await transaction.get(
          muestraRef
        );

        if (!muestraSnap.exists()) {
          throw new Error(
            "La muestra ya no existe."
          );
        }

        const datos = muestraSnap.data();

        if (
          texto(datos.laboratorioId) !==
          usuarioActual.laboratorioId
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        const estadoActual = texto(datos.estado);

        const estadoEsperado =
          nuevoEstado === "en_proceso"
            ? "aceptada"
            : "en_proceso";

        if (estadoActual !== estadoEsperado) {
          throw new Error(
            `La muestra debe estar en estado "${nombreEstado(
              estadoEsperado
            )}" para realizar esta acción.`
          );
        }

        // Compatibilidad con muestras anteriores
        // que no guardaban el campo aceptada.
        if (datos.aceptada === false) {
          throw new Error(
            "La muestra no está aceptada."
          );
        }

        const cambios: Record<string, any> = {
          estado: nuevoEstado,
          actualizadoPor: usuarioActual.uid,
          fechaActualizacion: serverTimestamp(),
        };

        if (nuevoEstado === "en_proceso") {
          cambios.fechaInicioProcesamiento =
            serverTimestamp();
        }

        if (nuevoEstado === "procesada") {
          cambios.fechaFinProcesamiento =
            serverTimestamp();
        }

        // No modificar aceptada, laboratorioId,
        // ordenId ni otros datos originales.
        transaction.update(muestraRef, cambios);
      });

      mostrarMensaje(
        "Operación correcta",
        nuevoEstado === "en_proceso"
          ? "Se inició el procesamiento de la muestra."
          : "Se finalizó el procesamiento de la muestra."
      );

      // Actualizar inmediatamente la lista.
      await cargarDatos(false);

      // Actualizar también el detalle abierto.
      const muestraActualizada = await getDoc(
        muestraRef
      );

      if (muestraActualizada.exists()) {
        setDetalle(
          convertirMuestra(
            muestraActualizada.id,
            muestraActualizada.data()
          )
        );
      }
    } catch (error: any) {
      console.error(
        "Error actualizando estado:",
        error
      );

      mostrarMensaje(
        "No se pudo actualizar",
        obtenerError(error)
      );
    } finally {
      setProcesandoId("");
    }
  };

  // ===================================================
  // CONFIRMAR INICIO
  // ===================================================

  const iniciarProceso = (muestra: Muestra) => {
    confirmar(
      "Iniciar proceso",
      "¿Deseas iniciar el procesamiento de esta muestra?",
      () => cambiarEstado(muestra, "en_proceso")
    );
  };

  // ===================================================
  // CONFIRMAR FINALIZACIÓN
  // ===================================================

  const finalizarProceso = (muestra: Muestra) => {
    confirmar(
      "Finalizar proceso",
      "¿Deseas marcar esta muestra como procesada?",
      () => cambiarEstado(muestra, "procesada")
    );
  };

  // ===================================================
  // FILTRAR MUESTRAS
  // ===================================================

  const muestrasFiltradas = muestras.filter(
    (muestra) => {
      const paciente = pacientes[muestra.pacienteId];

      const contenido = [
        muestra.codigoEtiqueta,
        muestra.muestraId,
        muestra.ordenId,
        muestra.analisisNombre,
        muestra.tipo,
        muestra.estado,
        paciente?.nombre || "",
        paciente?.ci || "",
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(
        busqueda.trim().toLowerCase()
      );
    }
  );

  const tomadas = muestras.filter(
    (muestra) => muestra.estado === "tomada"
  ).length;

  const aceptadas = muestras.filter(
    (muestra) => muestra.estado === "aceptada"
  ).length;

  const enProceso = muestras.filter(
    (muestra) => muestra.estado === "en_proceso"
  ).length;

  const procesadas = muestras.filter(
    (muestra) => muestra.estado === "procesada"
  ).length;

  // ===================================================
  // COMPONENTE DE ACCIONES
  // ===================================================

  const botonesAcciones = (muestra: Muestra) => {
    const ocupado = procesandoId === muestra.id;

    return (
      <View style={styles.acciones}>
        <Pressable
          style={[
            styles.boton,
            styles.botonDetalle,
            cargandoDetalle && styles.deshabilitado,
          ]}
          disabled={cargandoDetalle}
          onPress={() => verDetalle(muestra)}
        >
          <Text style={styles.textoBoton}>
            Ver detalle
          </Text>
        </Pressable>

        {muestra.estado === "aceptada" && (
          <Pressable
            style={[
              styles.boton,
              styles.botonIniciar,
              ocupado && styles.deshabilitado,
            ]}
            disabled={ocupado}
            onPress={() => iniciarProceso(muestra)}
          >
            {ocupado ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBoton}>
                Iniciar proceso
              </Text>
            )}
          </Pressable>
        )}

        {muestra.estado === "en_proceso" && (
          <Pressable
            style={[
              styles.boton,
              styles.botonFinalizar,
              ocupado && styles.deshabilitado,
            ]}
            disabled={ocupado}
            onPress={() => finalizarProceso(muestra)}
          >
            {ocupado ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBoton}>
                Finalizar proceso
              </Text>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  // ===================================================
  // PANTALLA DE CARGA
  // ===================================================

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#19385F"
        />

        <Text style={styles.textoSecundario}>
          Cargando seguimiento de muestras...
        </Text>
      </View>
    );
  }

  // ===================================================
  // INTERFAZ PRINCIPAL
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>
              Seguimiento de muestras
            </Text>

            <Text style={styles.subtitulo}>
              Consulta el estado y controla el
              procesamiento de las muestras.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() => router.back()}
          >
            <Text style={styles.textoBoton}>
              Volver
            </Text>
          </Pressable>
        </View>

        {/* CONTADORES */}

        <View style={styles.contadores}>
          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Total
            </Text>

            <Text style={styles.contadorNumero}>
              {muestras.length}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Tomadas
            </Text>

            <Text style={styles.contadorNumero}>
              {tomadas}
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
              En proceso
            </Text>

            <Text style={styles.contadorNumero}>
              {enProceso}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Procesadas
            </Text>

            <Text style={styles.contadorNumero}>
              {procesadas}
            </Text>
          </View>
        </View>

        {/* BUSCADOR */}

        <View style={styles.panel}>
          <Text style={styles.seccionTitulo}>
            Buscar muestra
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Paciente, CI, análisis o código"
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          {/* BOTÓN ACTUALIZAR FUNCIONAL */}

          <Pressable
            style={[
              styles.botonActualizar,
              actualizando && styles.deshabilitado,
            ]}
            disabled={actualizando}
            onPress={actualizar}
          >
            {actualizando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBoton}>
                Actualizar
              </Text>
            )}
          </Pressable>
        </View>

        {/* LISTADO */}

        <View style={styles.panel}>
          <Text style={styles.seccionTitulo}>
            Muestras registradas
          </Text>

          {muestrasFiltradas.length === 0 ? (
            <Text style={styles.textoSecundario}>
              No se encontraron muestras.
            </Text>
          ) : (
            muestrasFiltradas.map((muestra) => {
              const paciente =
                pacientes[muestra.pacienteId];

              return (
                <View
                  key={muestra.id}
                  style={styles.tarjeta}
                >
                  <View style={styles.filaTitulo}>
                    <Text style={styles.nombreAnalisis}>
                      {muestra.analisisNombre}
                    </Text>

                    <View
                      style={[
                        styles.etiquetaEstado,
                        {
                          backgroundColor:
                            colorEstado(muestra.estado),
                        },
                      ]}
                    >
                      <Text style={styles.textoEstado}>
                        {nombreEstado(muestra.estado)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.dato}>
                    Código: {muestra.codigoEtiqueta}
                  </Text>

                  <Text style={styles.dato}>
                    Paciente:{" "}
                    {paciente?.nombre || "Sin identificar"}
                  </Text>

                  <Text style={styles.dato}>
                    CI: {paciente?.ci || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Tipo: {muestra.tipo}
                  </Text>

                  <Text style={styles.dato}>
                    Orden: {muestra.ordenId || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Fecha de toma:{" "}
                    {mostrarFecha(muestra.fechaToma)}
                  </Text>

                  {botonesAcciones(muestra)}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODAL VER DETALLE */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView
              contentContainerStyle={styles.contenidoModal}
            >
              <Text style={styles.tituloModal}>
                Detalle de la muestra
              </Text>

              {detalle && (
                <>
                  <View style={styles.resumen}>
                    <Text style={styles.nombreAnalisis}>
                      {detalle.analisisNombre}
                    </Text>

                    <Text style={styles.dato}>
                      Paciente:{" "}
                      {pacientes[detalle.pacienteId]
                        ?.nombre || "Sin identificar"}
                    </Text>

                    <Text style={styles.dato}>
                      CI:{" "}
                      {pacientes[detalle.pacienteId]
                        ?.ci || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Estado: {nombreEstado(detalle.estado)}
                    </Text>
                  </View>

                  <View style={styles.bloqueDetalle}>
                    <Text style={styles.seccionTitulo}>
                      Información de la muestra
                    </Text>

                    <Text style={styles.dato}>
                      Código: {detalle.codigoEtiqueta}
                    </Text>

                    <Text style={styles.dato}>
                      ID de muestra: {detalle.muestraId}
                    </Text>

                    <Text style={styles.dato}>
                      Orden: {detalle.ordenId || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Solicitud:{" "}
                      {detalle.solicitudId || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Tipo de muestra: {detalle.tipo}
                    </Text>

                    <Text style={styles.dato}>
                      Aceptada:{" "}
                      {detalle.aceptada ? "Sí" : "No"}
                    </Text>

                    {detalle.motivoRechazo !== "" && (
                      <Text style={styles.dato}>
                        Motivo de rechazo:{" "}
                        {detalle.motivoRechazo}
                      </Text>
                    )}
                  </View>

                  <View style={styles.bloqueDetalle}>
                    <Text style={styles.seccionTitulo}>
                      Seguimiento del procesamiento
                    </Text>

                    <Text style={styles.dato}>
                      Fecha de toma:{" "}
                      {mostrarFecha(detalle.fechaToma)}
                    </Text>

                    <Text style={styles.dato}>
                      Fecha de validación:{" "}
                      {mostrarFecha(
                        detalle.fechaValidacion
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Inicio del proceso:{" "}
                      {mostrarFecha(
                        detalle.fechaInicioProcesamiento
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Fin del proceso:{" "}
                      {mostrarFecha(
                        detalle.fechaFinProcesamiento
                      )}
                    </Text>
                  </View>

                  <View style={styles.accionesModal}>
                    <Pressable
                      style={[
                        styles.boton,
                        styles.botonCerrar,
                      ]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.textoBoton}>
                        Cerrar
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.boton,
                        styles.botonActualizar,
                      ]}
                      onPress={async () => {
                        await verDetalle(detalle);
                      }}
                    >
                      <Text style={styles.textoBoton}>
                        Actualizar detalle
                      </Text>
                    </Pressable>

                    {detalle.estado === "aceptada" && (
                      <Pressable
                        style={[
                          styles.boton,
                          styles.botonIniciar,
                        ]}
                        disabled={procesandoId === detalle.id}
                        onPress={() => iniciarProceso(detalle)}
                      >
                        <Text style={styles.textoBoton}>
                          Iniciar proceso
                        </Text>
                      </Pressable>
                    )}

                    {detalle.estado === "en_proceso" && (
                      <Pressable
                        style={[
                          styles.boton,
                          styles.botonFinalizar,
                        ]}
                        disabled={procesandoId === detalle.id}
                        onPress={() => finalizarProceso(detalle)}
                      >
                        <Text style={styles.textoBoton}>
                          Finalizar proceso
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
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
    backgroundColor: "#F4F7FB",
  },

  contenido: {
    padding: 20,
    paddingBottom: 50,
  },

  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FB",
  },

  textoSecundario: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 10,
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },

  titulo: {
    fontSize: 27,
    fontWeight: "bold",
    color: "#19385F",
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
  },

  botonVolver: {
    backgroundColor: "#64748B",
    padding: 12,
    borderRadius: 8,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontWeight: "bold",
    textAlign: "center",
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },

  contador: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    color: "#64748B",
    fontSize: 13,
  },

  contadorNumero: {
    color: "#19385F",
    fontSize: 25,
    fontWeight: "bold",
    marginTop: 8,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },

  seccionTitulo: {
    color: "#19385F",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 13,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 12,
  },

  botonActualizar: {
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 9,
    alignSelf: "flex-start",
    minWidth: 110,
  },

  deshabilitado: {
    opacity: 0.5,
  },

  tarjeta: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },

  filaTitulo: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  nombreAnalisis: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#19385F",
    flexShrink: 1,
  },

  etiquetaEstado: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  textoEstado: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },

  dato: {
    color: "#475569",
    fontSize: 14,
    marginBottom: 9,
  },

  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },

  boton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 9,
  },

  botonDetalle: {
    backgroundColor: "#19385F",
  },

  botonIniciar: {
    backgroundColor: "#2563EB",
  },

  botonFinalizar: {
    backgroundColor: "#059669",
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    width: "100%",
    maxWidth: 700,
    maxHeight: "90%",
    overflow: "hidden",
  },

  contenidoModal: {
    padding: 20,
    paddingBottom: 35,
  },

  tituloModal: {
    fontSize: 23,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 18,
  },

  resumen: {
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },

  bloqueDetalle: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },

  accionesModal: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 15,
  },

  botonCerrar: {
    backgroundColor: "#64748B",
  },
});