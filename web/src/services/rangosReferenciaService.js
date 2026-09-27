import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLECCION = "analisis";


function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


async function obtenerDocumentoAnalisis(
  analisisId,
  laboratorioId
) {
  const idAnalisis =
    limpiarTexto(analisisId);

  const idLaboratorio =
    limpiarTexto(laboratorioId);


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


  if (!resultado.exists()) {
    throw new Error(
      "El análisis seleccionado no existe."
    );
  }


  const datos =
    resultado.data();


  if (
    datos.laboratorioId !==
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


// =====================================================
// OBTENER RANGO DE UN PARÁMETRO
// =====================================================

export async function obtenerRangoReferencia(
  analisisId,
  laboratorioId,
  parametroId
) {
  const {
    datos,
  } =
    await obtenerDocumentoAnalisis(
      analisisId,
      laboratorioId
    );


  const parametros =
    Array.isArray(
      datos.parametros
    )
      ? datos.parametros
      : [];


  const parametro =
    parametros.find(
      (item) =>
        item.parametroId ===
        parametroId
    );


  if (!parametro) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  const rango =
    parametro.rangoReferencia &&
    typeof parametro.rangoReferencia ===
      "object"
      ? parametro.rangoReferencia
      : {};


  return {
    tipo:
      limpiarTexto(
        rango.tipo
      ) || "numerico",

    minimo:
      rango.minimo ??
      "",

    maximo:
      rango.maximo ??
      "",

    textoReferencia:
      limpiarTexto(
        rango.textoReferencia
      ),

    observaciones:
      limpiarTexto(
        rango.observaciones
      ),
  };
}


// =====================================================
// GUARDAR / ACTUALIZAR RANGO
// =====================================================

export async function guardarRangoReferencia(
  analisisId,
  laboratorioId,
  parametroId,
  datosRango
) {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumentoAnalisis(
      analisisId,
      laboratorioId
    );


  const parametros =
    Array.isArray(
      datos.parametros
    )
      ? [...datos.parametros]
      : [];


  const indice =
    parametros.findIndex(
      (item) =>
        item.parametroId ===
        parametroId
    );


  if (indice === -1) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  const tipo =
    limpiarTexto(
      datosRango.tipo
    ) || "numerico";


  const textoReferencia =
    limpiarTexto(
      datosRango.textoReferencia
    );


  const observaciones =
    limpiarTexto(
      datosRango.observaciones
    );


  let minimo = null;
  let maximo = null;


  if (tipo === "numerico") {

    if (
      datosRango.minimo ===
        "" ||
      datosRango.maximo ===
        ""
    ) {
      throw new Error(
        "Debes ingresar el valor mínimo y máximo."
      );
    }


    minimo =
      Number(
        datosRango.minimo
      );


    maximo =
      Number(
        datosRango.maximo
      );


    if (
      Number.isNaN(minimo) ||
      Number.isNaN(maximo)
    ) {
      throw new Error(
        "El rango mínimo y máximo deben ser números válidos."
      );
    }


    if (
      minimo >
      maximo
    ) {
      throw new Error(
        "El valor mínimo no puede ser mayor al valor máximo."
      );
    }
  }


  if (
    tipo === "texto" &&
    !textoReferencia
  ) {
    throw new Error(
      "Debes ingresar el valor o texto de referencia."
    );
  }


  parametros[indice] = {
    ...parametros[indice],

    rangoReferencia: {
      tipo,

      minimo:
        tipo === "numerico"
          ? minimo
          : null,

      maximo:
        tipo === "numerico"
          ? maximo
          : null,

      textoReferencia:
        tipo === "texto"
          ? textoReferencia
          : "",

      observaciones,
    },
  };


  await updateDoc(
    referencia,
    {
      parametros,
    }
  );
}


// =====================================================
// ELIMINAR RANGO
// =====================================================

export async function eliminarRangoReferencia(
  analisisId,
  laboratorioId,
  parametroId
) {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumentoAnalisis(
      analisisId,
      laboratorioId
    );


  const parametros =
    Array.isArray(
      datos.parametros
    )
      ? [...datos.parametros]
      : [];


  const indice =
    parametros.findIndex(
      (item) =>
        item.parametroId ===
        parametroId
    );


  if (indice === -1) {
    throw new Error(
      "El parámetro seleccionado no existe."
    );
  }


  parametros[indice] = {
    ...parametros[indice],

    rangoReferencia: null,
  };


  await updateDoc(
    referencia,
    {
      parametros,
    }
  );
}