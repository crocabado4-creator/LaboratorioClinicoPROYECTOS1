import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  escucharNotificacionesRecepcion,
  solicitarNuevaToma,
  type NotificacionRecepcion,
  type FechaFirestore,
} from "../services/notificacionesRecepcionService";

// ======================================================
// TIPOS
// ======================================================

type Filtro =
  | "todas"
  | "pendientes"
  | "rechazadas"
  | "procesadas"
  | "nuevas";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function mostrarFecha(
  fecha: FechaFirestore
): string {
  if (!fecha) {
    return "Sin fecha";
  }

  let fechaFinal: Date;

  if (fecha instanceof Date) {
    fechaFinal = fecha;
  } else if (
    typeof fecha === "number" ||
    typeof fecha === "string"
  ) {
    fechaFinal = new Date(fecha);
  } else if (
    typeof fecha === "object" &&
    "toDate" in fecha &&
    typeof fecha.toDate === "function"
  ) {
    fechaFinal = fecha.toDate();
  } else {
    return "Sin fecha";
  }

  if (
    Number.isNaN(fechaFinal.getTime())
  ) {
    return "Sin fecha";
  }

  return fechaFinal.toLocaleString("es-BO");
}

function mostrarAlerta(
  titulo: string,
  mensaje: string
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }

    return;
  }

  Alert.alert(titulo, mensaje);
}

function obtenerColores(tipo: string) {
  if (tipo === "muestra_rechazada") {
    return {
      fondo: "#FFF1F2",
      borde: "#EF4444",
      titulo: "#DC2626",
    };
  }

  if (tipo === "muestra_procesada") {
    return {
      fondo: "#F0FDF4",
      borde: "#22C55E",
      titulo: "#16A34A",
    };
  }

  return {
    fondo: "#EFF6FF",
    borde: "#3B82F6",
    titulo: "#2563EB",
  };
}

// ======================================================
// TARJETA ESTADÍSTICA
// ======================================================

function TarjetaEstadistica({
  titulo,
  cantidad,
  color,
}: {
  titulo: string;
  cantidad: number;
  color: string;
}) {
  return (
    <View style={styles.estadistica}>
      <Text style={styles.estadisticaTitulo}>
        {titulo}
      </Text>

      <Text
        style={[
          styles.estadisticaNumero,
          { color },
        ]}
      >
        {cantidad}
      </Text>
    </View>
  );
}

// ======================================================
// BOTÓN DE FILTRO
// ======================================================

