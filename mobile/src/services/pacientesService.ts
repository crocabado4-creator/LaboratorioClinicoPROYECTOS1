import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


const COLECCION = "pacientes";


export type Paciente = {
  id: string;
  pacienteId: string;
  laboratorioId: string;
  nombres: string;
  apellidos: string;
  ci: string;
  fechaNacimiento: string;
  sexo: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  alergias: string[];
  enfermedadesPrevias: string[];
  fechaRegistro?: unknown;
  fechaActualizacion?: unknown;
};


export type DatosPaciente = {
  nombres: string;
  apellidos: string;
  ci: string;
  fechaNacimiento: string;
  sexo: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  alergias?: string[];
  enfermedadesPrevias?: string[];
};


function limpiarTexto(
  valor: unknown
): string {
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


function limpiarLista(
  valor: unknown
): string[] {
  if (
    Array.isArray(
      valor
    )
  ) {
    return valor
      .map(
        (item) =>
          limpiarTexto(
            item
          )
      )
      .filter(Boolean);
  }

  if (
    typeof valor ===
    "string"
  ) {
    return valor
      .split(",")
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);
  }

  return [];
}


function validarDatosPaciente(
  datos: DatosPaciente
) {
  const paciente = {
    nombres:
      limpiarTexto(
        datos?.nombres
      ),

    apellidos:
      limpiarTexto(
        datos?.apellidos
      ),

    ci:
      limpiarTexto(
        datos?.ci
      ),

    fechaNacimiento:
      limpiarTexto(
        datos?.fechaNacimiento
      ),

    sexo:
      limpiarTexto(
        datos?.sexo
      ),

    telefono:
      limpiarTexto(
        datos?.telefono
      ),

    email:
      limpiarTexto(
        datos?.email
      ).toLowerCase(),

    direccion:
      limpiarTexto(
        datos?.direccion
      ),

    ciudad:
      limpiarTexto(
        datos?.ciudad
      ),

    alergias:
      limpiarLista(
        datos?.alergias
      ),

    enfermedadesPrevias:
      limpiarLista(
        datos?.enfermedadesPrevias
      ),
  };


  if (
    !paciente.nombres
  ) {
    throw new Error(
      "Los nombres son obligatorios."
    );
  }


  if (
    !paciente.apellidos
  ) {
    throw new Error(
      "Los apellidos son obligatorios."
    );
  }


  if (
    !paciente.ci
  ) {
    throw new Error(
      "El CI es obligatorio."
    );
  }


  if (
    !paciente.fechaNacimiento
  ) {
    throw new Error(
      "La fecha de nacimiento es obligatoria."
    );
  }


  if (
    !paciente.sexo
  ) {
    throw new Error(
      "Debe seleccionar el sexo."
    );
  }


  if (
    paciente.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      paciente.email
    )
  ) {
    throw new Error(
      "El correo electrónico no es válido."
    );
  }


  return paciente;
}


function convertirPaciente(
  id: string,
  datos: DocumentData
): Paciente {
  return {
    id,

    pacienteId:
      limpiarTexto(
        datos?.pacienteId
      ) || id,

    laboratorioId:
      limpiarTexto(
        datos?.laboratorioId
      ),

    nombres:
      limpiarTexto(
        datos?.nombres
      ),

    apellidos:
      limpiarTexto(
        datos?.apellidos
      ),

    ci:
      limpiarTexto(
        datos?.ci
      ),

    fechaNacimiento:
      limpiarTexto(
        datos?.fechaNacimiento
      ),

    sexo:
      limpiarTexto(
        datos?.sexo
      ),

    telefono:
      limpiarTexto(
        datos?.telefono
      ),

    email:
      limpiarTexto(
        datos?.email
      ),

    direccion:
      limpiarTexto(
        datos?.direccion
      ),

    ciudad:
      limpiarTexto(
        datos?.ciudad
      ),

    alergias:
      limpiarLista(
        datos?.alergias
      ),

    enfermedadesPrevias:
      limpiarLista(
        datos?.enfermedadesPrevias
      ),

    fechaRegistro:
      datos?.fechaRegistro,

    fechaActualizacion:
      datos?.fechaActualizacion,
  };
}


