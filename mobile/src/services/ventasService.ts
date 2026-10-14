import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


const COLECCION_SOLICITUDES =
  "solicitudes";

const COLECCION_VENTAS =
  "ventas";

const COLECCION_ORDENES =
  "ordenes";


export type AnalisisVenta = {
  analisisId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};


export type Venta = {
  id: string;
  ventaId: string;
  solicitudId: string;
  ordenId: string;
  laboratorioId: string;
  pacienteId: string;
  empleadoId: string;
  fecha: unknown;
  metodoPago: string;
  total: number;
  estado: string;
  analisis: AnalisisVenta[];
};


export type Orden = {
  id: string;
  ordenId: string;
  ventaId: string;
  solicitudId: string;
  laboratorioId: string;
  pacienteId: string;
  empleadoId: string;
  fecha: unknown;
  estado: string;
  total: number;
  analisis: AnalisisVenta[];
};


export type RegistrarVentaInput = {
  laboratorioId: string;
  empleadoId: string;
  solicitudId: string;
  metodoPago: string;
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
): AnalisisVenta[] {

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
      ): AnalisisVenta | null => {

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


        const subtotalDato =
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

          precio:
            Number.isFinite(
              precio
            )
              ? precio
              : 0,

          cantidad,

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
      ): item is AnalisisVenta =>
        item !== null
    );
}


function convertirVenta(
  id: string,
  datos: DocumentData
): Venta {

  return {
    id,

    ventaId:
      texto(
        datos.ventaId
      ) || id,

    solicitudId:
      texto(
        datos.solicitudId
      ),

    ordenId:
      texto(
        datos.ordenId
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

    fecha:
      datos.fecha || null,

    metodoPago:
      texto(
        datos.metodoPago
      ),

    total:
      Number(
        datos.total || 0
      ),

    estado:
      texto(
        datos.estado
      ) ||
      "pagada",

    analisis:
      normalizarAnalisis(
        datos.analisis
      ),
  };
}


function convertirOrden(
  id: string,
  datos: DocumentData
): Orden {

  return {
    id,

    ordenId:
      texto(
        datos.ordenId
      ) || id,

    ventaId:
      texto(
        datos.ventaId
      ),

    solicitudId:
      texto(
        datos.solicitudId
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

    fecha:
      datos.fecha || null,

    estado:
      texto(
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


// ==========================================
// HU-20
// REGISTRAR VENTA Y GENERAR ORDEN
// ==========================================

export async function
registrarVentaYGenerarOrden(
  datos: RegistrarVentaInput
): Promise<{
  ventaId: string;
  ordenId: string;
}> {

  const laboratorioId =
    texto(
      datos.laboratorioId
    );

  const empleadoId =
    texto(
      datos.empleadoId
    );

  const solicitudId =
    texto(
      datos.solicitudId
    );

  const metodoPago =
    texto(
      datos.metodoPago
    );


  if (!laboratorioId) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (!empleadoId) {
    throw new Error(
      "No se pudo identificar al usuario."
    );
  }


  if (!solicitudId) {
    throw new Error(
      "Selecciona una solicitud."
    );
  }


  if (!metodoPago) {
    throw new Error(
      "Selecciona un método de pago."
    );
  }


  const solicitudRef =
    doc(
      db,
      COLECCION_SOLICITUDES,
      solicitudId
    );


  const ventaRef =
    doc(
      collection(
        db,
        COLECCION_VENTAS
      )
    );


  const ordenRef =
    doc(
      collection(
        db,
        COLECCION_ORDENES
      )
    );


  await runTransaction(
    db,
    async (
      transaction
    ) => {

      const solicitudSnap =
        await transaction.get(
          solicitudRef
        );


      if (
        !solicitudSnap.exists()
      ) {
        throw new Error(
          "La solicitud no existe."
        );
      }


      const solicitud =
        solicitudSnap.data();


      if (
        texto(
          solicitud.laboratorioId
        ) !==
        laboratorioId
      ) {
        throw new Error(
          "La solicitud pertenece a otro laboratorio."
        );
      }


      // Evita vender dos veces.
      if (
        texto(
          solicitud.ventaId
        ) ||
        texto(
          solicitud.ordenId
        ) ||
        [
          "pagada",
          "vendida",
          "procesada",
        ].includes(
          texto(
            solicitud.estado
          ).toLowerCase()
        )
      ) {
        throw new Error(
          "Esta solicitud ya fue vendida."
        );
      }


      const pacienteId =
        texto(
          solicitud.pacienteId
        );


      const analisis =
        normalizarAnalisis(
          solicitud.analisis
        );


      const total =
        Number(
          solicitud.total || 0
        );


      if (!pacienteId) {
        throw new Error(
          "La solicitud no tiene un paciente válido."
        );
      }


      if (
        analisis.length ===
        0
      ) {
        throw new Error(
          "La solicitud no tiene análisis."
        );
      }


      if (
        !Number.isFinite(
          total
        ) ||
        total < 0
      ) {
        throw new Error(
          "El total no es válido."
        );
      }


      // VENTA
      transaction.set(
        ventaRef,
        {
          ventaId:
            ventaRef.id,

          solicitudId:
            solicitudSnap.id,

          ordenId:
            ordenRef.id,

          laboratorioId,

          pacienteId,

          empleadoId,

          fecha:
            serverTimestamp(),

          metodoPago,

          total,

          estado:
            "pagada",

          analisis,
        }
      );


      // ORDEN INDEPENDIENTE
      transaction.set(
        ordenRef,
        {
          ordenId:
            ordenRef.id,

          ventaId:
            ventaRef.id,

          solicitudId:
            solicitudSnap.id,

          laboratorioId,

          pacienteId,

          empleadoId,

          fecha:
            serverTimestamp(),

          estado:
            "generada",

          total,

          analisis,
        }
      );


      // ACTUALIZAR SOLICITUD
      transaction.update(
        solicitudRef,
        {
          ventaId:
            ventaRef.id,

          ordenId:
            ordenRef.id,

          estado:
            "pagada",

          fechaVenta:
            serverTimestamp(),
        }
      );
    }
  );


  return {
    ventaId:
      ventaRef.id,

    ordenId:
      ordenRef.id,
  };
}


// ==========================================
// HU-21
// HISTORIAL DE VENTAS
// ==========================================

export async function obtenerVentas(
  laboratorioId: string
): Promise<Venta[]> {

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
        COLECCION_VENTAS
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
        convertirVenta(
          item.id,
          item.data()
        )
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


// ==========================================
// OBTENER ORDEN
// ==========================================

export async function
obtenerOrdenPorId(
  ordenId: string,
  laboratorioId: string
): Promise<Orden | null> {

  const id =
    texto(
      ordenId
    );

  const idLaboratorio =
    texto(
      laboratorioId
    );


  if (!id) {
    return null;
  }


  const resultado =
    await getDoc(
      doc(
        db,
        COLECCION_ORDENES,
        id
      )
    );


  if (
    !resultado.exists()
  ) {
    return null;
  }


  const orden =
    convertirOrden(
      resultado.id,
      resultado.data()
    );


  if (
    orden.laboratorioId !==
    idLaboratorio
  ) {
    throw new Error(
      "La orden pertenece a otro laboratorio."
    );
  }


  return orden;
}