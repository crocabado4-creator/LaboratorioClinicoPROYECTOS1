import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


export type ConfiguracionAnalisis = {
  tipoMuestra: string;
  preparacionPaciente: string;
  requiereAyuno: boolean;
  horasAyuno: number;
  tiempoEntrega: string;
  instrucciones: string;
};


export type RangoReferencia = {
  tipo: "numerico" | "texto";
  minimo: number | null;
  maximo: number | null;
  textoReferencia: string;
  observaciones: string;
};


export type ParametroAnalisis = {
  parametroId: string;
  nombre: string;
  unidad: string;
  descripcion: string;
  activo: boolean;
  rangoReferencia: RangoReferencia | null;
};


export type AnalisisClinico = {
  id: string;
  analisisId: string;
  laboratorioId: string;
  nombre: string;
  descripcion: string;
  precio: number;
  unidad: string;
  tipo: string;
  activo: boolean;
  configuracion: ConfiguracionAnalisis;
  parametros: ParametroAnalisis[];
  fechaRegistro?: unknown;
  fechaActualizacion?: unknown;
};


export type DatosAnalisis = {
  nombre: string;
  descripcion: string;
  precio: number;
  unidad?: string;
  tipo: string;
  activo: boolean;
};


const COLECCION =
  "analisis";


const CONFIGURACION_VACIA:
  ConfiguracionAnalisis = {
    tipoMuestra: "",
    preparacionPaciente: "",
    requiereAyuno: false,
    horasAyuno: 0,
    tiempoEntrega: "",
    instrucciones: "",
  };


function limpiarTexto(
  valor: unknown
): string {
  return typeof valor ===
    "string"
    ? valor.trim()
    : "";
}


function normalizarRangoReferencia(
  valor: unknown
): RangoReferencia | null {
  if (
    !valor ||
    typeof valor !==
      "object"
  ) {
    return null;
  }


  const datos =
    valor as Record<
      string,
      unknown
    >;


  const minimo =
    typeof datos.minimo ===
      "number"
      ? datos.minimo
      : null;


  const maximo =
    typeof datos.maximo ===
      "number"
      ? datos.maximo
      : null;


  const textoReferencia =
    limpiarTexto(
      datos.textoReferencia
    );


  const observaciones =
    limpiarTexto(
      datos.observaciones
    );


  const tieneDatos =
    minimo !== null ||
    maximo !== null ||
    textoReferencia !== "" ||
    observaciones !== "";


  if (!tieneDatos) {
    return null;
  }


  return {
    tipo:
      datos.tipo ===
      "texto"
        ? "texto"
        : "numerico",

    minimo,
    maximo,
    textoReferencia,
    observaciones,
  };
}


