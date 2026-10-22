import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
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
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

type EstadoMuestra =
  | "tomada"
  | "aceptada"
  | "rechazada"
  | "en_proceso"
  | "procesada";

type EstadoValidacion =
  | "pendiente"
  | "aceptada"
  | "rechazada";

type Muestra = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  ordenId: string;
  solicitudId: string;
  pacienteId: string;
  analisisId: string;
  analisisNombre: string;
  codigoEtiqueta: string;
  tipo: string;
  estado: EstadoMuestra;
  estadoValidacion: EstadoValidacion;
  aceptada: boolean;
  motivoRechazo: string;
  observaciones: string;
  registradoPor: string;
  validadoPor: string;
  actualizadoPor: string;
  fechaToma: unknown;
  fechaValidacion: unknown;
  fechaInicioProcesamiento: unknown;
  fechaFinProcesamiento: unknown;
  fechaActualizacion: unknown;
  historialEstados: HistorialEstado[];
};

type HistorialEstado = {
  estado: string;
  usuarioId: string;
  fecha: unknown;
};

type Paciente = {
  nombre: string;
  ci: string;
};

type Usuario = {
  uid: string;
  laboratorioId: string;
  rol: string;
};

type FiltroEstado =
  | "todos"
  | "tomada"
  | "aceptada"
  | "rechazada"
  | "en_proceso"
  | "procesada";

const FILTROS: {
  valor: FiltroEstado;
  nombre: string;
}[] = [
  { valor: "todos", nombre: "Todas" },
  { valor: "tomada", nombre: "Tomadas" },
  { valor: "aceptada", nombre: "Aceptadas" },
  { valor: "en_proceso", nombre: "En proceso" },
  { valor: "procesada", nombre: "Procesadas" },
  { valor: "rechazada", nombre: "Rechazadas" },
];

const ORDEN_ESTADOS: EstadoMuestra[] = [
  "aceptada",
  "en_proceso",
  "tomada",
  "procesada",
  "rechazada",
];

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function obtenerEstado(valor: unknown): EstadoMuestra {
  const estado = normalizar(valor);

  if (
    estado === "tomada" ||
    estado === "aceptada" ||
    estado === "rechazada" ||
    estado === "en_proceso" ||
    estado === "procesada"
  ) {
    return estado;
  }

  return "tomada";
}

