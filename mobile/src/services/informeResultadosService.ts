
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

export type ParametroInforme = {
  id: string;
  nombre: string;
  valor: string;
  unidad: string;
  referencia: string;
  observacion: string;
};

export type InformeClinico = {
  id: string;
  
  laboratorioId: string;
  laboratorioNombre: string;
  pacienteId: string;
  pacienteNombre: string;
  pacienteCI: string;
  analisisId: string;
  analisisNombre: string;
  ordenId: string;
  muestraId: string;
  valorResultado: string;
  unidad: string;
  observaciones: string;
  estado: string;
  fechaRegistro: string;
  fechaValidacion: string;
  validadoPorNombre: string;
  parametros: ParametroInforme[];
};

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function obtenerFecha(valor: any): string {
  if (!valor) {
    return "-";
  }

  let fecha: Date;

  if (typeof valor.toDate === "function") {
    fecha = valor.toDate();
  } else if (typeof valor.seconds === "number") {
    fecha = new Date(valor.seconds * 1000);
  } else {
    fecha = new Date(valor);
  }

  if (Number.isNaN(fecha.getTime())) {
    return "-";
  }

  return fecha.toLocaleString("es-BO");
}

function esResultadoFinalizado(datos: any): boolean {
  return (
    datos.validado === true ||
    datos.estado === "validado" ||
    datos.estado === "finalizado"
  );
}

async function obtenerLaboratorioId(): Promise<string> {
  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error("No hay una sesión activa.");
  }

  const perfil = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  if (!perfil.exists()) {
    throw new Error(
      "No se encontró el perfil del usuario."
    );
  }

  const datos = perfil.data();

  if (datos.activo === false) {
    throw new Error("El usuario está desactivado.");
  }

  const laboratorioId = texto(datos.laboratorioId);

  if (!laboratorioId) {
    throw new Error(
      "El usuario no tiene un laboratorio asignado."
    );
  }

  return laboratorioId;
}

async function obtenerNombreLaboratorio(
  laboratorioId: string
): Promise<string> {
  const snapshot = await getDoc(
    doc(db, "laboratorios", laboratorioId)
  );

  if (!snapshot.exists()) {
    return "Laboratorio Clínico";
  }

  const datos = snapshot.data();

  return (
    texto(datos.nombre) ||
    texto(datos.nombreLaboratorio) ||
    "Laboratorio Clínico"
  );
}

async function obtenerPaciente(
  pacienteId: string,
  laboratorioId: string
): Promise<{ nombre: string; ci: string }> {
  if (!pacienteId) {
    return {
      nombre: "Paciente no identificado",
      ci: "-",
    };
  }

  const snapshot = await getDoc(
    doc(db, "pacientes", pacienteId)
  );

  if (!snapshot.exists()) {
    return {
      nombre: "Paciente no encontrado",
      ci: "-",
    };
  }

  const datos = snapshot.data();

  if (
    texto(datos.laboratorioId) !== laboratorioId
  ) {
    throw new Error(
      "El paciente no pertenece al laboratorio."
    );
  }

  const nombreCompleto =
    texto(datos.nombreCompleto) ||
    [texto(datos.nombres), texto(datos.apellidos)]
      .filter(Boolean)
      .join(" ") ||
    [texto(datos.nombre), texto(datos.apellido)]
      .filter(Boolean)
      .join(" ");

  return {
    nombre: nombreCompleto || "Sin nombre",
    ci: texto(datos.ci) || "-",
  };
}

function crearInforme(
  id: string,
  datos: any,
  laboratorioNombre: string,
  paciente: { nombre: string; ci: string },
  parametros: ParametroInforme[] = []
): InformeClinico {
  return {
    id,
    laboratorioId: texto(datos.laboratorioId),
    laboratorioNombre,
    pacienteId: texto(datos.pacienteId),
    pacienteNombre: paciente.nombre,
    pacienteCI: paciente.ci,
    analisisId: texto(datos.analisisId),
    analisisNombre:
      texto(datos.analisisNombre) || "Análisis clínico",
    ordenId: texto(datos.ordenId),
    muestraId: texto(datos.muestraId),
    valorResultado: texto(datos.valorResultado),
    unidad: texto(datos.unidad),
    observaciones: texto(datos.observaciones),
    estado: texto(datos.estado),
    fechaRegistro: obtenerFecha(datos.fechaRegistro),
    fechaValidacion: obtenerFecha(datos.fechaValidacion),
    validadoPorNombre: texto(datos.validadoPorNombre),
    parametros,
  };
}

export async function listarInformesFinalizados():
  Promise<InformeClinico[]> {
  const laboratorioId = await obtenerLaboratorioId();

  const consulta = query(
    collection(db, "resultados"),
    where("laboratorioId", "==", laboratorioId)
  );

  const snapshot = await getDocs(consulta);

  const documentos = snapshot.docs
    .filter((resultado) =>
      esResultadoFinalizado(resultado.data())
    )
    .sort((a, b) => {
      const fechaA =
        a.data().fechaValidacion?.toMillis?.() ??
        a.data().fechaRegistro?.toMillis?.() ??
        0;

      const fechaB =
        b.data().fechaValidacion?.toMillis?.() ??
        b.data().fechaRegistro?.toMillis?.() ??
        0;

      return fechaB - fechaA;
    });

  const laboratorioNombre =
    await obtenerNombreLaboratorio(laboratorioId);

  const informes = await Promise.all(
    documentos.map(async (documento) => {
      const datos = documento.data();

      const paciente = await obtenerPaciente(
        texto(datos.pacienteId),
        laboratorioId
      );

      return crearInforme(
        documento.id,
        datos,
        laboratorioNombre,
        paciente
      );
    })
  );

  return informes;
}

export async function obtenerInformeFinalizado(
  resultadoId: string
): Promise<InformeClinico> {
  const laboratorioId = await obtenerLaboratorioId();

  const resultadoSnap = await getDoc(
    doc(db, "resultados", resultadoId)
  );

  if (!resultadoSnap.exists()) {
    throw new Error("El resultado no existe.");
  }

  const datos = resultadoSnap.data();

  if (texto(datos.laboratorioId) !== laboratorioId) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  if (!esResultadoFinalizado(datos)) {
    throw new Error(
      "Solo se pueden emitir informes de resultados validados."
    );
  }

  const [laboratorioNombre, paciente, valoresSnap] =
    await Promise.all([
      obtenerNombreLaboratorio(laboratorioId),
      obtenerPaciente(
        texto(datos.pacienteId),
        laboratorioId
      ),
      getDocs(
        collection(
          db,
          "resultados",
          resultadoId,
          "valores"
        )
      ),
    ]);

  const parametros: ParametroInforme[] =
    valoresSnap.docs.map((documento) => {
      const valor = documento.data();

      return {
        id: documento.id,
        nombre:
          texto(valor.nombre) || documento.id,
        valor: texto(valor.valor),
        unidad: texto(valor.unidad),
        referencia:
          texto(valor.referencia) ||
          texto(valor.rangoReferencia),
        observacion: texto(valor.observacion),
      };
    });

  return crearInforme(
    resultadoSnap.id,
    datos,
    laboratorioNombre,
    paciente,
    parametros
  );
}
