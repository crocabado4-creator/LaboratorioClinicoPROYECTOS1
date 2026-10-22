import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type EstadoMuestra = "tomada" | "aceptada" | "rechazada" | "en_proceso" | "procesada";
type Filtro = "todas" | EstadoMuestra;
type Sesion = { uid: string; laboratorioId: string };
type Muestra = {
  id: string;
  codigo: string;
  paciente: string;
  pacienteId: string;
  analisis: string;
  analisisId: string;
  ordenId: string;
  tipo: string;
  laboratorioId: string;
  estado: EstadoMuestra;
  estadoValidacion: string;
  fechaToma: string;
  fechaInicioProceso: string;
  fechaProcesamiento: string;
  motivoRechazo: string;
};

const C = {
  fondo: "#F2F6FC",
  blanco: "#FFFFFF",
  principal: "#15365C",
  azul: "#2563EB",
  texto: "#14233A",
  secundario: "#64748B",
  borde: "#DFE7F1",
  tenue: "#EFF5FF",
  verde: "#059669",
  rojo: "#DC2626",
  ambar: "#D97706",
};

const ETAPAS: EstadoMuestra[] = ["tomada", "aceptada", "en_proceso", "procesada"];
const FILTROS: { valor: Filtro; titulo: string }[] = [
  { valor: "todas", titulo: "Todas" },
  { valor: "tomada", titulo: "Tomadas" },
  { valor: "aceptada", titulo: "Aceptadas" },
  { valor: "en_proceso", titulo: "En proceso" },
  { valor: "procesada", titulo: "Procesadas" },
  { valor: "rechazada", titulo: "Rechazadas" },
];

