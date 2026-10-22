import { getAuth } from "firebase/auth";

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

export type EstadoValidacion =
  | "pendiente"
  | "aceptada"
  | "rechazada";

export type EstadoMuestra =
  | "tomada"
  | "aceptada"
  | "rechazada"
  | "en_proceso"
  | "procesada";

export type Muestra = {
  id: string;
  laboratorioId: string;
  ordenId: string;
  pacienteId: string;
  analisisId: string;

  solicitudId?: string;

  codigo?: string;
  codigoMuestra?: string;

  pacienteNombre?: string;
  analisisNombre?: string;

  tipoMuestra: string;
  observaciones?: string;

  estado: EstadoMuestra;
  estadoValidacion: EstadoValidacion;
  aceptada: boolean;

  motivoRechazo: string;

  registradoPor?: string;
  fechaRegistro?: unknown;
  fechaToma?: unknown;

  validadoPor?: string;
  fechaValidacion?: unknown;

  actualizadoPor?: string;
  fechaActualizacion?: unknown;

  historialEstados?: unknown[];
};

export type OrdenParaMuestra = {
  id: string;

  laboratorioId: string;
  pacienteId: string;

  analisisId: string;
  analisisIds: string[];

  solicitudId: string;
  estado: string;

  codigo?: string;
  codigoOrden?: string;

  pacienteNombre?: string;
  nombrePaciente?: string;

  analisis?: unknown[];
  analisisSolicitados?: unknown[];

  fechaCreacion?: unknown;
};

export type DatosRegistroMuestra = {
  ordenId: string;
  analisisId: string;
  tipoMuestra: string;

  codigoMuestra?: string;
  observaciones?: string;
};

type SesionBioquimico = {
  uid: string;
  laboratorioId: string;
};

type DatosOrden = Record<string, any>;

function normalizarTexto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function obtenerEstadoValidacion(
  valor: unknown
): EstadoValidacion {
  if (valor === "aceptada") {
    return "aceptada";
  }

  if (valor === "rechazada") {
    return "rechazada";
  }

  return "pendiente";
}

function obtenerEstadoMuestra(
  valor: unknown
): EstadoMuestra {
  if (
    valor === "tomada" ||
    valor === "aceptada" ||
    valor === "rechazada" ||
    valor === "en_proceso" ||
    valor === "procesada"
  ) {
    return valor;
  }

  return "tomada";
}

function obtenerMensajeError(error: unknown): Error {
  const codigo = (error as { code?: string })?.code;

  if (codigo === "permission-denied") {
    return new Error(
      "Firestore rechazó la operación. Verifica los permisos del Bioquímico para consultar o modificar muestras."
    );
  }

  if (codigo === "unavailable") {
    return new Error(
      "No se pudo conectar con Firebase. Verifica tu conexión a Internet."
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(
    "Ocurrió un error inesperado al gestionar las muestras."
  );
}

function extraerIdsAnalisis(valor: unknown): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  const ids = valor
    .map((item) => {
      if (typeof item === "string") {
        return normalizarTexto(item);
      }

      if (item && typeof item === "object") {
        const datos = item as Record<string, any>;

        return normalizarTexto(
          datos.analisisId ||
            datos.id ||
            datos.analisis?.id ||
            ""
        );
      }

      return "";
    })
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function obtenerAnalisisDeOrden(
  orden: DatosOrden
): string[] {
  const ids = [
    ...extraerIdsAnalisis(orden.analisis),
    ...extraerIdsAnalisis(orden.analisisIds),
    ...extraerIdsAnalisis(orden.analisisSolicitados),
  ];

  const analisisIndividual = normalizarTexto(
    orden.analisisId
  );

  if (analisisIndividual) {
    ids.push(analisisIndividual);
  }

  return Array.from(new Set(ids));
}

function generarCodigoMuestra(): string {
  const ahora = new Date();

  const fecha =
    ahora.getFullYear().toString() +
    String(ahora.getMonth() + 1).padStart(2, "0") +
    String(ahora.getDate()).padStart(2, "0");

  const aleatorio = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `MUE-${fecha}-${aleatorio}`;
}

// =====================================================
// SESIÓN DEL BIOQUÍMICO
// =====================================================

async function obtenerSesionBioquimico(): Promise<SesionBioquimico> {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión.");
  }

  const referencia = doc(
    db,
    "usuarios",
    usuario.uid
  );

  const resultado = await getDoc(referencia);

  if (!resultado.exists()) {
    throw new Error("No se encontró tu usuario.");
  }

  const datos = resultado.data();

  if (datos.activo !== true) {
    throw new Error("Tu cuenta está inactiva.");
  }

  const rol = normalizarTexto(
    datos.rol
  ).toLowerCase();

  if (
    rol !== "bioquimico" &&
    rol !== "bioquímico"
  ) {
    throw new Error(
      "Solo el Bioquímico puede gestionar y validar muestras."
    );
  }

  const laboratorioId = normalizarTexto(
    datos.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "Tu usuario no tiene laboratorio asignado."
    );
  }

  return {
    uid: usuario.uid,
    laboratorioId,
  };
}

