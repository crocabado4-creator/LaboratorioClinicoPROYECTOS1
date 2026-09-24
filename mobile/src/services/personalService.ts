import {
  deleteApp,
  getApp,
  initializeApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signOut,
} from "firebase/auth";

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

export type PersonalSistema = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  laboratorioId: string;
  activo: boolean;
  fechaRegistro: unknown;
  requiereVerificacionEmail: boolean;
};

export type LaboratorioPersonal = {
  id: string;
  laboratorioId: string;
  nombre: string;
  nombreVisible: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  activo: boolean;
};

export type DatosNuevoPersonal = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: "recepcionista" | "bioquimico";
  requiereVerificacionEmail: boolean;
};

export type DatosEditarPersonal = {
  nombre: string;
  apellido: string;
  rol: "recepcionista" | "bioquimico";
};

const ROLES_PERSONAL = [
  "recepcionista",
  "bioquimico",
];

function limpiarTexto(
  valor: unknown
): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function correoValido(
  correo: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    correo
  );
}

export function passwordSeguraPersonal(
  password: string
): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function rolValido(
  rol: string
): rol is "recepcionista" | "bioquimico" {
  return ROLES_PERSONAL.includes(
    rol
  );
}

function obtenerCodigoError(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      (
        error as {
          code?: string;
        }
      ).code || ""
    );
  }

  return "";
}

function convertirErrorFirebase(
  error: unknown
): Error {
  const codigo =
    obtenerCodigoError(
      error
    );

  if (
    codigo ===
    "auth/email-already-in-use"
  ) {
    return new Error(
      "Ya existe una cuenta registrada con ese correo electrónico."
    );
  }

  if (
    codigo ===
    "auth/invalid-email"
  ) {
    return new Error(
      "El correo electrónico no es válido."
    );
  }

  if (
    codigo ===
    "auth/weak-password"
  ) {
    return new Error(
      "La contraseña no cumple los requisitos de seguridad."
    );
  }

  if (
    codigo ===
    "auth/network-request-failed"
  ) {
    return new Error(
      "No se pudo conectar con Firebase. Revisa tu conexión a Internet."
    );
  }

  if (
    error instanceof Error
  ) {
    return error;
  }

  return new Error(
    "Ocurrió un error inesperado."
  );
}

async function validarAdministradorActual() {
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
    datos.activo !== true
  ) {
    throw new Error(
      "La cuenta se encuentra inactiva."
    );
  }

  if (
    datos.rol !==
    "administrador"
  ) {
    throw new Error(
      "Solo el Administrador del Laboratorio puede gestionar personal."
    );
  }

  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );

  if (!laboratorioId) {
    throw new Error(
      "El Administrador no tiene un laboratorio asociado."
    );
  }

  return {
    uid:
      firebaseUser.uid,

    laboratorioId,
  };
}

export async function obtenerPermisosGestionPersonal(): Promise<
  string[]
> {
  await validarAdministradorActual();

  const rolSnap =
    await getDoc(
      doc(
        db,
        "roles",
        "administrador"
      )
    );

  if (
    !rolSnap.exists()
  ) {
    return [];
  }

  const datos =
    rolSnap.data();

  if (
    datos.activo !== true
  ) {
    return [];
  }

  return Array.isArray(
    datos.permisos
  )
    ? datos.permisos.filter(
        (
          permiso
        ): permiso is string =>
          typeof permiso ===
          "string"
      )
    : [];
}

async function validarPermiso(
  permiso: string
) {
  const permisos =
    await obtenerPermisosGestionPersonal();

  if (
    !permisos.includes(
      permiso
    )
  ) {
    throw new Error(
      "No tienes permiso para realizar esta operación."
    );
  }
}

function convertirPersonal(
  id: string,
  datos: Record<string, unknown>
): PersonalSistema {
  return {
    id,

    nombre:
      limpiarTexto(
        datos.nombre
      ),

    apellido:
      limpiarTexto(
        datos.apellido
      ),

    email:
      limpiarTexto(
        datos.email
      ),

    rol:
      limpiarTexto(
        datos.rol
      ),

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    activo:
      datos.activo === true,

    fechaRegistro:
      datos.fechaRegistro ||
      null,

    requiereVerificacionEmail:
      datos.requiereVerificacionEmail ===
      true,
  };
}