function obtenerEstadoValidacion(
  valor: unknown,
  estado: EstadoMuestra
): EstadoValidacion {
  const validacion = normalizar(valor);

  if (
    validacion === "aceptada" ||
    validacion === "rechazada" ||
    validacion === "pendiente"
  ) {
    return validacion;
  }

  if (estado === "rechazada") {
    return "rechazada";
  }

  if (
    estado === "aceptada" ||
    estado === "en_proceso" ||
    estado === "procesada"
  ) {
    return "aceptada";
  }

  return "pendiente";
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

function confirmarAccion(
  titulo: string,
  mensaje: string,
  accion: () => void
): void {
  if (Platform.OS === "web") {
    if (
      typeof window !== "undefined" &&
      window.confirm(`${titulo}\n\n${mensaje}`)
    ) {
      accion();
    }

    return;
  }

  Alert.alert(titulo, mensaje, [
    {
      text: "Cancelar",
      style: "cancel",
    },
    {
      text: "Confirmar",
      onPress: accion,
    },
  ]);
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

function mostrarFecha(valor: unknown): string {
  if (!valor) {
    return "No registrada";
  }

  try {
    if (
      typeof valor === "object" &&
      valor !== null &&
      "toDate" in valor &&
      typeof valor.toDate === "function"
    ) {
      const fecha = valor.toDate();

      if (fecha instanceof Date) {
        return fecha.toLocaleString("es-BO");
      }
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
    return "No registrada";
  }

  return "No registrada";
}

function nombreEstado(estado: string): string {
  const nombres: Record<string, string> = {
    tomada: "Tomada",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    en_proceso: "En proceso",
    procesada: "Procesada",
  };

  return nombres[estado] || estado || "Sin estado";
}

function colorEstado(estado: string): string {
  const colores: Record<string, string> = {
    tomada: "#D97706",
    aceptada: "#2563EB",
    rechazada: "#DC2626",
    en_proceso: "#7C3AED",
    procesada: "#059669",
  };

  return colores[estado] || "#64748B";
}

function convertirMuestra(
  id: string,
  datos: Record<string, any>
): Muestra {
  const estado = obtenerEstado(datos.estado);

  const estadoValidacion = obtenerEstadoValidacion(
    datos.estadoValidacion,
    estado
  );

  const aceptada =
    datos.aceptada === true ||
    (
      datos.aceptada !== false &&
      estadoValidacion === "aceptada"
    );

  return {
    id,

    muestraId: texto(datos.muestraId) || id,

    laboratorioId: texto(datos.laboratorioId),

    ordenId: texto(datos.ordenId),

    solicitudId: texto(datos.solicitudId),

    pacienteId: texto(datos.pacienteId),

    analisisId: texto(datos.analisisId),

    analisisNombre:
      texto(datos.analisisNombre) ||
      texto(datos.nombreAnalisis) ||
      "Análisis",

    codigoEtiqueta:
      texto(datos.codigoEtiqueta) ||
      texto(datos.codigoMuestra) ||
      texto(datos.codigo) ||
      id,

    tipo:
      texto(datos.tipoMuestra) ||
      texto(datos.tipo) ||
      "No especificado",

    estado,

    estadoValidacion,

    aceptada,

    motivoRechazo: texto(datos.motivoRechazo),

    observaciones: texto(datos.observaciones),

    registradoPor: texto(datos.registradoPor),

    validadoPor: texto(datos.validadoPor),

    actualizadoPor: texto(datos.actualizadoPor),

    fechaToma:
      datos.fechaToma ||
      datos.fechaRegistro ||
      null,

    fechaValidacion:
      datos.fechaValidacion || null,

    fechaInicioProcesamiento:
      datos.fechaInicioProcesamiento || null,

    fechaFinProcesamiento:
      datos.fechaFinProcesamiento || null,

    fechaActualizacion:
      datos.fechaActualizacion || null,

    historialEstados: Array.isArray(
      datos.historialEstados
    )
      ? datos.historialEstados
      : [],
  };
}

async function obtenerUsuarioActual(): Promise<Usuario> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "Debes iniciar sesión para acceder al seguimiento."
    );
  }

  const usuarioSnap = await getDoc(
    doc(db, "usuarios", firebaseUser.uid)
  );

  if (!usuarioSnap.exists()) {
    throw new Error(
      "No existe tu usuario en Firestore."
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
      "Esta pantalla corresponde al bioquímico."
    );
  }

  const laboratorioId = texto(
    datos.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene un laboratorio asignado."
    );
  }

  return {
    uid: firebaseUser.uid,
    laboratorioId,
    rol,
  };
}

