import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";
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

type UsuarioActual = {
  uid: string;
  laboratorioId: string;
};

type Resultado = {
  id: string;
  laboratorioId: string;
  muestraId: string;
  pacienteId: string;
  ordenId: string;
  analisisId: string;
  analisisNombre: string;
  estado: string;
  validado: boolean;
  fechaRegistro: unknown;
};

type Paciente = {
  id: string;
  nombre: string;
  ci: string;
};

type Parametro = {
  id: string;
  nombre: string;
  unidad: string;
  descripcion: string;
  rangoReferencia: unknown;
  activo: boolean;
};

type ValorGuardado = {
  id: string;
  parametroId: string;
  nombreParametro: string;
  valor: string;
  unidad: string;
  rangoReferencia: string;
  observacion: string;
};

type FormularioValor = {
  parametroId: string;
  valor: string;
  observacion: string;
};

const COLORES = {
  fondo: "#F3F6FC",
  blanco: "#FFFFFF",
  primario: "#17365D",
  primarioClaro: "#EAF1FB",
  azul: "#2563EB",
  azulClaro: "#EFF6FF",
  verde: "#059669",
  verdeClaro: "#ECFDF5",
  amarillo: "#D97706",
  amarilloClaro: "#FFFBEB",
  rojo: "#DC2626",
  rojoClaro: "#FEF2F2",
  texto: "#0F172A",
  secundario: "#64748B",
  borde: "#E2E8F0",
};

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .trim();
}

function obtenerError(error: unknown): string {
  const codigo = (
    error as { code?: string }
  )?.code;

  if (
    codigo === "permission-denied" ||
    codigo === "firestore/permission-denied"
  ) {
    return (
      "No tienes permisos suficientes en Firestore. " +
      "Comprueba las reglas del laboratorio y los resultados."
    );
  }

  if (
    codigo === "unavailable" ||
    codigo === "firestore/unavailable"
  ) {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

function mostrarMensaje(
  titulo: string,
  mensaje: string
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }

    return;
  }

  Alert.alert(titulo, mensaje);
}

function fechaTexto(valor: unknown): string {
  if (!valor) {
    return "Sin fecha";
  }

  try {
    let fecha: Date;

    if (
      typeof valor === "object" &&
      valor !== null &&
      "toDate" in valor &&
      typeof valor.toDate === "function"
    ) {
      fecha = valor.toDate();
    } else if (
      typeof valor === "object" &&
      valor !== null &&
      "seconds" in valor &&
      typeof valor.seconds === "number"
    ) {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor as string | number);
    }

    if (Number.isNaN(fecha.getTime())) {
      return "Sin fecha";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "Sin fecha";
  }
}

function referenciaTexto(
  referencia: unknown
): string {
  if (
    referencia === null ||
    referencia === undefined ||
    referencia === ""
  ) {
    return "No configurada";
  }

  if (
    typeof referencia === "string" ||
    typeof referencia === "number"
  ) {
    return String(referencia);
  }

  if (
    typeof referencia !== "object"
  ) {
    return "No configurada";
  }

  const datos = referencia as Record<
    string,
    unknown
  >;

  const minimo =
    datos.min ??
    datos.minimo ??
    datos.valorMinimo;

  const maximo =
    datos.max ??
    datos.maximo ??
    datos.valorMaximo;

  if (
    minimo !== undefined &&
    minimo !== null &&
    minimo !== "" &&
    maximo !== undefined &&
    maximo !== null &&
    maximo !== ""
  ) {
    return `${minimo} - ${maximo}`;
  }

  return (
    texto(datos.texto) ||
    texto(datos.descripcion) ||
    texto(datos.valor) ||
    "No configurada"
  );
}

function obtenerLimites(
  referencia: unknown
): {
  minimo: number;
  maximo: number;
} | null {
  if (
    !referencia ||
    typeof referencia !== "object"
  ) {
    return null;
  }

  const datos = referencia as Record<
    string,
    unknown
  >;

  const minimo =
    datos.min ??
    datos.minimo ??
    datos.valorMinimo;

  const maximo =
    datos.max ??
    datos.maximo ??
    datos.valorMaximo;

  if (
    minimo === undefined ||
    maximo === undefined ||
    minimo === null ||
    maximo === null ||
    minimo === "" ||
    maximo === ""
  ) {
    return null;
  }

  const numeroMinimo = Number(minimo);
  const numeroMaximo = Number(maximo);

  if (
    !Number.isFinite(numeroMinimo) ||
    !Number.isFinite(numeroMaximo)
  ) {
    return null;
  }

  return {
    minimo: numeroMinimo,
    maximo: numeroMaximo,
  };
}

function evaluarValor(
  valor: string,
  referencia: unknown
): "normal" | "bajo" | "alto" | "sin_referencia" {
  if (!valor.trim()) {
    return "sin_referencia";
  }

  const limites = obtenerLimites(referencia);

  if (!limites) {
    return "sin_referencia";
  }

  const numero = Number(
    valor.trim().replace(",", ".")
  );

  if (!Number.isFinite(numero)) {
    return "sin_referencia";
  }

  if (numero < limites.minimo) {
    return "bajo";
  }

  if (numero > limites.maximo) {
    return "alto";
  }

  return "normal";
}

function obtenerColorEvaluacion(
  evaluacion: string
): string {
  if (evaluacion === "normal") {
    return COLORES.verde;
  }

  if (
    evaluacion === "alto" ||
    evaluacion === "bajo"
  ) {
    return COLORES.rojo;
  }

  return COLORES.secundario;
}

function nombreEvaluacion(
  evaluacion: string
): string {
  if (evaluacion === "normal") {
    return "En rango";
  }

  if (evaluacion === "alto") {
    return "Sobre el rango";
  }

  if (evaluacion === "bajo") {
    return "Bajo el rango";
  }

  return "Sin evaluación";
}

