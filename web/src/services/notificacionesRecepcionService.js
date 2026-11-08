import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
}

function obtenerFecha(datos) {
  return (
    datos.fechaActualizacion ||
    datos.fechaValidacion ||
    datos.fechaFinProcesamiento ||
    datos.fechaToma ||
    datos.fechaRegistro ||
    datos.fechaCreacion ||
    null
  );
}

function fechaNumero(fecha) {
  if (!fecha) return 0;

  if (typeof fecha.toMillis === "function") {
    return fecha.toMillis();
  }

  if (typeof fecha.seconds === "number") {
    return fecha.seconds * 1000;
  }

  const numero = new Date(fecha).getTime();

  return Number.isNaN(numero) ? 0 : numero;
}

// ======================================================
// OBTENER DATOS DEL USUARIO
// ======================================================

async function obtenerUsuarioActual() {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión.");
  }

  const referencia = doc(
    db,
    "usuarios",
    usuario.uid
  );

  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error(
      "El usuario autenticado no existe en Firestore."
    );
  }

  const datos = documento.data();

  if (datos.activo !== true) {
    throw new Error("Tu usuario está inactivo.");
  }

  const laboratorioId = texto(datos.laboratorioId);

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene un laboratorio asignado."
    );
  }

  return {
    uid: usuario.uid,
    rol: normalizar(datos.rol),
    laboratorioId,
  };
}

// ======================================================
// DATOS DEL PACIENTE
// ======================================================

function obtenerPaciente(muestra, pacientes) {
  return pacientes.find(
    (item) =>
      item.id === muestra.pacienteId ||
      item.pacienteId === muestra.pacienteId
  );
}

