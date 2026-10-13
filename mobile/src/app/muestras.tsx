import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router } from "expo-router";
import { getAuth } from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

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
  fechaToma: string;
};

type Selector = "orden" | "analisis" | "tipo" | null;

// =====================================================
// FUNCIONES
// =====================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

function fecha(valor: any): string {
  if (!valor) return "";

  if (typeof valor.toDate === "function") {
    return valor.toDate().toLocaleString("es-BO");
  }

  if (valor instanceof Date) {
    return valor.toLocaleString("es-BO");
  }

  return texto(valor);
}

function aviso(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }
  } else {
    Alert.alert(titulo, mensaje);
  }
}

function extraerIds(valor: any): string[] {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object") {
        return texto(
          item.analisisId ||
          item.id ||
          item.analisis?.id
        );
      }

      return "";
    })
    .filter(Boolean);
}

function generarCodigo(): string {
  const ahora = new Date();

  const fechaCodigo =
    ahora.getFullYear().toString() +
    String(ahora.getMonth() + 1).padStart(2, "0") +
    String(ahora.getDate()).padStart(2, "0");

  const numero = Math.floor(1000 + Math.random() * 9000);

  return `MUE-${fechaCodigo}-${numero}`;
}

// =====================================================
// BOTONES DE NAVEGACIÓN
// =====================================================

const pantallas = [
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
  {
    nombre: "Registro de resultados",
    ruta: "/registro-resultados",
  },
  {
    nombre: "Valores por parámetros",
    ruta: "/valores-parametros",
  },
  {
    nombre: "Estado de análisis",
    ruta: "/estado-analisis",
  },
  {
    nombre: "Validación de resultados",
    ruta: "/validacion-resultados",
  },
] as const;

// =====================================================
// PANTALLA
// =====================================================

