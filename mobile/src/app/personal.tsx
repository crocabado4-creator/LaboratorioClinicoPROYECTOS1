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
  actualizarPersonal,
  cambiarEstadoPersonal,
  crearPersonal,
  obtenerPersonal,
  type Personal,
} from "../services/personalService";


type Formulario = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: string;
};


const formularioInicial: Formulario = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  rol: "recepcionista",
};


export default function PersonalScreen() {
  const router = useRouter();

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [personal, setPersonal] =
    useState<Personal[]>([]);

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


  const puedeCrear =
    permisos.includes(
      "empleados.crear"
    );

  const puedeVer =
    permisos.includes(
      "empleados.ver"
    );

  const puedeEditar =
    permisos.includes(
      "empleados.editar"
    );

  const puedeDesactivar =
    permisos.includes(
      "empleados.desactivar"
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

        const idLaboratorio =
          typeof usuario.laboratorioId ===
          "string"
            ? usuario.laboratorioId
            : "";

        if (!idLaboratorio) {
          Alert.alert(
            "Error",
            "El administrador no tiene laboratorio asignado."
          );

          return;
        }

        setLaboratorioId(
          idLaboratorio
        );

        if (
          permisosRol.includes(
            "empleados.ver"
          )
        ) {
          const datos =
            await obtenerPersonal(
              idLaboratorio
            );

          setPersonal(
            datos
          );
        }

      } catch (error) {
        console.error(
          "Error cargando personal:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cargar el personal."
        );

      } finally {
        setCargando(false);
      }
    };


  const cargarPersonal =
    async () => {
      if (
        !puedeVer ||
        !laboratorioId
      ) {
        return;
      }

      const datos =
        await obtenerPersonal(
          laboratorioId
        );

      setPersonal(
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
        formulario.apellido.trim() === ""
      ) {
        Alert.alert(
          "Campos incompletos",
          "Ingrese nombre y apellido."
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
          await actualizarPersonal(
            editandoId,
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              rol:
                formulario.rol,
            }
          );

          await cargarPersonal();

          setFormulario(
            formularioInicial
          );

          setEditandoId(null);

          Alert.alert(
            "Edición exitosa",
            "Los datos del empleado fueron actualizados correctamente."
          );

        } else {
          await crearPersonal({
            nombre:
              formulario.nombre,

            apellido:
              formulario.apellido,

            email:
              formulario.email,

            password:
              formulario.password,

            rol:
              formulario.rol,

            laboratorioId,
          });

          await cargarPersonal();

          setFormulario(
            formularioInicial
          );

          Alert.alert(
            "Creación exitosa",
            "El empleado fue registrado correctamente."
          );
        }

      } catch (error: any) {
        console.error(
          "Error guardando personal:",
          error
        );

        const codigo =
          error?.code ?? "";

        if (
          codigo ===
          "auth/email-already-in-use"
        ) {
          Alert.alert(
            "Correo existente",
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
            "No se pudo guardar el personal."
          );
        }

      } finally {
        setGuardando(false);
      }
    };


  const editar =
    (
      empleado: Personal
    ) => {
      setEditandoId(
        empleado.id
      );

      setFormulario({
        nombre:
          empleado.nombre,

        apellido:
          empleado.apellido,

        email:
          empleado.email,

        password:
          "",

        rol:
          empleado.rol,
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
      empleado: Personal
    ) => {
      try {
        const nuevoEstado =
          !empleado.activo;

        await cambiarEstadoPersonal(
          empleado.id,
          nuevoEstado
        );

        await cargarPersonal();

        Alert.alert(
          "Cambio realizado",
          nuevoEstado
            ? "El empleado fue activado correctamente."
            : "El empleado fue desactivado correctamente."
        );

      } catch (error: any) {
        console.error(
          "Error cambiando estado:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cambiar el estado del empleado."
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
          Cargando personal...
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
          Gestión de personal
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
              Rol
            </Text>


            {[
              "recepcionista",
              "bioquimico",
            ].map(
              (rol) => (
                <Pressable
                  key={
                    rol
                  }
                  style={[
                    styles.opcion,

                    formulario.rol ===
                      rol &&
                      styles.seleccionado,
                  ]}
                  onPress={() =>
                    cambiarCampo(
                      "rol",
                      rol
                    )
                  }
                >
                  <Text
                    style={
                      formulario.rol ===
                      rol
                        ? styles.textoSeleccionado
                        : undefined
                    }
                  >
                    {rol ===
                    "bioquimico"
                      ? "Bioquímico"
                      : "Recepcionista"}
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
                    : "Registrar personal"}
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
          personal.map(
            (
              empleado
            ) => (
              <View
                key={
                  empleado.id
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
                  {empleado.nombre}{" "}
                  {empleado.apellido}
                </Text>

                <Text>
                  Correo:{" "}
                  {
                    empleado.email
                  }
                </Text>

                <Text>
                  Rol:{" "}
                  {
                    empleado.rol
                  }
                </Text>

                <Text>
                  Estado:{" "}
                  {empleado.activo
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
                          empleado
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
                          empleado
                        )
                      }
                    >
                      <Text>
                        {empleado.activo
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
      padding: 14,
      borderRadius: 10,
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