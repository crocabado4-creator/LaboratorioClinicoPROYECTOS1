import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

export type Registro = {
  id: string;
  [campo: string]: any;
};

export type TipoReporte =
  | "pacientes"
  | "analisis"
  | "ventas"
  | "ordenes"
  | "resultados";

export type ResumenLaboratorio = {
  laboratorio: string;
  pacientes: number;
  analisis: number;
  ventas: number;
  totalVendido: number;
  ordenes: number;
  resultadosFinalizados: number;
  resultadosPendientes: number;
  muestrasPendientes: number;
};

export function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

export function fecha(valor: any): string {
  if (!valor) return "-";

  let resultado: Date;

  if (typeof valor.toDate === "function") {
    resultado = valor.toDate();
  } else if (typeof valor.seconds === "number") {
    resultado = new Date(valor.seconds * 1000);
  } else {
    resultado = new Date(valor);
  }

  return Number.isNaN(resultado.getTime())
    ? "-"
    : resultado.toLocaleString("es-BO");
}

async function contextoAdministrador() {
  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error("Debes iniciar sesión.");
  }

  const perfil = await getDoc(doc(db, "usuarios", usuario.uid));

  if (!perfil.exists()) {
    throw new Error("No existe el perfil del usuario.");
  }

  const datos = perfil.data();
  const rol = texto(datos.rol).toLowerCase();

  if (rol !== "administrador") {
    throw new Error("Este módulo es exclusivo del Administrador.");
  }

  if (datos.activo === false) {
    throw new Error("La cuenta está desactivada.");
  }

  const laboratorioId = texto(datos.laboratorioId);

  if (!laboratorioId) {
    throw new Error("Tu cuenta no tiene laboratorio asignado.");
  }

  return { laboratorioId };
}

