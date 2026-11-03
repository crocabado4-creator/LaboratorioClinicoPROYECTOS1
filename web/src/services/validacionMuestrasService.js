import {
  collection,
  doc,
  getDoc,
  getDocs,
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

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. Verifica los " +
      "permisos de muestras y notificaciones."
    );
  }

  if (error?.code === "unauthenticated") {
    return "La sesión ha expirado. Inicia sesión nuevamente.";
  }

  if (error?.code === "unavailable") {
    return "No se pudo conectar con Firebase.";
  }

  return error?.message || "Ocurrió un error inesperado.";
}

function convertirDocumento(documento) {
  return {
    ...documento.data(),
    id: documento.id,
  };
}

function fechaMilisegundos(fecha) {
  if (!fecha) return 0;

  if (typeof fecha.toMillis === "function") {
    return fecha.toMillis();
  }

  if (typeof fecha.seconds === "number") {
    return fecha.seconds * 1000;
  }

  if (fecha instanceof Date) {
    return fecha.getTime();
  }

  const valor = new Date(fecha).getTime();

  return Number.isNaN(valor) ? 0 : valor;
}

// =====================================================
// USUARIO ACTUAL
// =====================================================

async function obtenerUsuarioActual() {
  const usuarioAuth = getAuth().currentUser;

  if (!usuarioAuth) {
    throw new Error("Debes iniciar sesión.");
  }

  const referencia = doc(
    db,
    "usuarios",
    usuarioAuth.uid
  );

  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error(
      "El usuario no existe en Firestore."
    );
  }

  const datos = documento.data();

  if (datos.activo !== true) {
    throw new Error("Tu cuenta está inactiva.");
  }

  return {
    uid: usuarioAuth.uid,

    rol: limpiarTexto(datos.rol).toLowerCase(),

    laboratorioId: limpiarTexto(
      datos.laboratorioId
    ),

    nombre: [
      datos.nombre || datos.nombres || "",
      datos.apellido || datos.apellidos || "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

// =====================================================
// VERIFICAR ACCESO
// =====================================================

async function verificarAccesoLectura(laboratorioId) {
  const usuario = await obtenerUsuarioActual();

  if (!laboratorioId) {
    throw new Error("No se identificó el laboratorio.");
  }

  if (usuario.laboratorioId !== laboratorioId) {
    throw new Error(
      "No perteneces al laboratorio solicitado."
    );
  }

  const permitidos = [
    "administrador",
    "recepcionista",
    "bioquimico",
  ];

  if (!permitidos.includes(usuario.rol)) {
    throw new Error("No tienes permisos.");
  }

  return usuario;
}

// =====================================================
// PERMISO BIOQUÍMICO
// =====================================================

export async function verificarPermisoValidacion(
  laboratorioId
) {
  const usuario = await verificarAccesoLectura(
    laboratorioId
  );

  if (usuario.rol !== "bioquimico") {
    throw new Error(
      "Solo el Bioquímico puede validar muestras."
    );
  }

  return usuario;
}

// =====================================================
// LISTAR MUESTRAS
// =====================================================

export async function listarMuestrasValidacion(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(laboratorioId);

  await verificarAccesoLectura(idLaboratorio);

  const consulta = query(
    collection(db, "muestras"),
    where("laboratorioId", "==", idLaboratorio)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs
    .map(convertirDocumento)
    .sort(
      (a, b) =>
        fechaMilisegundos(b.fechaToma) -
        fechaMilisegundos(a.fechaToma)
    );
}

// =====================================================
// OBTENER MUESTRA
// =====================================================

export async function obtenerMuestraValidacion({
  muestraId,
  laboratorioId,
}) {
  const idMuestra = limpiarTexto(muestraId);
  const idLaboratorio = limpiarTexto(laboratorioId);

  if (!idMuestra) {
    throw new Error("No se identificó la muestra.");
  }

  await verificarAccesoLectura(idLaboratorio);

  const referencia = doc(db, "muestras", idMuestra);
  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error("La muestra no existe.");
  }

  if (
    limpiarTexto(documento.data().laboratorioId) !==
    idLaboratorio
  ) {
    throw new Error(
      "La muestra pertenece a otro laboratorio."
    );
  }

  return convertirDocumento(documento);
}

// =====================================================
// ACEPTAR MUESTRA
// =====================================================

export async function aceptarMuestra({
  muestraId,
  laboratorioId,
}) {
  const idMuestra = limpiarTexto(muestraId);
  const idLaboratorio = limpiarTexto(laboratorioId);

  const usuario = await verificarPermisoValidacion(
    idLaboratorio
  );

  const referencia = doc(db, "muestras", idMuestra);

  try {
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

      if (muestra.estado !== "tomada") {
        throw new Error(
          "Solo puedes aceptar muestras tomadas."
        );
      }

      const historial = Array.isArray(
        muestra.historialEstados
      )
        ? muestra.historialEstados
        : [];

      transaccion.update(referencia, {
        estado: "aceptada",
        estadoValidacion: "aceptada",
        aceptada: true,
        motivoRechazo: "",
        validadoPor: usuario.uid,
        fechaValidacion: serverTimestamp(),
        actualizadoPor: usuario.uid,
        fechaActualizacion: serverTimestamp(),

        historialEstados: [
          ...historial,
          {
            estado: "aceptada",
            usuarioId: usuario.uid,
            fecha: new Date().toISOString(),
            observacion: "Muestra aceptada.",
          },
        ],
      });
    });

    return true;
  } catch (error) {
    throw new Error(obtenerMensajeError(error));
  }
}

// =====================================================
// RECHAZAR MUESTRA + NOTIFICAR RECEPCIÓN
// =====================================================

