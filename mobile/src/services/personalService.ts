import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
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
  type DocumentData,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";


const COLECCION_USUARIOS =
  "usuarios";

const COLECCION_LABORATORIOS =
  "laboratorios";

const COLECCION_ROLES =
  "roles";

const NOMBRE_APP_SECUNDARIA =
  "crear-personal-secundario";


// =====================================================
// TIPOS
// =====================================================

export type RolPersonal =
  | "recepcionista"
  | "bioquimico";


export type PersonalSistema = {
  id: string;

  uid: string;

  nombre: string;

  apellido: string;

  email: string;

  rol: RolPersonal;

  laboratorioId: string;

  activo: boolean;

  requiereVerificacionEmail: boolean;

  fechaRegistro?: unknown;

  color?: string;

  [key: string]: any;
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

  [key: string]: any;
};


export type CrearPersonalInput = {
  laboratorioId?: string;

  nombre: string;

  apellido: string;

  email: string;

  password: string;

  rol: RolPersonal;

  requiereVerificacionEmail?: boolean;
};


export type ActualizarPersonalInput = {
  nombre?: string;

  apellido?: string;

  rol?: RolPersonal;

  activo?: boolean;
};


// =====================================================
// UTILIDADES
// =====================================================

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


function normalizarEmail(
  valor: unknown
): string {
  return limpiarTexto(
    valor
  ).toLowerCase();
}


function rolValido(
  rol: unknown
): rol is RolPersonal {
  return (
    rol === "recepcionista" ||
    rol === "bioquimico"
  );
}


function colorValido(
  color: unknown
): boolean {
  return (
    typeof color === "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(
      color.trim()
    )
  );
}


// =====================================================
// CONVERTIR PERSONAL
// =====================================================

function convertirPersonal(
  id: string,
  datos: DocumentData
): PersonalSistema {
  const rol =
    limpiarTexto(
      datos.rol
    );


  return {
    id,

    uid:
      limpiarTexto(
        datos.uid
      ) || id,

    nombre:
      limpiarTexto(
        datos.nombre
      ),

    apellido:
      limpiarTexto(
        datos.apellido
      ),

    email:
      normalizarEmail(
        datos.email
      ),

    rol:
      rolValido(
        rol
      )
        ? rol
        : "recepcionista",

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ),

    activo:
      datos.activo === true,

    requiereVerificacionEmail:
      datos.requiereVerificacionEmail ===
      true,

    fechaRegistro:
      datos.fechaRegistro,

    color:
      limpiarTexto(
        datos.color
      ),
  };
}


// =====================================================
// CONVERTIR LABORATORIO
// =====================================================

function convertirLaboratorio(
  id: string,
  datos: DocumentData
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
      ) || id,

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
      colorValido(
        colorPrimario
      )
        ? colorPrimario.toUpperCase()
        : "#2563EB",

    colorSecundario:
      colorValido(
        colorSecundario
      )
        ? colorSecundario.toUpperCase()
        : "#14B8A6",

    activo:
      datos.activo === true,
  };
}


// =====================================================
// OBTENER ADMINISTRADOR ACTUAL
// =====================================================

async function obtenerAdministradorActual() {
  const firebaseUser =
    auth.currentUser;


  if (
    !firebaseUser
  ) {
    throw new Error(
      "No existe una sesión activa."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION_USUARIOS,
      firebaseUser.uid
    );


  const snapshot =
    await getDoc(
      referencia
    );


  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "No se encontró el usuario actual."
    );
  }


  const datos =
    snapshot.data();


  if (
    datos.activo !== true
  ) {
    throw new Error(
      "El usuario actual está inactivo."
    );
  }


  if (
    limpiarTexto(
      datos.rol
    ) !== "administrador"
  ) {
    throw new Error(
      "Solo el Administrador puede gestionar personal."
    );
  }


  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );


  if (
    !laboratorioId
  ) {
    throw new Error(
      "El Administrador no está asociado a un laboratorio."
    );
  }


  return {
    uid:
      firebaseUser.uid,

    laboratorioId,

    rol:
      "administrador",
  };
}


// =====================================================
// OBTENER LABORATORIO DEL ADMINISTRADOR
// =====================================================

export async function obtenerLaboratorioDelAdministrador():
  Promise<LaboratorioPersonal> {
  const administrador =
    await obtenerAdministradorActual();


  const referencia =
    doc(
      db,
      COLECCION_LABORATORIOS,
      administrador.laboratorioId
    );


  const snapshot =
    await getDoc(
      referencia
    );


  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "El laboratorio del Administrador no existe."
    );
  }


  return convertirLaboratorio(
    snapshot.id,
    snapshot.data()
  );
}


// =====================================================
// OBTENER PERMISOS
// =====================================================

