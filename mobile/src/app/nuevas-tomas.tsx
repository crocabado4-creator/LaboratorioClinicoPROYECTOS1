import React, {
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
  escucharNuevasTomas,
  registrarNuevaToma,
  type NuevaTomaSolicitada,
} from "../services/nuevasTomasService";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TIPOS_MUESTRA = [
  "Sangre",
  "Orina",
  "Heces",
  "Saliva",
  "Hisopado",
  "Otro",
];

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

function mostrarFecha(valor: unknown): string {
  if (!valor) {
    return "Sin fecha";
  }

  let fecha: Date;

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof valor.toDate === "function"
  ) {
    fecha = valor.toDate() as Date;
  } else {
    fecha = new Date(String(valor));
  }

  if (Number.isNaN(fecha.getTime())) {
    return "Sin fecha";
  }

  return fecha.toLocaleString("es-BO");
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function NuevasTomasScreen() {
  const router = useRouter();

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [solicitudes, setSolicitudes] = useState<
    NuevaTomaSolicitada[]
  >([]);

  const [busqueda, setBusqueda] = useState("");

  const [tipos, setTipos] = useState<
    Record<string, string>
  >({});

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [procesando, setProcesando] = useState("");

  // ===================================================
  // CARGAR USUARIO
  // ===================================================

  useEffect(() => {
    let activo = true;

    async function cargarUsuario() {
      try {
        const usuario = getAuth().currentUser;

        if (!usuario) {
          throw new Error(
            "Debes iniciar sesión."
          );
        }

        const documentoUsuario = await getDoc(
          doc(db, "usuarios", usuario.uid)
        );

        if (!documentoUsuario.exists()) {
          throw new Error(
            "No se encontró tu usuario."
          );
        }

        const datos = documentoUsuario.data();

        if (datos.activo !== true) {
          throw new Error(
            "Tu usuario está inactivo."
          );
        }

        if (datos.rol !== "bioquimico") {
          throw new Error(
            "Este módulo es exclusivo del Bioquímico."
          );
        }

        if (!datos.laboratorioId) {
          throw new Error(
            "No se identificó el laboratorio."
          );
        }

        if (activo) {
          setLaboratorioId(
            String(datos.laboratorioId)
          );
        }
      } catch (errorUsuario) {
        if (activo) {
          setError(
            errorUsuario instanceof Error
              ? errorUsuario.message
              : "No se pudo cargar el usuario."
          );

          setCargando(false);
        }
      }
    }

    cargarUsuario();

    return () => {
      activo = false;
    };
  }, []);

  // ===================================================
  // ESCUCHAR NUEVAS TOMAS
  // ===================================================

  useEffect(() => {
    if (!laboratorioId) {
      return;
    }

    setCargando(true);

    const cancelar = escucharNuevasTomas(
      laboratorioId,

      (datos) => {
        setSolicitudes(datos);
        setCargando(false);
        setError("");
      },

      (errorFirebase) => {
        setError(errorFirebase.message);
        setCargando(false);
      }
    );

    return () => {
      cancelar();
    };
  }, [laboratorioId]);

  // ===================================================
  // FILTRAR SOLICITUDES
  // ===================================================

  const solicitudesFiltradas = useMemo(() => {
    const termino = busqueda
      .trim()
      .toLowerCase();

    if (!termino) {
      return solicitudes;
    }

    return solicitudes.filter((solicitud) => {
      const contenido = [
        solicitud.nombrePaciente,
        solicitud.ciPaciente,
        solicitud.nombreAnalisis,
        solicitud.codigoMuestra,
        solicitud.motivoRechazo,
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(termino);
    });
  }, [solicitudes, busqueda]);

  // ===================================================
  // REGISTRAR NUEVA MUESTRA
  // ===================================================

  async function registrar(
    solicitud: NuevaTomaSolicitada
  ): Promise<void> {
    if (procesando !== "") {
      return;
    }

    const tipo = tipos[solicitud.id];

    if (!tipo) {
      mostrarAlerta(
        "Tipo de muestra",
        "Selecciona un tipo de muestra."
      );

      return;
    }

    try {
      setProcesando(solicitud.id);

      const resultado = await registrarNuevaToma(
        solicitud,
        tipo
      );

      mostrarAlerta(
        "Registro correcto",
        resultado.mensaje
      );
    } catch (errorRegistro) {
      mostrarAlerta(
        "No se pudo registrar",
        errorRegistro instanceof Error
          ? errorRegistro.message
          : "Ocurrió un error inesperado."
      );
    } finally {
      setProcesando("");
    }
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <SafeAreaView style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
      >
        <Pressable
          style={styles.volver}
          onPress={() => router.back()}
        >
          <Text style={styles.volverTexto}>
            {"← Volver"}
          </Text>
        </Pressable>

        <View style={styles.panel}>
          <Text style={styles.titulo}>
            Nuevas tomas solicitadas
          </Text>

          <Text style={styles.subtitulo}>
            Solicitudes reanudadas por Recepción.
          </Text>

          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar paciente, CI o análisis..."
            style={styles.buscador}
          />

          {error !== "" && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#2563EB"
            />
          ) : solicitudesFiltradas.length === 0 ? (
            <Text style={styles.vacio}>
              No hay nuevas tomas solicitadas.
            </Text>
          ) : (
            solicitudesFiltradas.map((solicitud) => (
              <View
                key={solicitud.id}
                style={styles.tarjeta}
              >
                <Text style={styles.paciente}>
                  {solicitud.nombrePaciente}
                </Text>

                <Text style={styles.dato}>
                  CI:{" "}
                  {solicitud.ciPaciente || "Sin CI"}
                </Text>

                <Text style={styles.dato}>
                  Análisis:{" "}
                  {solicitud.nombreAnalisis}
                </Text>

                <Text style={styles.dato}>
                  Código:{" "}
                  {solicitud.codigoMuestra}
                </Text>

                <Text style={styles.dato}>
                  Motivo de rechazo:{" "}
                  {solicitud.motivoRechazo ||
                    "No especificado"}
                </Text>

                <Text style={styles.dato}>
                  Estado: Nueva toma solicitada
                </Text>

                <Text style={styles.dato}>
                  Fecha de solicitud:{" "}
                  {mostrarFecha(
                    solicitud.fechaSolicitud
                  )}
                </Text>

                <Text style={styles.etiqueta}>
                  Tipo de nueva muestra
                </Text>

                <View style={styles.tipos}>
                  {TIPOS_MUESTRA.map((tipo) => {
                    const seleccionado =
                      tipos[solicitud.id] === tipo;

                    return (
                      <Pressable
                        key={tipo}
                        onPress={() =>
                          setTipos((anterior) => ({
                            ...anterior,
                            [solicitud.id]: tipo,
                          }))
                        }
                        style={[
                          styles.tipoBoton,
                          seleccionado
                            ? styles.tipoSeleccionado
                            : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tipoTexto,
                            seleccionado
                              ? styles.tipoTextoSeleccionado
                              : null,
                          ]}
                        >
                          {tipo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  disabled={
                    procesando === solicitud.id
                  }
                  onPress={() =>
                    registrar(solicitud)
                  }
                  style={styles.botonRegistrar}
                >
                  {procesando === solicitud.id ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={styles.botonRegistrarTexto}
                    >
                      Nueva muestra
                    </Text>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    padding: 20,
    paddingBottom: 40,
  },

  volver: {
    backgroundColor: "#E2E8F0",
    padding: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  volverTexto: {
    color: "#0F172A",
    fontWeight: "700",
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },

  titulo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
  },

  buscador: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    color: "#0F172A",
  },

  tarjeta: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
  },

  paciente: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },

  dato: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 8,
  },

  etiqueta: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
    marginBottom: 10,
  },

  tipos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },

  tipoBoton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },

  tipoSeleccionado: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  tipoTexto: {
    color: "#334155",
    fontSize: 13,
  },

  tipoTextoSeleccionado: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  botonRegistrar: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  botonRegistrarTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  error: {
    color: "#DC2626",
    marginBottom: 15,
  },

  vacio: {
    color: "#64748B",
    textAlign: "center",
    padding: 25,
  },
});