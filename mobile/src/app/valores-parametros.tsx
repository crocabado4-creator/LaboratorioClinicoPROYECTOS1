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

import { getAuth } from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Parametro = {
  id: string;
  nombre: string;
  unidad: string;
  valorReferencia: string;
  valor: string;
};

type Resultado = {
  id: string;
  muestraId: string;
  pacienteId: string;
  analisisId: string;
  ordenId: string;
  laboratorioId: string;
  estado: string;
  paciente: string;
  analisis: string;
  parametros: Parametro[];
};

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

function aviso(titulo: string, contenido: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${contenido}`);
    }
  } else {
    Alert.alert(titulo, contenido);
  }
}

// =====================================================
// PANTALLA
// =====================================================

export default function ValoresParametrosScreen() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  const [seleccionado, setSeleccionado] =
    useState<Resultado | null>(null);

  const [parametros, setParametros] = useState<Parametro[]>([]);

  // ===================================================
  // OBTENER NOMBRE DEL PACIENTE
  // ===================================================

  async function obtenerPaciente(pacienteId: string) {
    if (!pacienteId) return "Sin paciente";

    try {
      const documento = await getDoc(
        doc(db, "pacientes", pacienteId)
      );

      if (!documento.exists()) return pacienteId;

      const datos = documento.data();

      const nombre = texto(datos.nombre || datos.nombres);
      const apellido = texto(datos.apellido || datos.apellidos);

      return `${nombre} ${apellido}`.trim() || pacienteId;
    } catch {
      return pacienteId;
    }
  }

  // ===================================================
  // OBTENER ANÁLISIS
  // ===================================================

  async function obtenerAnalisis(analisisId: string) {
    if (!analisisId) return "Sin análisis";

    try {
      const documento = await getDoc(
        doc(db, "analisis", analisisId)
      );

      if (!documento.exists()) return analisisId;

      const datos = documento.data();

      return texto(
        datos.nombre ||
        datos.nombreAnalisis ||
        datos.descripcion ||
        analisisId
      );
    } catch {
      return analisisId;
    }
  }

  // ===================================================
  // CARGAR RESULTADOS
  // ===================================================

  const cargar = useCallback(async () => {
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

      const laboratorioId = texto(datosUsuario.laboratorioId);

      if (!laboratorioId) {
        throw new Error("No tienes laboratorio asignado.");
      }

      const consulta = query(
        collection(db, "resultados"),
        where("laboratorioId", "==", laboratorioId)
      );

      const consultaResultados = await getDocs(consulta);

      const lista = await Promise.all(
        consultaResultados.docs.map(async (documento) => {
          const datos = documento.data();

          const pacienteId = texto(datos.pacienteId);
          const analisisId = texto(datos.analisisId);

          const paciente = await obtenerPaciente(pacienteId);
          const analisis = await obtenerAnalisis(analisisId);

          const parametrosGuardados = Array.isArray(
            datos.parametros
          )
            ? datos.parametros
            : [];

          const parametros: Parametro[] =
            parametrosGuardados.map(
              (parametro: any, indice: number) => ({
                id: texto(parametro.id || indice),
                nombre: texto(parametro.nombre),
                unidad: texto(parametro.unidad),
                valorReferencia: texto(
                  parametro.valorReferencia
                ),
                valor: texto(parametro.valor),
              })
            );

          const resultado: Resultado = {
            id: documento.id,
            muestraId: texto(datos.muestraId),
            pacienteId,
            analisisId,
            ordenId: texto(datos.ordenId),
            laboratorioId,
            estado: texto(datos.estado || "registrado"),
            paciente,
            analisis,
            parametros,
          };

          return resultado;
        })
      );

      setResultados(lista);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar los resultados."
      );

      setResultados([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ===================================================
  // ABRIR PARÁMETROS
  // ===================================================

  const abrirParametros = async (resultado: Resultado) => {
    try {
      setCargando(true);

      const documentoAnalisis = await getDoc(
        doc(db, "analisis", resultado.analisisId)
      );

      let listaParametros: Parametro[] = [];

      if (documentoAnalisis.exists()) {
        const datos = documentoAnalisis.data();

        const configurados = Array.isArray(datos.parametros)
          ? datos.parametros
          : [];

        listaParametros = configurados.map(
          (parametro: any, indice: number) => {
            const guardado = resultado.parametros.find(
              (p) =>
                p.id === texto(parametro.id || indice)
            );

            return {
              id: texto(parametro.id || indice),
              nombre: texto(parametro.nombre),
              unidad: texto(parametro.unidad),
              valorReferencia: texto(
                parametro.valorReferencia
              ),
              valor: guardado?.valor || "",
            };
          }
        );
      }

      if (listaParametros.length === 0) {
        listaParametros = resultado.parametros;
      }

      if (listaParametros.length === 0) {
        aviso(
          "Sin parámetros",
          "Este análisis no tiene parámetros configurados."
        );
        return;
      }

      setParametros(listaParametros);
      setSeleccionado(resultado);
    } catch (e: unknown) {
      aviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudieron consultar los parámetros."
      );
    } finally {
      setCargando(false);
    }
  };

  // ===================================================
  // CAMBIAR VALOR
  // ===================================================

  const cambiarValor = (id: string, valor: string) => {
    setParametros((anteriores) =>
      anteriores.map((parametro) =>
        parametro.id === id
          ? { ...parametro, valor }
          : parametro
      )
    );
  };

  // ===================================================
  // GUARDAR PARÁMETROS
  // ===================================================

  const guardar = async () => {
    if (!seleccionado || guardando) return;

    const incompleto = parametros.some(
      (parametro) => !parametro.valor.trim()
    );

    if (incompleto) {
      aviso(
        "Campos obligatorios",
        "Debes registrar el valor de todos los parámetros."
      );
      return;
    }

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error("Debes iniciar sesión.");
      }

      if (
        seleccionado.estado.toLowerCase() === "validado"
      ) {
        throw new Error(
          "No puedes modificar un resultado validado."
        );
      }

      await updateDoc(
        doc(db, "resultados", seleccionado.id),
        {
          parametros: parametros.map((parametro) => ({
            id: parametro.id,
            nombre: parametro.nombre,
            unidad: parametro.unidad,
            valorReferencia: parametro.valorReferencia,
            valor: parametro.valor.trim(),
          })),
          fechaActualizacion: serverTimestamp(),
          actualizadoPor: usuario.uid,
        }
      );

      setSeleccionado(null);
      setParametros([]);

      await cargar();

      aviso(
        "Correcto",
        "Los valores de los parámetros se guardaron correctamente."
      );
    } catch (e: unknown) {
      aviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudieron guardar los parámetros."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // FILTROS
  // ===================================================

  const filtrados = resultados.filter((resultado) => {
    const contenido = [
      resultado.id,
      resultado.muestraId,
      resultado.paciente,
      resultado.analisis,
      resultado.ordenId,
    ]
      .join(" ")
      .toLowerCase();

    return contenido.includes(busqueda.trim().toLowerCase());
  });

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.titulo}>
          Registro de valores por parámetros
        </Text>

        <Text style={styles.subtitulo}>
          Ingresa los valores obtenidos para cada parámetro
          configurado en el análisis.
        </Text>

        <View style={styles.resumen}>
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
              Con parámetros
            </Text>

            <Text style={styles.contadorNumero}>
              {
                resultados.filter(
                  (resultado) =>
                    resultado.parametros.length > 0
                ).length
              }
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.barra}>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por paciente, análisis o muestra..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable
              style={styles.botonActualizar}
              onPress={cargar}
            >
              <Text style={styles.textoBlanco}>
                Actualizar
              </Text>
            </Pressable>
          </View>

          {error !== "" && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#17365D"
            />
          ) : (
            <ScrollView horizontal>
              <View style={styles.tabla}>
                <View style={styles.cabecera}>
                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colPaciente,
                    ]}
                  >
                    Paciente
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colAnalisis,
                    ]}
                  >
                    Análisis
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colMuestra,
                    ]}
                  >
                    Muestra
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colEstado,
                    ]}
                  >
                    Estado
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colParametros,
                    ]}
                  >
                    Parámetros
                  </Text>

                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colAcciones,
                    ]}
                  >
                    Acciones
                  </Text>
                </View>

                {filtrados.map((resultado) => (
                  <View
                    style={styles.fila}
                    key={resultado.id}
                  >
                    <Text
                      style={[
                        styles.celda,
                        styles.colPaciente,
                      ]}
                    >
                      {resultado.paciente}
                    </Text>

                    <Text
                      style={[
                        styles.celda,
                        styles.colAnalisis,
                      ]}
                    >
                      {resultado.analisis}
                    </Text>

                    <Text
                      style={[
                        styles.celda,
                        styles.colMuestra,
                      ]}
                    >
                      {resultado.muestraId || "-"}
                    </Text>

                    <Text
                      style={[
                        styles.celda,
                        styles.colEstado,
                      ]}
                    >
                      {resultado.estado}
                    </Text>

                    <Text
                      style={[
                        styles.celda,
                        styles.colParametros,
                      ]}
                    >
                      {resultado.parametros.length}
                    </Text>

                    <View style={styles.colAcciones}>
                      <Pressable
                        style={styles.botonRegistrar}
                        onPress={() =>
                          abrirParametros(resultado)
                        }
                      >
                        <Text style={styles.textoBlanco}>
                          {resultado.estado.toLowerCase() ===
                          "validado"
                            ? "Ver parámetros"
                            : "Registrar valores"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {filtrados.length === 0 && (
                  <Text style={styles.sinDatos}>
                    No se encontraron resultados.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={seleccionado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!guardando) setSeleccionado(null);
        }}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitulo}>
                Valores por parámetros
              </Text>

              <Text style={styles.modalDato}>
                Paciente: {seleccionado?.paciente}
              </Text>

              <Text style={styles.modalDato}>
                Análisis: {seleccionado?.analisis}
              </Text>

              <Text style={styles.modalDato}>
                Muestra: {seleccionado?.muestraId}
              </Text>

              {parametros.map((parametro) => (
                <View
                  style={styles.parametro}
                  key={parametro.id}
                >
                  <Text style={styles.nombreParametro}>
                    {parametro.nombre}
                  </Text>

                  <Text style={styles.referencia}>
                    Referencia:{" "}
                    {parametro.valorReferencia || "-"}
                    {parametro.unidad
                      ? ` ${parametro.unidad}`
                      : ""}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Ingresar valor"
                    placeholderTextColor="#94A3B8"
                    value={parametro.valor}
                    onChangeText={(valor) =>
                      cambiarValor(parametro.id, valor)
                    }
                    editable={
                      !guardando &&
                      seleccionado?.estado.toLowerCase() !==
                        "validado"
                    }
                  />
                </View>
              ))}

              <View style={styles.botones}>
                <Pressable
                  style={styles.botonCancelar}
                  disabled={guardando}
                  onPress={() => setSeleccionado(null)}
                >
                  <Text style={styles.textoCancelar}>
                    Cerrar
                  </Text>
                </Pressable>

                {seleccionado?.estado.toLowerCase() !==
                  "validado" && (
                  <Pressable
                    style={styles.botonRegistrar}
                    disabled={guardando}
                    onPress={guardar}
                  >
                    {guardando ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.textoBlanco}>
                        Guardar valores
                      </Text>
                    )}
                  </Pressable>
                )}
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
    backgroundColor: "#F3F6FB",
  },

  contenido: {
    padding: 20,
    paddingBottom: 40,
  },

  titulo: {
    fontSize: 26,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 8,
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 22,
  },

  resumen: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },

  contador: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  contadorTitulo: {
    fontSize: 13,
    color: "#64748B",
  },

  contadorNumero: {
    fontSize: 25,
    fontWeight: "800",
    color: "#17365D",
    marginTop: 8,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },

  barra: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },

  buscador: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#0F172A",
  },

  botonActualizar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: "center",
  },

  textoBlanco: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  tabla: {
    minWidth: 1050,
  },

  cabecera: {
    flexDirection: "row",
    backgroundColor: "#17365D",
    padding: 12,
  },

  cabeceraTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  celda: {
    fontSize: 12,
    color: "#0F172A",
  },

  colPaciente: {
    width: 190,
  },

  colAnalisis: {
    width: 210,
  },

  colMuestra: {
    width: 180,
  },

  colEstado: {
    width: 130,
  },

  colParametros: {
    width: 120,
  },

  colAcciones: {
    width: 170,
    alignItems: "center",
  },

  botonRegistrar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    alignItems: "center",
  },

  sinDatos: {
    padding: 25,
    textAlign: "center",
    color: "#64748B",
  },

  error: {
    color: "#DC2626",
    marginBottom: 12,
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    maxHeight: "85%",
  },

  modalTitulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 15,
  },

  modalDato: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 7,
  },

  parametro: {
    marginTop: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },

  nombreParametro: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 6,
  },

  referencia: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 10,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#0F172A",
  },

  botones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  botonCancelar: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  textoCancelar: {
    color: "#334155",
    fontWeight: "700",
  },
});