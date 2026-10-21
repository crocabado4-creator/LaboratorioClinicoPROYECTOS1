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

const COLECCION_USUARIOS = "usuarios";
const COLECCION_ANALISIS = "analisis";
const COLECCION_RESULTADOS = "resultados";

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

function obtenerFechaMilisegundos(valor) {
  if (!valor) {
    return 0;
  }

  if (typeof valor.toMillis === "function") {
    return valor.toMillis();
  }

  if (typeof valor.seconds === "number") {
    return valor.seconds * 1000;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? 0
    : fecha.getTime();
}

async function obtenerUsuarioAutenticado() {
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
      "El usuario autenticado no está registrado en Firestore."
    );
  }

  const datos = documentoUsuario.data();

  if (datos.activo !== true) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  return {
    uid: usuarioAuth.uid,
    rol: normalizar(datos.rol),
    laboratorioId: limpiar(datos.laboratorioId),
  };
}

async function verificarAcceso(
  laboratorioId,
  requiereBioquimico = false
) {
  const usuario = await obtenerUsuarioAutenticado();

  if (!laboratorioId) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  if (usuario.laboratorioId !== laboratorioId) {
    throw new Error(
      "Tu usuario no pertenece a este laboratorio."
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
      "Solo el Bioquímico puede registrar valores."
    );
  }

  return usuario;
}

export function resultadoPermiteEditarValores(resultado) {
  if (!resultado) {
    return false;
  }

  return (
    normalizar(resultado.estado) === "borrador" &&
    resultado.validado !== true
  );
}

export async function listarResultadosParaParametros(
  laboratorioId
) {
  const laboratorio = limpiar(laboratorioId);

  await verificarAcceso(laboratorio);

  const consulta = query(
    collection(db, COLECCION_RESULTADOS),
    where("laboratorioId", "==", laboratorio)
  );

  const respuesta = await getDocs(consulta);

  return respuesta.docs
    .map(convertirDocumento)
    .sort(
      (a, b) =>
        obtenerFechaMilisegundos(b.fechaRegistro) -
        obtenerFechaMilisegundos(a.fechaRegistro)
    );
}

export async function listarParametrosAnalisis(
  analisisId,
  laboratorioId
) {
  const idAnalisis = limpiar(analisisId);
  const laboratorio = limpiar(laboratorioId);

  await verificarAcceso(laboratorio);

  if (!idAnalisis) {
    throw new Error(
      "No se identificó el análisis."
    );
  }

  const referenciaAnalisis = doc(
    db,
    COLECCION_ANALISIS,
    idAnalisis
  );

  const documentoAnalisis = await getDoc(
    referenciaAnalisis
  );

  if (!documentoAnalisis.exists()) {
    throw new Error(
      "El análisis no existe."
    );
  }

  const datosAnalisis = documentoAnalisis.data();

  if (
    limpiar(datosAnalisis.laboratorioId) !== laboratorio
  ) {
    throw new Error(
      "El análisis pertenece a otro laboratorio."
    );
  }

  const respuesta = await getDocs(
    collection(
      db,
      COLECCION_ANALISIS,
      idAnalisis,
      "parametros"
    )
  );

  const parametrosSubcoleccion = respuesta.docs.map(
    (documento) => ({
      ...documento.data(),
      id: documento.id,
      parametroId: documento.id,
      origen: "subcoleccion",
    })
  );

  if (parametrosSubcoleccion.length > 0) {
    return parametrosSubcoleccion.sort((a, b) => {
      const ordenA = Number(a.orden);
      const ordenB = Number(b.orden);

      if (
        Number.isFinite(ordenA) &&
        Number.isFinite(ordenB)
      ) {
        return ordenA - ordenB;
      }

      return limpiar(
        a.nombre || a.nombreParametro
      ).localeCompare(
        limpiar(b.nombre || b.nombreParametro),
        "es"
      );
    });
  }

  const parametrosIntegrados = datosAnalisis.parametros;

  if (Array.isArray(parametrosIntegrados)) {
    return parametrosIntegrados.map(
      (parametro, indice) => ({
        ...parametro,
        id: limpiar(
          parametro.id ||
          parametro.parametroId ||
          `parametro-${indice}`
        ),
        parametroId: limpiar(
          parametro.id ||
          parametro.parametroId ||
          `parametro-${indice}`
        ),
        origen: "integrado",
        indiceOriginal: indice,
      })
    );
  }

  return [];
}