function convertirLaboratorio(
  id: string,
  datos: Record<string, unknown>
): LaboratorioPersonal {
  const colorPrimario =
    limpiarTexto(
      datos.colorPrimario
    );

  const colorSecundario =
    limpiarTexto(
      datos.colorSecundario
    );

  return {
    id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ) ||
      id,

    nombre:
      limpiarTexto(
        datos.nombre
      ),

    nombreVisible:
      limpiarTexto(
        datos.nombreVisible
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

    colorPrimario:
      /^#[0-9A-Fa-f]{6}$/.test(
        colorPrimario
      )
        ? colorPrimario.toUpperCase()
        : "#2563EB",

    colorSecundario:
      /^#[0-9A-Fa-f]{6}$/.test(
        colorSecundario
      )
        ? colorSecundario.toUpperCase()
        : "#14B8A6",

    activo:
      datos.activo === true,
  };
}

export async function obtenerLaboratorioDelAdministrador(): Promise<
  LaboratorioPersonal
> {
  const administrador =
    await validarAdministradorActual();

  const snapshot =
    await getDoc(
      doc(
        db,
        "laboratorios",
        administrador.laboratorioId
      )
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "No se encontró el laboratorio asociado al Administrador."
    );
  }

  return convertirLaboratorio(
    snapshot.id,
    snapshot.data()
  );
}

export async function obtenerPersonal(): Promise<
  PersonalSistema[]
