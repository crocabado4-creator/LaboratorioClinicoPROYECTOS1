import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
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

import {
  useRouter,
} from "expo-router";

import {
  actualizarConfiguracionLaboratorio,
  obtenerConfiguracionLaboratorio,
  type ConfiguracionLaboratorio,
} from "../services/configuracionLaboratorioService";

type Mensaje = {
  tipo:
    | "exito"
    | "error";
  texto: string;
} | null;

export default function ConfiguracionScreen() {
  const router =
    useRouter();

  const [
    laboratorio,
    setLaboratorio,
  ] =
    useState<ConfiguracionLaboratorio | null>(
      null
    );

  const [
    nombre,
    setNombre,
  ] = useState("");

  const [
    direccion,
    setDireccion,
  ] = useState("");

  const [
    telefono,
    setTelefono,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    editando,
    setEditando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState<Mensaje>(
    null
  );

  const [
    logoError,
    setLogoError,
  ] = useState(false);

  const colocarDatos = (
    datos: ConfiguracionLaboratorio
  ) => {
    setNombre(
      datos.nombre
    );

    setDireccion(
      datos.direccion
    );

    setTelefono(
      datos.telefono
    );

    setEmail(
      datos.email
    );
  };

  const cargarDatos =
    async () => {
      try {
        setCargando(
          true
        );

        setMensaje(null);

        const datos =
          await obtenerConfiguracionLaboratorio();

        setLaboratorio(
          datos
        );

        colocarDatos(
          datos
        );

        setLogoError(
          false
        );
      } catch (error) {
        console.error(
          "Error cargando configuración:",
          error
        );

        setMensaje({
          tipo:
            "error",

          texto:
            error instanceof
            Error
              ? error.message
              : "No se pudo cargar la configuración.",
        });
      } finally {
        setCargando(
          false
        );
      }
    };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const temporizador =
      setTimeout(
        () => {
          setMensaje(
            null
          );
        },
        4000
      );

    return () => {
      clearTimeout(
        temporizador
      );
    };
  }, [mensaje]);

  const iniciarEdicion =
    () => {
      if (!laboratorio) {
        return;
      }

      colocarDatos(
        laboratorio
      );

      setMensaje(
        null
      );

      setEditando(
        true
      );
    };

  const cancelarEdicion =
    () => {
      if (
        guardando ||
        !laboratorio
      ) {
        return;
      }

      colocarDatos(
        laboratorio
      );

      setEditando(
        false
      );

      setMensaje(
        null
      );
    };

  const validar =
    (): string => {
      if (
        nombre.trim().length <
        2
      ) {
        return "Ingresa un nombre válido.";
      }

      if (
        direccion.trim().length <
        4
      ) {
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
          email
            .trim()
            .toLowerCase()
        )
      ) {
        return "Ingresa un correo electrónico válido.";
      }

      return "";
    };

  const guardarCambios =
    async () => {
      const validacion =
        validar();

      if (validacion) {
        setMensaje({
          tipo:
            "error",

          texto:
            validacion,
        });

        return;
      }

      try {
        setGuardando(
          true
        );

        setMensaje(
          null
        );

        await actualizarConfiguracionLaboratorio(
          {
            nombre,
            direccion,
            telefono,
            email,
          }
        );

        const datos =
          await obtenerConfiguracionLaboratorio();

        setLaboratorio(
          datos
        );

        colocarDatos(
          datos
        );

        setEditando(
          false
        );

        setMensaje({
          tipo:
            "exito",

          texto:
            "La información del laboratorio fue actualizada correctamente.",
        });
      } catch (error) {
        console.error(
          "Error guardando configuración:",
          error
        );

        setMensaje({
          tipo:
            "error",

          texto:
            error instanceof
            Error
              ? error.message
              : "No se pudo guardar la información.",
        });
      } finally {
        setGuardando(
          false
        );
      }
    };

  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.loadingPage
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#f8fafc"
        />

        <View
          style={
            styles.loadingIcon
          }
        >
          <Text
            style={
              styles.loadingEmoji
            }
          >
            ⚙️
          </Text>
        </View>

        <ActivityIndicator
          size="large"
          color="#0284c7"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Configuración
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando información del laboratorio...
        </Text>
      </SafeAreaView>
    );
  }

  if (!laboratorio) {
    return (
      <SafeAreaView
        style={
          styles.page
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#f8fafc"
        />

        <View
          style={
            styles.errorPage
          }
        >
          <View
            style={
              styles.errorIcon
            }
          >
            <Text
              style={
                styles.errorEmoji
              }
            >
              !
            </Text>
          </View>

          <Text
            style={
              styles.errorTitle
            }
          >
            Configuración no disponible
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {mensaje?.texto ||
              "No fue posible cargar la información del laboratorio."}
          </Text>

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={
              cargarDatos
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Intentar nuevamente
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.secondaryButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.secondaryButtonText
              }
            >
              Volver
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const colorPrimario =
    /^#[0-9A-Fa-f]{6}$/.test(
      laboratorio.colorPrimario
    )
      ? laboratorio.colorPrimario
      : "#2563EB";

  const colorSecundario =
    /^#[0-9A-Fa-f]{6}$/.test(
      laboratorio.colorSecundario
    )
      ? laboratorio.colorSecundario
      : "#14B8A6";

  const nombreVisible =
    laboratorio.nombreVisible ||
    laboratorio.nombre;

  return (
    <SafeAreaView
      style={
        styles.page
      }
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#075985"
      />

      <KeyboardAvoidingView
        style={
          styles.keyboard
        }
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scroll
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.header
            }
          >
            <Pressable
              style={
                styles.backButton
              }
              onPress={() =>
                router.back()
              }
            >
              <Text
                style={
                  styles.backText
                }
              >
                ‹
              </Text>
            </Pressable>

            <View
              style={
                styles.headerContent
              }
            >
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                LABORATORIO
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Configuración
              </Text>

              <Text
                style={
                  styles.headerDescription
                }
              >
                Mantén actualizada la información general de tu laboratorio.
              </Text>
            </View>

            <View
              style={
                styles.headerIcon
              }
            >
              <Text
                style={
                  styles.headerEmoji
                }
              >
                ⚙️
              </Text>
            </View>
          </View>

          {mensaje && (
            <View
              style={[
                styles.message,

                mensaje.tipo ===
                  "exito"
                  ? styles.messageSuccess
                  : styles.messageError,
              ]}
            >
              <View
                style={[
                  styles.messageIcon,

                  mensaje.tipo ===
                    "exito"
                    ? styles.messageIconSuccess
                    : styles.messageIconError,
                ]}
              >
                <Text
                  style={[
                    styles.messageSymbol,

                    mensaje.tipo ===
                      "exito"
                      ? styles.messageSymbolSuccess
                      : styles.messageSymbolError,
                  ]}
                >
                  {mensaje.tipo ===
                  "exito"
                    ? "✓"
                    : "!"}
                </Text>
              </View>

              <Text
                style={[
                  styles.messageText,

                  mensaje.tipo ===
                    "exito"
                    ? styles.messageTextSuccess
                    : styles.messageTextError,
                ]}
              >
                {mensaje.texto}
              </Text>
            </View>
          )}

          <View
            style={
              styles.identityCard
            }
          >
            <View
              style={[
                styles.identityTop,
                {
                  backgroundColor:
                    colorPrimario,
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

              <View
                style={
                  styles.logoContainer
                }
              >
                {laboratorio.logoUrl &&
                !logoError ? (
                  <Image
                    source={{
                      uri:
                        laboratorio.logoUrl,
                    }}
                    style={
                      styles.logo
                    }
                    resizeMode="contain"
                    onError={() =>
                      setLogoError(
                        true
                      )
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.logoFallback
                    }
                  >
                    🧪
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.identityText
                }
              >
                <Text
                  style={
                    styles.identityName
                  }
                >
                  {nombreVisible}
                </Text>

                <Text
                  style={
                    styles.identitySubtitle
                  }
                >
                  {laboratorio.nombre}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.identityBottom
              }
            >
              <View>
                <Text
                  style={
                    styles.identityLabel
                  }
                >
                  Estado
                </Text>

                <View
                  style={
                    styles.activeBadge
                  }
                >
                  <Text
                    style={
                      styles.activeBadgeText
                    }
                  >
                    ● Activo
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.identityIdContainer
                }
              >
                <Text
                  style={
                    styles.identityLabel
                  }
                >
                  Identificador
                </Text>

                <Text
                  style={
                    styles.identityId
                  }
                  numberOfLines={
                    1
                  }
                >
                  {laboratorio.laboratorioId}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Información general
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Datos visibles y de contacto del laboratorio.
              </Text>
            </View>

            {!editando && (
              <Pressable
                style={
                  styles.editButton
                }
                onPress={
                  iniciarEdicion
                }
              >
                <Text
                  style={
                    styles.editButtonText
                  }
                >
                  ✎ Editar
                </Text>
              </Pressable>
            )}
          </View>

          <View
            style={
              styles.formCard
            }
          >
            <Campo
              titulo="Nombre del laboratorio"
              valor={
                nombre
              }
              onChange={
                setNombre
              }
              editable={
                editando
              }
              placeholder="Nombre del laboratorio"
              icono="🏥"
            />

            <Campo
              titulo="Dirección"
              valor={
                direccion
              }
              onChange={
                setDireccion
              }
              editable={
                editando
              }
              placeholder="Dirección del laboratorio"
              icono="📍"
              multiline
            />

            <Campo
              titulo="Teléfono"
              valor={
                telefono
              }
              onChange={
                setTelefono
              }
              editable={
                editando
              }
              placeholder="Número de teléfono"
              icono="☎"
              keyboardType="phone-pad"
            />

            <Campo
              titulo="Correo electrónico"
              valor={
                email
              }
              onChange={
                setEmail
              }
              editable={
                editando
              }
              placeholder="correo@laboratorio.com"
              icono="✉"
              keyboardType="email-address"
            />

            <View
              style={
                styles.lockedField
              }
            >
              <View
                style={
                  styles.lockedIcon
                }
              >
                <Text>
                  🔒
                </Text>
              </View>

              <View
                style={
                  styles.lockedData
                }
              >
                <Text
                  style={
                    styles.lockedLabel
                  }
                >
                  Laboratorio asociado
                </Text>

                <Text
                  style={
                    styles.lockedValue
                  }
                  numberOfLines={
                    1
                  }
                >
                  {laboratorio.laboratorioId}
                </Text>

                <Text
                  style={
                    styles.lockedHelp
                  }
                >
                  Este valor no puede modificarse desde esta cuenta.
                </Text>
              </View>
            </View>

            {editando && (
              <View
                style={
                  styles.actions
                }
              >
                <Pressable
                  style={[
                    styles.cancelButton,

                    guardando &&
                      styles.disabled,
                  ]}
                  onPress={
                    cancelarEdicion
                  }
                  disabled={
                    guardando
                  }
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,

                    guardando &&
                      styles.disabled,
                  ]}
                  onPress={
                    guardarCambios
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Guardar cambios
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          <View
            style={
              styles.infoCard
            }
          >
            <View
              style={
                styles.infoIcon
              }
            >
              <Text>
                ℹ
              </Text>
            </View>

            <View
              style={
                styles.infoContent
              }
            >
              <Text
                style={
                  styles.infoTitle
                }
              >
                Información de la cuenta
              </Text>

              <Text
                style={
                  styles.infoText
                }
              >
                Los cambios realizados aquí corresponden únicamente a los datos generales del laboratorio.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Campo({
  titulo,
  valor,
  onChange,
  editable,
  placeholder,
  icono,
  multiline = false,
  keyboardType = "default",
}: {
  titulo: string;
  valor: string;
  onChange:
    (
      texto: string
    ) => void;
  editable: boolean;
  placeholder: string;
  icono: string;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "email-address"
    | "phone-pad";
}) {
  return (
    <View
      style={
        styles.field
      }
    >
      <Text
        style={
          styles.label
        }
      >
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
        <Text
          style={[
            styles.inputIcon,

            multiline &&
              styles.inputIconMultiline,
          ]}
        >
          {icono}
        </Text>

        <TextInput
          style={[
            styles.input,

            multiline &&
              styles.inputMultiline,

            !editable &&
              styles.inputDisabled,
          ]}
          value={
            valor
          }
          onChangeText={
            onChange
          }
          editable={
            editable
          }
          placeholder={
            placeholder
          }
          placeholderTextColor="#94a3b8"
          multiline={
            multiline
          }
          numberOfLines={
            multiline
              ? 3
              : 1
          }
          keyboardType={
            keyboardType
          }
          autoCapitalize={
            keyboardType ===
            "email-address"
              ? "none"
              : "sentences"
          }
          autoCorrect={
            keyboardType !==
            "email-address"
          }
        />
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        "#f1f5f9",
    },

    keyboard: {
      flex: 1,
    },

    scroll: {
      paddingBottom: 45,
    },

    header: {
      minHeight: 190,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal: 18,
      paddingTop: 25,
      paddingBottom: 25,
      backgroundColor:
        "#075985",
    },

    backButton: {
      width: 42,
      height: 42,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 10,
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,.2)",
      borderRadius: 13,
      backgroundColor:
        "rgba(255,255,255,.1)",
    },

    backText: {
      marginTop: -4,
      color:
        "#ffffff",
      fontSize: 33,
      fontWeight:
        "300",
    },

    headerContent: {
      flex: 1,
    },

    headerEyebrow: {
      color:
        "#bae6fd",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    headerTitle: {
      marginTop: 5,
      color:
        "#ffffff",
      fontSize: 26,
      fontWeight:
        "900",
    },

    headerDescription: {
      marginTop: 5,
      maxWidth: 270,
      color:
        "#e0f2fe",
      fontSize: 10,
      lineHeight: 15,
    },

    headerIcon: {
      width: 56,
      height: 56,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginLeft: 8,
      borderRadius: 17,
      backgroundColor:
        "rgba(255,255,255,.12)",
    },

    headerEmoji: {
      fontSize: 25,
    },

    message: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 9,
      marginHorizontal: 14,
      marginTop: 14,
      padding: 12,
      borderWidth: 1,
      borderRadius: 12,
    },

    messageSuccess: {
      borderColor:
        "#a7f3d0",
      backgroundColor:
        "#ecfdf5",
    },

    messageError: {
      borderColor:
        "#fecaca",
      backgroundColor:
        "#fff1f2",
    },

    messageIcon: {
      width: 28,
      height: 28,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 9,
    },

    messageIconSuccess: {
      backgroundColor:
        "#d1fae5",
    },

    messageIconError: {
      backgroundColor:
        "#fee2e2",
    },

    messageSymbol: {
      fontSize: 12,
      fontWeight:
        "900",
    },

    messageSymbolSuccess: {
      color:
        "#047857",
    },

    messageSymbolError: {
      color:
        "#b91c1c",
    },

    messageText: {
      flex: 1,
      fontSize: 9,
      lineHeight: 14,
      fontWeight:
        "700",
    },

    messageTextSuccess: {
      color:
        "#047857",
    },

    messageTextError: {
      color:
        "#b91c1c",
    },

    identityCard: {
      overflow:
        "hidden",
      marginHorizontal: 14,
      marginTop: -15,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 18,
      backgroundColor:
        "#ffffff",

      shadowColor:
        "#0f172a",

      shadowOffset: {
        width: 0,
        height: 7,
      },

      shadowOpacity:
        0.07,

      shadowRadius:
        16,

      elevation: 4,
    },

    identityTop: {
      position:
        "relative",
      overflow:
        "hidden",
      flexDirection:
        "row",
      alignItems:
        "center",
      minHeight: 105,
      padding: 17,
    },

    identityDecoration: {
      position:
        "absolute",
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
      alignItems:
        "center",
      justifyContent:
        "center",
      overflow:
        "hidden",
      marginRight: 13,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
    },

    logo: {
      width: 54,
      height: 54,
    },

    logoFallback: {
      fontSize: 27,
    },

    identityText: {
      flex: 1,
      zIndex: 2,
    },

    identityName: {
      color:
        "#ffffff",
      fontSize: 17,
      fontWeight:
        "900",
    },

    identitySubtitle: {
      marginTop: 4,
      color:
        "rgba(255,255,255,.82)",
      fontSize: 9,
    },

    identityBottom: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      gap: 15,
      padding: 13,
    },

    identityLabel: {
      color:
        "#94a3b8",
      fontSize: 7,
      fontWeight:
        "800",
      textTransform:
        "uppercase",
    },

    activeBadge: {
      alignSelf:
        "flex-start",
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor:
        "#dcfce7",
    },

    activeBadgeText: {
      color:
        "#15803d",
      fontSize: 8,
      fontWeight:
        "800",
    },

    identityIdContainer: {
      flex: 1,
      alignItems:
        "flex-end",
    },

    identityId: {
      maxWidth: 180,
      marginTop: 5,
      color:
        "#475569",
      fontSize: 8,
      fontWeight:
        "700",
    },

    sectionHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap: 10,
      marginHorizontal: 15,
      marginTop: 27,
      marginBottom: 11,
    },

    sectionTitle: {
      color:
        "#0f172a",
      fontSize: 18,
      fontWeight:
        "900",
    },

    sectionSubtitle: {
      marginTop: 3,
      color:
        "#64748b",
      fontSize: 9,
    },

    editButton: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor:
        "#e0f2fe",
    },

    editButtonText: {
      color:
        "#0369a1",
      fontSize: 9,
      fontWeight:
        "900",
    },

    formCard: {
      marginHorizontal: 14,
      padding: 16,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 17,
      backgroundColor:
        "#ffffff",
    },

    field: {
      marginBottom: 15,
    },

    label: {
      marginBottom: 7,
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "800",
    },

    inputContainer: {
      minHeight: 50,
      flexDirection:
        "row",
      alignItems:
        "center",
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 11,
      backgroundColor:
        "#ffffff",
    },

    inputContainerDisabled: {
      borderColor:
        "#e2e8f0",
      backgroundColor:
        "#f8fafc",
    },

    inputContainerMultiline: {
      alignItems:
        "flex-start",
      minHeight: 90,
    },

    inputIcon: {
      marginLeft: 12,
      marginRight: 8,
      fontSize: 14,
    },

    inputIconMultiline: {
      marginTop: 14,
    },

    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 13,
      paddingRight: 12,
      color:
        "#0f172a",
      fontSize: 11,
    },

    inputMultiline: {
      minHeight: 85,
      textAlignVertical:
        "top",
    },

    inputDisabled: {
      color:
        "#475569",
    },

    lockedField: {
      flexDirection:
        "row",
      alignItems:
        "center",
      padding: 12,
      borderRadius: 11,
      backgroundColor:
        "#f8fafc",
    },

    lockedIcon: {
      width: 38,
      height: 38,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 10,
      borderRadius: 10,
      backgroundColor:
        "#e2e8f0",
    },

    lockedData: {
      flex: 1,
    },

    lockedLabel: {
      color:
        "#64748b",
      fontSize: 8,
      fontWeight:
        "800",
    },

    lockedValue: {
      marginTop: 2,
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "700",
    },

    lockedHelp: {
      marginTop: 3,
      color:
        "#94a3b8",
      fontSize: 7,
    },

    actions: {
      flexDirection:
        "row",
      gap: 9,
      marginTop: 19,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor:
        "#f1f5f9",
    },

    cancelButton: {
      minHeight: 46,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 11,
      backgroundColor:
        "#ffffff",
    },

    cancelButtonText: {
      color:
        "#475569",
      fontSize: 9,
      fontWeight:
        "800",
    },

    saveButton: {
      minHeight: 46,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 11,
      backgroundColor:
        "#0284c7",
    },

    saveButtonText: {
      color:
        "#ffffff",
      fontSize: 9,
      fontWeight:
        "900",
    },

    disabled: {
      opacity: 0.55,
    },

    infoCard: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      gap: 10,
      marginHorizontal: 14,
      marginTop: 13,
      padding: 13,
      borderWidth: 1,
      borderColor:
        "#dbeafe",
      borderRadius: 13,
      backgroundColor:
        "#eff6ff",
    },

    infoIcon: {
      width: 30,
      height: 30,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 9,
      backgroundColor:
        "#dbeafe",
    },

    infoContent: {
      flex: 1,
    },

    infoTitle: {
      color:
        "#1e3a8a",
      fontSize: 9,
      fontWeight:
        "900",
    },

    infoText: {
      marginTop: 3,
      color:
        "#475569",
      fontSize: 8,
      lineHeight: 13,
    },

    loadingPage: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 25,
      backgroundColor:
        "#f8fafc",
    },

    loadingIcon: {
      width: 67,
      height: 67,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom: 18,
      borderRadius: 20,
      backgroundColor:
        "#e0f2fe",
    },

    loadingEmoji: {
      fontSize: 30,
    },

    loadingTitle: {
      marginTop: 15,
      color:
        "#0f172a",
      fontSize: 18,
      fontWeight:
        "800",
    },

    loadingText: {
      marginTop: 4,
      color:
        "#64748b",
      fontSize: 10,
      textAlign:
        "center",
    },

    errorPage: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 25,
    },

    errorIcon: {
      width: 65,
      height: 65,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom: 15,
      borderRadius: 20,
      backgroundColor:
        "#fee2e2",
    },

    errorEmoji: {
      color:
        "#dc2626",
      fontSize: 25,
      fontWeight:
        "900",
    },

    errorTitle: {
      color:
        "#0f172a",
      fontSize: 19,
      fontWeight:
        "900",
      textAlign:
        "center",
    },

    errorText: {
      maxWidth: 330,
      marginTop: 7,
      color:
        "#64748b",
      fontSize: 10,
      lineHeight: 16,
      textAlign:
        "center",
    },

    primaryButton: {
      minWidth: 190,
      minHeight: 46,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 20,
      borderRadius: 11,
      backgroundColor:
        "#0284c7",
    },

    primaryButtonText: {
      color:
        "#ffffff",
      fontSize: 10,
      fontWeight:
        "900",
    },

    secondaryButton: {
      minWidth: 190,
      minHeight: 44,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 9,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 11,
      backgroundColor:
        "#ffffff",
    },

    secondaryButtonText: {
      color:
        "#475569",
      fontSize: 10,
      fontWeight:
        "800",
    },
  });