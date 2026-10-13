import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// ======================================================
// HU-24 - RECEPCIÓN Y VALIDACIÓN DE MUESTRAS
// ======================================================

const COLECCION = "muestras";

const ESTADOS_PENDIENTES = [
  "tomada",
  "pendiente",
  "registrada",
];

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(valor) {
  return limpiarTexto(valor).toLowerCase();
}

// ======================================================
// OBTENER NOMBRE COMPLETO DEL PACIENTE
// ======================================================

function obtenerNombrePaciente(paciente) {
  if (!paciente) return "";

  const nombre =
    paciente.nombre ||
    paciente.nombres ||
    paciente.primerNombre ||
    "";

  const apellido =
    paciente.apellido ||
    paciente.apellidos ||
    paciente.primerApellido ||
    "";

  return `${nombre} ${apellido}`.trim();
}

// ======================================================
// LISTAR MUESTRAS CON NOMBRE Y APELLIDO
// ======================================================

export async function listarMuestrasValidacion(laboratorioId) {
  const idLaboratorio = limpiarTexto(laboratorioId);

  if (!idLaboratorio) {
    throw new Error("No se identificó el laboratorio.");
  }

  // Obtener muestras
  const consultaMuestras = query(
    collection(db, COLECCION),
    where("laboratorioId", "==", idLaboratorio)
  );

  const resultadoMuestras = await getDocs(consultaMuestras);

  // Obtener pacientes
  const consultaPacientes = query(
    collection(db, "pacientes"),
    where("laboratorioId", "==", idLaboratorio)
  );

  const resultadoPacientes = await getDocs(consultaPacientes);

  // Crear índice de pacientes
  const pacientes = new Map();

  resultadoPacientes.docs.forEach((documento) => {
    const paciente = documento.data();

    const datos = {
      id: documento.id,
      ...paciente,
    };

    // Buscar por ID del documento
    pacientes.set(documento.id, datos);

    // Buscar por pacienteId
    if (paciente.pacienteId) {
      pacientes.set(
        limpiarTexto(paciente.pacienteId),
        datos
      );
    }

    // Buscar por campo id
    if (paciente.id) {
      pacientes.set(
        limpiarTexto(paciente.id),
        datos
      );
    }
  });

  // Relacionar muestras con pacientes
  const muestras = await Promise.all(
    resultadoMuestras.docs.map(async (documento) => {
      const muestra = documento.data();

      const pacienteId = limpiarTexto(muestra.pacienteId);

      let paciente = pacientes.get(pacienteId);

      // Si no aparece en la consulta, intentar por documento
      if (!paciente && pacienteId) {
        try {
          const referenciaPaciente = doc(
            db,
            "pacientes",
            pacienteId
          );

          const documentoPaciente = await getDoc(
            referenciaPaciente
          );

          if (documentoPaciente.exists()) {
            const datos = documentoPaciente.data();

            if (datos.laboratorioId === idLaboratorio) {
              paciente = {
                id: documentoPaciente.id,
                ...datos,
              };
            }
          }
        } catch (error) {
          console.warn(
            "No se pudo consultar el paciente:",
            pacienteId,
            error
          );
        }
      }

      const nombrePaciente = obtenerNombrePaciente(paciente);

      return {
        ...muestra,
        id: documento.id,
        nombrePaciente:
          nombrePaciente || "Paciente no encontrado",
      };
    })
  );

  return muestras;
}

// ======================================================
// VERIFICAR SI LA MUESTRA PUEDE PROCESARSE
// ======================================================

export function muestraPuedeProcesarse(muestra) {
  if (!muestra) return false;

  return (
    normalizarEstado(muestra.estado) === "aceptada" &&
    muestra.aceptada === true
  );
}

// ======================================================
// ACEPTAR O RECHAZAR MUESTRA
// ======================================================

export async function validarMuestra({
  muestraId,
  laboratorioId,
  usuarioId,
  accion,
  motivoRechazo = "",
}) {
  const idMuestra = limpiarTexto(muestraId);
  const idLaboratorio = limpiarTexto(laboratorioId);
  const idUsuario = limpiarTexto(usuarioId);
  const motivo = limpiarTexto(motivoRechazo);

  if (!idMuestra || !idLaboratorio || !idUsuario) {
    throw new Error("Faltan datos para validar la muestra.");
  }

  if (accion !== "aceptar" && accion !== "rechazar") {
    throw new Error("Acción de validación incorrecta.");
  }

  if (accion === "rechazar" && !motivo) {
    throw new Error("Debes indicar el motivo del rechazo.");
  }

  const referencia = doc(db, COLECCION, idMuestra);

  await runTransaction(db, async (transaccion) => {
    const documento = await transaccion.get(referencia);

    if (!documento.exists()) {
      throw new Error("La muestra no existe.");
    }

    const muestra = documento.data();

    if (muestra.laboratorioId !== idLaboratorio) {
      throw new Error(
        "La muestra pertenece a otro laboratorio."
      );
    }

    const estadoActual = normalizarEstado(muestra.estado);

    if (!ESTADOS_PENDIENTES.includes(estadoActual)) {
      throw new Error(
        "La muestra ya fue validada o no está pendiente."
      );
    }

    if (accion === "aceptar") {
      transaccion.update(referencia, {
        estado: "aceptada",
        aceptada: true,
        motivoRechazo: "",
        validadoPor: idUsuario,
        fechaValidacion: serverTimestamp(),
      });
    } else {
      transaccion.update(referencia, {
        estado: "rechazada",
        aceptada: false,
        motivoRechazo: motivo,
        validadoPor: idUsuario,
        fechaValidacion: serverTimestamp(),
      });
    }
  });

  return true;
}

// ======================================================
// VERIFICAR MUESTRA ANTES DEL PROCESAMIENTO
// ======================================================

export async function verificarMuestraParaProcesamiento({
  muestraId,
  laboratorioId,
}) {
  const idMuestra = limpiarTexto(muestraId);
  const idLaboratorio = limpiarTexto(laboratorioId);

  if (!idMuestra || !idLaboratorio) {
    throw new Error("Faltan datos de la muestra.");
  }

  const referencia = doc(db, COLECCION, idMuestra);

  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error("La muestra no existe.");
  }

  const muestra = documento.data();

  if (muestra.laboratorioId !== idLaboratorio) {
    throw new Error(
      "La muestra pertenece a otro laboratorio."
    );
  }

  if (!muestraPuedeProcesarse(muestra)) {
    throw new Error(
      "La muestra debe estar aceptada antes de procesarse."
    );
  }

  return {
    ...muestra,
    id: documento.id,
  };
}