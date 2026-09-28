import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
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

import {
  useRouter,
} from "expo-router";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  obtenerPermisosRol,
} from "../services/rolesService";

import {
  actualizarPaciente,
  crearPaciente,
  obtenerPacientes,
  type Paciente,
  type PacienteInput,
} from "../services/pacientesService";


type UsuarioActual = {
  id: string;
  rol: string;
  laboratorioId: string;
};


type CampoBusqueda =
  | "todos"
  | "nombres"
  | "apellidos"
  | "ci"
  | "telefono"
  | "email";


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


const camposBusqueda: {
  valor: CampoBusqueda;
  texto: string;
}[] = [
  {
    valor: "todos",
    texto: "Todos",
  },
  {
    valor: "nombres",
    texto: "Nombres",
  },
  {
    valor: "apellidos",
    texto: "Apellidos",
  },
  {
    valor: "ci",
    texto: "CI",
  },
  {
    valor: "telefono",
    texto: "Teléfono",
  },
  {
    valor: "email",
    texto: "Correo",
  },
];


export default function Pacientes() {
  const router =
    useRouter();


  const [
    usuario,
    setUsuario,
  ] =
    useState<UsuarioActual | null>(
      null
    );


  const [
    permisos,
    setPermisos,
  ] =
    useState<string[]>([]);


  const [
    pacientes,
    setPacientes,
  ] =
    useState<Paciente[]>([]);


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
    busqueda,
    setBusqueda,
  ] =
    useState("");


  const [
    campoBusqueda,
    setCampoBusqueda,
  ] =
    useState<CampoBusqueda>(
      "todos"
    );


  const [
    fechaFiltro,
    setFechaFiltro,
  ] =
    useState("");


  const [
    modalFormulario,
    setModalFormulario,
  ] =
    useState(false);


  const [
    modalDetalle,
    setModalDetalle,
  ] =
    useState(false);


  const [
    pacienteSeleccionado,
    setPacienteSeleccionado,
  ] =
    useState<Paciente | null>(
      null
    );


  const [
    editandoId,
    setEditandoId,
  ] =
    useState<string | null>(
      null
    );


  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioPaciente>(
      formularioInicial
    );


  const puedeCrear =
    permisos.includes(
      "pacientes.crear"
    );


  const puedeEditar =
    permisos.includes(
      "pacientes.editar"
    );


  const puedeVer =
    permisos.includes(
      "pacientes.ver"
    ) ||
    puedeCrear ||
    puedeEditar;


  const puedeVerHistorial =
    permisos.includes(
      "resultados.ver"
    );


  const cargarPantalla =
    useCallback(
      async () => {
        try {
          setCargando(
            true
          );

          const firebaseUser =
            auth.currentUser;

          if (!firebaseUser) {
            Alert.alert(
              "Sesión no disponible",
              "Debes iniciar sesión nuevamente."
            );

            router.replace(
              "/"
            );

            return;
          }

          const usuarioSnap =
            await getDoc(
              doc(
                db,
                "usuarios",
                firebaseUser.uid
              )
            );

          if (
            !usuarioSnap.exists()
          ) {
            throw new Error(
              "No se encontró el usuario en Firestore."
            );
          }

          const datosUsuario =
            usuarioSnap.data();

          if (
            datosUsuario.activo !==
            true
          ) {
            throw new Error(
              "El usuario está inactivo."
            );
          }

          const rol =
            typeof datosUsuario.rol ===
              "string"
              ? datosUsuario.rol.trim()
              : "";

          const laboratorioId =
            typeof datosUsuario.laboratorioId ===
              "string"
              ? datosUsuario.laboratorioId.trim()
              : "";

          if (!rol) {
            throw new Error(
              "El usuario no tiene rol asignado."
            );
          }

          if (!laboratorioId) {
            throw new Error(
              "El usuario no está asociado a un laboratorio."
            );
          }

          const permisosRol =
            await obtenerPermisosRol(
              rol
            );

          const listaPermisos =
            Array.isArray(
              permisosRol
            )
              ? permisosRol
              : [];

          const tieneAcceso =
            listaPermisos.some(
              (permiso) =>
                [
                  "pacientes.crear",
                  "pacientes.editar",
                  "pacientes.ver",
                ].includes(
                  permiso
                )
            );

          if (!tieneAcceso) {
            throw new Error(
              "No tienes permiso para consultar pacientes."
            );
          }

          const usuarioActual:
            UsuarioActual = {
              id:
                usuarioSnap.id,

              rol,

              laboratorioId,
            };

          setUsuario(
            usuarioActual
          );

          setPermisos(
            listaPermisos
          );

          const resultado =
            await obtenerPacientes(
              laboratorioId
            );

          setPacientes(
            resultado
          );

        } catch (error) {
          console.error(
            "Error cargando pacientes:",
            error
          );

          Alert.alert(
            "Error",
            obtenerMensajeError(
              error,
              "No se pudieron cargar los pacientes."
            )
          );

        } finally {
          setCargando(
            false
          );
        }
      },
      [
        router,
      ]
    );


  useEffect(() => {
    cargarPantalla();
  }, [cargarPantalla]);


  const pacientesFiltrados =
    useMemo(
      () => {
        const texto =
          normalizarTexto(
            busqueda
          );

        const fecha =
          fechaFiltro.trim();

        return pacientes.filter(
          (paciente) => {
            if (
              fecha !== "" &&
              paciente.fechaNacimiento !==
                fecha
            ) {
              return false;
            }

            if (!texto) {
              return true;
            }

            const valores = {
              nombres:
                normalizarTexto(
                  paciente.nombres
                ),

              apellidos:
                normalizarTexto(
                  paciente.apellidos
                ),

              ci:
                normalizarTexto(
                  paciente.ci
                ),

              telefono:
                normalizarTexto(
                  paciente.telefono
                ),

              email:
                normalizarTexto(
                  paciente.email
                ),
            };

            if (
              campoBusqueda ===
              "todos"
            ) {
              return Object.values(
                valores
              ).some(
                (valor) =>
                  valor.includes(
                    texto
                  )
              );
            }

            return valores[
              campoBusqueda
            ].includes(
              texto
            );
          }
        );
      },
      [
        pacientes,
        busqueda,
        campoBusqueda,
        fechaFiltro,
      ]
    );


  const filtrosActivos =
    busqueda.trim() !== "" ||
    fechaFiltro.trim() !== "" ||
    campoBusqueda !== "todos";


  const limpiarFiltros =
    () => {
      setBusqueda("");
      setFechaFiltro("");
      setCampoBusqueda(
        "todos"
      );
    };


  const abrirNuevo =
    () => {
      if (!puedeCrear) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para registrar pacientes."
        );

        return;
      }

      setFormulario(
        formularioInicial
      );

      setEditandoId(
        null
      );

      setPacienteSeleccionado(
        null
      );

      setModalFormulario(
        true
      );
    };


  const abrirEditar =
    (
      paciente: Paciente
    ) => {
      if (!puedeEditar) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para modificar pacientes."
        );

        return;
      }

      setEditandoId(
        paciente.id
      );

      setPacienteSeleccionado(
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
          paciente.alergias.join(
            ", "
          ),

        enfermedadesPrevias:
          paciente.enfermedadesPrevias.join(
            ", "
          ),
      });

      setModalFormulario(
        true
      );
    };


  const abrirHistorial =
    (
      paciente: Paciente
    ) => {
      if (
        !puedeVerHistorial
      ) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para consultar el historial clínico."
        );

        return;
      }

      router.push({
        pathname:
          "/historial-paciente",

        params: {
          pacienteId:
            paciente.id,
        },
      });
    };


  const abrirDetalle =
    (
      paciente: Paciente
    ) => {
      setPacienteSeleccionado(
        paciente
      );

      setModalDetalle(
        true
      );
    };


  const cerrarFormulario =
    () => {
      if (guardando) {
        return;
      }

      setModalFormulario(
        false
      );

      setEditandoId(
        null
      );

      setPacienteSeleccionado(
        null
      );

      setFormulario(
        formularioInicial
      );
    };


  const cambiarCampo =
    (
      campo:
        keyof FormularioPaciente,
      valor: string
    ) => {
      setFormulario(
        (actual) => ({
          ...actual,
          [campo]: valor,
        })
      );
    };


  const validarFormulario =
    (): string => {
      if (
        !formulario.nombres.trim()
      ) {
        return "Los nombres son obligatorios.";
      }

      if (
        !formulario.apellidos.trim()
      ) {
        return "Los apellidos son obligatorios.";
      }

      if (!formulario.ci.trim()) {
        return "El CI es obligatorio.";
      }

      if (
        !formulario.fechaNacimiento.trim()
      ) {
        return "La fecha de nacimiento es obligatoria.";
      }

      if (
        !formulario.sexo.trim()
      ) {
        return "Debes seleccionar el sexo.";
      }

      if (
        !fechaValida(
          formulario.fechaNacimiento
        )
      ) {
        return "La fecha debe tener el formato AAAA-MM-DD y ser válida.";
      }

      const nacimiento =
        new Date(
          `${formulario.fechaNacimiento}T00:00:00`
        );

      const hoy =
        new Date();

      hoy.setHours(
        0,
        0,
        0,
        0
      );

      if (
        nacimiento >
        hoy
      ) {
        return "La fecha de nacimiento no puede ser futura.";
      }

      if (
        formulario.email.trim() !==
          "" &&
        !correoValido(
          formulario.email
        )
      ) {
        return "El correo electrónico no es válido.";
      }

      return "";
    };


  const guardarPaciente =
    async () => {
      const error =
        validarFormulario();

      if (error) {
        Alert.alert(
          "Revisa los datos",
          error
        );

        return;
      }

      if (!usuario) {
        Alert.alert(
          "Error",
          "No se pudo identificar el laboratorio."
        );

        return;
      }

      const datos:
        PacienteInput = {
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
            textoALista(
              formulario.alergias
            ),

          enfermedadesPrevias:
            textoALista(
              formulario.enfermedadesPrevias
            ),
        };

      try {
        setGuardando(
          true
        );

        if (editandoId) {
          if (!puedeEditar) {
            throw new Error(
              "No tienes permiso para modificar pacientes."
            );
          }

          await actualizarPaciente(
            editandoId,
            usuario.laboratorioId,
            datos
          );

          Alert.alert(
            "Correcto",
            "Paciente actualizado correctamente."
          );

        } else {
          if (!puedeCrear) {
            throw new Error(
              "No tienes permiso para registrar pacientes."
            );
          }

          await crearPaciente(
            usuario.laboratorioId,
            datos
          );

          Alert.alert(
            "Correcto",
            "Paciente registrado correctamente."
          );
        }

        setModalFormulario(
          false
        );

        setEditandoId(
          null
        );

        setPacienteSeleccionado(
          null
        );

        setFormulario(
          formularioInicial
        );

        const resultado =
          await obtenerPacientes(
            usuario.laboratorioId
          );

        setPacientes(
          resultado
        );

      } catch (error) {
        console.error(
          "Error guardando paciente:",
          error
        );

        Alert.alert(
          "Error",
          obtenerMensajeError(
            error,
            "No se pudo guardar el paciente."
          )
        );

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
          backgroundColor="#F8FAFC"
        />

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
          Cargando información...
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
        barStyle="dark-content"
        backgroundColor="#F8FAFC"
      />

      <ScrollView
        contentContainerStyle={
          styles.content
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
                styles.headerText
              }
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                PACIENTES
              </Text>

              <Text
                style={
                  styles.title
                }
              >
                Gestión de pacientes
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Registra, consulta y actualiza pacientes del laboratorio.
              </Text>
            </View>

            {puedeCrear && (
              <Pressable
                style={
                  styles.newButton
                }
                onPress={
                  abrirNuevo
                }
              >
                <Text
                  style={
                    styles.newButtonText
                  }
                >
                  + Nuevo
                </Text>
              </Pressable>
            )}
          </View>
        </View>


        <View
          style={
            styles.statsRow
          }
        >
          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              TOTAL
            </Text>

            <Text
              style={
                styles.statValue
              }
            >
              {pacientes.length}
            </Text>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              RESULTADOS
            </Text>

            <Text
              style={
                styles.statValue
              }
            >
              {pacientesFiltrados.length}
            </Text>
          </View>
        </View>


        <View
          style={
            styles.filterCard
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                BÚSQUEDA
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Buscar pacientes
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Busca por nombres, apellidos, CI, teléfono, correo o fecha de nacimiento.
              </Text>
            </View>

            {filtrosActivos && (
              <Pressable
                style={
                  styles.clearButton
                }
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
            )}
          </View>

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
            placeholder="Buscar paciente..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.chips
            }
          >
            {camposBusqueda.map(
              (item) => (
                <Pressable
                  key={
                    item.valor
                  }
                  style={[
                    styles.chip,

                    campoBusqueda ===
                      item.valor &&
                      styles.chipActive,
                  ]}
                  onPress={() =>
                    setCampoBusqueda(
                      item.valor
                    )
                  }
                >
                  <Text
                    style={[
                      styles.chipText,

                      campoBusqueda ===
                        item.valor &&
                        styles.chipTextActive,
                    ]}
                  >
                    {item.texto}
                  </Text>
                </Pressable>
              )
            )}
          </ScrollView>

          <Text
            style={
              styles.fieldLabel
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
            keyboardType="numbers-and-punctuation"
          />
        </View>


        <View
          style={
            styles.listHeader
          }
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
              styles.resultText
            }
          >
            {pacientesFiltrados.length} resultado
            {pacientesFiltrados.length ===
            1
              ? ""
              : "s"}
          </Text>
        </View>


        {!puedeVer ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              🔒
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Sin acceso
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              No tienes permiso para consultar pacientes.
            </Text>
          </View>

        ) : pacientesFiltrados.length ===
          0 ? (
          <View
            style={
              styles.emptyCard
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
              No existen coincidencias
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Cambia o limpia los filtros para buscar nuevamente.
            </Text>
          </View>

        ) : (
          pacientesFiltrados.map(
            (paciente) => (
              <View
                key={
                  paciente.id
                }
                style={
                  styles.patientCard
                }
              >
                <View
                  style={
                    styles.patientTop
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
                      {obtenerIniciales(
                        paciente
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.patientInfo
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
                        styles.patientMeta
                      }
                    >
                      CI: {paciente.ci}
                    </Text>

                    <Text
                      style={
                        styles.patientMeta
                      }
                    >
                      Nacimiento:{" "}
                      {formatearFecha(
                        paciente.fechaNacimiento
                      )}
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.cardActions
                  }
                >
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.detailButton,
                    ]}
                    onPress={() =>
                      abrirDetalle(
                        paciente
                      )
                    }
                  >
                    <Text
                      style={
                        styles.detailButtonText
                      }
                    >
                      Ver detalle
                    </Text>
                  </Pressable>

                  {puedeVerHistorial && (
                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.historyButton,
                      ]}
                      onPress={() =>
                        abrirHistorial(
                          paciente
                        )
                      }
                    >
                      <Text
                        style={
                          styles.historyButtonText
                        }
                      >
                        Historial
                      </Text>
                    </Pressable>
                  )}

                  {puedeEditar && (
                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.editButton,
                      ]}
                      onPress={() =>
                        abrirEditar(
                          paciente
                        )
                      }
                    >
                      <Text
                        style={
                          styles.editButtonText
                        }
                      >
                        Editar
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )
          )
        )}
      </ScrollView>


      <Modal
        visible={
          modalFormulario
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
          <View
            style={
              styles.modalCard
            }
          >
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
                    styles.modalEyebrow
                  }
                >
                  {editandoId
                    ? "ACTUALIZAR"
                    : "NUEVO REGISTRO"}
                </Text>

                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {editandoId
                    ? "Editar paciente"
                    : "Registrar paciente"}
                </Text>
              </View>

              <Pressable
                style={
                  styles.closeButton
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
                    styles.closeButtonText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.formContent
              }
            >
              <CampoTexto
                label="Nombres *"
                value={
                  formulario.nombres
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "nombres",
                    valor
                  )
                }
                placeholder="Ej. Juan Carlos"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Apellidos *"
                value={
                  formulario.apellidos
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "apellidos",
                    valor
                  )
                }
                placeholder="Ej. Pérez López"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="CI / Carnet *"
                value={
                  formulario.ci
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "ci",
                    valor
                  )
                }
                placeholder="Ej. 1234567"
                keyboardType="default"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Fecha de nacimiento *"
                value={
                  formulario.fechaNacimiento
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "fechaNacimiento",
                    valor
                  )
                }
                placeholder="AAAA-MM-DD"
                keyboardType="numbers-and-punctuation"
                editable={
                  !guardando
                }
              />

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Sexo *
              </Text>

              <View
                style={
                  styles.sexRow
                }
              >
                {[
                  "Masculino",
                  "Femenino",
                  "Otro",
                ].map(
                  (sexo) => (
                    <Pressable
                      key={
                        sexo
                      }
                      style={[
                        styles.sexButton,

                        formulario.sexo ===
                          sexo &&
                          styles.sexButtonActive,
                      ]}
                      onPress={() =>
                        cambiarCampo(
                          "sexo",
                          sexo
                        )
                      }
                      disabled={
                        guardando
                      }
                    >
                      <Text
                        style={[
                          styles.sexButtonText,

                          formulario.sexo ===
                            sexo &&
                            styles.sexButtonTextActive,
                        ]}
                      >
                        {sexo}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              <CampoTexto
                label="Teléfono"
                value={
                  formulario.telefono
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "telefono",
                    valor
                  )
                }
                placeholder="Ej. 70707070"
                keyboardType="phone-pad"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Correo electrónico"
                value={
                  formulario.email
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "email",
                    valor
                  )
                }
                placeholder="correo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Dirección"
                value={
                  formulario.direccion
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "direccion",
                    valor
                  )
                }
                placeholder="Dirección del paciente"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Ciudad"
                value={
                  formulario.ciudad
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "ciudad",
                    valor
                  )
                }
                placeholder="Ej. Cochabamba"
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Alergias"
                value={
                  formulario.alergias
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "alergias",
                    valor
                  )
                }
                placeholder="Separadas por coma"
                multiline
                editable={
                  !guardando
                }
              />

              <CampoTexto
                label="Enfermedades previas"
                value={
                  formulario.enfermedadesPrevias
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "enfermedadesPrevias",
                    valor
                  )
                }
                placeholder="Separadas por coma"
                multiline
                editable={
                  !guardando
                }
              />

              <View
                style={
                  styles.formActions
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
                      styles.disabledButton,
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
                        styles.saveButtonText
                      }
                    >
                      {editandoId
                        ? "Guardar cambios"
                        : "Registrar"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal
        visible={
          modalDetalle
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalDetalle(
            false
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
              styles.modalCard,
              styles.detailModal,
            ]}
          >
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
                    styles.modalEyebrow
                  }
                >
                  INFORMACIÓN COMPLETA
                </Text>

                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Detalle del paciente
                </Text>
              </View>

              <Pressable
                style={
                  styles.closeButton
                }
                onPress={() =>
                  setModalDetalle(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.closeButtonText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>

            {pacienteSeleccionado && (
              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.detailContent
                }
              >
                <View
                  style={
                    styles.detailProfile
                  }
                >
                  <View
                    style={
                      styles.detailAvatar
                    }
                  >
                    <Text
                      style={
                        styles.detailAvatarText
                      }
                    >
                      {obtenerIniciales(
                        pacienteSeleccionado
                      )}
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.detailName
                      }
                    >
                      {
                        pacienteSeleccionado.nombres
                      }{" "}
                      {
                        pacienteSeleccionado.apellidos
                      }
                    </Text>

                    <Text
                      style={
                        styles.detailSubtext
                      }
                    >
                      CI:{" "}
                      {
                        pacienteSeleccionado.ci
                      }
                    </Text>
                  </View>
                </View>

                <Detalle
                  label="Fecha de nacimiento"
                  value={
                    formatearFecha(
                      pacienteSeleccionado.fechaNacimiento
                    )
                  }
                />

                <Detalle
                  label="Sexo"
                  value={
                    pacienteSeleccionado.sexo
                  }
                />

                <Detalle
                  label="Teléfono"
                  value={
                    pacienteSeleccionado.telefono
                  }
                />

                <Detalle
                  label="Correo"
                  value={
                    pacienteSeleccionado.email
                  }
                />

                <Detalle
                  label="Dirección"
                  value={
                    pacienteSeleccionado.direccion
                  }
                />

                <Detalle
                  label="Ciudad"
                  value={
                    pacienteSeleccionado.ciudad
                  }
                />

                <Detalle
                  label="Alergias"
                  value={
                    pacienteSeleccionado.alergias.length >
                    0
                      ? pacienteSeleccionado.alergias.join(
                          ", "
                        )
                      : "Sin información"
                  }
                />

                <Detalle
                  label="Enfermedades previas"
                  value={
                    pacienteSeleccionado.enfermedadesPrevias.length >
                    0
                      ? pacienteSeleccionado.enfermedadesPrevias.join(
                          ", "
                        )
                      : "Sin información"
                  }
                />

                <Detalle
                  label="Identificador"
                  value={
                    pacienteSeleccionado.pacienteId
                  }
                />

                <Pressable
                  style={
                    styles.closeDetailButton
                  }
                  onPress={() =>
                    setModalDetalle(
                      false
                    )
                  }
                >
                  <Text
                    style={
                      styles.closeDetailText
                    }
                  >
                    Cerrar
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


type CampoTextoProps = {
  label: string;
  value: string;
  onChangeText:
    (
      valor: string
    ) => void;
  placeholder: string;
  keyboardType?:
    | "default"
    | "email-address"
    | "phone-pad"
    | "numbers-and-punctuation";
  autoCapitalize?:
    | "none"
    | "sentences"
    | "words"
    | "characters";
  multiline?: boolean;
  editable?: boolean;
};


function CampoTexto({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType =
    "default",
  autoCapitalize =
    "sentences",
  multiline = false,
  editable = true,
}: CampoTextoProps) {
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
        {label}
      </Text>

      <TextInput
        style={[
          styles.input,

          multiline &&
            styles.textArea,
        ]}
        value={
          value
        }
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#94A3B8"
        keyboardType={
          keyboardType
        }
        autoCapitalize={
          autoCapitalize
        }
        autoCorrect={
          false
        }
        multiline={
          multiline
        }
        textAlignVertical={
          multiline
            ? "top"
            : "center"
        }
        editable={
          editable
        }
      />
    </View>
  );
}


function Detalle({
  label,
  value,
}: {
  label: string;
  value?: string;
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
        {label}
      </Text>

      <Text
        style={
          styles.detailValue
        }
      >
        {value?.trim()
          ? value
          : "Sin información"}
      </Text>
    </View>
  );
}


function normalizarTexto(
  valor: unknown
): string {
  return String(
    valor ?? ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}


function textoALista(
  texto: string
): string[] {
  return texto
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(
      (item) =>
        item !== ""
    );
}


function correoValido(
  correo: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    correo.trim()
  );
}


function fechaValida(
  fecha: string
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      fecha
    )
  ) {
    return false;
  }

  const valor =
    new Date(
      `${fecha}T00:00:00`
    );

  return !Number.isNaN(
    valor.getTime()
  );
}