export async function obtenerPacientes(
  laboratorioId: string
): Promise<Paciente[]> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idLaboratorio
  ) {
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


  const pacientes =
    resultado.docs.map(
      (documento) =>
        convertirPaciente(
          documento.id,
          documento.data()
        )
    );


  pacientes.sort(
    (a, b) => {
      const nombreA =
        `${a.nombres} ${a.apellidos}`;

      const nombreB =
        `${b.nombres} ${b.apellidos}`;

      return nombreA.localeCompare(
        nombreB,
        "es",
        {
          sensitivity:
            "base",
        }
      );
    }
  );


  return pacientes;
}


async function validarCiDuplicado(
  laboratorioId: string,
  ci: string,
  ignorarPacienteId = ""
): Promise<void> {
  const pacientes =
    await obtenerPacientes(
      laboratorioId
    );


  const ciNormalizado =
    limpiarTexto(
      ci
    ).toLowerCase();


  const existe =
    pacientes.some(
      (paciente) =>
        paciente.id !==
          ignorarPacienteId &&
        limpiarTexto(
          paciente.ci
        ).toLowerCase() ===
          ciNormalizado
    );


  if (
    existe
  ) {
    throw new Error(
      "Ya existe un paciente con ese CI en este laboratorio."
    );
  }
}


export async function crearPaciente(
  laboratorioId: string,
  datos: DatosPaciente
): Promise<string> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idLaboratorio
  ) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  const datosLimpios =
    validarDatosPaciente(
      datos
    );


  await validarCiDuplicado(
    idLaboratorio,
    datosLimpios.ci
  );


  const referencia =
    doc(
      collection(
        db,
        COLECCION
      )
    );


  await setDoc(
    referencia,
    {
      pacienteId:
        referencia.id,

      laboratorioId:
        idLaboratorio,

      ...datosLimpios,

      fechaRegistro:
        serverTimestamp(),

      fechaActualizacion:
        serverTimestamp(),
    }
  );


  return referencia.id;
}


export async function actualizarPaciente(
  pacienteId: string,
  laboratorioId: string,
  datos: DatosPaciente
): Promise<void> {
  const idPaciente =
    limpiarTexto(
      pacienteId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idPaciente
  ) {
    throw new Error(
      "No se pudo identificar el paciente."
    );
  }


  if (
    !idLaboratorio
  ) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION,
      idPaciente
    );


  const snapshot =
    await getDoc(
      referencia
    );


  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "El paciente seleccionado no existe."
    );
  }


  const pacienteActual =
    snapshot.data();


  if (
    limpiarTexto(
      pacienteActual.laboratorioId
    ) !== idLaboratorio
  ) {
    throw new Error(
      "El paciente no pertenece a este laboratorio."
    );
  }


  const datosLimpios =
    validarDatosPaciente(
      datos
    );


  await validarCiDuplicado(
    idLaboratorio,
    datosLimpios.ci,
    idPaciente
  );


  await updateDoc(
    referencia,
    {
      nombres:
        datosLimpios.nombres,

      apellidos:
        datosLimpios.apellidos,

      ci:
        datosLimpios.ci,

      fechaNacimiento:
        datosLimpios.fechaNacimiento,

      sexo:
        datosLimpios.sexo,

      telefono:
        datosLimpios.telefono,

      email:
        datosLimpios.email,

      direccion:
        datosLimpios.direccion,

      ciudad:
        datosLimpios.ciudad,

      alergias:
        datosLimpios.alergias,

      enfermedadesPrevias:
        datosLimpios.enfermedadesPrevias,

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}


export async function obtenerPacientePorId(
  pacienteId: string,
  laboratorioId: string
): Promise<Paciente | null> {
  const idPaciente =
    limpiarTexto(
      pacienteId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idPaciente
  ) {
    throw new Error(
      "Paciente inválido."
    );
  }


  if (
    !idLaboratorio
  ) {
    throw new Error(
      "Laboratorio inválido."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION,
      idPaciente
    );


  const snapshot =
    await getDoc(
      referencia
    );


  if (
    !snapshot.exists()
  ) {
    return null;
  }


  const paciente =
    convertirPaciente(
      snapshot.id,
      snapshot.data()
    );


  if (
    paciente.laboratorioId !==
    idLaboratorio
  ) {
    throw new Error(
      "El paciente no pertenece a este laboratorio."
    );
  }


  return paciente;
}