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
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Usuario = {
  uid: string;
  laboratorioId: string;
};

type Muestra = {
  id: string;
  pacienteId: string;
  analisisId: string;
  analisisNombre: string;
  laboratorioId: string;
  estado: string;
  codigoEtiqueta: string;
};

type Paciente = {
  nombre: string;
  ci: string;
};

type Parametro = {
  id: string;
  nombre: string;
  unidad: string;
  referencia: string;
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: any): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor).trim();
}

function mostrarMensaje(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

function errorMensaje(error: any): string {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la consulta. " +
      "Comprueba los permisos del usuario."
    );
  }

  return error?.message || "Ocurrió un error inesperado.";
}

// =====================================================
// FORMATEAR REFERENCIA
// =====================================================

function obtenerReferencia(valor: any): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number"
  ) {
    return String(valor);
  }

  if (Array.isArray(valor)) {
    return valor
      .map((item) => obtenerReferencia(item))
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof valor === "object") {
    const minimo =
      valor.min ??
      valor.minimo ??
      valor.desde ??
      valor.valorMinimo;

    const maximo =
      valor.max ??
      valor.maximo ??
      valor.hasta ??
      valor.valorMaximo;

    if (minimo !== undefined && maximo !== undefined) {
      return `${minimo} - ${maximo}`;
    }

    if (minimo !== undefined) {
      return `Desde ${minimo}`;
    }

    if (maximo !== undefined) {
      return `Hasta ${maximo}`;
    }

    const partes = Object.entries(valor)
      .filter(
        ([, dato]) =>
          dato !== null &&
          dato !== undefined &&
          dato !== ""
      )
      .map(([clave, dato]) => {
        return `${clave}: ${obtenerReferencia(dato)}`;
      });

    return partes.join(" | ");
  }

  return "";
}

// =====================================================
// NORMALIZAR PARÁMETRO
// =====================================================

function crearParametro(
  datos: any,
  id: string,
  nombreAlternativo = ""
): Parametro {
  const referenciaOriginal =
    datos.rangoReferencia ??
    datos.valorReferencia ??
    datos.referencia ??
    datos.rango ??
    datos.valoresReferencia ??
    null;

  return {
    id,

    nombre:
      texto(datos.nombre) ||
      texto(datos.nombreParametro) ||
      texto(datos.parametro) ||
      texto(datos.descripcion) ||
      texto(datos.prueba) ||
      nombreAlternativo ||
      "Parámetro",

    unidad:
      texto(datos.unidad) ||
      texto(datos.unidadMedida) ||
      texto(datos.unidades),

    referencia: obtenerReferencia(referenciaOriginal),
  };
}

// =====================================================
// EXTRAER PARÁMETROS
// =====================================================

