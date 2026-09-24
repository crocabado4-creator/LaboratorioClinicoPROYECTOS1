import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

export type Laboratorio = {
  id: string;
  laboratorioId: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
  nombreVisible: string;
  colorPrimario: string;
  colorSecundario: string;
  activo: boolean;
  fechaRegistro: unknown;
};

export type DatosLaboratorio = {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
};

function limpiarTexto(
  valor: unknown
): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function validarCorreo(
  correo: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    correo
  );
}

function validarTelefono(
  telefono: string
): boolean {
  return /^[0-9+\-\s()]{6,20}$/.test(
    telefono
  );
}

async function validarSuperAdmin() {
  const firebaseUser =
    auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "No existe una sesión autenticada."
    );
  }

  const usuarioRef = doc(
    db,
    "usuarios",
    firebaseUser.uid
  );

  const usuarioSnap =
    await getDoc(
      usuarioRef
    );

  if (!usuarioSnap.exists()) {
    throw new Error(
      "La cuenta autenticada no existe en el sistema."
    );
  }

  const datos =
    usuarioSnap.data();

  if (
    datos.activo !== true
  ) {
    throw new Error(
      "La cuenta se encuentra inactiva."
    );
  }

  if (
    datos.rol !==
    "super_admin"
  ) {
    throw new Error(
      "Solo el Super Administrador puede gestionar laboratorios."
    );
  }

  return {
    uid:
      firebaseUser.uid,
  };
}

function convertirLaboratorio(
  id: string,
  datos: Record<string, unknown>
): Laboratorio {
  return {
    id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ) || id,

    nombre:
      limpiarTexto(
        datos.nombre
      ),

    direccion:
      limpiarTexto(
        datos.direccion
      ),

    telefono:
      limpiarTexto(
        datos.telefono
      ),

    email:
      limpiarTexto(
        datos.email
      ),

    logoUrl:
      limpiarTexto(
        datos.logoUrl
      ),

    nombreVisible:
      limpiarTexto(
        datos.nombreVisible
      ),

    colorPrimario:
      limpiarTexto(
        datos.colorPrimario
      ) ||
      "#2563EB",

    colorSecundario:
      limpiarTexto(
        datos.colorSecundario
      ) ||
      "#14B8A6",

    activo:
      datos.activo === true,

    fechaRegistro:
      datos.fechaRegistro ||
      null,
  };
}

export async function obtenerLaboratorios(): Promise<
  Laboratorio[]
> {
  await validarSuperAdmin();

  const snapshot =
    await getDocs(
      collection(
        db,
        "laboratorios"
      )
    );

  const resultado =
    snapshot.docs.map(
      (documento) =>
        convertirLaboratorio(
          documento.id,
          documento.data()
        )
    );

  return resultado.sort(
    (a, b) =>
      a.nombre.localeCompare(
        b.nombre,
        "es"
      )
  );
}

export async function obtenerLaboratorioPorId(
  laboratorioId: string
): Promise<Laboratorio> {
  await validarSuperAdmin();

  const id =
    limpiarTexto(
      laboratorioId
    );

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot =
    await getDoc(
      referencia
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  return convertirLaboratorio(
    snapshot.id,
    snapshot.data()
  );
}

export async function crearLaboratorio(
  datos: DatosLaboratorio
): Promise<string> {
  await validarSuperAdmin();

  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const direccion =
    limpiarTexto(
      datos.direccion
    );

  const telefono =
    limpiarTexto(
      datos.telefono
    );

  const email =
    limpiarTexto(
      datos.email
    ).toLowerCase();

  if (
    nombre.length < 2
  ) {
    throw new Error(
      "Ingresa un nombre válido."
    );
  }

  if (
    direccion.length < 4
  ) {
    throw new Error(
      "Ingresa una dirección válida."
    );
  }

  if (
    !validarTelefono(
      telefono
    )
  ) {
    throw new Error(
      "Ingresa un teléfono válido."
    );
  }

  if (
    !validarCorreo(
      email
    )
  ) {
    throw new Error(
      "Ingresa un correo electrónico válido."
    );
  }

  const nuevoRef = doc(
    collection(
      db,
      "laboratorios"
    )
  );

  await setDoc(
    nuevoRef,
    {
      laboratorioId:
        nuevoRef.id,

      nombre,
      direccion,
      telefono,
      email,

      logoUrl:
        "",

      activo:
        true,

      fechaRegistro:
        serverTimestamp(),
    }
  );

  return nuevoRef.id;
}

export async function actualizarLaboratorio(
  laboratorioId: string,
  datos: DatosLaboratorio
): Promise<void> {
  await validarSuperAdmin();

  const id =
    limpiarTexto(
      laboratorioId
    );

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const direccion =
    limpiarTexto(
      datos.direccion
    );

  const telefono =
    limpiarTexto(
      datos.telefono
    );

  const email =
    limpiarTexto(
      datos.email
    ).toLowerCase();

  if (
    nombre.length < 2
  ) {
    throw new Error(
      "Ingresa un nombre válido."
    );
  }

  if (
    direccion.length < 4
  ) {
    throw new Error(
      "Ingresa una dirección válida."
    );
  }

  if (
    !validarTelefono(
      telefono
    )
  ) {
    throw new Error(
      "Ingresa un teléfono válido."
    );
  }

  if (
    !validarCorreo(
      email
    )
  ) {
    throw new Error(
      "Ingresa un correo electrónico válido."
    );
  }

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot =
    await getDoc(
      referencia
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  await updateDoc(
    referencia,
    {
      nombre,
      direccion,
      telefono,
      email,
    }
  );
}

export async function cambiarEstadoLaboratorio(
  laboratorioId: string,
  nuevoEstado: boolean
): Promise<void> {
  await validarSuperAdmin();

  const id =
    limpiarTexto(
      laboratorioId
    );

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  if (
    typeof nuevoEstado !==
    "boolean"
  ) {
    throw new Error(
      "Estado inválido."
    );
  }

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot =
    await getDoc(
      referencia
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  await updateDoc(
    referencia,
    {
      activo:
        nuevoEstado,
    }
  );
}