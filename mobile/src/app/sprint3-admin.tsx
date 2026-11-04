import React, {
  useCallback,
  useEffect,
  useMemo,
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
  useWindowDimensions,
} from "react-native";

import { router } from "expo-router";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

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

// ======================================================
// TIPOS
// ======================================================

type Pestana =
  | "dashboard"
  | "reportes"
  | "notificaciones"
  | "auditoria";

type Clasificacion =
  | "positivo"
  | "elevado"
  | "bajo"
  | "normal"
  | "negativo"
  | "sin_clasificar";

type FiltroResultado =
  | "todos"
  | Clasificacion;

type ResultadoClinico = {
  id: string;
  registro: Registro;
  paciente: string;
  analisis: string;
  parametro: string;
  valor: string;
  unidad: string;
  rango: string;
  clasificacion: Clasificacion;
};

type NotificacionCompleta = Registro & {
  _fechaEvento?: unknown;
  _responsableNombre?: string;
  _responsableRol?: string;
  _codigoMuestra?: string;
  _fechaOrigen?: string;
};

// ======================================================
// CONFIGURACIÓN
// ======================================================

const PESTANAS: {
  id: Pestana;
  nombre: string;
  icono: string;
}[] = [
  {
    id: "dashboard",
    nombre: "Dashboard",
    icono: "▦",
  },
  {
    id: "reportes",
    nombre: "Reportes",
    icono: "▤",
  },
  {
    id: "notificaciones",
    nombre: "Notificaciones",
    icono: "◉",
  },
  {
    id: "auditoria",
    nombre: "Auditoría",
    icono: "◎",
  },
];

const TIPOS: {
  id: TipoReporte;
  nombre: string;
}[] = [
  { id: "pacientes", nombre: "Pacientes" },
  { id: "analisis", nombre: "Análisis" },
  { id: "ventas", nombre: "Ventas" },
  { id: "ordenes", nombre: "Órdenes" },
  { id: "resultados", nombre: "Resultados" },
];

const FILTROS: {
  id: FiltroResultado;
  nombre: string;
}[] = [
  { id: "todos", nombre: "Todos" },
  { id: "positivo", nombre: "Positivos" },
  { id: "elevado", nombre: "Elevados" },
  { id: "bajo", nombre: "Bajos" },
  { id: "normal", nombre: "Normales" },
  { id: "negativo", nombre: "Negativos" },
  {
    id: "sin_clasificar",
    nombre: "Sin clasificar",
  },
];

// ======================================================
// UTILIDADES
// ======================================================

function cadena(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor).trim();
}

function obtener(
  objeto: any,
  campos: string[],
  defecto = ""
): string {
  if (!objeto) return defecto;

  for (const campo of campos) {
    const valor = cadena(objeto[campo]);

    if (valor) return valor;
  }

  return defecto;
}

function primerValor(
  objeto: any,
  campos: string[]
): any {
  if (!objeto) return undefined;

  for (const campo of campos) {
    const valor = objeto[campo];

    if (
      valor !== undefined &&
      valor !== null &&
      valor !== ""
    ) {
      return valor;
    }
  }

  return undefined;
}

