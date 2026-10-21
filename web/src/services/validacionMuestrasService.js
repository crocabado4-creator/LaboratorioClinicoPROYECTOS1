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
      "Firestore rechazó la operación. Verifica que " +
      "el usuario tenga el rol Bioquímico, esté activo " +
      "y pertenezca al laboratorio correspondiente."
    );
  }

  if (error?.code === "unauthenticated") {
    return "La sesión ha expirado. Inicia sesión nuevamente.";
  }

  if (error?.code === "unavailable") {
    return (
      "No se pudo conectar con Firebase. " +
      "Comprueba tu conexión a Internet."
    );
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

  return 0;
}

// =====================================================
// VERIFICAR USUARIO AUTENTICADO
// =====================================================

async function obtenerUsuarioActual() {
  const usuarioAuth = getAuth().currentUser;

  if (!usuarioAuth) {
    throw new Error(
      "No existe una sesión activa. Inicia sesión nuevamente."
    );
  }

  const referenciaUsuario = doc(
    db,
    "usuarios",
    usuarioAuth.uid
  );

  const documentoUsuario = await getDoc(
    referenciaUsuario
  );

  if (!documentoUsuario.exists()) {
    throw new Error(
      "El usuario autenticado no tiene un registro en Firestore."
    );
  }

  const datosUsuario = documentoUsuario.data();

  if (datosUsuario.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  return {
    uid: usuarioAuth.uid,

    rol: limpiarTexto(datosUsuario.rol),

    laboratorioId: limpiarTexto(
      datosUsuario.laboratorioId
    ),

    nombre: [
      datosUsuario.nombre || datosUsuario.nombres || "",
      datosUsuario.apellido || datosUsuario.apellidos || "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

// =====================================================
// VERIFICAR ACCESO DE LECTURA
// =====================================================

async function verificarAccesoLectura(laboratorioId) {
  const idLaboratorio = limpiarTexto(
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
      "Tu usuario no pertenece al laboratorio solicitado."
    );
  }

  const rolesPermitidos = [
    "administrador",
    "recepcionista",
    "bioquimico",
  ];

  if (!rolesPermitidos.includes(usuario.rol)) {
    throw new Error(
      "No tienes permisos para consultar esta información."
    );
  }

  return usuario;
}

// =====================================================
// VERIFICAR AUTORIZACIÓN PARA VALIDAR
// =====================================================

export async function verificarPermisoValidacion(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(
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
      "Tu usuario no pertenece al laboratorio de este registro."
    );
  }

  if (usuario.rol !== "bioquimico") {
    throw new Error(
      "Tu cuenta tiene el rol '" +
        usuario.rol +
        "'. Solo el Bioquímico puede realizar validaciones."
    );
  }

  return {
    uid: usuario.uid,
    nombre: usuario.nombre,
  };
}

// =====================================================
// LISTAR MUESTRAS PARA VALIDACIÓN
// HU-25
// =====================================================

export async function listarMuestrasValidacion(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  await verificarAccesoLectura(idLaboratorio);

  try {
    const consulta = query(
      collection(db, "muestras"),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );

    const respuesta = await getDocs(consulta);

    return respuesta.docs
      .map(convertirDocumento)
      .sort(
        (a, b) =>
          fechaMilisegundos(b.fechaToma) -
          fechaMilisegundos(a.fechaToma)
      );
  } catch (error) {
    console.error(
      "Error listando muestras para validación:",
      error
    );

    throw new Error(obtenerMensajeError(error));
  }
}

// =====================================================
// OBTENER UNA MUESTRA
// HU-25
// =====================================================

export async function obtenerMuestraValidacion({
  muestraId,
  laboratorioId,
}) {
  const idMuestra = limpiarTexto(
    muestraId
  );

  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idMuestra) {
    throw new Error(
      "No se identificó la muestra."
    );
  }

  await verificarAccesoLectura(idLaboratorio);

  try {
    const referencia = doc(
      db,
      "muestras",
      idMuestra
    );

    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      throw new Error(
        "La muestra solicitada no existe."
      );
    }

    const datos = documento.data();

    if (
      limpiarTexto(datos.laboratorioId) !==
      idLaboratorio
    ) {
      throw new Error(
        "La muestra pertenece a otro laboratorio."
      );
    }

    return convertirDocumento(documento);
  } catch (error) {
    console.error(
      "Error obteniendo muestra:",
      error
    );

    throw new Error(obtenerMensajeError(error));
  }
}

// =====================================================
// ACEPTAR MUESTRA
// HU-25
// =====================================================