> {
  const administrador =
    await validarAdministradorActual();

  await validarPermiso(
    "empleados.ver"
  );

  const consulta =
    query(
      collection(
        db,
        "usuarios"
      ),
      where(
        "laboratorioId",
        "==",
        administrador.laboratorioId
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
        convertirPersonal(
          documento.id,
          documento.data()
        )
    )
    .filter(
      (
        usuario
      ) =>
        rolValido(
          usuario.rol
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        `${a.nombre} ${a.apellido}`.localeCompare(
          `${b.nombre} ${b.apellido}`,
          "es"
        )
    );
}

async function validarRolDisponible(
  rol: string
) {
  if (
    !rolValido(
      rol
    )
  ) {
    throw new Error(
      "Debes seleccionar un rol válido."
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

  if (
    !rolSnap.exists() ||
    rolSnap.data().activo !==
      true
  ) {
    throw new Error(
      "El rol seleccionado no se encuentra disponible."
    );
  }
}

async function validarCorreoNoRegistrado(
  email: string
) {
  const consulta =
    query(
      collection(
        db,
        "usuarios"
      ),
      where(
        "email",
        "==",
        email
      )
    );

  const snapshot =
    await getDocs(
      consulta
    );

  if (
    !snapshot.empty
  ) {
    throw new Error(
      "Ya existe un usuario registrado con ese correo electrónico."
    );
  }
}

export async function crearPersonal(
  datos: DatosNuevoPersonal
): Promise<string> {
  const administrador =
    await validarAdministradorActual();

  await validarPermiso(
    "empleados.crear"
  );

  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const apellido =
    limpiarTexto(
      datos.apellido
    );

  const email =
    limpiarTexto(
      datos.email
    ).toLowerCase();

  const password =
    datos.password;

  const rol =
    limpiarTexto(
      datos.rol
    );

  if (
    nombre.length < 2
  ) {
    throw new Error(
      "Ingresa un nombre válido."
    );
  }

  if (
    apellido.length < 2
  ) {
    throw new Error(
      "Ingresa un apellido válido."
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
    !passwordSeguraPersonal(
      password
    )
  ) {
    throw new Error(
      "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
    );
  }

  if (
    !rolValido(
      rol
    )
  ) {
    throw new Error(
      "Selecciona Recepcionista o Bioquímico."
    );
  }

  await validarRolDisponible(
    rol
  );

  const laboratorioSnap =
    await getDoc(
      doc(
        db,
        "laboratorios",
        administrador.laboratorioId
      )
    );

  if (
    !laboratorioSnap.exists()
  ) {
    throw new Error(
      "El laboratorio asociado no existe."
    );
  }

  if (
    laboratorioSnap.data().activo !==
    true
  ) {
    throw new Error(
      "No se puede registrar personal porque el laboratorio se encuentra inactivo."
    );
  }

  await validarCorreoNoRegistrado(
    email
  );

  const nombreApp =
    `personal-secundario-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const appSecundaria =
    initializeApp(
      getApp().options,
      nombreApp
    );

  const authSecundaria =
    getAuth(
      appSecundaria
    );

  let usuarioCreado:
    Awaited<
      ReturnType<
        typeof createUserWithEmailAndPassword
      >
    > | null = null;

  try {
    usuarioCreado =
      await createUserWithEmailAndPassword(
        authSecundaria,
        email,
        password
      );

    if (
      datos.requiereVerificacionEmail
    ) {
      await sendEmailVerification(
        usuarioCreado.user
      );
    }

    await setDoc(
      doc(
        db,
        "usuarios",
        usuarioCreado.user.uid
      ),
      {
        nombre,
        apellido,
        email,
        rol,

        laboratorioId:
          administrador.laboratorioId,

        activo:
          true,

        fechaRegistro:
          serverTimestamp(),

        requiereVerificacionEmail:
          datos.requiereVerificacionEmail ===
          true,
      }
    );

    return usuarioCreado.user.uid;

  } catch (error) {
    if (
      usuarioCreado?.user
    ) {
      try {
        await deleteUser(
          usuarioCreado.user
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "No se pudo revertir el usuario de Authentication:",
          rollbackError
        );
      }
    }

    throw convertirErrorFirebase(
      error
    );

  } finally {
    try {
      await signOut(
        authSecundaria
      );
    } catch {
    }

    try {
      await deleteApp(
        appSecundaria
      );
    } catch {
    }
  }
}

export async function actualizarPersonal(
  usuarioId: string,
  datos: DatosEditarPersonal
): Promise<void> {
  const administrador =
    await validarAdministradorActual();

  await validarPermiso(
    "empleados.editar"
  );

  const id =
    limpiarTexto(
      usuarioId
    );

  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const apellido =
    limpiarTexto(
      datos.apellido
    );

  const rol =
    limpiarTexto(
      datos.rol
    );

  if (!id) {
    throw new Error(
      "El integrante seleccionado no es válido."
    );
  }

  if (
    nombre.length < 2
  ) {
    throw new Error(
      "Ingresa un nombre válido."
    );
  }

  if (
    apellido.length < 2
  ) {
    throw new Error(
      "Ingresa un apellido válido."
    );
  }

  if (
    !rolValido(
      rol
    )
  ) {
    throw new Error(
      "Selecciona un rol válido."
    );
  }

  await validarRolDisponible(
    rol
  );

  const referencia =
    doc(
      db,
      "usuarios",
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
      "El integrante seleccionado no existe."
    );
  }

  const actual =
    snapshot.data();

  if (
    actual.laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes modificar personal de otro laboratorio."
    );
  }

  if (
    !rolValido(
      limpiarTexto(
        actual.rol
      )
    )
  ) {
    throw new Error(
      "No puedes modificar esta cuenta desde Gestión de Personal."
    );
  }

  await updateDoc(
    referencia,
    {
      nombre,
      apellido,
      rol,
    }
  );
}

export async function cambiarEstadoPersonal(
  usuarioId: string,
  nuevoEstado: boolean
): Promise<void> {
  const administrador =
    await validarAdministradorActual();

  await validarPermiso(
    "empleados.desactivar"
  );

  const id =
    limpiarTexto(
      usuarioId
    );

  if (!id) {
    throw new Error(
      "El integrante seleccionado no es válido."
    );
  }

  const referencia =
    doc(
      db,
      "usuarios",
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
      "El integrante seleccionado no existe."
    );
  }

  const datos =
    snapshot.data();

  if (
    datos.laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes modificar personal de otro laboratorio."
    );
  }

  if (
    !rolValido(
      limpiarTexto(
        datos.rol
      )
    )
  ) {
    throw new Error(
      "La cuenta seleccionada no corresponde al personal administrable."
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