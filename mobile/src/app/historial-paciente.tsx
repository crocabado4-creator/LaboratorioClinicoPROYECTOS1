import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
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

import {
  obtenerInformeFinalizado,
  obtenerInformesPorOrden,
  type InformeClinico,
} from "../services/informeResultadosService";

import {
  generarPDFResultado,
  generarPDFResultadosOrden,
} from "../services/pdfResultadosService";

// ======================================================
// TIPOS
// ======================================================

type UsuarioActual = {
  laboratorioId: string;
  rol: string;
};

type InformeSeleccionado = {
  informes: InformeClinico[];
  resultadoId: string;
};

const historialInicial: HistorialPaciente = {
  solicitudes: [],
  resultados: [],
  totalAnalisis: 0,
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function obtenerParametro(
  valor: string | string[] | undefined
): string {
  if (Array.isArray(valor)) {
    return valor[0] || "";
  }

  return valor || "";
}

function obtenerMensajeError(
  error: unknown,
  mensaje: string
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return mensaje;
}

function texto(
  valor: unknown,
  alternativo = "-"
): string {
  if (valor === null || valor === undefined) {
    return alternativo;
  }

  const resultado = String(valor).trim();

  return resultado || alternativo;
}

function formatearFecha(valor: unknown): string {
  if (!valor) {
    return "Sin fecha";
  }

  try {
    let fecha: Date;

    if (
      typeof valor === "object" &&
      valor !== null &&
      "toDate" in valor &&
      typeof valor.toDate === "function"
    ) {
      fecha = valor.toDate() as Date;
    } else if (
      typeof valor === "object" &&
      valor !== null &&
      "seconds" in valor &&
      typeof valor.seconds === "number"
    ) {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor as string);
    }

    if (Number.isNaN(fecha.getTime())) {
      return texto(valor, "Sin fecha");
    }

    return fecha.toLocaleDateString("es-BO");
  } catch {
    return texto(valor, "Sin fecha");
  }
}

function esResultadoFinalizado(
  estado: string
): boolean {
  return [
    "validado",
    "finalizado",
    "completado",
    "entregado",
  ].includes(
    String(estado || "").trim().toLowerCase()
  );
}

