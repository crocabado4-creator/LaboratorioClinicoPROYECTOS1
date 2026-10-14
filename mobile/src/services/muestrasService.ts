import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


const COLECCION_ORDENES =
  "ordenes";

const COLECCION_MUESTRAS =
  "muestras";


export type AnalisisOrden = {
  analisisId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};


export type OrdenParaMuestra = {
  id: string;
  ordenId: string;
  solicitudId: string;
  ventaId: string;
  laboratorioId: string;
  pacienteId: string;
  empleadoId: string;
  estado: string;
  total: number;
  fecha: unknown;
  analisis: AnalisisOrden[];
};


export type Muestra = {
  id: string;
  muestraId: string;
  laboratorioId: string;
  solicitudId: string;
  ordenId: string;
  pacienteId: string;
  analisisId: string;
  analisisNombre: string;
  bioquimicoId: string;
  tipo: string;
  codigoEtiqueta: string;
  estado: string;
  fechaToma: unknown;
};


export type RegistrarMuestraInput = {
  laboratorioId: string;
  bioquimicoId: string;
  ordenId: string;
  analisisId: string;
  tipo: string;
};


function texto(
  valor: unknown
): string {

  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }


  return String(
    valor
  ).trim();
}


function normalizarAnalisis(
  valor: unknown
): AnalisisOrden[] {

  if (
    !Array.isArray(
      valor
    )
  ) {
    return [];
  }


  return valor
    .map(
      (
        item
      ): AnalisisOrden | null => {

        if (
          !item ||
          typeof item !==
            "object"
        ) {
          return null;
        }


        const datos =
          item as Record<
            string,
            unknown
          >;


        const analisisId =
          texto(
            datos.analisisId
          );


        if (!analisisId) {
          return null;
        }


        const precio =
          Number(
            datos.precio || 0
          );

        const cantidad =
          Math.max(
            1,
            Number(
              datos.cantidad || 1
            )
          );


        const subtotal =
          Number(
            datos.subtotal
          );


        return {
          analisisId,

          nombre:
            texto(
              datos.nombre
            ) ||
            "Análisis",

          precio,

          cantidad,

          subtotal:
            Number.isFinite(
              subtotal
            )
              ? subtotal
              : precio *
                cantidad,
        };
      }
    )
    .filter(
      (
        item
      ): item is AnalisisOrden =>
        item !== null
    );
}


function convertirOrden(
  id: string,
  datos: DocumentData
): OrdenParaMuestra {

  return {
    id,

    ordenId:
      texto(
        datos.ordenId
      ) || id,

    solicitudId:
      texto(
        datos.solicitudId
      ),

    ventaId:
      texto(
        datos.ventaId
      ),

    laboratorioId:
      texto(
        datos.laboratorioId
      ),

    pacienteId:
      texto(
        datos.pacienteId
      ),

    empleadoId:
      texto(
        datos.empleadoId
      ),

    estado:
      texto(
        datos.estado
      ) ||
      "generada",

    total:
      Number(
        datos.total || 0
      ),

    fecha:
      datos.fecha || null,

    analisis:
      normalizarAnalisis(
        datos.analisis
      ),
  };
}


function convertirMuestra(
  id: string,
  datos: DocumentData
): Muestra {

  return {
    id,

    muestraId:
      texto(
        datos.muestraId
      ) || id,

    laboratorioId:
      texto(
        datos.laboratorioId
      ),

    solicitudId:
      texto(
        datos.solicitudId
      ),

    ordenId:
      texto(
        datos.ordenId
      ),

    pacienteId:
      texto(
        datos.pacienteId
      ),

    analisisId:
      texto(
        datos.analisisId
      ),

    analisisNombre:
      texto(
        datos.analisisNombre
      ) ||
      "Análisis",

    bioquimicoId:
      texto(
        datos.bioquimicoId
      ),

    tipo:
      texto(
        datos.tipo
      ),

    codigoEtiqueta:
      texto(
        datos.codigoEtiqueta
      ),

    estado:
      texto(
        datos.estado
      ) ||
      "tomada",

    fechaToma:
      datos.fechaToma ||
      null,
  };
}


