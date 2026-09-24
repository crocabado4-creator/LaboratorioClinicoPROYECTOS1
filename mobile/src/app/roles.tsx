import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
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
  actualizarRolUsuario,
  nombreRol,
  obtenerRolesAsignables,
  obtenerUsuariosLaboratorio,
  type RolSistema,
  type UsuarioRol,
} from "../services/rolesService";


type FiltroRol =
  | "todos"
  | "recepcionista"
  | "bioquimico";


type FiltroEstado =
  | "todos"
  | "activo"
  | "inactivo";


export default function RolesScreen() {
  const router =
    useRouter();


  const [
    usuarios,
    setUsuarios,
  ] = useState<UsuarioRol[]>(
    []
  );


  const [
    roles,
    setRoles,
  ] = useState<RolSistema[]>(
    []
  );


  const [
    cargando,
    setCargando,
  ] = useState(true);


  const [
    actualizando,
    setActualizando,
  ] = useState(false);


  const [
    refrescando,
    setRefrescando,
  ] = useState(false);


  const [
    busqueda,
    setBusqueda,
  ] = useState("");


  const [
    filtroRol,
    setFiltroRol,
  ] = useState<FiltroRol>(
    "todos"
  );


  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState<FiltroEstado>(
    "todos"
  );


  const [
    mostrarFiltros,
    setMostrarFiltros,
  ] = useState(false);


  const [
    usuarioDetalle,
    setUsuarioDetalle,
  ] = useState<UsuarioRol | null>(
    null
  );


  const [
    usuarioEditar,
    setUsuarioEditar,
  ] = useState<UsuarioRol | null>(
    null
  );


  const [
    rolSeleccionado,
    setRolSeleccionado,
  ] = useState("");


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
            resultadoUsuarios,
            resultadoRoles,
          ] =
            await Promise.all([
              obtenerUsuariosLaboratorio(),
              obtenerRolesAsignables(),
            ]);


          setUsuarios(
            resultadoUsuarios
          );


          setRoles(
            resultadoRoles
          );


        } catch (error) {
          console.error(
            "Error cargando roles:",
            error
          );


          const mensaje =
            error instanceof Error
              ? error.message
              : "No se pudo cargar la información.";


          Alert.alert(
            "No se pudo cargar",
            mensaje,
            [
              {
                text:
                  "Volver",

                onPress:
                  () =>
                    router.back(),
              },
            ]
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
      [router]
    );


  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);


  const refrescar =
    async () => {
      setRefrescando(
        true
      );

      await cargarDatos(
        false
      );
    };


  const usuariosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();


      return usuarios.filter(
        (usuario) => {
          const coincideBusqueda =
            texto === "" ||
            [
              usuario.nombre,
              usuario.apellido,
              usuario.email,
              nombreRol(
                usuario.rol
              ),
            ].some(
              (valor) =>
                valor
                  .toLowerCase()
                  .includes(
                    texto
                  )
            );


          const coincideRol =
            filtroRol ===
              "todos" ||
            usuario.rol ===
              filtroRol;


          let coincideEstado =
            true;


          if (
            filtroEstado ===
            "activo"
          ) {
            coincideEstado =
              usuario.activo ===
              true;
          }


          if (
            filtroEstado ===
            "inactivo"
          ) {
            coincideEstado =
              usuario.activo ===
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
      usuarios,
      busqueda,
      filtroRol,
      filtroEstado,
    ]);


  const cantidadActivos =
    usuarios.filter(
      (usuario) =>
        usuario.activo
    ).length;


  const cantidadRecepcionistas =
    usuarios.filter(
      (usuario) =>
        usuario.rol ===
        "recepcionista"
    ).length;


  const cantidadBioquimicos =
    usuarios.filter(
      (usuario) =>
        usuario.rol ===
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


  const abrirCambioRol = (
    usuario: UsuarioRol
  ) => {
    setUsuarioEditar(
      usuario
    );

    setRolSeleccionado(
      usuario.rol
    );
  };


  const cerrarCambioRol =
    () => {
      if (
        actualizando
      ) {
        return;
      }

      setUsuarioEditar(
        null
      );

      setRolSeleccionado(
        ""
      );
    };


  const guardarRol =
    async () => {
      if (!usuarioEditar) {
        return;
      }


      if (!rolSeleccionado) {
        Alert.alert(
          "Selecciona un rol",
          "Debes seleccionar el nuevo rol."
        );

        return;
      }


      if (
        rolSeleccionado ===
        usuarioEditar.rol
      ) {
        Alert.alert(
          "Sin cambios",
          "El usuario ya tiene asignado ese rol."
        );

        cerrarCambioRol();

        return;
      }


      try {
        setActualizando(
          true
        );


        await actualizarRolUsuario(
          usuarioEditar.id,
          rolSeleccionado
        );


        setUsuarioEditar(
          null
        );

        setRolSeleccionado(
          ""
        );


        await cargarDatos(
          false
        );


        Alert.alert(
          "Rol actualizado",
          "El rol fue actualizado correctamente."
        );


      } catch (error) {
        console.error(
          "Error actualizando rol:",
          error
        );


        Alert.alert(
          "No se pudo actualizar",
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el rol."
        );


      } finally {
        setActualizando(
          false
        );
      }
    };


  const obtenerRol = (
    rolId: string
  ) => {
    return roles.find(
      (rol) =>
        rol.id ===
        rolId
    );
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
            🛡️
          </Text>
        </View>

        <ActivityIndicator
          size="large"
          color="#4f46e5"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Roles y permisos
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando personal...
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
        backgroundColor="#312e81"
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
            tintColor="#4f46e5"
          />
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
                styles.backButtonText
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
              Roles y permisos
            </Text>

            <Text
              style={
                styles.headerDescription
              }
            >
              Gestiona los roles asignados al personal de tu laboratorio.
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
              🛡️
            </Text>
          </View>
        </View>


        <View
          style={
            styles.statsGrid
          }
        >

          <Estadistica
            titulo="Personal"
            valor={
              usuarios.length
            }
            icono="👥"
            fondo="#dbeafe"
          />


          <Estadistica
            titulo="Activos"
            valor={
              cantidadActivos
            }
            icono="✓"
            fondo="#dcfce7"
          />


          <Estadistica
            titulo="Recepción"
            valor={
              cantidadRecepcionistas
            }
            icono="💼"
            fondo="#cffafe"
          />


          <Estadistica
            titulo="Bioquímica"
            valor={
              cantidadBioquimicos
            }
            icono="🧪"
            fondo="#ede9fe"
          />

        </View>


        <View
          style={
            styles.searchSection
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
              placeholderTextColor="#94a3b8"
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
              <FiltroChip
                texto="Todos"
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

              <FiltroChip
                texto="Recepcionista"
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

              <FiltroChip
                texto="Bioquímico"
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
                styles.filterLabelSpacing,
              ]}
            >
              Estado
            </Text>


            <View
              style={
                styles.chips
              }
            >
              <FiltroChip
                texto="Todos"
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

              <FiltroChip
                texto="Activos"
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

              <FiltroChip
                texto="Inactivos"
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
          <View>
            <Text
              style={
                styles.listTitle
              }
            >
              Personal
            </Text>

            <Text
              style={
                styles.listSubtitle
              }
            >
              Usuarios del laboratorio
            </Text>
          </View>

          <View
            style={
              styles.resultBadge
            }
          >
            <Text
              style={
                styles.resultBadgeText
              }
            >
              {usuariosFiltrados.length}
            </Text>
          </View>
        </View>


        {usuariosFiltrados.length ===
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
              Sin resultados
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              No encontramos personal que coincida con la búsqueda.
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
                Limpiar búsqueda
              </Text>
            </Pressable>
          </View>

        ) : (
          usuariosFiltrados.map(
            (usuario) => (
              <View
                key={
                  usuario.id
                }
                style={
                  styles.userCard
                }
              >

                <View
                  style={
                    styles.userTop
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
                        usuario.nombre ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>


                  <View
                    style={
                      styles.userData
                    }
                  >
                    <Text
                      style={
                        styles.userName
                      }
                    >
                      {usuario.nombre}{" "}
                      {usuario.apellido}
                    </Text>

                    <Text
                      style={
                        styles.userEmail
                      }
                    >
                      {usuario.email}
                    </Text>


                    <View
                      style={
                        styles.badges
                      }
                    >
                      <View
                        style={[
                          styles.roleBadge,

                          usuario.rol ===
                          "bioquimico"
                            ? styles.roleBioquimico
                            : styles.roleRecepcionista,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleText,

                            usuario.rol ===
                            "bioquimico"
                              ? styles.roleBioquimicoText
                              : styles.roleRecepcionistaText,
                          ]}
                        >
                          {nombreRol(
                            usuario.rol
                          )}
                        </Text>
                      </View>


                      <View
                        style={[
                          styles.statusBadge,

                          usuario.activo
                            ? styles.statusActive
                            : styles.statusInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,

                            usuario.activo
                              ? styles.statusActiveText
                              : styles.statusInactiveText,
                          ]}
                        >
                          ●{" "}
                          {usuario.activo
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
                      styles.actionButton,
                      styles.detailButton,
                    ]}
                    onPress={() =>
                      setUsuarioDetalle(
                        usuario
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


                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.editButton,
                    ]}
                    onPress={() =>
                      abrirCambioRol(
                        usuario
                      )
                    }
                  >
                    <Text
                      style={
                        styles.editButtonText
                      }
                    >
                      Cambiar rol
                    </Text>
                  </Pressable>

                </View>

              </View>
            )
          )
        )}

      </ScrollView>


      <Modal
        visible={
          usuarioDetalle !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setUsuarioDetalle(
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
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Detalle del usuario
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Información de la cuenta
                </Text>
              </View>

              <Pressable
                style={
                  styles.modalClose
                }
                onPress={() =>
                  setUsuarioDetalle(
                    null
                  )
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


            {usuarioDetalle && (
              <>
                <Detalle
                  titulo="Nombre"
                  valor={
                    usuarioDetalle.nombre
                  }
                />

                <Detalle
                  titulo="Apellido"
                  valor={
                    usuarioDetalle.apellido
                  }
                />

                <Detalle
                  titulo="Correo"
                  valor={
                    usuarioDetalle.email
                  }
                />

                <Detalle
                  titulo="Rol"
                  valor={
                    nombreRol(
                      usuarioDetalle.rol
                    )
                  }
                />

                <Detalle
                  titulo="Estado"
                  valor={
                    usuarioDetalle.activo
                      ? "Activo"
                      : "Inactivo"
                  }
                />


                <Text
                  style={
                    styles.permissionsTitle
                  }
                >
                  Permisos del rol
                </Text>


                <View
                  style={
                    styles.permissionsContainer
                  }
                >
                  {obtenerRol(
                    usuarioDetalle.rol
                  )?.permisos.length ? (
                    obtenerRol(
                      usuarioDetalle.rol
                    )?.permisos.map(
                      (
                        permiso
                      ) => (
                        <View
                          key={
                            permiso
                          }
                          style={
                            styles.permissionItem
                          }
                        >
                          <Text
                            style={
                              styles.permissionIcon
                            }
                          >
                            ✓
                          </Text>

                          <Text
                            style={
                              styles.permissionText
                            }
                          >
                            {permiso}
                          </Text>
                        </View>
                      )
                    )

                  ) : (
                    <Text
                      style={
                        styles.noPermissions
                      }
                    >
                      No hay permisos registrados para este rol.
                    </Text>
                  )}
                </View>
              </>
            )}


            <Pressable
              style={
                styles.primaryButton
              }
              onPress={() =>
                setUsuarioDetalle(
                  null
                )
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      <Modal
        visible={
          usuarioEditar !==
          null
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarCambioRol
        }
      >
        <View
          style={
            styles.modalOverlay
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
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Cambiar rol
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Selecciona el rol del usuario
                </Text>
              </View>

              <Pressable
                style={
                  styles.modalClose
                }
                onPress={
                  cerrarCambioRol
                }
                disabled={
                  actualizando
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


            {usuarioEditar && (
              <View
                style={
                  styles.editUser
                }
              >
                <View
                  style={
                    styles.avatarLarge
                  }
                >
                  <Text
                    style={
                      styles.avatarLargeText
                    }
                  >
                    {(
                      usuarioEditar.nombre ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View
                  style={
                    styles.editUserData
                  }
                >
                  <Text
                    style={
                      styles.editUserName
                    }
                  >
                    {usuarioEditar.nombre}{" "}
                    {usuarioEditar.apellido}
                  </Text>

                  <Text
                    style={
                      styles.editUserEmail
                    }
                  >
                    {usuarioEditar.email}
                  </Text>
                </View>
              </View>
            )}


            <Text
              style={
                styles.roleSelectTitle
              }
            >
              Rol
            </Text>


            {roles.map(
              (rol) => {
                const seleccionado =
                  rolSeleccionado ===
                  rol.id;


                return (
                  <Pressable
                    key={
                      rol.id
                    }
                    style={[
                      styles.roleOption,

                      seleccionado &&
                        styles.roleOptionSelected,
                    ]}
                    onPress={() =>
                      setRolSeleccionado(
                        rol.id
                      )
                    }
                    disabled={
                      actualizando
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
                        styles.roleOptionContent
                      }
                    >
                      <Text
                        style={
                          styles.roleOptionTitle
                        }
                      >
                        {rol.nombre}
                      </Text>

                      <Text
                        style={
                          styles.roleOptionDescription
                        }
                      >
                        {rol.descripcion ||
                          `${rol.permisos.length} permiso(s) asignado(s)`}
                      </Text>
                    </View>
                  </Pressable>
                );
              }
            )}


            <View
              style={
                styles.modalActions
              }
            >
              <Pressable
                style={
                  styles.secondaryButton
                }
                onPress={
                  cerrarCambioRol
                }
                disabled={
                  actualizando
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Cancelar
                </Text>
              </Pressable>


              <Pressable
                style={[
                  styles.primaryButton,
                  styles.flexButton,

                  actualizando &&
                    styles.buttonDisabled,
                ]}
                onPress={
                  guardarRol
                }
                disabled={
                  actualizando
                }
              >
                {actualizando ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />

                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Guardar cambios
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


function Estadistica({
  titulo,
  valor,
  icono,
  fondo,
}: {
  titulo: string;
  valor: number;
  icono: string;
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

      <Text
        style={
          styles.statValue
        }
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


function FiltroChip({
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
        {texto}
      </Text>
    </Pressable>
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
        "#f1f5f9",
    },

    scroll: {
      paddingBottom: 40,
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
        "#312e81",
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

    backButtonText: {
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
        "#c7d2fe",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    headerTitle: {
      marginTop: 5,
      color:
        "#ffffff",
      fontSize: 25,
      fontWeight:
        "800",
    },

    headerDescription: {
      marginTop: 5,
      maxWidth: 270,
      color:
        "#e0e7ff",
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
      marginLeft: 10,
      borderRadius: 17,
      backgroundColor:
        "rgba(255,255,255,.12)",
    },

    headerEmoji: {
      fontSize: 26,
    },

    statsGrid: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      gap: 9,
      paddingHorizontal: 14,
      marginTop: -16,
    },

    statCard: {
      width:
        "48.5%",
      minHeight: 107,
      padding: 13,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
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

    statEmoji: {
      fontSize: 16,
    },

    statValue: {
      marginTop: 8,
      color:
        "#0f172a",
      fontSize: 21,
      fontWeight:
        "900",
    },

    statTitle: {
      marginTop: 1,
      color:
        "#64748b",
      fontSize: 9,
      fontWeight:
        "700",
    },

    searchSection: {
      flexDirection:
        "row",
      gap: 8,
      paddingHorizontal: 14,
      marginTop: 20,
    },

    searchContainer: {
      minHeight: 49,
      flex: 1,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 13,
      backgroundColor:
        "#ffffff",
    },

    searchIcon: {
      marginRight: 8,
      fontSize: 14,
    },

    searchInput: {
      flex: 1,
      color:
        "#0f172a",
      fontSize: 11,
    },

    filterButton: {
      minWidth: 86,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 13,
      backgroundColor:
        "#ffffff",
    },

    filterButtonActive: {
      borderColor:
        "#6366f1",
      backgroundColor:
        "#eef2ff",
    },

    filterButtonText: {
      color:
        "#475569",
      fontSize: 9,
      fontWeight:
        "800",
    },

    filterButtonTextActive: {
      color:
        "#4338ca",
    },

    filtersCard: {
      marginHorizontal: 14,
      marginTop: 10,
      padding: 15,
      borderWidth: 1,
      borderColor:
        "#e0e7ff",
      borderRadius: 15,
      backgroundColor:
        "#ffffff",
    },

    filtersHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      marginBottom: 14,
    },

    filtersTitle: {
      color:
        "#0f172a",
      fontSize: 13,
      fontWeight:
        "800",
    },

    clearText: {
      color:
        "#4f46e5",
      fontSize: 9,
      fontWeight:
        "800",
    },

    filterLabel: {
      marginBottom: 7,
      color:
        "#475569",
      fontSize: 9,
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
      gap: 7,
    },

    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 20,
      backgroundColor:
        "#ffffff",
    },

    chipActive: {
      borderColor:
        "#6366f1",
      backgroundColor:
        "#eef2ff",
    },

    chipText: {
      color:
        "#64748b",
      fontSize: 9,
      fontWeight:
        "700",
    },

    chipTextActive: {
      color:
        "#4338ca",
    },

    listHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      paddingHorizontal: 16,
      marginTop: 25,
      marginBottom: 11,
    },

    listTitle: {
      color:
        "#0f172a",
      fontSize: 18,
      fontWeight:
        "800",
    },

    listSubtitle: {
      marginTop: 2,
      color:
        "#64748b",
      fontSize: 9,
    },

    resultBadge: {
      minWidth: 32,
      height: 32,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 8,
      borderRadius: 16,
      backgroundColor:
        "#e0e7ff",
    },

    resultBadgeText: {
      color:
        "#4338ca",
      fontSize: 10,
      fontWeight:
        "900",
    },

    userCard: {
      marginHorizontal: 14,
      marginBottom: 10,
      padding: 14,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
    },

    userTop: {
      flexDirection:
        "row",
    },

    avatar: {
      width: 49,
      height: 49,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 11,
      borderRadius: 14,
      backgroundColor:
        "#e0e7ff",
    },

    avatarText: {
      color:
        "#4338ca",
      fontSize: 19,
      fontWeight:
        "900",
    },

    userData: {
      flex: 1,
    },

    userName: {
      color:
        "#0f172a",
      fontSize: 13,
      fontWeight:
        "800",
    },

    userEmail: {
      marginTop: 3,
      color:
        "#64748b",
      fontSize: 9,
    },

    badges: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      gap: 5,
      marginTop: 7,
    },

    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
    },

    roleRecepcionista: {
      backgroundColor:
        "#e0f2fe",
    },

    roleBioquimico: {
      backgroundColor:
        "#ede9fe",
    },

    roleText: {
      fontSize: 8,
      fontWeight:
        "800",
    },

    roleRecepcionistaText: {
      color:
        "#0369a1",
    },

    roleBioquimicoText: {
      color:
        "#6d28d9",
    },

    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 15,
    },

    statusActive: {
      backgroundColor:
        "#dcfce7",
    },

    statusInactive: {
      backgroundColor:
        "#fee2e2",
    },

    statusText: {
      fontSize: 8,
      fontWeight:
        "800",
    },

    statusActiveText: {
      color:
        "#15803d",
    },

    statusInactiveText: {
      color:
        "#b91c1c",
    },

    actions: {
      flexDirection:
        "row",
      gap: 8,
      marginTop: 13,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        "#f1f5f9",
    },

    actionButton: {
      minHeight: 39,
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 10,
    },

    detailButton: {
      backgroundColor:
        "#ede9fe",
    },

    detailButtonText: {
      color:
        "#6d28d9",
      fontSize: 9,
      fontWeight:
        "800",
    },

    editButton: {
      backgroundColor:
        "#fef3c7",
    },

    editButtonText: {
      color:
        "#a16207",
      fontSize: 9,
      fontWeight:
        "800",
    },

    emptyCard: {
      alignItems:
        "center",
      marginHorizontal: 14,
      padding: 35,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
    },

    emptyIcon: {
      fontSize: 34,
    },

    emptyTitle: {
      marginTop: 10,
      color:
        "#334155",
      fontSize: 14,
      fontWeight:
        "800",
    },

    emptyText: {
      marginTop: 5,
      color:
        "#64748b",
      fontSize: 9,
      textAlign:
        "center",
    },

    emptyAction: {
      marginTop: 12,
      color:
        "#4f46e5",
      fontSize: 9,
      fontWeight:
        "800",
    },

    loadingPage: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
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
        "#e0e7ff",
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
    },

    modalOverlay: {
      flex: 1,
      justifyContent:
        "center",
      padding: 18,
      backgroundColor:
        "rgba(15,23,42,.65)",
    },

    modalCard: {
      maxHeight:
        "90%",
      padding: 19,
      borderRadius: 20,
      backgroundColor:
        "#ffffff",
    },

    modalHeader: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      justifyContent:
        "space-between",
      marginBottom: 17,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        "#e2e8f0",
    },

    modalTitle: {
      color:
        "#0f172a",
      fontSize: 18,
      fontWeight:
        "800",
    },

    modalSubtitle: {
      marginTop: 3,
      color:
        "#64748b",
      fontSize: 9,
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
        "#f1f5f9",
    },

    modalCloseText: {
      marginTop: -2,
      color:
        "#475569",
      fontSize: 22,
    },

    detailItem: {
      marginBottom: 8,
      padding: 11,
      borderRadius: 10,
      backgroundColor:
        "#f8fafc",
    },

    detailLabel: {
      color:
        "#64748b",
      fontSize: 8,
      fontWeight:
        "700",
    },

    detailValue: {
      marginTop: 3,
      color:
        "#0f172a",
      fontSize: 10,
      fontWeight:
        "700",
    },

    permissionsTitle: {
      marginTop: 10,
      marginBottom: 8,
      color:
        "#0f172a",
      fontSize: 11,
      fontWeight:
        "800",
    },

    permissionsContainer: {
      marginBottom: 15,
      padding: 12,
      borderRadius: 11,
      backgroundColor:
        "#f8fafc",
    },

    permissionItem: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      marginBottom: 7,
    },

    permissionIcon: {
      marginRight: 7,
      color:
        "#10b981",
      fontSize: 9,
      fontWeight:
        "900",
    },

    permissionText: {
      flex: 1,
      color:
        "#475569",
      fontSize: 8,
      lineHeight: 12,
    },

    noPermissions: {
      color:
        "#94a3b8",
      fontSize: 9,
    },

    editUser: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 19,
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        "#f8fafc",
    },

    avatarLarge: {
      width: 49,
      height: 49,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 11,
      borderRadius: 14,
      backgroundColor:
        "#e0e7ff",
    },

    avatarLargeText: {
      color:
        "#4338ca",
      fontSize: 19,
      fontWeight:
        "900",
    },

    editUserData: {
      flex: 1,
    },

    editUserName: {
      color:
        "#0f172a",
      fontSize: 12,
      fontWeight:
        "800",
    },

    editUserEmail: {
      marginTop: 3,
      color:
        "#64748b",
      fontSize: 9,
    },

    roleSelectTitle: {
      marginBottom: 9,
      color:
        "#334155",
      fontSize: 10,
      fontWeight:
        "800",
    },

    roleOption: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 8,
      padding: 13,
      borderWidth: 1,
      borderColor:
        "#e2e8f0",
      borderRadius: 12,
      backgroundColor:
        "#ffffff",
    },

    roleOptionSelected: {
      borderColor:
        "#6366f1",
      backgroundColor:
        "#eef2ff",
    },

    radio: {
      width: 19,
      height: 19,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 10,
      borderWidth: 2,
      borderColor:
        "#cbd5e1",
      borderRadius: 10,
    },

    radioSelected: {
      borderColor:
        "#4f46e5",
    },

    radioInner: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        "#4f46e5",
    },

    roleOptionContent: {
      flex: 1,
    },

    roleOptionTitle: {
      color:
        "#0f172a",
      fontSize: 11,
      fontWeight:
        "800",
    },

    roleOptionDescription: {
      marginTop: 2,
      color:
        "#64748b",
      fontSize: 8,
      lineHeight: 12,
    },

    modalActions: {
      flexDirection:
        "row",
      gap: 8,
      marginTop: 10,
    },

    primaryButton: {
      minHeight: 45,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 17,
      borderRadius: 11,
      backgroundColor:
        "#4f46e5",
    },

    primaryButtonText: {
      color:
        "#ffffff",
      fontSize: 10,
      fontWeight:
        "800",
    },

    secondaryButton: {
      minHeight: 45,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 17,
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

    flexButton: {
      flex: 1,
    },

    buttonDisabled: {
      opacity: 0.55,
    },
  });