// =====================================================
// LISTAR ÓRDENES DEL LABORATORIO
// =====================================================

export async function obtenerOrdenesParaMuestras(): Promise<
  OrdenParaMuestra[]
> {
  try {
    const sesion = await obtenerSesionBioquimico();

    const consulta = query(
      collection(db, "ordenes"),
      where(
        "laboratorioId",
        "==",
        sesion.laboratorioId
      )
    );

    const resultado = await getDocs(consulta);

    return resultado.docs.map((documento) => {
      const datos = documento.data();

      const analisisIds = obtenerAnalisisDeOrden(datos);

      return {
        id: documento.id,

        laboratorioId: normalizarTexto(
          datos.laboratorioId
        ),

        pacienteId: normalizarTexto(
          datos.pacienteId
        ),

        analisisId: normalizarTexto(
          datos.analisisId
        ),

        analisisIds,

        solicitudId: normalizarTexto(
          datos.solicitudId
        ),

        estado: normalizarTexto(
          datos.estado
        ),

        codigo: normalizarTexto(
          datos.codigo
        ),

        codigoOrden: normalizarTexto(
          datos.codigoOrden
        ),

        pacienteNombre: normalizarTexto(
          datos.pacienteNombre
        ),

        nombrePaciente: normalizarTexto(
          datos.nombrePaciente
        ),

        analisis: Array.isArray(datos.analisis)
          ? datos.analisis
          : [],

        analisisSolicitados: Array.isArray(
          datos.analisisSolicitados
        )
          ? datos.analisisSolicitados
          : [],

        fechaCreacion: datos.fechaCreacion,
      };
    });
  } catch (error) {
    throw obtenerMensajeError(error);
  }
}

// =====================================================
// LISTAR MUESTRAS
// =====================================================

export async function obtenerMuestras(): Promise<Muestra[]> {
  try {
    const sesion = await obtenerSesionBioquimico();

    const consulta = query(
      collection(db, "muestras"),
      where(
        "laboratorioId",
        "==",
        sesion.laboratorioId
      )
    );

    const resultado = await getDocs(consulta);

    return resultado.docs.map((documento) => {
      const datos = documento.data();

      return {
        id: documento.id,

        laboratorioId: normalizarTexto(
          datos.laboratorioId
        ),

        ordenId: normalizarTexto(
          datos.ordenId
        ),

        pacienteId: normalizarTexto(
          datos.pacienteId
        ),

        analisisId: normalizarTexto(
          datos.analisisId
        ),

        solicitudId: normalizarTexto(
          datos.solicitudId
        ),

        codigo: normalizarTexto(
          datos.codigo || datos.codigoMuestra
        ),

        codigoMuestra: normalizarTexto(
          datos.codigoMuestra || datos.codigo
        ),

        pacienteNombre: normalizarTexto(
          datos.pacienteNombre ||
            datos.nombrePaciente
        ),

        analisisNombre: normalizarTexto(
          datos.analisisNombre ||
            datos.nombreAnalisis
        ),

        tipoMuestra: normalizarTexto(
          datos.tipoMuestra
        ),

        observaciones: normalizarTexto(
          datos.observaciones
        ),

        estado: obtenerEstadoMuestra(
          datos.estado
        ),

        estadoValidacion:
          obtenerEstadoValidacion(
            datos.estadoValidacion
          ),

        aceptada: datos.aceptada === true,

        motivoRechazo: normalizarTexto(
          datos.motivoRechazo
        ),

        registradoPor: normalizarTexto(
          datos.registradoPor
        ),

        fechaRegistro: datos.fechaRegistro,

        fechaToma:
          datos.fechaToma ||
          datos.fechaRegistro,

        validadoPor: normalizarTexto(
          datos.validadoPor
        ),

        fechaValidacion: datos.fechaValidacion,

        actualizadoPor: normalizarTexto(
          datos.actualizadoPor
        ),

        fechaActualizacion:
          datos.fechaActualizacion,

        historialEstados: Array.isArray(
          datos.historialEstados
        )
          ? datos.historialEstados
          : [],
      };
    });
  } catch (error) {
    throw obtenerMensajeError(error);
  }
}

