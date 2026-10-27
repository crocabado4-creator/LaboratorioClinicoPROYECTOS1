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
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  obtenerMuestras,
  obtenerOrdenesParaMuestras,
  registrarMuestra,
  type Muestra as MuestraFirestore,
  type OrdenParaMuestra,
} from "../services/muestrasService";

type Orden = {
  id: string;
  codigo: string;
  pacienteId: string;
  paciente: string;
  analisisIds: string[];
};

type Analisis = {
  id: string;
  nombre: string;
};

type Muestra = {
  id: string;
  codigo: string;
  ordenId: string;
  pacienteId: string;
  paciente: string;
  analisisId: string;
  analisis: string;
  tipoMuestra: string;
  estado: string;
  estadoValidacion: string;
  aceptada: boolean;
  motivoRechazo: string;
  fechaToma: string;
  registradoPor: string;
};

type Selector = "orden" | "analisis" | "tipo" | null;

type Filtro = "todas" | "pendientes" | "aceptadas" | "rechazadas";

const TIPOS_MUESTRA = [
  "Sangre",
  "Orina",
  "Heces",
  "Saliva",
  "Plasma",
  "Suero",
  "Hisopado",
  "Otro",
];

const PANTALLAS = [
  {
    nombre: "Registro de muestras",
    ruta: "/muestras",
  },
  {
    nombre: "Recepción y validación",
    ruta: "/validar-muestras",
  },
  {
    nombre: "Seguimiento de muestras",
    ruta: "/seguimiento-muestras",
  },
] as const;

const FILTROS: {
  id: Filtro;
  nombre: string;
}[] = [
  { id: "todas", nombre: "Todas" },
  { id: "pendientes", nombre: "Pendientes" },
  { id: "aceptadas", nombre: "Aceptadas" },
  { id: "rechazadas", nombre: "Rechazadas" },
];

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function formatearFecha(valor: unknown): string {
  if (!valor) {
    return "No registrada";
  }

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof valor.toDate === "function"
  ) {
    const fecha = valor.toDate();

    if (
      fecha instanceof Date &&
      !Number.isNaN(fecha.getTime())
    ) {
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

  return "No registrada";
}

function aviso(titulo: string, mensaje: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }

    return;
  }

  Alert.alert(titulo, mensaje);
}

