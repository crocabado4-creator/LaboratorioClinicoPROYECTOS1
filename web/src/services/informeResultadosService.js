
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function estaFinalizado(resultado) {
  const estado = limpiarTexto(
    resultado?.estado
  ).toLowerCase();

  return (
    resultado?.validado === true ||
    ["validado", "finalizado"].includes(estado)
  );
}

function normalizarRango(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number"
  ) {
    return String(valor);
  }

  if (typeof valor === "object") {
    const texto =
      valor.texto ??
      valor.descripcion ??
      valor.referencia;

    if (
      texto !== undefined &&
      texto !== null &&
      texto !== ""
    ) {
      return String(texto);
    }

    const minimo =
      valor.min ??
      valor.minimo ??
      valor.desde ??
      valor.valorMinimo;

    const maximo =
      valor.max ??
      valor.maximo ??
      valor.hasta ??
      valor.valorMaximo;

    if (
      minimo !== undefined ||
      maximo !== undefined
    ) {
      return `${minimo ?? "-"} - ${maximo ?? "-"}`;
    }
  }

  return "-";
}

function fechaMilisegundos(valor) {
  if (!valor) return 0;

  if (typeof valor.toMillis === "function") {
    return valor.toMillis();
  }

  if (typeof valor.toDate === "function") {
    return valor.toDate().getTime();
  }

  if (typeof valor.seconds === "number") {
    return valor.seconds * 1000;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? 0
    : fecha.getTime();
}

// Registra información de diagnóstico
// únicamente durante el desarrollo.

async function leerConDiagnostico(
  descripcion,
  operacion
) {
  try {
    const resultado = await operacion();

    if (import.meta.env.DEV) {
      console.info(
        `[FIRESTORE OK] ${descripcion}`
      );
    }

    return resultado;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(
        `[FIRESTORE ERROR] ${descripcion}`,
        error?.code,
        error?.message
      );
    }

    throw error;
  }
}

// Consulta un documento relacionado.
// La verificación de laboratorio complementa
// las reglas de seguridad de Firestore.

async function obtenerDocumento(
  coleccionNombre,
  id,
  laboratorioId
) {
  const idLimpio = limpiarTexto(id);

  if (!idLimpio) {
    return null;
  }

  const snapshot = await leerConDiagnostico(
    `${coleccionNombre}/${idLimpio}`,
    () =>
      getDoc(
        doc(
          db,
          coleccionNombre,
          idLimpio
        )
      )
  );

  if (!snapshot.exists()) {
    return null;
  }

  const datos = snapshot.data();

  if (
    datos.laboratorioId &&
    limpiarTexto(datos.laboratorioId) !==
      limpiarTexto(laboratorioId)
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    ...datos,
  };
}

// Obtiene los parámetros del resultado.

async function obtenerValores(resultadoId) {
  const idLimpio = limpiarTexto(resultadoId);

  if (!idLimpio) {
    return [];
  }

  const snapshot = await leerConDiagnostico(
    `resultados/${idLimpio}/valores`,
    () =>
      getDocs(
        collection(
          db,
          "resultados",
          idLimpio,
          "valores"
        )
      )
  );

  return snapshot.docs.map((documento) => {
    const datos = documento.data();

    return {
      id: documento.id,

      parametroId:
        limpiarTexto(datos.parametroId) ||
        documento.id,

      nombreParametro:
        limpiarTexto(datos.nombreParametro) ||
        limpiarTexto(datos.nombre) ||
        limpiarTexto(datos.parametro) ||
        "Parámetro",

      valor:
        limpiarTexto(
          datos.valor ??
          datos.resultado ??
          datos.valorObtenido
        ) || "-",

      unidad:
        limpiarTexto(datos.unidad) || "-",

      rangoReferencia:
        normalizarRango(
          datos.rangoReferencia ??
          datos.rango ??
          datos.valoresReferencia
        ),

      observacion:
        limpiarTexto(datos.observacion) ||
        limpiarTexto(datos.observaciones),
    };
  });
}