export async function listarValoresResultado(resultadoId) {
  const idResultado = limpiar(resultadoId);

  const usuario = await obtenerUsuarioAutenticado();

  if (
    usuario.rol !== "bioquimico" &&
    usuario.rol !== "administrador"
  ) {
    throw new Error(
      "No tienes autorización para consultar valores."
    );
  }

  if (!idResultado) {
    return [];
  }

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

  if (
    limpiar(documentoResultado.data().laboratorioId) !==
    usuario.laboratorioId
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  const respuesta = await getDocs(
    collection(
      db,
      COLECCION_RESULTADOS,
      idResultado,
      "valores"
    )
  );

  return respuesta.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

function encontrarParametroIntegrado(
  parametros,
  parametroId
) {
  if (!Array.isArray(parametros)) {
    return null;
  }

  return (
    parametros.find((parametro, indice) => {
      const identificador = limpiar(
        parametro.id ||
        parametro.parametroId ||
        `parametro-${indice}`
      );

      return identificador === parametroId;
    }) || null
  );
}

export async function guardarValorParametro({
  resultadoId,
  laboratorioId,
  parametroId,
  nombreParametro,
  valor,
  unidad,
  rangoReferencia,
  observacion,
}) {
  const idResultado = limpiar(resultadoId);
  const laboratorio = limpiar(laboratorioId);
  const idParametro = limpiar(parametroId);
  const valorIngresado = limpiar(valor);

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

  if (!idParametro) {
    throw new Error(
      "No se identificó el parámetro."
    );
  }

  if (!valorIngresado) {
    throw new Error(
      "Debes ingresar el valor del parámetro."
    );
  }

  const usuario = await verificarAcceso(
    laboratorio,
    true
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

  const resultadoActual = documentoResultado.data();

  if (
    limpiar(resultadoActual.laboratorioId) !== laboratorio
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  if (!resultadoPermiteEditarValores(resultadoActual)) {
    throw new Error(
      "El resultado ya fue validado o no está en borrador."
    );
  }

  const analisisId = limpiar(
    resultadoActual.analisisId
  );

  if (!analisisId) {
    throw new Error(
      "El resultado no tiene un análisis asociado."
    );
  }

  const referenciaAnalisis = doc(
    db,
    COLECCION_ANALISIS,
    analisisId
  );

  const documentoAnalisis = await getDoc(
    referenciaAnalisis
  );

  if (!documentoAnalisis.exists()) {
    throw new Error(
      "El análisis asociado no existe."
    );
  }

  const analisisActual = documentoAnalisis.data();

  if (
    limpiar(analisisActual.laboratorioId) !== laboratorio
  ) {
    throw new Error(
      "El análisis pertenece a otro laboratorio."
    );
  }

  const referenciaParametro = doc(
    db,
    COLECCION_ANALISIS,
    analisisId,
    "parametros",
    idParametro
  );

  const documentoParametro = await getDoc(
    referenciaParametro
  );

  let parametroEncontrado = null;

  if (documentoParametro.exists()) {
    parametroEncontrado = {
      ...documentoParametro.data(),
      id: documentoParametro.id,
    };
  } else {
    parametroEncontrado = encontrarParametroIntegrado(
      analisisActual.parametros,
      idParametro
    );
  }

  if (!parametroEncontrado) {
    throw new Error(
      "El parámetro seleccionado no existe en este análisis."
    );
  }

  if (parametroEncontrado.activo === false) {
    throw new Error(
      "El parámetro está desactivado."
    );
  }

  const nombreReal = limpiar(
    parametroEncontrado.nombre ||
    parametroEncontrado.nombreParametro ||
    nombreParametro
  );

  const unidadReal = limpiar(
    unidad ||
    parametroEncontrado.unidad
  );

  const referenciaValor = limpiar(
    rangoReferencia ||
    parametroEncontrado.rangoReferencia ||
    parametroEncontrado.referencia
  );

  const referenciaValorResultado = doc(
    db,
    COLECCION_RESULTADOS,
    idResultado,
    "valores",
    idParametro
  );

  await runTransaction(
    db,
    async (transaccion) => {
      const resultadoSnapshot =
        await transaccion.get(
          referenciaResultado
        );

      const valorSnapshot =
        await transaccion.get(
          referenciaValorResultado
        );

      if (!resultadoSnapshot.exists()) {
        throw new Error(
          "El resultado ya no existe."
        );
      }

      const resultado = resultadoSnapshot.data();

      if (
        limpiar(resultado.laboratorioId) !== laboratorio
      ) {
        throw new Error(
          "El resultado pertenece a otro laboratorio."
        );
      }

      if (!resultadoPermiteEditarValores(resultado)) {
        throw new Error(
          "El resultado fue validado mientras intentabas guardar."
        );
      }

      const datos = {
        laboratorioId: laboratorio,
        resultadoId: idResultado,
        parametroId: idParametro,
        nombreParametro: nombreReal,
        valor: valorIngresado,
        unidad: unidadReal,
        rangoReferencia: referenciaValor,
        observacion: limpiar(observacion),
        actualizadoPor: usuario.uid,
        fechaActualizacion: serverTimestamp(),
      };

      if (valorSnapshot.exists()) {
        transaccion.update(
          referenciaValorResultado,
          datos
        );
      } else {
        transaccion.set(
          referenciaValorResultado,
          {
            ...datos,
            registradoPor: usuario.uid,
            fechaRegistro: serverTimestamp(),
          }
        );
      }
    }
  );

  return true;
}