function normalizarParametros(
  valor: unknown
): ParametroAnalisis[] {
  if (
    !Array.isArray(
      valor
    )
  ) {
    return [];
  }


  return valor
    .map(
      (
        item
      ): ParametroAnalisis | null => {
        if (
          !item ||
          typeof item !==
            "object"
        ) {
          return null;
        }


        const datos =
          item as Record<
            string,
            unknown
          >;


        const parametroId =
          limpiarTexto(
            datos.parametroId
          );


        const nombre =
          limpiarTexto(
            datos.nombre
          );


        if (
          !parametroId ||
          !nombre
        ) {
          return null;
        }


        return {
          parametroId,
          nombre,

          unidad:
            limpiarTexto(
              datos.unidad
            ),

          descripcion:
            limpiarTexto(
              datos.descripcion
            ),

          activo:
            datos.activo !==
            false,

          rangoReferencia:
            normalizarRangoReferencia(
              datos.rangoReferencia
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is ParametroAnalisis =>
        item !== null
    );
}


function normalizarConfiguracion(
  valor: unknown
): ConfiguracionAnalisis {
  if (
    !valor ||
    typeof valor !==
      "object"
  ) {
    return {
      ...CONFIGURACION_VACIA,
    };
  }


  const datos =
    valor as Record<
      string,
      unknown
    >;


  return {
    tipoMuestra:
      limpiarTexto(
        datos.tipoMuestra
      ),

    preparacionPaciente:
      limpiarTexto(
        datos.preparacionPaciente
      ),

    requiereAyuno:
      datos.requiereAyuno ===
      true,

    horasAyuno:
      typeof datos.horasAyuno ===
        "number"
        ? datos.horasAyuno
        : 0,

    tiempoEntrega:
      limpiarTexto(
        datos.tiempoEntrega
      ),

    instrucciones:
      limpiarTexto(
        datos.instrucciones
      ),
  };
}


function validarDatos(
  datos: DatosAnalisis
) {
  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const descripcion =
    limpiarTexto(
      datos.descripcion
    );

  const tipo =
    limpiarTexto(
      datos.tipo
    );

  const unidad =
    limpiarTexto(
      datos.unidad
    );

  const precio =
    Number(
      datos.precio
    );


  if (!nombre) {
    throw new Error(
      "El nombre del análisis es obligatorio."
    );
  }


  if (!descripcion) {
    throw new Error(
      "La descripción es obligatoria."
    );
  }


  if (!tipo) {
    throw new Error(
      "El tipo de análisis es obligatorio."
    );
  }


  if (
    Number.isNaN(
      precio
    ) ||
    precio < 0
  ) {
    throw new Error(
      "El precio debe ser un número mayor o igual a 0."
    );
  }


  return {
    nombre,
    descripcion,
    tipo,
    unidad,
    precio,
    activo:
      datos.activo ===
      true,
  };
}


async function obtenerDocumento(
  analisisId: string,
  laboratorioId: string
) {
  const idAnalisis =
    limpiarTexto(
      analisisId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idAnalisis) {
    throw new Error(
      "No se pudo identificar el análisis."
    );
  }


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION,
      idAnalisis
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (
    !resultado.exists()
  ) {
    throw new Error(
      "El análisis seleccionado no existe."
    );
  }


  const datos =
    resultado.data();


  if (
    limpiarTexto(
      datos.laboratorioId
    ) !==
    idLaboratorio
  ) {
    throw new Error(
      "No puedes acceder a análisis de otro laboratorio."
    );
  }


  return {
    referencia,
    datos,
  };
}


export async function obtenerAnalisis(
  laboratorioId: string
): Promise<AnalisisClinico[]> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idLaboratorio) {
    return [];
  }


  const consulta =
    query(
      collection(
        db,
        COLECCION
      ),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );


  const resultado =
    await getDocs(
      consulta
    );


  const lista:
    AnalisisClinico[] =
    resultado.docs.map(
      (documento) => {
        const datos =
          documento.data();

        return {
          id:
            documento.id,

          analisisId:
            limpiarTexto(
              datos.analisisId
            ) ||
            documento.id,

          laboratorioId:
            limpiarTexto(
              datos.laboratorioId
            ),

          nombre:
            limpiarTexto(
              datos.nombre
            ),

          descripcion:
            limpiarTexto(
              datos.descripcion
            ),

          precio:
            typeof datos.precio ===
              "number"
              ? datos.precio
              : 0,

          unidad:
            limpiarTexto(
              datos.unidad
            ),

          tipo:
            limpiarTexto(
              datos.tipo
            ),

          activo:
            datos.activo !==
            false,

          configuracion:
            normalizarConfiguracion(
              datos.configuracion
            ),

          parametros:
            normalizarParametros(
              datos.parametros
            ),

          fechaRegistro:
            datos.fechaRegistro,

          fechaActualizacion:
            datos.fechaActualizacion,
        };
      }
    );


  lista.sort(
    (a, b) =>
      a.nombre.localeCompare(
        b.nombre,
        "es",
        {
          sensitivity:
            "base",
        }
      )
  );


  return lista;
}


async function validarDuplicado(
  laboratorioId: string,
  nombre: string,
  ignorarId = ""
) {
  const lista =
    await obtenerAnalisis(
      laboratorioId
    );


  const nombreNormalizado =
    limpiarTexto(
      nombre
    ).toLocaleLowerCase(
      "es"
    );


  const existe =
    lista.some(
      (item) =>
        item.id !==
          ignorarId &&
        item.nombre
          .trim()
          .toLocaleLowerCase(
            "es"
          ) ===
          nombreNormalizado
    );


  if (existe) {
    throw new Error(
      "Ya existe un análisis con ese nombre en este laboratorio."
    );
  }
}


export async function crearAnalisis(
  laboratorioId: string,
  datos: DatosAnalisis
): Promise<string> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  const datosLimpios =
    validarDatos(
      datos
    );


  await validarDuplicado(
    idLaboratorio,
    datosLimpios.nombre
  );


  const referencia =
    doc(
      collection(
        db,
        COLECCION
      )
    );


  await setDoc(
    referencia,
    {
      analisisId:
        referencia.id,

      laboratorioId:
        idLaboratorio,

      ...datosLimpios,

      configuracion: {
        ...CONFIGURACION_VACIA,
      },

      parametros:
        [],

      fechaRegistro:
        serverTimestamp(),

      fechaActualizacion:
        serverTimestamp(),
    }
  );


  return referencia.id;
}