function obtenerNombrePaciente(muestra, pacientes) {
  const paciente = obtenerPaciente(
    muestra,
    pacientes
  );

  if (paciente) {
    const nombre = [
      paciente.nombres,
      paciente.apellidos,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (nombre) return nombre;
  }

  return (
    muestra.nombrePaciente ||
    muestra.pacienteNombre ||
    "Paciente no identificado"
  );
}

function obtenerCiPaciente(muestra, pacientes) {
  const paciente = obtenerPaciente(
    muestra,
    pacientes
  );

  return (
    paciente?.ci ||
    muestra.ciPaciente ||
    ""
  );
}

// ======================================================
// DATOS DEL ANÁLISIS
// ======================================================

function obtenerNombreAnalisis(muestra, analisis) {
  const encontrado = analisis.find(
    (item) =>
      item.id === muestra.analisisId ||
      item.analisisId === muestra.analisisId
  );

  if (encontrado) {
    return (
      encontrado.nombre ||
      encontrado.nombreAnalisis ||
      encontrado.descripcion ||
      "Análisis sin nombre"
    );
  }

  return (
    muestra.nombreAnalisis ||
    muestra.analisisNombre ||
    muestra.tipoAnalisis ||
    "Análisis no identificado"
  );
}

// ======================================================
// CONVERTIR MUESTRA EN NOTIFICACIÓN
// ======================================================

function convertirMuestra(
  muestra,
  pacientes,
  analisis,
  solicitudes
) {
  const estado = normalizar(muestra.estado);

  const codigo =
    muestra.codigoEtiqueta ||
    muestra.codigoMuestra ||
    muestra.codigo ||
    muestra.id;

  const nombrePaciente = obtenerNombrePaciente(
    muestra,
    pacientes
  );

  const ciPaciente = obtenerCiPaciente(
    muestra,
    pacientes
  );

  const nombreAnalisis = obtenerNombreAnalisis(
    muestra,
    analisis
  );

  const motivoRechazo = texto(
    muestra.motivoRechazo
  );

  const solicitudNuevaToma =
    solicitudes.find(
      (item) =>
        item.muestraOriginalId === muestra.id
    ) || null;

  let tipo = "";
  let titulo = "";
  let mensaje = "";

  if (estado === "rechazada") {
    tipo = "muestra_rechazada";

    titulo = "Muestra rechazada";

    mensaje =
      `La muestra ${codigo} fue rechazada. ` +
      `Motivo: ${
        motivoRechazo || "No especificado"
      }.`;
  } else if (estado === "procesada") {
    tipo = "muestra_procesada";

    titulo = "Procesamiento finalizado";

    mensaje =
      `La muestra ${codigo} terminó su procesamiento.`;
  } else if (
    estado === "tomada" ||
    estado === "aceptada" ||
    estado === "en_proceso"
  ) {
    tipo = "muestra_pendiente";

    titulo =
      estado === "tomada"
        ? "Muestra pendiente de validación"
        : estado === "aceptada"
        ? "Muestra aceptada"
        : "Muestra en procesamiento";

    mensaje =
      `La muestra ${codigo} se encuentra en estado: ` +
      estado.replace("_", " ") +
      ".";
  } else {
    return null;
  }

  const fecha = obtenerFecha(muestra);

  return {
    ...muestra,

    id: muestra.id,
    muestraId: muestra.id,

    codigoMuestra: codigo,
    nombrePaciente,
    ciPaciente,
    nombreAnalisis,

    tipo,
    titulo,
    mensaje,

    motivoRechazo,
    estadoMuestra: estado,

    fechaCreacion: fecha,
    fechaNumero: fechaNumero(fecha),

    requiereNuevaToma:
      estado === "rechazada",

    solicitudNuevaToma,

    origen: "muestra",
  };
}

// ======================================================
// ESCUCHAR NOTIFICACIONES EN TIEMPO REAL
// ======================================================

export function escucharNotificacionesRecepcion(
  laboratorioId,
  usuarioId,
  callback,
  callbackError = () => {}
) {
  const idLaboratorio = texto(laboratorioId);
  const idUsuario = texto(usuarioId);

  if (!idLaboratorio || !idUsuario) {
    callbackError(
      new Error(
        "No se identificó al usuario o laboratorio."
      )
    );

    return () => {};
  }

  const usuarioActual = getAuth().currentUser;

  if (
    !usuarioActual ||
    usuarioActual.uid !== idUsuario
  ) {
    callbackError(
      new Error("Sesión de usuario no válida.")
    );

    return () => {};
  }

  let muestras = [];
  let pacientes = [];
  let analisis = [];
  let solicitudes = [];

  let muestrasListas = false;
  let pacientesListos = false;
  let analisisListos = false;
  let solicitudesListas = false;

  let cancelado = false;

  function actualizar() {
    if (cancelado) return;

    if (
      !muestrasListas ||
      !pacientesListos ||
      !analisisListos ||
      !solicitudesListas
    ) {
      return;
    }

    const lista = muestras
      .map((muestra) =>
        convertirMuestra(
          muestra,
          pacientes,
          analisis,
          solicitudes
        )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.fechaNumero - a.fechaNumero
      );

    callback(lista);
  }

  function escucharColeccion(
    nombre,
    actualizarDatos
  ) {
    const consulta = query(
      collection(db, nombre),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );

    return onSnapshot(
      consulta,

      (resultado) => {
        if (cancelado) return;

        const datos = resultado.docs.map(
          (documento) => ({
            ...documento.data(),
            id: documento.id,
          })
        );

        actualizarDatos(datos);
        actualizar();
      },

      (error) => {
        if (cancelado) return;

        console.error(
          `Error consultando ${nombre}:`,
          error
        );

        callbackError(
          new Error(
            `No se pudo consultar ${nombre}: ` +
            error.message
          )
        );
      }
    );
  }

  const cancelarMuestras = escucharColeccion(
    "muestras",
    (datos) => {
      muestras = datos;
      muestrasListas = true;
    }
  );

  const cancelarPacientes = escucharColeccion(
    "pacientes",
    (datos) => {
      pacientes = datos;
      pacientesListos = true;
    }
  );

  const cancelarAnalisis = escucharColeccion(
    "analisis",
    (datos) => {
      analisis = datos;
      analisisListos = true;
    }
  );

  const cancelarSolicitudes = escucharColeccion(
    "solicitudesNuevaToma",
    (datos) => {
      solicitudes = datos;
      solicitudesListas = true;
    }
  );

  return () => {
    cancelado = true;

    cancelarMuestras();
    cancelarPacientes();
    cancelarAnalisis();
    cancelarSolicitudes();
  };
}

// ======================================================
// SOLICITAR NUEVA TOMA
// ======================================================

export async function solicitarNuevaToma(muestra) {
  const usuario = await obtenerUsuarioActual();

  if (usuario.rol !== "recepcionista") {
    throw new Error(
      "Solo Recepción puede solicitar una nueva toma."
    );
  }

  const muestraId = texto(
    muestra?.muestraId || muestra?.id
  );

  if (!muestraId) {
    throw new Error(
      "No se identificó la muestra."
    );
  }

  const referenciaMuestra = doc(
    db,
    "muestras",
    muestraId
  );

  const referenciaSolicitud = doc(
    db,
    "solicitudesNuevaToma",
    muestraId
  );

  try {
    await runTransaction(
      db,
      async (transaccion) => {

        // Consultar la muestra original.
        // No se realiza get() sobre la solicitud
        // para evitar el BatchGetDocuments denegado.

        const documentoMuestra =
          await transaccion.get(
            referenciaMuestra
          );

        if (!documentoMuestra.exists()) {
          throw new Error(
            "La muestra ya no existe."
          );
        }

        const datosMuestra =
          documentoMuestra.data();

        if (
          texto(datosMuestra.laboratorioId) !==
          usuario.laboratorioId
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (
          normalizar(datosMuestra.estado) !==
          "rechazada"
        ) {
          throw new Error(
            "Solo puedes solicitar una nueva toma de una muestra rechazada."
          );
        }

        const nuevaSolicitud = {
          laboratorioId:
            usuario.laboratorioId,

          muestraOriginalId:
            muestraId,

          pacienteId:
            texto(datosMuestra.pacienteId),

          analisisId:
            texto(datosMuestra.analisisId),

          ordenId:
            texto(datosMuestra.ordenId),

          codigoMuestra:
            texto(
              datosMuestra.codigoEtiqueta ||
              datosMuestra.codigoMuestra ||
              muestraId
            ),

          motivoRechazo:
            texto(datosMuestra.motivoRechazo) ||
            "No especificado",

          estado: "pendiente",

          solicitadoPor:
            usuario.uid,

          fechaSolicitud:
            serverTimestamp(),
        };

        // La escritura utiliza un ID fijo
        // basado en la muestra original.
        //
        // La regla de Firestore debe permitir
        // CREATE y proteger contra UPDATE
        // no autorizado.

        transaccion.set(
          referenciaSolicitud,
          nuevaSolicitud
        );
      }
    );

    return referenciaSolicitud.id;

  } catch (error) {
    console.error(
      "Error solicitando nueva toma:",
      error
    );

    if (error?.code === "permission-denied") {
      throw new Error(
        "Firestore rechazó la operación. " +
        "Verifica que Recepción tenga permisos " +
        "para consultar muestras y crear " +
        "solicitudesNuevaToma."
      );
    }

    throw error;
  }
}