import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


const COLECCION_ORDENES =
  "ordenes";

const COLECCION_SOLICITUDES =
  "solicitudes";

const COLECCION_MUESTRAS =
  "muestras";


function limpiarTexto(
  valor
) {
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


function fechaMilisegundos(
  fecha
) {
  if (
    !fecha
  ) {
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
    return (
      fecha.seconds *
      1000
    );
  }


  if (
    fecha instanceof Date
  ) {
    return fecha.getTime();
  }


  return 0;
}


function normalizarAnalisis(
  valor
) {
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
      ) => {
        if (
          !item ||
          typeof item !==
            "object"
        ) {
          return null;
        }


        const analisisId =
          limpiarTexto(
            item.analisisId
          ) ||
          limpiarTexto(
            item.id
          );


        if (
          !analisisId
        ) {
          return null;
        }


        const precio =
          Number(
            item.precio ||
            0
          );


        const cantidad =
          Math.max(
            1,
            Number(
              item.cantidad ||
              1
            )
          );


        const subtotalDato =
          Number(
            item.subtotal
          );


        return {
          analisisId,

          nombre:
            limpiarTexto(
              item.nombre
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
              : (
                  Number.isFinite(
                    precio
                  )
                    ? precio
                    : 0
                ) *
                (
                  Number.isFinite(
                    cantidad
                  )
                    ? cantidad
                    : 1
                ),
        };
      }
    )
    .filter(
      (
        item
      ) =>
        item !==
        null
    );
}


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


async function completarOrdenConSolicitud(
  documento,
  laboratorioId
) {
  const datosOrden =
    documento.data();


  const solicitudId =
    limpiarTexto(
      datosOrden.solicitudId
    );


  let datosSolicitud =
    null;


  /*
   * Compatibilidad con órdenes antiguas.
   *
   * Si una orden no tiene pacienteId
   * o analisis[], recuperamos esos datos
   * desde la solicitud asociada.
   */
  if (
    solicitudId
  ) {
    try {
      const solicitudSnap =
        await getDoc(
          doc(
            db,
            COLECCION_SOLICITUDES,
            solicitudId
          )
        );


      if (
        solicitudSnap.exists()
      ) {
        const posibleSolicitud =
          solicitudSnap.data();


        if (
          limpiarTexto(
            posibleSolicitud.laboratorioId
          ) ===
          laboratorioId
        ) {
          datosSolicitud =
            posibleSolicitud;
        }
      }

    } catch (
      error
    ) {
      console.warn(
        `No se pudo completar la orden ${documento.id} desde la solicitud ${solicitudId}:`,
        error
      );
    }
  }


  const pacienteId =
    limpiarTexto(
      datosOrden.pacienteId
    ) ||
    limpiarTexto(
      datosSolicitud?.pacienteId
    );


  const analisisOrden =
    normalizarAnalisis(
      datosOrden.analisis
    );


  const analisisSolicitud =
    normalizarAnalisis(
      datosSolicitud?.analisis
    );


  const analisis =
    analisisOrden.length >
    0
      ? analisisOrden
      : analisisSolicitud;


  return {
    id:
      documento.id,

    ordenId:
      limpiarTexto(
        datosOrden.ordenId
      ) ||
      documento.id,

    ventaId:
      limpiarTexto(
        datosOrden.ventaId
      ),

    solicitudId,

    laboratorioId:
      limpiarTexto(
        datosOrden.laboratorioId
      ),

    pacienteId,

    empleadoId:
      limpiarTexto(
        datosOrden.empleadoId
      ) ||
      limpiarTexto(
        datosSolicitud?.empleadoId
      ),

    fecha:
      datosOrden.fecha ||
      datosSolicitud?.fecha ||
      null,

    estado:
      limpiarTexto(
        datosOrden.estado
      ) ||
      "generada",

    total:
      Number(
        datosOrden.total ??
        datosSolicitud?.total ??
        0
      ),

    analisis,
  };
}


export async function obtenerOrdenesParaMuestras(
  laboratorioId
) {
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


  const ordenes =
    await Promise.all(
      resultado.docs.map(
        (
          documento
        ) =>
          completarOrdenConSolicitud(
            documento,
            idLaboratorio
          )
      )
    );


  return ordenes
    .filter(
      (
        orden
      ) =>
        orden.laboratorioId ===
        idLaboratorio
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
  laboratorioId
) {
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
      convertirMuestra
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


function generarCodigoEtiqueta() {
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


  if (
    !idLaboratorio
  ) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (
    !idBioquimico
  ) {
    throw new Error(
      "No se pudo identificar al Bioquímico."
    );
  }


  if (
    !idOrden
  ) {
    throw new Error(
      "Debe seleccionar una orden."
    );
  }


  if (
    !idAnalisis
  ) {
    throw new Error(
      "Debe seleccionar un análisis."
    );
  }


  if (
    !tipoMuestra
  ) {
    throw new Error(
      "Debe seleccionar el tipo de muestra."
    );
  }


  const ordenSnap =
    await getDoc(
      doc(
        db,
        COLECCION_ORDENES,
        idOrden
      )
    );


  if (
    !ordenSnap.exists()
  ) {
    throw new Error(
      "La orden seleccionada no existe."
    );
  }


  const orden =
    await completarOrdenConSolicitud(
      ordenSnap,
      idLaboratorio
    );


  if (
    orden.laboratorioId !==
    idLaboratorio
  ) {
    throw new Error(
      "La orden pertenece a otro laboratorio."
    );
  }


  if (
    !orden.pacienteId
  ) {
    throw new Error(
      "La orden no tiene un paciente asociado."
    );
  }


  const analisis =
    orden.analisis.find(
      (
        item
      ) =>
        item.analisisId ===
        idAnalisis
    );


  if (
    !analisis
  ) {
    throw new Error(
      "El análisis seleccionado no pertenece a la orden."
    );
  }


  const muestrasActuales =
    await obtenerMuestras(
      idLaboratorio
    );


  const yaRegistrada =
    muestrasActuales.some(
      (
        muestra
      ) =>
        muestra.ordenId ===
          idOrden &&
        muestra.analisisId ===
          idAnalisis
    );


  if (
    yaRegistrada
  ) {
    throw new Error(
      "Ya existe una muestra registrada para este análisis de la orden."
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

      laboratorioId:
        idLaboratorio,

      solicitudId:
        orden.solicitudId,

      ordenId:
        idOrden,

      pacienteId:
        orden.pacienteId,

      analisisId:
        idAnalisis,

      analisisNombre:
        analisis.nombre,

      bioquimicoId:
        idBioquimico,

      tipo:
        tipoMuestra,

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
    creada
  );
}