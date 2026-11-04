import React, {

  useCallback,

  useEffect,

  useMemo,

  useState,

} from "react";



import {

  ActivityIndicator,

  Alert,

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  TextInput,

  View,

} from "react-native";



import {

  useRouter,

} from "expo-router";



import {

  collection,

  doc,

  getDoc,

  getDocs,

  query,

  where,

} from "firebase/firestore";



import {

  onAuthStateChanged,

} from "firebase/auth";



import * as Print from "expo-print";

import * as Sharing from "expo-sharing";



import {

  auth,

  db,

} from "../firebase/firebase";



// =====================================================

// TIPOS

// =====================================================



type Datos = Record<string, any>;



type Registro = {

  id: string;

  [key: string]: any;

};



type Paciente = {

  id: string;

  nombreCompleto: string;

  ci: string;

  telefono: string;

  laboratorioId: string;

  datos: Datos;

};



type Usuario = {

  uid: string;

  rol: string;

  laboratorioId: string;

};



type Historial = {

  solicitudes: Registro[];

  ventas: Registro[];

  ordenes: Registro[];

  muestras: Registro[];

  resultados: Registro[];

  nuevasTomas: Registro[];

};



type ClaveHistorial = keyof Historial;



type EstadoCarga = {

  [K in ClaveHistorial]: string | null;

};



const HISTORIAL_VACIO: Historial = {

  solicitudes: [],

  ventas: [],

  ordenes: [],

  muestras: [],

  resultados: [],

  nuevasTomas: [],

};



const ERRORES_VACIOS: EstadoCarga = {

  solicitudes: null,

  ventas: null,

  ordenes: null,

  muestras: null,

  resultados: null,

  nuevasTomas: null,

};



// =====================================================

// UTILIDADES

// =====================================================



function cadena(valor: unknown): string {

  if (valor === undefined || valor === null) {

    return "";

  }



  return String(valor).trim();

}



function normalizar(valor: unknown): string {

  return cadena(valor)

    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "");

}



function campo(

  datos: Datos,

  nombres: string[],

  defecto = "No registrado"

): string {

  for (const nombre of nombres) {

    const valor = datos[nombre];



    if (

      valor !== undefined &&

      valor !== null &&

      cadena(valor) !== ""

    ) {

      if (typeof valor === "object") {

        continue;

      }



      return cadena(valor);

    }

  }



  return defecto;

}



function nombreCompleto(datos: Datos): string {

  const completo = campo(

    datos,

    ["nombreCompleto"],

    ""

  );



  if (completo) {

    return completo;

  }



  const nombres = campo(

    datos,

    ["nombres", "nombre"],

    ""

  );



  const apellidos = campo(

    datos,

    ["apellidos", "apellido"],

    ""

  );



  return (

    `${nombres} ${apellidos}`.trim() ||

    "Paciente sin nombre"

  );

}



function convertirFecha(valor: any): Date | null {

  if (!valor) {

    return null;

  }



  try {

    let resultado: Date;



    if (

      typeof valor === "object" &&

      typeof valor.toDate === "function"

    ) {

      resultado = valor.toDate();

    } else if (

      typeof valor === "object" &&

      typeof valor.seconds === "number"

    ) {

      resultado = new Date(

        valor.seconds * 1000

      );

    } else {

      resultado = new Date(valor);

    }



    if (Number.isNaN(resultado.getTime())) {

      return null;

    }



    return resultado;

  } catch {

    return null;

  }

}



function fecha(valor: any): string {

  const resultado = convertirFecha(valor);



  return resultado

    ? resultado.toLocaleString("es-BO")

    : "Sin fecha";

}



function fechaRegistro(datos: Datos): string {

  return fecha(

    datos.fechaRegistro ||

    datos.fechaSolicitud ||

    datos.fechaVenta ||

    datos.fechaOrden ||

    datos.fechaToma ||

    datos.fechaCreacion ||

    datos.fechaValidacion ||

    datos.fechaRechazo ||

    datos.fecha ||

    datos.createdAt ||

    datos.creadoEn

  );

}



function escaparHTML(valor: unknown): string {

  return cadena(valor)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#39;");

}



function convertirPaciente(

  id: string,

  datos: Datos

): Paciente {

  return {

    id,

    nombreCompleto: nombreCompleto(datos),

    ci: campo(

      datos,

      ["ci", "carnetIdentidad"],

      ""

    ),

    telefono: campo(

      datos,

      ["telefono", "celular"],

      ""

    ),

    laboratorioId: cadena(

      datos.laboratorioId

    ),

    datos,

  };

}



function tituloAnalisis(datos: Datos): string {

  return campo(

    datos,

    [

      "analisisNombre",

      "nombreAnalisis",

      "nombre",

      "analisis",

      "tipoAnalisis",

    ],

    "Análisis clínico"

  );

}



function estadoRegistro(datos: Datos): string {

  if (datos.validado === true) {

    return "Validado";

  }



  return campo(

    datos,

    [

      "estado",

      "estadoResultado",

      "estadoValidacion",

      "estadoSolicitud",

      "estadoPago",

    ]

  );

}



function valorResultado(datos: Datos): string {

  return campo(

    datos,

    [

      "valorResultado",

      "resultado",

      "valor",

      "resultadoFinal",

    ]

  );

}



