import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";


type UsuarioActual = {
  id: string;
  rol: string;
  laboratorioId: string;
};


type PacienteResumen = {
  id: string;
  pacienteId: string;
  nombres: string;
  apellidos: string;
};


type AnalisisOrden = {
  analisisId: string;
  nombre: string;
};


type OrdenMuestra = {
  id: string;
  ordenId: string;
  solicitudId: string;
  laboratorioId: string;
  pacienteId: string;
  estado: string;
  analisis: AnalisisOrden[];
};


type MuestraItem = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  solicitudId: string;
  ordenId: string;
  pacienteId: string;
  analisisId: string;
  analisisNombre: string;
  bioquimicoId: string;
  tipo: string;
  codigoEtiqueta: string;
  estado: string;
  fechaToma: unknown;
};


const TIPOS_MUESTRA: string[] = [
  "Sangre",
  "Suero",
  "Plasma",
  "Orina",
  "Heces",
  "Hisopado",
  "Otro",
];


function limpiarTexto(
  valor: unknown
): string {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(
    valor
  ).trim();
}


function obtenerMensajeError(
  error: unknown,
  mensajeDefecto: string
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return mensajeDefecto;
}


function convertirPaciente(
  documento: QueryDocumentSnapshot<DocumentData>
): PacienteResumen {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ) ||
      documento.id,

    nombres:
      limpiarTexto(
        datos.nombres
      ),

    apellidos:
      limpiarTexto(
        datos.apellidos
      ),
  };
}


function normalizarAnalisis(
  valor: unknown
): AnalisisOrden[] {
  if (
    !Array.isArray(
      valor
    )
  ) {
    return [];
  }

  return valor
    .map(
      (
        item
      ): AnalisisOrden | null => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return null;
        }

        const datos =
          item as Record<
            string,
            unknown
          >;

        const analisisId =
          limpiarTexto(
            datos.analisisId
          ) ||
          limpiarTexto(
            datos.id
          );

        if (
          !analisisId
        ) {
          return null;
        }

        return {
          analisisId,

          nombre:
            limpiarTexto(
              datos.nombre
            ) ||
            "Análisis",
        };
      }
    )
    .filter(
      (
        item
      ): item is AnalisisOrden =>
        item !== null
    );
}


function convertirOrden(
  documento: QueryDocumentSnapshot<DocumentData>
): OrdenMuestra {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    ordenId:
      limpiarTexto(
        datos.ordenId
      ) ||
      documento.id,

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ),

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "generada",

    analisis:
      normalizarAnalisis(
        datos.analisis
      ),
  };
}


function convertirMuestra(
  documento: QueryDocumentSnapshot<DocumentData>
): MuestraItem {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    muestraId:
      limpiarTexto(
        datos.muestraId
      ) ||
      documento.id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    ordenId:
      limpiarTexto(
        datos.ordenId
      ),

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ),

    analisisId:
      limpiarTexto(
        datos.analisisId
      ),

    analisisNombre:
      limpiarTexto(
        datos.analisisNombre
      ) ||
      "Análisis",

    bioquimicoId:
      limpiarTexto(
        datos.bioquimicoId
      ),

    tipo:
      limpiarTexto(
        datos.tipo
      ),

    codigoEtiqueta:
      limpiarTexto(
        datos.codigoEtiqueta
      ),

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "tomada",

    fechaToma:
      datos.fechaToma ||
      null,
  };
}


function generarCodigoEtiqueta(): string {
  const fecha =
    Date.now()
      .toString()
      .slice(-8);

  const aleatorio =
    Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase();

  return `MUE-${fecha}-${aleatorio}`;
}