function BotonFiltro({
  titulo,
  seleccionado,
  onPress,
}: {
  titulo: string;
  seleccionado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.botonFiltro,
        seleccionado
          ? styles.botonFiltroActivo
          : null,
      ]}
    >
      <Text
        style={[
          styles.textoFiltro,
          seleccionado
            ? styles.textoFiltroActivo
            : null,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

// ======================================================
// TARJETA DE NOTIFICACIÓN
// ======================================================

function TarjetaNotificacion({
  item,
  procesando,
  onReanudar,
}: {
  item: NotificacionRecepcion;
  procesando: boolean;
  onReanudar: (
    item: NotificacionRecepcion
  ) => void;
}) {
  const colores = obtenerColores(item.tipo);

  const rechazada =
    item.tipo === "muestra_rechazada";

  const procesada =
    item.tipo === "muestra_procesada";

  const tieneNuevaToma =
    item.solicitudNuevaToma !== null;

  return (
    <View
      style={[
        styles.notificacion,
        {
          backgroundColor: colores.fondo,
          borderColor: colores.borde,
        },
      ]}
    >
      <Text
        style={[
          styles.notificacionTitulo,
          {
            color: colores.titulo,
          },
        ]}
      >
        {rechazada
          ? "⚠️ "
          : procesada
            ? "✅ "
            : "📋 "}

        {item.titulo}
      </Text>

      <View style={styles.datosPaciente}>
        <Text style={styles.dato}>
          <Text style={styles.negrita}>
            Paciente:
          </Text>{" "}
          {item.nombrePaciente}
        </Text>

        <Text style={styles.dato}>
          <Text style={styles.negrita}>
            CI:
          </Text>{" "}
          {item.ciPaciente || "No registrado"}
        </Text>

        <Text style={styles.dato}>
          <Text style={styles.negrita}>
            Análisis clínico:
          </Text>{" "}
          {item.nombreAnalisis}
        </Text>

        <Text style={styles.dato}>
          <Text style={styles.negrita}>
            Código de muestra:
          </Text>{" "}
          {item.codigoMuestra}
        </Text>

        <Text style={styles.dato}>
          <Text style={styles.negrita}>
            Fecha:
          </Text>{" "}
          {mostrarFecha(item.fechaCreacion)}
        </Text>
      </View>

      <Text style={styles.mensajeNotificacion}>
        {item.mensaje}
      </Text>

      {rechazada && (
        <View style={styles.detalleRechazo}>
          <Text style={styles.motivo}>
            Motivo del rechazo:{" "}
            <Text style={{ fontWeight: "400" }}>
              {item.motivoRechazo ||
                "No especificado"}
            </Text>
          </Text>

          <Text style={styles.nuevaTomaTitulo}>
            Nueva toma requerida
          </Text>

          <Text style={styles.nuevaTomaDescripcion}>
            Recepción debe contactar al paciente
            y coordinar una nueva muestra.
          </Text>

          {tieneNuevaToma ? (
            <View style={styles.confirmacion}>
              <Text style={styles.confirmacionTexto}>
                Nueva toma solicitada. Pendiente de
                atención por el Bioquímico.
              </Text>
            </View>
          ) : (
            <Pressable
              disabled={procesando}
              onPress={() => onReanudar(item)}
              style={[
                styles.botonReanudar,
                procesando
                  ? { opacity: 0.6 }
                  : null,
              ]}
            >
              {procesando ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={styles.botonReanudarTexto}
                >
                  Reanudar muestra / Nueva toma
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {procesada && (
        <View style={styles.detalleProcesado}>
          <Text
            style={styles.detalleProcesadoTexto}
          >
            Procesamiento finalizado
            correctamente.
          </Text>
        </View>
      )}
    </View>
  );
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function NotificacionesRecepcionScreen() {
  const router = useRouter();

  const [
    notificaciones,
    setNotificaciones,
  ] = useState<NotificacionRecepcion[]>([]);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    filtro,
    setFiltro,
  ] = useState<Filtro>("todas");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    procesando,
    setProcesando,
  ] = useState("");

  const [
    laboratorioId,
    setLaboratorioId,
  ] = useState("");

  const [
    usuarioId,
    setUsuarioId,
  ] = useState("");

  // ====================================================
  // IDENTIFICAR USUARIO
  // ====================================================

  useEffect(() => {
    let activo = true;

    async function cargarUsuario() {
      try {
        setCargando(true);
        setError("");

        const usuario = getAuth().currentUser;

        if (!usuario) {
          throw new Error(
            "Debes iniciar sesión."
          );
        }

        const documento = await getDoc(
          doc(
            db,
            "usuarios",
            usuario.uid
          )
        );

        if (!documento.exists()) {
          throw new Error(
            "Tu usuario no existe en el sistema."
          );
        }

        const datos = documento.data();

        const rol = String(datos.rol || "")
          .trim()
          .toLowerCase();

        if (rol !== "recepcionista") {
          throw new Error(
            "Este módulo es exclusivo de Recepción."
          );
        }

        if (datos.activo !== true) {
          throw new Error(
            "Tu usuario está inactivo."
          );
        }

        if (!datos.laboratorioId) {
          throw new Error(
            "No se identificó el laboratorio."
          );
        }

        if (!activo) {
          return;
        }

        setUsuarioId(usuario.uid);

        setLaboratorioId(
          String(datos.laboratorioId)
        );
      } catch (errorUsuario) {
        if (!activo) {
          return;
        }

        setError(
          errorUsuario instanceof Error
            ? errorUsuario.message
            : "No se pudo identificar al usuario."
        );

        setCargando(false);
      }
    }

    cargarUsuario();

    return () => {
      activo = false;
    };
  }, []);

  // ====================================================
  // ESCUCHAR NOTIFICACIONES
  // ====================================================

  useEffect(() => {
    if (!laboratorioId || !usuarioId) {
      return;
    }

    setCargando(true);

    const cancelar =
      escucharNotificacionesRecepcion(
        laboratorioId,
        usuarioId,
        (datos) => {
          setNotificaciones(datos);
          setCargando(false);
          setError("");
        },
        (errorFirebase) => {
          setError(
            errorFirebase.message ||
              "No se pudieron consultar las notificaciones."
          );

          setCargando(false);
        }
      );

    return () => {
      cancelar();
    };
  }, [laboratorioId, usuarioId]);

  // ====================================================
  // CONTADORES
  // ====================================================

  const pendientes = useMemo(
    () =>
      notificaciones.filter(
        (item) =>
          item.tipo === "muestra_pendiente"
      ),
    [notificaciones]
  );

  const rechazadas = useMemo(
    () =>
      notificaciones.filter(
        (item) =>
          item.tipo === "muestra_rechazada"
      ),
    [notificaciones]
  );

  const procesadas = useMemo(
    () =>
      notificaciones.filter(
        (item) =>
          item.tipo === "muestra_procesada"
      ),
    [notificaciones]
  );

  const nuevasTomas = useMemo(
    () =>
      rechazadas.filter(
        (item) =>
          item.solicitudNuevaToma !== null
      ),
    [rechazadas]
  );

  // ====================================================
  // FILTROS Y BÚSQUEDA
  // ====================================================

  const notificacionesFiltradas = useMemo(() => {
    let lista = [...notificaciones];

    if (filtro === "pendientes") {
      lista = pendientes;
    }

    if (filtro === "rechazadas") {
      lista = rechazadas;
    }

    if (filtro === "procesadas") {
      lista = procesadas;
    }

    if (filtro === "nuevas") {
      lista = nuevasTomas;
    }

    const textoBusqueda = busqueda
      .trim()
      .toLowerCase();

    if (textoBusqueda) {
      lista = lista.filter((item) => {
        const contenido = [
          item.nombrePaciente,
          item.ciPaciente,
          item.nombreAnalisis,
          item.codigoMuestra,
          item.motivoRechazo,
          item.titulo,
          item.mensaje,
        ]
          .join(" ")
          .toLowerCase();

        return contenido.includes(
          textoBusqueda
        );
      });
    }

    return [...lista].sort(
      (a, b) =>
        b.fechaNumero - a.fechaNumero
    );
  }, [
    notificaciones,
    pendientes,
    rechazadas,
    procesadas,
    nuevasTomas,
    filtro,
    busqueda,
  ]);

  // ====================================================
  // REANUDAR MUESTRA
  // ====================================================

  async function reanudarMuestra(
    notificacion: NotificacionRecepcion
  ): Promise<void> {
    if (procesando !== "") {
      return;
    }

    try {
      setProcesando(notificacion.id);
      setMensaje("");
      setError("");

      const resultado = await solicitarNuevaToma(
        notificacion
      );

      setMensaje(resultado.mensaje);
    } catch (errorSolicitud: unknown) {
      const mensajeError =
        errorSolicitud instanceof Error
          ? errorSolicitud.message
          : "No se pudo solicitar la nueva toma.";

      mostrarAlerta(
        "No se pudo solicitar",
        mensajeError
      );
    } finally {
      setProcesando("");
    }
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <SafeAreaView style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
      >
        <Pressable
          style={styles.botonVolver}
          onPress={() => router.back()}
        >
          <Text style={styles.botonVolverTexto}>
            ← Volver al Dashboard
          </Text>
        </Pressable>

        <View style={styles.panel}>
          <Text style={styles.titulo}>
            🔔 Notificaciones de Recepción
          </Text>

          <Text style={styles.subtitulo}>
            Seguimiento de muestras, pacientes,
            análisis clínicos y nuevas tomas.
          </Text>

          <View style={styles.estadisticas}>
            <TarjetaEstadistica
              titulo="Pendientes"
              cantidad={pendientes.length}
              color="#2563EB"
            />

            <TarjetaEstadistica
              titulo="Rechazadas"
              cantidad={rechazadas.length}
              color="#DC2626"
            />

            <TarjetaEstadistica
              titulo="Procesadas"
              cantidad={procesadas.length}
              color="#16A34A"
            />

            <TarjetaEstadistica
              titulo="Nuevas tomas solicitadas"
              cantidad={nuevasTomas.length}
              color="#9333EA"
            />
          </View>

          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por nombre, apellido, CI, análisis, código o motivo..."
            placeholderTextColor="#64748B"
            style={styles.buscador}
          />

          <View style={styles.filtros}>
            <BotonFiltro
              titulo="Todas"
              seleccionado={filtro === "todas"}
              onPress={() => setFiltro("todas")}
            />

            <BotonFiltro
              titulo="Pendientes"
              seleccionado={
                filtro === "pendientes"
              }
              onPress={() =>
                setFiltro("pendientes")
              }
            />

            <BotonFiltro
              titulo="Rechazadas"
              seleccionado={
                filtro === "rechazadas"
              }
              onPress={() =>
                setFiltro("rechazadas")
              }
            />

            <BotonFiltro
              titulo="Procesadas"
              seleccionado={
                filtro === "procesadas"
              }
              onPress={() =>
                setFiltro("procesadas")
              }
            />

            <BotonFiltro
              titulo="Nuevas tomas"
              seleccionado={
                filtro === "nuevas"
              }
              onPress={() => setFiltro("nuevas")}
            />
          </View>

          {mensaje !== "" && (
            <View style={styles.mensajeExito}>
              <Text
                style={styles.mensajeExitoTexto}
              >
                {mensaje}
              </Text>
            </View>
          )}

          {error !== "" && (
            <View style={styles.mensajeError}>
              <Text
                style={styles.mensajeErrorTexto}
              >
                {error}
              </Text>
            </View>
          )}

          {cargando ? (
            <View style={styles.cargando}>
              <ActivityIndicator
                size="large"
                color="#2563EB"
              />

              <Text style={styles.cargandoTexto}>
                Cargando notificaciones...
              </Text>
            </View>
          ) : notificacionesFiltradas.length ===
            0 ? (
            <View style={styles.vacio}>
              <Text style={styles.vacioTexto}>
                No se encontraron notificaciones.
              </Text>
            </View>
          ) : (
            notificacionesFiltradas.map(
              (item) => (
                <TarjetaNotificacion
                  key={item.id}
                  item={item}
                  procesando={
                    procesando === item.id
                  }
                  onReanudar={reanudarMuestra}
                />
              )
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    padding: 20,
    paddingBottom: 40,
  },

  botonVolver: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  botonVolverTexto: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
  },

  titulo: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },

  subtitulo: {
    fontSize: 15,
    color: "#64748B",
    marginBottom: 25,
    lineHeight: 22,
  },

  estadisticas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },

  estadistica: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 120,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 18,
    justifyContent: "space-between",
  },

  estadisticaTitulo: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },

  estadisticaNumero: {
    fontSize: 30,
    fontWeight: "800",
    marginTop: 15,
  },

  buscador: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 18,
    backgroundColor: "#FFFFFF",
  },

  filtros: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 25,
  },

  botonFiltro: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },

  botonFiltroActivo: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  textoFiltro: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  textoFiltroActivo: {
    color: "#FFFFFF",
  },

  notificacion: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },

  notificacionTitulo: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 18,
  },

  datosPaciente: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 10,
    marginBottom: 18,
  },

  dato: {
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 12,
    lineHeight: 21,
  },

  negrita: {
    fontWeight: "800",
  },

  mensajeNotificacion: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
    marginBottom: 16,
  },

  detalleRechazo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
  },

  motivo: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
    lineHeight: 20,
  },

  nuevaTomaTitulo: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },

  nuevaTomaDescripcion: {
    color: "#B91C1C",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },

  botonReanudar: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  botonReanudarTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  confirmacion: {
    backgroundColor: "#DCFCE7",
    padding: 14,
    borderRadius: 8,
  },

  confirmacionTexto: {
    color: "#166534",
    fontSize: 13,
    lineHeight: 20,
  },

  detalleProcesado: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 10,
  },

  detalleProcesadoTexto: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "700",
  },

  mensajeExito: {
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    padding: 15,
    marginBottom: 18,
  },

  mensajeExitoTexto: {
    color: "#166534",
    fontSize: 14,
  },

  mensajeError: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 15,
    marginBottom: 18,
  },

  mensajeErrorTexto: {
    color: "#B91C1C",
    fontSize: 14,
  },

  cargando: {
    paddingVertical: 50,
    alignItems: "center",
  },

  cargandoTexto: {
    marginTop: 15,
    color: "#64748B",
    fontSize: 14,
  },

  vacio: {
    backgroundColor: "#F8FAFC",
    padding: 35,
    borderRadius: 12,
    alignItems: "center",
  },

  vacioTexto: {
    color: "#64748B",
    fontSize: 15,
    textAlign: "center",
  },
});