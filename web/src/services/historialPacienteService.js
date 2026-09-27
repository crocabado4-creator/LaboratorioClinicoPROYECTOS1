import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


// =====================================================
// HISTORIAL DEL PACIENTE
// HU-11
// =====================================================

export async function obtenerHistorialPaciente(
  laboratorioId,
  pacienteId
) {
  if (!laboratorioId) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }

  if (!pacienteId) {
    throw new Error(
      "No se pudo identificar al paciente."
    );
  }


  // ===================================================
  // CONSULTAR SOLICITUDES
  // ===================================================

  const consultaSolicitudes =
    query(
      collection(
        db,
        "solicitudes"
      ),

      where(
        "laboratorioId",
        "==",
        laboratorioId
      ),

      where(
        "pacienteId",
        "==",
        pacienteId
      )
    );


  // ===================================================
  // CONSULTAR RESULTADOS
  //
  // IMPORTANTE:
  // En tu BD la colección existente es "resultado"
  // en singular.
  // ===================================================

  const consultaResultados =
    query(
      collection(
        db,
        "resultado"
      ),

      where(
        "laboratorioId",
        "==",
        laboratorioId
      ),

      where(
        "pacienteId",
        "==",
        pacienteId
      )
    );


  const [
    resultadoSolicitudes,
    resultadoResultados,
  ] =
    await Promise.all([
      getDocs(
        consultaSolicitudes
      ),

      getDocs(
        consultaResultados
      ),
    ]);


  // ===================================================
  // CONVERTIR SOLICITUDES
  // ===================================================

  const solicitudes =
    resultadoSolicitudes.docs
      .map(
        (documento) => {
          const datos =
            documento.data();

          return {
            id:
              documento.id,

            solicitudId:
              datos.solicitudId ||
              documento.id,

            laboratorioId:
              datos.laboratorioId ||
              "",

            pacienteId:
              datos.pacienteId ||
              "",

            empleadoId:
              datos.empleadoId ||
              "",

            fecha:
              datos.fecha ||
              null,

            estado:
              datos.estado ||
              "pendiente",

            total:
              Number(
                datos.total ||
                0
              ),

            analisis:
              Array.isArray(
                datos.analisis
              )
                ? datos.analisis
                : [],
          };
        }
      )
      .sort(
        (a, b) =>
          obtenerMilisegundos(
            b.fecha
          ) -
          obtenerMilisegundos(
            a.fecha
          )
      );


  // ===================================================
  // CONVERTIR RESULTADOS
  // ===================================================

  const resultados =
    resultadoResultados.docs
      .map(
        (documento) => {
          const datos =
            documento.data();

          return {
            id:
              documento.id,

            resultadoId:
              datos.resultadoId ||
              documento.id,

            laboratorioId:
              datos.laboratorioId ||
              "",

            solicitudId:
              datos.solicitudId ||
              "",

            pacienteId:
              datos.pacienteId ||
              "",

            analisisId:
              datos.analisisId ||
              "",

            valores:
              Array.isArray(
                datos.valores
              )
                ? datos.valores
                : [],

            observaciones:
              datos.observaciones ||
              "",

            fechaRegistro:
              datos.fechaRegistro ||
              null,

            estado:
              datos.estado ||
              "pendiente",
          };
        }
      )
      .sort(
        (a, b) =>
          obtenerMilisegundos(
            b.fechaRegistro
          ) -
          obtenerMilisegundos(
            a.fechaRegistro
          )
      );


  return {
    solicitudes,
    resultados,
  };
}


// =====================================================
// OBTENER MILISEGUNDOS
// =====================================================

function obtenerMilisegundos(
  valor
) {
  if (!valor) {
    return 0;
  }


  try {

    if (
      typeof valor.toDate ===
      "function"
    ) {
      return valor
        .toDate()
        .getTime();
    }


    if (
      valor.seconds
    ) {
      return (
        valor.seconds *
        1000
      );
    }


    const fecha =
      new Date(
        valor
      );


    if (
      Number.isNaN(
        fecha.getTime()
      )
    ) {
      return 0;
    }


    return fecha.getTime();

  } catch {
    return 0;
  }
}