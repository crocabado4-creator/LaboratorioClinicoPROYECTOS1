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
// HU-26 - REGISTRO DE RESULTADOS DE ANÁLISIS
// ======================================================

const COLECCION_MUESTRAS = "muestras";
const COLECCION_RESULTADOS = "resultados";
const COLECCION_USUARIOS = "usuarios";

const ESTADOS_MUESTRA = {
  TOMADA: "tomada",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
  EN_PROCESO: "en_proceso",
  PROCESADA: "procesada",
};

const ESTADOS_RESULTADO = {
  BORRADOR: "borrador",
  VALIDADO: "validado",
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function limpiar(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(valor) {
  return limpiar(valor).toLowerCase();
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

    laboratorioId: limpiar(
      datos.laboratorioId
    ),

    muestraId: limpiar(
      datos.muestraId
    ),

    pacienteId: limpiar(
      datos.pacienteId
    ),

    ordenId: limpiar(
      datos.ordenId
    ),

    analisisId: limpiar(
      datos.analisisId
    ),

    analisisNombre: limpiar(
      datos.analisisNombre
    ),

    estado: normalizarEstado(
      datos.estado
    ),

    validado:
      datos.validado === true,
  };
}

function obtenerMensajeError(error) {
  if (error?.code === "permission-denied") {
    return (
      "Firestore rechazó la operación. " +
      "Verifica los permisos del Bioquímico " +
      "sobre las colecciones de muestras y resultados."
    );
  }

  if (error?.code === "unauthenticated") {
    return (
      "No existe una sesión activa. " +
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
    "Ocurrió un error al registrar el resultado."
  );
}

// ======================================================
// OBTENER USUARIO AUTENTICADO
// ======================================================

async function obtenerUsuarioAutenticado() {
  const usuarioFirebase = getAuth().currentUser;

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

    rol: normalizarEstado(
      datosUsuario.rol
    ),

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
    "bioquimico",
  ];

  if (
    !rolesPermitidos.includes(
      usuario.rol
    )
  ) {
    throw new Error(
      "No tienes autorización para acceder a los resultados."
    );
  }

  if (
    requiereBioquimico &&
    usuario.rol !== "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede registrar resultados de análisis."
    );
  }

  return usuario;
}

// ======================================================
// LISTAR MUESTRAS PROCESADAS
// ======================================================

