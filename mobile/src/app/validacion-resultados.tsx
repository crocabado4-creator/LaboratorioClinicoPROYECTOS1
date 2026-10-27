import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection, doc, getDoc, getDocs, query, runTransaction,
  serverTimestamp, where,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type Usuario = { uid: string; laboratorioId: string; nombre: string };
type Paciente = { nombre: string; ci: string };
type Resultado = {
  id: string; laboratorioId: string; muestraId: string; pacienteId: string;
  ordenId: string; analisisId: string; analisisNombre: string;
  valorResultado: string; unidad: string; observaciones: string;
  estado: string; validado: boolean; fechaRegistro: unknown;
  fechaValidacion: unknown; validadoPor: string; validadoPorNombre: string;
};
type Parametro = {
  id: string; nombre: string; unidad: string; referencia: string;
  valor: string; observacion: string; registrado: boolean;
};
type Filtro = "todos" | "pendientes" | "validados";

const C = {
  fondo: "#F3F6FC", blanco: "#FFFFFF", azulOscuro: "#17365D",
  azul: "#2563EB", azulClaro: "#EFF6FF", texto: "#0F172A",
  secundario: "#64748B", borde: "#E2E8F0", verde: "#059669",
  verdeClaro: "#ECFDF5", ambar: "#B45309", ambarClaro: "#FFFBEB",
  rojo: "#DC2626", rojoClaro: "#FEF2F2",
};