export async function obtenerPermisosGestionPersonal():
  Promise<any> {
  const administrador =
    await obtenerAdministradorActual();


  const referencia =
    doc(
      db,
      COLECCION_ROLES,
      administrador.rol
    );


  const snapshot =
    await getDoc(
      referencia
    );


  const permisos:
    string[] =
    snapshot.exists() &&
    Array.isArray(
      snapshot.data().permisos
    )
      ? snapshot
          .data()
          .permisos
          .filter(
            (
              permiso: unknown
            ) =>
              typeof permiso ===
              "string"
          )
      : [];


  const resultado:
    any =
    [...permisos];


  resultado.permisos =
    permisos;


  resultado.puedeVer =
    permisos.includes(
      "empleados.ver"
    );


  resultado.puedeCrear =
    permisos.includes(
      "empleados.crear"
    );


  resultado.puedeEditar =
    permisos.includes(
      "empleados.editar"
    );


  resultado.puedeDesactivar =
    permisos.includes(
      "empleados.desactivar"
    );


  return resultado;
}


// =====================================================
// CONTRASEÑA SEGURA
// =====================================================

export function passwordSeguraPersonal(
  password?: string
): any {
  if (
    typeof password ===
    "string"
  ) {
    const valor =
      password.trim();


    return (
      valor.length >= 8 &&
      /[A-Z]/.test(
        valor
      ) &&
      /[a-z]/.test(
        valor
      ) &&
      /[0-9]/.test(
        valor
      )
    );
  }


  const mayusculas =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const minusculas =
    "abcdefghijkmnopqrstuvwxyz";

  const numeros =
    "23456789";

  const especiales =
    "!@#$%";


  const obtenerAleatorio =
    (
      caracteres: string
    ): string => {
      const indice =
        Math.floor(
          Math.random() *
          caracteres.length
        );

      return caracteres[
        indice
      ];
    };


  let resultado =
    obtenerAleatorio(
      mayusculas
    ) +
    obtenerAleatorio(
      minusculas
    ) +
    obtenerAleatorio(
      numeros
    ) +
    obtenerAleatorio(
      especiales
    );


  const todos =
    mayusculas +
    minusculas +
    numeros +
    especiales;


  while (
    resultado.length <
    10
  ) {
    resultado +=
      obtenerAleatorio(
        todos
      );
  }


  return resultado;
}


// =====================================================
// OBTENER PERSONAL
// =====================================================

export async function obtenerPersonal(
  laboratorioId?: string
): Promise<PersonalSistema[]> {
  let idLaboratorio =
    limpiarTexto(
      laboratorioId
    );


  if (
    !idLaboratorio
  ) {
    const administrador =
      await obtenerAdministradorActual();


    idLaboratorio =
      administrador.laboratorioId;
  }


  const consulta =
    query(
      collection(
        db,
        COLECCION_USUARIOS
      ),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );


  const snapshot =
    await getDocs(
      consulta
    );


  const resultado =
    snapshot.docs
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
          usuario.rol ===
            "recepcionista" ||
          usuario.rol ===
            "bioquimico"
      );


  resultado.sort(
    (
      a,
      b
    ) =>
      `${a.nombre} ${a.apellido}`
        .localeCompare(
          `${b.nombre} ${b.apellido}`,
          "es",
          {
            sensitivity:
              "base",
          }
        )
  );


  return resultado;
}


// =====================================================
// APP SECUNDARIA
// =====================================================

function obtenerAppSecundaria():
  FirebaseApp {
  const existente =
    getApps().find(
      (
        app
      ) =>
        app.name ===
        NOMBRE_APP_SECUNDARIA
    );


  if (
    existente
  ) {
    return existente;
  }


  const appPrincipal =
    getApp();


  return initializeApp(
    appPrincipal.options,
    NOMBRE_APP_SECUNDARIA
  );
}


// =====================================================
// CREAR PERSONAL
// =====================================================

