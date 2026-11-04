import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  where,
  type DocumentData,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// ======================================================
// TIPOS
// ======================================================

export type EstadoNotificacion =
  | "muestra_pendiente"
  | "muestra_rechazada"
  | "muestra_procesada";

export type FechaFirestore =
  | Timestamp
  | Date
  | string
  | number
  | null;

export interface SolicitudNuevaToma {
  id: string;
  laboratorioId: string;
  muestraOriginalId: string;
  pacienteId: string;
  analisisId: string;
  ordenId: string;
  codigoMuestra: string;
  motivoRechazo: string;
  estado: string;
  solicitadoPor: string;
  fechaSolicitud: FechaFirestore;
}

export interface NotificacionRecepcion {
  id: string;
  muestraId: string;
  laboratorioId: string;
  pacienteId: string;
  analisisId: string;
  ordenId: string;

  codigoMuestra: string;
  nombrePaciente: string;
  ciPaciente: string;
  nombreAnalisis: string;

  tipo: EstadoNotificacion;
  titulo: string;
  mensaje: string;

  motivoRechazo: string;
  estadoMuestra: string;

  fechaCreacion: FechaFirestore;
  fechaNumero: number;

  requiereNuevaToma: boolean;
  solicitudNuevaToma: SolicitudNuevaToma | null;
}

export interface ResultadoNuevaToma {
  correcto: boolean;
  mensaje: string;
}

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obtenerFecha(datos: DocumentData): FechaFirestore {
  return (
    datos.fechaActualizacion ??
    datos.fechaValidacion ??
    datos.fechaFinProcesamiento ??
    datos.fechaToma ??
    datos.fechaRegistro ??
    datos.fechaCreacion ??
    null
  ) as FechaFirestore;
}

function fechaNumero(fecha: FechaFirestore): number {
  if (!fecha) {
    return 0;
  }

  if (fecha instanceof Date) {
    return fecha.getTime();
  }

  if (typeof fecha === "number") {
    return fecha;
  }

  if (typeof fecha === "string") {
    const resultado = new Date(fecha).getTime();

    return Number.isNaN(resultado) ? 0 : resultado;
  }

  if (
    typeof fecha === "object" &&
    "toMillis" in fecha &&
    typeof fecha.toMillis === "function"
  ) {
    return fecha.toMillis();
  }

  return 0;
}