function texto(valor: unknown): string {
  return valor === undefined || valor === null ? "" : String(valor).trim();
}
function normalizar(valor: unknown): string {
  return texto(valor).toLowerCase();
}
function estadoMuestra(valor: unknown): EstadoMuestra {
  const estado = normalizar(valor).replace(/ /g, "_");
  if (estado === "aceptada" || estado === "aceptado") return "aceptada";
  if (estado === "rechazada" || estado === "rechazado") return "rechazada";
  if (estado === "en_proceso" || estado === "procesando") return "en_proceso";
  if (estado === "procesada" || estado === "procesado") return "procesada";
  return "tomada";
}
function nombreEstado(estado: EstadoMuestra): string {
  return {
    tomada: "Tomada",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    en_proceso: "En proceso",
    procesada: "Procesada",
  }[estado];
}
function colorEstado(estado: EstadoMuestra): { fondo: string; texto: string } {
  return {
    tomada: { fondo: "#FEF3C7", texto: "#92400E" },
    aceptada: { fondo: "#D1FAE5", texto: "#047857" },
    rechazada: { fondo: "#FEE2E2", texto: "#B91C1C" },
    en_proceso: { fondo: "#DBEAFE", texto: "#1D4ED8" },
    procesada: { fondo: "#CCFBF1", texto: "#0F766E" },
  }[estado];
}
function fecha(valor: unknown): string {
  if (!valor) return "Sin registrar";
  try {
    let d: Date;
    if (typeof valor === "object" && valor !== null && "toDate" in valor && typeof valor.toDate === "function") {
      d = valor.toDate() as Date;
    } else if (typeof valor === "object" && valor !== null && "seconds" in valor && typeof valor.seconds === "number") {
      d = new Date(valor.seconds * 1000);
    } else {
      d = new Date(valor as string | number);
    }
    return Number.isNaN(d.getTime()) ? "Sin registrar" : d.toLocaleString("es-BO");
  } catch {
    return "Sin registrar";
  }
}
function avisar(titulo: string, mensaje: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}
function mensajeError(error: unknown): string {
  const codigo = (error as { code?: string })?.code || "";
  if (codigo.includes("permission-denied")) return "Firestore rechazó la operación. Revisa los permisos del laboratorio y del bioquímico.";
  if (codigo.includes("unavailable")) return "No hay conexión con Firestore. Intenta nuevamente.";
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
async function obtenerSesion(): Promise<Sesion> {
  const usuario = getAuth().currentUser;
  if (!usuario) throw new Error("Debes iniciar sesión.");
  const snap = await getDoc(doc(db, "usuarios", usuario.uid));
  if (!snap.exists()) throw new Error("No se encontró tu usuario en Firestore.");
  const datos = snap.data();
  if (datos.activo === false) throw new Error("Tu cuenta está desactivada.");
  const rol = normalizar(datos.rol);
  if (rol !== "bioquimico" && rol !== "bioquímico") {
    throw new Error("Este módulo está disponible para el bioquímico.");
  }
  const laboratorioId = texto(datos.laboratorioId);
  if (!laboratorioId) throw new Error("No tienes laboratorio asignado.");
  return { uid: usuario.uid, laboratorioId };
}

export default function EstadoAnalisisScreen() {
  const router = useRouter();
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [seleccionada, setSeleccionada] = useState<Muestra | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<"en_proceso" | "procesada" | null>(null);
  const [detalle, setDetalle] = useState<Muestra | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    try {
      if (inicial) setCargando(true);
      else setActualizando(true);
      setError("");
      const sesion = await obtenerSesion();
      const snap = await getDocs(query(collection(db, "muestras"), where("laboratorioId", "==", sesion.laboratorioId)));
      const documentos = snap.docs.map((item) => ({ id: item.id, datos: item.data() }));
      const pacienteIds = [...new Set(documentos.map((x) => texto(x.datos.pacienteId)).filter(Boolean))];
      const analisisIds = [...new Set(documentos.map((x) => texto(x.datos.analisisId)).filter(Boolean))];
      const [pacientesSnap, analisisSnap] = await Promise.all([
        Promise.all(pacienteIds.map(async (id) => {
          try {
            const s = await getDoc(doc(db, "pacientes", id));
            if (!s.exists() || texto(s.data().laboratorioId) !== sesion.laboratorioId) return [id, ""] as const;
            const d = s.data();
            return [id, [texto(d.nombres || d.nombre), texto(d.apellidos || d.apellido)].filter(Boolean).join(" ")] as const;
          } catch { return [id, ""] as const; }
        })),
        Promise.all(analisisIds.map(async (id) => {
          try {
            const s = await getDoc(doc(db, "analisis", id));
            if (!s.exists()) return [id, ""] as const;
            const d = s.data();
            if (d.laboratorioId && texto(d.laboratorioId) !== sesion.laboratorioId) return [id, ""] as const;
            return [id, texto(d.nombre || d.nombreAnalisis || d.descripcion)] as const;
          } catch { return [id, ""] as const; }
        })),
      ]);
      const nombresPacientes = Object.fromEntries(pacientesSnap);
      const nombresAnalisis = Object.fromEntries(analisisSnap);
      const lista: Muestra[] = documentos.map(({ id, datos }) => {
        const pacienteId = texto(datos.pacienteId);
        const analisisId = texto(datos.analisisId);
        return {
          id,
          codigo: texto(datos.codigo || datos.codigoMuestra || id),
          pacienteId,
          paciente: texto(datos.pacienteNombre || datos.nombrePaciente) || nombresPacientes[pacienteId] || "Paciente sin identificar",
          analisisId,
          analisis: texto(datos.analisisNombre || datos.nombreAnalisis) || nombresAnalisis[analisisId] || "Análisis sin identificar",
          ordenId: texto(datos.ordenId),
          tipo: texto(datos.tipoMuestra || datos.tipo) || "No indicado",
          laboratorioId: sesion.laboratorioId,
          estado: estadoMuestra(datos.estado),
          estadoValidacion: normalizar(datos.estadoValidacion),
          fechaToma: fecha(datos.fechaToma || datos.fechaRegistro),
          fechaInicioProceso: fecha(datos.fechaInicioProceso),
          fechaProcesamiento: fecha(datos.fechaProcesamiento),
          motivoRechazo: texto(datos.motivoRechazo),
        };
      });
      lista.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
      setMuestras(lista);
      setDetalle((anterior) => anterior ? lista.find((m) => m.id === anterior.id) || null : null);
    } catch (e) {
      setError(mensajeError(e));
      setMuestras([]);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => { void cargar(true); }, [cargar]);

  const conteos = useMemo(() => ({
    todas: muestras.length,
    tomada: muestras.filter((m) => m.estado === "tomada").length,
    aceptada: muestras.filter((m) => m.estado === "aceptada").length,
    rechazada: muestras.filter((m) => m.estado === "rechazada").length,
    en_proceso: muestras.filter((m) => m.estado === "en_proceso").length,
    procesada: muestras.filter((m) => m.estado === "procesada").length,
  }), [muestras]);

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    return muestras.filter((m) => {
      const coincide = [m.codigo, m.paciente, m.analisis, m.ordenId, m.tipo, m.id].join(" ").toLowerCase().includes(q);
      return coincide && (filtro === "todas" || m.estado === filtro);
    });
  }, [muestras, busqueda, filtro]);

  const cerrarConfirmacion = () => {
    if (guardando) return;
    setSeleccionada(null);
    setNuevoEstado(null);
  };

  const cambiarEstado = async () => {
    if (!seleccionada || !nuevoEstado || guardando) return;
    const muestraId = seleccionada.id;
    const destino = nuevoEstado;
    try {
      setGuardando(true);
      const sesion = await obtenerSesion();
      const referencia = doc(db, "muestras", muestraId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(referencia);
        if (!snap.exists()) throw new Error("La muestra ya no existe.");
        const datos = snap.data();
        if (texto(datos.laboratorioId) !== sesion.laboratorioId) throw new Error("La muestra no pertenece a tu laboratorio.");
        const actual = estadoMuestra(datos.estado);
        if (destino === "en_proceso" && actual !== "aceptada") {
          throw new Error("Solo se puede iniciar el procesamiento de una muestra aceptada.");
        }
        if (destino === "procesada" && actual !== "en_proceso") {
          throw new Error("Solo se puede finalizar una muestra en proceso.");
        }
        if (normalizar(datos.estadoValidacion) === "rechazada" || datos.aceptada === false && actual !== "tomada") {
          throw new Error("Esta muestra no tiene una validación favorable.");
        }
        const cambios: Record<string, unknown> = {
          estado: destino,
          actualizadoPor: sesion.uid,
          fechaActualizacion: serverTimestamp(),
        };
        if (destino === "en_proceso") cambios.fechaInicioProceso = serverTimestamp();
        if (destino === "procesada") cambios.fechaProcesamiento = serverTimestamp();
        const historial = Array.isArray(datos.historialEstados) ? datos.historialEstados : [];
        cambios.historialEstados = [...historial, {
          estadoAnterior: actual,
          estado: destino,
          usuarioId: sesion.uid,
          fecha: new Date().toISOString(),
        }];
        tx.update(referencia, cambios);
      });
      setSeleccionada(null);
      setNuevoEstado(null);
      await cargar();
      avisar("Estado actualizado", destino === "en_proceso" ? "La muestra inició su procesamiento." : "La muestra se marcó como procesada.");
    } catch (e) {
      avisar("No se pudo actualizar", mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const botonAccion = (m: Muestra) => {
    const destino = m.estado === "aceptada" ? "en_proceso" : m.estado === "en_proceso" ? "procesada" : null;
    if (!destino) return null;
    return (
      <Pressable
        style={[styles.botonAccion, { backgroundColor: destino === "procesada" ? C.verde : C.azul }]}
        onPress={() => { setSeleccionada(m); setNuevoEstado(destino); }}
      >
        <Text style={styles.textoAccion}>{destino === "en_proceso" ? "Iniciar procesamiento" : "Finalizar procesamiento"}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.pantalla}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => void cargar()} tintColor={C.azul} colors={[C.azul]} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroSuperior}>
            <View style={styles.etiquetaHero}><Text style={styles.etiquetaHeroTexto}>LABORATORIO CLÍNICO · BIOQUÍMICA</Text></View>
            <Pressable style={styles.volver} onPress={() => router.back()}><Text style={styles.volverTexto}>Volver</Text></Pressable>
          </View>
          <Text style={styles.heroTitulo}>Estado de análisis</Text>
          <Text style={styles.heroDescripcion}>Seguimiento de muestras y control de las etapas de procesamiento.</Text>
          <View style={styles.heroResumen}>
            <View><Text style={styles.heroNumero}>{conteos.todas}</Text><Text style={styles.heroNumeroLabel}>Muestras registradas</Text></View>
            <View style={styles.heroSeparador} />
            <View><Text style={styles.heroNumero}>{conteos.en_proceso}</Text><Text style={styles.heroNumeroLabel}>En procesamiento</Text></View>
          </View>
        </View>

        <View style={styles.estadisticas}>
          {([
            ["Tomadas", conteos.tomada, "#D97706", "#FFFBEB"],
            ["Aceptadas", conteos.aceptada, "#059669", "#ECFDF5"],
            ["En proceso", conteos.en_proceso, "#2563EB", "#EFF6FF"],
            ["Procesadas", conteos.procesada, "#0F766E", "#F0FDFA"],
            ["Rechazadas", conteos.rechazada, "#DC2626", "#FEF2F2"],
          ] as [string, number, string, string][]).map(([titulo, cantidad, color, fondo]) => (
            <View key={titulo} style={styles.estadistica}>
              <View style={[styles.estadisticaIcono, { backgroundColor: fondo }]}><View style={[styles.estadisticaPunto, { backgroundColor: color }]} /></View>
              <Text style={styles.estadisticaNumero}>{cantidad}</Text>
              <Text style={styles.estadisticaLabel}>{titulo}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.seccionEncabezado}>
            <View style={{ flex: 1 }}>
              <Text style={styles.seccionTitulo}>Seguimiento de muestras</Text>
              <Text style={styles.seccionDescripcion}>Consulta cada muestra y avanza su procesamiento cuando corresponda.</Text>
            </View>
            <Pressable style={styles.actualizar} onPress={() => void cargar()} disabled={cargando || actualizando}>
              <Text style={styles.actualizarTexto}>{actualizando ? "Actualizando..." : "Actualizar"}</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.buscador}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar paciente, código, orden o análisis"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
            {FILTROS.map((item) => (
              <Pressable key={item.valor} onPress={() => setFiltro(item.valor)} style={[styles.filtro, filtro === item.valor && styles.filtroActivo]}>
                <Text style={[styles.filtroTexto, filtro === item.valor && styles.filtroTextoActivo]}>{item.titulo} · {conteos[item.valor]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.listaEncabezado}>
            <Text style={styles.listaTitulo}>Resultados encontrados</Text>
            <Text style={styles.listaCantidad}>{filtradas.length} muestras</Text>
          </View>

          {error ? (
            <View style={styles.errorCaja}>
              <Text style={styles.errorTexto}>{error}</Text>
              <Pressable onPress={() => void cargar(true)} style={styles.reintentar}><Text style={styles.reintentarTexto}>Reintentar</Text></Pressable>
            </View>
          ) : cargando ? (
            <View style={styles.vacio}><ActivityIndicator size="large" color={C.azul} /><Text style={styles.vacioDescripcion}>Cargando muestras...</Text></View>
          ) : filtradas.length === 0 ? (
            <View style={styles.vacio}>
              <Text style={styles.vacioTitulo}>No se encontraron muestras</Text>
              <Text style={styles.vacioDescripcion}>Prueba con otro filtro o actualiza los datos.</Text>
            </View>
          ) : filtradas.map((m) => {
            const color = colorEstado(m.estado);
            const indice = ETAPAS.indexOf(m.estado);
            return (
              <View key={m.id} style={styles.tarjeta}>
                <View style={styles.tarjetaSuperior}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codigoLabel}>CÓDIGO DE MUESTRA</Text>
                    <Text style={styles.codigo}>{m.codigo}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: color.fondo }]}><Text style={[styles.badgeTexto, { color: color.texto }]}>{nombreEstado(m.estado)}</Text></View>
                </View>
                <Text style={styles.analisis}>{m.analisis}</Text>
                <Text style={styles.paciente}>{m.paciente}</Text>
                <View style={styles.metadatos}>
                  <View style={styles.metadato}><Text style={styles.metadatoLabel}>Tipo de muestra</Text><Text style={styles.metadatoValor}>{m.tipo}</Text></View>
                  <View style={styles.metadato}><Text style={styles.metadatoLabel}>Orden</Text><Text style={styles.metadatoValor} numberOfLines={1}>{m.ordenId || "Sin orden"}</Text></View>
                </View>
                <View style={styles.linea} />
                {m.estado === "rechazada" ? (
                  <View style={styles.rechazo}><Text style={styles.rechazoTitulo}>Muestra rechazada</Text><Text style={styles.rechazoTexto}>{m.motivoRechazo || "No se registró un motivo de rechazo."}</Text></View>
                ) : (
                  <View style={styles.etapas}>
                    {ETAPAS.map((etapa, index) => (
                      <View key={etapa} style={styles.etapa}>
                        <View style={[styles.etapaPunto, index <= indice && styles.etapaPuntoActivo]} />
                        <Text style={[styles.etapaTexto, index <= indice && styles.etapaTextoActivo]} numberOfLines={2}>{nombreEstado(etapa)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.tarjetaPie}>
                  <Pressable onPress={() => setDetalle(m)} style={styles.detalleBoton}><Text style={styles.detalleTexto}>Ver detalles</Text></Pressable>
                  {botonAccion(m)}
                  {m.estado === "tomada" && <Text style={styles.pendienteTexto}>Pendiente de validación</Text>}
                  {m.estado === "procesada" && <Text style={styles.finalizadoTexto}>Procesamiento finalizado</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={detalle !== null} transparent animationType="fade" onRequestClose={() => setDetalle(null)}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <ScrollView contentContainerStyle={styles.modalContenido}>
              <View style={styles.modalCabecera}><Text style={styles.modalTitulo}>Detalle de la muestra</Text><Pressable onPress={() => setDetalle(null)}><Text style={styles.cerrarTexto}>Cerrar</Text></Pressable></View>
              {detalle && <>
                <View style={styles.detalleDestacado}><Text style={styles.detalleDestacadoLabel}>MUESTRA</Text><Text style={styles.detalleDestacadoValor}>{detalle.codigo}</Text><Text style={styles.detalleDestacadoSub}>{detalle.analisis}</Text></View>
                {([
                  ["Paciente", detalle.paciente], ["Tipo de muestra", detalle.tipo], ["Orden", detalle.ordenId || "Sin orden"],
                  ["Estado actual", nombreEstado(detalle.estado)], ["Fecha de toma", detalle.fechaToma],
                  ["Inicio de procesamiento", detalle.fechaInicioProceso], ["Finalización", detalle.fechaProcesamiento],
                ] as [string, string][]).map(([etiqueta, valor]) => <View key={etiqueta} style={styles.detalleFila}><Text style={styles.detalleEtiqueta}>{etiqueta}</Text><Text style={styles.detalleValor}>{valor}</Text></View>)}
                {detalle.estado === "rechazada" && <View style={styles.rechazo}><Text style={styles.rechazoTitulo}>Motivo de rechazo</Text><Text style={styles.rechazoTexto}>{detalle.motivoRechazo || "No especificado"}</Text></View>}
                <View style={styles.modalAcciones}>{botonAccion(detalle)}</View>
              </>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={seleccionada !== null} transparent animationType="fade" onRequestClose={cerrarConfirmacion}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <View style={styles.modalContenido}>
              <Text style={styles.modalTitulo}>Confirmar cambio de estado</Text>
              <Text style={styles.modalDescripcion}>Esta acción actualizará el seguimiento de la muestra en Firestore.</Text>
              <View style={styles.confirmacionInfo}>
                <Text style={styles.confirmacionCodigo}>{seleccionada?.codigo}</Text>
                <Text style={styles.confirmacionTexto}>{seleccionada?.paciente}</Text>
                <Text style={styles.confirmacionTexto}>{seleccionada?.analisis}</Text>
                <View style={styles.confirmacionEstados}><Text style={styles.confirmacionAnterior}>{seleccionada ? nombreEstado(seleccionada.estado) : ""}</Text><Text style={styles.confirmacionFlecha}>→</Text><Text style={styles.confirmacionNuevo}>{nuevoEstado ? nombreEstado(nuevoEstado) : ""}</Text></View>
              </View>
              <View style={styles.confirmacionBotones}>
                <Pressable disabled={guardando} style={styles.cancelar} onPress={cerrarConfirmacion}><Text style={styles.cancelarTexto}>Cancelar</Text></Pressable>
                <Pressable disabled={guardando} style={[styles.confirmar, guardando && { opacity: 0.6 }]} onPress={() => void cambiarEstado()}>
                  {guardando ? <ActivityIndicator color={C.blanco} /> : <Text style={styles.confirmarTexto}>Confirmar</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { padding: 16, paddingBottom: 55 },
  hero: { backgroundColor: C.principal, borderRadius: 20, padding: 21, marginBottom: 16 },
  heroSuperior: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 19, gap: 8 },
  etiquetaHero: { backgroundColor: "#284C76", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, flexShrink: 1 },
  etiquetaHeroTexto: { color: "#D9E9FF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  volver: { paddingVertical: 8, paddingHorizontal: 13, backgroundColor: "#355679", borderRadius: 9 },
  volverTexto: { color: C.blanco, fontWeight: "700", fontSize: 12 },
  heroTitulo: { color: C.blanco, fontSize: 28, fontWeight: "800", marginBottom: 7 },
  heroDescripcion: { color: "#C9D9ED", fontSize: 13, lineHeight: 20 },
  heroResumen: { marginTop: 22, paddingTop: 17, borderTopWidth: 1, borderTopColor: "#416082", flexDirection: "row", alignItems: "center", gap: 22 },
  heroNumero: { color: C.blanco, fontSize: 26, fontWeight: "800" },
  heroNumeroLabel: { color: "#C9D9ED", fontSize: 11, marginTop: 3 },
  heroSeparador: { height: 37, width: 1, backgroundColor: "#54718F" },
  estadisticas: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 17 },
  estadistica: { backgroundColor: C.blanco, borderWidth: 1, borderColor: C.borde, borderRadius: 14, minWidth: 103, flexGrow: 1, padding: 13 },
  estadisticaIcono: { width: 29, height: 29, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 9 },
  estadisticaPunto: { width: 11, height: 11, borderRadius: 6 },
  estadisticaNumero: { color: C.principal, fontSize: 23, fontWeight: "800" },
  estadisticaLabel: { color: C.secundario, fontSize: 11, marginTop: 3 },
  panel: { backgroundColor: C.blanco, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: C.borde },
  seccionEncabezado: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 16 },
  seccionTitulo: { fontSize: 19, color: C.principal, fontWeight: "800" },
  seccionDescripcion: { fontSize: 12, color: C.secundario, lineHeight: 18, marginTop: 6 },
  actualizar: { backgroundColor: C.tenue, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10 },
  actualizarTexto: { color: C.azul, fontWeight: "800", fontSize: 11 },
  buscador: { borderColor: C.borde, borderWidth: 1, backgroundColor: "#F8FAFD", borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13, fontSize: 13, color: C.texto },
  filtros: { gap: 8, paddingVertical: 15 },
  filtro: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 20, backgroundColor: "#EDF2F8", borderWidth: 1, borderColor: C.borde },
  filtroActivo: { backgroundColor: C.principal, borderColor: C.principal },
  filtroTexto: { color: "#475569", fontSize: 11, fontWeight: "700" },
  filtroTextoActivo: { color: C.blanco },
  listaEncabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  listaTitulo: { color: C.principal, fontSize: 14, fontWeight: "800" },
  listaCantidad: { color: C.secundario, fontSize: 12 },
  tarjeta: { borderWidth: 1, borderColor: C.borde, backgroundColor: C.blanco, borderRadius: 14, padding: 15, marginTop: 13 },
  tarjetaSuperior: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 },
  codigoLabel: { color: C.secundario, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  codigo: { color: C.principal, fontSize: 16, fontWeight: "800", marginTop: 4 },
  badge: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20 },
  badgeTexto: { fontSize: 11, fontWeight: "800" },
  analisis: { fontSize: 16, fontWeight: "800", color: C.texto, marginBottom: 5 },
  paciente: { fontSize: 13, color: C.secundario, marginBottom: 13 },
  metadatos: { flexDirection: "row", gap: 9 },
  metadato: { flex: 1, minWidth: 0, padding: 11, backgroundColor: "#F6F9FD", borderRadius: 10 },
  metadatoLabel: { color: C.secundario, fontSize: 10, marginBottom: 5 },
  metadatoValor: { color: C.texto, fontSize: 12, fontWeight: "700" },
  linea: { height: 1, backgroundColor: C.borde, marginVertical: 16 },
  etapas: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginBottom: 17 },
  etapa: { flex: 1, alignItems: "center" },
  etapaPunto: { height: 11, width: 11, borderRadius: 6, backgroundColor: "#D6E0EC", marginBottom: 7 },
  etapaPuntoActivo: { backgroundColor: C.verde },
  etapaTexto: { fontSize: 10, textAlign: "center", color: "#94A3B8" },
  etapaTextoActivo: { color: C.principal, fontWeight: "700" },
  tarjetaPie: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  detalleBoton: { paddingHorizontal: 14, paddingVertical: 11, backgroundColor: C.tenue, borderRadius: 9 },
  detalleTexto: { color: C.principal, fontWeight: "800", fontSize: 12 },
  botonAccion: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center" },
  textoAccion: { color: C.blanco, fontWeight: "800", fontSize: 11 },
  pendienteTexto: { color: C.ambar, fontWeight: "700", fontSize: 11, flexShrink: 1 },
  finalizadoTexto: { color: C.verde, fontWeight: "700", fontSize: 11 },
  rechazo: { backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 13 },
  rechazoTitulo: { color: C.rojo, fontWeight: "800", fontSize: 12, marginBottom: 5 },
  rechazoTexto: { color: "#991B1B", fontSize: 12, lineHeight: 18 },
  vacio: { paddingVertical: 38, alignItems: "center", gap: 10 },
  vacioTitulo: { fontSize: 15, color: C.principal, fontWeight: "800" },
  vacioDescripcion: { color: C.secundario, fontSize: 12, textAlign: "center" },
  errorCaja: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginTop: 12 },
  errorTexto: { color: C.rojo, fontSize: 12, lineHeight: 19 },
  reintentar: { alignSelf: "flex-start", backgroundColor: C.rojo, borderRadius: 8, padding: 10, marginTop: 12 },
  reintentarTexto: { color: C.blanco, fontWeight: "800", fontSize: 12 },
  modalFondo: { flex: 1, backgroundColor: "rgba(15,23,42,0.65)", justifyContent: "center", padding: 18, alignItems: "center" },
  modalCaja: { width: "100%", maxWidth: 520, maxHeight: "88%", backgroundColor: C.blanco, borderRadius: 18, overflow: "hidden" },
  modalContenido: { padding: 20 },
  modalCabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 },
  modalTitulo: { fontSize: 20, fontWeight: "800", color: C.principal },
  cerrarTexto: { color: C.rojo, fontSize: 12, fontWeight: "800" },
  modalDescripcion: { color: C.secundario, fontSize: 13, lineHeight: 20, marginTop: 10, marginBottom: 16 },
  detalleDestacado: { backgroundColor: C.principal, borderRadius: 12, padding: 16, marginBottom: 16 },
  detalleDestacadoLabel: { color: "#BDD6F4", fontSize: 10, fontWeight: "800" },
  detalleDestacadoValor: { color: C.blanco, fontSize: 20, fontWeight: "800", marginTop: 5 },
  detalleDestacadoSub: { color: "#E1EDFC", fontSize: 13, marginTop: 7 },
  detalleFila: { paddingVertical: 11, borderBottomColor: C.borde, borderBottomWidth: 1 },
  detalleEtiqueta: { color: C.secundario, fontSize: 11, marginBottom: 4 },
  detalleValor: { color: C.texto, fontSize: 13, fontWeight: "700" },
  modalAcciones: { alignItems: "flex-end", marginTop: 18 },
  confirmacionInfo: { backgroundColor: "#F6F9FD", borderRadius: 12, padding: 16 },
  confirmacionCodigo: { color: C.principal, fontWeight: "800", fontSize: 17, marginBottom: 7 },
  confirmacionTexto: { color: C.secundario, fontSize: 12, marginBottom: 5 },
  confirmacionEstados: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 12 },
  confirmacionAnterior: { color: C.secundario, fontWeight: "700", fontSize: 12 },
  confirmacionFlecha: { color: C.azul, fontSize: 18, fontWeight: "800" },
  confirmacionNuevo: { color: C.verde, fontWeight: "800", fontSize: 12 },
  confirmacionBotones: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelar: { flex: 1, backgroundColor: "#E8EEF6", borderRadius: 10, padding: 14, alignItems: "center" },
  cancelarTexto: { color: C.principal, fontWeight: "800", fontSize: 12 },
  confirmar: { flex: 1, backgroundColor: C.principal, borderRadius: 10, padding: 14, alignItems: "center" },
  confirmarTexto: { color: C.blanco, fontWeight: "800", fontSize: 12 },
});
