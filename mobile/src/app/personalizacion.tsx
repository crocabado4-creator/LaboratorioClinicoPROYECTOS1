import React, {
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

// ======================================================
// TIPOS
// ======================================================

type FiltroEstado =
  | "todos"
  | "activos"
  | "inactivos";

type Paleta = {
  nombre: string;
  primario: string;
  secundario: string;
};

// ======================================================
// PALETAS
// ======================================================

const PALETAS: Paleta[] = [
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

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function obtenerMensajeError(
  error: unknown,
  mensaje: string
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return mensaje;
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

function validarColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ======================================================
// CONVERTIR IMAGEN A BASE64 EN WEB
// ======================================================

async function convertirImagenWeb(
  uri: string
): Promise<string> {
  const respuesta = await fetch(uri);

  if (!respuesta.ok) {
    throw new Error(
      "No se pudo leer la imagen seleccionada."
    );
  }

  const blob = await respuesta.blob();

  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => {
      if (typeof lector.result === "string") {
        resolve(lector.result);
      } else {
        reject(
          new Error(
            "No se pudo convertir la imagen."
          )
        );
      }
    };

    lector.onerror = () => {
      reject(
        new Error(
          "Error leyendo el archivo."
        )
      );
    };

    lector.readAsDataURL(blob);
  });
}

// ======================================================
// COMPRIMIR IMAGEN WEB
// ======================================================

async function comprimirImagenWeb(
  dataUrl: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const imagen = new window.Image();

    imagen.onload = () => {
      try {
        const maximo = 500;

        const proporcion = Math.min(
          1,
          maximo / Math.max(
            imagen.width,
            imagen.height
          )
        );

        const ancho = Math.max(
          1,
          Math.round(imagen.width * proporcion)
        );

        const alto = Math.max(
          1,
          Math.round(imagen.height * proporcion)
        );

        const canvas =
          document.createElement("canvas");

        canvas.width = ancho;
        canvas.height = alto;

        const contexto =
          canvas.getContext("2d");

        if (!contexto) {
          throw new Error(
            "No se pudo procesar la imagen."
          );
        }

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

        let resultado = "";

        const calidades = [
          0.75,
          0.6,
          0.45,
          0.3,
        ];

        for (const calidad of calidades) {
          resultado = canvas.toDataURL(
            "image/jpeg",
            calidad
          );

          if (resultado.length <= 600000) {
            break;
          }
        }

        if (resultado.length > 600000) {
          throw new Error(
            "La imagen es demasiado grande. Selecciona otra imagen."
          );
        }

        resolve(resultado);
      } catch (error) {
        reject(error);
      }
    };

    imagen.onerror = () => {
      reject(
        new Error(
          "No se pudo cargar la imagen."
        )
      );
    };

    imagen.src = dataUrl;
  });
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function Personalizacion() {
  const router = useRouter();

  // ====================================================
  // ESTADOS
  // ====================================================

  const [
    laboratorios,
    setLaboratorios,
  ] = useState<PersonalizacionLaboratorio[]>([]);

  const [
    seleccionado,
    setSeleccionado,
  ] = useState<PersonalizacionLaboratorio | null>(
    null
  );

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    filtro,
    setFiltro,
  ] = useState<FiltroEstado>("todos");

  const [
    nombreVisible,
    setNombreVisible,
  ] = useState("");

  const [
    logoUrl,
    setLogoUrl,
  ] = useState("");

  const [
    nombreArchivo,
    setNombreArchivo,
  ] = useState("");

  const [
    colorPrimario,
    setColorPrimario,
  ] = useState(
    PERSONALIZACION_DEFAULT.colorPrimario
  );

  const [
    colorSecundario,
    setColorSecundario,
  ] = useState(
    PERSONALIZACION_DEFAULT.colorSecundario
  );

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    procesandoImagen,
    setProcesandoImagen,
  ] = useState(false);

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false);

  // ====================================================
  // CARGAR LABORATORIOS
  // ====================================================

  const cargarLaboratorios = useCallback(
    async () => {
      try {
        setCargando(true);

        const resultado =
          await obtenerLaboratoriosPersonalizacion();

        setLaboratorios(resultado);
      } catch (error) {
        console.error(
          "Error cargando laboratorios:",
          error
        );

        mostrarMensaje(
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

  // ====================================================
  // FILTRAR LABORATORIOS
  // ====================================================

  const laboratoriosFiltrados = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase();

    return laboratorios.filter((laboratorio) => {
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
          filtro === "activos" &&
          laboratorio.activo
        ) ||
        (
          filtro === "inactivos" &&
          !laboratorio.activo
        );

      return coincideTexto && coincideEstado;
    });
  }, [
    laboratorios,
    busqueda,
    filtro,
  ]);

  // ====================================================
  // ESTADÍSTICAS
  // ====================================================

  const total = laboratorios.length;

  const personalizados = laboratorios.filter(
    (laboratorio) =>
      Boolean(
        laboratorio.nombreVisible ||
        laboratorio.logoUrl
      )
  ).length;

  const pendientes = total - personalizados;

  // ====================================================
  // ABRIR EDITOR
  // ====================================================

  const abrirEditor = (
    laboratorio: PersonalizacionLaboratorio
  ) => {
    setSeleccionado(laboratorio);

    setNombreVisible(
      laboratorio.nombreVisible ||
      laboratorio.nombre
    );

    setLogoUrl(
      laboratorio.logoUrl || ""
    );

    setNombreArchivo("");

    setColorPrimario(
      laboratorio.colorPrimario ||
      PERSONALIZACION_DEFAULT.colorPrimario
    );

    setColorSecundario(
      laboratorio.colorSecundario ||
      PERSONALIZACION_DEFAULT.colorSecundario
    );

    setModalVisible(true);
  };

  // ====================================================
  // CERRAR EDITOR
  // ====================================================

  const cerrarEditor = () => {
    if (guardando || procesandoImagen) {
      return;
    }

    setModalVisible(false);

    setSeleccionado(null);

    setNombreArchivo("");
  };

  // ====================================================
  // SELECCIONAR LOGO
  // ====================================================

  const seleccionarLogo = async () => {
    if (procesandoImagen || guardando) {
      return;
    }

    try {
      setProcesandoImagen(true);

      // ================================================
      // PERMISOS EN ANDROID / IOS
      // ================================================

      if (Platform.OS !== "web") {
        const permiso =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (!permiso.granted) {
          mostrarMensaje(
            "Permiso requerido",
            "Debes permitir el acceso a tus imágenes."
          );

          return;
        }
      }

      // ================================================
      // ABRIR GALERÍA
      // ================================================

      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],

          allowsEditing: Platform.OS !== "web",

          aspect: [1, 1],

          quality: 0.5,

          base64: true,
        });

      if (
        resultado.canceled ||
        !resultado.assets ||
        resultado.assets.length === 0
      ) {
        return;
      }

      const archivo = resultado.assets[0];

      // ================================================
      // OBTENER IMAGEN
      // ================================================

      let imagenDataUrl = "";

      if (Platform.OS === "web") {
        // En web puede no existir archivo.base64.

        if (archivo.base64) {
          imagenDataUrl =
            `data:image/jpeg;base64,${archivo.base64}`;
        } else {
          imagenDataUrl =
            await convertirImagenWeb(archivo.uri);
        }

        // Comprimir antes de guardar.

        imagenDataUrl =
          await comprimirImagenWeb(imagenDataUrl);
      } else {
        // Android / iOS

        if (!archivo.base64) {
          throw new Error(
            "No se pudo convertir la imagen a Base64."
          );
        }

        imagenDataUrl =
          `data:image/jpeg;base64,${archivo.base64}`;

        if (imagenDataUrl.length > 650000) {
          throw new Error(
            "La imagen es demasiado grande. Selecciona una imagen más pequeña."
          );
        }
      }

      // ================================================
      // VALIDAR
      // ================================================

      if (!imagenDataUrl) {
        throw new Error(
          "La imagen seleccionada está vacía."
        );
      }

      if (imagenDataUrl.length > 650000) {
        throw new Error(
          "El logo supera el tamaño permitido."
        );
      }

      // ================================================
      // ACTUALIZAR VISTA PREVIA
      // ================================================

      setLogoUrl(imagenDataUrl);

      setNombreArchivo(
        archivo.fileName ||
        "logo-seleccionado.jpg"
      );

      console.log(
        "Logo seleccionado correctamente"
      );
    } catch (error) {
      console.error(
        "Error seleccionando logo:",
        error
      );

      mostrarMensaje(
        "Error",
        obtenerMensajeError(
          error,
          "No se pudo procesar el logo."
        )
      );
    } finally {
      setProcesandoImagen(false);
    }
  };

  // ====================================================
  // QUITAR LOGO
  // ====================================================

  const quitarLogo = () => {
    if (guardando || procesandoImagen) {
      return;
    }

    setLogoUrl("");

    setNombreArchivo("");
  };

  // ====================================================
  // APLICAR PALETA
  // ====================================================

  const aplicarPaleta = (
    primario: string,
    secundario: string
  ) => {
    setColorPrimario(primario);

    setColorSecundario(secundario);
  };

  // ====================================================
  // GUARDAR PERSONALIZACIÓN
  // ====================================================

  const guardar = async () => {
    if (!seleccionado) {
      return;
    }

    if (guardando || procesandoImagen) {
      return;
    }

    const nombre = nombreVisible.trim();

    const primario = colorPrimario
      .trim()
      .toUpperCase();

    const secundario = colorSecundario
      .trim()
      .toUpperCase();

    if (nombre.length < 2) {
      mostrarMensaje(
        "Nombre inválido",
        "Ingresa un nombre visible válido."
      );

      return;
    }

    if (!validarColor(primario)) {
      mostrarMensaje(
        "Color inválido",
        "El color principal debe tener formato #RRGGBB."
      );

      return;
    }

    if (!validarColor(secundario)) {
      mostrarMensaje(
        "Color inválido",
        "El color secundario debe tener formato #RRGGBB."
      );

      return;
    }

    try {
      setGuardando(true);

      await actualizarPersonalizacion(
        seleccionado.id,
        {
          nombreVisible: nombre,

          logoUrl,

          colorPrimario: primario,

          colorSecundario: secundario,
        }
      );

      // Actualizar lista sin recargar.

      setLaboratorios((actuales) =>
        actuales.map((laboratorio) =>
          laboratorio.id === seleccionado.id
            ? {
                ...laboratorio,

                nombreVisible: nombre,

                logoUrl,

                colorPrimario: primario,

                colorSecundario: secundario,
              }
            : laboratorio
        )
      );

      setModalVisible(false);

      setSeleccionado(null);

      setNombreArchivo("");

      mostrarMensaje(
        "Correcto",
        "La personalización se guardó correctamente."
      );
    } catch (error) {
      console.error(
        "Error guardando personalización:",
        error
      );

      mostrarMensaje(
        "Error",
        obtenerMensajeError(
          error,
          "No se pudo guardar la personalización."
        )
      );
    } finally {
      setGuardando(false);
    }
  };

  // ====================================================
  // PANTALLA DE CARGA
  // ====================================================

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F4F7FB"
        />

        <ActivityIndicator
          size="large"
          color="#7C3AED"
        />

        <Text style={styles.loadingTitle}>
          Personalización
        </Text>

        <Text style={styles.loadingText}>
          Cargando laboratorios...
        </Text>
      </SafeAreaView>
    );
  }

  // ====================================================
  // INTERFAZ PRINCIPAL
  // ====================================================

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F7FB"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO */}

        <View style={styles.header}>
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

          <View style={styles.headerRow}>
            <View style={styles.headerTextBox}>
              <Text style={styles.eyebrow}>
                IDENTIDAD VISUAL
              </Text>

              <Text style={styles.title}>
                Personalización
              </Text>

              <Text style={styles.subtitle}>
                Configura el logo, nombre visible
                y colores de cada laboratorio.
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <Text style={{ fontSize: 32 }}>
                🎨
              </Text>
            </View>
          </View>
        </View>

        {/* ESTADÍSTICAS */}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {total}
            </Text>

            <Text style={styles.statLabel}>
              Laboratorios
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {personalizados}
            </Text>

            <Text style={styles.statLabel}>
              Personalizados
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {pendientes}
            </Text>

            <Text style={styles.statLabel}>
              Pendientes
            </Text>
          </View>
        </View>

        {/* BUSCADOR */}

        <View style={styles.filtersCard}>
          <Text style={styles.label}>
            Buscar laboratorio
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre o correo..."
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <View style={styles.filtersRow}>
            {(
              [
                "todos",
                "activos",
                "inactivos",
              ] as FiltroEstado[]
            ).map((estado) => (
              <Pressable
                key={estado}
                style={[
                  styles.filterButton,
                  filtro === estado &&
                    styles.filterButtonActive,
                ]}
                onPress={() => setFiltro(estado)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filtro === estado &&
                      styles.filterTextActive,
                  ]}
                >
                  {estado === "todos"
                    ? "Todos"
                    : estado === "activos"
                    ? "Activos"
                    : "Inactivos"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* LISTA */}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            Laboratorios registrados
          </Text>

          <Pressable
            onPress={() => {
              void cargarLaboratorios();
            }}
          >
            <Text style={styles.refreshText}>
              Actualizar
            </Text>
          </Pressable>
        </View>

        {laboratoriosFiltrados.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No se encontraron laboratorios.
            </Text>
          </View>
        ) : (
          laboratoriosFiltrados.map((laboratorio) => (
            <View
              key={laboratorio.id}
              style={styles.labCard}
            >
              <View style={styles.labRow}>
                <View style={styles.labLogo}>
                  {laboratorio.logoUrl ? (
                    <Image
                      source={{
                        uri: laboratorio.logoUrl,
                      }}
                      style={styles.labLogoImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 25 }}>
                      🧪
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.labName}>
                    {laboratorio.nombreVisible ||
                      laboratorio.nombre}
                  </Text>

                  <Text style={styles.labEmail}>
                    {laboratorio.email}
                  </Text>

                  <Text
                    style={[
                      styles.labStatus,
                      {
                        color: laboratorio.activo
                          ? "#15803D"
                          : "#B91C1C",
                      },
                    ]}
                  >
                    {laboratorio.activo
                      ? "Activo"
                      : "Inactivo"}
                  </Text>
                </View>
              </View>

              <View style={styles.colorsRow}>
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

                <Text style={styles.colorDescription}>
                  Colores configurados
                </Text>
              </View>

              <Pressable
                style={styles.editButton}
                onPress={() => abrirEditor(laboratorio)}
              >
                <Text style={styles.editButtonText}>
                  Editar personalización
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {/* ================================================= */}
      {/* MODAL EDITOR */}
      {/* ================================================= */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Editar personalización
                </Text>

                <Text style={styles.modalSubtitle}>
                  {seleccionado?.nombre || ""}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={cerrarEditor}
                disabled={
                  guardando || procesandoImagen
                }
              >
                <Text style={styles.closeText}>
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              {/* NOMBRE */}

              <Text style={styles.label}>
                Nombre visible del laboratorio
              </Text>

              <TextInput
                style={styles.input}
                value={nombreVisible}
                onChangeText={setNombreVisible}
                placeholder="Nombre del laboratorio"
                placeholderTextColor="#94A3B8"
                editable={!guardando}
              />

              {/* LOGO */}

              <Text style={styles.label}>
                Logo del laboratorio
              </Text>

              <View style={styles.logoPreviewBox}>
                {logoUrl ? (
                  <Image
                    key={logoUrl.substring(0, 80)}
                    source={{ uri: logoUrl }}
                    style={styles.logoPreview}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={{ fontSize: 43 }}>
                      🧪
                    </Text>

                    <Text style={styles.logoPlaceholderText}>
                      Sin logo seleccionado
                    </Text>
                  </View>
                )}
              </View>

              {nombreArchivo !== "" && (
                <Text style={styles.fileName}>
                  Archivo: {nombreArchivo}
                </Text>
              )}

              <Pressable
                style={[
                  styles.selectButton,
                  procesandoImagen &&
                    styles.buttonDisabled,
                ]}
                onPress={() => {
                  void seleccionarLogo();
                }}
                disabled={
                  procesandoImagen || guardando
                }
              >
                {procesandoImagen ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.selectButtonText}>
                    Seleccionar imagen
                  </Text>
                )}
              </Pressable>

              {logoUrl !== "" && (
                <Pressable
                  style={styles.removeButton}
                  onPress={quitarLogo}
                  disabled={
                    guardando || procesandoImagen
                  }
                >
                  <Text style={styles.removeButtonText}>
                    Quitar logo
                  </Text>
                </Pressable>
              )}

              <Text style={styles.helpText}>
                Selecciona una imagen JPG o PNG.
                La imagen se procesará antes de
                guardarse.
              </Text>

              {/* COLORES */}

              <Text style={styles.sectionLabel}>
                Colores del laboratorio
              </Text>

              <Text style={styles.label}>
                Color principal
              </Text>

              <View style={styles.colorInputRow}>
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor: validarColor(
                        colorPrimario
                      )
                        ? colorPrimario
                        : "#FFFFFF",
                    },
                  ]}
                />

                <TextInput
                  style={styles.colorInput}
                  value={colorPrimario}
                  onChangeText={setColorPrimario}
                  placeholder="#2563EB"
                  autoCapitalize="characters"
                  maxLength={7}
                />
              </View>

              <Text style={styles.label}>
                Color secundario
              </Text>

              <View style={styles.colorInputRow}>
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor: validarColor(
                        colorSecundario
                      )
                        ? colorSecundario
                        : "#FFFFFF",
                    },
                  ]}
                />

                <TextInput
                  style={styles.colorInput}
                  value={colorSecundario}
                  onChangeText={setColorSecundario}
                  placeholder="#14B8A6"
                  autoCapitalize="characters"
                  maxLength={7}
                />
              </View>

              {/* PALETAS */}

              <Text style={styles.sectionLabel}>
                Paletas predeterminadas
              </Text>

              <View style={styles.paletasContainer}>
                {PALETAS.map((paleta) => (
                  <Pressable
                    key={paleta.nombre}
                    style={styles.paletaButton}
                    onPress={() =>
                      aplicarPaleta(
                        paleta.primario,
                        paleta.secundario
                      )
                    }
                  >
                    <View style={styles.paletaColors}>
                      <View
                        style={[
                          styles.paletaDot,
                          {
                            backgroundColor:
                              paleta.primario,
                          },
                        ]}
                      />

                      <View
                        style={[
                          styles.paletaDot,
                          {
                            backgroundColor:
                              paleta.secundario,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.paletaText}>
                      {paleta.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* BOTONES */}

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={cerrarEditor}
                  disabled={
                    guardando || procesandoImagen
                  }
                >
                  <Text style={styles.cancelText}>
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    (guardando || procesandoImagen) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    void guardar();
                  }}
                  disabled={
                    guardando || procesandoImagen
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.saveText}>
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

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  scroll: {
    padding: 20,
    paddingBottom: 45,
  },

  loadingPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7FB",
  },

  loadingTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 18,
  },

  loadingText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
  },

  header: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 8,
  },

  backText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 14,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerTextBox: {
    flex: 1,
  },

  eyebrow: {
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },

  subtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },

  headerIcon: {
    width: 65,
    height: 65,
    borderRadius: 17,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 15,
  },

  statsRow: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  statNumber: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0F172A",
  },

  statLabel: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },

  filtersCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 17,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 9,
  },

  input: {
    height: 49,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 18,
  },

  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  filterButton: {
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
  },

  filterButtonActive: {
    backgroundColor: "#2563EB",
  },

  filterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },

  filterTextActive: {
    color: "#FFFFFF",
  },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },

  refreshText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },

  emptyCard: {
    padding: 30,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    alignItems: "center",
  },

  emptyText: {
    color: "#64748B",
    fontSize: 14,
  },

  labCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  labRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  labLogo: {
    width: 65,
    height: 65,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
  },

  labLogoImage: {
    width: 58,
    height: 58,
  },

  labName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  labEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  labStatus: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  colorsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    marginBottom: 15,
    gap: 8,
  },

  colorDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },

  colorDescription: {
    color: "#64748B",
    fontSize: 12,
    marginLeft: 5,
  },

  editButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },

  editButtonText: {
    color: "#4338CA",
    fontSize: 13,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 600,
    maxHeight: "92%",
    borderRadius: 20,
    overflow: "hidden",
  },

  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
  },

  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  closeText: {
    fontSize: 25,
    color: "#475569",
  },

  modalScroll: {
    padding: 20,
    paddingBottom: 30,
  },

  logoPreviewBox: {
    height: 170,
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },

  logoPreview: {
    width: 145,
    height: 145,
  },

  logoPlaceholder: {
    alignItems: "center",
  },

  logoPlaceholderText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 9,
  },

  fileName: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 12,
  },

  selectButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  selectButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  removeButton: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    marginBottom: 10,
  },

  removeButtonText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
  },

  helpText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 19,
    marginBottom: 24,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 15,
    marginTop: 8,
  },

  colorInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  colorPreview: {
    width: 43,
    height: 43,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: 12,
  },

  colorInput: {
    flex: 1,
    height: 47,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#0F172A",
    fontSize: 14,
  },

  paletasContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 25,
  },

  paletaButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    minWidth: 95,
  },

  paletaColors: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },

  paletaDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  paletaText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelText: {
    color: "#475569",
    fontWeight: "800",
    fontSize: 13,
  },

  saveButton: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  saveText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  buttonDisabled: {
    opacity: 0.5,
  },
});