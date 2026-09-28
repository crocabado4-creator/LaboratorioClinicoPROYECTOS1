import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useLocalSearchParams,
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
  obtenerPaciente,
  type Paciente,
} from "../services/pacientesService";

import {
  obtenerHistorialPaciente,
  type HistorialPaciente,
  type ResultadoHistorial,
  type SolicitudHistorial,
} from "../services/historialPacienteService";


type UsuarioActual = {
  laboratorioId: string;
  rol: string;
};


const historialInicial:
  HistorialPaciente = {
    solicitudes: [],
    resultados: [],
    totalAnalisis: 0,
  };


export default function HistorialPacienteScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      pacienteId?: string |
        string[];
    }>();

  const pacienteId =
    obtenerParametro(
      params.pacienteId
    );


  const [
    paciente,
    setPaciente,
  ] =
    useState<Paciente | null>(
      null
    );


  const [
    historial,
    setHistorial,
  ] =
    useState<HistorialPaciente>(
      historialInicial
    );


  const [
    cargando,
    setCargando,
  ] =
    useState(true);


  const cargarHistorial =
    useCallback(
      async () => {
        try {
          setCargando(
            true
          );

          if (!pacienteId) {
            throw new Error(
              "No se recibió el identificador del paciente."
            );
          }

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


          const usuario:
            UsuarioActual = {
              laboratorioId:
                typeof datosUsuario.laboratorioId ===
                  "string"
                  ? datosUsuario.laboratorioId.trim()
                  : "",

              rol:
                typeof datosUsuario.rol ===
                  "string"
                  ? datosUsuario.rol.trim()
                  : "",
            };


          if (
            !usuario.laboratorioId
          ) {
            throw new Error(
              "El usuario no está asociado a un laboratorio."
            );
          }


          if (!usuario.rol) {
            throw new Error(
              "El usuario no tiene un rol asignado."
            );
          }


          const permisos =
            await obtenerPermisosRol(
              usuario.rol
            );


          if (
            !Array.isArray(
              permisos
            ) ||
            !permisos.includes(
              "resultados.ver"
            )
          ) {
            throw new Error(
              "No tienes permiso para consultar el historial clínico."
            );
          }


          const pacienteActual =
            await obtenerPaciente(
              pacienteId
            );


          if (!pacienteActual) {
            throw new Error(
              "El paciente seleccionado no existe."
            );
          }


          if (
            pacienteActual.laboratorioId !==
            usuario.laboratorioId
          ) {
            throw new Error(
              "No puedes consultar pacientes de otro laboratorio."
            );
          }


          const datosHistorial =
            await obtenerHistorialPaciente(
              usuario.laboratorioId,
              pacienteId
            );


          setPaciente(
            pacienteActual
          );

          setHistorial(
            datosHistorial
          );

        } catch (error) {
          console.error(
            "Error cargando historial:",
            error
          );

          Alert.alert(
            "Error",
            obtenerMensajeError(
              error,
              "No se pudo cargar el historial del paciente."
            )
          );

        } finally {
          setCargando(
            false
          );
        }
      },
      [
        pacienteId,
        router,
      ]
    );


  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);


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
          color="#2563EB"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Historial del paciente
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Consultando solicitudes y resultados...
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

          <Text
            style={
              styles.eyebrow
            }
          >
            HISTORIAL CLÍNICO
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Historial del paciente
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Consulta las solicitudes, análisis y resultados anteriores registrados para este paciente.
          </Text>
        </View>


        {paciente ? (
          <View
            style={
              styles.patientCard
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
                {formatearFechaSimple(
                  paciente.fechaNacimiento
                )}
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Paciente no disponible
            </Text>
          </View>
        )}


        <View
          style={
            styles.statsRow
          }
        >
          <Estadistica
            titulo="SOLICITUDES"
            valor={
              historial.solicitudes.length
            }
          />

          <Estadistica
            titulo="ANÁLISIS"
            valor={
              historial.totalAnalisis
            }
          />

          <Estadistica
            titulo="RESULTADOS"
            valor={
              historial.resultados.length
            }
          />
        </View>


        <View
          style={
            styles.section
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                SOLICITUDES
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Solicitudes anteriores
              </Text>
            </View>

            <Text
              style={
                styles.counter
              }
            >
              {historial.solicitudes.length}
            </Text>
          </View>


          {historial.solicitudes.length ===
          0 ? (
            <Vacio
              icono="🧾"
              titulo="Sin solicitudes"
              texto="Todavía no existen solicitudes registradas para este paciente."
            />
          ) : (
            historial.solicitudes.map(
              (solicitud) => (
                <SolicitudCard
                  key={
                    solicitud.id
                  }
                  solicitud={
                    solicitud
                  }
                />
              )
            )
          )}
        </View>


        <View
          style={
            styles.section
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                RESULTADOS
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Resultados registrados
              </Text>
            </View>

            <Text
              style={
                styles.counter
              }
            >
              {historial.resultados.length}
            </Text>
          </View>


          {historial.resultados.length ===
          0 ? (
            <Vacio
              icono="📋"
              titulo="Sin resultados"
              texto="Todavía no existen resultados registrados para este paciente."
            />
          ) : (
            historial.resultados.map(
              (resultado) => (
                <ResultadoCard
                  key={
                    resultado.id
                  }
                  resultado={
                    resultado
                  }
                />
              )
            )
          )}
        </View>
      </ScrollView>
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
          styles.statLabel
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


function SolicitudCard({
  solicitud,
}: {
  solicitud:
    SolicitudHistorial;
}) {
  return (
    <View
      style={
        styles.recordCard
      }
    >
      <View
        style={
          styles.recordHeader
        }
      >
        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.recordTitle
            }
          >
            Solicitud{" "}
            {recortarId(
              solicitud.solicitudId
            )}
          </Text>

          <Text
            style={
              styles.recordDate
            }
          >
            {formatearFecha(
              solicitud.fecha
            )}
          </Text>
        </View>

        <Estado
          valor={
            solicitud.estado
          }
        />
      </View>


      <Text
        style={
          styles.recordLabel
        }
      >
        ANÁLISIS SOLICITADOS
      </Text>


      {solicitud.analisis.length ===
      0 ? (
        <Text
          style={
            styles.muted
          }
        >
          Sin detalle de análisis.
        </Text>
      ) : (
        solicitud.analisis.map(
          (
            analisis,
            indice
          ) => (
            <View
              key={
                analisis.analisisId ||
                `${solicitud.id}-${indice}`
              }
              style={
                styles.analysisRow
              }
            >
              <View
                style={
                  styles.analysisBullet
                }
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.analysisName
                  }
                >
                  {analisis.nombre}
                </Text>

                <Text
                  style={
                    styles.analysisMeta
                  }
                >
                  Cantidad:{" "}
                  {analisis.cantidad}
                </Text>
              </View>

              {analisis.subtotal >
              0 && (
                <Text
                  style={
                    styles.analysisPrice
                  }
                >
                  Bs{" "}
                  {analisis.subtotal.toFixed(
                    2
                  )}
                </Text>
              )}
            </View>
          )
        )
      )}


      {solicitud.total >
      0 && (
        <View
          style={
            styles.totalRow
          }
        >
          <Text
            style={
              styles.totalLabel
            }
          >
            Total
          </Text>

          <Text
            style={
              styles.totalValue
            }
          >
            Bs{" "}
            {solicitud.total.toFixed(
              2
            )}
          </Text>
        </View>
      )}
    </View>
  );
}


function ResultadoCard({
  resultado,
}: {
  resultado:
    ResultadoHistorial;
}) {
  return (
    <View
      style={
        styles.resultCard
      }
    >
      <View
        style={
          styles.recordHeader
        }
      >
        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.recordTitle
            }
          >
            {resultado.analisisNombre}
          </Text>

          <Text
            style={
              styles.recordDate
            }
          >
            {formatearFecha(
              resultado.fechaRegistro
            )}
          </Text>
        </View>

        <Estado
          valor={
            resultado.estado
          }
        />
      </View>


      {resultado.solicitudId ? (
        <Text
          style={
            styles.referenceText
          }
        >
          Solicitud:{" "}
          {recortarId(
            resultado.solicitudId
          )}
        </Text>
      ) : null}


      {resultado.valores.length >
      0 && (
        <View
          style={
            styles.valuesBox
          }
        >
          <Text
            style={
              styles.recordLabel
            }
          >
            VALORES REGISTRADOS
          </Text>

          {resultado.valores.map(
            (
              valor,
              indice
            ) => (
              <View
                key={
                  valor.parametroId ||
                  `${resultado.id}-${indice}`
                }
                style={
                  styles.valueRow
                }
              >
                <Text
                  style={
                    styles.valueName
                  }
                >
                  {valor.nombre}
                </Text>

                <Text
                  style={
                    styles.valueText
                  }
                >
                  {valor.valor ||
                    "Sin valor"}
                  {valor.unidad
                    ? ` ${valor.unidad}`
                    : ""}
                </Text>
              </View>
            )
          )}
        </View>
      )}


      {resultado.observaciones ? (
        <View
          style={
            styles.observationBox
          }
        >
          <Text
            style={
              styles.recordLabel
            }
          >
            OBSERVACIONES
          </Text>

          <Text
            style={
              styles.observationText
            }
          >
            {resultado.observaciones}
          </Text>
        </View>
      ) : null}
    </View>
  );
}