function extraerParametros(
  datos: any,
  idBase: string
): Parametro[] {
  if (!datos || typeof datos !== "object") {
    return [];
  }

  const posiblesHijos = [
    datos.subparametros,
    datos.subParametros,
    datos.parametros,
    datos.pruebas,
    datos.items,
    datos.componentes,
    datos.determinaciones,
  ];

  const hijos = posiblesHijos.filter(
    (item) => Array.isArray(item) && item.length > 0
  );

  if (hijos.length > 0) {
    const encontrados: Parametro[] = [];

    hijos.forEach((arreglo, indiceArreglo) => {
      arreglo.forEach((item: any, indice: number) => {
        const id = `${idBase}_${indiceArreglo}_${indice}`;

        if (typeof item === "string") {
          encontrados.push(
            crearParametro(
              { nombre: item },
              id
            )
          );
        } else {
          encontrados.push(
            ...extraerParametros(item, id)
          );
        }
      });
    });

    return encontrados;
  }

  return [crearParametro(datos, idBase)];
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function ValoresParametros() {
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [muestras, setMuestras] = useState<Muestra[]>([]);

  const [pacientes, setPacientes] = useState<
    Record<string, Paciente>
  >({});

  const [parametros, setParametros] = useState<Parametro[]>([]);

  const [muestraSeleccionada, setMuestraSeleccionada] =
    useState<Muestra | null>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const [cargando, setCargando] = useState(true);

  const [cargandoParametros, setCargandoParametros] =
    useState(false);

  const [busqueda, setBusqueda] = useState("");

  // ===================================================
  // CARGAR DATOS
  // ===================================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error("Debes iniciar sesión.");
      }

      const usuarioSnap = await getDoc(
        doc(db, "usuarios", firebaseUser.uid)
      );

      if (!usuarioSnap.exists()) {
        throw new Error("Usuario no encontrado.");
      }

      const datosUsuario = usuarioSnap.data();

      if (datosUsuario.activo !== true) {
        throw new Error("Usuario inactivo.");
      }

      if (datosUsuario.rol !== "bioquimico") {
        throw new Error(
          "Esta pantalla corresponde al Bioquímico."
        );
      }

      const laboratorioId = texto(
        datosUsuario.laboratorioId
      );

      if (!laboratorioId) {
        throw new Error("No tienes laboratorio asignado.");
      }

      setUsuario({
        uid: firebaseUser.uid,
        laboratorioId,
      });

      const [muestrasSnap, pacientesSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, "muestras"),
              where("laboratorioId", "==", laboratorioId)
            )
          ),

          getDocs(
            query(
              collection(db, "pacientes"),
              where("laboratorioId", "==", laboratorioId)
            )
          ),
        ]);

      const listaMuestras: Muestra[] =
        muestrasSnap.docs.map((documento) => {
          const datos = documento.data();

          return {
            id: documento.id,

            pacienteId: texto(datos.pacienteId),

            analisisId: texto(datos.analisisId),

            analisisNombre:
              texto(datos.analisisNombre) || "Análisis",

            laboratorioId: texto(datos.laboratorioId),

            estado: texto(datos.estado),

            codigoEtiqueta:
              texto(datos.codigoEtiqueta) || documento.id,
          };
        });

      setMuestras(listaMuestras);

      const mapaPacientes: Record<string, Paciente> = {};

      pacientesSnap.docs.forEach((documento) => {
        const datos = documento.data();

        mapaPacientes[documento.id] = {
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
    } catch (error: any) {
      console.error("Error cargando datos:", error);

      mostrarMensaje("Error", errorMensaje(error));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // OBTENER PARÁMETROS DEL ANÁLISIS
  // ===================================================

  const obtenerParametros = async (
    analisisId: string
  ): Promise<Parametro[]> => {
    const encontrados: Parametro[] = [];

    const analisisSnap = await getDoc(
      doc(db, "analisis", analisisId)
    );

    if (!analisisSnap.exists()) {
      throw new Error("No se encontró el análisis.");
    }

    const datosAnalisis = analisisSnap.data();

    if (
      usuario &&
      datosAnalisis.laboratorioId !== usuario.laboratorioId
    ) {
      throw new Error(
        "El análisis pertenece a otro laboratorio."
      );
    }

    // PARÁMETROS GUARDADOS COMO ARREGLOS

    const arreglos = [
      datosAnalisis.parametros,
      datosAnalisis.parametrosAnalisis,
      datosAnalisis.valoresParametros,
      datosAnalisis.pruebas,
      datosAnalisis.items,
    ];

    arreglos.forEach((arreglo, indiceArreglo) => {
      if (!Array.isArray(arreglo)) {
        return;
      }

      arreglo.forEach((item: any, indice: number) => {
        const id = `array_${indiceArreglo}_${indice}`;

        if (typeof item === "string") {
          encontrados.push(
            crearParametro(
              { nombre: item },
              id
            )
          );
        } else {
          encontrados.push(
            ...extraerParametros(item, id)
          );
        }
      });
    });

    // PARÁMETROS EN SUBCOLECCIÓN

    const parametrosSnap = await getDocs(
      collection(
        db,
        "analisis",
        analisisId,
        "parametros"
      )
    );

    parametrosSnap.docs.forEach((documento) => {
      encontrados.push(
        ...extraerParametros(
          documento.data(),
          documento.id
        )
      );
    });

    // ELIMINAR DUPLICADOS POR NOMBRE

    const mapa = new Map<string, Parametro>();

    encontrados.forEach((parametro) => {
      const clave = parametro.nombre.toLowerCase().trim();

      if (!mapa.has(clave)) {
        mapa.set(clave, parametro);
      }
    });

    return Array.from(mapa.values());
  };

  // ===================================================
  // VER PARÁMETROS
  // ===================================================

  const verParametros = async (muestra: Muestra) => {
    try {
      if (!muestra.analisisId) {
        throw new Error(
          "La muestra no tiene análisis asociado."
        );
      }

      setCargandoParametros(true);

      const lista = await obtenerParametros(
        muestra.analisisId
      );

      setMuestraSeleccionada(muestra);

      setParametros(lista);

      setModalVisible(true);
    } catch (error: any) {
      console.error("Error viendo parámetros:", error);

      mostrarMensaje("Error", errorMensaje(error));
    } finally {
      setCargandoParametros(false);
    }
  };

  // ===================================================
  // FILTRAR MUESTRAS
  // ===================================================

  const muestrasDisponibles = muestras.filter(
    (muestra) => muestra.estado === "procesada"
  );

  const muestrasFiltradas = muestrasDisponibles.filter(
    (muestra) => {
      const paciente = pacientes[muestra.pacienteId];

      const contenido = [
        muestra.analisisNombre,
        muestra.codigoEtiqueta,
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
          Cargando parámetros...
        </Text>
      </View>
    );
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>
              Valores por parámetros
            </Text>

            <Text style={styles.subtitulo}>
              Consulta los parámetros de cada análisis.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() => router.back()}
          >
            <Text style={styles.textoBoton}>
              Volver
            </Text>
          </Pressable>
        </View>

        {/* BUSCADOR */}

        <View style={styles.panel}>
          <Text style={styles.etiqueta}>
            Buscar muestra procesada
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Paciente, CI o análisis"
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
            </Text>
          ) : (
            muestrasFiltradas.map((muestra) => {
              const paciente =
                pacientes[muestra.pacienteId];

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

                  <Pressable
                    style={[
                      styles.botonParametros,
                      cargandoParametros &&
                        styles.botonDeshabilitado,
                    ]}
                    disabled={cargandoParametros}
                    onPress={() => verParametros(muestra)}
                  >
                    <Text style={styles.textoBoton}>
                      {cargandoParametros
                        ? "Cargando..."
                        : "Ver parámetros"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODAL SOLO LECTURA */}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView
              contentContainerStyle={styles.contenidoModal}
            >
              <Text style={styles.tituloModal}>
                Valores de parámetros
              </Text>

              {muestraSeleccionada && (
                <View style={styles.resumen}>
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

                  <Text style={styles.dato}>
                    Total de parámetros: {parametros.length}
                  </Text>
                </View>
              )}

              {parametros.length === 0 ? (
                <Text style={styles.textoVacio}>
                  No existen parámetros configurados
                  para este análisis.
                </Text>
              ) : (
                parametros.map((parametro, indice) => (
                  <View
                    key={parametro.id}
                    style={styles.tarjetaParametro}
                  >
                    <Text style={styles.nombreParametro}>
                      {indice + 1}. {parametro.nombre}
                    </Text>

                    {parametro.referencia !== "" && (
                      <Text style={styles.referencia}>
                        Referencia: {parametro.referencia}
                      </Text>
                    )}

                    {parametro.unidad !== "" && (
                      <Text style={styles.referencia}>
                        Unidad: {parametro.unidad}
                      </Text>
                    )}
                  </View>
                ))
              )}

              <View style={styles.accionesModal}>
                <Pressable
                  style={styles.botonCancelar}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.textoBoton}>
                    Cerrar
                  </Text>
                </Pressable>
              </View>
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

  textoBoton: {
    color: "#FFFFFF",
    fontWeight: "bold",
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

  botonActualizar: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
    alignSelf: "flex-start",
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

  botonParametros: {
    backgroundColor: "#2563EB",
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 10,
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  textoVacio: {
    color: "#64748B",
    fontSize: 14,
    paddingVertical: 15,
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 700,
    maxHeight: "90%",
    borderRadius: 14,
    overflow: "hidden",
  },

  contenidoModal: {
    padding: 20,
    paddingBottom: 35,
  },

  tituloModal: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 15,
  },

  resumen: {
    backgroundColor: "#F1F5F9",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  tarjetaParametro: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },

  nombreParametro: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#19385F",
  },

  referencia: {
    color: "#64748B",
    marginTop: 8,
    fontSize: 14,
  },

  accionesModal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },

  botonCancelar: {
    backgroundColor: "#64748B",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 9,
  },
});