function esInformeValidado(
  informe: InformeClinico
): boolean {
  const estado = texto(
    informe.estado,
    ""
  ).toLowerCase();

  return [
    "validado",
    "finalizado",
    "completado",
    "entregado",
  ].includes(estado);
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function HistorialPacienteScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    pacienteId?: string | string[];
  }>();

  const pacienteId = obtenerParametro(
    params.pacienteId
  );

  const [paciente, setPaciente] =
    useState<Paciente | null>(null);

  const [historial, setHistorial] =
    useState<HistorialPaciente>(
      historialInicial
    );

  const [usuario, setUsuario] =
    useState<UsuarioActual | null>(null);

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [procesando, setProcesando] =
    useState(false);

  const [resultadoProcesando, setResultadoProcesando] =
    useState<string | null>(null);

  const [informeSeleccionado, setInformeSeleccionado] =
    useState<InformeSeleccionado | null>(null);

  // ====================================================
  // CARGAR HISTORIAL
  // ====================================================

  const cargarHistorial = useCallback(
    async () => {
      try {
        if (!pacienteId) {
          throw new Error(
            "No se recibió el identificador del paciente."
          );
        }

        const firebaseUser = auth.currentUser;

        if (!firebaseUser) {
          throw new Error(
            "Debes iniciar sesión nuevamente."
          );
        }

        const usuarioSnap = await getDoc(
          doc(
            db,
            "usuarios",
            firebaseUser.uid
          )
        );

        if (!usuarioSnap.exists()) {
          throw new Error(
            "No se encontró el usuario en Firestore."
          );
        }

        const datosUsuario = usuarioSnap.data();

        if (datosUsuario.activo !== true) {
          throw new Error(
            "El usuario está inactivo."
          );
        }

        const usuarioActual: UsuarioActual = {
          laboratorioId: texto(
            datosUsuario.laboratorioId,
            ""
          ),

          rol: texto(
            datosUsuario.rol,
            ""
          ),
        };

        if (!usuarioActual.laboratorioId) {
          throw new Error(
            "El usuario no tiene laboratorio asignado."
          );
        }

        if (!usuarioActual.rol) {
          throw new Error(
            "El usuario no tiene un rol asignado."
          );
        }

        const permisos = await obtenerPermisosRol(
          usuarioActual.rol
        );

        if (
          !Array.isArray(permisos) ||
          !permisos.includes("resultados.ver")
        ) {
          throw new Error(
            "No tienes permiso para consultar resultados clínicos."
          );
        }

        const pacienteActual =
          await obtenerPaciente(pacienteId);

        if (!pacienteActual) {
          throw new Error(
            "El paciente seleccionado no existe."
          );
        }

        if (
          pacienteActual.laboratorioId !==
          usuarioActual.laboratorioId
        ) {
          throw new Error(
            "El paciente pertenece a otro laboratorio."
          );
        }

        const datosHistorial =
          await obtenerHistorialPaciente(
            usuarioActual.laboratorioId,
            pacienteId
          );

        setUsuario(usuarioActual);
        setPaciente(pacienteActual);
        setHistorial(datosHistorial);
      } catch (error) {
        console.error(
          "Error cargando historial:",
          error
        );

        Alert.alert(
          "Error",
          obtenerMensajeError(
            error,
            "No se pudo cargar el historial."
          )
        );
      } finally {
        setCargando(false);
      }
    },
    [pacienteId]
  );

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const actualizar = async () => {
    try {
      setActualizando(true);
      await cargarHistorial();
    } finally {
      setActualizando(false);
    }
  };

  // ====================================================
  // VALIDAR PERTENENCIA DEL INFORME
  // ====================================================

  const validarInforme = (
    informe: InformeClinico
  ) => {
    if (!usuario) {
      throw new Error(
        "No se encontró la sesión del usuario."
      );
    }

    if (informe.pacienteId !== pacienteId) {
      throw new Error(
        "El resultado pertenece a otro paciente."
      );
    }

    if (
      informe.laboratorioId !==
      usuario.laboratorioId
    ) {
      throw new Error(
        "El resultado pertenece a otro laboratorio."
      );
    }

    if (!esInformeValidado(informe)) {
      throw new Error(
        "El resultado clínico todavía no está validado."
      );
    }
  };

  // ====================================================
  // CONSULTAR INFORME INDIVIDUAL
  // ====================================================

  const consultarResultado = async (
    resultadoId: string
  ) => {
    if (procesando) {
      return;
    }

    try {
      setProcesando(true);
      setResultadoProcesando(resultadoId);

      const informe =
        await obtenerInformeFinalizado(
          resultadoId
        );

      validarInforme(informe);

      setInformeSeleccionado({
        informes: [informe],
        resultadoId,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        obtenerMensajeError(
          error,
          "No se pudo consultar el resultado clínico."
        )
      );
    } finally {
      setProcesando(false);
      setResultadoProcesando(null);
    }
  };

  // ====================================================
  // CONSULTAR TODOS LOS RESULTADOS DE LA ORDEN
  // ====================================================

  const consultarOrden = async (
    resultadoId: string
  ) => {
    if (procesando || !usuario) {
      return;
    }

    try {
      setProcesando(true);
      setResultadoProcesando(resultadoId);

      const resultadoSnap = await getDoc(
        doc(
          db,
          "resultados",
          resultadoId
        )
      );

      if (!resultadoSnap.exists()) {
        throw new Error(
          "No se encontró el resultado seleccionado."
        );
      }

      const datos = resultadoSnap.data();

      if (
        texto(datos.pacienteId, "") !==
        pacienteId
      ) {
        throw new Error(
          "El resultado pertenece a otro paciente."
        );
      }

      if (
        texto(datos.laboratorioId, "") !==
        usuario.laboratorioId
      ) {
        throw new Error(
          "El resultado pertenece a otro laboratorio."
        );
      }

      const ordenId = texto(
        datos.ordenId,
        ""
      );

      if (!ordenId) {
        throw new Error(
          "El resultado no tiene una orden asociada."
        );
      }

      const informes =
        await obtenerInformesPorOrden(
          ordenId
        );

      if (!informes.length) {
        throw new Error(
          "La orden no tiene resultados clínicos validados."
        );
      }

      informes.forEach((informe) => {
        validarInforme(informe);

        if (informe.ordenId !== ordenId) {
          throw new Error(
            "Los resultados no pertenecen a la misma orden."
          );
        }
      });

      setInformeSeleccionado({
        informes,
        resultadoId,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        obtenerMensajeError(
          error,
          "No se pudieron consultar los resultados de la orden."
        )
      );
    } finally {
      setProcesando(false);
      setResultadoProcesando(null);
    }
  };

  // ====================================================
  // GENERAR PDF DEL INFORME SELECCIONADO
  // ====================================================

  const generarPDFSeleccionado = async () => {
    if (
      procesando ||
      !informeSeleccionado
    ) {
      return;
    }

    try {
      setProcesando(true);

      const informes =
        informeSeleccionado.informes;

      informes.forEach(validarInforme);

      if (informes.length === 1) {
        await generarPDFResultado(
          informes[0]
        );
      } else {
        await generarPDFResultadosOrden(
          informes
        );
      }
    } catch (error) {
      Alert.alert(
        "Error al generar PDF",
        obtenerMensajeError(
          error,
          "No se pudo generar el informe clínico."
        )
      );
    } finally {
      setProcesando(false);
    }
  };

  // ====================================================
  // CARGANDO
  // ====================================================

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text style={styles.loadingTitle}>
          Historial del paciente
        </Text>

        <Text style={styles.loadingText}>
          Consultando solicitudes y resultados...
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
        backgroundColor="#F8FAFC"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={actualizar}
          />
        }
      >
        {/* ENCABEZADO */}

        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>
              ← Volver
            </Text>
          </Pressable>

          <Text style={styles.eyebrow}>
            LABORATORIO CLÍNICO
          </Text>

          <Text style={styles.title}>
            Resultados de pacientes
          </Text>

          <Text style={styles.subtitle}>
            Consulta resultados clínicos,
            parámetros, rangos de referencia
            y solicitudes del paciente.
          </Text>
        </View>

        {/* PACIENTE */}

        {paciente ? (
          <View style={styles.patientCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {texto(
                  paciente.nombres,
                  "P"
                )
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>
                {paciente.nombres}{" "}
                {paciente.apellidos}
              </Text>

              <Text style={styles.patientMeta}>
                CI: {texto(paciente.ci)}
              </Text>

              <Text style={styles.patientMeta}>
                Nacimiento:{" "}
                {formatearFecha(
                  paciente.fechaNacimiento
                )}
              </Text>
            </View>
          </View>
        ) : (
          <Vacio
            titulo="Paciente no disponible"
            descripcion="No se encontraron los datos del paciente."
          />
        )}

        {/* ESTADÍSTICAS */}

        <View style={styles.statsRow}>
          <Estadistica
            titulo="SOLICITUDES"
            valor={historial.solicitudes.length}
          />

          <Estadistica
            titulo="ANÁLISIS"
            valor={historial.totalAnalisis}
          />

          <Estadistica
            titulo="RESULTADOS"
            valor={historial.resultados.length}
          />
        </View>

        {/* SOLICITUDES */}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Solicitudes anteriores
            </Text>

            <Text style={styles.counter}>
              {historial.solicitudes.length}
            </Text>
          </View>

          {historial.solicitudes.length === 0 ? (
            <Vacio
              titulo="Sin solicitudes"
              descripcion="No existen solicitudes registradas para este paciente."
            />
          ) : (
            historial.solicitudes.map(
              (solicitud) => (
                <SolicitudCard
                  key={solicitud.id}
                  solicitud={solicitud}
                />
              )
            )
          )}
        </View>

        {/* RESULTADOS */}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Resultados clínicos
            </Text>

            <Text style={styles.counter}>
              {historial.resultados.length}
            </Text>
          </View>

          {historial.resultados.length === 0 ? (
            <Vacio
              titulo="Sin resultados"
              descripcion="Todavía no existen resultados registrados para este paciente."
            />
          ) : (
            historial.resultados.map(
              (resultado) => (
                <ResultadoCard
                  key={resultado.id}
                  resultado={resultado}
                  procesando={
                    procesando &&
                    resultadoProcesando === resultado.id
                  }
                  bloqueado={procesando}
                  onVerResultado={() =>
                    consultarResultado(resultado.id)
                  }
                  onVerOrden={() =>
                    consultarOrden(resultado.id)
                  }
                />
              )
            )
          )}
        </View>
      </ScrollView>

      {/* VISTA PREVIA DEL INFORME */}

      <Modal
        visible={informeSeleccionado !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setInformeSeleccionado(null)
        }
      >
        <SafeAreaView style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Informe de resultados clínicos
            </Text>

            <Pressable
              style={styles.closeButton}
              onPress={() =>
                setInformeSeleccionado(null)
              }
            >
              <Text style={styles.closeButtonText}>
                Cerrar
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={
              styles.modalContent
            }
          >
            {informeSeleccionado && (
              <InformeClinicoVista
                informes={
                  informeSeleccionado.informes
                }
              />
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={[
                styles.primaryButton,
                procesando && styles.disabledButton,
              ]}
              disabled={procesando}
              onPress={generarPDFSeleccionado}
            >
              {procesando ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Generar PDF
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ======================================================
// VISTA PREVIA DEL INFORME
// ======================================================

function InformeClinicoVista({
  informes,
}: {
  informes: InformeClinico[];
}) {
  if (!informes.length) {
    return null;
  }

  const principal = informes[0];

  const logo = texto(
    principal.laboratorioLogo,
    ""
  );

  const mostrarLogo =
    logo.startsWith("https://") ||
    logo.startsWith("data:image/");

  return (
    <View style={styles.reportPage}>
      <View style={styles.reportTopBar} />

      {/* DATOS DEL LABORATORIO */}

      <View style={styles.reportLaboratory}>
        {mostrarLogo ? (
          <Image
            source={{ uri: logo }}
            style={styles.reportLogo}
            resizeMode="contain"
          />
        ) : null}

        <View style={{ flex: 1 }}>
          <Text style={styles.reportLaboratoryName}>
            {texto(
              principal.laboratorioNombre,
              "LABORATORIO CLÍNICO"
            )}
          </Text>

          <Text style={styles.reportSmallText}>
            {texto(
              principal.laboratorioDireccion
            )}
          </Text>

          <Text style={styles.reportSmallText}>
            Tel.:{" "}
            {texto(
              principal.laboratorioTelefono
            )}
          </Text>

          <Text style={styles.reportSmallText}>
            {texto(
              principal.laboratorioCorreo
            )}
          </Text>
        </View>
      </View>

      {/* TÍTULO */}

      <View style={styles.reportMainTitle}>
        <Text style={styles.reportMainTitleText}>
          INFORME DE RESULTADOS CLÍNICOS
        </Text>
      </View>

      {/* PACIENTE */}

      <View style={styles.reportTable}>
        <ReportRow
          label1="PACIENTE"
          value1={principal.pacienteNombre}
          label2="EDAD"
          value2={principal.pacienteEdad}
        />

        <ReportRow
          label1="CI"
          value1={principal.pacienteCI}
          label2="SEXO"
          value2={principal.pacienteSexo}
        />

        <ReportRow
          label1="CORREO"
          value1={principal.pacienteCorreo}
          label2="FECHA"
          value2={principal.fechaRegistro}
        />
      </View>

      {/* INFORMACIÓN DE ORDEN */}

      <ReportSectionTitle
        titulo="INFORMACIÓN DE LA ORDEN"
      />

      <View style={styles.reportTable}>
        <ReportRow
          label1="N.º ORDEN"
          value1={principal.numeroOrden}
          label2="N.º MUESTRA"
          value2={principal.numeroMuestra}
        />

        <ReportRow
          label1="REGISTRO"
          value1={principal.fechaRegistro}
          label2="VALIDACIÓN"
          value2={principal.fechaValidacion}
        />

        <ReportRow
          label1="ESTADO"
          value1={principal.estado}
          label2="ANÁLISIS"
          value2={informes.length}
        />
      </View>

      {/* TODOS LOS ANÁLISIS */}

      {informes.map((informe, indice) => (
        <View
          key={`${informe.id}-${indice}`}
          style={styles.reportAnalysis}
        >
          <ReportSectionTitle
            titulo={texto(
              informe.analisisNombre,
              "ANÁLISIS CLÍNICO"
            ).toUpperCase()}
          />

          <View style={styles.reportSampleRow}>
            <Text style={styles.reportSampleText}>
              Muestra:{" "}
              {texto(informe.tipoMuestra)}
            </Text>

            <Text style={styles.reportSampleText}>
              N.º:{" "}
              {texto(informe.numeroMuestra)}
            </Text>

            <Text style={styles.reportSampleText}>
              Toma:{" "}
              {texto(informe.fechaToma)}
            </Text>
          </View>

          {/* ENCABEZADO DE PARÁMETROS */}

          <View style={styles.parametersHeader}>
            <Text
              style={[
                styles.parametersHeaderText,
                { flex: 2 },
              ]}
            >
              PARÁMETRO
            </Text>

            <Text
              style={[
                styles.parametersHeaderText,
                { flex: 1.5 },
              ]}
            >
              RESULTADO
            </Text>

            <Text
              style={[
                styles.parametersHeaderText,
                { flex: 1 },
              ]}
            >
              UNIDAD
            </Text>

            <Text
              style={[
                styles.parametersHeaderText,
                { flex: 1.5 },
              ]}
            >
              REFERENCIA
            </Text>

            <Text
              style={[
                styles.parametersHeaderText,
                { flex: 1 },
              ]}
            >
              OBS.
            </Text>
          </View>

          {/* FILAS DE PARÁMETROS */}

          {Array.isArray(informe.parametros) &&
          informe.parametros.length > 0 ? (
            informe.parametros.map(
              (parametro, parametroIndice) => (
                <View
                  key={`${informe.id}-${parametro.id}-${parametroIndice}`}
                  style={[
                    styles.parameterRow,
                    parametroIndice % 2 === 0 &&
                      styles.parameterRowAlternate,
                  ]}
                >
                  <Text
                    style={[
                      styles.parameterCell,
                      { flex: 2 },
                    ]}
                  >
                    {texto(parametro.nombre)}
                  </Text>

                  <Text
                    style={[
                      styles.parameterCell,
                      { flex: 1.5 },
                    ]}
                  >
                    {texto(
                      parametro.valor,
                      "Sin resultado registrado"
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.parameterCell,
                      { flex: 1 },
                    ]}
                  >
                    {texto(parametro.unidad)}
                  </Text>

                  <Text
                    style={[
                      styles.parameterCell,
                      { flex: 1.5 },
                    ]}
                  >
                    {texto(
                      parametro.referencia,
                      "No configurado"
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.parameterCell,
                      { flex: 1 },
                    ]}
                  >
                    {texto(
                      parametro.observacion
                    )}
                  </Text>
                </View>
              )
            )
          ) : (
            <View style={styles.parameterRow}>
              <Text style={styles.emptyParameterText}>
                No hay parámetros individuales
                disponibles para este resultado.
              </Text>
            </View>
          )}

          {/* OBSERVACIONES */}

          <View style={styles.reportObservations}>
            <Text style={styles.reportBlueLabel}>
              OBSERVACIONES:
            </Text>

            <Text style={styles.reportObservationValue}>
              {texto(informe.observaciones)}
            </Text>
          </View>

          {/* VALIDACIÓN */}

          <View style={styles.reportValidation}>
            <Text style={styles.reportValidationText}>
              Validado por:{" "}
              {texto(
                informe.validadoPorNombre
              )}
            </Text>

            <Text style={styles.reportValidationText}>
              Fecha:{" "}
              {texto(
                informe.fechaValidacion
              )}
            </Text>
          </View>
        </View>
      ))}

      {/* FIN DEL INFORME */}

      <View style={styles.reportEnd}>
        <Text style={styles.reportEndTitle}>
          FIN DEL INFORME
        </Text>

        <Text style={styles.reportEndDescription}>
          Los resultados corresponden a los
          registros validados disponibles.
        </Text>
      </View>

      {/* PIE */}

      <View style={styles.reportFooter}>
        <Text style={styles.reportFooterText}>
          {texto(
            principal.laboratorioNombre
          )}
        </Text>

        <Text style={styles.reportFooterText}>
          Vista previa del informe
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// FILA DE INFORMACIÓN DEL INFORME
// ======================================================

function ReportRow({
  label1,
  value1,
  label2,
  value2,
}: {
  label1: string;
  value1: unknown;
  label2: string;
  value2: unknown;
}) {
  return (
    <View style={styles.reportRow}>
      <View
        style={[
          styles.reportLabelCell,
          { flex: 1.2 },
        ]}
      >
        <Text style={styles.reportLabelText}>
          {label1}
        </Text>
      </View>

      <View
        style={[
          styles.reportValueCell,
          { flex: 2.5 },
        ]}
      >
        <Text style={styles.reportValueText}>
          {texto(value1)}
        </Text>
      </View>

      <View
        style={[
          styles.reportLabelCell,
          { flex: 1.2 },
        ]}
      >
        <Text style={styles.reportLabelText}>
          {label2}
        </Text>
      </View>

      <View
        style={[
          styles.reportValueCell,
          { flex: 2 },
        ]}
      >
        <Text style={styles.reportValueText}>
          {texto(value2)}
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// TÍTULO DE SECCIÓN
// ======================================================

function ReportSectionTitle({
  titulo,
}: {
  titulo: string;
}) {
  return (
    <View style={styles.reportSectionTitle}>
      <Text style={styles.reportSectionTitleText}>
        {titulo}
      </Text>
    </View>
  );
}

// ======================================================
// ESTADÍSTICA
// ======================================================

function Estadistica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>
        {titulo}
      </Text>

      <Text style={styles.statValue}>
        {valor}
      </Text>
    </View>
  );
}

// ======================================================
// SOLICITUD
// ======================================================

function SolicitudCard({
  solicitud,
}: {
  solicitud: SolicitudHistorial;
}) {
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>
            Solicitud{" "}
            {solicitud.solicitudId}
          </Text>

          <Text style={styles.recordDate}>
            {formatearFecha(
              solicitud.fecha
            )}
          </Text>
        </View>

        <Estado valor={solicitud.estado} />
      </View>

      <Text style={styles.recordLabel}>
        ANÁLISIS SOLICITADOS
      </Text>

      {solicitud.analisis.length === 0 ? (
        <Text style={styles.muted}>
          Sin detalle de análisis.
        </Text>
      ) : (
        solicitud.analisis.map(
          (analisis, indice) => (
            <View
              key={`${solicitud.id}-${indice}`}
              style={styles.analysisRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.analysisName}>
                  {analisis.nombre}
                </Text>

                <Text style={styles.analysisMeta}>
                  Cantidad:{" "}
                  {analisis.cantidad}
                </Text>
              </View>

              {analisis.subtotal > 0 && (
                <Text style={styles.analysisPrice}>
                  Bs{" "}
                  {analisis.subtotal.toFixed(2)}
                </Text>
              )}
            </View>
          )
        )
      )}

      {solicitud.total > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total
          </Text>

          <Text style={styles.totalValue}>
            Bs{" "}
            {solicitud.total.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ======================================================
// RESULTADO
// ======================================================

function ResultadoCard({
  resultado,
  onVerResultado,
  onVerOrden,
  procesando,
  bloqueado,
}: {
  resultado: ResultadoHistorial;
  onVerResultado: () => void;
  onVerOrden: () => void;
  procesando: boolean;
  bloqueado: boolean;
}) {
  const finalizado =
    esResultadoFinalizado(
      resultado.estado
    );

  return (
    <View style={styles.resultCard}>
      <View style={styles.recordHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>
            {resultado.analisisNombre}
          </Text>

          <Text style={styles.recordDate}>
            {formatearFecha(
              resultado.fechaRegistro
            )}
          </Text>
        </View>

        <Estado valor={resultado.estado} />
      </View>

      {resultado.solicitudId ? (
        <Text style={styles.referenceText}>
          Solicitud:{" "}
          {resultado.solicitudId}
        </Text>
      ) : null}

      {resultado.valores.length > 0 && (
        <View style={styles.valuesBox}>
          <Text style={styles.recordLabel}>
            VALORES REGISTRADOS
          </Text>

          {resultado.valores.map(
            (valor, indice) => (
              <View
                key={`${resultado.id}-${indice}`}
                style={styles.valueRow}
              >
                <Text style={styles.valueName}>
                  {valor.nombre}
                </Text>

                <Text style={styles.valueText}>
                  {valor.valor || "Sin valor"}
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
        <View style={styles.observationBox}>
          <Text style={styles.recordLabel}>
            OBSERVACIONES
          </Text>

          <Text style={styles.observationText}>
            {resultado.observaciones}
          </Text>
        </View>
      ) : null}

      {finalizado ? (
        <View style={styles.pdfSection}>
          <Text style={styles.pdfTitle}>
            Informes clínicos
          </Text>

          <Pressable
            style={[
              styles.pdfButton,
              bloqueado &&
                styles.disabledButton,
            ]}
            disabled={bloqueado}
            onPress={onVerResultado}
          >
            {procesando ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text style={styles.pdfButtonText}>
                Ver resultado clínico
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.pdfOrderButton,
              bloqueado &&
                styles.disabledButton,
            ]}
            disabled={bloqueado}
            onPress={onVerOrden}
          >
            <Text style={styles.pdfOrderButtonText}>
              Ver informe de la orden completa
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingText}>
            El informe estará disponible
            cuando el resultado sea validado.
          </Text>
        </View>
      )}
    </View>
  );
}

// ======================================================
// ESTADO
// ======================================================

function Estado({
  valor,
}: {
  valor: string;
}) {
  const finalizado =
    esResultadoFinalizado(valor);

  return (
    <View
      style={[
        styles.status,
        finalizado
          ? styles.statusSuccess
          : styles.statusPending,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          finalizado
            ? styles.statusSuccessText
            : styles.statusPendingText,
        ]}
      >
        {valor || "Pendiente"}
      </Text>
    </View>
  );
}

// ======================================================
// VACÍO
// ======================================================

function Vacio({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>
        {titulo}
      </Text>

      <Text style={styles.emptyText}>
        {descripcion}
      </Text>
    </View>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loadingPage: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 20,
  },

  loadingText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  header: {
    marginBottom: 22,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    marginBottom: 16,
  },

  backText: {
    fontSize: 15,
    color: "#2563EB",
    fontWeight: "700",
  },

  eyebrow: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "800",
    letterSpacing: 1,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
  },

  subtitle: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 21,
    marginTop: 8,
  },

  patientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  avatarText: {
    fontSize: 23,
    fontWeight: "800",
    color: "#1D4ED8",
  },

  patientInfo: {
    flex: 1,
  },

  patientName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 5,
  },

  patientMeta: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  statLabel: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "800",
    textAlign: "center",
  },

  statValue: {
    fontSize: 23,
    fontWeight: "800",
    color: "#1D4ED8",
    marginTop: 6,
  },

  section: {
    marginBottom: 24,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  counter: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: "hidden",
  },

  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  recordHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 8,
  },

  recordTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  recordDate: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  recordLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 10,
    letterSpacing: 0.5,
  },

  muted: {
    color: "#94A3B8",
    fontSize: 13,
  },

  analysisRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  analysisName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },

  analysisMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },

  analysisPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },

  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },

  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  status: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 110,
  },

  statusSuccess: {
    backgroundColor: "#DCFCE7",
  },

  statusPending: {
    backgroundColor: "#FEF3C7",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  statusSuccessText: {
    color: "#166534",
  },

  statusPendingText: {
    color: "#92400E",
  },

  referenceText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
  },

  valuesBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 10,
  },

  valueName: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },

  valueText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "800",
  },

  observationBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  observationText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },

  pdfSection: {
    marginTop: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  pdfTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },

  pdfButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  pdfButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  pdfOrderButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  pdfOrderButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.5,
  },

  pendingBox: {
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },

  pendingText: {
    color: "#92400E",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },

  // ====================================================
  // MODAL
  // ====================================================

  modalPage: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  modalHeader: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },

  closeButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginLeft: 10,
  },

  closeButtonText: {
    color: "#1E3A5F",
    fontSize: 12,
    fontWeight: "700",
  },

  modalContent: {
    padding: 12,
    paddingBottom: 30,
  },

  modalFooter: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  // ====================================================
  // INFORME CLÍNICO
  // ====================================================

  reportPage: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  reportTopBar: {
    height: 9,
    backgroundColor: "#2563EB",
    marginBottom: 14,
  },

  reportLaboratory: {
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#DCE5F0",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  reportLogo: {
    width: 70,
    height: 85,
    marginRight: 14,
  },

  reportLaboratoryName: {
    color: "#2563EB",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },

  reportSmallText: {
    color: "#475569",
    fontSize: 10,
    lineHeight: 15,
  },

  reportMainTitle: {
    backgroundColor: "#2563EB",
    borderRadius: 7,
    paddingVertical: 13,
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: "center",
  },

  reportMainTitleText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  reportTable: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#DCE5F0",
  },

  reportRow: {
    flexDirection: "row",
    minHeight: 38,
  },

  reportLabelCell: {
    backgroundColor: "#EEF1F7",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#DCE5F0",
    justifyContent: "center",
    padding: 5,
  },

  reportValueCell: {
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#DCE5F0",
    justifyContent: "center",
    padding: 5,
  },

  reportLabelText: {
    color: "#263445",
    fontSize: 8,
    fontWeight: "800",
  },

  reportValueText: {
    color: "#334155",
    fontSize: 9,
  },

  reportSectionTitle: {
    backgroundColor: "#EAF2F8",
    borderLeftWidth: 8,
    borderLeftColor: "#2563EB",
    borderRadius: 3,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 20,
    marginBottom: 12,
  },

  reportSectionTitleText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "800",
  },

  reportAnalysis: {
    marginTop: 10,
  },

  reportSampleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginVertical: 10,
  },

  reportSampleText: {
    flex: 1,
    color: "#64748B",
    fontSize: 8,
  },

  parametersHeader: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },

  parametersHeaderText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 2,
  },

  parameterRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#DCE5F0",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#DCE5F0",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },

  parameterRowAlternate: {
    backgroundColor: "#F4F7FB",
  },

  parameterCell: {
    color: "#334155",
    fontSize: 8,
    textAlign: "center",
    paddingHorizontal: 2,
  },

  emptyParameterText: {
    color: "#64748B",
    fontSize: 10,
    textAlign: "center",
    flex: 1,
  },

  reportObservations: {
    marginTop: 15,
    marginBottom: 26,
  },

  reportBlueLabel: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
  },

  reportObservationValue: {
    color: "#475569",
    fontSize: 10,
    marginTop: 5,
  },

  reportValidation: {
    borderTopWidth: 1,
    borderTopColor: "#DCE5F0",
    paddingTop: 12,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  reportValidationText: {
    color: "#64748B",
    fontSize: 8,
    flex: 1,
  },

  reportEnd: {
    borderTopWidth: 2,
    borderTopColor: "#2563EB",
    marginTop: 40,
    paddingTop: 20,
    alignItems: "center",
  },

  reportEndTitle: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
  },

  reportEndDescription: {
    color: "#64748B",
    fontSize: 8,
    textAlign: "center",
    marginTop: 10,
  },

  reportFooter: {
    borderTopWidth: 1,
    borderTopColor: "#DCE5F0",
    marginTop: 60,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  reportFooterText: {
    color: "#64748B",
    fontSize: 8,
  },
});