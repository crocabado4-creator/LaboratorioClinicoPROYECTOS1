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

function obtenerMensajeError(error, operacion) {
  if (error?.code === "permission-denied") {
    return new Error(
      `Firestore denegó el permiso para ${operacion}. ` +
      "Revisa las reglas de seguridad y los permisos del Bioquímico."
    );
  }

  return error;
}

async function obtenerUsuarioActivo() {
  const usuarioAuth = getAuth().currentUser;

  if (!usuarioAuth) {
    throw new Error(
      "No existe una sesión activa. Inicia sesión nuevamente."
    );
  }

  let documentoUsuario;

  try {
    documentoUsuario = await getDoc(
      doc(db, "usuarios", usuarioAuth.uid)
    );
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "consultar el usuario autenticado"
    );
  }

  if (!documentoUsuario.exists()) {
    throw new Error(
      "El usuario autenticado no está registrado en Firestore."
    );
  }

  const datos = documentoUsuario.data();

  if (datos.activo !== true) {
    throw new Error("Tu cuenta está inactiva.");
  }

  return {
    uid: usuarioAuth.uid,
    rol: normalizar(datos.rol),
    laboratorioId: limpiar(datos.laboratorioId),
    nombre: [
      datos.nombre || datos.nombres || "",
      datos.apellido || datos.apellidos || "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

async function verificarAcceso(
  laboratorioId,
  requiereBioquimico = false
) {
  const laboratorio = limpiar(laboratorioId);

  if (!laboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const usuario = await obtenerUsuarioActivo();

  if (usuario.laboratorioId !== laboratorio) {
    throw new Error(
      "Tu usuario no pertenece al laboratorio de este resultado."
    );
  }

  if (
    usuario.rol !== "bioquimico" &&
    usuario.rol !== "administrador"
  ) {
    throw new Error(
      "No tienes autorización para consultar resultados."
    );
  }

  if (
    requiereBioquimico &&
    usuario.rol !== "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede validar resultados."
    );
  }

  return usuario;
}

function resultadoEstaValidado(resultado) {
  return (
    normalizar(resultado?.estado) === "validado" ||
    resultado?.validado === true
  );
}

function obtenerIdParametro(parametro, indice) {
  return limpiar(
    parametro.id ||
    parametro.parametroId ||
    `parametro-${indice}`
  );
}

function obtenerNombreParametro(parametro, indice) {
  return limpiar(
    parametro.nombre ||
    parametro.nombreParametro ||
    `Parámetro ${indice + 1}`
  );
}

function valorNoVacio(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    String(valor).trim() !== ""
  );
}

function buscarValorParametro(parametro, valores) {
  const parametroId = limpiar(parametro.id);

  const porId = valores.find((valor) => {
    return limpiar(
      valor.parametroId || valor.id
    ) === parametroId;
  });

  if (porId) {
    return porId;
  }

  const nombreParametro = normalizar(
    parametro.nombre
  );

  return (
    valores.find(
      (valor) =>
        normalizar(
          valor.nombreParametro || valor.nombre
        ) === nombreParametro
    ) || null
  );
}

async function consultarParametrosAnalisis(
  analisisId,
  laboratorioId
) {
  const referenciaAnalisis = doc(
    db,
    "analisis",
    analisisId
  );

  let documentoAnalisis;

  try {
    documentoAnalisis = await getDoc(
      referenciaAnalisis
    );
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "consultar el análisis"
    );
  }

  if (!documentoAnalisis.exists()) {
    throw new Error(
      "El análisis asociado al resultado no existe."
    );
  }

  const analisis = documentoAnalisis.data();

  if (
    limpiar(analisis.laboratorioId) !== laboratorioId
  ) {
    throw new Error(
      "El análisis pertenece a otro laboratorio."
    );
  }

  let respuestaParametros;

  try {
    respuestaParametros = await getDocs(
      collection(
        db,
        "analisis",
        analisisId,
        "parametros"
      )
    );
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "consultar los parámetros del análisis"
    );
  }

  if (!respuestaParametros.empty) {
    return respuestaParametros.docs.map(
      (documento, indice) => ({
        ...documento.data(),
        id: documento.id,
        parametroId: documento.id,
        nombre: obtenerNombreParametro(
          documento.data(),
          indice
        ),
      })
    );
  }

  if (Array.isArray(analisis.parametros)) {
    return analisis.parametros.map(
      (parametro, indice) => ({
        ...parametro,
        id: obtenerIdParametro(
          parametro,
          indice
        ),
        nombre: obtenerNombreParametro(
          parametro,
          indice
        ),
      })
    );
  }

  return [];
}

async function consultarValoresResultado(resultadoId) {
  try {
    const respuesta = await getDocs(
      collection(
        db,
        "resultados",
        resultadoId,
        "valores"
      )
    );

    return respuesta.docs.map(convertirDocumento);
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "consultar los valores individuales del resultado"
    );
  }
}

