import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import * as ImageManipulator from "expo-image-manipulator";

import {
  obtenerConfiguracionQR,
  guardarQRLaboratorio,
  eliminarQRLaboratorio,
} from "../services/qrCobroService";

// ========================================
// TIPOS
// ========================================

type Props = {
  laboratorioId: string;
};

// Límite del servicio y las reglas actuales.
const LIMITE_QR = 150000;

// ========================================
// FUNCIONES AUXILIARES
// ========================================

function obtenerError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

function mostrarMensaje(
  titulo: string,
  mensaje: string
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }
  } else {
    Alert.alert(titulo, mensaje);
  }
}

// ========================================
// COMPRIMIR IMAGEN QR
// ========================================

async function comprimirImagenQR(
  uri: string
): Promise<string> {
  if (!uri) {
    throw new Error(
      "No se encontró la imagen seleccionada."
    );
  }

  // Se prueban diferentes tamaños.
  // Se conserva PNG para mantener
  // los bordes definidos del QR.

  const dimensiones = [
    800,
    700,
    600,
    500,
    450,
    400,
    350,
    300,
    250,
  ];

  for (const dimension of dimensiones) {
    const contexto =
      ImageManipulator.ImageManipulator.manipulate(
        uri
      );

    contexto.resize({
      width: dimension,
      height: null,
    });

    const imagenProcesada =
      await contexto.renderAsync();

    const resultado =
      await imagenProcesada.saveAsync({
        format: ImageManipulator.SaveFormat.PNG,
        compress: 1,
        base64: true,
      });

    if (!resultado.base64) {
      continue;
    }

    const imagenBase64 =
      `data:image/png;base64,${resultado.base64}`;

    if (imagenBase64.length <= LIMITE_QR) {
      return imagenBase64;
    }
  }

  throw new Error(
    "No fue posible reducir la imagen QR al tamaño permitido. " +
    "Prueba con una imagen que tenga menos elementos alrededor del código QR."
  );
}

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

