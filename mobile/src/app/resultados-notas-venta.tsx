import React, {
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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

import { onAuthStateChanged } from "firebase/auth";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { auth, db } from "../firebase/firebase";

// ======================================================
// TIPOS
// ======================================================

type Registro = {
  id: string;
  [key: string]: any;
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
  valor: string;
  rango: string;
};

type DetalleResultado = {
  resultado: Registro;
  analisis: Registro | null;
  muestra: Registro | null;
  parametros: Parametro[];
  validador: string;
};

type ModalActual =
  | {
      tipo: "resultado";
      registro: Registro;
    }
  | {
      tipo: "venta";
      registro: Registro;
    }
  | null;

// ======================================================
// UTILIDADES
// ======================================================

const convertirTexto = (valor: any): string => {
  if (valor === undefined || valor === null) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor).trim();
};

const obtenerCampo = (
  objeto: any,
  campos: string[],
  defecto = "No registrado"
): string => {
  if (!objeto) return defecto;

  for (const nombre of campos) {
    const valor = objeto[nombre];

    if (
      valor !== undefined &&
      valor !== null &&
      typeof valor !== "object" &&
      String(valor).trim() !== ""
    ) {
      return String(valor).trim();
    }
  }

  return defecto;
};

const normalizar = (valor: any): string =>
  convertirTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const convertirFecha = (valor: any): Date | null => {
  if (!valor) return null;

  try {
    let resultado: Date;

    if (typeof valor.toDate === "function") {
      resultado = valor.toDate();
    } else if (
      typeof valor === "object" &&
      typeof valor.seconds === "number"
    ) {
      resultado = new Date(valor.seconds * 1000);
    } else {
      resultado = new Date(valor);
    }

    return Number.isNaN(resultado.getTime())
      ? null
      : resultado;
  } catch {
    return null;
  }
};

const mostrarFecha = (valor: any): string => {
  const fecha = convertirFecha(valor);

  return fecha
    ? fecha.toLocaleString("es-BO")
    : "No registrada";
};

const fechaRegistro = (registro: any): string =>
  mostrarFecha(
    registro?.fechaRegistro ??
      registro?.fechaCreacion ??
      registro?.fechaVenta ??
      registro?.createdAt ??
      registro?.fecha
  );

const nombrePaciente = (datos: any): string => {
  const completo = obtenerCampo(
    datos,
    ["nombreCompleto"],
    ""
  );

  if (completo) return completo;

  const nombres = obtenerCampo(
    datos,
    ["nombres", "nombre"],
    ""
  );

  const apellidos = obtenerCampo(
    datos,
    ["apellidos", "apellido"],
    ""
  );

  return (
    `${nombres} ${apellidos}`.trim() ||
    "Paciente sin nombre"
  );
};

const nombreAnalisis = (datos: any): string =>
  obtenerCampo(
    datos,
    [
      "nombreAnalisis",
      "analisisNombre",
      "nombre",
      "tipoAnalisis",
      "analisis",
    ],
    "Análisis clínico"
  );

const estadoResultado = (datos: any): string => {
  if (datos?.validado === true) {
    return "validado";
  }

  return obtenerCampo(
    datos,
    ["estado", "estadoResultado"],
    "pendiente"
  );
};

const convertirNumero = (valor: any): number => {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  const cadena = convertirTexto(valor)
    .replace(/[^\d,.-]/g, "");

  if (!cadena) return 0;

  let normalizado = cadena;

  if (
    cadena.includes(",") &&
    cadena.includes(".")
  ) {
    normalizado =
      cadena.lastIndexOf(",") >
      cadena.lastIndexOf(".")
        ? cadena.replace(/\./g, "").replace(",", ".")
        : cadena.replace(/,/g, "");
  } else {
    normalizado = cadena.replace(",", ".");
  }

  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : 0;
};

const moneda = (valor: any): string =>
  `Bs ${convertirNumero(valor).toFixed(2).replace(".", ",")}`;

const mostrarError = (
  titulo: string,
  mensaje: string
) => {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined"
  ) {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
};

const escaparHTML = (valor: any): string =>
  convertirTexto(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ======================================================
// FIRESTORE
// ======================================================

async function leerDocumento(
  coleccionNombre: string,
  id: string
): Promise<Registro | null> {
  if (!id) return null;

  try {
    const referencia = doc(
      db,
      coleccionNombre,
      id
    );

    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      return null;
    }

    return {
      id: documento.id,
      ...documento.data(),
    };
  } catch {
    return null;
  }
}

async function leerDocumentoVariasColecciones(
  nombres: string[],
  id: string
): Promise<Registro | null> {
  for (const nombre of nombres) {
    const documento = await leerDocumento(
      nombre,
      id
    );

    if (documento) {
      return documento;
    }
  }

  return null;
}

async function consultarColeccion(
  nombre: string,
  laboratorioId: string
): Promise<Registro[]> {
  const consulta = query(
    collection(db, nombre),
    where("laboratorioId", "==", laboratorioId)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  }));
}

const pertenecePaciente = (
  registro: Registro,
  pacienteId: string
): boolean => {
  const posibles = [
    registro.pacienteId,
    registro.idPaciente,
    registro.paciente?.id,
  ];

  return posibles.some(
    (valor) => convertirTexto(valor) === pacienteId
  );
};

const ordenarRegistros = (
  registros: Registro[]
): Registro[] => {
  const obtenerTiempo = (registro: Registro) =>
    convertirFecha(
      registro.fechaRegistro ??
        registro.fechaValidacion ??
        registro.fechaVenta ??
        registro.createdAt ??
        registro.fecha
    )?.getTime() ?? 0;

  return [...registros].sort(
    (a, b) => obtenerTiempo(b) - obtenerTiempo(a)
  );
};

// ======================================================
// RANGOS DE REFERENCIA
// ======================================================

const RANGOS_DIRECTOS = [
  "rangoReferencia",
  "rango_referencia",
  "rangoDeReferencia",
  "rango",
  "referencia",
  "referenceRange",
  "rangoNormal",
  "valorReferencia",
  "valoresReferencia",
  "intervaloReferencia",
  "intervalo",
  "valorNormal",
  "valoresNormales",
  "rangoReferencial",
  "rango_referencial",
  "reference",
];

