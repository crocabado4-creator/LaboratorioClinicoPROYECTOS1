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
  return (
    resultado?.validado === true ||
    resultado?.estado === "validado" ||
    resultado?.estado === "finalizado"
  );
}

function normalizarRango(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "-";
  }

  if (typeof valor === "string" || typeof valor === "number") {
    return String(valor);
  }

  if (typeof valor === "object") {
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

    const texto =
      valor.texto ??
      valor.descripcion ??
      valor.referencia;

    if (texto) {
      return String(texto);
    }

    if (minimo !== undefined || maximo !== undefined) {
      return `${minimo ?? "-"} - ${maximo ?? "-"}`;
    }
  }

  return String(valor);
}

function fechaMilisegundos(valor) {
  if (!valor) {
    return 0;
  }

  if (typeof valor?.toMillis === "function") {
    return valor.toMillis();
  }

  if (typeof valor?.toDate === "function") {
    return valor.toDate().getTime();
  }

  if (typeof valor?.seconds === "number") {
    return valor.seconds * 1000;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? 0
    : fecha.getTime();
}

async function obtenerDocumento(
  coleccionNombre,
  id,
  laboratorioId
) {
  const idLimpio = limpiarTexto(id);

  if (!idLimpio) {
    return null;
  }

  const snapshot = await getDoc(
    doc(db, coleccionNombre, idLimpio)
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

async function obtenerValores(resultadoId) {
  const idResultado = limpiarTexto(resultadoId);

  if (!idResultado) {
    return [];
  }

  const snapshot = await getDocs(
    collection(
      db,
      "resultados",
      idResultado,
      "valores"
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
      limpiarTexto(resultado.unidad) || "-",
    rangoReferencia: "-",
    observacion:
      limpiarTexto(resultado.observaciones),
  };
}

export async function obtenerLaboratorioInforme(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(laboratorioId);

  if (!idLaboratorio) {
    return null;
  }

  const snapshot = await getDoc(
    doc(db, "laboratorios", idLaboratorio)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

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

  const snapshot = await getDocs(
    query(
      collection(db, "resultados"),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    )
  );

  const resultados = snapshot.docs
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .filter(estaFinalizado);

  const completos = await Promise.all(
    resultados.map(async (resultado) => {
      const [valores, analisis] =
        await Promise.all([
          obtenerValores(resultado.id),
          obtenerDocumento(
            "analisis",
            resultado.analisisId,
            idLaboratorio
          ),
        ]);

      return {
        ...resultado,
        analisisNombre:
          limpiarTexto(
            resultado.analisisNombre
          ) ||
          limpiarTexto(analisis?.nombre) ||
          limpiarTexto(
            analisis?.nombreAnalisis
          ) ||
          "Análisis clínico",
        parametros:
          valores.length > 0
            ? valores
            : [parametroGeneral(resultado)],
      };
    })
  );

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

  informes.sort(
    (a, b) =>
      b.fechaValidacion -
      a.fechaValidacion
  );

  return informes;
}