function obtenerError(error: unknown): Error {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const codigo = String(error.code);

    if (codigo === "permission-denied") {
      return new Error(
        "Firestore rechazó la operación. " +
          "Verifica que las reglas permitan al Recepcionista " +
          "crear solicitudesNuevaToma y consultar las muestras " +
          "de su laboratorio."
      );
    }

    if (codigo === "unavailable") {
      return new Error(
        "No se pudo conectar con Firestore. " +
          "Verifica tu conexión a Internet."
      );
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Ocurrió un error inesperado.");
}

// ======================================================
// OBTENER PACIENTE
// ======================================================

function buscarPaciente(
  muestra: DocumentData,
  pacientes: DocumentData[]
): DocumentData | undefined {
  return pacientes.find(
    (paciente) =>
      texto(paciente.id) === texto(muestra.pacienteId) ||
      texto(paciente.pacienteId) === texto(muestra.pacienteId)
  );
}

function obtenerNombrePaciente(
  muestra: DocumentData,
  pacientes: DocumentData[]
): string {
  const paciente = buscarPaciente(muestra, pacientes);

  if (paciente) {
    const nombre = [
      texto(paciente.nombres || paciente.nombre),
      texto(paciente.apellidos || paciente.apellido),
    ]
      .filter(Boolean)
      .join(" ");

    if (nombre) {
      return nombre;
    }
  }

  return (
    texto(muestra.nombrePaciente) ||
    texto(muestra.pacienteNombre) ||
    "Paciente no identificado"
  );
}

function obtenerCiPaciente(
  muestra: DocumentData,
  pacientes: DocumentData[]
): string {
  const paciente = buscarPaciente(muestra, pacientes);

  return (
    texto(paciente?.ci) ||
    texto(paciente?.carnetIdentidad) ||
    texto(muestra.ciPaciente) ||
    ""
  );
}

// ======================================================
// OBTENER ANÁLISIS
// ======================================================

function obtenerNombreAnalisis(
  muestra: DocumentData,
  analisis: DocumentData[]
): string {
  const encontrado = analisis.find(
    (item) =>
      texto(item.id) === texto(muestra.analisisId) ||
      texto(item.analisisId) === texto(muestra.analisisId)
  );

  if (encontrado) {
    return (
      texto(encontrado.nombre) ||
      texto(encontrado.nombreAnalisis) ||
      texto(encontrado.descripcion) ||
      "Análisis sin nombre"
    );
  }

  return (
    texto(muestra.nombreAnalisis) ||
    texto(muestra.analisisNombre) ||
    texto(muestra.tipoAnalisis) ||
    "Análisis no identificado"
  );
}

// ======================================================
// CONVERTIR SOLICITUD
// ======================================================

function convertirSolicitud(
  datos: DocumentData
): SolicitudNuevaToma {
  return {
    id: texto(datos.id),
    laboratorioId: texto(datos.laboratorioId),
    muestraOriginalId: texto(datos.muestraOriginalId),
    pacienteId: texto(datos.pacienteId),
    analisisId: texto(datos.analisisId),
    ordenId: texto(datos.ordenId),
    codigoMuestra: texto(datos.codigoMuestra),
    motivoRechazo: texto(datos.motivoRechazo),
    estado: texto(datos.estado),
    solicitadoPor: texto(datos.solicitadoPor),
    fechaSolicitud: (datos.fechaSolicitud ??
      null) as FechaFirestore,
  };
}

// ======================================================
// CONVERTIR MUESTRA EN NOTIFICACIÓN
// ======================================================

function convertirMuestra(
  muestra: DocumentData,
  pacientes: DocumentData[],
  analisis: DocumentData[],
  solicitudes: DocumentData[]
): NotificacionRecepcion | null {
  const estado = normalizar(muestra.estado);
  const muestraId = texto(muestra.id);

  if (!muestraId) {
    return null;
  }

  const codigo =
    texto(muestra.codigoEtiqueta) ||
    texto(muestra.codigoMuestra) ||
    texto(muestra.codigo) ||
    muestraId;

  const nombrePaciente = obtenerNombrePaciente(
    muestra,
    pacientes
  );

  const ciPaciente = obtenerCiPaciente(muestra, pacientes);

  const nombreAnalisis = obtenerNombreAnalisis(
    muestra,
    analisis
  );

  const motivoRechazo = texto(muestra.motivoRechazo);

  const solicitudEncontrada = solicitudes.find(
    (solicitud) =>
      texto(solicitud.muestraOriginalId) === muestraId &&
      normalizar(solicitud.estado) === "pendiente"
  );

  const solicitudNuevaToma = solicitudEncontrada
    ? convertirSolicitud(solicitudEncontrada)
    : null;

  let tipo: EstadoNotificacion;
  let titulo = "";
  let mensaje = "";

  if (estado === "rechazada") {
    tipo = "muestra_rechazada";
    titulo = "Muestra rechazada";

    mensaje =
      `La muestra ${codigo} fue rechazada. ` +
      `Motivo: ${motivoRechazo || "No especificado"}.`;
  } else if (
    estado === "procesada" ||
    estado === "finalizada"
  ) {
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
      `${estado.replace("_", " ")}.`;
  } else {
    return null;
  }

  const fecha = obtenerFecha(muestra);

  return {
    id: muestraId,
    muestraId,
    laboratorioId: texto(muestra.laboratorioId),
    pacienteId: texto(muestra.pacienteId),
    analisisId: texto(muestra.analisisId),
    ordenId: texto(muestra.ordenId),

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

    requiereNuevaToma: estado === "rechazada",
    solicitudNuevaToma,
  };
}

// ======================================================
// ESCUCHAR NOTIFICACIONES EN TIEMPO REAL
// ======================================================

export function escucharNotificacionesRecepcion(
  laboratorioId: string,
  usuarioId: string,
  callback: (
    notificaciones: NotificacionRecepcion[]
  ) => void,
  callbackError: (error: Error) => void = () => {}
): Unsubscribe {
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
      new Error("La sesión del usuario no es válida.")
    );

    return () => {};
  }

  let muestras: DocumentData[] = [];
  let pacientes: DocumentData[] = [];
  let analisis: DocumentData[] = [];
  let solicitudes: DocumentData[] = [];

  let muestrasListas = false;
  let pacientesListos = false;
  let analisisListos = false;
  let solicitudesListas = false;

  let cancelado = false;

  const cancelaciones: Unsubscribe[] = [];

  function actualizar(): void {
    if (cancelado) {
      return;
    }

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
      .filter(
        (item): item is NotificacionRecepcion =>
          item !== null
      )
      .sort(
        (a, b) => b.fechaNumero - a.fechaNumero
      );

    callback(lista);
  }

  function escucharColeccion(
    nombre: string,
    actualizarDatos: (
      datos: DocumentData[]
    ) => void
  ): Unsubscribe {
    const consulta = query(
      collection(db, nombre),
      where("laboratorioId", "==", idLaboratorio)
    );

    return onSnapshot(
      consulta,
      (resultado) => {
        if (cancelado) {
          return;
        }

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
        if (cancelado) {
          return;
        }

        callbackError(
          new Error(
            `No se pudo consultar ${nombre}: ${error.message}`
          )
        );
      }
    );
  }

  cancelaciones.push(
    escucharColeccion("muestras", (datos) => {
      muestras = datos;
      muestrasListas = true;
    })
  );

  cancelaciones.push(
    escucharColeccion("pacientes", (datos) => {
      pacientes = datos;
      pacientesListos = true;
    })
  );

  cancelaciones.push(
    escucharColeccion("analisis", (datos) => {
      analisis = datos;
      analisisListos = true;
    })
  );

  cancelaciones.push(
    escucharColeccion(
      "solicitudesNuevaToma",
      (datos) => {
        solicitudes = datos;
        solicitudesListas = true;
      }
    )
  );

  return () => {
    cancelado = true;

    cancelaciones.forEach((cancelar) => cancelar());
  };
}

