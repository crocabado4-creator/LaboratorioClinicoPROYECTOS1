import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLECCION_ORDENES = "ordenes";
const COLECCION_MUESTRAS = "muestras";


// =====================================================
// UTILIDADES
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


function fechaMilisegundos(fecha) {
  if (!fecha) {
    return 0;
  }

  if (
    typeof fecha.toMillis ===
    "function"
  ) {
    return fecha.toMillis();
  }

  if (
    typeof fecha.seconds ===
    "number"
  ) {
    return fecha.seconds * 1000;
  }

  return 0;
}


// =====================================================
// NORMALIZAR ANÁLISIS
// =====================================================

function normalizarAnalisis(valor) {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map((item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      return {
        analisisId:
          limpiarTexto(
            item.analisisId
          ) ||
          limpiarTexto(
            item.id
          ),

        nombre:
          limpiarTexto(
            item.nombre
          ),

        precio:
          Number(
            item.precio || 0
          ),

        cantidad:
          Math.max(
            1,
            Number(
              item.cantidad || 1
            )
          ),
      };
    })
    .filter(
      (item) =>
        item &&
        item.analisisId
    );
}


// =====================================================
// CONVERTIR ORDEN
// =====================================================

function convertirOrden(
  documento
) {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    ordenId:
      limpiarTexto(
        datos.ordenId
      ) ||
      documento.id,

    ventaId:
      limpiarTexto(
        datos.ventaId
      ),

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ),

    empleadoId:
      limpiarTexto(
        datos.empleadoId
      ),

    fecha:
      datos.fecha || null,

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "generada",

    total:
      Number(
        datos.total || 0
      ),

    analisis:
      normalizarAnalisis(
        datos.analisis
      ),
  };
}


// =====================================================
// CONVERTIR MUESTRA
// =====================================================

function convertirMuestra(
  documento
) {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    muestraId:
      limpiarTexto(
        datos.muestraId
      ) ||
      documento.id,

    codigoEtiqueta:
      limpiarTexto(
        datos.codigoEtiqueta
      ) ||
      documento.id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    ordenId:
      limpiarTexto(
        datos.ordenId
      ),

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ),

    analisisId:
      limpiarTexto(
        datos.analisisId
      ),

    analisisNombre:
      limpiarTexto(
        datos.analisisNombre
      ),

    tipo:
      limpiarTexto(
        datos.tipo
      ),

    fechaToma:
      datos.fechaToma || null,

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "tomada",

    bioquimicoId:
      limpiarTexto(
        datos.bioquimicoId
      ),
  };
}


// =====================================================
// GENERAR ID ÚNICO DE MUESTRA
// =====================================================

function construirIdMuestra(
  ordenId,
  analisisId
) {
  return (
    ordenId +
    "__" +
    analisisId
  )
    .replace(
      /[\/\\#?\[\]]/g,
      "_"
    )
    .slice(
      0,
      1200
    );
}


// =====================================================
// HU-22
// OBTENER ÓRDENES PARA TOMA DE MUESTRA
// =====================================================

export async function obtenerOrdenesParaMuestras(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );

  if (!idLaboratorio) {
    return [];
  }

  const consulta =
    query(
      collection(
        db,
        COLECCION_ORDENES
      ),

      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );

  const resultado =
    await getDocs(
      consulta
    );

  return resultado.docs
    .map(
      convertirOrden
    )
    .filter(
      (orden) =>
        orden.estado !==
        "cancelada"
    )
    .sort(
      (a, b) =>
        fechaMilisegundos(
          b.fecha
        ) -
        fechaMilisegundos(
          a.fecha
        )
    );
}


// =====================================================
// HU-23
// OBTENER MUESTRAS
// =====================================================

export async function obtenerMuestras(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );

  if (!idLaboratorio) {
    return [];
  }

  const consulta =
    query(
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

  const resultado =
    await getDocs(
      consulta
    );

  return resultado.docs
    .map(
      convertirMuestra
    )
    .sort(
      (a, b) =>
        fechaMilisegundos(
          b.fechaToma
        ) -
        fechaMilisegundos(
          a.fechaToma
        )
    );
}


// =====================================================
// HU-22 + HU-23
// REGISTRAR TOMA E IDENTIFICACIÓN DE MUESTRA
// =====================================================

export async function registrarMuestra({
  laboratorioId,
  bioquimicoId,
  ordenId,
  analisisId,
  tipo,
}) {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );

  const idBioquimico =
    limpiarTexto(
      bioquimicoId
    );

  const idOrden =
    limpiarTexto(
      ordenId
    );

  const idAnalisis =
    limpiarTexto(
      analisisId
    );

  const tipoMuestra =
    limpiarTexto(
      tipo
    );


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (!idBioquimico) {
    throw new Error(
      "No se pudo identificar al bioquímico."
    );
  }


  if (!idOrden) {
    throw new Error(
      "Debe seleccionar una orden."
    );
  }


  if (!idAnalisis) {
    throw new Error(
      "Debe seleccionar un análisis."
    );
  }


  if (!tipoMuestra) {
    throw new Error(
      "Debe seleccionar el tipo de muestra."
    );
  }


  const ordenRef =
    doc(
      db,
      COLECCION_ORDENES,
      idOrden
    );


  const muestraId =
    construirIdMuestra(
      idOrden,
      idAnalisis
    );


  const muestraRef =
    doc(
      db,
      COLECCION_MUESTRAS,
      muestraId
    );


  let muestraCreada =
    null;


  await runTransaction(
    db,
    async (
      transaction
    ) => {

      const ordenSnap =
        await transaction.get(
          ordenRef
        );


      if (
        !ordenSnap.exists()
      ) {
        throw new Error(
          "La orden seleccionada no existe."
        );
      }


      const datosOrden =
        ordenSnap.data();


      if (
        limpiarTexto(
          datosOrden.laboratorioId
        ) !==
        idLaboratorio
      ) {
        throw new Error(
          "La orden pertenece a otro laboratorio."
        );
      }


      const pacienteId =
        limpiarTexto(
          datosOrden.pacienteId
        );


      if (!pacienteId) {
        throw new Error(
          "La orden no tiene un paciente válido."
        );
      }


      const analisis =
        normalizarAnalisis(
          datosOrden.analisis
        );


      const analisisOrden =
        analisis.find(
          (item) =>
            item.analisisId ===
            idAnalisis
        );


      if (!analisisOrden) {
        throw new Error(
          "El análisis seleccionado no pertenece a esta orden."
        );
      }


      const muestraSnap =
        await transaction.get(
          muestraRef
        );


      if (
        muestraSnap.exists()
      ) {
        throw new Error(
          "Ya existe una muestra para este análisis y esta orden."
        );
      }


      const codigoEtiqueta =
        (
          "M-" +
          muestraId
            .slice(
              -18
            )
            .toUpperCase()
        );


      muestraCreada = {
        muestraId,

        codigoEtiqueta,

        laboratorioId:
          idLaboratorio,

        ordenId:
          ordenSnap.id,

        solicitudId:
          limpiarTexto(
            datosOrden.solicitudId
          ),

        pacienteId,

        analisisId:
          analisisOrden.analisisId,

        analisisNombre:
          analisisOrden.nombre,

        tipo:
          tipoMuestra,

        fechaToma:
          serverTimestamp(),

        estado:
          "tomada",

        bioquimicoId:
          idBioquimico,
      };


      transaction.set(
        muestraRef,
        muestraCreada
      );
    }
  );


  return {
    ...muestraCreada,

    id:
      muestraId,
  };
}