function mensajeError(error: unknown): string {
  const codigo = (
    error as {
      code?: string;
    }
  )?.code;

  if (
    codigo === "permission-denied" ||
    codigo === "firestore/permission-denied"
  ) {
    return "No tienes permisos para realizar esta operación en Firestore.";
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

function extraerIds(valor: unknown): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  const ids = valor
    .map((item) => {
      if (typeof item === "string") {
        return texto(item);
      }

      if (item && typeof item === "object") {
        const datos = item as Record<string, any>;

        return texto(
          datos.analisisId ||
            datos.id ||
            datos.analisis?.id
        );
      }

      return "";
    })
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function estadoLegible(estado: string): string {
  const estados: Record<string, string> = {
    tomada: "Tomada",
    pendiente: "Pendiente",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    en_proceso: "En proceso",
    procesada: "Procesada",
    validada: "Validada",
  };

  return estados[estado] || estado || "Sin estado";
}

function obtenerColorEstado(estado: string) {
  if (estado === "rechazada") {
    return {
      fondo: "#FEE2E2",
      texto: "#DC2626",
    };
  }

  if (
    estado === "aceptada" ||
    estado === "procesada" ||
    estado === "validada"
  ) {
    return {
      fondo: "#DCFCE7",
      texto: "#15803D",
    };
  }

  if (estado === "en_proceso") {
    return {
      fondo: "#DBEAFE",
      texto: "#2563EB",
    };
  }

  return {
    fondo: "#FEF3C7",
    texto: "#A16207",
  };
}

function estaPendiente(muestra: Muestra): boolean {
  return (
    muestra.estado === "tomada" &&
    muestra.estadoValidacion === "pendiente"
  );
}

export default function GestionMuestrasScreen() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [analisis, setAnalisis] = useState<Analisis[]>([]);
  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [ordenId, setOrdenId] = useState("");
  const [analisisId, setAnalisisId] = useState("");
  const [tipoMuestra, setTipoMuestra] = useState("");

  const [selector, setSelector] = useState<Selector>(null);
  const [detalle, setDetalle] = useState<Muestra | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const cargarDatos = useCallback(
    async (mostrarCarga = true) => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        setError("");

        const usuario = getAuth().currentUser;

        if (!usuario) {
          throw new Error("Debes iniciar sesión.");
        }

        const usuarioDoc = await getDoc(
          doc(db, "usuarios", usuario.uid)
        );

        if (!usuarioDoc.exists()) {
          throw new Error(
            "No se encontró tu usuario en Firestore."
          );
        }

        const datosUsuario = usuarioDoc.data();

        if (datosUsuario.activo !== true) {
          throw new Error(
            "Tu cuenta está inactiva."
          );
        }

        const rol = texto(
          datosUsuario.rol
        ).toLowerCase();

        if (
          rol !== "bioquimico" &&
          rol !== "bioquímico"
        ) {
          throw new Error(
            "Solo el Bioquímico puede gestionar muestras."
          );
        }

        const laboratorioId = texto(
          datosUsuario.laboratorioId
        );

        if (!laboratorioId) {
          throw new Error(
            "No tienes un laboratorio asignado."
          );
        }

        const [
          ordenesFirestore,
          muestrasFirestore,
          analisisSnapshot,
        ] = await Promise.all([
          obtenerOrdenesParaMuestras(),
          obtenerMuestras(),
          getDocs(
            query(
              collection(db, "analisis"),
              where(
                "laboratorioId",
                "==",
                laboratorioId
              )
            )
          ),
        ]);

        const listaAnalisis: Analisis[] =
          analisisSnapshot.docs.map((documento) => {
            const datos = documento.data();

            return {
              id: documento.id,
              nombre:
                texto(
                  datos.nombre ||
                    datos.nombreAnalisis ||
                    datos.descripcion
                ) || documento.id,
            };
          });

        const mapaAnalisis = new Map(
          listaAnalisis.map((item) => [
            item.id,
            item.nombre,
          ])
        );

        const pacientesCache = new Map<
          string,
          string
        >();

        const obtenerNombrePaciente = async (
          pacienteId: string,
          nombreGuardado?: string
        ): Promise<string> => {
          if (texto(nombreGuardado)) {
            return texto(nombreGuardado);
          }

          if (!pacienteId) {
            return "Sin paciente";
          }

          const nombreCache =
            pacientesCache.get(pacienteId);

          if (nombreCache) {
            return nombreCache;
          }

          try {
            const pacienteDoc = await getDoc(
              doc(db, "pacientes", pacienteId)
            );

            if (!pacienteDoc.exists()) {
              return pacienteId;
            }

            const paciente = pacienteDoc.data();

            if (
              texto(paciente.laboratorioId) !==
              laboratorioId
            ) {
              return "Paciente no disponible";
            }

            const nombres = texto(
              paciente.nombres ||
                paciente.nombre
            );

            const apellidos = texto(
              paciente.apellidos ||
                paciente.apellido
            );

            const nombreCompleto =
              `${nombres} ${apellidos}`.trim() ||
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

        const listaOrdenes: Orden[] =
          await Promise.all(
            ordenesFirestore.map(
              async (
                orden: OrdenParaMuestra
              ) => {
                const datos =
                  orden as OrdenParaMuestra &
                    Record<string, any>;

                const pacienteId = texto(
                  datos.pacienteId
                );

                const paciente =
                  await obtenerNombrePaciente(
                    pacienteId,
                    texto(
                      datos.pacienteNombre ||
                        datos.nombrePaciente
                    )
                  );

                const ids = extraerIds(
                  datos.analisis ||
                    datos.analisisIds ||
                    datos.analisisSolicitados
                );

                if (
                  ids.length === 0 &&
                  texto(datos.analisisId)
                ) {
                  ids.push(
                    texto(datos.analisisId)
                  );
                }

                return {
                  id: orden.id,
                  codigo:
                    texto(
                      datos.codigo ||
                        datos.codigoOrden
                    ) || orden.id,
                  pacienteId,
                  paciente,
                  analisisIds: ids,
                };
              }
            )
          );

        const ordenesPorId = new Map(
          listaOrdenes.map((orden) => [
            orden.id,
            orden,
          ])
        );

        const listaMuestras: Muestra[] =
          await Promise.all(
            muestrasFirestore.map(
              async (
                muestra: MuestraFirestore
              ) => {
                const datos =
                  muestra as MuestraFirestore &
                    Record<string, any>;

                const orden =
                  ordenesPorId.get(
                    muestra.ordenId
                  );

                const pacienteId = texto(
                  muestra.pacienteId ||
                    orden?.pacienteId
                );

                const paciente =
                  await obtenerNombrePaciente(
                    pacienteId,
                    texto(
                      datos.pacienteNombre ||
                        datos.nombrePaciente ||
                        orden?.paciente
                    )
                  );

                const idAnalisis = texto(
                  muestra.analisisId
                );

                const nombreAnalisis =
                  texto(
                    datos.analisisNombre ||
                      datos.nombreAnalisis
                  ) ||
                  mapaAnalisis.get(
                    idAnalisis
                  ) ||
                  idAnalisis ||
                  "Sin análisis";

                return {
                  id: muestra.id,
                  codigo:
                    texto(
                      datos.codigo ||
                        datos.codigoMuestra
                    ) || muestra.id,
                  ordenId: texto(
                    muestra.ordenId
                  ),
                  pacienteId,
                  paciente,
                  analisisId: idAnalisis,
                  analisis: nombreAnalisis,
                  tipoMuestra:
                    texto(
                      muestra.tipoMuestra
                    ) || "No especificado",
                  estado:
                    texto(muestra.estado) ||
                    "tomada",
                  estadoValidacion:
                    texto(
                      muestra.estadoValidacion
                    ) || "pendiente",
                  aceptada:
                    muestra.aceptada === true,
                  motivoRechazo: texto(
                    muestra.motivoRechazo
                  ),
                  fechaToma:
                    formatearFecha(
                      datos.fechaToma ||
                        datos.fechaRegistro
                    ),
                  registradoPor: texto(
                    muestra.registradoPor
                  ),
                };
              }
            )
          );

        setOrdenes(listaOrdenes);
        setAnalisis(listaAnalisis);
        setMuestras(listaMuestras);

        setDetalle((anterior) => {
          if (!anterior) {
            return null;
          }

          return (
            listaMuestras.find(
              (item) =>
                item.id === anterior.id
            ) || null
          );
        });
      } catch (e: unknown) {
        setError(mensajeError(e));
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

  const actualizar = useCallback(
    async () => {
      setActualizando(true);
      await cargarDatos(false);
    },
    [cargarDatos]
  );

  const ordenSeleccionada = useMemo(
    () =>
      ordenes.find(
        (orden) => orden.id === ordenId
      ),
    [ordenes, ordenId]
  );

  const analisisDisponibles = useMemo(() => {
    if (!ordenSeleccionada) {
      return [];
    }

    return analisis.filter((item) =>
      ordenSeleccionada.analisisIds.includes(
        item.id
      )
    );
  }, [analisis, ordenSeleccionada]);

  const analisisSeleccionado = useMemo(
    () =>
      analisis.find(
        (item) => item.id === analisisId
      ),
    [analisis, analisisId]
  );

  const ordenesPendientes = useMemo(() => {
    return ordenes.filter((orden) =>
      orden.analisisIds.some(
        (id) =>
          !muestras.some(
            (muestra) =>
              muestra.ordenId === orden.id &&
              muestra.analisisId === id &&
              muestra.estado !== "rechazada"
          )
      )
    );
  }, [ordenes, muestras]);

  const pendientesValidacion = useMemo(
    () => muestras.filter(estaPendiente).length,
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
      if (
        filtro === "pendientes" &&
        !estaPendiente(muestra)
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

      if (!termino) {
        return true;
      }

      const contenido = [
        muestra.codigo,
        muestra.id,
        muestra.paciente,
        muestra.pacienteId,
        muestra.analisis,
        muestra.analisisId,
        muestra.ordenId,
        muestra.tipoMuestra,
        muestra.estado,
        muestra.estadoValidacion,
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(termino);
    });
  }, [muestras, filtro, busqueda]);

  const ordenesDisponibles = useMemo(() => {
    return ordenes.filter((orden) =>
      orden.analisisIds.some(
        (id) =>
          !muestras.some(
            (muestra) =>
              muestra.ordenId === orden.id &&
              muestra.analisisId === id &&
              muestra.estado !== "rechazada"
          )
      )
    );
  }, [ordenes, muestras]);

  const analisisSinMuestra = useMemo(() => {
    if (!ordenSeleccionada) {
      return [];
    }

    return analisisDisponibles.filter(
      (item) =>
        !muestras.some(
          (muestra) =>
            muestra.ordenId ===
              ordenSeleccionada.id &&
            muestra.analisisId === item.id &&
            muestra.estado !== "rechazada"
        )
    );
  }, [
    analisisDisponibles,
    muestras,
    ordenSeleccionada,
  ]);

  const registrar = async () => {
    if (guardando) {
      return;
    }

    if (
      !ordenId ||
      !analisisId ||
      !tipoMuestra
    ) {
      aviso(
        "Campos obligatorios",
        "Selecciona una orden, un análisis y un tipo de muestra."
      );
      return;
    }

    if (!ordenSeleccionada) {
      aviso(
        "Orden inválida",
        "La orden seleccionada no existe."
      );
      return;
    }

    if (
      !ordenSeleccionada.analisisIds.includes(
        analisisId
      )
    ) {
      aviso(
        "Análisis inválido",
        "El análisis seleccionado no pertenece a esta orden."
      );
      return;
    }

    const existe = muestras.some(
      (muestra) =>
        muestra.ordenId === ordenId &&
        muestra.analisisId === analisisId &&
        muestra.estado !== "rechazada"
    );

    if (existe) {
      aviso(
        "Muestra existente",
        "Este análisis ya tiene una muestra activa registrada."
      );
      return;
    }

    try {
      setGuardando(true);

      await registrarMuestra({
        ordenId,
        analisisId,
        tipoMuestra,
      });

      setOrdenId("");
      setAnalisisId("");
      setTipoMuestra("");

      await cargarDatos(false);

      aviso(
        "Registro exitoso",
        "La muestra se registró correctamente y quedó pendiente de validación."
      );
    } catch (e: unknown) {
      aviso(
        "Error al registrar",
        mensajeError(e)
      );
    } finally {
      setGuardando(false);
    }
  };

  const navegar = (ruta: string) => {
    router.push(ruta as any);
  };

  const renderEstado = (estado: string) => {
    const colores =
      obtenerColorEstado(estado);

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
          {estadoLegible(estado)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.contenedor}>
      <View style={styles.barraNavegacion}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.contenidoNavegacion
          }
        >
          {PANTALLAS.map((pantalla) => {
            const activo =
              pantalla.ruta === "/muestras";

            return (
              <Pressable
                key={pantalla.ruta}
                style={[
                  styles.botonNavegacion,
                  activo &&
                    styles.botonNavegacionActivo,
                ]}
                onPress={() =>
                  navegar(pantalla.ruta)
                }
              >
                <Text
                  style={[
                    styles.textoNavegacion,
                    activo &&
                      styles.textoNavegacionActivo,
                  ]}
                >
                  {pantalla.nombre}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.contenido
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={actualizar}
            tintColor="#7C3AED"
            colors={["#7C3AED"]}
          />
        }
      >
        <View style={styles.encabezado}>
          <Pressable
            style={styles.botonVolver}
            onPress={() => router.back()}
          >
            <Text style={styles.textoVolver}>
              ← Volver
            </Text>
          </Pressable>

          <Text
            style={styles.etiquetaSuperior}
          >
            LABORATORIO · BIOQUÍMICO
          </Text>

          <Text style={styles.titulo}>
            Gestión de muestras
          </Text>

          <Text style={styles.subtitulo}>
            Registra las muestras de los
            pacientes y consulta su estado
            durante el procesamiento.
          </Text>
        </View>

        <View style={styles.contadores}>
          <View style={styles.contador}>
            <Text
              style={styles.contadorTitulo}
            >
              ÓRDENES
            </Text>

            <Text
              style={styles.contadorNumero}
            >
              {ordenes.length}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text
              style={styles.contadorTitulo}
            >
              MUESTRAS
            </Text>

            <Text
              style={styles.contadorNumero}
            >
              {muestras.length}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text
              style={styles.contadorTitulo}
            >
              POR REGISTRAR
            </Text>

            <Text
              style={styles.contadorNumero}
            >
              {ordenesPendientes.length}
            </Text>
          </View>
        </View>

        <View style={styles.resumenEstados}>
          <View style={styles.resumenEstado}>
            <Text
              style={[
                styles.resumenNumero,
                { color: "#A16207" },
              ]}
            >
              {pendientesValidacion}
            </Text>

            <Text
              style={styles.resumenEtiqueta}
            >
              Pendientes
            </Text>
          </View>

          <View style={styles.resumenEstado}>
            <Text
              style={[
                styles.resumenNumero,
                { color: "#15803D" },
              ]}
            >
              {aceptadas}
            </Text>

            <Text
              style={styles.resumenEtiqueta}
            >
              Aceptadas
            </Text>
          </View>

          <View style={styles.resumenEstado}>
            <Text
              style={[
                styles.resumenNumero,
                { color: "#DC2626" },
              ]}
            >
              {rechazadas}
            </Text>

            <Text
              style={styles.resumenEtiqueta}
            >
              Rechazadas
            </Text>
          </View>
        </View>

        {error !== "" && (
          <View
            style={styles.errorContenedor}
          >
            <Text style={styles.error}>
              {error}
            </Text>

            <Pressable
              onPress={() =>
                cargarDatos()
              }
            >
              <Text
                style={styles.reintentar}
              >
                Reintentar
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.panelTitulo}>
            Registrar toma de muestra
          </Text>

          <Text
            style={styles.panelDescripcion}
          >
            Selecciona una orden, el
            análisis solicitado y el tipo
            de muestra recolectada.
          </Text>

          <Text style={styles.label}>
            Orden de análisis *
          </Text>

          <Pressable
            style={styles.selector}
            onPress={() =>
              setSelector("orden")
            }
            disabled={
              cargando || guardando
            }
          >
            <Text
              style={
                ordenId
                  ? styles.selectorTexto
                  : styles.selectorPlaceholder
              }
              numberOfLines={2}
            >
              {ordenSeleccionada
                ? `${ordenSeleccionada.codigo} - ${ordenSeleccionada.paciente}`
                : "Seleccionar orden"}
            </Text>

            <Text style={styles.flecha}>
              ›
            </Text>
          </Pressable>

          <Text style={styles.label}>
            Análisis *
          </Text>

          <Pressable
            style={[
              styles.selector,
              !ordenId &&
                styles.selectorDeshabilitado,
            ]}
            disabled={
              !ordenId ||
              cargando ||
              guardando
            }
            onPress={() =>
              setSelector("analisis")
            }
          >
            <Text
              style={
                analisisId
                  ? styles.selectorTexto
                  : styles.selectorPlaceholder
              }
              numberOfLines={2}
            >
              {!ordenId
                ? "Primero selecciona una orden"
                : analisisSeleccionado
                ? analisisSeleccionado.nombre
                : "Seleccionar análisis"}
            </Text>

            <Text style={styles.flecha}>
              ›
            </Text>
          </Pressable>

          <Text style={styles.label}>
            Tipo de muestra *
          </Text>

          <Pressable
            style={styles.selector}
            onPress={() =>
              setSelector("tipo")
            }
            disabled={
              cargando || guardando
            }
          >
            <Text
              style={
                tipoMuestra
                  ? styles.selectorTexto
                  : styles.selectorPlaceholder
              }
            >
              {tipoMuestra ||
                "Seleccionar tipo de muestra"}
            </Text>

            <Text style={styles.flecha}>
              ›
            </Text>
          </Pressable>

          {ordenSeleccionada &&
            analisisSeleccionado && (
              <View
                style={
                  styles.resumenRegistro
                }
              >
                <Text
                  style={
                    styles.resumenRegistroTitulo
                  }
                >
                  Resumen del registro
                </Text>

                <Text
                  style={
                    styles.resumenRegistroTexto
                  }
                >
                  Paciente:{" "}
                  {
                    ordenSeleccionada.paciente
                  }
                </Text>

                <Text
                  style={
                    styles.resumenRegistroTexto
                  }
                >
                  Análisis:{" "}
                  {
                    analisisSeleccionado.nombre
                  }
                </Text>

                <Text
                  style={
                    styles.resumenRegistroTexto
                  }
                >
                  Muestra:{" "}
                  {tipoMuestra ||
                    "Sin seleccionar"}
                </Text>
              </View>
            )}

          <Pressable
            style={[
              styles.botonRegistrar,
              (guardando || cargando) &&
                styles.botonDeshabilitado,
            ]}
            disabled={
              guardando || cargando
            }
            onPress={registrar}
          >
            {guardando ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.botonRegistrarTexto
                }
              >
                Registrar muestra
              </Text>
            )}
          </Pressable>

          <Pressable
            style={
              styles.botonSecundario
            }
            onPress={() =>
              navegar(
                "/validar-muestras"
              )
            }
          >
            <Text
              style={
                styles.botonSecundarioTexto
              }
            >
              Ir a recepción y validación
            </Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View
            style={styles.tituloFila}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={styles.panelTitulo}
              >
                Muestras registradas
              </Text>

              <Text
                style={
                  styles.panelDescripcion
                }
              >
                Consulta las muestras y
                sus estados de validación.
              </Text>
            </View>

            <Pressable
              style={
                styles.botonActualizar
              }
              disabled={
                actualizando ||
                guardando
              }
              onPress={actualizar}
            >
              <Text
                style={
                  styles.textoActualizar
                }
              >
                Actualizar
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.buscador}
            placeholder="Buscar por paciente, código, análisis u orden..."
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
            autoCapitalize="none"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filtros
            }
          >
            {FILTROS.map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.filtroBoton,
                  filtro === item.id &&
                    styles.filtroActivo,
                ]}
                onPress={() =>
                  setFiltro(item.id)
                }
              >
                <Text
                  style={[
                    styles.filtroTexto,
                    filtro === item.id &&
                      styles.filtroTextoActivo,
                  ]}
                >
                  {item.nombre}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text
            style={
              styles.cantidadResultados
            }
          >
            {
              muestrasFiltradas.length
            }{" "}
            muestra(s) encontrada(s)
          </Text>

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#7C3AED"
              style={{
                marginVertical: 30,
              }}
            />
          ) : muestrasFiltradas.length ===
            0 ? (
            <View
              style={styles.vacio}
            >
              <Text
                style={
                  styles.vacioTitulo
                }
              >
                No se encontraron muestras
              </Text>

              <Text
                style={
                  styles.vacioDescripcion
                }
              >
                {busqueda
                  ? "Prueba con otro término de búsqueda."
                  : "No hay muestras que coincidan con el filtro seleccionado."}
              </Text>
            </View>
          ) : (
            muestrasFiltradas.map(
              (muestra) => (
                <Pressable
                  key={muestra.id}
                  style={
                    styles.tarjetaMuestra
                  }
                  onPress={() =>
                    setDetalle(muestra)
                  }
                >
                  <View
                    style={
                      styles.muestraEncabezado
                    }
                  >
                    <View
                      style={
                        styles.iconoMuestra
                      }
                    >
                      <Text
                        style={
                          styles.iconoTexto
                        }
                      >
                        M
                      </Text>
                    </View>

                    <View
                      style={
                        styles.muestraInfo
                      }
                    >
                      <Text
                        style={
                          styles.codigoMuestra
                        }
                      >
                        {muestra.codigo}
                      </Text>

                      <Text
                        style={
                          styles.nombrePaciente
                        }
                      >
                        {muestra.paciente}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.flecha
                      }
                    >
                      ›
                    </Text>
                  </View>

                  <View
                    style={
                      styles.separador
                    }
                  />

                  <Text
                    style={
                      styles.datoTitulo
                    }
                  >
                    ANÁLISIS
                  </Text>

                  <Text
                    style={
                      styles.datoValor
                    }
                  >
                    {muestra.analisis}
                  </Text>

                  <Text
                    style={
                      styles.datoTitulo
                    }
                  >
                    TIPO DE MUESTRA
                  </Text>

                  <Text
                    style={
                      styles.datoValor
                    }
                  >
                    {
                      muestra.tipoMuestra
                    }
                  </Text>

                  <Text
                    style={
                      styles.datoTitulo
                    }
                  >
                    ESTADO
                  </Text>

                  {renderEstado(
                    muestra.estado
                  )}

                  <Text
                    style={
                      styles.datoTitulo
                    }
                  >
                    VALIDACIÓN
                  </Text>

                  {renderEstado(
                    muestra.estadoValidacion
                  )}

                  <Text
                    style={
                      styles.datoTitulo
                    }
                  >
                    FECHA DE TOMA
                  </Text>

                  <Text
                    style={
                      styles.datoValor
                    }
                  >
                    {muestra.fechaToma}
                  </Text>

                  {muestra.estadoValidacion ===
                    "rechazada" &&
                    muestra.motivoRechazo !==
                      "" && (
                      <View
                        style={
                          styles.rechazoContenedor
                        }
                      >
                        <Text
                          style={
                            styles.rechazoTexto
                          }
                        >
                          Motivo:{" "}
                          {
                            muestra.motivoRechazo
                          }
                        </Text>
                      </View>
                    )}
                </Pressable>
              )
            )
          )}
        </View>
      </ScrollView>

      <Modal
        visible={selector !== null}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setSelector(null)
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
              {selector === "orden"
                ? "Seleccionar orden"
                : selector ===
                  "analisis"
                ? "Seleccionar análisis"
                : "Seleccionar tipo de muestra"}
            </Text>

            <ScrollView
              style={
                styles.listaOpciones
              }
              keyboardShouldPersistTaps="handled"
            >
              {selector === "orden" &&
                ordenesDisponibles.map(
                  (orden) => (
                    <Pressable
                      key={orden.id}
                      style={
                        styles.opcion
                      }
                      onPress={() => {
                        setOrdenId(
                          orden.id
                        );
                        setAnalisisId(
                          ""
                        );
                        setSelector(
                          null
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.opcionTitulo
                        }
                      >
                        {orden.codigo}
                      </Text>

                      <Text
                        style={
                          styles.opcionDescripcion
                        }
                      >
                        {orden.paciente}
                      </Text>
                    </Pressable>
                  )
                )}

              {selector ===
                "analisis" &&
                analisisSinMuestra.map(
                  (item) => (
                    <Pressable
                      key={item.id}
                      style={
                        styles.opcion
                      }
                      onPress={() => {
                        setAnalisisId(
                          item.id
                        );
                        setSelector(
                          null
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.opcionTitulo
                        }
                      >
                        {item.nombre}
                      </Text>
                    </Pressable>
                  )
                )}

              {selector === "tipo" &&
                TIPOS_MUESTRA.map(
                  (tipo) => (
                    <Pressable
                      key={tipo}
                      style={
                        styles.opcion
                      }
                      onPress={() => {
                        setTipoMuestra(
                          tipo
                        );
                        setSelector(
                          null
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.opcionTitulo
                        }
                      >
                        {tipo}
                      </Text>
                    </Pressable>
                  )
                )}

              {selector === "orden" &&
                ordenesDisponibles.length ===
                  0 && (
                  <Text
                    style={
                      styles.sinDatos
                    }
                  >
                    No hay órdenes con
                    análisis pendientes de
                    registrar.
                  </Text>
                )}

              {selector ===
                "analisis" &&
                analisisSinMuestra.length ===
                  0 && (
                  <Text
                    style={
                      styles.sinDatos
                    }
                  >
                    No hay análisis
                    disponibles para esta
                    orden.
                  </Text>
                )}
            </ScrollView>

            <Pressable
              style={
                styles.botonCerrar
              }
              onPress={() =>
                setSelector(null)
              }
            >
              <Text
                style={
                  styles.textoCerrar
                }
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={detalle !== null}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDetalle(null)
        }
      >
        <View
          style={styles.fondoModal}
        >
          <View style={styles.modal}>
            <ScrollView>
              <Text
                style={
                  styles.modalTitulo
                }
              >
                Detalle de muestra
              </Text>

              {detalle && (
                <>
                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Código
                  </Text>

                  <Text
                    style={
                      styles.detalleValor
                    }
                  >
                    {detalle.codigo}
                  </Text>

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Paciente
                  </Text>

                  <Text
                    style={
                      styles.detalleValor
                    }
                  >
                    {detalle.paciente}
                  </Text>

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Orden
                  </Text>

                  <Text
                    style={
                      styles.detalleValor
                    }
                  >
                    {detalle.ordenId}
                  </Text>

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Análisis
                  </Text>

                  <Text
                    style={
                      styles.detalleValor
                    }
                  >
                    {detalle.analisis}
                  </Text>

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Tipo de muestra
                  </Text>

                  <Text
                    style={
                      styles.detalleValor
                    }
                  >
                    {
                      detalle.tipoMuestra
                    }
                  </Text>

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Estado de la muestra
                  </Text>

                  {renderEstado(
                    detalle.estado
                  )}

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Estado de validación
                  </Text>

                  {renderEstado(
                    detalle.estadoValidacion
                  )}

                  <Text
                    style={
                      styles.detalleTitulo
                    }
                  >
                    Fecha de toma
                  </Text>

                  <Text
                    style={
                      styles.detalleValor
                    }
                  >
                    {detalle.fechaToma}
                  </Text>

                  {detalle.motivoRechazo ? (
                    <>
                      <Text
                        style={
                          styles.detalleTitulo
                        }
                      >
                        Motivo del rechazo
                      </Text>

                      <Text
                        style={
                          styles.detalleValor
                        }
                      >
                        {
                          detalle.motivoRechazo
                        }
                      </Text>
                    </>
                  ) : null}

                  {estaPendiente(
                    detalle
                  ) && (
                    <Pressable
                      style={
                        styles.botonValidacion
                      }
                      onPress={() => {
                        setDetalle(null);

                        navegar(
                          "/validar-muestras"
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.botonValidacionTexto
                        }
                      >
                        Ir a validar muestra
                      </Text>
                    </Pressable>
                  )}
                </>
              )}

              <Pressable
                style={
                  styles.botonCerrar
                }
                onPress={() =>
                  setDetalle(null)
                }
              >
                <Text
                  style={
                    styles.textoCerrar
                  }
                >
                  Cerrar
                </Text>
              </Pressable>
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
    backgroundColor: "#F1F5F9",
  },

  barraNavegacion: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  contenidoNavegacion: {
    paddingHorizontal: 12,
    gap: 9,
    alignItems: "center",
  },

  botonNavegacion: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  botonNavegacionActivo: {
    backgroundColor: "#17365D",
  },

  textoNavegacion: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },

  textoNavegacionActivo: {
    color: "#FFFFFF",
  },

  contenido: {
    padding: 14,
    paddingBottom: 40,
  },

  encabezado: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  botonVolver: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginBottom: 18,
  },

  textoVolver: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },

  etiquetaSuperior: {
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },

  titulo: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 7,
  },

  subtitulo: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 19,
  },

  contadores: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 12,
  },

  contador: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
  },

  contadorNumero: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 6,
  },

  resumenEstados: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  resumenEstado: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    alignItems: "center",
  },

  resumenNumero: {
    fontSize: 20,
    fontWeight: "900",
    color: "#17365D",
  },

  resumenEtiqueta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "700",
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  panelTitulo: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 6,
  },

  panelDescripcion: {
    color: "#64748B",
    fontSize: 11,
    marginBottom: 16,
    lineHeight: 17,
  },

  tituloFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    marginTop: 12,
  },

  selector: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    minHeight: 49,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  selectorDeshabilitado: {
    backgroundColor: "#F8FAFC",
    borderColor: "#F1F5F9",
  },

  selectorTexto: {
    color: "#0F172A",
    fontSize: 12,
    flex: 1,
  },

  selectorPlaceholder: {
    color: "#94A3B8",
    fontSize: 12,
    flex: 1,
  },

  flecha: {
    color: "#7C3AED",
    fontSize: 25,
    fontWeight: "700",
    marginLeft: 10,
  },

  resumenRegistro: {
    backgroundColor: "#F5F3FF",
    borderRadius: 9,
    padding: 12,
    marginTop: 17,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },

  resumenRegistroTitulo: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B21B6",
    marginBottom: 9,
  },

  resumenRegistroTexto: {
    fontSize: 12,
    color: "#334155",
    marginBottom: 6,
  },

  botonRegistrar: {
    backgroundColor: "#7C3AED",
    borderRadius: 9,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },

  botonRegistrarTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  botonSecundario: {
    backgroundColor: "#EDE9FE",
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },

  botonSecundarioTexto: {
    color: "#6D28D9",
    fontSize: 12,
    fontWeight: "900",
  },

  botonActualizar: {
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  textoActualizar: {
    color: "#6D28D9",
    fontSize: 11,
    fontWeight: "800",
  },

  buscador: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 12,
    color: "#0F172A",
    marginBottom: 14,
  },

  filtros: {
    gap: 8,
    paddingBottom: 5,
  },

  filtroBoton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  filtroActivo: {
    backgroundColor: "#17365D",
    borderColor: "#17365D",
  },

  filtroTexto: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },

  filtroTextoActivo: {
    color: "#FFFFFF",
  },

  cantidadResultados: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 13,
    marginBottom: 12,
  },

  tarjetaMuestra: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },

  muestraEncabezado: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconoMuestra: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },

  iconoTexto: {
    fontSize: 20,
    fontWeight: "900",
    color: "#7C3AED",
  },

  muestraInfo: {
    flex: 1,
    marginLeft: 10,
  },

  codigoMuestra: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
  },

  nombrePaciente: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },

  separador: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },

  datoTitulo: {
    fontSize: 9,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 4,
    marginTop: 5,
  },

  datoValor: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },

  estadoBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },

  estadoTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  rechazoContenedor: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },

  rechazoTexto: {
    color: "#B91C1C",
    fontSize: 11,
    lineHeight: 17,
  },

  vacio: {
    alignItems: "center",
    padding: 25,
  },

  vacioTitulo: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },

  vacioDescripcion: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
  },

  sinDatos: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
    padding: 20,
  },

  errorContenedor: {
    backgroundColor: "#FEF2F2",
    borderRadius: 9,
    padding: 12,
    marginBottom: 12,
  },

  error: {
    color: "#DC2626",
    fontSize: 12,
    lineHeight: 18,
  },

  reintentar: {
    color: "#B91C1C",
    fontWeight: "900",
    fontSize: 12,
    marginTop: 10,
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 20,
    maxHeight: "85%",
  },

  modalTitulo: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 15,
  },

  listaOpciones: {
    maxHeight: 350,
  },

  opcion: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 14,
  },

  opcionTitulo: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },

  opcionDescripcion: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  botonCerrar: {
    backgroundColor: "#7C3AED",
    borderRadius: 9,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },

  textoCerrar: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  detalleTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 13,
  },

  detalleValor: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 5,
  },

  botonValidacion: {
    backgroundColor: "#15803D",
    borderRadius: 9,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },

  botonValidacionTexto: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
});