export async function rechazarMuestra({
  muestraId,
  laboratorioId,
  motivoRechazo,
}) {
  const idMuestra = limpiarTexto(muestraId);
  const idLaboratorio = limpiarTexto(laboratorioId);
  const motivo = limpiarTexto(motivoRechazo);

  if (!idMuestra) {
    throw new Error("No se identificó la muestra.");
  }

  if (!motivo) {
    throw new Error(
      "Debes indicar el motivo del rechazo."
    );
  }

  const usuario = await verificarPermisoValidacion(
    idLaboratorio
  );

  const referenciaMuestra = doc(
    db,
    "muestras",
    idMuestra
  );

  // Una notificación única por rechazo.
  const referenciaNotificacion = doc(
    db,
    "notificaciones",
    `rechazo_${idMuestra}`
  );

  try {
    await runTransaction(db, async (transaccion) => {
      const documento = await transaccion.get(
        referenciaMuestra
      );

      if (!documento.exists()) {
        throw new Error("La muestra no existe.");
      }

      const muestra = documento.data();

      if (muestra.laboratorioId !== idLaboratorio) {
        throw new Error(
          "La muestra pertenece a otro laboratorio."
        );
      }

      if (muestra.estado !== "tomada") {
        throw new Error(
          "Solo se pueden rechazar muestras tomadas."
        );
      }

      const historial = Array.isArray(
        muestra.historialEstados
      )
        ? muestra.historialEstados
        : [];

      const codigo =
        muestra.codigoEtiqueta ||
        muestra.codigoMuestra ||
        idMuestra;

      // ===============================================
      // ACTUALIZAR MUESTRA
      // ===============================================

      transaccion.update(referenciaMuestra, {
        estado: "rechazada",
        estadoValidacion: "rechazada",
        aceptada: false,

        motivoRechazo: motivo,

        requiereNuevaToma: true,

        validadoPor: usuario.uid,
        fechaValidacion: serverTimestamp(),
        actualizadoPor: usuario.uid,
        fechaActualizacion: serverTimestamp(),

        historialEstados: [
          ...historial,
          {
            estado: "rechazada",
            usuarioId: usuario.uid,
            fecha: new Date().toISOString(),
            observacion: motivo,
          },
        ],
      });

      // ===============================================
      // CREAR NOTIFICACIÓN
      // ===============================================

      transaccion.set(referenciaNotificacion, {
        laboratorioId: idLaboratorio,

        destinatarioRol: "recepcionista",

        tipo: "muestra_rechazada",

        titulo: "Muestra rechazada - Nueva toma requerida",

        mensaje:
          `La muestra ${codigo} fue rechazada. ` +
          `Motivo: ${motivo}. ` +
          "Recepción debe contactar al paciente " +
          "y coordinar una nueva toma.",

        muestraId: idMuestra,
        codigoMuestra: codigo,

        pacienteId: muestra.pacienteId || "",
        ordenId: muestra.ordenId || "",

        referenciaId: idMuestra,
        referenciaTipo: "muestra",

        motivoRechazo: motivo,

        requiereNuevaToma: true,

        leida: false,
        leido: false,

        creadoPor: usuario.uid,
        creadoPorNombre: usuario.nombre,

        fechaCreacion: serverTimestamp(),
        fechaLectura: null,
      });
    });

    return true;
  } catch (error) {
    console.error(
      "Error rechazando muestra:",
      error
    );

    throw new Error(obtenerMensajeError(error));
  }
}

// =====================================================
// LISTAR RESULTADOS
// =====================================================

export async function listarResultadosValidacion(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(laboratorioId);

  await verificarAccesoLectura(idLaboratorio);

  const consulta = query(
    collection(db, "resultados"),
    where("laboratorioId", "==", idLaboratorio)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs.map(convertirDocumento);
}

// =====================================================
// OBTENER VALORES
// =====================================================

export async function obtenerValoresValidacion(
  resultadoId
) {
  const idResultado = limpiarTexto(resultadoId);

  if (!idResultado) return [];

  const respuesta = await getDocs(
    collection(db, "resultados", idResultado, "valores")
  );

  return respuesta.docs.map(convertirDocumento);
}

// =====================================================
// VALIDAR RESULTADO FINAL
// =====================================================

export async function validarResultadoFinal({
  resultadoId,
  laboratorioId,
}) {
  const idResultado = limpiarTexto(resultadoId);
  const idLaboratorio = limpiarTexto(laboratorioId);

  if (!idResultado) {
    throw new Error("No se identificó el resultado.");
  }

  const usuario = await verificarPermisoValidacion(
    idLaboratorio
  );

  const referencia = doc(
    db,
    "resultados",
    idResultado
  );

  try {
    await runTransaction(db, async (transaccion) => {
      const documento = await transaccion.get(referencia);

      if (!documento.exists()) {
        throw new Error("El resultado no existe.");
      }

      const resultado = documento.data();

      if (resultado.laboratorioId !== idLaboratorio) {
        throw new Error(
          "El resultado pertenece a otro laboratorio."
        );
      }

      if (
        resultado.estado === "validado" ||
        resultado.validado === true
      ) {
        throw new Error(
          "Este resultado ya fue validado."
        );
      }

      if (resultado.estado !== "borrador") {
        throw new Error(
          "Solo se pueden validar resultados en borrador."
        );
      }

      transaccion.update(referencia, {
        estado: "validado",
        validado: true,
        validadoPor: usuario.uid,
        validadoPorNombre: usuario.nombre,
        fechaValidacion: serverTimestamp(),
      });
    });

    return true;
  } catch (error) {
    throw new Error(obtenerMensajeError(error));
  }
}