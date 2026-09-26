import {
  useCallback,
  useEffect,
  useMemo,
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

import * as ImagePicker from "expo-image-picker";

import {
  actualizarPersonalizacion,
  obtenerLaboratoriosPersonalizacion,
  PERSONALIZACION_DEFAULT,
  type PersonalizacionLaboratorio,
} from "../services/personalizacionService";

type FiltroEstado =
  | "todos"
  | "activos"
  | "inactivos";

const PALETAS = [
  {
    nombre: "Clínico",
    primario: "#2563EB",
    secundario: "#14B8A6",
  },
  {
    nombre: "Violeta",
    primario: "#7C3AED",
    secundario: "#0EA5E9",
  },
  {
    nombre: "Esmeralda",
    primario: "#059669",
    secundario: "#14B8A6",
  },
  {
    nombre: "Naranja",
    primario: "#EA580C",
    secundario: "#F59E0B",
  },
];

export default function Personalizacion() {
  const router =
    useRouter();

  const [
    laboratorios,
    setLaboratorios,
  ] =
    useState<
      PersonalizacionLaboratorio[]
    >([]);

  const [
    seleccionado,
    setSeleccionado,
  ] =
    useState<
      PersonalizacionLaboratorio |
      null
    >(null);

  const [
    busqueda,
    setBusqueda,
  ] =
    useState("");

  const [
    filtro,
    setFiltro,
  ] =
    useState<FiltroEstado>(
      "todos"
    );

  const [
    nombreVisible,
    setNombreVisible,
  ] =
    useState("");

  const [
    logoUrl,
    setLogoUrl,
  ] =
    useState("");

  const [
    nombreArchivo,
    setNombreArchivo,
  ] =
    useState("");

  const [
    colorPrimario,
    setColorPrimario,
  ] =
    useState(
      PERSONALIZACION_DEFAULT
        .colorPrimario
    );

  const [
    colorSecundario,
    setColorSecundario,
  ] =
    useState(
      PERSONALIZACION_DEFAULT
        .colorSecundario
    );

  const [
    cargando,
    setCargando,
  ] =
    useState(true);

  const [
    guardando,
    setGuardando,
  ] =
    useState(false);

  const [
    procesandoImagen,
    setProcesandoImagen,
  ] =
    useState(false);

  const [
    modalVisible,
    setModalVisible,
  ] =
    useState(false);

  // =====================================================
  // CARGAR LABORATORIOS
  // =====================================================

  const cargarLaboratorios =
    useCallback(
      async () => {
        try {
          setCargando(true);

          const resultado =
            await obtenerLaboratoriosPersonalizacion();

          setLaboratorios(
            resultado
          );

        } catch (error) {
          console.error(
            "Error cargando laboratorios:",
            error
          );

          Alert.alert(
            "Error",
            obtenerMensajeError(
              error,
              "No se pudieron cargar los laboratorios."
            )
          );

        } finally {
          setCargando(false);
        }
      },
      []
    );

  useEffect(() => {
    void cargarLaboratorios();
  }, [cargarLaboratorios]);

  // =====================================================
  // FILTRAR
  // =====================================================

  const laboratoriosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return laboratorios.filter(
        (laboratorio) => {
          const coincideTexto =
            !texto ||
            laboratorio.nombre
              .toLowerCase()
              .includes(texto) ||
            laboratorio.nombreVisible
              .toLowerCase()
              .includes(texto) ||
            laboratorio.email
              .toLowerCase()
              .includes(texto);

          const coincideEstado =
            filtro === "todos" ||
            (
              filtro ===
                "activos" &&
              laboratorio.activo
            ) ||
            (
              filtro ===
                "inactivos" &&
              !laboratorio.activo
            );

          return (
            coincideTexto &&
            coincideEstado
          );
        }
      );
    }, [
      laboratorios,
      busqueda,
      filtro,
    ]);

  // =====================================================
  // ESTADÍSTICAS
  // =====================================================

  const total =
    laboratorios.length;

  const personalizados =
    laboratorios.filter(
      (laboratorio) =>
        Boolean(
          laboratorio.nombreVisible ||
          laboratorio.logoUrl
        )
    ).length;

  const pendientes =
    total -
    personalizados;

  // =====================================================
  // ABRIR EDITOR
  // =====================================================

  const abrirEditor =
    (
      laboratorio:
        PersonalizacionLaboratorio
    ) => {
      setSeleccionado(
        laboratorio
      );

      setNombreVisible(
        laboratorio.nombreVisible ||
        laboratorio.nombre
      );

      setLogoUrl(
        laboratorio.logoUrl ||
        ""
      );

      setNombreArchivo(
        ""
      );

      setColorPrimario(
        laboratorio.colorPrimario ||
        PERSONALIZACION_DEFAULT
          .colorPrimario
      );

      setColorSecundario(
        laboratorio.colorSecundario ||
        PERSONALIZACION_DEFAULT
          .colorSecundario
      );

      setModalVisible(
        true
      );
    };

  // =====================================================
  // CERRAR EDITOR
  // =====================================================

  const cerrarEditor =
    () => {
      if (
        guardando ||
        procesandoImagen
      ) {
        return;
      }

      setModalVisible(
        false
      );

      setSeleccionado(
        null
      );

      setNombreArchivo(
        ""
      );
    };

  // =====================================================
  // SELECCIONAR LOGO
  // =====================================================

  const seleccionarLogo =
    async () => {
      try {
        setProcesandoImagen(
          true
        );

        // Android / iOS
        if (
          Platform.OS !==
          "web"
        ) {
          const permiso =
            await ImagePicker
              .requestMediaLibraryPermissionsAsync();

          if (!permiso.granted) {
            Alert.alert(
              "Permiso requerido",
              "Debes permitir acceso a tus imágenes para seleccionar el logo."
            );

            return;
          }
        }

        const resultado =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes: [
                "images",
              ],

              allowsEditing:
                true,

              aspect: [
                1,
                1,
              ],

              quality:
                0.2,

              base64:
                true,
            });

        if (
          resultado.canceled ||
          !resultado.assets ||
          resultado.assets.length ===
            0
        ) {
          return;
        }

        const archivo =
          resultado.assets[0];

        if (!archivo.base64) {
          throw new Error(
            "No se pudo convertir la imagen seleccionada a Base64."
          );
        }

        const dataUrl =
          `data:image/jpeg;base64,${archivo.base64}`;

        if (
          dataUrl.length >
          650000
        ) {
          throw new Error(
            "El logo es demasiado pesado. Selecciona una imagen más pequeña."
          );
        }

        setLogoUrl(
          dataUrl
        );

        setNombreArchivo(
          archivo.fileName ||
          "logo-seleccionado.jpg"
        );

        Alert.alert(
          "Logo seleccionado",
          "El logo está listo. Presiona Guardar cambios."
        );

      } catch (error) {
        console.error(
          "Error seleccionando logo:",
          error
        );

        Alert.alert(
          "Error",
          obtenerMensajeError(
            error,
            "No se pudo procesar el logo."
          )
        );

      } finally {
        setProcesandoImagen(
          false
        );
      }
    };

  // =====================================================
  // QUITAR LOGO
  // =====================================================

  const quitarLogo =
    () => {
      setLogoUrl(
        ""
      );

      setNombreArchivo(
        ""
      );
    };

  // =====================================================
  // PALETA
  // =====================================================

  const aplicarPaleta =
    (
      primario: string,
      secundario: string
    ) => {
      setColorPrimario(
        primario
      );

      setColorSecundario(
        secundario
      );
    };

  // =====================================================
  // GUARDAR
  // =====================================================

  const guardar =
    async () => {
      if (!seleccionado) {
        return;
      }

      const nombre =
        nombreVisible
          .trim();

      const primario =
        colorPrimario
          .trim()
          .toUpperCase();

      const secundario =
        colorSecundario
          .trim()
          .toUpperCase();

      if (
        nombre.length <
        2
      ) {
        Alert.alert(
          "Nombre inválido",
          "Ingresa un nombre visible válido."
        );

        return;
      }

      if (
        !validarColor(
          primario
        )
      ) {
        Alert.alert(
          "Color inválido",
          "El color principal debe tener formato #RRGGBB."
        );

        return;
      }

      if (
        !validarColor(
          secundario
        )
      ) {
        Alert.alert(
          "Color inválido",
          "El color secundario debe tener formato #RRGGBB."
        );

        return;
      }

      try {
        setGuardando(
          true
        );

        await actualizarPersonalizacion(
          seleccionado.id,
          {
            nombreVisible:
              nombre,

            logoUrl,

            colorPrimario:
              primario,

            colorSecundario:
              secundario,
          }
        );

        setLaboratorios(
          (actuales) =>
            actuales.map(
              (laboratorio) =>
                laboratorio.id ===
                seleccionado.id
                  ? {
                      ...laboratorio,

                      nombreVisible:
                        nombre,

                      logoUrl,

                      colorPrimario:
                        primario,

                      colorSecundario:
                        secundario,
                    }
                  : laboratorio
            )
        );

        setModalVisible(
          false
        );

        setSeleccionado(
          null
        );

        setNombreArchivo(
          ""
        );

        Alert.alert(
          "Correcto",
          "Personalización guardada correctamente."
        );

      } catch (error) {
        console.error(
          "Error guardando personalización:",
          error
        );

        Alert.alert(
          "Error",
          obtenerMensajeError(
            error,
            "No se pudo guardar la personalización."
          )
        );

      } finally {
        setGuardando(
          false
        );
      }
    };

  // =====================================================
  // CARGANDO
  // =====================================================

  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.loadingPage
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F4F7FB"
        />

        <ActivityIndicator
          size="large"
          color="#7C3AED"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Personalización
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando laboratorios...
        </Text>
      </SafeAreaView>
    );
  }

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <SafeAreaView
      style={
        styles.page
      }
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F7FB"
      />

      <ScrollView
        contentContainerStyle={
          styles.scroll
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* HEADER */}

        <View
          style={
            styles.header
          }
        >
          <Pressable
  style={styles.backButton}
  onPress={() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }}
