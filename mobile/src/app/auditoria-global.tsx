import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import {
  collection,
  getDocs,
  limit,
  query,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Actividad = {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioObjetivo: string;
  laboratorioId: string;
  laboratorioNombre: string;
  accion: string;
  accionTexto: string;
  modulo: string;
  descripcion: string;
  fecha: any;
};

type OpcionFiltro = {
  id: string;
  nombre: string;
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function convertirFecha(valor: any): Date | null {
  if (!valor) return null;

  if (typeof valor.toDate === "function") {
    return valor.toDate();
  }

  if (typeof valor.seconds === "number") {
    return new Date(valor.seconds * 1000);
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function mostrarFecha(valor: any): string {
  const fecha = convertirFecha(valor);

  if (!fecha) return "Fecha no disponible";

  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obtenerNombreUsuario(datos: any): string {
  if (!datos) return "";

  const nombreCompleto = [
    datos.nombres || datos.nombre || "",
    datos.apellidos || datos.apellido || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    nombreCompleto ||
    datos.nombreCompleto ||
    datos.displayName ||
    datos.email ||
    datos.correo ||
    ""
  );
}

function obtenerNombreLaboratorio(datos: any): string {
  if (!datos) return "";

  return (
    datos.nombre ||
    datos.nombreLaboratorio ||
    datos.razonSocial ||
    datos.nombreComercial ||
    ""
  );
}

function formatearAccion(accion: string): string {
  const acciones: Record<string, string> = {
    CAMBIO_PASSWORD: "Cambio de contraseña",
    CREAR_USUARIO: "Creación de usuario",
    USUARIO_CREADO: "Creación de usuario",
    EDITAR_USUARIO: "Actualización de usuario",
    ACTUALIZAR_USUARIO: "Actualización de usuario",
    ELIMINAR_USUARIO: "Eliminación de usuario",

    CREAR_LABORATORIO: "Creación de laboratorio",
    EDITAR_LABORATORIO: "Actualización de laboratorio",
    ACTUALIZAR_LABORATORIO: "Actualización de laboratorio",
    ELIMINAR_LABORATORIO: "Eliminación de laboratorio",

    LOGIN: "Inicio de sesión",
    LOGOUT: "Cierre de sesión",

    CREAR_PACIENTE: "Registro de paciente",
    EDITAR_PACIENTE: "Actualización de paciente",

    CREAR_VENTA: "Registro de venta",
    REGISTRAR_VENTA: "Registro de venta",

    CREAR_SOLICITUD: "Creación de solicitud",
    REGISTRAR_SOLICITUD: "Registro de solicitud",

    CREAR_MUESTRA: "Registro de muestra",
    VALIDAR_MUESTRA: "Validación de muestra",

    CREAR_RESULTADO: "Registro de resultado",
    VALIDAR_RESULTADO: "Validación de resultado",
  };

  if (!accion) return "Actividad registrada";

  return (
    acciones[accion] ||
    accion
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^./, (letra) => letra.toUpperCase())
  );
}

function generarDescripcion(
  datos: any,
  usuarioObjetivo: string
): string {
  const descripcion =
    datos.descripcion ||
    datos.detalle ||
    datos.mensaje;

  if (typeof descripcion === "string" && descripcion.trim()) {
    return descripcion;
  }

  const accion = String(
    datos.accion || datos.evento || ""
  ).toUpperCase();

  const modulo = String(datos.modulo || "sistema");

  if (accion === "CAMBIO_PASSWORD") {
    return usuarioObjetivo
      ? `Se realizó un cambio de contraseña para ${usuarioObjetivo}.`
      : "Se realizó un cambio de contraseña de una cuenta del sistema.";
  }

  if (accion === "LOGIN") {
    return "El usuario inició sesión en la plataforma.";
  }

  if (accion === "LOGOUT") {
    return "El usuario cerró sesión en la plataforma.";
  }

  if (accion.includes("VALIDAR")) {
    return `Se realizó una validación en el módulo de ${modulo}.`;
  }

  if (
    accion.includes("CREAR") ||
    accion.includes("REGISTR")
  ) {
    return `Se registró información en el módulo de ${modulo}.`;
  }

  if (
    accion.includes("EDITAR") ||
    accion.includes("ACTUALIZAR")
  ) {
    return `Se actualizó información en el módulo de ${modulo}.`;
  }

  if (accion.includes("ELIMINAR")) {
    return `Se eliminó un registro del módulo de ${modulo}.`;
  }

  return `Se realizó la actividad "${formatearAccion(
    accion
  )}" en el módulo de ${modulo}.`;
}

function normalizarTexto(valor: string): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function AuditoriaGlobalScreen() {
  const router = useRouter();

  const [actividades, setActividades] = useState<Actividad[]>([]);

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [accionSeleccionada, setAccionSeleccionada] = useState("");
  const [laboratorioSeleccionado, setLaboratorioSeleccionado] =
    useState("");

  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [detalle, setDetalle] = useState<Actividad | null>(null);

  // =====================================================
  // VOLVER AL DASHBOARD
  // =====================================================

  function volverDashboard() {
    router.replace("/");
  }

  // =====================================================
  // CARGAR AUDITORÍA DESDE FIRESTORE
  // =====================================================

  const cargarAuditoria = useCallback(
    async (refrescar: boolean = false) => {
      if (refrescar) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      setError("");

      try {
        const consulta = query(
          collection(db, "auditoria"),
          limit(500)
        );

        const resultado = await getDocs(consulta);

        const mapaUsuarios = new Map<string, string>();
        const mapaLaboratorios = new Map<string, string>();

        // Consultar usuarios y laboratorios.
        const [resultadoUsuarios, resultadoLaboratorios] =
          await Promise.allSettled([
            getDocs(collection(db, "usuarios")),
            getDocs(collection(db, "laboratorios")),
          ]);

        // Nombres de usuarios.
        if (resultadoUsuarios.status === "fulfilled") {
          resultadoUsuarios.value.docs.forEach((documento) => {
            const datos = documento.data();

            const nombre = obtenerNombreUsuario(datos);

            if (nombre) {
              mapaUsuarios.set(documento.id, nombre);

              if (datos.uid) {
                mapaUsuarios.set(String(datos.uid), nombre);
              }
            }
          });
        } else {
          console.warn(
            "No se pudieron consultar los usuarios:",
            resultadoUsuarios.reason
          );
        }

        // Nombres de laboratorios.
        if (resultadoLaboratorios.status === "fulfilled") {
          resultadoLaboratorios.value.docs.forEach((documento) => {
            const datos = documento.data();

            const nombre = obtenerNombreLaboratorio(datos);

            if (nombre) {
              mapaLaboratorios.set(documento.id, nombre);
            }
          });
        } else {
          console.warn(
            "No se pudieron consultar los laboratorios:",
            resultadoLaboratorios.reason
          );
        }

        // Construir registros.
        const registros: Actividad[] = resultado.docs.map(
          (documento) => {
            const datos = documento.data();

            const usuarioId = String(
              datos.usuarioId || datos.uid || ""
            );

            const usuarioObjetivoId = String(
              datos.usuarioObjetivoId || ""
            );

            const laboratorioId = String(
              datos.laboratorioId || ""
            );

            const usuarioNombre = String(
              mapaUsuarios.get(usuarioId) ||
                datos.usuarioNombre ||
                datos.nombreUsuario ||
                datos.email ||
                "Usuario no disponible"
            );

            const usuarioObjetivo = String(
              mapaUsuarios.get(usuarioObjetivoId) ||
                datos.usuarioObjetivoNombre ||
                ""
            );

            const laboratorioNombre = String(
              mapaLaboratorios.get(laboratorioId) ||
                datos.laboratorioNombre ||
                "Laboratorio no disponible"
            );

            const accion = String(
              datos.accion || datos.evento || ""
            );

            const modulo = String(
              datos.modulo || "General"
            );

            const fecha =
              datos.fecha ||
              datos.fechaHora ||
              datos.createdAt ||
              datos.creadoEn ||
              null;

            return {
              id: documento.id,
              usuarioId,
              usuarioNombre,
              usuarioObjetivo,
              laboratorioId,
              laboratorioNombre,
              accion,
              accionTexto: formatearAccion(accion),
              modulo,
              descripcion: generarDescripcion(
                { ...datos, accion, modulo },
                usuarioObjetivo
              ),
              fecha,
            };
          }
        );

        // Ordenar desde la actividad más reciente.
        registros.sort((a, b) => {
          const fechaA =
            convertirFecha(a.fecha)?.getTime() || 0;

          const fechaB =
            convertirFecha(b.fecha)?.getTime() || 0;

          return fechaB - fechaA;
        });

        setActividades(registros);
      } catch (err: any) {
        console.error(
          "Error al cargar Auditoría Global:",
          err
        );

        if (err?.code === "permission-denied") {
          setError(
            "No tienes permisos para consultar los registros de auditoría. Revisa las reglas de Firestore."
          );
        } else {
          setError(
            "No se pudieron cargar las actividades. Verifica tu conexión."
          );
        }
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    []
  );

  useEffect(() => {
    cargarAuditoria();
  }, [cargarAuditoria]);

  // =====================================================
  // OPCIONES DE FILTROS
  // =====================================================

  const acciones = useMemo(() => {
    return [
      ...new Set(
        actividades
          .map((actividad) => actividad.accion)
          .filter(Boolean)
      ),
    ].sort();
  }, [actividades]);

  const laboratorios = useMemo<OpcionFiltro[]>(() => {
    const mapa = new Map<string, string>();

    actividades.forEach((actividad) => {
      const id =
        actividad.laboratorioId ||
        actividad.laboratorioNombre;

      mapa.set(id, actividad.laboratorioNombre);
    });

    return Array.from(mapa.entries()).map(
      ([id, nombre]) => ({
        id,
        nombre,
      })
    );
  }, [actividades]);

  // =====================================================
  // FILTRAR ACTIVIDADES
  // =====================================================

  const actividadesFiltradas = useMemo(() => {
    return actividades.filter((actividad) => {
      const texto = normalizarTexto(busqueda.trim());

      const contenido = normalizarTexto(
        [
          actividad.usuarioNombre,
          actividad.usuarioObjetivo,
          actividad.laboratorioNombre,
          actividad.accionTexto,
          actividad.descripcion,
          actividad.modulo,
        ].join(" ")
      );

      const coincideBusqueda =
        !texto || contenido.includes(texto);

      const coincideAccion =
        !accionSeleccionada ||
        actividad.accion === accionSeleccionada;

      const coincideLaboratorio =
        !laboratorioSeleccionado ||
        (actividad.laboratorioId ||
          actividad.laboratorioNombre) ===
          laboratorioSeleccionado;

      return (
        coincideBusqueda &&
        coincideAccion &&
        coincideLaboratorio
      );
    });
  }, [
    actividades,
    busqueda,
    accionSeleccionada,
    laboratorioSeleccionado,
  ]);

  // =====================================================
  // ESTADÍSTICAS
  // =====================================================

  const totalUsuarios = useMemo(() => {
    return new Set(
      actividades
        .map((actividad) => actividad.usuarioId)
        .filter(Boolean)
    ).size;
  }, [actividades]);

  const totalLaboratorios = laboratorios.length;

  function limpiarFiltros() {
    setBusqueda("");
    setAccionSeleccionada("");
    setLaboratorioSeleccionado("");
  }

  // =====================================================
  // TARJETA DE ACTIVIDAD
  // =====================================================

  function renderActividad({ item }: { item: Actividad }) {
    return (
      <Pressable
        style={styles.tarjetaActividad}
        onPress={() => setDetalle(item)}
      >
        <View style={styles.tarjetaEncabezado}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>
              {item.usuarioNombre.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.usuarioInformacion}>
            <Text style={styles.usuarioNombre}>
              {item.usuarioNombre}
            </Text>

            <Text style={styles.fecha}>
              {mostrarFecha(item.fecha)}
            </Text>
          </View>

          <Text style={styles.flecha}>›</Text>
        </View>

        <View style={styles.accionContenedor}>
          <Text style={styles.accionTexto}>
            {item.accionTexto}
          </Text>
        </View>

        <Text style={styles.descripcion}>
          {item.descripcion}
        </Text>

        <View style={styles.separador} />

        <View style={styles.filaInformacion}>
          <Text style={styles.iconoInformacion}>⌂</Text>

          <View style={styles.informacionContenido}>
            <Text style={styles.informacionEtiqueta}>
              LABORATORIO
            </Text>

            <Text style={styles.informacionValor}>
              {item.laboratorioNombre}
            </Text>
          </View>
        </View>

        <View style={styles.filaInformacion}>
          <Text style={styles.iconoInformacion}>▦</Text>

          <View style={styles.informacionContenido}>
            <Text style={styles.informacionEtiqueta}>
              MÓDULO
            </Text>

            <Text style={styles.informacionValor}>
              {item.modulo}
            </Text>
          </View>
        </View>

        <Text style={styles.verDetalle}>
          Ver información completa →
        </Text>
      </Pressable>
    );
  }

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F3F6FC"
      />

      <FlatList
        data={actividadesFiltradas}
        keyExtractor={(item) => item.id}
        renderItem={renderActividad}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contenido}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={() => cargarAuditoria(true)}
            colors={["#2563EB"]}
          />
        }
        ListHeaderComponent={
          <>
            {/* VOLVER */}

            <Pressable
              style={styles.botonVolver}
              onPress={volverDashboard}
            >
              <Text style={styles.botonVolverTexto}>
                ← Volver al Dashboard
              </Text>
            </Pressable>

            {/* ENCABEZADO */}

            <View style={styles.encabezado}>
              <View style={styles.iconoPrincipal}>
                <Text style={styles.iconoPrincipalTexto}>
                  📋
                </Text>
              </View>

              <Text style={styles.etiquetaSuperior}>
                SEGURIDAD Y CONTROL
              </Text>

              <Text style={styles.titulo}>
                Auditoría Global
              </Text>

              <Text style={styles.subtitulo}>
                Monitorea las actividades realizadas por los
                usuarios y laboratorios de la plataforma.
              </Text>
            </View>

            {/* ESTADÍSTICAS */}

            <View style={styles.estadisticas}>
              <View style={styles.tarjetaEstadistica}>
                <Text style={styles.estadisticaIcono}>
                  📋
                </Text>

                <Text style={styles.estadisticaNumero}>
                  {actividades.length}
                </Text>

                <Text style={styles.estadisticaTitulo}>
                  Actividades
                </Text>
              </View>

              <View style={styles.tarjetaEstadistica}>
                <Text style={styles.estadisticaIcono}>
                  👤
                </Text>

                <Text style={styles.estadisticaNumero}>
                  {totalUsuarios}
                </Text>

                <Text style={styles.estadisticaTitulo}>
                  Usuarios
                </Text>
              </View>

              <View style={styles.tarjetaEstadistica}>
                <Text style={styles.estadisticaIcono}>
                  🏥
                </Text>

                <Text style={styles.estadisticaNumero}>
                  {totalLaboratorios}
                </Text>

                <Text style={styles.estadisticaTitulo}>
                  Laboratorios
                </Text>
              </View>

              <View style={styles.tarjetaEstadistica}>
                <Text style={styles.estadisticaIcono}>
                  🔎
                </Text>

                <Text style={styles.estadisticaNumero}>
                  {actividadesFiltradas.length}
                </Text>

                <Text style={styles.estadisticaTitulo}>
                  Encontrados
                </Text>
              </View>
            </View>

            {/* BUSCADOR */}

            <View style={styles.panelBusqueda}>
              <View style={styles.panelEncabezado}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelEtiqueta}>
                    HISTORIAL
                  </Text>

                  <Text style={styles.panelTitulo}>
                    Actividades recientes
                  </Text>
                </View>

                <Pressable
                  style={styles.botonActualizar}
                  onPress={() => cargarAuditoria(true)}
                  disabled={actualizando}
                >
                  <Text style={styles.actualizarTexto}>
                    ↻ Actualizar
                  </Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.buscador}
                placeholder="Buscar usuario, acción o laboratorio..."
                placeholderTextColor="#94A3B8"
                value={busqueda}
                onChangeText={setBusqueda}
              />

              <Pressable
                style={styles.botonFiltros}
                onPress={() =>
                  setMostrarFiltros(!mostrarFiltros)
                }
              >
                <Text style={styles.botonFiltrosTexto}>
                  {mostrarFiltros
                    ? "Ocultar filtros"
                    : "Filtrar actividades"}
                </Text>

                <Text style={styles.botonFiltrosFlecha}>
                  {mostrarFiltros ? "⌃" : "⌄"}
                </Text>
              </Pressable>

              {mostrarFiltros && (
                <View style={styles.filtrosContenido}>
                  <Text style={styles.filtroTitulo}>
                    Tipo de acción
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <Pressable
                      style={[
                        styles.chip,
                        !accionSeleccionada &&
                          styles.chipActivo,
                      ]}
                      onPress={() =>
                        setAccionSeleccionada("")
                      }
                    >
                      <Text
                        style={[
                          styles.chipTexto,
                          !accionSeleccionada &&
                            styles.chipTextoActivo,
                        ]}
                      >
                        Todas
                      </Text>
                    </Pressable>

                    {acciones.map((accion) => (
                      <Pressable
                        key={accion}
                        style={[
                          styles.chip,
                          accionSeleccionada === accion &&
                            styles.chipActivo,
                        ]}
                        onPress={() =>
                          setAccionSeleccionada(accion)
                        }
                      >
                        <Text
                          style={[
                            styles.chipTexto,
                            accionSeleccionada === accion &&
                              styles.chipTextoActivo,
                          ]}
                        >
                          {formatearAccion(accion)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.filtroTitulo}>
                    Laboratorio
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <Pressable
                      style={[
                        styles.chip,
                        !laboratorioSeleccionado &&
                          styles.chipActivo,
                      ]}
                      onPress={() =>
                        setLaboratorioSeleccionado("")
                      }
                    >
                      <Text
                        style={[
                          styles.chipTexto,
                          !laboratorioSeleccionado &&
                            styles.chipTextoActivo,
                        ]}
                      >
                        Todos
                      </Text>
                    </Pressable>

                    {laboratorios.map((laboratorio) => (
                      <Pressable
                        key={laboratorio.id}
                        style={[
                          styles.chip,
                          laboratorioSeleccionado ===
                            laboratorio.id &&
                            styles.chipActivo,
                        ]}
                        onPress={() =>
                          setLaboratorioSeleccionado(
                            laboratorio.id
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.chipTexto,
                            laboratorioSeleccionado ===
                              laboratorio.id &&
                              styles.chipTextoActivo,
                          ]}
                        >
                          {laboratorio.nombre}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Pressable
                    style={styles.limpiarFiltros}
                    onPress={limpiarFiltros}
                  >
                    <Text style={styles.limpiarFiltrosTexto}>
                      Limpiar filtros
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* ERRORES */}

            {error ? (
              <View style={styles.error}>
                <Text style={styles.errorTitulo}>
                  No se pudo cargar la auditoría
                </Text>

                <Text style={styles.errorTexto}>
                  {error}
                </Text>

                <Pressable
                  onPress={() => cargarAuditoria()}
                  style={styles.reintentar}
                >
                  <Text style={styles.reintentarTexto}>
                    Reintentar
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* CARGANDO */}

            {cargando && (
              <View style={styles.cargando}>
                <ActivityIndicator
                  size="large"
                  color="#2563EB"
                />

                <Text style={styles.cargandoTexto}>
                  Consultando registros de auditoría...
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !cargando && !error ? (
            <View style={styles.vacio}>
              <Text style={styles.vacioIcono}>
                📭
              </Text>

              <Text style={styles.vacioTitulo}>
                No se encontraron actividades
              </Text>

              <Text style={styles.vacioTexto}>
                No hay registros que coincidan con los filtros
                seleccionados.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !cargando && actividades.length > 0 ? (
            <Text style={styles.notaFinal}>
              Se consultan hasta 500 registros de auditoría
              por carga.
            </Text>
          ) : null
        }
      />

      {/* =====================================================
          MODAL DE DETALLES
      ===================================================== */}

      <Modal
        visible={detalle !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetalle(null)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalContenido}>
            <View style={styles.modalEncabezado}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEtiquetaSuperior}>
                  REGISTRO DE AUDITORÍA
                </Text>

                <Text style={styles.modalTitulo}>
                  Detalle de actividad
                </Text>
              </View>

              <Pressable
                style={styles.modalCerrar}
                onPress={() => setDetalle(null)}
              >
                <Text style={styles.modalCerrarTexto}>
                  ✕
                </Text>
              </Pressable>
            </View>

            {detalle && (
              <ScrollView
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalDestacado}>
                  <View style={styles.modalAccionContenedor}>
                    <Text style={styles.modalAccion}>
                      {detalle.accionTexto}
                    </Text>
                  </View>

                  <Text style={styles.modalDescripcion}>
                    {detalle.descripcion}
                  </Text>

                  <Text style={styles.modalFecha}>
                    {mostrarFecha(detalle.fecha)}
                  </Text>
                </View>

                <View style={styles.modalCampo}>
                  <Text style={styles.modalCampoEtiqueta}>
                    USUARIO RESPONSABLE
                  </Text>

                  <Text style={styles.modalCampoValor}>
                    {detalle.usuarioNombre}
                  </Text>
                </View>

                <View style={styles.modalCampo}>
                  <Text style={styles.modalCampoEtiqueta}>
                    LABORATORIO
                  </Text>

                  <Text style={styles.modalCampoValor}>
                    {detalle.laboratorioNombre}
                  </Text>
                </View>

                <View style={styles.modalCampo}>
                  <Text style={styles.modalCampoEtiqueta}>
                    ACCIÓN REALIZADA
                  </Text>

                  <Text style={styles.modalCampoValor}>
                    {detalle.accionTexto}
                  </Text>
                </View>

                <View style={styles.modalCampo}>
                  <Text style={styles.modalCampoEtiqueta}>
                    MÓDULO
                  </Text>

                  <Text style={styles.modalCampoValor}>
                    {detalle.modulo}
                  </Text>
                </View>

                <View style={styles.modalCampo}>
                  <Text style={styles.modalCampoEtiqueta}>
                    FECHA Y HORA
                  </Text>

                  <Text style={styles.modalCampoValor}>
                    {mostrarFecha(detalle.fecha)}
                  </Text>
                </View>

                {detalle.usuarioObjetivo ? (
                  <View style={styles.modalCampo}>
                    <Text style={styles.modalCampoEtiqueta}>
                      USUARIO AFECTADO
                    </Text>

                    <Text style={styles.modalCampoValor}>
                      {detalle.usuarioObjetivo}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={styles.modalBoton}
                  onPress={() => setDetalle(null)}
                >
                  <Text style={styles.modalBotonTexto}>
                    Cerrar detalle
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F3F6FC",
  },

  contenido: {
    padding: 18,
    paddingBottom: 45,
  },

  botonVolver: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
  },

  botonVolverTexto: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },

  encabezado: {
    marginBottom: 24,
  },

  iconoPrincipal: {
    width: 58,
    height: 58,
    backgroundColor: "#E8EEFF",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },

  iconoPrincipalTexto: {
    fontSize: 27,
  },

  etiquetaSuperior: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 9,
  },

  titulo: {
    color: "#0F172A",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 10,
  },

  subtitulo: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
  },

  estadisticas: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  tarjetaEstadistica: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 17,
    marginBottom: 12,
    elevation: 2,
  },

  estadisticaIcono: {
    fontSize: 22,
    marginBottom: 13,
  },

  estadisticaNumero: {
    color: "#0F172A",
    fontSize: 29,
    fontWeight: "800",
    marginBottom: 4,
  },

  estadisticaTitulo: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },

  panelBusqueda: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },

  panelEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  panelEtiqueta: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },

  panelTitulo: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },

  botonActualizar: {
    backgroundColor: "#EFF4FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  actualizarTexto: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },

  buscador: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#DCE4EF",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 12,
  },

  botonFiltros: {
    backgroundColor: "#EFF4FF",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  botonFiltrosTexto: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "800",
  },

  botonFiltrosFlecha: {
    color: "#2563EB",
    fontSize: 20,
  },

  filtrosContenido: {
    paddingTop: 15,
  },

  filtroTitulo: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 12,
  },

  chip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 8,
    marginBottom: 10,
  },

  chipActivo: {
    backgroundColor: "#2563EB",
  },

  chipTexto: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },

  chipTextoActivo: {
    color: "#FFFFFF",
  },

  limpiarFiltros: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 5,
  },

  limpiarFiltrosTexto: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 13,
  },

  tarjetaActividad: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 19,
    marginBottom: 15,
    elevation: 2,
  },

  tarjetaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarTexto: {
    color: "#2563EB",
    fontSize: 18,
    fontWeight: "800",
  },

  usuarioInformacion: {
    flex: 1,
  },

  usuarioNombre: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },

  fecha: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 5,
  },

  flecha: {
    color: "#94A3B8",
    fontSize: 26,
    marginLeft: 8,
  },

  accionContenedor: {
    backgroundColor: "#EAF0FF",
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginBottom: 13,
  },

  accionTexto: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
  },

  descripcion: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 22,
  },

  separador: {
    height: 1,
    backgroundColor: "#EDF2F7",
    marginVertical: 16,
  },

  filaInformacion: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  iconoInformacion: {
    width: 28,
    fontSize: 20,
    color: "#2563EB",
  },

  informacionContenido: {
    flex: 1,
  },

  informacionEtiqueta: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  informacionValor: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },

  verDetalle: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 8,
  },

  error: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 15,
    padding: 18,
    marginBottom: 18,
  },

  errorTitulo: {
    color: "#991B1B",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },

  errorTexto: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 20,
  },

  reintentar: {
    backgroundColor: "#DC2626",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 15,
  },

  reintentarTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  cargando: {
    alignItems: "center",
    paddingVertical: 40,
  },

  cargandoTexto: {
    color: "#64748B",
    marginTop: 13,
    fontSize: 13,
  },

  vacio: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    alignItems: "center",
    padding: 35,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  vacioIcono: {
    fontSize: 40,
    marginBottom: 15,
  },

  vacioTitulo: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  vacioTexto: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },

  notaFinal: {
    color: "#94A3B8",
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
  },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "flex-end",
  },

  modalContenido: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: "90%",
  },

  modalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  modalEtiquetaSuperior: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: 6,
  },

  modalTitulo: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
  },

  modalCerrar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  modalCerrarTexto: {
    color: "#475569",
    fontSize: 19,
    fontWeight: "700",
  },

  modalDestacado: {
    backgroundColor: "#F3F6FF",
    borderRadius: 18,
    padding: 19,
    marginBottom: 20,
  },

  modalAccionContenedor: {
    alignSelf: "flex-start",
    backgroundColor: "#E0E9FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },

  modalAccion: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
  },

  modalDescripcion: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 10,
  },

  modalFecha: {
    color: "#64748B",
    fontSize: 12,
  },

  modalCampo: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 13,
    padding: 16,
    marginBottom: 12,
  },

  modalCampoEtiqueta: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  modalCampoValor: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
  },

  modalBoton: {
    backgroundColor: "#2563EB",
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 15,
    marginBottom: 25,
  },

  modalBotonTexto: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});