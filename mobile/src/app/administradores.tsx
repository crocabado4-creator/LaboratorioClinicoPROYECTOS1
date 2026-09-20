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
  obtenerLaboratorios,
  type Laboratorio,
} from "../services/laboratoriosService";

import {
  actualizarAdministrador,
  cambiarEstadoAdministrador,
  crearAdministrador,
  obtenerAdministradores,
  type Administrador,
} from "../services/administradoresService";


type Formulario = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  laboratorioId: string;
};


const formularioInicial: Formulario = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  laboratorioId: "",
};


export default function AdministradoresScreen() {
  const router = useRouter();

  const [administradores, setAdministradores] =
    useState<Administrador[]>([]);

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
      "administradores.ver"
    );

  const puedeCrear =
    permisos.includes(
      "administradores.crear"
    );

  const puedeEditar =
    permisos.includes(
      "administradores.editar"
    );

  const puedeDesactivar =
    permisos.includes(
      "administradores.desactivar"
    );


  useEffect(() => {
    inicializar();
  }, []);


  const inicializar =
    async () => {
      try {
        const firebaseUser =
          auth.currentUser;

        if (!firebaseUser) {
          router.replace(
            "/" as any
          );

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

        if (!usuarioSnap.exists()) {
          Alert.alert(
            "Error",
            "No se encontró el usuario."
          );

          return;
        }

        const usuario =
          usuarioSnap.data();

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

        const [
          datosLaboratorios,
          datosAdministradores,
        ] =
          await Promise.all([
            obtenerLaboratorios(),

            permisosRol.includes(
              "administradores.ver"
            )
              ? obtenerAdministradores()
              : Promise.resolve([]),
          ]);

        setLaboratorios(
          datosLaboratorios
        );

        setAdministradores(
          datosAdministradores
        );

      } catch (error) {
        console.error(
          "Error cargando administradores:",
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


  const cargarAdministradores =
    async () => {
      if (!puedeVer) {
        return;
      }

      const datos =
        await obtenerAdministradores();

      setAdministradores(
        datos
      );
    };


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


  const guardar =
    async () => {
      if (
        formulario.nombre.trim() === "" ||
        formulario.apellido.trim() === "" ||
        formulario.laboratorioId === ""
      ) {
        Alert.alert(
          "Campos incompletos",
          "Complete nombre, apellido y laboratorio."
        );

        return;
      }

      if (
        !editandoId &&
        (
          formulario.email.trim() === "" ||
          formulario.password.length < 6
        )
      ) {
        Alert.alert(
          "Datos incompletos",
          "Ingrese correo y una contraseña de al menos 6 caracteres."
        );

        return;
      }

      try {
        setGuardando(true);

        if (editandoId) {
          await actualizarAdministrador(
            editandoId,
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              laboratorioId:
                formulario.laboratorioId,
            }
          );

          await cargarAdministradores();

          setFormulario(
            formularioInicial
          );

          setEditandoId(
            null
          );

          Alert.alert(
            "Edición exitosa",
            "El administrador fue actualizado correctamente."
          );

        } else {
          await crearAdministrador({
            nombre:
              formulario.nombre,

            apellido:
              formulario.apellido,

            email:
              formulario.email,

            password:
              formulario.password,

            laboratorioId:
              formulario.laboratorioId,
          });

          await cargarAdministradores();

          setFormulario(
            formularioInicial
          );

          Alert.alert(
            "Creación exitosa",
            "El administrador fue registrado correctamente."
          );
        }

      } catch (error: any) {
        console.error(
          "Error guardando administrador:",
          error
        );

        const codigo =
          error?.code ?? "";

        if (
          codigo ===
          "auth/email-already-in-use"
        ) {
          Alert.alert(
            "Correo registrado",
            "Ese correo ya está registrado."
          );

        } else if (
          codigo ===
          "permission-denied"
        ) {
          Alert.alert(
            "Permiso denegado",
            "Firestore no permite realizar esta operación."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudo guardar el administrador."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  const editar =
    (
      administrador: Administrador
    ) => {
      setEditandoId(
        administrador.id
      );

      setFormulario({
        nombre:
          administrador.nombre,

        apellido:
          administrador.apellido,

        email:
          administrador.email,

        password:
          "",

        laboratorioId:
          administrador.laboratorioId,
      });
    };


  const cancelarEdicion =
    () => {
      setEditandoId(null);
      setFormulario(
        formularioInicial
      );
    };


  const cambiarEstado =
    async (
      administrador: Administrador
    ) => {
      try {
        const nuevoEstado =
          !administrador.activo;

        await cambiarEstadoAdministrador(
          administrador.id,
          nuevoEstado
        );

        await cargarAdministradores();

        Alert.alert(
          "Cambio realizado",
          nuevoEstado
            ? "El administrador fue activado correctamente."
            : "El administrador fue desactivado correctamente."
        );

      } catch (error: any) {
        console.error(
          "Error cambiando estado:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cambiar el estado del administrador."
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
          Cargando administradores...
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
          Gestión de administradores
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

            <TextInput
              style={
                styles.input
              }
              placeholder="Nombre"
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

            <TextInput
              style={
                styles.input
              }
              placeholder="Apellido"
              value={
                formulario.apellido
              }
              onChangeText={(
                valor
              ) =>
                cambiarCampo(
                  "apellido",
                  valor
                )
              }
            />

            <TextInput
              style={
                styles.input
              }
              placeholder="Correo"
              value={
                formulario.email
              }
              editable={
                !editandoId
              }
              onChangeText={(
                valor
              ) =>
                cambiarCampo(
                  "email",
                  valor
                )
              }
              autoCapitalize="none"
            />


            {!editandoId && (
              <TextInput
                style={
                  styles.input
                }
                placeholder="Contraseña"
                secureTextEntry
                value={
                  formulario.password
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "password",
                    valor
                  )
                }
              />
            )}


            <Text
              style={
                styles.label
              }
            >
              Seleccione laboratorio
            </Text>


            {laboratorios.map(
              (
                laboratorio
              ) => (
                <Pressable
                  key={
                    laboratorio.id
                  }
                  style={[
                    styles.opcion,

                    formulario.laboratorioId ===
                      laboratorio.id &&
                      styles.seleccionado,
                  ]}
                  onPress={() =>
                    cambiarCampo(
                      "laboratorioId",
                      laboratorio.id
                    )
                  }
                >
                  <Text
                    style={
                      formulario.laboratorioId ===
                      laboratorio.id
                        ? styles.textoSeleccionado
                        : undefined
                    }
                  >
                    {
                      laboratorio.nombre
                    }
                  </Text>
                </Pressable>
              )
            )}


            <Pressable
              style={
                styles.botonGuardar
              }
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
                    : "Registrar administrador"}
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


        {puedeVer &&
          administradores.map(
            (
              administrador
            ) => (
              <View
                key={
                  administrador.id
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
                  {administrador.nombre}{" "}
                  {administrador.apellido}
                </Text>

                <Text>
                  {
                    administrador.email
                  }
                </Text>

                <Text>
                  Estado:{" "}
                  {administrador.activo
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
                          administrador
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
                          administrador
                        )
                      }
                    >
                      <Text>
                        {administrador.activo
                          ? "Desactivar"
                          : "Activar"}
                      </Text>
                    </Pressable>
                  )}

                </View>

              </View>
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

    titulo: {
      fontSize: 30,
      fontWeight: "bold",
      marginTop: 25,
      marginBottom: 20,
    },

    card: {
      backgroundColor: "#ffffff",
      padding: 20,
      borderRadius: 15,
      marginBottom: 20,
    },

    input: {
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
      padding: 14,
      marginBottom: 15,
    },

    label: {
      fontWeight: "bold",
      marginBottom: 10,
    },

    opcion: {
      borderWidth: 1,
      borderColor: "#cccccc",
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },

    seleccionado: {
      backgroundColor: "#222222",
    },

    textoSeleccionado: {
      color: "#ffffff",
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
      marginBottom: 8,
    },

    acciones: {
      flexDirection: "row",
      gap: 10,
      marginTop: 15,
    },

    botonAccion: {
      borderWidth: 1,
      borderColor: "#cccccc",
      padding: 10,
      borderRadius: 8,
    },
  });