export default function GestionMuestrasScreen() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [analisis, setAnalisis] = useState<Analisis[]>([]);
  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [laboratorioId, setLaboratorioId] = useState("");

  const [ordenId, setOrdenId] = useState("");
  const [analisisId, setAnalisisId] = useState("");
  const [tipoMuestra, setTipoMuestra] = useState("");

  const [selector, setSelector] = useState<Selector>(null);
  const [detalle, setDetalle] = useState<Muestra | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const tiposMuestra = [
    "Sangre",
    "Orina",
    "Heces",
    "Saliva",
    "Plasma",
    "Suero",
    "Hisopado",
    "Otro",
  ];

  // ===================================================
  // CARGAR DATOS
  // ===================================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      const usuarioDoc = await getDoc(
        doc(db, "usuarios", usuario.uid)
      );

      if (!usuarioDoc.exists()) {
        throw new Error("Usuario no encontrado.");
      }

      const datosUsuario = usuarioDoc.data();

      if (datosUsuario.activo === false) {
        throw new Error("Tu usuario está desactivado.");
      }

      const labId = texto(datosUsuario.laboratorioId);

      if (!labId) {
        throw new Error("No tienes laboratorio asignado.");
      }

      setLaboratorioId(labId);

      const [ordenesSnap, analisisSnap, muestrasSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, "ordenes"),
              where("laboratorioId", "==", labId)
            )
          ),

          getDocs(
            query(
              collection(db, "analisis"),
              where("laboratorioId", "==", labId)
            )
          ),

          getDocs(
            query(
              collection(db, "muestras"),
              where("laboratorioId", "==", labId)
            )
          ),
        ]);

      // ANÁLISIS

      const listaAnalisis: Analisis[] = analisisSnap.docs.map(
        (documento) => {
          const datos = documento.data();

          return {
            id: documento.id,
            nombre: texto(
              datos.nombre ||
              datos.nombreAnalisis ||
              datos.descripcion ||
              documento.id
            ),
          };
        }
      );

      setAnalisis(listaAnalisis);

      // PACIENTES

      const pacientesCache: Record<string, string> = {};

      const obtenerPaciente = async (pacienteId: string) => {
        if (!pacienteId) return "Sin paciente";

        if (pacientesCache[pacienteId]) {
          return pacientesCache[pacienteId];
        }

        try {
          const documento = await getDoc(
            doc(db, "pacientes", pacienteId)
          );

          if (!documento.exists()) return pacienteId;

          const datos = documento.data();

          const nombre = texto(datos.nombre || datos.nombres);
          const apellido = texto(datos.apellido || datos.apellidos);

          const completo =
            `${nombre} ${apellido}`.trim() || pacienteId;

          pacientesCache[pacienteId] = completo;

          return completo;
        } catch {
          return pacienteId;
        }
      };

      // ÓRDENES

      const listaOrdenes: Orden[] = await Promise.all(
        ordenesSnap.docs.map(async (documento) => {
          const datos = documento.data();

          const pacienteId = texto(datos.pacienteId);

          const paciente =
            texto(datos.pacienteNombre || datos.nombrePaciente) ||
            (await obtenerPaciente(pacienteId));

          return {
            id: documento.id,
            codigo: texto(
              datos.codigo ||
              datos.codigoOrden ||
              documento.id
            ),
            pacienteId,
            paciente,
            analisisIds: extraerIds(
              datos.analisis ||
              datos.analisisIds ||
              datos.analisisSolicitados
            ),
          };
        })
      );

      setOrdenes(listaOrdenes);

      // MUESTRAS

      const listaMuestras: Muestra[] = await Promise.all(
        muestrasSnap.docs.map(async (documento) => {
          const datos = documento.data();

          const pacienteId = texto(datos.pacienteId);
          const analisisId = texto(datos.analisisId);

          const paciente =
            texto(datos.pacienteNombre || datos.nombrePaciente) ||
            (await obtenerPaciente(pacienteId));

          const analisisEncontrado = listaAnalisis.find(
            (item) => item.id === analisisId
          );

          return {
            id: documento.id,

            codigo: texto(
              datos.codigo ||
              datos.codigoMuestra ||
              documento.id
            ),

            ordenId: texto(datos.ordenId),

            pacienteId,
            paciente,

            analisisId,

            analisis:
              texto(datos.analisisNombre || datos.nombreAnalisis) ||
              analisisEncontrado?.nombre ||
              analisisId,

            tipoMuestra: texto(
              datos.tipoMuestra ||
              datos.tipo ||
              "-"
            ),

            estado: texto(datos.estado || "tomada"),

            fechaToma: fecha(datos.fechaToma),
          };
        })
      );

      setMuestras(listaMuestras);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar los datos."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // SELECCIONES
  // ===================================================

  const ordenSeleccionada = ordenes.find(
    (orden) => orden.id === ordenId
  );

  const analisisDisponibles = analisis.filter(
    (item) =>
      ordenSeleccionada?.analisisIds.includes(item.id)
  );

  const analisisSeleccionado = analisis.find(
    (item) => item.id === analisisId
  );

  // ===================================================
  // CONTADORES
  // ===================================================

  const pendientes = ordenes.filter(
    (orden) =>
      !muestras.some(
        (muestra) => muestra.ordenId === orden.id
      )
  ).length;

  // ===================================================
  // REGISTRAR MUESTRA
  // ===================================================

  const registrarMuestra = async () => {
    if (guardando) return;

    if (!ordenId || !analisisId || !tipoMuestra) {
      aviso(
        "Campos obligatorios",
        "Selecciona una orden, un análisis y un tipo de muestra."
      );
      return;
    }

    if (!ordenSeleccionada) {
      aviso("Error", "La orden seleccionada no existe.");
      return;
    }

    if (!ordenSeleccionada.analisisIds.includes(analisisId)) {
      aviso(
        "Error",
        "El análisis no pertenece a la orden."
      );
      return;
    }

    const existe = muestras.some(
      (muestra) =>
        muestra.ordenId === ordenId &&
        muestra.analisisId === analisisId
    );

    if (existe) {
      aviso(
        "Muestra existente",
        "Este análisis ya tiene una muestra registrada."
      );
      return;
    }

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      await addDoc(collection(db, "muestras"), {
        codigo: generarCodigo(),
        laboratorioId,
        ordenId,
        pacienteId: ordenSeleccionada.pacienteId,
        pacienteNombre: ordenSeleccionada.paciente,
        analisisId,
        analisisNombre: analisisSeleccionado?.nombre || "",
        tipoMuestra,
        estado: "tomada",
        estadoValidacion: "pendiente",
        fechaToma: serverTimestamp(),
        registradoPor: usuario.uid,
        fechaRegistro: serverTimestamp(),
      });

      setOrdenId("");
      setAnalisisId("");
      setTipoMuestra("");

      await cargarDatos();

      aviso(
        "Correcto",
        "La muestra se registró correctamente."
      );
    } catch (e: unknown) {
      aviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudo registrar la muestra."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // NAVEGACIÓN
  // ===================================================

  const navegar = (ruta: string) => {
    router.push(ruta as any);
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      {/* ===============================================
          BARRA DE LOS 7 BOTONES
      =============================================== */}

      <View style={styles.barraNavegacion}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contenidoNavegacion}
        >
          {pantallas.map((pantalla) => {
            const activo = pantalla.ruta === "/muestras";

            return (
              <Pressable
                key={pantalla.ruta}
                style={[
                  styles.botonNavegacion,
                  activo && styles.botonNavegacionActivo,
                ]}
                onPress={() => navegar(pantalla.ruta)}
              >
                <Text
                  style={[
                    styles.textoNavegacion,
                    activo && styles.textoNavegacionActivo,
                  ]}
                >
                  {pantalla.nombre}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ===============================================
          CONTENIDO DE REGISTRO DE MUESTRAS
      =============================================== */}

      <ScrollView contentContainerStyle={styles.contenido}>
        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <Pressable
            style={styles.botonVolver}
            onPress={() => router.back()}
          >
            <Text style={styles.textoVolver}>
              ← Volver
            </Text>
          </Pressable>

          <Text style={styles.etiquetaSuperior}>
            LABORATORIO
          </Text>

          <Text style={styles.titulo}>
            Gestión de muestras
          </Text>

          <Text style={styles.subtitulo}>
            Registra y consulta muestras asociadas a las
            órdenes del laboratorio.
          </Text>
        </View>

        {/* CONTADORES */}

        <View style={styles.contadores}>
          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              ÓRDENES
            </Text>

            <Text style={styles.contadorNumero}>
              {ordenes.length}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              MUESTRAS
            </Text>

            <Text style={styles.contadorNumero}>
              {muestras.length}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              PENDIENTES
            </Text>

            <Text style={styles.contadorNumero}>
              {pendientes}
            </Text>
          </View>
        </View>

        {/* REGISTRAR TOMA DE MUESTRA */}

        <View style={styles.panel}>
          <Text style={styles.panelTitulo}>
            Registrar toma de muestra
          </Text>

          <Text style={styles.panelDescripcion}>
            Selecciona una orden, el análisis y el tipo
            de muestra.
          </Text>

          {/* ORDEN */}

          <Text style={styles.label}>
            Orden
          </Text>

          <Pressable
            style={styles.selector}
            onPress={() => setSelector("orden")}
          >
            <Text
              style={
                ordenId
                  ? styles.selectorTexto
                  : styles.selectorPlaceholder
              }
            >
              {ordenSeleccionada
                ? `${ordenSeleccionada.codigo} - ${ordenSeleccionada.paciente}`
                : "Seleccionar orden"}
            </Text>

            <Text style={styles.flecha}>
              ›
            </Text>
          </Pressable>

          {/* ANÁLISIS */}

          <Text style={styles.label}>
            Análisis
          </Text>

          <Pressable
            style={[
              styles.selector,
              !ordenId && styles.selectorDeshabilitado,
            ]}
            disabled={!ordenId}
            onPress={() => setSelector("analisis")}
          >
            <Text
              style={
                analisisId
                  ? styles.selectorTexto
                  : styles.selectorPlaceholder
              }
            >
              {!ordenId
                ? "Primero selecciona una orden."
                : analisisSeleccionado
                ? analisisSeleccionado.nombre
                : "Seleccionar análisis"}
            </Text>

            <Text style={styles.flecha}>
              {ordenId ? "›" : ""}
            </Text>
          </Pressable>

          {/* TIPO */}

          <Text style={styles.label}>
            Tipo de muestra
          </Text>

          <Pressable
            style={styles.selector}
            onPress={() => setSelector("tipo")}
          >
            <Text
              style={
                tipoMuestra
                  ? styles.selectorTexto
                  : styles.selectorPlaceholder
              }
            >
              {tipoMuestra || "Seleccionar tipo"}
            </Text>

            <Text style={styles.flecha}>
              ›
            </Text>
          </Pressable>

          {/* REGISTRAR */}

          <Pressable
            style={[
              styles.botonRegistrar,
              guardando && styles.botonDeshabilitado,
            ]}
            disabled={guardando}
            onPress={registrarMuestra}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.botonRegistrarTexto}>
                Registrar muestra
              </Text>
            )}
          </Pressable>
        </View>

        {/* MUESTRAS REGISTRADAS */}

        <View style={styles.panel}>
          <Text style={styles.panelTitulo}>
            Muestras registradas
          </Text>

          <Text style={styles.panelDescripcion}>
            Muestras tomadas en el laboratorio.
          </Text>

          {error !== "" && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#8B5CF6"
              style={{ marginVertical: 25 }}
            />
          ) : muestras.length === 0 ? (
            <Text style={styles.sinDatos}>
              No hay muestras registradas.
            </Text>
          ) : (
            muestras.map((muestra) => (
              <Pressable
                key={muestra.id}
                style={styles.tarjetaMuestra}
                onPress={() => setDetalle(muestra)}
              >
                <View style={styles.muestraEncabezado}>
                  <View style={styles.iconoMuestra}>
                    <Text style={styles.iconoTexto}>
                      🧪
                    </Text>
                  </View>

                  <View style={styles.muestraInfo}>
                    <Text style={styles.codigoMuestra}>
                      {muestra.codigo}
                    </Text>

                    <Text style={styles.nombrePaciente}>
                      {muestra.paciente}
                    </Text>
                  </View>

                  <Text style={styles.flecha}>
                    ›
                  </Text>
                </View>

                <View style={styles.separador} />

                <Text style={styles.datoTitulo}>
                  ANÁLISIS
                </Text>

                <Text style={styles.datoValor}>
                  {muestra.analisis}
                </Text>

                <Text style={styles.datoTitulo}>
                  TIPO
                </Text>

                <Text style={styles.datoValor}>
                  {muestra.tipoMuestra}
                </Text>

                <Text style={styles.datoTitulo}>
                  ESTADO
                </Text>

                <Text style={styles.datoValor}>
                  {muestra.estado}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* SELECTORES */}

      <Modal
        visible={selector !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelector(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>
              {selector === "orden"
                ? "Seleccionar orden"
                : selector === "analisis"
                ? "Seleccionar análisis"
                : "Seleccionar tipo de muestra"}
            </Text>

            <ScrollView style={styles.listaOpciones}>
              {selector === "orden" &&
                ordenes.map((orden) => (
                  <Pressable
                    key={orden.id}
                    style={styles.opcion}
                    onPress={() => {
                      setOrdenId(orden.id);
                      setAnalisisId("");
                      setSelector(null);
                    }}
                  >
                    <Text style={styles.opcionTitulo}>
                      {orden.codigo}
                    </Text>

                    <Text style={styles.opcionDescripcion}>
                      {orden.paciente}
                    </Text>
                  </Pressable>
                ))}

              {selector === "analisis" &&
                analisisDisponibles.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.opcion}
                    onPress={() => {
                      setAnalisisId(item.id);
                      setSelector(null);
                    }}
                  >
                    <Text style={styles.opcionTitulo}>
                      {item.nombre}
                    </Text>
                  </Pressable>
                ))}

              {selector === "tipo" &&
                tiposMuestra.map((tipo) => (
                  <Pressable
                    key={tipo}
                    style={styles.opcion}
                    onPress={() => {
                      setTipoMuestra(tipo);
                      setSelector(null);
                    }}
                  >
                    <Text style={styles.opcionTitulo}>
                      {tipo}
                    </Text>
                  </Pressable>
                ))}

              {selector === "analisis" &&
                analisisDisponibles.length === 0 && (
                  <Text style={styles.sinDatos}>
                    No se encontraron análisis para esta orden.
                  </Text>
                )}
            </ScrollView>

            <Pressable
              style={styles.botonCerrar}
              onPress={() => setSelector(null)}
            >
              <Text style={styles.textoCerrar}>
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* DETALLE */}

      <Modal
        visible={detalle !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetalle(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitulo}>
                Detalle de muestra
              </Text>

              <Text style={styles.detalleTitulo}>
                Código
              </Text>
              <Text style={styles.detalleValor}>
                {detalle?.codigo}
              </Text>

              <Text style={styles.detalleTitulo}>
                Paciente
              </Text>
              <Text style={styles.detalleValor}>
                {detalle?.paciente}
              </Text>

              <Text style={styles.detalleTitulo}>
                Análisis
              </Text>
              <Text style={styles.detalleValor}>
                {detalle?.analisis}
              </Text>

              <Text style={styles.detalleTitulo}>
                Tipo
              </Text>
              <Text style={styles.detalleValor}>
                {detalle?.tipoMuestra}
              </Text>

              <Text style={styles.detalleTitulo}>
                Estado
              </Text>
              <Text style={styles.detalleValor}>
                {detalle?.estado}
              </Text>

              <Text style={styles.detalleTitulo}>
                Fecha de toma
              </Text>
              <Text style={styles.detalleValor}>
                {detalle?.fechaToma || "No registrada"}
              </Text>

              <Pressable
                style={styles.botonCerrar}
                onPress={() => setDetalle(null)}
              >
                <Text style={styles.textoCerrar}>
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

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  // NAVEGACIÓN

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

  // CONTENIDO

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
    gap: 6,
    marginBottom: 12,
  },

  contador: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
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
    marginBottom: 19,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    marginTop: 10,
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

  botonRegistrar: {
    backgroundColor: "#B794F4",
    borderRadius: 9,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  botonRegistrarTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
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

  sinDatos: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
    padding: 20,
  },

  error: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 12,
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
    maxHeight: "80%",
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
});