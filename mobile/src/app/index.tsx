import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import {
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { obtenerPermisosRol } from "../services/rolesService";
import { cerrarSesionFirebase } from "../services/sessionService";

import {
  obtenerPersonalizacion,
  PERSONALIZACION_DEFAULT,
  type PersonalizacionLaboratorio,
} from "../services/personalizacionService";

type UsuarioSistema = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  laboratorioId: string;
  activo: boolean;
  requiereVerificacionEmail: boolean;
};

type ModuloProps = {
  icono: string;
  titulo: string;
  descripcion: string;
  fondo: string;
  color: string;
  onPress: () => void;
};

export default function Index() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [usuario, setUsuario] =
    useState<UsuarioSistema | null>(null);

  const [permisos, setPermisos] =
    useState<string[]>([]);

  const [laboratorio, setLaboratorio] =
    useState<PersonalizacionLaboratorio | null>(null);

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [
    mostrarCerrarSesion,
    setMostrarCerrarSesion,
  ] = useState(false);

  const limpiarSesionLocal = () => {
    setUsuario(null);
    setPermisos([]);
    setLaboratorio(null);
  };

  const cerrarSesionInterna = async () => {
    try {
      await cerrarSesionFirebase();
    } catch (error) {
      console.error(
        "Error cerrando sesión:",
        error
      );
    } finally {
      limpiarSesionLocal();
    }
  };

  const cargarUsuario = async (
    firebaseUser: User
  ) => {
    try {
      await reload(firebaseUser);

      const usuarioSnap =
        await getDoc(
          doc(
            db,
            "usuarios",
            firebaseUser.uid
          )
        );

      if (!usuarioSnap.exists()) {
        await cerrarSesionInterna();

        Alert.alert(
          "Cuenta no disponible",
          "No se encontró información de esta cuenta."
        );

        return;
      }

      const datos =
        usuarioSnap.data();

      if (datos.activo !== true) {
        await cerrarSesionInterna();

        Alert.alert(
          "Cuenta inactiva",
          "Tu cuenta se encuentra deshabilitada."
        );

        return;
      }

      const rol =
        typeof datos.rol === "string"
          ? datos.rol.trim()
          : "";

      if (!rol) {
        await cerrarSesionInterna();

        Alert.alert(
          "Cuenta sin rol",
          "La cuenta no tiene un rol asignado."
        );

        return;
      }

      const requiereVerificacion =
        datos.requiereVerificacionEmail ===
        true;

      if (
        requiereVerificacion &&
        !firebaseUser.emailVerified
      ) {
        await cerrarSesionInterna();

        Alert.alert(
          "Correo pendiente",
          "Debes verificar tu correo antes de ingresar."
        );

        return;
      }

      const usuarioSistema:
        UsuarioSistema = {
        id:
          usuarioSnap.id,

        nombre:
          typeof datos.nombre ===
          "string"
            ? datos.nombre.trim()
            : "",

        apellido:
          typeof datos.apellido ===
          "string"
            ? datos.apellido.trim()
            : "",

        email:
          typeof datos.email ===
          "string"
            ? datos.email.trim()
            : firebaseUser.email || "",

        rol,

        laboratorioId:
          typeof datos.laboratorioId ===
          "string"
            ? datos.laboratorioId.trim()
            : "",

        activo:
          true,

        requiereVerificacionEmail:
          requiereVerificacion,
      };

      const permisosRol =
        await obtenerPermisosRol(
          rol
        );

      setUsuario(
        usuarioSistema
      );

      setPermisos(
        Array.isArray(
          permisosRol
        )
          ? permisosRol
          : []
      );

      if (
        usuarioSistema.laboratorioId
      ) {
        try {
          const identidad =
            await obtenerPersonalizacion(
              usuarioSistema.laboratorioId
            );

          setLaboratorio(
            identidad
          );

        } catch (error) {
          console.error(
            "No se pudo cargar la identidad:",
            error
          );

          setLaboratorio(
            null
          );
        }

      } else {
        setLaboratorio(
          null
        );
      }

    } catch (error) {
      console.error(
        "Error cargando usuario:",
        error
      );

      await cerrarSesionInterna();

      Alert.alert(
        "Error",
        "No se pudo cargar la información de tu cuenta."
      );
    }
  };

  useEffect(() => {
    const cancelar =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          try {
            setCargando(
              true
            );

            if (
              !firebaseUser
            ) {
              limpiarSesionLocal();
              return;
            }

            await cargarUsuario(
              firebaseUser
            );

          } finally {
            setCargando(
              false
            );
          }
        }
      );

    return cancelar;
  }, []);

  const iniciarSesion =
    async () => {
      const correo =
        email
          .trim()
          .toLowerCase();

      if (
        !correo ||
        !password
      ) {
        Alert.alert(
          "Campos incompletos",
          "Ingresa tu correo y contraseña."
        );

        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          correo
        )
      ) {
        Alert.alert(
          "Correo inválido",
          "Ingresa un correo válido."
        );

        return;
      }

      try {
        setProcesando(
          true
        );

        await signInWithEmailAndPassword(
          auth,
          correo,
          password
        );

        setPassword("");

      } catch (
        error: unknown
      ) {
        let codigo =
          "";

        if (
          typeof error ===
            "object" &&
          error !== null &&
          "code" in error
        ) {
          codigo =
            String(
              (
                error as {
                  code?: string;
                }
              ).code ||
                ""
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
            "Acceso rechazado",
            "El correo o la contraseña son incorrectos."
          );

        } else if (
          codigo ===
          "auth/invalid-email"
        ) {
          Alert.alert(
            "Correo inválido",
            "El correo electrónico no es válido."
          );

        } else if (
          codigo ===
          "auth/user-disabled"
        ) {
          Alert.alert(
            "Cuenta deshabilitada",
            "Esta cuenta no se encuentra disponible."
          );

        } else if (
          codigo ===
          "auth/too-many-requests"
        ) {
          Alert.alert(
            "Acceso temporalmente bloqueado",
            "Se realizaron demasiados intentos incorrectos. Intenta nuevamente más tarde."
          );

        } else if (
          codigo ===
          "auth/network-request-failed"
        ) {
          Alert.alert(
            "Sin conexión",
            "Revisa tu conexión a Internet."
          );

        } else {
          console.error(
            "Error de inicio de sesión:",
            error
          );

          Alert.alert(
            "Error",
            "No se pudo iniciar sesión."
          );
        }

      } finally {
        setProcesando(
          false
        );
      }
    };

  const ejecutarCerrarSesion =
    async () => {
      if (
        procesando
      ) {
        return;
      }

      try {
        setProcesando(
          true
        );

        setMostrarCerrarSesion(
          false
        );

        await cerrarSesionFirebase();

        limpiarSesionLocal();

        setEmail("");
        setPassword("");
        setMostrarPassword(
          false
        );

        router.replace(
          "/"
        );

      } catch (error) {
        console.error(
          "Error cerrando sesión:",
          error
        );

        Alert.alert(
          "Error",
          "No se pudo cerrar la sesión."
        );

      } finally {
        setProcesando(
          false
        );
      }
    };

  const tienePermiso = (
    permiso: string
  ): boolean => {
    return permisos.includes(
      permiso
    );
  };

  const tieneAlgunPermiso = (
    lista: string[]
  ): boolean => {
    return lista.some(
      (
        permiso
      ) =>
        permisos.includes(
          permiso
        )
    );
  };

  const moduloNoDisponible = (
    nombre: string
  ) => {
    Alert.alert(
      nombre,
      "Este módulo todavía no está disponible."
    );
  };

  const colorPrimario =
    laboratorio?.colorPrimario ||
    PERSONALIZACION_DEFAULT.colorPrimario;

  const colorSecundario =
    laboratorio?.colorSecundario ||
    PERSONALIZACION_DEFAULT.colorSecundario;

  const nombreLaboratorio =
    laboratorio?.nombreVisible ||
    laboratorio?.nombre ||
    "Laboratorio Clínico";

  if (
    cargando
  ) {
    return (
      <SafeAreaView
        style={
          styles.loadingPage
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
        />

        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Laboratorio Clínico
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Preparando tu espacio de trabajo...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    !usuario
  ) {
    return (
      <SafeAreaView
        style={
          styles.loginPage
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
        />

        <KeyboardAvoidingView
          style={{
            flex: 1,
          }}
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.loginScroll
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
          >
            <View
              style={
                styles.loginBrand
              }
            >
              <View
                style={
                  styles.brandIcon
                }
              >
                <Text
                  style={
                    styles.brandEmoji
                  }
                >
                  🧪
                </Text>
              </View>

              <Text
                style={
                  styles.brandTitle
                }
              >
                Laboratorio Clínico
              </Text>

              <Text
                style={
                  styles.brandSubtitle
                }
              >
                Gestión segura de tu laboratorio
              </Text>
            </View>

            <View
              style={
                styles.loginCard
              }
            >
              <Text
                style={
                  styles.loginTitle
                }
              >
                Bienvenido
              </Text>

              <Text
                style={
                  styles.loginDescription
                }
              >
                Ingresa con las credenciales de tu cuenta.
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
                value={
                  email
                }
                onChangeText={
                  setEmail
                }
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={
                  false
                }
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

              <View
                style={
                  styles.passwordRow
                }
              >
                <TextInput
                  style={
                    styles.passwordInput
                  }
                  value={
                    password
                  }
                  onChangeText={
                    setPassword
                  }
                  secureTextEntry={
                    !mostrarPassword
                  }
                  placeholder="Contraseña"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  editable={
                    !procesando
                  }
                  onSubmitEditing={
                    iniciarSesion
                  }
                />

                <Pressable
                  onPress={() =>
                    setMostrarPassword(
                      !mostrarPassword
                    )
                  }
                  disabled={
                    procesando
                  }
                >
                  <Text
                    style={
                      styles.showText
                    }
                  >
                    {mostrarPassword
                      ? "Ocultar"
                      : "Ver"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.loginButton,

                  procesando &&
                    styles.buttonDisabled,
                ]}
                onPress={
                  iniciarSesion
                }
                disabled={
                  procesando
                }
              >
                {procesando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.loginButtonText
                    }
                  >
                    Iniciar sesión
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.dashboardPage
      }
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={
          colorPrimario
        }
      />

      <ScrollView
        contentContainerStyle={
          styles.dashboardScroll
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={[
            styles.hero,

            {
              backgroundColor:
                colorPrimario,
            },
          ]}
        >
          <View
            style={[
              styles.heroDecoration,

              {
                backgroundColor:
                  colorSecundario,
              },
            ]}
          />

          <View
            style={
              styles.heroContent
            }
          >
            <View
              style={
                styles.heroLogo
              }
            >
              {laboratorio?.logoUrl ? (
                <Image
                  source={{
                    uri:
                      laboratorio.logoUrl,
                  }}
                  style={
                    styles.heroLogoImage
                  }
                  resizeMode="contain"
                />
              ) : (
                <Text
                  style={
                    styles.heroEmoji
                  }
                >
                  🧪
                </Text>
              )}
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.heroSmall
                }
              >
                {nombreLaboratorio}
              </Text>

              <Text
                style={
                  styles.heroTitle
                }
              >
                Hola,{" "}
                {usuario.nombre ||
                  "Usuario"}
              </Text>

              <Text
                style={
                  styles.heroSubtitle
                }
              >
                {nombreRol(
                  usuario.rol
                )}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={
            styles.profileCard
          }
        >
          <View
            style={[
              styles.profileAvatar,

              {
                backgroundColor:
                  `${colorPrimario}18`,
              },
            ]}
          >
            <Text
              style={[
                styles.profileLetter,

                {
                  color:
                    colorPrimario,
                },
              ]}
            >
              {(
                usuario.nombre ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.profileName
              }
            >
              {usuario.nombre}{" "}
              {usuario.apellido}
            </Text>

            <Text
              style={
                styles.profileEmail
              }
            >
              {usuario.email}
            </Text>

            <Text
              style={[
                styles.profileRole,

                {
                  color:
                    colorPrimario,
                },
              ]}
            >
              {nombreRol(
                usuario.rol
              )}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={[
              styles.sectionEyebrow,

              {
                color:
                  colorPrimario,
              },
            ]}
          >
            ÁREA DE TRABAJO
          </Text>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Módulos disponibles
          </Text>

          <Text
            style={
              styles.sectionDescription
            }
          >
            Accede a las funciones autorizadas para tu cuenta.
          </Text>
        </View>

        <View
          style={
            styles.modules
          }
        >
          {usuario.rol ===
            "super_admin" &&
            tieneAlgunPermiso([
              "laboratorios.crear",
              "laboratorios.ver",
              "laboratorios.editar",
              "laboratorios.desactivar",
            ]) && (
              <Modulo
                icono="🏥"
                titulo="Laboratorios"
                descripcion="Administra los laboratorios registrados."
                color="#1D4ED8"
                fondo="#DBEAFE"
                onPress={() =>
                  router.push(
                    "/laboratorios"
                  )
                }
              />
            )}

          {usuario.rol ===
            "super_admin" &&
            tienePermiso(
              "laboratorios.editar"
            ) && (
              <Modulo
                icono="🎨"
                titulo="Personalización"
                descripcion="Configura la identidad visual de cada laboratorio."
                color="#6D28D9"
                fondo="#EDE9FE"
                onPress={() =>
                  router.push(
                    "/personalizacion"
                  )
                }
              />
            )}

          {usuario.rol ===
            "super_admin" &&
            tieneAlgunPermiso([
              "administradores.crear",
              "administradores.ver",
              "administradores.editar",
              "administradores.desactivar",
            ]) && (
              <Modulo
                icono="👤"
                titulo="Administradores"
                descripcion="Gestiona responsables de laboratorio."
                color="#7E22CE"
                fondo="#F3E8FF"
                onPress={() =>
                  router.push(
                    "/administradores"
                  )
                }
              />
            )}

          {usuario.rol ===
            "super_admin" &&
            tienePermiso(
              "roles.ver"
            ) && (
              <Modulo
                icono="🛡️"
                titulo="Roles"
                descripcion="Consulta los roles y permisos del sistema."
                color="#4338CA"
                fondo="#E0E7FF"
                onPress={() =>
                  router.push(
                    "/roles"
                  )
                }
              />
            )}

          {usuario.rol ===
            "administrador" &&
            tienePermiso(
              "configuracion.editar"
            ) && (
              <Modulo
                icono="⚙️"
                titulo="Configuración"
                descripcion="Actualiza los datos generales de tu laboratorio."
                color="#0369A1"
                fondo="#E0F2FE"
                onPress={() =>
                  router.push(
                    "/configuracion"
                  )
                }
              />
            )}

          {usuario.rol ===
            "administrador" &&
            tienePermiso(
              "roles.asignar"
            ) && (
              <Modulo
                icono="🛡️"
                titulo="Roles y permisos"
                descripcion="Gestiona los roles del personal."
                color="#4338CA"
                fondo="#E0E7FF"
                onPress={() =>
                  router.push(
                    "/roles"
                  )
                }
              />
            )}

          {usuario.rol ===
            "administrador" &&
            tieneAlgunPermiso([
              "empleados.crear",
              "empleados.ver",
              "empleados.editar",
              "empleados.desactivar",
            ]) && (
              <Modulo
                icono="👥"
                titulo="Personal"
                descripcion="Administra Recepcionistas y Bioquímicos."
                color="#0F766E"
                fondo="#CCFBF1"
                onPress={() =>
                  router.push(
                    "/personal"
                  )
                }
              />
            )}

          {tieneAlgunPermiso([
            "pacientes.crear",
            "pacientes.editar",
            "pacientes.ver",
          ]) && (
            <Modulo
              icono="🧑‍⚕️"
              titulo="Pacientes"
              descripcion="Registra, consulta y administra pacientes del laboratorio."
              color="#15803D"
              fondo="#DCFCE7"
              onPress={() =>
                router.push(
                  "/pacientes"
                )
              }
            />
          )}

          {tieneAlgunPermiso([
            "analisis.crear",
            "analisis.editar",
            "analisis.ver",
          ]) && (
            <Modulo
              icono="🔬"
              titulo="Análisis clínicos"
              descripcion="Gestiona los análisis disponibles."
              color="#0E7490"
              fondo="#CFFAFE"
              onPress={() =>
                moduloNoDisponible(
                  "Análisis clínicos"
                )
              }
            />
          )}

          {tienePermiso(
            "ventas.ver"
          ) && (
            <Modulo
              icono="💳"
              titulo="Ventas"
              descripcion="Consulta operaciones registradas."
              color="#A16207"
              fondo="#FEF3C7"
              onPress={() =>
                moduloNoDisponible(
                  "Ventas"
                )
              }
            />
          )}

          {tienePermiso(
            "resultados.ver"
          ) && (
            <Modulo
              icono="📋"
              titulo="Resultados"
              descripcion="Consulta resultados clínicos."
              color="#1D4ED8"
              fondo="#DBEAFE"
              onPress={() =>
                moduloNoDisponible(
                  "Resultados"
                )
              }
            />
          )}

          {tienePermiso(
            "reportes.ver"
          ) && (
            <Modulo
              icono="📊"
              titulo="Reportes"
              descripcion="Consulta reportes del laboratorio."
              color="#7C3AED"
              fondo="#EDE9FE"
              onPress={() =>
                moduloNoDisponible(
                  "Reportes"
                )
              }
            />
          )}

          {tienePermiso(
            "auditoria.ver_global"
          ) && (
            <Modulo
              icono="📜"
              titulo="Auditoría global"
              descripcion="Consulta operaciones importantes del sistema."
              color="#475569"
              fondo="#E2E8F0"
              onPress={() =>
                moduloNoDisponible(
                  "Auditoría global"
                )
              }
            />
          )}
        </View>

        <View
          style={
            styles.sessionCard
          }
        >
          <View>
            <Text
              style={
                styles.sessionTitle
              }
            >
              ● Sesión activa
            </Text>

            <Text
              style={
                styles.sessionEmail
              }
            >
              {usuario.email}
            </Text>
          </View>

          <Pressable
            style={[
              styles.logoutButton,

              procesando &&
                styles.buttonDisabled,
            ]}
            onPress={() =>
              setMostrarCerrarSesion(
                true
              )
            }
            disabled={
              procesando
            }
          >
            <Text
              style={
                styles.logoutText
              }
            >
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={
          mostrarCerrarSesion
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarCerrarSesion(
            false
          )
        }
      >
        <View
          style={
            styles.logoutOverlay
          }
        >
          <View
            style={
              styles.logoutModal
            }
          >
            <View
              style={
                styles.logoutIcon
              }
            >
              <Text
                style={{
                  fontSize: 25,
                }}
              >
                ↪
              </Text>
            </View>

            <Text
              style={
                styles.logoutTitle
              }
            >
              Cerrar sesión
            </Text>

            <Text
              style={
                styles.logoutDescription
              }
            >
              ¿Deseas cerrar tu sesión actual?
            </Text>

            <View
              style={
                styles.logoutActions
              }
            >
              <Pressable
                style={
                  styles.cancelLogout
                }
                onPress={() =>
                  setMostrarCerrarSesion(
                    false
                  )
                }
                disabled={
                  procesando
                }
              >
                <Text
                  style={
                    styles.cancelLogoutText
                  }
                >
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmLogout,

                  procesando &&
                    styles.buttonDisabled,
                ]}
                onPress={
                  ejecutarCerrarSesion
                }
                disabled={
                  procesando
                }
              >
                {procesando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                    size="small"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmLogoutText
                    }
                  >
                    Cerrar sesión
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Modulo({
  icono,
  titulo,
  descripcion,
  fondo,
  color,
  onPress,
}: ModuloProps) {
  return (
    <Pressable
      style={({
        pressed,
      }) => [
        styles.module,

        pressed && {
          opacity: 0.7,
        },
      ]}
      onPress={
        onPress
      }
    >
      <View
        style={[
          styles.moduleIcon,

          {
            backgroundColor:
              fondo,
          },
        ]}
      >
        <Text
          style={
            styles.moduleEmoji
          }
        >
          {icono}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={
            styles.moduleTitle
          }
        >
          {titulo}
        </Text>

        <Text
          style={
            styles.moduleDescription
          }
        >
          {descripcion}
        </Text>
      </View>

      <Text
        style={[
          styles.moduleArrow,

          {
            color,
          },
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}

function nombreRol(
  rol: string
): string {
  switch (
    rol
  ) {
    case "super_admin":
      return "Super Administrador";

    case "administrador":
      return "Administrador";

    case "recepcionista":
      return "Recepcionista";

    case "bioquimico":
      return "Bioquímico";

    case "paciente":
      return "Paciente";

    default:
      return rol ||
        "Sin rol";
  }
}

const styles =
  StyleSheet.create({
    loadingPage: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F8FAFC",
    },

    loadingTitle: {
      marginTop: 15,
      color:
        "#0F172A",
      fontSize: 20,
      fontWeight:
        "900",
    },

    loadingText: {
      marginTop: 5,
      color:
        "#64748B",
      fontSize: 10,
    },

    loginPage: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    loginScroll: {
      flexGrow: 1,
      justifyContent:
        "center",
      padding: 22,
    },

    loginBrand: {
      alignItems:
        "center",
      marginBottom: 26,
    },

    brandIcon: {
      width: 78,
      height: 78,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom: 14,
      borderRadius: 24,
      backgroundColor:
        "#DBEAFE",
    },

    brandEmoji: {
      fontSize: 37,
    },

    brandTitle: {
      color:
        "#0F172A",
      fontSize: 28,
      fontWeight:
        "900",
    },

    brandSubtitle: {
      marginTop: 5,
      color:
        "#64748B",
      fontSize: 11,
    },

    loginCard: {
      width:
        "100%",
      maxWidth: 500,
      alignSelf:
        "center",
      padding: 22,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 20,
      backgroundColor:
        "#FFFFFF",
    },

    loginTitle: {
      color:
        "#0F172A",
      fontSize: 23,
      fontWeight:
        "900",
    },

    loginDescription: {
      marginTop: 5,
      marginBottom: 21,
      color:
        "#64748B",
      fontSize: 11,
    },

    label: {
      marginTop: 12,
      marginBottom: 6,
      color:
        "#334155",
      fontSize: 10,
      fontWeight:
        "800",
    },

    input: {
      minHeight: 51,
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 11,
      color:
        "#0F172A",
    },

    passwordRow: {
      minHeight: 51,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 11,
    },

    passwordInput: {
      flex: 1,
      color:
        "#0F172A",
    },

    showText: {
      color:
        "#2563EB",
      fontSize: 9,
      fontWeight:
        "900",
    },

    loginButton: {
      minHeight: 51,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 20,
      borderRadius: 11,
      backgroundColor:
        "#2563EB",
    },

    loginButtonText: {
      color:
        "#FFFFFF",
      fontSize: 11,
      fontWeight:
        "900",
    },

    buttonDisabled: {
      opacity: 0.55,
    },

    dashboardPage: {
      flex: 1,
      backgroundColor:
        "#F1F5F9",
    },

    dashboardScroll: {
      paddingBottom: 40,
    },

    hero: {
      position:
        "relative",
      overflow:
        "hidden",
      minHeight: 205,
      justifyContent:
        "flex-end",
      padding: 22,
      paddingBottom: 30,
    },

    heroDecoration: {
      position:
        "absolute",
      width: 210,
      height: 210,
      right: -70,
      top: -90,
      borderRadius: 105,
      opacity: 0.45,
    },

    heroContent: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    heroLogo: {
      width: 68,
      height: 68,
      alignItems:
        "center",
      justifyContent:
        "center",
      overflow:
        "hidden",
      marginRight: 14,
      borderRadius: 20,
      backgroundColor:
        "rgba(255,255,255,.92)",
    },

    heroLogoImage: {
      width: 60,
      height: 60,
    },

    heroEmoji: {
      fontSize: 32,
    },

    heroSmall: {
      marginBottom: 4,
      color:
        "rgba(255,255,255,.78)",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing: 0.5,
    },

    heroTitle: {
      color:
        "#FFFFFF",
      fontSize: 26,
      fontWeight:
        "900",
    },

    heroSubtitle: {
      marginTop: 4,
      color:
        "rgba(255,255,255,.82)",
      fontSize: 10,
    },

    profileCard: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginHorizontal: 16,
      marginTop: -15,
      padding: 16,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
    },

    profileAvatar: {
      width: 53,
      height: 53,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 12,
      borderRadius: 15,
    },

    profileLetter: {
      fontSize: 20,
      fontWeight:
        "900",
    },

    profileName: {
      color:
        "#0F172A",
      fontSize: 14,
      fontWeight:
        "900",
    },

    profileEmail: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 9,
    },

    profileRole: {
      marginTop: 6,
      fontSize: 9,
      fontWeight:
        "900",
    },

    sectionHeader: {
      marginHorizontal: 18,
      marginTop: 27,
      marginBottom: 13,
    },

    sectionEyebrow: {
      fontSize: 8,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    sectionTitle: {
      marginTop: 4,
      color:
        "#0F172A",
      fontSize: 20,
      fontWeight:
        "900",
    },

    sectionDescription: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 9,
    },

    modules: {
      paddingHorizontal: 16,
    },

    module: {
      minHeight: 86,
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 9,
      padding: 13,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
    },

    moduleIcon: {
      width: 51,
      height: 51,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 11,
      borderRadius: 14,
    },

    moduleEmoji: {
      fontSize: 22,
    },

    moduleTitle: {
      color:
        "#0F172A",
      fontSize: 12,
      fontWeight:
        "900",
    },

    moduleDescription: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 8,
      lineHeight: 12,
    },

    moduleArrow: {
      fontSize: 27,
    },

    sessionCard: {
      margin: 16,
      marginTop: 25,
      padding: 16,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
    },

    sessionTitle: {
      color:
        "#15803D",
      fontSize: 10,
      fontWeight:
        "900",
    },

    sessionEmail: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 8,
    },

    logoutButton: {
      minHeight: 44,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 13,
      borderRadius: 10,
      backgroundColor:
        "#FFF1F2",
    },

    logoutText: {
      color:
        "#DC2626",
      fontSize: 9,
      fontWeight:
        "900",
    },

    logoutOverlay: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 20,
      backgroundColor:
        "rgba(15,23,42,.7)",
    },

    logoutModal: {
      width:
        "100%",
      maxWidth: 420,
      padding: 22,
      borderRadius: 20,
      backgroundColor:
        "#FFFFFF",
    },

    logoutIcon: {
      width: 60,
      height: 60,
      alignSelf:
        "center",
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 18,
      backgroundColor:
        "#FEE2E2",
    },

    logoutTitle: {
      marginTop: 13,
      color:
        "#0F172A",
      fontSize: 19,
      fontWeight:
        "900",
      textAlign:
        "center",
    },

    logoutDescription: {
      marginTop: 5,
      color:
        "#64748B",
      fontSize: 9,
      textAlign:
        "center",
    },

    logoutActions: {
      flexDirection:
        "row",
      marginTop: 20,
    },

    cancelLogout: {
      minHeight: 45,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 8,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
    },

    cancelLogoutText: {
      color:
        "#475569",
      fontSize: 9,
      fontWeight:
        "900",
    },

    confirmLogout: {
      minHeight: 45,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
      backgroundColor:
        "#DC2626",
    },

    confirmLogoutText: {
      color:
        "#FFFFFF",
      fontSize: 9,
      fontWeight:
        "900",
    },
  });