// =====================================================
// REGISTRAR MUESTRA
// =====================================================

export async function registrarMuestra(
  datos: DatosRegistroMuestra
): Promise<string> {
  try {
    const sesion = await obtenerSesionBioquimico();

    const ordenId = normalizarTexto(
      datos.ordenId
    );

    const analisisId = normalizarTexto(
      datos.analisisId
    );

    const tipoMuestra = normalizarTexto(
      datos.tipoMuestra
    );

    const observaciones = normalizarTexto(
      datos.observaciones
    );

    const codigoMuestra =
      normalizarTexto(datos.codigoMuestra) ||
      generarCodigoMuestra();

    if (!ordenId) {
      throw new Error(
        "Debes seleccionar una orden."
      );
    }

    if (!analisisId) {
      throw new Error(
        "Debes seleccionar un análisis."
      );
    }

    if (!tipoMuestra) {
      throw new Error(
        "Debes indicar el tipo de muestra."
      );
    }

    const referenciaOrden = doc(
      db,
      "ordenes",
      ordenId
    );

    const documentoOrden = await getDoc(
      referenciaOrden
    );

    if (!documentoOrden.exists()) {
      throw new Error(
        "La orden seleccionada no existe."
      );
    }

    const orden = documentoOrden.data();

    if (
      normalizarTexto(
        orden.laboratorioId
      ) !== sesion.laboratorioId
    ) {
      throw new Error(
        "La orden pertenece a otro laboratorio."
      );
    }

    const pacienteId = normalizarTexto(
      orden.pacienteId
    );

    const solicitudId = normalizarTexto(
      orden.solicitudId
    );

    if (!pacienteId) {
      throw new Error(
        "La orden no tiene un paciente asociado."
      );
    }

    const analisisOrden =
      obtenerAnalisisDeOrden(orden);

    if (
      !analisisOrden.includes(analisisId)
    ) {
      throw new Error(
        "El análisis seleccionado no pertenece a esta orden."
      );
    }

    const referenciaAnalisis = doc(
      db,
      "analisis",
      analisisId
    );

    const documentoAnalisis = await getDoc(
      referenciaAnalisis
    );

    if (!documentoAnalisis.exists()) {
      throw new Error(
        "El análisis seleccionado no existe."
      );
    }

    const datosAnalisis = documentoAnalisis.data();

    if (
      normalizarTexto(
        datosAnalisis.laboratorioId
      ) !== sesion.laboratorioId
    ) {
      throw new Error(
        "El análisis pertenece a otro laboratorio."
      );
    }

    const analisisNombre = normalizarTexto(
      datosAnalisis.nombre ||
        datosAnalisis.nombreAnalisis ||
        datosAnalisis.descripcion
    );

    const pacienteNombre = normalizarTexto(
      orden.pacienteNombre ||
        orden.nombrePaciente
    );

    const muestrasConsulta = query(
      collection(db, "muestras"),
      where(
        "laboratorioId",
        "==",
        sesion.laboratorioId
      ),
      where(
        "ordenId",
        "==",
        ordenId
      )
    );

    const muestrasExistentes = await getDocs(
      muestrasConsulta
    );

    const duplicado = muestrasExistentes.docs.some(
      (documento) => {
        const muestra = documento.data();

        return (
          normalizarTexto(
            muestra.analisisId
          ) === analisisId &&
          normalizarTexto(
            muestra.estado
          ) !== "rechazada"
        );
      }
    );

    if (duplicado) {
      throw new Error(
        "Este análisis ya tiene una muestra activa registrada en la orden."
      );
    }

    const referenciaNuevaMuestra = doc(
      collection(db, "muestras")
    );

    const nuevaMuestra = {
      codigo: codigoMuestra,
      codigoMuestra,

      laboratorioId:
        sesion.laboratorioId,

      ordenId,
      pacienteId,
      analisisId,
      solicitudId,

      pacienteNombre,
      analisisNombre,

      tipoMuestra,
      observaciones,

      estado: "tomada",
      estadoValidacion: "pendiente",
      aceptada: false,

      motivoRechazo: "",

      registradoPor: sesion.uid,

      fechaToma: serverTimestamp(),
      fechaRegistro: serverTimestamp(),

      actualizadoPor: sesion.uid,
      fechaActualizacion: serverTimestamp(),

      historialEstados: [
        {
          estado: "tomada",
          usuarioId: sesion.uid,
          fecha: new Date().toISOString(),
          observacion: "Muestra registrada",
        },
      ],
    };

    await runTransaction(
      db,
      async (transaccion) => {
        const ordenActual = await transaccion.get(
          referenciaOrden
        );

        const analisisActual = await transaccion.get(
          referenciaAnalisis
        );

        if (!ordenActual.exists()) {
          throw new Error(
            "La orden ya no existe."
          );
        }

        if (!analisisActual.exists()) {
          throw new Error(
            "El análisis ya no existe."
          );
        }

        const datosOrdenActual =
          ordenActual.data();

        const datosAnalisisActual =
          analisisActual.data();

        if (
          normalizarTexto(
            datosOrdenActual.laboratorioId
          ) !== sesion.laboratorioId
        ) {
          throw new Error(
            "La orden pertenece a otro laboratorio."
          );
        }

        if (
          normalizarTexto(
            datosAnalisisActual.laboratorioId
          ) !== sesion.laboratorioId
        ) {
          throw new Error(
            "El análisis pertenece a otro laboratorio."
          );
        }

        const idsActuales =
          obtenerAnalisisDeOrden(
            datosOrdenActual
          );

        if (
          !idsActuales.includes(analisisId)
        ) {
          throw new Error(
            "El análisis ya no pertenece a la orden."
          );
        }

        transaccion.set(
          referenciaNuevaMuestra,
          nuevaMuestra
        );
      }
    );

    return referenciaNuevaMuestra.id;
  } catch (error) {
    throw obtenerMensajeError(error);
  }
}

