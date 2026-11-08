import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import {
  actualizarConfiguracionLaboratorio,
  obtenerConfiguracionLaboratorio,
  type ConfiguracionLaboratorio,
} from "../services/configuracionLaboratorioService";

import {
  obtenerConfiguracionQR,
  guardarQRLaboratorio,
  eliminarQRLaboratorio,
} from "../services/qrCobroService";

// =====================================================
// CONFIGURACIÓN
// =====================================================

// Límite del Base64 enviado al servicio QR.
// Debe ser compatible con la validación de
// services/qrCobroService.ts.

const LIMITE_QR_BASE64 = 140000;

// =====================================================
// TIPOS
// =====================================================

type Mensaje = {
  tipo: "exito" | "error";
  texto: string;
} | null;

type CampoProps = {
  titulo: string;
  valor: string;
  onChange: (valor: string) => void;
  editable: boolean;
  placeholder: string;
  icono: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function obtenerMensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

function colorValido(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

function mostrarAlerta(
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

// =====================================================
// PROCESAR IMAGEN EN WEB
// =====================================================

async function procesarQRWeb(
  uri: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      reject(
        new Error(
          "El procesamiento web no está disponible."
        )
      );

      return;
    }

    const imagen = new window.Image();

    imagen.onload = () => {
      try {
        const anchoOriginal =
          imagen.naturalWidth || imagen.width;

        const altoOriginal =
          imagen.naturalHeight || imagen.height;

        if (
          !Number.isFinite(anchoOriginal) ||
          !Number.isFinite(altoOriginal) ||
          anchoOriginal <= 0 ||
          altoOriginal <= 0
        ) {
          throw new Error(
            "La imagen seleccionada no tiene dimensiones válidas."
          );
        }

        const canvas =
          document.createElement("canvas");

        const contexto =
          canvas.getContext("2d");

        if (!contexto) {
          throw new Error(
            "No se pudo inicializar Canvas."
          );
        }

        // Mantener las proporciones originales.
        // Nunca utilizar alto igual a cero.

        const tamaños = [
          900,
          800,
          700,
          600,
          500,
          450,
          400,
          350,
          300,
        ];

        // Primero probar PNG, que es preferible
        // para conservar los bordes de un QR.

        for (const tamaño of tamaños) {
          const escala = Math.min(
            1,
            tamaño / Math.max(
              anchoOriginal,
              altoOriginal
            )
          );

          const ancho = Math.max(
            1,
            Math.round(anchoOriginal * escala)
          );

          const alto = Math.max(
            1,
            Math.round(altoOriginal * escala)
          );

          canvas.width = ancho;
          canvas.height = alto;

          contexto.clearRect(
            0,
            0,
            ancho,
            alto
          );

          contexto.imageSmoothingEnabled = true;
          contexto.imageSmoothingQuality = "high";

          contexto.drawImage(
            imagen,
            0,
            0,
            ancho,
            alto
          );

          const base64 =
            canvas.toDataURL("image/png");

          if (
            base64.length <=
            LIMITE_QR_BASE64
          ) {
            resolve(base64);
            return;
          }
        }

        // Si PNG no alcanza, probar JPEG
        // con distintas dimensiones y calidades.

        for (const tamaño of tamaños) {
          const escala = Math.min(
            1,
            tamaño / Math.max(
              anchoOriginal,
              altoOriginal
            )
          );

          const ancho = Math.max(
            1,
            Math.round(anchoOriginal * escala)
          );

          const alto = Math.max(
            1,
            Math.round(altoOriginal * escala)
          );

          canvas.width = ancho;
          canvas.height = alto;

          contexto.fillStyle = "#FFFFFF";

          contexto.fillRect(
            0,
            0,
            ancho,
            alto
          );

          contexto.drawImage(
            imagen,
            0,
            0,
            ancho,
            alto
          );

          for (const calidad of [
            0.95,
            0.85,
            0.75,
            0.65,
          ]) {
            const base64 =
              canvas.toDataURL(
                "image/jpeg",
                calidad
              );

            if (
              base64.length <=
              LIMITE_QR_BASE64
            ) {
              resolve(base64);
              return;
            }
          }
        }

        reject(
          new Error(
            "La imagen QR sigue siendo demasiado grande. " +
            "Selecciona un QR con fondo sencillo."
          )
        );
      } catch (error) {
        reject(error);
      }
    };

    imagen.onerror = () => {
      reject(
        new Error(
          "No se pudo cargar la imagen QR seleccionada."
        )
      );
    };

    imagen.src = uri;
  });
}

