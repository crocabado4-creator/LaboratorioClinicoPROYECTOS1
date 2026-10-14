import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  obtenerPacientes,
  type Paciente,
} from "../services/pacientesService";

import {
  obtenerAnalisis,
  type AnalisisClinico,
} from "../services/analisisService";

import {
  crearSolicitud,
  obtenerSolicitudes,
  type Solicitud,
} from "../services/solicitudesService";


type UsuarioActual = {
  id: string;
  rol: string;
  laboratorioId: string;
};


export default function Solicitudes() {
  const router =
    useRouter();


  const [
    usuario,
    setUsuario,
  ] =
    useState<UsuarioActual | null>(
      null
    );


  const [
    pacientes,
    setPacientes,
  ] =
    useState<Paciente[]>([]);


  const [
    analisis,
    setAnalisis,
  ] =
    useState<AnalisisClinico[]>([]);


  const [
    solicitudes,
    setSolicitudes,
  ] =
    useState<Solicitud[]>([]);


  const [
    pacienteId,
    setPacienteId,
  ] =
    useState("");


  const [
    analisisSeleccionados,
    setAnalisisSeleccionados,
  ] =
    useState<string[]>([]);


  const [
    buscarPaciente,
    setBuscarPaciente,
  ] =
    useState("");


  const [
    buscarAnalisis,
    setBuscarAnalisis,
  ] =
    useState("");


  const [
    cargando,
    setCargando,
  ] =
    useState(true);


  const [
    guardando,
    setGuardando,
  ] =
    useState(false);


  const cargarDatos =
    async () => {
      try {
        setCargando(true);

        const firebaseUser =
          auth.currentUser;


        if (!firebaseUser) {
          Alert.alert(
            "Error",
            "No existe una sesión activa."
          );

          router.replace("/");
          return;
        }


        const usuarioSnap =
          await getDoc(
            doc(
              db,
              "usuarios",
              firebaseUser.uid
            )
          );


        if (
          !usuarioSnap.exists()
        ) {
          Alert.alert(
            "Error",
            "No se encontró el usuario."
          );

          router.replace("/");
          return;
        }


        const datosUsuario =
          usuarioSnap.data();


        const actual:
          UsuarioActual = {
          id:
            firebaseUser.uid,

          rol:
            String(
              datosUsuario.rol ||
                ""
            ),

          laboratorioId:
            String(
              datosUsuario
                .laboratorioId ||
                ""
            ),
        };


        if (
          actual.rol !==
          "recepcionista"
        ) {
          Alert.alert(
            "Acceso restringido",
            "Este módulo corresponde al Recepcionista."
          );

          router.back();
          return;
        }


        setUsuario(
          actual
        );


        const [
          listaPacientes,
          listaAnalisis,
          listaSolicitudes,
        ] =
          await Promise.all([
            obtenerPacientes(
              actual.laboratorioId
            ),

            obtenerAnalisis(
              actual.laboratorioId
            ),

            obtenerSolicitudes(
              actual.laboratorioId
            ),
          ]);


        setPacientes(
          listaPacientes
        );


        setAnalisis(
          listaAnalisis.filter(
            (item) =>
              item.activo
          )
        );


        setSolicitudes(
          listaSolicitudes
        );

      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos."
        );

      } finally {
        setCargando(false);
      }
    };


  useEffect(() => {
    cargarDatos();
  }, []);


  const pacientesFiltrados =
    useMemo(() => {
      const texto =
        buscarPaciente
          .trim()
          .toLowerCase();


      if (!texto) {
        return pacientes;
      }


      return pacientes.filter(
        (item) => {
          const contenido =
            `${item.nombres} ${item.apellidos} ${item.ci}`
              .toLowerCase();

          return contenido.includes(
            texto
          );
        }
      );
    }, [
      pacientes,
      buscarPaciente,
    ]);


  const analisisFiltrados =
    useMemo(() => {
      const texto =
        buscarAnalisis
          .trim()
          .toLowerCase();


      if (!texto) {
        return analisis;
      }


      return analisis.filter(
        (item) =>
          item.nombre
            .toLowerCase()
            .includes(
              texto
            )
      );
    }, [
      analisis,
      buscarAnalisis,
    ]);


  const total =
    useMemo(() => {
      return analisis
        .filter(
          (item) =>
            analisisSeleccionados.includes(
              item.id
            )
        )
        .reduce(
          (
            suma,
            item
          ) =>
            suma +
            item.precio,
          0
        );
    }, [
      analisis,
      analisisSeleccionados,
    ]);


  const seleccionarAnalisis =
    (
      analisisId: string
    ) => {
      setAnalisisSeleccionados(
        (actuales) => {
          if (
            actuales.includes(
              analisisId
            )
          ) {
            return actuales.filter(
              (id) =>
                id !==
                analisisId
            );
          }


          return [
            ...actuales,
            analisisId,
          ];
        }
      );
    };


  const registrar =
    async () => {
      if (!usuario) {
        return;
      }


      if (!pacienteId) {
        Alert.alert(
          "Falta paciente",
          "Selecciona un paciente."
        );

        return;
      }


      if (
        analisisSeleccionados
          .length === 0
      ) {
        Alert.alert(
          "Faltan análisis",
          "Selecciona al menos un análisis."
        );

        return;
      }


      try {
        setGuardando(true);


        await crearSolicitud({
          laboratorioId:
            usuario.laboratorioId,

          empleadoId:
            usuario.id,

          pacienteId,

          analisis:
            analisisSeleccionados.map(
              (analisisId) => ({
                analisisId,
                cantidad: 1,
              })
            ),
        });


        Alert.alert(
          "Correcto",
          "Solicitud registrada correctamente."
        );


        setPacienteId(
          ""
        );

        setAnalisisSeleccionados(
          []
        );

        setBuscarPaciente(
          ""
        );

        setBuscarAnalisis(
          ""
        );


        const nuevas =
          await obtenerSolicitudes(
            usuario.laboratorioId
          );


        setSolicitudes(
          nuevas
        );

      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo registrar la solicitud."
        );

      } finally {
        setGuardando(false);
      }
    };


  const nombrePaciente =
    (
      id: string
    ) => {
      const paciente =
        pacientes.find(
          (item) =>
            item.id === id
        );


      if (!paciente) {
        return id;
      }


      return `${paciente.nombres} ${paciente.apellidos}`;
    };


  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.cargando
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text>
          Cargando solicitudes...
        </Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.contenido
        }
      >

        <View
          style={
            styles.encabezado
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.volver
              }
            >
              ← Volver
            </Text>
          </Pressable>

          <Text
            style={
              styles.titulo
            }
          >
            Solicitudes de análisis
          </Text>

          <Text
            style={
              styles.subtitulo
            }
          >
            Registra los análisis solicitados por el paciente.
          </Text>
        </View>


        <View
          style={
            styles.tarjeta
          }
        >
          <Text
            style={
              styles.tituloTarjeta
            }
          >
            1. Seleccionar paciente
          </Text>


          <TextInput
            style={
              styles.input
            }
            placeholder="Buscar por nombre, apellido o CI"
            value={
              buscarPaciente
            }
            onChangeText={
              setBuscarPaciente
            }
          />


          {pacientesFiltrados.map(
            (paciente) => (
              <Pressable
                key={
                  paciente.id
                }
                style={[
                  styles.opcion,

                  pacienteId ===
                    paciente.id &&
                    styles
                      .opcionSeleccionada,
                ]}
                onPress={() =>
                  setPacienteId(
                    paciente.id
                  )
                }
              >
                <Text
                  style={
                    styles
                      .opcionTitulo
                  }
                >
                  {
                    paciente.nombres
                  }{" "}
                  {
                    paciente.apellidos
                  }
                </Text>

                <Text
                  style={
                    styles.opcionTexto
                  }
                >
                  CI: {
                    paciente.ci
                  }
                </Text>
              </Pressable>
            )
          )}
        </View>


        <View
          style={
            styles.tarjeta
          }
        >
          <Text
            style={
              styles.tituloTarjeta
            }
          >
            2. Seleccionar análisis
          </Text>


          <TextInput
            style={
              styles.input
            }
            placeholder="Buscar análisis"
            value={
              buscarAnalisis
            }
            onChangeText={
              setBuscarAnalisis
            }
          />


          {analisisFiltrados.map(
            (item) => {
              const seleccionado =
                analisisSeleccionados.includes(
                  item.id
                );


              return (
                <Pressable
                  key={
                    item.id
                  }
                  style={[
                    styles.opcion,

                    seleccionado &&
                      styles
                        .opcionSeleccionada,
                  ]}
                  onPress={() =>
                    seleccionarAnalisis(
                      item.id
                    )
                  }
                >
                  <View
                    style={
                      styles.fila
                    }
                  >
                    <View
                      style={
                        styles.flex
                      }
                    >
                      <Text
                        style={
                          styles
                            .opcionTitulo
                        }
                      >
                        {
                          item.nombre
                        }
                      </Text>

                      <Text
                        style={
                          styles
                            .opcionTexto
                        }
                      >
                        Bs.{" "}
                        {
                          item.precio
                        }
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.check
                      }
                    >
                      {
                        seleccionado
                          ? "✓"
                          : "+"
                      }
                    </Text>
                  </View>
                </Pressable>
              );
            }
          )}
        </View>


        <View
          style={
            styles.totalCard
          }
        >
          <Text
            style={
              styles.totalTexto
            }
          >
            Análisis seleccionados:{" "}
            {
              analisisSeleccionados.length
            }
          </Text>

          <Text
            style={
              styles.total
            }
          >
            Total: Bs.{" "}
            {
              total.toFixed(
                2
              )
            }
          </Text>


          <Pressable
            style={[
              styles.boton,

              guardando &&
                styles
                  .botonDesactivado,
            ]}
            disabled={
              guardando
            }
            onPress={
              registrar
            }
          >
            <Text
              style={
                styles.botonTexto
              }
            >
              {
                guardando
                  ? "Registrando..."
                  : "Registrar solicitud"
              }
            </Text>
          </Pressable>
        </View>


        <View
          style={
            styles.tarjeta
          }
        >
          <Text
            style={
              styles.tituloTarjeta
            }
          >
            Solicitudes registradas
          </Text>


          {solicitudes.length ===
          0 ? (
            <Text
              style={
                styles.vacio
              }
            >
              No existen solicitudes registradas.
            </Text>
          ) : (
            solicitudes.map(
              (
                solicitud
              ) => (
                <View
                  key={
                    solicitud.id
                  }
                  style={
                    styles
                      .solicitudCard
                  }
                >
                  <Text
                    style={
                      styles
                        .solicitudTitulo
                    }
                  >
                    {
                      nombrePaciente(
                        solicitud.pacienteId
                      )
                    }
                  </Text>

                  <Text
                    style={
                      styles.opcionTexto
                    }
                  >
                    Estado:{" "}
                    {
                      solicitud.estado
                    }
                  </Text>

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Análisis:
                  </Text>


                  {solicitud.analisis.map(
                    (
                      detalle,
                      indice
                    ) => (
                      <Text
                        key={`${solicitud.id}-${detalle.analisisId}-${indice}`}
                        style={
                          styles
                            .detalleTexto
                        }
                      >
                        •{" "}
                        {
                          detalle.nombre
                        }{" "}
                        - Bs.{" "}
                        {
                          detalle.precio
                        }
                      </Text>
                    )
                  )}


                  <Text
                    style={
                      styles
                        .solicitudTotal
                    }
                  >
                    Total: Bs.{" "}
                    {
                      solicitud.total.toFixed(
                        2
                      )
                    }
                  </Text>
                </View>
              )
            )
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    contenido: {
      padding: 18,
      paddingBottom: 50,
    },

    cargando: {
      flex: 1,
      justifyContent:
        "center",
      alignItems:
        "center",
      gap: 12,
    },

    encabezado: {
      marginBottom: 18,
    },

    volver: {
      color: "#2563EB",
      fontWeight: "700",
      marginBottom: 12,
    },

    titulo: {
      fontSize: 26,
      fontWeight: "800",
      color: "#0F172A",
    },

    subtitulo: {
      marginTop: 5,
      color: "#64748B",
    },

    tarjeta: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },

    tituloTarjeta: {
      fontSize: 18,
      fontWeight: "800",
      color: "#1E293B",
      marginBottom: 12,
    },

    input: {
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginBottom: 12,
      backgroundColor:
        "#FFFFFF",
    },

    opcion: {
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },

    opcionSeleccionada: {
      borderColor:
        "#2563EB",
      backgroundColor:
        "#EFF6FF",
    },

    opcionTitulo: {
      fontWeight: "700",
      color: "#0F172A",
    },

    opcionTexto: {
      color: "#64748B",
      marginTop: 3,
    },

    fila: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    flex: {
      flex: 1,
    },

    check: {
      fontSize: 22,
      fontWeight: "800",
      color: "#2563EB",
    },

    totalCard: {
      backgroundColor:
        "#EFF6FF",
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },

    totalTexto: {
      color: "#475569",
    },

    total: {
      fontSize: 24,
      fontWeight: "800",
      color: "#1D4ED8",
      marginTop: 6,
      marginBottom: 14,
    },

    boton: {
      backgroundColor:
        "#2563EB",
      paddingVertical: 13,
      borderRadius: 10,
      alignItems:
        "center",
    },

    botonDesactivado: {
      opacity: 0.6,
    },

    botonTexto: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    vacio: {
      color: "#64748B",
    },

    solicitudCard: {
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },

    solicitudTitulo: {
      fontSize: 16,
      fontWeight: "800",
      color: "#0F172A",
    },

    detalleTitulo: {
      marginTop: 10,
      fontWeight: "700",
      color: "#334155",
    },

    detalleTexto: {
      color: "#475569",
      marginTop: 4,
    },

    solicitudTotal: {
      marginTop: 12,
      fontSize: 17,
      fontWeight: "800",
      color: "#2563EB",
    },
  });