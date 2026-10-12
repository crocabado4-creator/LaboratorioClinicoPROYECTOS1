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
  actualizarLaboratorio,
  cambiarEstadoLaboratorio,
  crearLaboratorio,
  obtenerLaboratorios,
  type Laboratorio,
} from "../services/laboratoriosService";

// =====================================================
// TIPOS
// =====================================================

type FiltroEstado =
  | "todos"
  | "activo"
  | "inactivo";

type ModoFormulario =
  | "crear"
  | "editar"
  | null;

type Mensaje = {
  tipo: "exito" | "error";
  texto: string;
} | null;

type FormularioLaboratorio = {
  nombre: string;
  direccion: string;
  telefono: string;
};

// =====================================================
// FORMULARIO INICIAL
// =====================================================

const formularioInicial: FormularioLaboratorio = {
  nombre: "",
  direccion: "",
  telefono: "",
};

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function LaboratoriosScreen() {
  const router = useRouter();

  const [laboratorios, setLaboratorios] =
    useState<Laboratorio[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [refrescando, setRefrescando] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState<Mensaje>(null);

  const [busqueda, setBusqueda] =
    useState("");

  const [filtroEstado, setFiltroEstado] =
    useState<FiltroEstado>("todos");

  const [mostrarFiltros, setMostrarFiltros] =
    useState(false);

  const [modoFormulario, setModoFormulario] =
    useState<ModoFormulario>(null);

  const [formulario, setFormulario] =
    useState<FormularioLaboratorio>(
      formularioInicial
    );

  const [laboratorioEditar, setLaboratorioEditar] =
    useState<Laboratorio | null>(null);

  const [laboratorioDetalle, setLaboratorioDetalle] =
    useState<Laboratorio | null>(null);

  const [laboratorioEstado, setLaboratorioEstado] =
    useState<Laboratorio | null>(null);

  // ===================================================
  // MENSAJES
  // ===================================================

  const mostrarMensaje = (
    tipo: "exito" | "error",
    texto: string
  ) => {
    setMensaje({
      tipo,
      texto,
    });
  };

  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const temporizador = setTimeout(() => {
      setMensaje(null);
    }, 5000);

    return () => {
      clearTimeout(temporizador);
    };
  }, [mensaje]);

  // ===================================================
  // CARGAR LABORATORIOS
  // ===================================================

  const cargarDatos = useCallback(
    async (mostrarCarga = true) => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        const resultado =
          await obtenerLaboratorios();

        setLaboratorios(resultado);
      } catch (error) {
        console.error(
          "Error cargando laboratorios:",
          error
        );

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
    },
    []
  );

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // REFRESCAR
  // ===================================================

  const refrescar = async () => {
    setRefrescando(true);

    await cargarDatos(false);
  };

  // ===================================================
  // FILTRAR LABORATORIOS EN TIEMPO REAL
  // ===================================================

  const laboratoriosFiltrados = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase();

    return laboratorios.filter(
      (laboratorio) => {
        const contenido = [
          laboratorio.nombre,
          laboratorio.nombreVisible,
          laboratorio.direccion,
          laboratorio.telefono,
          laboratorio.laboratorioId,
        ]
          .join(" ")
          .toLowerCase();

        const coincideBusqueda =
          texto === "" ||
          contenido.includes(texto);

        let coincideEstado = true;

        if (filtroEstado === "activo") {
          coincideEstado =
            laboratorio.activo === true;
        }

        if (filtroEstado === "inactivo") {
          coincideEstado =
            laboratorio.activo === false;
        }

        return (
          coincideBusqueda &&
          coincideEstado
        );
      }
    );
  }, [
    laboratorios,
    busqueda,
    filtroEstado,
  ]);

  // ===================================================
  // ESTADÍSTICAS
  // ===================================================

  const cantidadActivos =
    laboratorios.filter(
      (item) => item.activo
    ).length;

  const cantidadInactivos =
    laboratorios.filter(
      (item) => !item.activo
    ).length;

  const cantidadPersonalizados =
    laboratorios.filter(
      (item) =>
        Boolean(
          item.nombreVisible?.trim()
        ) ||
        Boolean(
          item.logoUrl?.trim()
        )
    ).length;

  // ===================================================
  // ACTUALIZAR FORMULARIO
  // ===================================================

  const actualizarCampo = (
    campo: keyof FormularioLaboratorio,
    valor: string
  ) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  // ===================================================
  // ABRIR CREAR
  // ===================================================

  const abrirCrear = () => {
    setFormulario({
      ...formularioInicial,
    });

    setLaboratorioEditar(null);

    setModoFormulario("crear");

    setMensaje(null);
  };

  // ===================================================
  // ABRIR EDITAR
  // ===================================================

  const abrirEditar = (
    laboratorio: Laboratorio
  ) => {
    setFormulario({
      nombre:
        laboratorio.nombre || "",

      direccion:
        laboratorio.direccion || "",

      telefono:
        laboratorio.telefono || "",
    });

    setLaboratorioEditar(
      laboratorio
    );

    setModoFormulario("editar");

    setMensaje(null);
  };

  // ===================================================
  // CERRAR FORMULARIO
  // ===================================================

  const cerrarFormulario = () => {
    if (guardando) {
      return;
    }

    setModoFormulario(null);

    setLaboratorioEditar(null);

    setFormulario({
      ...formularioInicial,
    });
  };

  // ===================================================
  // VALIDAR FORMULARIO SIN CORREO
  // ===================================================

  const validarFormulario = (): string => {
    if (
      formulario.nombre.trim().length < 2
    ) {
      return "Ingresa un nombre válido.";
    }

    if (
      formulario.direccion.trim().length < 4
    ) {
      return "Ingresa una dirección válida.";
    }

    if (
      !/^[0-9+\-\s()]{6,20}$/.test(
        formulario.telefono.trim()
      )
    ) {
      return "Ingresa un teléfono válido.";
    }

    return "";
  };

  // ===================================================
  // GUARDAR LABORATORIO
  // ===================================================

  const guardarLaboratorio = async () => {
    if (guardando) {
      return;
    }

    const validacion =
      validarFormulario();

    if (validacion) {
      Alert.alert(
        "Datos incorrectos",
        validacion
      );

      return;
    }

    try {
      setGuardando(true);

      const datos = {
        nombre:
          formulario.nombre.trim(),

        direccion:
          formulario.direccion.trim(),

        telefono:
          formulario.telefono.trim(),
      };

      if (
        modoFormulario === "crear"
      ) {
        await crearLaboratorio(datos);

        mostrarMensaje(
          "exito",
          "Laboratorio registrado correctamente."
        );
      } else if (
        modoFormulario === "editar" &&
        laboratorioEditar
      ) {
        await actualizarLaboratorio(
          laboratorioEditar.id,
          datos
        );

        mostrarMensaje(
          "exito",
          "Laboratorio actualizado correctamente."
        );
      }

      setModoFormulario(null);

      setLaboratorioEditar(null);

      setFormulario({
        ...formularioInicial,
      });

      await cargarDatos(false);
    } catch (error) {
      console.error(
        "Error guardando laboratorio:",
        error
      );

      const texto =
        error instanceof Error
          ? error.message
          : "No se pudo guardar el laboratorio.";

      mostrarMensaje(
        "error",
        texto
      );

      Alert.alert(
        "Error",
        texto
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // CONFIRMAR CAMBIO DE ESTADO
  // ===================================================

  const confirmarCambioEstado = (
    laboratorio: Laboratorio
  ) => {
    setLaboratorioEstado(
      laboratorio
    );
  };

  // ===================================================
  // ACTIVAR / DESACTIVAR
  // ===================================================

  const ejecutarCambioEstado = async () => {
    if (
      !laboratorioEstado ||
      guardando
    ) {
      return;
    }

    const laboratorio =
      laboratorioEstado;

    const nuevoEstado =
      !laboratorio.activo;

    try {
      setGuardando(true);

      await cambiarEstadoLaboratorio(
        laboratorio.id,
        nuevoEstado
      );

      setLaboratorioEstado(null);

      mostrarMensaje(
        "exito",
        nuevoEstado
          ? "Laboratorio activado correctamente."
          : "Laboratorio desactivado correctamente."
      );

      await cargarDatos(false);
    } catch (error) {
      console.error(
        "Error cambiando estado:",
        error
      );

      const texto =
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado.";

      mostrarMensaje(
        "error",
        texto
      );

      Alert.alert(
        "Error",
        texto
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // INTERFAZ PRINCIPAL
  // ===================================================

  return (
    <SafeAreaView style={styles.contenedor}>
      <StatusBar barStyle="dark-content" />

      {/* ENCABEZADO */}

      <View style={styles.encabezado}>
        <Pressable
          style={styles.botonVolver}
          onPress={() => router.back()}
        >
          <Text style={styles.botonVolverTexto}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.encabezadoCentro}>
          <Text style={styles.encabezadoTitulo}>
            Laboratorios
          </Text>

          <Text style={styles.encabezadoSubtitulo}>
            Administración de laboratorios
          </Text>
        </View>

        <Pressable
          style={styles.botonAgregarEncabezado}
          onPress={abrirCrear}
        >
          <Text style={styles.botonAgregarTexto}>
            +
          </Text>
        </Pressable>
      </View>

      {/* MENSAJES */}

      {mensaje && (
        <View
          style={[
            styles.mensaje,
            mensaje.tipo === "exito"
              ? styles.mensajeExito
              : styles.mensajeError,
          ]}
        >
          <Text
            style={[
              styles.mensajeTexto,
              {
                color:
                  mensaje.tipo === "exito"
                    ? "#166534"
                    : "#991B1B",
              },
            ]}
          >
            {mensaje.texto}
          </Text>

          <Pressable
            onPress={() =>
              setMensaje(null)
            }
          >
            <Text style={styles.cerrarMensaje}>
              ×
            </Text>
          </Pressable>
        </View>
      )}

      {/* CONTENIDO */}

      <ScrollView
        contentContainerStyle={styles.contenido}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            colors={["#2563EB"]}
          />
        }
      >
        {/* BANNER */}

        <View style={styles.banner}>
          <Text style={styles.bannerEtiqueta}>
            PANEL DE CONTROL
          </Text>

          <Text style={styles.bannerTitulo}>
            Gestión de laboratorios
          </Text>

          <Text style={styles.bannerDescripcion}>
            Registra, consulta y administra
            los laboratorios del sistema.
          </Text>

          <Pressable
            style={styles.bannerBoton}
            onPress={abrirCrear}
          >
            <Text style={styles.bannerBotonTexto}>
              + Nuevo laboratorio
            </Text>
          </Pressable>
        </View>

        {/* ESTADÍSTICAS */}

        <View style={styles.estadisticas}>
          <View style={styles.estadistica}>
            <Text style={styles.estadisticaNumero}>
              {laboratorios.length}
            </Text>

            <Text style={styles.estadisticaTitulo}>
              Total
            </Text>
          </View>

          <View style={styles.estadistica}>
            <Text
              style={[
                styles.estadisticaNumero,
                {
                  color: "#16A34A",
                },
              ]}
            >
              {cantidadActivos}
            </Text>

            <Text style={styles.estadisticaTitulo}>
              Activos
            </Text>
          </View>

          <View style={styles.estadistica}>
            <Text
              style={[
                styles.estadisticaNumero,
                {
                  color: "#DC2626",
                },
              ]}
            >
              {cantidadInactivos}
            </Text>

            <Text style={styles.estadisticaTitulo}>
              Inactivos
            </Text>
          </View>
        </View>

        {/* PERSONALIZACIÓN */}

        <View style={styles.personalizados}>
          <Text style={styles.personalizadosTexto}>
            Laboratorios personalizados:{" "}
            {cantidadPersonalizados}
          </Text>
        </View>

        {/* BUSCADOR */}

        <View style={styles.buscadorContenedor}>
          <Text style={styles.seccionTitulo}>
            Lista de laboratorios
          </Text>

          <Text style={styles.seccionDescripcion}>
            Busca por nombre, dirección,
            teléfono o identificador.
          </Text>

          <TextInput
            style={styles.buscador}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar laboratorio..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />

          <Pressable
            style={styles.botonFiltros}
            onPress={() =>
              setMostrarFiltros(
                !mostrarFiltros
              )
            }
          >
            <Text style={styles.botonFiltrosTexto}>
              {mostrarFiltros
                ? "Ocultar filtros ▲"
                : "Mostrar filtros ▼"}
            </Text>
          </Pressable>

          {mostrarFiltros && (
            <View style={styles.filtros}>
              {(
                [
                  "todos",
                  "activo",
                  "inactivo",
                ] as const
              ).map((filtro) => (
                <Pressable
                  key={filtro}
                  style={[
                    styles.filtro,
                    filtroEstado === filtro &&
                      styles.filtroActivo,
                  ]}
                  onPress={() =>
                    setFiltroEstado(filtro)
                  }
                >
                  <Text
                    style={[
                      styles.filtroTexto,
                      filtroEstado === filtro &&
                        styles.filtroTextoActivo,
                    ]}
                  >
                    {filtro === "todos"
                      ? "Todos"
                      : filtro === "activo"
                      ? "Activos"
                      : "Inactivos"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.resultados}>
            {laboratoriosFiltrados.length} resultados
          </Text>
        </View>

        {/* LISTADO */}

        {cargando ? (
          <View style={styles.cargando}>
            <ActivityIndicator
              size="large"
              color="#2563EB"
            />

            <Text style={styles.cargandoTexto}>
              Cargando laboratorios...
            </Text>
          </View>
        ) : laboratoriosFiltrados.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioIcono}>
              🏥
            </Text>

            <Text style={styles.vacioTitulo}>
              No se encontraron laboratorios
            </Text>

            <Text style={styles.vacioDescripcion}>
              Registra un laboratorio o modifica
              los filtros de búsqueda.
            </Text>
          </View>
        ) : (
          laboratoriosFiltrados.map(
            (laboratorio) => (
              <View
                key={laboratorio.id}
                style={styles.tarjeta}
              >
                <View style={styles.tarjetaEncabezado}>
                  <View style={styles.iconoLaboratorio}>
                    {laboratorio.logoUrl ? (
                      <Image
                        source={{
                          uri: laboratorio.logoUrl,
                        }}
                        style={styles.logoLaboratorio}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.iconoTexto}>
                        🏥
                      </Text>
                    )}
                  </View>

                  <View style={styles.tarjetaInfo}>
                    <Text style={styles.tarjetaTitulo}>
                      {laboratorio.nombre}
                    </Text>

                    <Text style={styles.tarjetaSubtitulo}>
                      {laboratorio.nombreVisible ||
                        "Sin nombre personalizado"}
                    </Text>
                  </View>
                </View>

                {/* ESTADO */}

                <View
                  style={[
                    styles.estadoEtiqueta,
                    laboratorio.activo
                      ? styles.estadoActivo
                      : styles.estadoInactivo,
                  ]}
                >
                  <Text
                    style={[
                      styles.estadoTexto,
                      {
                        color: laboratorio.activo
                          ? "#166534"
                          : "#991B1B",
                      },
                    ]}
                  >
                    {laboratorio.activo
                      ? "● Activo"
                      : "● Inactivo"}
                  </Text>
                </View>

                <View style={styles.separador} />

                {/* DATOS */}

                <Text style={styles.tarjetaDato}>
                  Dirección:{" "}
                  {laboratorio.direccion ||
                    "No registrada"}
                </Text>

                <Text style={styles.tarjetaDato}>
                  Teléfono:{" "}
                  {laboratorio.telefono ||
                    "No registrado"}
                </Text>

                <Text style={styles.tarjetaDato}>
                  ID: {laboratorio.laboratorioId}
                </Text>

                {/* ACCIONES */}

                <View style={styles.acciones}>
                  <Pressable
                    style={[
                      styles.accion,
                      styles.accionVer,
                    ]}
                    onPress={() =>
                      setLaboratorioDetalle(
                        laboratorio
                      )
                    }
                  >
                    <Text style={styles.accionTextoVer}>
                      Ver
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.accion,
                      styles.accionEditar,
                    ]}
                    onPress={() =>
                      abrirEditar(laboratorio)
                    }
                  >
                    <Text style={styles.accionTextoEditar}>
                      Editar
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.accion,
                      laboratorio.activo
                        ? styles.accionDesactivar
                        : styles.accionActivar,
                    ]}
                    onPress={() =>
                      confirmarCambioEstado(
                        laboratorio
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.accionTextoEstado,
                        {
                          color: laboratorio.activo
                            ? "#B91C1C"
                            : "#166534",
                        },
                      ]}
                    >
                      {laboratorio.activo
                        ? "Desactivar"
                        : "Activar"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          )
        )}
      </ScrollView>

      {/* ============================================= */}
      {/* MODAL CREAR / EDITAR */}
      {/* ============================================= */}

      <Modal
        visible={modoFormulario !== null}
        transparent
        animationType="slide"
        onRequestClose={cerrarFormulario}
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
            <View style={styles.modalEncabezado}>
              <View>
                <Text style={styles.modalTitulo}>
                  {modoFormulario === "crear"
                    ? "Nuevo laboratorio"
                    : "Editar laboratorio"}
                </Text>

                <Text style={styles.modalSubtitulo}>
                  Completa los datos del laboratorio
                </Text>
              </View>

              <Pressable
                onPress={cerrarFormulario}
                disabled={guardando}
              >
                <Text style={styles.modalCerrar}>
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.modalContenido
              }
            >
              {/* NOMBRE */}

              <Text style={styles.campoEtiqueta}>
                Nombre del laboratorio *
              </Text>

              <TextInput
                style={styles.campo}
                placeholder="Ej. Laboratorio Central"
                placeholderTextColor="#94A3B8"
                value={formulario.nombre}
                onChangeText={(valor) =>
                  actualizarCampo(
                    "nombre",
                    valor
                  )
                }
              />

              {/* DIRECCIÓN */}

              <Text style={styles.campoEtiqueta}>
                Dirección *
              </Text>

              <TextInput
                style={styles.campo}
                placeholder="Dirección del laboratorio"
                placeholderTextColor="#94A3B8"
                value={formulario.direccion}
                onChangeText={(valor) =>
                  actualizarCampo(
                    "direccion",
                    valor
                  )
                }
              />

              {/* TELÉFONO */}

              <Text style={styles.campoEtiqueta}>
                Teléfono *
              </Text>

              <TextInput
                style={styles.campo}
                placeholder="Número de teléfono"
                placeholderTextColor="#94A3B8"
                value={formulario.telefono}
                onChangeText={(valor) =>
                  actualizarCampo(
                    "telefono",
                    valor
                  )
                }
                keyboardType="phone-pad"
              />

              {/* SIN CORREO ELECTRÓNICO */}

              <View style={styles.informacion}>
                <Text style={styles.informacionTexto}>
                  El laboratorio se registrará sin
                  correo electrónico. Después podrás
                  asignarle un administrador desde
                  el módulo Administradores.
                </Text>
              </View>

              {/* BOTONES */}

              <View style={styles.modalAcciones}>
                <Pressable
                  style={styles.botonCancelar}
                  onPress={cerrarFormulario}
                  disabled={guardando}
                >
                  <Text style={styles.botonCancelarTexto}>
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.botonGuardar,
                    guardando &&
                      styles.botonDeshabilitado,
                  ]}
                  onPress={guardarLaboratorio}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.botonGuardarTexto}>
                      {modoFormulario === "crear"
                        ? "Registrar"
                        : "Guardar"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================= */}
      {/* MODAL DETALLES */}
      {/* ============================================= */}

      <Modal
        visible={laboratorioDetalle !== null}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setLaboratorioDetalle(null)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenedor}>
            <View style={styles.modalEncabezado}>
              <Text style={styles.modalTitulo}>
                Detalles del laboratorio
              </Text>

              <Pressable
                onPress={() =>
                  setLaboratorioDetalle(null)
                }
              >
                <Text style={styles.modalCerrar}>
                  ×
                </Text>
              </Pressable>
            </View>

            {laboratorioDetalle && (
              <ScrollView
                contentContainerStyle={
                  styles.modalContenido
                }
              >
                {laboratorioDetalle.logoUrl ? (
                  <Image
                    source={{
                      uri: laboratorioDetalle.logoUrl,
                    }}
                    style={styles.logoDetalle}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.logoDetalleVacio}>
                    <Text style={styles.logoDetalleTexto}>
                      🏥
                    </Text>
                  </View>
                )}

                <Detalle
                  titulo="Nombre"
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
                  titulo="Dirección"
                  valor={laboratorioDetalle.direccion}
                />

                <Detalle
                  titulo="Teléfono"
                  valor={laboratorioDetalle.telefono}
                />

                <Detalle
                  titulo="ID del laboratorio"
                  valor={laboratorioDetalle.laboratorioId}
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
                  titulo="Color primario"
                  valor={laboratorioDetalle.colorPrimario}
                />

                <Detalle
                  titulo="Color secundario"
                  valor={laboratorioDetalle.colorSecundario}
                />

                <Pressable
                  style={[
                    styles.botonGuardar,
                    {
                      marginTop: 20,
                    },
                  ]}
                  onPress={() =>
                    setLaboratorioDetalle(null)
                  }
                >
                  <Text style={styles.botonGuardarTexto}>
                    Cerrar
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============================================= */}
      {/* MODAL ACTIVAR / DESACTIVAR */}
      {/* ============================================= */}

      <Modal
        visible={laboratorioEstado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!guardando) {
            setLaboratorioEstado(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmacion}>
            <Text style={styles.confirmacionIcono}>
              {laboratorioEstado?.activo
                ? "⚠️"
                : "✓"}
            </Text>

            <Text style={styles.confirmacionTitulo}>
              {laboratorioEstado?.activo
                ? "Desactivar laboratorio"
                : "Activar laboratorio"}
            </Text>

            <Text style={styles.confirmacionDescripcion}>
              ¿Estás seguro de que deseas{" "}
              {laboratorioEstado?.activo
                ? "desactivar"
                : "activar"}{" "}
              el laboratorio{" "}
              {laboratorioEstado?.nombre}?
            </Text>

            <View style={styles.modalAcciones}>
              <Pressable
                style={styles.botonCancelar}
                onPress={() =>
                  setLaboratorioEstado(null)
                }
                disabled={guardando}
              >
                <Text style={styles.botonCancelarTexto}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.botonGuardar,
                  guardando &&
                    styles.botonDeshabilitado,
                ]}
                onPress={ejecutarCambioEstado}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.botonGuardarTexto}>
                    Confirmar
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