function str(v: unknown): string {
  if (v === null || v === undefined || typeof v === "object") return "";
  return String(v).trim();
}
function normal(v: unknown): string {
  return str(v).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function nombre(datos: Record<string, any>): string {
  return str(datos.nombreCompleto) ||
    [str(datos.nombres || datos.nombre), str(datos.apellidos || datos.apellido)]
      .filter(Boolean).join(" ") || "Sin identificar";
}
function fecha(v: unknown): string {
  try {
    if (!v) return "Sin fecha";
    const x = v as { toDate?: () => Date; seconds?: number };
    const d = typeof x.toDate === "function" ? x.toDate() :
      typeof x.seconds === "number" ? new Date(x.seconds * 1000) : new Date(v as string);
    return Number.isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleString("es-BO");
  } catch { return "Sin fecha"; }
}
function referencia(v: unknown): string {
  if (v == null) return "";
  if (typeof v !== "object") return str(v);
  if (Array.isArray(v)) return v.map(referencia).filter(Boolean).join(" | ");
  const r = v as Record<string, any>;
  const min = r.min ?? r.minimo ?? r.desde ?? r.valorMinimo;
  const max = r.max ?? r.maximo ?? r.hasta ?? r.valorMaximo;
  if (min != null && max != null) return `${min} - ${max}`;
  return str(r.texto || r.descripcion || r.valor) ||
    (min != null ? `Desde ${min}` : max != null ? `Hasta ${max}` : "");
}
function aviso(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${titulo}\n\n${mensaje}`);
  } else Alert.alert(titulo, mensaje);
}
function confirmar(accion: () => void) {
  const mensaje = "Se bloqueará la edición de este resultado. ¿Confirmas que todos los valores están correctos?";
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(mensaje)) accion();
  } else Alert.alert("Confirmar validación", mensaje, [
    { text: "Cancelar", style: "cancel" }, { text: "Validar resultado", onPress: accion },
  ]);
}
function errorTexto(e: unknown): string {
  const x = e as { code?: string; message?: string };
  if (x?.code === "permission-denied" || x?.code === "firestore/permission-denied")
    return "Permisos insuficientes en Firestore. Revisa las reglas de resultados, análisis y sus subcolecciones.";
  return x?.message || "Ocurrió un error inesperado.";
}
function mapResultado(id: string, d: Record<string, any>): Resultado {
  return {
    id, laboratorioId: str(d.laboratorioId), muestraId: str(d.muestraId),
    pacienteId: str(d.pacienteId), ordenId: str(d.ordenId), analisisId: str(d.analisisId),
    analisisNombre: str(d.analisisNombre || d.nombreAnalisis) || "Análisis clínico",
    valorResultado: str(d.valorResultado), unidad: str(d.unidad),
    observaciones: str(d.observaciones), estado: normal(d.estado) || "borrador",
    validado: d.validado === true || normal(d.estado) === "validado",
    fechaRegistro: d.fechaRegistro || d.fechaCreacion || null,
    fechaValidacion: d.fechaValidacion || null, validadoPor: str(d.validadoPor),
    validadoPorNombre: str(d.validadoPorNombre),
  };
}
function param(id: string, d: Record<string, any>): Parametro {
  return {
    id: str(d.parametroId || d.id) || id,
    nombre: str(d.nombreParametro || d.nombre || d.parametro || d.prueba) || "Parámetro",
    unidad: str(d.unidad || d.unidadMedida || d.unidades),
    referencia: referencia(d.rangoReferencia ?? d.valorReferencia ?? d.referencia ?? d.rango),
    valor: str(d.valor ?? d.valorResultado ?? d.resultado),
    observacion: str(d.observacion || d.observaciones), registrado: false,
  };
}
function extraer(d: any, id: string): Parametro[] {
  if (typeof d === "string") return [param(id, { nombre: d })];
  if (!d || typeof d !== "object" || d.activo === false) return [];
  const grupos = [d.subparametros, d.subParametros, d.parametros, d.pruebas, d.items, d.componentes, d.determinaciones]
    .filter((x) => Array.isArray(x) && x.length > 0);
  if (grupos.length) return grupos.flatMap((g: any[], gi: number) =>
    g.flatMap((x: any, i: number) => extraer(x, str(x?.parametroId || x?.id) || `${id}_${gi}_${i}`)));
  return [param(id, d)];
}
async function usuarioActivo(): Promise<Usuario> {
  const u = auth.currentUser;
  if (!u) throw new Error("Debes iniciar sesión.");
  const snap = await getDoc(doc(db, "usuarios", u.uid));
  if (!snap.exists()) throw new Error("No se encontró tu usuario.");
  const d = snap.data();
  if (d.activo !== true) throw new Error("Tu cuenta está inactiva.");
  if (normal(d.rol) !== "bioquimico") throw new Error("Solo el bioquímico puede validar resultados.");
  const laboratorioId = str(d.laboratorioId);
  if (!laboratorioId) throw new Error("Tu usuario no tiene laboratorio asignado.");
  return { uid: u.uid, laboratorioId, nombre: nombre(d) === "Sin identificar" ? "Bioquímico" : nombre(d) };
}
async function parametrosConfigurados(analisisId: string, laboratorioId: string): Promise<Parametro[]> {
  if (!analisisId) return [];
  const snap = await getDoc(doc(db, "analisis", analisisId));
  if (!snap.exists()) throw new Error("No existe la configuración del análisis.");
  const d = snap.data();
  if (str(d.laboratorioId) !== laboratorioId) throw new Error("El análisis pertenece a otro laboratorio.");
  const sub = await getDocs(collection(db, "analisis", analisisId, "parametros"));
  const configurados: Parametro[] = [];
  for (const campo of ["parametros", "parametrosAnalisis", "valoresParametros", "pruebas", "items"]) {
    if (Array.isArray(d[campo])) d[campo].forEach((x: any, i: number) =>
      configurados.push(...extraer(x, str(x?.parametroId || x?.id) || `${campo}_${i}`)));
  }
  sub.docs.forEach((x) => configurados.push(...extraer(x.data(), x.id)));
  const mapa = new Map<string, Parametro>();
  configurados.forEach((p) => {
    const k = normal(p.nombre);
    if (!mapa.has(k)) mapa.set(k, p);
  });
  return [...mapa.values()];
}
function unir(configurados: Parametro[], guardados: Parametro[]): Parametro[] {
  const lista = [...configurados];
  guardados.forEach((g) => {
    const i = lista.findIndex((p) => p.id === g.id || normal(p.nombre) === normal(g.nombre));
    if (i >= 0) lista[i] = { ...lista[i], valor: g.valor, observacion: g.observacion,
      unidad: g.unidad || lista[i].unidad, referencia: g.referencia || lista[i].referencia,
      registrado: true };
    else lista.push(g);
  });
  return lista;
}

export default function ValidacionResultados() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [pacientes, setPacientes] = useState<Record<string, Paciente>>({});
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Resultado | null>(null);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [configurados, setConfigurados] = useState<Parametro[]>([]);
  const [nombreValidador, setNombreValidador] = useState("");

  const cargar = useCallback(async (inicial = false) => {
    try {
      if (inicial) setCargando(true);
      else setActualizando(true);
      setError("");
      const u = await usuarioActivo();
      const [rs, ps] = await Promise.all([
        getDocs(query(collection(db, "resultados"), where("laboratorioId", "==", u.laboratorioId))),
        getDocs(query(collection(db, "pacientes"), where("laboratorioId", "==", u.laboratorioId))),
      ]);
      const lista = rs.docs.map((x) => mapResultado(x.id, x.data()));
      lista.sort((a, b) => {
        if (a.validado !== b.validado) return a.validado ? 1 : -1;
        return a.analisisNombre.localeCompare(b.analisisNombre, "es");
      });
      const mapa: Record<string, Paciente> = {};
      ps.docs.forEach((x) => {
        const d = x.data();
        mapa[x.id] = { nombre: nombre(d), ci: str(d.ci || d.carnet || d.carnetIdentidad || d.numeroDocumento) };
      });
      setUsuario(u);
      setResultados(lista);
      setPacientes(mapa);
    } catch (e) { setError(errorTexto(e)); }
    finally { setCargando(false); setActualizando(false); }
  }, []);
  useEffect(() => { void cargar(true); }, [cargar]);

  const abrir = async (r: Resultado) => {
    if (cargandoDetalle) return;
    try {
      setCargandoDetalle(true);
      const u = await usuarioActivo();
      const snap = await getDoc(doc(db, "resultados", r.id));
      if (!snap.exists()) throw new Error("El resultado ya no existe.");
      if (str(snap.data().laboratorioId) !== u.laboratorioId) throw new Error("Resultado de otro laboratorio.");
      const actual = mapResultado(snap.id, snap.data());
      const [cfg, vs] = await Promise.all([
        parametrosConfigurados(actual.analisisId, u.laboratorioId),
        getDocs(collection(db, "resultados", actual.id, "valores")),
      ]);
      const guardados = vs.docs.map((x) => ({ ...param(x.id, x.data()), registrado: true }));
      const unidos = unir(cfg, guardados);
      let validador = actual.validadoPorNombre;
      if (!validador && actual.validadoPor) {
        try {
          const us = await getDoc(doc(db, "usuarios", actual.validadoPor));
          if (us.exists() && str(us.data().laboratorioId) === u.laboratorioId)
            validador = nombre(us.data());
        } catch { validador = "No disponible"; }
      }
      setUsuario(u);
      setSeleccionado(actual);
      setConfigurados(cfg);
      setParametros(unidos);
      setNombreValidador(validador || "No registrado");
      setModalVisible(true);
    } catch (e) { aviso("No se pudo abrir el resultado", errorTexto(e)); }
    finally { setCargandoDetalle(false); }
  };

  const cerrar = () => {
    if (validando) return;
    setModalVisible(false);
    setSeleccionado(null);
    setParametros([]);
    setConfigurados([]);
  };

  const validar = async () => {
    if (!seleccionado || !usuario || validando) return;
    try {
      setValidando(true);
      const u = await usuarioActivo();
      if (u.uid !== usuario.uid || u.laboratorioId !== usuario.laboratorioId)
        throw new Error("La sesión cambió. Actualiza la pantalla.");
      const ref = doc(db, "resultados", seleccionado.id);
      const valoresSnap = await getDocs(collection(db, "resultados", seleccionado.id, "valores"));
      const guardados = valoresSnap.docs.map((x) => ({ ...param(x.id, x.data()), registrado: true }));
      const unidos = unir(configurados, guardados);
      const faltantes = configurados.filter((p) => {
        const g = guardados.find((v) => v.id === p.id || normal(v.nombre) === normal(p.nombre));
        return !g || !g.valor.trim();
      });
      if (faltantes.length) throw new Error(`Faltan ${faltantes.length} parámetros por registrar: ${faltantes.map((x) => x.nombre).join(", ")}.`);
      if (!configurados.length && !guardados.some((x) => x.valor.trim()) && !seleccionado.valorResultado.trim())
        throw new Error("No hay ningún valor registrado para validar.");
      if (guardados.some((x) => !x.valor.trim())) throw new Error("Hay parámetros guardados sin valor.");
      await runTransaction(db, async (tx) => {
        const rs = await tx.get(ref);
        if (!rs.exists()) throw new Error("El resultado ya no existe.");
        const d = rs.data();
        if (str(d.laboratorioId) !== u.laboratorioId) throw new Error("Resultado de otro laboratorio.");
        if (d.validado === true || normal(d.estado) === "validado") throw new Error("Este resultado ya fue validado.");
        if (normal(d.estado) !== "borrador") throw new Error("Solo se pueden validar resultados en borrador.");
        if (str(d.analisisId) !== seleccionado.analisisId) throw new Error("El análisis cambió. Actualiza la pantalla.");
        if (!unidos.length && !str(d.valorResultado)) throw new Error("No existe un valor principal registrado.");
        const documentos = [];
        for (const v of valoresSnap.docs) documentos.push(await tx.get(v.ref));
        for (let i = 0; i < documentos.length; i++) {
          const documento = documentos[i];
          if (!documento.exists() || str(documento.data().valor) !== str(valoresSnap.docs[i].data().valor))
            throw new Error("Los valores cambiaron durante la revisión. Vuelve a abrir el resultado.");
        }
        tx.update(ref, {
          estado: "validado", validado: true, validadoPor: u.uid,
          validadoPorNombre: u.nombre, fechaValidacion: serverTimestamp(),
        });
      });
      cerrarTrasValidacion();
      aviso("Validación completada", "El resultado fue validado y quedó bloqueado para edición.");
      await cargar(false);
    } catch (e) { aviso("No se pudo validar", errorTexto(e)); }
    finally { setValidando(false); }
  };
  const cerrarTrasValidacion = () => {
    setModalVisible(false); setSeleccionado(null); setParametros([]); setConfigurados([]);
  };

  const lista = useMemo(() => resultados.filter((r) => {
    if (filtro === "pendientes" && r.validado) return false;
    if (filtro === "validados" && !r.validado) return false;
    const p = pacientes[r.pacienteId];
    return normal([r.analisisNombre, r.id, r.ordenId, r.muestraId, p?.nombre, p?.ci].join(" "))
      .includes(normal(busqueda));
  }), [resultados, pacientes, filtro, busqueda]);
  const validados = resultados.filter((r) => r.validado).length;
  const pendientes = resultados.length - validados;
  const completos = parametros.filter((p) => p.registrado && p.valor.trim()).length;
  const faltantes = configurados.filter((p) => !parametros.some((v) =>
    (v.id === p.id || normal(v.nombre) === normal(p.nombre)) && v.registrado && v.valor.trim())).length;
  const tieneValorPrincipal = !!seleccionado?.valorResultado.trim();
  const tieneValores = parametros.some((p) => p.registrado && p.valor.trim());
  const puedeValidar = !!seleccionado && !seleccionado.validado && seleccionado.estado === "borrador" &&
    faltantes === 0 && (tieneValorPrincipal || tieneValores) &&
    !parametros.some((p) => p.registrado && !p.valor.trim());

  if (cargando) return <View style={s.cargando}>
    <ActivityIndicator size="large" color={C.azul} />
    <Text style={s.textoSuave}>Cargando resultados clínicos...</Text>
  </View>;

  return <View style={s.pantalla}>
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => void cargar(false)} colors={[C.azul]} />}>
      <View style={s.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={s.sobretitulo}>LABORATORIO CLÍNICO</Text>
          <Text style={s.titulo}>Validación de resultados</Text>
          <Text style={s.descripcion}>Revisa los valores clínicos y confirma los resultados antes de su entrega.</Text>
        </View>
        <Pressable style={s.volver} onPress={() => router.back()}><Text style={s.volverTexto}>Volver</Text></Pressable>
      </View>
      <View style={s.estadisticas}>
        {[
          { n: resultados.length, t: "Total", color: C.azul, fondo: C.azulClaro },
          { n: pendientes, t: "Pendientes", color: C.ambar, fondo: C.ambarClaro },
          { n: validados, t: "Validados", color: C.verde, fondo: C.verdeClaro },
        ].map((x) => <View key={x.t} style={s.estadistica}>
          <View style={[s.punto, { backgroundColor: x.fondo }]}><View style={[s.puntoInterior, { backgroundColor: x.color }]} /></View>
          <Text style={s.estadisticaNumero}>{x.n}</Text><Text style={s.estadisticaTitulo}>{x.t}</Text>
        </View>)}
      </View>
      <View style={s.panel}>
        <Text style={s.seccionTitulo}>Explorar resultados</Text>
        <Text style={s.textoSuave}>Busca por paciente, CI, análisis, orden o código de muestra.</Text>
        <TextInput style={s.buscador} placeholder="Buscar resultados..." placeholderTextColor="#94A3B8"
          value={busqueda} onChangeText={setBusqueda} />
        <View style={s.filtros}>
          {(["pendientes", "validados", "todos"] as Filtro[]).map((f) => <Pressable key={f}
            onPress={() => setFiltro(f)} style={[s.filtro, filtro === f && s.filtroActivo]}>
            <Text style={[s.filtroTexto, filtro === f && s.filtroTextoActivo]}>
              {f === "pendientes" ? "Pendientes" : f === "validados" ? "Validados" : "Todos"}
            </Text>
          </Pressable>)}
        </View>
        <View style={s.filaSeparada}>
          <Text style={s.conteo}>{lista.length} resultado(s)</Text>
          <Pressable style={s.actualizar} disabled={actualizando} onPress={() => void cargar(false)}>
            <Text style={s.actualizarTexto}>{actualizando ? "Actualizando..." : "Actualizar"}</Text>
          </Pressable>
        </View>
      </View>
      {!!error && <View style={s.error}><Text style={s.errorTexto}>{error}</Text>
        <Pressable onPress={() => void cargar(false)}><Text style={s.reintentar}>Reintentar</Text></Pressable>
      </View>}
      <View style={s.panel}>
        <Text style={s.seccionTitulo}>Resultados registrados</Text>
        {lista.length === 0 ? <View style={s.vacio}>
          <Text style={s.vacioTitulo}>No hay resultados para mostrar</Text>
          <Text style={s.textoSuave}>Prueba otro filtro o registra los valores desde el módulo correspondiente.</Text>
        </View> : lista.map((r) => {
          const p = pacientes[r.pacienteId];
          return <View key={r.id} style={s.tarjeta}>
            <View style={s.tarjetaSuperior}>
              <View style={s.icono}><Text style={s.iconoTexto}>R</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.analisis}>{r.analisisNombre}</Text>
                <Text style={s.codigo}>Resultado · {r.id}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: r.validado ? C.verdeClaro : C.ambarClaro }]}>
                <Text style={[s.badgeTexto, { color: r.validado ? C.verde : C.ambar }]}>
                  {r.validado ? "Validado" : "Pendiente"}
                </Text>
              </View>
            </View>
            <View style={s.linea} />
            <Text style={s.dato}><Text style={s.etiqueta}>Paciente: </Text>{p?.nombre || "Sin identificar"}</Text>
            <Text style={s.dato}><Text style={s.etiqueta}>CI: </Text>{p?.ci || "—"}</Text>
            <Text style={s.dato}><Text style={s.etiqueta}>Orden: </Text>{r.ordenId || "—"}</Text>
            <Text style={s.dato}><Text style={s.etiqueta}>Resultado principal: </Text>{r.valorResultado || "Consultar parámetros"}</Text>
            <Text style={s.fecha}>Registrado: {fecha(r.fechaRegistro)}</Text>
            <Pressable style={[s.boton, cargandoDetalle && s.desactivado]} disabled={cargandoDetalle}
              onPress={() => void abrir(r)}><Text style={s.botonTexto}>
                {cargandoDetalle ? "Cargando detalle..." : r.validado ? "Consultar resultado" : "Revisar y validar"}
              </Text></Pressable>
          </View>;
        })}
      </View>
    </ScrollView>
    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={cerrar}>
      <View style={s.fondoModal}><View style={s.modal}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalContenido}>
          <View style={s.filaSeparada}>
            <View style={{ flex: 1 }}><Text style={s.sobretitulo}>REVISIÓN CLÍNICA</Text>
              <Text style={s.modalTitulo}>Detalle del resultado</Text></View>
            <Pressable onPress={cerrar} disabled={validando} style={s.cerrar}><Text style={s.cerrarTexto}>Cerrar</Text></Pressable>
          </View>
          {seleccionado && <>
            <View style={s.resumen}>
              <Text style={s.resumenSubtitulo}>ANÁLISIS</Text>
              <Text style={s.resumenTitulo}>{seleccionado.analisisNombre}</Text>
              <Text style={s.resumenDato}>Paciente: {pacientes[seleccionado.pacienteId]?.nombre || "Sin identificar"}</Text>
              <Text style={s.resumenDato}>CI: {pacientes[seleccionado.pacienteId]?.ci || "—"}</Text>
              <Text style={s.resumenDato}>Orden: {seleccionado.ordenId || "—"}</Text>
              <Text style={s.resumenDato}>Fecha: {fecha(seleccionado.fechaRegistro)}</Text>
            </View>
            <View style={s.resumenProgreso}>
              <View style={s.filaSeparada}><Text style={s.seccionTitulo}>Verificación de parámetros</Text>
                <Text style={s.progresoNumero}>{completos}/{parametros.length}</Text></View>
              <View style={s.barra}><View style={[s.barraDentro, {
                width: `${parametros.length ? Math.round(completos * 100 / parametros.length) : 0}%`,
              }]} /></View>
              <Text style={s.textoSuave}>{faltantes === 0 ? "No hay parámetros configurados pendientes." :
                `Faltan ${faltantes} parámetro(s) configurado(s) por registrar.`}</Text>
            </View>
            <View style={s.bloque}>
              <Text style={s.seccionTitulo}>Resultado principal</Text>
              <Text style={s.dato}><Text style={s.etiqueta}>Valor: </Text>{seleccionado.valorResultado || "Sin valor principal"}</Text>
              <Text style={s.dato}><Text style={s.etiqueta}>Unidad: </Text>{seleccionado.unidad || "—"}</Text>
              <Text style={s.dato}><Text style={s.etiqueta}>Observaciones: </Text>{seleccionado.observaciones || "Sin observaciones"}</Text>
            </View>
            <View style={s.bloque}>
              <Text style={s.seccionTitulo}>Valores por parámetros</Text>
              {parametros.length === 0 ? <Text style={s.textoSuave}>No hay parámetros configurados ni valores individuales.</Text> :
                parametros.map((p, i) => <View key={`${p.id}-${i}`} style={s.parametro}>
                  <View style={s.filaSeparada}><Text style={[s.parametroNombre, { flex: 1 }]}>{i + 1}. {p.nombre}</Text>
                    <View style={[s.badge, { backgroundColor: p.registrado && p.valor ? C.verdeClaro : C.ambarClaro }]}>
                      <Text style={[s.badgeTexto, { color: p.registrado && p.valor ? C.verde : C.ambar }]}>
                        {p.registrado && p.valor ? "Registrado" : "Pendiente"}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.parametroValor}>{p.registrado && p.valor ? p.valor : "Sin valor"}
                    {!!p.unidad && <Text style={s.parametroUnidad}> {p.unidad}</Text>}</Text>
                  {!!p.referencia && <Text style={s.dato}>Referencia: {p.referencia}</Text>}
                  {!!p.observacion && <Text style={s.dato}>Observación: {p.observacion}</Text>}
                </View>)}
            </View>
            {seleccionado.validado ? <View style={s.exito}>
              <Text style={s.exitoTitulo}>Resultado validado</Text>
              <Text style={s.dato}>Fecha: {fecha(seleccionado.fechaValidacion)}</Text>
              <Text style={s.dato}>Validado por: {nombreValidador}</Text>
              <Text style={s.textoSuave}>Este resultado es de solo lectura.</Text>
            </View> : <View style={[s.advertencia, puedeValidar && s.avisoListo]}>
              <Text style={s.advertenciaTitulo}>{puedeValidar ? "Listo para validación" : "Validación no disponible"}</Text>
              <Text style={s.textoSuave}>{puedeValidar ?
                "Revisa cuidadosamente los valores antes de confirmar. La validación bloqueará su edición." :
                "El resultado debe estar en borrador y tener todos los parámetros configurados con valores registrados, o un valor principal cuando no hay parámetros."}</Text>
            </View>}
            <View style={s.acciones}>
              <Pressable onPress={cerrar} disabled={validando} style={s.cancelar}><Text style={s.cancelarTexto}>Cerrar</Text></Pressable>
              {!seleccionado.validado && <Pressable onPress={() => confirmar(() => void validar())}
                disabled={!puedeValidar || validando} style={[s.validar, (!puedeValidar || validando) && s.desactivado]}>
                {validando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.botonTexto}>Validar resultado</Text>}
              </Pressable>}
            </View>
          </>}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { padding: 18, paddingBottom: 55 },
  cargando: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.fondo, gap: 14 },
  textoSuave: { color: C.secundario, fontSize: 13, lineHeight: 20 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  sobretitulo: { fontSize: 10, fontWeight: "800", color: C.azul, letterSpacing: 1.2, marginBottom: 7 },
  titulo: { fontSize: 27, fontWeight: "800", color: C.azulOscuro, marginBottom: 6 },
  descripcion: { color: C.secundario, fontSize: 13, lineHeight: 20 },
  volver: { backgroundColor: "#334155", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  volverTexto: { color: C.blanco, fontWeight: "800", fontSize: 12 },
  estadisticas: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  estadistica: { flexGrow: 1, minWidth: 100, backgroundColor: C.blanco, borderRadius: 14,
    borderWidth: 1, borderColor: C.borde, padding: 15 },
  punto: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 9 },
  puntoInterior: { width: 12, height: 12, borderRadius: 6 },
  estadisticaNumero: { fontSize: 27, fontWeight: "800", color: C.azulOscuro },
  estadisticaTitulo: { fontSize: 12, color: C.secundario, marginTop: 4 },
  panel: { backgroundColor: C.blanco, borderRadius: 15, borderWidth: 1, borderColor: C.borde,
    padding: 17, marginBottom: 16 },
  seccionTitulo: { fontSize: 17, fontWeight: "800", color: C.azulOscuro, marginBottom: 9 },
  buscador: { borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC",
    color: C.texto, paddingHorizontal: 14, paddingVertical: 12, marginTop: 13, fontSize: 14 },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 },
  filtro: { backgroundColor: "#F1F5F9", borderRadius: 20, paddingVertical: 9, paddingHorizontal: 13 },
  filtroActivo: { backgroundColor: C.azulOscuro },
  filtroTexto: { fontSize: 12, color: C.secundario, fontWeight: "700" },
  filtroTextoActivo: { color: C.blanco },
  filaSeparada: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  conteo: { fontSize: 12, color: C.secundario },
  actualizar: { backgroundColor: C.azulClaro, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  actualizarTexto: { color: C.azulOscuro, fontSize: 12, fontWeight: "800" },
  tarjeta: { borderWidth: 1, borderColor: C.borde, borderRadius: 13, padding: 15, marginTop: 12 },
  tarjetaSuperior: { flexDirection: "row", alignItems: "center", gap: 10 },
  icono: { width: 43, height: 43, borderRadius: 11, backgroundColor: C.azulClaro,
    justifyContent: "center", alignItems: "center" },
  iconoTexto: { fontSize: 19, color: C.azul, fontWeight: "800" },
  analisis: { fontSize: 15, color: C.azulOscuro, fontWeight: "800", marginBottom: 4 },
  codigo: { fontSize: 10, color: C.secundario },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  badgeTexto: { fontSize: 10, fontWeight: "800" },
  linea: { height: 1, backgroundColor: C.borde, marginVertical: 13 },
  dato: { fontSize: 13, color: C.texto, marginBottom: 8, lineHeight: 20 },
  etiqueta: { color: C.secundario, fontWeight: "600" },
  fecha: { fontSize: 11, color: C.secundario, marginTop: 3 },
  boton: { backgroundColor: C.azul, borderRadius: 9, padding: 13, alignItems: "center", marginTop: 15 },
  botonTexto: { color: C.blanco, fontSize: 12, fontWeight: "800", textAlign: "center" },
  desactivado: { opacity: 0.45 },
  vacio: { alignItems: "center", padding: 25, gap: 8 },
  vacioTitulo: { fontSize: 15, fontWeight: "800", color: C.azulOscuro, textAlign: "center" },
  error: { backgroundColor: C.rojoClaro, borderColor: "#FECACA", borderWidth: 1, borderRadius: 10,
    padding: 15, marginBottom: 15 },
  errorTexto: { color: C.rojo, fontSize: 13, lineHeight: 20 },
  reintentar: { color: C.rojo, fontWeight: "800", marginTop: 9 },
  fondoModal: { flex: 1, backgroundColor: "rgba(15,23,42,0.65)", padding: 12,
    justifyContent: "center", alignItems: "center" },
  modal: { width: "100%", maxWidth: 710, maxHeight: "94%", borderRadius: 17,
    backgroundColor: C.blanco, overflow: "hidden" },
  modalContenido: { padding: 19, paddingBottom: 35 },
  modalTitulo: { fontSize: 22, fontWeight: "800", color: C.azulOscuro, marginBottom: 15 },
  cerrar: { backgroundColor: "#F1F5F9", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 9 },
  cerrarTexto: { fontSize: 12, color: C.azulOscuro, fontWeight: "800" },
  resumen: { backgroundColor: C.azulOscuro, borderRadius: 13, padding: 17, marginBottom: 16 },
  resumenSubtitulo: { color: "#BFDBFE", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  resumenTitulo: { color: C.blanco, fontSize: 19, fontWeight: "800", marginTop: 8, marginBottom: 13 },
  resumenDato: { color: "#DBEAFE", fontSize: 12, marginBottom: 7 },
  resumenProgreso: { backgroundColor: C.azulClaro, borderRadius: 12, padding: 15, marginBottom: 16 },
  progresoNumero: { color: C.azul, fontSize: 17, fontWeight: "800" },
  barra: { backgroundColor: "#DBEAFE", height: 9, borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  barraDentro: { backgroundColor: C.azul, height: "100%", borderRadius: 8 },
  bloque: { borderWidth: 1, borderColor: C.borde, borderRadius: 12, padding: 15, marginBottom: 15 },
  parametro: { borderTopWidth: 1, borderTopColor: C.borde, paddingTop: 13, marginTop: 12 },
  parametroNombre: { fontSize: 13, color: C.azulOscuro, fontWeight: "800" },
  parametroValor: { fontSize: 22, color: C.texto, fontWeight: "800", marginVertical: 8 },
  parametroUnidad: { fontSize: 12, color: C.secundario, fontWeight: "500" },
  advertencia: { borderRadius: 10, backgroundColor: C.ambarClaro, borderWidth: 1,
    borderColor: "#FDE68A", padding: 14, marginBottom: 14 },
  avisoListo: { backgroundColor: C.verdeClaro, borderColor: "#A7F3D0" },
  advertenciaTitulo: { fontSize: 13, fontWeight: "800", color: C.azulOscuro, marginBottom: 6 },
  exito: { backgroundColor: C.verdeClaro, borderRadius: 10, padding: 15, marginBottom: 15 },
  exitoTitulo: { color: C.verde, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  acciones: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 },
  cancelar: { backgroundColor: "#E2E8F0", borderRadius: 9, paddingHorizontal: 16, paddingVertical: 13 },
  cancelarTexto: { color: C.azulOscuro, fontWeight: "800", fontSize: 12 },
  validar: { backgroundColor: C.verde, borderRadius: 9, paddingHorizontal: 17,
    paddingVertical: 13, minWidth: 145, alignItems: "center" },
});
