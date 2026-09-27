import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLECCION = "analisis";


// =====================================================
// LIMPIAR TEXTO
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


// =====================================================
// GENERAR ID
// =====================================================

function generarParametroId() {
  return `param_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}


// =====================================================
// OBTENER DOCUMENTO DEL ANÁLISIS
// =====================================================

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
// OBTENER PARÁMETROS
// =====================================================

export async function obtenerParametrosAnalisis(
  analisisId,
  laboratorioId
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


  return parametros.map(
    (parametro) => ({
      parametroId:
        limpiarTexto(
          parametro.parametroId
        ),

      nombre:
        limpiarTexto(
          parametro.nombre
        ),

      unidad:
        limpiarTexto(
          parametro.unidad
        ),

      descripcion:
        limpiarTexto(
          parametro.descripcion
        ),

      activo:
        parametro.activo !== false,

      rangoReferencia:
        parametro.rangoReferencia &&
        typeof parametro.rangoReferencia ===
          "object"
          ? parametro.rangoReferencia
          : null,
    })
  );
}


// =====================================================
// CREAR PARÁMETRO
// =====================================================

export async function crearParametroAnalisis(
  analisisId,
  laboratorioId,
  datosParametro
) {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumentoAnalisis(
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
    Array.isArray(
      datos.parametros
    )
      ? [...datos.parametros]
      : [];


  const duplicado =
    parametros.some(
      (parametro) =>
        limpiarTexto(
          parametro.nombre
        ).toLowerCase() ===
        nombre.toLowerCase()
    );


  if (duplicado) {
    throw new Error(
      "Ya existe un parámetro con ese nombre en este análisis."
    );
  }


  const nuevoParametro = {
    parametroId:
      generarParametroId(),

    nombre,

    unidad,

    descripcion,

    activo: true,

    rangoReferencia: null,
  };


  parametros.push(
    nuevoParametro
  );


  await updateDoc(
    referencia,
    {
      parametros,
    }
  );


  return nuevoParametro.parametroId;
}


// =====================================================
// ACTUALIZAR PARÁMETRO
// =====================================================

export async function actualizarParametroAnalisis(
  analisisId,
  laboratorioId,
  parametroId,
  datosParametro
) {
  const {
    referencia,
    datos,
  } =
    await obtenerDocumentoAnalisis(
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
      "Parámetro inválido."
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
    Array.isArray(
      datos.parametros
    )
      ? [...datos.parametros]
      : [];


  const indice =
    parametros.findIndex(
      (parametro) =>
        parametro.parametroId ===
        idParametro
    );


  if (indice === -1) {
    throw new Error(
      "El parámetro no existe."
    );
  }


  const duplicado =
    parametros.some(
      (parametro) =>
        parametro.parametroId !==
          idParametro &&
        limpiarTexto(
          parametro.nombre
        ).toLowerCase() ===
          nombre.toLowerCase()
    );


  if (duplicado) {
    throw new Error(
      "Ya existe otro parámetro con ese nombre."
    );
  }


  parametros[indice] = {
    ...parametros[indice],

    nombre,

    unidad,

    descripcion,

    activo:
      datosParametro.activo !==
      false,
  };


  await updateDoc(
    referencia,
    {
      parametros,
    }
  );
}


// =====================================================
// ELIMINAR PARÁMETRO
// =====================================================

export async function eliminarParametroAnalisis(
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


  const idParametro =
    limpiarTexto(
      parametroId
    );


  if (!idParametro) {
    throw new Error(
      "Parámetro inválido."
    );
  }


  const parametros =
    Array.isArray(
      datos.parametros
    )
      ? [...datos.parametros]
      : [];


  const existe =
    parametros.some(
      (parametro) =>
        parametro.parametroId ===
        idParametro
    );


  if (!existe) {
    throw new Error(
      "El parámetro no existe."
    );
  }


  const nuevosParametros =
    parametros.filter(
      (parametro) =>
        parametro.parametroId !==
        idParametro
    );


  await updateDoc(
    referencia,
    {
      parametros:
        nuevosParametros,
    }
  );
}