// =====================================================
// COMPONENTE DETALLE
// =====================================================

function Detalle({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <View style={styles.detalleFila}>
      <Text style={styles.detalleTitulo}>
        {titulo}
      </Text>

      <Text style={styles.detalleValor}>
        {valor || "No registrado"}
      </Text>
    </View>
  );
}

// =====================================================
// ESTILOS COMPLETOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  encabezado: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  botonVolver: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },

  botonVolverTexto: {
    fontSize: 30,
    color: "#334155",
    marginTop: -5,
  },

  encabezadoCentro: {
    flex: 1,
    marginLeft: 12,
  },

  encabezadoTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  encabezadoSubtitulo: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },

  botonAgregarEncabezado: {
    width: 40,
    height: 40,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  botonAgregarTexto: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "600",
  },

  contenido: {
    padding: 16,
    paddingBottom: 40,
  },

  mensaje: {
    padding: 13,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mensajeExito: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  mensajeError: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  mensajeTexto: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  cerrarMensaje: {
    fontSize: 24,
    color: "#64748B",
    marginLeft: 12,
  },

  banner: {
    backgroundColor: "#1D4ED8",
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
  },

  bannerEtiqueta: {
    fontSize: 11,
    fontWeight: "800",
    color: "#BFDBFE",
    letterSpacing: 1,
  },

  bannerTitulo: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
    marginTop: 10,
  },

  bannerDescripcion: {
    color: "#DBEAFE",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  bannerBoton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 18,
  },

  bannerBotonTexto: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "800",
  },

  estadisticas: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  estadistica: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },

  estadisticaNumero: {
    fontSize: 25,
    fontWeight: "900",
    color: "#2563EB",
  },

  estadisticaTitulo: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 5,
  },

  personalizados: {
    backgroundColor: "#EFF6FF",
    padding: 13,
    borderRadius: 10,
    marginBottom: 20,
  },

  personalizadosTexto: {
    fontSize: 12,
    color: "#1D4ED8",
    fontWeight: "600",
  },

  buscadorContenedor: {
    marginBottom: 18,
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  seccionDescripcion: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
    marginBottom: 14,
  },

  buscador: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 15,
    color: "#0F172A",
    fontSize: 14,
  },

  botonFiltros: {
    alignSelf: "flex-start",
    paddingVertical: 12,
  },

  botonFiltrosTexto: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },

  filtros: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  filtro: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
  },

  filtroActivo: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  filtroTexto: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
  },

  filtroTextoActivo: {
    color: "#FFFFFF",
  },

  resultados: {
    fontSize: 12,
    color: "#64748B",
  },

  cargando: {
    padding: 40,
    alignItems: "center",
  },

  cargandoTexto: {
    marginTop: 12,
    color: "#64748B",
  },

  vacio: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  vacioIcono: {
    fontSize: 42,
  },

  vacioTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginTop: 12,
  },

  vacioDescripcion: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  tarjetaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconoLaboratorio: {
    width: 55,
    height: 55,
    backgroundColor: "#EFF6FF",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  iconoTexto: {
    fontSize: 28,
  },

  logoLaboratorio: {
    width: 48,
    height: 48,
  },

  tarjetaInfo: {
    flex: 1,
    marginLeft: 12,
  },

  tarjetaTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  tarjetaSubtitulo: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  estadoEtiqueta: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 15,
  },

  estadoActivo: {
    backgroundColor: "#DCFCE7",
  },

  estadoInactivo: {
    backgroundColor: "#FEE2E2",
  },

  estadoTexto: {
    fontSize: 12,
    fontWeight: "800",
  },

  separador: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 15,
  },

  tarjetaDato: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
    lineHeight: 19,
  },

  acciones: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  accion: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  accionVer: {
    backgroundColor: "#EFF6FF",
  },

  accionEditar: {
    backgroundColor: "#FEF3C7",
  },

  accionDesactivar: {
    backgroundColor: "#FEE2E2",
  },

  accionActivar: {
    backgroundColor: "#DCFCE7",
  },

  accionTextoVer: {
    color: "#1D4ED8",
    fontWeight: "800",
    fontSize: 12,
  },

  accionTextoEditar: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 12,
  },

  accionTextoEstado: {
    fontWeight: "800",
    fontSize: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    padding: 16,
  },

  modalContenedor: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    maxHeight: "90%",
    overflow: "hidden",
  },

  modalEncabezado: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  modalSubtitulo: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  modalCerrar: {
    fontSize: 28,
    color: "#64748B",
    paddingHorizontal: 5,
  },

  modalContenido: {
    padding: 20,
    paddingBottom: 30,
  },

  campoEtiqueta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    marginTop: 10,
  },

  campo: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0F172A",
  },

  informacion: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },

  informacionTexto: {
    fontSize: 12,
    color: "#1D4ED8",
    lineHeight: 19,
  },

  modalAcciones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  botonCancelar: {
    flex: 1,
    paddingVertical: 15,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  botonCancelarTexto: {
    color: "#475569",
    fontWeight: "800",
    fontSize: 13,
  },

  botonGuardar: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  botonGuardarTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  detalleFila: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 12,
  },

  detalleTitulo: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },

  detalleValor: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 5,
  },

  logoDetalle: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 20,
  },

  logoDetalleVacio: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  logoDetalleTexto: {
    fontSize: 45,
  },

  confirmacion: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 25,
  },

  confirmacionIcono: {
    fontSize: 40,
    textAlign: "center",
  },

  confirmacionTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginTop: 12,
  },

  confirmacionDescripcion: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 12,
  },
});