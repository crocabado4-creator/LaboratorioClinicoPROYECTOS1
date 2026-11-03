import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
}

function obtenerCodigo() {
  const fecha = Date.now();

  const aleatorio = Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase();

  return `MUE-${fecha}-${aleatorio}`;
}

// =====================================================
// ESCUCHAR SOLICITUDES DE NUEVA TOMA
// =====================================================

export function escucharNuevasTomas(
  laboratorioId,
  callback,
  callbackError = () => {}
) {
  if (!laboratorioId) {
    callbackError(
      new Error("No se identificó el laboratorio.")
    );

    return () => {};
  }

  const consulta = query(
    collection(db, "solicitudesNuevaToma"),

    where(
      "laboratorioId",
      "==",
      laboratorioId
    )
  );

  return onSnapshot(
    consulta,

    (resultado) => {
      const solicitudes = resultado.docs
        .map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }))
        .filter(
          (solicitud) =>
            solicitud.estado === "pendiente"
        );

      callback(solicitudes);
    },

    (error) => {
      console.error(
        "Error consultando nuevas tomas:",
        error
      );

      callbackError(error);
    }
  );
}

// =====================================================
// OBTENER DATOS DEL PACIENTE Y ANÁLISIS
// =====================================================

export async function obtenerDatosNuevaToma(
  solicitud
) {
  let paciente = null;
  let analisis = null;

  if (solicitud.pacienteId) {
    const referenciaPaciente = doc(
      db,
      "pacientes",
      solicitud.pacienteId
    );

    const documentoPaciente = await getDoc(
      referenciaPaciente
    );

    if (documentoPaciente.exists()) {
      paciente = {
        id: documentoPaciente.id,
        ...documentoPaciente.data(),
      };
    }
  }

  if (solicitud.analisisId) {
    const referenciaAnalisis = doc(
      db,
      "analisis",
      solicitud.analisisId
    );

    const documentoAnalisis = await getDoc(
      referenciaAnalisis
    );

    if (documentoAnalisis.exists()) {
      analisis = {
        id: documentoAnalisis.id,
        ...documentoAnalisis.data(),
      };
    }
  }

  const nombrePaciente = paciente
    ? [
        paciente.nombres,
        paciente.apellidos,
      ]
        .filter(Boolean)
        .join(" ")
    : "Paciente no identificado";

  const nombreAnalisis =
    analisis?.nombre ||
    analisis?.nombreAnalisis ||
    "Análisis no identificado";

  return {
    ...solicitud,

    nombrePaciente,

    ciPaciente: paciente?.ci || "",

    nombreAnalisis,
  };
}

// =====================================================
// REGISTRAR NUEVA MUESTRA
// =====================================================

export async function registrarNuevaToma(
  solicitud,
  tipoMuestra
) {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error(
      "Debes iniciar sesión."
    );
  }

  if (!solicitud?.id) {
    throw new Error(
      "Selecciona una solicitud de nueva toma."
    );
  }

  if (!texto(tipoMuestra)) {
    throw new Error(
      "Selecciona el tipo de muestra."
    );
  }

  const referenciaUsuario = doc(
    db,
    "usuarios",
    usuario.uid
  );

  const documentoUsuario = await getDoc(
    referenciaUsuario
  );

  if (!documentoUsuario.exists()) {
    throw new Error(
      "No se encontró el usuario."
    );
  }

  const datosUsuario = documentoUsuario.data();

  if (
    normalizar(datosUsuario.rol) !==
    "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede registrar muestras."
    );
  }

  if (datosUsuario.activo !== true) {
    throw new Error(
      "El usuario está inactivo."
    );
  }

  const referenciaSolicitud = doc(
    db,
    "solicitudesNuevaToma",
    solicitud.id
  );

  const referenciaMuestra = doc(
    collection(db, "muestras")
  );

  const codigo = obtenerCodigo();

  await runTransaction(
    db,
    async (transaccion) => {
      const documentoSolicitud =
        await transaccion.get(
          referenciaSolicitud
        );

      if (!documentoSolicitud.exists()) {
        throw new Error(
          "La solicitud no existe."
        );
      }

      const datosSolicitud =
        documentoSolicitud.data();

      if (
        datosSolicitud.estado !== "pendiente"
      ) {
        throw new Error(
          "Esta solicitud ya fue atendida."
        );
      }

      if (
        datosSolicitud.laboratorioId !==
        datosUsuario.laboratorioId
      ) {
        throw new Error(
          "La solicitud pertenece a otro laboratorio."
        );
      }

      const referenciaOriginal = doc(
        db,
        "muestras",
        datosSolicitud.muestraOriginalId
      );

      const documentoOriginal =
        await transaccion.get(
          referenciaOriginal
        );

      if (!documentoOriginal.exists()) {
        throw new Error(
          "La muestra original no existe."
        );
      }

      const muestraOriginal =
        documentoOriginal.data();

      if (
        muestraOriginal.estado !== "rechazada"
      ) {
        throw new Error(
          "La muestra original ya no está rechazada."
        );
      }

      if (
        muestraOriginal.laboratorioId !==
        datosUsuario.laboratorioId
      ) {
        throw new Error(
          "La muestra original pertenece a otro laboratorio."
        );
      }

      // ===============================================
      // CREAR NUEVA MUESTRA
      // ===============================================

      transaccion.set(
        referenciaMuestra,
        {
          laboratorioId:
            datosSolicitud.laboratorioId,

          ordenId:
            datosSolicitud.ordenId,

          pacienteId:
            datosSolicitud.pacienteId,

          analisisId:
            datosSolicitud.analisisId,

          tipoMuestra: texto(tipoMuestra),

          tipo: texto(tipoMuestra),

          codigoEtiqueta: codigo,

          codigoMuestra: codigo,

          estado: "tomada",

          estadoValidacion: "pendiente",

          aceptada: false,

          motivoRechazo: "",

          requiereNuevaToma: false,

          esNuevaToma: true,

          muestraOriginalId:
            datosSolicitud.muestraOriginalId,

          solicitudNuevaTomaId:
            solicitud.id,

          registradoPor: usuario.uid,

          bioquimicoId: usuario.uid,

          fechaRegistro: serverTimestamp(),

          fechaToma: serverTimestamp(),

          fechaActualizacion:
            serverTimestamp(),
        }
      );

      // ===============================================
      // COMPLETAR SOLICITUD
      // ===============================================

      transaccion.update(
        referenciaSolicitud,
        {
          estado: "completada",

          nuevaMuestraId:
            referenciaMuestra.id,

          codigoNuevaMuestra: codigo,

          atendidoPor: usuario.uid,

          fechaAtencion:
            serverTimestamp(),
        }
      );
    }
  );

  return {
    muestraId: referenciaMuestra.id,
    codigo,
  };
}