export default function ConfiguracionQRMobile({
  laboratorioId,
}: Props) {
  // ======================================
  // ESTADOS
  // ======================================

  const [qrActual, setQrActual] =
    useState("");

  const [qrNuevo, setQrNuevo] =
    useState("");

  const [
    nombreLaboratorio,
    setNombreLaboratorio,
  ] = useState("");

  const [cargando, setCargando] =
    useState(true);

  const [procesandoImagen, setProcesandoImagen] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [eliminando, setEliminando] =
    useState(false);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  // ======================================
  // CARGAR QR DESDE FIRESTORE
  // ======================================

  const cargarQR = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "No se encontró el identificador del laboratorio."
      );

      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const configuracion =
        await obtenerConfiguracionQR(
          laboratorioId
        );

      setQrActual(
        configuracion.qrUrl || ""
      );

      setNombreLaboratorio(
        configuracion.laboratorioNombre || ""
      );
    } catch (err) {
      setError(obtenerError(err));
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  // ======================================
  // CARGA INICIAL
  // ======================================

  useEffect(() => {
    cargarQR();
  }, [cargarQR]);

  // ======================================
  // SELECCIONAR Y COMPRIMIR IMAGEN
  // ======================================

  async function seleccionarImagen() {
    if (
      guardando ||
      eliminando ||
      procesandoImagen
    ) {
      return;
    }

    try {
      setProcesandoImagen(true);
      setError("");
      setMensaje("");

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
          "No se pudo obtener la imagen seleccionada."
        );
      }

      // Comprimir automáticamente.
      const imagenBase64 =
        await comprimirImagenQR(
          imagen.uri
        );

      // Verificación adicional.
      if (
        imagenBase64.length > LIMITE_QR
      ) {
        throw new Error(
          "La imagen continúa superando el tamaño permitido."
        );
      }

      setQrNuevo(imagenBase64);

      setMensaje(
        "Imagen QR procesada correctamente. " +
        "Ahora puedes guardarla en Firestore."
      );
    } catch (err) {
      setError(obtenerError(err));

      mostrarMensaje(
        "Error al seleccionar QR",
        obtenerError(err)
      );
    } finally {
      setProcesandoImagen(false);
    }
  }

  // ======================================
  // GUARDAR QR EN FIRESTORE
  // ======================================

  async function guardarQR() {
    if (
      guardando ||
      eliminando ||
      procesandoImagen
    ) {
      return;
    }

    if (!laboratorioId) {
      mostrarMensaje(
        "Error",
        "No se encontró el laboratorio."
      );

      return;
    }

    if (!qrNuevo) {
      mostrarMensaje(
        "Imagen pendiente",
        "Primero selecciona una imagen QR."
      );

      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const imagenParaGuardar = qrNuevo;

      // Guardar en Firestore.
      await guardarQRLaboratorio(
        laboratorioId,
        imagenParaGuardar
      );

      // Consultar nuevamente.
      const configuracion =
        await obtenerConfiguracionQR(
          laboratorioId
        );

      // Verificar persistencia.
      if (
        configuracion.qrUrl !==
        imagenParaGuardar
      ) {
        throw new Error(
          "El QR no coincide con el valor guardado en Firestore."
        );
      }

      // Actualizar interfaz.
      setQrActual(
        configuracion.qrUrl
      );

      setQrNuevo("");

      setMensaje(
        "El QR bancario fue guardado correctamente en Firestore."
      );

      mostrarMensaje(
        "QR guardado",
        "El código QR bancario fue guardado correctamente."
      );
    } catch (err) {
      setError(obtenerError(err));

      mostrarMensaje(
        "Error al guardar QR",
        obtenerError(err)
      );
    } finally {
      setGuardando(false);
    }
  }

  // ======================================
  // ELIMINAR QR DE FIRESTORE
  // ======================================

  async function eliminarQR() {
    if (
      guardando ||
      eliminando ||
      procesandoImagen
    ) {
      return;
    }

    if (!laboratorioId) {
      mostrarMensaje(
        "Error",
        "No se encontró el laboratorio."
      );

      return;
    }

    try {
      setEliminando(true);
      setError("");
      setMensaje("");

      // Eliminar desde Firestore.
      await eliminarQRLaboratorio(
        laboratorioId
      );

      // Verificar eliminación.
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

      setMensaje(
        "El QR bancario fue eliminado correctamente."
      );

      mostrarMensaje(
        "QR eliminado",
        "El código QR fue eliminado de Firestore."
      );
    } catch (err) {
      setError(obtenerError(err));

      mostrarMensaje(
        "Error al eliminar QR",
        obtenerError(err)
      );
    } finally {
      setEliminando(false);
    }
  }

  // ======================================
  // CONFIRMAR ELIMINACIÓN
  // ======================================

  function confirmarEliminacion() {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          "¿Estás seguro de eliminar el código QR bancario?"
        )
      ) {
        eliminarQR();
      }

      return;
    }

    Alert.alert(
      "Eliminar QR",
      "¿Estás seguro de eliminar el código QR bancario?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: eliminarQR,
        },
      ]
    );
  }

  // ======================================
  // ACTUALIZAR DESDE FIRESTORE
  // ======================================

  async function actualizarQR() {
    if (
      guardando ||
      eliminando ||
      procesandoImagen
    ) {
      return;
    }

    setQrNuevo("");
    setMensaje("");

    await cargarQR();
  }

  // ======================================
  // INTERFAZ DE CARGA
  // ======================================

  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <ActivityIndicator
          size="large"
          color="#0284C7"
        />

        <Text style={styles.descripcion}>
          Cargando configuración QR...
        </Text>
      </View>
    );
  }

  // ======================================
  // INTERFAZ PRINCIPAL
  // ======================================

  return (
    <View style={styles.contenedor}>

      {/* ENCABEZADO */}

      <Text style={styles.titulo}>
        Configuración de pagos QR
      </Text>

      <Text style={styles.descripcion}>
        Configura el código QR bancario
        que utilizará el laboratorio
        para recibir pagos.
      </Text>

      {nombreLaboratorio ? (
        <Text style={styles.laboratorio}>
          {nombreLaboratorio}
        </Text>
      ) : null}

      {/* MENSAJES */}

      {error ? (
        <View style={styles.errorCaja}>
          <Text style={styles.errorTexto}>
            {error}
          </Text>
        </View>
      ) : null}

      {mensaje ? (
        <View style={styles.exitoCaja}>
          <Text style={styles.exitoTexto}>
            {mensaje}
          </Text>
        </View>
      ) : null}

      {/* QR ACTUAL */}

      <View style={styles.seccion}>
        <Text style={styles.subtitulo}>
          QR bancario actual
        </Text>

        {qrActual ? (
          <>
            <View style={styles.imagenContenedor}>
              <Image
                source={{
                  uri: qrActual,
                }}
                style={styles.imagen}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.estadoCorrecto}>
              QR configurado correctamente
            </Text>
          </>
        ) : (
          <View style={styles.sinQR}>
            <Text style={styles.sinQRTexto}>
              Todavía no se registró
              un código QR bancario.
            </Text>
          </View>
        )}
      </View>

      {/* SELECCIONAR QR */}

      <View style={styles.seccion}>
        <Text style={styles.subtitulo}>
          {qrActual
            ? "Actualizar código QR"
            : "Registrar código QR"}
        </Text>

        <Pressable
          style={[
            styles.botonSeleccionar,
            procesandoImagen &&
              styles.deshabilitado,
          ]}
          onPress={seleccionarImagen}
          disabled={
            procesandoImagen ||
            guardando ||
            eliminando
          }
        >
          {procesandoImagen ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.botonTexto}>
              Seleccionar imagen QR
            </Text>
          )}
        </Pressable>

        {/* VISTA PREVIA */}

        {qrNuevo ? (
          <View style={styles.vistaPrevia}>
            <Text style={styles.subtitulo}>
              Vista previa del nuevo QR
            </Text>

            <View style={styles.imagenContenedor}>
              <Image
                source={{
                  uri: qrNuevo,
                }}
                style={styles.imagen}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.descripcion}>
              La imagen ya fue procesada
              y está lista para guardar.
            </Text>
          </View>
        ) : null}

        {/* GUARDAR */}

        <Pressable
          style={[
            styles.botonGuardar,
            (
              !qrNuevo ||
              guardando ||
              eliminando ||
              procesandoImagen
            ) && styles.deshabilitado,
          ]}
          disabled={
            !qrNuevo ||
            guardando ||
            eliminando ||
            procesandoImagen
          }
          onPress={guardarQR}
        >
          {guardando ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.botonTexto}>
              {qrActual
                ? "Actualizar QR en Firestore"
                : "Guardar QR en Firestore"}
            </Text>
          )}
        </Pressable>

        {/* ELIMINAR */}

        {qrActual ? (
          <Pressable
            style={[
              styles.botonEliminar,
              (
                guardando ||
                eliminando ||
                procesandoImagen
              ) && styles.deshabilitado,
            ]}
            disabled={
              guardando ||
              eliminando ||
              procesandoImagen
            }
            onPress={confirmarEliminacion}
          >
            {eliminando ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text style={styles.botonTexto}>
                Eliminar QR bancario
              </Text>
            )}
          </Pressable>
        ) : null}

        {/* RECARGAR */}

        <Pressable
          style={styles.botonActualizar}
          onPress={actualizarQR}
          disabled={
            guardando ||
            eliminando ||
            procesandoImagen
          }
        >
          <Text style={styles.botonActualizarTexto}>
            Actualizar desde Firestore
          </Text>
        </Pressable>
      </View>

      {/* INFORMACIÓN */}

      <View style={styles.informacion}>
        <Text style={styles.informacionTitulo}>
          Información importante
        </Text>

        <Text style={styles.informacionTexto}>
          El código QR se almacena en
          Firebase Firestore y queda
          asociado al laboratorio.
        </Text>

        <Text style={styles.informacionTexto}>
          La recepción debe verificar
          manualmente que el pago fue
          recibido antes de registrar
          la venta.
        </Text>

        <Text style={styles.informacionTexto}>
          El código QR no confirma
          automáticamente el pago.
        </Text>
      </View>
    </View>
  );
}

