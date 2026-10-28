
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";
import { doc, getDoc, getFirestore } from "firebase/firestore";

import {
  type Registro,
  type ResumenLaboratorio,
  type TipoReporte,
  cargarResumenLaboratorio,
  cargarReporte,
  cargarNotificaciones,
  cargarAuditoria,
  marcarNotificacionLeida,
  fecha,
  texto,
} from "../services/sprint3MobileService";

type Pestana =
  | "dashboard"
  | "reportes"
  | "notificaciones"
  | "auditoria";

const pestanas: { id: Pestana; nombre: string }[] = [
  { id: "dashboard", nombre: "Dashboard" },
  { id: "reportes", nombre: "Reportes" },
  { id: "notificaciones", nombre: "Notificaciones" },
  { id: "auditoria", nombre: "Auditoría" },
];

const tipos: { id: TipoReporte; nombre: string }[] = [
  { id: "pacientes", nombre: "Pacientes" },
  { id: "analisis", nombre: "Análisis" },
  { id: "ventas", nombre: "Ventas" },
  { id: "ordenes", nombre: "Órdenes" },
  { id: "resultados", nombre: "Resultados" },
];

function normalizarEstado(valor: unknown): string {
  return texto(valor).trim().toLowerCase();
}

function presentarEstado(valor: string): string {
  const limpio = valor.replace(/_/g, " ").replace(/-/g, " ");

  if (!limpio) return "";

  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function nombrePaciente(registro: Registro): string {
  const nombreCompleto = texto(registro.nombreCompleto);

  if (nombreCompleto) return nombreCompleto;

  const nombres = texto(registro.nombres ?? registro.nombre);
  const apellidos = texto(registro.apellidos ?? registro.apellido);

  return [nombres, apellidos].filter(Boolean).join(" ") ||
    "Paciente sin nombre";
}

function tituloReporte(
  registro: Registro,
  tipo: TipoReporte
): string {
  if (tipo === "pacientes") {
    return nombrePaciente(registro);
  }

  if (tipo === "analisis") {
    return (
      texto(registro.nombreAnalisis) ||
      texto(registro.nombre) ||
      texto(registro.codigo) ||
      "Análisis sin nombre"
    );
  }

  if (tipo === "resultados") {
    return (
      texto(registro.analisisNombre) ||
      texto(registro.nombreAnalisis) ||
      texto(registro.pacienteNombre) ||
      "Resultado clínico"
    );
  }

  if (tipo === "ventas") {
    return (
      texto(registro.pacienteNombre) ||
      texto(registro.codigo) ||
      texto(registro.numeroVenta) ||
      "Venta registrada"
    );
  }

  if (tipo === "ordenes") {
    return (
      texto(registro.pacienteNombre) ||
      texto(registro.codigo) ||
      texto(registro.numeroOrden) ||
      "Orden de análisis"
    );
  }

  return "Registro";
}

// ===================================================
// OBTENER NOMBRE REAL DEL USUARIO DESDE FIRESTORE
// ===================================================

async function obtenerNombreUsuario(uid: string): Promise<string> {
  if (!uid) return "";

  try {
    const db = getFirestore();
    const referencia = doc(db, "usuarios", uid);
    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      return "";
    }

    const usuario = documento.data();

    const nombreCompleto = texto(usuario.nombreCompleto);

    const nombres = texto(
      usuario.nombres || usuario.nombre
    );

    const apellidos = texto(
      usuario.apellidos || usuario.apellido
    );

    const nombre = [nombres, apellidos]
      .filter(Boolean)
      .join(" ");

    const identificacion =
      nombreCompleto ||
      nombre ||
      texto(usuario.displayName) ||
      texto(usuario.correo || usuario.email);

    if (identificacion === uid) return "";

    return identificacion;
  } catch (error) {
    console.warn(
      "No se pudo consultar el nombre del usuario:",
      error
    );

    return "";
  }
}

// ===================================================
// COMPONENTE PRINCIPAL
// ===================================================