function normalizar(valor: unknown): string {
  return cadena(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function presentarEstado(valor: unknown): string {
  const limpio = cadena(valor)
    .replace(/_/g, " ")
    .replace(/-/g, " ");

  if (!limpio) return "No registrado";

  return (
    limpio.charAt(0).toUpperCase() +
    limpio.slice(1)
  );
}

function nombrePersona(datos: any): string {
  if (!datos) return "";

  const completo = obtener(datos, [
    "nombreCompleto",
    "nombre_completo",
    "displayName",
  ]);

  if (completo) return completo;

  const nombres = obtener(datos, [
    "nombres",
    "nombre",
    "primerNombre",
  ]);

  const apellidos = obtener(datos, [
    "apellidos",
    "apellido",
    "primerApellido",
  ]);

  return `${nombres} ${apellidos}`.trim();
}

function nombrePaciente(registro: Registro): string {
  return (
    obtener(registro, [
      "pacienteNombre",
      "nombrePaciente",
      "nombreCompleto",
    ]) ||
    nombrePersona(registro) ||
    "Paciente no identificado"
  );
}

function nombreAnalisis(registro: Registro): string {
  return obtener(
    registro,
    [
      "analisisNombre",
      "nombreAnalisis",
      "nombre",
      "tipoAnalisis",
    ],
    "Análisis clínico"
  );
}

function tituloReporte(
  registro: Registro,
  tipo: TipoReporte
): string {
  if (tipo === "pacientes") {
    return nombrePaciente(registro);
  }

  if (tipo === "analisis") {
    return nombreAnalisis(registro);
  }

  if (tipo === "resultados") {
    return nombreAnalisis(registro);
  }

  if (tipo === "ventas") {
    return obtener(
      registro,
      ["pacienteNombre", "codigo", "numeroVenta"],
      "Venta registrada"
    );
  }

  return obtener(
    registro,
    ["pacienteNombre", "codigo", "numeroOrden"],
    "Orden de análisis"
  );
}

// ======================================================
// FECHAS
// ======================================================

function convertirFecha(valor: any): Date | null {
  if (!valor) return null;

  try {
    let resultado: Date;

    if (typeof valor.toDate === "function") {
      resultado = valor.toDate();
    } else if (typeof valor.seconds === "number") {
      resultado = new Date(
        valor.seconds * 1000
      );
    } else if (valor instanceof Date) {
      resultado = valor;
    } else {
      resultado = new Date(valor);
    }

    if (
      Number.isNaN(resultado.getTime())
    ) {
      return null;
    }

    return resultado;
  } catch {
    return null;
  }
}

function fechaCompleta(valor: any): string {
  const resultado = convertirFecha(valor);

  if (!resultado) {
    return "No registrada";
  }

  return resultado.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function soloFecha(valor: any): string {
  const resultado = convertirFecha(valor);

  if (!resultado) {
    return "No registrada";
  }

  return resultado.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function soloHora(valor: any): string {
  const resultado = convertirFecha(valor);

  if (!resultado) {
    return "No registrada";
  }

  return resultado.toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ======================================================
// FIRESTORE: USUARIOS
// ======================================================

async function consultarUsuario(
  uid: string
): Promise<{
  nombre: string;
  rol: string;
}> {
  if (!uid) {
    return {
      nombre: "",
      rol: "",
    };
  }

  try {
    const referencia = doc(
      db,
      "usuarios",
      uid
    );

    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      return {
        nombre: "",
        rol: "",
      };
    }

    const datos = documento.data();

    return {
      nombre:
        nombrePersona(datos) ||
        obtener(datos, ["correo", "email"]),
      rol: obtener(datos, [
        "rol",
        "nombreRol",
      ]),
    };
  } catch (error) {
    console.warn(
      "No se pudo consultar el usuario:",
      error
    );

    return {
      nombre: "",
      rol: "",
    };
  }
}

// ======================================================
// FIRESTORE: MUESTRAS
// ======================================================

async function consultarMuestra(
  muestraId: string,
  laboratorioId: string
): Promise<Registro | null> {
  if (!muestraId || !laboratorioId) {
    return null;
  }

  try {
    const referencia = doc(
      db,
      "muestras",
      muestraId
    );

    const documento = await getDoc(referencia);

    if (documento.exists()) {
      const datos = documento.data();

      if (
        cadena(datos.laboratorioId) ===
        laboratorioId
      ) {
        return {
          id: documento.id,
          ...datos,
        };
      }
    }
  } catch (error) {
    console.warn(
      "No se pudo consultar la muestra por ID:",
      error
    );
  }

  return null;
}

async function consultarMuestraPorCodigo(
  codigo: string,
  laboratorioId: string
): Promise<Registro | null> {
  if (!codigo || !laboratorioId) {
    return null;
  }

  const campos = [
    "codigo",
    "codigoMuestra",
  ];

  for (const campo of campos) {
    try {
      const consulta = query(
        collection(db, "muestras"),
        where("laboratorioId", "==", laboratorioId),
        where(campo, "==", codigo)
      );

      const respuesta = await getDocs(consulta);

      if (!respuesta.empty) {
        const documento = respuesta.docs[0];

        return {
          id: documento.id,
          ...documento.data(),
        };
      }
    } catch (error) {
      console.warn(
        `No se pudo buscar la muestra por ${campo}:`,
        error
      );
    }
  }

  return null;
}

// ======================================================
// IDENTIFICAR MUESTRA DESDE NOTIFICACIÓN
// ======================================================

function extraerCodigoMuestra(
  notificacion: Registro
): string {
  const directo = obtener(notificacion, [
    "codigoMuestra",
    "muestraCodigo",
    "codigo_muestra",
  ]);

  if (directo) return directo;

  const mensaje = obtener(
    notificacion,
    ["mensaje", "descripcion"]
  );

  const coincidencia = mensaje.match(
    /\bMUE-[A-Za-z0-9-]+\b/i
  );

  return coincidencia
    ? coincidencia[0]
    : "";
}

// ======================================================
// FECHA DEL EVENTO
// ======================================================

function fechaNotificacion(
  notificacion: any
): any {
  return primerValor(notificacion, [
    "fecha",
    "fechaCreacion",
    "fechaRegistro",
    "createdAt",
    "fechaNotificacion",
    "timestamp",
  ]);
}

function fechaProcesamiento(
  muestra: any
): any {
  return primerValor(muestra, [
    "fechaProcesamientoFinalizado",
    "fechaFinalizacionProcesamiento",
    "fechaFinProcesamiento",
    "fechaProcesada",
    "fechaProcesamiento",
    "procesadoEn",
    "fechaActualizacion",
  ]);
}

// ======================================================
// RESPONSABLE DEL PROCESAMIENTO
// ======================================================

function idResponsable(
  registro: any
): string {
  return obtener(registro, [
    "procesadoPor",
    "procesadoPorId",
    "bioquimicoId",
    "bioquimicoUID",
    "bioquimicoUid",
    "usuarioProcesamientoId",
    "responsableId",
    "usuarioId",
    "finalizadoPor",
    "actualizadoPor",
  ]);
}

function nombreResponsable(
  registro: any
): string {
  return obtener(registro, [
    "procesadoPorNombre",
    "bioquimicoNombre",
    "nombreBioquimico",
    "responsableNombre",
    "usuarioNombre",
    "finalizadoPorNombre",
  ]);
}

// ======================================================
// COMPLETAR NOTIFICACIONES
// ======================================================

async function completarNotificaciones(
  lista: Registro[]
): Promise<NotificacionCompleta[]> {
  const cacheUsuarios = new Map<
    string,
    Promise<{
      nombre: string;
      rol: string;
    }>
  >();

  const cacheMuestras = new Map<
    string,
    Promise<Registro | null>
  >();

  const obtenerUsuarioCache = (
    uid: string
  ) => {
    if (!cacheUsuarios.has(uid)) {
      cacheUsuarios.set(
        uid,
        consultarUsuario(uid)
      );
    }

    return cacheUsuarios.get(uid)!;
  };

  const obtenerMuestraCache = (
    id: string,
    laboratorioId: string,
    codigo: string
  ) => {
    const clave =
      `${laboratorioId}:${id || codigo}`;

    if (!cacheMuestras.has(clave)) {
      cacheMuestras.set(
        clave,
        (async () => {
          if (id) {
            const porId =
              await consultarMuestra(
                id,
                laboratorioId
              );

            if (porId) return porId;
          }

          if (codigo) {
            return consultarMuestraPorCodigo(
              codigo,
              laboratorioId
            );
          }

          return null;
        })()
      );
    }

    return cacheMuestras.get(clave)!;
  };

  return Promise.all(
    lista.map(async (notificacion) => {
      const laboratorioId = obtener(
        notificacion,
        ["laboratorioId"]
      );

      const muestraId = obtener(
        notificacion,
        [
          "muestraId",
          "idMuestra",
          "muestra_id",
        ]
      );

      const codigo =
        extraerCodigoMuestra(notificacion);

      let muestra: Registro | null = null;

      if (
        laboratorioId &&
        (muestraId || codigo)
      ) {
        muestra = await obtenerMuestraCache(
          muestraId,
          laboratorioId,
          codigo
        );
      }

      const titulo = normalizar(
        notificacion.titulo
      );

      const esProcesamiento =
        titulo.includes("procesamiento") ||
        titulo.includes("muestra");

      const fechaOriginal =
        fechaNotificacion(notificacion);

      const fechaMuestra = muestra
        ? fechaProcesamiento(muestra)
        : undefined;

      const fechaEvento =
        esProcesamiento
          ? fechaMuestra || fechaOriginal
          : fechaOriginal;

      let responsableNombre =
        nombreResponsable(
          muestra || notificacion
        );

      let responsableRol = obtener(
        muestra || notificacion,
        ["responsableRol", "rolResponsable"]
      );

      const uid =
        idResponsable(muestra) ||
        idResponsable(notificacion);

      if (
        uid &&
        (!responsableNombre ||
          responsableNombre === uid)
      ) {
        const usuario =
          await obtenerUsuarioCache(uid);

        responsableNombre =
          usuario.nombre || "";

        responsableRol =
          usuario.rol || responsableRol;
      }

      if (
        responsableNombre &&
        responsableNombre === uid
      ) {
        responsableNombre = "";
      }

      return {
        ...notificacion,

        _fechaEvento: fechaEvento,

        _fechaOrigen:
          esProcesamiento && fechaMuestra
            ? "muestra"
            : fechaOriginal
            ? "notificacion"
            : "sin_fecha",

        _responsableNombre:
          responsableNombre ||
          "No registrado",

        _responsableRol:
          responsableRol ||
          (esProcesamiento
            ? "Responsable no verificado"
            : "No registrado"),

        _codigoMuestra:
          codigo ||
          obtener(muestra, [
            "codigo",
            "codigoMuestra",
          ]),
      };
    })
  );
}

// ======================================================
// CLASIFICACIÓN DE RESULTADOS
// ======================================================

function numero(valor: unknown): number | null {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    return valor;
  }

  const original = cadena(valor);

  if (
    !/^[+-]?\d+(?:[.,]\d+)?$/.test(original)
  ) {
    return null;
  }

  const convertido = Number(
    original.replace(",", ".")
  );

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function obtenerRango(datos: any): {
  minimo: number | null;
  maximo: number | null;
  texto: string;
} {
  const referencia =
    datos?.rangoReferencia ??
    datos?.rango_referencia ??
    datos?.rango ??
    datos?.referenceRange;

  if (
    referencia &&
    typeof referencia === "object" &&
    !Array.isArray(referencia)
  ) {
    return obtenerRango({
      ...datos,
      ...referencia,
      rangoReferencia: undefined,
      rango_referencia: undefined,
      rango: undefined,
      referenceRange: undefined,
    });
  }

  const minimo = numero(
    datos?.minimo ??
      datos?.valorMinimo ??
      datos?.rangoMinimo ??
      datos?.limiteInferior ??
      datos?.min
  );

  const maximo = numero(
    datos?.maximo ??
      datos?.valorMaximo ??
      datos?.rangoMaximo ??
      datos?.limiteSuperior ??
      datos?.max
  );

  if (
    minimo !== null ||
    maximo !== null
  ) {
    const descripcion =
      minimo !== null &&
      maximo !== null
        ? `${minimo} - ${maximo}`
        : minimo !== null
        ? `Desde ${minimo}`
        : `Hasta ${maximo}`;

    return {
      minimo,
      maximo,
      texto: descripcion,
    };
  }

  const rangoTexto = cadena(referencia);

  const coincidencia = rangoTexto.match(
    /^\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:-|–|—|a)\s*([+-]?\d+(?:[.,]\d+)?)\s*$/
  );

  if (coincidencia) {
    return {
      minimo: numero(coincidencia[1]),
      maximo: numero(coincidencia[2]),
      texto: rangoTexto,
    };
  }

  return {
    minimo: null,
    maximo: null,
    texto: rangoTexto || "No configurado",
  };
}

function clasificarResultado(
  valor: string,
  datos: any
): Clasificacion {
  const limpio = normalizar(valor);

  if (
    ["positivo", "reactivo", "detectado"].includes(
      limpio
    )
  ) {
    return "positivo";
  }

  if (
    [
      "negativo",
      "no reactivo",
      "no detectado",
    ].includes(limpio)
  ) {
    return "negativo";
  }

  const valorNumerico = numero(valor);

  if (valorNumerico === null) {
    return "sin_clasificar";
  }

  const rango = obtenerRango(datos);

  if (
    rango.minimo !== null &&
    rango.maximo !== null &&
    rango.minimo > rango.maximo
  ) {
    return "sin_clasificar";
  }

  if (
    rango.maximo !== null &&
    valorNumerico > rango.maximo
  ) {
    return "elevado";
  }

  if (
    rango.minimo !== null &&
    valorNumerico < rango.minimo
  ) {
    return "bajo";
  }

  if (
    rango.minimo !== null ||
    rango.maximo !== null
  ) {
    return "normal";
  }

  return "sin_clasificar";
}

function extraerResultados(
  registros: Registro[]
): ResultadoClinico[] {
  const salida: ResultadoClinico[] = [];

  registros.forEach((registro) => {
    const colecciones = [
      registro.parametros,
      registro.parametrosResultado,
      registro.resultadosParametros,
      registro.valoresParametros,
      registro.detalleResultados,
    ];

    const parametros = colecciones.find(
      (valor) =>
        Array.isArray(valor) &&
        valor.length > 0
    );

    const lista: any[] = parametros
      ? parametros
      : [registro];

    lista.forEach((elemento, indice) => {
      const dato =
        elemento &&
        typeof elemento === "object"
          ? elemento
          : { valor: elemento };

      const valor = obtener(
        dato,
        [
          "valor",
          "resultado",
          "valorResultado",
          "valorRegistrado",
        ],
        "No registrado"
      );

      const rango = obtenerRango(dato);

      salida.push({
        id: `${registro.id}-${indice}`,
        registro,
        paciente: nombrePaciente(registro),
        analisis: nombreAnalisis(registro),
        parametro: obtener(
          dato,
          [
            "nombreParametro",
            "parametro",
            "nombre",
          ],
          nombreAnalisis(registro)
        ),
        valor,
        unidad: obtener(
          dato,
          ["unidad", "unidadMedida"],
          "No registrada"
        ),
        rango: rango.texto,
        clasificacion: clasificarResultado(
          valor,
          dato
        ),
      });
    });
  });

  return salida;
}

function coloresClasificacion(
  clasificacion: Clasificacion
) {
  switch (clasificacion) {
    case "positivo":
      return {
        fondo: "#FEE2E2",
        texto: "#B91C1C",
        nombre: "POSITIVO",
      };

    case "elevado":
      return {
        fondo: "#FFEDD5",
        texto: "#C2410C",
        nombre: "ELEVADO",
      };

    case "bajo":
      return {
        fondo: "#DBEAFE",
        texto: "#1D4ED8",
        nombre: "BAJO",
      };

    case "normal":
      return {
        fondo: "#DCFCE7",
        texto: "#15803D",
        nombre: "NORMAL",
      };

    case "negativo":
      return {
        fondo: "#E0F2FE",
        texto: "#0369A1",
        nombre: "NEGATIVO",
      };

    default:
      return {
        fondo: "#F1F5F9",
        texto: "#64748B",
        nombre: "SIN CLASIFICAR",
      };
  }
}

// ======================================================
// COMPONENTES VISUALES
// ======================================================

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <View style={styles.datoCaja}>
      <Text style={styles.datoEtiqueta}>
        {titulo}
      </Text>

      <Text style={styles.datoValor}>
        {valor || "No registrado"}
      </Text>
    </View>
  );
}

function Metrica({
  titulo,
  valor,
  color = "#2563EB",
}: {
  titulo: string;
  valor: string | number;
  color?: string;
}) {
  return (
    <View style={styles.metrica}>
      <View
        style={[
          styles.metricaLinea,
          { backgroundColor: color },
        ]}
      />

      <Text style={styles.metricaTitulo}>
        {titulo}
      </Text>

      <Text
        style={[
          styles.metricaValor,
          { color },
        ]}
      >
        {valor}
      </Text>
    </View>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function Sprint3Admin() {
  const { width } = useWindowDimensions();

  const compacto = width < 650;

  const [pestana, setPestana] =
    useState<Pestana>("dashboard");

  const [tipo, setTipo] =
    useState<TipoReporte>("pacientes");

  const [busqueda, setBusqueda] =
    useState("");

  const [estado, setEstado] =
    useState("");

  const [filtroResultado, setFiltroResultado] =
    useState<FiltroResultado>("todos");

  const [resumen, setResumen] =
    useState<ResumenLaboratorio | null>(null);

  const [registros, setRegistros] =
    useState<Registro[]>([]);

  const [
    notificaciones,
    setNotificaciones,
  ] = useState<NotificacionCompleta[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [marcando, setMarcando] =
    useState("");

  // ====================================================
  // CARGA
  // ====================================================

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      if (pestana === "dashboard") {
        const datos =
          await cargarResumenLaboratorio();

        setResumen(datos);
      }

      if (pestana === "reportes") {
        const datos =
          await cargarReporte(tipo);

        setRegistros(datos);
      }

      if (pestana === "notificaciones") {
        const datos =
          await cargarNotificaciones();

        const completos =
          await completarNotificaciones(datos);

        setNotificaciones(completos);
      }

      if (pestana === "auditoria") {
        const datos = await cargarAuditoria();

        const ids = Array.from(
          new Set(
            datos
              .map((evento) =>
                obtener(evento, ["usuarioId"])
              )
              .filter(Boolean)
          )
        );

        const usuarios = new Map<
          string,
          string
        >();

        await Promise.all(
          ids.map(async (uid) => {
            const usuario =
              await consultarUsuario(uid);

            if (usuario.nombre) {
              usuarios.set(uid, usuario.nombre);
            }
          })
        );

        const completos = datos.map(
          (evento) => {
            const uid = obtener(
              evento,
              ["usuarioId"]
            );

            const guardado = obtener(
              evento,
              ["usuarioNombre"]
            );

            return {
              ...evento,
              usuarioNombre:
                (guardado &&
                guardado !== uid
                  ? guardado
                  : usuarios.get(uid)) ||
                "Nombre no disponible",
            };
          }
        );

        setRegistros(completos);
      }
    } catch (e: any) {
      setError(
        e?.message ||
          "No se pudo cargar la información."
      );
    } finally {
      setCargando(false);
    }
  }, [pestana, tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ====================================================
  // MARCAR NOTIFICACIÓN COMO LEÍDA
  // ====================================================

  const marcarLeida = async (id: string) => {
    try {
      setMarcando(id);
      setError("");

      await marcarNotificacionLeida(id);

      setNotificaciones((anteriores) =>
        anteriores.map((item) =>
          item.id === id
            ? { ...item, leida: true }
            : item
        )
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "No se pudo marcar la notificación."
      );
    } finally {
      setMarcando("");
    }
  };

  // ====================================================
  // FILTROS DE REPORTES
  // ====================================================

  const estadosDisponibles = useMemo(() => {
    if (pestana !== "reportes") {
      return [];
    }

    return Array.from(
      new Set(
        registros
          .map((registro) =>
            normalizar(registro.estado)
          )
          .filter(Boolean)
      )
    ).sort();
  }, [registros, pestana]);

  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda);

    return registros.filter((registro) => {
      const contenido = Object.values(registro)
        .filter(
          (valor) =>
            typeof valor === "string" ||
            typeof valor === "number"
        )
        .join(" ");

      const coincideBusqueda =
        !termino ||
        normalizar(contenido).includes(termino);

      const coincideEstado =
        !estado ||
        normalizar(registro.estado) === estado;

      return (
        coincideBusqueda &&
        coincideEstado
      );
    });
  }, [registros, busqueda, estado]);

  // ====================================================
  // RESULTADOS CLÍNICOS
  // ====================================================

  const resultados = useMemo(
    () =>
      tipo === "resultados"
        ? extraerResultados(registros)
        : [],
    [registros, tipo]
  );

  const resultadosFiltrados = useMemo(() => {
    const termino = normalizar(busqueda);

    return resultados.filter((resultado) => {
      const contenido = normalizar(
        [
          resultado.paciente,
          resultado.analisis,
          resultado.parametro,
          resultado.valor,
          resultado.rango,
        ].join(" ")
      );

      const coincideBusqueda =
        !termino ||
        contenido.includes(termino);

      const coincideEstado =
        !estado ||
        normalizar(
          resultado.registro.estado
        ) === estado;

      const coincideClasificacion =
        filtroResultado === "todos" ||
        resultado.clasificacion ===
          filtroResultado;

      return (
        coincideBusqueda &&
        coincideEstado &&
        coincideClasificacion
      );
    });
  }, [
    resultados,
    busqueda,
    estado,
    filtroResultado,
  ]);

  const estadisticas = useMemo(() => {
    const contar = (
      clasificacion: Clasificacion
    ) =>
      resultados.filter(
        (item) =>
          item.clasificacion ===
          clasificacion
      ).length;

    return {
      total: resultados.length,
      positivos: contar("positivo"),
      elevados: contar("elevado"),
      bajos: contar("bajo"),
      normales: contar("normal"),
      negativos: contar("negativo"),
      sinClasificar: contar(
        "sin_clasificar"
      ),
    };
  }, [resultados]);

  // ====================================================
  // ESTADÍSTICAS DE NOTIFICACIONES
  // ====================================================

  const estadisticasNotificaciones =
    useMemo(() => {
      return {
        total: notificaciones.length,

        leidas: notificaciones.filter(
          (item) => item.leida === true
        ).length,

        pendientes: notificaciones.filter(
          (item) => item.leida !== true
        ).length,

        conResponsable:
          notificaciones.filter(
            (item) =>
              item._responsableNombre &&
              item._responsableNombre !==
                "No registrado"
          ).length,
      };
    }, [notificaciones]);

  // ====================================================
  // NAVEGACIÓN
  // ====================================================

  const cambiarPestana = (
    nueva: Pestana
  ) => {
    setPestana(nueva);
    setBusqueda("");
    setEstado("");
    setFiltroResultado("todos");
    setRegistros([]);
  };

  const cambiarTipo = (
    nuevo: TipoReporte
  ) => {
    setTipo(nuevo);
    setBusqueda("");
    setEstado("");
    setFiltroResultado("todos");
    setRegistros([]);
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <View style={styles.fondo}>
      <ScrollView
        contentContainerStyle={
          styles.contenido
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <View style={styles.encabezadoTexto}>
            <Text style={styles.sobretitulo}>
              PANEL ADMINISTRATIVO
            </Text>

            <Text style={styles.titulo}>
              Administración del laboratorio
            </Text>

            <Text style={styles.subtitulo}>
              Indicadores, reportes clínicos,
              notificaciones y auditoría.
            </Text>
          </View>

          <Pressable
            style={styles.botonVolver}
            onPress={() =>
              router.replace("/")
            }
          >
            <Text style={styles.botonVolverTexto}>
              ← Volver al inicio
            </Text>
          </Pressable>
        </View>

        {/* PESTAÑAS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.navegacion}
        >
          {PESTANAS.map((opcion) => (
            <Pressable
              key={opcion.id}
              style={[
                styles.pestana,
                pestana === opcion.id &&
                  styles.pestanaActiva,
              ]}
              onPress={() =>
                cambiarPestana(opcion.id)
              }
            >
              <Text
                style={[
                  styles.pestanaTexto,
                  pestana === opcion.id &&
                    styles.pestanaTextoActivo,
                ]}
              >
                {opcion.icono} {opcion.nombre}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ACCIONES */}

        <View style={styles.barraAcciones}>
          <Text style={styles.barraTitulo}>
            {
              PESTANAS.find(
                (item) =>
                  item.id === pestana
              )?.nombre
            }
          </Text>

          <Pressable
            style={styles.botonActualizar}
            onPress={cargar}
            disabled={cargando}
          >
            <Text style={styles.actualizarTexto}>
              {cargando
                ? "Cargando..."
                : "↻ Actualizar"}
            </Text>
          </Pressable>
        </View>

        {/* ERROR */}

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorTitulo}>
              No se pudo completar la operación
            </Text>

            <Text style={styles.errorTexto}>
              {error}
            </Text>
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
              Cargando información...
            </Text>
          </View>
        )}

        {/* ============================================ */}
        {/* DASHBOARD                                    */}
        {/* ============================================ */}

        {!cargando &&
          !error &&
          pestana === "dashboard" &&
          resumen && (
            <>
              <View style={styles.banner}>
                <Text style={styles.bannerEtiqueta}>
                  RESUMEN GENERAL
                </Text>

                <Text style={styles.bannerTitulo}>
                  {resumen.laboratorio}
                </Text>

                <Text style={styles.bannerDescripcion}>
                  Información general del
                  laboratorio clínico.
                </Text>
              </View>

              <View style={styles.metricas}>
                <Metrica
                  titulo="Pacientes"
                  valor={resumen.pacientes}
                />

                <Metrica
                  titulo="Análisis"
                  valor={resumen.analisis}
                  color="#7C3AED"
                />

                <Metrica
                  titulo="Ventas"
                  valor={resumen.ventas}
                  color="#059669"
                />

                <Metrica
                  titulo="Total vendido"
                  valor={`Bs ${resumen.totalVendido.toFixed(
                    2
                  )}`}
                  color="#0F766E"
                />

                <Metrica
                  titulo="Órdenes"
                  valor={resumen.ordenes}
                  color="#D97706"
                />

                <Metrica
                  titulo="Resultados finalizados"
                  valor={
                    resumen.resultadosFinalizados
                  }
                  color="#16A34A"
                />

                <Metrica
                  titulo="Resultados pendientes"
                  valor={
                    resumen.resultadosPendientes
                  }
                  color="#EA580C"
                />

                <Metrica
                  titulo="Muestras pendientes"
                  valor={
                    resumen.muestrasPendientes
                  }
                  color="#DC2626"
                />
              </View>
            </>
          )}

        {/* ============================================ */}
        {/* REPORTES                                     */}
        {/* ============================================ */}

        {pestana === "reportes" && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitulo}>
                Reportes del laboratorio
              </Text>

              <Text style={styles.panelDescripcion}>
                Selecciona el tipo de reporte.
              </Text>

              <View style={styles.tipos}>
                {TIPOS.map((opcion) => (
                  <Pressable
                    key={opcion.id}
                    style={[
                      styles.tipoBoton,
                      tipo === opcion.id &&
                        styles.tipoActivo,
                    ]}
                    onPress={() =>
                      cambiarTipo(opcion.id)
                    }
                  >
                    <Text
                      style={[
                        styles.tipoTexto,
                        tipo === opcion.id &&
                          styles.tipoTextoActivo,
                      ]}
                    >
                      {opcion.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar paciente, análisis o registro..."
                placeholderTextColor="#94A3B8"
              />

              {estadosDisponibles.length >
                0 && (
                <>
                  <Text style={styles.filtroTitulo}>
                    Filtrar por estado
                  </Text>

                  <View style={styles.tipos}>
                    <Pressable
                      style={[
                        styles.filtroBoton,
                        !estado &&
                          styles.filtroActivo,
                      ]}
                      onPress={() =>
                        setEstado("")
                      }
                    >
                      <Text
                        style={[
                          styles.filtroTexto,
                          !estado &&
                            styles.filtroTextoActivo,
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
                            styles.filtroBoton,
                            estado === opcion &&
                              styles.filtroActivo,
                          ]}
                          onPress={() =>
                            setEstado(opcion)
                          }
                        >
                          <Text
                            style={[
                              styles.filtroTexto,
                              estado === opcion &&
                                styles.filtroTextoActivo,
                            ]}
                          >
                            {presentarEstado(
                              opcion
                            )}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </>
              )}
            </View>

            {/* RESULTADOS CLÍNICOS */}

            {tipo === "resultados" &&
              !cargando &&
              !error && (
                <>
                  <View
                    style={
                      styles.bannerResultados
                    }
                  >
                    <Text
                      style={
                        styles.bannerEtiqueta
                      }
                    >
                      ANÁLISIS DE RESULTADOS
                    </Text>

                    <Text
                      style={
                        styles.bannerTitulo
                      }
                    >
                      Resultados clínicos
                    </Text>

                    <Text
                      style={
                        styles.bannerDescripcion
                      }
                    >
                      Consulta resultados
                      positivos y valores
                      fuera de referencia.
                    </Text>
                  </View>

                  <View style={styles.metricas}>
                    <Metrica
                      titulo="Total de valores"
                      valor={
                        estadisticas.total
                      }
                    />

                    <Metrica
                      titulo="Positivos"
                      valor={
                        estadisticas.positivos
                      }
                      color="#DC2626"
                    />

                    <Metrica
                      titulo="Elevados"
                      valor={
                        estadisticas.elevados
                      }
                      color="#EA580C"
                    />

                    <Metrica
                      titulo="Bajos"
                      valor={
                        estadisticas.bajos
                      }
                      color="#2563EB"
                    />

                    <Metrica
                      titulo="Normales"
                      valor={
                        estadisticas.normales
                      }
                      color="#16A34A"
                    />

                    <Metrica
                      titulo="Sin clasificar"
                      valor={
                        estadisticas.sinClasificar
                      }
                      color="#64748B"
                    />
                  </View>

                  <View style={styles.panel}>
                    <Text style={styles.panelTitulo}>
                      Clasificación
                    </Text>

                    <View style={styles.tipos}>
                      {FILTROS.map(
                        (opcion) => (
                          <Pressable
                            key={opcion.id}
                            style={[
                              styles.filtroBoton,
                              filtroResultado ===
                                opcion.id &&
                                styles.filtroActivo,
                            ]}
                            onPress={() =>
                              setFiltroResultado(
                                opcion.id
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.filtroTexto,
                                filtroResultado ===
                                  opcion.id &&
                                  styles.filtroTextoActivo,
                              ]}
                            >
                              {opcion.nombre}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  </View>

                  <Text
                    style={
                      styles.seccionTitulo
                    }
                  >
                    Resultados encontrados (
                    {resultadosFiltrados.length})
                  </Text>

                  {resultadosFiltrados.length ===
                    0 && (
                    <View
                      style={
                        styles.vacioContenedor
                      }
                    >
                      <Text
                        style={
                          styles.vacioTexto
                        }
                      >
                        No se encontraron
                        resultados.
                      </Text>
                    </View>
                  )}

                  {resultadosFiltrados.map(
                    (resultado) => {
                      const colores =
                        coloresClasificacion(
                          resultado.clasificacion
                        );

                      return (
                        <View
                          key={resultado.id}
                          style={
                            styles.resultadoCard
                          }
                        >
                          <View
                            style={
                              styles.resultadoSuperior
                            }
                          >
                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text
                                style={
                                  styles.resultadoPaciente
                                }
                              >
                                {
                                  resultado.paciente
                                }
                              </Text>

                              <Text
                                style={
                                  styles.resultadoAnalisis
                                }
                              >
                                {
                                  resultado.analisis
                                }
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.etiqueta,
                                {
                                  backgroundColor:
                                    colores.fondo,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.etiquetaTexto,
                                  {
                                    color:
                                      colores.texto,
                                  },
                                ]}
                              >
                                {colores.nombre}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.resultadoDatos,
                              compacto && {
                                flexDirection:
                                  "column",
                              },
                            ]}
                          >
                            <Dato
                              titulo="Parámetro"
                              valor={
                                resultado.parametro
                              }
                            />

                            <Dato
                              titulo="Valor"
                              valor={
                                resultado.valor
                              }
                            />

                            <Dato
                              titulo="Unidad"
                              valor={
                                resultado.unidad
                              }
                            />

                            <Dato
                              titulo="Rango de referencia"
                              valor={
                                resultado.rango
                              }
                            />
                          </View>

                          <Text
                            style={
                              styles.resultadoFecha
                            }
                          >
                            Fecha:{" "}
                            {fecha(
                              resultado.registro
                                .fechaValidacion ??
                                resultado.registro
                                  .fechaRegistro ??
                                resultado.registro
                                  .fecha
                            )}
                          </Text>
                        </View>
                      );
                    }
                  )}
                </>
              )}

            {/* OTROS REPORTES */}

            {tipo !== "resultados" &&
              !cargando &&
              !error && (
                <>
                  <Text
                    style={
                      styles.seccionTitulo
                    }
                  >
                    Registros encontrados (
                    {filtrados.length})
                  </Text>

                  {filtrados.length === 0 && (
                    <View
                      style={
                        styles.vacioContenedor
                      }
                    >
                      <Text
                        style={
                          styles.vacioTexto
                        }
                      >
                        No se encontraron
                        registros.
                      </Text>
                    </View>
                  )}

                  {filtrados.map(
                    (registro) => (
                      <View
                        key={registro.id}
                        style={styles.tarjeta}
                      >
                        <Text
                          style={
                            styles.tarjetaTitulo
                          }
                        >
                          {tituloReporte(
                            registro,
                            tipo
                          )}
                        </Text>

                        {registro.pacienteNombre && (
                          <Text
                            style={
                              styles.tarjetaDato
                            }
                          >
                            Paciente:{" "}
                            {texto(
                              registro.pacienteNombre
                            )}
                          </Text>
                        )}

                        {registro.estado && (
                          <Text
                            style={
                              styles.tarjetaDato
                            }
                          >
                            Estado:{" "}
                            {presentarEstado(
                              registro.estado
                            )}
                          </Text>
                        )}

                        {registro.ci && (
                          <Text
                            style={
                              styles.tarjetaDato
                            }
                          >
                            CI:{" "}
                            {texto(
                              registro.ci
                            )}
                          </Text>
                        )}

                        {registro.total !==
                          undefined &&
                          registro.total !==
                            null && (
                            <Text
                              style={
                                styles.tarjetaDato
                              }
                            >
                              Total: Bs{" "}
                              {texto(
                                registro.total
                              )}
                            </Text>
                          )}

                        {tipo === "pacientes" &&
                          registro.fechaNacimiento && (
                            <Text
                              style={
                                styles.tarjetaDato
                              }
                            >
                              Fecha de nacimiento:{" "}
                              {fecha(
                                registro.fechaNacimiento
                              )}
                            </Text>
                          )}

                        <Text
                          style={
                            styles.tarjetaDato
                          }
                        >
                          Fecha:{" "}
                          {fecha(
                            registro.fecha ??
                              registro.fechaRegistro ??
                              registro.fechaCreacion
                          )}
                        </Text>
                      </View>
                    )
                  )}
                </>
              )}
          </>
        )}

        {/* ============================================ */}
        {/* NOTIFICACIONES - NUEVO DISEÑO                */}
        {/* ============================================ */}

        {!cargando &&
          !error &&
          pestana === "notificaciones" && (
            <>
              {/* ENCABEZADO */}

              <View
                style={
                  styles.bannerNotificaciones
                }
              >
                <Text
                  style={
                    styles.bannerEtiqueta
                  }
                >
                  CONTROL DE ACTIVIDADES
                </Text>

                <Text
                  style={
                    styles.bannerTitulo
                  }
                >
                  Notificaciones del laboratorio
                </Text>

                <Text
                  style={
                    styles.bannerDescripcion
                  }
                >
                  Consulta qué ocurrió, cuándo
                  ocurrió y quién fue el
                  responsable de cada actividad.
                </Text>
              </View>

              {/* ESTADÍSTICAS */}

              <View style={styles.metricas}>
                <Metrica
                  titulo="Total"
                  valor={
                    estadisticasNotificaciones.total
                  }
                />

                <Metrica
                  titulo="No leídas"
                  valor={
                    estadisticasNotificaciones.pendientes
                  }
                  color="#EA580C"
                />

                <Metrica
                  titulo="Leídas"
                  valor={
                    estadisticasNotificaciones.leidas
                  }
                  color="#16A34A"
                />

                <Metrica
                  titulo="Con responsable"
                  valor={
                    estadisticasNotificaciones.conResponsable
                  }
                  color="#7C3AED"
                />
              </View>

              {/* LISTADO */}

              <Text
                style={styles.seccionTitulo}
              >
                Actividades registradas (
                {notificaciones.length})
              </Text>

              {notificaciones.length ===
                0 && (
                <View
                  style={
                    styles.vacioContenedor
                  }
                >
                  <Text
                    style={
                      styles.vacioTitulo
                    }
                  >
                    Sin notificaciones
                  </Text>

                  <Text
                    style={
                      styles.vacioTexto
                    }
                  >
                    No hay notificaciones
                    disponibles.
                  </Text>
                </View>
              )}

              {notificaciones.map(
                (notificacion) => {
                  const leida =
                    notificacion.leida === true;

                  const titulo = obtener(
                    notificacion,
                    ["titulo"],
                    "Notificación"
                  );

                  const mensaje = obtener(
                    notificacion,
                    [
                      "mensaje",
                      "descripcion",
                    ],
                    "Sin descripción"
                  );

                  const esProcesamiento =
                    normalizar(titulo).includes(
                      "procesamiento"
                    ) ||
                    normalizar(titulo).includes(
                      "muestra"
                    );

                  return (
                    <View
                      key={notificacion.id}
                      style={[
                        styles.notificacionCard,
                        !leida &&
                          styles.notificacionPendiente,
                      ]}
                    >
                      {/* CABECERA */}

                      <View
                        style={
                          styles.notificacionCabecera
                        }
                      >
                        <View
                          style={[
                            styles.iconoNotificacion,
                            {
                              backgroundColor:
                                esProcesamiento
                                  ? "#DBEAFE"
                                  : "#DCFCE7",
                            },
                          ]}
                        >
                          <Text
                            style={
                              styles.iconoNotificacionTexto
                            }
                          >
                            {esProcesamiento
                              ? "◈"
                              : "✓"}
                          </Text>
                        </View>

                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.notificacionTitulo
                            }
                          >
                            {titulo}
                          </Text>

                          <Text
                            style={
                              styles.notificacionTipo
                            }
                          >
                            {esProcesamiento
                              ? "Procesamiento de muestra"
                              : "Actividad del laboratorio"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.estadoNotificacion,
                            {
                              backgroundColor:
                                leida
                                  ? "#DCFCE7"
                                  : "#FFEDD5",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.estadoNotificacionTexto,
                              {
                                color: leida
                                  ? "#15803D"
                                  : "#C2410C",
                              },
                            ]}
                          >
                            {leida
                              ? "LEÍDA"
                              : "NO LEÍDA"}
                          </Text>
                        </View>
                      </View>

                      {/* MENSAJE */}

                      <Text
                        style={
                          styles.notificacionMensaje
                        }
                      >
                        {mensaje}
                      </Text>

                      {/* CÓDIGO DE MUESTRA */}

                      {notificacion._codigoMuestra ? (
                        <View
                          style={
                            styles.codigoMuestraCaja
                          }
                        >
                          <Text
                            style={
                              styles.codigoMuestraEtiqueta
                            }
                          >
                            CÓDIGO DE MUESTRA
                          </Text>

                          <Text
                            style={
                              styles.codigoMuestraValor
                            }
                          >
                            {
                              notificacion._codigoMuestra
                            }
                          </Text>
                        </View>
                      ) : null}

                      {/* INFORMACIÓN DEL EVENTO */}

                      <View
                        style={
                          styles.detalleNotificacion
                        }
                      >
                        <Text
                          style={
                            styles.detalleNotificacionTitulo
                          }
                        >
                          Información del evento
                        </Text>

                        <View
                          style={[
                            styles.detalleNotificacionGrid,
                            compacto && {
                              flexDirection:
                                "column",
                            },
                          ]}
                        >
                          <Dato
                            titulo="Fecha"
                            valor={soloFecha(
                              notificacion._fechaEvento
                            )}
                          />

                          <Dato
                            titulo="Hora"
                            valor={soloHora(
                              notificacion._fechaEvento
                            )}
                          />

                          <Dato
                            titulo={
                              esProcesamiento
                                ? "Procesado por"
                                : "Responsable"
                            }
                            valor={
                              notificacion._responsableNombre ||
                              "No registrado"
                            }
                          />

                          <Dato
                            titulo="Cargo"
                            valor={
                              notificacion._responsableRol ||
                              "No registrado"
                            }
                          />
                        </View>
                      </View>

                      {/* ESTADO */}

                      <View
                        style={
                          styles.notificacionPie
                        }
                      >
                        <Text
                          style={
                            styles.notificacionPieTexto
                          }
                        >
                          {leida
                            ? "Esta notificación ya fue revisada."
                            : "Esta notificación está pendiente de revisión."}
                        </Text>

                        {!leida && (
                          <Pressable
                            style={
                              styles.botonPrincipal
                            }
                            disabled={
                              marcando ===
                              notificacion.id
                            }
                            onPress={() =>
                              marcarLeida(
                                notificacion.id
                              )
                            }
                          >
                            <Text
                              style={
                                styles.botonPrincipalTexto
                              }
                            >
                              {marcando ===
                              notificacion.id
                                ? "Actualizando..."
                                : "Marcar como leída"}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                }
              )}
            </>
          )}

        {/* ============================================ */}
        {/* AUDITORÍA                                   */}
        {/* ============================================ */}

        {!cargando &&
          !error &&
          pestana === "auditoria" && (
            <>
              <View style={styles.banner}>
                <Text
                  style={
                    styles.bannerEtiqueta
                  }
                >
                  SEGUIMIENTO
                </Text>

                <Text
                  style={
                    styles.bannerTitulo
                  }
                >
                  Auditoría del sistema
                </Text>

                <Text
                  style={
                    styles.bannerDescripcion
                  }
                >
                  Historial de actividades
                  realizadas por los usuarios.
                </Text>
              </View>

              <Text
                style={styles.seccionTitulo}
              >
                Eventos registrados (
                {registros.length})
              </Text>

              {registros.length === 0 && (
                <View
                  style={
                    styles.vacioContenedor
                  }
                >
                  <Text
                    style={
                      styles.vacioTexto
                    }
                  >
                    No hay eventos disponibles.
                  </Text>
                </View>
              )}

              {registros.map(
                (evento) => (
                  <View
                    key={evento.id}
                    style={styles.tarjeta}
                  >
                    <Text
                      style={
                        styles.tarjetaTitulo
                      }
                    >
                      {obtener(
                        evento,
                        ["accion"],
                        "Evento"
                      )}
                    </Text>

                    <Text
                      style={
                        styles.tarjetaDato
                      }
                    >
                      Usuario:{" "}
                      {obtener(
                        evento,
                        ["usuarioNombre"],
                        "Nombre no disponible"
                      )}
                    </Text>

                    {evento.entidad && (
                      <Text
                        style={
                          styles.tarjetaDato
                        }
                      >
                        Entidad:{" "}
                        {texto(
                          evento.entidad
                        )}
                      </Text>
                    )}

                    {evento.detalle && (
                      <Text
                        style={
                          styles.tarjetaDato
                        }
                      >
                        Detalle:{" "}
                        {texto(
                          evento.detalle
                        )}
                      </Text>
                    )}

                    <Text
                      style={
                        styles.tarjetaDato
                      }
                    >
                      Fecha:{" "}
                      {fecha(
                        evento.fecha
                      )}
                    </Text>
                  </View>
                )
              )}
            </>
          )}
      </ScrollView>
    </View>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 60,
  },

  encabezado: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
  },

  encabezadoTexto: {
    flex: 1,
    minWidth: 220,
  },

  sobretitulo: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  titulo: {
    fontSize: 25,
    fontWeight: "800",
    color: "#16345C",
    marginBottom: 8,
  },

  subtitulo: {
    fontSize: 14,
    lineHeight: 22,
    color: "#64748B",
  },

  botonVolver: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },

  botonVolverTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  navegacion: {
    marginBottom: 16,
    flexGrow: 0,
  },

  pestana: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 9,
  },

  pestanaActiva: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  pestanaTexto: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },

  pestanaTextoActivo: {
    color: "#FFFFFF",
  },

  barraAcciones: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  barraTitulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#16345C",
  },

  botonActualizar: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
  },

  actualizarTexto: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },

  cargando: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 35,
    alignItems: "center",
  },

  cargandoTexto: {
    color: "#64748B",
    marginTop: 12,
  },

  error: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginBottom: 18,
  },

  errorTitulo: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 7,
  },

  errorTexto: {
    color: "#991B1B",
    fontSize: 13,
  },

  banner: {
    backgroundColor: "#19385F",
    padding: 24,
    borderRadius: 18,
    marginBottom: 18,
  },

  bannerResultados: {
    backgroundColor: "#19385F",
    padding: 24,
    borderRadius: 18,
    marginBottom: 18,
  },

  bannerNotificaciones: {
    backgroundColor: "#19385F",
    padding: 24,
    borderRadius: 18,
    marginBottom: 18,
  },

  bannerEtiqueta: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  bannerTitulo: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },

  bannerDescripcion: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 21,
  },

  metricas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  metrica: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 135,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  metricaLinea: {
    width: 30,
    height: 5,
    borderRadius: 10,
    marginBottom: 14,
  },

  metricaTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 10,
  },

  metricaValor: {
    fontSize: 27,
    fontWeight: "800",
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  },

  panelTitulo: {
    fontSize: 18,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 7,
  },

  panelDescripcion: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },

  tipos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 16,
  },

  tipoBoton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  tipoActivo: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  tipoTexto: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },

  tipoTextoActivo: {
    color: "#FFFFFF",
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: "#F8FAFC",
    color: "#19385F",
    fontSize: 14,
    marginBottom: 15,
  },

  filtroTitulo: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
  },

  filtroBoton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  filtroActivo: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  filtroTexto: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },

  filtroTextoActivo: {
    color: "#FFFFFF",
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 15,
    marginTop: 5,
  },

  resultadoCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 15,
    padding: 18,
    marginBottom: 14,
  },

  resultadoSuperior: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 15,
  },

  resultadoPaciente: {
    fontSize: 17,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 5,
  },

  resultadoAnalisis: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  etiqueta: {
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },

  etiquetaTexto: {
    fontSize: 11,
    fontWeight: "800",
  },

  resultadoDatos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  datoCaja: {
    flexGrow: 1,
    flexBasis: 125,
    backgroundColor: "#F1F5F9",
    borderRadius: 9,
    padding: 12,
  },

  datoEtiqueta: {
    color: "#64748B",
    fontSize: 11,
    marginBottom: 7,
  },

  datoValor: {
    color: "#19385F",
    fontSize: 13,
    fontWeight: "800",
  },

  resultadoFecha: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 15,
  },

  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    padding: 18,
    marginBottom: 13,
  },

  tarjetaTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 12,
  },

  tarjetaDato: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 9,
    lineHeight: 19,
  },

  botonPrincipal: {
    backgroundColor: "#2563EB",
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "flex-start",
    marginTop: 10,
  },

  botonPrincipalTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  vacioContenedor: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 15,
    padding: 30,
    alignItems: "center",
    marginBottom: 15,
  },

  vacioTitulo: {
    color: "#19385F",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 9,
  },

  vacioTexto: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // ====================================================
  // ESTILOS DE NOTIFICACIONES
  // ====================================================

  notificacionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },

  notificacionPendiente: {
    borderLeftWidth: 5,
    borderLeftColor: "#F59E0B",
  },

  notificacionCabecera: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },

  iconoNotificacion: {
    width: 45,
    height: 45,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  iconoNotificacionTexto: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2563EB",
  },

  notificacionTitulo: {
    color: "#19385F",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 5,
  },

  notificacionTipo: {
    color: "#64748B",
    fontSize: 12,
  },

  estadoNotificacion: {
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  estadoNotificacionTexto: {
    fontSize: 10,
    fontWeight: "800",
  },

  notificacionMensaje: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 23,
    marginBottom: 18,
  },

  codigoMuestraCaja: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 11,
    padding: 14,
    marginBottom: 16,
  },

  codigoMuestraEtiqueta: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginBottom: 7,
  },

  codigoMuestraValor: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "800",
  },

  detalleNotificacion: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 12,
    padding: 14,
  },

  detalleNotificacionTitulo: {
    color: "#19385F",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 13,
  },

  detalleNotificacionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  notificacionPie: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 14,
    marginTop: 16,
  },

  notificacionPieTexto: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 19,
  },
});