export default function Muestras() {
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
    pacientes,
    setPacientes,
  ] =
    useState<PacienteResumen[]>(
      []
    );


  const [
    ordenes,
    setOrdenes,
  ] =
    useState<OrdenMuestra[]>(
      []
    );


  const [
    muestras,
    setMuestras,
  ] =
    useState<MuestraItem[]>(
      []
    );


  const [
    cargando,
    setCargando,
  ] =
    useState<boolean>(
      true
    );


  const [
    guardando,
    setGuardando,
  ] =
    useState<boolean>(
      false
    );


  const [
    ordenId,
    setOrdenId,
  ] =
    useState<string>(
      ""
    );


  const [
    analisisId,
    setAnalisisId,
  ] =
    useState<string>(
      ""
    );


  const [
    tipo,
    setTipo,
  ] =
    useState<string>(
      ""
    );


  const [
    modalOrdenes,
    setModalOrdenes,
  ] =
    useState<boolean>(
      false
    );


  const [
    modalTipos,
    setModalTipos,
  ] =
    useState<boolean>(
      false
    );


  const [
    detalle,
    setDetalle,
  ] =
    useState<MuestraItem | null>(
      null
    );


  const obtenerPacientes =
    async (
      laboratorioId: string
    ): Promise<PacienteResumen[]> => {
      const consulta =
        query(
          collection(
            db,
            "pacientes"
          ),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

      const resultado =
        await getDocs(
          consulta
        );

      return resultado.docs.map(
        convertirPaciente
      );
    };


  const obtenerOrdenes =
    async (
      laboratorioId: string
    ): Promise<OrdenMuestra[]> => {
      const consulta =
        query(
          collection(
            db,
            "ordenes"
          ),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

      const resultado =
        await getDocs(
          consulta
        );

      return resultado.docs
        .map(
          convertirOrden
        )
        .filter(
          (
            orden
          ) =>
            orden.analisis.length >
            0
        );
    };


  const obtenerMuestras =
    async (
      laboratorioId: string
    ): Promise<MuestraItem[]> => {
      const consulta =
        query(
          collection(
            db,
            "muestras"
          ),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

      const resultado =
        await getDocs(
          consulta
        );

      return resultado.docs.map(
        convertirMuestra
      );
    };


  const cargarDatos =
    async (): Promise<void> => {
      try {
        setCargando(
          true
        );

        const firebaseUser =
          auth.currentUser;

        if (
          !firebaseUser
        ) {
          Alert.alert(
            "Sesión no disponible",
            "Debes iniciar sesión nuevamente."
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
          Alert.alert(
            "Usuario no encontrado",
            "No se encontró la información de tu cuenta."
          );

          return;
        }

        const datosUsuario =
          usuarioSnap.data();

        const rol =
          limpiarTexto(
            datosUsuario.rol
          );

        const laboratorioId =
          limpiarTexto(
            datosUsuario.laboratorioId
          );

        if (
          datosUsuario.activo !== true
        ) {
          Alert.alert(
            "Cuenta inactiva",
            "Tu cuenta se encuentra deshabilitada."
          );

          return;
        }

        if (
          rol !==
          "bioquimico"
        ) {
          Alert.alert(
            "Acceso restringido",
            "Este módulo está disponible para Bioquímicos."
          );

          router.back();

          return;
        }

        if (
          !laboratorioId
        ) {
          Alert.alert(
            "Laboratorio no disponible",
            "Tu cuenta no está asociada a un laboratorio."
          );

          return;
        }

        const usuarioActual:
          UsuarioActual = {
          id:
            firebaseUser.uid,

          rol,

          laboratorioId,
        };

        setUsuario(
          usuarioActual
        );

        const [
          pacientesResultado,
          ordenesResultado,
          muestrasResultado,
        ] =
          await Promise.all([
            obtenerPacientes(
              laboratorioId
            ),

            obtenerOrdenes(
              laboratorioId
            ),

            obtenerMuestras(
              laboratorioId
            ),
          ]);

        setPacientes(
          pacientesResultado
        );

        setOrdenes(
          ordenesResultado
        );

        setMuestras(
          muestrasResultado
        );

      } catch (
        error: unknown
      ) {
        console.error(
          "Error cargando muestras:",
          error
        );

        Alert.alert(
          "Error",
          obtenerMensajeError(
            error,
            "No se pudo cargar la información de muestras."
          )
        );

      } finally {
        setCargando(
          false
        );
      }
    };


  useEffect(
    () => {
      void cargarDatos();
    },
    []
  );


  const ordenSeleccionada =
    useMemo(
      () => {
        return (
          ordenes.find(
            (
              orden
            ) =>
              orden.id ===
                ordenId ||
              orden.ordenId ===
                ordenId
          ) ||
          null
        );
      },
      [
        ordenes,
        ordenId,
      ]
    );


  const analisisDisponibles =
    useMemo(
      () => {
        if (
          !ordenSeleccionada
        ) {
          return [];
        }

        return ordenSeleccionada
          .analisis
          .filter(
            (
              analisis
            ) => {
              return !muestras.some(
                (
                  muestra
                ) =>
                  muestra.ordenId ===
                    ordenSeleccionada.id &&
                  muestra.analisisId ===
                    analisis.analisisId
              );
            }
          );
      },
      [
        ordenSeleccionada,
        muestras,
      ]
    );


  const obtenerNombrePaciente =
    (
      pacienteId: string
    ): string => {
      const paciente =
        pacientes.find(
          (
            item
          ) =>
            item.id ===
              pacienteId ||
            item.pacienteId ===
              pacienteId
        );

      if (
        !paciente
      ) {
        return (
          pacienteId ||
          "Paciente"
        );
      }

      const nombre =
        [
          paciente.nombres,
          paciente.apellidos,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      return (
        nombre ||
        pacienteId ||
        "Paciente"
      );
    };


  const seleccionarOrden =
    (
      orden: OrdenMuestra
    ): void => {
      setOrdenId(
        orden.id
      );

      setAnalisisId(
        ""
      );

      setTipo(
        ""
      );

      setModalOrdenes(
        false
      );
    };


  const registrar =
    async (): Promise<void> => {
      if (
        !usuario
      ) {
        Alert.alert(
          "Sesión no disponible",
          "No se pudo identificar al usuario."
        );

        return;
      }

      if (
        !ordenSeleccionada
      ) {
        Alert.alert(
          "Orden requerida",
          "Selecciona una orden."
        );

        return;
      }

      if (
        !analisisId
      ) {
        Alert.alert(
          "Análisis requerido",
          "Selecciona un análisis."
        );

        return;
      }

      if (
        !tipo
      ) {
        Alert.alert(
          "Tipo requerido",
          "Selecciona el tipo de muestra."
        );

        return;
      }

      try {
        setGuardando(
          true
        );

        const analisis =
          ordenSeleccionada
            .analisis
            .find(
              (
                item
              ) =>
                item.analisisId ===
                analisisId
            );

        if (
          !analisis
        ) {
          throw new Error(
            "El análisis seleccionado no pertenece a la orden."
          );
        }

        const duplicada =
          muestras.some(
            (
              muestra
            ) =>
              muestra.ordenId ===
                ordenSeleccionada.id &&
              muestra.analisisId ===
                analisisId
          );

        if (
          duplicada
        ) {
          throw new Error(
            "Esta orden ya tiene una muestra registrada para ese análisis."
          );
        }

        const referencia =
          doc(
            collection(
              db,
              "muestras"
            )
          );

        const codigoEtiqueta =
          generarCodigoEtiqueta();

        await setDoc(
          referencia,
          {
            muestraId:
              referencia.id,

            laboratorioId:
              usuario.laboratorioId,

            solicitudId:
              ordenSeleccionada
                .solicitudId,

            ordenId:
              ordenSeleccionada.id,

            pacienteId:
              ordenSeleccionada
                .pacienteId,

            analisisId,

            analisisNombre:
              analisis.nombre,

            bioquimicoId:
              usuario.id,

            tipo,

            codigoEtiqueta,

            estado:
              "tomada",

            fechaToma:
              serverTimestamp(),
          }
        );

        const nuevaSnap =
          await getDoc(
            referencia
          );

        if (
          !nuevaSnap.exists()
        ) {
          throw new Error(
            "La muestra se registró, pero no pudo recuperarse."
          );
        }

        const nueva:
          MuestraItem = {
          id:
            nuevaSnap.id,

          muestraId:
            limpiarTexto(
              nuevaSnap.data()
                .muestraId
            ) ||
            nuevaSnap.id,

          laboratorioId:
            limpiarTexto(
              nuevaSnap.data()
                .laboratorioId
            ),

          solicitudId:
            limpiarTexto(
              nuevaSnap.data()
                .solicitudId
            ),

          ordenId:
            limpiarTexto(
              nuevaSnap.data()
                .ordenId
            ),

          pacienteId:
            limpiarTexto(
              nuevaSnap.data()
                .pacienteId
            ),

          analisisId:
            limpiarTexto(
              nuevaSnap.data()
                .analisisId
            ),

          analisisNombre:
            limpiarTexto(
              nuevaSnap.data()
                .analisisNombre
            ),

          bioquimicoId:
            limpiarTexto(
              nuevaSnap.data()
                .bioquimicoId
            ),

          tipo:
            limpiarTexto(
              nuevaSnap.data()
                .tipo
            ),

          codigoEtiqueta:
            limpiarTexto(
              nuevaSnap.data()
                .codigoEtiqueta
            ),

          estado:
            limpiarTexto(
              nuevaSnap.data()
                .estado
            ) ||
            "tomada",

          fechaToma:
            nuevaSnap.data()
              .fechaToma ||
            null,
        };

        const muestrasActualizadas =
          await obtenerMuestras(
            usuario.laboratorioId
          );

        setMuestras(
          muestrasActualizadas
        );

        setDetalle(
          nueva
        );

        setAnalisisId(
          ""
        );

        setTipo(
          ""
        );

        Alert.alert(
          "Muestra registrada",
          `Etiqueta: ${codigoEtiqueta}`
        );

      } catch (
        error: unknown
      ) {
        console.error(
          "Error registrando muestra:",
          error
        );

        Alert.alert(
          "Error",
          obtenerMensajeError(
            error,
            "No se pudo registrar la muestra."
          )
        );

      } finally {
        setGuardando(
          false
        );
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
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
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
          Gestión de muestras
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
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                LABORATORIO
              </Text>

              <Text
                style={
                  styles.title
                }
              >
                Gestión de muestras
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Registra y consulta muestras asociadas a las órdenes del laboratorio.
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
                🧪
              </Text>
            </View>
          </View>
        </View>


        <View
          style={
            styles.statsRow
          }
        >
          <Estadistica
            titulo="ÓRDENES"
            valor={
              ordenes.length
            }
          />

          <Estadistica
            titulo="MUESTRAS"
            valor={
              muestras.length
            }
          />

          <Estadistica
            titulo="PENDIENTES"
            valor={
              analisisDisponibles.length
            }
          />
        </View>


        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Registrar toma de muestra
          </Text>

          <Text
            style={
              styles.cardDescription
            }
          >
            Selecciona una orden, el análisis y el tipo de muestra.
          </Text>


          <Text
            style={
              styles.label
            }
          >
            Orden
          </Text>

          <Pressable
            style={
              styles.selector
            }
            onPress={() =>
              setModalOrdenes(
                true
              )
            }
          >
            <Text
              style={
                ordenSeleccionada
                  ? styles.selectorValue
                  : styles.selectorPlaceholder
              }
            >
              {ordenSeleccionada
                ? `${ordenSeleccionada.ordenId} · ${obtenerNombrePaciente(
                    ordenSeleccionada.pacienteId
                  )}`
                : "Seleccionar orden"}
            </Text>

            <Text
              style={
                styles.selectorArrow
              }
            >
              ›
            </Text>
          </Pressable>


          {ordenSeleccionada && (
            <View
              style={
                styles.summaryBox
              }
            >
              <Dato
                titulo="PACIENTE"
                valor={
                  obtenerNombrePaciente(
                    ordenSeleccionada
                      .pacienteId
                  )
                }
              />

              <Dato
                titulo="SOLICITUD"
                valor={
                  ordenSeleccionada
                    .solicitudId ||
                  "Sin solicitud"
                }
              />

              <Dato
                titulo="ESTADO"
                valor={
                  ordenSeleccionada
                    .estado
                }
              />
            </View>
          )}


          <Text
            style={
              styles.label
            }
          >
            Análisis
          </Text>


          {!ordenSeleccionada ? (
            <View
              style={
                styles.infoBox
              }
            >
              <Text
                style={
                  styles.infoText
                }
              >
                Primero selecciona una orden.
              </Text>
            </View>

          ) : analisisDisponibles.length ===
            0 ? (
            <View
              style={
                styles.warningBox
              }
            >
              <Text
                style={
                  styles.warningText
                }
              >
                No existen análisis pendientes de muestra en esta orden.
              </Text>
            </View>

          ) : (
            <View
              style={
                styles.optionsWrap
              }
            >
              {analisisDisponibles.map(
                (
                  analisis
                ) => {
                  const seleccionado =
                    analisisId ===
                    analisis.analisisId;

                  return (
                    <Pressable
                      key={
                        analisis.analisisId
                      }
                      style={[
                        styles.optionButton,

                        seleccionado &&
                          styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        setAnalisisId(
                          analisis.analisisId
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,

                          seleccionado &&
                            styles.optionTextActive,
                        ]}
                      >
                        {analisis.nombre}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}


          <Text
            style={
              styles.label
            }
          >
            Tipo de muestra
          </Text>

          <Pressable
            style={
              styles.selector
            }
            onPress={() =>
              setModalTipos(
                true
              )
            }
          >
            <Text
              style={
                tipo
                  ? styles.selectorValue
                  : styles.selectorPlaceholder
              }
            >
              {tipo ||
                "Seleccionar tipo"}
            </Text>

            <Text
              style={
                styles.selectorArrow
              }
            >
              ›
            </Text>
          </Pressable>


          <Pressable
            style={[
              styles.primaryButton,

              (
                guardando ||
                !ordenId ||
                !analisisId ||
                !tipo
              ) &&
                styles.buttonDisabled,
            ]}
            disabled={
              guardando ||
              !ordenId ||
              !analisisId ||
              !tipo
            }
            onPress={
              registrar
            }
          >
            {guardando ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Registrar muestra
              </Text>
            )}
          </Pressable>
        </View>


        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Muestras registradas
          </Text>

          <Text
            style={
              styles.cardDescription
            }
          >
            Muestras tomadas en el laboratorio.
          </Text>


          {muestras.length ===
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
                🧪
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Sin muestras
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Todavía no existen muestras registradas.
              </Text>
            </View>

          ) : (
            muestras.map(
              (
                muestra
              ) => (
                <Pressable
                  key={
                    muestra.id
                  }
                  style={
                    styles.sampleCard
                  }
                  onPress={() =>
                    setDetalle(
                      muestra
                    )
                  }
                >
                  <View
                    style={
                      styles.sampleHeader
                    }
                  >
                    <View
                      style={
                        styles.sampleIcon
                      }
                    >
                      <Text>
                        🧪
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.sampleCode
                        }
                      >
                        {muestra.codigoEtiqueta ||
                          muestra.muestraId}
                      </Text>

                      <Text
                        style={
                          styles.samplePatient
                        }
                      >
                        {obtenerNombrePaciente(
                          muestra.pacienteId
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.selectorArrow
                      }
                    >
                      ›
                    </Text>
                  </View>

                  <View
                    style={
                      styles.sampleDetails
                    }
                  >
                    <Dato
                      titulo="ANÁLISIS"
                      valor={
                        muestra.analisisNombre
                      }
                    />

                    <Dato
                      titulo="TIPO"
                      valor={
                        muestra.tipo
                      }
                    />

                    <Dato
                      titulo="ESTADO"
                      valor={
                        muestra.estado
                      }
                    />
                  </View>
                </Pressable>
              )
            )
          )}
        </View>
      </ScrollView>


      <Modal
        visible={
          modalOrdenes
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalOrdenes(
            false
          )
        }
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Seleccionar orden
            </Text>


            <ScrollView
              style={
                styles.modalScroll
              }
            >
              {ordenes.length ===
              0 ? (
                <Text
                  style={
                    styles.emptyModalText
                  }
                >
                  No existen órdenes disponibles.
                </Text>
              ) : (
                ordenes.map(
                  (
                    orden
                  ) => (
                    <Pressable
                      key={
                        orden.id
                      }
                      style={
                        styles.modalOption
                      }
                      onPress={() =>
                        seleccionarOrden(
                          orden
                        )
                      }
                    >
                      <Text
                        style={
                          styles.modalOptionTitle
                        }
                      >
                        {orden.ordenId}
                      </Text>

                      <Text
                        style={
                          styles.modalOptionText
                        }
                      >
                        {obtenerNombrePaciente(
                          orden.pacienteId
                        )}
                      </Text>
                    </Pressable>
                  )
                )
              )}
            </ScrollView>


            <Pressable
              style={
                styles.closeButton
              }
              onPress={() =>
                setModalOrdenes(
                  false
                )
              }
            >
              <Text
                style={
                  styles.closeButtonText
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
          modalTipos
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalTipos(
            false
          )
        }
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Tipo de muestra
            </Text>


            {TIPOS_MUESTRA.map(
              (
                item
              ) => (
                <Pressable
                  key={
                    item
                  }
                  style={
                    styles.modalOption
                  }
                  onPress={() => {
                    setTipo(
                      item
                    );

                    setModalTipos(
                      false
                    );
                  }}
                >
                  <Text
                    style={
                      styles.modalOptionTitle
                    }
                  >
                    {item}
                  </Text>
                </Pressable>
              )
            )}


            <Pressable
              style={
                styles.closeButton
              }
              onPress={() =>
                setModalTipos(
                  false
                )
              }
            >
              <Text
                style={
                  styles.closeButtonText
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
          detalle !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDetalle(
            null
          )
        }
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <Text
              style={
                styles.modalLabel
              }
            >
              ETIQUETA DE MUESTRA
            </Text>

            <Text
              style={
                styles.labelCode
              }
            >
              {detalle?.codigoEtiqueta ||
                detalle?.muestraId ||
                "Muestra"}
            </Text>


            {detalle && (
              <View
                style={
                  styles.summaryBox
                }
              >
                <Dato
                  titulo="PACIENTE"
                  valor={
                    obtenerNombrePaciente(
                      detalle.pacienteId
                    )
                  }
                />

                <Dato
                  titulo="ORDEN"
                  valor={
                    detalle.ordenId ||
                    "Sin orden"
                  }
                />

                <Dato
                  titulo="ANÁLISIS"
                  valor={
                    detalle.analisisNombre
                  }
                />

                <Dato
                  titulo="TIPO"
                  valor={
                    detalle.tipo
                  }
                />

                <Dato
                  titulo="ESTADO"
                  valor={
                    detalle.estado
                  }
                />
              </View>
            )}


            <Pressable
              style={
                styles.closeButton
              }
              onPress={() =>
                setDetalle(
                  null
                )
              }
            >
              <Text
                style={
                  styles.closeButtonText
                }
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


function Estadistica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <View
      style={
        styles.statCard
      }
    >
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
  );
}


function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <View
      style={
        styles.dataBox
      }
    >
      <Text
        style={
          styles.dataTitle
        }
      >
        {titulo}
      </Text>

      <Text
        style={
          styles.dataValue
        }
      >
        {valor ||
          "—"}
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
      marginTop: 14,
      color:
        "#0F172A",
      fontSize: 20,
      fontWeight:
        "900",
    },

    loadingText: {
      marginTop: 5,
      color:
        "#64748B",
      fontSize: 10,
    },

    content: {
      paddingBottom: 40,
    },

    header: {
      padding: 20,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
    },

    backButton: {
      alignSelf:
        "flex-start",
      marginBottom: 18,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 9,
      backgroundColor:
        "#F1F5F9",
    },

    backText: {
      color:
        "#475569",
      fontSize: 10,
      fontWeight:
        "800",
    },

    headerRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    eyebrow: {
      color:
        "#7C3AED",
      fontSize: 8,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    title: {
      marginTop: 4,
      color:
        "#0F172A",
      fontSize: 25,
      fontWeight:
        "900",
    },

    subtitle: {
      marginTop: 6,
      color:
        "#64748B",
      fontSize: 10,
      lineHeight: 15,
    },

    headerIcon: {
      width: 62,
      height: 62,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginLeft: 12,
      borderRadius: 19,
      backgroundColor:
        "#EDE9FE",
    },

    headerEmoji: {
      fontSize: 29,
    },

    statsRow: {
      flexDirection:
        "row",
      paddingHorizontal: 14,
      paddingTop: 14,
    },

    statCard: {
      flex: 1,
      marginHorizontal: 3,
      padding: 12,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 13,
      backgroundColor:
        "#FFFFFF",
    },

    statTitle: {
      color:
        "#64748B",
      fontSize: 7,
      fontWeight:
        "900",
    },

    statValue: {
      marginTop: 6,
      color:
        "#0F172A",
      fontSize: 20,
      fontWeight:
        "900",
    },

    card: {
      marginHorizontal: 16,
      marginTop: 14,
      padding: 17,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
    },

    cardTitle: {
      color:
        "#0F172A",
      fontSize: 16,
      fontWeight:
        "900",
    },

    cardDescription: {
      marginTop: 4,
      marginBottom: 13,
      color:
        "#64748B",
      fontSize: 9,
      lineHeight: 14,
    },

    label: {
      marginTop: 13,
      marginBottom: 6,
      color:
        "#334155",
      fontSize: 9,
      fontWeight:
        "900",
    },

    selector: {
      minHeight: 49,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 11,
      backgroundColor:
        "#FFFFFF",
    },

    selectorValue: {
      flex: 1,
      color:
        "#0F172A",
      fontSize: 10,
      fontWeight:
        "700",
    },

    selectorPlaceholder: {
      flex: 1,
      color:
        "#94A3B8",
      fontSize: 10,
    },

    selectorArrow: {
      marginLeft: 8,
      color:
        "#7C3AED",
      fontSize: 23,
    },

    summaryBox: {
      marginTop: 11,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#F8FAFC",
    },

    dataBox: {
      marginBottom: 8,
    },

    dataTitle: {
      color:
        "#64748B",
      fontSize: 7,
      fontWeight:
        "900",
    },

    dataValue: {
      marginTop: 3,
      color:
        "#0F172A",
      fontSize: 10,
      fontWeight:
        "800",
    },

    infoBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor:
        "#F8FAFC",
    },

    infoText: {
      color:
        "#94A3B8",
      fontSize: 9,
    },

    warningBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor:
        "#FFF7ED",
    },

    warningText: {
      color:
        "#C2410C",
      fontSize: 9,
      fontWeight:
        "700",
    },

    optionsWrap: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      marginHorizontal: -3,
    },

    optionButton: {
      margin: 3,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor:
        "#DDD6FE",
      borderRadius: 9,
      backgroundColor:
        "#FAF5FF",
    },

    optionButtonActive: {
      borderColor:
        "#7C3AED",
      backgroundColor:
        "#7C3AED",
    },

    optionText: {
      color:
        "#6D28D9",
      fontSize: 9,
      fontWeight:
        "800",
    },

    optionTextActive: {
      color:
        "#FFFFFF",
    },

    primaryButton: {
      minHeight: 48,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 18,
      borderRadius: 11,
      backgroundColor:
        "#7C3AED",
    },

    primaryButtonText: {
      color:
        "#FFFFFF",
      fontSize: 10,
      fontWeight:
        "900",
    },

    buttonDisabled: {
      opacity: 0.5,
    },

    empty: {
      alignItems:
        "center",
      paddingVertical: 27,
    },

    emptyEmoji: {
      fontSize: 30,
    },

    emptyTitle: {
      marginTop: 8,
      color:
        "#0F172A",
      fontSize: 13,
      fontWeight:
        "900",
    },

    emptyText: {
      marginTop: 4,
      color:
        "#64748B",
      fontSize: 9,
    },

    sampleCard: {
      marginTop: 10,
      padding: 13,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 13,
      backgroundColor:
        "#FFFFFF",
    },

    sampleHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    sampleIcon: {
      width: 41,
      height: 41,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight: 10,
      borderRadius: 12,
      backgroundColor:
        "#EDE9FE",
    },

    sampleCode: {
      color:
        "#0F172A",
      fontSize: 11,
      fontWeight:
        "900",
    },

    samplePatient: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 8,
    },

    sampleDetails: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        "#F1F5F9",
    },

    overlay: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 18,
      backgroundColor:
        "rgba(15,23,42,.72)",
    },

    modalCard: {
      width:
        "100%",
      maxWidth: 480,
      maxHeight:
        "82%",
      padding: 18,
      borderRadius: 18,
      backgroundColor:
        "#FFFFFF",
    },

    modalTitle: {
      marginBottom: 12,
      color:
        "#0F172A",
      fontSize: 17,
      fontWeight:
        "900",
    },

    modalScroll: {
      maxHeight: 430,
    },

    modalOption: {
      marginBottom: 8,
      padding: 12,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 11,
      backgroundColor:
        "#F8FAFC",
    },

    modalOptionTitle: {
      color:
        "#0F172A",
      fontSize: 10,
      fontWeight:
        "900",
    },

    modalOptionText: {
      marginTop: 3,
      color:
        "#64748B",
      fontSize: 8,
    },

    emptyModalText: {
      paddingVertical: 25,
      color:
        "#64748B",
      fontSize: 9,
      textAlign:
        "center",
    },

    closeButton: {
      minHeight: 44,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 12,
      borderRadius: 10,
      backgroundColor:
        "#F1F5F9",
    },

    closeButtonText: {
      color:
        "#475569",
      fontSize: 9,
      fontWeight:
        "900",
    },

    modalLabel: {
      color:
        "#7C3AED",
      fontSize: 8,
      fontWeight:
        "900",
      textAlign:
        "center",
      letterSpacing: 1,
    },

    labelCode: {
      marginTop: 8,
      marginBottom: 17,
      color:
        "#0F172A",
      fontSize: 22,
      fontWeight:
        "900",
      textAlign:
        "center",
    },
  });
