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
  auth,
  db,
} from "../firebase/firebase";

export type PacienteSistema = {
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
  fechaRegistro: unknown;
};

export type DatosPaciente = {
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
};

function limpiarTexto(
  valor: unknown
): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function convertirArray(
  valor: unknown
): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .filter(
      (
        item
      ): item is string =>
        typeof item === "string"
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(Boolean);
}

function fechaValida(
  fecha: string
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      fecha
    )
  ) {
    return false;
  }

  const fechaObjeto =
    new Date(
      `${fecha}T00:00:00`
    );

  if (
    Number.isNaN(
      fechaObjeto.getTime()
    )
  ) {
    return false;
  }

  const partes =
    fecha.split("-");

  const anio =
    Number(
      partes[0]
    );

  const mes =
    Number(
      partes[1]
    );

  const dia =
    Number(
      partes[2]
    );

  if (
    fechaObjeto.getFullYear() !==
      anio ||
    fechaObjeto.getMonth() + 1 !==
      mes ||
    fechaObjeto.getDate() !==
      dia
  ) {
    return false;
  }

  const hoy =
    new Date();

  hoy.setHours(
    0,
    0,
    0,
    0
  );

  return fechaObjeto <=
    hoy;
}

function correoValido(
  email: string
): boolean {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function telefonoValido(
  telefono: string
): boolean {
  if (!telefono) {
    return true;
  }

  return /^[0-9+\-\s()]{6,20}$/.test(
    telefono
  );
}

async function obtenerContextoUsuario() {
  const firebaseUser =
    auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "No existe una sesión autenticada."
    );
  }

  const usuarioSnap =
    await getDoc(
      doc(
        db,
        "usuarios",
        firebaseUser.uid
      )
    );

  if (
    !usuarioSnap.exists()
  ) {
    throw new Error(
      "La cuenta autenticada no existe en el sistema."
    );
  }

  const datos =
    usuarioSnap.data();

  if (
    datos.activo !==
    true
  ) {
    throw new Error(
      "Tu cuenta se encuentra inactiva."
    );
  }

  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );

  if (!laboratorioId) {
    throw new Error(
      "Tu cuenta no tiene un laboratorio asociado."
    );
  }

  const rol =
    limpiarTexto(
      datos.rol
    );

  if (!rol) {
    throw new Error(
      "Tu cuenta no tiene un rol asignado."
    );
  }

  const rolSnap =
    await getDoc(
      doc(
        db,
        "roles",
        rol
      )
    );

  const permisos =
    rolSnap.exists() &&
    rolSnap.data().activo ===
      true &&
    Array.isArray(
      rolSnap.data().permisos
    )
      ? rolSnap
          .data()
          .permisos.filter(
            (
              permiso: unknown
            ): permiso is string =>
              typeof permiso ===
              "string"
          )
      : [];

  return {
    uid:
      firebaseUser.uid,

    rol,
    laboratorioId,
    permisos,
  };
}

async function validarPermiso(
  permiso: string
) {
  const contexto =
    await obtenerContextoUsuario();

  if (
    !contexto.permisos.includes(
      permiso
    )
  ) {
    throw new Error(
      "No tienes permiso para realizar esta operación."
    );
  }

  return contexto;
}

function convertirPaciente(
  id: string,
  datos: Record<string, unknown>
): PacienteSistema {
  return {
    id,

    pacienteId:
      limpiarTexto(
        datos.pacienteId
      ) ||
      id,

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
      convertirArray(
        datos.alergias
      ),

    enfermedadesPrevias:
      convertirArray(
        datos.enfermedadesPrevias
      ),

    fechaRegistro:
      datos.fechaRegistro ||
      null,
  };
}