function formatearFecha(
  fecha: string
): string {
  const partes =
    fecha.split(
      "-"
    );

  if (
    partes.length !==
    3
  ) {
    return fecha ||
      "Sin información";
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}


function obtenerIniciales(
  paciente: Paciente
): string {
  const nombre =
    paciente.nombres
      .trim()
      .charAt(0);

  const apellido =
    paciente.apellidos
      .trim()
      .charAt(0);

  return `${nombre}${apellido}`
    .toUpperCase() ||
    "P";
}


function obtenerMensajeError(
  error: unknown,
  defecto: string
): string {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  return defecto;
}


const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    content: {
      padding: 16,
      paddingBottom: 40,
    },

    loadingPage: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F8FAFC",
      padding: 24,
    },

    loadingTitle: {
      marginTop: 14,
      fontSize: 22,
      fontWeight: "800",
      color: "#0F172A",
    },

    loadingText: {
      marginTop: 5,
      fontSize: 13,
      color: "#64748B",
    },

    header: {
      padding: 18,
      borderRadius: 20,
      backgroundColor:
        "#ECFDF5",
      borderWidth: 1,
      borderColor:
        "#A7F3D0",
      marginBottom: 14,
    },

    backButton: {
      alignSelf:
        "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#D1FAE5",
      marginBottom: 16,
    },

    backText: {
      color: "#475569",
      fontWeight: "700",
      fontSize: 12,
    },

    headerRow: {
      flexDirection: "row",
      alignItems:
        "flex-end",
      gap: 12,
    },

    headerText: {
      flex: 1,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      color: "#15803D",
      marginBottom: 5,
    },

    title: {
      fontSize: 27,
      fontWeight: "900",
      color: "#0F172A",
    },

    subtitle: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      color: "#64748B",
    },

    newButton: {
      backgroundColor:
        "#15803D",
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 12,
    },

    newButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "900",
    },

    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },

    statCard: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 15,
      padding: 15,
    },

    statLabel: {
      color: "#64748B",
      fontSize: 9,
      fontWeight: "900",
    },

    statValue: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 23,
      fontWeight: "900",
    },

    filterCard: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#D1FAE5",
      borderRadius: 17,
      padding: 16,
      marginBottom: 16,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 10,
      marginBottom: 13,
    },

    sectionEyebrow: {
      color: "#15803D",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    sectionTitle: {
      marginTop: 3,
      color: "#0F172A",
      fontSize: 18,
      fontWeight: "900",
    },

    sectionSubtitle: {
      marginTop: 4,
      color: "#64748B",
      fontSize: 11,
      lineHeight: 16,
    },

    clearButton: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor:
        "#F1F5F9",
    },

    clearText: {
      color: "#475569",
      fontWeight: "800",
      fontSize: 10,
    },

    searchInput: {
      minHeight: 46,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 11,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal: 13,
      color: "#0F172A",
      fontSize: 13,
      marginBottom: 11,
    },

    chips: {
      gap: 7,
      paddingBottom: 13,
    },

    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor:
        "#F1F5F9",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
    },

    chipActive: {
      backgroundColor:
        "#DCFCE7",
      borderColor:
        "#86EFAC",
    },

    chipText: {
      color: "#475569",
      fontSize: 10,
      fontWeight: "800",
    },

    chipTextActive: {
      color: "#15803D",
    },

    field: {
      marginBottom: 12,
    },

    fieldLabel: {
      color: "#334155",
      fontSize: 11,
      fontWeight: "800",
      marginBottom: 6,
    },

    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 11,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal: 12,
      color: "#0F172A",
      fontSize: 13,
    },

    textArea: {
      minHeight: 90,
      paddingTop: 12,
      paddingBottom: 12,
    },

    listHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
      marginBottom: 10,
    },

    listTitle: {
      flex: 1,
      color: "#0F172A",
      fontSize: 18,
      fontWeight: "900",
    },

    resultText: {
      color: "#15803D",
      fontSize: 10,
      fontWeight: "800",
    },

    patientCard: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },

    patientTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },

    avatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor:
        "#DCFCE7",
      alignItems: "center",
      justifyContent:
        "center",
    },

    avatarText: {
      color: "#15803D",
      fontSize: 15,
      fontWeight: "900",
    },

    patientInfo: {
      flex: 1,
    },

    patientName: {
      color: "#0F172A",
      fontSize: 15,
      fontWeight: "900",
    },

    patientMeta: {
      marginTop: 3,
      color: "#64748B",
      fontSize: 11,
    },

    cardActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 13,
    },

    actionButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 9,
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal: 10,
    },

    detailButton: {
      backgroundColor:
        "#E0F2FE",
    },

    detailButtonText: {
      color: "#0369A1",
      fontSize: 11,
      fontWeight: "900",
    },

    editButton: {
      backgroundColor:
        "#EDE9FE",
    },

    editButtonText: {
      color: "#6D28D9",
      fontSize: 11,
      fontWeight: "900",
    },


    historyButton: {
      backgroundColor:
        "#DBEAFE",
    },

    historyButtonText: {
      color: "#1D4ED8",
      fontSize: 11,
      fontWeight: "900",
    },

    emptyCard: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 16,
      padding: 28,
      alignItems: "center",
    },

    emptyIcon: {
      fontSize: 32,
    },

    emptyTitle: {
      marginTop: 8,
      color: "#334155",
      fontSize: 16,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 5,
      color: "#64748B",
      fontSize: 11,
      textAlign: "center",
      lineHeight: 17,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(15, 23, 42, 0.68)",
      justifyContent:
        "center",
      padding: 14,
    },

    modalCard: {
      maxHeight: "94%",
      backgroundColor:
        "#F8FAFC",
      borderRadius: 20,
      padding: 17,
    },

    detailModal: {
      maxHeight: "88%",
    },

    modalHeader: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 10,
      paddingBottom: 13,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
    },

    modalEyebrow: {
      color: "#15803D",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    modalTitle: {
      marginTop: 3,
      color: "#0F172A",
      fontSize: 20,
      fontWeight: "900",
    },

    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#E2E8F0",
    },

    closeButtonText: {
      color: "#475569",
      fontSize: 23,
      fontWeight: "700",
      lineHeight: 25,
    },

    formContent: {
      paddingTop: 15,
      paddingBottom: 6,
    },

    sexRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 13,
    },

    sexButton: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor:
        "#F1F5F9",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
    },

    sexButtonActive: {
      backgroundColor:
        "#DCFCE7",
      borderColor:
        "#86EFAC",
    },

    sexButtonText: {
      color: "#475569",
      fontSize: 11,
      fontWeight: "800",
    },

    sexButtonTextActive: {
      color: "#15803D",
    },

    formActions: {
      flexDirection: "row",
      gap: 9,
      marginTop: 7,
    },

    cancelButton: {
      flex: 1,
      minHeight: 45,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      backgroundColor:
        "#FFFFFF",
    },

    cancelButtonText: {
      color: "#475569",
      fontWeight: "900",
      fontSize: 11,
    },

    saveButton: {
      flex: 1,
      minHeight: 45,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 11,
      backgroundColor:
        "#15803D",
    },

    saveButtonText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 11,
    },

    disabledButton: {
      opacity: 0.6,
    },

    detailContent: {
      paddingTop: 15,
      paddingBottom: 5,
    },

    detailProfile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor:
        "#ECFDF5",
      borderWidth: 1,
      borderColor:
        "#A7F3D0",
      borderRadius: 14,
      padding: 13,
      marginBottom: 12,
    },

    detailAvatar: {
      width: 51,
      height: 51,
      borderRadius: 14,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#15803D",
    },

    detailAvatarText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "900",
    },

    detailName: {
      color: "#0F172A",
      fontSize: 15,
      fontWeight: "900",
    },

    detailSubtext: {
      marginTop: 3,
      color: "#64748B",
      fontSize: 11,
    },

    detailItem: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 11,
      padding: 12,
      marginBottom: 8,
    },

    detailLabel: {
      color: "#64748B",
      fontSize: 9,
      fontWeight: "900",
      textTransform:
        "uppercase",
    },

    detailValue: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
    },

    closeDetailButton: {
      minHeight: 45,
      marginTop: 7,
      borderRadius: 11,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#15803D",
    },

    closeDetailText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 11,
    },
  });