function parametroGeneral(resultado) {
  return {
    parametroId: "resultado-general",

    nombreParametro:
      limpiarTexto(resultado.analisisNombre) ||
      "Resultado general",

    valor:
      limpiarTexto(resultado.valorResultado) ||
      "-",

    unidad:
      limpiarTexto(resultado.unidad) ||
      "-",

    rangoReferencia: "-",

    observacion:
      limpiarTexto(resultado.observaciones),
  };
}

// Información institucional para el informe.

export async function obtenerLaboratorioInforme(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(laboratorioId);

  if (!idLaboratorio) {
    return null;
  }

  const snapshot = await leerConDiagnostico(
    `laboratorios/${idLaboratorio}`,
    () =>
      getDoc(
        doc(
          db,
          "laboratorios",
          idLaboratorio
        )
      )
  );

  return snapshot.exists()
    ? {
        id: snapshot.id,
        ...snapshot.data(),
      }
    : null;
}

// Lista los informes correspondientes
// a resultados clínicos finalizados.

export async function listarInformesFinalizados(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(laboratorioId);

  if (!idLaboratorio) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  // 1. Consultar resultados del laboratorio.

  const snapshot = await leerConDiagnostico(
    "resultados (por laboratorio)",
    () =>
      getDocs(
        query(
          collection(db, "resultados"),
          where(
            "laboratorioId",
            "==",
            idLaboratorio
          )
        )
      )
  );

  // 2. Filtrar únicamente los finalizados.

  const resultados = snapshot.docs
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .filter(estaFinalizado);

  // 3. Cargar parámetros y obtener nombre del análisis.

  const completos = await Promise.all(
    resultados.map(async (resultado) => {
      const valores = await obtenerValores(
        resultado.id
      );

      // Si el resultado ya tiene el nombre,
      // no es necesario consultar nuevamente
      // el documento de la colección analisis.

      let analisisNombre =
        limpiarTexto(resultado.analisisNombre) ||
        limpiarTexto(resultado.nombreAnalisis) ||
        limpiarTexto(
          resultado.analisis?.nombre
        );

      // Consultar el análisis solamente cuando
      // su nombre no está guardado en el resultado.

      if (
        !analisisNombre &&
        limpiarTexto(resultado.analisisId)
      ) {
        const analisis = await obtenerDocumento(
          "analisis",
          resultado.analisisId,
          idLaboratorio
        );

        analisisNombre =
          limpiarTexto(analisis?.nombre) ||
          limpiarTexto(
            analisis?.nombreAnalisis
          );
      }

      return {
        ...resultado,

        analisisNombre:
          analisisNombre ||
          "Análisis no identificado",

        parametros:
          valores.length > 0
            ? valores
            : [parametroGeneral(resultado)],
      };
    })
  );

  // 4. Agrupar los resultados por orden.

  const grupos = new Map();

  completos.forEach((resultado) => {
    const ordenId =
      limpiarTexto(resultado.ordenId);

    if (!ordenId) {
      return;
    }

    if (!grupos.has(ordenId)) {
      grupos.set(ordenId, []);
    }

    grupos.get(ordenId).push(resultado);
  });

  // 5. Obtener información de pacientes y órdenes.

  const informes = await Promise.all(
    Array.from(grupos.entries()).map(
      async ([ordenId, listaResultados]) => {
        const primero = listaResultados[0];

        const [paciente, orden] =
          await Promise.all([
            obtenerDocumento(
              "pacientes",
              primero.pacienteId,
              idLaboratorio
            ),

            obtenerDocumento(
              "ordenes",
              ordenId,
              idLaboratorio
            ),
          ]);

        const fechaValidacion = Math.max(
          0,
          ...listaResultados.map(
            (resultado) =>
              fechaMilisegundos(
                resultado.fechaValidacion
              )
          )
        );

        return {
          ordenId,

          pacienteId:
            limpiarTexto(
              primero.pacienteId
            ),

          paciente,
          orden,
          resultados: listaResultados,
          fechaValidacion,
        };
      }
    )
  );

  // 6. Ordenar informes por fecha de validación.

  informes.sort(
    (a, b) =>
      b.fechaValidacion -
      a.fechaValidacion
  );

  return informes;
}
