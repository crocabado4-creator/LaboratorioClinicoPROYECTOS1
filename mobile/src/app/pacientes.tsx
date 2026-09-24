import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
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

import {
  useRouter,
} from "expo-router";

import {
  actualizarPaciente,
  crearPaciente,
  obtenerPacientes,
  type DatosPaciente,
  type PacienteSistema,
} from "../services/pacientesService";

type SexoFiltro =
  | "todos"
  | "masculino"
  | "femenino"
  | "otro";

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

type FormularioPaciente = {
  nombres: string;
  apellidos: string;
  ci: string;
  fechaNacimiento: string;
  sexo: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  alergias: string;
  enfermedadesPrevias: string;
};

const formularioInicial:
  FormularioPaciente = {
  nombres: "",
  apellidos: "",
  ci: "",
  fechaNacimiento: "",
  sexo: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  alergias: "",
  enfermedadesPrevias: "",
};

export default function PacientesScreen() {
  const router =
    useRouter();

  const [
    pacientes,
    setPacientes,
  ] =
    useState<PacienteSistema[]>(
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
  ] =
    useState<Mensaje>(
      null
    );

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    fechaFiltro,
    setFechaFiltro,
  ] = useState("");

  const [
    sexoFiltro,
    setSexoFiltro,
  ] =
    useState<SexoFiltro>(
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
    useState<FormularioPaciente>(
      formularioInicial
    );

  const [
    pacienteEditar,
    setPacienteEditar,
  ] =
    useState<PacienteSistema | null>(
      null
    );

  const [
    pacienteVer,
    setPacienteVer,
  ] =
    useState<PacienteSistema | null>(
      null
    );

  const [
    pacienteDetalle,
    setPacienteDetalle,
  ] =
    useState<PacienteSistema | null>(
      null
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

          const resultado =
            await obtenerPacientes();

          setPacientes(
            resultado
          );

        } catch (error) {
          console.error(
            "Error cargando pacientes:",
            error
          );

          mostrarMensaje(
            "error",
            error instanceof
            Error
              ? error.message
              : "No se pudieron cargar los pacientes."
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

  const pacientesFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      return pacientes.filter(
        (
          paciente
        ) => {
          const coincideBusqueda =
            texto === "" ||
            [
              paciente.nombres,
              paciente.apellidos,
              paciente.ci,
              paciente.telefono,
              paciente.email,
              paciente.ciudad,
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

          const coincideFecha =
            fechaFiltro.trim() ===
              "" ||
            paciente.fechaNacimiento ===
              fechaFiltro.trim();

          const coincideSexo =
            sexoFiltro ===
              "todos" ||
            paciente.sexo.toLowerCase() ===
              sexoFiltro;

          return (
            coincideBusqueda &&
            coincideFecha &&
            coincideSexo
          );
        }
      );
    }, [
      pacientes,
      busqueda,
      fechaFiltro,
      sexoFiltro,
    ]);

  const masculino =
    pacientes.filter(
      (
        paciente
      ) =>
        paciente.sexo ===
        "masculino"
    ).length;

  const femenino =
    pacientes.filter(
      (
        paciente
      ) =>
        paciente.sexo ===
        "femenino"
    ).length;

  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFechaFiltro("");
      setSexoFiltro(
        "todos"
      );
    };

  const convertirTextoArray = (
    texto: string
  ): string[] => {
    return texto
      .split(",")
      .map(
        (
          item
        ) =>
          item.trim()
      )
      .filter(Boolean);
  };

  const convertirArrayTexto = (
    lista: string[]
  ): string => {
    return lista.join(
      ", "
    );
  };

  const actualizarCampo = (
    campo:
      keyof FormularioPaciente,
    valor: string
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

      setPacienteEditar(
        null
      );

      setMensaje(
        null
      );

      setModoFormulario(
        "crear"
      );
    };

  const abrirEditar = (
    paciente:
      PacienteSistema
  ) => {
    setPacienteEditar(
      paciente
    );

    setFormulario({
      nombres:
        paciente.nombres,

      apellidos:
        paciente.apellidos,

      ci:
        paciente.ci,

      fechaNacimiento:
        paciente.fechaNacimiento,

      sexo:
        paciente.sexo,

      telefono:
        paciente.telefono,

      email:
        paciente.email,

      direccion:
        paciente.direccion,

      ciudad:
        paciente.ciudad,

      alergias:
        convertirArrayTexto(
          paciente.alergias
        ),

      enfermedadesPrevias:
        convertirArrayTexto(
          paciente.enfermedadesPrevias
        ),
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

      setPacienteEditar(
        null
      );

      setFormulario({
        ...formularioInicial,
      });
    };

  const validarFormulario =
    (): string => {
      if (
        formulario.nombres
          .trim()
          .length < 2
      ) {
        return "Ingresa los nombres del paciente.";
      }

      if (
        formulario.apellidos
          .trim()
          .length < 2
      ) {
        return "Ingresa los apellidos del paciente.";
      }

      if (
        formulario.ci
          .trim()
          .length < 4
      ) {
        return "Ingresa un CI o carnet válido.";
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          formulario.fechaNacimiento
            .trim()
        )
      ) {
        return "La fecha debe utilizar el formato AAAA-MM-DD.";
      }

      if (
        ![
          "masculino",
          "femenino",
          "otro",
        ].includes(
          formulario.sexo
        )
      ) {
        return "Selecciona el sexo.";
      }

      if (
        formulario.direccion
          .trim()
          .length < 3
      ) {
        return "Ingresa la dirección del paciente.";
      }

      if (
        formulario.ciudad
          .trim()
          .length < 2
      ) {
        return "Ingresa la ciudad del paciente.";
      }

      return "";
    };

  const prepararDatos =
    (): DatosPaciente => {
      return {
        nombres:
          formulario.nombres,

        apellidos:
          formulario.apellidos,

        ci:
          formulario.ci,

        fechaNacimiento:
          formulario.fechaNacimiento,

        sexo:
          formulario.sexo,

        telefono:
          formulario.telefono,

        email:
          formulario.email,

        direccion:
          formulario.direccion,

        ciudad:
          formulario.ciudad,

        alergias:
          convertirTextoArray(
            formulario.alergias
          ),

        enfermedadesPrevias:
          convertirTextoArray(
            formulario.enfermedadesPrevias
          ),
      };
    };

  const guardarPaciente =
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

        const datos =
          prepararDatos();

        if (
          modoFormulario ===
          "crear"
        ) {
          await crearPaciente(
            datos
          );

          mostrarMensaje(
            "exito",
            "Paciente registrado correctamente."
          );

        } else if (
          modoFormulario ===
            "editar" &&
          pacienteEditar
        ) {
          await actualizarPaciente(
            pacienteEditar.id,
            datos
          );

          mostrarMensaje(
            "exito",
            "Paciente actualizado correctamente."
          );
        }

        setModoFormulario(
          null
        );

        setPacienteEditar(
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
          "Error guardando paciente:",
          error
        );

        mostrarMensaje(
          "error",
          error instanceof
          Error
            ? error.message
            : "No se pudo guardar el paciente."
        );

      } finally {
        setGuardando(
          false
        );
      }
    };

  const nombreSexo = (
    sexo: string
  ): string => {
    if (
      sexo ===
      "masculino"
    ) {
      return "Masculino";
    }

    if (
      sexo ===
      "femenino"
    ) {
      return "Femenino";
    }

    if (
      sexo ===
      "otro"
    ) {
      return "Otro";
    }

    return sexo ||
      "No registrado";
  };

  const formatearFechaRegistro = (
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

      return "No registrada";

    } catch {
      return "No registrada";
    }
  };

  if (
    cargando
  ) {
    return (
      <SafeAreaView
        style={
          styles.loadingPage
        }
      >
        <ActivityIndicator
          size="large"
          color="#15803D"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Pacientes
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando pacientes del laboratorio...
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
        backgroundColor="#166534"
      />

      <ScrollView
        contentContainerStyle={
          styles.scroll
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refrescando
            }
            onRefresh={
              refrescar
            }
            tintColor="#15803D"
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
              styles.headerRow
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
                styles.headerData
              }
            >
              <Text
                style={
                  styles.headerSmall
                }
              >
                ATENCIÓN DEL LABORATORIO
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Pacientes
              </Text>

              <Text
                style={
                  styles.headerDescription
                }
              >
                Registra, consulta y actualiza los pacientes del laboratorio.
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
                🧑‍⚕️
              </Text>
            </View>
          </View>

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
              + Nuevo paciente
            </Text>
          </Pressable>
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
              style={
                mensaje.tipo ===
                "exito"
                  ? styles.successText
                  : styles.errorText
              }
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
                  ? styles.successText
                  : styles.errorText,
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
            titulo="Pacientes"
            valor={
              pacientes.length
            }
            icono="🧑‍⚕️"
            fondo="#DCFCE7"
            color="#15803D"
          />

          <Stat
            titulo="Masculino"
            valor={
              masculino
            }
            icono="♂"
            fondo="#DBEAFE"
            color="#1D4ED8"
          />

          <Stat
            titulo="Femenino"
            valor={
              femenino
            }
            icono="♀"
            fondo="#FCE7F3"
            color="#BE185D"
          />
        </View>

        <View
          style={
            styles.toolbar
          }
        >
          <View
            style={
              styles.searchBox
            }
          >
            <Text>
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
              placeholder="Nombre, apellido, CI, teléfono, correo..."
              placeholderTextColor="#94A3B8"
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
              style={
                styles.filterButtonText
              }
            >
              ⚙ Filtros
            </Text>
          </Pressable>
        </View>

        {mostrarFiltros && (
          <View
            style={
              styles.filters
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
                Filtros de pacientes
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
                styles.label
              }
            >
              Fecha de nacimiento
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                fechaFiltro
              }
              onChangeText={
                setFechaFiltro
              }
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#94A3B8"
              maxLength={
                10
              }
            />

            <Text
              style={[
                styles.label,
                styles.spacingTop,
              ]}
            >
              Sexo
            </Text>

            <View
              style={
                styles.chips
              }
            >
              <Chip
                titulo="Todos"
                activo={
                  sexoFiltro ===
                  "todos"
                }
                onPress={() =>
                  setSexoFiltro(
                    "todos"
                  )
                }
              />

              <Chip
                titulo="Masculino"
                activo={
                  sexoFiltro ===
                  "masculino"
                }
                onPress={() =>
                  setSexoFiltro(
                    "masculino"
                  )
                }
              />

              <Chip
                titulo="Femenino"
                activo={
                  sexoFiltro ===
                  "femenino"
                }
                onPress={() =>
                  setSexoFiltro(
                    "femenino"
                  )
                }
              />

              <Chip
                titulo="Otro"
                activo={
                  sexoFiltro ===
                  "otro"
                }
                onPress={() =>
                  setSexoFiltro(
                    "otro"
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
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.listTitle
              }
            >
              Pacientes registrados
            </Text>

            <Text
              style={
                styles.listSubtitle
              }
            >
              Se muestran únicamente los datos principales.
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
                pacientesFiltrados.length
              }
            </Text>
          </View>
        </View>

        {pacientesFiltrados.length ===
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
              No se encontraron pacientes
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Cambia la búsqueda o los filtros aplicados.
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
          pacientesFiltrados.map(
            (
              paciente
            ) => (
              <View
                key={
                  paciente.id
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
                        paciente.nombres ||
                        "P"
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
                        styles.patientName
                      }
                    >
                      {paciente.nombres}{" "}
                      {paciente.apellidos}
                    </Text>

                    <Text
                      style={
                        styles.patientSecondary
                      }
                    >
                      CI:{" "}
                      {paciente.ci}
                    </Text>

                    <Text
                      style={
                        styles.patientSecondary
                      }
                    >
                      Nacimiento:{" "}
                      {paciente.fechaNacimiento}
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
                      setPacienteVer(
                        paciente
                      )
                    }
                  >
                    <Text
                      style={
                        styles.viewText
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
                      setPacienteDetalle(
                        paciente
                      )
                    }
                  >
                    <Text
                      style={
                        styles.detailText
                      }
                    >
                      📄 Ver detalle
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={
                    styles.editButton
                  }
                  onPress={() =>
                    abrirEditar(
                      paciente
                    )
                  }
                >
                  <Text
                    style={
                      styles.editText
                    }
                  >
                    ✎ Editar paciente
                  </Text>
                </Pressable>
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
                    ? "Nuevo paciente"
                    : "Editar paciente"
                }
                subtitulo="Completa la información clínica y de contacto."
                cerrar={
                  cerrarFormulario
                }
              />

              <Campo
                titulo="Nombres *"
                valor={
                  formulario.nombres
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "nombres",
                    valor
                  )
                }
                placeholder="Nombres"
              />

              <Campo
                titulo="Apellidos *"
                valor={
                  formulario.apellidos
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "apellidos",
                    valor
                  )
                }
                placeholder="Apellidos"
              />

              <Campo
                titulo="CI / Carnet *"
                valor={
                  formulario.ci
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "ci",
                    valor
                  )
                }
                placeholder="Documento de identidad"
              />

              <Campo
                titulo="Fecha de nacimiento *"
                valor={
                  formulario.fechaNacimiento
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "fechaNacimiento",
                    valor
                  )
                }
                placeholder="AAAA-MM-DD"
                maxLength={
                  10
                }
              />

              <Text
                style={
                  styles.label
                }
              >
                Sexo *
              </Text>

              <View
                style={
                  styles.sexOptions
                }
              >
                <Option
                  titulo="Masculino"
                  seleccionado={
                    formulario.sexo ===
                    "masculino"
                  }
                  onPress={() =>
                    actualizarCampo(
                      "sexo",
                      "masculino"
                    )
                  }
                />

                <Option
                  titulo="Femenino"
                  seleccionado={
                    formulario.sexo ===
                    "femenino"
                  }
                  onPress={() =>
                    actualizarCampo(
                      "sexo",
                      "femenino"
                    )
                  }
                />

                <Option
                  titulo="Otro"
                  seleccionado={
                    formulario.sexo ===
                    "otro"
                  }
                  onPress={() =>
                    actualizarCampo(
                      "sexo",
                      "otro"
                    )
                  }
                />
              </View>

              <Campo
                titulo="Teléfono"
                valor={
                  formulario.telefono
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "telefono",
                    valor
                  )
                }
                placeholder="Número de teléfono"
                keyboardType="phone-pad"
              />

              <Campo
                titulo="Correo electrónico"
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
                placeholder="paciente@correo.com"
                keyboardType="email-address"
              />

              <Campo
                titulo="Dirección *"
                valor={
                  formulario.direccion
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "direccion",
                    valor
                  )
                }
                placeholder="Dirección"
                multiline
              />

              <Campo
                titulo="Ciudad *"
                valor={
                  formulario.ciudad
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "ciudad",
                    valor
                  )
                }
                placeholder="Ciudad"
              />

              <Campo
                titulo="Alergias"
                valor={
                  formulario.alergias
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "alergias",
                    valor
                  )
                }
                placeholder="Ej.: Penicilina, látex"
                multiline
              />

              <Text
                style={
                  styles.help
                }
              >
                Separa varias alergias con comas.
              </Text>

              <Campo
                titulo="Enfermedades previas"
                valor={
                  formulario.enfermedadesPrevias
                }
                onChange={(
                  valor
                ) =>
                  actualizarCampo(
                    "enfermedadesPrevias",
                    valor
                  )
                }
                placeholder="Ej.: Diabetes, hipertensión"
                multiline
              />

              <Text
                style={
                  styles.help
                }
              >
                Separa varios antecedentes con comas.
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
                  onPress={
                    cerrarFormulario
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
                    guardarPaciente
                  }
                  disabled={
                    guardando
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
          pacienteVer !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPacienteVer(
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
            {pacienteVer && (
              <>
                <ModalHeader
                  titulo="Paciente"
                  subtitulo="Vista rápida"
                  cerrar={() =>
                    setPacienteVer(
                      null
                    )
                  }
                />

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
                      {pacienteVer.nombres
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.profileName
                    }
                  >
                    {pacienteVer.nombres}{" "}
                    {pacienteVer.apellidos}
                  </Text>

                  <Text
                    style={
                      styles.profileInfo
                    }
                  >
                    CI:{" "}
                    {pacienteVer.ci}
                  </Text>

                  <Text
                    style={
                      styles.profileInfo
                    }
                  >
                    {nombreSexo(
                      pacienteVer.sexo
                    )}
                  </Text>

                  <Text
                    style={
                      styles.profileInfo
                    }
                  >
                    {pacienteVer.telefono ||
                      "Sin teléfono"}
                  </Text>
                </View>

                <Pressable
                  style={
                    styles.fullButton
                  }
                  onPress={() =>
                    setPacienteVer(
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
          pacienteDetalle !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPacienteDetalle(
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
              {pacienteDetalle && (
                <>
                  <ModalHeader
                    titulo="Detalle del paciente"
                    subtitulo="Información completa registrada"
                    cerrar={() =>
                      setPacienteDetalle(
                        null
                      )
                    }
                  />

                  <Detalle
                    titulo="Nombres"
                    valor={
                      pacienteDetalle.nombres
                    }
                  />

                  <Detalle
                    titulo="Apellidos"
                    valor={
                      pacienteDetalle.apellidos
                    }
                  />

                  <Detalle
                    titulo="CI / Carnet"
                    valor={
                      pacienteDetalle.ci
                    }
                  />

                  <Detalle
                    titulo="Fecha de nacimiento"
                    valor={
                      pacienteDetalle.fechaNacimiento
                    }
                  />

                  <Detalle
                    titulo="Sexo"
                    valor={
                      nombreSexo(
                        pacienteDetalle.sexo
                      )
                    }
                  />

                  <Detalle
                    titulo="Teléfono"
                    valor={
                      pacienteDetalle.telefono
                    }
                  />

                  <Detalle
                    titulo="Correo"
                    valor={
                      pacienteDetalle.email
                    }
                  />

                  <Detalle
                    titulo="Dirección"
                    valor={
                      pacienteDetalle.direccion
                    }
                  />

                  <Detalle
                    titulo="Ciudad"
                    valor={
                      pacienteDetalle.ciudad
                    }
                  />

                  <Detalle
                    titulo="Alergias"
                    valor={
                      pacienteDetalle.alergias.length
                        ? pacienteDetalle.alergias.join(
                            ", "
                          )
                        : "Ninguna registrada"
                    }
                  />

                  <Detalle
                    titulo="Enfermedades previas"
                    valor={
                      pacienteDetalle.enfermedadesPrevias.length
                        ? pacienteDetalle.enfermedadesPrevias.join(
                            ", "
                          )
                        : "Ninguna registrada"
                    }
                  />

                  <Detalle
                    titulo="Fecha de registro"
                    valor={
                      formatearFechaRegistro(
                        pacienteDetalle.fechaRegistro
                      )
                    }
                  />

                  <Pressable
                    style={
                      styles.fullButton
                    }
                    onPress={() =>
                      setPacienteDetalle(
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
    </SafeAreaView>
  );
}

function Stat({
  titulo,
  valor,
  icono,
  fondo,
  color,
}: {
  titulo: string;
  valor: number;
  icono: string;
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
  onPress: () => void;
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

function Option({
  titulo,
  seleccionado,
  onPress,
}: {
  titulo: string;
  seleccionado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.option,
        seleccionado &&
          styles.optionSelected,
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

      <Text
        style={[
          styles.optionText,
          seleccionado &&
            styles.optionTextSelected,
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
  multiline = false,
  keyboardType = "default",
  maxLength,
}: {
  titulo: string;
  valor: string;
  onChange: (
    valor: string
  ) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "email-address"
    | "phone-pad";
  maxLength?: number;
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

      <TextInput
        style={[
          styles.input,

          multiline &&
            styles.multiline,
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
        multiline={
          multiline
        }
        keyboardType={
          keyboardType
        }
        maxLength={
          maxLength
        }
        autoCapitalize={
          keyboardType ===
          "email-address"
            ? "none"
            : "sentences"
        }
      />
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
  cerrar: () => void;
}) {
  return (
    <View
      style={
        styles.modalHeader
      }
    >
      <View
        style={{
          flex: 1,
        }}
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
      paddingBottom: 28,
      backgroundColor:
        "#166534",
    },

    headerRow: {
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

    headerData: {
      flex: 1,
    },

    headerSmall: {
      color:
        "#BBF7D0",
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
        "#DCFCE7",
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
      marginTop: 18,
      borderRadius: 12,
      backgroundColor:
        "#FFFFFF",
    },

    newButtonText: {
      color:
        "#15803D",
      fontSize: 10,
      fontWeight:
        "900",
    },

    message: {
      flexDirection:
        "row",
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

    messageText: {
      flex: 1,
      marginLeft: 8,
      fontSize: 9,
      fontWeight:
        "700",
    },

    successText: {
      color:
        "#047857",
      fontWeight:
        "900",
    },

    errorText: {
      color:
        "#B91C1C",
      fontWeight:
        "900",
    },

    stats: {
      flexDirection:
        "row",
      paddingHorizontal: 14,
      marginTop: 15,
    },

    stat: {
      flex: 1,
      marginHorizontal: 3,
      padding: 11,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
    },

    statIcon: {
      width: 32,
      height: 32,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 9,
    },

    statValue: {
      marginTop: 7,
      fontSize: 19,
      fontWeight:
        "900",
    },

    statTitle: {
      color:
        "#64748B",
      fontSize: 7,
      fontWeight:
        "700",
    },

    toolbar: {
      flexDirection:
        "row",
      paddingHorizontal: 14,
      marginTop: 18,
    },

    searchBox: {
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

    searchInput: {
      flex: 1,
      marginLeft: 7,
      color:
        "#0F172A",
      fontSize: 9,
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
        "#16A34A",
      backgroundColor:
        "#F0FDF4",
    },

    filterButtonText: {
      color:
        "#475569",
      fontSize: 8,
      fontWeight:
        "900",
    },

    filters: {
      marginHorizontal: 14,
      marginTop: 9,
      padding: 14,
      borderWidth: 1,
      borderColor:
        "#BBF7D0",
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
        "#15803D",
      fontSize: 8,
      fontWeight:
        "900",
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
    },

    chipActive: {
      borderColor:
        "#16A34A",
      backgroundColor:
        "#F0FDF4",
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
        "#15803D",
    },

    spacingTop: {
      marginTop: 12,
    },

    listHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginHorizontal: 15,
      marginTop: 22,
      marginBottom: 11,
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
        "#DCFCE7",
    },

    resultText: {
      color:
        "#15803D",
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
        "#DCFCE7",
    },

    avatarText: {
      color:
        "#15803D",
      fontSize: 19,
      fontWeight:
        "900",
    },

    cardData: {
      flex: 1,
    },

    patientName: {
      color:
        "#0F172A",
      fontSize: 13,
      fontWeight:
        "900",
    },

    patientSecondary: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 8,
    },

    actions: {
      flexDirection:
        "row",
      marginTop: 10,
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

    viewText: {
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

    detailText: {
      color:
        "#6D28D9",
      fontSize: 8,
      fontWeight:
        "900",
    },

    editButton: {
      minHeight: 39,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 7,
      borderRadius: 9,
      backgroundColor:
        "#FEF3C7",
    },

    editText: {
      color:
        "#A16207",
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
    },

    emptyAction: {
      marginTop: 10,
      color:
        "#15803D",
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

    loadingTitle: {
      marginTop: 15,
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

    modalHeader: {
      flexDirection:
        "row",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
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

    label: {
      marginBottom: 6,
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "800",
    },

    input: {
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

    multiline: {
      minHeight: 80,
      paddingTop: 12,
      textAlignVertical:
        "top",
    },

    help: {
      marginTop: -7,
      marginBottom: 12,
      color:
        "#94A3B8",
      fontSize: 7,
    },

    sexOptions: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      marginBottom: 13,
    },

    option: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginRight: 7,
      marginBottom: 7,
      padding: 9,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 10,
    },

    optionSelected: {
      borderColor:
        "#16A34A",
      backgroundColor:
        "#F0FDF4",
    },

    radio: {
      width: 17,
      height: 17,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 6,
      borderWidth: 2,
      borderColor:
        "#CBD5E1",
      borderRadius: 9,
    },

    radioSelected: {
      borderColor:
        "#15803D",
    },

    radioInner: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        "#15803D",
    },

    optionText: {
      color:
        "#64748B",
      fontSize: 8,
      fontWeight:
        "700",
    },

    optionTextSelected: {
      color:
        "#15803D",
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
        "#15803D",
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
      paddingVertical: 13,
    },

    profileAvatar: {
      width: 75,
      height: 75,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 22,
      backgroundColor:
        "#DCFCE7",
    },

    profileAvatarText: {
      color:
        "#15803D",
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

    profileInfo: {
      marginTop: 4,
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

    fullButton: {
      minHeight: 44,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 14,
      borderRadius: 10,
      backgroundColor:
        "#15803D",
    },

    fullButtonText: {
      color:
        "#FFFFFF",
      fontSize: 9,
      fontWeight:
        "900",
    },
  });