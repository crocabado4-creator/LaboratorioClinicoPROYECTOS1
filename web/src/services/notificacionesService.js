import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { db } from "../firebase/firebase";

// ======================================================
// HU-29 - NOTIFICACIONES DEL LABORATORIO
// ======================================================

const COLECCION_NOTIFICACIONES = "notificaciones";
const COLECCION_USUARIOS = "usuarios";

// ======================================================
// TIPOS DE NOTIFICACIONES
// ======================================================

export const TIPOS_NOTIFICACION = {
  MUESTRA_REGISTRADA: "muestra_registrada",
  MUESTRA_ACEPTADA: "muestra_aceptada",
  MUESTRA_RECHAZADA: "muestra_rechazada",
  MUESTRA_PROCESADA: "muestra_procesada",
  RESULTADO_REGISTRADO: "resultado_registrado",
  RESULTADO_VALIDADO: "resultado_validado",
  GENERAL: "general",
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function limpiar(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor) {
  return limpiar(valor).toLowerCase();
}

function convertirDocumento(documento) {
  return {
    ...documento.data(),
    id: documento.id,
  };
}

function obtenerMilisegundos(fecha) {
  if (!fecha) {
    return 0;
  }

  if (typeof fecha.toMillis === "function") {
    return fecha.toMillis();
  }

  if (typeof fecha.seconds === "number") {
    return fecha.seconds * 1000;
  }

  if (fecha instanceof Date) {
    return fecha.getTime();
  }

  const fechaConvertida = new Date(fecha);

  return Number.isNaN(fechaConvertida.getTime())
    ? 0
    : fechaConvertida.getTime();
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Verifica los permisos de la colección notificaciones."
    );
  }

  if (error?.code === "unavailable") {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
  }

  return (
    error?.message ||
    "Ocurrió un error al gestionar las notificaciones."
  );
}

// ======================================================
// OBTENER USUARIO AUTENTICADO
// ======================================================

