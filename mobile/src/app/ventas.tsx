import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

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
import { generarPDFVenta } from "../services/pdfService";

// ======================================================
// TIPOS
// ======================================================

type Paciente = {
  id: string;
  pacienteId: string;
  nombres: string;
  apellidos: string;
  ci: string;
};

type Analisis = {
  analisisId?: string;
  nombre?: string;
  tipo?: string;
  precio?: number;
  cantidad?: number;
};

type Solicitud = {
  id: string;
  solicitudId: string;
  pacienteId: string;
  laboratorioId: string;
  estado: string;
  total: number;
  analisis: Analisis[];
};

type Venta = {
  id: string;
  ventaId: string;
  solicitudId: string;
  ordenId: string;
  pacienteId: string;
  laboratorioId: string;
  metodoPago: string;
  total: number;
  usuarioId: string;
  fecha: any;
  estado: string;
  analisis: Analisis[];
};

type Usuario = {
  uid: string;
  rol: string;
  laboratorioId: string;
  nombre: string;
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor: any): string {
  return String(valor ?? "").trim();
}

function normalizar(valor: any): string {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function numero(valor: any): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dinero(valor: any): string {
  return numero(valor).toFixed(2);
}

function obtenerFecha(valor: any): Date | null {
  if (!valor) return null;

  try {
    if (typeof valor.toDate === "function") {
      return valor.toDate();
    }

    if (typeof valor.seconds === "number") {
      return new Date(valor.seconds * 1000);
    }

    const fecha = new Date(valor);

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  } catch {
    return null;
  }
}

function fechaVisible(valor: any): string {
  const fecha = obtenerFecha(valor);

  if (!fecha) return "Sin fecha";

  return fecha.toLocaleString("es-BO");
}

function fechaISO(valor: any): string {
  const fecha = obtenerFecha(valor);

  if (!fecha) return "";

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function fechaValida(valor: string): boolean {
  if (!valor) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T12:00:00`);

  return (
    !Number.isNaN(fecha.getTime()) &&
    fechaISO(fecha) === valor
  );
}

// ======================================================
// PANTALLA
// ======================================================

export default function VentasScreen() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState("");

  const [error, setError] = useState("");

  // FILTROS DEL HISTORIAL

  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pacienteFiltro, setPacienteFiltro] = useState("");
  const [usuarioFiltro, setUsuarioFiltro] = useState("");

  const [mostrarPacientes, setMostrarPacientes] = useState(false);

  // REGISTRAR VENTA

  const [busquedaSolicitud, setBusquedaSolicitud] = useState("");
  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] =
    useState("");

  const [metodoPago, setMetodoPago] = useState("efectivo");

  // DETALLE

  const [ventaDetalle, setVentaDetalle] = useState<Venta | null>(
    null
  );

  const puedeRegistrar =
    normalizar(usuario?.rol) === "recepcionista";

  // ====================================================
  // AUTENTICACIÓN
  // ====================================================

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUsuario(null);
        setCargando(false);
        setError("Debes iniciar sesión.");
        return;
      }

      try {
        setCargando(true);
        setError("");

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
          throw new Error("Tu usuario está inactivo.");
        }

        const rol = normalizar(datos.rol);

        if (
          rol !== "administrador" &&
          rol !== "recepcionista"
        ) {
          throw new Error(
            "No tienes autorización para acceder a Ventas."
          );
        }

        const laboratorioId = texto(datos.laboratorioId);

        if (!laboratorioId) {
          throw new Error(
            "Tu usuario no tiene laboratorio asignado."
          );
        }

        const usuarioActual: Usuario = {
          uid: firebaseUser.uid,
          rol,
          laboratorioId,
          nombre: texto(datos.nombre),
        };

        setUsuario(usuarioActual);

        await cargarDatos(laboratorioId);
      } catch (e: any) {
        console.error("Error de acceso a Ventas:", e);

        setError(
          e?.message || "No se pudo abrir Gestión de ventas."
        );
      } finally {
        setCargando(false);
      }
    });

    return cancelar;
  }, []);

  // ====================================================
  // CARGAR FIRESTORE
  // ====================================================

  async function cargarDatos(laboratorioId: string) {
    const consultaPacientes = query(
      collection(db, "pacientes"),
      where("laboratorioId", "==", laboratorioId)
    );

    const consultaSolicitudes = query(
      collection(db, "solicitudes"),
      where("laboratorioId", "==", laboratorioId)
    );

    const consultaVentas = query(
      collection(db, "ventas"),
      where("laboratorioId", "==", laboratorioId)
    );

    const [pacientesSnap, solicitudesSnap, ventasSnap] =
      await Promise.all([
        getDocs(consultaPacientes),
        getDocs(consultaSolicitudes),
        getDocs(consultaVentas),
      ]);

    const pacientesLista: Paciente[] = pacientesSnap.docs.map(
      (item) => {
        const datos = item.data();

        return {
          id: item.id,
          pacienteId: texto(datos.pacienteId || item.id),
          nombres: texto(datos.nombres || datos.nombre),
          apellidos: texto(datos.apellidos || datos.apellido),
          ci: texto(datos.ci || datos.carnet),
        };
      }
    );

    const solicitudesLista: Solicitud[] =
      solicitudesSnap.docs.map((item) => {
        const datos = item.data();

        return {
          id: item.id,
          solicitudId: texto(datos.solicitudId || item.id),
          pacienteId: texto(datos.pacienteId),
          laboratorioId: texto(datos.laboratorioId),
          estado: texto(datos.estado || "pendiente"),
          total: numero(datos.total ?? datos.montoTotal),
          analisis: Array.isArray(datos.analisis)
            ? datos.analisis
            : [],
        };
      });

    const ventasLista: Venta[] = ventasSnap.docs.map((item) => {
      const datos = item.data();

      return {
        id: item.id,
        ventaId: texto(datos.ventaId || item.id),
        solicitudId: texto(datos.solicitudId),
        ordenId: texto(datos.ordenId),
        pacienteId: texto(datos.pacienteId),
        laboratorioId: texto(datos.laboratorioId),
        metodoPago: texto(datos.metodoPago || datos.metodo_pago),
        total: numero(datos.total ?? datos.montoTotal),
        usuarioId: texto(
          datos.usuarioId ||
            datos.empleadoId ||
            datos.registradoPor
        ),
        fecha:
          datos.fecha ||
          datos.fechaCreacion ||
          datos.createdAt ||
          null,
        estado: texto(datos.estado || "pagada"),
        analisis: Array.isArray(datos.analisis)
          ? datos.analisis
          : [],
      };
    });

    ventasLista.sort((a, b) => {
      const fechaA = obtenerFecha(a.fecha)?.getTime() || 0;
      const fechaB = obtenerFecha(b.fecha)?.getTime() || 0;

      return fechaB - fechaA;
    });

    setPacientes(pacientesLista);
    setSolicitudes(solicitudesLista);
    setVentas(ventasLista);
  }

  async function actualizar() {
    if (!usuario) return;

    try {
      setActualizando(true);
      await cargarDatos(usuario.laboratorioId);
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message || "No se pudieron actualizar las ventas."
      );
    } finally {
      setActualizando(false);
    }
  }

  // ====================================================
  // PACIENTES
  // ====================================================

  function obtenerPaciente(pacienteId: string) {
    return pacientes.find(
      (item) =>
        item.id === pacienteId ||
        item.pacienteId === pacienteId
    );
  }

  function nombrePaciente(pacienteId: string): string {
    const paciente = obtenerPaciente(pacienteId);

    if (!paciente) return "Paciente no encontrado";

    return `${paciente.nombres} ${paciente.apellidos}`.trim();
  }

  function ciPaciente(pacienteId: string): string {
    return obtenerPaciente(pacienteId)?.ci || "-";
  }

  // ====================================================
  // SOLICITUDES PENDIENTES
  // ====================================================

  const solicitudesPendientes = useMemo(() => {
    return solicitudes.filter(
      (item) => normalizar(item.estado) === "pendiente"
    );
  }, [solicitudes]);

  const solicitudesFiltradas = useMemo(() => {
    const buscar = normalizar(busquedaSolicitud);

    return solicitudesPendientes.filter((item) => {
      const paciente = obtenerPaciente(item.pacienteId);

      const nombre = normalizar(paciente?.nombres);
      const apellido = normalizar(paciente?.apellidos);
      const ci = normalizar(paciente?.ci);

      return (
        !buscar ||
        nombre.includes(buscar) ||
        apellido.includes(buscar) ||
        `${nombre} ${apellido}`.includes(buscar) ||
        ci.includes(buscar) ||
        normalizar(item.id).includes(buscar)
      );
    });
  }, [solicitudesPendientes, pacientes, busquedaSolicitud]);

  const solicitudSeleccionada = solicitudes.find(
    (item) => item.id === solicitudSeleccionadaId
  );

  // ====================================================
  // FILTROS DEL HISTORIAL
  // ====================================================

  const ventasFiltradas = useMemo(() => {
    const buscar = normalizar(busqueda);
    const uid = normalizar(usuarioFiltro);

    return ventas.filter((venta) => {
      const paciente = obtenerPaciente(venta.pacienteId);

      const nombre = normalizar(paciente?.nombres);
      const apellido = normalizar(paciente?.apellidos);
      const ci = normalizar(paciente?.ci);

      const coincideBusqueda =
        !buscar ||
        nombre.includes(buscar) ||
        apellido.includes(buscar) ||
        `${nombre} ${apellido}`.includes(buscar) ||
        ci.includes(buscar);

      const coincidePaciente =
        !pacienteFiltro ||
        venta.pacienteId === pacienteFiltro;

      const coincideUsuario =
        !uid || normalizar(venta.usuarioId).includes(uid);

      const fechaVenta = fechaISO(venta.fecha);

      const coincideDesde =
        !fechaDesde || fechaVenta >= fechaDesde;

      const coincideHasta =
        !fechaHasta || fechaVenta <= fechaHasta;

      return (
        coincideBusqueda &&
        coincidePaciente &&
        coincideUsuario &&
        coincideDesde &&
        coincideHasta
      );
    });
  }, [
    ventas,
    pacientes,
    busqueda,
    pacienteFiltro,
    usuarioFiltro,
    fechaDesde,
    fechaHasta,
  ]);

  // ====================================================
  // REGISTRAR VENTA + GENERAR ORDEN
  // ====================================================

  async function registrarVenta() {
    if (!usuario || !puedeRegistrar) {
      Alert.alert(
        "Sin permiso",
        "Solo Recepcionista puede registrar ventas."
      );
      return;
    }

    if (!solicitudSeleccionada) {
      Alert.alert(
        "Selecciona una solicitud",
        "Debes elegir una solicitud pendiente."
      );
      return;
    }

    if (guardando) return;

    try {
      setGuardando(true);

      const solicitudRef = doc(
        db,
        "solicitudes",
        solicitudSeleccionada.id
      );

      const ventaRef = doc(collection(db, "ventas"));
      const ordenRef = doc(collection(db, "ordenes"));

      await runTransaction(db, async (transaccion) => {
        const solicitudSnap = await transaccion.get(solicitudRef);

        if (!solicitudSnap.exists()) {
          throw new Error("La solicitud no existe.");
        }

        const datos = solicitudSnap.data();

        if (
          texto(datos.laboratorioId) !== usuario.laboratorioId
        ) {
          throw new Error(
            "La solicitud pertenece a otro laboratorio."
          );
        }

        if (normalizar(datos.estado) !== "pendiente") {
          throw new Error(
            "Esta solicitud ya no está pendiente."
          );
        }

        const analisis = Array.isArray(datos.analisis)
          ? datos.analisis
          : [];

        const total = numero(datos.total ?? datos.montoTotal);

        if (!analisis.length) {
          throw new Error(
            "La solicitud no contiene análisis."
          );
        }

        if (total <= 0) {
          throw new Error(
            "El total de la solicitud debe ser mayor a cero."
          );
        }

        const pacienteId = texto(datos.pacienteId);

        transaccion.set(ventaRef, {
          ventaId: ventaRef.id,
          solicitudId: solicitudRef.id,
          ordenId: ordenRef.id,
          pacienteId,
          laboratorioId: usuario.laboratorioId,
          usuarioId: usuario.uid,
          empleadoId: usuario.uid,
          metodoPago,
          total,
          montoTotal: total,
          estado: "pagada",
          fecha: serverTimestamp(),
          fechaCreacion: serverTimestamp(),
        });

        transaccion.set(ordenRef, {
          ordenId: ordenRef.id,
          solicitudId: solicitudRef.id,
          ventaId: ventaRef.id,
          pacienteId,
          laboratorioId: usuario.laboratorioId,
          analisis,
          total,
          estado: "pendiente",
          fecha: serverTimestamp(),
          fechaCreacion: serverTimestamp(),
        });

        transaccion.update(solicitudRef, {
          estado: "pagada",
          ventaId: ventaRef.id,
          ordenId: ordenRef.id,
          fechaPago: serverTimestamp(),
        });
      });

      setSolicitudSeleccionadaId("");
      setBusquedaSolicitud("");

      await cargarDatos(usuario.laboratorioId);

      Alert.alert(
        "Venta registrada",
        `La venta y la orden se crearon correctamente.\n\nVenta: ${ventaRef.id}\nOrden: ${ordenRef.id}`
      );
    } catch (e: any) {
      console.error("Error registrando venta:", e);

      Alert.alert(
        "Error",
        e?.message || "No se pudo registrar la venta."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ====================================================
  // PDF
  // ====================================================

  async function imprimirVenta(venta: Venta) {
    try {
      setGenerandoPDF(venta.id);

      const solicitud = solicitudes.find(
        (item) =>
          item.id === venta.solicitudId ||
          item.solicitudId === venta.solicitudId
      );

      const paciente = obtenerPaciente(venta.pacienteId);

      const analisis =
        solicitud?.analisis?.length
          ? solicitud.analisis
          : venta.analisis;

      await generarPDFVenta({
        codigo: venta.ventaId || venta.id,
        fecha: fechaVisible(venta.fecha),
        laboratorio: "Laboratorio Clínico",
        paciente: nombrePaciente(venta.pacienteId),
        ci: paciente?.ci || "",
        metodoPago: venta.metodoPago,
        total: venta.total,
        analisis,
      });
    } catch (e: any) {
      console.error("Error generando PDF:", e);

      Alert.alert(
        "Error",
        e?.message || "No se pudo generar el PDF."
      );
    } finally {
      setGenerandoPDF("");
    }
  }

  // ====================================================
  // CARGANDO
  // ====================================================

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#0284C7" />

        <Text style={styles.cargandoTexto}>
          Cargando gestión de ventas...
        </Text>
      </View>
    );
  }

  // ====================================================
  // ERROR
  // ====================================================

  if (error || !usuario) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.errorTitulo}>
          No se pudo abrir Ventas
        </Text>

        <Text style={styles.errorTexto}>
          {error || "No hay una sesión activa."}
        </Text>

        <Pressable
          style={styles.botonAzul}
          onPress={() => router.back()}
        >
          <Text style={styles.botonBlanco}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  // ====================================================
  // INTERFAZ PRINCIPAL
  // ====================================================

  return (
    <View style={styles.pantalla}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={actualizar}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.volver}>
              ← Volver
            </Text>
          </Pressable>

          <Text style={styles.etiquetaSuperior}>
            VENTAS Y ÓRDENES
          </Text>

          <Text style={styles.titulo}>
            Gestión de ventas
          </Text>

          <Text style={styles.subtitulo}>
            Registra la venta de una solicitud y genera una
            orden independiente para el procesamiento.
          </Text>
        </View>

        {/* ESTADÍSTICAS */}

        <View style={styles.estadisticas}>
          <View style={styles.estadistica}>
            <Text style={styles.estadisticaEtiqueta}>
              VENTAS
            </Text>

            <Text style={styles.estadisticaNumero}>
              {ventas.length}
            </Text>
          </View>

          <View style={styles.estadistica}>
            <Text style={styles.estadisticaEtiqueta}>
              SOLICITUDES PENDIENTES
            </Text>

            <Text style={styles.estadisticaNumero}>
              {solicitudesPendientes.length}
            </Text>
          </View>

          <View style={styles.estadistica}>
            <Text style={styles.estadisticaEtiqueta}>
              RESULTADOS FILTRADOS
            </Text>

            <Text style={styles.estadisticaNumero}>
              {ventasFiltradas.length}
            </Text>
          </View>
        </View>

        {/* =========================================== */}
        {/* HISTORIAL DE VENTAS */}
        {/* =========================================== */}

        <View style={styles.tarjeta}>
          <Text style={styles.hu}>HU-21</Text>

          <Text style={styles.seccionTitulo}>
            Historial de ventas
          </Text>

          <Text style={styles.descripcion}>
            Filtra por fecha, paciente, nombre, apellido,
            CI o usuario que realizó la operación.
          </Text>

          <Text style={styles.label}>
            Buscar paciente por nombre, apellido o CI
          </Text>

          <TextInput
            style={styles.input}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Escribe el nombre, apellido o carnet..."
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.resultados}>
            Resultados encontrados: {ventasFiltradas.length}
          </Text>

          <Text style={styles.label}>
            Desde (AAAA-MM-DD)
          </Text>

          <TextInput
            style={styles.input}
            value={fechaDesde}
            onChangeText={setFechaDesde}
            placeholder="2026-10-01"
            placeholderTextColor="#94A3B8"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <Text style={styles.label}>
            Hasta (AAAA-MM-DD)
          </Text>

          <TextInput
            style={styles.input}
            value={fechaHasta}
            onChangeText={setFechaHasta}
            placeholder="2026-10-31"
            placeholderTextColor="#94A3B8"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          {(!fechaValida(fechaDesde) ||
            !fechaValida(fechaHasta)) && (
            <Text style={styles.advertencia}>
              Escribe las fechas con formato AAAA-MM-DD.
            </Text>
          )}

          <Text style={styles.label}>
            Paciente
          </Text>

          <Pressable
            style={styles.selector}
            onPress={() => setMostrarPacientes(true)}
          >
            <Text style={styles.selectorTexto}>
              {pacienteFiltro
                ? nombrePaciente(pacienteFiltro)
                : "Todos los pacientes"}
            </Text>

            <Text style={styles.selectorFlecha}>⌄</Text>
          </Pressable>

          <Text style={styles.label}>
            Usuario / UID
          </Text>

          <TextInput
            style={styles.input}
            value={usuarioFiltro}
            onChangeText={setUsuarioFiltro}
            placeholder="Buscar UID..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />

          <Pressable
            style={styles.limpiarFiltros}
            onPress={() => {
              setBusqueda("");
              setFechaDesde("");
              setFechaHasta("");
              setPacienteFiltro("");
              setUsuarioFiltro("");
            }}
          >
            <Text style={styles.limpiarTexto}>
              Limpiar filtros
            </Text>
          </Pressable>

          {/* LISTADO */}

          {ventasFiltradas.length === 0 ? (
            <View style={styles.sinResultados}>
              <Text style={styles.sinResultadosTexto}>
                No se encontraron ventas.
              </Text>
            </View>
          ) : (
            ventasFiltradas.map((venta) => (
              <View key={venta.id} style={styles.venta}>
                <View style={styles.ventaEncabezado}>
                  <Text style={styles.ventaPaciente}>
                    {nombrePaciente(venta.pacienteId)}
                  </Text>

                  <Text style={styles.ventaTotal}>
                    Bs {dinero(venta.total)}
                  </Text>
                </View>

                <Text style={styles.dato}>
                  Fecha: {fechaVisible(venta.fecha)}
                </Text>

                <Text style={styles.dato}>
                  CI: {ciPaciente(venta.pacienteId)}
                </Text>

                <Text style={styles.dato}>
                  Método: {venta.metodoPago || "-"}
                </Text>

                <Text style={styles.dato}>
                  Orden: {venta.ordenId || "-"}
                </Text>

                <Text style={styles.dato}>
                  Usuario: {venta.usuarioId || "-"}
                </Text>

                <View style={styles.acciones}>
                  <Pressable
                    style={styles.botonDetalle}
                    onPress={() => setVentaDetalle(venta)}
                  >
                    <Text style={styles.botonDetalleTexto}>
                      Ver detalle
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.botonAzul,
                      generandoPDF === venta.id &&
                        styles.deshabilitado,
                    ]}
                    disabled={generandoPDF === venta.id}
                    onPress={() => imprimirVenta(venta)}
                  >
                    {generandoPDF === venta.id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.botonBlanco}>
                        Generar PDF
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* =========================================== */}
        {/* REGISTRAR NUEVA VENTA */}
        {/* =========================================== */}

        {puedeRegistrar && (
          <View style={styles.tarjeta}>
            <Text style={styles.hu}>HU-20</Text>

            <Text style={styles.seccionTitulo}>
              Registrar venta
            </Text>

            <Text style={styles.descripcion}>
              Selecciona una solicitud pendiente para
              registrar el pago y generar su orden.
            </Text>

            <Text style={styles.label}>
              Buscar solicitud pendiente
            </Text>

            <TextInput
              style={styles.input}
              value={busquedaSolicitud}
              onChangeText={setBusquedaSolicitud}
              placeholder="Nombre, apellido, CI o código..."
              placeholderTextColor="#94A3B8"
            />

            {solicitudesFiltradas.length === 0 ? (
              <Text style={styles.sinResultadosTexto}>
                No hay solicitudes pendientes.
              </Text>
            ) : (
              solicitudesFiltradas.map((solicitud) => (
                <Pressable
                  key={solicitud.id}
                  style={[
                    styles.solicitud,
                    solicitudSeleccionadaId === solicitud.id &&
                      styles.solicitudActiva,
                  ]}
                  onPress={() =>
                    setSolicitudSeleccionadaId(solicitud.id)
                  }
                >
                  <Text style={styles.ventaPaciente}>
                    {nombrePaciente(solicitud.pacienteId)}
                  </Text>

                  <Text style={styles.dato}>
                    CI: {ciPaciente(solicitud.pacienteId)}
                  </Text>

                  <Text style={styles.dato}>
                    Solicitud: {solicitud.solicitudId}
                  </Text>

                  <Text style={styles.ventaTotal}>
                    Bs {dinero(solicitud.total)}
                  </Text>

                  <Text style={styles.seleccionarTexto}>
                    {solicitudSeleccionadaId === solicitud.id
                      ? "✓ Seleccionada"
                      : "Seleccionar"}
                  </Text>
                </Pressable>
              ))
            )}

            {solicitudSeleccionada && (
              <View style={styles.detalleSolicitud}>
                <Text style={styles.seccionTitulo}>
                  Detalle de solicitud
                </Text>

                {solicitudSeleccionada.analisis.map(
                  (item, index) => (
                    <View
                      key={`${item.analisisId || index}`}
                      style={styles.analisisFila}
                    >
                      <Text style={styles.analisisNombre}>
                        {item.nombre || "Análisis"}
                      </Text>

                      <Text style={styles.analisisPrecio}>
                        Bs{" "}
                        {dinero(
                          numero(item.precio) *
                            numero(item.cantidad || 1)
                        )}
                      </Text>
                    </View>
                  )
                )}

                <Text style={styles.totalFinal}>
                  Total: Bs{" "}
                  {dinero(solicitudSeleccionada.total)}
                </Text>

                <Text style={styles.label}>
                  Método de pago
                </Text>

                <View style={styles.metodos}>
                  {[
                    "efectivo",
                    "qr",
                    "transferencia",
                  ].map((metodo) => (
                    <Pressable
                      key={metodo}
                      style={[
                        styles.metodo,
                        metodoPago === metodo &&
                          styles.metodoActivo,
                      ]}
                      onPress={() => setMetodoPago(metodo)}
                    >
                      <Text
                        style={[
                          styles.metodoTexto,
                          metodoPago === metodo &&
                            styles.metodoTextoActivo,
                        ]}
                      >
                        {metodo.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[
                    styles.botonRegistrar,
                    guardando && styles.deshabilitado,
                  ]}
                  disabled={guardando}
                  onPress={registrarVenta}
                >
                  {guardando ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.botonBlanco}>
                      Registrar pago y generar orden
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* =========================================== */}
      {/* MODAL FILTRO PACIENTES */}
      {/* =========================================== */}

      <Modal
        visible={mostrarPacientes}
        transparent
        animationType="slide"
        onRequestClose={() => setMostrarPacientes(false)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>
              Filtrar por paciente
            </Text>

            <ScrollView style={{ maxHeight: 350 }}>
              <Pressable
                style={styles.modalOpcion}
                onPress={() => {
                  setPacienteFiltro("");
                  setMostrarPacientes(false);
                }}
              >
                <Text>Todos los pacientes</Text>
              </Pressable>

              {pacientes.map((paciente) => (
                <Pressable
                  key={paciente.id}
                  style={styles.modalOpcion}
                  onPress={() => {
                    setPacienteFiltro(paciente.pacienteId);
                    setMostrarPacientes(false);
                  }}
                >
                  <Text>
                    {paciente.nombres} {paciente.apellidos}
                  </Text>

                  <Text style={styles.dato}>
                    CI: {paciente.ci}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={styles.botonCerrar}
              onPress={() => setMostrarPacientes(false)}
            >
              <Text style={styles.botonBlanco}>
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =========================================== */}
      {/* MODAL DETALLE VENTA */}
      {/* =========================================== */}

      <Modal
        visible={ventaDetalle !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setVentaDetalle(null)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>
              Detalle de venta
            </Text>

            {ventaDetalle && (
              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={styles.detalleTexto}>
                  Venta: {ventaDetalle.ventaId}
                </Text>

                <Text style={styles.detalleTexto}>
                  Paciente:{" "}
                  {nombrePaciente(ventaDetalle.pacienteId)}
                </Text>

                <Text style={styles.detalleTexto}>
                  CI: {ciPaciente(ventaDetalle.pacienteId)}
                </Text>

                <Text style={styles.detalleTexto}>
                  Fecha: {fechaVisible(ventaDetalle.fecha)}
                </Text>

                <Text style={styles.detalleTexto}>
                  Método: {ventaDetalle.metodoPago}
                </Text>

                <Text style={styles.detalleTexto}>
                  Solicitud: {ventaDetalle.solicitudId}
                </Text>

                <Text style={styles.detalleTexto}>
                  Orden: {ventaDetalle.ordenId || "-"}
                </Text>

                <Text style={styles.detalleTexto}>
                  Usuario: {ventaDetalle.usuarioId || "-"}
                </Text>

                <Text style={styles.totalFinal}>
                  Total: Bs {dinero(ventaDetalle.total)}
                </Text>
              </ScrollView>
            )}

            <Pressable
              style={styles.botonCerrar}
              onPress={() => setVentaDetalle(null)}
            >
              <Text style={styles.botonBlanco}>
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ======================================================
// ESTILOS COMPLETOS
// ======================================================

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F3F7FB",
  },

  contenido: {
    padding: 15,
    paddingBottom: 45,
  },

  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F3F7FB",
  },

  cargandoTexto: {
    marginTop: 12,
    color: "#64748B",
  },

  errorTitulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },

  errorTexto: {
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 20,
  },

  encabezado: {
    backgroundColor: "#EFF9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },

  volver: {
    color: "#334155",
    fontWeight: "800",
    marginBottom: 12,
  },

  etiquetaSuperior: {
    color: "#0369A1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 10,
  },

  titulo: {
    color: "#0F172A",
    fontSize: 26,
    fontWeight: "900",
  },

  subtitulo: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  estadisticas: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  estadistica: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  estadisticaEtiqueta: {
    fontSize: 8,
    fontWeight: "800",
    color: "#94A3B8",
  },

  estadisticaNumero: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 7,
  },

  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 17,
    marginBottom: 17,
  },

  hu: {
    color: "#0369A1",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 7,
  },

  descripcion: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
    marginTop: 12,
    marginBottom: 7,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },

  resultados: {
    color: "#64748B",
    marginTop: 10,
    marginBottom: 6,
  },

  advertencia: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 6,
  },

  selector: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  selectorTexto: {
    color: "#334155",
  },

  selectorFlecha: {
    color: "#334155",
    fontSize: 20,
  },

  limpiarFiltros: {
    alignSelf: "flex-end",
    paddingVertical: 12,
  },

  limpiarTexto: {
    color: "#0369A1",
    fontWeight: "800",
  },

  sinResultados: {
    padding: 25,
    alignItems: "center",
  },

  sinResultadosTexto: {
    color: "#64748B",
    textAlign: "center",
    paddingVertical: 12,
  },

  venta: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 15,
    marginTop: 12,
    backgroundColor: "#FAFCFF",
  },

  ventaEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },

  ventaPaciente: {
    flex: 1,
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
  },

  ventaTotal: {
    color: "#0369A1",
    fontWeight: "900",
    fontSize: 15,
  },

  dato: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 5,
  },

  acciones: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  botonDetalle: {
    flex: 1,
    backgroundColor: "#E0F2FE",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  botonDetalleTexto: {
    color: "#0369A1",
    fontWeight: "800",
  },

  botonAzul: {
    flex: 1,
    backgroundColor: "#0284C7",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  botonBlanco: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },

  solicitud: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },

  solicitudActiva: {
    borderColor: "#0284C7",
    borderWidth: 2,
    backgroundColor: "#EFF9FF",
  },

  seleccionarTexto: {
    color: "#0284C7",
    fontWeight: "800",
    marginTop: 10,
  },

  detalleSolicitud: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 18,
    paddingTop: 18,
  },

  analisisFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  analisisNombre: {
    color: "#334155",
    flex: 1,
    marginRight: 10,
  },

  analisisPrecio: {
    color: "#0369A1",
    fontWeight: "800",
  },

  totalFinal: {
    color: "#0369A1",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 15,
    marginBottom: 15,
  },

  metodos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },

  metodo: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 10,
  },

  metodoActivo: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },

  metodoTexto: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
  },

  metodoTextoActivo: {
    color: "#FFFFFF",
  },

  botonRegistrar: {
    backgroundColor: "#0284C7",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },

  deshabilitado: {
    opacity: 0.5,
  },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    padding: 20,
  },

  modalContenido: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 20,
    maxHeight: "85%",
  },

  modalTitulo: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 15,
  },

  modalOpcion: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  detalleTexto: {
    color: "#334155",
    fontSize: 13,
    marginBottom: 10,
  },

  botonCerrar: {
    backgroundColor: "#475569",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
});