function convertirResultado(
  id: string,
  datos: Record<string, any>
): Resultado {
  return {
    id,
    laboratorioId: texto(
      datos.laboratorioId
    ),
    muestraId: texto(
      datos.muestraId
    ),
    pacienteId: texto(
      datos.pacienteId
    ),
    ordenId: texto(
      datos.ordenId
    ),
    analisisId: texto(
      datos.analisisId
    ),
    analisisNombre:
      texto(datos.analisisNombre) ||
      texto(datos.nombreAnalisis) ||
      "Análisis sin nombre",
    estado:
      normalizar(datos.estado) ||
      "borrador",
    validado:
      datos.validado === true ||
      normalizar(datos.estado) === "validado",
    fechaRegistro:
      datos.fechaRegistro || null,
  };
}

function convertirParametro(
  id: string,
  datos: Record<string, any>
): Parametro {
  return {
    id:
      texto(datos.parametroId) ||
      texto(datos.id) ||
      id,
    nombre:
      texto(datos.nombre) ||
      texto(datos.nombreParametro) ||
      "Parámetro sin nombre",
    unidad: texto(datos.unidad),
    descripcion: texto(
      datos.descripcion
    ),
    rangoReferencia:
      datos.rangoReferencia ??
      datos.referencia ??
      null,
    activo: datos.activo !== false,
  };
}

function convertirValor(
  id: string,
  datos: Record<string, any>
): ValorGuardado {
  return {
    id,
    parametroId:
      texto(datos.parametroId) || id,
    nombreParametro: texto(
      datos.nombreParametro
    ),
    valor: texto(datos.valor),
    unidad: texto(datos.unidad),
    rangoReferencia: texto(
      datos.rangoReferencia
    ),
    observacion: texto(
      datos.observacion
    ),
  };
}

async function obtenerUsuarioActual(): Promise<UsuarioActual> {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error(
      "Debes iniciar sesión para acceder a este módulo."
    );
  }

  const usuarioSnap = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  if (!usuarioSnap.exists()) {
    throw new Error(
      "No se encontró tu usuario en Firestore."
    );
  }

  const datos = usuarioSnap.data();

  if (datos.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  const rol = normalizar(datos.rol);

  if (
    rol !== "bioquimico" &&
    rol !== "bioquímico"
  ) {
    throw new Error(
      "Solo el bioquímico puede gestionar valores por parámetros."
    );
  }

  const laboratorioId = texto(
    datos.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene un laboratorio asignado."
    );
  }

  return {
    uid: usuario.uid,
    laboratorioId,
  };
}

function resultadoEditable(
  resultado: Resultado
): boolean {
  return (
    resultado.estado === "borrador" &&
    resultado.validado === false
  );
}

