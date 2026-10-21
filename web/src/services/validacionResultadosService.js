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

import {
  getAuth,
} from "firebase/auth";

import {
  db,
} from "../firebase/firebase";

import {
  registrarEventoSprint3,
} from "./eventosSprint3Service";

function limpiar(valor) {
  return String(valor ?? "").trim();
}

export async function listarResultadosValidacion(
  laboratorioId
) {
  if (!laboratorioId) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const consulta = query(
    collection(db, "resultados"),
    where(
      "laboratorioId",
      "==",
      laboratorioId
    )
  );

  const respuesta =
    await getDocs(consulta);

  return respuesta.docs.map(
    (documento) => ({
      ...documento.data(),
      id: documento.id,
    })
  );
}

export async function obtenerValoresValidacion(
  resultadoId
) {
  if (!resultadoId) {
    return [];
  }

  const respuesta =
    await getDocs(
      collection(
        db,
        "resultados",
        resultadoId,
        "valores"
      )
    );

  return respuesta.docs.map(
    (documento) => ({
      ...documento.data(),
      id: documento.id,
    })
  );
}

async function verificarPermisoValidacion(
  laboratorioId
) {
  const usuarioAuth =
    getAuth().currentUser;

  if (!usuarioAuth) {
    throw new Error(
      "No existe una sesión activa. Inicia sesión nuevamente."
    );
  }

  const documentoUsuario =
    await getDoc(
      doc(
        db,
        "usuarios",
        usuarioAuth.uid
      )
    );

  if (!documentoUsuario.exists()) {
    throw new Error(
      "El usuario autenticado no tiene un registro en Firestore."
    );
  }

  const datosUsuario =
    documentoUsuario.data();

  if (
    datosUsuario.activo !== true
  ) {
    throw new Error(
      "Tu cuenta está inactiva."
    );
  }

  if (
    datosUsuario.laboratorioId !==
    laboratorioId
  ) {
    throw new Error(
      "Tu usuario no pertenece al laboratorio de este resultado."
    );
  }

  if (
    datosUsuario.rol !==
    "bioquimico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede validar resultados."
    );
  }

  return {
    uid:
      usuarioAuth.uid,
    nombre:
      [
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

function normalizarParametros(
  lista
) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map(
      (
        parametro,
        indice
      ) => ({
        parametroId:
          limpiar(
            parametro?.parametroId ??
              parametro?.id
          ) ||
          `parametro-${indice}`,
        nombre:
          limpiar(
            parametro?.nombre ??
              parametro?.nombreParametro
          ) ||
          `Parámetro ${indice + 1}`,
        activo:
          parametro?.activo !== false,
        obligatorio:
          parametro?.obligatorio !== false,
      })
    )
    .filter(
      (parametro) =>
        parametro.activo &&
        parametro.obligatorio
    );
}

async function obtenerParametrosObligatorios(
  analisisId
) {
  const idAnalisis =
    limpiar(analisisId);

  if (!idAnalisis) {
    return [];
  }

  const analisisSnap =
    await getDoc(
      doc(
        db,
        "analisis",
        idAnalisis
      )
    );

  if (!analisisSnap.exists()) {
    return [];
  }

  const datos =
    analisisSnap.data();

  let parametros = [
    ...normalizarParametros(
      datos.parametros
    ),
    ...normalizarParametros(
      datos.parametrosAnalisis
    ),
    ...normalizarParametros(
      datos.valoresParametros
    ),
  ];

  try {
    const subcoleccion =
      await getDocs(
        collection(
          db,
          "analisis",
          idAnalisis,
          "parametros"
        )
      );

    parametros = [
      ...parametros,
      ...normalizarParametros(
        subcoleccion.docs.map(
          (documento) => ({
            id:
              documento.id,
            ...documento.data(),
          })
        )
      ),
    ];
  } catch (error) {
    console.warn(
      "No se pudo leer la subcolección de parámetros:",
      error
    );
  }

  const unicos =
    new Map();

  parametros.forEach(
    (parametro) => {
      if (
        !unicos.has(
          parametro.parametroId
        )
      ) {
        unicos.set(
          parametro.parametroId,
          parametro
        );
      }
    }
  );

  return Array.from(
    unicos.values()
  );
}

async function verificarResultadoCompleto(
  resultadoId,
  resultado
) {
  const parametros =
    await obtenerParametrosObligatorios(
      resultado.analisisId
    );

  const valores =
    await obtenerValoresValidacion(
      resultadoId
    );

  if (
    parametros.length === 0
  ) {
    if (
      !limpiar(
        resultado.valorResultado
      )
    ) {
      throw new Error(
        "No se puede finalizar el análisis porque falta el resultado."
      );
    }

    return;
  }

  const valoresPorParametro =
    new Map();

  valores.forEach(
    (valor) => {
      const id =
        limpiar(
          valor.parametroId
        ) ||
        limpiar(valor.id);

      if (id) {
        valoresPorParametro.set(
          id,
          limpiar(valor.valor)
        );
      }
    }
  );

  const faltantes =
    parametros.filter(
      (parametro) =>
        !valoresPorParametro.get(
          parametro.parametroId
        )
    );

  if (
    faltantes.length > 0
  ) {
    throw new Error(
      "No se puede finalizar. Faltan valores obligatorios: " +
        faltantes
          .map(
            (parametro) =>
              parametro.nombre
          )
          .join(", ")
    );
  }
}

export async function validarResultadoFinal({
  resultadoId,
  laboratorioId,
}) {
  if (!resultadoId) {
    throw new Error(
      "No se identificó el resultado."
    );
  }

  if (!laboratorioId) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const usuario =
    await verificarPermisoValidacion(
      laboratorioId
    );

  const referenciaResultado =
    doc(
      db,
      "resultados",
      resultadoId
    );

  const snapshot =
    await getDoc(
      referenciaResultado
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El resultado no existe."
    );
  }

  const resultadoActual =
    snapshot.data();

  if (
    resultadoActual.laboratorioId !==
    laboratorioId
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  if (
    resultadoActual.estado ===
      "validado" ||
    resultadoActual.validado ===
      true
  ) {
    throw new Error(
      "Este resultado ya fue validado."
    );
  }

  if (
    resultadoActual.estado !==
    "borrador"
  ) {
    throw new Error(
      "Solo se pueden validar resultados en estado borrador."
    );
  }

  await verificarResultadoCompleto(
    resultadoId,
    resultadoActual
  );

  await runTransaction(
    db,
    async (transaccion) => {
      const documento =
        await transaccion.get(
          referenciaResultado
        );

      if (
        !documento.exists()
      ) {
        throw new Error(
          "El resultado no existe."
        );
      }

      const resultado =
        documento.data();

      if (
        resultado.laboratorioId !==
        laboratorioId
      ) {
        throw new Error(
          "El resultado pertenece a otro laboratorio."
        );
      }

      if (
        resultado.estado !==
          "borrador" ||
        resultado.validado ===
          true
      ) {
        throw new Error(
          "El resultado ya no está disponible para validación."
        );
      }

      transaccion.update(
        referenciaResultado,
        {
          estado:
            "validado",
          validado:
            true,
          validadoPor:
            usuario.uid,
          validadoPorNombre:
            usuario.nombre,
          fechaValidacion:
            serverTimestamp(),
        }
      );
    }
  );

  await registrarEventoSprint3({
    laboratorioId,
    accion:
      "Resultado validado",
    entidad:
      "resultados",
    entidadId:
      resultadoId,
    detalle:
      "Se validó y finalizó un resultado clínico.",
    notificarAdministrador:
      true,
  });

  return true;
}
