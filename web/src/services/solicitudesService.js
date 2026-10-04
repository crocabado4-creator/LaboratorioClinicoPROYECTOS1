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

import { db } from "../firebase/firebase";


// =====================================================
// COLECCIÓN
// =====================================================

const COLECCION = "solicitudes";


// =====================================================
// LIMPIAR TEXTO
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


// =====================================================
// CONVERTIR DOCUMENTO
// =====================================================

function convertirSolicitud(documento) {
  const datos = documento.data();

  return {
    id: documento.id,

    solicitudId:
      limpiarTexto(datos.solicitudId) ||
      documento.id,

    laboratorioId:
      limpiarTexto(datos.laboratorioId),

    pacienteId:
      limpiarTexto(datos.pacienteId),

    empleadoId:
      limpiarTexto(datos.empleadoId),

    fecha:
      datos.fecha || null,

    estado:
      limpiarTexto(datos.estado) ||
      "pendiente",

    total:
      Number(datos.total || 0),

    analisis:
      Array.isArray(datos.analisis)
        ? datos.analisis
        : [],
  };
}


// =====================================================
// VALIDAR ANÁLISIS
// =====================================================

function validarAnalisisSeleccionados(analisis) {
  if (
    !Array.isArray(analisis) ||
    analisis.length === 0
  ) {
    throw new Error(
      "Debe seleccionar al menos un análisis."
    );
  }

  analisis.forEach((item) => {
    const analisisId =
      limpiarTexto(item.analisisId);

    const nombre =
      limpiarTexto(item.nombre);

    const precio =
      Number(item.precio);

    const cantidad =
      Number(item.cantidad);

    if (!analisisId) {
      throw new Error(
        "Existe un análisis sin identificador."
      );
    }

    if (!nombre) {
      throw new Error(
        "Existe un análisis sin nombre."
      );
    }

    if (
      Number.isNaN(precio) ||
      precio < 0
    ) {
      throw new Error(
        `El precio de "${nombre}" no es válido.`
      );
    }

    if (
      !Number.isInteger(cantidad) ||
      cantidad < 1
    ) {
      throw new Error(
        `La cantidad de "${nombre}" no es válida.`
      );
    }
  });
}


// =====================================================
// PREPARAR ANÁLISIS
// =====================================================

function prepararAnalisis(analisis) {
  return analisis.map((item) => {
    const precio =
      Number(item.precio || 0);

    const cantidad =
      Number(item.cantidad || 1);

    return {
      analisisId:
        limpiarTexto(item.analisisId),

      nombre:
        limpiarTexto(item.nombre),

      precio,

      cantidad,

      subtotal:
        precio * cantidad,
    };
  });
}


// =====================================================
// CALCULAR TOTAL
// =====================================================

function calcularTotal(analisis) {
  return analisis.reduce(
    (acumulado, item) =>
      acumulado +
      Number(item.subtotal || 0),
    0
  );
}


// =====================================================
// VALIDAR PACIENTE
// =====================================================

async function validarPacienteLaboratorio(
  pacienteId,
  laboratorioId
) {
  const referencia =
    doc(
      db,
      "pacientes",
      pacienteId
    );

  const resultado =
    await getDoc(referencia);

  if (!resultado.exists()) {
    throw new Error(
      "El paciente seleccionado no existe."
    );
  }

  const paciente =
    resultado.data();

  if (
    paciente.laboratorioId !==
    laboratorioId
  ) {
    throw new Error(
      "El paciente no pertenece a este laboratorio."
    );
  }
}


// =====================================================
// VALIDAR ANÁLISIS CONTRA FIRESTORE
// =====================================================

async function validarAnalisisLaboratorio(
  analisis,
  laboratorioId
) {
  for (const item of analisis) {
    const referencia =
      doc(
        db,
        "analisis",
        item.analisisId
      );

    const resultado =
      await getDoc(referencia);

    if (!resultado.exists()) {
      throw new Error(
        `El análisis "${item.nombre}" ya no existe.`
      );
    }

    const actual =
      resultado.data();

    if (
      actual.laboratorioId !==
      laboratorioId
    ) {
      throw new Error(
        `El análisis "${item.nombre}" pertenece a otro laboratorio.`
      );
    }

    if (actual.activo === false) {
      throw new Error(
        `El análisis "${item.nombre}" está inactivo.`
      );
    }
  }
}


// =====================================================
// CREAR SOLICITUD
// HU-17 + HU-19
// =====================================================

export async function crearSolicitud(
  laboratorioId,
  empleadoId,
  pacienteId,
  analisisSeleccionados
) {
  const idLaboratorio =
    limpiarTexto(laboratorioId);

  const idEmpleado =
    limpiarTexto(empleadoId);

  const idPaciente =
    limpiarTexto(pacienteId);


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  if (!idEmpleado) {
    throw new Error(
      "No se pudo identificar al empleado."
    );
  }


  if (!idPaciente) {
    throw new Error(
      "Debe seleccionar un paciente."
    );
  }


  validarAnalisisSeleccionados(
    analisisSeleccionados
  );


  await validarPacienteLaboratorio(
    idPaciente,
    idLaboratorio
  );


  const analisis =
    prepararAnalisis(
      analisisSeleccionados
    );


  await validarAnalisisLaboratorio(
    analisis,
    idLaboratorio
  );


  const total =
    calcularTotal(analisis);


  const referencia =
    doc(
      collection(
        db,
        COLECCION
      )
    );


  const nuevaSolicitud = {
    solicitudId:
      referencia.id,

    laboratorioId:
      idLaboratorio,

    pacienteId:
      idPaciente,

    empleadoId:
      idEmpleado,

    fecha:
      serverTimestamp(),

    estado:
      "pendiente",

    total,

    analisis,
  };


  await setDoc(
    referencia,
    nuevaSolicitud
  );


  console.log(
    "Solicitud registrada:",
    referencia.id
  );


  return referencia.id;
}


// =====================================================
// LISTAR SOLICITUDES DEL LABORATORIO
// =====================================================

export async function obtenerSolicitudes(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(laboratorioId);


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
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
      convertirSolicitud
    )
    .sort((a, b) => {
      const fechaA =
        a.fecha?.seconds || 0;

      const fechaB =
        b.fecha?.seconds || 0;

      return fechaB - fechaA;
    });
}


// =====================================================
// OBTENER UNA SOLICITUD
// HU-18
// =====================================================

export async function obtenerSolicitudPorId(
  solicitudId,
  laboratorioId
) {
  const id =
    limpiarTexto(solicitudId);

  const idLaboratorio =
    limpiarTexto(laboratorioId);


  if (!id) {
    return null;
  }


  const referencia =
    doc(
      db,
      COLECCION,
      id
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (!resultado.exists()) {
    return null;
  }


  const solicitud =
    convertirSolicitud(resultado);


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