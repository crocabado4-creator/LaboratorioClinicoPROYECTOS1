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
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


const COLECCION =
  "pacientes";


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


export type PacienteInput = {
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


function validarDatos(
  datos: PacienteInput
): void {
  if (
    !limpiarTexto(
      datos.nombres
    )
  ) {
    throw new Error(
      "Los nombres son obligatorios."
    );
  }

  if (
    !limpiarTexto(
      datos.apellidos
    )
  ) {
    throw new Error(
      "Los apellidos son obligatorios."
    );
  }

  if (
    !limpiarTexto(
      datos.ci
    )
  ) {
    throw new Error(
      "El CI es obligatorio."
    );
  }

  if (
    !limpiarTexto(
      datos.fechaNacimiento
    )
  ) {
    throw new Error(
      "La fecha de nacimiento es obligatoria."
    );
  }

  if (
    !limpiarTexto(
      datos.sexo
    )
  ) {
    throw new Error(
      "El sexo es obligatorio."
    );
  }

  const email =
    limpiarTexto(
      datos.email
    );

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "El correo electrónico no es válido."
    );
  }
}


function convertirPaciente(
  id: string,
  datos: DocumentData
): Paciente {
  return {
    id,

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ) || id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    nombres:
      limpiarTexto(
        datos.nombres
      ),

    apellidos:
      limpiarTexto(
        datos.apellidos
      ),

    ci:
      limpiarTexto(
        datos.ci
      ),

    fechaNacimiento:
      limpiarTexto(
        datos.fechaNacimiento
      ),

    sexo:
      limpiarTexto(
        datos.sexo
      ),

    telefono:
      limpiarTexto(
        datos.telefono
      ),

    email:
      limpiarTexto(
        datos.email
      ),

    direccion:
      limpiarTexto(
        datos.direccion
      ),

    ciudad:
      limpiarTexto(
        datos.ciudad
      ),

    alergias:
      limpiarLista(
        datos.alergias
      ),

    enfermedadesPrevias:
      limpiarLista(
        datos.enfermedadesPrevias
      ),

    fechaRegistro:
      datos.fechaRegistro,

    fechaActualizacion:
      datos.fechaActualizacion,
  };
}


async function existeCi(
  laboratorioId: string,
  ci: string,
  ignorarPacienteId = ""
): Promise<boolean> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );

  const ciNormalizado =
    limpiarTexto(
      ci
    ).toLowerCase();


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


  return resultado.docs.some(
    (
      item:
        QueryDocumentSnapshot<DocumentData>
    ) => {
      const datos =
        item.data();

      return (
        item.id !==
          ignorarPacienteId &&
        limpiarTexto(
          datos.ci
        ).toLowerCase() ===
          ciNormalizado
      );
    }
  );
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


  const pacientes:
    Paciente[] =
    resultado.docs.map(
      (
        item:
          QueryDocumentSnapshot<DocumentData>
      ) =>
        convertirPaciente(
          item.id,
          item.data()
        )
    );


  pacientes.sort(
    (a, b) =>
      `${a.apellidos} ${a.nombres}`
        .localeCompare(
          `${b.apellidos} ${b.nombres}`,
          "es",
          {
            sensitivity:
              "base",
          }
        )
  );


  return pacientes;
}


export async function obtenerPaciente(
  pacienteId: string
): Promise<Paciente | null> {
  const idPaciente =
    limpiarTexto(
      pacienteId
    );


  if (
    !idPaciente
  ) {
    return null;
  }


  const referencia =
    doc(
      db,
      COLECCION,
      idPaciente
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


  return convertirPaciente(
    resultado.id,
    resultado.data()
  );
}


export async function crearPaciente(
  laboratorioId: string,
  datos: PacienteInput
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


  validarDatos(
    datos
  );


  const ci =
    limpiarTexto(
      datos.ci
    );


  const duplicado =
    await existeCi(
      idLaboratorio,
      ci
    );


  if (
    duplicado
  ) {
    throw new Error(
      "Ya existe un paciente con ese CI en este laboratorio."
    );
  }


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

      nombres:
        limpiarTexto(
          datos.nombres
        ),

      apellidos:
        limpiarTexto(
          datos.apellidos
        ),

      ci,

      fechaNacimiento:
        limpiarTexto(
          datos.fechaNacimiento
        ),

      sexo:
        limpiarTexto(
          datos.sexo
        ),

      telefono:
        limpiarTexto(
          datos.telefono
        ),

      email:
        limpiarTexto(
          datos.email
        ).toLowerCase(),

      direccion:
        limpiarTexto(
          datos.direccion
        ),

      ciudad:
        limpiarTexto(
          datos.ciudad
        ),

      alergias:
        limpiarLista(
          datos.alergias
        ),

      enfermedadesPrevias:
        limpiarLista(
          datos.enfermedadesPrevias
        ),

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
  datos: PacienteInput
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


  validarDatos(
    datos
  );


  const referencia =
    doc(
      db,
      COLECCION,
      idPaciente
    );


  const actual =
    await getDoc(
      referencia
    );


  if (
    !actual.exists()
  ) {
    throw new Error(
      "El paciente no existe."
    );
  }


  const actualDatos =
    actual.data();


  if (
    limpiarTexto(
      actualDatos.laboratorioId
    ) !== idLaboratorio
  ) {
    throw new Error(
      "No puedes modificar pacientes de otro laboratorio."
    );
  }


  const ci =
    limpiarTexto(
      datos.ci
    );


  const duplicado =
    await existeCi(
      idLaboratorio,
      ci,
      idPaciente
    );


  if (
    duplicado
  ) {
    throw new Error(
      "Ya existe otro paciente con ese CI en este laboratorio."
    );
  }


  // Solo modificamos los datos editables.
  // No cambiamos pacienteId ni laboratorioId.
  await updateDoc(
    referencia,
    {
      nombres:
        limpiarTexto(
          datos.nombres
        ),

      apellidos:
        limpiarTexto(
          datos.apellidos
        ),

      ci,

      fechaNacimiento:
        limpiarTexto(
          datos.fechaNacimiento
        ),

      sexo:
        limpiarTexto(
          datos.sexo
        ),

      telefono:
        limpiarTexto(
          datos.telefono
        ),

      email:
        limpiarTexto(
          datos.email
        ).toLowerCase(),

      direccion:
        limpiarTexto(
          datos.direccion
        ),

      ciudad:
        limpiarTexto(
          datos.ciudad
        ),

      alergias:
        limpiarLista(
          datos.alergias
        ),

      enfermedadesPrevias:
        limpiarLista(
          datos.enfermedadesPrevias
        ),

      fechaActualizacion:
        serverTimestamp(),
    }
  );
}