async function listar(
  nombre: string,
  laboratorioId: string
): Promise<Registro[]> {
  const snapshot = await getDocs(
    query(
      collection(db, nombre),
      where("laboratorioId", "==", laboratorioId)
    )
  );

  return snapshot.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// =====================================================
// ENLAZAR LOS REPORTES CON EL PACIENTE REAL
// =====================================================

// Algunos documentos guardan "pacienteId", otros "idPaciente"
// y otros solo guardan "ordenId" o "solicitudId".
// Se buscan relaciones dentro del MISMO laboratorio.

function primerDato(registro: Registro, campos: string[]): string {
  for (const campo of campos) {
    const valor = registro[campo];

    if (typeof valor === "string" || typeof valor === "number") {
      const resultado = texto(valor);
      if (resultado) return resultado;
    }

    if (valor && typeof valor === "object") {
      // Soporta referencias embebidas: { id: "..." }.
      const identificador = texto(valor.id ?? valor.uid);
      if (identificador) return identificador;
    }
  }

  return "";
}

function nombreDesdePaciente(paciente: Registro): string {
  const completo = texto(
    paciente.nombreCompleto ?? paciente.nombre_completo
  );

  const nombres = texto(
    paciente.nombres ?? paciente.nombre ?? paciente.primerNombre
  );

  const apellidos = texto(
    paciente.apellidos ?? paciente.apellido ?? paciente.primerApellido
  );

  return completo || [nombres, apellidos].filter(Boolean).join(" ");
}

function nombreGuardado(registro: Registro): string {
  const directo = primerDato(registro, [
    "pacienteNombre",
    "nombrePaciente",
    "pacienteNombreCompleto",
    "nombreCompletoPaciente",
  ]);

  if (directo) return directo;

  const paciente = registro.paciente;
  if (paciente && typeof paciente === "object") {
    return nombreDesdePaciente(paciente as Registro);
  }

  return "";
}

const CLAVES_PACIENTE = [
  "pacienteId",
  "idPaciente",
  "paciente_id",
  "pacienteUid",
  "pacienteUID",
  "paciente",
];

const CLAVES_CI = [
  "pacienteCI",
  "pacienteCi",
  "ciPaciente",
  "ci_paciente",
  "pacienteDocumento",
  "ci",
];

type TipoRelacion = "ventas" | "ordenes" | "solicitudes" | "resultados";

const ENLACES: Record<TipoRelacion, string[]> = {
  ventas: ["ventaId", "idVenta", "venta_id", "venta"],
  ordenes: ["ordenId", "idOrden", "orden_id", "orden"],
  solicitudes: [
    "solicitudId",
    "idSolicitud",
    "solicitud_id",
    "solicitud",
  ],
  resultados: ["resultadoId", "idResultado", "resultado_id"],
};

function indexar(registros: Registro[]): Map<string, Registro> {
  return new Map(registros.map((registro) => [texto(registro.id), registro]));
}

function resolverPaciente(
  original: Registro,
  tipo: TipoReporte,
  pacientesPorId: Map<string, Registro>,
  pacientesPorCi: Map<string, Registro>,
  relaciones: Record<TipoRelacion, Map<string, Registro>>
): Registro {
  const pendientes: { tipo: string; registro: Registro }[] = [
    { tipo, registro: original },
  ];
  const visitados = new Set<string>();

  let pacienteEncontrado: Registro | undefined;
  let nombreEncontrado = nombreGuardado(original);
  let referenciaEncontrada = "";

  while (pendientes.length > 0) {
    const actual = pendientes.shift()!;
    const clave = `${actual.tipo}:${actual.registro.id}`;

    if (visitados.has(clave)) continue;
    visitados.add(clave);

    // El nombre real que viene de pacientes tiene prioridad;
    // si no se puede leer esa colección, usar el nombre guardado.
    if (!nombreEncontrado) {
      nombreEncontrado = nombreGuardado(actual.registro);
    }

    const pacienteId = primerDato(actual.registro, CLAVES_PACIENTE);
    if (pacienteId) {
      referenciaEncontrada = pacienteId;
      pacienteEncontrado = pacientesPorId.get(pacienteId);
    }

    if (!pacienteEncontrado) {
      const ci = primerDato(actual.registro, CLAVES_CI);
      if (ci) {
        pacienteEncontrado = pacientesPorCi.get(ci);
        if (pacienteEncontrado) referenciaEncontrada = pacienteEncontrado.id;
      }
    }

    if (pacienteEncontrado) break;

    // Seguir únicamente relaciones explícitas entre documentos.
    for (const clase of ["ordenes", "solicitudes", "ventas", "resultados"] as const) {
      if (clase === actual.tipo) continue;
      const id = primerDato(actual.registro, ENLACES[clase]);
      if (!id) continue;

      const relacionado = relaciones[clase].get(id);
      if (relacionado) {
        pendientes.push({ tipo: clase, registro: relacionado });
      }
    }
  }

  const nombre = pacienteEncontrado
    ? nombreDesdePaciente(pacienteEncontrado) || nombreEncontrado
    : nombreEncontrado;

  return {
    ...original,
    pacienteId: pacienteEncontrado?.id || referenciaEncontrada ||
      primerDato(original, CLAVES_PACIENTE),
    pacienteNombre: nombre,
    // Solo para el listado visual; no se escribe en Firestore.
    _pacienteResuelto: Boolean(nombre),
  };
}

async function completarNombresPacientes(
  tipo: TipoReporte,
  registros: Registro[],
  laboratorioId: string
): Promise<Registro[]> {
  if (tipo === "pacientes" || tipo === "analisis" || registros.length === 0) {
    return registros;
  }

  // Todas las consultas se limitan al laboratorio del administrador.
  // Si alguna colección auxiliar tiene restricciones de lectura,
  // el reporte principal sigue funcionando.
  const colecciones = ["pacientes", "ordenes", "solicitudes", "ventas", "resultados"] as const;

  const respuestas = await Promise.all(
    colecciones.map(async (nombre) => {
      if (nombre === tipo) return registros;
      try {
        return await listar(nombre, laboratorioId);
      } catch (error) {
        console.warn(`No se pudo consultar ${nombre} para enlazar pacientes:`, error);
        return [] as Registro[];
      }
    })
  );

  const [pacientes, ordenes, solicitudes, ventas, resultados] = respuestas;
  const pacientesPorId = indexar(pacientes);
  const pacientesPorCi = new Map<string, Registro>();
  const ciAmbiguos = new Set<string>();

  pacientes.forEach((paciente) => {
    const ci = primerDato(paciente, ["ci", "carnetIdentidad", "documento", "numeroDocumento"]);
    if (!ci) return;
    if (pacientesPorCi.has(ci)) ciAmbiguos.add(ci);
    else pacientesPorCi.set(ci, paciente);
  });

  // Nunca enlazar automáticamente cuando dos pacientes comparten CI.
  ciAmbiguos.forEach((ci) => pacientesPorCi.delete(ci));

  const relaciones = {
    ventas: indexar(ventas),
    ordenes: indexar(ordenes),
    solicitudes: indexar(solicitudes),
    resultados: indexar(resultados),
  };

  return registros.map((registro) =>
    resolverPaciente(
      registro,
      tipo,
      pacientesPorId,
      pacientesPorCi,
      relaciones
    )
  );
}

// =====================================================
// DASHBOARD
// =====================================================

export async function cargarResumenLaboratorio():
  Promise<ResumenLaboratorio> {
  const { laboratorioId } = await contextoAdministrador();

  const [
    laboratorio,
    pacientes,
    analisis,
    ventas,
    ordenes,
    resultados,
    muestras,
  ] = await Promise.all([
    getDoc(doc(db, "laboratorios", laboratorioId)),
    listar("pacientes", laboratorioId),
    listar("analisis", laboratorioId),
    listar("ventas", laboratorioId),
    listar("ordenes", laboratorioId),
    listar("resultados", laboratorioId),
    listar("muestras", laboratorioId),
  ]);

  const finalizados = resultados.filter(
    (resultado) =>
      resultado.validado === true ||
      ["validado", "finalizado"].includes(
        texto(resultado.estado).toLowerCase()
      )
  ).length;

  const nombreLaboratorio = laboratorio.exists()
    ? texto(laboratorio.data().nombre) ||
      texto(laboratorio.data().nombreLaboratorio) ||
      "Laboratorio Clínico"
    : "Laboratorio Clínico";

  return {
    laboratorio: nombreLaboratorio,
    pacientes: pacientes.length,
    analisis: analisis.length,
    ventas: ventas.length,
    totalVendido: ventas.reduce(
      (total, venta) => total +
        (Number.isFinite(Number(venta.total))
          ? Number(venta.total)
          : 0),
      0
    ),
    ordenes: ordenes.length,
    resultadosFinalizados: finalizados,
    resultadosPendientes: resultados.length - finalizados,
    muestrasPendientes: muestras.filter(
      (muestra) =>
        ["tomada", "aceptada", "en_proceso"].includes(
          texto(muestra.estado).toLowerCase()
        )
    ).length,
  };
}

// =====================================================
// REPORTES
// =====================================================

export async function cargarReporte(tipo: TipoReporte): Promise<Registro[]> {
  const { laboratorioId } = await contextoAdministrador();
  const registros = await listar(tipo, laboratorioId);
  return completarNombresPacientes(tipo, registros, laboratorioId);
}

// =====================================================
// NOTIFICACIONES Y AUDITORÍA
// =====================================================

export async function cargarNotificaciones(): Promise<Registro[]> {
  const { laboratorioId } = await contextoAdministrador();
  const lista = await listar("notificaciones", laboratorioId);

  return lista.filter(
    (notificacion) =>
      !notificacion.rolDestino ||
      notificacion.rolDestino === "administrador"
  );
}

export async function cargarAuditoria(): Promise<Registro[]> {
  const { laboratorioId } = await contextoAdministrador();
  return listar("auditoria", laboratorioId);
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  const { laboratorioId } = await contextoAdministrador();

  const referencia = doc(db, "notificaciones", id);
  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error("La notificación no existe.");
  }

  if (texto(snapshot.data().laboratorioId) !== laboratorioId) {
    throw new Error(
      "No puedes modificar notificaciones de otro laboratorio."
    );
  }

  await updateDoc(referencia, {
    leida: true,
    fechaLectura: serverTimestamp(),
  });
}
