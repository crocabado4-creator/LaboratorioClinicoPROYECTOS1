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
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


const COLECCION = "pacientes";


function limpiarTexto(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(valor).trim();
}


function limpiarLista(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map((item) =>
        limpiarTexto(item)
      )
      .filter(Boolean);
  }

  if (typeof valor === "string") {
    return valor
      .split(",")
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  return [];
}


function validarDatosPaciente(datos) {
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


  if (!paciente.nombres) {
    throw new Error(
      "Los nombres son obligatorios."
    );
  }


  if (!paciente.apellidos) {
    throw new Error(
      "Los apellidos son obligatorios."
    );
  }


  if (!paciente.ci) {
    throw new Error(
      "El CI es obligatorio."
    );
  }


  if (!paciente.fechaNacimiento) {
    throw new Error(
      "La fecha de nacimiento es obligatoria."
    );
  }


  if (!paciente.sexo) {
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
  id,
  datos
) {
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
      datos?.fechaRegistro ||
      null,

    fechaActualizacion:
      datos?.fechaActualizacion ||
      null,
  };
}


export async function obtenerPacientes(
  laboratorioId
) {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  const referencia =
    collection(
      db,
      COLECCION
    );


  const consulta =
    query(
      referencia,
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
  laboratorioId,
  ci,
  ignorarPacienteId = ""
) {
  const pacientes =
    await obtenerPacientes(
      laboratorioId
    );


  const ciNormalizado =
    limpiarTexto(
      ci
    ).toLowerCase();


  const duplicado =
    pacientes.some(
      (paciente) =>
        paciente.id !==
          ignorarPacienteId &&
        limpiarTexto(
          paciente.ci
        ).toLowerCase() ===
          ciNormalizado
    );


  if (duplicado) {
    throw new Error(
      "Ya existe un paciente con ese CI en este laboratorio."
    );
  }
}


export async function crearPaciente(
  laboratorioId,
  datos
) {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idLaboratorio) {
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


  const nuevoPaciente = {
    pacienteId:
      referencia.id,

    laboratorioId:
      idLaboratorio,

    ...datosLimpios,

    fechaRegistro:
      serverTimestamp(),

    fechaActualizacion:
      serverTimestamp(),
  };


  await setDoc(
    referencia,
    nuevoPaciente
  );


  return referencia.id;
}


export async function actualizarPaciente(
  pacienteId,
  laboratorioId,
  datos
) {
  const idPaciente =
    limpiarTexto(
      pacienteId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idPaciente) {
    throw new Error(
      "No se pudo identificar el paciente."
    );
  }


  if (!idLaboratorio) {
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


  if (!snapshot.exists()) {
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


  // IMPORTANTE:
  // No enviamos laboratorioId ni pacienteId.
  // De esta manera nunca se cambia la
  // pertenencia del paciente ni su ID.
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
  pacienteId,
  laboratorioId
) {
  const idPaciente =
    limpiarTexto(
      pacienteId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!idPaciente) {
    throw new Error(
      "Paciente inválido."
    );
  }


  if (!idLaboratorio) {
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


  if (!snapshot.exists()) {
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