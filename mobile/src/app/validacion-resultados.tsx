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
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Usuario = {
  uid: string;
  laboratorioId: string;
  nombre: string;
};

type Paciente = {
  nombre: string;
  ci: string;
};

type Resultado = {
  id: string;
  muestraId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  laboratorioId: string;
  valorResultado: string;
  unidad: string;
  observaciones: string;
  estado: string;
  validado: boolean;
  fechaRegistro: any;
  fechaValidacion: any;
  validadoPor: string;
  validadoPorNombre: string;
};

type ValorParametro = {
  id: string;
  nombre: string;
  valor: string;
  unidad: string;
  referencia: string;
  observacion: string;
  registrado: boolean;
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

function obtenerNombre(datos: any): string {
  const nombreCompleto = texto(datos.nombreCompleto);

  if (nombreCompleto) {
    return nombreCompleto;
  }

  const nombres = texto(datos.nombres || datos.nombre);

  const apellidos = texto(
    datos.apellidos || datos.apellido
  );

  return [nombres, apellidos]
    .filter(Boolean)
    .join(" ");
}

function mostrarMensaje(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

function confirmarAccion(
  titulo: string,
  mensaje: string,
  accion: () => void
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) {
      accion();
    }
  } else {
    Alert.alert(titulo, mensaje, [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Validar",
        onPress: accion,
      },
    ]);
  }
}

function mensajeError(error: any): string {
  if (error?.code === "permission-denied") {
    return "Firestore rechazó la operación por falta de permisos.";
  }

  return error?.message || "Ocurrió un error inesperado.";
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

    const fecha = new Date(valor);

    if (isNaN(fecha.getTime())) {
      return "-";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "-";
  }
}

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

    return Object.entries(valor)
      .map(
        ([clave, dato]) =>
          `${clave}: ${obtenerReferencia(dato)}`
      )
      .join(" | ");
  }

  return "";
}

function crearParametro(
  datos: any,
  id: string
): ValorParametro {
  return {
    id,

    nombre:
      texto(datos.nombreParametro) ||
      texto(datos.nombre) ||
      texto(datos.parametro) ||
      texto(datos.descripcion) ||
      texto(datos.prueba) ||
      "Parámetro",

    valor:
      texto(datos.valor) ||
      texto(datos.valorResultado) ||
      texto(datos.resultado),

    unidad:
      texto(datos.unidad) ||
      texto(datos.unidadMedida) ||
      texto(datos.unidades),

    referencia: obtenerReferencia(
      datos.rangoReferencia ??
      datos.valorReferencia ??
      datos.referencia ??
      datos.rango ??
      datos.valoresReferencia
    ),

    observacion:
      texto(datos.observacion) ||
      texto(datos.observaciones),

    registrado: false,
  };
}

