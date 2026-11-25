import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
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
  useWindowDimensions,
} from "react-native";

import { useRouter } from "expo-router";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

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

type ModuloSistema = {
  icono: string;
  titulo: string;
  descripcion: string;
  fondo: string;
  color: string;
  ruta: string;
};

type ModuloProps = {
  modulo: ModuloSistema;
  onPress: () => void;
};

// ======================================================
// COLORES
// ======================================================

const C = {
  primario: "#2563EB",
  primarioOscuro: "#1D4ED8",
  azulProfundo: "#17356C",
  fondo: "#F3F7FC",
  blanco: "#FFFFFF",
  texto: "#17243D",
  secundario: "#64748B",
  borde: "#DFE7F2",
  error: "#B91C1C",
  errorFondo: "#FFF1F2",
  verde: "#15803D",
};

// ======================================================
// FUNCIONES GENERALES
// ======================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizarRol(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esRolValido(rol: string): rol is RolUsuario {
  return [
    "super_admin",
    "administrador",
    "recepcionista",
    "bioquimico",
  ].includes(rol);
}

function nombreRol(rol: RolUsuario): string {
  switch (rol) {
    case "super_admin":
      return "Super Administrador";

    case "administrador":
      return "Administrador del Laboratorio";

    case "recepcionista":
      return "Recepcionista";

    case "bioquimico":
      return "Bioquímico";
  }
}

function codigoFirebase(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return texto(
      (error as { code?: string }).code
    );
  }

  return "";
}

function mensajeAutenticacion(error: unknown): string {
  switch (codigoFirebase(error)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "El correo electrónico o la contraseña son incorrectos.";

    case "auth/invalid-email":
      return "Ingresa un correo electrónico válido.";

    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada. Contacta al administrador.";

    case "auth/too-many-requests":
      return "Demasiados intentos. Inténtalo nuevamente más tarde.";

    case "auth/network-request-failed":
      return "No se pudo establecer conexión. Revisa tu Internet.";

    case "auth/operation-not-allowed":
      return "El inicio de sesión con correo no está habilitado.";

    default:
      return "No se pudo iniciar sesión. Comprueba tus datos e inténtalo nuevamente.";
  }
}

function mensajeSistema(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes(
        "Missing or insufficient permissions"
      )
    ) {
      return "No tienes permisos suficientes para acceder al sistema.";
    }

    if (
      error.message.includes("FirebaseError") ||
      error.message.includes("Firebase:")
    ) {
      return "No se pudo consultar tu cuenta. Comprueba la conexión.";
    }

    return error.message;
  }

  return "Ocurrió un problema al verificar tu cuenta.";
}

// ======================================================
// COMPONENTE TARJETA DE MÓDULO
// ======================================================

