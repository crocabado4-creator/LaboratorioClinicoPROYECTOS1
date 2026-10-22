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

import { router } from "expo-router";
import { getAuth } from "firebase/auth";

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

import { db } from "../firebase/firebase";

type EstadoValidacion =
  | "pendiente"
  | "aceptada"
  | "rechazada";

type Muestra = {
  id: string;
  codigo: string;
  pacienteId: string;
  paciente: string;
  ordenId: string;
  analisisId: string;
  analisis: string;
  tipoMuestra: string;
  estado: string;
  estadoValidacion: EstadoValidacion;
  aceptada: boolean;
  laboratorioId: string;
  fechaToma: string;
  motivoRechazo: string;
  validadoPor: string;
};

type Filtro =
  | "todas"
  | "pendientes"
  | "aceptadas"
  | "rechazadas";

type Sesion = {
  uid: string;
  laboratorioId: string;
};

const OPCIONES_FILTRO: {
  valor: Filtro;
  nombre: string;
}[] = [
  {
    valor: "todas",
    nombre: "Todas las muestras",
  },
  {
    valor: "pendientes",
    nombre: "Pendientes",
  },
  {
    valor: "aceptadas",
    nombre: "Aceptadas",
  },
  {
    valor: "rechazadas",
    nombre: "Rechazadas",
  },
];

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function normalizarEstado(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function obtenerFecha(valor: unknown): string {
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
    return "-";
  }

  return "-";
}