// =====================================================
// PROCESAR IMAGEN EN ANDROID / IOS
// =====================================================

async function procesarQRNativo(
  uri: string
): Promise<string> {
  const tamaños = [
    900,
    800,
    700,
    600,
    500,
    450,
    400,
    350,
    300,
  ];

  // Se especifica solamente width.
  // La librería calcula la altura proporcional.

  for (const ancho of tamaños) {
    const contexto =
      ImageManipulator.ImageManipulator.manipulate(
        uri
      );

    contexto.resize({
      width: ancho,
    });

    const imagen =
      await contexto.renderAsync();

    const resultado =
      await imagen.saveAsync({
        format:
          ImageManipulator.SaveFormat.PNG,
        base64: true,
      });

    if (!resultado.base64) {
      continue;
    }

    const base64 =
      `data:image/png;base64,${resultado.base64}`;

    if (
      base64.length <=
      LIMITE_QR_BASE64
    ) {
      return base64;
    }
  }

  // Alternativa JPEG.

  for (const ancho of tamaños) {
    for (const calidad of [
      0.95,
      0.85,
      0.75,
      0.65,
    ]) {
      const contexto =
        ImageManipulator.ImageManipulator.manipulate(
          uri
        );

      contexto.resize({
        width: ancho,
      });

      const imagen =
        await contexto.renderAsync();

      const resultado =
        await imagen.saveAsync({
          format:
            ImageManipulator.SaveFormat.JPEG,
          compress: calidad,
          base64: true,
        });

      if (!resultado.base64) {
        continue;
      }

      const base64 =
        `data:image/jpeg;base64,${resultado.base64}`;

      if (
        base64.length <=
        LIMITE_QR_BASE64
      ) {
        return base64;
      }
    }
  }

  throw new Error(
    "No fue posible reducir la imagen QR. " +
    "Selecciona una imagen más sencilla."
  );
}

// =====================================================
// PROCESAMIENTO SEGÚN PLATAFORMA
// =====================================================

async function procesarImagenQR(
  uri: string
): Promise<string> {
  if (!uri) {
    throw new Error(
      "No se encontró la imagen QR."
    );
  }

  if (Platform.OS === "web") {
    return procesarQRWeb(uri);
  }

  return procesarQRNativo(uri);
}

// =====================================================
// PANTALLA CONFIGURACIÓN
// =====================================================

