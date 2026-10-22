import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

type UsuarioActual = {
  uid: string;
  laboratorioId: string;
};

type Muestra = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  codigoEtiqueta: string;
  tipo: string;
  estado: string;
  estadoValidacion: string;
  aceptada: boolean;
};

type Paciente = {
  id: string;
  nombre: string;
  ci: string;
};

type Resultado = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  valorResultado: string;
  unidad: string;
  observaciones: string;
  estado: string;
  validado: boolean;
  fechaRegistro: unknown;
};

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor: unknown): string {
  return texto(valor).toLowerCase();
}

function obtenerError(error: unknown): string {
  const codigo = (
    error as { code?: string }
  )?.code;

  if (
    codigo === "permission-denied" ||
    codigo === "firestore/permission-denied"
  ) {
    return (
      "Firestore rechazó la operación. " +
      "Comprueba los permisos del bioquímico, " +
      "el laboratorio y el estado de la muestra."
    );
  }

  if (
    codigo === "unavailable" ||
    codigo === "firestore/unavailable"
  ) {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

function mostrarMensaje(
  titulo: string,
  mensaje: string
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }

    return;
  }

  Alert.alert(titulo, mensaje);
}

function convertirFecha(valor: unknown): string {
  if (!valor) {
    return "-";
  }

  try {
    if (
      typeof valor === "object" &&
      valor !== null &&
      "toDate" in valor &&
      typeof valor.toDate === "function"
    ) {
      return valor.toDate().toLocaleString("es-BO");
    }

    if (valor instanceof Date) {
      return valor.toLocaleString("es-BO");
    }

    if (
      typeof valor === "string" ||
      typeof valor === "number"
    ) {
      const fecha = new Date(valor);

      if (!Number.isNaN(fecha.getTime())) {
        return fecha.toLocaleString("es-BO");
      }
    }
  } catch {
    return "-";
  }

  return "-";
}

function convertirMuestra(
  id: string,
  datos: Record<string, any>
): Muestra {
  const estado = normalizar(datos.estado);

  const estadoValidacion = normalizar(
    datos.estadoValidacion
  );

  const validacionAceptada =
    estadoValidacion === "aceptada" ||
    (
      !estadoValidacion &&
      ["aceptada", "en_proceso", "procesada"].includes(
        estado
      )
    );

  return {
    id,

    muestraId:
      texto(datos.muestraId) || id,

    laboratorioId:
      texto(datos.laboratorioId),

    pacienteId:
      texto(datos.pacienteId),

    ordenId:
      texto(datos.ordenId),

    analisisId:
      texto(datos.analisisId),

    analisisNombre:
      texto(datos.analisisNombre) ||
      texto(datos.nombreAnalisis) ||
      "Análisis",

    codigoEtiqueta:
      texto(datos.codigoEtiqueta) ||
      texto(datos.codigoMuestra) ||
      id,

    tipo:
      texto(datos.tipoMuestra) ||
      texto(datos.tipo) ||
      "No especificado",

    estado,

    estadoValidacion:
      estadoValidacion ||
      (
        validacionAceptada
          ? "aceptada"
          : "pendiente"
      ),

    aceptada:
      datos.aceptada === true ||
      (
        datos.aceptada !== false &&
        validacionAceptada
      ),
  };
}

function convertirResultado(
  id: string,
  datos: Record<string, any>
): Resultado {
  return {
    id,

    muestraId:
      texto(datos.muestraId),

    laboratorioId:
      texto(datos.laboratorioId),

    pacienteId:
      texto(datos.pacienteId),

    ordenId:
      texto(datos.ordenId),

    analisisId:
      texto(datos.analisisId),

    analisisNombre:
      texto(datos.analisisNombre) ||
      "Análisis",

    valorResultado:
      texto(datos.valorResultado),

    unidad:
      texto(datos.unidad),

    observaciones:
      texto(datos.observaciones),

    estado:
      normalizar(datos.estado) ||
      "borrador",

    validado:
      datos.validado === true ||
      normalizar(datos.estado) === "validado",

    fechaRegistro:
      datos.fechaRegistro || null,
  };
}

