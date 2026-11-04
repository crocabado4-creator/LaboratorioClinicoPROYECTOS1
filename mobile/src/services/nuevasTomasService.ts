import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

// =====================================================
// INTERFACES
// =====================================================

export interface NuevaTomaSolicitada {
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
  fechaSolicitud: unknown;

  nombrePaciente: string;
  ciPaciente: string;
  nombreAnalisis: string;
}

export interface ResultadoNuevaToma {
  correcto: boolean;
  mensaje: string;
  muestraId: string;
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function convertirTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function obtenerMensajeError(error: unknown): string {
  if (error instanceof Error) {
    if (
      "code" in error &&
      error.code === "permission-denied"
    ) {
      return (
        "Firestore rechazó la operación. " +
        "Verifica los permisos del Bioquímico."
      );
    }

    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

// =====================================================
// OBTENER BIOQUÍMICO
// =====================================================

async function obtenerBioquimico(): Promise<{
  uid: string;
  laboratorioId: string;
}> {
  const usuario = getAuth().currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión.");
  }

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
      "No se encontró tu usuario en Firestore."
    );
  }

  const datosUsuario = documentoUsuario.data();

  if (datosUsuario.activo !== true) {
    throw new Error("Tu usuario está inactivo.");
  }

  if (
    convertirTexto(datosUsuario.rol) !== "bioquimico"
  ) {
    throw new Error(
      "Esta función es exclusiva del Bioquímico."
    );
  }