function Estado({
  valor,
}: {
  valor: string;
}) {
  const normalizado =
    valor
      .trim()
      .toLowerCase();

  const finalizado =
    [
      "finalizado",
      "completado",
      "entregado",
      "validado",
    ].includes(
      normalizado
    );

  const pendiente =
    [
      "pendiente",
      "registrado",
    ].includes(
      normalizado
    );

  return (
    <View
      style={[
        styles.status,

        finalizado &&
          styles.statusSuccess,

        pendiente &&
          styles.statusPending,
      ]}
    >
      <Text
        style={[
          styles.statusText,

          finalizado &&
            styles.statusSuccessText,

          pendiente &&
            styles.statusPendingText,
        ]}
      >
        {valor ||
          "Sin estado"}
      </Text>
    </View>
  );
}


function Vacio({
  icono,
  titulo,
  texto,
}: {
  icono: string;
  titulo: string;
  texto: string;
}) {
  return (
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
        {icono}
      </Text>

      <Text
        style={
          styles.emptyTitle
        }
      >
        {titulo}
      </Text>

      <Text
        style={
          styles.emptyText
        }
      >
        {texto}
      </Text>
    </View>
  );
}


function obtenerParametro(
  valor:
    | string
    | string[]
    | undefined
): string {
  if (
    Array.isArray(
      valor
    )
  ) {
    return valor[0] ||
      "";
  }

  return valor ||
    "";
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


function recortarId(
  valor: string
): string {
  if (!valor) {
    return "-";
  }

  if (
    valor.length <=
    12
  ) {
    return valor;
  }

  return `${valor.slice(
    0,
    8
  )}...`;
}


function formatearFechaSimple(
  fecha: string
): string {
  const partes =
    fecha.split(
      "-"
    );

  if (
    partes.length ===
    3
  ) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  return fecha ||
    "Sin información";
}


function formatearFecha(
  valor: unknown
): string {
  if (!valor) {
    return "Sin fecha";
  }

  try {
    if (
      typeof valor ===
        "object" &&
      valor !== null
    ) {
      const objeto =
        valor as {
          toDate?: () => Date;
          seconds?: number;
        };

      if (
        typeof objeto.toDate ===
        "function"
      ) {
        return objeto
          .toDate()
          .toLocaleString(
            "es-BO"
          );
      }

      if (
        typeof objeto.seconds ===
        "number"
      ) {
        return new Date(
          objeto.seconds *
          1000
        ).toLocaleString(
          "es-BO"
        );
      }
    }

    if (
      typeof valor ===
      "string"
    ) {
      const fecha =
        new Date(valor);

      if (
        !Number.isNaN(
          fecha.getTime()
        )
      ) {
        return fecha.toLocaleString(
          "es-BO"
        );
      }

      return valor;
    }

    return String(valor);

  } catch {
    return "Sin fecha";
  }
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
      paddingBottom: 45,
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
      fontWeight: "900",
      color: "#0F172A",
    },

    loadingText: {
      marginTop: 5,
      fontSize: 12,
      textAlign: "center",
      color: "#64748B",
    },

    header: {
      padding: 18,
      borderRadius: 20,
      backgroundColor:
        "#EFF6FF",
      borderWidth: 1,
      borderColor:
        "#BFDBFE",
      marginBottom: 13,
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
        "#DBEAFE",
      marginBottom: 16,
    },

    backText: {
      color: "#475569",
      fontSize: 12,
      fontWeight: "800",
    },

    eyebrow: {
      color: "#2563EB",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    title: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 27,
      fontWeight: "900",
    },

    subtitle: {
      marginTop: 6,
      color: "#64748B",
      fontSize: 12,
      lineHeight: 18,
    },

    patientCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 15,
      borderRadius: 16,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      marginBottom: 13,
    },

    avatar: {
      width: 52,
      height: 52,
      borderRadius: 15,
      backgroundColor:
        "#DBEAFE",
      alignItems: "center",
      justifyContent:
        "center",
    },

    avatarText: {
      color: "#1D4ED8",
      fontSize: 16,
      fontWeight: "900",
    },

    patientInfo: {
      flex: 1,
    },

    patientName: {
      color: "#0F172A",
      fontSize: 16,
      fontWeight: "900",
    },

    patientMeta: {
      marginTop: 3,
      color: "#64748B",
      fontSize: 11,
    },

    statsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },

    statCard: {
      flex: 1,
      minHeight: 82,
      padding: 12,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      justifyContent:
        "center",
    },

    statLabel: {
      color: "#64748B",
      fontSize: 8,
      fontWeight: "900",
    },

    statValue: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 22,
      fontWeight: "900",
    },

    section: {
      marginBottom: 16,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
      marginBottom: 9,
    },

    sectionEyebrow: {
      color: "#2563EB",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1,
    },

    sectionTitle: {
      marginTop: 2,
      color: "#0F172A",
      fontSize: 18,
      fontWeight: "900",
    },

    counter: {
      minWidth: 31,
      textAlign: "center",
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 20,
      backgroundColor:
        "#DBEAFE",
      color: "#1D4ED8",
      fontSize: 10,
      fontWeight: "900",
    },

    recordCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      marginBottom: 9,
    },

    resultCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#BFDBFE",
      marginBottom: 9,
    },

    recordHeader: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 10,
      marginBottom: 11,
    },

    recordTitle: {
      color: "#0F172A",
      fontSize: 14,
      fontWeight: "900",
    },

    recordDate: {
      marginTop: 3,
      color: "#64748B",
      fontSize: 10,
    },

    recordLabel: {
      color: "#64748B",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: .7,
      marginBottom: 7,
    },

    status: {
      paddingVertical: 6,
      paddingHorizontal: 9,
      borderRadius: 20,
      backgroundColor:
        "#E2E8F0",
    },

    statusText: {
      color: "#475569",
      fontSize: 8,
      fontWeight: "900",
      textTransform:
        "uppercase",
    },

    statusSuccess: {
      backgroundColor:
        "#DCFCE7",
    },

    statusSuccessText: {
      color: "#15803D",
    },

    statusPending: {
      backgroundColor:
        "#FEF3C7",
    },

    statusPendingText: {
      color: "#A16207",
    },

    analysisRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor:
        "#F1F5F9",
    },

    analysisBullet: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        "#2563EB",
    },

    analysisName: {
      color: "#334155",
      fontSize: 11,
      fontWeight: "800",
    },

    analysisMeta: {
      marginTop: 2,
      color: "#94A3B8",
      fontSize: 9,
    },

    analysisPrice: {
      color: "#0F172A",
      fontSize: 10,
      fontWeight: "900",
    },

    totalRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        "#E2E8F0",
    },

    totalLabel: {
      color: "#64748B",
      fontSize: 10,
      fontWeight: "800",
    },

    totalValue: {
      color: "#15803D",
      fontSize: 13,
      fontWeight: "900",
    },

    referenceText: {
      marginBottom: 9,
      color: "#64748B",
      fontSize: 9,
      fontWeight: "700",
    },

    valuesBox: {
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#F8FAFC",
      marginBottom: 9,
    },

    valueRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      gap: 12,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
    },

    valueName: {
      flex: 1,
      color: "#475569",
      fontSize: 10,
      fontWeight: "700",
    },

    valueText: {
      color: "#0F172A",
      fontSize: 10,
      fontWeight: "900",
      textAlign: "right",
    },

    observationBox: {
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#EFF6FF",
    },

    observationText: {
      color: "#334155",
      fontSize: 10,
      lineHeight: 16,
    },

    muted: {
      color: "#94A3B8",
      fontSize: 10,
    },

    emptyCard: {
      padding: 24,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      alignItems: "center",
    },

    emptyIcon: {
      fontSize: 30,
    },

    emptyTitle: {
      marginTop: 7,
      color: "#334155",
      fontSize: 15,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 4,
      color: "#64748B",
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
    },
  });