export default function Sprint3Admin() {
  const [pestana, setPestana] =
    useState<Pestana>("dashboard");

  const [tipo, setTipo] =
    useState<TipoReporte>("ordenes");

  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");

  const [resumen, setResumen] =
    useState<ResumenLaboratorio | null>(null);

  const [registros, setRegistros] =
    useState<Registro[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [marcando, setMarcando] = useState("");

  // ===================================================
  // CARGAR INFORMACIÓN
  // ===================================================

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      if (pestana === "dashboard") {
        const datos = await cargarResumenLaboratorio();

        setResumen(datos);
      } else if (pestana === "reportes") {
        const datos = await cargarReporte(tipo);

        setRegistros(datos);
      } else if (pestana === "notificaciones") {
        const datos = await cargarNotificaciones();

        setRegistros(datos);
      } else if (pestana === "auditoria") {
        const datos = await cargarAuditoria();

        // Obtener los UID de los eventos sin repetirlos.
        const ids = Array.from(
          new Set(
            datos
              .map((evento) => texto(evento.usuarioId))
              .filter(Boolean)
          )
        );

        // Buscar el nombre de cada usuario una sola vez.
        const nombres = new Map<string, string>();

        await Promise.all(
          ids.map(async (uid) => {
            const nombre = await obtenerNombreUsuario(uid);

            if (nombre) {
              nombres.set(uid, nombre);
            }
          })
        );

        // Agregar el nombre a cada evento.
        const eventosConNombres = datos.map((evento) => {
          const uid = texto(evento.usuarioId);
          const nombreGuardado = texto(evento.usuarioNombre);

          const nombre =
            (nombreGuardado && nombreGuardado !== uid
              ? nombreGuardado
              : nombres.get(uid)) ||
            "Nombre no disponible";

          return {
            ...evento,
            usuarioNombre: nombre,
          };
        });

        setRegistros(eventosConNombres);
      }
    } catch (e: any) {
      setError(
        e?.message || "No se pudo cargar la información."
      );
    } finally {
      setCargando(false);
    }
  }, [pestana, tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ===================================================
  // MARCAR NOTIFICACIÓN COMO LEÍDA
  // ===================================================

  const marcarLeida = async (id: string) => {
    try {
      setMarcando(id);
      setError("");

      await marcarNotificacionLeida(id);
      await cargar();
    } catch (e: any) {
      setError(
        e?.message || "No se pudo actualizar la notificación."
      );
    } finally {
      setMarcando("");
    }
  };

  // ===================================================
  // ESTADOS DISPONIBLES
  // ===================================================

  const estadosDisponibles = useMemo(() => {
    if (pestana !== "reportes") return [];

    const estados = registros
      .map((registro) => normalizarEstado(registro.estado))
      .filter(Boolean);

    const coincideBusqueda = contenido.includes(
      busqueda.trim().toLowerCase()
    );

  // ===================================================
  // FILTRAR REPORTES
  // ===================================================

  const filtrados = useMemo(() => {
    const busquedaNormalizada =
      busqueda.trim().toLowerCase();

    return coincideBusqueda && coincideEstado;
  });

          return "";
        })
        .join(" ")
        .toLowerCase();

      const coincideBusqueda =
        !busquedaNormalizada ||
        contenido.includes(busquedaNormalizada);

      const coincideEstado =
        estado === "" ||
        normalizarEstado(registro.estado) === estado;

      return coincideBusqueda && coincideEstado;
    });
  }, [registros, busqueda, estado]);

  // ===================================================
  // TARJETA DE MÉTRICA
  // ===================================================

  const metrica = (
    titulo: string,
    valor: string | number
  ) => (
    <View style={styles.metrica} key={titulo}>
      <Text style={styles.metricaTitulo}>
        {titulo}
      </Text>

      <Text style={styles.metricaValor}>
        {valor}
      </Text>
    </View>
  );

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.fondo}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>
              Administración del laboratorio
            </Text>

            <Text style={styles.subtitulo}>
              Sprint 3 — Dashboard, reportes y auditoría
            </Text>
          </View>

          <Pressable
            style={styles.botonGris}
            onPress={() => router.back()}
          >
            <Text style={styles.textoGris}>
              Volver
            </Text>
          </Pressable>
        </View>

        {/* PESTAÑAS */}

        <View style={styles.pestanas}>
          {pestanas.map((opcion) => (
            <Pressable
              key={opcion.id}
              style={[
                styles.pestana,
                pestana === opcion.id && styles.pestanaActiva,
              ]}
              onPress={() => {
                setBusqueda("");
                setEstado("");
                setPestana(opcion.id);
              }}
            >
              <Text
                style={[
                  styles.pestanaTexto,
                  pestana === opcion.id &&
                    styles.pestanaTextoActivo,
                ]}
              >
                {opcion.nombre}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.botonGris}
          onPress={cargar}
          disabled={cargando}
        >
          <Text style={styles.textoGris}>
            Actualizar datos
          </Text>
        </Pressable>

        {/* ERROR */}

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorTexto}>
              {error}
            </Text>

            {error.toLowerCase().includes("permission") && (
              <Text style={styles.dato}>
                Firebase está rechazando esta consulta.
                Toto debe revisar los permisos de Firestore.
              </Text>
            )}
          </View>
        ) : null}

        {/* CARGANDO */}

        {cargando && (
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
        ) : null}

        {!cargando && !error &&
          pestana === "dashboard" && resumen && (
          <>
            <Text style={styles.seccionTitulo}>
              {resumen.laboratorio}
            </Text>

            <View style={styles.metricas}>
              {metrica("Pacientes", resumen.pacientes)}
              {metrica("Análisis", resumen.analisis)}
              {metrica("Ventas", resumen.ventas)}
              {metrica(
                "Total vendido",
                `Bs. ${resumen.totalVendido.toFixed(2)}`
              )}
              {metrica("Órdenes", resumen.ordenes)}
              {metrica(
                "Resultados finalizados",
                resumen.resultadosFinalizados
              )}
              {metrica(
                "Resultados pendientes",
                resumen.resultadosPendientes
              )}
              {metrica(
                "Muestras pendientes",
                resumen.muestrasPendientes
              )}
            </View>
          </>
        )}

        {pestana === "reportes" && (
          <View style={styles.panel}>
            <Text style={styles.seccionTitulo}>
              Reportes del laboratorio
            </Text>

            <Text style={styles.dato}>
              Seleccionar tipo de reporte
            </Text>

            <View style={styles.pestanas}>
              {tipos.map((opcion) => (
                <Pressable
                  key={opcion}
                  style={[
                    styles.pestana,
                    tipo === opcion && styles.pestanaActiva,
                  ]}
                  onPress={() => {
                    setTipo(opcion);
                    setEstado("");
                  }}
                >
                  <Text
                    style={[
                      styles.pestanaTexto,
                      tipo === opcion &&
                        styles.pestanaTextoActivo,
                    ]}
                  >
                    {opcion}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* BUSCADOR */}

            <TextInput
              style={styles.input}
              placeholder="Buscar registros"
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            {/* FILTRO POR ESTADO */}

            {!cargando &&
              !error &&
              estadosDisponibles.length > 0 && (
                <View style={styles.filtroEstados}>
                  <Text style={styles.filtroTitulo}>
                    Filtrar por estado
                  </Text>

                  <View style={styles.pestanas}>
                    <Pressable
                      style={[
                        styles.pestana,
                        estado === "" &&
                          styles.pestanaActiva,
                      ]}
                      onPress={() => setEstado("")}
                    >
                      <Text
                        style={[
                          styles.pestanaTexto,
                          estado === "" &&
                            styles.pestanaTextoActivo,
                        ]}
                      >
                        Todos
                      </Text>
                    </Pressable>

                    {estadosDisponibles.map(
                      (opcion) => (
                        <Pressable
                          key={opcion}
                          style={[
                            styles.pestana,
                            estado === opcion &&
                              styles.pestanaActiva,
                          ]}
                          onPress={() =>
                            setEstado(opcion)
                          }
                        >
                          <Text
                            style={[
                              styles.pestanaTexto,
                              estado === opcion &&
                                styles.pestanaTextoActivo,
                            ]}
                          >
                            {presentarEstado(opcion)}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>

                  {estado !== "" && (
                    <Text style={styles.dato}>
                      Estado seleccionado:{" "}
                      {presentarEstado(estado)}
                    </Text>
                  )}
                </View>
              )}
          </View>
        )}

        {!cargando && !error &&
          pestana === "reportes" && (
          <>
            <Text style={styles.seccionTitulo}>
              {filtrados.length} registro(s)
            </Text>

            {filtrados.map((registro) => (
              <View key={registro.id} style={styles.tarjeta}>
                <Text style={styles.tarjetaTitulo}>
                  {texto(registro.nombreCompleto) ||
                    texto(registro.nombre) ||
                    texto(registro.analisisNombre) ||
                    texto(registro.codigo) ||
                    registro.id}
                </Text>

              {filtrados.map((registro) => (
                <View
                  key={registro.id}
                  style={styles.tarjeta}
                >
                  <Text style={styles.tarjetaTitulo}>
                    {tituloReporte(registro, tipo)}
                  </Text>

                  {/* PACIENTE */}

                  {registro.pacienteId &&
                    tipo !== "pacientes" && (
                      <Text style={styles.dato}>
                        Paciente:{" "}
                        {texto(registro.pacienteNombre) ||
                          "Paciente no encontrado"}
                      </Text>
                    )}

                  {/* ESTADO */}

                  {registro.estado && (
                    <Text style={styles.dato}>
                      Estado:{" "}
                      {presentarEstado(
                        texto(registro.estado)
                      )}
                    </Text>
                  )}

                  {/* TOTAL */}

                  {registro.total !== undefined &&
                    registro.total !== null && (
                      <Text style={styles.dato}>
                        Total: Bs.{" "}
                        {texto(registro.total)}
                      </Text>
                    )}

                  {/* CI */}

                  {registro.ci && (
                    <Text style={styles.dato}>
                      CI: {texto(registro.ci)}
                    </Text>
                  )}

                  {/* NACIMIENTO */}

                  {tipo === "pacientes" &&
                    registro.fechaNacimiento && (
                      <Text style={styles.dato}>
                        Fecha de nacimiento:{" "}
                        {fecha(registro.fechaNacimiento)}
                      </Text>
                    )}

                  {/* FECHA */}

                {registro.pacienteId && (
                  <Text style={styles.dato}>
                    Fecha:{" "}
                    {fecha(
                      registro.fecha ??
                        registro.fechaRegistro ??
                        registro.fechaCreacion
                    )}
                  </Text>
                )}

                {registro.estado && (
                  <Text style={styles.dato}>
                    Estado: {texto(registro.estado)}
                  </Text>
                )}

                {registro.total !== undefined && (
                  <Text style={styles.dato}>
                    Total: Bs. {texto(registro.total)}
                  </Text>
                )}

                {registro.ci && (
                  <Text style={styles.dato}>
                    CI: {texto(registro.ci)}
                  </Text>
                )}

                <Text style={styles.dato}>
                  Fecha: {fecha(
                    registro.fecha ??
                    registro.fechaRegistro ??
                    registro.fechaCreacion
                  )}
                </Text>
              </View>
            ))}
          </>
        )}

        {!cargando && !error &&
          pestana === "notificaciones" && (
          <>
            <Text style={styles.seccionTitulo}>
              Notificaciones ({registros.length})
            </Text>

            {registros.map((notificacion) => (
              <View
                key={notificacion.id}
                style={styles.tarjeta}
              >
                <Text style={styles.tarjetaTitulo}>
                  {texto(notificacion.titulo) || "Notificación"}
                </Text>

                <Text style={styles.dato}>
                  {texto(notificacion.mensaje)}
                </Text>

                <Text style={styles.dato}>
                  Fecha: {fecha(notificacion.fecha)}
                </Text>

                  <Text style={styles.dato}>
                    Fecha:{" "}
                    {fecha(notificacion.fecha)}
                  </Text>

                  <Text style={styles.dato}>
                    {notificacion.leida
                      ? "Leída"
                      : "No leída"}
                  </Text>

                  {!notificacion.leida && (
                    <Pressable
                      style={styles.botonAzul}
                      disabled={
                        marcando === notificacion.id
                      }
                      onPress={() =>
                        marcarLeida(notificacion.id)
                      }
                    >
                      <Text style={styles.textoBlanco}>
                        {marcando === notificacion.id
                          ? "Actualizando..."
                          : "Marcar como leída"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}

        {/* AUDITORÍA CORREGIDA */}

        {!cargando &&
          !error &&
          pestana === "auditoria" && (
          <>
            <Text style={styles.seccionTitulo}>
              Auditoría ({registros.length})
            </Text>

            {registros.map((evento) => (
              <View
                key={evento.id}
                style={styles.tarjeta}
              >
                <Text style={styles.tarjetaTitulo}>
                  {texto(evento.accion) || "Evento"}
                </Text>

              {registros.map((evento) => (
                <View
                  key={evento.id}
                  style={styles.tarjeta}
                >
                  <Text style={styles.tarjetaTitulo}>
                    {texto(evento.accion) || "Evento"}
                  </Text>

                  {/* MOSTRAR NOMBRE, NO UID */}

                  <Text style={styles.dato}>
                    Usuario:{" "}
                    {texto(evento.usuarioNombre) ||
                      "Nombre no disponible"}
                  </Text>

                  {evento.entidad && (
                    <Text style={styles.dato}>
                      Entidad:{" "}
                      {texto(evento.entidad)}
                    </Text>
                  )}

                  {evento.detalle && (
                    <Text style={styles.dato}>
                      Detalle:{" "}
                      {texto(evento.detalle)}
                    </Text>
                  )}

                  <Text style={styles.dato}>
                    Fecha:{" "}
                    {fecha(evento.fecha)}
                  </Text>
                </View>
              ))}
            </>
          )}
      </ScrollView>
    </View>
  );
}

// ===================================================
// ESTILOS
// ===================================================

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  contenido: {
    padding: 18,
    paddingBottom: 45,
    gap: 13,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titulo: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#19385F",
  },
  subtitulo: {
    color: "#64748B",
    marginTop: 6,
  },
  seccionTitulo: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#19385F",
    marginTop: 10,
  },
  pestanas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pestana: {
    backgroundColor: "#E2E8F0",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pestanaActiva: {
    backgroundColor: "#19385F",
  },
  pestanaTexto: {
    color: "#334155",
    fontWeight: "600",
  },
  pestanaTextoActivo: {
    color: "#FFFFFF",
  },
  botonGris: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    padding: 12,
    borderRadius: 9,
  },
  textoGris: {
    color: "#19385F",
    fontWeight: "bold",
  },
  metricas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metrica: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 17,
  },
  metricaTitulo: {
    fontSize: 13,
    color: "#64748B",
  },
  metricaValor: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#19385F",
    marginTop: 7,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    padding: 17,
    borderRadius: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 12,
    color: "#0F172A",
  },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    padding: 17,
    borderRadius: 12,
    gap: 9,
  },
  tarjetaTitulo: {
    color: "#19385F",
    fontWeight: "bold",
    fontSize: 17,
  },
  dato: {
    color: "#475569",
    lineHeight: 21,
  },
  botonAzul: {
    alignSelf: "flex-start",
    backgroundColor: "#2563EB",
    borderRadius: 9,
    padding: 12,
  },
  textoBlanco: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  error: {
    padding: 15,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    gap: 7,
  },
  errorTexto: {
    color: "#B91C1C",
    fontWeight: "bold",
  },
});
