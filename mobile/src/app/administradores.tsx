import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  actualizarAdministrador,
  cambiarEstadoAdministrador,
  crearAdministrador,
  obtenerAdministradores,
  obtenerLaboratoriosAdministradores,
  obtenerPermisosGestionAdministradores,
  passwordSegura,
  type AdministradorSistema,
  type LaboratorioAdministrador,
} from "../services/administradoresService";

type FiltroEstado =
  | "todos"
  | "activo"
  | "inactivo";

type ModoFormulario =
  | "crear"
  | "editar"
  | null;

type Mensaje = {
  tipo:
    | "exito"
    | "error";

  texto:
    string;
} | null;

type FormularioAdministrador = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  confirmarPassword: string;
  laboratorioId: string;
  requiereVerificacionEmail: boolean;
};

const formularioInicial:
  FormularioAdministrador = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  confirmarPassword: "",
  laboratorioId: "",
  requiereVerificacionEmail: true,
};

export default function AdministradoresScreen() {
  const router =
    useRouter();

  const [
    administradores,
    setAdministradores,
  ] =
    useState<AdministradorSistema[]>(
      []
    );

  const [
    laboratorios,
    setLaboratorios,
  ] =
    useState<LaboratorioAdministrador[]>(
      []
    );

  const [
    permisos,
    setPermisos,
  ] = useState<string[]>(
    []
  );

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    refrescando,
    setRefrescando,
  ] = useState(false);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState<Mensaje>(
    null
  );

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    filtroEstado,
    setFiltroEstado,
  ] =
    useState<FiltroEstado>(
      "todos"
    );

  const [
    filtroLaboratorio,
    setFiltroLaboratorio,
  ] = useState("todos");

  const [
    mostrarFiltros,
    setMostrarFiltros,
  ] = useState(false);

  const [
    modoFormulario,
    setModoFormulario,
  ] =
    useState<ModoFormulario>(
      null
    );

  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioAdministrador>(
      formularioInicial
    );

  const [
    administradorEditar,
    setAdministradorEditar,
  ] =
    useState<AdministradorSistema | null>(
      null
    );

  const [
    administradorVer,
    setAdministradorVer,
  ] =
    useState<AdministradorSistema | null>(
      null
    );

  const [
    administradorDetalle,
    setAdministradorDetalle,
  ] =
    useState<AdministradorSistema | null>(
      null
    );

  const [
    administradorEstado,
    setAdministradorEstado,
  ] =
    useState<AdministradorSistema | null>(
      null
    );

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  const [
    mostrarConfirmacionPassword,
    setMostrarConfirmacionPassword,
  ] = useState(false);

  const puedeCrear =
    permisos.includes(
      "administradores.crear"
    );

  const puedeEditar =
    permisos.includes(
      "administradores.editar"
    );

  const puedeCambiarEstado =
    permisos.includes(
      "administradores.desactivar"
    );

  const mostrarMensaje = (
    tipo:
      | "exito"
      | "error",
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
  }, [
    mensaje,
  ]);

  const cargarDatos =
    useCallback(
      async (
        mostrarCarga = true
      ) => {
        try {
          if (
            mostrarCarga
          ) {
            setCargando(
              true
            );
          }

          const [
            resultadoAdministradores,
            resultadoLaboratorios,
            resultadoPermisos,
          ] =
            await Promise.all([
              obtenerAdministradores(),
              obtenerLaboratoriosAdministradores(),
              obtenerPermisosGestionAdministradores(),
            ]);

          setAdministradores(
            resultadoAdministradores
          );

          setLaboratorios(
            resultadoLaboratorios
          );

          setPermisos(
            resultadoPermisos
          );

        } catch (error) {
          console.error(
            "Error cargando administradores:",
            error
          );

          mostrarMensaje(
            "error",
            error instanceof
            Error
              ? error.message
              : "No se pudo cargar la información."
          );

        } finally {
          setCargando(
            false
          );

          setRefrescando(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    cargarDatos();
  }, [
    cargarDatos,
  ]);

  const refrescar =
    async () => {
      setRefrescando(
        true
      );

      await cargarDatos(
        false
      );
    };

  const obtenerLaboratorio = (
    laboratorioId: string
  ) => {
    return (
      laboratorios.find(
        (
          laboratorio
        ) =>
          laboratorio.id ===
            laboratorioId ||
          laboratorio.laboratorioId ===
            laboratorioId
      ) ||
      null
    );
  };

  const nombreLaboratorio = (
    laboratorioId: string
  ): string => {
    const laboratorio =
      obtenerLaboratorio(
        laboratorioId
      );

    return (
      laboratorio?.nombreVisible ||
      laboratorio?.nombre ||
      "Laboratorio no disponible"
    );
  };

  const administradoresFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return administradores.filter(
        (
          administrador
        ) => {
          const laboratorio =
            laboratorios.find(
              (
                item
              ) =>
                item.id ===
                  administrador.laboratorioId ||
                item.laboratorioId ===
                  administrador.laboratorioId
            );

          const coincideBusqueda =
            texto === "" ||
            [
              administrador.nombre,
              administrador.apellido,
              administrador.email,
              laboratorio?.nombre,
              laboratorio?.nombreVisible,
              administrador.laboratorioId,
            ].some(
              (
                valor
              ) =>
                String(
                  valor ||
                  ""
                )
                  .toLowerCase()
                  .includes(
                    texto
                  )
            );

          let coincideEstado =
            true;

          if (
            filtroEstado ===
            "activo"
          ) {
            coincideEstado =
              administrador.activo ===
              true;
          }

          if (
            filtroEstado ===
            "inactivo"
          ) {
            coincideEstado =
              administrador.activo ===
              false;
          }

          const coincideLaboratorio =
            filtroLaboratorio ===
              "todos" ||
            administrador.laboratorioId ===
              filtroLaboratorio;

          return (
            coincideBusqueda &&
            coincideEstado &&
            coincideLaboratorio
          );
        }
      );
    }, [
      administradores,
      laboratorios,
      busqueda,
      filtroEstado,
      filtroLaboratorio,
    ]);

  const activos =
    administradores.filter(
      (
        administrador
      ) =>
        administrador.activo
    ).length;

  const inactivos =
    administradores.length -
    activos;

  const laboratoriosConAdministrador =
    new Set(
      administradores
        .map(
          (
            administrador
          ) =>
            administrador.laboratorioId
        )
        .filter(
          Boolean
        )
    ).size;

  const laboratoriosActivos =
    laboratorios.filter(
      (
        laboratorio
      ) =>
        laboratorio.activo
    );

  const actualizarCampo = <
    K extends keyof FormularioAdministrador
  >(
    campo: K,
    valor:
      FormularioAdministrador[K]
  ) => {
    setFormulario(
      (
        anterior
      ) => ({
        ...anterior,

        [campo]:
          valor,
      })
    );
  };

  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFiltroEstado(
        "todos"
      );
      setFiltroLaboratorio(
        "todos"
      );
    };

  const abrirCrear =
    () => {
      setFormulario({
        ...formularioInicial,
      });

      setAdministradorEditar(
        null
      );

      setMostrarPassword(
        false
      );

      setMostrarConfirmacionPassword(
        false
      );

      setMensaje(
        null
      );

      setModoFormulario(
        "crear"
      );
    };

  const abrirEditar = (
    administrador:
      AdministradorSistema
  ) => {
    setAdministradorEditar(
      administrador
    );

    setFormulario({
      nombre:
        administrador.nombre,

      apellido:
        administrador.apellido,

      email:
        administrador.email,

      password:
        "",

      confirmarPassword:
        "",

      laboratorioId:
        administrador.laboratorioId,

      requiereVerificacionEmail:
        administrador.requiereVerificacionEmail,
    });

    setMensaje(
      null
    );

    setModoFormulario(
      "editar"
    );
  };

  const cerrarFormulario =
    () => {
      if (
        guardando
      ) {
        return;
      }

      setModoFormulario(
        null
      );

      setAdministradorEditar(
        null
      );

      setFormulario({
        ...formularioInicial,
      });
    };

  const validarFormulario =
    (): string => {
      if (
        formulario.nombre
          .trim()
          .length < 2
      ) {
        return "Ingresa un nombre válido.";
      }

      if (
        formulario.apellido
          .trim()
          .length < 2
      ) {
        return "Ingresa un apellido válido.";
      }

      if (
        !formulario.laboratorioId
      ) {
        return "Debes seleccionar un laboratorio.";
      }

      if (
        modoFormulario ===
        "crear"
      ) {
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            formulario.email
              .trim()
              .toLowerCase()
          )
        ) {
          return "Ingresa un correo electrónico válido.";
        }

        if (
          !passwordSegura(
            formulario.password
          )
        ) {
          return "La contraseña no cumple todos los requisitos de seguridad.";
        }

        if (
          formulario.password !==
          formulario.confirmarPassword
        ) {
          return "Las contraseñas no coinciden.";
        }
      }

      return "";
    };

  const guardarAdministrador =
    async () => {
      const validacion =
        validarFormulario();

      if (
        validacion
      ) {
        mostrarMensaje(
          "error",
          validacion
        );

        return;
      }

      try {
        setGuardando(
          true
        );

        if (
          modoFormulario ===
          "crear"
        ) {
          await crearAdministrador(
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              email:
                formulario.email,

              password:
                formulario.password,

              laboratorioId:
                formulario.laboratorioId,

              requiereVerificacionEmail:
                formulario.requiereVerificacionEmail,
            }
          );

          mostrarMensaje(
            "exito",
            formulario.requiereVerificacionEmail
              ? "Administrador registrado. Se envió el correo de verificación."
              : "Administrador registrado correctamente."
          );

        } else if (
          modoFormulario ===
            "editar" &&
          administradorEditar
        ) {
          await actualizarAdministrador(
            administradorEditar.id,
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              laboratorioId:
                formulario.laboratorioId,
            }
          );

          mostrarMensaje(
            "exito",
            "Administrador actualizado correctamente."
          );
        }

        setModoFormulario(
          null
        );

        setAdministradorEditar(
          null
        );

        setFormulario({
          ...formularioInicial,
        });

        await cargarDatos(
          false
        );

      } catch (error) {
        console.error(
          "Error guardando administrador:",
          error
        );

        mostrarMensaje(
          "error",
          error instanceof
          Error
            ? error.message
            : "No se pudo guardar el administrador."
        );

      } finally {
        setGuardando(
          false
        );
      }
    };

  const ejecutarCambioEstado =
    async () => {
      if (
        !administradorEstado
      ) {
        return;
      }

      try {
        setGuardando(
          true
        );

        const nuevoEstado =
          !administradorEstado.activo;

        await cambiarEstadoAdministrador(
          administradorEstado.id,
          nuevoEstado
        );

        setAdministradorEstado(
          null
        );

        await cargarDatos(
          false
        );

        mostrarMensaje(
          "exito",
          nuevoEstado
            ? "Administrador activado correctamente."
            : "Administrador desactivado correctamente."
        );

      } catch (error) {
        console.error(
          "Error cambiando estado:",
          error
        );

        mostrarMensaje(
          "error",
          error instanceof
          Error
            ? error.message
            : "No se pudo cambiar el estado."
        );

      } finally {
        setGuardando(
          false
        );
      }
    };

  const formatearFecha = (
    fecha: unknown
  ): string => {
    if (
      !fecha
    ) {
      return "No registrada";
    }

    try {
      if (
        typeof fecha ===
          "object" &&
        fecha !== null &&
        "toDate" in fecha &&
        typeof (
          fecha as {
            toDate?: unknown;
          }
        ).toDate ===
          "function"
      ) {
        return (
          fecha as {
            toDate:
              () => Date;
          }
        )
          .toDate()
          .toLocaleString(
            "es-BO"
          );
      }

      if (
        typeof fecha ===
          "object" &&
        fecha !== null &&
        "seconds" in fecha
      ) {
        const segundos =
          Number(
            (
              fecha as {
                seconds:
                  number;
              }
            ).seconds
          );

        return new Date(
          segundos *
            1000
        ).toLocaleString(
          "es-BO"
        );
      }

      return "No registrada";

    } catch {
      return "No registrada";
    }
  };

  const requisitoLongitud =
    formulario.password.length >=
    8;

  const requisitoMayuscula =
    /[A-Z]/.test(
      formulario.password
    );

  const requisitoMinuscula =
    /[a-z]/.test(
      formulario.password
    );

  const requisitoNumero =
    /[0-9]/.test(
      formulario.password
    );

  const requisitoEspecial =
    /[^A-Za-z0-9]/.test(
      formulario.password
    );

  if (
    cargando
  ) {
    return (
      <SafeAreaView
        style={
          styles.loadingPage
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
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
            👤
          </Text>
        </View>

        <ActivityIndicator
          size="large"
          color="#7C3AED"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Administradores
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando responsables de laboratorio...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.page
      }
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#581C87"
      />

      <ScrollView
        contentContainerStyle={
          styles.scroll
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={
              refrescando
            }
            onRefresh={
              refrescar
            }
            tintColor="#7C3AED"
          />
        }
      >
        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.headerTop
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
                ADMINISTRACIÓN
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Administradores
              </Text>

              <Text
                style={
                  styles.headerDescription
                }
              >
                Gestiona los responsables de los laboratorios registrados.
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
                👤
              </Text>
            </View>
          </View>

          {puedeCrear && (
            <Pressable
              style={
                styles.newButton
              }
              onPress={
                abrirCrear
              }
            >
              <Text
                style={
                  styles.newButtonText
                }
              >
                + Nuevo administrador
              </Text>
            </Pressable>
          )}
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
            <Text
              style={[
                styles.messageSymbol,

                mensaje.tipo ===
                  "exito"
                  ? styles.messageSuccessText
                  : styles.messageErrorText,
              ]}
            >
              {mensaje.tipo ===
              "exito"
                ? "✓"
                : "!"}
            </Text>

            <Text
              style={[
                styles.messageText,

                mensaje.tipo ===
                  "exito"
                  ? styles.messageSuccessText
                  : styles.messageErrorText,
              ]}
            >
              {mensaje.texto}
            </Text>
          </View>
        )}

        <View
          style={
            styles.stats
          }
        >
          <Stat
            icono="👤"
            titulo="Administradores"
            valor={
              administradores.length
            }
            fondo="#F3E8FF"
            color="#7E22CE"
          />

          <Stat
            icono="✓"
            titulo="Activos"
            valor={
              activos
            }
            fondo="#DCFCE7"
            color="#15803D"
          />

          <Stat
            icono="○"
            titulo="Inactivos"
            valor={
              inactivos
            }
            fondo="#FEE2E2"
            color="#B91C1C"
          />

          <Stat
            icono="🏥"
            titulo="Laboratorios"
            valor={
              laboratoriosConAdministrador
            }
            fondo="#DBEAFE"
            color="#1D4ED8"
          />
        </View>

        <View
          style={
            styles.toolbar
          }
        >
          <View
            style={
              styles.searchContainer
            }
          >
            <Text
              style={
                styles.searchIcon
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
              placeholder="Buscar nombre, apellido, correo..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={
                false
              }
            />
          </View>

          <Pressable
            style={[
              styles.filterButton,

              mostrarFiltros &&
                styles.filterButtonActive,
            ]}
            onPress={() =>
              setMostrarFiltros(
                !mostrarFiltros
              )
            }
          >
            <Text
              style={[
                styles.filterButtonText,

                mostrarFiltros &&
                  styles.filterButtonTextActive,
              ]}
            >
              ⚙ Filtros
            </Text>
          </Pressable>
        </View>

        {mostrarFiltros && (
          <View
            style={
              styles.filtersCard
            }
          >
            <View
              style={
                styles.filtersHeader
              }
            >
              <Text
                style={
                  styles.filtersTitle
                }
              >
                Filtrar administradores
              </Text>

              <Pressable
                onPress={
                  limpiarFiltros
                }
              >
                <Text
                  style={
                    styles.clearText
                  }
                >
                  Limpiar
                </Text>
              </Pressable>
            </View>

            <Text
              style={
                styles.filterLabel
              }
            >
              Estado
            </Text>

            <View
              style={
                styles.chips
              }
            >
              <Chip
                titulo="Todos"
                activo={
                  filtroEstado ===
                  "todos"
                }
                onPress={() =>
                  setFiltroEstado(
                    "todos"
                  )
                }
              />

              <Chip
                titulo="Activos"
                activo={
                  filtroEstado ===
                  "activo"
                }
                onPress={() =>
                  setFiltroEstado(
                    "activo"
                  )
                }
              />

              <Chip
                titulo="Inactivos"
                activo={
                  filtroEstado ===
                  "inactivo"
                }
                onPress={() =>
                  setFiltroEstado(
                    "inactivo"
                  )
                }
              />
            </View>

            <Text
              style={[
                styles.filterLabel,
                styles.filterLabelSpacing,
              ]}
            >
              Laboratorio
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
            >
              <View
                style={
                  styles.horizontalChips
                }
              >
                <Chip
                  titulo="Todos"
                  activo={
                    filtroLaboratorio ===
                    "todos"
                  }
                  onPress={() =>
                    setFiltroLaboratorio(
                      "todos"
                    )
                  }
                />

                {laboratorios.map(
                  (
                    laboratorio
                  ) => (
                    <Chip
                      key={
                        laboratorio.id
                      }
                      titulo={
                        laboratorio.nombreVisible ||
                        laboratorio.nombre
                      }
                      activo={
                        filtroLaboratorio ===
                        laboratorio.id
                      }
                      onPress={() =>
                        setFiltroLaboratorio(
                          laboratorio.id
                        )
                      }
                    />
                  )
                )}
              </View>
            </ScrollView>
          </View>
        )}

        <View
          style={
            styles.listHeader
          }
        >
          <View
            style={
              styles.listHeaderText
            }
          >
            <Text
              style={
                styles.listTitle
              }
            >
              Responsables registrados
            </Text>

            <Text
              style={
                styles.listSubtitle
              }
            >
              Consulta y administra las cuentas responsables de cada laboratorio.
            </Text>
          </View>

          <View
            style={
              styles.resultBadge
            }
          >
            <Text
              style={
                styles.resultText
              }
            >
              {
                administradoresFiltrados.length
              }
            </Text>
          </View>
        </View>

        {administradoresFiltrados.length ===
        0 ? (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyEmoji
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
              No encontramos administradores que coincidan con la búsqueda.
            </Text>

            <Pressable
              onPress={
                limpiarFiltros
              }
            >
              <Text
                style={
                  styles.emptyAction
                }
              >
                Limpiar filtros
              </Text>
            </Pressable>
          </View>

        ) : (
          administradoresFiltrados.map(
            (
              administrador
            ) => {
              const laboratorio =
                obtenerLaboratorio(
                  administrador.laboratorioId
                );

              return (
                <View
                  key={
                    administrador.id
                  }
                  style={
                    styles.card
                  }
                >
                  <View
                    style={
                      styles.cardTop
                    }
                  >
                    <View
                      style={
                        styles.avatar
                      }
                    >
                      <Text
                        style={
                          styles.avatarText
                        }
                      >
                        {(
                          administrador.nombre ||
                          "A"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.cardData
                      }
                    >
                      <Text
                        style={
                          styles.adminName
                        }
                      >
                        {administrador.nombre}{" "}
                        {administrador.apellido}
                      </Text>

                      <Text
                        style={
                          styles.adminEmail
                        }
                      >
                        {administrador.email}
                      </Text>

                      <View
                        style={
                          styles.badges
                        }
                      >
                        <View
                          style={
                            administrador.activo
                              ? styles.activeBadge
                              : styles.inactiveBadge
                          }
                        >
                          <Text
                            style={
                              administrador.activo
                                ? styles.activeText
                                : styles.inactiveText
                            }
                          >
                            ●{" "}
                            {administrador.activo
                              ? "Activo"
                              : "Inactivo"}
                          </Text>
                        </View>

                        {administrador.requiereVerificacionEmail && (
                          <View
                            style={
                              styles.verifyBadge
                            }
                          >
                            <Text
                              style={
                                styles.verifyText
                              }
                            >
                              ✉ Verificación
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View
                    style={
                      styles.labBox
                    }
                  >
                    <View
                      style={[
                        styles.labColor,

                        {
                          backgroundColor:
                            laboratorio?.colorPrimario ||
                            "#2563EB",
                        },
                      ]}
                    />

                    <View
                      style={
                        styles.labData
                      }
                    >
                      <Text
                        style={
                          styles.labLabel
                        }
                      >
                        LABORATORIO ASIGNADO
                      </Text>

                      <Text
                        style={
                          styles.labName
                        }
                      >
                        {nombreLaboratorio(
                          administrador.laboratorioId
                        )}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      style={[
                        styles.action,
                        styles.viewAction,
                      ]}
                      onPress={() =>
                        setAdministradorVer(
                          administrador
                        )
                      }
                    >
                      <Text
                        style={
                          styles.viewActionText
                        }
                      >
                        👁 Ver
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.action,
                        styles.detailAction,
                      ]}
                      onPress={() =>
                        setAdministradorDetalle(
                          administrador
                        )
                      }
                    >
                      <Text
                        style={
                          styles.detailActionText
                        }
                      >
                        📄 Ver detalle
                      </Text>
                    </Pressable>
                  </View>

                  {(puedeEditar ||
                    puedeCambiarEstado) && (
                    <View
                      style={
                        styles.actions
                      }
                    >
                      {puedeEditar && (
                        <Pressable
                          style={[
                            styles.action,
                            styles.editAction,
                          ]}
                          onPress={() =>
                            abrirEditar(
                              administrador
                            )
                          }
                        >
                          <Text
                            style={
                              styles.editActionText
                            }
                          >
                            ✎ Editar
                          </Text>
                        </Pressable>
                      )}

                      {puedeCambiarEstado && (
                        <Pressable
                          style={[
                            styles.action,

                            administrador.activo
                              ? styles.disableAction
                              : styles.enableAction,
                          ]}
                          onPress={() =>
                            setAdministradorEstado(
                              administrador
                            )
                          }
                        >
                          <Text
                            style={
                              administrador.activo
                                ? styles.disableActionText
                                : styles.enableActionText
                            }
                          >
                            {administrador.activo
                              ? "Desactivar"
                              : "Activar"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            }
          )
        )}
      </ScrollView>

      <Modal
        visible={
          modoFormulario !==
          null
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarFormulario
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
          <ScrollView
            contentContainerStyle={
              styles.modalScroll
            }
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={
                styles.modal
              }
            >
              <ModalHeader
                titulo={
                  modoFormulario ===
                  "crear"
                    ? "Nuevo administrador"
                    : "Editar administrador"
                }
                subtitulo={
                  modoFormulario ===
                  "crear"
                    ? "Registra una cuenta responsable de laboratorio."
                    : "Actualiza los datos y laboratorio asignado."
                }
                cerrar={
                  cerrarFormulario
                }
              />

              <Campo
                titulo="Nombre *"
                valor={
                  formulario.nombre
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "nombre",
                    valor
                  )
                }
                placeholder="Nombre"
              />

              <Campo
                titulo="Apellido *"
                valor={
                  formulario.apellido
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "apellido",
                    valor
                  )
                }
                placeholder="Apellido"
              />

              <Campo
                titulo="Correo electrónico *"
                valor={
                  formulario.email
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "email",
                    valor
                  )
                }
                placeholder="administrador@correo.com"
                keyboardType="email-address"
                editable={
                  modoFormulario ===
                  "crear"
                }
              />

              {modoFormulario ===
                "editar" && (
                  <Text
                    style={
                      styles.fieldHelp
                    }
                  >
                    El correo de una cuenta existente no se modifica desde esta pantalla.
                  </Text>
                )}

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Laboratorio *
              </Text>

              <View
                style={
                  styles.labsSelector
                }
              >
                {laboratoriosActivos.length ===
                0 ? (
                  <View
                    style={
                      styles.noLabsBox
                    }
                  >
                    <Text
                      style={
                        styles.noLabsText
                      }
                    >
                      No existen laboratorios activos disponibles.
                    </Text>
                  </View>

                ) : (
                  laboratoriosActivos.map(
                    (
                      laboratorio
                    ) => {
                      const seleccionado =
                        formulario.laboratorioId ===
                        laboratorio.id;

                      return (
                        <Pressable
                          key={
                            laboratorio.id
                          }
                          style={[
                            styles.labOption,

                            seleccionado &&
                              styles.labOptionSelected,
                          ]}
                          onPress={() =>
                            actualizarCampo(
                              "laboratorioId",
                              laboratorio.id
                            )
                          }
                        >
                          <View
                            style={[
                              styles.radio,

                              seleccionado &&
                                styles.radioSelected,
                            ]}
                          >
                            {seleccionado && (
                              <View
                                style={
                                  styles.radioInner
                                }
                              />
                            )}
                          </View>

                          <View
                            style={[
                              styles.labOptionColor,
                              {
                                backgroundColor:
                                  laboratorio.colorPrimario,
                              },
                            ]}
                          />

                          <View
                            style={
                              styles.labOptionData
                            }
                          >
                            <Text
                              style={
                                styles.labOptionName
                              }
                            >
                              {laboratorio.nombreVisible ||
                                laboratorio.nombre}
                            </Text>

                            <Text
                              style={
                                styles.labOptionEmail
                              }
                            >
                              {laboratorio.email ||
                                "Sin correo institucional"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }
                  )
                )}
              </View>

              {modoFormulario ===
                "crear" && (
                  <>
                    <Text
                      style={
                        styles.fieldLabel
                      }
                    >
                      Contraseña *
                    </Text>

                    <View
                      style={
                        styles.passwordContainer
                      }
                    >
                      <TextInput
                        style={
                          styles.passwordInput
                        }
                        value={
                          formulario.password
                        }
                        onChangeText={(
                          valor
                        ) =>
                          actualizarCampo(
                            "password",
                            valor
                          )
                        }
                        placeholder="Contraseña segura"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={
                          !mostrarPassword
                        }
                        autoCapitalize="none"
                      />

                      <Pressable
                        style={
                          styles.passwordShow
                        }
                        onPress={() =>
                          setMostrarPassword(
                            !mostrarPassword
                          )
                        }
                      >
                        <Text
                          style={
                            styles.passwordShowText
                          }
                        >
                          {mostrarPassword
                            ? "Ocultar"
                            : "Ver"}
                        </Text>
                      </Pressable>
                    </View>

                    <View
                      style={
                        styles.passwordRules
                      }
                    >
                      <ReglaPassword
                        cumplida={
                          requisitoLongitud
                        }
                        texto="Mínimo 8 caracteres"
                      />

                      <ReglaPassword
                        cumplida={
                          requisitoMayuscula
                        }
                        texto="Una letra mayúscula"
                      />

                      <ReglaPassword
                        cumplida={
                          requisitoMinuscula
                        }
                        texto="Una letra minúscula"
                      />

                      <ReglaPassword
                        cumplida={
                          requisitoNumero
                        }
                        texto="Un número"
                      />

                      <ReglaPassword
                        cumplida={
                          requisitoEspecial
                        }
                        texto="Un carácter especial"
                      />
                    </View>

                    <Text
                      style={
                        styles.fieldLabel
                      }
                    >
                      Confirmar contraseña *
                    </Text>

                    <View
                      style={
                        styles.passwordContainer
                      }
                    >
                      <TextInput
                        style={
                          styles.passwordInput
                        }
                        value={
                          formulario.confirmarPassword
                        }
                        onChangeText={(
                          valor
                        ) =>
                          actualizarCampo(
                            "confirmarPassword",
                            valor
                          )
                        }
                        placeholder="Repite la contraseña"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={
                          !mostrarConfirmacionPassword
                        }
                        autoCapitalize="none"
                      />

                      <Pressable
                        style={
                          styles.passwordShow
                        }
                        onPress={() =>
                          setMostrarConfirmacionPassword(
                            !mostrarConfirmacionPassword
                          )
                        }
                      >
                        <Text
                          style={
                            styles.passwordShowText
                          }
                        >
                          {mostrarConfirmacionPassword
                            ? "Ocultar"
                            : "Ver"}
                        </Text>
                      </Pressable>
                    </View>

                    <View
                      style={
                        styles.verificationCard
                      }
                    >
                      <View
                        style={
                          styles.verificationContent
                        }
                      >
                        <Text
                          style={
                            styles.verificationTitle
                          }
                        >
                          Verificación de correo
                        </Text>

                        <Text
                          style={
                            styles.verificationDescription
                          }
                        >
                          El usuario deberá verificar su correo antes de iniciar sesión.
                        </Text>
                      </View>

                      <Switch
                        value={
                          formulario.requiereVerificacionEmail
                        }
                        onValueChange={(
                          valor
                        ) =>
                          actualizarCampo(
                            "requiereVerificacionEmail",
                            valor
                          )
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.securityBox
                      }
                    >
                      <Text
                        style={
                          styles.securityEmoji
                        }
                      >
                        🔒
                      </Text>

                      <Text
                        style={
                          styles.securityText
                        }
                      >
                        La contraseña será gestionada por Firebase Authentication y no se guardará en Firestore.
                      </Text>
                    </View>
                  </>
                )}

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
                    cerrarFormulario
                  }
                  disabled={
                    guardando
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
                      styles.disabled,
                  ]}
                  onPress={
                    guardarAdministrador
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />

                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      {modoFormulario ===
                      "crear"
                        ? "Registrar"
                        : "Guardar cambios"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={
          administradorVer !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAdministradorVer(
            null
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={[
              styles.modal,
              styles.smallModal,
            ]}
          >
            {administradorVer && (
              <>
                <ModalHeader
                  titulo="Administrador"
                  subtitulo="Vista rápida de la cuenta"
                  cerrar={() =>
                    setAdministradorVer(
                      null
                    )
                  }
                />

                <VistaAdministrador
                  administrador={
                    administradorVer
                  }
                  laboratorio={
                    obtenerLaboratorio(
                      administradorVer.laboratorioId
                    )
                  }
                />

                <Pressable
                  style={
                    styles.fullButton
                  }
                  onPress={() =>
                    setAdministradorVer(
                      null
                    )
                  }
                >
                  <Text
                    style={
                      styles.fullButtonText
                    }
                  >
                    Cerrar
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={
          administradorDetalle !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAdministradorDetalle(
            null
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScroll
            }
          >
            <View
              style={
                styles.modal
              }
            >
              {administradorDetalle && (
                <>
                  <ModalHeader
                    titulo="Detalle del administrador"
                    subtitulo="Información completa de la cuenta"
                    cerrar={() =>
                      setAdministradorDetalle(
                        null
                      )
                    }
                  />

                  <Detalle
                    titulo="Nombre"
                    valor={
                      administradorDetalle.nombre
                    }
                  />

                  <Detalle
                    titulo="Apellido"
                    valor={
                      administradorDetalle.apellido
                    }
                  />

                  <Detalle
                    titulo="Correo electrónico"
                    valor={
                      administradorDetalle.email
                    }
                  />

                  <Detalle
                    titulo="Rol"
                    valor="Administrador"
                  />

                  <Detalle
                    titulo="Estado"
                    valor={
                      administradorDetalle.activo
                        ? "Activo"
                        : "Inactivo"
                    }
                  />

                  <Detalle
                    titulo="Verificación requerida"
                    valor={
                      administradorDetalle.requiereVerificacionEmail
                        ? "Sí"
                        : "No"
                    }
                  />

                  <Detalle
                    titulo="Laboratorio"
                    valor={
                      nombreLaboratorio(
                        administradorDetalle.laboratorioId
                      )
                    }
                  />

                  <Detalle
                    titulo="Laboratorio ID"
                    valor={
                      administradorDetalle.laboratorioId
                    }
                  />

                  <Detalle
                    titulo="Fecha de registro"
                    valor={
                      formatearFecha(
                        administradorDetalle.fechaRegistro
                      )
                    }
                  />

                  <Text
                    style={
                      styles.detailSectionTitle
                    }
                  >
                    Identidad heredada
                  </Text>

                  <VistaLaboratorio
                    laboratorio={
                      obtenerLaboratorio(
                        administradorDetalle.laboratorioId
                      )
                    }
                  />

                  <Pressable
                    style={
                      styles.fullButton
                    }
                    onPress={() =>
                      setAdministradorDetalle(
                        null
                      )
                    }
                  >
                    <Text
                      style={
                        styles.fullButtonText
                      }
                    >
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
        visible={
          administradorEstado !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAdministradorEstado(
            null
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={[
              styles.modal,
              styles.confirmModal,
            ]}
          >
            {administradorEstado && (
              <>
                <View
                  style={
                    administradorEstado.activo
                      ? styles.confirmDangerIcon
                      : styles.confirmSuccessIcon
                  }
                >
                  <Text
                    style={
                      styles.confirmIconText
                    }
                  >
                    {administradorEstado.activo
                      ? "!"
                      : "✓"}
                  </Text>
                </View>

                <Text
                  style={
                    styles.confirmTitle
                  }
                >
                  {administradorEstado.activo
                    ? "Desactivar administrador"
                    : "Activar administrador"}
                </Text>

                <Text
                  style={
                    styles.confirmDescription
                  }
                >
                  {administradorEstado.activo
                    ? `¿Deseas desactivar la cuenta de ${administradorEstado.nombre} ${administradorEstado.apellido}?`
                    : `¿Deseas activar la cuenta de ${administradorEstado.nombre} ${administradorEstado.apellido}?`}
                </Text>

                <View
                  style={
                    styles.modalActions
                  }
                >
                  <Pressable
                    style={
                      styles.cancelButton
                    }
                    onPress={() =>
                      setAdministradorEstado(
                        null
                      )
                    }
                    disabled={
                      guardando
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
                      administradorEstado.activo
                        ? styles.confirmDangerButton
                        : styles.confirmSuccessButton,

                      guardando &&
                        styles.disabled,
                    ]}
                    onPress={
                      ejecutarCambioEstado
                    }
                    disabled={
                      guardando
                    }
                  >
                    {guardando ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />

                    ) : (
                      <Text
                        style={
                          styles.confirmButtonText
                        }
                      >
                        Confirmar
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
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
    <View
      style={
        styles.stat
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
        <Text>
          {icono}
        </Text>
      </View>

      <Text
        style={[
          styles.statValue,

          {
            color,
          },
        ]}
      >
        {valor}
      </Text>

      <Text
        style={
          styles.statTitle
        }
      >
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
  onPress:
    () => void;
}) {
  return (
    <Pressable
      style={[
        styles.chip,

        activo &&
          styles.chipActive,
      ]}
      onPress={
        onPress
      }
    >
      <Text
        style={[
          styles.chipText,

          activo &&
            styles.chipTextActive,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function Campo({
  titulo,
  valor,
  onChange,
  placeholder,
  keyboardType = "default",
  editable = true,
}: {
  titulo: string;
  valor: string;
  onChange:
    (
      valor:
        string
    ) => void;
  placeholder: string;
  keyboardType?:
    | "default"
    | "email-address";
  editable?:
    boolean;
}) {
  return (
    <View
      style={
        styles.field
      }
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {titulo}
      </Text>

      <TextInput
        style={[
          styles.fieldInput,

          !editable &&
            styles.fieldInputDisabled,
        ]}
        value={
          valor
        }
        onChangeText={
          onChange
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#94A3B8"
        keyboardType={
          keyboardType
        }
        autoCapitalize={
          keyboardType ===
          "email-address"
            ? "none"
            : "words"
        }
        autoCorrect={
          false
        }
        editable={
          editable
        }
      />
    </View>
  );
}

function ReglaPassword({
  cumplida,
  texto,
}: {
  cumplida:
    boolean;
  texto:
    string;
}) {
  return (
    <View
      style={
        styles.passwordRule
      }
    >
      <View
        style={[
          styles.passwordRuleIcon,

          cumplida
            ? styles.passwordRuleOk
            : styles.passwordRulePending,
        ]}
      >
        <Text
          style={[
            styles.passwordRuleIconText,

            cumplida
              ? styles.passwordRuleOkText
              : styles.passwordRulePendingText,
          ]}
        >
          {cumplida
            ? "✓"
            : "•"}
        </Text>
      </View>

      <Text
        style={[
          styles.passwordRuleText,

          cumplida &&
            styles.passwordRuleTextOk,
        ]}
      >
        {texto}
      </Text>
    </View>
  );
}

function ModalHeader({
  titulo,
  subtitulo,
  cerrar,
}: {
  titulo: string;
  subtitulo: string;
  cerrar:
    () => void;
}) {
  return (
    <View
      style={
        styles.modalHeader
      }
    >
      <View
        style={
          styles.modalHeaderContent
        }
      >
        <Text
          style={
            styles.modalTitle
          }
        >
          {titulo}
        </Text>

        <Text
          style={
            styles.modalSubtitle
          }
        >
          {subtitulo}
        </Text>
      </View>

      <Pressable
        style={
          styles.modalClose
        }
        onPress={
          cerrar
        }
      >
        <Text
          style={
            styles.modalCloseText
          }
        >
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
    <View
      style={
        styles.detailItem
      }
    >
      <Text
        style={
          styles.detailLabel
        }
      >
        {titulo}
      </Text>

      <Text
        style={
          styles.detailValue
        }
      >
        {valor ||
          "No registrado"}
      </Text>
    </View>
  );
}

function VistaAdministrador({
  administrador,
  laboratorio,
}: {
  administrador:
    AdministradorSistema;
  laboratorio:
    LaboratorioAdministrador | null;
}) {
  return (
    <>
      <View
        style={
          styles.profile
        }
      >
        <View
          style={
            styles.profileAvatar
          }
        >
          <Text
            style={
              styles.profileAvatarText
            }
          >
            {(
              administrador.nombre ||
              "A"
            )
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>

        <Text
          style={
            styles.profileName
          }
        >
          {administrador.nombre}{" "}
          {administrador.apellido}
        </Text>

        <Text
          style={
            styles.profileEmail
          }
        >
          {administrador.email}
        </Text>

        <View
          style={
            administrador.activo
              ? styles.activeBadge
              : styles.inactiveBadge
          }
        >
          <Text
            style={
              administrador.activo
                ? styles.activeText
                : styles.inactiveText
            }
          >
            ●{" "}
            {administrador.activo
              ? "Activo"
              : "Inactivo"}
          </Text>
        </View>
      </View>

      <VistaLaboratorio
        laboratorio={
          laboratorio
        }
      />
    </>
  );
}

function VistaLaboratorio({
  laboratorio,
}: {
  laboratorio:
    LaboratorioAdministrador | null;
}) {
  if (
    !laboratorio
  ) {
    return (
      <View
        style={
          styles.noLabPreview
        }
      >
        <Text
          style={
            styles.noLabPreviewText
          }
        >
          No se encontró información del laboratorio asociado.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.identityPreview,

        {
          backgroundColor:
            laboratorio.colorPrimario,
        },
      ]}
    >
      <View
        style={[
          styles.identityCircle,

          {
            backgroundColor:
              laboratorio.colorSecundario,
          },
        ]}
      />

      <View
        style={
          styles.identityLogo
        }
      >
        {laboratorio.logoUrl ? (
          <Image
            source={{
              uri:
                laboratorio.logoUrl,
            }}
            style={
              styles.identityLogoImage
            }
            resizeMode="contain"
          />

        ) : (
          <Text
            style={
              styles.identityEmoji
            }
          >
            🧪
          </Text>
        )}
      </View>

      <View
        style={
          styles.identityData
        }
      >
        <Text
          style={
            styles.identityName
          }
        >
          {laboratorio.nombreVisible ||
            laboratorio.nombre}
        </Text>

        <Text
          style={
            styles.identitySubtitle
          }
        >
          Identidad visual heredada
        </Text>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        "#F1F5F9",
    },

    scroll: {
      paddingBottom: 45,
    },

    header: {
      paddingHorizontal: 17,
      paddingTop: 25,
      paddingBottom: 29,
      backgroundColor:
        "#581C87",
    },

    headerTop: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    backButton: {
      width: 42,
      height: 42,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 10,
      borderRadius: 13,
      backgroundColor:
        "rgba(255,255,255,.12)",
    },

    backText: {
      marginTop: -4,
      color:
        "#FFFFFF",
      fontSize: 33,
    },

    headerContent: {
      flex: 1,
    },

    headerEyebrow: {
      color:
        "#E9D5FF",
      fontSize: 8,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    headerTitle: {
      marginTop: 4,
      color:
        "#FFFFFF",
      fontSize: 27,
      fontWeight:
        "900",
    },

    headerDescription: {
      marginTop: 4,
      color:
        "#F3E8FF",
      fontSize: 9,
      lineHeight: 14,
    },

    headerIcon: {
      width: 54,
      height: 54,
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

    newButton: {
      minHeight: 46,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 19,
      borderRadius: 12,
      backgroundColor:
        "#FFFFFF",
    },

    newButtonText: {
      color:
        "#7E22CE",
      fontSize: 10,
      fontWeight:
        "900",
    },

    message: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginHorizontal: 14,
      marginTop: 13,
      padding: 12,
      borderWidth: 1,
      borderRadius: 11,
    },

    messageSuccess: {
      borderColor:
        "#A7F3D0",
      backgroundColor:
        "#ECFDF5",
    },

    messageError: {
      borderColor:
        "#FECACA",
      backgroundColor:
        "#FFF1F2",
    },

    messageSymbol: {
      marginRight: 8,
      fontWeight:
        "900",
    },

    messageText: {
      flex: 1,
      fontSize: 9,
      fontWeight:
        "700",
    },

    messageSuccessText: {
      color:
        "#047857",
    },

    messageErrorText: {
      color:
        "#B91C1C",
    },

    stats: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      paddingHorizontal: 14,
      marginTop: 15,
    },

    stat: {
      width:
        "48%",
      margin:
        "1%",
      padding: 13,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
    },

    statIcon: {
      width: 35,
      height: 35,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
    },

    statValue: {
      marginTop: 8,
      fontSize: 21,
      fontWeight:
        "900",
    },

    statTitle: {
      color:
        "#64748B",
      fontSize: 8,
      fontWeight:
        "700",
    },

    toolbar: {
      flexDirection:
        "row",
      paddingHorizontal: 14,
      marginTop: 18,
    },

    searchContainer: {
      minHeight: 48,
      flex: 1,
      flexDirection:
        "row",
      alignItems:
        "center",
      marginRight: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 12,
      backgroundColor:
        "#FFFFFF",
    },

    searchIcon: {
      marginRight: 7,
    },

    searchInput: {
      flex: 1,
      color:
        "#0F172A",
      fontSize: 10,
    },

    filterButton: {
      justifyContent:
        "center",
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 12,
      backgroundColor:
        "#FFFFFF",
    },

    filterButtonActive: {
      borderColor:
        "#7C3AED",
      backgroundColor:
        "#F5F3FF",
    },

    filterButtonText: {
      color:
        "#475569",
      fontSize: 8,
      fontWeight:
        "800",
    },

    filterButtonTextActive: {
      color:
        "#6D28D9",
    },

    filtersCard: {
      marginHorizontal: 14,
      marginTop: 9,
      padding: 14,
      borderWidth: 1,
      borderColor:
        "#E9D5FF",
      borderRadius: 13,
      backgroundColor:
        "#FFFFFF",
    },

    filtersHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      marginBottom: 12,
    },

    filtersTitle: {
      color:
        "#0F172A",
      fontSize: 11,
      fontWeight:
        "900",
    },

    clearText: {
      color:
        "#7C3AED",
      fontSize: 8,
      fontWeight:
        "800",
    },

    filterLabel: {
      marginBottom: 7,
      color:
        "#64748B",
      fontSize: 8,
      fontWeight:
        "800",
    },

    filterLabelSpacing: {
      marginTop: 14,
    },

    chips: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
    },

    horizontalChips: {
      flexDirection:
        "row",
      paddingRight: 10,
    },

    chip: {
      marginRight: 7,
      marginBottom: 7,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 20,
      backgroundColor:
        "#FFFFFF",
    },

    chipActive: {
      borderColor:
        "#7C3AED",
      backgroundColor:
        "#F5F3FF",
    },

    chipText: {
      color:
        "#64748B",
      fontSize: 8,
      fontWeight:
        "700",
    },

    chipTextActive: {
      color:
        "#6D28D9",
    },

    listHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      paddingHorizontal: 15,
      marginTop: 22,
      marginBottom: 11,
    },

    listHeaderText: {
      flex: 1,
      paddingRight: 10,
    },

    listTitle: {
      color:
        "#0F172A",
      fontSize: 16,
      fontWeight:
        "900",
    },

    listSubtitle: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 8,
      lineHeight: 12,
    },

    resultBadge: {
      minWidth: 31,
      height: 31,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 16,
      backgroundColor:
        "#F3E8FF",
    },

    resultText: {
      color:
        "#7E22CE",
      fontSize: 9,
      fontWeight:
        "900",
    },

    card: {
      marginHorizontal: 14,
      marginBottom: 11,
      padding: 14,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 16,
      backgroundColor:
        "#FFFFFF",
    },

    cardTop: {
      flexDirection:
        "row",
    },

    avatar: {
      width: 51,
      height: 51,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 11,
      borderRadius: 14,
      backgroundColor:
        "#F3E8FF",
    },

    avatarText: {
      color:
        "#7E22CE",
      fontSize: 19,
      fontWeight:
        "900",
    },

    cardData: {
      flex: 1,
    },

    adminName: {
      color:
        "#0F172A",
      fontSize: 13,
      fontWeight:
        "900",
    },

    adminEmail: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 8,
    },

    badges: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      marginTop: 7,
    },

    activeBadge: {
      alignSelf:
        "flex-start",
      marginRight: 6,
      marginBottom: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
      backgroundColor:
        "#DCFCE7",
    },

    inactiveBadge: {
      alignSelf:
        "flex-start",
      marginRight: 6,
      marginBottom: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
      backgroundColor:
        "#FEE2E2",
    },

    activeText: {
      color:
        "#15803D",
      fontSize: 8,
      fontWeight:
        "800",
    },

    inactiveText: {
      color:
        "#B91C1C",
      fontSize: 8,
      fontWeight:
        "800",
    },

    verifyBadge: {
      alignSelf:
        "flex-start",
      marginBottom: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
      backgroundColor:
        "#DBEAFE",
    },

    verifyText: {
      color:
        "#1D4ED8",
      fontSize: 8,
      fontWeight:
        "800",
    },

    labBox: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor:
        "#F8FAFC",
    },

    labColor: {
      width: 7,
      height: 34,
      marginRight: 9,
      borderRadius: 4,
    },

    labData: {
      flex: 1,
    },

    labLabel: {
      color:
        "#94A3B8",
      fontSize: 7,
      fontWeight:
        "900",
      letterSpacing: 0.5,
    },

    labName: {
      marginTop: 3,
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "800",
    },

    actions: {
      flexDirection:
        "row",
      marginTop: 8,
    },

    action: {
      minHeight: 39,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 9,
    },

    viewAction: {
      marginRight: 7,
      backgroundColor:
        "#E0F2FE",
    },

    viewActionText: {
      color:
        "#0369A1",
      fontSize: 8,
      fontWeight:
        "900",
    },

    detailAction: {
      backgroundColor:
        "#EDE9FE",
    },

    detailActionText: {
      color:
        "#6D28D9",
      fontSize: 8,
      fontWeight:
        "900",
    },

    editAction: {
      marginRight: 7,
      backgroundColor:
        "#FEF3C7",
    },

    editActionText: {
      color:
        "#A16207",
      fontSize: 8,
      fontWeight:
        "900",
    },

    disableAction: {
      backgroundColor:
        "#FEE2E2",
    },

    disableActionText: {
      color:
        "#B91C1C",
      fontSize: 8,
      fontWeight:
        "900",
    },

    enableAction: {
      backgroundColor:
        "#DCFCE7",
    },

    enableActionText: {
      color:
        "#15803D",
      fontSize: 8,
      fontWeight:
        "900",
    },

    empty: {
      alignItems:
        "center",
      marginHorizontal: 14,
      padding: 35,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
    },

    emptyEmoji: {
      fontSize: 34,
    },

    emptyTitle: {
      marginTop: 9,
      color:
        "#334155",
      fontSize: 13,
      fontWeight:
        "900",
    },

    emptyText: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 8,
      textAlign:
        "center",
    },

    emptyAction: {
      marginTop: 10,
      color:
        "#7C3AED",
      fontSize: 8,
      fontWeight:
        "900",
    },

    loadingPage: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F8FAFC",
    },

    loadingIcon: {
      width: 68,
      height: 68,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom: 17,
      borderRadius: 20,
      backgroundColor:
        "#F3E8FF",
    },

    loadingEmoji: {
      fontSize: 31,
    },

    loadingTitle: {
      marginTop: 14,
      color:
        "#0F172A",
      fontSize: 18,
      fontWeight:
        "900",
    },

    loadingText: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 9,
    },

    modalOverlay: {
      flex: 1,
      justifyContent:
        "center",
      padding: 17,
      backgroundColor:
        "rgba(15,23,42,.72)",
    },

    modalScroll: {
      flexGrow: 1,
      justifyContent:
        "center",
      paddingVertical: 20,
    },

    modal: {
      width:
        "100%",
      maxWidth: 530,
      alignSelf:
        "center",
      padding: 19,
      borderRadius: 20,
      backgroundColor:
        "#FFFFFF",
    },

    smallModal: {
      maxWidth: 420,
    },

    confirmModal: {
      maxWidth: 400,
    },

    modalHeader: {
      flexDirection:
        "row",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
    },

    modalHeaderContent: {
      flex: 1,
      paddingRight: 10,
    },

    modalTitle: {
      color:
        "#0F172A",
      fontSize: 18,
      fontWeight:
        "900",
    },

    modalSubtitle: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 8,
      lineHeight: 13,
    },

    modalClose: {
      width: 35,
      height: 35,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
      backgroundColor:
        "#F1F5F9",
    },

    modalCloseText: {
      color:
        "#475569",
      fontSize: 21,
    },

    field: {
      marginBottom: 13,
    },

    fieldLabel: {
      marginTop: 4,
      marginBottom: 6,
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "800",
    },

    fieldInput: {
      minHeight: 49,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
      color:
        "#0F172A",
      fontSize: 10,
      backgroundColor:
        "#FFFFFF",
    },

    fieldInputDisabled: {
      color:
        "#64748B",
      borderColor:
        "#E2E8F0",
      backgroundColor:
        "#F8FAFC",
    },

    fieldHelp: {
      marginTop: -7,
      marginBottom: 12,
      color:
        "#94A3B8",
      fontSize: 7,
      lineHeight: 11,
    },

    labsSelector: {
      marginBottom: 14,
    },

    labOption: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 7,
      padding: 11,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 11,
      backgroundColor:
        "#FFFFFF",
    },

    labOptionSelected: {
      borderColor:
        "#7C3AED",
      backgroundColor:
        "#FAF5FF",
    },

    radio: {
      width: 19,
      height: 19,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 9,
      borderWidth: 2,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
    },

    radioSelected: {
      borderColor:
        "#7C3AED",
    },

    radioInner: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        "#7C3AED",
    },

    labOptionColor: {
      width: 7,
      height: 34,
      marginRight: 9,
      borderRadius: 4,
    },

    labOptionData: {
      flex: 1,
    },

    labOptionName: {
      color:
        "#0F172A",
      fontSize: 10,
      fontWeight:
        "800",
    },

    labOptionEmail: {
      marginTop: 2,
      color:
        "#64748B",
      fontSize: 7,
    },

    noLabsBox: {
      padding: 13,
      borderRadius: 10,
      backgroundColor:
        "#FFF7ED",
    },

    noLabsText: {
      color:
        "#C2410C",
      fontSize: 8,
      lineHeight: 12,
    },

    passwordContainer: {
      minHeight: 49,
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 8,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
      backgroundColor:
        "#FFFFFF",
    },

    passwordInput: {
      flex: 1,
      paddingHorizontal: 12,
      color:
        "#0F172A",
      fontSize: 10,
    },

    passwordShow: {
      alignSelf:
        "stretch",
      justifyContent:
        "center",
      paddingHorizontal: 12,
    },

    passwordShowText: {
      color:
        "#7C3AED",
      fontSize: 8,
      fontWeight:
        "900",
    },

    passwordRules: {
      marginBottom: 13,
      padding: 11,
      borderRadius: 10,
      backgroundColor:
        "#F8FAFC",
    },

    passwordRule: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 5,
    },

    passwordRuleIcon: {
      width: 18,
      height: 18,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 7,
      borderRadius: 9,
    },

    passwordRuleOk: {
      backgroundColor:
        "#DCFCE7",
    },

    passwordRulePending: {
      backgroundColor:
        "#E2E8F0",
    },

    passwordRuleIconText: {
      fontSize: 8,
      fontWeight:
        "900",
    },

    passwordRuleOkText: {
      color:
        "#15803D",
    },

    passwordRulePendingText: {
      color:
        "#64748B",
    },

    passwordRuleText: {
      color:
        "#64748B",
      fontSize: 7,
    },

    passwordRuleTextOk: {
      color:
        "#15803D",
      fontWeight:
        "700",
    },

    verificationCard: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginTop: 15,
      padding: 12,
      borderWidth: 1,
      borderColor:
        "#DBEAFE",
      borderRadius: 11,
      backgroundColor:
        "#EFF6FF",
    },

    verificationContent: {
      flex: 1,
      paddingRight: 10,
    },

    verificationTitle: {
      color:
        "#1E3A8A",
      fontSize: 9,
      fontWeight:
        "900",
    },

    verificationDescription: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 7,
      lineHeight: 11,
    },

    securityBox: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginTop: 10,
      padding: 11,
      borderRadius: 10,
      backgroundColor:
        "#F8FAFC",
    },

    securityEmoji: {
      marginRight: 8,
    },

    securityText: {
      flex: 1,
      color:
        "#64748B",
      fontSize: 7,
      lineHeight: 12,
    },

    modalActions: {
      flexDirection:
        "row",
      marginTop: 17,
    },

    cancelButton: {
      minHeight: 45,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 8,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
      backgroundColor:
        "#FFFFFF",
    },

    cancelText: {
      color:
        "#475569",
      fontSize: 9,
      fontWeight:
        "800",
    },

    saveButton: {
      minHeight: 45,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
      backgroundColor:
        "#7C3AED",
    },

    saveText: {
      color:
        "#FFFFFF",
      fontSize: 9,
      fontWeight:
        "900",
    },

    disabled: {
      opacity: 0.55,
    },

    profile: {
      alignItems:
        "center",
      paddingVertical: 12,
    },

    profileAvatar: {
      width: 76,
      height: 76,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 22,
      backgroundColor:
        "#F3E8FF",
    },

    profileAvatarText: {
      color:
        "#7E22CE",
      fontSize: 29,
      fontWeight:
        "900",
    },

    profileName: {
      marginTop: 12,
      color:
        "#0F172A",
      fontSize: 17,
      fontWeight:
        "900",
      textAlign:
        "center",
    },

    profileEmail: {
      marginTop: 4,
      marginBottom: 9,
      color:
        "#64748B",
      fontSize: 9,
    },

    detailItem: {
      marginBottom: 8,
      padding: 11,
      borderRadius: 10,
      backgroundColor:
        "#F8FAFC",
    },

    detailLabel: {
      color:
        "#64748B",
      fontSize: 7,
      fontWeight:
        "800",
      textTransform:
        "uppercase",
    },

    detailValue: {
      marginTop: 3,
      color:
        "#0F172A",
      fontSize: 9,
      fontWeight:
        "700",
    },

    detailSectionTitle: {
      marginTop: 10,
      marginBottom: 8,
      color:
        "#0F172A",
      fontSize: 11,
      fontWeight:
        "900",
    },

    identityPreview: {
      position:
        "relative",
      overflow:
        "hidden",
      flexDirection:
        "row",
      alignItems:
        "center",
      marginTop: 10,
      padding: 14,
      borderRadius: 13,
    },

    identityCircle: {
      position:
        "absolute",
      width: 100,
      height: 100,
      right: -25,
      top: -40,
      borderRadius: 50,
      opacity: 0.55,
    },

    identityLogo: {
      width: 52,
      height: 52,
      alignItems:
        "center",
      justifyContent:
        "center",
      overflow:
        "hidden",
      marginRight: 11,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
    },

    identityLogoImage: {
      width: 46,
      height: 46,
    },

    identityEmoji: {
      fontSize: 23,
    },

    identityData: {
      flex: 1,
    },

    identityName: {
      color:
        "#FFFFFF",
      fontSize: 12,
      fontWeight:
        "900",
    },

    identitySubtitle: {
      marginTop: 3,
      color:
        "rgba(255,255,255,.8)",
      fontSize: 7,
    },

    noLabPreview: {
      marginTop: 10,
      padding: 13,
      borderRadius: 11,
      backgroundColor:
        "#F8FAFC",
    },

    noLabPreviewText: {
      color:
        "#64748B",
      fontSize: 8,
      textAlign:
        "center",
    },

    fullButton: {
      minHeight: 44,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 14,
      borderRadius: 10,
      backgroundColor:
        "#7C3AED",
    },

    fullButtonText: {
      color:
        "#FFFFFF",
      fontSize: 9,
      fontWeight:
        "900",
    },

    confirmDangerIcon: {
      width: 58,
      height: 58,
      alignSelf:
        "center",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom: 13,
      borderRadius: 18,
      backgroundColor:
        "#FEE2E2",
    },

    confirmSuccessIcon: {
      width: 58,
      height: 58,
      alignSelf:
        "center",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom: 13,
      borderRadius: 18,
      backgroundColor:
        "#DCFCE7",
    },

    confirmIconText: {
      fontSize: 23,
      fontWeight:
        "900",
    },

    confirmTitle: {
      color:
        "#0F172A",
      fontSize: 17,
      fontWeight:
        "900",
      textAlign:
        "center",
    },

    confirmDescription: {
      marginTop: 6,
      color:
        "#64748B",
      fontSize: 9,
      lineHeight: 14,
      textAlign:
        "center",
    },

    confirmDangerButton: {
      minHeight: 45,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
      backgroundColor:
        "#DC2626",
    },

    confirmSuccessButton: {
      minHeight: 45,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
      backgroundColor:
        "#16A34A",
    },

    confirmButtonText: {
      color:
        "#FFFFFF",
      fontSize: 9,
      fontWeight:
        "900",
    },
  });