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
  type QueryDocumentSnapshot,
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


function limpiarTexto(
  valor: unknown
): string {
  return typeof valor ===
    "string"
    ? valor.trim()
    : "";
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
          limpiarTexto(
            datos.analisisId
          ) ||
          limpiarTexto(
            datos.id
          );


        if (
          !analisisId
        ) {
          return null;
        }


        const precio =
          Number(
            datos.precio ||
            0
          );

        const cantidad =
          Math.max(
            1,
            Number(
              datos.cantidad ||
              1
            )
          );

        const subtotalDato =
          Number(
            datos.subtotal
          );


        return {
          analisisId,

          nombre:
            limpiarTexto(
              datos.nombre
            ) ||
            "Análisis",

          precio:
            Number.isFinite(
              precio
            )
              ? precio
              : 0,

          cantidad:
            Number.isFinite(
              cantidad
            )
              ? cantidad
              : 1,

          subtotal:
            Number.isFinite(
              subtotalDato
            )
              ? subtotalDato
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
  documento:
    QueryDocumentSnapshot<DocumentData>
): OrdenParaMuestra {
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

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    ventaId:
      limpiarTexto(
        datos.ventaId
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

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "generada",

    total:
      Number(
        datos.total ||
        0
      ),

    fecha:
      datos.fecha ||
      null,

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
      limpiarTexto(
        datos.muestraId
      ) ||
      id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    ordenId:
      limpiarTexto(
        datos.ordenId
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
      ) ||
      "Análisis",

    bioquimicoId:
      limpiarTexto(
        datos.bioquimicoId
      ),

    tipo:
      limpiarTexto(
        datos.tipo
      ),

    codigoEtiqueta:
      limpiarTexto(
        datos.codigoEtiqueta
      ),

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "tomada",

    fechaToma:
      datos.fechaToma ||
      null,
  };
}


function fechaMilisegundos(
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


function generarCodigoEtiqueta(): string {
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


export async function obtenerOrdenesParaMuestras(
  laboratorioId: string
): Promise<OrdenParaMuestra[]> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idLaboratorio
  ) {
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
      (
        orden
      ) =>
        orden.analisis.length >
        0
    )
    .sort(
      (
        a,
        b
      ) =>
        fechaMilisegundos(
          b.fecha
        ) -
        fechaMilisegundos(
          a.fecha
        )
    );
}


export async function obtenerMuestras(
  laboratorioId: string
): Promise<Muestra[]> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idLaboratorio
  ) {
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
      (
        documento
      ) =>
        convertirMuestra(
          documento.id,
          documento.data()
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        fechaMilisegundos(
          b.fechaToma
        ) -
        fechaMilisegundos(
          a.fechaToma
        )
    );
}


export async function registrarMuestra(
  datos:
    RegistrarMuestraInput
): Promise<Muestra> {
  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );

  const bioquimicoId =
    limpiarTexto(
      datos.bioquimicoId
    );

  const ordenId =
    limpiarTexto(
      datos.ordenId
    );

  const analisisId =
    limpiarTexto(
      datos.analisisId
    );

  const tipo =
    limpiarTexto(
      datos.tipo
    );


  if (
    !laboratorioId
  ) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (
    !bioquimicoId
  ) {
    throw new Error(
      "No se pudo identificar al Bioquímico."
    );
  }


  if (
    !ordenId
  ) {
    throw new Error(
      "Debe seleccionar una orden."
    );
  }


  if (
    !analisisId
  ) {
    throw new Error(
      "Debe seleccionar un análisis."
    );
  }


  if (
    !tipo
  ) {
    throw new Error(
      "Debe seleccionar el tipo de muestra."
    );
  }


  const ordenRef =
    doc(
      db,
      COLECCION_ORDENES,
      ordenId
    );


  const ordenSnap =
    await getDoc(
      ordenRef
    );


  if (
    !ordenSnap.exists()
  ) {
    throw new Error(
      "La orden seleccionada no existe."
    );
  }


  const ordenDatos =
    ordenSnap.data();


  if (
    limpiarTexto(
      ordenDatos.laboratorioId
    ) !==
    laboratorioId
  ) {
    throw new Error(
      "La orden pertenece a otro laboratorio."
    );
  }


  const analisisOrden =
    normalizarAnalisis(
      ordenDatos.analisis
    );


  const analisis =
    analisisOrden.find(
      (
        item
      ) =>
        item.analisisId ===
        analisisId
    );


  if (
    !analisis
  ) {
    throw new Error(
      "El análisis seleccionado no pertenece a la orden."
    );
  }


  const muestrasExistentes =
    await obtenerMuestras(
      laboratorioId
    );


  const duplicada =
    muestrasExistentes.some(
      (
        muestra
      ) =>
        muestra.ordenId ===
          ordenId &&
        muestra.analisisId ===
          analisisId
    );


  if (
    duplicada
  ) {
    throw new Error(
      "Esta orden ya tiene una muestra registrada para ese análisis."
    );
  }


  const referencia =
    doc(
      collection(
        db,
        COLECCION_MUESTRAS
      )
    );


  const codigoEtiqueta =
    generarCodigoEtiqueta();


  await setDoc(
    referencia,
    {
      muestraId:
        referencia.id,

      laboratorioId,

      solicitudId:
        limpiarTexto(
          ordenDatos.solicitudId
        ),

      ordenId,

      pacienteId:
        limpiarTexto(
          ordenDatos.pacienteId
        ),

      analisisId,

      analisisNombre:
        analisis.nombre,

      bioquimicoId,

      tipo,

      codigoEtiqueta,

      estado:
        "tomada",

      fechaToma:
        serverTimestamp(),
    }
  );


  const creada =
    await getDoc(
      referencia
    );


  if (
    !creada.exists()
  ) {
    throw new Error(
      "La muestra fue registrada, pero no pudo recuperarse."
    );
  }


  return convertirMuestra(
    creada.id,
    creada.data()
  );
}