async function obtenerUsuarioActual() {
  const usuarioAuth = getAuth().currentUser;

  if (!usuarioAuth) {
    throw new Error(
      "No existe una sesión activa. Inicia sesión nuevamente."
    );
  }

  const referenciaUsuario = doc(
    db,
    COLECCION_USUARIOS,
    usuarioAuth.uid
  );

  const documentoUsuario = await getDoc(
    referenciaUsuario
  );

  if (!documentoUsuario.exists()) {
    throw new Error(
      "El usuario autenticado no existe en Firestore."
    );
  }

  const datosUsuario = documentoUsuario.data();

  if (datosUsuario.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  const laboratorioId = limpiar(
    datosUsuario.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene un laboratorio asignado."
    );
  }

  return {
    uid: usuarioAuth.uid,

    laboratorioId,

    rol: normalizar(
      datosUsuario.rol
    ),

    nombre: [
      datosUsuario.nombre ||
        datosUsuario.nombres ||
        "",

      datosUsuario.apellido ||
        datosUsuario.apellidos ||
        "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

// ======================================================
// VERIFICAR LABORATORIO
// ======================================================

async function verificarLaboratorio(laboratorioId) {
  const idLaboratorio = limpiar(
    laboratorioId
  );

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const usuario = await obtenerUsuarioActual();

  if (usuario.laboratorioId !== idLaboratorio) {
    throw new Error(
      "No tienes autorización para acceder a otro laboratorio."
    );
  }

  return usuario;
}

// ======================================================
// VERIFICAR ADMINISTRADOR
// ======================================================

async function verificarAdministrador(laboratorioId) {
  const usuario = await verificarLaboratorio(
    laboratorioId
  );

  if (usuario.rol !== "administrador") {
    throw new Error(
      "Solo el Administrador puede consultar las notificaciones del laboratorio."
    );
  }

  return usuario;
}

// ======================================================
// CREAR NOTIFICACIÓN
// ======================================================

export async function crearNotificacion({
  laboratorioId,
  tipo = TIPOS_NOTIFICACION.GENERAL,
  titulo,
  mensaje,
  referenciaId = "",
  referenciaTipo = "",
  destinatarioId = "",
}) {
  const idLaboratorio = limpiar(
    laboratorioId
  );

  const tituloLimpio = limpiar(titulo);
  const mensajeLimpio = limpiar(mensaje);

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  if (!tituloLimpio) {
    throw new Error(
      "La notificación necesita un título."
    );
  }

  if (!mensajeLimpio) {
    throw new Error(
      "La notificación necesita un mensaje."
    );
  }

  const usuario = await verificarLaboratorio(
    idLaboratorio
  );

  try {
    const datos = {
      laboratorioId: idLaboratorio,

      tipo: limpiar(tipo) ||
        TIPOS_NOTIFICACION.GENERAL,

      titulo: tituloLimpio,

      mensaje: mensajeLimpio,

      referenciaId: limpiar(referenciaId),

      referenciaTipo: limpiar(referenciaTipo),

      destinatarioId: limpiar(destinatarioId),

      leida: false,

      leido: false,

      creadoPor: usuario.uid,

      creadoPorNombre: usuario.nombre,

      fechaCreacion: serverTimestamp(),

      fechaLectura: null,
    };

    const referencia = await addDoc(
      collection(
        db,
        COLECCION_NOTIFICACIONES
      ),
      datos
    );

    return referencia.id;
  } catch (error) {
    console.error(
      "Error creando notificación:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// NOTIFICAR REGISTRO DE MUESTRA
// ======================================================

export async function notificarMuestraRegistrada({
  laboratorioId,
  muestraId,
  codigoMuestra = "",
}) {
  const codigo = limpiar(
    codigoMuestra
  );

  return crearNotificacion({
    laboratorioId,

    tipo:
      TIPOS_NOTIFICACION.MUESTRA_REGISTRADA,

    titulo:
      "Nueva muestra registrada",

    mensaje:
      "Se registró una nueva muestra" +
      (codigo ? ` con código ${codigo}` : "") +
      " en el laboratorio.",

    referenciaId: muestraId,

    referenciaTipo: "muestra",
  });
}

// ======================================================
// NOTIFICAR ACEPTACIÓN DE MUESTRA
// ======================================================

export async function notificarMuestraAceptada({
  laboratorioId,
  muestraId,
  codigoMuestra = "",
}) {
  const codigo = limpiar(
    codigoMuestra
  );

  return crearNotificacion({
    laboratorioId,

    tipo:
      TIPOS_NOTIFICACION.MUESTRA_ACEPTADA,

    titulo:
      "Muestra aceptada",

    mensaje:
      "La muestra" +
      (codigo ? ` ${codigo}` : "") +
      " fue aceptada por el Bioquímico.",

    referenciaId: muestraId,

    referenciaTipo: "muestra",
  });
}

// ======================================================
// NOTIFICAR RECHAZO DE MUESTRA
// ======================================================

export async function notificarMuestraRechazada({
  laboratorioId,
  muestraId,
  codigoMuestra = "",
  motivo = "",
}) {
  const codigo = limpiar(
    codigoMuestra
  );

  const motivoLimpio = limpiar(
    motivo
  );

  return crearNotificacion({
    laboratorioId,

    tipo:
      TIPOS_NOTIFICACION.MUESTRA_RECHAZADA,

    titulo:
      "Muestra rechazada",

    mensaje:
      "La muestra" +
      (codigo ? ` ${codigo}` : "") +
      " fue rechazada." +
      (motivoLimpio
        ? ` Motivo: ${motivoLimpio}`
        : ""),

    referenciaId: muestraId,

    referenciaTipo: "muestra",
  });
}

// ======================================================
// NOTIFICAR PROCESAMIENTO FINALIZADO
// ======================================================

export async function notificarMuestraProcesada({
  laboratorioId,
  muestraId,
  codigoMuestra = "",
}) {
  const codigo = limpiar(
    codigoMuestra
  );

  return crearNotificacion({
    laboratorioId,

    tipo:
      TIPOS_NOTIFICACION.MUESTRA_PROCESADA,

    titulo:
      "Procesamiento de muestra finalizado",

    mensaje:
      "La muestra" +
      (codigo ? ` ${codigo}` : "") +
      " finalizó su procesamiento.",

    referenciaId: muestraId,

    referenciaTipo: "muestra",
  });
}

// ======================================================
// NOTIFICAR RESULTADO REGISTRADO
// ======================================================

export async function notificarResultadoRegistrado({
  laboratorioId,
  resultadoId,
  analisisNombre = "",
}) {
  const nombre = limpiar(
    analisisNombre
  );

  return crearNotificacion({
    laboratorioId,

    tipo:
      TIPOS_NOTIFICACION.RESULTADO_REGISTRADO,

    titulo:
      "Nuevo resultado registrado",

    mensaje:
      "Se registró un resultado" +
      (nombre ? ` del análisis ${nombre}` : "") +
      ". Está pendiente de validación.",

    referenciaId: resultadoId,

    referenciaTipo: "resultado",
  });
}

// ======================================================
// NOTIFICAR RESULTADO VALIDADO
// ======================================================

export async function notificarResultadoValidado({
  laboratorioId,
  resultadoId,
  analisisNombre = "",
}) {
  const nombre = limpiar(
    analisisNombre
  );

  return crearNotificacion({
    laboratorioId,

    tipo:
      TIPOS_NOTIFICACION.RESULTADO_VALIDADO,

    titulo:
      "Resultado validado",

    mensaje:
      "El resultado" +
      (nombre ? ` del análisis ${nombre}` : "") +
      " fue validado por el Bioquímico.",

    referenciaId: resultadoId,

    referenciaTipo: "resultado",
  });
}

// ======================================================
// LISTAR NOTIFICACIONES DEL LABORATORIO
// ======================================================

export async function listarNotificaciones(
  laboratorioId
) {
  const idLaboratorio = limpiar(
    laboratorioId
  );

  await verificarAdministrador(
    idLaboratorio
  );

  try {
    const consulta = query(
      collection(
        db,
        COLECCION_NOTIFICACIONES
      ),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );

    const respuesta = await getDocs(
      consulta
    );

    return respuesta.docs
      .map(convertirDocumento)
      .sort(
        (a, b) =>
          obtenerMilisegundos(
            b.fechaCreacion
          ) -
          obtenerMilisegundos(
            a.fechaCreacion
          )
      );
  } catch (error) {
    console.error(
      "Error listando notificaciones:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// OBTENER NOTIFICACIONES NO LEÍDAS
// ======================================================

export async function listarNotificacionesNoLeidas(
  laboratorioId
) {
  const notificaciones =
    await listarNotificaciones(
      laboratorioId
    );

  return notificaciones.filter(
    (notificacion) =>
      notificacion.leida !== true &&
      notificacion.leido !== true
  );
}

// ======================================================
// CONTAR NOTIFICACIONES NO LEÍDAS
// ======================================================

export async function contarNotificacionesNoLeidas(
  laboratorioId
) {
  const notificaciones =
    await listarNotificacionesNoLeidas(
      laboratorioId
    );

  return notificaciones.length;
}

// ======================================================
// MARCAR NOTIFICACIÓN COMO LEÍDA
// ======================================================

export async function marcarNotificacionLeida({
  notificacionId,
  laboratorioId,
}) {
  const idNotificacion = limpiar(
    notificacionId
  );

  const idLaboratorio = limpiar(
    laboratorioId
  );

  if (!idNotificacion) {
    throw new Error(
      "No se identificó la notificación."
    );
  }

  await verificarAdministrador(
    idLaboratorio
  );

  try {
    const referencia = doc(
      db,
      COLECCION_NOTIFICACIONES,
      idNotificacion
    );

    const documento = await getDoc(
      referencia
    );

    if (!documento.exists()) {
      throw new Error(
        "La notificación no existe."
      );
    }

    const notificacion = documento.data();

    if (
      limpiar(notificacion.laboratorioId) !==
      idLaboratorio
    ) {
      throw new Error(
        "La notificación pertenece a otro laboratorio."
      );
    }

    if (
      notificacion.leida === true ||
      notificacion.leido === true
    ) {
      return true;
    }

    await updateDoc(
      referencia,
      {
        leida: true,

        leido: true,

        fechaLectura:
          serverTimestamp(),
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Error marcando notificación:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// MARCAR TODAS COMO LEÍDAS
// ======================================================

export async function marcarTodasNotificacionesLeidas(
  laboratorioId
) {
  const idLaboratorio = limpiar(
    laboratorioId
  );

  await verificarAdministrador(
    idLaboratorio
  );

  try {
    const notificaciones =
      await listarNotificacionesNoLeidas(
        idLaboratorio
      );

    if (notificaciones.length === 0) {
      return 0;
    }

    let actualizadas = 0;

    const TAMANO_LOTE = 400;

    for (
      let indice = 0;
      indice < notificaciones.length;
      indice += TAMANO_LOTE
    ) {
      const grupo = notificaciones.slice(
        indice,
        indice + TAMANO_LOTE
      );

      const lote = writeBatch(db);

      grupo.forEach(
        (notificacion) => {
          const referencia = doc(
            db,
            COLECCION_NOTIFICACIONES,
            notificacion.id
          );

          lote.update(
            referencia,
            {
              leida: true,

              leido: true,

              fechaLectura:
                serverTimestamp(),
            }
          );
        }
      );

      await lote.commit();

      actualizadas += grupo.length;
    }

    return actualizadas;
  } catch (error) {
    console.error(
      "Error marcando todas las notificaciones:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// OBTENER RESUMEN DE NOTIFICACIONES
// ======================================================

export async function obtenerResumenNotificaciones(
  laboratorioId
) {
  const notificaciones =
    await listarNotificaciones(
      laboratorioId
    );

  const noLeidas = notificaciones.filter(
    (notificacion) =>
      notificacion.leida !== true &&
      notificacion.leido !== true
  );

  const leidas = notificaciones.filter(
    (notificacion) =>
      notificacion.leida === true ||
      notificacion.leido === true
  );

  return {
    total: notificaciones.length,

    noLeidas: noLeidas.length,

    leidas: leidas.length,

    recientes: notificaciones.slice(0, 5),
  };
}