function descripcionAnalisis(

  valor: unknown

): string {

  if (typeof valor === "string") {

    return valor;

  }



  if (

    valor &&

    typeof valor === "object"

  ) {

    const datos = valor as Datos;



    return campo(

      datos,

      [

        "nombre",

        "nombreAnalisis",

        "analisisNombre",

        "analisisId",

      ],

      "Análisis"

    );

  }



  return "";

}



function listaAnalisis(datos: Datos): string {

  const posibles = [

    datos.analisis,

    datos.analisisSolicitados,

    datos.detalles,

    datos.items,

  ];



  for (const valor of posibles) {

    if (Array.isArray(valor)) {

      return valor

        .map(descripcionAnalisis)

        .filter(Boolean)

        .join(", ") || "Sin detalle";

    }

  }



  return tituloAnalisis(datos);

}



function nombreSeccion(

  clave: ClaveHistorial

): string {

  const nombres: Record<

    ClaveHistorial,

    string

  > = {

    solicitudes: "Solicitudes",

    ventas: "Ventas",

    ordenes: "Órdenes de análisis",

    muestras: "Muestras",

    resultados: "Resultados clínicos",

    nuevasTomas: "Nuevas tomas solicitadas",

  };



  return nombres[clave];

}



function crearHistorialVacio(): Historial {

  return {

    solicitudes: [],

    ventas: [],

    ordenes: [],

    muestras: [],

    resultados: [],

    nuevasTomas: [],

  };

}



function crearErroresVacios(): EstadoCarga {

  return {

    solicitudes: null,

    ventas: null,

    ordenes: null,

    muestras: null,

    resultados: null,

    nuevasTomas: null,

  };

}



// =====================================================

// CONSULTAS FIRESTORE

// =====================================================



// Cada consulta está limitada al laboratorio.

//

// Se consultan las relaciones existentes y luego

// se unen los documentos por sus identificadores.

//

// No se descargan colecciones completas sin filtro.



async function consultarColeccion(

  nombre: string,

  laboratorioId: string

): Promise<Registro[]> {

  const referencia = collection(db, nombre);



  const consulta = query(

    referencia,

    where(

      "laboratorioId",

      "==",

      laboratorioId

    )

  );



  const snapshot = await getDocs(consulta);



  return snapshot.docs.map((documento) => ({

    ...documento.data(),

    id: documento.id,

  }));

}



function contieneReferencia(

  valor: unknown,

  identificadores: Set<string>

): boolean {

  if (typeof valor === "string") {

    return identificadores.has(valor);

  }



  if (Array.isArray(valor)) {

    return valor.some((elemento) =>

      contieneReferencia(

        elemento,

        identificadores

      )

    );

  }



  if (

    valor &&

    typeof valor === "object"

  ) {

    const datos = valor as Datos;



    return [

      datos.id,

      datos.pacienteId,

      datos.solicitudId,

      datos.ventaId,

      datos.ordenId,

      datos.muestraId,

      datos.resultadoId,

    ].some(

      (elemento) =>

        typeof elemento === "string" &&

        identificadores.has(elemento)

    );

  }



  return false;

}



function perteneceA(

  registro: Registro,

  identificadores: Set<string>,

  campos: string[]

): boolean {

  return campos.some((nombre) =>

    contieneReferencia(

      registro[nombre],

      identificadores

    )

  );

}



function filtrarPorPaciente(

  registros: Registro[],

  pacienteId: string

): Registro[] {

  const ids = new Set([pacienteId]);



  return registros.filter((registro) =>

    perteneceA(registro, ids, [

      "pacienteId",

      "idPaciente",

      "paciente",

    ])

  );

}



function filtrarRelacionados(

  registros: Registro[],

  pacienteId: string,

  solicitudes: Registro[],

  ventas: Registro[],

  ordenes: Registro[],

  muestras: Registro[]

): Registro[] {

  const ids = new Set<string>([

    pacienteId,

    ...solicitudes.map((r) => r.id),

    ...ventas.map((r) => r.id),

    ...ordenes.map((r) => r.id),

    ...muestras.map((r) => r.id),

  ]);



  return registros.filter((registro) =>

    perteneceA(registro, ids, [

      "pacienteId",

      "idPaciente",

      "paciente",

      "solicitudId",

      "idSolicitud",

      "ventaId",

      "idVenta",

      "ordenId",

      "idOrden",

      "muestraId",

      "muestraOriginalId",

    ])

  );

}



function ordenarRegistros(

  registros: Registro[]

): Registro[] {

  return [...registros].sort((a, b) => {

    const obtenerTiempo = (datos: Datos) => {

      const campos = [

        "fechaRegistro",

        "fechaSolicitud",

        "fechaVenta",

        "fechaOrden",

        "fechaToma",

        "fechaCreacion",

        "fecha",

        "createdAt",

        "creadoEn",

      ];



      for (const nombre of campos) {

        const valor = convertirFecha(

          datos[nombre]

        );



        if (valor) {

          return valor.getTime();

        }

      }



      return 0;

    };



    return obtenerTiempo(b) - obtenerTiempo(a);

  });

}



