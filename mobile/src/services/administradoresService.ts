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

export type AdministradorSistema = {
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

export type LaboratorioAdministrador = {
  id: string;
  laboratorioId: string;
  nombre: string;
  nombreVisible: string;
  email: string;
  direccion: string;
  telefono: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  activo: boolean;
};

export type DatosNuevoAdministrador = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  laboratorioId: string;
  requiereVerificacionEmail: boolean;
};

export type DatosEditarAdministrador = {
  nombre: string;
  apellido: string;
  laboratorioId: string;
};

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

export function passwordSegura(
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

async function validarSuperAdmin() {
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
    "super_admin"
  ) {
    throw new Error(
      "Solo el Super Administrador puede gestionar administradores."
    );
  }

  return {
    uid:
      firebaseUser.uid,
  };
}

export async function obtenerPermisosGestionAdministradores(): Promise<
  string[]
> {
  await validarSuperAdmin();

  const rolSnap =
    await getDoc(
      doc(
        db,
        "roles",
        "super_admin"
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
    await obtenerPermisosGestionAdministradores();

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

function convertirAdministrador(
  id: string,
  datos: Record<string, unknown>
): AdministradorSistema {
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
): LaboratorioAdministrador {
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

    email:
      limpiarTexto(
        datos.email
      ),

    direccion:
      limpiarTexto(
        datos.direccion
      ),

    telefono:
      limpiarTexto(
        datos.telefono
      ),

    logoUrl:
      limpiarTexto(
        datos.logoUrl
      ),

    colorPrimario:
      /^#[0-9A-Fa-f]{6}$/.test(
        limpiarTexto(
          datos.colorPrimario
        )
      )
        ? limpiarTexto(
            datos.colorPrimario
          ).toUpperCase()
        : "#2563EB",

    colorSecundario:
      /^#[0-9A-Fa-f]{6}$/.test(
        limpiarTexto(
          datos.colorSecundario
        )
      )
        ? limpiarTexto(
            datos.colorSecundario
          ).toUpperCase()
        : "#14B8A6",

    activo:
      datos.activo === true,
  };
}

export async function obtenerAdministradores(): Promise<
  AdministradorSistema[]
> {
  await validarSuperAdmin();

  const consulta =
    query(
      collection(
        db,
        "usuarios"
      ),
      where(
        "rol",
        "==",
        "administrador"
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
        convertirAdministrador(
          documento.id,
          documento.data()
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

export async function obtenerLaboratoriosAdministradores(): Promise<
  LaboratorioAdministrador[]
> {
  await validarSuperAdmin();

  const snapshot =
    await getDocs(
      collection(
        db,
        "laboratorios"
      )
    );

  return snapshot.docs
    .map(
      (
        documento
      ) =>
        convertirLaboratorio(
          documento.id,
          documento.data()
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        a.nombre.localeCompare(
          b.nombre,
          "es"
        )
    );
}

async function validarLaboratorio(
  laboratorioId: string
): Promise<LaboratorioAdministrador> {
  const id =
    limpiarTexto(
      laboratorioId
    );

  if (!id) {
    throw new Error(
      "Debes seleccionar un laboratorio."
    );
  }

  const laboratorioSnap =
    await getDoc(
      doc(
        db,
        "laboratorios",
        id
      )
    );

  if (
    !laboratorioSnap.exists()
  ) {
    throw new Error(
      "El laboratorio seleccionado no existe."
    );
  }

  const laboratorio =
    convertirLaboratorio(
      laboratorioSnap.id,
      laboratorioSnap.data()
    );

  if (
    laboratorio.activo !==
    true
  ) {
    throw new Error(
      "No puedes asignar un administrador a un laboratorio inactivo."
    );
  }

  return laboratorio;
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

export async function crearAdministrador(
  datos: DatosNuevoAdministrador
): Promise<string> {
  await validarSuperAdmin();

  await validarPermiso(
    "administradores.crear"
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

  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
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
    !passwordSegura(
      password
    )
  ) {
    throw new Error(
      "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
    );
  }

  await validarLaboratorio(
    laboratorioId
  );

  await validarCorreoNoRegistrado(
    email
  );

  const nombreApp =
    `admin-secundario-${Date.now()}-${Math.random()
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
        rol:
          "administrador",

        laboratorioId,

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

export async function actualizarAdministrador(
  administradorId: string,
  datos: DatosEditarAdministrador
): Promise<void> {
  await validarSuperAdmin();

  await validarPermiso(
    "administradores.editar"
  );

  const id =
    limpiarTexto(
      administradorId
    );

  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const apellido =
    limpiarTexto(
      datos.apellido
    );

  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );

  if (!id) {
    throw new Error(
      "Administrador inválido."
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

  await validarLaboratorio(
    laboratorioId
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
      "El administrador no existe."
    );
  }

  if (
    snapshot.data().rol !==
    "administrador"
  ) {
    throw new Error(
      "La cuenta seleccionada no corresponde a un Administrador."
    );
  }

  await updateDoc(
    referencia,
    {
      nombre,
      apellido,
      laboratorioId,
    }
  );
}

export async function cambiarEstadoAdministrador(
  administradorId: string,
  nuevoEstado: boolean
): Promise<void> {
  await validarSuperAdmin();

  await validarPermiso(
    "administradores.desactivar"
  );

  const id =
    limpiarTexto(
      administradorId
    );

  if (!id) {
    throw new Error(
      "Administrador inválido."
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
      "El administrador no existe."
    );
  }

  if (
    snapshot.data().rol !==
    "administrador"
  ) {
    throw new Error(
      "La cuenta seleccionada no corresponde a un Administrador."
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