function extraerParametros(
  datos: any,
  idBase: string
): ValorParametro[] {
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
    const encontrados: ValorParametro[] = [];

    hijos.forEach((arreglo, indiceArreglo) => {
      arreglo.forEach((item: any, indice: number) => {
        const id =
          texto(item?.id) ||
          texto(item?.parametroId) ||
          `${idBase}_${indiceArreglo}_${indice}`;

        if (typeof item === "string") {
          encontrados.push(
            crearParametro({ nombre: item }, id)
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
// OBTENER NOMBRE DEL BIOQUÍMICO
// =====================================================

async function obtenerNombreBioquimico(
  uid: string,
  laboratorioId: string
): Promise<string> {
  if (!uid) {
    return "No registrado";
  }

  const usuarioSnap = await getDoc(
    doc(db, "usuarios", uid)
  );

  if (!usuarioSnap.exists()) {
    return "Usuario no encontrado";
  }

  const datos = usuarioSnap.data();

  if (
    texto(datos.laboratorioId) !== laboratorioId
  ) {
    return "Usuario de otro laboratorio";
  }

  return obtenerNombre(datos) || "Nombre no registrado";
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function ValidacionResultados() {
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [resultados, setResultados] =
    useState<Resultado[]>([]);

  const [pacientes, setPacientes] = useState<
    Record<string, Paciente>
  >({});

  const [resultadoSeleccionado, setResultadoSeleccionado] =
    useState<Resultado | null>(null);

  const [valoresParametros, setValoresParametros] =
    useState<ValorParametro[]>([]);

  const [nombreBioquimico, setNombreBioquimico] =
    useState("");

  const [modalVisible, setModalVisible] = useState(false);

  const [cargando, setCargando] = useState(true);

  const [cargandoDetalle, setCargandoDetalle] =
    useState(false);

  const [validando, setValidando] = useState(false);

  const [busqueda, setBusqueda] = useState("");

  // ===================================================
  // CARGAR RESULTADOS Y PACIENTES
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
        throw new Error(
          "No tienes un laboratorio asignado."
        );
      }

      setUsuario({
        uid: firebaseUser.uid,
        laboratorioId,
        nombre:
          obtenerNombre(datosUsuario) ||
          texto(firebaseUser.displayName) ||
          "Bioquímico",
      });

      const [resultadosSnap, pacientesSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, "resultados"),
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

      const listaResultados: Resultado[] =
        resultadosSnap.docs.map((documento) => {
          const datos = documento.data();

          return {
            id: documento.id,

            muestraId: texto(datos.muestraId),

            pacienteId: texto(datos.pacienteId),

            ordenId: texto(datos.ordenId),

            analisisId: texto(datos.analisisId),

            analisisNombre:
              texto(datos.analisisNombre) || "Análisis",

            laboratorioId: texto(datos.laboratorioId),

            valorResultado: texto(datos.valorResultado),

            unidad: texto(datos.unidad),

            observaciones: texto(datos.observaciones),

            estado: texto(datos.estado) || "borrador",

            validado: datos.validado === true,

            fechaRegistro: datos.fechaRegistro || null,

            fechaValidacion: datos.fechaValidacion || null,

            validadoPor: texto(datos.validadoPor),

            validadoPorNombre: texto(
              datos.validadoPorNombre
            ),
          };
        });

      setResultados(listaResultados);

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
      console.error(
        "Error cargando resultados:",
        error
      );

      mostrarMensaje(
        "Error",
        mensajeError(error)
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // CARGAR PARÁMETROS CONFIGURADOS
  // ===================================================

  const cargarParametrosConfigurados = async (
    analisisId: string
  ): Promise<ValorParametro[]> => {
    if (!analisisId) {
      return [];
    }

    const encontrados: ValorParametro[] = [];

    const analisisSnap = await getDoc(
      doc(db, "analisis", analisisId)
    );

    if (!analisisSnap.exists()) {
      return [];
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
            crearParametro({ nombre: item }, id)
          );
        } else {
          encontrados.push(
            ...extraerParametros(item, id)
          );
        }
      });
    });

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

    const mapa = new Map<string, ValorParametro>();

    encontrados.forEach((parametro) => {
      const clave = parametro.nombre
        .toLowerCase()
        .trim();

      if (!mapa.has(clave)) {
        mapa.set(clave, parametro);
      }
    });

    return Array.from(mapa.values());
  };

  // ===================================================
  // CARGAR VALORES GUARDADOS
  // ===================================================

  const cargarValoresGuardados = async (
    resultadoId: string
  ): Promise<ValorParametro[]> => {
    const valoresSnap = await getDocs(
      collection(
        db,
        "resultados",
        resultadoId,
        "valores"
      )
    );

    return valoresSnap.docs.map((documento) => {
      const datos = documento.data();

      return {
        ...crearParametro(datos, documento.id),

        registrado: true,
      };
    });
  };

  // ===================================================
  // UNIR PARÁMETROS Y VALORES
  // ===================================================

  const unirParametros = (
    configurados: ValorParametro[],
    guardados: ValorParametro[]
  ): ValorParametro[] => {
    const mapa = new Map<string, ValorParametro>();

    configurados.forEach((parametro) => {
      mapa.set(
        parametro.nombre.toLowerCase().trim(),
        parametro
      );
    });

    guardados.forEach((guardado) => {
      const clave = guardado.nombre.toLowerCase().trim();

      const anterior = mapa.get(clave);

      if (anterior) {
        mapa.set(clave, {
          ...anterior,

          valor: guardado.valor,

          unidad: guardado.unidad || anterior.unidad,

          referencia:
            guardado.referencia || anterior.referencia,

          observacion: guardado.observacion,

          registrado: true,
        });
      } else {
        mapa.set(clave, guardado);
      }
    });

    return Array.from(mapa.values());
  };

  // ===================================================
  // REVISAR Y VALIDAR RESULTADO
  // ===================================================

  const revisarYValidar = async (resultado: Resultado) => {
    try {
      if (!usuario) {
        throw new Error("No hay sesión activa.");
      }

      setCargandoDetalle(true);

      const resultadoSnap = await getDoc(
        doc(db, "resultados", resultado.id)
      );

      if (!resultadoSnap.exists()) {
        throw new Error(
          "El resultado ya no existe."
        );
      }

      const datos = resultadoSnap.data();

      if (
        datos.laboratorioId !== usuario.laboratorioId
      ) {
        throw new Error(
          "El resultado pertenece a otro laboratorio."
        );
      }

      const resultadoActualizado: Resultado = {
        ...resultado,

        valorResultado: texto(datos.valorResultado),

        unidad: texto(datos.unidad),

        observaciones: texto(datos.observaciones),

        estado: texto(datos.estado) || "borrador",

        validado: datos.validado === true,

        fechaValidacion: datos.fechaValidacion || null,

        validadoPor: texto(datos.validadoPor),

        validadoPorNombre: texto(
          datos.validadoPorNombre
        ),
      };

      const configurados =
        await cargarParametrosConfigurados(
          resultadoActualizado.analisisId
        );

      const guardados =
        await cargarValoresGuardados(
          resultadoActualizado.id
        );

      setValoresParametros(
        unirParametros(configurados, guardados)
      );

      let nombre =
        resultadoActualizado.validadoPorNombre;

      if (
        !nombre &&
        resultadoActualizado.validadoPor
      ) {
        try {
          nombre = await obtenerNombreBioquimico(
            resultadoActualizado.validadoPor,
            usuario.laboratorioId
          );
        } catch (error) {
          // El detalle debe abrirse incluso si el perfil
          // del bioquímico no se puede consultar.
          nombre = "Nombre no disponible";
        }
      }

      setNombreBioquimico(
        nombre || "Nombre no registrado"
      );

      setResultadoSeleccionado(resultadoActualizado);

      setModalVisible(true);
    } catch (error: any) {
      console.error(
        "Error revisando resultado:",
        error
      );

      mostrarMensaje(
        "Error",
        mensajeError(error)
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ===================================================
  // VALIDAR RESULTADO
  // ===================================================

  const validarResultado = async () => {
    try {
      if (!usuario) {
        throw new Error("No hay sesión activa.");
      }

      if (!resultadoSeleccionado) {
        throw new Error(
          "Selecciona un resultado."
        );
      }

      if (
        resultadoSeleccionado.validado ||
        resultadoSeleccionado.estado === "validado"
      ) {
        throw new Error(
          "Este resultado ya fue validado."
        );
      }

      setValidando(true);

      const resultadoRef = doc(
        db,
        "resultados",
        resultadoSeleccionado.id
      );

      await runTransaction(db, async (transaction) => {
        const resultadoSnap = await transaction.get(
          resultadoRef
        );

        if (!resultadoSnap.exists()) {
          throw new Error(
            "El resultado ya no existe."
          );
        }

        const datos = resultadoSnap.data();

        if (
          datos.laboratorioId !== usuario.laboratorioId
        ) {
          throw new Error(
            "El resultado pertenece a otro laboratorio."
          );
        }

        if (
          datos.validado === true ||
          datos.estado === "validado"
        ) {
          throw new Error(
            "Este resultado ya está validado."
          );
        }

        if (!texto(datos.valorResultado)) {
          throw new Error(
            "El resultado no tiene un valor registrado."
          );
        }

        transaction.update(resultadoRef, {
          estado: "validado",
          validado: true,
          validadoPor: usuario.uid,
          validadoPorNombre: usuario.nombre,
          fechaValidacion: serverTimestamp(),
        });
      });

      mostrarMensaje(
        "Resultado validado",
        "El resultado fue validado correctamente."
      );

      setModalVisible(false);
      setResultadoSeleccionado(null);
      setValoresParametros([]);

      await cargarDatos();
    } catch (error: any) {
      console.error(
        "Error validando resultado:",
        error
      );

      mostrarMensaje(
        "No se pudo validar",
        mensajeError(error)
      );
    } finally {
      setValidando(false);
    }
  };

  const confirmarValidacion = () => {
    confirmarAccion(
      "Confirmar validación",
      "¿Estás seguro de que deseas validar este resultado?",
      validarResultado
    );
  };

  // ===================================================
  // FILTRAR RESULTADOS
  // ===================================================

  const resultadosFiltrados = resultados.filter(
    (resultado) => {
      const paciente = pacientes[resultado.pacienteId];

      const contenido = [
        resultado.analisisNombre,
        resultado.id,
        resultado.muestraId,
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

  const pendientes = resultados.filter(
    (resultado) =>
      !resultado.validado &&
      resultado.estado !== "validado"
  ).length;

  const validados = resultados.filter(
    (resultado) =>
      resultado.validado ||
      resultado.estado === "validado"
  ).length;

  // ===================================================
  // CARGANDO
  // ===================================================

  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator
          size="large"
          color="#19385F"
        />

        <Text style={styles.textoCargando}>
          Cargando validación de resultados...
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
        <View style={styles.encabezado}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>
              Validación de resultados
            </Text>

            <Text style={styles.subtitulo}>
              Revisa y valida los resultados registrados.
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

        <View style={styles.contadores}>
          <View style={styles.contador}>
            <Text style={styles.contadorTitulo}>
              Total de resultados
            </Text>

            <Text style={styles.contadorNumero}>
              {resultados.length}
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

        <View style={styles.panel}>
          <Text style={styles.etiqueta}>
            Buscar resultado
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

        <View style={styles.panel}>
          <Text style={styles.seccionTitulo}>
            Resultados registrados
          </Text>

          {resultadosFiltrados.length === 0 ? (
            <Text style={styles.textoVacio}>
              No se encontraron resultados.
            </Text>
          ) : (
            resultadosFiltrados.map((resultado) => {
              const paciente =
                pacientes[resultado.pacienteId];

              const estaValidado =
                resultado.validado ||
                resultado.estado === "validado";

              return (
                <View
                  key={resultado.id}
                  style={styles.tarjeta}
                >
                  <Text style={styles.nombreAnalisis}>
                    {resultado.analisisNombre}
                  </Text>

                  <Text style={styles.dato}>
                    Paciente:{" "}
                    {paciente?.nombre || "Sin identificar"}
                  </Text>

                  <Text style={styles.dato}>
                    CI: {paciente?.ci || "-"}
                  </Text>

                  <Text style={styles.dato}>
                    Valor:{" "}
                    {resultado.valorResultado || "Sin valor"}
                  </Text>

                  <Text style={styles.dato}>
                    Fecha:{" "}
                    {convertirFecha(
                      resultado.fechaRegistro
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.estado,
                      {
                        color: estaValidado
                          ? "#059669"
                          : "#D97706",
                      },
                    ]}
                  >
                    {estaValidado
                      ? "Validado"
                      : "Pendiente de validación"}
                  </Text>

                  <Pressable
                    style={[
                      styles.botonVer,
                      cargandoDetalle &&
                        styles.botonDeshabilitado,
                    ]}
                    disabled={cargandoDetalle}
                    onPress={() =>
                      revisarYValidar(resultado)
                    }
                  >
                    <Text style={styles.textoBoton}>
                      {cargandoDetalle
                        ? "Cargando..."
                        : estaValidado
                        ? "Ver resultado"
                        : "Revisar y validar"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!validando) {
            setModalVisible(false);
          }
        }}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <ScrollView
              contentContainerStyle={styles.contenidoModal}
            >
              <Text style={styles.tituloModal}>
                Detalle del resultado
              </Text>

              {resultadoSeleccionado && (
                <>
                  <View style={styles.resumen}>
                    <Text style={styles.dato}>
                      Análisis:{" "}
                      {resultadoSeleccionado.analisisNombre}
                    </Text>

                    <Text style={styles.dato}>
                      Paciente:{" "}
                      {pacientes[
                        resultadoSeleccionado.pacienteId
                      ]?.nombre || "Sin identificar"}
                    </Text>

                    <Text style={styles.dato}>
                      CI:{" "}
                      {pacientes[
                        resultadoSeleccionado.pacienteId
                      ]?.ci || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Estado:{" "}
                      {resultadoSeleccionado.validado ||
                      resultadoSeleccionado.estado === "validado"
                        ? "Validado"
                        : "Pendiente"}
                    </Text>
                  </View>

                  <View style={styles.tarjetaDetalle}>
                    <Text style={styles.seccionTitulo}>
                      Resultado principal
                    </Text>

                    <Text style={styles.dato}>
                      Valor:{" "}
                      {resultadoSeleccionado.valorResultado ||
                        "Sin registrar"}
                    </Text>

                    <Text style={styles.dato}>
                      Unidad:{" "}
                      {resultadoSeleccionado.unidad || "-"}
                    </Text>

                    <Text style={styles.dato}>
                      Observaciones:{" "}
                      {resultadoSeleccionado.observaciones ||
                        "Sin observaciones"}
                    </Text>

                    <Text style={styles.dato}>
                      Fecha de registro:{" "}
                      {convertirFecha(
                        resultadoSeleccionado.fechaRegistro
                      )}
                    </Text>
                  </View>

                  <View style={styles.tarjetaDetalle}>
                    <Text style={styles.seccionTitulo}>
                      Valores por parámetros
                    </Text>

                    {valoresParametros.length === 0 ? (
                      <Text style={styles.textoVacio}>
                        No existen parámetros configurados
                        ni valores individuales registrados
                        para este resultado.
                      </Text>
                    ) : (
                      valoresParametros.map(
                        (parametro, indice) => (
                          <View
                            key={`${parametro.id}_${indice}`}
                            style={styles.parametro}
                          >
                            <Text style={styles.nombreParametro}>
                              {indice + 1}. {parametro.nombre}
                            </Text>

                            <Text style={styles.dato}>
                              Valor:{" "}
                              {parametro.registrado &&
                              parametro.valor
                                ? parametro.valor
                                : "Sin valor registrado"}
                            </Text>

                            {parametro.unidad !== "" && (
                              <Text style={styles.dato}>
                                Unidad: {parametro.unidad}
                              </Text>
                            )}

                            {parametro.referencia !== "" && (
                              <Text style={styles.dato}>
                                Referencia:{" "}
                                {parametro.referencia}
                              </Text>
                            )}

                            {parametro.observacion !== "" && (
                              <Text style={styles.dato}>
                                Observación:{" "}
                                {parametro.observacion}
                              </Text>
                            )}
                          </View>
                        )
                      )
                    )}
                  </View>

                  {(resultadoSeleccionado.validado ||
                    resultadoSeleccionado.estado === "validado") && (
                    <View style={styles.tarjetaValidado}>
                      <Text style={styles.validadoTitulo}>
                        Resultado validado
                      </Text>

                      <Text style={styles.dato}>
                        Fecha:{" "}
                        {convertirFecha(
                          resultadoSeleccionado.fechaValidacion
                        )}
                      </Text>

                      <Text style={styles.dato}>
                        Validado por:{" "}
                        {nombreBioquimico}
                      </Text>
                    </View>
                  )}

                  <View style={styles.accionesModal}>
                    <Pressable
                      style={styles.botonCerrar}
                      disabled={validando}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.textoBoton}>
                        Cerrar
                      </Text>
                    </Pressable>

                    {!resultadoSeleccionado.validado &&
                      resultadoSeleccionado.estado !==
                        "validado" && (
                        <Pressable
                          style={[
                            styles.botonValidar,
                            validando &&
                              styles.botonDeshabilitado,
                          ]}
                          disabled={validando}
                          onPress={confirmarValidacion}
                        >
                          {validando ? (
                            <ActivityIndicator
                              color="#FFFFFF"
                            />
                          ) : (
                            <Text style={styles.textoBoton}>
                              Validar resultado
                            </Text>
                          )}
                        </Pressable>
                      )}
                  </View>
                </>
              )}
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

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  contador: {
    flexGrow: 1,
    minWidth: 150,
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

  estado: {
    fontSize: 14,
    fontWeight: "bold",
    marginVertical: 10,
  },

  botonVer: {
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

  tarjetaDetalle: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },

  parametro: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingVertical: 12,
  },

  nombreParametro: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#19385F",
    marginBottom: 8,
  },

  tarjetaValidado: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },

  validadoTitulo: {
    color: "#059669",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 10,
  },

  accionesModal: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 15,
  },

  botonCerrar: {
    backgroundColor: "#64748B",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 9,
  },

  botonValidar: {
    backgroundColor: "#059669",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 9,
  },
});