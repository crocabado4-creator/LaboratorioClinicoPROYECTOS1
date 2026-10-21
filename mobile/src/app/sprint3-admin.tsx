
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

const tipos: TipoReporte[] = [
  "pacientes",
  "analisis",
  "ventas",
  "ordenes",
  "resultados",
];

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
      } else {
        const datos = await cargarAuditoria();
        setRegistros(datos);
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

  const filtrados = registros.filter((registro) => {
    const contenido = Object.values(registro)
      .map((valor) =>
        typeof valor === "string" ||
        typeof valor === "number"
          ? String(valor)
          : ""
      )
      .join(" ")
      .toLowerCase();

    const coincideBusqueda = contenido.includes(
      busqueda.trim().toLowerCase()
    );

    const coincideEstado =
      !estado.trim() ||
      texto(registro.estado).toLowerCase().includes(
        estado.trim().toLowerCase()
      );

    return coincideBusqueda && coincideEstado;
  });

  const metrica = (titulo: string, valor: string | number) => (
    <View style={styles.metrica} key={titulo}>
      <Text style={styles.metricaTitulo}>
        {titulo}
      </Text>

      <Text style={styles.metricaValor}>
        {valor}
      </Text>
    </View>
  );

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

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorTexto}>
              {error}
            </Text>

            {error.includes("permission") && (
              <Text style={styles.dato}>
                Firebase está rechazando esta consulta.
                Toto debe revisar los permisos de Firestore.
              </Text>
            )}
          </View>
        ) : null}

        {cargando ? (
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

            <TextInput
              style={styles.input}
              placeholder="Buscar registros"
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <TextInput
              style={styles.input}
              placeholder="Filtrar por estado (opcional)"
              placeholderTextColor="#94A3B8"
              value={estado}
              onChangeText={setEstado}
            />
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

                <Text style={styles.dato}>
                  ID: {registro.id}
                </Text>

                {registro.pacienteId && (
                  <Text style={styles.dato}>
                    Paciente ID: {texto(registro.pacienteId)}
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
                  {notificacion.leida ? "Leída" : "No leída"}
                </Text>

                {!notificacion.leida && (
                  <Pressable
                    style={styles.botonAzul}
                    disabled={marcando === notificacion.id}
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

        {!cargando && !error &&
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

                <Text style={styles.dato}>
                  Usuario: {texto(evento.usuarioNombre) ||
                    texto(evento.usuarioId)}
                </Text>

                <Text style={styles.dato}>
                  Entidad: {texto(evento.entidad)}
                </Text>

                <Text style={styles.dato}>
                  Detalle: {texto(evento.detalle)}
                </Text>

                <Text style={styles.dato}>
                  Fecha: {fecha(evento.fecha)}
                </Text>
              </View>
            ))}
          </>
        )}

        {!cargando && !error &&
          pestana !== "dashboard" &&
          registros.length === 0 && (
            <Text style={styles.subtitulo}>
              No hay registros disponibles.
            </Text>
          )}
      </ScrollView>
    </View>
  );
}

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
