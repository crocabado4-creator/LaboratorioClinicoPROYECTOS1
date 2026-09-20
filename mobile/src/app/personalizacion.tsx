import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
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
  actualizarPersonalizacion,
  obtenerPersonalizacion,
} from "../services/personalizacionService";


export default function PersonalizacionScreen() {
  const router = useRouter();

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [nombre, setNombre] =
    useState("");

  const [logoUrl, setLogoUrl] =
    useState("");

  const [errorLogo, setErrorLogo] =
    useState(false);

  const [puedeEditar, setPuedeEditar] =
    useState(false);

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);


  useEffect(() => {
    cargarDatos();
  }, []);


  const cargarDatos =
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

        const rol =
          typeof usuario.rol === "string"
            ? usuario.rol
            : "";

        const permisos =
          await obtenerPermisosRol(
            rol
          );

        if (
          !permisos.includes(
            "personalizacion.editar"
          )
        ) {
          Alert.alert(
            "Sin permiso",
            "No tiene permiso para personalizar el laboratorio."
          );

          return;
        }

        setPuedeEditar(true);

        const idLaboratorio =
          typeof usuario.laboratorioId ===
          "string"
            ? usuario.laboratorioId
            : "";

        if (!idLaboratorio) {
          Alert.alert(
            "Error",
            "No tiene laboratorio asignado."
          );

          return;
        }

        setLaboratorioId(
          idLaboratorio
        );

        const datos =
          await obtenerPersonalizacion(
            idLaboratorio
          );

        if (!datos) {
          Alert.alert(
            "Error",
            "No se encontró el laboratorio."
          );

          return;
        }

        setNombre(
          datos.nombre
        );

        setLogoUrl(
          datos.logoUrl
        );

        setErrorLogo(false);

      } catch (error) {
        console.error(
          "Error cargando personalización:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cargar la personalización."
        );

      } finally {
        setCargando(false);
      }
    };


  const guardar =
    async () => {
      if (!puedeEditar) {
        Alert.alert(
          "Sin permiso",
          "No puede modificar la personalización."
        );

        return;
      }

      if (
        nombre.trim() === ""
      ) {
        Alert.alert(
          "Campo requerido",
          "Ingrese el nombre del laboratorio."
        );

        return;
      }

      try {
        setGuardando(true);

        await actualizarPersonalizacion(
          laboratorioId,
          {
            nombre,
            logoUrl,
          }
        );

        const actualizado =
          await obtenerPersonalizacion(
            laboratorioId
          );

        if (actualizado) {
          setNombre(
            actualizado.nombre
          );

          setLogoUrl(
            actualizado.logoUrl
          );
        }

        Alert.alert(
          "Guardado exitoso",
          "La personalización del laboratorio fue actualizada correctamente."
        );

      } catch (error: any) {
        console.error(
          "Error guardando personalización:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          Alert.alert(
            "Permiso denegado",
            "Firestore no permite modificar la personalización."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudo guardar la personalización."
          );
        }

      } finally {
        setGuardando(false);
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
          Cargando personalización...
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
          Personalización
        </Text>


        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.label
            }
          >
            Nombre del laboratorio
          </Text>

          <TextInput
            style={
              styles.input
            }
            value={
              nombre
            }
            onChangeText={
              setNombre
            }
          />


          <Text
            style={
              styles.label
            }
          >
            URL del logo
          </Text>

          <TextInput
            style={
              styles.input
            }
            value={
              logoUrl
            }
            onChangeText={(
              valor
            ) => {
              setLogoUrl(
                valor
              );

              setErrorLogo(
                false
              );
            }}
            autoCapitalize="none"
          />


          {logoUrl.trim() !== "" &&
          !errorLogo ? (
            <Image
              source={{
                uri:
                  logoUrl.trim(),
              }}
              style={
                styles.logo
              }
              resizeMode="contain"
              onError={() =>
                setErrorLogo(
                  true
                )
              }
            />

          ) : (
            <View
              style={
                styles.sinLogo
              }
            >
              <Text>
                {errorLogo
                  ? "No se pudo cargar el logo."
                  : "No hay logo configurado."}
              </Text>
            </View>
          )}


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
                : "Guardar cambios"}
            </Text>
          </Pressable>

        </View>

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
    },

    label: {
      fontWeight: "bold",
      marginBottom: 7,
    },

    input: {
      borderWidth: 1,
      borderColor: "#cccccc",
      padding: 14,
      borderRadius: 10,
      marginBottom: 15,
    },

    logo: {
      width: "100%",
      height: 180,
      marginBottom: 20,
    },

    sinLogo: {
      height: 100,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f1f5f9",
      marginBottom: 20,
      borderRadius: 10,
    },

    botonGuardar: {
      backgroundColor: "#222222",
      padding: 15,
      borderRadius: 10,
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

    deshabilitado: {
      opacity: 0.6,
    },
  });