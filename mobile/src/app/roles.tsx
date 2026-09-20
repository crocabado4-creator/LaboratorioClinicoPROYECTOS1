import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
  actualizarRolUsuario,
  obtenerPermisosRol,
  obtenerRolesAsignables,
  obtenerUsuariosLaboratorio,
  type RolSistema,
  type UsuarioRol,
} from "../services/rolesService";


export default function RolesScreen() {
  const router = useRouter();

  const [usuarios, setUsuarios] =
    useState<UsuarioRol[]>([]);

  const [roles, setRoles] =
    useState<RolSistema[]>([]);

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [actualizandoId, setActualizandoId] =
    useState<string | null>(
      null
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

        if (
          usuario.activo !== true
        ) {
          Alert.alert(
            "Acceso denegado",
            "El usuario está inactivo."
          );

          return;
        }

        const rolActual =
          typeof usuario.rol === "string"
            ? usuario.rol
            : "";

        const permisos =
          await obtenerPermisosRol(
            rolActual
          );

        if (
          !permisos.includes(
            "roles.asignar"
          )
        ) {
          Alert.alert(
            "Sin permiso",
            "No tiene permiso para asignar roles."
          );

          return;
        }

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

        const [
          rolesDisponibles,
          usuariosDisponibles,
        ] =
          await Promise.all([
            obtenerRolesAsignables(),

            obtenerUsuariosLaboratorio(
              idLaboratorio
            ),
          ]);

        setRoles(
          rolesDisponibles
        );

        setUsuarios(
          usuariosDisponibles
        );

      } catch (error) {
        console.error(
          "Error cargando roles:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudieron cargar los roles."
        );

      } finally {
        setCargando(false);
      }
    };


  const cargarUsuarios =
    async () => {
      const datos =
        await obtenerUsuariosLaboratorio(
          laboratorioId
        );

      setUsuarios(
        datos
      );
    };


  const cambiarRol =
    async (
      usuario: UsuarioRol,
      nuevoRol: string
    ) => {
      if (
        usuario.rol ===
        nuevoRol
      ) {
        Alert.alert(
          "Sin cambios",
          "El usuario ya tiene este rol asignado."
        );

        return;
      }

      try {
        setActualizandoId(
          usuario.id
        );

        await actualizarRolUsuario(
          usuario.id,
          nuevoRol
        );

        await cargarUsuarios();

        const nombreRol =
          nuevoRol === "bioquimico"
            ? "Bioquímico"
            : "Recepcionista";

        Alert.alert(
          "Rol actualizado",
          `El rol de ${usuario.nombre} ${usuario.apellido} fue cambiado a ${nombreRol} correctamente.`
        );

      } catch (error: any) {
        console.error(
          "Error actualizando rol:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          Alert.alert(
            "Permiso denegado",
            "Firestore no permite cambiar el rol."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudo actualizar el rol."
          );
        }

      } finally {
        setActualizandoId(
          null
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
          Cargando roles...
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
          Roles y permisos
        </Text>


        {usuarios.length === 0 ? (
          <Text>
            No existe personal registrado.
          </Text>

        ) : (
          usuarios.map(
            (
              usuario
            ) => (
              <View
                key={
                  usuario.id
                }
                style={
                  styles.card
                }
              >

                <Text
                  style={
                    styles.nombre
                  }
                >
                  {usuario.nombre}{" "}
                  {usuario.apellido}
                </Text>

                <Text>
                  {
                    usuario.email
                  }
                </Text>

                <Text
                  style={
                    styles.rolActual
                  }
                >
                  Rol actual:{" "}
                  {
                    usuario.rol
                  }
                </Text>


                {roles.map(
                  (rol) => {
                    const seleccionado =
                      usuario.rol ===
                      rol.id;

                    return (
                      <Pressable
                        key={
                          rol.id
                        }
                        style={[
                          styles.opcionRol,

                          seleccionado &&
                            styles.seleccionado,
                        ]}
                        disabled={
                          actualizandoId ===
                          usuario.id
                        }
                        onPress={() =>
                          cambiarRol(
                            usuario,
                            rol.id
                          )
                        }
                      >
                        <Text
                          style={
                            seleccionado
                              ? styles.textoSeleccionado
                              : styles.textoRol
                          }
                        >
                          {
                            rol.nombre
                          }
                        </Text>
                      </Pressable>
                    );
                  }
                )}

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
      marginBottom: 15,
    },

    nombre: {
      fontSize: 20,
      fontWeight: "bold",
    },

    rolActual: {
      marginTop: 10,
      marginBottom: 10,
    },

    opcionRol: {
      borderWidth: 1,
      borderColor: "#cccccc",
      padding: 13,
      borderRadius: 10,
      marginBottom: 8,
    },

    seleccionado: {
      backgroundColor: "#222222",
    },

    textoRol: {
      textAlign: "center",
    },

    textoSeleccionado: {
      textAlign: "center",
      color: "#ffffff",
      fontWeight: "bold",
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
  });