// =====================================================
// ACEPTAR MUESTRA
// =====================================================

export async function aceptarMuestra(
  muestraId: string
): Promise<void> {
  try {
    const sesion = await obtenerSesionBioquimico();

    const id = normalizarTexto(
      muestraId
    );

    if (!id) {
      throw new Error(
        "Selecciona una muestra."
      );
    }

    const referencia = doc(
      db,
      "muestras",
      id
    );

    await runTransaction(
      db,
      async (transaccion) => {
        const documento = await transaccion.get(
          referencia
        );

        if (!documento.exists()) {
          throw new Error(
            "La muestra no existe."
          );
        }

        const muestra = documento.data();

        if (
          normalizarTexto(
            muestra.laboratorioId
          ) !== sesion.laboratorioId
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (
          muestra.estadoValidacion === "aceptada" ||
          muestra.estadoValidacion === "rechazada"
        ) {
          throw new Error(
            "Esta muestra ya fue validada."
          );
        }

        if (
          muestra.estado !== "tomada" &&
          muestra.estado !== undefined
        ) {
          throw new Error(
            "Solo se pueden aceptar muestras en estado tomada."
          );
        }

        const historial = Array.isArray(
          muestra.historialEstados
        )
          ? muestra.historialEstados
          : [];

        transaccion.update(
          referencia,
          {
            estado: "aceptada",
            estadoValidacion: "aceptada",
            aceptada: true,

            motivoRechazo: "",

            validadoPor: sesion.uid,
            fechaValidacion:
              serverTimestamp(),

            actualizadoPor: sesion.uid,
            fechaActualizacion:
              serverTimestamp(),

            historialEstados: [
              ...historial,
              {
                estado: "aceptada",
                usuarioId: sesion.uid,
                fecha:
                  new Date().toISOString(),
                observacion:
                  "Muestra aceptada",
              },
            ],
          }
        );
      }
    );
  } catch (error) {
    throw obtenerMensajeError(error);
  }
}

// =====================================================
// RECHAZAR MUESTRA
// =====================================================

export async function rechazarMuestra(
  muestraId: string,
  motivo: string
): Promise<void> {
  try {
    const sesion = await obtenerSesionBioquimico();

    const id = normalizarTexto(
      muestraId
    );

    const motivoLimpio = normalizarTexto(
      motivo
    );

    if (!id) {
      throw new Error(
        "Selecciona una muestra."
      );
    }

    if (!motivoLimpio) {
      throw new Error(
        "Debes ingresar el motivo del rechazo."
      );
    }

    const referencia = doc(
      db,
      "muestras",
      id
    );

    await runTransaction(
      db,
      async (transaccion) => {
        const documento = await transaccion.get(
          referencia
        );

        if (!documento.exists()) {
          throw new Error(
            "La muestra no existe."
          );
        }

        const muestra = documento.data();

        if (
          normalizarTexto(
            muestra.laboratorioId
          ) !== sesion.laboratorioId
        ) {
          throw new Error(
            "La muestra pertenece a otro laboratorio."
          );
        }

        if (
          muestra.estadoValidacion === "aceptada" ||
          muestra.estadoValidacion === "rechazada"
        ) {
          throw new Error(
            "Esta muestra ya fue validada."
          );
        }

        if (
          muestra.estado !== "tomada" &&
          muestra.estado !== undefined
        ) {
          throw new Error(
            "Solo se pueden rechazar muestras en estado tomada."
          );
        }

        const historial = Array.isArray(
          muestra.historialEstados
        )
          ? muestra.historialEstados
          : [];

        transaccion.update(
          referencia,
          {
            estado: "rechazada",
            estadoValidacion: "rechazada",
            aceptada: false,

            motivoRechazo:
              motivoLimpio,

            validadoPor: sesion.uid,
            fechaValidacion:
              serverTimestamp(),

            actualizadoPor: sesion.uid,
            fechaActualizacion:
              serverTimestamp(),

            historialEstados: [
              ...historial,
              {
                estado: "rechazada",
                usuarioId: sesion.uid,
                fecha:
                  new Date().toISOString(),
                observacion:
                  motivoLimpio,
              },
            ],
          }
        );
      }
    );
  } catch (error) {
    throw obtenerMensajeError(error);
  }
}

// =====================================================
// VERIFICAR SI LA MUESTRA PUEDE PROCESARSE
// =====================================================

export async function validarMuestraParaProcesar(
  muestraId: string
): Promise<boolean> {
  try {
    const sesion = await obtenerSesionBioquimico();

    const id = normalizarTexto(
      muestraId
    );

    if (!id) {
      throw new Error(
        "Selecciona una muestra."
      );
    }

    const documento = await getDoc(
      doc(db, "muestras", id)
    );

    if (!documento.exists()) {
      throw new Error(
        "La muestra no existe."
      );
    }

    const muestra = documento.data();

    if (
      normalizarTexto(
        muestra.laboratorioId
      ) !== sesion.laboratorioId
    ) {
      throw new Error(
        "La muestra pertenece a otro laboratorio."
      );
    }

    if (
      muestra.estadoValidacion !== "aceptada" ||
      muestra.aceptada !== true
    ) {
      throw new Error(
        "Solo las muestras aceptadas pueden procesarse."
      );
    }

    if (
      muestra.estado !== "aceptada" &&
      muestra.estado !== "en_proceso"
    ) {
      throw new Error(
        "La muestra no se encuentra en un estado válido para procesamiento."
      );
    }

    return true;
  } catch (error) {
    throw obtenerMensajeError(error);
  }
}