function fechaNumero(
  fecha: unknown
): number {

  if (
    !fecha ||
    typeof fecha !==
      "object"
  ) {
    return 0;
  }


  const valor =
    fecha as {
      toMillis?: () => number;
      seconds?: number;
    };


  if (
    typeof valor.toMillis ===
    "function"
  ) {
    return valor.toMillis();
  }


  if (
    typeof valor.seconds ===
    "number"
  ) {
    return (
      valor.seconds *
      1000
    );
  }


  return 0;
}


function generarEtiqueta(): string {

  const fecha =
    Date.now()
      .toString()
      .slice(-8);


  const aleatorio =
    Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase();


  return `MUE-${fecha}-${aleatorio}`;
}


export async function
obtenerOrdenesParaMuestras(
  laboratorioId: string
): Promise<OrdenParaMuestra[]> {

  const idLaboratorio =
    texto(
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
      (item) =>
        convertirOrden(
          item.id,
          item.data()
        )
    )
    .filter(
      (orden) =>
        orden.analisis.length >
        0
    )
    .sort(
      (a, b) =>
        fechaNumero(
          b.fecha
        ) -
        fechaNumero(
          a.fecha
        )
    );
}


export async function obtenerMuestras(
  laboratorioId: string
): Promise<Muestra[]> {

  const idLaboratorio =
    texto(
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
      (item) =>
        convertirMuestra(
          item.id,
          item.data()
        )
    )
    .sort(
      (a, b) =>
        fechaNumero(
          b.fechaToma
        ) -
        fechaNumero(
          a.fechaToma
        )
    );
}


// ==========================================
// HU-22 + HU-23
// ==========================================

export async function registrarMuestra(
  datos: RegistrarMuestraInput
): Promise<string> {

  const laboratorioId =
    texto(
      datos.laboratorioId
    );

  const bioquimicoId =
    texto(
      datos.bioquimicoId
    );

  const ordenId =
    texto(
      datos.ordenId
    );

  const analisisId =
    texto(
      datos.analisisId
    );

  const tipo =
    texto(
      datos.tipo
    );


  if (!laboratorioId) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (!bioquimicoId) {
    throw new Error(
      "No se pudo identificar al Bioquímico."
    );
  }


  if (!ordenId) {
    throw new Error(
      "Selecciona una orden."
    );
  }


  if (!analisisId) {
    throw new Error(
      "Selecciona un análisis."
    );
  }


  if (!tipo) {
    throw new Error(
      "Indica el tipo de muestra."
    );
  }


  const ordenSnap =
    await getDoc(
      doc(
        db,
        COLECCION_ORDENES,
        ordenId
      )
    );


  if (
    !ordenSnap.exists()
  ) {
    throw new Error(
      "La orden no existe."
    );
  }


  const orden =
    convertirOrden(
      ordenSnap.id,
      ordenSnap.data()
    );


  if (
    orden.laboratorioId !==
    laboratorioId
  ) {
    throw new Error(
      "La orden pertenece a otro laboratorio."
    );
  }


  const analisis =
    orden.analisis.find(
      (item) =>
        item.analisisId ===
        analisisId
    );


  if (!analisis) {
    throw new Error(
      "El análisis no pertenece a esta orden."
    );
  }


  if (!orden.pacienteId) {
    throw new Error(
      "La orden no tiene paciente."
    );
  }


  // Una muestra por análisis de una orden.
  const muestraId =
    `${ordenId}__${analisisId}`;


  const muestraRef =
    doc(
      db,
      COLECCION_MUESTRAS,
      muestraId
    );


  const existente =
    await getDoc(
      muestraRef
    );


  if (
    existente.exists()
  ) {
    throw new Error(
      "Ya existe una muestra para este análisis."
    );
  }


  const codigoEtiqueta =
    generarEtiqueta();


  await setDoc(
    muestraRef,
    {
      muestraId,

      codigoEtiqueta,

      laboratorioId,

      ordenId:
        orden.ordenId,

      solicitudId:
        orden.solicitudId,

      pacienteId:
        orden.pacienteId,

      analisisId:
        analisis.analisisId,

      analisisNombre:
        analisis.nombre,

      tipo,

      bioquimicoId,

      fechaToma:
        serverTimestamp(),

      estado:
        "tomada",
    }
  );


  return muestraId;
}