// ======================================================
// SOLICITAR NUEVA TOMA
// ======================================================

export async function solicitarNuevaToma(
  muestra: NotificacionRecepcion
): Promise<ResultadoNuevaToma> {
  try {
    const usuario = getAuth().currentUser;

    if (!usuario) {
      throw new Error(
        "Debes iniciar sesión nuevamente."
      );
    }

    const muestraId = texto(
      muestra.muestraId || muestra.id
    );

    if (!muestraId) {
      throw new Error(
        "No se identificó la muestra."
      );
    }

    // ==================================================
    // VALIDAR USUARIO
    // ==================================================

    const referenciaUsuario = doc(
      db,
      "usuarios",
      usuario.uid
    );

    const documentoUsuario = await getDoc(
      referenciaUsuario
    );

    if (!documentoUsuario.exists()) {
      throw new Error(
        "El usuario no existe en el sistema."
      );
    }

    const datosUsuario = documentoUsuario.data();

    if (
      normalizar(datosUsuario.rol) !== "recepcionista"
    ) {
      throw new Error(
        "Solo Recepción puede solicitar una nueva toma."
      );
    }

    if (datosUsuario.activo !== true) {
      throw new Error(
        "Tu usuario está inactivo."
      );
    }

    const laboratorioId = texto(
      datosUsuario.laboratorioId
    );

    if (!laboratorioId) {
      throw new Error(
        "No se identificó el laboratorio."
      );
    }

    // ==================================================
    // CONSULTAR MUESTRA ORIGINAL
    // ==================================================

    const referenciaMuestra = doc(
      db,
      "muestras",
      muestraId
    );

    const documentoMuestra = await getDoc(
      referenciaMuestra
    );

    if (!documentoMuestra.exists()) {
      throw new Error(
        "La muestra original no existe."
      );
    }

    const datosMuestra = documentoMuestra.data();

    if (
      texto(datosMuestra.laboratorioId) !==
      laboratorioId
    ) {
      throw new Error(
        "La muestra no pertenece a tu laboratorio."
      );
    }

    if (
      normalizar(datosMuestra.estado) !== "rechazada"
    ) {
      throw new Error(
        "Solo se puede solicitar una nueva toma " +
          "cuando la muestra está rechazada."
      );
    }

    // ==================================================
    // VALIDAR DATOS DE LA MUESTRA
    // ==================================================

    const pacienteId = texto(
      datosMuestra.pacienteId
    );

    const analisisId = texto(
      datosMuestra.analisisId
    );

    const ordenId = texto(
      datosMuestra.ordenId
    );

    if (!pacienteId) {
      throw new Error(
        "La muestra no tiene pacienteId."
      );
    }

    if (!analisisId) {
      throw new Error(
        "La muestra no tiene analisisId."
      );
    }

    if (!ordenId) {
      throw new Error(
        "La muestra no tiene ordenId."
      );
    }

    const codigoMuestra =
      texto(datosMuestra.codigoEtiqueta) ||
      texto(datosMuestra.codigoMuestra) ||
      texto(datosMuestra.codigo) ||
      muestraId;

    const motivoRechazo =
      texto(datosMuestra.motivoRechazo) ||
      "No especificado";

    // ==================================================
    // CREAR SOLICITUD
    // ==================================================

    // El ID de la solicitud será el ID real
    // del documento original de la muestra.
    //
    // No se consulta el documento inexistente
    // antes de escribir.
    //
    // La operación merge:false intenta escribir
    // exactamente los campos especificados.
    //
    // IMPORTANTE:
    // setDoc no garantiza por sí solo que no
    // se sobrescriba una solicitud existente.
    // La regla de Firestore debe impedirlo.

    const referenciaSolicitud = doc(
      db,
      "solicitudesNuevaToma",
      muestraId
    );

    await setDoc(
      referenciaSolicitud,
      {
        laboratorioId,
        muestraOriginalId: muestraId,
        pacienteId,
        analisisId,
        ordenId,
        codigoMuestra,
        motivoRechazo,
        estado: "pendiente",
        solicitadoPor: usuario.uid,
        fechaSolicitud: serverTimestamp(),
      }
    );

    return {
      correcto: true,
      mensaje:
        "Nueva toma solicitada correctamente. " +
        "Pendiente de atención por el Bioquímico.",
    };
  } catch (error) {
    throw obtenerError(error);
  }
}