  const laboratorioId = convertirTexto(
    datosUsuario.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  return {
    uid: usuario.uid,
    laboratorioId,
  };
}

// =====================================================
// ESCUCHAR SOLICITUDES
// =====================================================

export function escucharNuevasTomas(
  laboratorioId: string,
  callback: (solicitudes: NuevaTomaSolicitada[]) => void,
  callbackError?: (error: Error) => void
): Unsubscribe {
  if (!laboratorioId) {
    callbackError?.(
      new Error("No se identificó el laboratorio.")
    );

    return () => {};
  }

  const referencia = query(
    collection(db, "solicitudesNuevaToma"),
    where("laboratorioId", "==", laboratorioId)
  );

  let activo = true;
  let version = 0;

  const cancelar = onSnapshot(
    referencia,

    async (resultado) => {
      const versionActual = ++version;

      try {
        const documentos = resultado.docs.filter(
          (documento) =>
            convertirTexto(documento.data().estado) ===
            "pendiente"
        );

        const solicitudes = await Promise.all(
          documentos.map(async (documento) => {
            const datos = documento.data();

            let nombrePaciente =
              "Paciente no identificado";

            let ciPaciente = "";

            let nombreAnalisis =
              "Análisis no identificado";

            const pacienteId = convertirTexto(
              datos.pacienteId
            );

            const analisisId = convertirTexto(
              datos.analisisId
            );

            if (pacienteId) {
              const pacienteDocumento = await getDoc(
                doc(db, "pacientes", pacienteId)
              );

              if (pacienteDocumento.exists()) {
                const paciente =
                  pacienteDocumento.data();

                const nombre = [
                  convertirTexto(
                    paciente.nombres ?? paciente.nombre
                  ),
                  convertirTexto(
                    paciente.apellidos ?? paciente.apellido
                  ),
                ]
                  .filter(Boolean)
                  .join(" ");

                if (nombre) {
                  nombrePaciente = nombre;
                }

                ciPaciente = convertirTexto(
                  paciente.ci ??
                    paciente.carnetIdentidad
                );
              }
            }

            if (analisisId) {
              const analisisDocumento = await getDoc(
                doc(db, "analisis", analisisId)
              );

              if (analisisDocumento.exists()) {
                const analisis =
                  analisisDocumento.data();

                nombreAnalisis =
                  convertirTexto(
                    analisis.nombre ??
                      analisis.nombreAnalisis ??
                      analisis.descripcion
                  ) || "Análisis no identificado";
              }
            }

            const solicitud: NuevaTomaSolicitada = {
              id: documento.id,

              laboratorioId: convertirTexto(
                datos.laboratorioId
              ),

              muestraOriginalId: convertirTexto(
                datos.muestraOriginalId
              ),

              pacienteId,
              analisisId,

              ordenId: convertirTexto(
                datos.ordenId
              ),

              codigoMuestra: convertirTexto(
                datos.codigoMuestra
              ),

              motivoRechazo: convertirTexto(
                datos.motivoRechazo
              ),

              estado: convertirTexto(
                datos.estado
              ),

              solicitadoPor: convertirTexto(
                datos.solicitadoPor
              ),

              fechaSolicitud:
                datos.fechaSolicitud ?? null,

              nombrePaciente,
              ciPaciente,
              nombreAnalisis,
            };

            return solicitud;
          })
        );

        if (
          activo &&
          versionActual === version
        ) {
          callback(solicitudes);
        }
      } catch (error) {
        if (activo) {
          callbackError?.(
            new Error(obtenerMensajeError(error))
          );
        }
      }
    },

    (error) => {
      if (activo) {
        callbackError?.(
          new Error(obtenerMensajeError(error))
        );
      }
    }
  );

  return () => {
    activo = false;
    version++;
    cancelar();
  };
}

// =====================================================
// REGISTRAR NUEVA MUESTRA
// =====================================================

export async function registrarNuevaToma(
  solicitud: NuevaTomaSolicitada,
  tipoMuestra: string
): Promise<ResultadoNuevaToma> {
  const bioquimico = await obtenerBioquimico();

  const tipo = convertirTexto(tipoMuestra);

  if (!tipo) {
    throw new Error(
      "Selecciona el tipo de muestra."
    );
  }

  const referenciaSolicitud = doc(
    db,
    "solicitudesNuevaToma",
    solicitud.id
  );

  const referenciaNuevaMuestra = doc(
    collection(db, "muestras")
  );

  try {
    await runTransaction(
      db,
      async (transaccion) => {
        const documentoSolicitud =
          await transaccion.get(
            referenciaSolicitud
          );

        if (!documentoSolicitud.exists()) {
          throw new Error(
            "La solicitud no existe."
          );
        }

        const datos = documentoSolicitud.data();

        if (
          convertirTexto(datos.estado) !==
          "pendiente"
        ) {
          throw new Error(
            "Esta solicitud ya fue atendida."
          );
        }

        if (
          convertirTexto(datos.laboratorioId) !==
          bioquimico.laboratorioId
        ) {
          throw new Error(
            "La solicitud pertenece a otro laboratorio."
          );
        }

        const ordenId = convertirTexto(
          datos.ordenId
        );

        const pacienteId = convertirTexto(
          datos.pacienteId
        );

        const analisisId = convertirTexto(
          datos.analisisId
        );

        if (
          !ordenId ||
          !pacienteId ||
          !analisisId
        ) {
          throw new Error(
            "La solicitud tiene datos incompletos."
          );
        }

        transaccion.set(
          referenciaNuevaMuestra,
          {
            laboratorioId:
              bioquimico.laboratorioId,

            ordenId,
            pacienteId,
            analisisId,

            tipoMuestra: tipo,
            tipo,

            estado: "tomada",
            estadoValidacion: "pendiente",
            aceptada: false,

            registradoPor: bioquimico.uid,
            bioquimicoId: bioquimico.uid,

            fechaRegistro: serverTimestamp(),
            fechaToma: serverTimestamp(),

            muestraOriginalId:
              convertirTexto(
                datos.muestraOriginalId
              ),

            solicitudNuevaTomaId:
              solicitud.id,
          }
        );

        transaccion.update(
          referenciaSolicitud,
          {
            estado: "atendida",
            atendidoPor: bioquimico.uid,
            fechaAtencion: serverTimestamp(),
            nuevaMuestraId:
              referenciaNuevaMuestra.id,
          }
        );
      }
    );

    return {
      correcto: true,
      mensaje:
        "Nueva muestra registrada correctamente.",
      muestraId: referenciaNuevaMuestra.id,
    };
  } catch (error) {
    throw new Error(obtenerMensajeError(error));
  }
}