// ========================================
// ESTILOS COMPLETOS
// ========================================

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 15,
  },

  titulo: {
    color: "#0F3B70",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  descripcion: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 15,
  },

  laboratorio: {
    color: "#0284C7",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 20,
  },

  seccion: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },

  subtitulo: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 15,
    textAlign: "center",
  },

  imagenContenedor: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    width: "100%",
  },

  imagen: {
    width: 240,
    height: 240,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
  },

  sinQR: {
    backgroundColor: "#E2E8F0",
    padding: 25,
    borderRadius: 10,
    width: "100%",
  },

  sinQRTexto: {
    color: "#64748B",
    textAlign: "center",
    fontSize: 13,
  },

  estadoCorrecto: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },

  botonSeleccionar: {
    backgroundColor: "#475569",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },

  botonGuardar: {
    backgroundColor: "#0284C7",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginTop: 15,
  },

  botonEliminar: {
    backgroundColor: "#DC2626",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginTop: 12,
  },

  botonTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },

  vistaPrevia: {
    marginTop: 20,
    alignItems: "center",
    width: "100%",
  },

  deshabilitado: {
    opacity: 0.5,
  },

  botonActualizar: {
    backgroundColor: "#E0F2FE",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginTop: 12,
  },

  botonActualizarTexto: {
    color: "#0369A1",
    fontWeight: "800",
    fontSize: 12,
  },

  informacion: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 15,
  },

  informacionTitulo: {
    color: "#1E40AF",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },

  informacionTexto: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 8,
  },

  errorCaja: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 13,
    borderRadius: 10,
    marginBottom: 15,
  },

  errorTexto: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 19,
  },

  exitoCaja: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 13,
    borderRadius: 10,
    marginBottom: 15,
  },

  exitoTexto: {
    color: "#047857",
    fontSize: 12,
    lineHeight: 19,
  },
});