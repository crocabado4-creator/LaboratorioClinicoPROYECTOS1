import { useState } from "react";

import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { FirebaseError } from "firebase/app";

import { auth, db } from "../firebase/firebase";

interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  laboratorioId: string;
  activo: boolean;
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const iniciarSesion = async () => {
    if (
      email.trim() === "" ||
      password.trim() === ""
    ) {
      Alert.alert(
        "Atención",
        "Debe completar el correo y la contraseña."
      );

      return;
    }

    try {
      setCargando(true);

      // LOGIN FIREBASE
      const credencial =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const correoUsuario =
        credencial.user.email;

      if (!correoUsuario) {
        await signOut(auth);

        Alert.alert(
          "Error",
          "No se pudo obtener el correo del usuario."
        );

        return;
      }

      // BUSCAR USUARIO EN FIRESTORE
      const consulta = query(
        collection(db, "usuarios"),
        where(
          "email",
          "==",
          correoUsuario
        )
      );

      const resultado =
        await getDocs(consulta);

      if (resultado.empty) {
        await signOut(auth);

        Alert.alert(
          "Error",
          "El usuario no está registrado en el sistema."
        );

        return;
      }

      const documento =
        resultado.docs[0];

      const datos =
        documento.data();

      const datosUsuario: Usuario = {
        id: documento.id,
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        rol: datos.rol,
        laboratorioId:
          datos.laboratorioId,
        activo: datos.activo,
      };

      // VALIDAR ACTIVO
      if (
        datosUsuario.activo !== true
      ) {
        await signOut(auth);

        Alert.alert(
          "Acceso denegado",
          "El usuario se encuentra inactivo."
        );

        return;
      }

      // LOGIN CORRECTO
      setUsuario(datosUsuario);

    } catch (error: unknown) {
      console.log(
        "Error al iniciar sesión:",
        error
      );

      if (
        error instanceof FirebaseError
      ) {
        if (
          error.code ===
            "auth/invalid-credential" ||
          error.code ===
            "auth/user-not-found" ||
          error.code ===
            "auth/wrong-password"
        ) {
          Alert.alert(
            "Error",
            "Correo o contraseña incorrectos."
          );
        } else if (
          error.code ===
          "auth/invalid-email"
        ) {
          Alert.alert(
            "Error",
            "El correo electrónico no es válido."
          );
        } else if (
          error.code ===
          "auth/user-disabled"
        ) {
          Alert.alert(
            "Error",
            "La cuenta está deshabilitada."
          );
        } else if (
          error.code ===
          "auth/too-many-requests"
        ) {
          Alert.alert(
            "Error",
            "Demasiados intentos. Intente nuevamente más tarde."
          );
        } else if (
          error.code ===
          "permission-denied"
        ) {
          Alert.alert(
            "Error",
            "No tiene permisos para consultar sus datos."
          );
        } else {
          Alert.alert(
            "Error",
            error.code
          );
        }

      } else {
        Alert.alert(
          "Error",
          "Ocurrió un error inesperado."
        );
      }

    } finally {
      setCargando(false);
    }
  };

  const cerrarSesion = async () => {
    try {
      await signOut(auth);

      setUsuario(null);
      setEmail("");
      setPassword("");

    } catch (error) {
      console.log(
        "Error al cerrar sesión:",
        error
      );
    }
  };

  // ===============================
  // DASHBOARD
  // ===============================

  if (usuario) {
    return (
      <SafeAreaView
        style={styles.contenedor}
      >
        <View style={styles.tarjeta}>

          <Text style={styles.titulo}>
            Laboratorio Clínico
          </Text>

          <Text
            style={styles.subtitulo}
          >
            Dashboard
          </Text>

          <Text style={styles.texto}>
            Bienvenido
          </Text>

          <Text style={styles.nombre}>
            {usuario.nombre}{" "}
            {usuario.apellido}
          </Text>

          <View
            style={
              styles.informacion
            }
          >
            <Text
              style={styles.texto}
            >
              Correo:
            </Text>

            <Text
              style={
                styles.valor
              }
            >
              {usuario.email}
            </Text>

            <Text
              style={styles.texto}
            >
              Rol:
            </Text>

            <Text
              style={
                styles.valor
              }
            >
              {usuario.rol}
            </Text>

            <Text
              style={styles.texto}
            >
              Laboratorio:
            </Text>

            <Text
              style={
                styles.valor
              }
            >
              {
                usuario.laboratorioId
              }
            </Text>
          </View>

          <Pressable
            style={styles.boton}
            onPress={cerrarSesion}
          >
            <Text
              style={
                styles.textoBoton
              }
            >
              Cerrar sesión
            </Text>
          </Pressable>

        </View>
      </SafeAreaView>
    );
  }

  // ===============================
  // LOGIN
  // ===============================

  return (
    <SafeAreaView
      style={styles.contenedor}
    >
      <View style={styles.tarjeta}>

        <Text style={styles.titulo}>
          Laboratorio Clínico
        </Text>

        <Text
          style={styles.subtitulo}
        >
          Iniciar sesión
        </Text>

        <Text style={styles.label}>
          Correo electrónico
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ingrese su correo"
          placeholderTextColor="#777"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!cargando}
        />

        <Text style={styles.label}>
          Contraseña
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ingrese su contraseña"
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!cargando}
        />

        <Pressable
          style={[
            styles.boton,
            cargando &&
              styles.botonDeshabilitado,
          ]}
          onPress={iniciarSesion}
          disabled={cargando}
        >
          <Text
            style={styles.textoBoton}
          >
            {cargando
              ? "Ingresando..."
              : "Iniciar sesión"}
          </Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    contenedor: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: "#f2f6f9",
    },

    tarjeta: {
      width: "100%",
      maxWidth: 450,
      backgroundColor: "#ffffff",
      padding: 30,
      borderRadius: 12,
      elevation: 5,
    },

    titulo: {
      fontSize: 30,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 8,
      color: "#111111",
    },

    subtitulo: {
      fontSize: 21,
      textAlign: "center",
      marginBottom: 30,
      color: "#555555",
    },

    label: {
      fontSize: 15,
      fontWeight: "bold",
      marginBottom: 7,
      color: "#222222",
    },

    input: {
      width: "100%",
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 7,
      padding: 13,
      marginBottom: 20,
      fontSize: 16,
      color: "#111111",
      backgroundColor:
        "#ffffff",
    },

    boton: {
      width: "100%",
      backgroundColor:
        "#222222",
      padding: 14,
      borderRadius: 7,
      marginTop: 5,
    },

    botonDeshabilitado: {
      opacity: 0.6,
    },

    textoBoton: {
      color: "#ffffff",
      textAlign: "center",
      fontSize: 16,
      fontWeight: "bold",
    },

    texto: {
      fontSize: 15,
      color: "#666666",
      marginBottom: 4,
    },

    nombre: {
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 25,
      color: "#111111",
    },

    informacion: {
      marginBottom: 20,
    },

    valor: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#222222",
      marginBottom: 15,
    },
  });