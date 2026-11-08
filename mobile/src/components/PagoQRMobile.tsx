import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Pressable,
  Switch,
  StyleSheet,
} from "react-native";

import {
  obtenerConfiguracionQR,
} from "../services/qrCobroService";

type Props = {
  laboratorioId: string;
  total: number;
  onConfirmar: (confirmado: boolean) => void;
};

export default function PagoQRMobile({
  laboratorioId,
  total,
  onConfirmar,
}: Props) {
  const [qrUrl, setQrUrl] = useState("");

  const [nombreLaboratorio, setNombreLaboratorio] =
    useState("");

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [confirmado, setConfirmado] =
    useState(false);

  const [recargar, setRecargar] =
    useState(0);

  useEffect(() => {
    let activo = true;

    async function cargarQR() {
      setCargando(true);
      setError("");
      setConfirmado(false);
      onConfirmar(false);

      try {
        const configuracion =
          await obtenerConfiguracionQR(
            laboratorioId
          );

        if (!activo) return;

        setQrUrl(configuracion.qrUrl);

        setNombreLaboratorio(
          configuracion.laboratorioNombre
        );
      } catch (err) {
        if (activo) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el QR."
          );

          setQrUrl("");
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarQR();

    return () => {
      activo = false;
    };
  }, [laboratorioId, recargar]);

  useEffect(() => {
    setConfirmado(false);
    onConfirmar(false);
  }, [total]);

  function cambiarConfirmacion(valor: boolean) {
    if (!qrUrl || cargando || error) {
      setConfirmado(false);
      onConfirmar(false);
      return;
    }

    setConfirmado(valor);
    onConfirmar(valor);
  }

  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <ActivityIndicator
          size="large"
          color="#0284C7"
        />

        <Text style={styles.descripcion}>
          Cargando código QR...
        </Text>
      </View>
    );
  }

  if (error || !qrUrl) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>
          Pago mediante QR
        </Text>

        <Text style={styles.error}>
          {error ||
            "El administrador todavía no configuró un código QR para este laboratorio."}
        </Text>

        <Pressable
          style={styles.botonActualizar}
          onPress={() =>
            setRecargar((anterior) => anterior + 1)
          }
        >
          <Text style={styles.botonTexto}>
            Actualizar QR
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>
        PAGO MEDIANTE QR
      </Text>

      <Text style={styles.laboratorio}>
        {nombreLaboratorio}
      </Text>

      <View style={styles.contenedorImagen}>
        <Image
          source={{ uri: qrUrl }}
          style={styles.imagenQR}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.total}>
        Total: Bs {Number(total || 0).toFixed(2)}
      </Text>

      <Text style={styles.descripcion}>
        Solicita al paciente que escanee
        el código QR con su aplicación
        bancaria y realice el pago.
      </Text>

      <View style={styles.advertencia}>
        <Text style={styles.advertenciaTexto}>
          Verifica que el dinero haya
          llegado a la cuenta bancaria
          del laboratorio antes de
          registrar la venta.
        </Text>
      </View>

      <View style={styles.confirmacion}>
        <Text style={styles.confirmacionTexto}>
          Confirmo que recibimos el pago
        </Text>

        <Switch
          value={confirmado}
          onValueChange={cambiarConfirmacion}
          trackColor={{
            false: "#CBD5E1",
            true: "#7DD3FC",
          }}
          thumbColor={
            confirmado
              ? "#0284C7"
              : "#F1F5F9"
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 16,
    padding: 20,
    marginTop: 18,
    alignItems: "center",
  },

  titulo: {
    color: "#0F3B70",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  laboratorio: {
    color: "#475569",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  contenedorImagen: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  imagenQR: {
    width: 250,
    height: 250,
  },

  total: {
    color: "#0284C7",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
  },

  descripcion: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },

  advertencia: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    width: "100%",
  },

  advertenciaTexto: {
    color: "#9A3412",
    fontSize: 12,
    lineHeight: 19,
  },

  confirmacion: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    gap: 12,
  },

  confirmacionTexto: {
    flex: 1,
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "600",
  },

  error: {
    color: "#DC2626",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 18,
  },

  botonActualizar: {
    backgroundColor: "#0284C7",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 9,
    marginTop: 12,
  },

  botonTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});