>
  <Text style={styles.backText}>
    ← Volver
  </Text>
</Pressable>

          <View
            style={
              styles.headerRow
            }
          >
            <View
              style={
                styles.headerTextBox
              }
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                IDENTIDAD VISUAL
              </Text>

              <Text
                style={
                  styles.title
                }
              >
                Personalización
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Configura el logo, nombre visible y colores de cada laboratorio.
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
                🎨
              </Text>
            </View>
          </View>
        </View>

        {/* ESTADÍSTICAS */}

        <View
          style={
            styles.stats
          }
        >
          <StatCard
            icono="🏥"
            titulo="Laboratorios"
            valor={total}
            fondo="#DBEAFE"
          />

          <StatCard
            icono="🎨"
            titulo="Personalizados"
            valor={personalizados}
            fondo="#EDE9FE"
          />

          <StatCard
            icono="⏳"
            titulo="Pendientes"
            valor={pendientes}
            fondo="#FEF3C7"
          />
        </View>

        {/* BUSCADOR */}

        <View
          style={
            styles.searchBox
          }
        >
          <Text
            style={
              styles.searchEmoji
            }
          >
            🔎
          </Text>

          <TextInput
            style={
              styles.searchInput
            }
            value={
              busqueda
            }
            onChangeText={
              setBusqueda
            }
            placeholder="Buscar laboratorio..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* FILTROS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filters
          }
        >
          <FiltroButton
            texto="Todos"
            activo={
              filtro ===
              "todos"
            }
            onPress={() =>
              setFiltro(
                "todos"
              )
            }
          />

          <FiltroButton
            texto="Activos"
            activo={
              filtro ===
              "activos"
            }
            onPress={() =>
              setFiltro(
                "activos"
              )
            }
          />

          <FiltroButton
            texto="Inactivos"
            activo={
              filtro ===
              "inactivos"
            }
            onPress={() =>
              setFiltro(
                "inactivos"
              )
            }
          />
        </ScrollView>

        {/* LISTADO */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <View
            style={
              styles.sectionHeaderText
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Laboratorios
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Selecciona el laboratorio que deseas personalizar.
            </Text>
          </View>

          <View
            style={
              styles.counter
            }
          >
            <Text
              style={
                styles.counterText
              }
            >
              {
                laboratoriosFiltrados
                  .length
              }
            </Text>
          </View>
        </View>

        {laboratoriosFiltrados.length ===
        0 ? (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              🔎
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Sin resultados
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              No se encontraron laboratorios.
            </Text>
          </View>

        ) : (
          laboratoriosFiltrados.map(
            (laboratorio) => (
              <Pressable
                key={
                  laboratorio.id
                }
                style={({
                  pressed,
                }) => [
                  styles.labCard,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() =>
                  abrirEditor(
                    laboratorio
                  )
                }
              >
                <View
                  style={
                    styles.labLogo
                  }
                >
                  {laboratorio.logoUrl ? (
                    <Image
                      source={{
                        uri:
                          laboratorio.logoUrl,
                      }}
                      style={
                        styles.labLogoImage
                      }
                      resizeMode="contain"
                    />
                  ) : (
                    <Text
                      style={
                        styles.labEmoji
                      }
                    >
                      🧪
                    </Text>
                  )}
                </View>

                <View
                  style={
                    styles.labInfo
                  }
                >
                  <Text
                    style={
                      styles.labName
                    }
                    numberOfLines={1}
                  >
                    {
                      laboratorio.nombre ||
                      "Sin nombre"
                    }
                  </Text>

                  <Text
                    style={
                      styles.labVisibleName
                    }
                    numberOfLines={1}
                  >
                    {
                      laboratorio.nombreVisible ||
                      "Sin personalizar"
                    }
                  </Text>

                  <View
                    style={
                      styles.labBottom
                    }
                  >
                    <View
                      style={[
                        styles.status,

                        laboratorio.activo
                          ? styles.statusActive
                          : styles.statusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,

                          {
                            color:
                              laboratorio.activo
                                ? "#15803D"
                                : "#B91C1C",
                          },
                        ]}
                      >
                        {
                          laboratorio.activo
                            ? "Activo"
                            : "Inactivo"
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.colors
                      }
                    >
                      <View
                        style={[
                          styles.colorDot,

                          {
                            backgroundColor:
                              laboratorio.colorPrimario,
                          },
                        ]}
                      />

                      <View
                        style={[
                          styles.colorDot,

                          {
                            backgroundColor:
                              laboratorio.colorSecundario,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                <Text
                  style={
                    styles.arrow
                  }
                >
                  ›
                </Text>
              </Pressable>
            )
          )
        )}
      </ScrollView>

      {/* MODAL */}

      <Modal
        visible={
          modalVisible
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarEditor
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={
              styles.modal
            }
          >
            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.modalHeaderText
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Personalizar laboratorio
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    {
                      seleccionado?.nombre ||
                      ""
                    }
                  </Text>
                </View>

                <Pressable
                  style={
                    styles.closeButton
                  }
                  onPress={
                    cerrarEditor
                  }
                  disabled={
                    guardando ||
                    procesandoImagen
                  }
                >
                  <Text
                    style={
                      styles.closeText
                    }
                  >
                    ×
                  </Text>
                </Pressable>
              </View>

              {/* IDENTIDAD */}

              <View
                style={
                  styles.formCard
                }
              >
                <SectionTitle
                  icono="🏷️"
                  titulo="Identidad"
                  texto="Nombre visible del laboratorio."
                />

                <Text
                  style={
                    styles.label
                  }
                >
                  Nombre visible
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={
                    nombreVisible
                  }
                  onChangeText={
                    setNombreVisible
                  }
                  placeholder="Laboratorio Central"
                  placeholderTextColor="#94A3B8"
                  maxLength={80}
                  editable={
                    !guardando
                  }
                />
              </View>

              {/* LOGO */}

              <View
                style={
                  styles.formCard
                }
              >
                <SectionTitle
                  icono="🖼️"
                  titulo="Logo"
                  texto="Selecciona una imagen desde tu dispositivo."
                  morado
                />

                <View
                  style={
                    styles.logoEditor
                  }
                >
                  <View
                    style={
                      styles.logoPreview
                    }
                  >
                    {logoUrl ? (
                      <Image
                        source={{
                          uri:
                            logoUrl,
                        }}
                        style={
                          styles.logoPreviewImage
                        }
                        resizeMode="contain"
                      />
                    ) : (
                      <Text
                        style={
                          styles.logoPreviewEmoji
                        }
                      >
                        🧪
                      </Text>
                    )}
                  </View>

                  <View
                    style={
                      styles.logoActions
                    }
                  >
                    <Pressable
                      style={[
                        styles.uploadButton,

                        (
                          guardando ||
                          procesandoImagen
                        ) &&
                          styles.disabledButton,
                      ]}
                      onPress={
                        seleccionarLogo
                      }
                      disabled={
                        guardando ||
                        procesandoImagen
                      }
                    >
                      {procesandoImagen ? (
                        <ActivityIndicator
                          color="#FFFFFF"
                          size="small"
                        />
                      ) : (
                        <Text
                          style={
                            styles.uploadButtonText
                          }
                        >
                          📁 Seleccionar logo
                        </Text>
                      )}
                    </Pressable>

                    {logoUrl ? (
                      <Pressable
                        style={
                          styles.removeButton
                        }
                        onPress={
                          quitarLogo
                        }
                        disabled={
                          guardando ||
                          procesandoImagen
                        }
                      >
                        <Text
                          style={
                            styles.removeButtonText
                          }
                        >
                          Quitar logo
                        </Text>
                      </Pressable>
                    ) : null}

                    {nombreArchivo ? (
                      <Text
                        style={
                          styles.fileName
                        }
                        numberOfLines={2}
                      >
                        {
                          nombreArchivo
                        }
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text
                  style={
                    styles.helpText
                  }
                >
                  El logo se guarda directamente en logoUrl de Firestore. No usa Firebase Storage.
                </Text>
              </View>

              {/* COLORES */}

              <View
                style={
                  styles.formCard
                }
              >
                <SectionTitle
                  icono="🎨"
                  titulo="Colores"
                  texto="Colores institucionales."
                  verde
                />

                <Text
                  style={
                    styles.label
                  }
                >
                  Color principal
                </Text>

                <View
                  style={
                    styles.colorInputRow
                  }
                >
                  <View
                    style={[
                      styles.colorPreview,

                      {
                        backgroundColor:
                          validarColor(
                            colorPrimario
                          )
                            ? colorPrimario
                            : PERSONALIZACION_DEFAULT
                                .colorPrimario,
                      },
                    ]}
                  />

                  <TextInput
                    style={
                      styles.colorTextInput
                    }
                    value={
                      colorPrimario
                    }
                    onChangeText={(
                      texto
                    ) =>
                      setColorPrimario(
                        texto.toUpperCase()
                      )
                    }
                    autoCapitalize="characters"
                    maxLength={7}
                    editable={
                      !guardando
                    }
                  />
                </View>

                <Text
                  style={
                    styles.labelSecond
                  }
                >
                  Color secundario
                </Text>

                <View
                  style={
                    styles.colorInputRow
                  }
                >
                  <View
                    style={[
                      styles.colorPreview,

                      {
                        backgroundColor:
                          validarColor(
                            colorSecundario
                          )
                            ? colorSecundario
                            : PERSONALIZACION_DEFAULT
                                .colorSecundario,
                      },
                    ]}
                  />

                  <TextInput
                    style={
                      styles.colorTextInput
                    }
                    value={
                      colorSecundario
                    }
                    onChangeText={(
                      texto
                    ) =>
                      setColorSecundario(
                        texto.toUpperCase()
                      )
                    }
                    autoCapitalize="characters"
                    maxLength={7}
                    editable={
                      !guardando
                    }
                  />
                </View>

                <Text
                  style={
                    styles.paletteTitle
                  }
                >
                  Paletas rápidas
                </Text>

                <View
                  style={
                    styles.paletteGrid
                  }
                >
                  {PALETAS.map(
                    (paleta) => (
                      <Pressable
                        key={
                          paleta.nombre
                        }
                        style={
                          styles.paletteCard
                        }
                        onPress={() =>
                          aplicarPaleta(
                            paleta.primario,
                            paleta.secundario
                          )
                        }
                        disabled={
                          guardando
                        }
                      >
                        <View
                          style={
                            styles.paletteColors
                          }
                        >
                          <View
                            style={[
                              styles.paletteColor,

                              {
                                backgroundColor:
                                  paleta.primario,
                              },
                            ]}
                          />

                          <View
                            style={[
                              styles.paletteColor,

                              {
                                backgroundColor:
                                  paleta.secundario,
                              },
                            ]}
                          />
                        </View>

                        <Text
                          style={
                            styles.paletteName
                          }
                        >
                          {
                            paleta.nombre
                          }
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>

              {/* PREVIEW */}

              <View
                style={
                  styles.formCard
                }
              >
                <SectionTitle
                  icono="👁️"
                  titulo="Vista previa"
                  texto="Así se verá la identidad del laboratorio."
                  morado
                />

                <View
                  style={[
                    styles.brandPreview,

                    {
                      backgroundColor:
                        validarColor(
                          colorPrimario
                        )
                          ? colorPrimario
                          : PERSONALIZACION_DEFAULT
                              .colorPrimario,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.secondaryDecoration,

                      {
                        backgroundColor:
                          validarColor(
                            colorSecundario
                          )
                            ? colorSecundario
                            : PERSONALIZACION_DEFAULT
                                .colorSecundario,
                      },
                    ]}
                  />

                  <View
                    style={
                      styles.previewTop
                    }
                  >
                    <View
                      style={
                        styles.previewLogo
                      }
                    >
                      {logoUrl ? (
                        <Image
                          source={{
                            uri:
                              logoUrl,
                          }}
                          style={
                            styles.previewLogoImage
                          }
                          resizeMode="contain"
                        />
                      ) : (
                        <Text
                          style={
                            styles.previewEmoji
                          }
                        >
                          🧪
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        styles.previewTextBox
                      }
                    >
                      <Text
                        style={
                          styles.previewTitle
                        }
                      >
                        {
                          nombreVisible ||
                          seleccionado?.nombre ||
                          "Laboratorio Clínico"
                        }
                      </Text>

                      <Text
                        style={
                          styles.previewSubtitle
                        }
                      >
                        Sistema de Laboratorio Clínico
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.previewStats
                    }
                  >
                    <PreviewStat
                      titulo="Pacientes"
                      valor="128"
                    />

                    <PreviewStat
                      titulo="Solicitudes"
                      valor="34"
                    />

                    <PreviewStat
                      titulo="Resultados"
                      valor="21"
                    />
                  </View>
                </View>
              </View>

              {/* BOTONES */}

              <View
                style={
                  styles.modalActions
                }
              >
                <Pressable
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    cerrarEditor
                  }
                  disabled={
                    guardando ||
                    procesandoImagen
                  }
                >
                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,

                    guardando &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    guardar
                  }
                  disabled={
                    guardando ||
                    procesandoImagen
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      Guardar cambios
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  icono,
  titulo,
  valor,
  fondo,
}: {
  icono: string;
  titulo: string;
  valor: number;
  fondo: string;
}) {
  return (
    <View
      style={
        styles.statCard
      }
    >
      <View
        style={[
          styles.statIcon,
          {
            backgroundColor:
              fondo,
          },
        ]}
      >
        <Text
          style={
            styles.statEmoji
          }
        >
          {icono}
        </Text>
      </View>

      <View>
        <Text
          style={
            styles.statTitle
          }
        >
          {titulo}
        </Text>

        <Text
          style={
            styles.statValue
          }
        >
          {valor}
        </Text>
      </View>
    </View>
  );
}

function FiltroButton({
  texto,
  activo,
  onPress,
}: {
  texto: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.filterButton,
        activo &&
          styles.filterButtonActive,
      ]}
      onPress={
        onPress
      }
    >
      <Text
        style={[
          styles.filterText,
          activo &&
            styles.filterTextActive,
        ]}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

function SectionTitle({
  icono,
  titulo,
  texto,
  morado = false,
  verde = false,
}: {
  icono: string;
  titulo: string;
  texto: string;
  morado?: boolean;
  verde?: boolean;
}) {
  return (
    <View
      style={
        styles.formHeader
      }
    >
      <View
        style={[
          styles.formIcon,

          morado &&
            styles.formIconPurple,

          verde &&
            styles.formIconGreen,
        ]}
      >
        <Text>
          {icono}
        </Text>
      </View>

      <View
        style={
          styles.formHeaderText
        }
      >
        <Text
          style={
            styles.formTitle
          }
        >
          {titulo}
        </Text>

        <Text
          style={
            styles.formDescription
          }
        >
          {texto}
        </Text>
      </View>
    </View>
  );
}

function PreviewStat({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <View
      style={
        styles.previewStat
      }
    >
      <Text
        style={
          styles.previewStatTitle
        }
      >
        {titulo}
      </Text>

      <Text
        style={
          styles.previewStatValue
        }
      >
        {valor}
      </Text>
    </View>
  );
}

function validarColor(
  color: string
): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(
    color
  );
}

function obtenerMensajeError(
  error: unknown,
  predeterminado: string
): string {
  return (
    error instanceof Error &&
    error.message
  )
    ? error.message
    : predeterminado;
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        "#F4F7FB",
    },

    scroll: {
      padding: 18,
      paddingBottom: 50,
    },

    loadingPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#F4F7FB",
    },

    loadingTitle: {
      marginTop: 15,
      color: "#0F172A",
      fontSize: 20,
      fontWeight: "900",
    },

    loadingText: {
      marginTop: 5,
      color: "#64748B",
      fontSize: 11,
    },

    header: {
      marginBottom: 20,
    },

    backButton: {
      alignSelf: "flex-start",
      marginBottom: 18,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
    },

    backText: {
      color: "#475569",
      fontSize: 11,
      fontWeight: "800",
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    headerTextBox: {
      flex: 1,
      paddingRight: 12,
    },

    eyebrow: {
      color: "#7C3AED",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
    },

    title: {
      marginTop: 5,
      color: "#0F172A",
      fontSize: 29,
      fontWeight: "900",
    },

    subtitle: {
      marginTop: 7,
      color: "#64748B",
      fontSize: 11,
      lineHeight: 17,
    },

    headerIcon: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 19,
      backgroundColor: "#EDE9FE",
    },

    headerEmoji: {
      fontSize: 28,
    },

    stats: {
      marginBottom: 18,
    },

    statCard: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      padding: 15,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
    },

    statIcon: {
      width: 45,
      height: 45,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderRadius: 13,
    },

    statEmoji: {
      fontSize: 19,
    },

    statTitle: {
      color: "#64748B",
      fontSize: 9,
      fontWeight: "800",
      textTransform: "uppercase",
    },

    statValue: {
      marginTop: 2,
      color: "#0F172A",
      fontSize: 22,
      fontWeight: "900",
    },

    searchBox: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 13,
      backgroundColor: "#FFFFFF",
    },

    searchEmoji: {
      marginRight: 9,
      fontSize: 18,
    },

    searchInput: {
      flex: 1,
      color: "#0F172A",
      fontSize: 12,
    },

    filters: {
      paddingVertical: 13,
      paddingRight: 8,
    },

    filterButton: {
      marginRight: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 20,
      backgroundColor: "#FFFFFF",
    },

    filterButtonActive: {
      borderColor: "#8B5CF6",
      backgroundColor: "#F5F3FF",
    },

    filterText: {
      color: "#64748B",
      fontSize: 10,
      fontWeight: "800",
    },

    filterTextActive: {
      color: "#6D28D9",
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginTop: 5,
      marginBottom: 12,
    },

    sectionHeaderText: {
      flex: 1,
      paddingRight: 12,
    },

    sectionTitle: {
      color: "#0F172A",
      fontSize: 19,
      fontWeight: "900",
    },

    sectionSubtitle: {
      marginTop: 3,
      color: "#64748B",
      fontSize: 9,
    },

    counter: {
      minWidth: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      backgroundColor: "#EDE9FE",
    },

    counterText: {
      color: "#6D28D9",
      fontSize: 12,
      fontWeight: "900",
    },

    labCard: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      padding: 13,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 15,
      backgroundColor: "#FFFFFF",
    },

    pressed: {
      opacity: 0.75,
    },

    labLogo: {
      width: 55,
      height: 55,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginRight: 11,
      borderRadius: 14,
      backgroundColor: "#F8FAFC",
    },

    labLogoImage: {
      width: "100%",
      height: "100%",
    },

    labEmoji: {
      fontSize: 25,
    },

    labInfo: {
      flex: 1,
    },

    labName: {
      color: "#0F172A",
      fontSize: 12,
      fontWeight: "900",
    },

    labVisibleName: {
      marginTop: 3,
      color: "#64748B",
      fontSize: 9,
    },

    labBottom: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },

    status: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 20,
    },

    statusActive: {
      backgroundColor: "#DCFCE7",
    },

    statusInactive: {
      backgroundColor: "#FEE2E2",
    },

    statusText: {
      fontSize: 8,
      fontWeight: "900",
    },

    colors: {
      flexDirection: "row",
      marginLeft: 9,
    },

    colorDot: {
      width: 16,
      height: 16,
      marginRight: 4,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: "#E2E8F0",
    },

    arrow: {
      marginLeft: 8,
      color: "#7C3AED",
      fontSize: 30,
      fontWeight: "300",
    },

    empty: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
    },

    emptyIcon: {
      fontSize: 37,
    },

    emptyTitle: {
      marginTop: 10,
      color: "#334155",
      fontSize: 15,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 4,
      color: "#64748B",
      fontSize: 10,
    },

    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor:
        "rgba(15,23,42,.65)",
    },

    modal: {
      maxHeight: "94%",
      padding: 20,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      backgroundColor: "#F8FAFC",
    },

    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingBottom: 15,
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#E2E8F0",
    },

    modalHeaderText: {
      flex: 1,
      paddingRight: 12,
    },

    modalTitle: {
      color: "#0F172A",
      fontSize: 20,
      fontWeight: "900",
    },

    modalSubtitle: {
      marginTop: 4,
      color: "#64748B",
      fontSize: 10,
    },

    closeButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor: "#E2E8F0",
    },

    closeText: {
      color: "#475569",
      fontSize: 23,
      lineHeight: 25,
    },

    formCard: {
      marginBottom: 13,
      padding: 16,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
    },

    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },

    formIcon: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      borderRadius: 11,
      backgroundColor: "#DBEAFE",
    },

    formIconPurple: {
      backgroundColor: "#EDE9FE",
    },

    formIconGreen: {
      backgroundColor: "#DCFCE7",
    },

    formHeaderText: {
      flex: 1,
    },

    formTitle: {
      color: "#0F172A",
      fontSize: 14,
      fontWeight: "900",
    },

    formDescription: {
      marginTop: 2,
      color: "#64748B",
      fontSize: 8,
    },

    label: {
      marginBottom: 7,
      color: "#334155",
      fontSize: 10,
      fontWeight: "800",
    },

    labelSecond: {
      marginTop: 15,
      marginBottom: 7,
      color: "#334155",
      fontSize: 10,
      fontWeight: "800",
    },

    input: {
      minHeight: 47,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      fontSize: 11,
    },

    logoEditor: {
      flexDirection: "row",
      alignItems: "center",
      padding: 13,
      borderRadius: 13,
      backgroundColor: "#F8FAFC",
    },

    logoPreview: {
      width: 85,
      height: 85,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginRight: 13,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
    },

    logoPreviewImage: {
      width: "100%",
      height: "100%",
    },

    logoPreviewEmoji: {
      fontSize: 35,
    },

    logoActions: {
      flex: 1,
    },

    uploadButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: "#7C3AED",
    },

    uploadButtonText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
    },

    removeButton: {
      alignSelf: "flex-start",
      marginTop: 7,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: "#FECACA",
      borderRadius: 8,
      backgroundColor: "#FFF1F2",
    },

    removeButtonText: {
      color: "#B91C1C",
      fontSize: 8,
      fontWeight: "900",
    },

    fileName: {
      marginTop: 7,
      color: "#64748B",
      fontSize: 8,
    },

    helpText: {
      marginTop: 10,
      color: "#94A3B8",
      fontSize: 8,
      lineHeight: 13,
    },

    colorInputRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    colorPreview: {
      width: 47,
      height: 47,
      marginRight: 8,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      borderRadius: 10,
    },

    colorTextInput: {
      flex: 1,
      minHeight: 47,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
      color: "#0F172A",
      fontSize: 11,
    },

    paletteTitle: {
      marginTop: 18,
      marginBottom: 9,
      color: "#475569",
      fontSize: 9,
      fontWeight: "900",
    },

    paletteGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },

    paletteCard: {
      width: "48%",
      marginBottom: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
    },

    paletteColors: {
      flexDirection: "row",
      marginBottom: 6,
    },

    paletteColor: {
      width: 25,
      height: 21,
      marginRight: 4,
      borderRadius: 6,
    },

    paletteName: {
      color: "#334155",
      fontSize: 8,
      fontWeight: "800",
    },

    brandPreview: {
      position: "relative",
      overflow: "hidden",
      marginTop: 13,
      padding: 18,
      borderRadius: 17,
    },

    secondaryDecoration: {
      position: "absolute",
      width: 160,
      height: 160,
      top: -90,
      right: -60,
      borderRadius: 80,
      opacity: 0.8,
    },

    previewTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    previewLogo: {
      width: 65,
      height: 65,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginRight: 12,
      borderRadius: 15,
      backgroundColor: "#FFFFFF",
    },

    previewLogoImage: {
      width: "100%",
      height: "100%",
    },

    previewEmoji: {
      fontSize: 30,
    },

    previewTextBox: {
      flex: 1,
    },

    previewTitle: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "900",
    },

    previewSubtitle: {
      marginTop: 4,
      color: "rgba(255,255,255,.8)",
      fontSize: 8,
    },

    previewStats: {
      flexDirection: "row",
      marginTop: 17,
    },

    previewStat: {
      flex: 1,
      marginRight: 7,
      padding: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,.20)",
      borderRadius: 10,
      backgroundColor:
        "rgba(255,255,255,.12)",
    },

    previewStatTitle: {
      color:
        "rgba(255,255,255,.8)",
      fontSize: 7,
    },

    previewStatValue: {
      marginTop: 3,
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "900",
    },

    modalActions: {
      flexDirection: "row",
      paddingBottom: 20,
    },

    cancelButton: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      borderRadius: 11,
      backgroundColor: "#FFFFFF",
    },

    cancelText: {
      color: "#475569",
      fontSize: 10,
      fontWeight: "900",
    },

    saveButton: {
      flex: 1.5,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 11,
      backgroundColor: "#7C3AED",
    },

    saveText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.55,
    },
  });