export default function ValoresParametrosScreen() {
  const router = useRouter();

  const [resultados, setResultados] =
    useState<Resultado[]>([]);

  const [pacientes, setPacientes] =
    useState<Record<string, Paciente>>({});

  const [busqueda, setBusqueda] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [cargandoParametros, setCargandoParametros] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    resultadoSeleccionado,
    setResultadoSeleccionado,
  ] = useState<Resultado | null>(null);

  const [parametros, setParametros] =
    useState<Parametro[]>([]);

  const [valores, setValores] =
    useState<Record<string, ValorGuardado>>({});

  const [modalVisible, setModalVisible] =
    useState(false);

  const [
    parametroSeleccionado,
    setParametroSeleccionado,
  ] = useState<Parametro | null>(null);

  const [formulario, setFormulario] =
    useState<FormularioValor>({
      parametroId: "",
      valor: "",
      observacion: "",
    });

  const cargarDatos = useCallback(
    async (
      mostrarCarga = true
    ): Promise<void> => {
      try {
        if (mostrarCarga) {
          setCargando(true);
        }

        setError("");

        const usuario =
          await obtenerUsuarioActual();

        const consultaResultados = query(
          collection(db, "resultados"),
          where(
            "laboratorioId",
            "==",
            usuario.laboratorioId
          )
        );

        const consultaPacientes = query(
          collection(db, "pacientes"),
          where(
            "laboratorioId",
            "==",
            usuario.laboratorioId
          )
        );

        const [
          resultadosSnap,
          pacientesSnap,
        ] = await Promise.all([
          getDocs(consultaResultados),
          getDocs(consultaPacientes),
        ]);

        const listaResultados =
          resultadosSnap.docs.map(
            (documento) =>
              convertirResultado(
                documento.id,
                documento.data()
              )
          );

        const mapaPacientes: Record<
          string,
          Paciente
        > = {};

        pacientesSnap.docs.forEach(
          (documento) => {
            const datos = documento.data();

            const nombres = texto(
              datos.nombres ||
              datos.nombre
            );

            const apellidos = texto(
              datos.apellidos ||
              datos.apellido
            );

            mapaPacientes[documento.id] = {
              id: documento.id,
              nombre:
                [nombres, apellidos]
                  .filter(Boolean)
                  .join(" ") ||
                "Paciente sin nombre",
              ci: texto(
                datos.ci ||
                datos.carnet ||
                datos.carnetIdentidad ||
                datos.numeroDocumento
              ),
            };
          }
        );

        listaResultados.sort(
          (a, b) =>
            a.analisisNombre.localeCompare(
              b.analisisNombre
            )
        );

        setResultados(listaResultados);
        setPacientes(mapaPacientes);

        setResultadoSeleccionado(
          (anterior) => {
            if (!anterior) {
              return null;
            }

            return (
              listaResultados.find(
                (resultado) =>
                  resultado.id === anterior.id
              ) || null
            );
          }
        );
      } catch (e: unknown) {
        setError(obtenerError(e));
        setResultados([]);
        setPacientes({});
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    []
  );

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const actualizar = useCallback(
    async (): Promise<void> => {
      if (actualizando) {
        return;
      }

      setActualizando(true);
      await cargarDatos(false);
    },
    [actualizando, cargarDatos]
  );

  const cargarParametros = async (
    resultado: Resultado
  ): Promise<void> => {
    try {
      setCargandoParametros(true);

      const usuario =
        await obtenerUsuarioActual();

      const resultadoSnap = await getDoc(
        doc(db, "resultados", resultado.id)
      );

      if (!resultadoSnap.exists()) {
        throw new Error(
          "El resultado seleccionado ya no existe."
        );
      }

      const datosResultado =
        resultadoSnap.data();

      if (
        texto(datosResultado.laboratorioId) !==
        usuario.laboratorioId
      ) {
        throw new Error(
          "Este resultado pertenece a otro laboratorio."
        );
      }

      const resultadoActual =
        convertirResultado(
          resultadoSnap.id,
          datosResultado
        );

      if (!resultadoActual.analisisId) {
        throw new Error(
          "El resultado no tiene un análisis asignado."
        );
      }

      const analisisSnap = await getDoc(
        doc(
          db,
          "analisis",
          resultadoActual.analisisId
        )
      );

      if (!analisisSnap.exists()) {
        throw new Error(
          "No se encontró la configuración del análisis."
        );
      }

      const datosAnalisis =
        analisisSnap.data();

      if (
        texto(datosAnalisis.laboratorioId) !==
        usuario.laboratorioId
      ) {
        throw new Error(
          "El análisis pertenece a otro laboratorio."
        );
      }

      const parametrosSubcoleccion =
        await getDocs(
          collection(
            db,
            "analisis",
            resultadoActual.analisisId,
            "parametros"
          )
        );

      let listaParametros: Parametro[] = [];

      if (!parametrosSubcoleccion.empty) {
        listaParametros =
          parametrosSubcoleccion.docs.map(
            (documento) =>
              convertirParametro(
                documento.id,
                documento.data()
              )
          );
      } else if (
        Array.isArray(
          datosAnalisis.parametros
        )
      ) {
        listaParametros =
          datosAnalisis.parametros.map(
            (
              parametro: Record<string, any>,
              indice: number
            ) =>
              convertirParametro(
                `parametro-${indice}`,
                parametro
              )
          );
      }

      listaParametros =
        listaParametros.filter(
          (parametro) =>
            parametro.activo
        );

      const valoresSnap = await getDocs(
        collection(
          db,
          "resultados",
          resultadoActual.id,
          "valores"
        )
      );

      const mapaValores: Record<
        string,
        ValorGuardado
      > = {};

      valoresSnap.docs.forEach(
        (documento) => {
          const valor = convertirValor(
            documento.id,
            documento.data()
          );

          mapaValores[valor.parametroId] =
            valor;
        }
      );

      setResultadoSeleccionado(
        resultadoActual
      );

      setParametros(listaParametros);
      setValores(mapaValores);
    } catch (e: unknown) {
      mostrarMensaje(
        "No se pudieron cargar los parámetros",
        obtenerError(e)
      );

      setResultadoSeleccionado(null);
      setParametros([]);
      setValores({});
    } finally {
      setCargandoParametros(false);
    }
  };

  const abrirResultado = async (
    resultado: Resultado
  ): Promise<void> => {
    await cargarParametros(resultado);
  };

  const cerrarResultado = (): void => {
    setResultadoSeleccionado(null);
    setParametros([]);
    setValores({});
    setModalVisible(false);
    setParametroSeleccionado(null);
  };

  const abrirFormulario = (
    parametro: Parametro
  ): void => {
    if (!resultadoSeleccionado) {
      return;
    }

    if (
      !resultadoEditable(
        resultadoSeleccionado
      )
    ) {
      mostrarMensaje(
        "Resultado bloqueado",
        "Este resultado ya fue validado o no está en borrador."
      );

      return;
    }

    const valorExistente =
      valores[parametro.id];

    setParametroSeleccionado(parametro);

    setFormulario({
      parametroId: parametro.id,
      valor:
        valorExistente?.valor || "",
      observacion:
        valorExistente?.observacion || "",
    });

    setModalVisible(true);
  };

  const cerrarFormulario = (): void => {
    if (guardando) {
      return;
    }

    setModalVisible(false);
    setParametroSeleccionado(null);

    setFormulario({
      parametroId: "",
      valor: "",
      observacion: "",
    });
  };

  const guardarValor = async (): Promise<void> => {
    if (guardando) {
      return;
    }

    if (
      !resultadoSeleccionado ||
      !parametroSeleccionado
    ) {
      mostrarMensaje(
        "Datos incompletos",
        "Selecciona un resultado y un parámetro."
      );

      return;
    }

    const valorIngresado =
      formulario.valor.trim();

    if (!valorIngresado) {
      mostrarMensaje(
        "Valor obligatorio",
        "Debes ingresar el valor del parámetro."
      );

      return;
    }

    try {
      setGuardando(true);

      const usuario =
        await obtenerUsuarioActual();

      const resultadoId =
        resultadoSeleccionado.id;

      const parametroId =
        parametroSeleccionado.id;

      const resultadoRef = doc(
        db,
        "resultados",
        resultadoId
      );

      const valorRef = doc(
        db,
        "resultados",
        resultadoId,
        "valores",
        parametroId
      );

      const rango =
        referenciaTexto(
          parametroSeleccionado.rangoReferencia
        );

      await runTransaction(
        db,
        async (transaccion) => {
          const resultadoSnap =
            await transaccion.get(
              resultadoRef
            );

          const valorSnap =
            await transaccion.get(
              valorRef
            );

          if (!resultadoSnap.exists()) {
            throw new Error(
              "El resultado ya no existe."
            );
          }

          const datosResultado =
            resultadoSnap.data();

          if (
            texto(
              datosResultado.laboratorioId
            ) !== usuario.laboratorioId
          ) {
            throw new Error(
              "Este resultado pertenece a otro laboratorio."
            );
          }

          if (
            normalizar(
              datosResultado.estado
            ) !== "borrador" ||
            datosResultado.validado === true
          ) {
            throw new Error(
              "Este resultado ya no puede modificarse."
            );
          }

          if (
            texto(
              datosResultado.analisisId
            ) !==
            resultadoSeleccionado.analisisId
          ) {
            throw new Error(
              "El análisis del resultado cambió. Actualiza la pantalla."
            );
          }

          const datosValor = {
            parametroId,
            nombreParametro:
              parametroSeleccionado.nombre,
            valor: valorIngresado,
            unidad:
              parametroSeleccionado.unidad,
            rangoReferencia: rango,
            observacion:
              formulario.observacion.trim(),
            registradoPor: usuario.uid,
            fechaActualizacion:
              serverTimestamp(),
          };

          if (valorSnap.exists()) {
            transaccion.update(
              valorRef,
              datosValor
            );
          } else {
            transaccion.set(
              valorRef,
              {
                ...datosValor,
                fechaRegistro:
                  serverTimestamp(),
              }
            );
          }
        }
      );

      setValores(
        (anteriores) => ({
          ...anteriores,
          [parametroId]: {
            id: parametroId,
            parametroId,
            nombreParametro:
              parametroSeleccionado.nombre,
            valor: valorIngresado,
            unidad:
              parametroSeleccionado.unidad,
            rangoReferencia: rango,
            observacion:
              formulario.observacion.trim(),
          },
        })
      );

      setModalVisible(false);
      setParametroSeleccionado(null);

      setFormulario({
        parametroId: "",
        valor: "",
        observacion: "",
      });

      mostrarMensaje(
        "Valor guardado",
        "El valor del parámetro se guardó correctamente."
      );
    } catch (e: unknown) {
      mostrarMensaje(
        "No se pudo guardar",
        obtenerError(e)
      );
    } finally {
      setGuardando(false);
    }
  };

  const resultadosFiltrados = useMemo(
    () => {
      const termino =
        busqueda.trim().toLowerCase();

      return resultados.filter(
        (resultado) => {
          const paciente =
            pacientes[
              resultado.pacienteId
            ];

          const contenido = [
            resultado.analisisNombre,
            resultado.analisisId,
            resultado.ordenId,
            resultado.muestraId,
            resultado.estado,
            paciente?.nombre || "",
            paciente?.ci || "",
          ]
            .join(" ")
            .toLowerCase();

          return contenido.includes(
            termino
          );
        }
      );
    },
    [
      resultados,
      pacientes,
      busqueda,
    ]
  );

  const estadisticas = useMemo(
    () => ({
      total: resultados.length,

      borradores: resultados.filter(
        (resultado) =>
          resultadoEditable(resultado)
      ).length,

      validados: resultados.filter(
        (resultado) =>
          resultado.validado ||
          resultado.estado === "validado"
      ).length,
    }),
    [resultados]
  );

  const progreso = useMemo(() => {
    const total = parametros.length;

    const completados =
      parametros.filter(
        (parametro) =>
          Boolean(
            valores[parametro.id]?.valor
          )
      ).length;

    return {
      total,
      completados,
      porcentaje:
        total > 0
          ? Math.round(
              (completados / total) *
                100
            )
          : 0,
    };
  }, [parametros, valores]);

  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator
          size="large"
          color={COLORES.azul}
        />

        <Text
          style={styles.textoCargando}
        >
          Cargando valores por parámetros...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={
          styles.contenido
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={() => {
              void actualizar();
            }}
            tintColor={COLORES.azul}
            colors={[COLORES.azul]}
          />
        }
      >
        <View style={styles.encabezado}>
          <View
            style={styles.encabezadoTexto}
          >
            <Text
              style={styles.titulo}
            >
              Valores por parámetros
            </Text>

            <Text
              style={styles.subtitulo}
            >
              Registra los valores de cada
              parámetro de los análisis
              clínicos.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={styles.textoVolver}
            >
              Volver
            </Text>
          </Pressable>
        </View>

        <View
          style={styles.contadores}
        >
          <View
            style={styles.contador}
          >
            <View
              style={[
                styles.iconoContador,
                {
                  backgroundColor:
                    COLORES.azulClaro,
                },
              ]}
            >
              <Text
                style={[
                  styles.iconoTexto,
                  {
                    color:
                      COLORES.azul,
                  },
                ]}
              >
                R
              </Text>
            </View>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {estadisticas.total}
            </Text>

            <Text
              style={
                styles.contadorTitulo
              }
            >
              Resultados
            </Text>
          </View>

          <View
            style={styles.contador}
          >
            <View
              style={[
                styles.iconoContador,
                {
                  backgroundColor:
                    COLORES.amarilloClaro,
                },
              ]}
            >
              <Text
                style={[
                  styles.iconoTexto,
                  {
                    color:
                      COLORES.amarillo,
                  },
                ]}
              >
                B
              </Text>
            </View>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {estadisticas.borradores}
            </Text>

            <Text
              style={
                styles.contadorTitulo
              }
            >
              Borradores
            </Text>
          </View>

          <View
            style={styles.contador}
          >
            <View
              style={[
                styles.iconoContador,
                {
                  backgroundColor:
                    COLORES.verdeClaro,
                },
              ]}
            >
              <Text
                style={[
                  styles.iconoTexto,
                  {
                    color:
                      COLORES.verde,
                  },
                ]}
              >
                V
              </Text>
            </View>

            <Text
              style={
                styles.contadorNumero
              }
            >
              {estadisticas.validados}
            </Text>

            <Text
              style={
                styles.contadorTitulo
              }
            >
              Validados
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text
            style={styles.panelTitulo}
          >
            Buscar análisis
          </Text>

          <Text
            style={styles.panelDescripcion}
          >
            Selecciona un resultado para
            consultar o registrar sus
            parámetros.
          </Text>

          <TextInput
            style={styles.buscador}
            placeholder="Buscar paciente, CI, análisis u orden..."
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
          />

          <View
            style={styles.filaHerramientas}
          >
            <Text
              style={styles.resultadosTexto}
            >
              {resultadosFiltrados.length} resultados
            </Text>

            <Pressable
              style={
                styles.botonActualizar
              }
              onPress={() => {
                void actualizar();
              }}
              disabled={actualizando}
            >
              <Text
                style={
                  styles.textoActualizar
                }
              >
                Actualizar
              </Text>
            </Pressable>
          </View>
        </View>

        {error !== "" && (
          <View
            style={styles.errorCaja}
          >
            <Text
              style={styles.errorTexto}
            >
              {error}
            </Text>

            <Pressable
              style={
                styles.botonReintentar
              }
              onPress={() => {
                void cargarDatos();
              }}
            >
              <Text
                style={
                  styles.textoBlanco
                }
              >
                Reintentar
              </Text>
            </Pressable>
          </View>
        )}

        {!resultadoSeleccionado ? (
          <View
            style={styles.panel}
          >
            <Text
              style={
                styles.panelTitulo
              }
            >
              Análisis disponibles
            </Text>

            {resultadosFiltrados.length ===
            0 ? (
              <View
                style={
                  styles.estadoVacio
                }
              >
                <Text
                  style={
                    styles.estadoVacioTitulo
                  }
                >
                  No hay resultados disponibles
                </Text>

                <Text
                  style={
                    styles.estadoVacioTexto
                  }
                >
                  Primero registra un
                  resultado en el módulo
                  Registro de resultados.
                </Text>

                <Pressable
                  style={
                    styles.botonPrimario
                  }
                  onPress={() =>
                    router.push(
                      "/registro-resultados"
                    )
                  }
                >
                  <Text
                    style={
                      styles.textoBlanco
                    }
                  >
                    Ir a registro de resultados
                  </Text>
                </Pressable>
              </View>
            ) : (
              resultadosFiltrados.map(
                (resultado) => {
                  const paciente =
                    pacientes[
                      resultado.pacienteId
                    ];

                  const editable =
                    resultadoEditable(
                      resultado
                    );

                  return (
                    <View
                      key={
                        resultado.id
                      }
                      style={
                        styles.tarjetaResultado
                      }
                    >
                      <View
                        style={
                          styles.filaTarjeta
                        }
                      >
                        <View
                          style={
                            styles.iconoAnalisis
                          }
                        >
                          <Text
                            style={
                              styles.iconoAnalisisTexto
                            }
                          >
                            A
                          </Text>
                        </View>

                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.nombreAnalisis
                            }
                          >
                            {
                              resultado.analisisNombre
                            }
                          </Text>

                          <Text
                            style={
                              styles.codigoAnalisis
                            }
                          >
                            Resultado:{" "}
                            {resultado.id}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.divisor
                        }
                      />

                      <View
                        style={
                          styles.datosResultado
                        }
                      >
                        <Text
                          style={
                            styles.dato
                          }
                        >
                          Paciente:{" "}
                          <Text
                            style={
                              styles.datoValor
                            }
                          >
                            {paciente?.nombre ||
                              "Sin identificar"}
                          </Text>
                        </Text>

                        <Text
                          style={
                            styles.dato
                          }
                        >
                          CI:{" "}
                          <Text
                            style={
                              styles.datoValor
                            }
                          >
                            {paciente?.ci ||
                              "-"}
                          </Text>
                        </Text>

                        <Text
                          style={
                            styles.dato
                          }
                        >
                          Orden:{" "}
                          <Text
                            style={
                              styles.datoValor
                            }
                          >
                            {resultado.ordenId ||
                              "-"}
                          </Text>
                        </Text>

                        <Text
                          style={
                            styles.dato
                          }
                        >
                          Fecha:{" "}
                          <Text
                            style={
                              styles.datoValor
                            }
                          >
                            {fechaTexto(
                              resultado.fechaRegistro
                            )}
                          </Text>
                        </Text>
                      </View>

                      <View
                        style={
                          styles.filaInferior
                        }
                      >
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                editable
                                  ? COLORES.amarilloClaro
                                  : COLORES.verdeClaro,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeTexto,
                              {
                                color:
                                  editable
                                    ? COLORES.amarillo
                                    : COLORES.verde,
                              },
                            ]}
                          >
                            {editable
                              ? "Borrador"
                              : resultado.validado
                              ? "Validado"
                              : resultado.estado}
                          </Text>
                        </View>

                        <Pressable
                          style={
                            styles.botonPrimario
                          }
                          disabled={
                            cargandoParametros
                          }
                          onPress={() => {
                            void abrirResultado(
                              resultado
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.textoBlanco
                            }
                          >
                            {editable
                              ? "Gestionar parámetros"
                              : "Ver parámetros"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }
              )
            )}
          </View>
        ) : (
          <View
            style={styles.panel}
          >
            <View
              style={
                styles.encabezadoParametros
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.panelTitulo
                  }
                >
                  Parámetros del análisis
                </Text>

                <Text
                  style={
                    styles.panelDescripcion
                  }
                >
                  {
                    resultadoSeleccionado.analisisNombre
                  }
                </Text>
              </View>

              <Pressable
                style={
                  styles.botonSecundario
                }
                onPress={
                  cerrarResultado
                }
              >
                <Text
                  style={
                    styles.textoSecundario
                  }
                >
                  Cambiar análisis
                </Text>
              </Pressable>
            </View>

            <View
              style={
                styles.resumenPaciente
              }
            >
              <Text
                style={
                  styles.resumenEtiqueta
                }
              >
                PACIENTE
              </Text>

              <Text
                style={
                  styles.resumenNombre
                }
              >
                {pacientes[
                  resultadoSeleccionado.pacienteId
                ]?.nombre ||
                  "Sin identificar"}
              </Text>

              <Text
                style={
                  styles.resumenDetalle
                }
              >
                CI:{" "}
                {pacientes[
                  resultadoSeleccionado.pacienteId
                ]?.ci || "-"}
              </Text>

              <Text
                style={
                  styles.resumenDetalle
                }
              >
                Orden:{" "}
                {resultadoSeleccionado.ordenId ||
                  "-"}
              </Text>
            </View>

            <View
              style={
                styles.progresoPanel
              }
            >
              <View
                style={
                  styles.filaProgreso
                }
              >
                <Text
                  style={
                    styles.progresoTitulo
                  }
                >
                  Progreso de registro
                </Text>

                <Text
                  style={
                    styles.progresoPorcentaje
                  }
                >
                  {progreso.porcentaje}%
                </Text>
              </View>

              <View
                style={
                  styles.barraProgreso
                }
              >
                <View
                  style={[
                    styles.barraProgresoInterior,
                    {
                      width:
                        `${progreso.porcentaje}%`,
                    },
                  ]}
                />
              </View>

              <Text
                style={
                  styles.progresoDescripcion
                }
              >
                {progreso.completados} de{" "}
                {progreso.total} parámetros
                registrados
              </Text>
            </View>

            {!resultadoEditable(
              resultadoSeleccionado
            ) && (
              <View
                style={
                  styles.avisoBloqueado
                }
              >
                <Text
                  style={
                    styles.avisoBloqueadoTexto
                  }
                >
                  Este resultado está
                  bloqueado para edición.
                  Solo puedes consultar
                  los valores registrados.
                </Text>
              </View>
            )}

            <View
              style={
                styles.filaHerramientas
              }
            >
              <Text
                style={
                  styles.panelTitulo
                }
              >
                Lista de parámetros
              </Text>

              <Pressable
                style={
                  styles.botonActualizar
                }
                onPress={() => {
                  void cargarParametros(
                    resultadoSeleccionado
                  );
                }}
                disabled={
                  cargandoParametros
                }
              >
                <Text
                  style={
                    styles.textoActualizar
                  }
                >
                  Actualizar
                </Text>
              </Pressable>
            </View>

            {cargandoParametros ? (
              <ActivityIndicator
                size="large"
                color={COLORES.azul}
                style={{
                  marginVertical: 30,
                }}
              />
            ) : parametros.length ===
              0 ? (
              <View
                style={
                  styles.estadoVacio
                }
              >
                <Text
                  style={
                    styles.estadoVacioTitulo
                  }
                >
                  Sin parámetros configurados
                </Text>

                <Text
                  style={
                    styles.estadoVacioTexto
                  }
                >
                  Este análisis no tiene
                  parámetros activos.
                  Configúralos desde el
                  módulo de análisis en Web.
                </Text>
              </View>
            ) : (
              parametros.map(
                (
                  parametro,
                  indice
                ) => {
                  const valorGuardado =
                    valores[
                      parametro.id
                    ];

                  const tieneValor =
                    Boolean(
                      valorGuardado?.valor
                    );

                  const evaluacion =
                    evaluarValor(
                      valorGuardado?.valor ||
                        "",
                      parametro.rangoReferencia
                    );

                  const editable =
                    resultadoEditable(
                      resultadoSeleccionado
                    );

                  return (
                    <View
                      key={
                        parametro.id
                      }
                      style={
                        styles.tarjetaParametro
                      }
                    >
                      <View
                        style={
                          styles.filaParametro
                        }
                      >
                        <View
                          style={
                            styles.numeroParametro
                          }
                        >
                          <Text
                            style={
                              styles.numeroParametroTexto
                            }
                          >
                            {indice + 1}
                          </Text>
                        </View>

                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.nombreParametro
                            }
                          >
                            {
                              parametro.nombre
                            }
                          </Text>

                          <Text
                            style={
                              styles.descripcionParametro
                            }
                          >
                            {parametro.descripcion ||
                              "Parámetro clínico"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                tieneValor
                                  ? COLORES.verdeClaro
                                  : COLORES.amarilloClaro,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeTexto,
                              {
                                color:
                                  tieneValor
                                    ? COLORES.verde
                                    : COLORES.amarillo,
                              },
                            ]}
                          >
                            {tieneValor
                              ? "Registrado"
                              : "Pendiente"}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.divisor
                        }
                      />

                      <View
                        style={
                          styles.informacionParametro
                        }
                      >
                        <View
                          style={
                            styles.infoColumna
                          }
                        >
                          <Text
                            style={
                              styles.infoEtiqueta
                            }
                          >
                            Unidad
                          </Text>

                          <Text
                            style={
                              styles.infoValor
                            }
                          >
                            {parametro.unidad ||
                              "Sin unidad"}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.infoColumna
                          }
                        >
                          <Text
                            style={
                              styles.infoEtiqueta
                            }
                          >
                            Referencia
                          </Text>

                          <Text
                            style={
                              styles.infoValor
                            }
                          >
                            {referenciaTexto(
                              parametro.rangoReferencia
                            )}
                          </Text>
                        </View>
                      </View>

                      {tieneValor ? (
                        <View
                          style={
                            styles.valorRegistrado
                          }
                        >
                          <Text
                            style={
                              styles.valorEtiqueta
                            }
                          >
                            VALOR REGISTRADO
                          </Text>

                          <Text
                            style={
                              styles.valorNumero
                            }
                          >
                            {
                              valorGuardado.valor
                            }{" "}
                            <Text
                              style={
                                styles.valorUnidad
                              }
                            >
                              {
                                parametro.unidad
                              }
                            </Text>
                          </Text>

                          {evaluacion !==
                            "sin_referencia" && (
                            <Text
                              style={[
                                styles.evaluacionTexto,
                                {
                                  color:
                                    obtenerColorEvaluacion(
                                      evaluacion
                                    ),
                                },
                              ]}
                            >
                              {nombreEvaluacion(
                                evaluacion
                              )}
                            </Text>
                          )}

                          {valorGuardado.observacion !==
                            "" && (
                            <Text
                              style={
                                styles.observacionTexto
                              }
                            >
                              Observación:{" "}
                              {
                                valorGuardado.observacion
                              }
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View
                          style={
                            styles.sinValor
                          }
                        >
                          <Text
                            style={
                              styles.sinValorTexto
                            }
                          >
                            Todavía no se registró
                            un valor para este
                            parámetro.
                          </Text>
                        </View>
                      )}

                      {editable && (
                        <Pressable
                          style={
                            styles.botonParametro
                          }
                          onPress={() =>
                            abrirFormulario(
                              parametro
                            )
                          }
                        >
                          <Text
                            style={
                              styles.textoBlanco
                            }
                          >
                            {tieneValor
                              ? "Editar valor"
                              : "Registrar valor"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }
              )
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={
          cerrarFormulario
        }
      >
        <View
          style={
            styles.fondoModal
          }
        >
          <View
            style={styles.modal}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.modalContenido
              }
            >
              <View
                style={
                  styles.modalEncabezado
                }
              >
                <Text
                  style={
                    styles.modalTitulo
                  }
                >
                  Registrar valor
                </Text>

                <Pressable
                  onPress={
                    cerrarFormulario
                  }
                  disabled={guardando}
                >
                  <Text
                    style={
                      styles.cerrarModal
                    }
                  >
                    Cerrar
                  </Text>
                </Pressable>
              </View>

              {parametroSeleccionado && (
                <>
                  <View
                    style={
                      styles.modalParametro
                    }
                  >
                    <Text
                      style={
                        styles.modalNombreParametro
                      }
                    >
                      {
                        parametroSeleccionado.nombre
                      }
                    </Text>

                    <Text
                      style={
                        styles.modalDescripcion
                      }
                    >
                      Unidad:{" "}
                      {parametroSeleccionado.unidad ||
                        "Sin unidad"}
                    </Text>

                    <Text
                      style={
                        styles.modalDescripcion
                      }
                    >
                      Referencia:{" "}
                      {referenciaTexto(
                        parametroSeleccionado.rangoReferencia
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.label
                    }
                  >
                    Valor del parámetro *
                  </Text>

                  <TextInput
                    style={
                      styles.input
                    }
                    placeholder="Ingresa el valor obtenido"
                    placeholderTextColor="#94A3B8"
                    value={
                      formulario.valor
                    }
                    onChangeText={(
                      valor
                    ) =>
                      setFormulario(
                        (anterior) => ({
                          ...anterior,
                          valor,
                        })
                      )
                    }
                    editable={
                      !guardando
                    }
                  />

                  {formulario.valor.trim() !==
                    "" && (
                    <View
                      style={
                        styles.previsualizacion
                      }
                    >
                      <Text
                        style={
                          styles.previsualizacionTitulo
                        }
                      >
                        Evaluación orientativa
                      </Text>

                      <Text
                        style={[
                          styles.previsualizacionValor,
                          {
                            color:
                              obtenerColorEvaluacion(
                                evaluarValor(
                                  formulario.valor,
                                  parametroSeleccionado.rangoReferencia
                                )
                              ),
                          },
                        ]}
                      >
                        {nombreEvaluacion(
                          evaluarValor(
                            formulario.valor,
                            parametroSeleccionado.rangoReferencia
                          )
                        )}
                      </Text>

                      <Text
                        style={
                          styles.previsualizacionNota
                        }
                      >
                        La interpretación
                        clínica corresponde
                        al profesional
                        responsable.
                      </Text>
                    </View>
                  )}

                  <Text
                    style={
                      styles.label
                    }
                  >
                    Observaciones
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      styles.inputObservaciones,
                    ]}
                    placeholder="Observaciones del parámetro (opcional)"
                    placeholderTextColor="#94A3B8"
                    value={
                      formulario.observacion
                    }
                    onChangeText={(
                      observacion
                    ) =>
                      setFormulario(
                        (anterior) => ({
                          ...anterior,
                          observacion,
                        })
                      )
                    }
                    multiline
                    editable={
                      !guardando
                    }
                  />

                  <View
                    style={
                      styles.botonesModal
                    }
                  >
                    <Pressable
                      style={
                        styles.botonCancelar
                      }
                      onPress={
                        cerrarFormulario
                      }
                      disabled={
                        guardando
                      }
                    >
                      <Text
                        style={
                          styles.textoCancelar
                        }
                      >
                        Cancelar
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.botonGuardar,
                        guardando &&
                          styles.deshabilitado,
                      ]}
                      disabled={
                        guardando
                      }
                      onPress={() => {
                        void guardarValor();
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
                          Guardar valor
                        </Text>
                      )}
                    </Pressable>
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

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },

  contenido: {
    padding: 18,
    paddingBottom: 50,
  },

  cargando: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORES.fondo,
  },

  textoCargando: {
    marginTop: 15,
    fontSize: 14,
    color: COLORES.secundario,
  },

  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
    gap: 12,
  },

  encabezadoTexto: {
    flex: 1,
  },

  titulo: {
    fontSize: 27,
    fontWeight: "800",
    color: COLORES.primario,
    marginBottom: 6,
  },

  subtitulo: {
    fontSize: 14,
    color: COLORES.secundario,
    lineHeight: 21,
  },

  botonVolver: {
    backgroundColor: "#334155",
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  textoVolver: {
    color: COLORES.blanco,
    fontWeight: "700",
    fontSize: 13,
  },

  contadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  contador: {
    flexGrow: 1,
    minWidth: 105,
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 17,
  },

  iconoContador: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  iconoTexto: {
    fontSize: 16,
    fontWeight: "800",
  },

  contadorNumero: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORES.primario,
  },

  contadorTitulo: {
    fontSize: 12,
    color: COLORES.secundario,
    marginTop: 5,
  },

  panel: {
    backgroundColor: COLORES.blanco,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 18,
    marginBottom: 18,
  },

  panelTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORES.primario,
    marginBottom: 8,
  },

  panelDescripcion: {
    fontSize: 13,
    color: COLORES.secundario,
    lineHeight: 20,
    marginBottom: 14,
  },

  buscador: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14,
    color: COLORES.texto,
  },

  filaHerramientas: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 15,
    marginBottom: 8,
  },

  resultadosTexto: {
    fontSize: 13,
    color: COLORES.secundario,
  },

  botonActualizar: {
    backgroundColor: COLORES.primarioClaro,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  textoActualizar: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORES.primario,
  },

  tarjetaResultado: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 13,
    padding: 16,
    marginTop: 12,
    backgroundColor: COLORES.blanco,
  },

  filaTarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  iconoAnalisis: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORES.primarioClaro,
    alignItems: "center",
    justifyContent: "center",
  },

  iconoAnalisisTexto: {
    color: COLORES.primario,
    fontSize: 20,
    fontWeight: "800",
  },

  nombreAnalisis: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORES.primario,
    marginBottom: 4,
  },

  codigoAnalisis: {
    fontSize: 11,
    color: COLORES.secundario,
  },

  divisor: {
    height: 1,
    backgroundColor: COLORES.borde,
    marginVertical: 15,
  },

  datosResultado: {
    gap: 7,
  },

  dato: {
    fontSize: 13,
    color: COLORES.secundario,
    lineHeight: 20,
  },

  datoValor: {
    color: COLORES.texto,
    fontWeight: "600",
  },

  filaInferior: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
  },

  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },

  badgeTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  botonPrimario: {
    backgroundColor: COLORES.azul,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  textoBlanco: {
    color: COLORES.blanco,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  estadoVacio: {
    paddingVertical: 35,
    paddingHorizontal: 18,
    alignItems: "center",
  },

  estadoVacioTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORES.primario,
    marginBottom: 8,
    textAlign: "center",
  },

  estadoVacioTexto: {
    fontSize: 13,
    color: COLORES.secundario,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },

  encabezadoParametros: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  botonSecundario: {
    backgroundColor: COLORES.primarioClaro,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  textoSecundario: {
    color: COLORES.primario,
    fontSize: 12,
    fontWeight: "800",
  },

  resumenPaciente: {
    backgroundColor: COLORES.primario,
    borderRadius: 13,
    padding: 18,
    marginBottom: 18,
  },

  resumenEtiqueta: {
    fontSize: 10,
    fontWeight: "800",
    color: "#BFDBFE",
    letterSpacing: 1,
    marginBottom: 8,
  },

  resumenNombre: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORES.blanco,
    marginBottom: 10,
  },

  resumenDetalle: {
    fontSize: 12,
    color: "#DBEAFE",
    marginBottom: 5,
  },

  progresoPanel: {
    backgroundColor: COLORES.azulClaro,
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
  },

  filaProgreso: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  progresoTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORES.primario,
  },

  progresoPorcentaje: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORES.azul,
  },

  barraProgreso: {
    height: 10,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    overflow: "hidden",
  },

  barraProgresoInterior: {
    height: "100%",
    borderRadius: 10,
    backgroundColor: COLORES.azul,
  },

  progresoDescripcion: {
    fontSize: 12,
    color: COLORES.secundario,
    marginTop: 10,
  },

  avisoBloqueado: {
    backgroundColor: COLORES.amarilloClaro,
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 13,
    marginBottom: 18,
  },

  avisoBloqueadoTexto: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 19,
  },

  tarjetaParametro: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 13,
    padding: 16,
    marginTop: 12,
  },

  filaParametro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  numeroParametro: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: COLORES.primarioClaro,
    alignItems: "center",
    justifyContent: "center",
  },

  numeroParametroTexto: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORES.primario,
  },

  nombreParametro: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORES.primario,
    marginBottom: 4,
  },

  descripcionParametro: {
    fontSize: 12,
    color: COLORES.secundario,
    lineHeight: 18,
  },

  informacionParametro: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 15,
  },

  infoColumna: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#F8FAFC",
    borderRadius: 9,
    padding: 12,
  },

  infoEtiqueta: {
    fontSize: 11,
    color: COLORES.secundario,
    marginBottom: 5,
  },

  infoValor: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORES.primario,
  },

  valorRegistrado: {
    backgroundColor: COLORES.verdeClaro,
    borderRadius: 10,
    padding: 15,
    marginBottom: 14,
  },

  valorEtiqueta: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORES.verde,
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  valorNumero: {
    fontSize: 25,
    fontWeight: "800",
    color: COLORES.primario,
  },

  valorUnidad: {
    fontSize: 13,
    color: COLORES.secundario,
    fontWeight: "600",
  },

  evaluacionTexto: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },

  observacionTexto: {
    fontSize: 12,
    color: COLORES.secundario,
    marginTop: 10,
    lineHeight: 19,
  },

  sinValor: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 15,
    marginBottom: 14,
  },

  sinValorTexto: {
    fontSize: 12,
    color: COLORES.secundario,
    textAlign: "center",
    lineHeight: 19,
  },

  botonParametro: {
    backgroundColor: COLORES.primario,
    borderRadius: 9,
    paddingVertical: 13,
    paddingHorizontal: 15,
    alignItems: "center",
  },

  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
  },

  modal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: COLORES.blanco,
    borderRadius: 16,
    overflow: "hidden",
  },

  modalContenido: {
    padding: 20,
    paddingBottom: 30,
  },

  modalEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  modalTitulo: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORES.primario,
  },

  cerrarModal: {
    color: COLORES.rojo,
    fontSize: 12,
    fontWeight: "800",
  },

  modalParametro: {
    backgroundColor: COLORES.azulClaro,
    borderRadius: 11,
    padding: 16,
    marginBottom: 18,
  },

  modalNombreParametro: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORES.primario,
    marginBottom: 9,
  },

  modalDescripcion: {
    fontSize: 12,
    color: COLORES.secundario,
    marginBottom: 5,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORES.texto,
    marginBottom: 9,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 13,
    color: COLORES.texto,
    backgroundColor: COLORES.blanco,
    fontSize: 14,
    marginBottom: 18,
  },

  inputObservaciones: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  previsualizacion: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },

  previsualizacionTitulo: {
    fontSize: 12,
    color: COLORES.secundario,
    marginBottom: 7,
  },

  previsualizacionValor: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 7,
  },

  previsualizacionNota: {
    fontSize: 11,
    color: COLORES.secundario,
    lineHeight: 17,
  },

  botonesModal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 5,
  },

  botonCancelar: {
    backgroundColor: "#E2E8F0",
    borderRadius: 9,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },

  textoCancelar: {
    color: COLORES.primario,
    fontWeight: "800",
    fontSize: 12,
  },

  botonGuardar: {
    backgroundColor: COLORES.verde,
    borderRadius: 9,
    paddingHorizontal: 19,
    paddingVertical: 13,
    minWidth: 125,
    alignItems: "center",
  },

  deshabilitado: {
    opacity: 0.5,
  },

  errorCaja: {
    backgroundColor: COLORES.rojoClaro,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 11,
    padding: 15,
    marginBottom: 18,
  },

  errorTexto: {
    fontSize: 13,
    color: COLORES.rojo,
    lineHeight: 20,
    marginBottom: 12,
  },

  botonReintentar: {
    backgroundColor: COLORES.rojo,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
});