async function obtenerUsuarioActual(): Promise<UsuarioActual> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "Debes iniciar sesión para registrar resultados."
    );
  }

  const usuarioSnap = await getDoc(
    doc(db, "usuarios", firebaseUser.uid)
  );

  if (!usuarioSnap.exists()) {
    throw new Error(
      "No se encontró tu usuario en Firestore."
    );
  }

  const datos = usuarioSnap.data();

  if (datos.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  const rol = normalizar(datos.rol);

  if (
    rol !== "bioquimico" &&
    rol !== "bioquímico"
  ) {
    throw new Error(
      "Este módulo está disponible únicamente para bioquímicos."
    );
  }

  const laboratorioId = texto(
    datos.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene laboratorio asignado."
    );
  }

  return {
    uid: firebaseUser.uid,
    laboratorioId,
  };
}

export default function RegistroResultados() {
  const router = useRouter();

  const scrollRef = useRef<ScrollView>(null);

  const [posicionFormulario, setPosicionFormulario] =
    useState(0);

  const [usuario, setUsuario] =
    useState<UsuarioActual | null>(null);

  const [muestras, setMuestras] =
    useState<Muestra[]>([]);

  const [pacientes, setPacientes] = useState<
    Record<string, Paciente>
  >({});

  const [resultados, setResultados] =
    useState<Resultado[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [busqueda, setBusqueda] =
    useState("");

  const [
    muestraSeleccionada,
    setMuestraSeleccionada,
  ] = useState<Muestra | null>(null);

  const [
    resultadoSeleccionado,
    setResultadoSeleccionado,
  ] = useState<Resultado | null>(null);

  const [
    valorResultado,
    setValorResultado,
  ] = useState("");

  const [unidad, setUnidad] =
    useState("");

  const [
    observaciones,
    setObservaciones,
  ] = useState("");

  const [error, setError] =
    useState("");

  const cargarDatos = useCallback(
    async (mostrarCarga = true): Promise<void> => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        setError("");

        const usuarioActual =
          await obtenerUsuarioActual();

        setUsuario(usuarioActual);

        const consultaMuestras = query(
          collection(db, "muestras"),
          where(
            "laboratorioId",
            "==",
            usuarioActual.laboratorioId
          )
        );

        const consultaPacientes = query(
          collection(db, "pacientes"),
          where(
            "laboratorioId",
            "==",
            usuarioActual.laboratorioId
          )
        );

        const consultaResultados = query(
          collection(db, "resultados"),
          where(
            "laboratorioId",
            "==",
            usuarioActual.laboratorioId
          )
        );

        const [
          muestrasSnap,
          pacientesSnap,
          resultadosSnap,
        ] = await Promise.all([
          getDocs(consultaMuestras),
          getDocs(consultaPacientes),
          getDocs(consultaResultados),
        ]);

        const listaMuestras =
          muestrasSnap.docs.map((documento) =>
            convertirMuestra(
              documento.id,
              documento.data()
            )
          );

        const mapaPacientes: Record<
          string,
          Paciente
        > = {};

        pacientesSnap.docs.forEach(
          (documento) => {
            const datos = documento.data();

            const nombres = texto(
              datos.nombres ||
              datos.nombre
            );

            const apellidos = texto(
              datos.apellidos ||
              datos.apellido
            );

            mapaPacientes[documento.id] = {
              id: documento.id,

              nombre:
                [nombres, apellidos]
                  .filter(Boolean)
                  .join(" ") ||
                "Paciente",

              ci: texto(
                datos.ci ||
                datos.carnet ||
                datos.numeroDocumento
              ),
            };
          }
        );

        const listaResultados =
          resultadosSnap.docs.map((documento) =>
            convertirResultado(
              documento.id,
              documento.data()
            )
          );

        listaResultados.sort((a, b) =>
          a.analisisNombre.localeCompare(
            b.analisisNombre
          )
        );

        setMuestras(listaMuestras);
        setPacientes(mapaPacientes);
        setResultados(listaResultados);
      } catch (e: unknown) {
        const mensaje = obtenerError(e);

        setError(mensaje);
        setMuestras([]);
        setPacientes({});
        setResultados([]);
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    []
  );

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const actualizar = async (): Promise<void> => {
    if (actualizando) {
      return;
    }

    setActualizando(true);

    await cargarDatos(false);
  };

  const irAlFormulario = (): void => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(
          0,
          posicionFormulario - 20
        ),
        animated: true,
      });
    }, 200);
  };

  const seleccionarMuestra = (
    muestra: Muestra
  ): void => {
    const resultadoExistente =
      resultados.find(
        (resultado) =>
          resultado.muestraId === muestra.id
      );

    if (
      resultadoExistente?.validado ||
      resultadoExistente?.estado ===
        "validado"
    ) {
      mostrarMensaje(
        "Resultado validado",
        "Este resultado ya fue validado y no puede modificarse."
      );

      return;
    }

    setMuestraSeleccionada(muestra);

    if (resultadoExistente) {
      setResultadoSeleccionado(
        resultadoExistente
      );

      setValorResultado(
        resultadoExistente.valorResultado
      );

      setUnidad(
        resultadoExistente.unidad
      );

      setObservaciones(
        resultadoExistente.observaciones
      );
    } else {
      setResultadoSeleccionado(null);
      setValorResultado("");
      setUnidad("");
      setObservaciones("");
    }

    irAlFormulario();
  };

  const limpiarFormulario = (): void => {
    setMuestraSeleccionada(null);
    setResultadoSeleccionado(null);
    setValorResultado("");
    setUnidad("");
    setObservaciones("");
  };

  const guardarResultado =
    async (): Promise<void> => {
      if (guardando) {
        return;
      }

      try {
        const usuarioActual =
          await obtenerUsuarioActual();

        if (!muestraSeleccionada) {
          throw new Error(
            "Selecciona una muestra."
          );
        }

        const valor =
          valorResultado.trim();

        if (!valor) {
          throw new Error(
            "Debes ingresar el valor del resultado."
          );
        }

        if (
          muestraSeleccionada.estado !==
          "procesada"
        ) {
          throw new Error(
            "La muestra debe estar procesada antes de registrar resultados."
          );
        }

        if (
          !muestraSeleccionada.aceptada ||
          muestraSeleccionada.estadoValidacion !==
            "aceptada"
        ) {
          throw new Error(
            "La muestra debe estar aceptada."
          );
        }

        if (
          resultadoSeleccionado?.validado ||
          resultadoSeleccionado?.estado ===
            "validado"
        ) {
          throw new Error(
            "El resultado ya está validado y no puede modificarse."
          );
        }

        setGuardando(true);

        const muestraId =
          muestraSeleccionada.id;

        const muestraRef = doc(
          db,
          "muestras",
          muestraId
        );

        const resultadoExistente =
          resultados.find(
            (resultado) =>
              resultado.muestraId ===
              muestraId
          );

        const resultadoRef = doc(
          db,
          "resultados",
          resultadoExistente?.id ||
            muestraId
        );

        await runTransaction(
          db,
          async (transaccion) => {
            const muestraSnap =
              await transaccion.get(
                muestraRef
              );

            const resultadoSnap =
              await transaccion.get(
                resultadoRef
              );

            if (!muestraSnap.exists()) {
              throw new Error(
                "La muestra ya no existe."
              );
            }

            const datosMuestra =
              muestraSnap.data();

            if (
              texto(
                datosMuestra.laboratorioId
              ) !==
              usuarioActual.laboratorioId
            ) {
              throw new Error(
                "La muestra pertenece a otro laboratorio."
              );
            }

            if (
              normalizar(
                datosMuestra.estado
              ) !== "procesada"
            ) {
              throw new Error(
                "La muestra todavía no está procesada."
              );
            }

            const estadoValidacion =
              normalizar(
                datosMuestra.estadoValidacion
              );

            if (
              datosMuestra.aceptada ===
                false ||
              (
                estadoValidacion !== "" &&
                estadoValidacion !==
                  "aceptada"
              )
            ) {
              throw new Error(
                "La muestra no fue aceptada."
              );
            }

            if (
              resultadoSnap.exists()
            ) {
              const datosResultado =
                resultadoSnap.data();

              if (
                texto(
                  datosResultado.laboratorioId
                ) !==
                usuarioActual.laboratorioId
              ) {
                throw new Error(
                  "El resultado pertenece a otro laboratorio."
                );
              }

              if (
                datosResultado.validado ===
                  true ||
                normalizar(
                  datosResultado.estado
                ) === "validado"
              ) {
                throw new Error(
                  "El resultado ya fue validado."
                );
              }

              if (
                texto(
                  datosResultado.muestraId
                ) !== muestraId
              ) {
                throw new Error(
                  "El resultado no corresponde a esta muestra."
                );
              }

              transaccion.update(
                resultadoRef,
                {
                  valorResultado: valor,

                  unidad:
                    unidad.trim(),

                  observaciones:
                    observaciones.trim(),

                  estado: "borrador",

                  validado: false,

                  actualizadoPor:
                    usuarioActual.uid,

                  fechaActualizacion:
                    serverTimestamp(),
                }
              );
            } else {
              transaccion.set(
                resultadoRef,
                {
                  laboratorioId:
                    usuarioActual.laboratorioId,

                  muestraId,

                  pacienteId:
                    texto(
                      datosMuestra.pacienteId
                    ),

                  ordenId:
                    texto(
                      datosMuestra.ordenId
                    ),

                  solicitudId:
                    texto(
                      datosMuestra.solicitudId
                    ),

                  analisisId:
                    texto(
                      datosMuestra.analisisId
                    ),

                  analisisNombre:
                    texto(
                      datosMuestra.analisisNombre
                    ) ||
                    muestraSeleccionada.analisisNombre,

                  valorResultado: valor,

                  unidad:
                    unidad.trim(),

                  observaciones:
                    observaciones.trim(),

                  estado: "borrador",

                  validado: false,

                  registradoPor:
                    usuarioActual.uid,

                  fechaRegistro:
                    serverTimestamp(),

                  actualizadoPor:
                    usuarioActual.uid,

                  fechaActualizacion:
                    serverTimestamp(),

                  validadoPor: null,

                  fechaValidacion: null,
                }
              );
            }
          }
        );

        limpiarFormulario();

        await cargarDatos(false);

        mostrarMensaje(
          "Resultado guardado",
          "El resultado se registró correctamente en estado borrador."
        );
      } catch (e: unknown) {
        mostrarMensaje(
          "No se pudo guardar",
          obtenerError(e)
        );
      } finally {
        setGuardando(false);
      }
    };

  const muestrasProcesadas = useMemo(
    () =>
      muestras.filter(
        (muestra) =>
          muestra.estado ===
            "procesada" &&
          muestra.aceptada &&
          muestra.estadoValidacion ===
            "aceptada"
      ),
    [muestras]
  );

  const muestrasFiltradas = useMemo(() => {
    const termino =
      busqueda.trim().toLowerCase();

    return muestrasProcesadas.filter(
      (muestra) => {
        const paciente =
          pacientes[muestra.pacienteId];

        const contenido = [
          muestra.codigoEtiqueta,
          muestra.muestraId,
          muestra.ordenId,
          muestra.analisisNombre,
          muestra.tipo,
          paciente?.nombre || "",
          paciente?.ci || "",
        ]
          .join(" ")
          .toLowerCase();

        return contenido.includes(
          termino
        );
      }
    );
  }, [
    muestrasProcesadas,
    pacientes,
    busqueda,
  ]);

  const resultadosPorMuestra = useMemo(() => {
    const mapa: Record<
      string,
      Resultado
    > = {};

    resultados.forEach(
      (resultado) => {
        if (resultado.muestraId) {
          mapa[resultado.muestraId] =
            resultado;
        }
      }
    );

    return mapa;
  }, [resultados]);

  const pendientes = useMemo(
    () =>
      muestrasProcesadas.filter(
        (muestra) =>
          !resultadosPorMuestra[
            muestra.id
          ]
      ).length,
    [
      muestrasProcesadas,
      resultadosPorMuestra,
    ]
  );

  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator
          size="large"
          color="#19385F"
        />

        <Text
          style={styles.textoCargando}
        >
          Cargando registro de resultados...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.contenedor}
      contentContainerStyle={
        styles.contenido
      }
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => {
            void actualizar();
          }}
          tintColor="#2563EB"
          colors={["#2563EB"]}
        />
      }
    >
      <View style={styles.encabezado}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>
            Registro de resultados
          </Text>

          <Text style={styles.subtitulo}>
            Registra los resultados de las
            muestras que finalizaron su
            procesamiento.
          </Text>
        </View>

        <Pressable
          style={styles.botonVolver}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={styles.textoVolver}
          >
            Volver
          </Text>
        </Pressable>
      </View>

      <View style={styles.contadores}>
        <View style={styles.contador}>
          <Text
            style={styles.contadorTitulo}
          >
            Muestras procesadas
          </Text>

          <Text
            style={styles.contadorNumero}
          >
            {muestrasProcesadas.length}
          </Text>
        </View>

        <View style={styles.contador}>
          <Text
            style={styles.contadorTitulo}
          >
            Resultados registrados
          </Text>

          <Text
            style={styles.contadorNumero}
          >
            {resultados.length}
          </Text>
        </View>

        <View style={styles.contador}>
          <Text
            style={styles.contadorTitulo}
          >
            Resultados pendientes
          </Text>

          <Text
            style={styles.contadorNumero}
          >
            {pendientes}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.etiqueta}>
          Buscar muestra procesada
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Paciente, CI, análisis, orden o etiqueta"
          placeholderTextColor="#94A3B8"
          value={busqueda}
          onChangeText={setBusqueda}
        />

        <Pressable
          style={styles.botonActualizar}
          disabled={actualizando}
          onPress={() => {
            void actualizar();
          }}
        >
          {actualizando ? (
            <ActivityIndicator
              color="#19385F"
            />
          ) : (
            <Text
              style={
                styles.textoActualizar
              }
            >
              Actualizar
            </Text>
          )}
        </Pressable>
      </View>

      {error !== "" && (
        <View
          style={styles.errorCaja}
        >
          <Text
            style={styles.errorTexto}
          >
            {error}
          </Text>

          <Pressable
            style={styles.botonActualizar}
            onPress={() => {
              void cargarDatos();
            }}
          >
            <Text
              style={
                styles.textoActualizar
              }
            >
              Reintentar
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.panel}>
        <Text
          style={styles.seccionTitulo}
        >
          Muestras disponibles
        </Text>

        {muestrasFiltradas.length ===
        0 ? (
          <Text
            style={styles.textoVacio}
          >
            No hay muestras procesadas
            disponibles. Primero debes
            finalizar el procesamiento
            desde Seguimiento de muestras.
          </Text>
        ) : (
          muestrasFiltradas.map(
            (muestra) => {
              const paciente =
                pacientes[
                  muestra.pacienteId
                ];

              const resultado =
                resultadosPorMuestra[
                  muestra.id
                ];

              const validado =
                resultado?.validado ||
                resultado?.estado ===
                  "validado";

              return (
                <View
                  key={muestra.id}
                  style={styles.tarjeta}
                >
                  <Text
                    style={
                      styles.nombreAnalisis
                    }
                  >
                    {muestra.analisisNombre}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Paciente:{" "}
                    {paciente?.nombre ||
                      "Sin identificar"}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    CI:{" "}
                    {paciente?.ci ||
                      "-"}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Etiqueta:{" "}
                    {muestra.codigoEtiqueta}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Orden:{" "}
                    {muestra.ordenId ||
                      "-"}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Estado de muestra:
                    Procesada
                  </Text>

                  <Text
                    style={[
                      styles.estadoResultado,
                      {
                        color: validado
                          ? "#059669"
                          : resultado
                          ? "#D97706"
                          : "#64748B",
                      },
                    ]}
                  >
                    {validado
                      ? "Resultado validado"
                      : resultado
                      ? "Resultado en borrador"
                      : "Sin resultado"}
                  </Text>

                  <Pressable
                    style={[
                      styles.botonSeleccionar,
                      validado &&
                        styles.botonDeshabilitado,
                    ]}
                    disabled={
                      Boolean(validado)
                    }
                    onPress={() =>
                      seleccionarMuestra(
                        muestra
                      )
                    }
                  >
                    <Text
                      style={
                        styles.textoBoton
                      }
                    >
                      {validado
                        ? "Resultado validado"
                        : resultado
                        ? "Editar resultado"
                        : "Registrar resultado"}
                    </Text>
                  </Pressable>
                </View>
              );
            }
          )
        )}
      </View>

      {muestraSeleccionada && (
        <View
          style={styles.panel}
          onLayout={(evento) => {
            const posicion =
              evento.nativeEvent.layout.y;

            setPosicionFormulario(
              posicion
            );

            scrollRef.current?.scrollTo({
              y: Math.max(
                0,
                posicion - 20
              ),
              animated: true,
            });
          }}
        >
          <View
            style={styles.filaTitulo}
          >
            <Text
              style={
                styles.seccionTitulo
              }
            >
              {resultadoSeleccionado
                ? "Editar resultado"
                : "Nuevo resultado"}
            </Text>

            <Pressable
              onPress={
                limpiarFormulario
              }
            >
              <Text
                style={styles.cerrar}
              >
                Cerrar
              </Text>
            </Pressable>
          </View>

          <Text style={styles.dato}>
            Análisis:{" "}
            {
              muestraSeleccionada.analisisNombre
            }
          </Text>

          <Text style={styles.dato}>
            Paciente:{" "}
            {pacientes[
              muestraSeleccionada.pacienteId
            ]?.nombre ||
              "Sin identificar"}
          </Text>

          <Text style={styles.dato}>
            Código:{" "}
            {
              muestraSeleccionada.codigoEtiqueta
            }
          </Text>

          <Text style={styles.etiqueta}>
            Valor del resultado *
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ejemplo: 12.5"
            placeholderTextColor="#94A3B8"
            value={valorResultado}
            onChangeText={
              setValorResultado
            }
            editable={!guardando}
          />

          <Text style={styles.etiqueta}>
            Unidad
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ejemplo: g/dL"
            placeholderTextColor="#94A3B8"
            value={unidad}
            onChangeText={setUnidad}
            editable={!guardando}
          />

          <Text style={styles.etiqueta}>
            Observaciones
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.inputObservaciones,
            ]}
            placeholder="Observaciones del análisis"
            placeholderTextColor="#94A3B8"
            value={observaciones}
            onChangeText={
              setObservaciones
            }
            editable={!guardando}
            multiline
          />

          <Pressable
            style={[
              styles.botonGuardar,
              guardando &&
                styles.botonDeshabilitado,
            ]}
            disabled={guardando}
            onPress={() => {
              void guardarResultado();
            }}
          >
            {guardando ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={styles.textoBoton}
              >
                Guardar resultado
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.panel}>
        <Text
          style={styles.seccionTitulo}
        >
          Resultados registrados
        </Text>

        {resultados.length === 0 ? (
          <Text
            style={styles.textoVacio}
          >
            Todavía no existen resultados
            registrados.
          </Text>
        ) : (
          resultados.map(
            (resultado) => {
              const paciente =
                pacientes[
                  resultado.pacienteId
                ];

              return (
                <View
                  key={resultado.id}
                  style={styles.tarjeta}
                >
                  <Text
                    style={
                      styles.nombreAnalisis
                    }
                  >
                    {
                      resultado.analisisNombre
                    }
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Paciente:{" "}
                    {paciente?.nombre ||
                      "Sin identificar"}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    CI:{" "}
                    {paciente?.ci ||
                      "-"}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Valor:{" "}
                    {
                      resultado.valorResultado
                    }
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Unidad:{" "}
                    {resultado.unidad ||
                      "-"}
                  </Text>

                  <Text
                    style={styles.dato}
                  >
                    Fecha:{" "}
                    {convertirFecha(
                      resultado.fechaRegistro
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.estadoResultado,
                      {
                        color:
                          resultado.validado
                            ? "#059669"
                            : "#D97706",
                      },
                    ]}
                  >
                    {resultado.validado
                      ? "Validado"
                      : "Borrador"}
                  </Text>
                </View>
              );
            }
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  contenido: {
    padding: 20,
    paddingBottom: 50,
  },

  cargando: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7FB",
  },

  textoCargando: {
    marginTop: 12,
    color: "#64748B",
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },

  titulo: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#19385F",
  },

  subtitulo: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 6,
  },

  botonVolver: {
    backgroundColor: "#334155",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
  },

  textoVolver: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  contador: {
    flexGrow: 1,
    minWidth: 160,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  contadorNumero: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#19385F",
    marginTop: 8,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },

  etiqueta: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 13,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    marginBottom: 10,
  },

  inputObservaciones: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  botonActualizar: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 10,
  },

  textoActualizar: {
    color: "#19385F",
    fontWeight: "600",
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 15,
  },

  tarjeta: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },

  nombreAnalisis: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 10,
  },

  dato: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 7,
  },

  estadoResultado: {
    fontSize: 14,
    fontWeight: "bold",
    marginVertical: 10,
  },

  botonSeleccionar: {
    backgroundColor: "#2563EB",
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 10,
  },

  botonGuardar: {
    backgroundColor: "#059669",
    padding: 15,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 15,
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },

  textoVacio: {
    color: "#64748B",
    fontSize: 14,
    paddingVertical: 15,
  },

  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cerrar: {
    color: "#DC2626",
    fontWeight: "bold",
  },

  errorCaja: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 15,
    marginBottom: 18,
  },

  errorTexto: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 10,
  },
});