async function obtenerHistorialCompleto(

  laboratorioId: string,

  pacienteId: string

): Promise<{

  historial: Historial;

  errores: EstadoCarga;

}> {

  const claves: ClaveHistorial[] = [

    "solicitudes",

    "ventas",

    "ordenes",

    "muestras",

    "resultados",

    "nuevasTomas",

  ];



  const colecciones: Record<

    ClaveHistorial,

    string

  > = {

    solicitudes: "solicitudes",

    ventas: "ventas",

    ordenes: "ordenes",

    muestras: "muestras",

    resultados: "resultados",

    nuevasTomas: "solicitudesNuevaToma",

  };



  const consultas = await Promise.allSettled(

    claves.map((clave) =>

      consultarColeccion(

        colecciones[clave],

        laboratorioId

      )

    )

  );



  const datos = crearHistorialVacio();

  const errores = crearErroresVacios();



  consultas.forEach((resultado, indice) => {

    const clave = claves[indice];



    if (resultado.status === "fulfilled") {

      datos[clave] = resultado.value;

    } else {

      const error = resultado.reason;



      errores[clave] =

        error instanceof Error

          ? error.message

          : "No se pudo consultar esta colección.";



      console.error(

        `Error consultando ${colecciones[clave]}:`,

        error

      );

    }

  });



  // ===================================================

  // RELACIONAR INFORMACIÓN DEL PACIENTE

  // ===================================================



  const solicitudes = filtrarPorPaciente(

    datos.solicitudes,

    pacienteId

  );



  const ventas = filtrarRelacionados(

    datos.ventas,

    pacienteId,

    solicitudes,

    [],

    [],

    []

  );



  const ordenes = filtrarRelacionados(

    datos.ordenes,

    pacienteId,

    solicitudes,

    ventas,

    [],

    []

  );



  const muestras = filtrarRelacionados(

    datos.muestras,

    pacienteId,

    solicitudes,

    ventas,

    ordenes,

    []

  );



  const resultados = filtrarRelacionados(

    datos.resultados,

    pacienteId,

    solicitudes,

    ventas,

    ordenes,

    muestras

  );



  const nuevasTomas = filtrarRelacionados(

    datos.nuevasTomas,

    pacienteId,

    solicitudes,

    ventas,

    ordenes,

    muestras

  );



  return {

    historial: {

      solicitudes: ordenarRegistros(

        solicitudes

      ),

      ventas: ordenarRegistros(ventas),

      ordenes: ordenarRegistros(ordenes),

      muestras: ordenarRegistros(muestras),

      resultados: ordenarRegistros(

        resultados

      ),

      nuevasTomas: ordenarRegistros(

        nuevasTomas

      ),

    },

    errores,

  };

}



// =====================================================

// CAMPOS VISIBLES POR SECCIÓN

// =====================================================



type CampoVisible = {

  etiqueta: string;

  valor: string;

};



function camposRegistro(

  tipo: ClaveHistorial,

  datos: Registro

): CampoVisible[] {

  const campos: CampoVisible[] = [

    {

      etiqueta: "Fecha",

      valor: fechaRegistro(datos),

    },

    {

      etiqueta: "Estado",

      valor: estadoRegistro(datos),

    },

  ];



  if (tipo === "solicitudes") {

    campos.push(

      {

        etiqueta: "Código",

        valor: campo(datos, [

          "codigo",

          "codigoSolicitud",

          "numeroSolicitud",

        ]),

      },

      {

        etiqueta: "Análisis solicitados",

        valor: listaAnalisis(datos),

      }

    );

  }



  if (tipo === "ventas") {

    campos.push(

      {

        etiqueta: "Número de venta",

        valor: campo(datos, [

          "numeroVenta",

          "codigoVenta",

          "codigo",

        ]),

      },

      {

        etiqueta: "Monto total",

        valor: campo(datos, [

          "total",

          "montoTotal",

          "importeTotal",

          "monto",

        ]),

      },

      {

        etiqueta: "Método de pago",

        valor: campo(datos, [

          "metodoPago",

          "formaPago",

          "tipoPago",

        ]),

      }

    );

  }



  if (tipo === "ordenes") {

    campos.push(

      {

        etiqueta: "Número de orden",

        valor: campo(datos, [

          "codigo",

          "codigoOrden",

          "numeroOrden",

        ]),

      },

      {

        etiqueta: "Análisis",

        valor: listaAnalisis(datos),

      }

    );

  }



  if (tipo === "muestras") {

    campos.push(

      {

        etiqueta: "Tipo de muestra",

        valor: campo(datos, [

          "tipoMuestra",

          "tipo",

        ]),

      },

      {

        etiqueta: "Análisis",

        valor: tituloAnalisis(datos),

      },

      {

        etiqueta: "Motivo de rechazo",

        valor: campo(datos, [

          "motivoRechazo",

          "observacionRechazo",

          "motivo",

        ]),

      }

    );

  }



  if (tipo === "resultados") {

    campos.push(

      {

        etiqueta: "Análisis",

        valor: tituloAnalisis(datos),

      },

      {

        etiqueta: "Resultado registrado",

        valor: valorResultado(datos),

      },

      {

        etiqueta: "Unidad",

        valor: campo(datos, [

          "unidad",

          "unidadMedida",

        ]),

      },

      {

        etiqueta: "Observaciones",

        valor: campo(datos, [

          "observaciones",

          "observacion",

        ]),

      }

    );

  }



  if (tipo === "nuevasTomas") {

    campos.push(

      {

        etiqueta: "Motivo de rechazo",

        valor: campo(datos, [

          "motivoRechazo",

          "motivo",

        ]),

      },

      {

        etiqueta: "Código de muestra",

        valor: campo(datos, [

          "codigoMuestra",

        ]),

      }

    );

  }



  return campos;

}



// =====================================================

// GENERAR PDF

// =====================================================



