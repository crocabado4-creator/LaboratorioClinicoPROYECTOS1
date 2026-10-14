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
  obtenerMuestras,
  obtenerOrdenesParaMuestras,
  registrarMuestra,
  type Muestra,
  type OrdenParaMuestra,
} from "../services/muestrasService";


type UsuarioActual = {
  id: string;
  rol: string;
  laboratorioId: string;
};


export default function Muestras() {

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
    ordenes,
    setOrdenes,
  ] =
    useState<OrdenParaMuestra[]>([]);


  const [
    muestras,
    setMuestras,
  ] =
    useState<Muestra[]>([]);


  const [
    ordenId,
    setOrdenId,
  ] =
    useState("");


  const [
    analisisId,
    setAnalisisId,
  ] =
    useState("");


  const [
    tipo,
    setTipo,
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


  const cargar =
    async () => {

      try {
        setCargando(
          true
        );


        const firebaseUser =
          auth.currentUser;


        if (!firebaseUser) {
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

          return;
        }


        const datos =
          usuarioSnap.data();


        const actual:
          UsuarioActual = {
          id:
            firebaseUser.uid,

          rol:
            String(
              datos.rol || ""
            ),

          laboratorioId:
            String(
              datos.laboratorioId ||
                ""
            ),
        };


        if (
          actual.rol !==
          "bioquimico"
        ) {
          Alert.alert(
            "Acceso restringido",
            "Este módulo corresponde al Bioquímico."
          );

          router.back();
          return;
        }


        setUsuario(
          actual
        );


        const [
          listaPacientes,
          listaOrdenes,
          listaMuestras,
        ] =
          await Promise.all([
            obtenerPacientes(
              actual.laboratorioId
            ),

            obtenerOrdenesParaMuestras(
              actual.laboratorioId
            ),

            obtenerMuestras(
              actual.laboratorioId
            ),
          ]);


        setPacientes(
          listaPacientes
        );

        setOrdenes(
          listaOrdenes
        );

        setMuestras(
          listaMuestras
        );

      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las muestras."
        );

      } finally {
        setCargando(
          false
        );
      }
    };


  useEffect(() => {
    cargar();
  }, []);


  const ordenSeleccionada =
    useMemo(
      () =>
        ordenes.find(
          (item) =>
            item.id ===
              ordenId ||
            item.ordenId ===
              ordenId
        ) || null,
      [
        ordenes,
        ordenId,
      ]
    );


  const nombrePaciente =
    (
      id: string
    ) => {

      const paciente =
        pacientes.find(
          (item) =>
            item.id === id ||
            item.pacienteId ===
              id
        );


      if (!paciente) {
        return id;
      }


      return `${paciente.nombres} ${paciente.apellidos}`;
    };


  const guardar =
    async () => {

      if (!usuario) {
        return;
      }


      if (!ordenId) {
        Alert.alert(
          "Falta orden",
          "Selecciona una orden."
        );

        return;
      }


      if (!analisisId) {
        Alert.alert(
          "Falta análisis",
          "Selecciona un análisis."
        );

        return;
      }


      if (
        !tipo.trim()
      ) {
        Alert.alert(
          "Falta tipo",
          "Escribe el tipo de muestra."
        );

        return;
      }


      try {
        setGuardando(
          true
        );


        await registrarMuestra({
          laboratorioId:
            usuario.laboratorioId,

          bioquimicoId:
            usuario.id,

          ordenId,

          analisisId,

          tipo,
        });


        const nuevas =
          await obtenerMuestras(
            usuario.laboratorioId
          );


        setMuestras(
          nuevas
        );


        setOrdenId(
          ""
        );

        setAnalisisId(
          ""
        );

        setTipo(
          ""
        );


        Alert.alert(
          "Correcto",
          "Muestra registrada y etiquetada correctamente."
        );

      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo registrar la muestra."
        );

      } finally {
        setGuardando(
          false
        );
      }
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
          Cargando muestras...
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
          Gestión de muestras
        </Text>


        <Text
          style={
            styles.subtitulo
          }
        >
          Registra la toma e identificación de las muestras.
        </Text>


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
            1. Seleccionar orden
          </Text>


          {ordenes.length ===
          0 ? (
            <Text
              style={
                styles.textoGris
              }
            >
              No existen órdenes disponibles.
            </Text>
          ) : (
            ordenes.map(
              (
                orden
              ) => (
                <Pressable
                  key={
                    orden.id
                  }
                  style={[
                    styles.opcion,

                    ordenId ===
                      orden.id &&
                      styles
                        .seleccionado,
                  ]}
                  onPress={() => {
                    setOrdenId(
                      orden.id
                    );

                    setAnalisisId(
                      ""
                    );
                  }}
                >
                  <Text
                    style={
                      styles
                        .opcionTitulo
                    }
                  >
                    Orden{" "}
                    {
                      orden.ordenId
                    }
                  </Text>

                  <Text
                    style={
                      styles.textoGris
                    }
                  >
                    Paciente:{" "}
                    {
                      nombrePaciente(
                        orden.pacienteId
                      )
                    }
                  </Text>
                </Pressable>
              )
            )
          )}
        </View>


        {ordenSeleccionada && (
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


            <Text
              style={
                styles.paciente
              }
            >
              Paciente:{" "}
              {
                nombrePaciente(
                  ordenSeleccionada.pacienteId
                )
              }
            </Text>


            {ordenSeleccionada
              .analisis.map(
                (
                  analisis
                ) => (
                  <Pressable
                    key={
                      analisis.analisisId
                    }
                    style={[
                      styles.opcion,

                      analisisId ===
                        analisis.analisisId &&
                        styles
                          .seleccionado,
                    ]}
                    onPress={() =>
                      setAnalisisId(
                        analisis.analisisId
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
                        analisis.nombre
                      }
                    </Text>
                  </Pressable>
                )
              )}


            <TextInput
              style={
                styles.input
              }
              placeholder="Tipo de muestra: sangre, orina..."
              value={
                tipo
              }
              onChangeText={
                setTipo
              }
            />


            <Pressable
              style={[
                styles.boton,

                guardando &&
                  styles
                    .desactivado,
              ]}
              disabled={
                guardando
              }
              onPress={
                guardar
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
                    : "Registrar muestra"
                }
              </Text>
            </Pressable>
          </View>
        )}


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
            Muestras registradas
          </Text>


          {muestras.length ===
          0 ? (
            <Text
              style={
                styles.textoGris
              }
            >
              No existen muestras registradas.
            </Text>
          ) : (
            muestras.map(
              (
                muestra
              ) => (
                <View
                  key={
                    muestra.id
                  }
                  style={
                    styles.muestra
                  }
                >
                  <Text
                    style={
                      styles
                        .codigo
                    }
                  >
                    {
                      muestra.codigoEtiqueta
                    }
                  </Text>

                  <Text>
                    Paciente:{" "}
                    {
                      nombrePaciente(
                        muestra.pacienteId
                      )
                    }
                  </Text>

                  <Text>
                    Análisis:{" "}
                    {
                      muestra.analisisNombre
                    }
                  </Text>

                  <Text>
                    Tipo:{" "}
                    {
                      muestra.tipo
                    }
                  </Text>

                  <Text>
                    Estado:{" "}
                    {
                      muestra.estado
                    }
                  </Text>

                  <Text
                    style={
                      styles.textoGris
                    }
                  >
                    Orden:{" "}
                    {
                      muestra.ordenId
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
      paddingBottom: 60,
    },

    cargando: {
      flex: 1,
      justifyContent:
        "center",
      alignItems:
        "center",
      gap: 10,
    },

    volver: {
      color: "#0F766E",
      fontWeight: "700",
      marginBottom: 12,
    },

    titulo: {
      fontSize: 26,
      fontWeight: "800",
      color: "#0F172A",
    },

    subtitulo: {
      color: "#64748B",
      marginTop: 5,
      marginBottom: 18,
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
      marginBottom: 12,
    },

    opcion: {
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },

    seleccionado: {
      borderColor:
        "#0F766E",
      backgroundColor:
        "#CCFBF1",
    },

    opcionTitulo: {
      fontWeight: "700",
      color: "#0F172A",
    },

    textoGris: {
      color: "#64748B",
      marginTop: 3,
    },

    paciente: {
      fontWeight: "700",
      marginBottom: 12,
    },

    input: {
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
      padding: 11,
      marginTop: 12,
      marginBottom: 10,
    },

    boton: {
      backgroundColor:
        "#0F766E",
      paddingVertical: 13,
      borderRadius: 10,
      alignItems:
        "center",
    },

    botonTexto: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    desactivado: {
      opacity: 0.6,
    },

    muestra: {
      borderWidth: 1,
      borderColor:
        "#D1FAE5",
      borderRadius: 12,
      padding: 13,
      marginBottom: 10,
      backgroundColor:
        "#F0FDFA",
    },

    codigo: {
      fontSize: 17,
      fontWeight: "800",
      color: "#0F766E",
      marginBottom: 8,
    },
  });