export default function SeguimientoMuestras() {
  const router = useRouter();

  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [pacientes, setPacientes] = useState<
    Record<string, Paciente>
  >({});

  const [busqueda, setBusqueda] = useState("");

  const [filtro, setFiltro] =
    useState<FiltroEstado>("todos");

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [procesandoId, setProcesandoId] =
    useState("");

  const [detalle, setDetalle] =
    useState<Muestra | null>(null);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [cargandoDetalle, setCargandoDetalle] =
    useState(false);

  const [error, setError] = useState("");

  const cargarDatos = useCallback(
    async (mostrarCarga = true): Promise<void> => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        setError("");

        const usuarioActual =
          await obtenerUsuarioActual();

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

        const [muestrasSnap, pacientesSnap] =
          await Promise.all([
            getDocs(consultaMuestras),
            getDocs(consultaPacientes),
          ]);

        const listaMuestras = muestrasSnap.docs.map(
          (documento) =>
            convertirMuestra(
              documento.id,
              documento.data()
            )
        );

        listaMuestras.sort((a, b) => {
          const posicionA = ORDEN_ESTADOS.indexOf(
            a.estado
          );

          const posicionB = ORDEN_ESTADOS.indexOf(
            b.estado
          );

          return posicionA - posicionB;
        });

        const mapaPacientes: Record<
          string,
          Paciente
        > = {};

        pacientesSnap.docs.forEach((documento) => {
          const datos = documento.data();

          const nombres = texto(
            datos.nombres || datos.nombre
          );

          const apellidos = texto(
            datos.apellidos || datos.apellido
          );

          mapaPacientes[documento.id] = {
            nombre:
              [nombres, apellidos]
                .filter(Boolean)
                .join(" ") || "Paciente",

            ci: texto(
              datos.ci ||
              datos.carnet ||
              datos.numeroDocumento
            ),
          };
        });

        setMuestras(listaMuestras);
        setPacientes(mapaPacientes);

        setDetalle((anterior) => {
          if (!anterior) {
            return null;
          }

          return (
            listaMuestras.find(
              (muestra) =>
                muestra.id === anterior.id
            ) || anterior
          );
        });
      } catch (e: unknown) {
        const mensaje = obtenerError(e);

        setError(mensaje);
        setMuestras([]);
        setPacientes({});
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

  const actualizar = useCallback(async () => {
    if (actualizando) {
      return;
    }

    setActualizando(true);

    await cargarDatos(false);
  }, [actualizando, cargarDatos]);

  const verDetalle = async (
    muestra: Muestra
  ): Promise<void> => {
    if (cargandoDetalle) {
      return;
    }

    try {
      setCargandoDetalle(true);

      const usuarioActual =
        await obtenerUsuarioActual();

      const muestraSnap = await getDoc(
        doc(db, "muestras", muestra.id)
      );

      if (!muestraSnap.exists()) {
        throw new Error(
          "Esta muestra ya no existe."
        );
      }

      const datos = muestraSnap.data();

      if (
        texto(datos.laboratorioId) !==
        usuarioActual.laboratorioId
      ) {
        throw new Error(
          "La muestra pertenece a otro laboratorio."
        );
      }

      setDetalle(
        convertirMuestra(
          muestraSnap.id,
          datos
        )
      );

      setModalVisible(true);
    } catch (e: unknown) {
      mostrarMensaje(
        "No se pudo abrir el detalle",
        obtenerError(e)
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cambiarEstado = async (
    muestra: Muestra,
    nuevoEstado: "en_proceso" | "procesada"
  ): Promise<void> => {
    if (procesandoId) {
      return;
    }

    try {
      setProcesandoId(muestra.id);

      const usuarioActual =
        await obtenerUsuarioActual();

      const muestraRef = doc(
        db,
        "muestras",
        muestra.id
      );

      await runTransaction(
        db,
        async (transaccion) => {
          const muestraSnap =
            await transaccion.get(muestraRef);

          if (!muestraSnap.exists()) {
            throw new Error(
              "La muestra ya no existe."
            );
          }

          const datos = muestraSnap.data();

          if (
            texto(datos.laboratorioId) !==
            usuarioActual.laboratorioId
          ) {
            throw new Error(
              "La muestra pertenece a otro laboratorio."
            );
          }

          const estadoActual = obtenerEstado(
            datos.estado
          );

          const estadoEsperado =
            nuevoEstado === "en_proceso"
              ? "aceptada"
              : "en_proceso";

          if (
            estadoActual !== estadoEsperado
          ) {
            throw new Error(
              `La muestra debe estar en estado "${nombreEstado(
                estadoEsperado
              )}" para realizar esta acción.`
            );
          }

          const estadoValidacion =
            obtenerEstadoValidacion(
              datos.estadoValidacion,
              estadoActual
            );

          if (
            estadoValidacion !== "aceptada" ||
            datos.aceptada === false
          ) {
            throw new Error(
              "La muestra no está aceptada."
            );
          }

          const cambios: Record<string, any> = {
            estado: nuevoEstado,

            estadoValidacion: "aceptada",

            aceptada: true,

            actualizadoPor: usuarioActual.uid,

            fechaActualizacion:
              serverTimestamp(),
          };

          if (
            nuevoEstado === "en_proceso"
          ) {
            cambios.fechaInicioProcesamiento =
              serverTimestamp();
          }

          if (
            nuevoEstado === "procesada"
          ) {
            cambios.fechaFinProcesamiento =
              serverTimestamp();
          }

          const historialAnterior =
            Array.isArray(
              datos.historialEstados
            )
              ? datos.historialEstados
              : [];

          cambios.historialEstados = [
            ...historialAnterior,
            {
              estado: nuevoEstado,
              usuarioId: usuarioActual.uid,
              fecha: Timestamp.now(),
            },
          ];

          transaccion.update(
            muestraRef,
            cambios
          );
        }
      );

      await cargarDatos(false);

      const muestraActualizada =
        await getDoc(muestraRef);

      if (
        muestraActualizada.exists()
      ) {
        setDetalle(
          (anterior) =>
            anterior?.id === muestra.id
              ? convertirMuestra(
                  muestraActualizada.id,
                  muestraActualizada.data()
                )
              : anterior
        );
      }

      mostrarMensaje(
        "Operación exitosa",
        nuevoEstado === "en_proceso"
          ? "Se inició correctamente el procesamiento de la muestra."
          : "La muestra fue marcada como procesada."
      );
    } catch (e: unknown) {
      mostrarMensaje(
        "No se pudo actualizar",
        obtenerError(e)
      );
    } finally {
      setProcesandoId("");
    }
  };

  const iniciarProceso = (
    muestra: Muestra
  ): void => {
    confirmarAccion(
      "Iniciar procesamiento",
      `¿Deseas iniciar el procesamiento de la muestra ${muestra.codigoEtiqueta}?`,
      () => {
        void cambiarEstado(
          muestra,
          "en_proceso"
        );
      }
    );
  };

  const finalizarProceso = (
    muestra: Muestra
  ): void => {
    confirmarAccion(
      "Finalizar procesamiento",
      `¿Deseas marcar la muestra ${muestra.codigoEtiqueta} como procesada?`,
      () => {
        void cambiarEstado(
          muestra,
          "procesada"
        );
      }
    );
  };

  const muestrasFiltradas = useMemo(() => {
    const termino = busqueda
      .trim()
      .toLowerCase();

    return muestras.filter((muestra) => {
      if (
        filtro !== "todos" &&
        muestra.estado !== filtro
      ) {
        return false;
      }

      const paciente =
        pacientes[muestra.pacienteId];

      const contenido = [
        muestra.codigoEtiqueta,
        muestra.muestraId,
        muestra.ordenId,
        muestra.solicitudId,
        muestra.analisisNombre,
        muestra.analisisId,
        muestra.tipo,
        muestra.estado,
        paciente?.nombre || "",
        paciente?.ci || "",
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(termino);
    });
  }, [
    muestras,
    pacientes,
    busqueda,
    filtro,
  ]);

  const contadores = useMemo(() => {
    return {
      total: muestras.length,

      tomadas: muestras.filter(
        (muestra) =>
          muestra.estado === "tomada"
      ).length,

      aceptadas: muestras.filter(
        (muestra) =>
          muestra.estado === "aceptada"
      ).length,

      enProceso: muestras.filter(
        (muestra) =>
          muestra.estado === "en_proceso"
      ).length,

      procesadas: muestras.filter(
        (muestra) =>
          muestra.estado === "procesada"
      ).length,

      rechazadas: muestras.filter(
        (muestra) =>
          muestra.estado === "rechazada"
      ).length,
    };
  }, [muestras]);

  const botonesAcciones = (
    muestra: Muestra
  ) => {
    const ocupado =
      procesandoId === muestra.id;

    const bloqueado =
      Boolean(procesandoId) ||
      cargandoDetalle;

    const validada =
      muestra.estadoValidacion ===
        "aceptada" &&
      muestra.aceptada;

    return (
      <View style={styles.acciones}>
        <Pressable
          style={[
            styles.boton,
            styles.botonDetalle,
            cargandoDetalle &&
              styles.deshabilitado,
          ]}
          disabled={bloqueado}
          onPress={() =>
            void verDetalle(muestra)
          }
        >
          <Text style={styles.textoBoton}>
            Ver detalle
          </Text>
        </Pressable>

        {muestra.estado === "aceptada" &&
          validada && (
            <Pressable
              style={[
                styles.boton,
                styles.botonIniciar,
                bloqueado &&
                  styles.deshabilitado,
              ]}
              disabled={bloqueado}
              onPress={() =>
                iniciarProceso(muestra)
              }
            >
              {ocupado ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={styles.textoBoton}
                >
                  Iniciar proceso
                </Text>
              )}
            </Pressable>
          )}

        {muestra.estado === "en_proceso" &&
          validada && (
            <Pressable
              style={[
                styles.boton,
                styles.botonFinalizar,
                bloqueado &&
                  styles.deshabilitado,
              ]}
              disabled={bloqueado}
              onPress={() =>
                finalizarProceso(muestra)
              }
            >
              {ocupado ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={styles.textoBoton}
                >
                  Finalizar proceso
                </Text>
              )}
            </Pressable>
          )}
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#19385F"
        />

        <Text style={styles.textoSecundario}>
          Cargando seguimiento de muestras...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={actualizar}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      >
        <View style={styles.encabezado}>
          <View style={styles.encabezadoTexto}>
            <Text style={styles.titulo}>
              Seguimiento de muestras
            </Text>

            <Text style={styles.subtitulo}>
              Consulta el estado y controla el
              procesamiento de las muestras
              del laboratorio.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() => router.back()}
          >
            <Text style={styles.textoBoton}>
              Volver
            </Text>
          </Pressable>
        </View>

        <View style={styles.contadores}>
          {[
            {
              titulo: "Total",
              valor: contadores.total,
            },
            {
              titulo: "Tomadas",
              valor: contadores.tomadas,
            },
            {
              titulo: "Aceptadas",
              valor: contadores.aceptadas,
            },
            {
              titulo: "En proceso",
              valor: contadores.enProceso,
            },
            {
              titulo: "Procesadas",
              valor: contadores.procesadas,
            },
            {
              titulo: "Rechazadas",
              valor: contadores.rechazadas,
            },
          ].map((contador) => (
            <View
              key={contador.titulo}
              style={styles.contador}
            >
              <Text
                style={styles.contadorTitulo}
              >
                {contador.titulo}
              </Text>

              <Text
                style={styles.contadorNumero}
              >
                {contador.valor}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.seccionTitulo}>
            Buscar muestra
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Paciente, CI, análisis, orden o código"
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <Text style={styles.etiquetaFiltro}>
            Filtrar por estado
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtros}
          >
            {FILTROS.map((opcion) => {
              const seleccionado =
                filtro === opcion.valor;

              return (
                <Pressable
                  key={opcion.valor}
                  style={[
                    styles.filtroBoton,
                    seleccionado &&
                      styles.filtroSeleccionado,
                  ]}
                  onPress={() =>
                    setFiltro(opcion.valor)
                  }
                >
                  <Text
                    style={[
                      styles.filtroTexto,
                      seleccionado &&
                        styles.filtroTextoSeleccionado,
                    ]}
                  >
                    {opcion.nombre}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={[
              styles.botonActualizar,
              actualizando &&
                styles.deshabilitado,
            ]}
            disabled={actualizando}
            onPress={() => {
              void actualizar();
            }}
          >
            {actualizando ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text style={styles.textoBoton}>
                Actualizar
              </Text>
            )}
          </Pressable>
        </View>

        {error !== "" && (
          <View style={styles.errorCaja}>
            <Text style={styles.errorTexto}>
              {error}
            </Text>

            <Pressable
              style={styles.botonActualizar}
              onPress={() => {
                void cargarDatos();
              }}
            >
              <Text style={styles.textoBoton}>
                Reintentar
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.panel}>
          <View style={styles.filaTitulo}>
            <Text style={styles.seccionTitulo}>
              Muestras registradas
            </Text>

            <Text style={styles.resultadosTexto}>
              {muestrasFiltradas.length} resultados
            </Text>
          </View>

          {muestrasFiltradas.length === 0 ? (
            <Text style={styles.textoSecundario}>
              No se encontraron muestras
              con los filtros seleccionados.
            </Text>
          ) : (
            muestrasFiltradas.map((muestra) => {
              const paciente =
                pacientes[muestra.pacienteId];

              return (
                <View
                  key={muestra.id}
                  style={styles.tarjeta}
                >
                  <View
                    style={styles.filaTitulo}
                  >
                    <Text
                      style={
                        styles.nombreAnalisis
                      }
                    >
                      {muestra.analisisNombre}
                    </Text>

                    <View
                      style={[
                        styles.etiquetaEstado,
                        {
                          backgroundColor:
                            colorEstado(
                              muestra.estado
                            ),
                        },
                      ]}
                    >
                      <Text
                        style={styles.textoEstado}
                      >
                        {nombreEstado(
                          muestra.estado
                        )}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.dato}>
                    Código:{" "}
                    {muestra.codigoEtiqueta}
                  </Text>

                  <Text style={styles.dato}>
                    Paciente:{" "}
                    {paciente?.nombre ||
                      "Sin identificar"}
                  </Text>

                  <Text style={styles.dato}>
                    CI: {paciente?.ci || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Tipo: {muestra.tipo}
                  </Text>

                  <Text style={styles.dato}>
                    Orden:{" "}
                    {muestra.ordenId || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Fecha de toma:{" "}
                    {mostrarFecha(
                      muestra.fechaToma
                    )}
                  </Text>

                  <Text style={styles.dato}>
                    Validación:{" "}
                    {nombreEstado(
                      muestra.estadoValidacion
                    )}
                  </Text>

                  {muestra.estado ===
                    "rechazada" &&
                    muestra.motivoRechazo !==
                      "" && (
                      <Text
                        style={styles.motivoRechazo}
                      >
                        Motivo:{" "}
                        {muestra.motivoRechazo}
                      </Text>
                    )}

                  {botonesAcciones(muestra)}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView
              contentContainerStyle={
                styles.contenidoModal
              }
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.tituloModal}>
                Detalle de la muestra
              </Text>

              {detalle && (
                <>
                  <View style={styles.resumen}>
                    <Text
                      style={
                        styles.nombreAnalisis
                      }
                    >
                      {detalle.analisisNombre}
                    </Text>

                    <Text style={styles.dato}>
                      Paciente:{" "}
                      {pacientes[
                        detalle.pacienteId
                      ]?.nombre ||
                        "Sin identificar"}
                    </Text>

                    <Text style={styles.dato}>
                      CI:{" "}
                      {pacientes[
                        detalle.pacienteId
                      ]?.ci || "-"}
                    </Text>

                    <View
                      style={[
                        styles.etiquetaEstado,
                        styles.estadoDetalle,
                        {
                          backgroundColor:
                            colorEstado(
                              detalle.estado
                            ),
                        },
                      ]}
                    >
                      <Text
                        style={styles.textoEstado}
                      >
                        {nombreEstado(
                          detalle.estado
                        )}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.bloqueDetalle
                    }
                  >
                    <Text
                      style={
                        styles.seccionTitulo
                      }
                    >
                      Información de la muestra
                    </Text>

                    <Text style={styles.dato}>
                      Código:{" "}
                      {detalle.codigoEtiqueta}
                    </Text>

                    <Text style={styles.dato}>
                      ID de muestra:{" "}
                      {detalle.muestraId}
                    </Text>

                    <Text style={styles.dato}>
                      Orden:{" "}
                      {detalle.ordenId || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Solicitud:{" "}
                      {detalle.solicitudId || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Tipo de muestra:{" "}
                      {detalle.tipo}
                    </Text>

                    <Text style={styles.dato}>
                      Validación:{" "}
                      {nombreEstado(
                        detalle.estadoValidacion
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Aceptada:{" "}
                      {detalle.aceptada
                        ? "Sí"
                        : "No"}
                    </Text>

                    {detalle.observaciones !==
                      "" && (
                      <Text
                        style={styles.dato}
                      >
                        Observaciones:{" "}
                        {detalle.observaciones}
                      </Text>
                    )}

                    {detalle.motivoRechazo !==
                      "" && (
                      <Text
                        style={
                          styles.motivoRechazo
                        }
                      >
                        Motivo de rechazo:{" "}
                        {detalle.motivoRechazo}
                      </Text>
                    )}
                  </View>

                  <View
                    style={
                      styles.bloqueDetalle
                    }
                  >
                    <Text
                      style={
                        styles.seccionTitulo
                      }
                    >
                      Seguimiento del procesamiento
                    </Text>

                    <Text style={styles.dato}>
                      Fecha de toma:{" "}
                      {mostrarFecha(
                        detalle.fechaToma
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Fecha de validación:{" "}
                      {mostrarFecha(
                        detalle.fechaValidacion
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Inicio del proceso:{" "}
                      {mostrarFecha(
                        detalle.fechaInicioProcesamiento
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Fin del proceso:{" "}
                      {mostrarFecha(
                        detalle.fechaFinProcesamiento
                      )}
                    </Text>

                    <Text style={styles.dato}>
                      Última actualización:{" "}
                      {mostrarFecha(
                        detalle.fechaActualizacion
                      )}
                    </Text>
                  </View>

                  {detalle.historialEstados.length >
                    0 && (
                    <View
                      style={
                        styles.bloqueDetalle
                      }
                    >
                      <Text
                        style={
                          styles.seccionTitulo
                        }
                      >
                        Historial de estados
                      </Text>

                      {detalle.historialEstados.map(
                        (registro, indice) => (
                          <View
                            key={indice}
                            style={
                              styles.historialItem
                            }
                          >
                            <Text
                              style={
                                styles.historialEstado
                              }
                            >
                              {nombreEstado(
                                registro.estado
                              )}
                            </Text>

                            <Text
                              style={styles.dato}
                            >
                              Fecha:{" "}
                              {mostrarFecha(
                                registro.fecha
                              )}
                            </Text>

                            <Text
                              style={styles.dato}
                            >
                              Responsable:{" "}
                              {registro.usuarioId ||
                                "-"}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  )}

                  <View
                    style={
                      styles.accionesModal
                    }
                  >
                    <Pressable
                      style={[
                        styles.boton,
                        styles.botonCerrar,
                      ]}
                      onPress={() =>
                        setModalVisible(false)
                      }
                    >
                      <Text
                        style={
                          styles.textoBoton
                        }
                      >
                        Cerrar
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.boton,
                        styles.botonActualizar,
                      ]}
                      disabled={cargandoDetalle}
                      onPress={() => {
                        void verDetalle(detalle);
                      }}
                    >
                      {cargandoDetalle ? (
                        <ActivityIndicator
                          color="#FFFFFF"
                        />
                      ) : (
                        <Text
                          style={
                            styles.textoBoton
                          }
                        >
                          Actualizar detalle
                        </Text>
                      )}
                    </Pressable>

                    {detalle.estado ===
                      "aceptada" &&
                      detalle.aceptada &&
                      detalle.estadoValidacion ===
                        "aceptada" && (
                        <Pressable
                          style={[
                            styles.boton,
                            styles.botonIniciar,
                          ]}
                          disabled={
                            Boolean(
                              procesandoId
                            )
                          }
                          onPress={() =>
                            iniciarProceso(
                              detalle
                            )
                          }
                        >
                          <Text
                            style={
                              styles.textoBoton
                            }
                          >
                            Iniciar proceso
                          </Text>
                        </Pressable>
                      )}

                    {detalle.estado ===
                      "en_proceso" &&
                      detalle.aceptada &&
                      detalle.estadoValidacion ===
                        "aceptada" && (
                        <Pressable
                          style={[
                            styles.boton,
                            styles.botonFinalizar,
                          ]}
                          disabled={
                            Boolean(
                              procesandoId
                            )
                          }
                          onPress={() =>
                            finalizarProceso(
                              detalle
                            )
                          }
                        >
                          <Text
                            style={
                              styles.textoBoton
                            }
                          >
                            Finalizar proceso
                          </Text>
                        </Pressable>
                      )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  contenido: {
    padding: 18,
    paddingBottom: 50,
  },

  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FB",
  },

  textoSecundario: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 10,
    textAlign: "center",
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },

  encabezadoTexto: {
    flex: 1,
  },

  titulo: {
    fontSize: 26,
    fontWeight: "800",
    color: "#19385F",
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 21,
  },

  botonVolver: {
    backgroundColor: "#64748B",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 12,
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },

  contador: {
    flexGrow: 1,
    minWidth: 115,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    color: "#64748B",
    fontSize: 13,
  },

  contadorNumero: {
    color: "#19385F",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 8,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },

  seccionTitulo: {
    color: "#19385F",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 13,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 14,
  },

  etiquetaFiltro: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 9,
  },

  filtros: {
    marginBottom: 15,
  },

  filtroBoton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },

  filtroSeleccionado: {
    backgroundColor: "#19385F",
    borderColor: "#19385F",
  },

  filtroTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },

  filtroTextoSeleccionado: {
    color: "#FFFFFF",
  },

  botonActualizar: {
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 9,
    alignSelf: "flex-start",
    minWidth: 110,
  },

  deshabilitado: {
    opacity: 0.5,
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
    marginBottom: 12,
  },

  tarjeta: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },

  filaTitulo: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  nombreAnalisis: {
    fontSize: 17,
    fontWeight: "800",
    color: "#19385F",
    flexShrink: 1,
  },

  etiquetaEstado: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  textoEstado: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  dato: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 9,
    lineHeight: 19,
  },

  resultadosTexto: {
    color: "#64748B",
    fontSize: 12,
  },

  motivoRechazo: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 9,
  },

  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },

  boton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 9,
  },

  botonDetalle: {
    backgroundColor: "#19385F",
  },

  botonIniciar: {
    backgroundColor: "#2563EB",
  },

  botonFinalizar: {
    backgroundColor: "#059669",
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    width: "100%",
    maxWidth: 700,
    maxHeight: "90%",
    overflow: "hidden",
  },

  contenidoModal: {
    padding: 20,
    paddingBottom: 35,
  },

  tituloModal: {
    fontSize: 23,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 18,
  },

  resumen: {
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },

  estadoDetalle: {
    marginTop: 8,
  },

  bloqueDetalle: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },

  accionesModal: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 15,
  },

  botonCerrar: {
    backgroundColor: "#64748B",
  },

  historialItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
    paddingLeft: 12,
    paddingVertical: 6,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
  },

  historialEstado: {
    fontSize: 14,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 6,
  },
});