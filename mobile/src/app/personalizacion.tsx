import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
  actualizarPersonalizacion,
  obtenerLaboratoriosPersonalizacion,
  PERSONALIZACION_DEFAULT,
  type PersonalizacionLaboratorio,
} from "../services/personalizacionService";

type FiltroEstado = "todos" | "activo" | "inactivo";
type FiltroPersonalizacion = "todos" | "personalizado" | "pendiente";

type Mensaje = {
  tipo: "exito" | "error";
  texto: string;
} | null;

const PALETAS = [
  {
    nombre: "Azul",
    primario: "#2563EB",
    secundario: "#14B8A6",
  },
  {
    nombre: "Violeta",
    primario: "#7C3AED",
    secundario: "#A855F7",
  },
  {
    nombre: "Verde",
    primario: "#059669",
    secundario: "#14B8A6",
  },
  {
    nombre: "Celeste",
    primario: "#0284C7",
    secundario: "#06B6D4",
  },
];

export default function PersonalizacionScreen() {
  const router = useRouter();

  const [laboratorios, setLaboratorios] = useState<PersonalizacionLaboratorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje>(null);

  const [busqueda, setBusqueda] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [filtroPersonalizacion, setFiltroPersonalizacion] =
    useState<FiltroPersonalizacion>("todos");

  const [laboratorioVer, setLaboratorioVer] =
    useState<PersonalizacionLaboratorio | null>(null);

  const [laboratorioDetalle, setLaboratorioDetalle] =
    useState<PersonalizacionLaboratorio | null>(null);

  const [laboratorioEditar, setLaboratorioEditar] =
    useState<PersonalizacionLaboratorio | null>(null);

  const [nombreVisible, setNombreVisible] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [colorPrimario, setColorPrimario] = useState(
    PERSONALIZACION_DEFAULT.colorPrimario
  );
  const [colorSecundario, setColorSecundario] = useState(
    PERSONALIZACION_DEFAULT.colorSecundario
  );

  const [logoError, setLogoError] = useState(false);

  const mostrarMensaje = (tipo: "exito" | "error", texto: string) => {
    setMensaje({ tipo, texto });
  };

  useEffect(() => {
    if (!mensaje) return;

    const temporizador = setTimeout(() => {
      setMensaje(null);
    }, 4000);

    return () => clearTimeout(temporizador);
  }, [mensaje]);

  const cargarDatos = useCallback(async (mostrarCarga = true) => {
    try {
      if (mostrarCarga) setCargando(true);

      const resultado = await obtenerLaboratoriosPersonalizacion();
      setLaboratorios(resultado);
    } catch (error) {
      console.error("Error cargando personalización:", error);

      mostrarMensaje(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los laboratorios."
      );
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargarDatos(false);
  };

  const laboratoriosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return laboratorios.filter((laboratorio) => {
      const coincideBusqueda =
        texto === "" ||
        [
          laboratorio.nombre,
          laboratorio.nombreVisible,
          laboratorio.email,
          laboratorio.telefono,
          laboratorio.laboratorioId,
        ].some((valor) =>
          String(valor || "").toLowerCase().includes(texto)
        );

      let coincideEstado = true;

      if (filtroEstado === "activo") {
        coincideEstado = laboratorio.activo;
      }

      if (filtroEstado === "inactivo") {
        coincideEstado = !laboratorio.activo;
      }

      let coincidePersonalizacion = true;

      if (filtroPersonalizacion === "personalizado") {
        coincidePersonalizacion = laboratorio.personalizado;
      }

      if (filtroPersonalizacion === "pendiente") {
        coincidePersonalizacion = !laboratorio.personalizado;
      }

      return coincideBusqueda && coincideEstado && coincidePersonalizacion;
    });
  }, [
    laboratorios,
    busqueda,
    filtroEstado,
    filtroPersonalizacion,
  ]);

  const personalizados = laboratorios.filter(
    (item) => item.personalizado
  ).length;

  const pendientes = laboratorios.length - personalizados;

  const activos = laboratorios.filter(
    (item) => item.activo
  ).length;

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("todos");
    setFiltroPersonalizacion("todos");
  };

  const abrirEditor = (laboratorio: PersonalizacionLaboratorio) => {
    setLaboratorioEditar(laboratorio);
    setNombreVisible(laboratorio.nombreVisible || laboratorio.nombre);
    setLogoUrl(laboratorio.logoUrl);
    setColorPrimario(laboratorio.colorPrimario);
    setColorSecundario(laboratorio.colorSecundario);
    setLogoError(false);
    setMensaje(null);
  };

  const cerrarEditor = () => {
    if (guardando) return;

    setLaboratorioEditar(null);
    setLogoError(false);
  };

  const seleccionarPaleta = (
    primario: string,
    secundario: string
  ) => {
    setColorPrimario(primario);
    setColorSecundario(secundario);
  };

  const restaurarColores = () => {
    setColorPrimario(PERSONALIZACION_DEFAULT.colorPrimario);
    setColorSecundario(PERSONALIZACION_DEFAULT.colorSecundario);
  };

  const guardar = async () => {
    if (!laboratorioEditar) return;

    if (nombreVisible.trim().length < 2) {
      mostrarMensaje("error", "Ingresa un nombre visible válido.");
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(colorPrimario.trim())) {
      mostrarMensaje("error", "El color principal no es válido.");
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(colorSecundario.trim())) {
      mostrarMensaje("error", "El color secundario no es válido.");
      return;
    }

    try {
      setGuardando(true);

      await actualizarPersonalizacion(laboratorioEditar.id, {
        nombreVisible,
        logoUrl,
        colorPrimario,
        colorSecundario,
      });

      setLaboratorioEditar(null);

      await cargarDatos(false);

      mostrarMensaje(
        "exito",
        "La personalización fue guardada correctamente."
      );
    } catch (error) {
      console.error("Error guardando personalización:", error);

      mostrarMensaje(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudo guardar la personalización."
      );
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#f8fafc"
        />

        <View style={styles.loadingIcon}>
          <Text style={styles.loadingEmoji}>🎨</Text>
        </View>

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

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#4C1D95"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor="#7C3AED"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>

            <View style={styles.headerContent}>
              <Text style={styles.headerEyebrow}>
                IDENTIDAD VISUAL
              </Text>

              <Text style={styles.headerTitle}>
                Personalización
              </Text>

              <Text style={styles.headerDescription}>
                Configura la apariencia de cada laboratorio.
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <Text style={styles.headerEmoji}>🎨</Text>
            </View>
          </View>
        </View>

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
              style={
                mensaje.tipo === "exito"
                  ? styles.messageSuccessText
                  : styles.messageErrorText
              }
            >
              {mensaje.tipo === "exito" ? "✓" : "!"}
            </Text>

            <Text
              style={[
                styles.messageText,
                mensaje.tipo === "exito"
                  ? styles.messageSuccessText
                  : styles.messageErrorText,
              ]}
            >
              {mensaje.texto}
            </Text>
          </View>
        )}

        <View style={styles.stats}>
          <Stat
            icono="🏥"
            titulo="Laboratorios"
            valor={laboratorios.length}
            fondo="#DBEAFE"
            color="#1D4ED8"
          />

          <Stat
            icono="🎨"
            titulo="Personalizados"
            valor={personalizados}
            fondo="#EDE9FE"
            color="#6D28D9"
          />

          <Stat
            icono="○"
            titulo="Pendientes"
            valor={pendientes}
            fondo="#FEF3C7"
            color="#A16207"
          />

          <Stat
            icono="✓"
            titulo="Activos"
            valor={activos}
            fondo="#DCFCE7"
            color="#15803D"
          />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.search}>
            <Text>🔎</Text>

            <TextInput
              style={styles.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar laboratorio..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </View>

          <Pressable
            style={[
              styles.filterButton,
              mostrarFiltros && styles.filterButtonActive,
            ]}
            onPress={() =>
              setMostrarFiltros(!mostrarFiltros)
            }
          >
            <Text
              style={[
                styles.filterText,
                mostrarFiltros && styles.filterTextActive,
              ]}
            >
              ⚙ Filtros
            </Text>
          </Pressable>
        </View>

        {mostrarFiltros && (
          <View style={styles.filters}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>
                Filtrar resultados
              </Text>

              <Pressable onPress={limpiarFiltros}>
                <Text style={styles.clearText}>
                  Limpiar
                </Text>
              </Pressable>
            </View>

            <Text style={styles.filterLabel}>
              Estado
            </Text>

            <View style={styles.chips}>
              <Chip
                titulo="Todos"
                activo={filtroEstado === "todos"}
                onPress={() => setFiltroEstado("todos")}
              />

              <Chip
                titulo="Activos"
                activo={filtroEstado === "activo"}
                onPress={() => setFiltroEstado("activo")}
              />

              <Chip
                titulo="Inactivos"
                activo={filtroEstado === "inactivo"}
                onPress={() => setFiltroEstado("inactivo")}
              />
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>
              Personalización
            </Text>

            <View style={styles.chips}>
              <Chip
                titulo="Todos"
                activo={filtroPersonalizacion === "todos"}
                onPress={() =>
                  setFiltroPersonalizacion("todos")
                }
              />

              <Chip
                titulo="Configurados"
                activo={
                  filtroPersonalizacion === "personalizado"
                }
                onPress={() =>
                  setFiltroPersonalizacion("personalizado")
                }
              />

              <Chip
                titulo="Pendientes"
                activo={
                  filtroPersonalizacion === "pendiente"
                }
                onPress={() =>
                  setFiltroPersonalizacion("pendiente")
                }
              />
            </View>
          </View>
        )}

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              Laboratorios
            </Text>

            <Text style={styles.listSubtitle}>
              Identidad visual configurada por establecimiento.
            </Text>
          </View>

          <View style={styles.resultBadge}>
            <Text style={styles.resultText}>
              {laboratoriosFiltrados.length}
            </Text>
          </View>
        </View>

        {laboratoriosFiltrados.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔎</Text>

            <Text style={styles.emptyTitle}>
              Sin resultados
            </Text>

            <Text style={styles.emptyText}>
              No existen laboratorios que coincidan con los filtros.
            </Text>

            <Pressable onPress={limpiarFiltros}>
              <Text style={styles.emptyAction}>
                Limpiar filtros
              </Text>
            </Pressable>
          </View>
        ) : (
          laboratoriosFiltrados.map((laboratorio) => (
            <View
              key={laboratorio.id}
              style={styles.card}
            >
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor:
                      laboratorio.colorPrimario,
                  },
                ]}
              >
                <View
                  style={[
                    styles.previewCircle,
                    {
                      backgroundColor:
                        laboratorio.colorSecundario,
                    },
                  ]}
                />

                <View style={styles.previewLogo}>
                  {laboratorio.logoUrl ? (
                    <Image
                      source={{
                        uri: laboratorio.logoUrl,
                      }}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.previewEmoji}>
                      🧪
                    </Text>
                  )}
                </View>

                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>
                    {laboratorio.nombreVisible ||
                      laboratorio.nombre}
                  </Text>

                  <Text style={styles.previewOriginal}>
                    {laboratorio.nombre}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.badges}>
                  <View
                    style={
                      laboratorio.activo
                        ? styles.activeBadge
                        : styles.inactiveBadge
                    }
                  >
                    <Text
                      style={
                        laboratorio.activo
                          ? styles.activeText
                          : styles.inactiveText
                      }
                    >
                      ●{" "}
                      {laboratorio.activo
                        ? "Activo"
                        : "Inactivo"}
                    </Text>
                  </View>

                  <View
                    style={
                      laboratorio.personalizado
                        ? styles.configuredBadge
                        : styles.pendingBadge
                    }
                  >
                    <Text
                      style={
                        laboratorio.personalizado
                          ? styles.configuredText
                          : styles.pendingText
                      }
                    >
                      {laboratorio.personalizado
                        ? "Personalizado"
                        : "Pendiente"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardEmail}>
                  {laboratorio.email || "Sin correo"}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.action,
                      styles.viewAction,
                    ]}
                    onPress={() =>
                      setLaboratorioVer(laboratorio)
                    }
                  >
                    <Text style={styles.viewText}>
                      👁 Ver
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.action,
                      styles.detailAction,
                    ]}
                    onPress={() =>
                      setLaboratorioDetalle(laboratorio)
                    }
                  >
                    <Text style={styles.detailText}>
                      📄 Ver detalle
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.editAction}
                  onPress={() =>
                    abrirEditor(laboratorio)
                  }
                >
                  <Text style={styles.editText}>
                    🎨 Personalizar
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={laboratorioVer !== null}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setLaboratorioVer(null)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, styles.smallModal]}>
            {laboratorioVer && (
              <>
                <ModalHeader
                  titulo="Vista del laboratorio"
                  subtitulo="Identidad visual actual"
                  cerrar={() => setLaboratorioVer(null)}
                />

                <VistaPrevia
                  laboratorio={laboratorioVer}
                />

                <Pressable
                  style={styles.fullButton}
                  onPress={() => setLaboratorioVer(null)}
                >
                  <Text style={styles.fullButtonText}>
                    Cerrar
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={laboratorioDetalle !== null}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setLaboratorioDetalle(null)
        }
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
          >
            <View style={styles.modal}>
              {laboratorioDetalle && (
                <>
                  <ModalHeader
                    titulo="Detalle de personalización"
                    subtitulo="Información completa del laboratorio"
                    cerrar={() =>
                      setLaboratorioDetalle(null)
                    }
                  />

                  <Detalle
                    titulo="Laboratorio"
                    valor={laboratorioDetalle.nombre}
                  />

                  <Detalle
                    titulo="Nombre visible"
                    valor={
                      laboratorioDetalle.nombreVisible ||
                      "No configurado"
                    }
                  />

                  <Detalle
                    titulo="Correo"
                    valor={laboratorioDetalle.email}
                  />

                  <Detalle
                    titulo="Estado"
                    valor={
                      laboratorioDetalle.activo
                        ? "Activo"
                        : "Inactivo"
                    }
                  />

                  <Detalle
                    titulo="Personalización"
                    valor={
                      laboratorioDetalle.personalizado
                        ? "Configurada"
                        : "Pendiente"
                    }
                  />

                  <Detalle
                    titulo="Color principal"
                    valor={
                      laboratorioDetalle.colorPrimario
                    }
                  />

                  <Detalle
                    titulo="Color secundario"
                    valor={
                      laboratorioDetalle.colorSecundario
                    }
                  />

                  <Detalle
                    titulo="Logo"
                    valor={
                      laboratorioDetalle.logoUrl
                        ? "Configurado"
                        : "No configurado"
                    }
                  />

                  <Detalle
                    titulo="Laboratorio ID"
                    valor={
                      laboratorioDetalle.laboratorioId
                    }
                  />

                  <VistaPrevia
                    laboratorio={laboratorioDetalle}
                  />

                  <Pressable
                    style={styles.fullButton}
                    onPress={() =>
                      setLaboratorioDetalle(null)
                    }
                  >
                    <Text style={styles.fullButtonText}>
                      Cerrar
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={laboratorioEditar !== null}
        transparent
        animationType="slide"
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
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modal}>
              {laboratorioEditar && (
                <>
                  <ModalHeader
                    titulo="Personalizar laboratorio"
                    subtitulo={laboratorioEditar.nombre}
                    cerrar={cerrarEditor}
                  />

                  <Text style={styles.fieldLabel}>
                    Nombre visible *
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={nombreVisible}
                    onChangeText={setNombreVisible}
                    placeholder="Nombre mostrado en el sistema"
                    placeholderTextColor="#94A3B8"
                  />

                  <Text style={styles.fieldLabel}>
                    Logo
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={logoUrl}
                    onChangeText={(valor) => {
                      setLogoUrl(valor);
                      setLogoError(false);
                    }}
                    placeholder="Dirección actual del logo"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />

                  <Text style={styles.help}>
                    La carga del logo mediante archivo la incorporaremos después; por ahora se mantiene el campo actual.
                  </Text>

                  <Text style={styles.sectionLabel}>
                    Paletas
                  </Text>

                  <View style={styles.paletteGrid}>
                    {PALETAS.map((paleta) => (
                      <Pressable
                        key={paleta.nombre}
                        style={styles.palette}
                        onPress={() =>
                          seleccionarPaleta(
                            paleta.primario,
                            paleta.secundario
                          )
                        }
                      >
                        <View style={styles.paletteColors}>
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

                        <Text style={styles.paletteName}>
                          {paleta.nombre}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>
                    Color principal
                  </Text>

                  <View style={styles.colorRow}>
                    <View
                      style={[
                        styles.colorPreview,
                        {
                          backgroundColor:
                            /^#[0-9A-Fa-f]{6}$/.test(
                              colorPrimario
                            )
                              ? colorPrimario
                              : "#ffffff",
                        },
                      ]}
                    />

                    <TextInput
                      style={[
                        styles.input,
                        styles.colorInput,
                      ]}
                      value={colorPrimario}
                      onChangeText={setColorPrimario}
                      autoCapitalize="characters"
                      maxLength={7}
                      placeholder="#2563EB"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>
                    Color secundario
                  </Text>

                  <View style={styles.colorRow}>
                    <View
                      style={[
                        styles.colorPreview,
                        {
                          backgroundColor:
                            /^#[0-9A-Fa-f]{6}$/.test(
                              colorSecundario
                            )
                              ? colorSecundario
                              : "#ffffff",
                        },
                      ]}
                    />

                    <TextInput
                      style={[
                        styles.input,
                        styles.colorInput,
                      ]}
                      value={colorSecundario}
                      onChangeText={setColorSecundario}
                      autoCapitalize="characters"
                      maxLength={7}
                      placeholder="#14B8A6"
                    />
                  </View>

                  <Pressable
                    style={styles.restoreButton}
                    onPress={restaurarColores}
                  >
                    <Text style={styles.restoreText}>
                      Restaurar colores predeterminados
                    </Text>
                  </Pressable>

                  <Text style={styles.sectionLabel}>
                    Vista previa
                  </Text>

                  <View
                    style={[
                      styles.editorPreview,
                      {
                        backgroundColor:
                          /^#[0-9A-Fa-f]{6}$/.test(
                            colorPrimario
                          )
                            ? colorPrimario
                            : "#2563EB",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.editorCircle,
                        {
                          backgroundColor:
                            /^#[0-9A-Fa-f]{6}$/.test(
                              colorSecundario
                            )
                              ? colorSecundario
                              : "#14B8A6",
                        },
                      ]}
                    />

                    <View style={styles.editorLogo}>
                      {logoUrl && !logoError ? (
                        <Image
                          source={{ uri: logoUrl }}
                          style={styles.editorLogoImage}
                          resizeMode="contain"
                          onError={() =>
                            setLogoError(true)
                          }
                        />
                      ) : (
                        <Text style={styles.editorEmoji}>
                          🧪
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.editorName}>
                        {nombreVisible ||
                          laboratorioEditar.nombre}
                      </Text>

                      <Text style={styles.editorSubtitle}>
                        Sistema de Laboratorio Clínico
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={cerrarEditor}
                      disabled={guardando}
                    >
                      <Text style={styles.cancelText}>
                        Cancelar
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.saveButton,
                        guardando && styles.disabled,
                      ]}
                      onPress={guardar}
                      disabled={guardando}
                    >
                      {guardando ? (
                        <ActivityIndicator
                          color="#ffffff"
                          size="small"
                        />
                      ) : (
                        <Text style={styles.saveText}>
                          Guardar
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  icono,
  titulo,
  valor,
  fondo,
  color,
}: {
  icono: string;
  titulo: string;
  valor: number;
  fondo: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor: fondo },
        ]}
      >
        <Text>{icono}</Text>
      </View>

      <Text
        style={[
          styles.statValue,
          { color },
        ]}
      >
        {valor}
      </Text>

      <Text style={styles.statTitle}>
        {titulo}
      </Text>
    </View>
  );
}

