import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  cambiarPasswordUsuario,
  validarPasswordNueva,
} from "../services/passwordService";

// =====================================================
// TIPOS
// =====================================================

type Props = {
  visible: boolean;
  usuarioId: string;
  nombreUsuario: string;
  onClose: () => void;
  onSuccess?: () => void;
};

// =====================================================
// MOSTRAR MENSAJES EN WEB Y MOBILE
// =====================================================

function mostrarMensaje(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

// =====================================================
// COMPONENTE CAMBIAR CONTRASEÑA
// =====================================================

export default function CambiarPasswordModal({
  visible,
  usuarioId,
  nombreUsuario,
  onClose,
  onSuccess,
}: Props) {
  const [password, setPassword] = useState("");

  const [confirmarPassword, setConfirmarPassword] =
    useState("");

  const [mostrarPassword, setMostrarPassword] =
    useState(false);

  const [guardando, setGuardando] = useState(false);

  // ===================================================
  // LIMPIAR FORMULARIO
  // ===================================================

  const limpiarFormulario = () => {
    setPassword("");
    setConfirmarPassword("");
    setMostrarPassword(false);
  };

  // ===================================================
  // CERRAR MODAL
  // ===================================================

  const cerrarModal = () => {
    if (guardando) {
      return;
    }

    limpiarFormulario();
    onClose();
  };

  // ===================================================
  // VALIDAR Y CAMBIAR CONTRASEÑA
  // ===================================================

  const guardarPassword = async () => {
    if (guardando) {
      return;
    }

    // Validar usuario seleccionado
    if (!usuarioId || !usuarioId.trim()) {
      mostrarMensaje(
        "Error",
        "No se ha seleccionado ningún usuario."
      );

      return;
    }

    // Validar contraseña vacía
    if (!password.trim()) {
      mostrarMensaje(
        "Error",
        "Ingresa una nueva contraseña."
      );

      return;
    }

    // Validar seguridad
    if (!validarPasswordNueva(password)) {
      mostrarMensaje(
        "Contraseña inválida",
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
      );

      return;
    }

    // Validar confirmación
    if (!confirmarPassword.trim()) {
      mostrarMensaje(
        "Error",
        "Debes confirmar la contraseña."
      );

      return;
    }

    // Validar coincidencia
    if (password !== confirmarPassword) {
      mostrarMensaje(
        "Error",
        "Las contraseñas no coinciden."
      );

      return;
    }

    // =================================================
    // GUARDAR CONTRASEÑA EN FIREBASE AUTHENTICATION
    // =================================================

    try {
      setGuardando(true);

      console.log(
        "Iniciando cambio de contraseña para UID:",
        usuarioId
      );

      // El servicio devuelve un mensaje de éxito (string).
      // Si ocurre un error, lanza una excepción.
      const mensaje = await cambiarPasswordUsuario(
        usuarioId.trim(),
        password
      );

      console.log(
        "Contraseña actualizada correctamente:",
        mensaje
      );

      // Limpiar formulario después del éxito
      limpiarFormulario();

      // Cerrar modal
      onClose();

      // Actualizar información en pantalla
      if (onSuccess) {
        onSuccess();
      }

      // Confirmar al usuario
      mostrarMensaje(
        "Contraseña actualizada",
        `La contraseña de ${
          nombreUsuario || "el usuario"
        } se cambió correctamente.`
      );

    } catch (error) {
      console.error(
        "Error al cambiar contraseña:",
        error
      );

      const mensajeError =
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la contraseña.";

      mostrarMensaje(
        "Error al cambiar contraseña",
        mensajeError
      );

    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cerrarModal}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.modalContenedor}>

          {/* ENCABEZADO */}

          <View style={styles.encabezado}>
            <Text style={styles.titulo}>
              Cambiar contraseña
            </Text>

            <Pressable
              onPress={cerrarModal}
              disabled={guardando}
            >
              <Text style={styles.cerrar}>
                ×
              </Text>
            </Pressable>
          </View>

          {/* INFORMACIÓN DEL USUARIO */}

          <View style={styles.usuarioContenedor}>
            <Text style={styles.usuarioEtiqueta}>
              Usuario seleccionado
            </Text>

            <Text style={styles.usuarioNombre}>
              {nombreUsuario || "Sin nombre"}
            </Text>
          </View>

          {/* NUEVA CONTRASEÑA */}

          <Text style={styles.etiqueta}>
            Nueva contraseña *
          </Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Ingresa la nueva contraseña"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!mostrarPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!guardando}
          />

          {/* CONFIRMAR CONTRASEÑA */}

          <Text style={styles.etiqueta}>
            Confirmar contraseña *
          </Text>

          <TextInput
            style={styles.input}
            value={confirmarPassword}
            onChangeText={setConfirmarPassword}
            placeholder="Repite la nueva contraseña"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!mostrarPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!guardando}
          />

          {/* MOSTRAR CONTRASEÑAS */}

          <Pressable
            style={styles.mostrarContenedor}
            onPress={() =>
              setMostrarPassword(!mostrarPassword)
            }
            disabled={guardando}
          >
            <Text style={styles.mostrarTexto}>
              {mostrarPassword
                ? "Ocultar contraseñas"
                : "Mostrar contraseñas"}
            </Text>
          </Pressable>

          {/* REQUISITOS */}

          <View style={styles.requisitos}>
            <Text style={styles.requisitosTitulo}>
              Requisitos de seguridad:
            </Text>

            <Text style={styles.requisitosTexto}>
              • Mínimo 8 caracteres
            </Text>

            <Text style={styles.requisitosTexto}>
              • Una letra mayúscula
            </Text>

            <Text style={styles.requisitosTexto}>
              • Una letra minúscula
            </Text>

            <Text style={styles.requisitosTexto}>
              • Un número
            </Text>

            <Text style={styles.requisitosTexto}>
              • Un carácter especial
            </Text>
          </View>

          {/* BOTONES */}

          <View style={styles.botones}>
            <Pressable
              style={styles.botonCancelar}
              onPress={cerrarModal}
              disabled={guardando}
            >
              <Text style={styles.botonCancelarTexto}>
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.botonGuardar,
                guardando && styles.botonDeshabilitado,
              ]}
              onPress={guardarPassword}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Text style={styles.botonGuardarTexto}>
                  Guardar contraseña
                </Text>
              )}
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =====================================================
// ESTILOS COMPLETOS
// =====================================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.7)",
    justifyContent: "center",
    padding: 18,
  },

  modalContenedor: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    maxHeight: "95%",
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },

  cerrar: {
    fontSize: 28,
    fontWeight: "600",
    color: "#64748B",
  },

  usuarioContenedor: {
    backgroundColor: "#EFF6FF",
    padding: 14,
    borderRadius: 10,
    marginBottom: 18,
  },

  usuarioEtiqueta: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },

  usuarioNombre: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1D4ED8",
    marginTop: 5,
  },

  etiqueta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    marginTop: 10,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },

  mostrarContenedor: {
    alignSelf: "flex-end",
    paddingVertical: 12,
  },

  mostrarTexto: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "700",
  },

  requisitos: {
    backgroundColor: "#F1F5F9",
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
  },

  requisitosTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },

  requisitosTexto: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 5,
  },

  botones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  botonCancelar: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  botonCancelarTexto: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },

  botonGuardar: {
    flex: 1.5,
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  botonGuardarTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },
});