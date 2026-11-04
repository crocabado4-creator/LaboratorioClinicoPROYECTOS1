import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  signInWithEmailAndPassword,
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

import {
  cerrarSesionFirebase,
} from "../services/sessionService";

import {
  obtenerPersonalizacion,
  PERSONALIZACION_DEFAULT,
  type PersonalizacionLaboratorio,
} from "../services/personalizacionService";

// ======================================================
// TIPOS
// ======================================================

type RolUsuario =
  | "super_admin"
  | "administrador"
  | "recepcionista"
  | "bioquimico";

type UsuarioSistema = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
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

type ModuloSistema = {
  icono: string;
  titulo: string;
  descripcion: string;
  fondo: string;
  color: string;
  ruta: string;
};

// ======================================================
// FUNCIONES GENERALES
// ======================================================

function normalizarRol(valor: unknown): string {
  if (typeof valor !== "string") {
    return "";
  }

  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esRolValido(
  rol: string
): rol is RolUsuario {
  return [
    "super_admin",
    "administrador",
    "recepcionista",
    "bioquimico",
  ].includes(rol);
}

function nombreRol(rol: string): string {
  switch (rol) {
    case "super_admin":
      return "Super Administrador";

    case "administrador":
      return "Administrador del Laboratorio";

    case "recepcionista":
      return "Recepcionista";

    case "bioquimico":
      return "Bioquímico";

    default:
      return "Usuario";
  }
}

function mostrarMensaje(
  titulo: string,
  mensaje: string
) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }

    return;
  }

  Alert.alert(titulo, mensaje);
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