function Chip({
  titulo,
  activo,
  onPress,
}: {
  titulo: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        activo && styles.chipActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          activo && styles.chipTextActive,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function ModalHeader({
  titulo,
  subtitulo,
  cerrar,
}: {
  titulo: string;
  subtitulo: string;
  cerrar: () => void;
}) {
  return (
    <View style={styles.modalHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.modalTitle}>
          {titulo}
        </Text>

        <Text style={styles.modalSubtitle}>
          {subtitulo}
        </Text>
      </View>

      <Pressable
        style={styles.modalClose}
        onPress={cerrar}
      >
        <Text style={styles.modalCloseText}>
          ×
        </Text>
      </Pressable>
    </View>
  );
}

function Detalle({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>
        {titulo}
      </Text>

      <Text style={styles.detailValue}>
        {valor || "No registrado"}
      </Text>
    </View>
  );
}

function VistaPrevia({
  laboratorio,
}: {
  laboratorio: PersonalizacionLaboratorio;
}) {
  return (
    <View
      style={[
        styles.fullPreview,
        {
          backgroundColor:
            laboratorio.colorPrimario,
        },
      ]}
    >
      <View
        style={[
          styles.fullPreviewCircle,
          {
            backgroundColor:
              laboratorio.colorSecundario,
          },
        ]}
      />

      <View style={styles.fullPreviewLogo}>
        {laboratorio.logoUrl ? (
          <Image
            source={{
              uri: laboratorio.logoUrl,
            }}
            style={styles.fullPreviewImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.fullPreviewEmoji}>
            🧪
          </Text>
        )}
      </View>

      <Text style={styles.fullPreviewName}>
        {laboratorio.nombreVisible ||
          laboratorio.nombre}
      </Text>

      <Text style={styles.fullPreviewText}>
        Laboratorio Clínico
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  scroll: {
    paddingBottom: 45,
  },

  header: {
    paddingHorizontal: 17,
    paddingTop: 25,
    paddingBottom: 29,
    backgroundColor: "#4C1D95",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,.12)",
  },

  backText: {
    marginTop: -4,
    color: "#ffffff",
    fontSize: 33,
  },

  headerContent: {
    flex: 1,
  },

  headerEyebrow: {
    color: "#DDD6FE",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },

  headerTitle: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
  },

  headerDescription: {
    marginTop: 4,
    color: "#EDE9FE",
    fontSize: 9,
  },

  headerIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,.12)",
  },

  headerEmoji: {
    fontSize: 25,
  },

  message: {
    flexDirection: "row",
    gap: 9,
    marginHorizontal: 14,
    marginTop: 13,
    padding: 12,
    borderWidth: 1,
    borderRadius: 11,
  },

  messageSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },

  messageError: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECACA",
  },

  messageText: {
    flex: 1,
    fontSize: 9,
    fontWeight: "700",
  },

  messageSuccessText: {
    color: "#047857",
    fontWeight: "900",
  },

  messageErrorText: {
    color: "#B91C1C",
    fontWeight: "900",
  },

  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    paddingHorizontal: 14,
    marginTop: 15,
  },

  stat: {
    width: "48.5%",
    padding: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 15,
    backgroundColor: "#ffffff",
  },

  statIcon: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },

  statValue: {
    marginTop: 8,
    fontSize: 21,
    fontWeight: "900",
  },

  statTitle: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "700",
  },

  toolbar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 19,
  },

  search: {
    minHeight: 48,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },

  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 10,
  },

  filterButton: {
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },

  filterButtonActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },

  filterText: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "800",
  },

  filterTextActive: {
    color: "#6D28D9",
  },

  filters: {
    marginHorizontal: 14,
    marginTop: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 13,
    backgroundColor: "#ffffff",
  },

  filtersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  filtersTitle: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "900",
  },

  clearText: {
    color: "#7C3AED",
    fontSize: 8,
    fontWeight: "800",
  },

  filterLabel: {
    marginBottom: 7,
    color: "#64748B",
    fontSize: 8,
    fontWeight: "800",
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
  },

  chipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },

  chipText: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#6D28D9",
  },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginTop: 23,
    marginBottom: 11,
  },

  listTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "900",
  },

  listSubtitle: {
    maxWidth: 280,
    marginTop: 3,
    color: "#64748B",
    fontSize: 8,
  },

  resultBadge: {
    minWidth: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
  },

  resultText: {
    color: "#6D28D9",
    fontSize: 9,
    fontWeight: "900",
  },

  card: {
    overflow: "hidden",
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 17,
    backgroundColor: "#ffffff",
  },

  preview: {
    position: "relative",
    overflow: "hidden",
    minHeight: 105,
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },

  previewCircle: {
    position: "absolute",
    width: 130,
    height: 130,
    right: -35,
    top: -55,
    borderRadius: 65,
    opacity: 0.5,
  },

  previewLogo: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 12,
    borderRadius: 15,
    backgroundColor: "#ffffff",
  },

  logoImage: {
    width: 48,
    height: 48,
  },

  previewEmoji: {
    fontSize: 26,
  },

  previewInfo: {
    flex: 1,
  },

  previewName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  previewOriginal: {
    marginTop: 3,
    color: "rgba(255,255,255,.78)",
    fontSize: 8,
  },

  cardBody: {
    padding: 13,
  },

  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: "#DCFCE7",
  },

  inactiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: "#FEE2E2",
  },

  activeText: {
    color: "#15803D",
    fontSize: 8,
    fontWeight: "800",
  },

  inactiveText: {
    color: "#B91C1C",
    fontSize: 8,
    fontWeight: "800",
  },

  configuredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: "#EDE9FE",
  },

  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: "#FEF3C7",
  },

  configuredText: {
    color: "#6D28D9",
    fontSize: 8,
    fontWeight: "800",
  },

  pendingText: {
    color: "#A16207",
    fontSize: 8,
    fontWeight: "800",
  },

  cardEmail: {
    marginTop: 9,
    color: "#64748B",
    fontSize: 8,
  },

  actions: {
    flexDirection: "row",
    gap: 7,
    marginTop: 11,
  },

  action: {
    minHeight: 38,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },

  viewAction: {
    backgroundColor: "#E0F2FE",
  },

  viewText: {
    color: "#0369A1",
    fontSize: 8,
    fontWeight: "900",
  },

  detailAction: {
    backgroundColor: "#EDE9FE",
  },

  detailText: {
    color: "#6D28D9",
    fontSize: 8,
    fontWeight: "900",
  },

  editAction: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
    borderRadius: 9,
    backgroundColor: "#FEF3C7",
  },

  editText: {
    color: "#A16207",
    fontSize: 8,
    fontWeight: "900",
  },

  empty: {
    alignItems: "center",
    marginHorizontal: 14,
    padding: 35,
    borderRadius: 15,
    backgroundColor: "#ffffff",
  },

  emptyEmoji: {
    fontSize: 35,
  },

  emptyTitle: {
    marginTop: 9,
    color: "#334155",
    fontSize: 13,
    fontWeight: "900",
  },

  emptyText: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 8,
    textAlign: "center",
  },

  emptyAction: {
    marginTop: 10,
    color: "#7C3AED",
    fontSize: 8,
    fontWeight: "900",
  },

  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },

  loadingIcon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
  },

  loadingEmoji: {
    fontSize: 31,
  },

  loadingTitle: {
    marginTop: 14,
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },

  loadingText: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 9,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 17,
    backgroundColor: "rgba(15,23,42,.7)",
  },

  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20,
  },

  modal: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 19,
    borderRadius: 20,
    backgroundColor: "#ffffff",
  },

  smallModal: {
    maxWidth: 420,
  },

  modalHeader: {
    flexDirection: "row",
    marginBottom: 17,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },

  modalSubtitle: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 8,
  },

  modalClose: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },

  modalCloseText: {
    color: "#475569",
    fontSize: 21,
  },

  detailItem: {
    marginBottom: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },

  detailLabel: {
    color: "#64748B",
    fontSize: 7,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    marginTop: 3,
    color: "#0F172A",
    fontSize: 9,
    fontWeight: "700",
  },

  fullPreview: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    marginTop: 5,
    padding: 25,
    borderRadius: 16,
  },

  fullPreviewCircle: {
    position: "absolute",
    width: 160,
    height: 160,
    right: -55,
    top: -70,
    borderRadius: 80,
    opacity: 0.55,
  },

  fullPreviewLogo: {
    width: 75,
    height: 75,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 21,
    backgroundColor: "#ffffff",
  },

  fullPreviewImage: {
    width: 67,
    height: 67,
  },

  fullPreviewEmoji: {
    fontSize: 34,
  },

  fullPreviewName: {
    marginTop: 13,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  fullPreviewText: {
    marginTop: 4,
    color: "rgba(255,255,255,.8)",
    fontSize: 8,
  },

  fullButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
  },

  fullButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  fieldLabel: {
    marginTop: 5,
    marginBottom: 6,
    color: "#334155",
    fontSize: 9,
    fontWeight: "800",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    color: "#0F172A",
    fontSize: 10,
  },

  help: {
    marginTop: 5,
    color: "#94A3B8",
    fontSize: 7,
    lineHeight: 11,
  },

  sectionLabel: {
    marginTop: 17,
    marginBottom: 8,
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "900",
  },

  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  palette: {
    width: "48%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 11,
  },

  paletteColors: {
    flexDirection: "row",
  },

  paletteColor: {
    width: 27,
    height: 27,
    marginRight: 5,
    borderRadius: 8,
  },

  paletteName: {
    marginTop: 6,
    color: "#475569",
    fontSize: 8,
    fontWeight: "800",
  },

  colorRow: {
    flexDirection: "row",
    gap: 8,
  },

  colorPreview: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
  },

  colorInput: {
    flex: 1,
  },

  restoreButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 39,
    marginTop: 10,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
  },

  restoreText: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "800",
  },

  editorPreview: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 14,
  },

  editorCircle: {
    position: "absolute",
    width: 110,
    height: 110,
    right: -30,
    top: -45,
    borderRadius: 55,
    opacity: 0.55,
  },

  editorLogo: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 11,
    borderRadius: 15,
    backgroundColor: "#ffffff",
  },

  editorLogoImage: {
    width: 48,
    height: 48,
  },

  editorEmoji: {
    fontSize: 25,
  },

  editorName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  editorSubtitle: {
    marginTop: 3,
    color: "rgba(255,255,255,.8)",
    fontSize: 7,
  },

  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },

  cancelButton: {
    minHeight: 45,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
  },

  cancelText: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "800",
  },

  saveButton: {
    minHeight: 45,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#7C3AED",
  },

  saveText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.55,
  },
});