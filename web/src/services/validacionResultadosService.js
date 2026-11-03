import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
} from "firebase/auth";

import { db } from "../firebase/firebase";

// ======================================================
// COLECCIONES
// ======================================================

const COLECCION_USUARIOS = "usuarios";

const COLECCION_RESULTADOS = "resultados";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function limpiar(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor) {
  return limpiar(valor).toLowerCase();
}

function obtenerRol(datosUsuario) {
  const rol = datosUsuario?.rol;

  if (
    rol &&
    typeof rol === "object"
  ) {
    return normalizar(
      rol.nombre ||
      rol.nombreRol ||
      rol.id
    );
  }

  return normalizar(rol);
}

function obtenerNombreUsuario(datosUsuario) {
  const nombres = limpiar(
    datosUsuario?.nombres ||
    datosUsuario?.nombre
  );

  const apellidos = limpiar(
    datosUsuario?.apellidos ||
    datosUsuario?.apellido
  );

  return (
    [nombres, apellidos]
      .filter(Boolean)
      .join(" ") ||
    limpiar(datosUsuario?.nombreCompleto) ||
    "Bioquímico"
  );
}

// ======================================================
// COMPROBAR SI EL RESULTADO ESTÁ VALIDADO
// ======================================================

function resultadoEstaValidado(resultado) {
  if (!resultado) {
    return false;
  }

  return (
    normalizar(resultado.estado) === "validado" ||
    resultado.validado === true
  );
}

// ======================================================
// COMPROBAR VALOR REGISTRADO
// ======================================================

function resultadoTieneValor(resultado) {
  if (!resultado) {
    return false;
  }

  const valor =
    resultado.valorResultado ??
    resultado.valor;

  return (
    valor !== null &&
    valor !== undefined &&
    limpiar(valor) !== ""
  );
}

// ======================================================
// COMPROBAR SI EL RESULTADO PUEDE VALIDARSE
// ======================================================

export function resultadoPermiteValidacion(resultado) {
  if (!resultado) {
    return false;
  }

  if (resultadoEstaValidado(resultado)) {
    return false;
  }

  if (
    normalizar(resultado.estado) !== "borrador"
  ) {
    return false;
  }

  if (!resultadoTieneValor(resultado)) {
    return false;
  }

  return true;
}

// ======================================================
// OBTENER USUARIO AUTENTICADO
// ======================================================

async function obtenerUsuarioAutenticado() {
  const auth = getAuth();

  const usuarioAuth = auth.currentUser;

  if (!usuarioAuth) {
    throw new Error(
      "No existe una sesión activa. " +
      "Inicia sesión nuevamente."
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
    uid: usuarioAuth.uid,

    rol: obtenerRol(datosUsuario),

    laboratorioId: limpiar(
      datosUsuario.laboratorioId
    ),

    nombreCompleto: obtenerNombreUsuario(
      datosUsuario
    ),
  };
}

// ======================================================
// VERIFICAR PERMISOS
// ======================================================

async function verificarPermisosValidacion(
  laboratorioId
) {
  const usuario = await obtenerUsuarioAutenticado();

  const laboratorio = limpiar(laboratorioId);

  if (!laboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  if (!usuario.laboratorioId) {
    throw new Error(
      "Tu usuario no tiene un laboratorio asignado."
    );
  }

  if (
    usuario.laboratorioId !== laboratorio
  ) {
    throw new Error(
      "No tienes permiso para validar resultados " +
      "de otro laboratorio."
    );
  }

  if (
    usuario.rol !== "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede validar resultados."
    );
  }

  return usuario;
}

// ======================================================
// CONSULTAR RESULTADO ANTES DE VALIDAR
// ======================================================

export async function consultarResultadoParaValidacion({
  resultadoId,
  laboratorioId,
}) {
  const idResultado = limpiar(resultadoId);

  const laboratorio = limpiar(laboratorioId);

  if (!idResultado) {
    throw new Error(
      "No se identificó el resultado."
    );
  }

  const usuario = await verificarPermisosValidacion(
    laboratorio
  );

  const referenciaResultado = doc(
    db,
    COLECCION_RESULTADOS,
    idResultado
  );

  const documentoResultado = await getDoc(
    referenciaResultado
  );

  if (!documentoResultado.exists()) {
    throw new Error(
      "El resultado no existe."
    );
  }

  const resultado = documentoResultado.data();

  if (
    limpiar(resultado.laboratorioId) !==
    usuario.laboratorioId
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  return {
    ...resultado,
    id: documentoResultado.id,
  };
}

// ======================================================
// VALIDAR RESULTADO FINAL
// ======================================================

export async function validarResultadoFinal({
  resultadoId,
  laboratorioId,
}) {
  const idResultado = limpiar(resultadoId);

  const laboratorio = limpiar(laboratorioId);

  // ====================================================
  // VALIDACIONES INICIALES
  // ====================================================

  if (!idResultado) {
    throw new Error(
      "No se identificó el resultado."
    );
  }

  if (!laboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  // ====================================================
  // VERIFICAR USUARIO Y LABORATORIO
  // ====================================================

  const usuario = await verificarPermisosValidacion(
    laboratorio
  );

  // ====================================================
  // REFERENCIA DEL RESULTADO
  // ====================================================

  const referenciaResultado = doc(
    db,
    COLECCION_RESULTADOS,
    idResultado
  );

  // ====================================================
  // TRANSACCIÓN
  // ====================================================

  await runTransaction(
    db,
    async (transaccion) => {

      // ================================================
      // LEER RESULTADO ACTUAL
      // ================================================

      const documentoResultado =
        await transaccion.get(
          referenciaResultado
        );

      if (!documentoResultado.exists()) {
        throw new Error(
          "El resultado ya no existe."
        );
      }

      const resultado =
        documentoResultado.data();

      // ================================================
      // COMPROBAR LABORATORIO
      // ================================================

      if (
        limpiar(resultado.laboratorioId) !==
        laboratorio
      ) {
        throw new Error(
          "El resultado pertenece a otro laboratorio."
        );
      }

      // ================================================
      // EVITAR DOBLE VALIDACIÓN
      // ================================================

      if (resultadoEstaValidado(resultado)) {
        throw new Error(
          "Este resultado ya fue validado anteriormente."
        );
      }

      // ================================================
      // COMPROBAR ESTADO
      // ================================================

      if (
        normalizar(resultado.estado) !==
        "borrador"
      ) {
        throw new Error(
          "Solo pueden validarse resultados en borrador."
        );
      }

      // ================================================
      // COMPROBAR VALOR
      // ================================================

      if (!resultadoTieneValor(resultado)) {
        throw new Error(
          "No puedes validar el resultado porque " +
          "no tiene un valor registrado."
        );
      }

      // ================================================
      // ACTUALIZAR RESULTADO
      // ================================================

      transaccion.update(
        referenciaResultado,
        {
          estado: "validado",

          validado: true,

          validadoPor: usuario.uid,

          validadoPorNombre:
            usuario.nombreCompleto,

          nombreValidador:
            usuario.nombreCompleto,

          fechaValidacion:
            serverTimestamp(),
        }
      );
    }
  );

  return {
    ok: true,

    resultadoId: idResultado,

    estado: "validado",

    mensaje:
      "El resultado fue validado correctamente.",
  };
}