// =====================================================
// LISTAR RESULTADOS
// =====================================================

export async function listarResultadosValidacion(
  laboratorioId
) {
  const laboratorio = limpiar(laboratorioId);

  await verificarAcceso(laboratorio);

  try {
    const consulta = query(
      collection(db, "resultados"),
      where("laboratorioId", "==", laboratorio)
    );

    const respuesta = await getDocs(consulta);

    return respuesta.docs.map(convertirDocumento);
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "listar los resultados del laboratorio"
    );
  }
}

// =====================================================
// OBTENER VALORES
// =====================================================

export async function obtenerValoresValidacion(resultadoId) {
  const idResultado = limpiar(resultadoId);

  if (!idResultado) {
    return [];
  }

  const usuario = await obtenerUsuarioActivo();

  if (
    usuario.rol !== "bioquimico" &&
    usuario.rol !== "administrador"
  ) {
    throw new Error(
      "No tienes autorización para consultar valores."
    );
  }

  let documentoResultado;

  try {
    documentoResultado = await getDoc(
      doc(db, "resultados", idResultado)
    );
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "consultar el resultado"
    );
  }

  if (!documentoResultado.exists()) {
    throw new Error(
      "El resultado no existe."
    );
  }

  if (
    limpiar(documentoResultado.data().laboratorioId) !==
    usuario.laboratorioId
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  return consultarValoresResultado(idResultado);
}

// =====================================================
// VERIFICAR AUTORIZACIÓN
// =====================================================

export async function verificarPermisoValidacion(
  laboratorioId
) {
  return verificarAcceso(laboratorioId, true);
}

// =====================================================
// VALIDAR RESULTADO FINAL
// =====================================================

export async function validarResultadoFinal({
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

  if (!laboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const usuario = await verificarPermisoValidacion(
    laboratorio
  );

  const referenciaResultado = doc(
    db,
    "resultados",
    idResultado
  );

  let documentoResultado;

  try {
    documentoResultado = await getDoc(
      referenciaResultado
    );
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "consultar el resultado antes de validarlo"
    );
  }

  if (!documentoResultado.exists()) {
    throw new Error(
      "El resultado no existe."
    );
  }

  const resultado = documentoResultado.data();

  if (
    limpiar(resultado.laboratorioId) !== laboratorio
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  if (resultadoEstaValidado(resultado)) {
    throw new Error(
      "Este resultado ya fue validado."
    );
  }

  if (normalizar(resultado.estado) !== "borrador") {
    throw new Error(
      "Solo se pueden validar resultados en borrador."
    );
  }

  if (!valorNoVacio(resultado.valorResultado)) {
    throw new Error(
      "El resultado principal no tiene un valor registrado."
    );
  }

  const analisisId = limpiar(
    resultado.analisisId
  );

  if (!analisisId) {
    throw new Error(
      "El resultado no tiene un análisis asociado."
    );
  }

  const parametros = await consultarParametrosAnalisis(
    analisisId,
    laboratorio
  );

  const valores = await consultarValoresResultado(
    idResultado
  );

  const faltantes = parametros
    .filter(
      (parametro) =>
        parametro.activo !== false &&
        parametro.obligatorio !== false
    )
    .filter((parametro) => {
      const registro = buscarValorParametro(
        parametro,
        valores
      );

      return !valorNoVacio(
        registro?.valor ??
        registro?.valorResultado ??
        registro?.resultado
      );
    });

  if (faltantes.length > 0) {
    throw new Error(
      "No se puede validar el resultado. " +
      "Faltan valores en: " +
      faltantes
        .map((parametro) => parametro.nombre)
        .join(", ")
    );
  }

  try {
    await runTransaction(
      db,
      async (transaccion) => {
        const documentoActual =
          await transaccion.get(
            referenciaResultado
          );

        if (!documentoActual.exists()) {
          throw new Error(
            "El resultado ya no existe."
          );
        }

        const resultadoActual =
          documentoActual.data();

        if (
          limpiar(resultadoActual.laboratorioId) !==
          laboratorio
        ) {
          throw new Error(
            "El resultado pertenece a otro laboratorio."
          );
        }

        if (resultadoEstaValidado(resultadoActual)) {
          throw new Error(
            "El resultado ya fue validado."
          );
        }

        if (
          normalizar(resultadoActual.estado) !==
          "borrador"
        ) {
          throw new Error(
            "El resultado ya no está en borrador."
          );
        }

        if (
          !valorNoVacio(
            resultadoActual.valorResultado
          )
        ) {
          throw new Error(
            "El resultado principal está vacío."
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
  } catch (error) {
    throw obtenerMensajeError(
      error,
      "actualizar el resultado a validado"
    );
  }

  return true;
}