const MINIMOS = [
  "minimo",
  "mínimo",
  "valorMinimo",
  "valorMínimo",
  "rangoMinimo",
  "rangoMínimo",
  "limiteInferior",
  "límiteInferior",
  "referenciaMinima",
  "referenciaMínima",
  "min",
  "desde",
  "inferior",
  "referenceMin",
  "normalMin",
];

const MAXIMOS = [
  "maximo",
  "máximo",
  "valorMaximo",
  "valorMáximo",
  "rangoMaximo",
  "rangoMáximo",
  "limiteSuperior",
  "límiteSuperior",
  "referenciaMaxima",
  "referenciaMáxima",
  "max",
  "hasta",
  "superior",
  "referenceMax",
  "normalMax",
];

function rangoEsValido(valor: any): boolean {
  const cadena = normalizar(valor);

  return (
    cadena !== "" &&
    cadena !== "no configurado" &&
    cadena !== "no registrada" &&
    cadena !== "no registrado" &&
    cadena !== "sin rango" &&
    cadena !== "n/a" &&
    cadena !== "null" &&
    cadena !== "undefined"
  );
}

function buscarValor(
  objeto: any,
  campos: string[]
): any {
  if (!objeto || typeof objeto !== "object") {
    return undefined;
  }

  for (const nombre of campos) {
    const valor = objeto[nombre];

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

function extraerRango(
  objeto: any,
  profundidad = 0
): string {
  if (
    !objeto ||
    typeof objeto !== "object" ||
    profundidad > 4
  ) {
    return "No configurado";
  }

  // Rango escrito directamente.
  const directo = buscarValor(
    objeto,
    RANGOS_DIRECTOS
  );

  if (
    typeof directo === "string" ||
    typeof directo === "number"
  ) {
    if (rangoEsValido(directo)) {
      return convertirTexto(directo);
    }
  }

  // Rango almacenado como objeto.
  if (
    directo &&
    typeof directo === "object" &&
    !Array.isArray(directo)
  ) {
    const interno = extraerRango(
      directo,
      profundidad + 1
    );

    if (rangoEsValido(interno)) {
      return interno;
    }
  }

  // Rango almacenado como límites.
  const minimo = buscarValor(objeto, MINIMOS);
  const maximo = buscarValor(objeto, MAXIMOS);

  const tieneMinimo =
    minimo !== undefined &&
    minimo !== null &&
    convertirTexto(minimo) !== "";

  const tieneMaximo =
    maximo !== undefined &&
    maximo !== null &&
    convertirTexto(maximo) !== "";

  if (tieneMinimo && tieneMaximo) {
    return `${convertirTexto(minimo)} - ${convertirTexto(maximo)}`;
  }

  if (tieneMinimo) {
    return `Desde ${convertirTexto(minimo)}`;
  }

  if (tieneMaximo) {
    return `Hasta ${convertirTexto(maximo)}`;
  }

  // Revisar objetos anidados relacionados con rangos.
  const objetosAnidados = [
    "referencia",
    "rangos",
    "rangoNormal",
    "valoresNormales",
    "limites",
    "límites",
    "configuracion",
    "configuración",
    "valoresReferencia",
  ];

  for (const nombre of objetosAnidados) {
    const anidado = objeto[nombre];

    if (
      anidado &&
      typeof anidado === "object" &&
      !Array.isArray(anidado)
    ) {
      const resultado = extraerRango(
        anidado,
        profundidad + 1
      );

      if (rangoEsValido(resultado)) {
        return resultado;
      }
    }
  }

  return "No configurado";
}

// ======================================================
// CONVERSIÓN DE PARÁMETROS
// ======================================================

function convertirParametro(
  dato: any,
  nombreAlternativo = "Parámetro"
): Parametro {
  if (
    dato === null ||
    typeof dato !== "object"
  ) {
    return {
      id: "",
      nombre: nombreAlternativo,
      unidad: "No registrada",
      valor: convertirTexto(dato) || "No registrado",
      rango: "No configurado",
    };
  }

  return {
    id: obtenerCampo(
      dato,
      ["id", "parametroId", "idParametro"],
      ""
    ),

    nombre: obtenerCampo(
      dato,
      [
        "nombre",
        "nombreParametro",
        "parametro",
        "descripcion",
      ],
      nombreAlternativo
    ),

    unidad: obtenerCampo(
      dato,
      [
        "unidad",
        "unidadMedida",
        "unidad_medida",
      ],
      "No registrada"
    ),

    valor: obtenerCampo(
      dato,
      [
        "valor",
        "resultado",
        "valorRegistrado",
        "valorResultado",
      ]
    ),

    rango: extraerRango(dato),
  };
}

function extraerParametros(
  registro: any
): Parametro[] {
  if (!registro) return [];

  const campos = [
    "parametros",
    "parámetros",
    "parametrosAnalisis",
    "parametrosConfigurados",
    "parametrosResultado",
    "resultadosParametros",
    "valoresParametros",
    "detalleParametros",
    "detalleResultados",
    "valores",
  ];

  for (const nombre of campos) {
    const contenido = registro[nombre];

    if (
      Array.isArray(contenido) &&
      contenido.length > 0
    ) {
      return contenido.map((item, indice) =>
        convertirParametro(
          item,
          `Parámetro ${indice + 1}`
        )
      );
    }

    if (
      contenido &&
      typeof contenido === "object" &&
      !Array.isArray(contenido)
    ) {
      return Object.entries(contenido).map(
        ([nombreParametro, valor]) =>
          convertirParametro(
            valor,
            nombreParametro
          )
      );
    }
  }

  return [];
}

function unirParametros(
  listas: Parametro[][]
): Parametro[] {
  const mapa = new Map<string, Parametro>();

  for (const lista of listas) {
    for (const parametro of lista) {
      const clave =
        parametro.id ||
        normalizar(parametro.nombre);

      const anterior = mapa.get(clave);

      if (!anterior) {
        mapa.set(clave, parametro);
        continue;
      }

      mapa.set(clave, {
        id: parametro.id || anterior.id,
        nombre:
          parametro.nombre || anterior.nombre,

        unidad:
          parametro.unidad !== "No registrada"
            ? parametro.unidad
            : anterior.unidad,

        valor:
          parametro.valor !== "No registrado"
            ? parametro.valor
            : anterior.valor,

        rango: rangoEsValido(parametro.rango)
          ? parametro.rango
          : anterior.rango,
      });
    }
  }

  return Array.from(mapa.values());
}

// ======================================================
// BÚSQUEDA DE RANGOS EN FIRESTORE
// ======================================================

async function buscarParametrosFirestore(
  laboratorioId: string,
  analisisId: string
): Promise<Parametro[]> {
  const colecciones = [
    "parametros",
    "parametrosAnalisis",
    "parametros_analisis",
  ];

  const encontrados: Parametro[] = [];

  for (const nombreColeccion of colecciones) {
    try {
      const registros = await consultarColeccion(
        nombreColeccion,
        laboratorioId
      );

      for (const registro of registros) {
        const relacionado = [
          registro.analisisId,
          registro.idAnalisis,
          registro.analisis?.id,
        ].some(
          (valor) =>
            analisisId !== "" &&
            convertirTexto(valor) === analisisId
        );

        if (relacionado) {
          encontrados.push(
            convertirParametro(registro)
          );
        }
      }
    } catch {
      // No todas las instalaciones utilizan
      // estas colecciones.
    }
  }

  return encontrados;
}

// ======================================================
// BUSCAR RANGOS POR NOMBRE E IDENTIFICADOR
// ======================================================

function completarRangos(
  parametros: Parametro[],
  configurados: Parametro[]
): Parametro[] {
  return parametros.map((parametro) => {
    if (rangoEsValido(parametro.rango)) {
      return parametro;
    }

    const coincidencia = configurados.find(
      (configurado) => {
        const mismoId =
          parametro.id !== "" &&
          configurado.id !== "" &&
          parametro.id === configurado.id;

        const mismoNombre =
          normalizar(parametro.nombre) ===
          normalizar(configurado.nombre);

        return mismoId || mismoNombre;
      }
    );

    if (
      coincidencia &&
      rangoEsValido(coincidencia.rango)
    ) {
      return {
        ...parametro,
        rango: coincidencia.rango,
      };
    }

    return parametro;
  });
}

// ======================================================
// NOTAS DE VENTA
// ======================================================

type ItemVenta = {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
};

function obtenerItemsVenta(
  venta: Registro
): ItemVenta[] {
  const opciones = [
    venta.detalles,
    venta.items,
    venta.analisisVendidos,
    venta.detalleVenta,
    venta.analisis,
  ];

  const items = opciones.find(
    (opcion) =>
      Array.isArray(opcion) &&
      opcion.length > 0
  );

  if (!items) {
    const total = convertirNumero(
      venta.total ??
        venta.montoTotal ??
        venta.precio
    );

    return [
      {
        nombre: nombreAnalisis(venta),
        cantidad: 1,
        precio: total,
        subtotal: total,
      },
    ];
  }

  return items.map((item: any) => {
    const cantidad =
      convertirNumero(item.cantidad ?? 1) || 1;

    const precio = convertirNumero(
      item.precioUnitario ??
        item.precio ??
        0
    );

    return {
      nombre:
        typeof item === "string"
          ? item
          : nombreAnalisis(item),

      cantidad,
      precio,

      subtotal: convertirNumero(
        item.subtotal ?? cantidad * precio
      ),
    };
  });
}

function obtenerTotalVenta(
  venta: Registro
): number {
  if (
    venta.total !== undefined &&
    venta.total !== null
  ) {
    return convertirNumero(venta.total);
  }

  if (
    venta.montoTotal !== undefined &&
    venta.montoTotal !== null
  ) {
    return convertirNumero(venta.montoTotal);
  }

  return obtenerItemsVenta(venta).reduce(
    (total, item) => total + item.subtotal,
    0
  );
}

// ======================================================
// COMPONENTES VISUALES
// ======================================================

function Boton({
  titulo,
  onPress,
  secundario = false,
  disabled = false,
}: {
  titulo: string;
  onPress: () => void;
  secundario?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.boton,
        secundario && styles.botonSecundario,
        disabled && styles.botonDeshabilitado,
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          secundario && styles.botonTextoSecundario,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>
        {titulo}
      </Text>

      {children}
    </View>
  );
}

function Campo({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoEtiqueta}>
        {etiqueta}
      </Text>

      <Text style={styles.campoValor}>
        {valor || "No registrado"}
      </Text>
    </View>
  );
}

function Fila({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View style={styles.filaCampos}>
      {children}
    </View>
  );
}

// ======================================================
// TABLA DE PARÁMETROS
// ======================================================

function TablaParametros({
  parametros,
}: {
  parametros: Parametro[];
}) {
  if (parametros.length === 0) {
    return (
      <Text style={styles.sinDatos}>
        No hay parámetros registrados.
      </Text>
    );
  }

  return (
    <ScrollView horizontal>
      <View style={styles.tablaParametros}>
        <View style={styles.tablaEncabezado}>
          <Text style={styles.columnaNombre}>
            Parámetro
          </Text>

          <Text style={styles.columnaUnidad}>
            Unidad
          </Text>

          <Text style={styles.columnaRango}>
            Rango de referencia
          </Text>
        </View>

        {parametros.map((parametro, indice) => (
          <View
            key={`${parametro.id}-${indice}`}
            style={styles.tablaFila}
          >
            <Text style={styles.columnaNombre}>
              {parametro.nombre}
            </Text>

            <Text style={styles.columnaUnidad}>
              {parametro.unidad}
            </Text>

            <Text style={styles.columnaRango}>
              {parametro.rango}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ======================================================
// TABLA DE VENTA
// ======================================================

function TablaVenta({
  items,
}: {
  items: ItemVenta[];
}) {
  return (
    <ScrollView horizontal>
      <View style={styles.tablaVenta}>
        <View style={styles.tablaEncabezado}>
          <Text style={styles.columnaVenta}>
            Análisis
          </Text>

          <Text style={styles.columnaVenta}>
            Cantidad
          </Text>

          <Text style={styles.columnaVenta}>
            Precio
          </Text>

          <Text style={styles.columnaVenta}>
            Subtotal
          </Text>
        </View>

        {items.map((item, indice) => (
          <View
            key={indice}
            style={styles.tablaFila}
          >
            <Text style={styles.columnaVenta}>
              {item.nombre}
            </Text>

            <Text style={styles.columnaVenta}>
              {item.cantidad}
            </Text>

            <Text style={styles.columnaVenta}>
              {moneda(item.precio)}
            </Text>

            <Text style={styles.columnaVenta}>
              {moneda(item.subtotal)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ======================================================
// HTML DEL PDF
// ======================================================

function construirHTML(
  tipo: "resultado" | "venta",
  registro: Registro,
  paciente: Paciente,
  detalle: DetalleResultado | null
): string {
  let contenido = "";

  if (tipo === "venta") {
    const items = obtenerItemsVenta(registro);

    const filas = items
      .map(
        (item) => `
          <tr>
            <td>${escaparHTML(item.nombre)}</td>
            <td>${item.cantidad}</td>
            <td>${moneda(item.precio)}</td>
            <td>${moneda(item.subtotal)}</td>
          </tr>
        `
      )
      .join("");

    contenido = `
      <h2>NOTA DE VENTA</h2>

      <section>
        <h3>Información de venta</h3>
        <p><b>Paciente:</b> ${escaparHTML(paciente.nombre)}</p>
        <p><b>CI:</b> ${escaparHTML(paciente.ci)}</p>
        <p><b>Fecha:</b> ${escaparHTML(fechaRegistro(registro))}</p>
        <p><b>Total:</b> ${moneda(obtenerTotalVenta(registro))}</p>
      </section>

      <section>
        <h3>Detalle de análisis vendidos</h3>

        <table>
          <thead>
            <tr>
              <th>Análisis</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>

          <tbody>${filas}</tbody>
        </table>
      </section>
    `;
  } else {
    const resultado =
      detalle?.resultado ?? registro;

    const analisis = detalle?.analisis;
    const muestra = detalle?.muestra;

    const parametros = detalle?.parametros ?? [];

    const filas = parametros
      .map(
        (parametro) => `
          <tr>
            <td>${escaparHTML(parametro.nombre)}</td>
            <td>${escaparHTML(parametro.unidad)}</td>
            <td>${escaparHTML(parametro.rango)}</td>
          </tr>
        `
      )
      .join("");

    contenido = `
      <h2>RESULTADO CLÍNICO</h2>

      <section>
        <h3>1. Información del paciente</h3>
        <p><b>Paciente:</b> ${escaparHTML(paciente.nombre)}</p>
        <p><b>CI:</b> ${escaparHTML(paciente.ci)}</p>
      </section>

      <section>
        <h3>2. Información del análisis</h3>
        <p><b>Análisis:</b> ${escaparHTML(nombreAnalisis(resultado))}</p>
        <p><b>Descripción:</b> ${escaparHTML(
          obtenerCampo(
            analisis,
            ["descripcion", "descripcionAnalisis"]
          )
        )}</p>
      </section>

      <section>
        <h3>3. Información de la muestra</h3>
        <p><b>Tipo:</b> ${escaparHTML(
          obtenerCampo(muestra, ["tipoMuestra", "tipo"])
        )}</p>
        <p><b>Estado:</b> ${escaparHTML(
          obtenerCampo(muestra, ["estadoMuestra", "estado"])
        )}</p>
        <p><b>Fecha de toma:</b> ${escaparHTML(
          mostrarFecha(muestra?.fechaToma)
        )}</p>
      </section>

      <section>
        <h3>4. Resultado clínico</h3>
        <p><b>Valor:</b> ${escaparHTML(
          obtenerCampo(resultado, [
            "valorResultado",
            "resultado",
            "valor",
          ])
        )}</p>
        <p><b>Unidad:</b> ${escaparHTML(
          obtenerCampo(resultado, ["unidad", "unidadMedida"])
        )}</p>
        <p><b>Estado:</b> ${escaparHTML(
          estadoResultado(resultado)
        )}</p>
        <p><b>Observaciones:</b> ${escaparHTML(
          obtenerCampo(resultado, [
            "observaciones",
            "observacion",
          ])
        )}</p>
      </section>

      <section>
        <h3>5. Valores de los parámetros</h3>

        <table>
          <thead>
            <tr>
              <th>Parámetro</th>
              <th>Unidad</th>
              <th>Rango de referencia</th>
            </tr>
          </thead>

          <tbody>${filas}</tbody>
        </table>
      </section>

      <section>
        <h3>6. Validación del resultado</h3>
        <p><b>Estado:</b> ${escaparHTML(
          estadoResultado(resultado)
        )}</p>
        <p><b>Validado por:</b> ${escaparHTML(
          detalle?.validador ?? "No registrado"
        )}</p>
        <p><b>Fecha:</b> ${escaparHTML(
          mostrarFecha(resultado.fechaValidacion)
        )}</p>
      </section>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">

        <style>
          @page {
            size: A4;
            margin: 18mm;
          }

          body {
            font-family: Arial, sans-serif;
            color: #17345B;
            font-size: 12px;
          }

          header {
            background: #19385F;
            color: white;
            padding: 20px;
            margin-bottom: 20px;
          }

          h1 {
            margin: 0;
          }

          h2 {
            border-bottom: 2px solid #2563EB;
            padding-bottom: 10px;
          }

          section {
            border: 1px solid #D6E4F5;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            border: 1px solid #D6E4F5;
            padding: 9px;
            text-align: left;
          }

          th {
            background: #E8F0FC;
          }
        </style>
      </head>

      <body>
        <header>
          <h1>LABORATORIO CLÍNICO</h1>
        </header>

        ${contenido}
      </body>
    </html>
  `;
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ResultadosNotasVenta() {
  const router = useRouter();

  const { width } = useWindowDimensions();

  const pantallaPequena = width < 620;

  const [laboratorioId, setLaboratorioId] =
    useState("");

  const [pacientes, setPacientes] =
    useState<Paciente[]>([]);

  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<Paciente | null>(null);

  const [resultados, setResultados] =
    useState<Registro[]>([]);

  const [ventas, setVentas] =
    useState<Registro[]>([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [modal, setModal] =
    useState<ModalActual>(null);

  const [detalleResultado, setDetalleResultado] =
    useState<DetalleResultado | null>(null);

  const [cargando, setCargando] =
    useState(true);

  const [cargandoPaciente, setCargandoPaciente] =
    useState(false);

  const [cargandoModal, setCargandoModal] =
    useState(false);

  const [generandoPDF, setGenerandoPDF] =
    useState(false);

  const [error, setError] =
    useState("");

  // ====================================================
  // AUTENTICACIÓN
  // ====================================================

  useEffect(() => {
    let activo = true;

    const cancelar = onAuthStateChanged(
      auth,
      async (usuarioFirebase) => {
        if (!usuarioFirebase) {
          if (activo) {
            setCargando(false);
            setError("Debes iniciar sesión.");
          }

          return;
        }

        try {
          setCargando(true);

          const referencia = doc(
            db,
            "usuarios",
            usuarioFirebase.uid
          );

          const documento = await getDoc(referencia);

          if (!documento.exists()) {
            throw new Error(
              "No se encontró el usuario."
            );
          }

          const datos = documento.data();

          const id = convertirTexto(
            datos.laboratorioId
          );

          if (!id) {
            throw new Error(
              "No tienes un laboratorio asignado."
            );
          }

          const registros = await consultarColeccion(
            "pacientes",
            id
          );

          const lista = registros.map((registro) => ({
            id: registro.id,
            nombre: nombrePaciente(registro),
            ci: obtenerCampo(
              registro,
              ["ci", "carnetIdentidad"],
              ""
            ),
          }));

          lista.sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es")
          );

          if (!activo) return;

          setLaboratorioId(id);
          setPacientes(lista);
          setError("");
        } catch (e) {
          if (activo) {
            setError(
              e instanceof Error
                ? e.message
                : "Error al cargar pacientes."
            );
          }
        } finally {
          if (activo) setCargando(false);
        }
      }
    );

    return () => {
      activo = false;
      cancelar();
    };
  }, []);

  // ====================================================
  // FILTRAR PACIENTES
  // ====================================================

  const pacientesFiltrados = useMemo(() => {
    const termino = normalizar(busqueda);

    if (!termino) {
      return pacientes;
    }

    return pacientes.filter((paciente) =>
      normalizar(
        `${paciente.nombre} ${paciente.ci}`
      ).includes(termino)
    );
  }, [pacientes, busqueda]);

  // ====================================================
  // SELECCIONAR PACIENTE
  // ====================================================

  const seleccionarPaciente = async (
    paciente: Paciente
  ) => {
    setPacienteSeleccionado(paciente);
    setCargandoPaciente(true);
    setResultados([]);
    setVentas([]);

    try {
      const [listaResultados, listaVentas] =
        await Promise.all([
          consultarColeccion(
            "resultados",
            laboratorioId
          ),

          consultarColeccion(
            "ventas",
            laboratorioId
          ),
        ]);

      setResultados(
        ordenarRegistros(
          listaResultados.filter((registro) =>
            pertenecePaciente(
              registro,
              paciente.id
            )
          )
        )
      );

      setVentas(
        ordenarRegistros(
          listaVentas.filter((registro) =>
            pertenecePaciente(
              registro,
              paciente.id
            )
          )
        )
      );
    } catch (e) {
      mostrarError(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudieron cargar los registros."
      );
    } finally {
      setCargandoPaciente(false);
    }
  };

  // ====================================================
  // ABRIR RESULTADO
  // ====================================================

  const abrirResultado = async (
    resultado: Registro
  ) => {
    setModal({
      tipo: "resultado",
      registro: resultado,
    });

    setDetalleResultado(null);
    setCargandoModal(true);

    try {
      const analisisId = convertirTexto(
        resultado.analisisId ??
          resultado.idAnalisis
      );

      const muestraId = convertirTexto(
        resultado.muestraId ??
          resultado.idMuestra
      );

      const [analisis, muestra] =
        await Promise.all([
          leerDocumentoVariasColecciones(
            ["analisis", "analisisClinicos"],
            analisisId
          ),

          leerDocumento(
            "muestras",
            muestraId
          ),
        ]);

      const parametrosResultado =
        extraerParametros(resultado);

      const parametrosAnalisis =
        extraerParametros(analisis);

      const parametrosMuestra =
        extraerParametros(muestra);

      // Buscar parámetros configurados en Firestore.
      const parametrosConfigurados =
        await buscarParametrosFirestore(
          laboratorioId,
          analisisId
        );

      // Unir los parámetros que vienen de las
      // distintas fuentes del sistema.
      const combinados = unirParametros([
        parametrosConfigurados,
        parametrosAnalisis,
        parametrosMuestra,
        parametrosResultado,
      ]);

      // Completar rangos mediante nombre o ID.
      const parametrosFinales = completarRangos(
        combinados,
        [
          ...parametrosConfigurados,
          ...parametrosAnalisis,
          ...parametrosMuestra,
        ]
      );

      // ==================================================
      // VALIDACIÓN
      // ==================================================

      const validadorId = convertirTexto(
        resultado.validadoPor ??
          resultado.bioquimicoId ??
          resultado.usuarioValidadorId
      );

      let validador = obtenerCampo(
        resultado,
        [
          "validadoPorNombre",
          "bioquimicoNombre",
          "nombreValidador",
        ],
        ""
      );

      if (!validador && validadorId) {
        const usuario = await leerDocumento(
          "usuarios",
          validadorId
        );

        if (usuario) {
          validador = nombrePaciente(usuario);
        }
      }

      setDetalleResultado({
        resultado,
        analisis,
        muestra,
        parametros: parametrosFinales,
        validador: validador || "No registrado",
      });
    } catch (e) {
      mostrarError(
        "Error",
        e instanceof Error
          ? e.message
          : "No se pudo cargar el resultado."
      );

      setDetalleResultado({
        resultado,
        analisis: null,
        muestra: null,
        parametros: extraerParametros(resultado),
        validador: "No registrado",
      });
    } finally {
      setCargandoModal(false);
    }
  };

  // ====================================================
  // PDF
  // ====================================================

  const generarPDF = async (
    tipo: "resultado" | "venta",
    registro: Registro
  ) => {
    if (!pacienteSeleccionado || generandoPDF) {
      return;
    }

    try {
      setGenerandoPDF(true);

      const html = construirHTML(
        tipo,
        registro,
        pacienteSeleccionado,
        tipo === "resultado"
          ? detalleResultado
          : null
      );

      if (Platform.OS === "web") {
        if (typeof window === "undefined") {
          throw new Error(
            "El navegador no está disponible."
          );
        }

        const ventana = window.open("", "_blank");

        if (!ventana) {
          throw new Error(
            "El navegador bloqueó la ventana emergente."
          );
        }

        ventana.document.open();
        ventana.document.write(html);
        ventana.document.close();

        let impreso = false;

        const imprimir = () => {
          if (impreso || ventana.closed) return;

          impreso = true;
          ventana.focus();
          ventana.print();
        };

        ventana.addEventListener(
          "load",
          imprimir,
          { once: true }
        );

        setTimeout(imprimir, 700);

        return;
      }

      const archivo = await Print.printToFileAsync({
        html,
      });

      if (!archivo.uri) {
        throw new Error(
          "No se pudo generar el PDF."
        );
      }

      const disponible =
        await Sharing.isAvailableAsync();

      if (disponible) {
        await Sharing.shareAsync(archivo.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Guardar PDF",
          UTI: "com.adobe.pdf",
        });
      } else {
        mostrarError(
          "PDF generado",
          archivo.uri
        );
      }
    } catch (e) {
      mostrarError(
        "Error al generar PDF",
        e instanceof Error
          ? e.message
          : "No se pudo generar el PDF."
      );
    } finally {
      setGenerandoPDF(false);
    }
  };

  // ====================================================
  // VOLVER
  // ====================================================

  const volverPacientes = () => {
    setPacienteSeleccionado(null);
    setResultados([]);
    setVentas([]);
    setModal(null);
    setDetalleResultado(null);
  };

  // ====================================================
  // CARGANDO
  // ====================================================

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text style={styles.textoCargando}>
          Cargando pacientes...
        </Text>
      </View>
    );
  }

  // ====================================================
  // DATOS DEL MODAL
  // ====================================================

  const resultadoModal =
    modal?.tipo === "resultado"
      ? detalleResultado?.resultado ??
        modal.registro
      : null;

  const analisisModal =
    detalleResultado?.analisis;

  const muestraModal =
    detalleResultado?.muestra;

  const parametrosModal =
    detalleResultado?.parametros ?? [];

  const campoRelacionado = (
    principal: any,
    secundario: any,
    nombres: string[]
  ): string => {
    const primero = obtenerCampo(
      principal,
      nombres,
      ""
    );

    return (
      primero ||
      obtenerCampo(
        secundario,
        nombres
      )
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <Boton
          titulo="← Volver al Dashboard"
          onPress={() => router.replace("/")}
        />

        <View style={styles.encabezado}>
          <Text style={styles.titulo}>
            Resultados de pacientes
          </Text>

          <Text style={styles.subtitulo}>
            Consulta resultados clínicos, rangos de
            referencia y notas de venta.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContenedor}>
            <Text style={styles.errorTexto}>
              {error}
            </Text>
          </View>
        ) : null}

        {!pacienteSeleccionado ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitulo}>
              Buscar pacientes
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Buscar por nombre o CI"
              placeholderTextColor="#94A3B8"
              value={busqueda}
              onChangeText={setBusqueda}
            />

            <Text style={styles.textoCantidad}>
              Pacientes encontrados:{" "}
              {pacientesFiltrados.length}
            </Text>

            {pacientesFiltrados.length === 0 ? (
              <Text style={styles.sinDatos}>
                No se encontraron pacientes.
              </Text>
            ) : (
              pacientesFiltrados.map((paciente) => (
                <View
                  key={paciente.id}
                  style={styles.tarjeta}
                >
                  <Text style={styles.nombre}>
                    {paciente.nombre}
                  </Text>

                  <Text style={styles.dato}>
                    CI:{" "}
                    {paciente.ci || "No registrado"}
                  </Text>

                  <Boton
                    titulo="Ver resultados y notas"
                    onPress={() =>
                      seleccionarPaciente(paciente)
                    }
                  />
                </View>
              ))
            )}
          </View>
        ) : (
          <>
            <View style={styles.separacion}>
              <Boton
                titulo="← Volver a pacientes"
                secundario
                onPress={volverPacientes}
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.nombreGrande}>
                {pacienteSeleccionado.nombre}
              </Text>

              <Text style={styles.dato}>
                CI:{" "}
                {pacienteSeleccionado.ci ||
                  "No registrado"}
              </Text>
            </View>

            {cargandoPaciente ? (
              <View style={styles.panel}>
                <ActivityIndicator
                  color="#2563EB"
                  size="large"
                />

                <Text style={styles.textoCargando}>
                  Cargando información...
                </Text>
              </View>
            ) : (
              <>
                {/* RESULTADOS */}

                <View style={styles.panel}>
                  <Text style={styles.panelTitulo}>
                    Resultados clínicos
                  </Text>

                  {resultados.length === 0 ? (
                    <Text style={styles.sinDatos}>
                      No hay resultados registrados.
                    </Text>
                  ) : (
                    resultados.map((resultado) => (
                      <View
                        key={resultado.id}
                        style={styles.tarjeta}
                      >
                        <Text style={styles.nombre}>
                          {nombreAnalisis(resultado)}
                        </Text>

                        <Text style={styles.dato}>
                          Estado:{" "}
                          {estadoResultado(resultado)}
                        </Text>

                        <Text style={styles.dato}>
                          Fecha:{" "}
                          {mostrarFecha(
                            resultado.fechaValidacion ??
                              resultado.fechaRegistro ??
                              resultado.createdAt
                          )}
                        </Text>

                        <Boton
                          titulo="Ver resultado"
                          onPress={() =>
                            abrirResultado(resultado)
                          }
                        />
                      </View>
                    ))
                  )}
                </View>

                {/* VENTAS */}

                <View style={styles.panel}>
                  <Text style={styles.panelTitulo}>
                    Notas de venta
                  </Text>

                  {ventas.length === 0 ? (
                    <Text style={styles.sinDatos}>
                      No hay notas de venta registradas.
                    </Text>
                  ) : (
                    ventas.map((venta) => (
                      <View
                        key={venta.id}
                        style={styles.tarjeta}
                      >
                        <Text style={styles.nombre}>
                          {obtenerItemsVenta(venta)
                            .map((item) => item.nombre)
                            .join(", ")}
                        </Text>

                        <Text style={styles.dato}>
                          Fecha: {fechaRegistro(venta)}
                        </Text>

                        <Text style={styles.dato}>
                          Total:{" "}
                          {moneda(
                            obtenerTotalVenta(venta)
                          )}
                        </Text>

                        <View style={styles.botonesFila}>
                          <Boton
                            titulo="Ver nota de venta"
                            onPress={() =>
                              setModal({
                                tipo: "venta",
                                registro: venta,
                              })
                            }
                          />

                          <Boton
                            titulo="Descargar PDF"
                            secundario
                            onPress={() =>
                              generarPDF(
                                "venta",
                                venta
                              )
                            }
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ================================================= */}
      {/* MODAL                                             */}
      {/* ================================================= */}

      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModal(null)}
      >
        <View style={styles.modalFondo}>
          <View
            style={[
              styles.modalContenido,
              {
                width: Math.min(
                  Math.max(width - 24, 280),
                  668
                ),
              },
            ]}
          >
            <View style={styles.modalEncabezado}>
              <Text style={styles.modalTitulo}>
                {modal?.tipo === "resultado"
                  ? "Detalle completo del resultado clínico"
                  : "Detalle de la nota de venta"}
              </Text>

              <Pressable
                style={styles.botonCerrarX}
                onPress={() => setModal(null)}
              >
                <Text style={styles.botonCerrarXTexto}>
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={
                styles.modalScrollContenido
              }
            >
              {cargandoModal &&
              modal?.tipo === "resultado" ? (
                <View style={styles.cargandoModal}>
                  <ActivityIndicator
                    size="large"
                    color="#2563EB"
                  />

                  <Text style={styles.textoCargando}>
                    Cargando información clínica...
                  </Text>
                </View>
              ) : null}

              {/* ======================================= */}
              {/* RESULTADO CLÍNICO                       */}
              {/* ======================================= */}

              {modal?.tipo === "resultado" &&
              resultadoModal &&
              !cargandoModal ? (
                <>
                  {/* 1. PACIENTE */}

                  <Seccion titulo="1. Información del paciente">
                    <Fila>
                      <Campo
                        etiqueta="Paciente"
                        valor={
                          pacienteSeleccionado?.nombre ??
                          "No registrado"
                        }
                      />

                      <Campo
                        etiqueta="CI"
                        valor={
                          pacienteSeleccionado?.ci ??
                          "No registrado"
                        }
                      />
                    </Fila>
                  </Seccion>

                  {/* 2. ANÁLISIS */}

                  <Seccion titulo="2. Información del análisis">
                    <Fila>
                      <Campo
                        etiqueta="Análisis"
                        valor={campoRelacionado(
                          resultadoModal,
                          analisisModal,
                          [
                            "nombreAnalisis",
                            "analisisNombre",
                            "nombre",
                          ]
                        )}
                      />

                      <Campo
                        etiqueta="Descripción"
                        valor={campoRelacionado(
                          analisisModal,
                          resultadoModal,
                          [
                            "descripcion",
                            "descripcionAnalisis",
                          ]
                        )}
                      />
                    </Fila>
                  </Seccion>

                  {/* 3. MUESTRA */}

                  <Seccion titulo="3. Información de la muestra">
                    <Fila>
                      <Campo
                        etiqueta="Tipo de muestra"
                        valor={campoRelacionado(
                          muestraModal,
                          resultadoModal,
                          ["tipoMuestra", "tipo"]
                        )}
                      />

                      <Campo
                        etiqueta="Estado de muestra"
                        valor={campoRelacionado(
                          muestraModal,
                          resultadoModal,
                          ["estadoMuestra", "estado"]
                        )}
                      />

                      <Campo
                        etiqueta="Fecha de toma"
                        valor={mostrarFecha(
                          muestraModal?.fechaToma ??
                            muestraModal?.fechaRegistro ??
                            resultadoModal.fechaToma
                        )}
                      />
                    </Fila>
                  </Seccion>

                  {/* 4. RESULTADO */}

                  <Seccion titulo="4. Resultado clínico">
                    <Fila>
                      <Campo
                        etiqueta="Valor registrado"
                        valor={obtenerCampo(
                          resultadoModal,
                          [
                            "valorResultado",
                            "resultado",
                            "valor",
                          ]
                        )}
                      />

                      <Campo
                        etiqueta="Unidad"
                        valor={obtenerCampo(
                          resultadoModal,
                          [
                            "unidad",
                            "unidadMedida",
                          ]
                        )}
                      />

                      <Campo
                        etiqueta="Rango de referencia"
                        valor={
                          rangoEsValido(
                            extraerRango(resultadoModal)
                          )
                            ? extraerRango(resultadoModal)
                            : "Ver rangos en los parámetros"
                        }
                      />

                      <Campo
                        etiqueta="Estado"
                        valor={estadoResultado(
                          resultadoModal
                        )}
                      />

                      <Campo
                        etiqueta="Fecha de registro"
                        valor={fechaRegistro(
                          resultadoModal
                        )}
                      />

                      <Campo
                        etiqueta="Observaciones"
                        valor={obtenerCampo(
                          resultadoModal,
                          [
                            "observaciones",
                            "observacion",
                          ]
                        )}
                      />
                    </Fila>
                  </Seccion>

                  {/* =================================== */}
                  {/* 5. PARÁMETROS                      */}
                  {/* =================================== */}

                  <Seccion titulo="5. Valores de los parámetros">
                    <TablaParametros
                      parametros={parametrosModal}
                    />
                  </Seccion>

                  {/* 6. VALIDACIÓN */}

                  <Seccion titulo="6. Validación del resultado">
                    <Fila>
                      <Campo
                        etiqueta="Estado"
                        valor={estadoResultado(
                          resultadoModal
                        )}
                      />

                      <Campo
                        etiqueta="Validado por"
                        valor={
                          detalleResultado?.validador ??
                          "No registrado"
                        }
                      />

                      <Campo
                        etiqueta="Fecha de validación"
                        valor={mostrarFecha(
                          resultadoModal.fechaValidacion
                        )}
                      />
                    </Fila>
                  </Seccion>
                </>
              ) : null}

              {/* ======================================= */}
              {/* NOTA DE VENTA                           */}
              {/* ======================================= */}

              {modal?.tipo === "venta" ? (
                <>
                  <Seccion titulo="Información de venta">
                    <Fila>
                      <Campo
                        etiqueta="Análisis vendidos"
                        valor={obtenerItemsVenta(
                          modal.registro
                        )
                          .map((item) => item.nombre)
                          .join(", ")}
                      />

                      <Campo
                        etiqueta="Paciente"
                        valor={
                          pacienteSeleccionado?.nombre ??
                          "No registrado"
                        }
                      />

                      <Campo
                        etiqueta="CI"
                        valor={
                          pacienteSeleccionado?.ci ??
                          "No registrado"
                        }
                      />

                      <Campo
                        etiqueta="Fecha"
                        valor={fechaRegistro(
                          modal.registro
                        )}
                      />

                      <Campo
                        etiqueta="Total"
                        valor={moneda(
                          obtenerTotalVenta(
                            modal.registro
                          )
                        )}
                      />
                    </Fila>
                  </Seccion>

                  <Seccion titulo="Detalle de análisis vendidos">
                    <TablaVenta
                      items={obtenerItemsVenta(
                        modal.registro
                      )}
                    />
                  </Seccion>
                </>
              ) : null}

              {/* BOTONES */}

              <View style={styles.botonesFila}>
                {modal ? (
                  <Boton
                    titulo={
                      generandoPDF
                        ? "Generando PDF..."
                        : "Descargar PDF"
                    }
                    disabled={
                      generandoPDF ||
                      (modal.tipo === "resultado" &&
                        cargandoModal)
                    }
                    onPress={() =>
                      generarPDF(
                        modal.tipo,
                        modal.registro
                      )
                    }
                  />
                ) : null}

                <Boton
                  titulo="Cerrar"
                  secundario
                  onPress={() => setModal(null)}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  contenido: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 45,
  },

  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },

  textoCargando: {
    color: "#19385F",
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
  },

  encabezado: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    padding: 20,
    marginVertical: 20,
  },

  titulo: {
    fontSize: 23,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 8,
  },

  subtitulo: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 21,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },

  panelTitulo: {
    fontSize: 19,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 15,
  },

  tarjeta: {
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },

  nombre: {
    fontSize: 16,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 10,
  },

  nombreGrande: {
    fontSize: 20,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 10,
  },

  dato: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 13,
    marginBottom: 15,
    color: "#19385F",
  },

  textoCantidad: {
    color: "#64748B",
    fontSize: 12,
    marginBottom: 15,
  },

  sinDatos: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 15,
  },

  boton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 9,
    alignSelf: "flex-start",
    marginTop: 8,
  },

  botonSecundario: {
    backgroundColor: "#E2E8F0",
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  botonTexto: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  botonTextoSecundario: {
    color: "#19385F",
  },

  botonesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },

  separacion: {
    marginBottom: 15,
  },

  errorContenedor: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 14,
    marginBottom: 15,
  },

  errorTexto: {
    color: "#B91C1C",
    fontSize: 13,
  },

  // ====================================================
  // MODAL
  // ====================================================

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },

  modalContenido: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    maxWidth: 668,
    maxHeight: "90%",
    overflow: "hidden",
    elevation: 12,
  },

  modalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  modalTitulo: {
    fontSize: 18,
    fontWeight: "800",
    color: "#19385F",
    flex: 1,
    marginRight: 10,
  },

  botonCerrarX: {
    backgroundColor: "#E2E8F0",
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  botonCerrarXTexto: {
    color: "#19385F",
    fontSize: 20,
    lineHeight: 24,
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalScrollContenido: {
    paddingBottom: 10,
  },

  cargandoModal: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  // ====================================================
  // SECCIONES
  // ====================================================

  seccion: {
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },

  seccionTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: "#19385F",
    marginBottom: 12,
  },

  // ====================================================
  // CAMPOS
  // ====================================================

  filaCampos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "stretch",
  },

  campo: {
    backgroundColor: "#F1F5F9",
    padding: 11,
    borderRadius: 8,
    minHeight: 50,
    justifyContent: "center",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "30%",
  },

  campoEtiqueta: {
    fontSize: 10,
    color: "#64748B",
    marginBottom: 5,
  },

  campoValor: {
    fontSize: 12,
    fontWeight: "700",
    color: "#19385F",
  },

  // ====================================================
  // TABLAS
  // ====================================================

  tablaParametros: {
    minWidth: 520,
    borderWidth: 1,
    borderColor: "#D6E4F5",
  },

  tablaVenta: {
    minWidth: 520,
    borderWidth: 1,
    borderColor: "#D6E4F5",
  },

  tablaEncabezado: {
    flexDirection: "row",
    backgroundColor: "#E8F0FC",
  },

  tablaFila: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#D6E4F5",
    backgroundColor: "#FFFFFF",
  },

  columnaNombre: {
    width: 180,
    padding: 9,
    color: "#19385F",
    fontSize: 11,
  },

  columnaUnidad: {
    width: 120,
    padding: 9,
    color: "#19385F",
    fontSize: 11,
  },

  columnaRango: {
    width: 220,
    padding: 9,
    color: "#19385F",
    fontSize: 11,
  },

  columnaVenta: {
    width: 130,
    padding: 9,
    color: "#19385F",
    fontSize: 11,
  },
});