export async function listarMuestrasProcesadas(
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

    const respuesta = await getDocs(
      consulta
    );

    return respuesta.docs
      .map(convertirDocumento)
      .filter((muestra) => {
        const estado = normalizarEstado(
          muestra.estado
        );

        const estadoValidacion =
          normalizarEstado(
            muestra.estadoValidacion
          );

        return (
          estado === ESTADOS_MUESTRA.PROCESADA &&
          muestra.aceptada === true &&
          estadoValidacion !==
            ESTADOS_MUESTRA.RECHAZADA
        );
      })
      .sort(
        (a, b) =>
          fechaMilisegundos(
            b.fechaFinProcesamiento ||
              b.fechaToma
          ) -
          fechaMilisegundos(
            a.fechaFinProcesamiento ||
              a.fechaToma
          )
      );
  } catch (error) {
    console.error(
      "Error listando muestras procesadas:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// LISTAR RESULTADOS DEL LABORATORIO
// ======================================================

export async function listarResultados(
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
        COLECCION_RESULTADOS
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
          fechaMilisegundos(
            b.fechaRegistro
          ) -
          fechaMilisegundos(
            a.fechaRegistro
          )
      );
  } catch (error) {
    console.error(
      "Error listando resultados:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}

// ======================================================
// VERIFICAR SI UNA MUESTRA PUEDE TENER RESULTADO
// ======================================================

export function muestraPuedeRegistrarResultado(
  muestra
) {
  if (!muestra) {
    return false;
  }

  const estado = normalizarEstado(
    muestra.estado
  );

  const estadoValidacion =
    normalizarEstado(
      muestra.estadoValidacion
    );

  return (
    estado === ESTADOS_MUESTRA.PROCESADA &&
    muestra.aceptada === true &&
    estadoValidacion !==
      ESTADOS_MUESTRA.RECHAZADA
  );
}

// ======================================================
// REGISTRAR RESULTADO
// ======================================================

export async function registrarResultado({
  muestraId,
  laboratorioId,
  usuarioId,
  valorResultado,
  unidad,
  observaciones,
}) {
  // ----------------------------------------------------
  // NORMALIZAR DATOS
  // ----------------------------------------------------

  const idMuestra = limpiar(
    muestraId
  );

  const idLaboratorio = limpiar(
    laboratorioId
  );

  const idUsuario = limpiar(
    usuarioId
  );

  const valor = limpiar(
    valorResultado
  );

  const unidadResultado = limpiar(
    unidad
  );

  const comentario = limpiar(
    observaciones
  );

  // ----------------------------------------------------
  // VALIDACIONES INICIALES
  // ----------------------------------------------------

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

  if (!valor) {
    throw new Error(
      "El resultado es obligatorio."
    );
  }

  // ----------------------------------------------------
  // VERIFICAR USUARIO
  // ----------------------------------------------------

  const usuario =
    await verificarAccesoLaboratorio(
      idLaboratorio,
      true
    );

  if (
    usuario.uid !== idUsuario
  ) {
    throw new Error(
      "El usuario responsable no coincide con la sesión autenticada."
    );
  }

  // ----------------------------------------------------
  // REFERENCIAS FIRESTORE
  // ----------------------------------------------------

  const referenciaMuestra = doc(
    db,
    COLECCION_MUESTRAS,
    idMuestra
  );

  // Se mantiene un resultado por muestra.
  // El ID del resultado es el ID de la muestra.
  //
  // Esto permite evitar duplicados y mantiene
  // la estructura existente del proyecto.

  const referenciaResultado = doc(
    db,
    COLECCION_RESULTADOS,
    idMuestra
  );

  // ----------------------------------------------------
  // TRANSACCIÓN
  // ----------------------------------------------------

  try {
    await runTransaction(
      db,
      async (transaccion) => {
        // ----------------------------------------------
        // CONSULTAR MUESTRA
        // ----------------------------------------------

        const documentoMuestra =
          await transaccion.get(
            referenciaMuestra
          );

        // ----------------------------------------------
        // CONSULTAR RESULTADO EXISTENTE
        // ----------------------------------------------

        const documentoResultado =
          await transaccion.get(
            referenciaResultado
          );

        // ----------------------------------------------
        // VERIFICAR EXISTENCIA DE MUESTRA
        // ----------------------------------------------

        if (
          !documentoMuestra.exists()
        ) {
          throw new Error(
            "La muestra no existe."
          );
        }

        const muestra =
          documentoMuestra.data();

        // ----------------------------------------------
        // VALIDAR LABORATORIO
        // ----------------------------------------------

        if (
          limpiar(
            muestra.laboratorioId
          ) !== idLaboratorio
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        // ----------------------------------------------
        // VALIDAR ESTADO DE LA MUESTRA
        // ----------------------------------------------

        if (
          !muestraPuedeRegistrarResultado(
            muestra
          )
        ) {
          throw new Error(
            "Solo se pueden registrar resultados de muestras procesadas y aceptadas."
          );
        }

        // ----------------------------------------------
        // EVITAR RESULTADOS DUPLICADOS
        // ----------------------------------------------

        if (
          documentoResultado.exists()
        ) {
          throw new Error(
            "Esta muestra ya tiene un resultado registrado."
          );
        }

        // ----------------------------------------------
        // VERIFICAR DATOS NECESARIOS
        // ----------------------------------------------

        const pacienteId = limpiar(
          muestra.pacienteId
        );

        const ordenId = limpiar(
          muestra.ordenId
        );

        const analisisId = limpiar(
          muestra.analisisId
        );

        const analisisNombre = limpiar(
          muestra.analisisNombre
        );

        if (!pacienteId) {
          throw new Error(
            "La muestra no tiene un paciente asociado."
          );
        }

        if (!ordenId) {
          throw new Error(
            "La muestra no tiene una orden asociada."
          );
        }

        if (!analisisId) {
          throw new Error(
            "La muestra no tiene un análisis asociado."
          );
        }

        // ----------------------------------------------
        // CREAR RESULTADO EN BORRADOR
        // ----------------------------------------------

        transaccion.set(
          referenciaResultado,
          {
            laboratorioId:
              idLaboratorio,

            muestraId:
              idMuestra,

            pacienteId,

            ordenId,

            analisisId,

            analisisNombre,

            valorResultado:
              valor,

            unidad:
              unidadResultado,

            observaciones:
              comentario,

            estado:
              ESTADOS_RESULTADO.BORRADOR,

            validado:
              false,

            registradoPor:
              usuario.uid,

            fechaRegistro:
              serverTimestamp(),

            validadoPor:
              null,

            fechaValidacion:
              null,
          }
        );
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Error registrando resultado:",
      error
    );

    throw new Error(
      obtenerMensajeError(error)
    );
  }
}