function Modulo({
  modulo,
  onPress,
}: ModuloProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${modulo.titulo}`}
      style={({ pressed }) => [
        styles.modulo,
        pressed && styles.moduloPresionado,
      ]}
    >
      <View
        style={[
          styles.moduloIcono,
          {
            backgroundColor: modulo.fondo,
          },
        ]}
      >
        <Text style={styles.moduloEmoji}>
          {modulo.icono}
        </Text>
      </View>

      <View style={styles.moduloContenido}>
        <Text style={styles.moduloTitulo}>
          {modulo.titulo}
        </Text>

        <Text style={styles.moduloDescripcion}>
          {modulo.descripcion}
        </Text>
      </View>

      <Text
        style={[
          styles.moduloFlecha,
          {
            color: modulo.color,
          },
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

  const { width } = useWindowDimensions();

  const esEscritorio = width >= 850;

  // ====================================================
  // ESTADOS DEL FORMULARIO
  // ====================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  // ====================================================
  // ESTADOS DE SESIÓN
  // ====================================================

  const [
    usuario,
    setUsuario,
  ] = useState<UsuarioSistema | null>(null);

  const [permisos, setPermisos] = useState<string[]>([]);

  const [
    laboratorio,
    setLaboratorio,
  ] = useState<PersonalizacionLaboratorio | null>(null);

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState("");

  const [
    mostrarCerrarSesion,
    setMostrarCerrarSesion,
  ] = useState(false);

  const versionSesion = useRef(0);
  const componenteActivo = useRef(false);

  // ====================================================
  // LIMPIAR DATOS LOCALES
  // ====================================================

  const limpiarSesionLocal = useCallback(() => {
    setUsuario(null);
    setPermisos([]);
    setLaboratorio(null);
  }, []);

  // ====================================================
  // CERRAR SESIÓN EN FIREBASE
  // ====================================================

  const cerrarSesionInterna = useCallback(
    async () => {
      versionSesion.current += 1;

      try {
        await cerrarSesionFirebase();
      } finally {
        if (componenteActivo.current) {
          limpiarSesionLocal();
          setCargando(false);
        }
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
    ): Promise<void> => {
      try {
        const usuarioRef = doc(
          db,
          "usuarios",
          firebaseUser.uid
        );

        const usuarioSnap = await getDoc(usuarioRef);

        if (
          !componenteActivo.current ||
          versionActual !== versionSesion.current
        ) {
          return;
        }

        if (!usuarioSnap.exists()) {
          throw new Error(
            "No se encontró tu cuenta en Firestore."
          );
        }

        const datos = usuarioSnap.data();

        if (datos.activo !== true) {
          throw new Error(
            "Tu cuenta se encuentra inactiva."
          );
        }

        const rol = normalizarRol(datos.rol);

        if (!esRolValido(rol)) {
          throw new Error(
            "Tu cuenta no tiene un rol válido."
          );
        }

        const laboratorioId = texto(
          datos.laboratorioId
        );

        if (
          rol !== "super_admin" &&
          !laboratorioId
        ) {
          throw new Error(
            "Tu cuenta no tiene laboratorio asignado."
          );
        }

        const usuarioSistema: UsuarioSistema = {
          id: usuarioSnap.id,

          nombre: texto(
            datos.nombre || datos.nombres
          ),

          apellido: texto(
            datos.apellido || datos.apellidos
          ),

          email: texto(
            datos.email || firebaseUser.email
          ).toLowerCase(),

          rol,
          laboratorioId,
          activo: true,
          requiereVerificacionEmail: false,
        };

        // ============================================
        // PERMISOS
        // ============================================

        let permisosRol: string[] = [];

        try {
          const respuesta = await obtenerPermisosRol(rol);

          if (Array.isArray(respuesta)) {
            permisosRol = respuesta;
          }
        } catch {
          permisosRol = [];
        }

        // ============================================
        // PERSONALIZACIÓN
        // ============================================

        let identidad:
          | PersonalizacionLaboratorio
          | null = null;

        if (laboratorioId) {
          try {
            identidad = await obtenerPersonalizacion(
              laboratorioId
            );
          } catch {
            identidad = null;
          }
        }

        if (
          !componenteActivo.current ||
          versionActual !== versionSesion.current
        ) {
          return;
        }

        setPermisos(permisosRol);
        setLaboratorio(identidad);
        setUsuario(usuarioSistema);

        setErrorAcceso("");
      } catch (error: unknown) {
        if (
          !componenteActivo.current ||
          versionActual !== versionSesion.current
        ) {
          return;
        }

        const mensaje = mensajeSistema(error);

        limpiarSesionLocal();
        setErrorAcceso(mensaje);

        // Cerrar únicamente la sesión no autorizada.
        // Se conserva el mensaje para el usuario.

        try {
          await cerrarSesionFirebase();
        } catch {
          // No mostrar errores internos al usuario.
        }

        if (componenteActivo.current) {
          setCargando(false);
        }
      }
    },
    [limpiarSesionLocal]
  );

  // ====================================================
  // OBSERVADOR DE AUTENTICACIÓN
  // ====================================================

  useEffect(() => {
    componenteActivo.current = true;

    const cancelar = onAuthStateChanged(
      auth,

      async (firebaseUser) => {
        const versionActual =
          ++versionSesion.current;

        if (!componenteActivo.current) {
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
        } catch {
          if (componenteActivo.current) {
            limpiarSesionLocal();

            setErrorAcceso(
              "No se pudo verificar tu sesión."
            );
          }
        } finally {
          if (
            componenteActivo.current &&
            (
              versionActual === versionSesion.current ||
              !auth.currentUser
            )
          ) {
            setCargando(false);
          }
        }
      },

      () => {
        if (componenteActivo.current) {
          limpiarSesionLocal();

          setErrorAcceso(
            "No se pudo comprobar la sesión actual."
          );

          setCargando(false);
        }
      }
    );

    return () => {
      componenteActivo.current = false;
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
    if (procesando || cargando) {
      return;
    }

    const correo = email
      .trim()
      .toLowerCase();

    if (!correo) {
      setErrorAcceso(
        "Debes ingresar tu correo electrónico."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
    ) {
      setErrorAcceso(
        "Ingresa un correo electrónico válido."
      );
      return;
    }

    if (!password) {
      setErrorAcceso(
        "Debes ingresar tu contraseña."
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
      // Errores esperados de autenticación.
      // No usar console.error aquí.

      setErrorAcceso(
        mensajeAutenticacion(error)
      );
    } finally {
      if (componenteActivo.current) {
        setProcesando(false);
      }
    }
  };

  // ====================================================
  // CAMPOS
  // ====================================================

  const cambiarCorreo = (valor: string) => {
    setEmail(valor);

    if (errorAcceso) {
      setErrorAcceso("");
    }
  };

  const cambiarPassword = (valor: string) => {
    setPassword(valor);

    if (errorAcceso) {
      setErrorAcceso("");
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
    } catch {
      setErrorAcceso(
        "No se pudo cerrar la sesión."
      );
    } finally {
      if (componenteActivo.current) {
        setProcesando(false);
      }
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
    router.push(ruta as never);
  };

  // ====================================================
  // PERSONALIZACIÓN
  // ====================================================

  const colorPrimario =
    laboratorio?.colorPrimario ||
    PERSONALIZACION_DEFAULT.colorPrimario ||
    C.primario;

  const colorSecundario =
    laboratorio?.colorSecundario ||
    PERSONALIZACION_DEFAULT.colorSecundario ||
    "#60A5FA";

  const nombreLaboratorio =
    laboratorio?.nombreVisible ||
    laboratorio?.nombre ||
    "Laboratorio Clínico";

  // ====================================================
  // MÓDULOS DEL DASHBOARD
  // ====================================================

  const obtenerModulos = (): ModuloSistema[] => {
    if (!usuario) {
      return [];
    }

    const lista: ModuloSistema[] = [];

    const agregar = (modulo: ModuloSistema) => {
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

      if (
        tienePermiso("roles.ver")
      ) {
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
    // ==================================================

    // Se respeta el cambio integrado en develop:
    // no mostrar el módulo independiente en el Dashboard.
    //
    // No se modifican la pantalla, Firestore
    // ni los registros históricos de pacientes.

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
    // RECEPCIONISTA
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

      agregar({
        icono: "📄",
        titulo: "Resultados y notas de venta",
        descripcion:
          "Busca pacientes, consulta resultados clínicos y descarga sus notas de venta.",
        fondo: "#DCFCE7",
        color: "#00853D",
        ruta: "/resultados-notas-venta",
      });
    }

    // ==================================================
    // BIOQUÍMICO
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
      tienePermiso("auditoria.ver_global")
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
          backgroundColor={C.fondo}
        />

        <View style={styles.loadingIcono}>
          <Text style={styles.loadingEmoji}>
            🧪
          </Text>
        </View>

        <ActivityIndicator
          size="large"
          color={C.primario}
        />

        <Text style={styles.loadingTitulo}>
          Laboratorio Clínico
        </Text>

        <Text style={styles.loadingTexto}>
          Preparando tu espacio de trabajo...
        </Text>
      </SafeAreaView>
    );
  }

  // ====================================================
  // INICIO DE SESIÓN
  // ====================================================

  if (!usuario) {
    return (
      <SafeAreaView style={styles.loginPage}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={C.fondo}
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
            contentContainerStyle={[
              styles.loginScroll,
              esEscritorio &&
                styles.loginScrollDesktop,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.loginWrapper,
                esEscritorio &&
                  styles.loginWrapperDesktop,
              ]}
            >
              {/* PANEL INSTITUCIONAL */}

              <View
                style={[
                  styles.panelInstitucional,
                  esEscritorio &&
                    styles.panelInstitucionalDesktop,
                ]}
              >
                <View style={styles.marcaFila}>
                  <View style={styles.marcaIcono}>
                    <Text style={styles.marcaEmoji}>
                      🧪
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.marcaTitulo}>
                      LABORATORIO CLÍNICO
                    </Text>

                    <Text style={styles.marcaSubtitulo}>
                      SISTEMA DE GESTIÓN
                    </Text>
                  </View>
                </View>

                <Text style={styles.presentacionEtiqueta}>
                  PLATAFORMA CLÍNICA
                </Text>

                <Text style={styles.presentacionTitulo}>
                  Tu laboratorio,
                  {"\n"}
                  más conectado.
                </Text>

                <Text style={styles.presentacionTexto}>
                  Gestiona pacientes, análisis,
                  resultados clínicos y operaciones
                  desde una sola plataforma.
                </Text>

                <View style={styles.presentacionLinea} />

                <View style={styles.beneficioFila}>
                  <View style={styles.beneficioMarca}>
                    <Text style={styles.beneficioMarcaTexto}>
                      ✓
                    </Text>
                  </View>

                  <Text style={styles.beneficioTexto}>
                    Acceso seguro según roles y permisos
                  </Text>
                </View>

                <View style={styles.beneficioFila}>
                  <View style={styles.beneficioMarca}>
                    <Text style={styles.beneficioMarcaTexto}>
                      ✓
                    </Text>
                  </View>

                  <Text style={styles.beneficioTexto}>
                    Gestión de pacientes y análisis
                  </Text>
                </View>

                <View style={styles.beneficioFila}>
                  <View style={styles.beneficioMarca}>
                    <Text style={styles.beneficioMarcaTexto}>
                      ✓
                    </Text>
                  </View>

                  <Text style={styles.beneficioTexto}>
                    Informes y resultados clínicos
                  </Text>
                </View>
              </View>

              {/* FORMULARIO */}

              <View
                style={[
                  styles.loginCard,
                  esEscritorio &&
                    styles.loginCardDesktop,
                ]}
              >
                <View style={styles.loginBadge}>
                  <Text style={styles.loginBadgeTexto}>
                    ACCESO AL SISTEMA
                  </Text>
                </View>

                <Text style={styles.loginTitulo}>
                  Bienvenido
                </Text>

                <Text style={styles.loginDescripcion}>
                  Ingresa tus credenciales para
                  acceder a tu espacio de trabajo.
                </Text>

                {/* CORREO */}

                <Text style={styles.label}>
                  Correo electrónico
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputIcono}>
                    @
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={cambiarCorreo}
                    placeholder="correo@laboratorio.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!procesando}
                    returnKeyType="next"
                  />
                </View>

                {/* CONTRASEÑA */}

                <Text style={styles.label}>
                  Contraseña
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputIcono}>
                    ●
                  </Text>

                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={cambiarPassword}
                    placeholder="Ingresa tu contraseña"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!mostrarPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!procesando}
                    returnKeyType="go"
                    onSubmitEditing={iniciarSesion}
                  />

                  <Pressable
                    style={styles.verPassword}
                    onPress={() =>
                      setMostrarPassword(
                        !mostrarPassword
                      )
                    }
                    disabled={procesando}
                    accessibilityRole="button"
                    accessibilityLabel={
                      mostrarPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    <Text style={styles.verPasswordTexto}>
                      {mostrarPassword
                        ? "Ocultar"
                        : "Ver"}
                    </Text>
                  </Pressable>
                </View>

                {/* MENSAJES DE ERROR */}

                {errorAcceso !== "" && (
                  <View
                    style={styles.errorBox}
                    accessibilityRole="alert"
                  >
                    <View style={styles.errorIcono}>
                      <Text style={styles.errorIconoTexto}>
                        !
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.errorTitulo}>
                        No se pudo iniciar sesión
                      </Text>

                      <Text style={styles.errorTexto}>
                        {errorAcceso}
                      </Text>
                    </View>
                  </View>
                )}

                {/* BOTÓN */}

                <Pressable
                  onPress={iniciarSesion}
                  disabled={procesando}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.loginBoton,
                    pressed &&
                      styles.loginBotonPresionado,
                    procesando &&
                      styles.botonDeshabilitado,
                  ]}
                >
                  {procesando ? (
                    <View style={styles.botonCargando}>
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />

                      <Text style={styles.loginBotonTexto}>
                        Verificando...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.loginBotonTexto}>
                      Iniciar sesión →
                    </Text>
                  )}
                </Pressable>

                <View style={styles.formularioPie}>
                  <Text style={styles.formularioPieTexto}>
                    Acceso exclusivo para personal autorizado
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.pieGeneral}>
              Sistema de Gestión de Laboratorio Clínico
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ====================================================
  // DASHBOARD
  // ====================================================

  const modulos = obtenerModulos();

  return (
    <SafeAreaView style={styles.dashboardPage}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colorPrimario}
      />

      <ScrollView
        contentContainerStyle={styles.dashboardScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO */}

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
              styles.heroDecoracion,
              {
                backgroundColor: colorSecundario,
              },
            ]}
          />

          <View style={styles.heroContenido}>
            <View style={styles.heroLogo}>
              {laboratorio?.logoUrl ? (
                <Image
                  source={{
                    uri: laboratorio.logoUrl,
                  }}
                  style={styles.heroLogoImagen}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.heroEmoji}>
                  🧪
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroLaboratorio}>
                {nombreLaboratorio}
              </Text>

              <Text style={styles.heroTitulo}>
                Hola, {usuario.nombre || "Usuario"}
              </Text>

              <Text style={styles.heroSubtitulo}>
                {nombreRol(usuario.rol)}
              </Text>
            </View>
          </View>
        </View>

        {/* PERFIL */}

        <View style={styles.perfil}>
          <View
            style={[
              styles.perfilAvatar,
              {
                backgroundColor: `${colorPrimario}18`,
              },
            ]}
          >
            <Text
              style={[
                styles.perfilInicial,
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
            <Text style={styles.perfilNombre}>
              {usuario.nombre} {usuario.apellido}
            </Text>

            <Text style={styles.perfilCorreo}>
              {usuario.email}
            </Text>

            <Text
              style={[
                styles.perfilRol,
                {
                  color: colorPrimario,
                },
              ]}
            >
              {nombreRol(usuario.rol)}
            </Text>
          </View>
        </View>

        {/* MÓDULOS */}

        <View style={styles.seccionTitulo}>
          <Text
            style={[
              styles.seccionEtiqueta,
              {
                color: colorPrimario,
              },
            ]}
          >
            ÁREA DE TRABAJO
          </Text>

          <Text style={styles.seccionNombre}>
            Módulos disponibles
          </Text>

          <Text style={styles.seccionDescripcion}>
            Accede a las funciones autorizadas
            para tu cuenta.
          </Text>
        </View>

        <View style={styles.modulos}>
          {modulos.map((modulo) => (
            <Modulo
              key={modulo.ruta}
              modulo={modulo}
              onPress={() =>
                abrirModulo(modulo.ruta)
              }
            />
          ))}

          {modulos.length === 0 && (
            <View style={styles.sinModulos}>
              <Text style={styles.sinModulosTitulo}>
                No hay módulos disponibles
              </Text>

              <Text style={styles.sinModulosTexto}>
                Tu cuenta inició sesión,
                pero no se pudieron cargar los permisos
                necesarios para mostrar los módulos.
              </Text>
            </View>
          )}
        </View>

        {/* SESIÓN */}

        <View style={styles.sesion}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sesionTitulo}>
              ● Sesión activa
            </Text>

            <Text style={styles.sesionCorreo}>
              {usuario.email}
            </Text>
          </View>

          <Pressable
            style={[
              styles.cerrarBoton,
              procesando &&
                styles.botonDeshabilitado,
            ]}
            onPress={() =>
              setMostrarCerrarSesion(true)
            }
            disabled={procesando}
          >
            <Text style={styles.cerrarTexto}>
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* MODAL DE CIERRE DE SESIÓN */}

      <Modal
        visible={mostrarCerrarSesion}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarCerrarSesion(false)
        }
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalTarjeta}>
            <View style={styles.modalIcono}>
              <Text style={styles.modalEmoji}>
                ↪
              </Text>
            </View>

            <Text style={styles.modalTitulo}>
              Cerrar sesión
            </Text>

            <Text style={styles.modalDescripcion}>
              ¿Deseas cerrar tu sesión actual?
            </Text>

            <View style={styles.modalAcciones}>
              <Pressable
                style={styles.modalCancelar}
                onPress={() =>
                  setMostrarCerrarSesion(false)
                }
                disabled={procesando}
              >
                <Text style={styles.modalCancelarTexto}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmar}
                onPress={ejecutarCerrarSesion}
                disabled={procesando}
              >
                {procesando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.modalConfirmarTexto}>
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
  // CARGA

  loadingPage: {
    flex: 1,
    backgroundColor: C.fondo,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingIcono: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  loadingEmoji: {
    fontSize: 40,
  },

  loadingTitulo: {
    marginTop: 20,
    fontSize: 23,
    fontWeight: "800",
    color: C.texto,
  },

  loadingTexto: {
    marginTop: 8,
    fontSize: 14,
    color: C.secundario,
    textAlign: "center",
  },

  // LOGIN

  loginPage: {
    flex: 1,
    backgroundColor: C.fondo,
  },

  loginScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 30,
  },

  loginScrollDesktop: {
    paddingHorizontal: 30,
    paddingVertical: 45,
  },

  loginWrapper: {
    width: "100%",
    maxWidth: 480,
  },

  loginWrapperDesktop: {
    maxWidth: 1100,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
  },

  // PANEL INSTITUCIONAL

  panelInstitucional: {
    backgroundColor: C.primarioOscuro,
    borderRadius: 20,
    padding: 27,
    marginBottom: 16,
    overflow: "hidden",
  },

  panelInstitucionalDesktop: {
    width: "52%",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
    padding: 42,
    justifyContent: "center",
  },

  marcaFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 35,
  },

  marcaIcono: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  marcaEmoji: {
    fontSize: 25,
  },

  marcaTitulo: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  marcaSubtitulo: {
    color: "#BFDBFE",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 5,
  },

  presentacionEtiqueta: {
    color: "#BFDBFE",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 15,
  },

  presentacionTitulo: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "900",
    lineHeight: 43,
    marginBottom: 18,
  },

  presentacionTexto: {
    color: "#DBEAFE",
    fontSize: 14,
    lineHeight: 23,
    maxWidth: 390,
  },

  presentacionLinea: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 28,
  },

  beneficioFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  beneficioMarca: {
    width: 22,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  beneficioMarcaTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  beneficioTexto: {
    color: "#E0F2FE",
    fontSize: 13,
    flex: 1,
  },

  // FORMULARIO

  loginCard: {
    width: "100%",
    backgroundColor: C.blanco,
    borderRadius: 20,
    padding: 27,
    borderWidth: 1,
    borderColor: C.borde,
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },

  loginCardDesktop: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    justifyContent: "center",
    padding: 40,
  },

  loginBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 25,
  },

  loginBadgeTexto: {
    color: C.primario,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  loginTitulo: {
    fontSize: 29,
    fontWeight: "900",
    color: C.texto,
  },

  loginDescripcion: {
    fontSize: 13,
    color: C.secundario,
    marginTop: 9,
    marginBottom: 30,
    lineHeight: 21,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 9,
  },

  inputContainer: {
    borderWidth: 1,
    borderColor: "#D7E1ED",
    borderRadius: 11,
    minHeight: 54,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFCFF",
    marginBottom: 22,
  },

  inputIcono: {
    color: C.secundario,
    fontSize: 15,
    fontWeight: "900",
    marginRight: 11,
  },

  input: {
    flex: 1,
    minHeight: 52,
    color: C.texto,
    fontSize: 14,
  },

  passwordInput: {
    flex: 1,
    minHeight: 52,
    color: C.texto,
    fontSize: 14,
  },

  verPassword: {
    paddingVertical: 10,
    paddingLeft: 8,
  },

  verPasswordTexto: {
    color: C.primario,
    fontSize: 12,
    fontWeight: "800",
  },

  // ERROR

  errorBox: {
    backgroundColor: C.errorFondo,
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 11,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  errorIcono: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  errorIconoTexto: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "900",
  },

  errorTitulo: {
    fontSize: 12,
    fontWeight: "900",
    color: C.error,
    marginBottom: 4,
  },

  errorTexto: {
    color: C.error,
    fontSize: 12,
    lineHeight: 19,
  },

  // BOTÓN

  loginBoton: {
    backgroundColor: C.primario,
    minHeight: 54,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },

  loginBotonPresionado: {
    backgroundColor: C.primarioOscuro,
  },

  loginBotonTexto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  botonCargando: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  formularioPie: {
    marginTop: 25,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
    alignItems: "center",
  },

  formularioPieTexto: {
    color: "#94A3B8",
    fontSize: 11,
    textAlign: "center",
  },

  pieGeneral: {
    marginTop: 25,
    color: "#94A3B8",
    fontSize: 11,
    textAlign: "center",
  },

  // DASHBOARD

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

  heroDecoracion: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -90,
    top: -110,
    opacity: 0.3,
  },

  heroContenido: {
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

  heroLogoImagen: {
    width: 56,
    height: 56,
  },

  heroEmoji: {
    fontSize: 33,
  },

  heroLaboratorio: {
    color: "#DBEAFE",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 5,
  },

  heroTitulo: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },

  heroSubtitulo: {
    color: "#E0F2FE",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "600",
  },

  // PERFIL

  perfil: {
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
  },

  perfilAvatar: {
    width: 54,
    height: 54,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  perfilInicial: {
    fontSize: 25,
    fontWeight: "800",
  },

  perfilNombre: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  perfilCorreo: {
    fontSize: 12,
    color: C.secundario,
    marginTop: 4,
  },

  perfilRol: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  // MÓDULOS

  seccionTitulo: {
    paddingHorizontal: 21,
    paddingTop: 30,
    paddingBottom: 18,
  },

  seccionEtiqueta: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  seccionNombre: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0F172A",
  },

  seccionDescripcion: {
    fontSize: 13,
    color: C.secundario,
    marginTop: 7,
    lineHeight: 20,
  },

  modulos: {
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
    color: C.secundario,
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
    color: C.secundario,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },

  // SESIÓN

  sesion: {
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

  sesionTitulo: {
    fontSize: 14,
    fontWeight: "800",
    color: C.verde,
  },

  sesionCorreo: {
    fontSize: 12,
    color: C.secundario,
    marginTop: 6,
  },

  cerrarBoton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 9,
    marginLeft: 10,
  },

  cerrarTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: C.error,
  },

  // MODAL

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },

  modalTarjeta: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
  },

  modalIcono: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  modalEmoji: {
    fontSize: 25,
  },

  modalTitulo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },

  modalDescripcion: {
    fontSize: 14,
    color: C.secundario,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 25,
  },

  modalAcciones: {
    flexDirection: "row",
    width: "100%",
  },

  modalCancelar: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },

  modalCancelarTexto: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },

  modalConfirmar: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 8,
  },

  modalConfirmarTexto: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});