function validarDatos(
  datos: DatosPaciente
) {
  const nombres =
    limpiarTexto(
      datos.nombres
    );

  const apellidos =
    limpiarTexto(
      datos.apellidos
    );

  const ci =
    limpiarTexto(
      datos.ci
    );

  const fechaNacimiento =
    limpiarTexto(
      datos.fechaNacimiento
    );

  const sexo =
    limpiarTexto(
      datos.sexo
    );

  const telefono =
    limpiarTexto(
      datos.telefono
    );

  const email =
    limpiarTexto(
      datos.email
    ).toLowerCase();

  const direccion =
    limpiarTexto(
      datos.direccion
    );

  const ciudad =
    limpiarTexto(
      datos.ciudad
    );

  if (
    nombres.length < 2
  ) {
    throw new Error(
      "Ingresa los nombres del paciente."
    );
  }

  if (
    apellidos.length < 2
  ) {
    throw new Error(
      "Ingresa los apellidos del paciente."
    );
  }

  if (
    ci.length < 4
  ) {
    throw new Error(
      "Ingresa un CI o carnet válido."
    );
  }

  if (
    !fechaValida(
      fechaNacimiento
    )
  ) {
    throw new Error(
      "Ingresa una fecha de nacimiento válida en formato AAAA-MM-DD."
    );
  }

  if (
    ![
      "masculino",
      "femenino",
      "otro",
    ].includes(
      sexo.toLowerCase()
    )
  ) {
    throw new Error(
      "Selecciona el sexo del paciente."
    );
  }

  if (
    !telefonoValido(
      telefono
    )
  ) {
    throw new Error(
      "Ingresa un teléfono válido."
    );
  }

  if (
    !correoValido(
      email
    )
  ) {
    throw new Error(
      "Ingresa un correo electrónico válido."
    );
  }

  if (
    direccion.length < 3
  ) {
    throw new Error(
      "Ingresa la dirección del paciente."
    );
  }

  if (
    ciudad.length < 2
  ) {
    throw new Error(
      "Ingresa la ciudad del paciente."
    );
  }

  return {
    nombres,
    apellidos,
    ci,
    fechaNacimiento,
    sexo:
      sexo.toLowerCase(),

    telefono,
    email,
    direccion,
    ciudad,

    alergias:
      convertirArray(
        datos.alergias
      ),

    enfermedadesPrevias:
      convertirArray(
        datos.enfermedadesPrevias
      ),
  };
}

async function validarCiDuplicado(
  laboratorioId: string,
  ci: string,
  pacienteExcluir?: string
) {
  const consulta =
    query(
      collection(
        db,
        "pacientes"
      ),
      where(
        "laboratorioId",
        "==",
        laboratorioId
      )
    );

  const snapshot =
    await getDocs(
      consulta
    );

  const duplicado =
    snapshot.docs.some(
      (
        documento
      ) => {
        if (
          pacienteExcluir &&
          documento.id ===
            pacienteExcluir
        ) {
          return false;
        }

        return (
          limpiarTexto(
            documento
              .data()
              .ci
          ).toLowerCase() ===
          ci.toLowerCase()
        );
      }
    );

  if (
    duplicado
  ) {
    throw new Error(
      "Ya existe un paciente con ese CI o carnet dentro de tu laboratorio."
    );
  }
}

export async function obtenerPacientes(): Promise<
  PacienteSistema[]
> {
  const contexto =
    await validarPermiso(
      "pacientes.ver"
    );

  const consulta =
    query(
      collection(
        db,
        "pacientes"
      ),
      where(
        "laboratorioId",
        "==",
        contexto.laboratorioId
      )
    );

  const snapshot =
    await getDocs(
      consulta
    );

  return snapshot.docs
    .map(
      (
        documento
      ) =>
        convertirPaciente(
          documento.id,
          documento.data()
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        `${a.apellidos} ${a.nombres}`.localeCompare(
          `${b.apellidos} ${b.nombres}`,
          "es"
        )
    );
}

export async function crearPaciente(
  datos: DatosPaciente
): Promise<string> {
  const contexto =
    await validarPermiso(
      "pacientes.crear"
    );

  const datosValidados =
    validarDatos(
      datos
    );

  await validarCiDuplicado(
    contexto.laboratorioId,
    datosValidados.ci
  );

  const nuevaReferencia =
    doc(
      collection(
        db,
        "pacientes"
      )
    );

  await setDoc(
    nuevaReferencia,
    {
      pacienteId:
        nuevaReferencia.id,

      laboratorioId:
        contexto.laboratorioId,

      ...datosValidados,

      fechaRegistro:
        serverTimestamp(),
    }
  );

  return nuevaReferencia.id;
}

export async function actualizarPaciente(
  pacienteId: string,
  datos: DatosPaciente
): Promise<void> {
  const contexto =
    await validarPermiso(
      "pacientes.editar"
    );

  const id =
    limpiarTexto(
      pacienteId
    );

  if (!id) {
    throw new Error(
      "Paciente inválido."
    );
  }

  const referencia =
    doc(
      db,
      "pacientes",
      id
    );

  const snapshot =
    await getDoc(
      referencia
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "El paciente no existe."
    );
  }

  if (
    limpiarTexto(
      snapshot.data()
        .laboratorioId
    ) !==
    contexto.laboratorioId
  ) {
    throw new Error(
      "No puedes modificar pacientes de otro laboratorio."
    );
  }

  const datosValidados =
    validarDatos(
      datos
    );

  await validarCiDuplicado(
    contexto.laboratorioId,
    datosValidados.ci,
    id
  );

  await updateDoc(
    referencia,
    datosValidados
  );
}