export default function ConfiguracionScreen() {
  const router = useRouter();

  // ===================================================
  // INFORMACIÓN GENERAL
  // ===================================================

  const [laboratorio, setLaboratorio] =
    useState<ConfiguracionLaboratorio | null>(
      null
    );

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [editando, setEditando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState<Mensaje>(null);

  const [logoError, setLogoError] =
    useState(false);

  // ===================================================
  // QR
  // ===================================================

  const [qrActual, setQrActual] =
    useState("");

  const [qrNuevo, setQrNuevo] =
    useState("");

  const [cargandoQR, setCargandoQR] =
    useState(false);

  const [procesandoQR, setProcesandoQR] =
    useState(false);

  const [guardandoQR, setGuardandoQR] =
    useState(false);

  const [eliminandoQR, setEliminandoQR] =
    useState(false);

  const ocupadoQR =
    procesandoQR ||
    guardandoQR ||
    eliminandoQR;

  // ===================================================
  // COLOCAR DATOS
  // ===================================================

  const colocarDatos = (
    datos: ConfiguracionLaboratorio
  ) => {
    setNombre(datos.nombre || "");
    setDireccion(datos.direccion || "");
    setTelefono(datos.telefono || "");
    setEmail(datos.email || "");
  };

  // ===================================================
  // CARGAR QR
  // ===================================================

  const cargarQR = useCallback(
    async (laboratorioId: string) => {
      if (!laboratorioId) {
        throw new Error(
          "No se encontró el laboratorio."
        );
      }

      setCargandoQR(true);

      try {
        const configuracion =
          await obtenerConfiguracionQR(
            laboratorioId
          );

        setQrActual(
          configuracion.qrUrl || ""
        );
      } finally {
        setCargandoQR(false);
      }
    },
    []
  );

  // ===================================================
  // CARGAR LABORATORIO
  // ===================================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setMensaje(null);

      const datos =
        await obtenerConfiguracionLaboratorio();

      if (!datos) {
        throw new Error(
          "No se encontró la configuración del laboratorio."
        );
      }

      setLaboratorio(datos);
      colocarDatos(datos);
      setLogoError(false);

      if (datos.laboratorioId) {
        try {
          await cargarQR(
            datos.laboratorioId
          );
        } catch (error) {
          setMensaje({
            tipo: "error",
            texto:
              "No se pudo consultar el QR: " +
              obtenerMensajeError(error),
          });
        }
      }
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto:
          obtenerMensajeError(error),
      });
    } finally {
      setCargando(false);
    }
  }, [cargarQR]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // EDITAR INFORMACIÓN
  // ===================================================

  const iniciarEdicion = () => {
    if (!laboratorio) return;

    colocarDatos(laboratorio);
    setEditando(true);
    setMensaje(null);
  };

  const cancelarEdicion = () => {
    if (!laboratorio || guardando) return;

    colocarDatos(laboratorio);
    setEditando(false);
    setMensaje(null);
  };

  // ===================================================
  // VALIDAR INFORMACIÓN
  // ===================================================

  const validar = (): string => {
    if (nombre.trim().length < 2) {
      return "Ingresa un nombre válido.";
    }

    if (direccion.trim().length < 4) {
      return "Ingresa una dirección válida.";
    }

    if (
      !/^[0-9+\-\s()]{6,20}$/.test(
        telefono.trim()
      )
    ) {
      return "Ingresa un teléfono válido.";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      return "Ingresa un correo válido.";
    }

    return "";
  };

  // ===================================================
  // GUARDAR INFORMACIÓN GENERAL
  // ===================================================

  const guardarCambios = async () => {
    if (guardando) return;

    const validacion = validar();

    if (validacion) {
      setMensaje({
        tipo: "error",
        texto: validacion,
      });

      return;
    }

    try {
      setGuardando(true);
      setMensaje(null);

      await actualizarConfiguracionLaboratorio({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        email: email.trim().toLowerCase(),
      });

      const datos =
        await obtenerConfiguracionLaboratorio();

      if (!datos) {
        throw new Error(
          "No se pudo recuperar la configuración actualizada."
        );
      }

      setLaboratorio(datos);
      colocarDatos(datos);
      setEditando(false);

      setMensaje({
        tipo: "exito",
        texto:
          "Información actualizada correctamente.",
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto:
          obtenerMensajeError(error),
      });
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // SELECCIONAR QR
  // ===================================================

  const seleccionarQR = async () => {
    if (ocupadoQR) return;

    try {
      setProcesandoQR(true);
      setMensaje(null);

      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1,
        });

      if (resultado.canceled) {
        return;
      }

      const imagen = resultado.assets[0];

      if (!imagen?.uri) {
        throw new Error(
          "No se pudo leer la imagen seleccionada."
        );
      }

      // Procesamiento específico para Web
      // o Android/iOS.

      const imagenProcesada =
        await procesarImagenQR(
          imagen.uri
        );

      if (
        imagenProcesada.length >
        LIMITE_QR_BASE64
      ) {
        throw new Error(
          "La imagen supera el tamaño permitido."
        );
      }

      setQrNuevo(imagenProcesada);

      setMensaje({
        tipo: "exito",
        texto:
          "Imagen QR procesada correctamente. " +
          "Presiona Guardar QR para registrarla.",
      });
    } catch (error) {
      const texto =
        obtenerMensajeError(error);

      setMensaje({
        tipo: "error",
        texto,
      });

      mostrarAlerta(
        "Error al procesar QR",
        texto
      );
    } finally {
      setProcesandoQR(false);
    }
  };

  // ===================================================
  // GUARDAR QR
  // ===================================================

  const guardarQR = async () => {
    if (ocupadoQR) return;

    if (!laboratorio?.laboratorioId) {
      setMensaje({
        tipo: "error",
        texto:
          "No se encontró el laboratorio asociado.",
      });

      return;
    }

    if (!qrNuevo) {
      setMensaje({
        tipo: "error",
        texto:
          "Primero selecciona una imagen QR.",
      });

      return;
    }

    try {
      setGuardandoQR(true);
      setMensaje(null);

      const laboratorioId =
        laboratorio.laboratorioId;

      const imagenParaGuardar =
        qrNuevo;

      await guardarQRLaboratorio(
        laboratorioId,
        imagenParaGuardar
      );

      const configuracion =
        await obtenerConfiguracionQR(
          laboratorioId
        );

      if (
        configuracion.qrUrl !==
        imagenParaGuardar
      ) {
        throw new Error(
          "No se pudo verificar el QR guardado."
        );
      }

      setQrActual(
        configuracion.qrUrl
      );

      setQrNuevo("");

      setMensaje({
        tipo: "exito",
        texto:
          "QR guardado correctamente en Firestore.",
      });

      mostrarAlerta(
        "QR guardado",
        "El código QR bancario se guardó correctamente."
      );
    } catch (error) {
      const texto =
        obtenerMensajeError(error);

      setMensaje({
        tipo: "error",
        texto,
      });

      mostrarAlerta(
        "Error al guardar QR",
        texto
      );
    } finally {
      setGuardandoQR(false);
    }
  };

  // ===================================================
  // ELIMINAR QR
  // ===================================================

  const ejecutarEliminarQR = async () => {
    if (
      !laboratorio?.laboratorioId ||
      ocupadoQR
    ) {
      return;
    }

    try {
      setEliminandoQR(true);
      setMensaje(null);

      const laboratorioId =
        laboratorio.laboratorioId;

      await eliminarQRLaboratorio(
        laboratorioId
      );

      const configuracion =
        await obtenerConfiguracionQR(
          laboratorioId
        );

      if (configuracion.qrUrl) {
        throw new Error(
          "No se pudo verificar la eliminación del QR."
        );
      }

      setQrActual("");
      setQrNuevo("");

      setMensaje({
        tipo: "exito",
        texto:
          "QR eliminado correctamente.",
      });

      mostrarAlerta(
        "QR eliminado",
        "El código QR fue eliminado correctamente."
      );
    } catch (error) {
      const texto =
        obtenerMensajeError(error);

      setMensaje({
        tipo: "error",
        texto,
      });

      mostrarAlerta(
        "Error al eliminar QR",
        texto
      );
    } finally {
      setEliminandoQR(false);
    }
  };

  // ===================================================
  // CONFIRMAR ELIMINACIÓN
  // ===================================================

  const confirmarEliminarQR = () => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          "¿Deseas eliminar el código QR bancario?"
        )
      ) {
        ejecutarEliminarQR();
      }

      return;
    }

    Alert.alert(
      "Eliminar QR",
      "¿Estás seguro de eliminar el código QR?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: ejecutarEliminarQR,
        },
      ]
    );
  };

  // ===================================================
  // RECARGAR QR
  // ===================================================

  const actualizarQR = async () => {
    if (
      !laboratorio?.laboratorioId ||
      ocupadoQR
    ) {
      return;
    }

    try {
      setMensaje(null);

      await cargarQR(
        laboratorio.laboratorioId
      );

      setQrNuevo("");

      setMensaje({
        tipo: "exito",
        texto:
          "QR actualizado desde Firestore.",
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto:
          obtenerMensajeError(error),
      });
    }
  };

  // ===================================================
  // CARGANDO
  // ===================================================

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <ActivityIndicator
          size="large"
          color="#0284C7"
        />

        <Text style={styles.loadingTitle}>
          Configuración
        </Text>

        <Text style={styles.loadingText}>
          Cargando información del laboratorio...
        </Text>
      </SafeAreaView>
    );
  }

  // ===================================================
  // ERROR GENERAL
  // ===================================================

  if (!laboratorio) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <Text style={styles.errorTitle}>
          Configuración no disponible
        </Text>

        <Text style={styles.errorText}>
          {mensaje?.texto ||
            "No se pudo cargar el laboratorio."}
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={cargarDatos}
        >
          <Text style={styles.primaryButtonText}>
            Intentar nuevamente
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>
            Volver
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===================================================
  // IDENTIDAD VISUAL
  // ===================================================

  const colorPrimario = colorValido(
    laboratorio.colorPrimario
  )
    ? laboratorio.colorPrimario
    : "#2563EB";

  const colorSecundario = colorValido(
    laboratorio.colorSecundario
  )
    ? laboratorio.colorSecundario
    : "#14B8A6";

  const nombreVisible =
    laboratorio.nombreVisible ||
    laboratorio.nombre;

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#075985"
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
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ENCABEZADO */}

          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>
                ‹
              </Text>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>
                LABORATORIO
              </Text>

              <Text style={styles.headerTitle}>
                Configuración
              </Text>

              <Text style={styles.headerDescription}>
                Mantén actualizada la información
                general de tu laboratorio.
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <Text style={{ fontSize: 25 }}>
                ⚙️
              </Text>
            </View>
          </View>

          {/* MENSAJES */}

          {mensaje && (
            <View
              style={[
                styles.message,
                mensaje.tipo === "exito"
                  ? styles.messageSuccess
                  : styles.messageError,
              ]}
            >
              <Text
                style={{
                  color:
                    mensaje.tipo === "exito"
                      ? "#047857"
                      : "#B91C1C",
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {mensaje.tipo === "exito"
                  ? "✓ "
                  : "⚠ "}

                {mensaje.texto}
              </Text>
            </View>
          )}

          {/* IDENTIDAD */}

          <View style={styles.identityCard}>
            <View
              style={[
                styles.identityTop,
                {
                  backgroundColor: colorPrimario,
                },
              ]}
            >
              <View
                style={[
                  styles.identityDecoration,
                  {
                    backgroundColor:
                      colorSecundario,
                  },
                ]}
              />

              <View style={styles.logoContainer}>
                {laboratorio.logoUrl &&
                !logoError ? (
                  <Image
                    source={{
                      uri: laboratorio.logoUrl,
                    }}
                    style={styles.logo}
                    resizeMode="contain"
                    onError={() =>
                      setLogoError(true)
                    }
                  />
                ) : (
                  <Text style={{ fontSize: 27 }}>
                    🧪
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.identityName}>
                  {nombreVisible}
                </Text>

                <Text style={styles.identitySubtitle}>
                  {laboratorio.nombre}
                </Text>
              </View>
            </View>

            <View style={styles.identityBottom}>
              <View>
                <Text style={styles.identityLabel}>
                  ESTADO
                </Text>

                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    ● Activo
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.identityLabel}>
                  IDENTIFICADOR
                </Text>

                <Text style={styles.identityId}>
                  {laboratorio.laboratorioId}
                </Text>
              </View>
            </View>
          </View>

          {/* INFORMACIÓN GENERAL */}

          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                Información general
              </Text>

              <Text style={styles.sectionSubtitle}>
                Datos de contacto del laboratorio.
              </Text>
            </View>

            {!editando && (
              <Pressable
                style={styles.editButton}
                onPress={iniciarEdicion}
              >
                <Text style={styles.editButtonText}>
                  ✎ Editar
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.formCard}>
            <Campo
              titulo="Nombre del laboratorio"
              valor={nombre}
              onChange={setNombre}
              editable={editando}
              placeholder="Nombre del laboratorio"
              icono="🏥"
            />

            <Campo
              titulo="Dirección"
              valor={direccion}
              onChange={setDireccion}
              editable={editando}
              placeholder="Dirección del laboratorio"
              icono="📍"
              multiline
            />

            <Campo
              titulo="Teléfono"
              valor={telefono}
              onChange={setTelefono}
              editable={editando}
              placeholder="Número de teléfono"
              icono="☎"
              keyboardType="phone-pad"
            />

            <Campo
              titulo="Correo electrónico"
              valor={email}
              onChange={setEmail}
              editable={editando}
              placeholder="correo@laboratorio.com"
              icono="✉"
              keyboardType="email-address"
            />

            <View style={styles.lockedField}>
              <Text style={{ fontSize: 22 }}>
                🔒
              </Text>

              <View style={{ flex: 1 }}>
                <Text style={styles.lockedLabel}>
                  Laboratorio asociado
                </Text>

                <Text style={styles.lockedValue}>
                  {laboratorio.laboratorioId}
                </Text>

                <Text style={styles.lockedHelp}>
                  Este valor no puede modificarse
                  desde esta cuenta.
                </Text>
              </View>
            </View>

            {editando && (
              <View style={styles.actions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={cancelarEdicion}
                  disabled={guardando}
                >
                  <Text style={styles.cancelButtonText}>
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    guardando && styles.disabled,
                  ]}
                  onPress={guardarCambios}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      Guardar cambios
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* CONFIGURACIÓN QR */}

          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                Configuración de pagos QR
              </Text>

              <Text style={styles.sectionSubtitle}>
                Administra el código QR bancario.
              </Text>
            </View>
          </View>

          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <View style={styles.qrIcon}>
                <Text style={styles.qrIconText}>
                  ▦
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.qrTitle}>
                  Código QR de cobro
                </Text>

                <Text style={styles.qrDescription}>
                  Este QR se mostrará al registrar
                  ventas con pago QR.
                </Text>
              </View>
            </View>

            {/* ESTADO */}

            <View
              style={[
                styles.qrBadge,
                qrActual
                  ? styles.qrBadgeActive
                  : styles.qrBadgePending,
              ]}
            >
              <Text
                style={{
                  color: qrActual
                    ? "#15803D"
                    : "#92400E",
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                {qrActual
                  ? "● QR configurado"
                  : "● QR pendiente de configurar"}
              </Text>
            </View>

            {/* CONTENIDO */}

            {cargandoQR ? (
              <View style={styles.qrLoading}>
                <ActivityIndicator
                  color="#0284C7"
                />

                <Text style={styles.qrHelp}>
                  Consultando QR en Firestore...
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.qrLabel}>
                  QR bancario actual
                </Text>

                {qrActual ? (
                  <View style={styles.qrImageBox}>
                    <Image
                      source={{ uri: qrActual }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />

                    <Text style={styles.qrHelp}>
                      Imagen recuperada de Firestore
                    </Text>
                  </View>
                ) : (
                  <View style={styles.qrEmpty}>
                    <Text style={styles.qrEmptyIcon}>
                      ▦
                    </Text>

                    <Text style={styles.qrEmptyTitle}>
                      No existe un QR registrado
                    </Text>

                    <Text style={styles.qrHelp}>
                      Selecciona la imagen QR
                      proporcionada por tu banco.
                    </Text>
                  </View>
                )}

                {/* SELECCIONAR */}

                <Text style={styles.qrLabel}>
                  {qrActual
                    ? "Actualizar QR bancario"
                    : "Registrar QR bancario"}
                </Text>

                <Pressable
                  style={[
                    styles.qrSelectButton,
                    ocupadoQR && styles.disabled,
                  ]}
                  onPress={seleccionarQR}
                  disabled={ocupadoQR}
                >
                  {procesandoQR ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.qrButtonText}>
                      Seleccionar imagen QR
                    </Text>
                  )}
                </Pressable>

                {/* VISTA PREVIA */}

                {qrNuevo ? (
                  <View style={styles.qrPreview}>
                    <Text style={styles.qrLabel}>
                      Vista previa del nuevo QR
                    </Text>

                    <Image
                      source={{ uri: qrNuevo }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />

                    <Text style={styles.qrHelp}>
                      Imagen procesada correctamente.
                    </Text>

                    <Text style={styles.qrHelp}>
                      Tamaño Base64:{" "}
                      {(
                        qrNuevo.length / 1024
                      ).toFixed(1)}
                      {" KB"}
                    </Text>

                    <Text style={styles.qrHelp}>
                      Comprueba que el QR se pueda
                      escanear antes de guardarlo.
                    </Text>
                  </View>
                ) : null}

                {/* GUARDAR */}

                <Pressable
                  style={[
                    styles.qrSaveButton,
                    (!qrNuevo || ocupadoQR) &&
                      styles.disabled,
                  ]}
                  onPress={guardarQR}
                  disabled={!qrNuevo || ocupadoQR}
                >
                  {guardandoQR ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.qrButtonText}>
                      {qrActual
                        ? "Guardar nuevo QR"
                        : "Guardar QR en Firestore"}
                    </Text>
                  )}
                </Pressable>

                {/* ELIMINAR */}

                {qrActual ? (
                  <Pressable
                    style={[
                      styles.qrDeleteButton,
                      ocupadoQR && styles.disabled,
                    ]}
                    onPress={confirmarEliminarQR}
                    disabled={ocupadoQR}
                  >
                    {eliminandoQR ? (
                      <ActivityIndicator
                        color="#DC2626"
                      />
                    ) : (
                      <Text style={styles.qrDeleteText}>
                        Eliminar QR bancario
                      </Text>
                    )}
                  </Pressable>
                ) : null}

                {/* RECARGAR */}

                <Pressable
                  style={[
                    styles.qrRefreshButton,
                    ocupadoQR && styles.disabled,
                  ]}
                  onPress={actualizarQR}
                  disabled={ocupadoQR}
                >
                  <Text style={styles.qrRefreshText}>
                    ↻ Actualizar desde Firestore
                  </Text>
                </Pressable>
              </>
            )}

            {/* INFORMACIÓN IMPORTANTE */}

            <View style={styles.qrNotice}>
              <Text style={styles.qrNoticeTitle}>
                Información importante
              </Text>

              <Text style={styles.qrNoticeText}>
                El QR bancario se guarda en Firebase
                Firestore asociado al laboratorio.
              </Text>

              <Text style={styles.qrNoticeText}>
                Antes de registrar una venta,
                recepción debe verificar
                manualmente el pago.
              </Text>

              <Text style={styles.qrNoticeText}>
                El QR no confirma automáticamente
                que el dinero haya sido recibido.
              </Text>
            </View>
          </View>

          {/* INFORMACIÓN DE CUENTA */}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Text>ℹ</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>
                Información de la cuenta
              </Text>

              <Text style={styles.infoText}>
                Los cambios realizados aquí
                corresponden únicamente al
                laboratorio asociado.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =====================================================
// COMPONENTE CAMPO
// =====================================================

function Campo({
  titulo,
  valor,
  onChange,
  editable,
  placeholder,
  icono,
  multiline = false,
  keyboardType = "default",
}: CampoProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {titulo}
      </Text>

      <View
        style={[
          styles.inputContainer,
          !editable &&
            styles.inputContainerDisabled,
          multiline &&
            styles.inputContainerMultiline,
        ]}
      >
        <Text style={styles.inputIcon}>
          {icono}
        </Text>

        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            !editable && styles.inputDisabled,
          ]}
          value={valor}
          onChangeText={onChange}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={
            keyboardType === "email-address"
              ? "none"
              : "sentences"
          }
          autoCorrect={
            keyboardType !== "email-address"
          }
        />
      </View>
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  scroll: {
    paddingBottom: 45,
  },

  header: {
    minHeight: 190,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 25,
    backgroundColor: "#075985",
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,.1)",
  },

  backText: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "300",
  },

  headerEyebrow: {
    color: "#BAE6FD",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },

  headerTitle: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },

  headerDescription: {
    marginTop: 5,
    color: "#E0F2FE",
    fontSize: 10,
    lineHeight: 15,
  },

  headerIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,.12)",
  },

  message: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },

  messageSuccess: {
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
  },

  messageError: {
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F2",
  },

  identityCard: {
    overflow: "hidden",
    marginHorizontal: 14,
    marginTop: -15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    elevation: 4,
  },

  identityTop: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 105,
    padding: 17,
  },

  identityDecoration: {
    position: "absolute",
    width: 150,
    height: 150,
    right: -65,
    top: -65,
    borderRadius: 75,
    opacity: 0.55,
  },

  logoContainer: {
    width: 61,
    height: 61,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 13,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },

  logo: {
    width: 54,
    height: 54,
  },

  identityName: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  identitySubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,.82)",
    fontSize: 9,
  },

  identityBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 13,
  },

  identityLabel: {
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "800",
  },

  activeBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
  },

  activeBadgeText: {
    color: "#15803D",
    fontSize: 9,
    fontWeight: "800",
  },

  identityId: {
    marginTop: 5,
    color: "#475569",
    fontSize: 9,
    fontWeight: "700",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 15,
    marginTop: 27,
    marginBottom: 11,
    gap: 10,
  },

  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },

  sectionSubtitle: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 10,
  },

  editButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
  },

  editButtonText: {
    color: "#0369A1",
    fontSize: 10,
    fontWeight: "900",
  },

  formCard: {
    marginHorizontal: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
  },

  field: {
    marginBottom: 15,
  },

  label: {
    marginBottom: 7,
    color: "#334155",
    fontSize: 10,
    fontWeight: "800",
  },

  inputContainer: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },

  inputContainerDisabled: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  inputContainerMultiline: {
    alignItems: "flex-start",
    minHeight: 90,
  },

  inputIcon: {
    marginLeft: 12,
    marginRight: 8,
    marginTop: 14,
    fontSize: 14,
  },

  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 13,
    paddingRight: 12,
    color: "#0F172A",
    fontSize: 11,
  },

  inputMultiline: {
    minHeight: 85,
    textAlignVertical: "top",
  },

  inputDisabled: {
    color: "#475569",
  },

  lockedField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 11,
    backgroundColor: "#F8FAFC",
  },

  lockedLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
  },

  lockedValue: {
    marginTop: 3,
    color: "#334155",
    fontSize: 10,
    fontWeight: "700",
  },

  lockedHelp: {
    marginTop: 3,
    color: "#94A3B8",
    fontSize: 9,
  },

  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 19,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },

  cancelButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },

  cancelButtonText: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "800",
  },

  saveButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#0284C7",
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.5,
  },

  qrCard: {
    marginHorizontal: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
  },

  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  qrIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },

  qrIconText: {
    color: "#0369A1",
    fontSize: 32,
    fontWeight: "900",
  },

  qrTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
  },

  qrDescription: {
    marginTop: 5,
    color: "#64748B",
    fontSize: 11,
    lineHeight: 17,
  },

  qrBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },

  qrBadgeActive: {
    backgroundColor: "#DCFCE7",
  },

  qrBadgePending: {
    backgroundColor: "#FEF3C7",
  },

  qrLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 12,
  },

  qrImageBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginBottom: 20,
  },

  qrImage: {
    width: 240,
    height: 240,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
  },

  qrEmpty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },

  qrEmptyIcon: {
    color: "#94A3B8",
    fontSize: 50,
  },

  qrEmptyTitle: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },

  qrHelp: {
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 17,
  },

  qrSelectButton: {
    backgroundColor: "#475569",
    borderRadius: 11,
    padding: 15,
    alignItems: "center",
    marginBottom: 12,
  },

  qrSaveButton: {
    backgroundColor: "#0284C7",
    borderRadius: 11,
    padding: 15,
    alignItems: "center",
    marginBottom: 12,
  },

  qrButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  qrPreview: {
    backgroundColor: "#EFF6FF",
    borderRadius: 13,
    padding: 18,
    alignItems: "center",
    marginBottom: 15,
  },

  qrDeleteButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 11,
    padding: 15,
    alignItems: "center",
    marginBottom: 12,
  },

  qrDeleteText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "900",
  },

  qrRefreshButton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 11,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
  },

  qrRefreshText: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "800",
  },

  qrLoading: {
    padding: 25,
    alignItems: "center",
  },

  qrNotice: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 12,
    padding: 15,
  },

  qrNoticeTitle: {
    color: "#1E40AF",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
  },

  qrNoticeText: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 7,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 13,
    padding: 13,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 13,
    backgroundColor: "#EFF6FF",
  },

  infoIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#DBEAFE",
  },

  infoTitle: {
    color: "#1E3A8A",
    fontSize: 10,
    fontWeight: "900",
  },

  infoText: {
    marginTop: 3,
    color: "#475569",
    fontSize: 9,
    lineHeight: 15,
  },

  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#F8FAFC",
  },

  loadingTitle: {
    marginTop: 15,
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },

  loadingText: {
    marginTop: 5,
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
  },

  errorTitle: {
    color: "#0F172A",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  errorText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
  },

  primaryButton: {
    minWidth: 190,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderRadius: 11,
    backgroundColor: "#0284C7",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  secondaryButton: {
    minWidth: 190,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },

  secondaryButtonText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
});