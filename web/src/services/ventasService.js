import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLECCION_VENTAS = "ventas";
const COLECCION_ORDENES = "ordenes";
const COLECCION_SOLICITUDES = "solicitudes";


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

  if (
    fecha instanceof Date
  ) {
    return fecha.getTime();
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

      const precio =
        Number(
          item.precio || 0
        );

      const cantidad =
        Math.max(
          1,
          Number(
            item.cantidad || 1
          )
        );

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
          Number.isFinite(precio)
            ? precio
            : 0,

        cantidad:
          Number.isFinite(cantidad)
            ? cantidad
            : 1,

        subtotal:
          Number.isFinite(
            Number(
              item.subtotal
            )
          )
            ? Number(
                item.subtotal
              )
            : precio * cantidad,
      };
    })
    .filter(
      (item) =>
        item &&
        item.analisisId
    );
}


// =====================================================
// CONVERTIR VENTA
// =====================================================

function convertirVenta(
  documento
) {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    ventaId:
      limpiarTexto(
        datos.ventaId
      ) ||
      documento.id,

    solicitudId:
      limpiarTexto(
        datos.solicitudId
      ),

    ordenId:
      limpiarTexto(
        datos.ordenId
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

    metodoPago:
      limpiarTexto(
        datos.metodoPago
      ),

    total:
      Number(
        datos.total || 0
      ),

    estado:
      limpiarTexto(
        datos.estado
      ) ||
      "pagada",

    analisis:
      normalizarAnalisis(
        datos.analisis
      ),
  };
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
// HU-20
// REGISTRAR VENTA Y GENERAR ORDEN
// =====================================================

export async function registrarVentaYGenerarOrden({
  laboratorioId,
  empleadoId,
  solicitudId,
  metodoPago,
}) {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );

  const idEmpleado =
    limpiarTexto(
      empleadoId
    );

  const idSolicitud =
    limpiarTexto(
      solicitudId
    );

  const pago =
    limpiarTexto(
      metodoPago
    );


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (!idEmpleado) {
    throw new Error(
      "No se pudo identificar al usuario."
    );
  }


  if (!idSolicitud) {
    throw new Error(
      "Debe seleccionar una solicitud."
    );
  }


  if (!pago) {
    throw new Error(
      "Debe seleccionar un método de pago."
    );
  }


  const solicitudRef =
    doc(
      db,
      COLECCION_SOLICITUDES,
      idSolicitud
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
          "La solicitud seleccionada no existe."
        );
      }


      const solicitud =
        solicitudSnap.data();


      // Validar laboratorio
      if (
        limpiarTexto(
          solicitud.laboratorioId
        ) !==
        idLaboratorio
      ) {
        throw new Error(
          "La solicitud pertenece a otro laboratorio."
        );
      }


      // Evitar vender dos veces
      if (
        limpiarTexto(
          solicitud.ventaId
        ) ||
        limpiarTexto(
          solicitud.ordenId
        ) ||
        [
          "pagada",
          "vendida",
          "procesada",
        ].includes(
          limpiarTexto(
            solicitud.estado
          ).toLowerCase()
        )
      ) {
        throw new Error(
          "Esta solicitud ya tiene una venta u orden asociada."
        );
      }


      const pacienteId =
        limpiarTexto(
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
          "La solicitud no contiene análisis."
        );
      }


      if (
        !Number.isFinite(total) ||
        total < 0
      ) {
        throw new Error(
          "El total de la solicitud no es válido."
        );
      }


      // ===============================================
      // CREAR VENTA
      // ===============================================

      transaction.set(
        ventaRef,
        {
          ventaId:
            ventaRef.id,

          solicitudId:
            solicitudSnap.id,

          ordenId:
            ordenRef.id,

          laboratorioId:
            idLaboratorio,

          pacienteId,

          empleadoId:
            idEmpleado,

          fecha:
            serverTimestamp(),

          metodoPago:
            pago,

          total,

          estado:
            "pagada",

          analisis,
        }
      );


      // ===============================================
      // CREAR ORDEN INDEPENDIENTE
      // ===============================================

      transaction.set(
        ordenRef,
        {
          ordenId:
            ordenRef.id,

          ventaId:
            ventaRef.id,

          solicitudId:
            solicitudSnap.id,

          laboratorioId:
            idLaboratorio,

          pacienteId,

          empleadoId:
            idEmpleado,

          fecha:
            serverTimestamp(),

          estado:
            "generada",

          total,

          analisis,
        }
      );


      // ===============================================
      // ACTUALIZAR SOLICITUD
      // ===============================================

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


// =====================================================
// HU-21
// OBTENER HISTORIAL DE VENTAS
// =====================================================

export async function obtenerVentas(
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
      convertirVenta
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
// OBTENER ORDEN POR ID
// =====================================================

export async function obtenerOrdenPorId(
  ordenId,
  laboratorioId
) {
  const idOrden =
    limpiarTexto(
      ordenId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idOrden) {
    return null;
  }


  const referencia =
    doc(
      db,
      COLECCION_ORDENES,
      idOrden
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (
    !resultado.exists()
  ) {
    return null;
  }


  const orden =
    convertirOrden(
      resultado
    );


  if (
    idLaboratorio &&
    orden.laboratorioId !==
      idLaboratorio
  ) {
    throw new Error(
      "La orden pertenece a otro laboratorio."
    );
  }


  return orden;
}