// ======================================================
// COMPONENTE DE MÓDULO
// ======================================================

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
      style={({ pressed }) => [
        styles.modulo,
        pressed && styles.moduloPresionado,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${titulo}`}
    >
      <View
        style={[
          styles.moduloIcono,
          { backgroundColor: fondo },
        ]}
      >
        <Text style={styles.moduloEmoji}>
          {icono}
        </Text>
      </View>

      <View style={styles.moduloContenido}>
        <Text style={styles.moduloTitulo}>
          {titulo}
        </Text>

        <Text style={styles.moduloDescripcion}>
          {descripcion}
        </Text>
      </View>

      <Text
        style={[
          styles.moduloFlecha,
          { color },
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function Index() {
  const router = useRouter();

  // ====================================================
  // ESTADOS DEL LOGIN
  // ====================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  // ====================================================
  // ESTADOS DEL USUARIO
  // ====================================================

  const [
    usuario,
    setUsuario,
  ] = useState<UsuarioSistema | null>(null);

  const [
    permisos,
    setPermisos,
  ] = useState<string[]>([]);

  const [
    laboratorio,
    setLaboratorio,
  ] = useState<PersonalizacionLaboratorio | null>(
    null
  );

  // ====================================================
  // ESTADOS GENERALES
  // ====================================================

  const [cargando, setCargando] = useState(true);

  const [
    procesando,
    setProcesando,
  ] = useState(false);

  const [
    mostrarCerrarSesion,
    setMostrarCerrarSesion,
  ] = useState(false);

  const [
    errorAcceso,
    setErrorAcceso,
  ] = useState("");

  const versionSesion = useRef(0);

  // ====================================================
  // LIMPIAR SESIÓN LOCAL
  // ====================================================

  const limpiarSesionLocal = useCallback(() => {
    setUsuario(null);
    setPermisos([]);
    setLaboratorio(null);
  }, []);

  // ====================================================
  // CERRAR SESIÓN INTERNA
  // ====================================================

  const cerrarSesionInterna = useCallback(
    async () => {
      versionSesion.current += 1;

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
    },
    [limpiarSesionLocal]
  );

  // ====================================================
  // CARGAR USUARIO AUTENTICADO
  // ====================================================

  const cargarUsuario = useCallback(
    async (
      firebaseUser: User,
      versionActual: number
    ) => {
      try {
        const usuarioRef = doc(
          db,
          "usuarios",
          firebaseUser.uid
        );

        const usuarioSnap = await getDoc(
          usuarioRef
        );

        if (
          versionActual !== versionSesion.current
        ) {
          return;
        }

        if (!usuarioSnap.exists()) {
          throw new Error(
            "No se encontró la cuenta en Firestore."
          );
        }

        const datos = usuarioSnap.data();

        if (datos.activo !== true) {
          throw new Error(
            "Tu cuenta se encuentra inactiva."
          );
        }

        const rol = normalizarRol(
          datos.rol
        );

        if (!esRolValido(rol)) {
          throw new Error(
            "El usuario no tiene un rol válido."
          );
        }

        const laboratorioId = String(
          datos.laboratorioId || ""
        ).trim();

        if (
          rol !== "super_admin" &&
          !laboratorioId
        ) {
          throw new Error(
            "El usuario no tiene un laboratorio asignado."
          );
        }

        // ==========================================
        // CONSTRUIR USUARIO
        // ==========================================

        const usuarioSistema: UsuarioSistema = {
          id: usuarioSnap.id,

          nombre: String(
            datos.nombre || ""
          ).trim(),

          apellido: String(
            datos.apellido || ""
          ).trim(),

          email: String(
            datos.email ||
            firebaseUser.email ||
            ""
          )
            .trim()
            .toLowerCase(),

          rol,

          laboratorioId,

          activo: true,

          requiereVerificacionEmail: false,
        };

        if (
          versionActual !== versionSesion.current
        ) {
          return;
        }

        setUsuario(usuarioSistema);
        setErrorAcceso("");

        // ==========================================
        // CARGAR PERMISOS
        // ==========================================

        try {
          const permisosRol =
            await obtenerPermisosRol(rol);

          if (
            versionActual !== versionSesion.current
          ) {
            return;
          }

          setPermisos(
            Array.isArray(permisosRol)
              ? permisosRol
              : []
          );
        } catch (error) {
          console.error(
            "Error consultando permisos:",
            error
          );

          if (
            versionActual === versionSesion.current
          ) {
            setPermisos([]);
          }
        }

        // ==========================================
        // CARGAR PERSONALIZACIÓN
        // ==========================================

        if (laboratorioId) {
          try {
            const identidad =
              await obtenerPersonalizacion(
                laboratorioId
              );

            if (
              versionActual !== versionSesion.current
            ) {
              return;
            }

            setLaboratorio(identidad);
          } catch (error) {
            console.error(
              "Error de personalización:",
              error
            );

            if (
              versionActual === versionSesion.current
            ) {
              setLaboratorio(null);
            }
          }
        } else {
          setLaboratorio(null);
        }

        console.log(
          "Acceso completado:",
          rol
        );
      } catch (error) {
        if (
          versionActual !== versionSesion.current
        ) {
          return;
        }

        console.error(
          "Error cargando usuario:",
          error
        );

        const mensaje = mensajeError(error);

        setErrorAcceso(mensaje);

        await cerrarSesionInterna();

        mostrarMensaje(
          "Error de acceso",
          mensaje
        );
      }
    },
    [cerrarSesionInterna]
  );

  // ====================================================
  // OBSERVAR AUTENTICACIÓN
  // ====================================================

  useEffect(() => {
    let componenteActivo = true;

    const cancelar = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        const versionActual =
          ++versionSesion.current;

        if (!componenteActivo) {
          return;
        }

        setCargando(true);

        try {
          if (!firebaseUser) {
            limpiarSesionLocal();
            return;
          }

          await cargarUsuario(
            firebaseUser,
            versionActual
          );
        } catch (error) {
          console.error(
            "Error observando autenticación:",
            error
          );
        } finally {
          if (
            componenteActivo &&
            versionActual ===
              versionSesion.current
          ) {
            setCargando(false);
          } else if (
            componenteActivo &&
            !auth.currentUser
          ) {
            setCargando(false);
          }
        }
      }
    );

    return () => {
      componenteActivo = false;
      versionSesion.current += 1;
      cancelar();
    };
  }, [
    cargarUsuario,
    limpiarSesionLocal,
  ]);

  // ====================================================
  // INICIAR SESIÓN
  // ====================================================

  const iniciarSesion = async () => {
    if (procesando) {
      return;
    }

    const correo = email
      .trim()
      .toLowerCase();

    if (!correo || !password) {
      mostrarMensaje(
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
      mostrarMensaje(
        "Correo inválido",
        "Ingresa un correo electrónico válido."
      );

      return;
    }

    try {
      setProcesando(true);
      setErrorAcceso("");

      await signInWithEmailAndPassword(
        auth,
        correo,
        password
      );

      setPassword("");
    } catch (error: unknown) {
      console.error(
        "Error iniciando sesión:",
        error
      );

      let codigo = "";

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error
      ) {
        codigo = String(
          (error as { code?: string }).code || ""
        );
      }

      let mensaje =
        "No se pudo iniciar sesión.";

      switch (codigo) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          mensaje =
            "El correo o la contraseña son incorrectos.";
          break;

        case "auth/invalid-email":
          mensaje =
            "El correo electrónico no es válido.";
          break;

        case "auth/user-disabled":
          mensaje =
            "Esta cuenta se encuentra deshabilitada.";
          break;

        case "auth/too-many-requests":
          mensaje =
            "Demasiados intentos. Intenta más tarde.";
          break;

        case "auth/network-request-failed":
          mensaje =
            "No se pudo conectar con Firebase. Revisa Internet.";
          break;

        default:
          mensaje = mensajeError(error);
      }

      setErrorAcceso(mensaje);

      mostrarMensaje(
        "Error de inicio de sesión",
        mensaje
      );
    } finally {
      setProcesando(false);
    }
  };

  // ====================================================
  // CERRAR SESIÓN
  // ====================================================

  const ejecutarCerrarSesion = async () => {
    if (procesando) {
      return;
    }

    try {
      setProcesando(true);

      setMostrarCerrarSesion(false);

      await cerrarSesionInterna();

      setEmail("");
      setPassword("");
      setMostrarPassword(false);
      setErrorAcceso("");

      router.replace("/");
    } catch (error) {
      console.error(
        "Error cerrando sesión:",
        error
      );

      mostrarMensaje(
        "Error",
        "No se pudo cerrar la sesión."
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
    return permisos.includes(permiso);
  };

  const tieneAlgunPermiso = (
    lista: string[]
  ): boolean => {
    return lista.some((permiso) =>
      permisos.includes(permiso)
    );
  };

  // ====================================================
  // NAVEGACIÓN
  // ====================================================

  const abrirModulo = (ruta: string) => {
    try {
      router.push(ruta as never);
    } catch (error) {
      console.error(
        "Error navegando:",
        error
      );

      mostrarMensaje(
        "Error",
        "No se pudo abrir el módulo."
      );
    }
  };

  // ====================================================
  // PERSONALIZACIÓN
  // ====================================================

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

  // ====================================================
  // OBTENER MÓDULOS DEL DASHBOARD
  // ====================================================

  const obtenerModulos = (): ModuloSistema[] => {
    if (!usuario) {
      return [];
    }

    const lista: ModuloSistema[] = [];

    const agregar = (
      modulo: ModuloSistema
    ) => {
      lista.push(modulo);
    };

    // ==================================================
    // SUPER ADMINISTRADOR
    // ==================================================

    if (usuario.rol === "super_admin") {
      if (
        tieneAlgunPermiso([
          "laboratorios.crear",
          "laboratorios.ver",
          "laboratorios.editar",
          "laboratorios.desactivar",
        ])
      ) {
        agregar({
          icono: "🏥",
          titulo: "Laboratorios",
          descripcion:
            "Administra los laboratorios registrados.",
          fondo: "#DBEAFE",
          color: "#1D4ED8",
          ruta: "/laboratorios",
        });
      }

      if (
        tienePermiso("laboratorios.editar")
      ) {
        agregar({
          icono: "🎨",
          titulo: "Personalización",
          descripcion:
            "Configura la identidad visual de los laboratorios.",
          fondo: "#EDE9FE",
          color: "#6D28D9",
          ruta: "/personalizacion",
        });
      }

      if (
        tieneAlgunPermiso([
          "administradores.crear",
          "administradores.ver",
          "administradores.editar",
          "administradores.desactivar",
        ])
      ) {
        agregar({
          icono: "👤",
          titulo: "Administradores",
          descripcion:
            "Gestiona responsables de laboratorio.",
          fondo: "#F3E8FF",
          color: "#7E22CE",
          ruta: "/administradores",
        });
      }

      if (tienePermiso("roles.ver")) {
        agregar({
          icono: "🛡️",
          titulo: "Roles",
          descripcion:
            "Consulta los roles y permisos del sistema.",
          fondo: "#E0E7FF",
          color: "#4338CA",
          ruta: "/roles",
        });
      }
    }

    // ==================================================
    // ADMINISTRADOR
    // ==================================================

    if (usuario.rol === "administrador") {
      if (
        tienePermiso("configuracion.editar")
      ) {
        agregar({
          icono: "⚙️",
          titulo: "Configuración",
          descripcion:
            "Actualiza los datos generales del laboratorio.",
          fondo: "#E0F2FE",
          color: "#0369A1",
          ruta: "/configuracion",
        });
      }

      if (
        tienePermiso("roles.asignar")
      ) {
        agregar({
          icono: "🛡️",
          titulo: "Roles y permisos",
          descripcion:
            "Gestiona los roles del personal.",
          fondo: "#E0E7FF",
          color: "#4338CA",
          ruta: "/roles",
        });
      }

      if (
        tieneAlgunPermiso([
          "empleados.crear",
          "empleados.ver",
          "empleados.editar",
          "empleados.desactivar",
        ])
      ) {
        agregar({
          icono: "👥",
          titulo: "Personal",
          descripcion:
            "Administra Recepcionistas y Bioquímicos.",
          fondo: "#CCFBF1",
          color: "#0F766E",
          ruta: "/personal",
        });
      }
    }

    // ==================================================
    // PACIENTES
    // ==================================================

    if (
      tieneAlgunPermiso([
        "pacientes.crear",
        "pacientes.editar",
        "pacientes.ver",
      ])
    ) {
      agregar({
        icono: "🧑‍⚕️",
        titulo: "Pacientes",
        descripcion:
          "Registra, consulta y administra pacientes.",
        fondo: "#DCFCE7",
        color: "#15803D",
        ruta: "/pacientes",
      });
    }

    // ==================================================
    // HISTORIAL DE PACIENTES
    // RECEPCIONISTA Y ADMINISTRADOR
    // ==================================================

    if (
      usuario.rol === "recepcionista" ||
      usuario.rol === "administrador"
    ) {
      agregar({
        icono: "📁",
        titulo: "Historial de pacientes",
        descripcion:
          "Consulta las atenciones, análisis, ventas, muestras y resultados de cada paciente. Genera su historial en PDF.",
        fondo: "#DBEAFE",
        color: "#1D4ED8",
        ruta: "/historial-paciente",
      });
    }

    // ==================================================
    // ANÁLISIS CLÍNICOS
    // ==================================================

    if (
      tieneAlgunPermiso([
        "analisis.crear",
        "analisis.editar",
        "analisis.ver",
      ])
    ) {
      agregar({
        icono: "🔬",
        titulo: "Análisis clínicos",
        descripcion:
          "Gestiona los análisis disponibles.",
        fondo: "#CFFAFE",
        color: "#0E7490",
        ruta: "/analisis",
      });
    }

    // ==================================================
    // SOLICITUDES
    // ==================================================

    if (
      (
        usuario.rol === "administrador" ||
        usuario.rol === "recepcionista"
      ) &&
      tieneAlgunPermiso([
        "solicitudes.ver",
        "solicitudes.crear",
      ])
    ) {
      agregar({
        icono: "📋",
        titulo: "Solicitudes de análisis",
        descripcion:
          "Registra solicitudes y consulta análisis.",
        fondo: "#E0F2FE",
        color: "#0369A1",
        ruta: "/solicitudes",
      });
    }

    // ==================================================
    // VENTAS
    // ==================================================

    if (
      (
        usuario.rol === "administrador" ||
        usuario.rol === "recepcionista"
      ) &&
      tieneAlgunPermiso([
        "ventas.ver",
        "ventas.crear",
      ])
    ) {
      agregar({
        icono: "💳",
        titulo: "Ventas",
        descripcion:
          usuario.rol === "recepcionista"
            ? "Registra pagos, genera órdenes y comprobantes."
            : "Consulta ventas y comprobantes.",
        fondo: "#FEF3C7",
        color: "#A16207",
        ruta: "/ventas",
      });
    }

    // ==================================================
    // RECEPCIONISTA - NOTIFICACIONES
    // ==================================================

    if (usuario.rol === "recepcionista") {
      agregar({
        icono: "🔔",
        titulo: "Notificaciones de Recepción",
        descripcion:
          "Consulta muestras pendientes, rechazadas, procesadas y nuevas tomas solicitadas.",
        fondo: "#DBEAFE",
        color: "#2563EB",
        ruta: "/notificaciones-recepcion",
      });

      // ================================================
      // NUEVO MÓDULO: RESULTADOS Y NOTAS DE VENTA
      // ================================================

      agregar({
        icono: "📄",
        titulo: "Resultados y notas de venta",
        descripcion:
          "Busca pacientes, consulta los resultados clínicos disponibles y descarga sus notas de venta.",
        fondo: "#DCFCE7",
        color: "#00853D",
        ruta: "/resultados-notas-venta",
      });
    }

    // ==================================================
    // BIOQUÍMICO - MUESTRAS
    // ==================================================

    if (usuario.rol === "bioquimico") {
      agregar({
        icono: "🧪",
        titulo: "Muestras",
        descripcion:
          "Registra y consulta las muestras del laboratorio.",
        fondo: "#EDE9FE",
        color: "#7C3AED",
        ruta: "/muestras",
      });
    }

    // ==================================================
    // RESULTADOS
    // ==================================================

    if (
      tienePermiso("resultados.ver")
    ) {
      agregar({
        icono: "📋",
        titulo: "Resultados",
        descripcion:
          "Consulta resultados clínicos.",
        fondo: "#DBEAFE",
        color: "#1D4ED8",
        ruta: "/resultados",
      });
    }

    // ==================================================
    // REPORTES
    // ==================================================

    if (
      tienePermiso("reportes.ver")
    ) {
      agregar({
        icono: "📊",
        titulo: "Reportes",
        descripcion:
          "Consulta reportes del laboratorio.",
        fondo: "#EDE9FE",
        color: "#7C3AED",
        ruta: "/sprint3-admin",
      });
    }

    // ==================================================
    // AUDITORÍA
    // ==================================================

    if (
      tienePermiso(
        "auditoria.ver_global"
      )
    ) {
      agregar({
        icono: "📜",
        titulo: "Auditoría global",
        descripcion:
          "Consulta operaciones importantes del sistema.",
        fondo: "#E2E8F0",
        color: "#475569",
        ruta: "/auditoria-global",
      });
    }

    return lista;
  };

  // ====================================================
  // PANTALLA DE CARGA
  // ====================================================

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
        />

        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text style={styles.loadingTitle}>
          Laboratorio Clínico
        </Text>

        <Text style={styles.loadingText}>
          Preparando tu espacio de trabajo...
        </Text>
      </SafeAreaView>
    );
  }

  // ====================================================
  // LOGIN
  // ====================================================

  if (!usuario) {
    return (
      <SafeAreaView style={styles.loginPage}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.loginScroll
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.loginBrand}>
              <View style={styles.brandIcon}>
                <Text style={styles.brandEmoji}>
                  🧪
                </Text>
              </View>

              <Text style={styles.brandTitle}>
                Laboratorio Clínico
              </Text>

              <Text style={styles.brandSubtitle}>
                Gestión segura de tu laboratorio
              </Text>
            </View>

            <View style={styles.loginCard}>
              <Text style={styles.loginTitle}>
                Bienvenido
              </Text>

              <Text
                style={styles.loginDescription}
              >
                Ingresa con las credenciales
                de tu cuenta.
              </Text>

              <Text style={styles.label}>
                Correo electrónico
              </Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!procesando}
              />

              <Text style={styles.label}>
                Contraseña
              </Text>

              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!mostrarPassword}
                  placeholder="Contraseña"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!procesando}
                  onSubmitEditing={iniciarSesion}
                />

                <Pressable
                  onPress={() =>
                    setMostrarPassword(
                      !mostrarPassword
                    )
                  }
                  disabled={procesando}
                >
                  <Text style={styles.showText}>
                    {mostrarPassword
                      ? "Ocultar"
                      : "Ver"}
                  </Text>
                </Pressable>
              </View>

              {errorAcceso !== "" && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {errorAcceso}
                  </Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.loginButton,
                  procesando &&
                    styles.buttonDisabled,
                ]}
                onPress={iniciarSesion}
                disabled={procesando}
              >
                {procesando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={styles.loginButtonText}
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

  // ====================================================
  // DASHBOARD PRINCIPAL
  // ====================================================

  const modulos = obtenerModulos();

  return (
    <SafeAreaView style={styles.dashboardPage}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colorPrimario}
      />

      <ScrollView
        contentContainerStyle={
          styles.dashboardScroll
        }
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================== */}
        {/* ENCABEZADO */}
        {/* =========================================== */}

        <View
          style={[
            styles.hero,
            {
              backgroundColor: colorPrimario,
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

          <View style={styles.heroContent}>
            <View style={styles.heroLogo}>
              {laboratorio?.logoUrl ? (
                <Image
                  source={{
                    uri: laboratorio.logoUrl,
                  }}
                  style={styles.heroLogoImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.heroEmoji}>
                  🧪
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroSmall}>
                {nombreLaboratorio}
              </Text>

              <Text style={styles.heroTitle}>
                Hola, {usuario.nombre || "Usuario"}
              </Text>

              <Text style={styles.heroSubtitle}>
                {nombreRol(usuario.rol)}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================== */}
        {/* PERFIL */}
        {/* =========================================== */}

        <View style={styles.profileCard}>
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
                  color: colorPrimario,
                },
              ]}
            >
              {(usuario.nombre || "U")
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {usuario.nombre} {usuario.apellido}
            </Text>

            <Text style={styles.profileEmail}>
              {usuario.email}
            </Text>

            <Text
              style={[
                styles.profileRole,
                {
                  color: colorPrimario,
                },
              ]}
            >
              {nombreRol(usuario.rol)}
            </Text>
          </View>
        </View>

        {/* =========================================== */}
        {/* TÍTULO */}
        {/* =========================================== */}

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionEyebrow,
              {
                color: colorPrimario,
              },
            ]}
          >
            ÁREA DE TRABAJO
          </Text>

          <Text style={styles.sectionTitle}>
            Módulos disponibles
          </Text>

          <Text
            style={styles.sectionDescription}
          >
            Accede a las funciones
            autorizadas para tu cuenta.
          </Text>
        </View>

        {/* =========================================== */}
        {/* MÓDULOS */}
        {/* =========================================== */}

        <View style={styles.modules}>
          {modulos.map((modulo) => (
            <Modulo
              key={modulo.ruta}
              icono={modulo.icono}
              titulo={modulo.titulo}
              descripcion={modulo.descripcion}
              fondo={modulo.fondo}
              color={modulo.color}
              onPress={() =>
                abrirModulo(modulo.ruta)
              }
            />
          ))}

          {modulos.length === 0 && (
            <View style={styles.sinModulos}>
              <Text
                style={styles.sinModulosTitulo}
              >
                No hay módulos disponibles
              </Text>

              <Text
                style={styles.sinModulosTexto}
              >
                Tu cuenta inició sesión,
                pero no se pudieron cargar
                los permisos necesarios
                para mostrar los módulos.
              </Text>
            </View>
          )}
        </View>

        {/* =========================================== */}
        {/* SESIÓN ACTIVA */}
        {/* =========================================== */}

        <View style={styles.sessionCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionTitle}>
              ● Sesión activa
            </Text>

            <Text style={styles.sessionEmail}>
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
              setMostrarCerrarSesion(true)
            }
            disabled={procesando}
          >
            <Text style={styles.logoutText}>
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ============================================= */}
      {/* MODAL CERRAR SESIÓN */}
      {/* ============================================= */}

      <Modal
        visible={mostrarCerrarSesion}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarCerrarSesion(false)
        }
      >
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutModal}>
            <View style={styles.logoutIcon}>
              <Text style={{ fontSize: 25 }}>
                ↪
              </Text>
            </View>

            <Text style={styles.logoutTitle}>
              Cerrar sesión
            </Text>

            <Text
              style={styles.logoutDescription}
            >
              ¿Deseas cerrar tu sesión actual?
            </Text>

            <View style={styles.logoutActions}>
              <Pressable
                style={styles.cancelLogout}
                onPress={() =>
                  setMostrarCerrarSesion(false)
                }
                disabled={procesando}
              >
                <Text
                  style={styles.cancelLogoutText}
                >
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={styles.confirmLogout}
                onPress={ejecutarCerrarSesion}
                disabled={procesando}
              >
                {procesando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={styles.confirmLogoutText}
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

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  // ====================================================
  // CARGA
  // ====================================================

  loadingPage: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingTitle: {
    marginTop: 20,
    fontSize: 23,
    fontWeight: "800",
    color: "#0F172A",
  },

  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },

  // ====================================================
  // LOGIN
  // ====================================================

  loginPage: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loginScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  loginBrand: {
    alignItems: "center",
    marginBottom: 30,
  },

  brandIcon: {
    width: 85,
    height: 85,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  brandEmoji: {
    fontSize: 43,
  },

  brandTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },

  brandSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
    textAlign: "center",
  },

  loginCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 26,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },

  loginTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },

  loginDescription: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 21,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 9,
  },

  input: {
    height: 51,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
  },

  passwordRow: {
    height: 51,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 23,
  },

  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    height: "100%",
  },

  showText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
  },

  loginButton: {
    backgroundColor: "#2563EB",
    height: 53,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  errorBox: {
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 9,
    marginBottom: 18,
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 19,
  },

  // ====================================================
  // DASHBOARD
  // ====================================================

  dashboardPage: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  dashboardScroll: {
    paddingBottom: 35,
  },

  hero: {
    minHeight: 175,
    paddingHorizontal: 23,
    paddingTop: 35,
    paddingBottom: 40,
    overflow: "hidden",
    justifyContent: "center",
  },

  heroDecoration: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -90,
    top: -110,
    opacity: 0.3,
  },

  heroContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  heroLogo: {
    width: 65,
    height: 65,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },

  heroLogoImage: {
    width: 56,
    height: 56,
  },

  heroEmoji: {
    fontSize: 33,
  },

  heroSmall: {
    color: "#DBEAFE",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 5,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },

  heroSubtitle: {
    color: "#E0F2FE",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "600",
  },

  // ====================================================
  // PERFIL
  // ====================================================

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 18,
    marginTop: -17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  profileLetter: {
    fontSize: 25,
    fontWeight: "800",
  },

  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  profileEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  profileRole: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  // ====================================================
  // SECCIÓN
  // ====================================================

  sectionHeader: {
    paddingHorizontal: 21,
    paddingTop: 30,
    paddingBottom: 18,
  },

  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  sectionTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0F172A",
  },

  sectionDescription: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 7,
    lineHeight: 20,
  },

  // ====================================================
  // MÓDULOS
  // ====================================================

  modules: {
    paddingHorizontal: 18,
  },

  modulo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },

  moduloPresionado: {
    opacity: 0.75,
  },

  moduloIcono: {
    width: 53,
    height: 53,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  moduloEmoji: {
    fontSize: 25,
  },

  moduloContenido: {
    flex: 1,
  },

  moduloTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 5,
  },

  moduloDescripcion: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },

  moduloFlecha: {
    fontSize: 29,
    fontWeight: "500",
    marginLeft: 8,
  },

  sinModulos: {
    padding: 25,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },

  sinModulosTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },

  sinModulosTexto: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },

  // ====================================================
  // SESIÓN
  // ====================================================

  sessionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 22,
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
  },

  sessionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#16A34A",
  },

  sessionEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 6,
  },

  logoutButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 9,
    marginLeft: 10,
  },

  logoutText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B91C1C",
  },

  // ====================================================
  // MODAL CERRAR SESIÓN
  // ====================================================

  logoutOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },

  logoutModal: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
  },

  logoutIcon: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  logoutTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },

  logoutDescription: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 25,
  },

  logoutActions: {
    flexDirection: "row",
    width: "100%",
  },

  cancelLogout: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },

  cancelLogoutText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },

  confirmLogout: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 8,
  },

  confirmLogoutText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});