function generarTablaHTML(

  titulo: string,

  tipo: ClaveHistorial,

  registros: Registro[],

  error: string | null

): string {

  if (error) {

    return `

      <h2>${escaparHTML(titulo)}</h2>

      <p class="advertencia">

        No se pudo consultar esta sección:

        ${escaparHTML(error)}

      </p>

    `;

  }



  if (registros.length === 0) {

    return `

      <h2>${escaparHTML(titulo)}</h2>

      <p>No hay registros relacionados con este paciente.</p>

    `;

  }



  const contenido = registros

    .map((registro, indice) => {

      const filas = camposRegistro(

        tipo,

        registro

      )

        .map(

          (item) => `

            <tr>

              <td>${escaparHTML(

                item.etiqueta

              )}</td>

              <td>${escaparHTML(

                item.valor

              )}</td>

            </tr>

          `

        )

        .join("");



      return `

        <div class="registro">

          <h3>Registro ${indice + 1}</h3>



          <table>

            <tbody>

              ${filas}

            </tbody>

          </table>

        </div>

      `;

    })

    .join("");



  return `

    <h2>${escaparHTML(titulo)}</h2>

    ${contenido}

  `;

}



function generarHTML(

  paciente: Paciente,

  historial: Historial,

  errores: EstadoCarga

): string {

  const secciones: ClaveHistorial[] = [

    "solicitudes",

    "ventas",

    "ordenes",

    "muestras",

    "resultados",

    "nuevasTomas",

  ];



  const seccionesHTML = secciones

    .map((clave) =>

      generarTablaHTML(

        nombreSeccion(clave),

        clave,

        historial[clave],

        errores[clave]

      )

    )

    .join("");



  const incompleto = secciones.some(

    (clave) => errores[clave] !== null

  );



  return `

<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">



<style>

  @page {

    size: A4;

    margin: 18mm 15mm;

  }



  body {

    font-family: Arial, sans-serif;

    font-size: 11px;

    color: #334155;

    line-height: 1.5;

  }



  .encabezado {

    background: #19385F;

    color: #FFFFFF;

    padding: 22px;

    border-radius: 8px;

  }



  h1 {

    font-size: 22px;

    margin: 0;

  }



  h2 {

    font-size: 16px;

    color: #19385F;

    border-bottom: 2px solid #2563EB;

    padding-bottom: 7px;

    margin-top: 25px;

  }



  h3 {

    color: #1D4ED8;

    font-size: 12px;

    margin-bottom: 8px;

  }



  .paciente {

    background: #F1F5F9;

    padding: 16px;

    border-radius: 8px;

    margin-top: 20px;

  }



  .paciente p {

    margin: 6px 0;

  }



  .resumen {

    margin-top: 20px;

    background: #EFF6FF;

    padding: 15px;

    border-radius: 8px;

  }



  .registro {

    margin-bottom: 15px;

    page-break-inside: avoid;

  }



  table {

    width: 100%;

    border-collapse: collapse;

  }



  td {

    border: 1px solid #CBD5E1;

    padding: 8px;

    vertical-align: top;

    overflow-wrap: anywhere;

  }



  td:first-child {

    width: 35%;

    background: #F8FAFC;

    font-weight: bold;

  }



  .advertencia {

    background: #FEF2F2;

    border: 1px solid #FECACA;

    padding: 12px;

    color: #991B1B;

  }



  .pie {

    margin-top: 35px;

    padding-top: 12px;

    border-top: 1px solid #CBD5E1;

    font-size: 9px;

    color: #64748B;

  }

</style>

</head>



<body>



<div class="encabezado">

  <h1>LABORATORIO CLÍNICO</h1>

  <p>HISTORIAL DEL PACIENTE</p>

  <p>

    Fecha de generación:

    ${escaparHTML(

      new Date().toLocaleString("es-BO")

    )}

  </p>

</div>



<div class="paciente">

  <h2>Datos del paciente</h2>



  <p>

    <strong>Nombre:</strong>

    ${escaparHTML(

      paciente.nombreCompleto

    )}

  </p>



  <p>

    <strong>CI:</strong>

    ${escaparHTML(

      paciente.ci || "No registrado"

    )}

  </p>



  <p>

    <strong>Teléfono:</strong>

    ${escaparHTML(

      paciente.telefono || "No registrado"

    )}

  </p>



  <p>

    <strong>Dirección:</strong>

    ${escaparHTML(

      campo(

        paciente.datos,

        ["direccion"]

      )

    )}

  </p>



  <p>

    <strong>Fecha de nacimiento:</strong>

    ${escaparHTML(

      fecha(

        paciente.datos.fechaNacimiento

      )

    )}

  </p>

</div>



<div class="resumen">

  <strong>Resumen de registros</strong>



  <p>Solicitudes: ${historial.solicitudes.length}</p>

  <p>Ventas: ${historial.ventas.length}</p>

  <p>Órdenes: ${historial.ordenes.length}</p>

  <p>Muestras: ${historial.muestras.length}</p>

  <p>Resultados: ${historial.resultados.length}</p>

  <p>Nuevas tomas: ${historial.nuevasTomas.length}</p>

</div>



${

  incompleto

    ? `

      <p class="advertencia">

        HISTORIAL PARCIAL:

        No fue posible consultar todas las

        secciones. Este documento no debe

        considerarse completo.

      </p>

    `

    : ""

}



${seccionesHTML}



<div class="pie">

  Documento generado por el sistema

  de Laboratorio Clínico.



  <br>



  Información confidencial del paciente.

  Su contenido depende de los registros

  disponibles y de las relaciones

  almacenadas en Firestore.

</div>



</body>

</html>

`;

}



