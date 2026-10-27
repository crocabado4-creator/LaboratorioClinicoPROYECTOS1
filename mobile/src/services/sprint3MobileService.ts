
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

  const perfil = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  if (!perfil.exists()) {
    throw new Error("No existe el perfil del usuario.");
  }

  const datos = perfil.data();
  const rol = texto(datos.rol).toLowerCase();

  if (rol !== "administrador") {
    throw new Error(
      "Este módulo es exclusivo del Administrador."
    );
  }

  if (datos.activo === false) {
    throw new Error("La cuenta está desactivada.");
  }

  const laboratorioId = texto(datos.laboratorioId);

  if (!laboratorioId) {
    throw new Error(
      "Tu cuenta no tiene laboratorio asignado."
    );
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
    id: documento.id,
    ...documento.data(),
  }));
}

export async function cargarResumenLaboratorio():
  Promise<ResumenLaboratorio> {
  const { laboratorioId } =
    await contextoAdministrador();

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
    resultadosPendientes:
      resultados.length - finalizados,
    muestrasPendientes: muestras.filter(
      (muestra) =>
        ["tomada", "aceptada", "en_proceso"].includes(
          texto(muestra.estado).toLowerCase()
        )
    ).length,
  };
}


export async function cargarReporte(
  tipo: TipoReporte
): Promise<Registro[]> {
  const { laboratorioId } =
    await contextoAdministrador();

  const [registros, pacientes] = await Promise.all([
    listar(tipo, laboratorioId),
    listar("pacientes", laboratorioId),
  ]);

  const nombresPacientes = new Map<string, string>();

  for (const paciente of pacientes) {
    const nombreCompleto =
      texto(paciente.nombreCompleto) ||
      [
        texto(paciente.nombres || paciente.nombre),
        texto(paciente.apellidos || paciente.apellido),
      ]
        .filter(Boolean)
        .join(" ");

    nombresPacientes.set(
      paciente.id,
      nombreCompleto || "Paciente sin nombre"
    );
  }

  return registros.map((registro) => {
    if (tipo === "pacientes") {
      return {
        ...registro,
        nombreCompleto:
          nombresPacientes.get(registro.id) ||
          "Paciente sin nombre",
      };
    }

    const pacienteId = texto(registro.pacienteId);

    return {
      ...registro,
      pacienteNombre: pacienteId
        ? nombresPacientes.get(pacienteId) ||
          "Paciente no encontrado"
        : "",
    };
  });
}


export async function cargarNotificaciones():
  Promise<Registro[]> {
  const { laboratorioId } =
    await contextoAdministrador();

  const lista = await listar(
    "notificaciones",
    laboratorioId
  );

  return lista.filter(
    (notificacion) =>
      !notificacion.rolDestino ||
      notificacion.rolDestino === "administrador"
  );
}

export async function cargarAuditoria():
  Promise<Registro[]> {
  const { laboratorioId } =
    await contextoAdministrador();

  return listar("auditoria", laboratorioId);
}

export async function marcarNotificacionLeida(
  id: string
): Promise<void> {
  const { laboratorioId } =
    await contextoAdministrador();

  const referencia = doc(db, "notificaciones", id);
  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error("La notificación no existe.");
  }

  if (
    texto(snapshot.data().laboratorioId) !== laboratorioId
  ) {
    throw new Error(
      "No puedes modificar notificaciones de otro laboratorio."
    );
  }

  await updateDoc(referencia, {
    leida: true,
    fechaLectura: serverTimestamp(),
  });
}
