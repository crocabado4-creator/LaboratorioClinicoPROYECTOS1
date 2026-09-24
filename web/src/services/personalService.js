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


const ROLES_PERSONAL = [
  "recepcionista",
  "bioquimico",
];


function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


function esRolPersonal(rol) {
  return ROLES_PERSONAL.includes(
    rol
  );
}


export function passwordSeguro(
  password
) {
  if (
    typeof password !==
    "string"
  ) {
    return false;
  }

  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(
      password
    )
  );
}


async function obtenerAdministradorActual() {
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
      "El usuario autenticado no existe en el sistema."
    );
  }


  const datos =
    usuarioSnap.data();


  if (
    datos.activo !== true
  ) {
    throw new Error(
      "La cuenta del Administrador se encuentra inactiva."
    );
  }


  if (
    datos.rol !==
    "administrador"
  ) {
    throw new Error(
      "Solo el Administrador del Laboratorio puede gestionar al personal."
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


  return {
    uid:
      usuarioSnap.id,

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

    laboratorioId,
  };
}


async function validarLaboratorio(
  laboratorioId
) {
  const laboratorioRef = doc(
    db,
    "laboratorios",
    laboratorioId
  );


  const laboratorioSnap =
    await getDoc(
      laboratorioRef
    );


  if (
    !laboratorioSnap.exists()
  ) {
    throw new Error(
      "El laboratorio asociado no existe."
    );
  }


  const datos =
    laboratorioSnap.data();


  if (
    datos.activo !== true
  ) {
    throw new Error(
      "El laboratorio se encuentra inactivo."
    );
  }


  return {
    id:
      laboratorioSnap.id,

    nombre:
      limpiarTexto(
        datos.nombre
      ),

    nombreVisible:
      limpiarTexto(
        datos.nombreVisible
      ),

    logoUrl:
      limpiarTexto(
        datos.logoUrl
      ),

    colorPrimario:
      limpiarTexto(
        datos.colorPrimario
      ),

    colorSecundario:
      limpiarTexto(
        datos.colorSecundario
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

    activo:
      datos.activo === true,
  };
}


export async function obtenerLaboratorioPersonal() {
  const administrador =
    await obtenerAdministradorActual();


  return validarLaboratorio(
    administrador.laboratorioId
  );
}


export async function obtenerPersonal(
  laboratorioIdSolicitado = ""
) {
  const administrador =
    await obtenerAdministradorActual();


  const laboratorioId =
    administrador.laboratorioId;


  if (
    laboratorioIdSolicitado &&
    laboratorioIdSolicitado !==
      laboratorioId
  ) {
    throw new Error(
      "No puedes consultar personal de otro laboratorio."
    );
  }


  const consulta = query(
    collection(
      db,
      "usuarios"
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


  const personal =
    snapshot.docs
      .map(
        (documento) => {
          const datos =
            documento.data();

          return {
            id:
              documento.id,

            uid:
              documento.id,

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
              datos.activo ===
              true,

            fechaRegistro:
              datos.fechaRegistro ||
              null,

            requiereVerificacionEmail:
              datos.requiereVerificacionEmail ===
              true,
          };
        }
      )
      .filter(
        (item) =>
          esRolPersonal(
            item.rol
          )
      );


  return personal.sort(
    (a, b) => {
      const nombreA =
        `${a.nombre} ${a.apellido}`.trim();

      const nombreB =
        `${b.nombre} ${b.apellido}`.trim();

      return nombreA.localeCompare(
        nombreB,
        "es"
      );
    }
  );
}


export async function crearPersonal(
  datos
) {
  const administrador =
    await obtenerAdministradorActual();


  const laboratorioId =
    administrador.laboratorioId;


  await validarLaboratorio(
    laboratorioId
  );


  const nombre =
    limpiarTexto(
      datos?.nombre
    );

  const apellido =
    limpiarTexto(
      datos?.apellido
    );

  const email =
    limpiarTexto(
      datos?.email
    ).toLowerCase();

  const rol =
    limpiarTexto(
      datos?.rol
    );

  const password =
    typeof datos?.password ===
    "string"
      ? datos.password
      : "";

  const requiereVerificacionEmail =
    datos?.requiereVerificacionEmail !==
    false;


  if (!nombre) {
    throw new Error(
      "Ingresa el nombre."
    );
  }


  if (!apellido) {
    throw new Error(
      "Ingresa el apellido."
    );
  }


  if (!email) {
    throw new Error(
      "Ingresa el correo electrónico."
    );
  }


  const correoValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  if (
    !correoValido.test(
      email
    )
  ) {
    throw new Error(
      "El correo electrónico no es válido."
    );
  }


  if (
    !esRolPersonal(
      rol
    )
  ) {
    throw new Error(
      "Selecciona un rol válido."
    );
  }


  if (
    !passwordSeguro(
      password
    )
  ) {
    throw new Error(
      "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
    );
  }


  if (
    datos?.laboratorioId &&
    datos.laboratorioId !==
      laboratorioId
  ) {
    throw new Error(
      "El personal debe pertenecer al mismo laboratorio del Administrador."
    );
  }


  const consultaEmail = query(
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


  const emailSnapshot =
    await getDocs(
      consultaEmail
    );


  if (
    !emailSnapshot.empty
  ) {
    throw new Error(
      "Ya existe un usuario registrado con ese correo."
    );
  }


  const appPrincipal =
    getApp();


  const nombreApp =
    `crear-personal-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;


  let appSecundaria = null;
  let authSecundario = null;
  let usuarioCreado = null;


  try {
    appSecundaria =
      initializeApp(
        appPrincipal.options,
        nombreApp
      );


    authSecundario =
      getAuth(
        appSecundaria
      );


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


    const usuarioRef = doc(
      db,
      "usuarios",
      usuarioCreado.uid
    );


    await setDoc(
      usuarioRef,
      {
        nombre,
        apellido,
        email,
        rol,
        laboratorioId,

        activo:
          true,

        fechaRegistro:
          serverTimestamp(),

        requiereVerificacionEmail,
      }
    );


    return {
      uid:
        usuarioCreado.uid,

      verificacionEnviada:
        requiereVerificacionEmail,
    };


  } catch (error) {
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
          "No se pudo revertir la cuenta:",
          errorEliminar
        );
      }
    }


    if (
      error?.code ===
      "auth/email-already-in-use"
    ) {
      throw new Error(
        "Ese correo ya está registrado en Firebase Authentication."
      );
    }


    if (
      error?.code ===
      "auth/invalid-email"
    ) {
      throw new Error(
        "El correo electrónico no es válido."
      );
    }


    if (
      error?.code ===
      "auth/weak-password"
    ) {
      throw new Error(
        "La contraseña no cumple los requisitos de seguridad."
      );
    }


    throw error;


  } finally {
    if (
      authSecundario
    ) {
      try {
        await signOut(
          authSecundario
        );
      } catch {
        // No modifica la sesión principal.
      }
    }


    if (
      appSecundaria
    ) {
      try {
        await deleteApp(
          appSecundaria
        );
      } catch {
        // La aplicación temporal ya no se utiliza.
      }
    }
  }
}


export async function actualizarPersonal(
  personalId,
  datos
) {
  const administrador =
    await obtenerAdministradorActual();


  if (
    typeof personalId !==
      "string" ||
    personalId.trim() ===
      ""
  ) {
    throw new Error(
      "Usuario inválido."
    );
  }


  const nombre =
    limpiarTexto(
      datos?.nombre
    );

  const apellido =
    limpiarTexto(
      datos?.apellido
    );

  const rol =
    limpiarTexto(
      datos?.rol
    );


  if (!nombre) {
    throw new Error(
      "Ingresa el nombre."
    );
  }


  if (!apellido) {
    throw new Error(
      "Ingresa el apellido."
    );
  }


  if (
    !esRolPersonal(
      rol
    )
  ) {
    throw new Error(
      "Selecciona un rol válido."
    );
  }


  const usuarioRef = doc(
    db,
    "usuarios",
    personalId
  );


  const usuarioSnap =
    await getDoc(
      usuarioRef
    );


  if (
    !usuarioSnap.exists()
  ) {
    throw new Error(
      "El integrante seleccionado no existe."
    );
  }


  const actual =
    usuarioSnap.data();


  if (
    actual.laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes modificar personal de otro laboratorio."
    );
  }


  if (
    !esRolPersonal(
      actual.rol
    )
  ) {
    throw new Error(
      "La cuenta seleccionada no corresponde al personal administrable."
    );
  }


  await updateDoc(
    usuarioRef,
    {
      nombre,
      apellido,
      rol,
    }
  );


  return true;
}


export async function cambiarEstadoPersonal(
  personalId,
  nuevoEstado
) {
  const administrador =
    await obtenerAdministradorActual();


  if (
    typeof personalId !==
      "string" ||
    personalId.trim() ===
      ""
  ) {
    throw new Error(
      "Usuario inválido."
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


  const usuarioRef = doc(
    db,
    "usuarios",
    personalId
  );


  const usuarioSnap =
    await getDoc(
      usuarioRef
    );


  if (
    !usuarioSnap.exists()
  ) {
    throw new Error(
      "El integrante seleccionado no existe."
    );
  }


  const datos =
    usuarioSnap.data();


  if (
    datos.laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes modificar personal de otro laboratorio."
    );
  }


  if (
    !esRolPersonal(
      datos.rol
    )
  ) {
    throw new Error(
      "La cuenta seleccionada no corresponde al personal administrable."
    );
  }


  await updateDoc(
    usuarioRef,
    {
      activo:
        nuevoEstado,
    }
  );


  return true;
}