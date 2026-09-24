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
  actualizarPersonal,
  cambiarEstadoPersonal,
  crearPersonal,
  obtenerLaboratorioDelAdministrador,
  obtenerPersonal,
  obtenerPermisosGestionPersonal,
  passwordSeguraPersonal,
  type LaboratorioPersonal,
  type PersonalSistema,
} from "../services/personalService";

type FiltroRol =
  | "todos"
  | "recepcionista"
  | "bioquimico";

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
  texto: string;
} | null;

type FormularioPersonal = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  confirmarPassword: string;
  rol:
    | ""
    | "recepcionista"
    | "bioquimico";
  requiereVerificacionEmail: boolean;
};

const formularioInicial:
  FormularioPersonal = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  confirmarPassword: "",
  rol: "",
  requiereVerificacionEmail: true,
};

export default function PersonalScreen() {
  const router =
    useRouter();

  const [
    personal,
    setPersonal,
  ] =
    useState<PersonalSistema[]>(
      []
    );

  const [
    laboratorio,
    setLaboratorio,
  ] =
    useState<LaboratorioPersonal | null>(
      null
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
    filtroRol,
    setFiltroRol,
  ] =
    useState<FiltroRol>(
      "todos"
    );

  const [
    filtroEstado,
    setFiltroEstado,
  ] =
    useState<FiltroEstado>(
      "todos"
    );

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
    useState<FormularioPersonal>(
      formularioInicial
    );

  const [
    personalEditar,
    setPersonalEditar,
  ] =
    useState<PersonalSistema | null>(
      null
    );

  const [
    personalVer,
    setPersonalVer,
  ] =
    useState<PersonalSistema | null>(
      null
    );

  const [
    personalDetalle,
    setPersonalDetalle,
  ] =
    useState<PersonalSistema | null>(
      null
    );

  const [
    personalEstado,
    setPersonalEstado,
  ] =
    useState<PersonalSistema | null>(
      null
    );

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  const [
    mostrarConfirmarPassword,
    setMostrarConfirmarPassword,
  ] = useState(false);

  const puedeCrear =
    permisos.includes(
      "empleados.crear"
    );

  const puedeEditar =
    permisos.includes(
      "empleados.editar"
    );

  const puedeCambiarEstado =
    permisos.includes(
      "empleados.desactivar"
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
            resultadoPersonal,
            resultadoLaboratorio,
            resultadoPermisos,
          ] =
            await Promise.all([
              obtenerPersonal(),
              obtenerLaboratorioDelAdministrador(),
              obtenerPermisosGestionPersonal(),
            ]);

          setPersonal(
            resultadoPersonal
          );

          setLaboratorio(
            resultadoLaboratorio
          );

          setPermisos(
            resultadoPermisos
          );

        } catch (error) {
          console.error(
            "Error cargando personal:",
            error
          );

          mostrarMensaje(
            "error",
            error instanceof Error
              ? error.message
              : "No se pudo cargar el personal."
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

  const nombreRol = (
    rol: string
  ): string => {
    if (
      rol ===
      "recepcionista"
    ) {
      return "Recepcionista";
    }

    if (
      rol ===
      "bioquimico"
    ) {
      return "Bioquímico";
    }

    return rol ||
      "Sin rol";
  };

  const personalFiltrado =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return personal.filter(
        (
          integrante
        ) => {
          const coincideBusqueda =
            texto === "" ||
            [
              integrante.nombre,
              integrante.apellido,
              integrante.email,
              nombreRol(
                integrante.rol
              ),
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

          const coincideRol =
            filtroRol ===
              "todos" ||
            integrante.rol ===
              filtroRol;

          let coincideEstado =
            true;

          if (
            filtroEstado ===
            "activo"
          ) {
            coincideEstado =
              integrante.activo ===
              true;
          }

          if (
            filtroEstado ===
            "inactivo"
          ) {
            coincideEstado =
              integrante.activo ===
              false;
          }

          return (
            coincideBusqueda &&
            coincideRol &&
            coincideEstado
          );
        }
      );
    }, [
      personal,
      busqueda,
      filtroRol,
      filtroEstado,
    ]);

  const activos =
    personal.filter(
      (
        integrante
      ) =>
        integrante.activo
    ).length;

  const recepcionistas =
    personal.filter(
      (
        integrante
      ) =>
        integrante.rol ===
        "recepcionista"
    ).length;

  const bioquimicos =
    personal.filter(
      (
        integrante
      ) =>
        integrante.rol ===
        "bioquimico"
    ).length;

  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFiltroRol(
        "todos"
      );
      setFiltroEstado(
        "todos"
      );
    };

  const actualizarCampo = <
    K extends keyof FormularioPersonal
  >(
    campo: K,
    valor:
      FormularioPersonal[K]
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

  const abrirCrear =
    () => {
      setFormulario({
        ...formularioInicial,
      });

      setPersonalEditar(
        null
      );

      setMostrarPassword(
        false
      );

      setMostrarConfirmarPassword(
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
    integrante:
      PersonalSistema
  ) => {
    setPersonalEditar(
      integrante
    );

    setFormulario({
      nombre:
        integrante.nombre,

      apellido:
        integrante.apellido,

      email:
        integrante.email,

      password:
        "",

      confirmarPassword:
        "",

      rol:
        integrante.rol ===
          "recepcionista" ||
        integrante.rol ===
          "bioquimico"
          ? integrante.rol
          : "",

      requiereVerificacionEmail:
        integrante.requiereVerificacionEmail,
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

      setPersonalEditar(
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
        formulario.rol !==
          "recepcionista" &&
        formulario.rol !==
          "bioquimico"
      ) {
        return "Selecciona Recepcionista o Bioquímico.";
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
          !passwordSeguraPersonal(
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

  const guardarPersonal =
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
          if (
            formulario.rol !==
              "recepcionista" &&
            formulario.rol !==
              "bioquimico"
          ) {
            return;
          }

          await crearPersonal(
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              email:
                formulario.email,

              password:
                formulario.password,

              rol:
                formulario.rol,

              requiereVerificacionEmail:
                formulario.requiereVerificacionEmail,
            }
          );

          mostrarMensaje(
            "exito",
            formulario.requiereVerificacionEmail
              ? "Integrante registrado. Se envió el correo de verificación."
              : "Integrante registrado correctamente."
          );

        } else if (
          modoFormulario ===
            "editar" &&
          personalEditar &&
          (
            formulario.rol ===
              "recepcionista" ||
            formulario.rol ===
              "bioquimico"
          )
        ) {
          await actualizarPersonal(
            personalEditar.id,
            {
              nombre:
                formulario.nombre,

              apellido:
                formulario.apellido,

              rol:
                formulario.rol,
            }
          );

          mostrarMensaje(
            "exito",
            "Integrante actualizado correctamente."
          );
        }

        setModoFormulario(
          null
        );

        setPersonalEditar(
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
          "Error guardando personal:",
          error
        );

        mostrarMensaje(
          "error",
          error instanceof Error
            ? error.message
            : "No se pudo guardar el integrante."
        );

      } finally {
        setGuardando(
          false
        );
      }
    };

  const cambiarEstado =
    async () => {
      if (
        !personalEstado
      ) {
        return;
      }

      try {
        setGuardando(
          true
        );

        const nuevoEstado =
          !personalEstado.activo;

        await cambiarEstadoPersonal(
          personalEstado.id,
          nuevoEstado
        );

        setPersonalEstado(
          null
        );

        await cargarDatos(
          false
        );

        mostrarMensaje(
          "exito",
          nuevoEstado
            ? "Integrante activado correctamente."
            : "Integrante desactivado correctamente."
        );

      } catch (error) {
        console.error(
          "Error cambiando estado:",
          error
        );

        mostrarMensaje(
          "error",
          error instanceof Error
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
    if (!fecha) {
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
        return new Date(
          Number(
            (
              fecha as {
                seconds:
                  number;
              }
            ).seconds
          ) *
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
            👥
          </Text>
        </View>

        <ActivityIndicator
          size="large"
          color="#0F766E"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Personal
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando personal del laboratorio...
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
        backgroundColor="#115E59"
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
            tintColor="#0F766E"
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
                EQUIPO DEL LABORATORIO
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Personal
              </Text>

              <Text
                style={
                  styles.headerDescription
                }
              >
                Gestiona Recepcionistas y Bioquímicos de tu laboratorio.
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
                👥
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
                + Nuevo integrante
              </Text>
            </Pressable>
          )}
        </View>

        {laboratorio && (
          <View
            style={[
              styles.labIdentity,

              {
                backgroundColor:
                  laboratorio.colorPrimario,
              },
            ]}
          >
            <View
              style={[
                styles.labCircle,

                {
                  backgroundColor:
                    laboratorio.colorSecundario,
                },
              ]}
            />

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
                styles.labIdentityData
              }
            >
              <Text
                style={
                  styles.labIdentityLabel
                }
              >
                LABORATORIO ASOCIADO
              </Text>

              <Text
                style={
                  styles.labIdentityName
                }
              >
                {laboratorio.nombreVisible ||
                  laboratorio.nombre}
              </Text>

              <Text
                style={
                  styles.labIdentityHelp
                }
              >
                Todo el personal registrado quedará vinculado automáticamente a este laboratorio.
              </Text>
            </View>
          </View>
        )}

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
            icono="👥"
            titulo="Personal"
            valor={
              personal.length
            }
            fondo="#CCFBF1"
            color="#0F766E"
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
            icono="💼"
            titulo="Recepcionistas"
            valor={
              recepcionistas
            }
            fondo="#E0F2FE"
            color="#0369A1"
          />

          <Stat
            icono="🧪"
            titulo="Bioquímicos"
            valor={
              bioquimicos
            }
            fondo="#EDE9FE"
            color="#6D28D9"
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
              placeholder="Buscar nombre, apellido o correo..."
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
                Filtrar personal
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
              Rol
            </Text>

            <View
              style={
                styles.chips
              }
            >
              <Chip
                titulo="Todos"
                activo={
                  filtroRol ===
                  "todos"
                }
                onPress={() =>
                  setFiltroRol(
                    "todos"
                  )
                }
              />

              <Chip
                titulo="Recepcionistas"
                activo={
                  filtroRol ===
                  "recepcionista"
                }
                onPress={() =>
                  setFiltroRol(
                    "recepcionista"
                  )
                }
              />

              <Chip
                titulo="Bioquímicos"
                activo={
                  filtroRol ===
                  "bioquimico"
                }
                onPress={() =>
                  setFiltroRol(
                    "bioquimico"
                  )
                }
              />
            </View>

            <Text
              style={[
                styles.filterLabel,
                styles.filterSpacing,
              ]}
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
          </View>
        )}

        <View
          style={
            styles.listHeader
          }
        >
          <View
            style={
              styles.listHeaderData
            }
          >
            <Text
              style={
                styles.listTitle
              }
            >
              Personal registrado
            </Text>

            <Text
              style={
                styles.listSubtitle
              }
            >
              Integrantes pertenecientes exclusivamente a tu laboratorio.
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
                personalFiltrado.length
              }
            </Text>
          </View>
        </View>

        {personalFiltrado.length ===
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
              No encontramos integrantes que coincidan con tu búsqueda.
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
          personalFiltrado.map(
            (
              integrante
            ) => (
              <View
                key={
                  integrante.id
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
                    style={[
                      styles.avatar,

                      integrante.rol ===
                        "bioquimico"
                        ? styles.avatarBioquimico
                        : styles.avatarRecepcionista,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,

                        integrante.rol ===
                          "bioquimico"
                          ? styles.avatarBioquimicoText
                          : styles.avatarRecepcionistaText,
                      ]}
                    >
                      {(
                        integrante.nombre ||
                        "U"
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
                        styles.personName
                      }
                    >
                      {integrante.nombre}{" "}
                      {integrante.apellido}
                    </Text>

                    <Text
                      style={
                        styles.personEmail
                      }
                    >
                      {integrante.email}
                    </Text>

                    <View
                      style={
                        styles.badges
                      }
                    >
                      <View
                        style={
                          integrante.rol ===
                          "bioquimico"
                            ? styles.bioBadge
                            : styles.recepBadge
                        }
                      >
                        <Text
                          style={
                            integrante.rol ===
                            "bioquimico"
                              ? styles.bioBadgeText
                              : styles.recepBadgeText
                          }
                        >
                          {nombreRol(
                            integrante.rol
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          integrante.activo
                            ? styles.activeBadge
                            : styles.inactiveBadge
                        }
                      >
                        <Text
                          style={
                            integrante.activo
                              ? styles.activeText
                              : styles.inactiveText
                          }
                        >
                          ●{" "}
                          {integrante.activo
                            ? "Activo"
                            : "Inactivo"}
                        </Text>
                      </View>
                    </View>
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
                      setPersonalVer(
                        integrante
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
                      setPersonalDetalle(
                        integrante
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
                              integrante
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

                            integrante.activo
                              ? styles.disableAction
                              : styles.enableAction,
                          ]}
                          onPress={() =>
                            setPersonalEstado(
                              integrante
                            )
                          }
                        >
                          <Text
                            style={
                              integrante.activo
                                ? styles.disableActionText
                                : styles.enableActionText
                            }
                          >
                            {integrante.activo
                              ? "Desactivar"
                              : "Activar"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
              </View>
            )
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
                    ? "Nuevo integrante"
                    : "Editar integrante"
                }
                subtitulo={
                  modoFormulario ===
                  "crear"
                    ? "Registra un Recepcionista o Bioquímico."
                    : "Actualiza la información del integrante."
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
                placeholder="usuario@correo.com"
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
                Rol *
              </Text>

              <View
                style={
                  styles.roleOptions
                }
              >
                <RolOption
                  titulo="Recepcionista"
                  descripcion="Atención, registro y gestión operativa de pacientes."
                  icono="💼"
                  seleccionado={
                    formulario.rol ===
                    "recepcionista"
                  }
                  onPress={() =>
                    actualizarCampo(
                      "rol",
                      "recepcionista"
                    )
                  }
                />

                <RolOption
                  titulo="Bioquímico"
                  descripcion="Procesamiento y gestión de resultados clínicos."
                  icono="🧪"
                  seleccionado={
                    formulario.rol ===
                    "bioquimico"
                  }
                  onPress={() =>
                    actualizarCampo(
                      "rol",
                      "bioquimico"
                    )
                  }
                />
              </View>

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Laboratorio
              </Text>

              <View
                style={
                  styles.fixedLab
                }
              >
                <View
                  style={[
                    styles.fixedLabColor,

                    {
                      backgroundColor:
                        laboratorio?.colorPrimario ||
                        "#2563EB",
                    },
                  ]}
                />

                <View
                  style={
                    styles.fixedLabData
                  }
                >
                  <Text
                    style={
                      styles.fixedLabName
                    }
                  >
                    {laboratorio?.nombreVisible ||
                      laboratorio?.nombre ||
                      "Laboratorio asociado"}
                  </Text>

                  <Text
                    style={
                      styles.fixedLabHelp
                    }
                  >
                    Se asigna automáticamente y no puede modificarse.
                  </Text>
                </View>

                <Text
                  style={
                    styles.fixedLabLock
                  }
                >
                  🔒
                </Text>
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
                          !mostrarConfirmarPassword
                        }
                        autoCapitalize="none"
                      />

                      <Pressable
                        style={
                          styles.passwordShow
                        }
                        onPress={() =>
                          setMostrarConfirmarPassword(
                            !mostrarConfirmarPassword
                          )
                        }
                      >
                        <Text
                          style={
                            styles.passwordShowText
                          }
                        >
                          {mostrarConfirmarPassword
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
                          styles.verificationData
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
                          La cuenta deberá verificar su correo antes de ingresar.
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
                        styles.securityCard
                      }
                    >
                      <Text
                        style={
                          styles.securityIcon
                        }
                      >
                        🔒
                      </Text>

                      <Text
                        style={
                          styles.securityText
                        }
                      >
                        La contraseña se guarda únicamente en Firebase Authentication y nunca dentro de Firestore.
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
                    guardarPersonal
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
          personalVer !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPersonalVer(
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
            {personalVer && (
              <>
                <ModalHeader
                  titulo="Integrante"
                  subtitulo="Vista rápida del personal"
                  cerrar={() =>
                    setPersonalVer(
                      null
                    )
                  }
                />

                <VistaPersonal
                  integrante={
                    personalVer
                  }
                  laboratorio={
                    laboratorio
                  }
                  nombreRol={
                    nombreRol
                  }
                />

                <Pressable
                  style={
                    styles.fullButton
                  }
                  onPress={() =>
                    setPersonalVer(
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
          personalDetalle !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPersonalDetalle(
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
              {personalDetalle && (
                <>
                  <ModalHeader
                    titulo="Detalle del integrante"
                    subtitulo="Información completa de la cuenta"
                    cerrar={() =>
                      setPersonalDetalle(
                        null
                      )
                    }
                  />

                  <Detalle
                    titulo="Nombre"
                    valor={
                      personalDetalle.nombre
                    }
                  />

                  <Detalle
                    titulo="Apellido"
                    valor={
                      personalDetalle.apellido
                    }
                  />

                  <Detalle
                    titulo="Correo electrónico"
                    valor={
                      personalDetalle.email
                    }
                  />

                  <Detalle
                    titulo="Rol"
                    valor={
                      nombreRol(
                        personalDetalle.rol
                      )
                    }
                  />

                  <Detalle
                    titulo="Estado"
                    valor={
                      personalDetalle.activo
                        ? "Activo"
                        : "Inactivo"
                    }
                  />

                  <Detalle
                    titulo="Verificación requerida"
                    valor={
                      personalDetalle.requiereVerificacionEmail
                        ? "Sí"
                        : "No"
                    }
                  />

                  <Detalle
                    titulo="Laboratorio"
                    valor={
                      laboratorio?.nombreVisible ||
                      laboratorio?.nombre ||
                      "No disponible"
                    }
                  />

                  <Detalle
                    titulo="Laboratorio ID"
                    valor={
                      personalDetalle.laboratorioId
                    }
                  />

                  <Detalle
                    titulo="Fecha de registro"
                    valor={
                      formatearFecha(
                        personalDetalle.fechaRegistro
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
                      laboratorio
                    }
                  />

                  <Pressable
                    style={
                      styles.fullButton
                    }
                    onPress={() =>
                      setPersonalDetalle(
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
          personalEstado !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPersonalEstado(
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
            {personalEstado && (
              <>
                <View
                  style={
                    personalEstado.activo
                      ? styles.confirmDangerIcon
                      : styles.confirmSuccessIcon
                  }
                >
                  <Text
                    style={
                      styles.confirmIconText
                    }
                  >
                    {personalEstado.activo
                      ? "!"
                      : "✓"}
                  </Text>
                </View>

                <Text
                  style={
                    styles.confirmTitle
                  }
                >
                  {personalEstado.activo
                    ? "Desactivar integrante"
                    : "Activar integrante"}
                </Text>

                <Text
                  style={
                    styles.confirmDescription
                  }
                >
                  {personalEstado.activo
                    ? `¿Deseas desactivar a ${personalEstado.nombre} ${personalEstado.apellido}?`
                    : `¿Deseas activar a ${personalEstado.nombre} ${personalEstado.apellido}?`}
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
                      setPersonalEstado(
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
                      personalEstado.activo
                        ? styles.confirmDangerButton
                        : styles.confirmSuccessButton,

                      guardando &&
                        styles.disabled,
                    ]}
                    onPress={
                      cambiarEstado
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
      valor: string
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

function RolOption({
  titulo,
  descripcion,
  icono,
  seleccionado,
  onPress,
}: {
  titulo: string;
  descripcion: string;
  icono: string;
  seleccionado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.roleOption,

        seleccionado &&
          styles.roleOptionSelected,
      ]}
      onPress={
        onPress
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
        style={
          styles.roleIcon
        }
      >
        <Text>
          {icono}
        </Text>
      </View>

      <View
        style={
          styles.roleData
        }
      >
        <Text
          style={
            styles.roleTitle
          }
        >
          {titulo}
        </Text>

        <Text
          style={
            styles.roleDescription
          }
        >
          {descripcion}
        </Text>
      </View>
    </Pressable>
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

function VistaPersonal({
  integrante,
  laboratorio,
  nombreRol,
}: {
  integrante:
    PersonalSistema;
  laboratorio:
    LaboratorioPersonal | null;
  nombreRol:
    (
      rol:
        string
    ) => string;
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
            integrante.rol ===
            "bioquimico"
              ? styles.profileAvatarBio
              : styles.profileAvatarRecep
          }
        >
          <Text
            style={
              integrante.rol ===
              "bioquimico"
                ? styles.profileAvatarBioText
                : styles.profileAvatarRecepText
            }
          >
            {(
              integrante.nombre ||
              "U"
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
          {integrante.nombre}{" "}
          {integrante.apellido}
        </Text>

        <Text
          style={
            styles.profileEmail
          }
        >
          {integrante.email}
        </Text>

        <View
          style={
            styles.profileRoleBadge
          }
        >
          <Text
            style={
              styles.profileRoleText
            }
          >
            {nombreRol(
              integrante.rol
            )}
          </Text>
        </View>

        <View
          style={
            integrante.activo
              ? styles.activeBadge
              : styles.inactiveBadge
          }
        >
          <Text
            style={
              integrante.activo
                ? styles.activeText
                : styles.inactiveText
            }
          >
            ●{" "}
            {integrante.activo
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
    LaboratorioPersonal | null;
}) {
  if (!laboratorio) {
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
          No se encontró la identidad del laboratorio.
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
          Identidad heredada automáticamente
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
        "#115E59",
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
        "#99F6E4",
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
        "#CCFBF1",
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
        "#0F766E",
      fontSize: 10,
      fontWeight:
        "900",
    },

    labIdentity: {
      position:
        "relative",
      overflow:
        "hidden",
      flexDirection:
        "row",
      alignItems:
        "center",
      marginHorizontal: 14,
      marginTop: 14,
      padding: 14,
      borderRadius: 15,
    },

    labCircle: {
      position:
        "absolute",
      width: 120,
      height: 120,
      right: -35,
      top: -50,
      borderRadius: 60,
      opacity: 0.55,
    },

    labLogo: {
      width: 55,
      height: 55,
      alignItems:
        "center",
      justifyContent:
        "center",
      overflow:
        "hidden",
      marginRight: 11,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
    },

    labLogoImage: {
      width: 48,
      height: 48,
    },

    labEmoji: {
      fontSize: 25,
    },

    labIdentityData: {
      flex: 1,
    },

    labIdentityLabel: {
      color:
        "rgba(255,255,255,.75)",
      fontSize: 7,
      fontWeight:
        "900",
      letterSpacing: 0.7,
    },

    labIdentityName: {
      marginTop: 3,
      color:
        "#FFFFFF",
      fontSize: 14,
      fontWeight:
        "900",
    },

    labIdentityHelp: {
      marginTop: 4,
      maxWidth: 280,
      color:
        "rgba(255,255,255,.8)",
      fontSize: 7,
      lineHeight: 11,
    },

    message: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginHorizontal: 14,
      marginTop: 12,
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
        "#14B8A6",
      backgroundColor:
        "#F0FDFA",
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
        "#0F766E",
    },

    filtersCard: {
      marginHorizontal: 14,
      marginTop: 9,
      padding: 14,
      borderWidth: 1,
      borderColor:
        "#99F6E4",
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
        "#0F766E",
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

    filterSpacing: {
      marginTop: 14,
    },

    chips: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
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
        "#14B8A6",
      backgroundColor:
        "#F0FDFA",
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
        "#0F766E",
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

    listHeaderData: {
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
        "#CCFBF1",
    },

    resultText: {
      color:
        "#0F766E",
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
    },

    avatarBioquimico: {
      backgroundColor:
        "#EDE9FE",
    },

    avatarRecepcionista: {
      backgroundColor:
        "#E0F2FE",
    },

    avatarText: {
      fontSize: 19,
      fontWeight:
        "900",
    },

    avatarBioquimicoText: {
      color:
        "#6D28D9",
    },

    avatarRecepcionistaText: {
      color:
        "#0369A1",
    },

    cardData: {
      flex: 1,
    },

    personName: {
      color:
        "#0F172A",
      fontSize: 13,
      fontWeight:
        "900",
    },

    personEmail: {
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

    bioBadge: {
      marginRight: 6,
      marginBottom: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
      backgroundColor:
        "#EDE9FE",
    },

    recepBadge: {
      marginRight: 6,
      marginBottom: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
      backgroundColor:
        "#E0F2FE",
    },

    bioBadgeText: {
      color:
        "#6D28D9",
      fontSize: 8,
      fontWeight:
        "800",
    },

    recepBadgeText: {
      color:
        "#0369A1",
      fontSize: 8,
      fontWeight:
        "800",
    },

    activeBadge: {
      alignSelf:
        "flex-start",
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
        "#0F766E",
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
        "#CCFBF1",
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

    roleOptions: {
      marginBottom: 13,
    },

    roleOption: {
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

    roleOptionSelected: {
      borderColor:
        "#14B8A6",
      backgroundColor:
        "#F0FDFA",
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
        "#0F766E",
    },

    radioInner: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        "#0F766E",
    },

    roleIcon: {
      width: 35,
      height: 35,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 9,
      borderRadius: 10,
      backgroundColor:
        "#F8FAFC",
    },

    roleData: {
      flex: 1,
    },

    roleTitle: {
      color:
        "#0F172A",
      fontSize: 10,
      fontWeight:
        "900",
    },

    roleDescription: {
      marginTop: 2,
      color:
        "#64748B",
      fontSize: 7,
      lineHeight: 11,
    },

    fixedLab: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 14,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#F8FAFC",
    },

    fixedLabColor: {
      width: 7,
      height: 38,
      marginRight: 9,
      borderRadius: 4,
    },

    fixedLabData: {
      flex: 1,
    },

    fixedLabName: {
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "900",
    },

    fixedLabHelp: {
      marginTop: 3,
      color:
        "#94A3B8",
      fontSize: 7,
    },

    fixedLabLock: {
      fontSize: 14,
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
        "#0F766E",
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
      marginTop: 14,
      padding: 12,
      borderWidth: 1,
      borderColor:
        "#CCFBF1",
      borderRadius: 11,
      backgroundColor:
        "#F0FDFA",
    },

    verificationData: {
      flex: 1,
      paddingRight: 10,
    },

    verificationTitle: {
      color:
        "#115E59",
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

    securityCard: {
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

    securityIcon: {
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
        "#0F766E",
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

    profileAvatarBio: {
      width: 76,
      height: 76,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 22,
      backgroundColor:
        "#EDE9FE",
    },

    profileAvatarRecep: {
      width: 76,
      height: 76,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 22,
      backgroundColor:
        "#E0F2FE",
    },

    profileAvatarBioText: {
      color:
        "#6D28D9",
      fontSize: 29,
      fontWeight:
        "900",
    },

    profileAvatarRecepText: {
      color:
        "#0369A1",
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
      color:
        "#64748B",
      fontSize: 9,
    },

    profileRoleBadge: {
      marginTop: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 15,
      backgroundColor:
        "#F1F5F9",
    },

    profileRoleText: {
      color:
        "#334155",
      fontSize: 8,
      fontWeight:
        "900",
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
        "#0F766E",
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