import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { db } from "../firebase/firebase";

// ======================================================
// HU-25 - SEGUIMIENTO DEL ESTADO DE MUESTRAS
// ======================================================

const COLECCION_MUESTRAS = "muestras";
const COLECCION_USUARIOS = "usuarios";

const ESTADOS = {
  TOMADA: "tomada",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
  EN_PROCESO: "en_proceso",
  PROCESADA: "procesada",
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function limpiar(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(estado) {
  return limpiar(estado).toLowerCase();
}

function fechaMilisegundos(fecha) {
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

  if (!Number.isNaN(fechaConvertida.getTime())) {
    return fechaConvertida.getTime();
  }

  return 0;
}

function convertirDocumento(documento) {
  const datos = documento.data();

  return {
    ...datos,

    id: documento.id,

    muestraId:
      limpiar(datos.muestraId) ||
      documento.id,

    laboratorioId:
      limpiar(datos.laboratorioId),

    ordenId:
      limpiar(datos.ordenId),

    pacienteId:
      limpiar(datos.pacienteId),

    analisisId:
      limpiar(datos.analisisId),

    analisisNombre:
      limpiar(datos.analisisNombre),

    tipo:
      limpiar(datos.tipo) ||
      limpiar(datos.tipoMuestra),

    codigoEtiqueta:
      limpiar(datos.codigoEtiqueta),

    estado:
      normalizarEstado(datos.estado) ||
      ESTADOS.TOMADA,

    aceptada:
      datos.aceptada === true,

    estadoValidacion:
      limpiar(datos.estadoValidacion),

    historialEstados:
      Array.isArray(datos.historialEstados)
        ? datos.historialEstados
        : [],
  };
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Verifica que el Bioquímico tenga permisos " +
      "para actualizar las muestras de su laboratorio."
    );
  }

  if (error?.code === "unauthenticated") {
    return (
      "Tu sesión ha expirado. " +
      "Inicia sesión nuevamente."
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
    "Ocurrió un error al procesar la solicitud."
  );
}

// ======================================================
// VERIFICAR USUARIO AUTENTICADO
// ======================================================

async function obtenerUsuarioAutenticado() {
  const auth = getAuth();

  const usuarioFirebase = auth.currentUser;

  if (!usuarioFirebase) {
    throw new Error(
      "No existe una sesión activa. Inicia sesión nuevamente."
    );
  }

  const referenciaUsuario = doc(
    db,
    COLECCION_USUARIOS,
    usuarioFirebase.uid
  );

  const documentoUsuario = await getDoc(
    referenciaUsuario
  );

  if (!documentoUsuario.exists()) {
    throw new Error(
      "El usuario autenticado no está registrado en Firestore."
    );
  }

  const datosUsuario = documentoUsuario.data();

  if (datosUsuario.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  return {
    uid: usuarioFirebase.uid,

    rol: limpiar(datosUsuario.rol).toLowerCase(),

    laboratorioId: limpiar(
      datosUsuario.laboratorioId
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
// VERIFICAR ACCESO AL LABORATORIO
// ======================================================

async function verificarAccesoLaboratorio(
  laboratorioId,
  requiereBioquimico = false
) {
  const idLaboratorio = limpiar(
    laboratorioId
  );

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const usuario = await obtenerUsuarioAutenticado();

  if (
    usuario.laboratorioId !== idLaboratorio
  ) {
    throw new Error(
      "Tu usuario no pertenece al laboratorio seleccionado."
    );
  }

  const rolesPermitidos = [
    "administrador",
    "recepcionista",
    "bioquimico",
  ];

  if (!rolesPermitidos.includes(usuario.rol)) {
    throw new Error(
      "No tienes autorización para acceder al seguimiento de muestras."
    );
  }

  if (
    requiereBioquimico &&
    usuario.rol !== "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede cambiar el estado de procesamiento de las muestras."
    );
  }

  return usuario;
}

// ======================================================
// OBTENER MUESTRAS DEL LABORATORIO
// ======================================================

export async function obtenerMuestrasSeguimiento(
  laboratorioId
) {
  const idLaboratorio = limpiar(
    laboratorioId
  );

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  await verificarAccesoLaboratorio(
    idLaboratorio
  );

  try {
    const consulta = query(
      collection(
        db,
        COLECCION_MUESTRAS
      ),

      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );

    const resultado = await getDocs(
      consulta
    );

    return resultado.docs
      .map(convertirDocumento)
      .sort(
        (a, b) =>
          fechaMilisegundos(b.fechaToma) -
          fechaMilisegundos(a.fechaToma)
      );
  } catch (error) {
    console.error(
      "Error obteniendo muestras para seguimiento:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// OBTENER HISTORIAL DE UNA MUESTRA
// ======================================================

export function obtenerHistorialMuestra(muestra) {
  if (!muestra) {
    return [];
  }

  const historial = Array.isArray(
    muestra.historialEstados
  )
    ? muestra.historialEstados
    : [];

  return [...historial].sort(
    (a, b) =>
      fechaMilisegundos(a.fecha) -
      fechaMilisegundos(b.fecha)
  );
}

// ======================================================
// VERIFICAR SI PUEDE INICIAR PROCESAMIENTO
// ======================================================

export function puedeIniciarProcesamiento(muestra) {
  if (!muestra) {
    return false;
  }

  const estado = normalizarEstado(
    muestra.estado
  );

  const estadoValidacion = normalizarEstado(
    muestra.estadoValidacion
  );

  if (
    estadoValidacion === ESTADOS.RECHAZADA
  ) {
    return false;
  }

  return (
    estado === ESTADOS.ACEPTADA &&
    muestra.aceptada === true
  );
}

// ======================================================
// VERIFICAR SI PUEDE FINALIZAR PROCESAMIENTO
// ======================================================

export function puedeFinalizarProcesamiento(muestra) {
  if (!muestra) {
    return false;
  }

  const estado = normalizarEstado(
    muestra.estado
  );

  const estadoValidacion = normalizarEstado(
    muestra.estadoValidacion
  );

  if (
    estadoValidacion === ESTADOS.RECHAZADA
  ) {
    return false;
  }

  return (
    estado === ESTADOS.EN_PROCESO &&
    muestra.aceptada === true
  );
}

// ======================================================
// OBTENER ESTADO ACTUAL
// ======================================================

export function obtenerEstadoMuestra(muestra) {
  if (!muestra) {
    return ESTADOS.TOMADA;
  }

  return (
    normalizarEstado(muestra.estado) ||
    ESTADOS.TOMADA
  );
}

// ======================================================
// OBTENER DESCRIPCIÓN DEL ESTADO
// ======================================================

export function obtenerDescripcionEstadoMuestra(
  estado
) {
  const estadoNormalizado = normalizarEstado(
    estado
  );

  const descripciones = {
    [ESTADOS.TOMADA]: "Muestra tomada",

    [ESTADOS.ACEPTADA]: "Muestra aceptada",

    [ESTADOS.RECHAZADA]: "Muestra rechazada",

    [ESTADOS.EN_PROCESO]: "En procesamiento",

    [ESTADOS.PROCESADA]: "Procesamiento finalizado",
  };

  return (
    descripciones[estadoNormalizado] ||
    estadoNormalizado ||
    "Estado desconocido"
  );
}

// ======================================================
// CAMBIAR ESTADO DE UNA MUESTRA
// ======================================================

export async function cambiarEstadoMuestra({
  muestraId,
  laboratorioId,
  usuarioId,
  nuevoEstado,
  observacion = "",
}) {
  const idMuestra = limpiar(
    muestraId
  );

  const idLaboratorio = limpiar(
    laboratorioId
  );

  const idUsuario = limpiar(
    usuarioId
  );

  const estadoNuevo = normalizarEstado(
    nuevoEstado
  );

  const comentario = limpiar(
    observacion
  );

  // --------------------------------------------------
  // VALIDACIONES INICIALES
  // --------------------------------------------------

  if (!idMuestra) {
    throw new Error(
      "No se identificó la muestra."
    );
  }

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  if (!idUsuario) {
    throw new Error(
      "No se identificó al usuario responsable."
    );
  }

  if (
    estadoNuevo !== ESTADOS.EN_PROCESO &&
    estadoNuevo !== ESTADOS.PROCESADA
  ) {
    throw new Error(
      "El estado seleccionado no es válido. " +
      "Solo se permite iniciar o finalizar el procesamiento."
    );
  }

  // --------------------------------------------------
  // VERIFICAR PERMISOS
  // --------------------------------------------------

  const usuario = await verificarAccesoLaboratorio(
    idLaboratorio,
    true
  );

  if (usuario.uid !== idUsuario) {
    throw new Error(
      "El usuario responsable no coincide con la sesión autenticada."
    );
  }

  // --------------------------------------------------
  // REFERENCIA A LA MUESTRA
  // --------------------------------------------------

  const referencia = doc(
    db,
    COLECCION_MUESTRAS,
    idMuestra
  );

  try {
    // ------------------------------------------------
    // TRANSACCIÓN
    // ------------------------------------------------

    await runTransaction(
      db,
      async (transaccion) => {
        const documento =
          await transaccion.get(
            referencia
          );

        if (!documento.exists()) {
          throw new Error(
            "La muestra no existe."
          );
        }

        const muestra = documento.data();

        // --------------------------------------------
        // VALIDAR LABORATORIO
        // --------------------------------------------

        if (
          limpiar(muestra.laboratorioId) !==
          idLaboratorio
        ) {
          throw new Error(
            "No puedes modificar muestras de otro laboratorio."
          );
        }

        // --------------------------------------------
        // VALIDAR ACEPTACIÓN
        // --------------------------------------------

        if (
          muestra.aceptada !== true
        ) {
          throw new Error(
            "La muestra no fue aceptada. No puede procesarse."
          );
        }

        const estadoValidacion = normalizarEstado(
          muestra.estadoValidacion
        );

        if (
          estadoValidacion ===
          ESTADOS.RECHAZADA
        ) {
          throw new Error(
            "La muestra fue rechazada y no puede procesarse."
          );
        }

        // --------------------------------------------
        // ESTADO ACTUAL
        // --------------------------------------------

        const estadoActual = normalizarEstado(
          muestra.estado
        );

        // --------------------------------------------
        // INICIAR PROCESAMIENTO
        // --------------------------------------------

        if (
          estadoNuevo === ESTADOS.EN_PROCESO
        ) {
          if (
            estadoActual !== ESTADOS.ACEPTADA
          ) {
            throw new Error(
              "Solo una muestra aceptada puede iniciar procesamiento."
            );
          }
        }

        // --------------------------------------------
        // FINALIZAR PROCESAMIENTO
        // --------------------------------------------

        if (
          estadoNuevo === ESTADOS.PROCESADA
        ) {
          if (
            estadoActual !== ESTADOS.EN_PROCESO
          ) {
            throw new Error(
              "La muestra debe estar en proceso antes de finalizar."
            );
          }
        }

        // --------------------------------------------
        // HISTORIAL ANTERIOR
        // --------------------------------------------

        const historialAnterior =
          Array.isArray(
            muestra.historialEstados
          )
            ? muestra.historialEstados
            : [];

        // --------------------------------------------
        // NUEVO REGISTRO DEL HISTORIAL
        // --------------------------------------------

        const nuevoRegistro = {
          estadoAnterior: estadoActual,

          estadoNuevo,

          usuarioId: usuario.uid,

          observacion: comentario,

          fecha: new Date().toISOString(),
        };

        // --------------------------------------------
        // CAMPOS A ACTUALIZAR
        // --------------------------------------------

        const cambios = {
          estado: estadoNuevo,

          historialEstados: [
            ...historialAnterior,
            nuevoRegistro,
          ],

          actualizadoPor: usuario.uid,

          fechaActualizacion:
            serverTimestamp(),
        };

        // --------------------------------------------
        // FECHA DE INICIO
        // --------------------------------------------

        if (
          estadoNuevo === ESTADOS.EN_PROCESO
        ) {
          cambios.fechaInicioProcesamiento =
            serverTimestamp();
        }

        // --------------------------------------------
        // FECHA DE FINALIZACIÓN
        // --------------------------------------------

        if (
          estadoNuevo === ESTADOS.PROCESADA
        ) {
          cambios.fechaFinProcesamiento =
            serverTimestamp();
        }

        // --------------------------------------------
        // GUARDAR CAMBIOS
        // --------------------------------------------

        transaccion.update(
          referencia,
          cambios
        );
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Error cambiando estado de muestra:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}