export async function crearPersonal(
  datos: CrearPersonalInput
): Promise<string> {
  const administrador =
    await obtenerAdministradorActual();


  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    ) ||
    administrador.laboratorioId;


  const nombre =
    limpiarTexto(
      datos.nombre
    );


  const apellido =
    limpiarTexto(
      datos.apellido
    );


  const email =
    normalizarEmail(
      datos.email
    );


  const password =
    String(
      datos.password ||
      ""
    );


  const rol =
    limpiarTexto(
      datos.rol
    );


  const requiereVerificacionEmail =
    datos.requiereVerificacionEmail ===
    true;


  if (
    laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes registrar personal en otro laboratorio."
    );
  }


  if (
    !nombre
  ) {
    throw new Error(
      "El nombre es obligatorio."
    );
  }


  if (
    !apellido
  ) {
    throw new Error(
      "El apellido es obligatorio."
    );
  }


  if (
    !email
  ) {
    throw new Error(
      "El correo es obligatorio."
    );
  }


  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "El correo electrónico no es válido."
    );
  }


  if (
    password.length <
    6
  ) {
    throw new Error(
      "La contraseña debe tener al menos 6 caracteres."
    );
  }


  if (
    !rolValido(
      rol
    )
  ) {
    throw new Error(
      "Seleccione un rol válido."
    );
  }


  const appSecundaria =
    obtenerAppSecundaria();


  const authSecundario =
    getAuth(
      appSecundaria
    );


  let usuarioCreado:
    Awaited<
      ReturnType<
        typeof createUserWithEmailAndPassword
      >
    >["user"] |
    null =
    null;


  try {
    const credencial =
      await createUserWithEmailAndPassword(
        authSecundario,
        email,
        password
      );


    usuarioCreado =
      credencial.user;


    if (
      requiereVerificacionEmail
    ) {
      await sendEmailVerification(
        usuarioCreado
      );
    }


    const uid =
      usuarioCreado.uid;


    // La escritura se hace con db de la app principal.
    // La sesión principal continúa siendo Administrador.
    await setDoc(
      doc(
        db,
        COLECCION_USUARIOS,
        uid
      ),
      {
        uid,

        laboratorioId,

        nombre,

        apellido,

        email,

        rol,

        activo:
          true,

        requiereVerificacionEmail,

        fechaRegistro:
          serverTimestamp(),
      }
    );


    await signOut(
      authSecundario
    );


    return uid;

  } catch (
    error
  ) {
    if (
      usuarioCreado
    ) {
      try {
        await deleteUser(
          usuarioCreado
        );
      } catch (
        errorEliminar
      ) {
        console.error(
          "No se pudo revertir el usuario creado:",
          errorEliminar
        );
      }
    }


    try {
      await signOut(
        authSecundario
      );
    } catch {
      // Sin acción.
    }


    throw error;
  }
}


// =====================================================
// ACTUALIZAR PERSONAL
// =====================================================

export async function actualizarPersonal(
  usuarioId: string,
  datos: ActualizarPersonalInput
): Promise<void> {
  const administrador =
    await obtenerAdministradorActual();


  const id =
    limpiarTexto(
      usuarioId
    );


  if (
    !id
  ) {
    throw new Error(
      "No se pudo identificar al integrante."
    );
  }


  if (
    id ===
    administrador.uid
  ) {
    throw new Error(
      "No puedes modificar tu propia cuenta desde este módulo."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION_USUARIOS,
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
      "El integrante no existe."
    );
  }


  const actual =
    snapshot.data();


  if (
    limpiarTexto(
      actual.laboratorioId
    ) !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "El integrante pertenece a otro laboratorio."
    );
  }


  if (
    !rolValido(
      actual.rol
    )
  ) {
    throw new Error(
      "El usuario seleccionado no pertenece al personal administrable."
    );
  }


  const cambios: {
    nombre?: string;
    apellido?: string;
    rol?: RolPersonal;
  } = {};


  if (
    datos.nombre !==
    undefined
  ) {
    const nombre =
      limpiarTexto(
        datos.nombre
      );


    if (
      !nombre
    ) {
      throw new Error(
        "El nombre es obligatorio."
      );
    }


    cambios.nombre =
      nombre;
  }


  if (
    datos.apellido !==
    undefined
  ) {
    const apellido =
      limpiarTexto(
        datos.apellido
      );


    if (
      !apellido
    ) {
      throw new Error(
        "El apellido es obligatorio."
      );
    }


    cambios.apellido =
      apellido;
  }


  if (
    datos.rol !==
    undefined
  ) {
    if (
      !rolValido(
        datos.rol
      )
    ) {
      throw new Error(
        "Seleccione un rol válido."
      );
    }


    cambios.rol =
      datos.rol;
  }


  if (
    Object.keys(
      cambios
    ).length ===
    0
  ) {
    return;
  }


  await updateDoc(
    referencia,
    cambios
  );
}


// =====================================================
// CAMBIAR ESTADO
// =====================================================

export async function cambiarEstadoPersonal(
  usuarioId: string,
  activo: boolean
): Promise<void> {
  const administrador =
    await obtenerAdministradorActual();


  const id =
    limpiarTexto(
      usuarioId
    );


  if (
    !id
  ) {
    throw new Error(
      "No se pudo identificar al integrante."
    );
  }


  if (
    id ===
    administrador.uid
  ) {
    throw new Error(
      "No puedes cambiar el estado de tu propia cuenta."
    );
  }


  const referencia =
    doc(
      db,
      COLECCION_USUARIOS,
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
      "El integrante no existe."
    );
  }


  const datos =
    snapshot.data();


  if (
    limpiarTexto(
      datos.laboratorioId
    ) !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "El integrante pertenece a otro laboratorio."
    );
  }


  if (
    !rolValido(
      datos.rol
    )
  ) {
    throw new Error(
      "El usuario seleccionado no pertenece al personal administrable."
    );
  }


  await updateDoc(
    referencia,
    {
      activo:
        activo === true,
    }
  );
}