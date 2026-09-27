import {
  doc,
  getDoc,
  serverTimestamp,
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
// OBTENER CONFIGURACIÓN
// =====================================================

export async function obtenerConfiguracionAnalisis(
  analisisId,
  laboratorioId
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
      "No puedes consultar análisis de otro laboratorio."
    );
  }


  const configuracion =
    datos.configuracion &&
    typeof datos.configuracion ===
      "object"
      ? datos.configuracion
      : {};


  return {

    tipoMuestra:
      limpiarTexto(
        configuracion.tipoMuestra
      ),

    preparacionPaciente:
      limpiarTexto(
        configuracion.preparacionPaciente
      ),

    requiereAyuno:
      configuracion.requiereAyuno ===
      true,

    horasAyuno:
      Number(
        configuracion.horasAyuno ||
        0
      ),

    tiempoEntrega:
      limpiarTexto(
        configuracion.tiempoEntrega
      ),

    instrucciones:
      limpiarTexto(
        configuracion.instrucciones
      ),

    fechaActualizacion:
      configuracion.fechaActualizacion ||
      null,
  };
}


// =====================================================
// GUARDAR CONFIGURACIÓN
// =====================================================

export async function guardarConfiguracionAnalisis(
  analisisId,
  laboratorioId,
  configuracion
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


  // ===================================================
  // VALIDACIONES
  // ===================================================

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
      horasAyuno <= 0 ||
      horasAyuno > 48
    )
  ) {
    throw new Error(
      "Las horas de ayuno deben ser mayores a 0 y menores o iguales a 48."
    );
  }


  // ===================================================
  // COMPROBAR ANÁLISIS
  // ===================================================

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


  // ===================================================
  // GUARDAR
  // ===================================================

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

        fechaActualizacion:
          serverTimestamp(),
      },
    }
  );
}