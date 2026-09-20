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
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

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


// ======================================================
// TIPO DE USUARIO
// ======================================================

type UsuarioSistema = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  laboratorioId: string;
  activo: boolean;
};


// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function Index() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [usuario, setUsuario] =
    useState<UsuarioSistema | null>(
      null
    );

  const [permisos, setPermisos] =
    useState<string[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [procesando, setProcesando] =
    useState(false);


  // ====================================================
  // CARGAR USUARIO
  // ====================================================

  const cargarUsuario = async (
    firebaseUser: User
  ) => {
    try {
      const usuarioRef = doc(
        db,
        "usuarios",
        firebaseUser.uid
      );

      const usuarioSnap =
        await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        setUsuario(null);
        setPermisos([]);

        await signOut(auth);

        Alert.alert(
          "Error",
          "El usuario no existe en Firestore."
        );

        return;
      }

      const datos =
        usuarioSnap.data();

      if (datos.activo !== true) {
        setUsuario(null);
        setPermisos([]);

        await signOut(auth);

        Alert.alert(
          "Acceso denegado",
          "El usuario está inactivo."
        );

        return;
      }

      const usuarioSistema: UsuarioSistema = {
        id: usuarioSnap.id,

        nombre:
          typeof datos.nombre === "string"
            ? datos.nombre
            : "",

        apellido:
          typeof datos.apellido === "string"
            ? datos.apellido
            : "",

        email:
          typeof datos.email === "string"
            ? datos.email
            : firebaseUser.email ?? "",

        rol:
          typeof datos.rol === "string"
            ? datos.rol
            : "",

        laboratorioId:
          typeof datos.laboratorioId === "string"
            ? datos.laboratorioId
            : "",

        activo:
          datos.activo === true,
      };

      if (
        usuarioSistema.rol.trim() === ""
      ) {
        setUsuario(null);
        setPermisos([]);

        await signOut(auth);

        Alert.alert(
          "Error",
          "El usuario no tiene un rol asignado."
        );

        return;
      }

      const permisosRol =
        await obtenerPermisosRol(
          usuarioSistema.rol
        );

      setUsuario(
        usuarioSistema
      );

      setPermisos(
        permisosRol
      );

    } catch (error) {
      console.error(
        "Error cargando usuario:",
        error
      );

      setUsuario(null);
      setPermisos([]);

      try {
        await signOut(auth);
      } catch (errorLogout) {
        console.error(
          "Error cerrando sesión:",
          errorLogout
        );
      }

      Alert.alert(
        "Error",
        "No se pudo cargar la información del usuario."
      );
    }
  };


  // ====================================================
  // CONTROL DE SESIÓN
  // ====================================================

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          try {
            setCargando(true);

            if (!firebaseUser) {
              setUsuario(null);
              setPermisos([]);
              return;
            }

            await cargarUsuario(
              firebaseUser
            );

          } catch (error) {
            console.error(
              "Error verificando sesión:",
              error
            );

            setUsuario(null);
            setPermisos([]);

          } finally {
            setCargando(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);


  // ====================================================
  // INICIAR SESIÓN
  // ====================================================

  const iniciarSesion =
    async () => {
      const correo =
        email
          .trim()
          .toLowerCase();

      if (
        correo === "" ||
        password.trim() === ""
      ) {
        Alert.alert(
          "Campos incompletos",
          "Ingrese correo y contraseña."
        );

        return;
      }

      try {
        setProcesando(true);

        await signInWithEmailAndPassword(
          auth,
          correo,
          password
        );

        setPassword("");

      } catch (error: unknown) {
        console.error(
          "Error al iniciar sesión:",
          error
        );

        let codigo = "";

        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error
        ) {
          codigo = String(
            (
              error as {
                code?: string;
              }
            ).code ?? ""
          );
        }

        if (
          codigo ===
            "auth/invalid-credential" ||
          codigo ===
            "auth/wrong-password" ||
          codigo ===
            "auth/user-not-found"
        ) {
          Alert.alert(
            "Credenciales incorrectas",
            "Correo o contraseña incorrectos."
          );

        } else if (
          codigo ===
          "auth/invalid-email"
        ) {
          Alert.alert(
            "Correo inválido",
            "Ingrese un correo válido."
          );

        } else if (
          codigo ===
          "auth/too-many-requests"
        ) {
          Alert.alert(
            "Demasiados intentos",
            "Intente nuevamente más tarde."
          );

        } else if (
          codigo ===
          "auth/network-request-failed"
        ) {
          Alert.alert(
            "Sin conexión",
            "Revise su conexión a Internet."
          );

        } else {
          Alert.alert(
            "Error",
            "No se pudo iniciar sesión."
          );
        }

      } finally {
        setProcesando(false);
      }
    };


  // ====================================================
  // CERRAR SESIÓN
  // ====================================================

  const cerrarSesion =
    async () => {
      try {
        setProcesando(true);

        await signOut(auth);

        setUsuario(null);
        setPermisos([]);

        setEmail("");
        setPassword("");

      } catch (error) {
        console.error(
          "Error al cerrar sesión:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cerrar sesión."
        );

      } finally {
        setProcesando(false);
      }
    };


  // ====================================================
  // PERMISOS
  // ====================================================

  const tienePermiso = (
    permiso: string
  ): boolean => {
    return permisos.includes(
      permiso
    );
  };


  const tieneAlgunPermiso = (
    permisosNecesarios: string[]
  ): boolean => {
    return permisosNecesarios.some(
      (permiso) =>
        permisos.includes(
          permiso
        )
    );
  };


  // ====================================================
  // MÓDULOS TODAVÍA PENDIENTES
  // ====================================================

  const abrirModulo = (
    modulo: string
  ) => {
    Alert.alert(
      modulo,
      "Este módulo todavía no está implementado en mobile."
    );
  };


  // ====================================================
  // NAVEGACIÓN
  // ====================================================

  const abrirLaboratorios =
    () => {
      router.push(
        "/laboratorios" as any
      );
    };


  const abrirAdministradores =
    () => {
      router.push(
        "/administradores" as any
      );
    };


  const abrirConfiguracion =
    () => {
      router.push(
        "/configuracion" as any
      );
    };


  const abrirPersonalizacion =
    () => {
      router.push(
        "/personalizacion" as any
      );
    };


  const abrirRoles =
    () => {
      router.push(
        "/roles" as any
      );
    };


  const abrirPersonal =
    () => {
      router.push(
        "/personal" as any
      );
    };


  // ====================================================
  // CARGANDO
  // ====================================================

  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.cargandoContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.cargandoTexto
          }
        >
          Cargando...
        </Text>
      </SafeAreaView>
    );
  }


  // ====================================================
  // LOGIN
  // ====================================================

  if (!usuario) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.titulo
            }
          >
            Laboratorio Clínico
          </Text>

          <Text
            style={
              styles.subtitulo
            }
          >
            Iniciar sesión
          </Text>

          <Text
            style={
              styles.label
            }
          >
            Correo electrónico
          </Text>

          <TextInput
            style={
              styles.input
            }
            placeholder="Ingrese su correo"
            placeholderTextColor="#888888"
            value={
              email
            }
            onChangeText={
              setEmail
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={
              !procesando
            }
          />

          <Text
            style={
              styles.label
            }
          >
            Contraseña
          </Text>

          <TextInput
            style={
              styles.input
            }
            placeholder="Ingrese su contraseña"
            placeholderTextColor="#888888"
            value={
              password
            }
            onChangeText={
              setPassword
            }
            secureTextEntry
            editable={
              !procesando
            }
            onSubmitEditing={
              iniciarSesion
            }
          />

          <Pressable
            style={[
              styles.botonPrincipal,

              procesando &&
                styles.botonDeshabilitado,
            ]}
            onPress={
              iniciarSesion
            }
            disabled={
              procesando
            }
          >
            <Text
              style={
                styles.textoBoton
              }
            >
              {procesando
                ? "Ingresando..."
                : "Iniciar sesión"}
            </Text>
          </Pressable>

        </View>
      </SafeAreaView>
    );
  }


  // ====================================================
  // DASHBOARD
  // ====================================================

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContenido
        }
        keyboardShouldPersistTaps="handled"
      >

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.titulo
            }
          >
            Laboratorio Clínico
          </Text>

          <Text
            style={
              styles.subtitulo
            }
          >
            Dashboard
          </Text>


          {/* INFORMACIÓN */}

          <Text
            style={
              styles.labelInfo
            }
          >
            Bienvenido
          </Text>

          <Text
            style={
              styles.valorPrincipal
            }
          >
            {usuario.nombre}{" "}
            {usuario.apellido}
          </Text>

          <Text
            style={
              styles.labelInfo
            }
          >
            Correo:
          </Text>

          <Text
            style={
              styles.valorInfo
            }
          >
            {usuario.email}
          </Text>

          <Text
            style={
              styles.labelInfo
            }
          >
            Rol:
          </Text>

          <Text
            style={
              styles.valorInfo
            }
          >
            {usuario.rol}
          </Text>

          {usuario.laboratorioId !==
            "" && (
            <>
              <Text
                style={
                  styles.labelInfo
                }
              >
                Laboratorio:
              </Text>

              <Text
                style={
                  styles.valorInfo
                }
              >
                {
                  usuario.laboratorioId
                }
              </Text>
            </>
          )}


          {/* MÓDULOS */}

          <Text
            style={
              styles.tituloModulos
            }
          >
            Módulos disponibles
          </Text>


          {/* HU-04 */}

          {tieneAlgunPermiso([
            "laboratorios.crear",
            "laboratorios.ver",
            "laboratorios.editar",
            "laboratorios.desactivar",
          ]) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={
                abrirLaboratorios
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Gestión de laboratorios
              </Text>
            </Pressable>
          )}


          {/* HU-07 */}

          {tieneAlgunPermiso([
            "administradores.crear",
            "administradores.ver",
            "administradores.editar",
            "administradores.desactivar",
          ]) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={
                abrirAdministradores
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Gestión de administradores
              </Text>
            </Pressable>
          )}


          {/* HU-05 */}

          {tienePermiso(
            "configuracion.editar"
          ) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={
                abrirConfiguracion
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Configuración del laboratorio
              </Text>
            </Pressable>
          )}


          {/* HU-06 */}

          {tienePermiso(
            "personalizacion.editar"
          ) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={
                abrirPersonalizacion
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Personalización
              </Text>
            </Pressable>
          )}


          {/* HU-02 ROLES */}

          {tienePermiso(
            "roles.asignar"
          ) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={
                abrirRoles
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Roles y permisos
              </Text>
            </Pressable>
          )}


          {/* HU-08 */}

          {tieneAlgunPermiso([
            "empleados.crear",
            "empleados.ver",
            "empleados.editar",
            "empleados.desactivar",
          ]) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={
                abrirPersonal
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Gestión de personal
              </Text>
            </Pressable>
          )}


          {/* PACIENTES */}

          {tieneAlgunPermiso([
            "pacientes.crear",
            "pacientes.editar",
            "pacientes.ver",
          ]) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={() =>
                abrirModulo(
                  "Gestión de pacientes"
                )
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Gestión de pacientes
              </Text>
            </Pressable>
          )}


          {/* ANÁLISIS */}

          {tieneAlgunPermiso([
            "analisis.crear",
            "analisis.editar",
            "analisis.ver",
          ]) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={() =>
                abrirModulo(
                  "Gestión de análisis"
                )
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Gestión de análisis
              </Text>
            </Pressable>
          )}


          {/* VENTAS */}

          {tienePermiso(
            "ventas.ver"
          ) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={() =>
                abrirModulo(
                  "Ventas"
                )
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Ventas
              </Text>
            </Pressable>
          )}


          {/* RESULTADOS */}

          {tienePermiso(
            "resultados.ver"
          ) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={() =>
                abrirModulo(
                  "Resultados"
                )
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Resultados
              </Text>
            </Pressable>
          )}


          {/* AUDITORÍA */}

          {tienePermiso(
            "auditoria.ver_global"
          ) && (
            <Pressable
              style={
                styles.botonModulo
              }
              onPress={() =>
                abrirModulo(
                  "Auditoría global"
                )
              }
            >
              <Text
                style={
                  styles.textoModulo
                }
              >
                Auditoría global
              </Text>
            </Pressable>
          )}


          {/* LOGOUT */}

          <Pressable
            style={[
              styles.botonCerrar,

              procesando &&
                styles.botonDeshabilitado,
            ]}
            onPress={
              cerrarSesion
            }
            disabled={
              procesando
            }
          >
            <Text
              style={
                styles.textoBoton
              }
            >
              {procesando
                ? "Cerrando..."
                : "Cerrar sesión"}
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      "#f1f5f9",
    padding: 20,
  },

  scrollContenido: {
    flexGrow: 1,
    justifyContent:
      "center",
    paddingVertical: 20,
  },

  card: {
    width: "100%",
    maxWidth: 700,
    alignSelf:
      "center",
    backgroundColor:
      "#ffffff",
    padding: 30,
    borderRadius: 18,
  },

  titulo: {
    fontSize: 36,
    fontWeight:
      "bold",
    textAlign:
      "center",
    marginBottom: 10,
    color:
      "#111111",
  },

  subtitulo: {
    fontSize: 28,
    textAlign:
      "center",
    color:
      "#555555",
    marginBottom: 35,
  },

  label: {
    fontSize: 18,
    fontWeight:
      "bold",
    marginBottom: 8,
    color:
      "#222222",
  },

  input: {
    borderWidth: 1,
    borderColor:
      "#cccccc",
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    marginBottom: 20,
    backgroundColor:
      "#ffffff",
    color:
      "#111111",
  },

  botonPrincipal: {
    backgroundColor:
      "#222222",
    padding: 17,
    borderRadius: 10,
    alignItems:
      "center",
    marginTop: 10,
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  textoBoton: {
    color:
      "#ffffff",
    fontSize: 18,
    fontWeight:
      "bold",
  },

  labelInfo: {
    fontSize: 18,
    color:
      "#666666",
    marginTop: 15,
  },

  valorPrincipal: {
    fontSize: 28,
    fontWeight:
      "bold",
    color:
      "#111111",
    marginTop: 5,
  },

  valorInfo: {
    fontSize: 20,
    fontWeight:
      "600",
    color:
      "#222222",
    marginTop: 4,
  },

  tituloModulos: {
    fontSize: 24,
    fontWeight:
      "bold",
    marginTop: 30,
    marginBottom: 15,
    color:
      "#111111",
  },

  botonModulo: {
    borderWidth: 1,
    borderColor:
      "#cccccc",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor:
      "#f8fafc",
  },

  textoModulo: {
    fontSize: 17,
    fontWeight:
      "600",
    color:
      "#222222",
    textAlign:
      "center",
  },

  botonCerrar: {
    backgroundColor:
      "#222222",
    padding: 17,
    borderRadius: 10,
    alignItems:
      "center",
    marginTop: 25,
  },

  cargandoContainer: {
    flex: 1,
    alignItems:
      "center",
    justifyContent:
      "center",
    backgroundColor:
      "#f1f5f9",
  },

  cargandoTexto: {
    marginTop: 10,
    fontSize: 16,
    color:
      "#222222",
  },
});