// =====================================================

// COMPONENTE PARA MOSTRAR REGISTROS

// =====================================================



function TarjetaRegistro({

  tipo,

  registro,

  indice,

}: {

  tipo: ClaveHistorial;

  registro: Registro;

  indice: number;

}) {

  const campos = camposRegistro(

    tipo,

    registro

  );



  return (

    <View style={styles.tarjetaRegistro}>

      <Text style={styles.tituloRegistro}>

        {nombreSeccion(tipo)} #{indice + 1}

      </Text>



      {campos.map((item, posicion) => (

        <View

          key={`${item.etiqueta}-${posicion}`}

          style={styles.filaDato}

        >

          <Text style={styles.etiquetaDato}>

            {item.etiqueta}

          </Text>



          <Text style={styles.valorDato}>

            {item.valor}

          </Text>

        </View>

      ))}

    </View>

  );

}



function SeccionHistorial({

  tipo,

  registros,

  error,

}: {

  tipo: ClaveHistorial;

  registros: Registro[];

  error: string | null;

}) {

  return (

    <View style={styles.panel}>

      <View style={styles.encabezadoSeccion}>

        <Text style={styles.tituloSeccion}>

          {nombreSeccion(tipo)}

        </Text>



        <View style={styles.contador}>

          <Text style={styles.contadorTexto}>

            {registros.length}

          </Text>

        </View>

      </View>



      {error ? (

        <View style={styles.error}>

          <Text style={styles.errorTexto}>

            No se pudo consultar esta sección.

          </Text>



          <Text style={styles.errorDetalle}>

            {error}

          </Text>

        </View>

      ) : registros.length === 0 ? (

        <Text style={styles.sinDatos}>

          No hay registros relacionados con

          este paciente.

        </Text>

      ) : (

        registros.map((registro, indice) => (

          <TarjetaRegistro

            key={`${tipo}-${registro.id}`}

            tipo={tipo}

            registro={registro}

            indice={indice}

          />

        ))

      )}

    </View>

  );

}



// =====================================================

// PANTALLA PRINCIPAL

// =====================================================