export async function aceptarMuestra({
  muestraId,
  laboratorioId,
}) {
  const idMuestra = limpiarTexto(
    muestraId
  );

  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idMuestra) {
    throw new Error(
      "No se identificó la muestra."
    );
  }

  const usuario = await verificarPermisoValidacion(
    idLaboratorio
  );

  const referencia = doc(
    db,
    "muestras",
    idMuestra
  );

  try {
    await runTransaction(
      db,
      async (transaccion) => {
        const documento = await transaccion.get(
          referencia
        );

        if (!documento.exists()) {
          throw new Error(
            "La muestra no existe."
          );
        }

        const muestra = documento.data();

        if (
          limpiarTexto(muestra.laboratorioId) !==
          idLaboratorio
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (muestra.estado !== "tomada") {
          throw new Error(
            "Solo se pueden aceptar muestras en estado tomada."
          );
        }

        const historialAnterior =
          Array.isArray(muestra.historialEstados)
            ? muestra.historialEstados
            : [];

        const historialActualizado = [
          ...historialAnterior,
          {
            estado: "aceptada",
            usuarioId: usuario.uid,
            fecha: new Date().toISOString(),
            observacion: "Muestra aceptada.",
          },
        ];

        transaccion.update(referencia, {
          estado: "aceptada",

          estadoValidacion: "aceptada",

          aceptada: true,

          motivoRechazo: "",

          validadoPor: usuario.uid,

          fechaValidacion: serverTimestamp(),

          actualizadoPor: usuario.uid,

          fechaActualizacion: serverTimestamp(),

          historialEstados: historialActualizado,
        });
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Error aceptando muestra:",
      error
    );

    throw new Error(obtenerMensajeError(error));
  }
}

// =====================================================
// RECHAZAR MUESTRA
// HU-25
// =====================================================

export async function rechazarMuestra({
  muestraId,
  laboratorioId,
  motivoRechazo,
}) {
  const idMuestra = limpiarTexto(
    muestraId
  );

  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  const motivo = limpiarTexto(
    motivoRechazo
  );

  if (!idMuestra) {
    throw new Error(
      "No se identificó la muestra."
    );
  }

  if (!motivo) {
    throw new Error(
      "Debes indicar el motivo del rechazo."
    );
  }

  const usuario = await verificarPermisoValidacion(
    idLaboratorio
  );

  const referencia = doc(
    db,
    "muestras",
    idMuestra
  );

  try {
    await runTransaction(
      db,
      async (transaccion) => {
        const documento = await transaccion.get(
          referencia
        );

        if (!documento.exists()) {
          throw new Error(
            "La muestra no existe."
          );
        }

        const muestra = documento.data();

        if (
          limpiarTexto(muestra.laboratorioId) !==
          idLaboratorio
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (muestra.estado !== "tomada") {
          throw new Error(
            "Solo se pueden rechazar muestras en estado tomada."
          );
        }

        const historialAnterior =
          Array.isArray(muestra.historialEstados)
            ? muestra.historialEstados
            : [];

        const historialActualizado = [
          ...historialAnterior,
          {
            estado: "rechazada",
            usuarioId: usuario.uid,
            fecha: new Date().toISOString(),
            observacion: motivo,
          },
        ];

        transaccion.update(referencia, {
          estado: "rechazada",

          estadoValidacion: "rechazada",

          aceptada: false,

          motivoRechazo: motivo,

          validadoPor: usuario.uid,

          fechaValidacion: serverTimestamp(),

          actualizadoPor: usuario.uid,

          fechaActualizacion: serverTimestamp(),

          historialEstados: historialActualizado,
        });
      }
    );

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
// FUNCIÓN ORIGINAL CONSERVADA
// =====================================================

export async function listarResultadosValidacion(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  await verificarAccesoLectura(idLaboratorio);

  const consulta = query(
    collection(db, "resultados"),
    where(
      "laboratorioId",
      "==",
      idLaboratorio
    )
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs.map(convertirDocumento);
}

// =====================================================
// OBTENER VALORES
// FUNCIÓN ORIGINAL CONSERVADA
// =====================================================

export async function obtenerValoresValidacion(
  resultadoId
) {
  const idResultado = limpiarTexto(
    resultadoId
  );

  if (!idResultado) {
    return [];
  }

  const respuesta = await getDocs(
    collection(
      db,
      "resultados",
      idResultado,
      "valores"
    )
  );

  return respuesta.docs.map(convertirDocumento);
}

// =====================================================
// VALIDAR RESULTADO FINAL
// FUNCIÓN ORIGINAL CONSERVADA
// =====================================================

export async function validarResultadoFinal({
  resultadoId,
  laboratorioId,
}) {
  const idResultado = limpiarTexto(
    resultadoId
  );

  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idResultado) {
    throw new Error(
      "No se identificó el resultado."
    );
  }

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const usuario = await verificarPermisoValidacion(
    idLaboratorio
  );

  const referenciaResultado = doc(
    db,
    "resultados",
    idResultado
  );

  try {
    await runTransaction(
      db,
      async (transaccion) => {
        const documento = await transaccion.get(
          referenciaResultado
        );

        if (!documento.exists()) {
          throw new Error(
            "El resultado no existe."
          );
        }

        const resultado = documento.data();

        if (
          resultado.laboratorioId !==
          idLaboratorio
        ) {
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
            "Solo se pueden validar resultados en estado borrador."
          );
        }

        transaccion.update(
          referenciaResultado,
          {
            estado: "validado",

            validado: true,

            validadoPor: usuario.uid,

            validadoPorNombre: usuario.nombre,

            fechaValidacion: serverTimestamp(),
          }
        );
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Error validando resultado:",
      error
    );

    throw new Error(obtenerMensajeError(error));
  }
}