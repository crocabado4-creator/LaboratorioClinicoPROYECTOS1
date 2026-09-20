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
  actualizarConfiguracionLaboratorio,
  obtenerLaboratorio,
} from "../services/configuracionLaboratorioService";


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


export default function ConfiguracionScreen() {
  const router = useRouter();

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [formulario, setFormulario] =
    useState<Formulario>(
      formularioInicial
    );

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [puedeEditar, setPuedeEditar] =
    useState(false);


  useEffect(() => {
    cargarDatos();
  }, []);


  const cargarDatos =
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

        const permisoEditar =
          permisos.includes(
            "configuracion.editar"
          );

        setPuedeEditar(
          permisoEditar
        );

        if (!permisoEditar) {
          Alert.alert(
            "Sin permiso",
            "No tiene permiso para editar la configuración."
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
            "El usuario no tiene laboratorio asignado."
          );

          return;
        }

        setLaboratorioId(
          idLaboratorio
        );

        const laboratorio =
          await obtenerLaboratorio(
            idLaboratorio
          );

        if (!laboratorio) {
          Alert.alert(
            "Error",
            "No se encontró el laboratorio."
          );

          return;
        }

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

      } catch (error) {
        console.error(
          "Error cargando configuración:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cargar la configuración."
        );

      } finally {
        setCargando(false);
      }
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


  const guardarCambios =
    async () => {
      if (!puedeEditar) {
        Alert.alert(
          "Sin permiso",
          "No puede modificar este laboratorio."
        );

        return;
      }

      if (!laboratorioId) {
        Alert.alert(
          "Error",
          "No existe un laboratorio asociado."
        );

        return;
      }

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

        await actualizarConfiguracionLaboratorio(
          laboratorioId,
          formulario
        );

        const actualizado =
          await obtenerLaboratorio(
            laboratorioId
          );

        if (actualizado) {
          setFormulario({
            nombre:
              actualizado.nombre,

            direccion:
              actualizado.direccion,

            telefono:
              actualizado.telefono,

            email:
              actualizado.email,
          });
        }

        Alert.alert(
          "Guardado exitoso",
          "La configuración del laboratorio fue actualizada correctamente."
        );

      } catch (error: any) {
        console.error(
          "Error guardando configuración:",
          error
        );

        if (
          error?.code ===
          "permission-denied"
        ) {
          Alert.alert(
            "Permiso denegado",
            "Firestore no permite actualizar la configuración."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudieron guardar los cambios."
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
          Cargando configuración...
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
          Configuración del laboratorio
        </Text>


        {!puedeEditar ? (
          <View
            style={
              styles.card
            }
          >
            <Text>
              No tiene permiso para editar.
            </Text>
          </View>

        ) : (
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
                guardarCambios
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
    },

    label: {
      fontWeight: "bold",
      marginBottom: 7,
    },

    input: {
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
      padding: 14,
      marginBottom: 15,
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