export default function HistorialPaciente() {

  const router = useRouter();



  const [usuario, setUsuario] =

    useState<Usuario | null>(null);



  const [pacientes, setPacientes] =

    useState<Paciente[]>([]);



  const [

    pacienteSeleccionado,

    setPacienteSeleccionado,

  ] = useState<Paciente | null>(null);



  const [historial, setHistorial] =

    useState<Historial>(

      crearHistorialVacio()

    );



  const [errores, setErrores] =

    useState<EstadoCarga>(

      crearErroresVacios()

    );



  const [busqueda, setBusqueda] =

    useState("");



  const [cargando, setCargando] =

    useState(true);



  const [

    cargandoHistorial,

    setCargandoHistorial,

  ] = useState(false);



  const [actualizando, setActualizando] =

    useState(false);



  const [generandoPDF, setGenerandoPDF] =

    useState(false);



  const [errorGeneral, setErrorGeneral] =

    useState("");



  // ===================================================

  // CARGAR PACIENTES

  // ===================================================



  const cargarPacientes = useCallback(

    async (laboratorioId: string) => {

      const consulta = query(

        collection(db, "pacientes"),

        where(

          "laboratorioId",

          "==",

          laboratorioId

        )

      );



      const snapshot = await getDocs(

        consulta

      );



      const lista = snapshot.docs.map(

        (documento) =>

          convertirPaciente(

            documento.id,

            documento.data()

          )

      );



      lista.sort((a, b) =>

        a.nombreCompleto.localeCompare(

          b.nombreCompleto,

          "es"

        )

      );



      setPacientes(lista);



      return lista;

    },

    []

  );



  // ===================================================

  // AUTENTICACIÓN

  // ===================================================



  useEffect(() => {

    let activo = true;



    const cancelar = onAuthStateChanged(

      auth,

      async (firebaseUser) => {

        if (!activo) {

          return;

        }



        setCargando(true);



        if (!firebaseUser) {

          setUsuario(null);

          setPacientes([]);

          setErrorGeneral(

            "Debes iniciar sesión."

          );

          setCargando(false);

          return;

        }



        try {

          setErrorGeneral("");



          const usuarioSnap = await getDoc(

            doc(

              db,

              "usuarios",

              firebaseUser.uid

            )

          );



          if (!usuarioSnap.exists()) {

            throw new Error(

              "No se encontró tu usuario."

            );

          }



          const datos = usuarioSnap.data();



          if (datos.activo !== true) {

            throw new Error(

              "Tu cuenta está inactiva."

            );

          }



          const rol = normalizar(

            datos.rolNombre ||

            datos.rol ||

            datos.role

          );



          if (

            rol !== "recepcionista" &&

            rol !== "administrador"

          ) {

            throw new Error(

              "Este módulo está disponible para Recepción y Administración."

            );

          }



          const laboratorioId = cadena(

            datos.laboratorioId

          );



          if (!laboratorioId) {

            throw new Error(

              "No tienes un laboratorio asignado."

            );

          }



          if (!activo) {

            return;

          }



          setUsuario({

            uid: firebaseUser.uid,

            rol,

            laboratorioId,

          });



          await cargarPacientes(

            laboratorioId

          );

        } catch (error) {

          if (activo) {

            setErrorGeneral(

              error instanceof Error

                ? error.message

                : "No se pudieron cargar los pacientes."

            );

          }

        } finally {

          if (activo) {

            setCargando(false);

          }

        }

      }

    );



    return () => {

      activo = false;

      cancelar();

    };

  }, [cargarPacientes]);



  // ===================================================

  // BUSCADOR

  // ===================================================



  const pacientesFiltrados = useMemo(() => {

    const termino = normalizar(busqueda);



    if (!termino) {

      return pacientes;

    }



    return pacientes.filter((paciente) => {

      const contenido = normalizar(

        [

          paciente.nombreCompleto,

          paciente.ci,

          paciente.telefono,

        ].join(" ")

      );



      return contenido.includes(termino);

    });

  }, [pacientes, busqueda]);



  // ===================================================

  // CONSULTAR HISTORIAL COMPLETO

  // ===================================================



  const cargarHistorial = useCallback(

    async (paciente: Paciente) => {

      if (!usuario) {

        return;

      }



      if (

        paciente.laboratorioId !==

        usuario.laboratorioId

      ) {

        Alert.alert(

          "Acceso denegado",

          "El paciente pertenece a otro laboratorio."

        );



        return;

      }



      try {

        setCargandoHistorial(true);



        setHistorial(

          crearHistorialVacio()

        );



        setErrores(

          crearErroresVacios()

        );



        const resultado =

          await obtenerHistorialCompleto(

            usuario.laboratorioId,

            paciente.id

          );



        setHistorial(

          resultado.historial

        );



        setErrores(

          resultado.errores

        );



        setPacienteSeleccionado(

          paciente

        );

      } catch (error) {

        Alert.alert(

          "Error",

          error instanceof Error

            ? error.message

            : "No se pudo cargar el historial."

        );

      } finally {

        setCargandoHistorial(false);

      }

    },

    [usuario]

  );



  // ===================================================

  // ACTUALIZAR

  // ===================================================



  const actualizar = async () => {

    if (!usuario) {

      return;

    }



    try {

      setActualizando(true);



      await cargarPacientes(

        usuario.laboratorioId

      );



      if (pacienteSeleccionado) {

        await cargarHistorial(

          pacienteSeleccionado

        );

      }

    } catch (error) {

      Alert.alert(

        "Error",

        error instanceof Error

          ? error.message

          : "No se pudo actualizar."

      );

    } finally {

      setActualizando(false);

    }

  };



  // ===================================================

  // GENERAR PDF

  // ===================================================



  const generarPDF = async () => {

    if (

      !usuario ||

      !pacienteSeleccionado

    ) {

      return;

    }



    try {

      setGenerandoPDF(true);



      const resultado =

        await obtenerHistorialCompleto(

          usuario.laboratorioId,

          pacienteSeleccionado.id

        );



      setHistorial(

        resultado.historial

      );



      setErrores(

        resultado.errores

      );



      const claves: ClaveHistorial[] = [

        "solicitudes",

        "ventas",

        "ordenes",

        "muestras",

        "resultados",

        "nuevasTomas",

      ];



      const incompleto = claves.some(

        (clave) =>

          resultado.errores[clave] !== null

      );



      if (incompleto) {

        Alert.alert(

          "Historial parcial",

          "Algunas secciones no pudieron consultarse. El PDF identificará los datos faltantes."

        );

      }



      const html = generarHTML(

        pacienteSeleccionado,

        resultado.historial,

        resultado.errores

      );



      const archivo =

        await Print.printToFileAsync({

          html,

        });



      const disponible =

        await Sharing.isAvailableAsync();



      if (!disponible) {

        Alert.alert(

          "PDF generado",

          `Archivo: ${archivo.uri}`

        );



        return;

      }



      await Sharing.shareAsync(

        archivo.uri,

        {

          mimeType: "application/pdf",

          dialogTitle:

            "Compartir historial del paciente",

          UTI: "com.adobe.pdf",

        }

      );

    } catch (error) {

      Alert.alert(

        "Error al generar PDF",

        error instanceof Error

          ? error.message

          : "No se pudo generar el PDF."

      );

    } finally {

      setGenerandoPDF(false);

    }

  };



  // ===================================================

  // VOLVER

  // ===================================================



  const volver = () => {

    if (pacienteSeleccionado) {

      setPacienteSeleccionado(null);



      setHistorial(

        crearHistorialVacio()

      );



      setErrores(

        crearErroresVacios()

      );



      return;

    }



    if (router.canGoBack()) {

      router.back();

    } else {

      router.replace("/");

    }

  };



  // ===================================================

  // PANTALLA DE CARGA

  // ===================================================



  if (cargando) {

    return (

      <View style={styles.cargando}>

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



  // ===================================================

  // RENDERIZADO

  // ===================================================



  const secciones: ClaveHistorial[] = [

    "solicitudes",

    "ventas",

    "ordenes",

    "muestras",

    "resultados",

    "nuevasTomas",

  ];



  const historialParcial = secciones.some(

    (clave) => errores[clave] !== null

  );



  return (

    <View style={styles.contenedor}>

      <ScrollView

        contentContainerStyle={

          styles.contenido

        }

        refreshControl={

          <RefreshControl

            refreshing={actualizando}

            onRefresh={actualizar}

          />

        }

      >

        {/* ENCABEZADO */}



        <View style={styles.encabezado}>

          <Pressable

            style={styles.botonVolver}

            onPress={volver}

          >

            <Text style={styles.botonVolverTexto}>

              ← Volver

            </Text>

          </Pressable>



          <Text style={styles.titulo}>

            Historial de pacientes

          </Text>



          <Text style={styles.subtitulo}>

            Consulta las atenciones,

            solicitudes, ventas, órdenes,

            muestras y resultados clínicos.

          </Text>

        </View>



        {/* ERROR GENERAL */}



        {errorGeneral ? (

          <View style={styles.error}>

            <Text style={styles.errorTexto}>

              {errorGeneral}

            </Text>

          </View>

        ) : null}



        {/* LISTADO */}



        {!pacienteSeleccionado ? (

          <View style={styles.panel}>

            <Text style={styles.tituloSeccion}>

              Buscar paciente

            </Text>



            <TextInput

              style={styles.input}

              placeholder="Nombre, apellido o CI"

              placeholderTextColor="#94A3B8"

              value={busqueda}

              onChangeText={setBusqueda}

            />



            <Text style={styles.textoContador}>

              Pacientes encontrados:{" "}

              {pacientesFiltrados.length}

            </Text>



            {pacientesFiltrados.length === 0 ? (

              <Text style={styles.sinDatos}>

                No se encontraron pacientes.

              </Text>

            ) : (

              pacientesFiltrados.map(

                (paciente) => (

                  <View

                    key={paciente.id}

                    style={styles.tarjetaPaciente}

                  >

                    <Text

                      style={styles.nombrePaciente}

                    >

                      {paciente.nombreCompleto}

                    </Text>



                    <Text style={styles.dato}>

                      CI:{" "}

                      {paciente.ci ||

                        "No registrado"}

                    </Text>



                    <Text style={styles.dato}>

                      Teléfono:{" "}

                      {paciente.telefono ||

                        "No registrado"}

                    </Text>



                    <Pressable

                      style={styles.botonPrincipal}

                      onPress={() =>

                        cargarHistorial(paciente)

                      }

                    >

                      <Text

                        style={

                          styles.botonPrincipalTexto

                        }

                      >

                        Ver historial completo

                      </Text>

                    </Pressable>

                  </View>

                )

              )

            )}

          </View>

        ) : (

          <>

            {/* DATOS DEL PACIENTE */}



            <View style={styles.panel}>

              <Text style={styles.tituloSeccion}>

                Datos del paciente

              </Text>



              <Text

                style={styles.nombrePacienteGrande}

              >

                {

                  pacienteSeleccionado.nombreCompleto

                }

              </Text>



              <Text style={styles.dato}>

                CI:{" "}

                {pacienteSeleccionado.ci ||

                  "No registrado"}

              </Text>



              <Text style={styles.dato}>

                Teléfono:{" "}

                {pacienteSeleccionado.telefono ||

                  "No registrado"}

              </Text>



              <View style={styles.botones}>

                <Pressable

                  style={styles.botonPrincipal}

                  onPress={generarPDF}

                  disabled={

                    generandoPDF ||

                    cargandoHistorial

                  }

                >

                  {generandoPDF ? (

                    <ActivityIndicator

                      color="#FFFFFF"

                    />

                  ) : (

                    <Text

                      style={

                        styles.botonPrincipalTexto

                      }

                    >

                      Generar PDF del historial

                    </Text>

                  )}

                </Pressable>



                <Pressable

                  style={styles.botonSecundario}

                  onPress={volver}

                >

                  <Text

                    style={

                      styles.botonSecundarioTexto

                    }

                  >

                    Ver pacientes

                  </Text>

                </Pressable>

              </View>

            </View>



            {cargandoHistorial ? (

              <View style={styles.panel}>

                <ActivityIndicator

                  size="large"

                  color="#2563EB"

                />



                <Text

                  style={styles.textoCargando}

                >

                  Consultando el historial...

                </Text>

              </View>

            ) : (

              <>

                {/* ADVERTENCIA */}



                {historialParcial && (

                  <View style={styles.error}>

                    <Text

                      style={styles.errorTexto}

                    >

                      Historial parcial

                    </Text>



                    <Text

                      style={styles.errorDetalle}

                    >

                      Algunas colecciones no

                      pudieron consultarse.

                      Revisa los errores que

                      aparecen en cada sección.

                    </Text>

                  </View>

                )}



                {/* RESUMEN */}



                <View style={styles.panel}>

                  <Text

                    style={styles.tituloSeccion}

                  >

                    Resumen del historial

                  </Text>



                  <View

                    style={styles.resumenContenedor}

                  >

                    {secciones.map((clave) => (

                      <View

                        key={clave}

                        style={styles.resumenItem}

                      >

                        <Text

                          style={styles.resumenNumero}

                        >

                          {

                            historial[clave]

                              .length

                          }

                        </Text>



                        <Text

                          style={styles.resumenTexto}

                        >

                          {nombreSeccion(clave)}

                        </Text>

                      </View>

                    ))}

                  </View>

                </View>



                {/* HISTORIAL POR SECCIONES */}



                {secciones.map((clave) => (

                  <SeccionHistorial

                    key={clave}

                    tipo={clave}

                    registros={historial[clave]}

                    error={errores[clave]}

                  />

                ))}

              </>

            )}

          </>

        )}

      </ScrollView>

    </View>

  );

}



// =====================================================

// ESTILOS

// =====================================================



const styles = StyleSheet.create({

  contenedor: {

    flex: 1,

    backgroundColor: "#F1F5F9",

  },



  contenido: {

    padding: 16,

    paddingBottom: 45,

  },



  cargando: {

    flex: 1,

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#F1F5F9",

  },



  textoCargando: {

    color: "#19385F",

    fontSize: 14,

    textAlign: "center",

    marginTop: 12,

  },



  encabezado: {

    backgroundColor: "#19385F",

    borderRadius: 16,

    padding: 20,

    marginBottom: 16,

  },



  botonVolver: {

    alignSelf: "flex-start",

    backgroundColor: "#FFFFFF",

    paddingHorizontal: 15,

    paddingVertical: 10,

    borderRadius: 9,

    marginBottom: 15,

  },



  botonVolverTexto: {

    color: "#19385F",

    fontWeight: "800",

    fontSize: 13,

  },



  titulo: {

    fontSize: 24,

    fontWeight: "800",

    color: "#FFFFFF",

    marginBottom: 8,

  },



  subtitulo: {

    fontSize: 13,

    color: "#DBEAFE",

    lineHeight: 20,

  },



  panel: {

    backgroundColor: "#FFFFFF",

    borderRadius: 14,

    padding: 17,

    marginBottom: 15,

    borderWidth: 1,

    borderColor: "#E2E8F0",

  },



  tituloSeccion: {

    fontSize: 17,

    fontWeight: "800",

    color: "#19385F",

    marginBottom: 15,

  },



  encabezadoSeccion: {

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 10,

  },



  contador: {

    backgroundColor: "#DBEAFE",

    paddingHorizontal: 12,

    paddingVertical: 5,

    borderRadius: 20,

  },



  contadorTexto: {

    color: "#1D4ED8",

    fontWeight: "800",

    fontSize: 13,

  },



  input: {

    backgroundColor: "#F8FAFC",

    borderWidth: 1,

    borderColor: "#CBD5E1",

    borderRadius: 10,

    paddingHorizontal: 14,

    paddingVertical: 13,

    fontSize: 14,

    color: "#19385F",

    marginBottom: 12,

  },



  textoContador: {

    fontSize: 12,

    color: "#64748B",

    marginBottom: 15,

  },



  tarjetaPaciente: {

    backgroundColor: "#F8FAFC",

    borderWidth: 1,

    borderColor: "#DBEAFE",

    borderRadius: 12,

    padding: 16,

    marginBottom: 12,

  },



  nombrePaciente: {

    fontSize: 16,

    fontWeight: "800",

    color: "#19385F",

    marginBottom: 10,

  },



  nombrePacienteGrande: {

    fontSize: 21,

    fontWeight: "800",

    color: "#19385F",

    marginBottom: 15,

  },



  dato: {

    fontSize: 13,

    color: "#475569",

    marginBottom: 8,

  },



  botones: {

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 10,

    marginTop: 12,

  },



  botonPrincipal: {

    backgroundColor: "#2563EB",

    paddingHorizontal: 17,

    paddingVertical: 13,

    borderRadius: 9,

    alignSelf: "flex-start",

    marginTop: 10,

    alignItems: "center",

  },



  botonPrincipalTexto: {

    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "800",

  },



  botonSecundario: {

    backgroundColor: "#E2E8F0",

    paddingHorizontal: 17,

    paddingVertical: 13,

    borderRadius: 9,

    alignSelf: "flex-start",

    marginTop: 10,

  },



  botonSecundarioTexto: {

    color: "#19385F",

    fontSize: 13,

    fontWeight: "800",

  },



  tarjetaRegistro: {

    backgroundColor: "#F8FAFC",

    borderWidth: 1,

    borderColor: "#DBEAFE",

    borderRadius: 11,

    padding: 14,

    marginBottom: 12,

  },



  tituloRegistro: {

    fontSize: 14,

    fontWeight: "800",

    color: "#1D4ED8",

    marginBottom: 12,

  },



  filaDato: {

    marginBottom: 9,

    borderBottomWidth: 1,

    borderBottomColor: "#E2E8F0",

    paddingBottom: 7,

  },



  etiquetaDato: {

    fontSize: 11,

    color: "#64748B",

    fontWeight: "700",

    marginBottom: 4,

  },



  valorDato: {

    fontSize: 13,

    color: "#19385F",

  },



  resumenContenedor: {

    flexDirection: "row",

    flexWrap: "wrap",

    gap: 10,

  },



  resumenItem: {

    backgroundColor: "#EFF6FF",

    borderRadius: 10,

    padding: 13,

    flexBasis: "45%",

    flexGrow: 1,

    alignItems: "center",

  },



  resumenNumero: {

    fontSize: 23,

    fontWeight: "800",

    color: "#19385F",

  },



  resumenTexto: {

    fontSize: 11,

    color: "#64748B",

    marginTop: 6,

    textAlign: "center",

  },



  error: {

    backgroundColor: "#FEF2F2",

    borderWidth: 1,

    borderColor: "#FECACA",

    borderRadius: 11,

    padding: 15,

    marginBottom: 15,

  },



  errorTexto: {

    color: "#B91C1C",

    fontSize: 14,

    fontWeight: "800",

    marginBottom: 6,

  },



  errorDetalle: {

    color: "#991B1B",

    fontSize: 12,

    lineHeight: 19,

  },



  sinDatos: {

    fontSize: 13,

    color: "#64748B",

    textAlign: "center",

    paddingVertical: 18,

  },

});