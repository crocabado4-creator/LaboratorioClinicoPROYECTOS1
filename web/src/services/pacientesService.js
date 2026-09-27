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

import { db } from "../firebase/firebase";


// =====================================================
// COLECCIÓN
// =====================================================

const COLECCION = "pacientes";


// =====================================================
// LIMPIAR TEXTO
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


// =====================================================
// LIMPIAR LISTA
// =====================================================

function limpiarLista(valor) {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map((item) =>
      limpiarTexto(item)
    )
    .filter(Boolean);
}


// =====================================================
// CONVERTIR DOCUMENTO
// =====================================================

function convertirPaciente(documento) {
  const datos =
    documento.data();

  return {
    id:
      documento.id,

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ) ||
      documento.id,

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
      Array.isArray(
        datos.alergias
      )
        ? datos.alergias
        : [],

    enfermedadesPrevias:
      Array.isArray(
        datos.enfermedadesPrevias
      )
        ? datos.enfermedadesPrevias
        : [],

    fechaRegistro:
      datos.fechaRegistro ||
      null,
  };
}


// =====================================================
// VALIDAR PACIENTE
// =====================================================

function validarPaciente(datos) {
  if (
    limpiarTexto(
      datos.nombres
    ) === ""
  ) {
    throw new Error(
      "Los nombres son obligatorios."
    );
  }

  if (
    limpiarTexto(
      datos.apellidos
    ) === ""
  ) {
    throw new Error(
      "Los apellidos son obligatorios."
    );
  }

  if (
    limpiarTexto(
      datos.ci
    ) === ""
  ) {
    throw new Error(
      "El CI es obligatorio."
    );
  }

  if (
    limpiarTexto(
      datos.fechaNacimiento
    ) === ""
  ) {
    throw new Error(
      "La fecha de nacimiento es obligatoria."
    );
  }

  if (
    limpiarTexto(
      datos.sexo
    ) === ""
  ) {
    throw new Error(
      "El sexo es obligatorio."
    );
  }
}


// =====================================================
// COMPROBAR CI DUPLICADO
// =====================================================

async function existeCi(
  laboratorioId,
  ci,
  ignorarPacienteId = ""
) {
  const consulta =
    query(
      collection(
        db,
        COLECCION
      ),

      where(
        "laboratorioId",
        "==",
        laboratorioId
      ),

      where(
        "ci",
        "==",
        ci
      )
    );


  const resultado =
    await getDocs(
      consulta
    );


  return resultado.docs.some(
    (documento) =>
      documento.id !==
      ignorarPacienteId
  );
}


// =====================================================
// LISTAR PACIENTES
// =====================================================

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


  return resultado.docs
    .map(
      convertirPaciente
    )
    .sort(
      (a, b) =>
        `${a.apellidos} ${a.nombres}`
          .localeCompare(
            `${b.apellidos} ${b.nombres}`,
            "es"
          )
    );
}


// =====================================================
// OBTENER PACIENTE
// =====================================================

export async function obtenerPaciente(
  pacienteId
) {
  const id =
    limpiarTexto(
      pacienteId
    );


  if (!id) {
    return null;
  }


  const referencia =
    doc(
      db,
      COLECCION,
      id
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (!resultado.exists()) {
    return null;
  }


  return convertirPaciente(
    resultado
  );
}


// =====================================================
// CREAR PACIENTE
//
// IMPORTANTE:
// Se genera primero el ID y después se guarda TODO
// en una sola escritura.
// =====================================================

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


  validarPaciente(
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


  if (duplicado) {
    throw new Error(
      "Ya existe un paciente con ese CI en este laboratorio."
    );
  }


  // Generamos un ID antes de guardar.
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
  };


  // UNA SOLA ESCRITURA
  await setDoc(
    referencia,
    nuevoPaciente
  );


  console.log(
    "Paciente registrado:",
    referencia.id
  );


  return referencia.id;
}


// =====================================================
// ACTUALIZAR PACIENTE
// =====================================================

export async function actualizarPaciente(
  pacienteId,
  laboratorioId,
  datos
) {
  const id =
    limpiarTexto(
      pacienteId
    );

  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (!id) {
    throw new Error(
      "Paciente inválido."
    );
  }


  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }


  validarPaciente(
    datos
  );


  const referencia =
    doc(
      db,
      COLECCION,
      id
    );


  const resultado =
    await getDoc(
      referencia
    );


  if (!resultado.exists()) {
    throw new Error(
      "El paciente no existe."
    );
  }


  const pacienteActual =
    resultado.data();


  if (
    pacienteActual.laboratorioId !==
    idLaboratorio
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
      id
    );


  if (duplicado) {
    throw new Error(
      "Ya existe otro paciente con ese CI."
    );
  }


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
    }
  );


  console.log(
    "Paciente actualizado:",
    id
  );
}