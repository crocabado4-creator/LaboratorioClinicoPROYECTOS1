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


const COLECCION = "solicitudes";


export type DetalleSolicitud = {
  analisisId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};


export type Solicitud = {
  id: string;
  solicitudId: string;
  laboratorioId: string;
  pacienteId: string;
  empleadoId: string;
  fecha: unknown;
  estado: string;
  total: number;
  analisis: DetalleSolicitud[];
  ventaId?: string;
  ordenId?: string;
};


export type NuevaSolicitud = {
  laboratorioId: string;
  empleadoId: string;
  pacienteId: string;
  analisis: {
    analisisId: string;
    cantidad?: number;
  }[];
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


function convertirAnalisis(
  valor: unknown
): DetalleSolicitud[] {

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
      ): DetalleSolicitud | null => {

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

          precio:
            Number.isFinite(
              precio
            )
              ? precio
              : 0,

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
      ): item is DetalleSolicitud =>
        item !== null
    );
}


function convertirSolicitud(
  id: string,
  datos: DocumentData
): Solicitud {

  return {
    id,

    solicitudId:
      texto(
        datos.solicitudId
      ) || id,

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
      ) || "pendiente",

    total:
      Number(
        datos.total || 0
      ),

    analisis:
      convertirAnalisis(
        datos.analisis
      ),

    ventaId:
      texto(
        datos.ventaId
      ),

    ordenId:
      texto(
        datos.ordenId
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
// HU-17, HU-18, HU-19
// CREAR SOLICITUD
// ==========================================

export async function crearSolicitud(
  datos: NuevaSolicitud
): Promise<string> {

  const laboratorioId =
    texto(
      datos.laboratorioId
    );

  const empleadoId =
    texto(
      datos.empleadoId
    );

  const pacienteId =
    texto(
      datos.pacienteId
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


  if (!pacienteId) {
    throw new Error(
      "Selecciona un paciente."
    );
  }


  if (
    datos.analisis.length ===
    0
  ) {
    throw new Error(
      "Selecciona al menos un análisis."
    );
  }


  // Validar paciente
  const pacienteSnap =
    await getDoc(
      doc(
        db,
        "pacientes",
        pacienteId
      )
    );


  if (
    !pacienteSnap.exists()
  ) {
    throw new Error(
      "El paciente no existe."
    );
  }


  if (
    texto(
      pacienteSnap.data()
        .laboratorioId
    ) !==
    laboratorioId
  ) {
    throw new Error(
      "El paciente pertenece a otro laboratorio."
    );
  }


  const detalles:
    DetalleSolicitud[] =
    [];


  // Validar análisis
  for (
    const seleccionado of
    datos.analisis
  ) {

    const analisisId =
      texto(
        seleccionado.analisisId
      );


    if (!analisisId) {
      continue;
    }


    const analisisSnap =
      await getDoc(
        doc(
          db,
          "analisis",
          analisisId
        )
      );


    if (
      !analisisSnap.exists()
    ) {
      throw new Error(
        "Uno de los análisis no existe."
      );
    }


    const analisisDatos =
      analisisSnap.data();


    if (
      texto(
        analisisDatos
          .laboratorioId
      ) !==
      laboratorioId
    ) {
      throw new Error(
        "Uno de los análisis pertenece a otro laboratorio."
      );
    }


    if (
      analisisDatos.activo ===
      false
    ) {
      throw new Error(
        "Uno de los análisis está inactivo."
      );
    }


    const cantidad =
      Math.max(
        1,
        Number(
          seleccionado.cantidad ||
            1
        )
      );


    const precio =
      typeof analisisDatos
        .precio ===
        "number"
        ? analisisDatos.precio
        : Number(
            analisisDatos.precio ||
              0
          );


    detalles.push({
      analisisId:
        analisisSnap.id,

      nombre:
        texto(
          analisisDatos.nombre
        ) ||
        "Análisis",

      precio,

      cantidad,

      subtotal:
        precio *
        cantidad,
    });
  }


  if (
    detalles.length ===
    0
  ) {
    throw new Error(
      "No hay análisis válidos."
    );
  }


  // HU-19
  const total =
    detalles.reduce(
      (
        suma,
        item
      ) =>
        suma +
        item.subtotal,
      0
    );


  const referencia =
    doc(
      collection(
        db,
        COLECCION
      )
    );


  await setDoc(
    referencia,
    {
      solicitudId:
        referencia.id,

      laboratorioId,

      pacienteId,

      empleadoId,

      fecha:
        serverTimestamp(),

      estado:
        "pendiente",

      analisis:
        detalles,

      total,
    }
  );


  return referencia.id;
}


// ==========================================
// LISTAR SOLICITUDES
// ==========================================

export async function obtenerSolicitudes(
  laboratorioId: string
): Promise<Solicitud[]> {

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
        COLECCION
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
        convertirSolicitud(
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
// HU-18
// DETALLE DE UNA SOLICITUD
// ==========================================

export async function obtenerSolicitudPorId(
  solicitudId: string,
  laboratorioId: string
): Promise<Solicitud | null> {

  const id =
    texto(
      solicitudId
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
        COLECCION,
        id
      )
    );


  if (
    !resultado.exists()
  ) {
    return null;
  }


  const solicitud =
    convertirSolicitud(
      resultado.id,
      resultado.data()
    );


  if (
    solicitud.laboratorioId !==
    idLaboratorio
  ) {
    throw new Error(
      "No puedes consultar solicitudes de otro laboratorio."
    );
  }


  return solicitud;
}