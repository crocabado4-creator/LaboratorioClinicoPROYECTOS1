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
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Parametro = {
  id: string;
  nombre: string;
  valor: string;
  unidad: string;
  valorReferencia: string;
};

type Resultado = {
  id: string;
  codigo: string;
  muestraId: string;
  pacienteId: string;
  paciente: string;
  analisisId: string;
  analisis: string;
  ordenId: string;
  laboratorioId: string;
  estado: string;
  valor: string;
  unidad: string;
  observacion: string;
  parametros: Parametro[];
  fechaRegistro: string;
  fechaValidacion: string;
  validadoPor: string;
};

type Filtro = "todos" | "pendientes" | "validados";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

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

  if (typeof valor === "string") {
    return valor;
  }

  return "";
}

function estaValidado(estado: string): boolean {
  return estado.toLowerCase().trim() === "validado";
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

function obtenerParametros(datos: any): Parametro[] {
  if (!Array.isArray(datos.parametros)) {
    return [];
  }

  return datos.parametros.map(
    (parametro: any, indice: number) => ({
      id: texto(parametro.id ?? indice),
      nombre: texto(parametro.nombre),
      valor: texto(parametro.valor),
      unidad: texto(parametro.unidad),
      valorReferencia: texto(parametro.valorReferencia),
    })
  );
}

function tieneValoresCompletos(datos: any): boolean {
  const parametros = obtenerParametros(datos);

  if (parametros.length > 0) {
    return parametros.every(
      (parametro) =>
        parametro.nombre.trim() !== "" &&
        parametro.valor.trim() !== ""
    );
  }

  const valor = texto(datos.valor ?? datos.resultado);

  return valor.trim() !== "";
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function ValidacionResultadosScreen() {
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [error, setError] = useState("");

  const [seleccionado, setSeleccionado] =
    useState<Resultado | null>(null);

  const [confirmando, setConfirmando] = useState(false);

  // ===================================================
  // OBTENER NOMBRE DEL PACIENTE
  // ===================================================

  async function obtenerPaciente(
    pacienteId: string
  ): Promise<string> {
    if (!pacienteId) {
      return "Sin paciente";
    }

    try {
      const documento = await getDoc(
        doc(db, "pacientes", pacienteId)
      );

      if (!documento.exists()) {
        return pacienteId;
      }

      const datos = documento.data();

      const nombre = texto(
        datos.nombre || datos.nombres
      );

      const apellido = texto(
        datos.apellido || datos.apellidos
      );

      return `${nombre} ${apellido}`.trim() || pacienteId;
    } catch {
      return pacienteId;
    }
  }

  // ===================================================
  // OBTENER NOMBRE DEL ANÁLISIS
  // ===================================================

  async function obtenerAnalisis(
    analisisId: string
  ): Promise<string> {
    if (!analisisId) {
      return "Sin análisis";
    }

    try {
      const documento = await getDoc(
        doc(db, "analisis", analisisId)
      );

      if (!documento.exists()) {
        return analisisId;
      }

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
        throw new Error(
          "No se encontró tu usuario en Firestore."
        );
      }

      const datosUsuario = usuarioDoc.data();

      if (datosUsuario.activo === false) {
        throw new Error(
          "Tu cuenta está desactivada."
        );
      }

      const laboratorioId = texto(
        datosUsuario.laboratorioId
      );

      if (!laboratorioId) {
        throw new Error(
          "No tienes laboratorio asignado."
        );
      }

      const consulta = query(
        collection(db, "resultados"),
        where("laboratorioId", "==", laboratorioId)
      );

      const consultaResultados = await getDocs(
        consulta
      );

      const lista = await Promise.all(
        consultaResultados.docs.map(
          async (documento) => {
            const datos = documento.data();

            const pacienteId = texto(
              datos.pacienteId
            );

            const analisisId = texto(
              datos.analisisId
            );

            const paciente =
              texto(
                datos.pacienteNombre ||
                  datos.nombrePaciente
              ) ||
              (await obtenerPaciente(pacienteId));

            const analisis =
              texto(
                datos.analisisNombre ||
                  datos.nombreAnalisis
              ) ||
              (await obtenerAnalisis(analisisId));

            const resultado: Resultado = {
              id: documento.id,

              codigo: texto(
                datos.codigo ||
                  datos.codigoResultado ||
                  documento.id
              ),

              muestraId: texto(datos.muestraId),

              pacienteId,
              paciente,

              analisisId,
              analisis,

              ordenId: texto(datos.ordenId),

              laboratorioId,

              estado: texto(
                datos.estado || "registrado"
              ),

              valor: texto(
                datos.valor ?? datos.resultado
              ),

              unidad: texto(datos.unidad),

              observacion: texto(
                datos.observacion
              ),

              parametros: obtenerParametros(datos),

              fechaRegistro: fecha(
                datos.fechaRegistro
              ),

              fechaValidacion: fecha(
                datos.fechaValidacion
              ),

              validadoPor: texto(
                datos.validadoPor
              ),
            };

            return resultado;
          }
        )
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
  // COMPROBAR SI UN RESULTADO ESTÁ COMPLETO
  // ===================================================

  const resultadoCompleto = (
    resultado: Resultado
  ): boolean => {
    if (resultado.parametros.length > 0) {
      return resultado.parametros.every(
        (parametro) =>
          parametro.nombre.trim() !== "" &&
          parametro.valor.trim() !== ""
      );
    }

    return resultado.valor.trim() !== "";
  };

  // ===================================================
  // VALIDAR RESULTADO
  // ===================================================

  const validarResultado = async () => {
    if (!seleccionado || guardando) {
      return;
    }

    try {
      setGuardando(true);

      const usuario = getAuth().currentUser;

      if (!usuario) {
        throw new Error(
          "Debes iniciar sesión."
        );
      }

      const usuarioDoc = await getDoc(
        doc(db, "usuarios", usuario.uid)
      );

      if (!usuarioDoc.exists()) {
        throw new Error(
          "No se encontró tu usuario."
        );
      }

      const datosUsuario = usuarioDoc.data();

      if (datosUsuario.activo === false) {
        throw new Error(
          "Tu usuario está desactivado."
        );
      }

      const laboratorioId = texto(
        datosUsuario.laboratorioId
      );

      if (
        laboratorioId !==
        seleccionado.laboratorioId
      ) {
        throw new Error(
          "No tienes permiso para validar este resultado."
        );
      }

      const referencia = doc(
        db,
        "resultados",
        seleccionado.id
      );

      await runTransaction(
        db,
        async (transaction) => {
          const documento = await transaction.get(
            referencia
          );

          if (!documento.exists()) {
            throw new Error(
              "El resultado ya no existe."
            );
          }

          const datos = documento.data();

          if (
            texto(datos.laboratorioId) !==
            laboratorioId
          ) {
            throw new Error(
              "El resultado pertenece a otro laboratorio."
            );
          }

          if (
            estaValidado(
              texto(datos.estado)
            )
          ) {
            throw new Error(
              "Este resultado ya fue validado."
            );
          }

          if (!tieneValoresCompletos(datos)) {
            throw new Error(
              "No puedes validar un resultado incompleto."
            );
          }

          transaction.update(referencia, {
            estado: "validado",
            validadoPor: usuario.uid,
            fechaValidacion: serverTimestamp(),
            fechaActualizacion: serverTimestamp(),
          });
        }
      );

      setSeleccionado(null);
      setConfirmando(false);

      await cargar();

      aviso(
        "Correcto",
        "El resultado fue validado correctamente."
      );
    } catch (e: unknown) {
      aviso(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudo validar el resultado."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // CONTADORES
  // ===================================================

  const total = resultados.length;

  const validados = resultados.filter(
    (resultado) =>
      estaValidado(resultado.estado)
  ).length;

  const pendientes = resultados.filter(
    (resultado) =>
      !estaValidado(resultado.estado)
  ).length;

  // ===================================================
  // BUSCADOR Y FILTROS
  // ===================================================

  const filtrados = resultados.filter(
    (resultado) => {
      const contenido = [
        resultado.codigo,
        resultado.paciente,
        resultado.pacienteId,
        resultado.analisis,
        resultado.analisisId,
        resultado.muestraId,
        resultado.ordenId,
      ]
        .join(" ")
        .toLowerCase();

      const coincideBusqueda =
        contenido.includes(
          busqueda.trim().toLowerCase()
        );

      let coincideFiltro = true;

      if (filtro === "pendientes") {
        coincideFiltro = !estaValidado(
          resultado.estado
        );
      }

      if (filtro === "validados") {
        coincideFiltro = estaValidado(
          resultado.estado
        );
      }

      return (
        coincideBusqueda &&
        coincideFiltro
      );
    }
  );

  // ===================================================
  // ABRIR DETALLE
  // ===================================================

  const abrirDetalle = (
    resultado: Resultado
  ) => {
    setSeleccionado(resultado);
    setConfirmando(false);
  };

  const cerrarDetalle = () => {
    if (guardando) return;

    setSeleccionado(null);
    setConfirmando(false);
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
      >
        {/* TÍTULO */}

        <Text style={styles.titulo}>
          Validación de resultados
        </Text>

        <Text style={styles.subtitulo}>
          Revisa y valida los resultados
          registrados por el Bioquímico.
        </Text>

        {/* CONTADORES */}

        <View style={styles.contadores}>
          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Total de resultados
            </Text>

            <Text style={styles.contadorNumero}>
              {total}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Pendientes
            </Text>

            <Text style={styles.contadorNumero}>
              {pendientes}
            </Text>
          </View>

          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Validados
            </Text>

            <Text style={styles.contadorNumero}>
              {validados}
            </Text>
          </View>
        </View>

        {/* PANEL */}

        <View style={styles.panel}>
          {/* BUSCADOR */}

          <View style={styles.barra}>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por paciente, análisis, muestra u orden..."
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Pressable
              style={styles.botonActualizar}
              onPress={cargar}
              disabled={cargando}
            >
              <Text style={styles.textoBlanco}>
                Actualizar
              </Text>
            </Pressable>
          </View>

          {/* FILTROS */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtros}
          >
            {(
              [
                ["todos", "Todos"],
                ["pendientes", "Pendientes"],
                ["validados", "Validados"],
              ] as [Filtro, string][]
            ).map(([valor, nombre]) => (
              <Pressable
                key={valor}
                style={[
                  styles.filtro,
                  filtro === valor &&
                    styles.filtroActivo,
                ]}
                onPress={() =>
                  setFiltro(valor)
                }
              >
                <Text
                  style={[
                    styles.filtroTexto,
                    filtro === valor &&
                      styles.filtroTextoActivo,
                  ]}
                >
                  {nombre}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ERRORES */}

          {error !== "" && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          {/* TABLA */}

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#17365D"
              style={{
                marginTop: 30,
              }}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
            >
              <View style={styles.tabla}>
                {/* CABECERA */}

                <View style={styles.cabecera}>
                  <Text
                    style={[
                      styles.cabeceraTexto,
                      styles.colCodigo,
                    ]}
                  >
                    Código
                  </Text>

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
                      styles.colResultado,
                    ]}
                  >
                    Resultado
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
                      styles.colFecha,
                    ]}
                  >
                    Fecha
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

                {/* FILAS */}

                {filtrados.map(
                  (resultado) => {
                    const validado =
                      estaValidado(
                        resultado.estado
                      );

                    const completo =
                      resultadoCompleto(
                        resultado
                      );

                    return (
                      <View
                        style={styles.fila}
                        key={resultado.id}
                      >
                        <Text
                          style={[
                            styles.celda,
                            styles.colCodigo,
                          ]}
                        >
                          {resultado.codigo}
                        </Text>

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
                            styles.colResultado,
                          ]}
                        >
                          {resultado.parametros
                            .length > 0
                            ? `${resultado.parametros.length} parámetros`
                            : resultado.valor
                            ? `${resultado.valor} ${resultado.unidad}`.trim()
                            : "Sin valores"}
                        </Text>

                        <View
                          style={styles.colEstado}
                        >
                          <View
                            style={[
                              styles.estadoBadge,
                              validado
                                ? styles.estadoValidado
                                : styles.estadoPendiente,
                            ]}
                          >
                            <Text
                              style={[
                                styles.estadoTexto,
                                validado
                                  ? styles.textoValidado
                                  : styles.textoPendiente,
                              ]}
                            >
                              {validado
                                ? "Validado"
                                : resultado.estado ||
                                  "Pendiente"}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.celda,
                            styles.colFecha,
                          ]}
                        >
                          {resultado.fechaRegistro ||
                            "-"}
                        </Text>

                        <View
                          style={styles.colAcciones}
                        >
                          <Pressable
                            style={
                              validado
                                ? styles.botonVer
                                : completo
                                ? styles.botonValidar
                                : styles.botonRevisar
                            }
                            onPress={() =>
                              abrirDetalle(
                                resultado
                              )
                            }
                          >
                            <Text
                              style={
                                styles.textoBlanco
                              }
                            >
                              {validado
                                ? "Ver detalle"
                                : completo
                                ? "Revisar y validar"
                                : "Revisar"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }
                )}

                {filtrados.length === 0 && (
                  <Text
                    style={styles.sinDatos}
                  >
                    No se encontraron resultados.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* MODAL DE DETALLE */}

      <Modal
        visible={seleccionado !== null}
        transparent
        animationType="fade"
        onRequestClose={cerrarDetalle}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitulo}>
                Validación de resultado
              </Text>

              <Text style={styles.modalDato}>
                Código: {seleccionado?.codigo}
              </Text>

              <Text style={styles.modalDato}>
                Paciente:{" "}
                {seleccionado?.paciente}
              </Text>

              <Text style={styles.modalDato}>
                Análisis:{" "}
                {seleccionado?.analisis}
              </Text>

              <Text style={styles.modalDato}>
                Muestra:{" "}
                {seleccionado?.muestraId}
              </Text>

              <Text style={styles.modalDato}>
                Orden:{" "}
                {seleccionado?.ordenId}
              </Text>

              <Text style={styles.modalDato}>
                Estado:{" "}
                {seleccionado?.estado}
              </Text>

              <View style={styles.separador} />

              <Text style={styles.seccionTitulo}>
                Valores registrados
              </Text>

              {seleccionado &&
              seleccionado.parametros.length >
                0 ? (
                seleccionado.parametros.map(
                  (parametro) => (
                    <View
                      style={
                        styles.parametro
                      }
                      key={parametro.id}
                    >
                      <Text
                        style={
                          styles.nombreParametro
                        }
                      >
                        {parametro.nombre}
                      </Text>

                      <Text
                        style={styles.modalDato}
                      >
                        Valor:{" "}
                        {parametro.valor ||
                          "Sin registrar"}
                      </Text>

                      <Text
                        style={styles.modalDato}
                      >
                        Unidad:{" "}
                        {parametro.unidad ||
                          "-"}
                      </Text>

                      <Text
                        style={styles.modalDato}
                      >
                        Referencia:{" "}
                        {parametro.valorReferencia ||
                          "-"}
                      </Text>
                    </View>
                  )
                )
              ) : (
                <View
                  style={styles.parametro}
                >
                  <Text
                    style={
                      styles.modalDato
                    }
                  >
                    Resultado:{" "}
                    {seleccionado?.valor ||
                      "Sin registrar"}
                  </Text>

                  <Text
                    style={
                      styles.modalDato
                    }
                  >
                    Unidad:{" "}
                    {seleccionado?.unidad ||
                      "-"}
                  </Text>
                </View>
              )}

              {seleccionado?.observacion !==
                "" && (
                <View>
                  <Text
                    style={
                      styles.seccionTitulo
                    }
                  >
                    Observaciones
                  </Text>

                  <Text
                    style={styles.modalDato}
                  >
                    {
                      seleccionado?.observacion
                    }
                  </Text>
                </View>
              )}

              {seleccionado &&
                estaValidado(
                  seleccionado.estado
                ) && (
                  <View
                    style={
                      styles.informacionValidada
                    }
                  >
                    <Text
                      style={
                        styles.textoValidado
                      }
                    >
                      Resultado validado
                    </Text>

                    <Text
                      style={
                        styles.modalDato
                      }
                    >
                      Fecha:{" "}
                      {seleccionado.fechaValidacion ||
                        "No registrada"}
                    </Text>

                    <Text
                      style={
                        styles.modalDato
                      }
                    >
                      Responsable:{" "}
                      {seleccionado.validadoPor ||
                        "No registrado"}
                    </Text>
                  </View>
                )}

              {seleccionado &&
                !estaValidado(
                  seleccionado.estado
                ) &&
                !resultadoCompleto(
                  seleccionado
                ) && (
                  <View
                    style={
                      styles.advertencia
                    }
                  >
                    <Text
                      style={
                        styles.advertenciaTexto
                      }
                    >
                      Este resultado está incompleto.
                      Debes registrar todos sus valores
                      antes de validarlo.
                    </Text>
                  </View>
                )}

              {confirmando && (
                <View
                  style={
                    styles.confirmacion
                  }
                >
                  <Text
                    style={
                      styles.confirmacionTexto
                    }
                  >
                    ¿Confirmas que revisaste los
                    valores y deseas validar este
                    resultado?
                  </Text>
                </View>
              )}

              {/* BOTONES */}

              <View style={styles.botones}>
                <Pressable
                  style={
                    styles.botonCancelar
                  }
                  disabled={guardando}
                  onPress={
                    cerrarDetalle
                  }
                >
                  <Text
                    style={
                      styles.textoCancelar
                    }
                  >
                    Cerrar
                  </Text>
                </Pressable>

                {seleccionado &&
                  !estaValidado(
                    seleccionado.estado
                  ) &&
                  resultadoCompleto(
                    seleccionado
                  ) && (
                    <Pressable
                      style={
                        styles.botonValidar
                      }
                      disabled={
                        guardando
                      }
                      onPress={() => {
                        if (
                          !confirmando
                        ) {
                          setConfirmando(
                            true
                          );
                        } else {
                          validarResultado();
                        }
                      }}
                    >
                      {guardando ? (
                        <ActivityIndicator
                          color="#FFFFFF"
                        />
                      ) : (
                        <Text
                          style={
                            styles.textoBlanco
                          }
                        >
                          {confirmando
                            ? "Confirmar validación"
                            : "Validar resultado"}
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
    fontSize: 27,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 8,
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 22,
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 22,
  },

  contador: {
    flex: 1,
    minWidth: 145,
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

  filtros: {
    marginBottom: 15,
  },

  filtro: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },

  filtroActivo: {
    backgroundColor: "#17365D",
  },

  filtroTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },

  filtroTextoActivo: {
    color: "#FFFFFF",
  },

  tabla: {
    minWidth: 1250,
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

  colCodigo: {
    width: 180,
  },

  colPaciente: {
    width: 210,
  },

  colAnalisis: {
    width: 210,
  },

  colResultado: {
    width: 170,
  },

  colEstado: {
    width: 140,
  },

  colFecha: {
    width: 170,
  },

  colAcciones: {
    width: 170,
    alignItems: "center",
  },

  estadoBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },

  estadoValidado: {
    backgroundColor: "#DCFCE7",
  },

  estadoPendiente: {
    backgroundColor: "#FEF3C7",
  },

  estadoTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  textoValidado: {
    color: "#166534",
    fontWeight: "800",
  },

  textoPendiente: {
    color: "#92400E",
  },

  botonValidar: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    alignItems: "center",
  },

  botonRevisar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    alignItems: "center",
  },

  botonVer: {
    backgroundColor: "#64748B",
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
    fontSize: 21,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 15,
  },

  modalDato: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
  },

  separador: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 15,
  },

  seccionTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17365D",
    marginTop: 14,
    marginBottom: 10,
  },

  parametro: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 13,
    marginBottom: 10,
  },

  nombreParametro: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17365D",
    marginBottom: 8,
  },

  informacionValidada: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 13,
    marginTop: 15,
  },

  advertencia: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 13,
    marginTop: 15,
  },

  advertenciaTexto: {
    fontSize: 13,
    color: "#92400E",
  },

  confirmacion: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 13,
    marginTop: 15,
  },

  confirmacionTexto: {
    fontSize: 13,
    color: "#1D4ED8",
    fontWeight: "700",
  },

  botones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  botonCancelar: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
  },

  textoCancelar: {
    color: "#334155",
    fontWeight: "700",
  },
});