function mostrarAviso(
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

function obtenerMensajeError(error: unknown): string {
  const codigo = (
    error as {
      code?: string;
    }
  )?.code;

  if (
    codigo === "permission-denied" ||
    codigo === "firestore/permission-denied"
  ) {
    return "No tienes permisos suficientes para realizar esta operación.";
  }

  if (
    codigo === "unavailable" ||
    codigo === "firestore/unavailable"
  ) {
    return "No se pudo conectar con Firebase. Comprueba tu conexión a Internet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

async function obtenerSesionBioquimico(): Promise<Sesion> {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error(
      "Debes iniciar sesión para gestionar las muestras."
    );
  }

  const usuarioSnap = await getDoc(
    doc(db, "usuarios", usuario.uid)
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

  const rol = texto(datos.rol).toLowerCase();

  if (
    rol !== "bioquimico" &&
    rol !== "bioquímico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede validar muestras."
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
    uid: usuario.uid,
    laboratorioId,
  };
}

function puedeValidarMuestra(
  muestra: Muestra
): boolean {
  return (
    normalizarEstado(muestra.estado) === "tomada" &&
    muestra.estadoValidacion === "pendiente"
  );
}

function obtenerEstiloEstado(estado: string) {
  const valor = normalizarEstado(estado);

  if (valor === "rechazada") {
    return {
      fondo: "#FEE2E2",
      texto: "#991B1B",
    };
  }

  if (
    valor === "aceptada" ||
    valor === "procesada"
  ) {
    return {
      fondo: "#DCFCE7",
      texto: "#166534",
    };
  }

  if (valor === "en_proceso") {
    return {
      fondo: "#DBEAFE",
      texto: "#1D4ED8",
    };
  }

  return {
    fondo: "#FEF3C7",
    texto: "#92400E",
  };
}

function nombreEstado(estado: string): string {
  const valor = normalizarEstado(estado);

  const nombres: Record<string, string> = {
    tomada: "Tomada",
    pendiente: "Pendiente",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    en_proceso: "En proceso",
    procesada: "Procesada",
  };

  return nombres[valor] || estado || "Sin estado";
}

export default function ValidarMuestrasScreen() {
  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const [
    muestraSeleccionada,
    setMuestraSeleccionada,
  ] = useState<Muestra | null>(null);

  const [mostrarRechazo, setMostrarRechazo] =
    useState(false);

  const [mostrarFiltros, setMostrarFiltros] =
    useState(false);

  const [motivoRechazo, setMotivoRechazo] =
    useState("");

  const cargarMuestras = useCallback(
    async (mostrarCarga = true) => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        setError("");

        const sesion =
          await obtenerSesionBioquimico();

        const muestrasConsulta = query(
          collection(db, "muestras"),
          where(
            "laboratorioId",
            "==",
            sesion.laboratorioId
          )
        );

        const muestrasSnap = await getDocs(
          muestrasConsulta
        );

        const pacientesCache = new Map<
          string,
          string
        >();

        const analisisCache = new Map<
          string,
          string
        >();

        const obtenerPaciente = async (
          pacienteId: string
        ): Promise<string> => {
          if (!pacienteId) {
            return "Sin paciente";
          }

          const cache =
            pacientesCache.get(pacienteId);

          if (cache) {
            return cache;
          }

          try {
            const pacienteSnap = await getDoc(
              doc(db, "pacientes", pacienteId)
            );

            if (!pacienteSnap.exists()) {
              return pacienteId;
            }

            const datos = pacienteSnap.data();

            if (
              texto(datos.laboratorioId) !==
              sesion.laboratorioId
            ) {
              return "Paciente no disponible";
            }

            const nombre = texto(
              datos.nombre || datos.nombres
            );

            const apellido = texto(
              datos.apellido || datos.apellidos
            );

            const nombreCompleto =
              `${nombre} ${apellido}`.trim() ||
              pacienteId;

            pacientesCache.set(
              pacienteId,
              nombreCompleto
            );

            return nombreCompleto;
          } catch {
            return pacienteId;
          }
        };

        const obtenerAnalisis = async (
          analisisId: string
        ): Promise<string> => {
          if (!analisisId) {
            return "Sin análisis";
          }

          const cache =
            analisisCache.get(analisisId);

          if (cache) {
            return cache;
          }

          try {
            const analisisSnap = await getDoc(
              doc(db, "analisis", analisisId)
            );

            if (!analisisSnap.exists()) {
              return analisisId;
            }

            const datos = analisisSnap.data();

            if (
              texto(datos.laboratorioId) !==
              sesion.laboratorioId
            ) {
              return "Análisis no disponible";
            }

            const nombre =
              texto(
                datos.nombre ||
                  datos.nombreAnalisis ||
                  datos.descripcion
              ) || analisisId;

            analisisCache.set(
              analisisId,
              nombre
            );

            return nombre;
          } catch {
            return analisisId;
          }
        };

        const lista: Muestra[] =
          await Promise.all(
            muestrasSnap.docs.map(
              async (documento) => {
                const datos = documento.data();

                const pacienteId = texto(
                  datos.pacienteId
                );

                const analisisId = texto(
                  datos.analisisId
                );

                const paciente =
                  texto(
                    datos.pacienteNombre ||
                      datos.nombrePaciente
                  ) ||
                  (await obtenerPaciente(
                    pacienteId
                  ));

                const analisis =
                  texto(
                    datos.analisisNombre ||
                      datos.nombreAnalisis
                  ) ||
                  (await obtenerAnalisis(
                    analisisId
                  ));

                const estado = normalizarEstado(
                  datos.estado || "tomada"
                );

                const estadoValidacion =
                  normalizarEstado(
                    datos.estadoValidacion ||
                      "pendiente"
                  );

                const validacion:
                  EstadoValidacion =
                  estadoValidacion === "aceptada" ||
                  estadoValidacion === "rechazada"
                    ? estadoValidacion
                    : "pendiente";

                return {
                  id: documento.id,

                  codigo:
                    texto(
                      datos.codigo ||
                        datos.codigoMuestra
                    ) || documento.id,

                  pacienteId,
                  paciente,

                  ordenId: texto(
                    datos.ordenId
                  ),

                  analisisId,
                  analisis,

                  tipoMuestra:
                    texto(
                      datos.tipoMuestra ||
                        datos.tipo
                    ) || "-",

                  estado,

                  estadoValidacion: validacion,

                  aceptada:
                    datos.aceptada === true,

                  laboratorioId:
                    sesion.laboratorioId,

                  fechaToma: obtenerFecha(
                    datos.fechaToma ||
                      datos.fechaRegistro
                  ),

                  motivoRechazo: texto(
                    datos.motivoRechazo
                  ),

                  validadoPor: texto(
                    datos.validadoPor
                  ),
                };
              }
            )
          );

        lista.sort((a, b) =>
          b.codigo.localeCompare(a.codigo)
        );

        setMuestras(lista);
      } catch (e: unknown) {
        setError(
          obtenerMensajeError(e)
        );

        setMuestras([]);
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    []
  );

  useEffect(() => {
    void cargarMuestras();
  }, [cargarMuestras]);

  const actualizar = useCallback(async () => {
    setActualizando(true);
    await cargarMuestras(false);
  }, [cargarMuestras]);

  const total = muestras.length;

  const pendientes = useMemo(
    () =>
      muestras.filter(
        puedeValidarMuestra
      ).length,
    [muestras]
  );

  const aceptadas = useMemo(
    () =>
      muestras.filter(
        (muestra) =>
          muestra.estadoValidacion ===
          "aceptada"
      ).length,
    [muestras]
  );

  const rechazadas = useMemo(
    () =>
      muestras.filter(
        (muestra) =>
          muestra.estadoValidacion ===
          "rechazada"
      ).length,
    [muestras]
  );

  const muestrasFiltradas = useMemo(() => {
    const termino = busqueda
      .trim()
      .toLowerCase();

    return muestras.filter((muestra) => {
      const contenido = [
        muestra.codigo,
        muestra.paciente,
        muestra.pacienteId,
        muestra.ordenId,
        muestra.analisis,
        muestra.analisisId,
        muestra.tipoMuestra,
        muestra.estado,
        muestra.estadoValidacion,
      ]
        .join(" ")
        .toLowerCase();

      if (
        termino &&
        !contenido.includes(termino)
      ) {
        return false;
      }

      if (
        filtro === "pendientes" &&
        !puedeValidarMuestra(muestra)
      ) {
        return false;
      }

      if (
        filtro === "aceptadas" &&
        muestra.estadoValidacion !==
          "aceptada"
      ) {
        return false;
      }

      if (
        filtro === "rechazadas" &&
        muestra.estadoValidacion !==
          "rechazada"
      ) {
        return false;
      }

      return true;
    });
  }, [muestras, busqueda, filtro]);

  const ejecutarValidacion = async (
    muestra: Muestra,
    accion: "aceptar" | "rechazar",
    motivo = ""
  ): Promise<void> => {
    if (guardando) {
      return;
    }

    if (
      accion === "rechazar" &&
      !motivo.trim()
    ) {
      mostrarAviso(
        "Motivo obligatorio",
        "Debes indicar el motivo del rechazo."
      );

      return;
    }

    try {
      setGuardando(true);

      const sesion =
        await obtenerSesionBioquimico();

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
            sesion.laboratorioId
          ) {
            throw new Error(
              "Esta muestra pertenece a otro laboratorio."
            );
          }

          const estadoActual =
            normalizarEstado(
              datos.estado || "tomada"
            );

          const validacionActual =
            normalizarEstado(
              datos.estadoValidacion ||
                "pendiente"
            );

          if (
            estadoActual !== "tomada" ||
            validacionActual !== "pendiente"
          ) {
            throw new Error(
              "Esta muestra ya fue validada o cambió de estado."
            );
          }

          const aceptada =
            accion === "aceptar";

          transaccion.update(muestraRef, {
            estado: aceptada
              ? "aceptada"
              : "rechazada",

            estadoValidacion: aceptada
              ? "aceptada"
              : "rechazada",

            aceptada,

            motivoRechazo: aceptada
              ? ""
              : motivo.trim(),

            validadoPor: sesion.uid,

            fechaValidacion:
              serverTimestamp(),

            fechaActualizacion:
              serverTimestamp(),
          });
        }
      );

      setMostrarRechazo(false);
      setMuestraSeleccionada(null);
      setMotivoRechazo("");

      await cargarMuestras(false);

      mostrarAviso(
        "Operación exitosa",
        accion === "aceptar"
          ? "La muestra fue aceptada correctamente."
          : "La muestra fue rechazada correctamente."
      );
    } catch (e: unknown) {
      mostrarAviso(
        "Error",
        obtenerMensajeError(e)
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirRechazo = (
    muestra: Muestra
  ) => {
    setMuestraSeleccionada(muestra);
    setMotivoRechazo("");
    setMostrarRechazo(true);
  };

  const confirmarRechazo = async () => {
    if (!muestraSeleccionada) {
      return;
    }

    await ejecutarValidacion(
      muestraSeleccionada,
      "rechazar",
      motivoRechazo
    );
  };

  const mostrarEstado = (
    estado: string
  ) => {
    const colores =
      obtenerEstiloEstado(estado);

    return (
      <View
        style={[
          styles.estadoBadge,
          {
            backgroundColor:
              colores.fondo,
          },
        ]}
      >
        <Text
          style={[
            styles.estadoTexto,
            {
              color: colores.texto,
            },
          ]}
        >
          {nombreEstado(estado)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={
          styles.contenido
        }
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
          <View
            style={styles.encabezadoTexto}
          >
            <Text style={styles.titulo}>
              Recepción y validación de muestras
            </Text>

            <Text
              style={styles.subtitulo}
            >
              Verifica que las muestras
              recibidas sean aptas antes
              de realizar el análisis.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() =>
              router.replace("/muestras")
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
              style={
                styles.contadorTitulo
              }
            >
              Total de muestras
            </Text>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {total}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text
              style={
                styles.contadorTitulo
              }
            >
              Pendientes
            </Text>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {pendientes}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text
              style={
                styles.contadorTitulo
              }
            >
              Aceptadas
            </Text>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {aceptadas}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text
              style={
                styles.contadorTitulo
              }
            >
              Rechazadas
            </Text>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {rechazadas}
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View
            style={
              styles.barraHerramientas
            }
          >
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por código, paciente, orden o análisis..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable
              style={
                styles.selectorFiltro
              }
              onPress={() =>
                setMostrarFiltros(true)
              }
            >
              <Text
                style={
                  styles.textoFiltro
                }
              >
                {OPCIONES_FILTRO.find(
                  (item) =>
                    item.valor === filtro
                )?.nombre ||
                  "Todas las muestras"}
              </Text>

              <Text
                style={
                  styles.flechaFiltro
                }
              >
                ⌄
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.botonActualizar
              }
              onPress={actualizar}
              disabled={
                cargando || guardando
              }
            >
              <Text
                style={styles.textoBlanco}
              >
                Actualizar
              </Text>
            </Pressable>
          </View>

          {error !== "" && (
            <View
              style={styles.errorCaja}
            >
              <Text
                style={
                  styles.errorTexto
                }
              >
                {error}
              </Text>

              <Pressable
                style={
                  styles.botonReintentar
                }
                onPress={() =>
                  cargarMuestras()
                }
              >
                <Text
                  style={
                    styles.textoBlanco
                  }
                >
                  Reintentar
                </Text>
              </Pressable>
            </View>
          )}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#2563EB"
              style={{
                marginVertical: 30,
              }}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
            >
              <View style={styles.tabla}>
                <View
                  style={
                    styles.cabeceraTabla
                  }
                >
                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colCodigo,
                    ]}
                  >
                    Código
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colPaciente,
                    ]}
                  >
                    Paciente
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colOrden,
                    ]}
                  >
                    Orden
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colAnalisis,
                    ]}
                  >
                    Análisis
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colTipo,
                    ]}
                  >
                    Tipo
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colFecha,
                    ]}
                  >
                    Fecha
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colEstado,
                    ]}
                  >
                    Validación
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colProcesamiento,
                    ]}
                  >
                    Procesamiento
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colAcciones,
                    ]}
                  >
                    Acciones
                  </Text>
                </View>

                {muestrasFiltradas.map(
                  (muestra) => {
                    const puedeValidar =
                      puedeValidarMuestra(
                        muestra
                      );

                    return (
                      <View
                        key={muestra.id}
                        style={
                          styles.fila
                        }
                      >
                        <Text
                          style={[
                            styles.celda,
                            styles.codigo,
                            styles.colCodigo,
                          ]}
                        >
                          {muestra.codigo}
                        </Text>

                        <Text
                          style={[
                            styles.celda,
                            styles.colPaciente,
                          ]}
                        >
                          {muestra.paciente}
                        </Text>

                        <Text
                          style={[
                            styles.celda,
                            styles.colOrden,
                          ]}
                        >
                          {muestra.ordenId}
                        </Text>

                        <Text
                          style={[
                            styles.celda,
                            styles.colAnalisis,
                          ]}
                        >
                          {muestra.analisis}
                        </Text>

                        <Text
                          style={[
                            styles.celda,
                            styles.colTipo,
                          ]}
                        >
                          {
                            muestra.tipoMuestra
                          }
                        </Text>

                        <Text
                          style={[
                            styles.celda,
                            styles.colFecha,
                          ]}
                        >
                          {muestra.fechaToma}
                        </Text>

                        <View
                          style={
                            styles.colEstado
                          }
                        >
                          {mostrarEstado(
                            muestra.estadoValidacion
                          )}
                        </View>

                        <View
                          style={
                            styles.colProcesamiento
                          }
                        >
                          {mostrarEstado(
                            muestra.estado
                          )}
                        </View>

                        <View
                          style={[
                            styles.colAcciones,
                            styles.acciones,
                          ]}
                        >
                          {puedeValidar ? (
                            <>
                              <Pressable
                                style={[
                                  styles.botonAceptar,
                                  guardando &&
                                    styles.botonDeshabilitado,
                                ]}
                                disabled={
                                  guardando
                                }
                                onPress={() =>
                                  ejecutarValidacion(
                                    muestra,
                                    "aceptar"
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.textoBlanco
                                  }
                                >
                                  Aceptar
                                </Text>
                              </Pressable>

                              <Pressable
                                style={[
                                  styles.botonRechazar,
                                  guardando &&
                                    styles.botonDeshabilitado,
                                ]}
                                disabled={
                                  guardando
                                }
                                onPress={() =>
                                  abrirRechazo(
                                    muestra
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.textoBlanco
                                  }
                                >
                                  Rechazar
                                </Text>
                              </Pressable>
                            </>
                          ) : muestra.estadoValidacion ===
                            "rechazada" ? (
                            <Text
                              style={
                                styles.motivoTexto
                              }
                            >
                              {muestra.motivoRechazo ||
                                "Rechazada"}
                            </Text>
                          ) : (
                            <Text
                              style={
                                styles.sinAcciones
                              }
                            >
                              Ya validada
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  }
                )}

                {muestrasFiltradas.length ===
                  0 && (
                  <Text
                    style={
                      styles.sinDatos
                    }
                  >
                    No se encontraron
                    muestras.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>

        <Pressable
          style={
            styles.botonSeguimiento
          }
          onPress={() =>
            router.push(
              "/seguimiento-muestras"
            )
          }
        >
          <Text
            style={
              styles.textoSeguimiento
            }
          >
            Ir a seguimiento de muestras
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={mostrarFiltros}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarFiltros(false)
        }
      >
        <View
          style={styles.fondoModal}
        >
          <View style={styles.modal}>
            <Text
              style={
                styles.modalTitulo
              }
            >
              Filtrar muestras
            </Text>

            {OPCIONES_FILTRO.map(
              (opcion) => (
                <Pressable
                  key={opcion.valor}
                  style={
                    styles.opcionFiltro
                  }
                  onPress={() => {
                    setFiltro(
                      opcion.valor
                    );
                    setMostrarFiltros(
                      false
                    );
                  }}
                >
                  <Text
                    style={
                      styles.opcionTexto
                    }
                  >
                    {opcion.nombre}
                  </Text>
                </Pressable>
              )
            )}

            <Pressable
              style={
                styles.botonCerrar
              }
              onPress={() =>
                setMostrarFiltros(false)
              }
            >
              <Text
                style={
                  styles.textoBlanco
                }
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={mostrarRechazo}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!guardando) {
            setMostrarRechazo(false);
          }
        }}
      >
        <View
          style={styles.fondoModal}
        >
          <View style={styles.modal}>
            <Text
              style={
                styles.modalTitulo
              }
            >
              Rechazar muestra
            </Text>

            <Text
              style={
                styles.modalDescripcion
              }
            >
              Código:{" "}
              {
                muestraSeleccionada?.codigo
              }
            </Text>

            <Text
              style={
                styles.modalDescripcion
              }
            >
              Paciente:{" "}
              {
                muestraSeleccionada?.paciente
              }
            </Text>

            <Text
              style={styles.label}
            >
              Motivo del rechazo *
            </Text>

            <TextInput
              style={
                styles.inputMotivo
              }
              placeholder="Escribe el motivo del rechazo..."
              placeholderTextColor="#94A3B8"
              multiline
              value={motivoRechazo}
              onChangeText={
                setMotivoRechazo
              }
              editable={!guardando}
            />

            <View
              style={
                styles.botonesModal
              }
            >
              <Pressable
                style={
                  styles.botonCancelar
                }
                disabled={guardando}
                onPress={() => {
                  setMostrarRechazo(
                    false
                  );
                  setMuestraSeleccionada(
                    null
                  );
                  setMotivoRechazo(
                    ""
                  );
                }}
              >
                <Text
                  style={
                    styles.textoCancelar
                  }
                >
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.botonRechazar,
                  guardando &&
                    styles.botonDeshabilitado,
                ]}
                disabled={guardando}
                onPress={
                  confirmarRechazo
                }
              >
                {guardando ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.textoBlanco
                    }
                  >
                    Confirmar rechazo
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    padding: 18,
    paddingBottom: 40,
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  encabezadoTexto: {
    flex: 1,
    paddingRight: 15,
  },

  titulo: {
    fontSize: 25,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 7,
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 21,
  },

  botonVolver: {
    backgroundColor: "#334155",
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 8,
  },

  textoVolver: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 22,
  },

  contador: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 8,
  },

  contadorNumero: {
    color: "#17365D",
    fontSize: 28,
    fontWeight: "800",
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  barraHerramientas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },

  buscador: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    fontSize: 12,
  },

  selectorFiltro: {
    minWidth: 160,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  textoFiltro: {
    fontSize: 12,
    color: "#0F172A",
  },

  flechaFiltro: {
    color: "#334155",
    fontSize: 20,
  },

  botonActualizar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 43,
  },

  textoBlanco: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  tabla: {
    minWidth: 1650,
  },

  cabeceraTabla: {
    flexDirection: "row",
    backgroundColor: "#17365D",
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  cabeceraTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    minHeight: 65,
  },

  celda: {
    fontSize: 12,
    color: "#0F172A",
  },

  codigo: {
    fontWeight: "800",
  },

  colCodigo: {
    width: 195,
  },

  colPaciente: {
    width: 215,
  },

  colOrden: {
    width: 205,
  },

  colAnalisis: {
    width: 210,
  },

  colTipo: {
    width: 100,
  },

  colFecha: {
    width: 190,
  },

  colEstado: {
    width: 135,
  },

  colProcesamiento: {
    width: 150,
  },

  colAcciones: {
    width: 225,
  },

  acciones: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  estadoBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  estadoTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  botonAceptar: {
    backgroundColor: "#16A34A",
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  botonRechazar: {
    backgroundColor: "#DC2626",
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  motivoTexto: {
    color: "#DC2626",
    fontSize: 11,
  },

  sinAcciones: {
    color: "#94A3B8",
    fontSize: 12,
  },

  sinDatos: {
    textAlign: "center",
    padding: 25,
    color: "#64748B",
    fontSize: 13,
  },

  errorCaja: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 9,
    padding: 13,
    marginBottom: 15,
  },

  errorTexto: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 10,
  },

  botonReintentar: {
    backgroundColor: "#2563EB",
    padding: 11,
    borderRadius: 7,
    alignItems: "center",
  },

  botonSeguimiento: {
    backgroundColor: "#17365D",
    borderRadius: 9,
    padding: 15,
    alignItems: "center",
    marginTop: 15,
  },

  textoSeguimiento: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    maxHeight: "85%",
  },

  modalTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 16,
  },

  modalDescripcion: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 9,
  },

  opcionFiltro: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  opcionTexto: {
    color: "#0F172A",
    fontSize: 14,
  },

  botonCerrar: {
    backgroundColor: "#334155",
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
    marginTop: 15,
  },

  label: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 14,
    marginBottom: 8,
  },

  inputMotivo: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    minHeight: 110,
    padding: 12,
    textAlignVertical: "top",
    color: "#0F172A",
  },

  botonesModal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  botonCancelar: {
    backgroundColor: "#E2E8F0",
    borderRadius: 7,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },

  textoCancelar: {
    color: "#334155",
    fontWeight: "700",
  },
});