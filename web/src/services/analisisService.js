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

import { db } from "../firebase/firebase";


// =====================================================
// COLECCIÓN
// =====================================================

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
// CONVERTIR DOCUMENTO
// =====================================================

function convertirAnalisis(documento) {
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
      Number(
        datos.precio ||
        0
      ),

    unidad:
      limpiarTexto(
        datos.unidad
      ),

    tipo:
      limpiarTexto(
        datos.tipo
      ),

    activo:
      datos.activo !== false,

    fechaRegistro:
      datos.fechaRegistro ||
      null,
  };
}


// =====================================================
// VALIDAR
// =====================================================

function validarAnalisis(datos) {

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
    Number.isNaN(precio) ||
    precio < 0
  ) {
    throw new Error(
      "El precio del análisis no es válido."
    );
  }
}


// =====================================================
// COMPROBAR NOMBRE DUPLICADO
// =====================================================

async function existeNombreAnalisis(
  laboratorioId,
  nombre,
  ignorarAnalisisId = ""
) {

  const consulta =
    query(
      collection(
        db,
        COLECCION
      ),

      where(
        "laboratorioId",
        "==",
        laboratorioId
      )
    );


  const resultado =
    await getDocs(
      consulta
    );


  const nombreNormalizado =
    limpiarTexto(nombre)
      .toLowerCase();


  return resultado.docs.some(
    (documento) => {

      if (
        documento.id ===
        ignorarAnalisisId
      ) {
        return false;
      }


      const datos =
        documento.data();


      return limpiarTexto(
        datos.nombre
      )
        .toLowerCase() ===
        nombreNormalizado;
    }
  );
}


// =====================================================
// LISTAR ANÁLISIS DEL LABORATORIO
// =====================================================

export async function obtenerAnalisis(
  laboratorioId
) {

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
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


  return resultado.docs
    .map(
      convertirAnalisis
    )
    .sort(
      (a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          "es"
        )
    );
}


// =====================================================
// OBTENER UNO
// =====================================================

export async function obtenerAnalisisPorId(
  analisisId
) {

  const id =
    limpiarTexto(
      analisisId
    );


  if (!id) {
    return null;
  }


  const referencia =
    doc(
      db,
      COLECCION,
      id
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (!resultado.exists()) {
    return null;
  }


  return convertirAnalisis(
    resultado
  );
}


// =====================================================
// CREAR
// =====================================================

export async function crearAnalisis(
  laboratorioId,
  datos
) {

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  validarAnalisis(
    datos
  );


  const nombre =
    limpiarTexto(
      datos.nombre
    );


  const duplicado =
    await existeNombreAnalisis(
      idLaboratorio,
      nombre
    );


  if (duplicado) {
    throw new Error(
      "Ya existe un análisis con ese nombre en este laboratorio."
    );
  }


  const referencia =
    doc(
      collection(
        db,
        COLECCION
      )
    );


  const nuevoAnalisis = {

    analisisId:
      referencia.id,

    laboratorioId:
      idLaboratorio,

    nombre,

    descripcion:
      limpiarTexto(
        datos.descripcion
      ),

    precio:
      Number(
        datos.precio ||
        0
      ),

    unidad:
      limpiarTexto(
        datos.unidad
      ),

    tipo:
      limpiarTexto(
        datos.tipo
      ),

    activo:
      datos.activo !== false,

    fechaRegistro:
      serverTimestamp(),
  };


  await setDoc(
    referencia,
    nuevoAnalisis
  );


  return referencia.id;
}


// =====================================================
// ACTUALIZAR
// =====================================================

export async function actualizarAnalisis(
  analisisId,
  laboratorioId,
  datos
) {

  const id =
    limpiarTexto(
      analisisId
    );


  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!id) {
    throw new Error(
      "Análisis inválido."
    );
  }


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  validarAnalisis(
    datos
  );


  const referencia =
    doc(
      db,
      COLECCION,
      id
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (!resultado.exists()) {
    throw new Error(
      "El análisis no existe."
    );
  }


  const actual =
    resultado.data();


  if (
    actual.laboratorioId !==
    idLaboratorio
  ) {
    throw new Error(
      "No puedes modificar análisis de otro laboratorio."
    );
  }


  const nombre =
    limpiarTexto(
      datos.nombre
    );


  const duplicado =
    await existeNombreAnalisis(
      idLaboratorio,
      nombre,
      id
    );


  if (duplicado) {
    throw new Error(
      "Ya existe otro análisis con ese nombre."
    );
  }


  await updateDoc(
    referencia,
    {

      nombre,

      descripcion:
        limpiarTexto(
          datos.descripcion
        ),

      precio:
        Number(
          datos.precio ||
          0
        ),

      unidad:
        limpiarTexto(
          datos.unidad
        ),

      tipo:
        limpiarTexto(
          datos.tipo
        ),

      activo:
        datos.activo !== false,
    }
  );
}


// =====================================================
// ACTIVAR / DESACTIVAR
// =====================================================

export async function cambiarEstadoAnalisis(
  analisisId,
  laboratorioId,
  activo
) {

  const id =
    limpiarTexto(
      analisisId
    );


  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!id) {
    throw new Error(
      "Análisis inválido."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION,
      id
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (!resultado.exists()) {
    throw new Error(
      "El análisis no existe."
    );
  }


  const actual =
    resultado.data();


  if (
    actual.laboratorioId !==
    idLaboratorio
  ) {
    throw new Error(
      "No puedes modificar análisis de otro laboratorio."
    );
  }


  await updateDoc(
    referencia,
    {
      activo:
        activo === true,
    }
  );
}