import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
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
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type UsuarioActual = {
  uid: string;
  laboratorioId: string;
};

type Muestra = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  codigoEtiqueta: string;
  tipo: string;
  estado: string;
  aceptada: boolean;
};

type Paciente = {
  id: string;
  nombre: string;
  ci: string;
};

type Resultado = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  valorResultado: string;
  unidad: string;
  observaciones: string;
  estado: string;
  validado: boolean;
  fechaRegistro: any;
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: any): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function obtenerError(error: any): string {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Comprueba los permisos del Bioquímico " +
      "y el estado de la muestra."
    );
  }

  return error?.message || "Ocurrió un error inesperado.";
}

function mostrarMensaje(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

function convertirFecha(valor: any): string {
  if (!valor) {
    return "-";
  }

  try {
    if (typeof valor.toDate === "function") {
      return valor.toDate().toLocaleString("es-BO");
    }

    if (valor instanceof Date) {
      return valor.toLocaleString("es-BO");
    }

    return new Date(valor).toLocaleString("es-BO");
  } catch {
    return "-";
  }
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function RegistroResultados() {
  const router = useRouter();

  // Referencia para mover la pantalla al formulario
  const scrollRef = useRef<ScrollView>(null);

  // Posición del formulario Nuevo resultado
  const [posicionFormulario, setPosicionFormulario] =
    useState(0);

  const [usuario, setUsuario] =
    useState<UsuarioActual | null>(null);

  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [pacientes, setPacientes] = useState<
    Record<string, Paciente>
  >({});

  const [resultados, setResultados] = useState<Resultado[]>([]);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");

  const [muestraSeleccionada, setMuestraSeleccionada] =
    useState<Muestra | null>(null);

  const [resultadoSeleccionado, setResultadoSeleccionado] =
    useState<Resultado | null>(null);

  const [valorResultado, setValorResultado] = useState("");

  const [unidad, setUnidad] = useState("");

  const [observaciones, setObservaciones] = useState("");

  // ===================================================
  // CARGAR INFORMACIÓN
  // ===================================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error("Debes iniciar sesión.");
      }

      const usuarioRef = doc(
        db,
        "usuarios",
        firebaseUser.uid
      );

      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        throw new Error(
          "No se encontró el usuario en Firestore."
        );
      }

      const datosUsuario = usuarioSnap.data();

      if (datosUsuario.activo !== true) {
        throw new Error("El usuario está inactivo.");
      }

      if (datosUsuario.rol !== "bioquimico") {
        throw new Error(
          "Este módulo está disponible únicamente " +
          "para Bioquímicos."
        );
      }

      const laboratorioId = texto(
        datosUsuario.laboratorioId
      );

      if (!laboratorioId) {
        throw new Error(
          "El usuario no tiene laboratorio asignado."
        );
      }

      setUsuario({
        uid: firebaseUser.uid,
        laboratorioId,
      });

      const consultaMuestras = query(
        collection(db, "muestras"),
        where("laboratorioId", "==", laboratorioId)
      );

      const consultaPacientes = query(
        collection(db, "pacientes"),
        where("laboratorioId", "==", laboratorioId)
      );

      const consultaResultados = query(
        collection(db, "resultados"),
        where("laboratorioId", "==", laboratorioId)
      );

      const [
        muestrasSnap,
        pacientesSnap,
        resultadosSnap,
      ] = await Promise.all([
        getDocs(consultaMuestras),
        getDocs(consultaPacientes),
        getDocs(consultaResultados),
      ]);

      // MUESTRAS

      const listaMuestras: Muestra[] =
        muestrasSnap.docs.map((documento) => {
          const datos = documento.data();

          return {
            id: documento.id,

            muestraId:
              texto(datos.muestraId) || documento.id,

            laboratorioId: texto(datos.laboratorioId),

            pacienteId: texto(datos.pacienteId),

            ordenId: texto(datos.ordenId),

            analisisId: texto(datos.analisisId),

            analisisNombre:
              texto(datos.analisisNombre) || "Análisis",

            codigoEtiqueta:
              texto(datos.codigoEtiqueta) || documento.id,

            tipo:
              texto(datos.tipo) ||
              texto(datos.tipoMuestra),

            estado: texto(datos.estado),

            aceptada:
              datos.aceptada === true ||
              datos.estado === "procesada",
          };
        });

      setMuestras(listaMuestras);

      // PACIENTES

      const mapaPacientes: Record<string, Paciente> = {};

      pacientesSnap.docs.forEach((documento) => {
        const datos = documento.data();

        mapaPacientes[documento.id] = {
          id: documento.id,

          nombre:
            [
              texto(datos.nombres || datos.nombre),
              texto(datos.apellidos || datos.apellido),
            ]
              .filter(Boolean)
              .join(" ") || "Paciente",

          ci: texto(datos.ci),
        };
      });

      setPacientes(mapaPacientes);

      // RESULTADOS

      const listaResultados: Resultado[] =
        resultadosSnap.docs.map((documento) => {
          const datos = documento.data();

          return {
            id: documento.id,

            muestraId: texto(datos.muestraId),

            laboratorioId: texto(datos.laboratorioId),

            pacienteId: texto(datos.pacienteId),

            ordenId: texto(datos.ordenId),

            analisisId: texto(datos.analisisId),

            analisisNombre:
              texto(datos.analisisNombre) || "Análisis",

            valorResultado: texto(datos.valorResultado),

            unidad: texto(datos.unidad),

            observaciones: texto(datos.observaciones),

            estado: texto(datos.estado),

            validado: datos.validado === true,

            fechaRegistro: datos.fechaRegistro || null,
          };
        });

      setResultados(listaResultados);
    } catch (error: any) {
      console.error(
        "Error cargando registro de resultados:",
        error
      );

      mostrarMensaje(
        "Error",
        obtenerError(error)
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // IR AUTOMÁTICAMENTE AL FORMULARIO
  // ===================================================

  const irAlFormulario = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, posicionFormulario - 20),
        animated: true,
      });
    }, 150);
  };

  // ===================================================
  // SELECCIONAR MUESTRA
  // ===================================================

  const seleccionarMuestra = (muestra: Muestra) => {
    setMuestraSeleccionada(muestra);

    const resultadoExistente = resultados.find(
      (resultado) =>
        resultado.muestraId === muestra.id
    );

    if (resultadoExistente) {
      setResultadoSeleccionado(resultadoExistente);

      setValorResultado(
        resultadoExistente.valorResultado
      );

      setUnidad(resultadoExistente.unidad);

      setObservaciones(
        resultadoExistente.observaciones
      );
    } else {
      setResultadoSeleccionado(null);

      setValorResultado("");

      setUnidad("");

      setObservaciones("");
    }

    // Redirigir directamente al formulario
    irAlFormulario();
  };

  // ===================================================
  // GUARDAR RESULTADO
  // ===================================================

  const guardarResultado = async () => {
    try {
      if (!usuario) {
        throw new Error("No existe una sesión activa.");
      }

      if (!muestraSeleccionada) {
        throw new Error("Selecciona una muestra.");
      }

      const valor = valorResultado.trim();

      if (!valor) {
        throw new Error(
          "Debes ingresar el valor del resultado."
        );
      }

      if (muestraSeleccionada.estado !== "procesada") {
        throw new Error(
          "La muestra debe estar procesada " +
          "antes de registrar resultados."
        );
      }

      if (
        resultadoSeleccionado?.validado ||
        resultadoSeleccionado?.estado === "validado"
      ) {
        throw new Error(
          "El resultado ya está validado y no " +
          "puede modificarse."
        );
      }

      setGuardando(true);

      const muestraId = muestraSeleccionada.id;

      const resultadoRef = doc(
        db,
        "resultados",
        muestraId
      );

      const muestraRef = doc(
        db,
        "muestras",
        muestraId
      );

      await runTransaction(db, async (transaction) => {
        const muestraSnap = await transaction.get(
          muestraRef
        );

        const resultadoSnap = await transaction.get(
          resultadoRef
        );

        if (!muestraSnap.exists()) {
          throw new Error(
            "La muestra ya no existe."
          );
        }

        const datosMuestra = muestraSnap.data();

        if (
          datosMuestra.laboratorioId !==
          usuario.laboratorioId
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (datosMuestra.estado !== "procesada") {
          throw new Error(
            "La muestra todavía no está procesada."
          );
        }

        if (datosMuestra.aceptada === false) {
          throw new Error(
            "La muestra no fue aceptada."
          );
        }

        if (resultadoSnap.exists()) {
          const datosResultado = resultadoSnap.data();

          if (
            datosResultado.laboratorioId !==
            usuario.laboratorioId
          ) {
            throw new Error(
              "El resultado pertenece a otro laboratorio."
            );
          }

          if (
            datosResultado.validado === true ||
            datosResultado.estado === "validado"
          ) {
            throw new Error(
              "El resultado ya fue validado."
            );
          }

          transaction.update(resultadoRef, {
            valorResultado: valor,

            unidad: unidad.trim(),

            observaciones: observaciones.trim(),

            actualizadoPor: usuario.uid,

            fechaActualizacion: serverTimestamp(),
          });
        } else {
          transaction.set(resultadoRef, {
            laboratorioId: usuario.laboratorioId,

            muestraId,

            pacienteId:
              muestraSeleccionada.pacienteId,

            ordenId:
              muestraSeleccionada.ordenId,

            analisisId:
              muestraSeleccionada.analisisId,

            analisisNombre:
              muestraSeleccionada.analisisNombre,

            valorResultado: valor,

            unidad: unidad.trim(),

            observaciones: observaciones.trim(),

            estado: "borrador",

            validado: false,

            registradoPor: usuario.uid,

            fechaRegistro: serverTimestamp(),

            validadoPor: null,

            fechaValidacion: null,
          });
        }
      });

      mostrarMensaje(
        "Resultado guardado",
        "El resultado se registró correctamente " +
        "en estado borrador."
      );

      setMuestraSeleccionada(null);

      setResultadoSeleccionado(null);

      setValorResultado("");

      setUnidad("");

      setObservaciones("");

      await cargarDatos();
    } catch (error: any) {
      console.error(
        "Error guardando resultado:",
        error
      );

      mostrarMensaje(
        "No se pudo guardar",
        obtenerError(error)
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // FILTRAR MUESTRAS
  // ===================================================

  const muestrasProcesadas = muestras.filter(
    (muestra) => muestra.estado === "procesada"
  );

  const muestrasFiltradas = muestrasProcesadas.filter(
    (muestra) => {
      const paciente = pacientes[muestra.pacienteId];

      const contenido = [
        muestra.codigoEtiqueta,
        muestra.analisisNombre,
        muestra.tipo,
        paciente?.nombre || "",
        paciente?.ci || "",
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(
        busqueda.trim().toLowerCase()
      );
    }
  );

  // ===================================================
  // PANTALLA DE CARGA
  // ===================================================

  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator
          size="large"
          color="#19385F"
        />

        <Text style={styles.textoCargando}>
          Cargando registro de resultados...
        </Text>
      </View>
    );
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.contenedor}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
    >
      {/* ENCABEZADO */}

      <View style={styles.encabezado}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>
            Registro de resultados
          </Text>

          <Text style={styles.subtitulo}>
            Registra los resultados de las muestras
            que finalizaron su procesamiento.
          </Text>
        </View>

        <Pressable
          style={styles.botonVolver}
          onPress={() => router.back()}
        >
          <Text style={styles.textoVolver}>
            Volver
          </Text>
        </Pressable>
      </View>

      {/* CONTADORES */}

      <View style={styles.contadores}>
        <View style={styles.contador}>
          <Text style={styles.contadorTitulo}>
            Muestras procesadas
          </Text>

          <Text style={styles.contadorNumero}>
            {muestrasProcesadas.length}
          </Text>
        </View>

        <View style={styles.contador}>
          <Text style={styles.contadorTitulo}>
            Resultados registrados
          </Text>

          <Text style={styles.contadorNumero}>
            {resultados.length}
          </Text>
        </View>

        <View style={styles.contador}>
          <Text style={styles.contadorTitulo}>
            Resultados pendientes
          </Text>

          <Text style={styles.contadorNumero}>
            {
              muestrasProcesadas.filter(
                (muestra) =>
                  !resultados.some(
                    (resultado) =>
                      resultado.muestraId === muestra.id
                  )
              ).length
            }
          </Text>
        </View>
      </View>

      {/* BUSCADOR */}

      <View style={styles.panel}>
        <Text style={styles.etiqueta}>
          Buscar muestra procesada
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Paciente, CI, análisis o etiqueta"
          value={busqueda}
          onChangeText={setBusqueda}
        />

        <Pressable
          style={styles.botonActualizar}
          onPress={cargarDatos}
        >
          <Text style={styles.textoActualizar}>
            Actualizar
          </Text>
        </Pressable>
      </View>

      {/* LISTA DE MUESTRAS */}

      <View style={styles.panel}>
        <Text style={styles.seccionTitulo}>
          Muestras disponibles
        </Text>

        {muestrasFiltradas.length === 0 ? (
          <Text style={styles.textoVacio}>
            No hay muestras procesadas disponibles.
            Primero debes finalizar el procesamiento
            desde Seguimiento de muestras.
          </Text>
        ) : (
          muestrasFiltradas.map((muestra) => {
            const paciente =
              pacientes[muestra.pacienteId];

            const resultado = resultados.find(
              (item) =>
                item.muestraId === muestra.id
            );

            return (
              <View
                key={muestra.id}
                style={styles.tarjeta}
              >
                <Text style={styles.nombreAnalisis}>
                  {muestra.analisisNombre}
                </Text>

                <Text style={styles.dato}>
                  Paciente:{" "}
                  {paciente?.nombre || "Sin identificar"}
                </Text>

                <Text style={styles.dato}>
                  CI: {paciente?.ci || "-"}
                </Text>

                <Text style={styles.dato}>
                  Etiqueta: {muestra.codigoEtiqueta}
                </Text>

                <Text style={styles.dato}>
                  Estado de muestra: Procesada
                </Text>

                <Text
                  style={[
                    styles.estadoResultado,
                    {
                      color: resultado?.validado
                        ? "#059669"
                        : resultado
                        ? "#D97706"
                        : "#64748B",
                    },
                  ]}
                >
                  {resultado?.validado
                    ? "Resultado validado"
                    : resultado
                    ? "Resultado en borrador"
                    : "Sin resultado"}
                </Text>

                <Pressable
                  style={[
                    styles.botonSeleccionar,
                    resultado?.validado &&
                      styles.botonDeshabilitado,
                  ]}
                  disabled={resultado?.validado === true}
                  onPress={() =>
                    seleccionarMuestra(muestra)
                  }
                >
                  <Text style={styles.textoBoton}>
                    {resultado?.validado
                      ? "Resultado validado"
                      : resultado
                      ? "Editar resultado"
                      : "Registrar resultado"}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* FORMULARIO NUEVO RESULTADO */}

      {muestraSeleccionada && (
        <View
          style={styles.panel}
          onLayout={(evento) => {
            setPosicionFormulario(
              evento.nativeEvent.layout.y
            );
          }}
        >
          <View style={styles.filaTitulo}>
            <Text style={styles.seccionTitulo}>
              {resultadoSeleccionado
                ? "Editar resultado"
                : "Nuevo resultado"}
            </Text>

            <Pressable
              onPress={() => {
                setMuestraSeleccionada(null);
                setResultadoSeleccionado(null);
              }}
            >
              <Text style={styles.cerrar}>
                Cerrar
              </Text>
            </Pressable>
          </View>

          <Text style={styles.dato}>
            Análisis:{" "}
            {muestraSeleccionada.analisisNombre}
          </Text>

          <Text style={styles.dato}>
            Paciente:{" "}
            {pacientes[
              muestraSeleccionada.pacienteId
            ]?.nombre || "Sin identificar"}
          </Text>

          <Text style={styles.etiqueta}>
            Valor del resultado *
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ejemplo: 12.5"
            value={valorResultado}
            onChangeText={setValorResultado}
            editable={!guardando}
          />

          <Text style={styles.etiqueta}>
            Unidad
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ejemplo: g/dL"
            value={unidad}
            onChangeText={setUnidad}
            editable={!guardando}
          />

          <Text style={styles.etiqueta}>
            Observaciones
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.inputObservaciones,
            ]}
            placeholder="Observaciones del análisis"
            value={observaciones}
            onChangeText={setObservaciones}
            editable={!guardando}
            multiline
          />

          <Pressable
            style={[
              styles.botonGuardar,
              guardando && styles.botonDeshabilitado,
            ]}
            disabled={guardando}
            onPress={guardarResultado}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBoton}>
                Guardar resultado
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* RESULTADOS REGISTRADOS */}

      <View style={styles.panel}>
        <Text style={styles.seccionTitulo}>
          Resultados registrados
        </Text>

        {resultados.length === 0 ? (
          <Text style={styles.textoVacio}>
            Todavía no existen resultados registrados.
          </Text>
        ) : (
          resultados.map((resultado) => (
            <View
              key={resultado.id}
              style={styles.tarjeta}
            >
              <Text style={styles.nombreAnalisis}>
                {resultado.analisisNombre}
              </Text>

              <Text style={styles.dato}>
                Valor: {resultado.valorResultado}
              </Text>

              <Text style={styles.dato}>
                Unidad: {resultado.unidad || "-"}
              </Text>

              <Text style={styles.dato}>
                Fecha:{" "}
                {convertirFecha(
                  resultado.fechaRegistro
                )}
              </Text>

              <Text
                style={[
                  styles.estadoResultado,
                  {
                    color: resultado.validado
                      ? "#059669"
                      : "#D97706",
                  },
                ]}
              >
                {resultado.validado
                  ? "Validado"
                  : "Borrador"}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  contenido: {
    padding: 20,
    paddingBottom: 50,
  },

  cargando: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7FB",
  },

  textoCargando: {
    marginTop: 12,
    color: "#64748B",
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },

  titulo: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#19385F",
  },

  subtitulo: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 6,
  },

  botonVolver: {
    backgroundColor: "#334155",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
  },

  textoVolver: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  contador: {
    flexGrow: 1,
    minWidth: 160,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  contadorNumero: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#19385F",
    marginTop: 8,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },

  etiqueta: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 13,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    marginBottom: 10,
  },

  inputObservaciones: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  botonActualizar: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 10,
  },

  textoActualizar: {
    color: "#19385F",
    fontWeight: "600",
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 15,
  },

  tarjeta: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },

  nombreAnalisis: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 10,
  },

  dato: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 7,
  },

  estadoResultado: {
    fontSize: 14,
    fontWeight: "bold",
    marginVertical: 10,
  },

  botonSeleccionar: {
    backgroundColor: "#2563EB",
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 10,
  },

  botonGuardar: {
    backgroundColor: "#059669",
    padding: 15,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 15,
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },

  textoVacio: {
    color: "#64748B",
    fontSize: 14,
    paddingVertical: 15,
  },

  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cerrar: {
    color: "#DC2626",
    fontWeight: "bold",
  },
});