export async function actualizarAnalisis(
  analisisId: string,
  laboratorioId: string,
  datos: DatosAnalisis
): Promise<void> {
  const {
    referencia,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const datosLimpios =
    validarDatos(
      datos
    );


  await validarDuplicado(
    laboratorioId,
    datosLimpios.nombre,
    analisisId
  );


  await updateDoc(
    referencia,
    {
      ...datosLimpios,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}


export async function cambiarEstadoAnalisis(
  analisisId: string,
  laboratorioId: string,
  activo: boolean
): Promise<void> {
  const {
    referencia,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  await updateDoc(
    referencia,
    {
      activo:
        activo === true,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}


export async function guardarConfiguracionAnalisis(
  analisisId: string,
  laboratorioId: string,
  configuracion: ConfiguracionAnalisis
): Promise<void> {
  const {
    referencia,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const tipoMuestra =
    limpiarTexto(
      configuracion.tipoMuestra
    );

  const preparacionPaciente =
    limpiarTexto(
      configuracion.preparacionPaciente
    );

  const tiempoEntrega =
    limpiarTexto(
      configuracion.tiempoEntrega
    );

  const instrucciones =
    limpiarTexto(
      configuracion.instrucciones
    );

  const requiereAyuno =
    configuracion.requiereAyuno ===
    true;

  const horasAyuno =
    requiereAyuno
      ? Number(
          configuracion.horasAyuno
        )
      : 0;


  if (!tipoMuestra) {
    throw new Error(
      "El tipo de muestra es obligatorio."
    );
  }


  if (!tiempoEntrega) {
    throw new Error(
      "El tiempo de entrega es obligatorio."
    );
  }


  if (
    requiereAyuno &&
    (
      Number.isNaN(
        horasAyuno
      ) ||
      horasAyuno < 1 ||
      horasAyuno > 48
    )
  ) {
    throw new Error(
      "Las horas de ayuno deben estar entre 1 y 48."
    );
  }


  await updateDoc(
    referencia,
    {
      configuracion: {
        tipoMuestra,
        preparacionPaciente,
        requiereAyuno,
        horasAyuno,
        tiempoEntrega,
        instrucciones,
      },

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}



function generarParametroId(): string {
  return `param_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}


export async function crearParametroAnalisis(
  analisisId: string,
  laboratorioId: string,
  datosParametro: {
    nombre: string;
    unidad: string;
    descripcion: string;
  }
): Promise<string> {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const nombre =
    limpiarTexto(
      datosParametro.nombre
    );


  const unidad =
    limpiarTexto(
      datosParametro.unidad
    );


  const descripcion =
    limpiarTexto(
      datosParametro.descripcion
    );


  if (!nombre) {
    throw new Error(
      "El nombre del parámetro es obligatorio."
    );
  }


  if (!unidad) {
    throw new Error(
      "La unidad del parámetro es obligatoria."
    );
  }


  const parametros =
    normalizarParametros(
      datos.parametros
    );


  const nombreNormalizado =
    nombre.toLocaleLowerCase(
      "es"
    );


  const duplicado =
    parametros.some(
      (item) =>
        item.nombre
          .trim()
          .toLocaleLowerCase(
            "es"
          ) ===
        nombreNormalizado
    );


  if (duplicado) {
    throw new Error(
      "Ya existe un parámetro con ese nombre."
    );
  }


  const parametroId =
    generarParametroId();


  const nuevoParametro:
    ParametroAnalisis = {
      parametroId,
      nombre,
      unidad,
      descripcion,
      activo: true,
      rangoReferencia:
        null,
    };


  await updateDoc(
    referencia,
    {
      parametros: [
        ...parametros,
        nuevoParametro,
      ],

      fechaActualizacion:
        serverTimestamp(),
    }
  );


  return parametroId;
}


export async function actualizarParametroAnalisis(
  analisisId: string,
  laboratorioId: string,
  parametroId: string,
  datosParametro: {
    nombre: string;
    unidad: string;
    descripcion: string;
  }
): Promise<void> {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const idParametro =
    limpiarTexto(
      parametroId
    );


  const nombre =
    limpiarTexto(
      datosParametro.nombre
    );


  const unidad =
    limpiarTexto(
      datosParametro.unidad
    );


  const descripcion =
    limpiarTexto(
      datosParametro.descripcion
    );


  if (!idParametro) {
    throw new Error(
      "No se pudo identificar el parámetro."
    );
  }


  if (!nombre) {
    throw new Error(
      "El nombre del parámetro es obligatorio."
    );
  }


  if (!unidad) {
    throw new Error(
      "La unidad del parámetro es obligatoria."
    );
  }


  const parametros =
    normalizarParametros(
      datos.parametros
    );


  const existente =
    parametros.find(
      (item) =>
        item.parametroId ===
        idParametro
    );


  if (!existente) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  const nombreNormalizado =
    nombre.toLocaleLowerCase(
      "es"
    );


  const duplicado =
    parametros.some(
      (item) =>
        item.parametroId !==
          idParametro &&
        item.nombre
          .trim()
          .toLocaleLowerCase(
            "es"
          ) ===
          nombreNormalizado
    );


  if (duplicado) {
    throw new Error(
      "Ya existe otro parámetro con ese nombre."
    );
  }


  const actualizados =
    parametros.map(
      (item) =>
        item.parametroId ===
        idParametro
          ? {
              ...item,
              nombre,
              unidad,
              descripcion,
            }
          : item
    );


  await updateDoc(
    referencia,
    {
      parametros:
        actualizados,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}


export async function eliminarParametroAnalisis(
  analisisId: string,
  laboratorioId: string,
  parametroId: string
): Promise<void> {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const idParametro =
    limpiarTexto(
      parametroId
    );


  if (!idParametro) {
    throw new Error(
      "No se pudo identificar el parámetro."
    );
  }


  const parametros =
    normalizarParametros(
      datos.parametros
    );


  const existe =
    parametros.some(
      (item) =>
        item.parametroId ===
        idParametro
    );


  if (!existe) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  const actualizados =
    parametros.filter(
      (item) =>
        item.parametroId !==
        idParametro
    );


  await updateDoc(
    referencia,
    {
      parametros:
        actualizados,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}



export async function guardarRangoReferencia(
  analisisId: string,
  laboratorioId: string,
  parametroId: string,
  rango: RangoReferencia
): Promise<void> {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const idParametro =
    limpiarTexto(
      parametroId
    );


  if (!idParametro) {
    throw new Error(
      "No se pudo identificar el parámetro."
    );
  }


  const parametros =
    normalizarParametros(
      datos.parametros
    );


  const existe =
    parametros.some(
      (item) =>
        item.parametroId ===
        idParametro
    );


  if (!existe) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  const tipo:
    "numerico" | "texto" =
    rango.tipo ===
    "texto"
      ? "texto"
      : "numerico";


  let minimo:
    number | null =
    null;

  let maximo:
    number | null =
    null;

  let textoReferencia =
    limpiarTexto(
      rango.textoReferencia
    );


  if (
    tipo ===
    "numerico"
  ) {
    minimo =
      rango.minimo ===
      null ||
      rango.minimo ===
      undefined
        ? null
        : Number(
            rango.minimo
          );

    maximo =
      rango.maximo ===
      null ||
      rango.maximo ===
      undefined
        ? null
        : Number(
            rango.maximo
          );


    if (
      minimo === null ||
      Number.isNaN(
        minimo
      )
    ) {
      throw new Error(
        "El valor mínimo es obligatorio."
      );
    }


    if (
      maximo === null ||
      Number.isNaN(
        maximo
      )
    ) {
      throw new Error(
        "El valor máximo es obligatorio."
      );
    }


    if (
      minimo >
      maximo
    ) {
      throw new Error(
        "El valor mínimo no puede ser mayor al máximo."
      );
    }


    textoReferencia =
      "";

  } else {
    if (
      !textoReferencia
    ) {
      throw new Error(
        "La referencia cualitativa es obligatoria."
      );
    }


    minimo =
      null;

    maximo =
      null;
  }


  const rangoLimpio:
    RangoReferencia = {
      tipo,
      minimo,
      maximo,
      textoReferencia,

      observaciones:
        limpiarTexto(
          rango.observaciones
        ),
    };


  const actualizados =
    parametros.map(
      (item) =>
        item.parametroId ===
        idParametro
          ? {
              ...item,
              rangoReferencia:
                rangoLimpio,
            }
          : item
    );


  await updateDoc(
    referencia,
    {
      parametros:
        actualizados,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}


export async function eliminarRangoReferencia(
  analisisId: string,
  laboratorioId: string,
  parametroId: string
): Promise<void> {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumento(
      analisisId,
      laboratorioId
    );


  const idParametro =
    limpiarTexto(
      parametroId
    );


  if (!idParametro) {
    throw new Error(
      "No se pudo identificar el parámetro."
    );
  }


  const parametros =
    normalizarParametros(
      datos.parametros
    );


  const existe =
    parametros.some(
      (item) =>
        item.parametroId ===
        idParametro
    );


  if (!existe) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  const actualizados =
    parametros.map(
      (item) =>
        item.parametroId ===
        idParametro
          ? {
              ...item,
              rangoReferencia:
                null,
            }
          : item
    );


  await updateDoc(
    referencia,
    {
      parametros:
        actualizados,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}
