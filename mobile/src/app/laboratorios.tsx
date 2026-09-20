import { useEffect, useState } from "react";

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

import { useRouter } from "expo-router";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  obtenerPermisosRol,
} from "../services/rolesService";

import {
  actualizarLaboratorio,
  cambiarEstadoLaboratorio,
  crearLaboratorio,
  obtenerLaboratorios,
  type Laboratorio,
} from "../services/laboratoriosService";


type Formulario = {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
};


const formularioInicial: Formulario = {
  nombre: "",
  direccion: "",
  telefono: "",
  email: "",
};


export default function LaboratoriosScreen() {
  const router = useRouter();

  const [laboratorios, setLaboratorios] =
    useState<Laboratorio[]>([]);

  const [permisos, setPermisos] =
    useState<string[]>([]);

  const [formulario, setFormulario] =
    useState<Formulario>(
      formularioInicial
    );

  const [editandoId, setEditandoId] =
    useState<string | null>(null);

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);


  const puedeVer =
    permisos.includes(
      "laboratorios.ver"
    );

  const puedeCrear =
    permisos.includes(
      "laboratorios.crear"
    );

  const puedeEditar =
    permisos.includes(
      "laboratorios.editar"
    );

  const puedeDesactivar =
    permisos.includes(
      "laboratorios.desactivar"
    );


  // =====================================================
  // INICIALIZAR
  // =====================================================

  useEffect(() => {
    inicializar();
  }, []);


  const inicializar =
    async () => {
      try {
        setCargando(true);

        const firebaseUser =
          auth.currentUser;

        if (!firebaseUser) {
          router.replace(
            "/" as any
          );

          return;
        }

        const usuarioRef =
          doc(
            db,
            "usuarios",
            firebaseUser.uid
          );

        const usuarioSnap =
          await getDoc(
            usuarioRef
          );

        if (!usuarioSnap.exists()) {
          Alert.alert(
            "Error",
            "No se encontró el usuario."
          );

          router.replace(
            "/" as any
          );

          return;
        }

        const usuario =
          usuarioSnap.data();

        if (
          usuario.activo !== true
        ) {
          Alert.alert(
            "Acceso denegado",
            "El usuario está inactivo."
          );

          router.replace(
            "/" as any
          );

          return;
        }

        const rol =
          typeof usuario.rol === "string"
            ? usuario.rol
            : "";

        const permisosRol =
          await obtenerPermisosRol(
            rol
          );

        setPermisos(
          permisosRol
        );

        const puedeAcceder =
          permisosRol.some(
            (permiso) =>
              [
                "laboratorios.crear",
                "laboratorios.ver",
                "laboratorios.editar",
                "laboratorios.desactivar",
              ].includes(
                permiso
              )
          );

        if (!puedeAcceder) {
          Alert.alert(
            "Sin permiso",
            "No tiene permisos para gestionar laboratorios."
          );

          return;
        }

        if (
          permisosRol.includes(
            "laboratorios.ver"
          )
        ) {
          const datos =
            await obtenerLaboratorios();

          setLaboratorios(
            datos
          );
        }

      } catch (error) {
        console.error(
          "Error inicializando laboratorios:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cargar el módulo."
        );

      } finally {
        setCargando(false);
      }
    };


  // =====================================================
  // RECARGAR
  // =====================================================

  const cargarLaboratorios =
    async () => {
      if (!puedeVer) {
        return;
      }

      try {
        const datos =
          await obtenerLaboratorios();

        setLaboratorios(
          datos
        );

      } catch (error) {
        console.error(
          "Error cargando laboratorios:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudieron actualizar los laboratorios."
        );
      }
    };


  // =====================================================
  // CAMBIAR CAMPO
  // =====================================================

  const cambiarCampo = (
    campo: keyof Formulario,
    valor: string
  ) => {
    setFormulario(
      (actual) => ({
        ...actual,
        [campo]: valor,
      })
    );
  };


  // =====================================================
  // GUARDAR
  // =====================================================

  const guardar =
    async () => {
      if (
        formulario.nombre.trim() === "" ||
        formulario.direccion.trim() === "" ||
        formulario.telefono.trim() === "" ||
        formulario.email.trim() === ""
      ) {
        Alert.alert(
          "Campos incompletos",
          "Complete todos los campos."
        );

        return;
      }

      try {
        setGuardando(true);

        if (editandoId) {
          if (!puedeEditar) {
            Alert.alert(
              "Sin permiso",
              "No puede editar laboratorios."
            );

            return;
          }

          await actualizarLaboratorio(
            editandoId,
            {
              nombre:
                formulario.nombre,

              direccion:
                formulario.direccion,

              telefono:
                formulario.telefono,

              email:
                formulario.email,
            }
          );

          await cargarLaboratorios();

          setFormulario(
            formularioInicial
          );

          setEditandoId(
            null
          );

          Alert.alert(
            "Edición exitosa",
            "Los datos del laboratorio fueron actualizados correctamente."
          );

        } else {
          if (!puedeCrear) {
            Alert.alert(
              "Sin permiso",
              "No puede crear laboratorios."
            );

            return;
          }

          await crearLaboratorio({
            nombre:
              formulario.nombre,

            direccion:
              formulario.direccion,

            telefono:
              formulario.telefono,

            email:
              formulario.email,
          });

          await cargarLaboratorios();

          setFormulario(
            formularioInicial
          );

          Alert.alert(
            "Creación exitosa",
            "El laboratorio fue registrado correctamente."
          );
        }

      } catch (error: any) {
        console.error(
          "Error guardando laboratorio:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          Alert.alert(
            "Permiso denegado",
            "Firestore no permite realizar esta operación."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudo guardar el laboratorio."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  // =====================================================
  // EDITAR
  // =====================================================

  const editar =
    (
      laboratorio: Laboratorio
    ) => {
      if (!puedeEditar) {
        Alert.alert(
          "Sin permiso",
          "No puede editar laboratorios."
        );

        return;
      }

      setEditandoId(
        laboratorio.id
      );

      setFormulario({
        nombre:
          laboratorio.nombre,

        direccion:
          laboratorio.direccion,

        telefono:
          laboratorio.telefono,

        email:
          laboratorio.email,
      });
    };


  // =====================================================
  // CANCELAR
  // =====================================================

  const cancelarEdicion =
    () => {
      setEditandoId(
        null
      );

      setFormulario(
        formularioInicial
      );
    };


  // =====================================================
  // ACTIVAR / DESACTIVAR
  // =====================================================

  const cambiarEstado =
    async (
      laboratorio: Laboratorio
    ) => {
      if (!puedeDesactivar) {
        Alert.alert(
          "Sin permiso",
          "No puede cambiar el estado de laboratorios."
        );

        return;
      }

      try {
        const nuevoEstado =
          !laboratorio.activo;

        await cambiarEstadoLaboratorio(
          laboratorio.id,
          nuevoEstado
        );

        await cargarLaboratorios();

        Alert.alert(
          "Cambio realizado",
          nuevoEstado
            ? "El laboratorio fue activado correctamente."
            : "El laboratorio fue desactivado correctamente."
        );

      } catch (error: any) {
        console.error(
          "Error cambiando estado:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          Alert.alert(
            "Permiso denegado",
            "Firestore no permite cambiar el estado del laboratorio."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudo cambiar el estado del laboratorio."
          );
        }
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

        <Text
          style={
            styles.textoCargando
          }
        >
          Cargando laboratorios...
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
        keyboardShouldPersistTaps="handled"
      >

        <Pressable
          style={
            styles.botonVolver
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.textoBoton
            }
          >
            Volver al Dashboard
          </Text>
        </Pressable>


        <Text
          style={
            styles.titulo
          }
        >
          Gestión de laboratorios
        </Text>


        {(
          (!editandoId && puedeCrear) ||
          (editandoId && puedeEditar)
        ) && (
          <View
            style={
              styles.card
            }
          >

            <Text
              style={
                styles.subtitulo
              }
            >
              {editandoId
                ? "Editar laboratorio"
                : "Registrar laboratorio"}
            </Text>


            <Text
              style={
                styles.label
              }
            >
              Nombre
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                formulario.nombre
              }
              onChangeText={(
                valor
              ) =>
                cambiarCampo(
                  "nombre",
                  valor
                )
              }
            />


            <Text
              style={
                styles.label
              }
            >
              Dirección
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                formulario.direccion
              }
              onChangeText={(
                valor
              ) =>
                cambiarCampo(
                  "direccion",
                  valor
                )
              }
            />


            <Text
              style={
                styles.label
              }
            >
              Teléfono
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                formulario.telefono
              }
              onChangeText={(
                valor
              ) =>
                cambiarCampo(
                  "telefono",
                  valor
                )
              }
              keyboardType="phone-pad"
            />


            <Text
              style={
                styles.label
              }
            >
              Correo
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                formulario.email
              }
              onChangeText={(
                valor
              ) =>
                cambiarCampo(
                  "email",
                  valor
                )
              }
              keyboardType="email-address"
              autoCapitalize="none"
            />


            <Pressable
              style={[
                styles.botonGuardar,
                guardando &&
                  styles.deshabilitado,
              ]}
              onPress={
                guardar
              }
              disabled={
                guardando
              }
            >
              <Text
                style={
                  styles.textoBoton
                }
              >
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Guardar cambios"
                    : "Registrar laboratorio"}
              </Text>
            </Pressable>


            {editandoId && (
              <Pressable
                style={
                  styles.botonCancelar
                }
                onPress={
                  cancelarEdicion
                }
              >
                <Text>
                  Cancelar edición
                </Text>
              </Pressable>
            )}

          </View>
        )}


        <Text
          style={
            styles.tituloLista
          }
        >
          Laboratorios registrados
        </Text>


        {!puedeVer ? (
          <Text
            style={
              styles.sinDatos
            }
          >
            No tiene permiso para consultar laboratorios.
          </Text>

        ) : laboratorios.length ===
          0 ? (
          <Text
            style={
              styles.sinDatos
            }
          >
            No existen laboratorios registrados.
          </Text>

        ) : (
          laboratorios.map(
            (
              laboratorio
            ) => (
              <View
                key={
                  laboratorio.id
                }
                style={
                  styles.itemCard
                }
              >

                <Text
                  style={
                    styles.nombre
                  }
                >
                  {
                    laboratorio.nombre
                  }
                </Text>

                <Text>
                  Dirección:{" "}
                  {
                    laboratorio.direccion
                  }
                </Text>

                <Text>
                  Teléfono:{" "}
                  {
                    laboratorio.telefono
                  }
                </Text>

                <Text>
                  Correo:{" "}
                  {
                    laboratorio.email
                  }
                </Text>

                <Text>
                  Estado:{" "}
                  {laboratorio.activo
                    ? "Activo"
                    : "Inactivo"}
                </Text>


                <View
                  style={
                    styles.acciones
                  }
                >

                  {puedeEditar && (
                    <Pressable
                      style={
                        styles.botonAccion
                      }
                      onPress={() =>
                        editar(
                          laboratorio
                        )
                      }
                    >
                      <Text>
                        Editar
                      </Text>
                    </Pressable>
                  )}


                  {puedeDesactivar && (
                    <Pressable
                      style={
                        styles.botonAccion
                      }
                      onPress={() =>
                        cambiarEstado(
                          laboratorio
                        )
                      }
                    >
                      <Text>
                        {laboratorio.activo
                          ? "Desactivar"
                          : "Activar"}
                      </Text>
                    </Pressable>
                  )}

                </View>

              </View>
            )
          )
        )}

      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#f1f5f9",
    },

    contenido: {
      padding: 20,
      paddingBottom: 50,
    },

    cargando: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    textoCargando: {
      marginTop: 10,
      fontSize: 16,
    },

    titulo: {
      fontSize: 30,
      fontWeight: "bold",
      marginTop: 25,
      marginBottom: 20,
    },

    subtitulo: {
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 20,
    },

    tituloLista: {
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 30,
      marginBottom: 15,
    },

    card: {
      backgroundColor: "#ffffff",
      padding: 20,
      borderRadius: 15,
    },

    label: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 7,
    },

    input: {
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
      padding: 14,
      marginBottom: 15,
      backgroundColor: "#ffffff",
    },

    botonGuardar: {
      backgroundColor: "#222222",
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 10,
    },

    botonCancelar: {
      padding: 15,
      alignItems: "center",
    },

    botonVolver: {
      backgroundColor: "#222222",
      padding: 12,
      borderRadius: 10,
      alignSelf: "flex-start",
    },

    textoBoton: {
      color: "#ffffff",
      fontWeight: "bold",
    },

    itemCard: {
      backgroundColor: "#ffffff",
      padding: 18,
      borderRadius: 14,
      marginBottom: 14,
    },

    nombre: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 10,
    },

    acciones: {
      flexDirection: "row",
      gap: 10,
      marginTop: 15,
    },

    botonAccion: {
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 8,
      padding: 10,
    },

    sinDatos: {
      fontSize: 16,
      color: "#666666",
    },

    deshabilitado: {
      opacity: 0.6,
    },
  });