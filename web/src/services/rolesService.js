import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";


const ROLES_ASIGNABLES = [
  "recepcionista",
  "bioquimico",
];


// =====================================================
// OBTENER PERMISOS DE UN ROL
// =====================================================

export async function obtenerPermisosRol(
  rolId
) {
  if (
    typeof rolId !== "string" ||
    rolId.trim() === ""
  ) {
    return [];
  }

  const rolRef = doc(
    db,
    "roles",
    rolId.trim()
  );

  const rolSnap = await getDoc(
    rolRef
  );

  if (!rolSnap.exists()) {
    return [];
  }

  const datos = rolSnap.data();

  if (datos.activo !== true) {
    return [];
  }

  return Array.isArray(
    datos.permisos
  )
    ? datos.permisos
    : [];
}


// =====================================================
// OBTENER ROLES ASIGNABLES
//
// El Administrador solo puede asignar:
// - recepcionista
// - bioquimico
// =====================================================

export async function obtenerRolesAsignables() {
  const snapshot =
    await getDocs(
      collection(
        db,
        "roles"
      )
    );

  return snapshot.docs
    .map((documento) => {
      const datos =
        documento.data();

      return {
        id:
          documento.id,

        nombre:
          typeof datos.nombre === "string" &&
          datos.nombre.trim() !== ""
            ? datos.nombre
            : documento.id,

        descripcion:
          typeof datos.descripcion === "string"
            ? datos.descripcion
            : "",

        permisos:
          Array.isArray(
            datos.permisos
          )
            ? datos.permisos
            : [],

        activo:
          datos.activo === true,
      };
    })
    .filter(
      (rol) =>
        ROLES_ASIGNABLES.includes(
          rol.id
        ) &&
        rol.activo === true
    )
    .sort(
      (a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          "es"
        )
    );
}


// =====================================================
// OBTENER ADMINISTRADOR AUTENTICADO
// =====================================================

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
      "El usuario autenticado no existe en Firestore."
    );
  }

  const datos =
    usuarioSnap.data();

  if (datos.activo !== true) {
    throw new Error(
      "El usuario autenticado está inactivo."
    );
  }

  if (
    datos.rol !==
    "administrador"
  ) {
    throw new Error(
      "Solo el Administrador del Laboratorio puede gestionar roles."
    );
  }

  if (
    typeof datos.laboratorioId !==
      "string" ||
    datos.laboratorioId.trim() ===
      ""
  ) {
    throw new Error(
      "El Administrador no está asociado a un laboratorio."
    );
  }

  return {
    uid:
      usuarioSnap.id,

    laboratorioId:
      datos.laboratorioId,
  };
}


// =====================================================
// OBTENER USUARIOS DEL LABORATORIO
//
// Solo:
// - recepcionista
// - bioquimico
//
// Y solo del laboratorio del Administrador.
// =====================================================

export async function obtenerUsuariosLaboratorio(
  laboratorioId
) {
  const administrador =
    await obtenerAdministradorActual();


  if (
    typeof laboratorioId !==
      "string" ||
    laboratorioId.trim() ===
      ""
  ) {
    return [];
  }


  if (
    administrador.laboratorioId !==
    laboratorioId
  ) {
    throw new Error(
      "No puede consultar usuarios de otro laboratorio."
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


  return snapshot.docs
    .map((documento) => {
      const datos =
        documento.data();

      return {
        id:
          documento.id,

        nombre:
          typeof datos.nombre ===
          "string"
            ? datos.nombre
            : "",

        apellido:
          typeof datos.apellido ===
          "string"
            ? datos.apellido
            : "",

        email:
          typeof datos.email ===
          "string"
            ? datos.email
            : "",

        rol:
          typeof datos.rol ===
          "string"
            ? datos.rol
            : "",

        laboratorioId:
          typeof datos.laboratorioId ===
          "string"
            ? datos.laboratorioId
            : "",

        activo:
          datos.activo ===
          true,

        fechaRegistro:
          datos.fechaRegistro ??
          null,
      };
    })
    .filter(
      (usuario) =>
        ROLES_ASIGNABLES.includes(
          usuario.rol
        )
    )
    .sort(
      (a, b) => {
        const nombreA =
          `${a.nombre} ${a.apellido}`
            .trim();

        const nombreB =
          `${b.nombre} ${b.apellido}`
            .trim();

        return nombreA.localeCompare(
          nombreB,
          "es"
        );
      }
    );
}


// =====================================================
// ACTUALIZAR ROL DE USUARIO
// =====================================================

export async function actualizarRolUsuario(
  usuarioId,
  nuevoRol
) {
  const administrador =
    await obtenerAdministradorActual();


  // -----------------------------------------------------
  // VALIDAR USUARIO
  // -----------------------------------------------------

  if (
    typeof usuarioId !==
      "string" ||
    usuarioId.trim() ===
      ""
  ) {
    throw new Error(
      "Usuario inválido."
    );
  }


  // -----------------------------------------------------
  // VALIDAR ROL
  // -----------------------------------------------------

  if (
    !ROLES_ASIGNABLES.includes(
      nuevoRol
    )
  ) {
    throw new Error(
      "El rol seleccionado no es válido."
    );
  }


  // -----------------------------------------------------
  // COMPROBAR QUE EL ROL EXISTE
  // -----------------------------------------------------

  const rolRef = doc(
    db,
    "roles",
    nuevoRol
  );

  const rolSnap =
    await getDoc(
      rolRef
    );


  if (!rolSnap.exists()) {
    throw new Error(
      "El rol seleccionado no existe."
    );
  }


  if (
    rolSnap.data().activo !==
    true
  ) {
    throw new Error(
      "El rol seleccionado está inactivo."
    );
  }


  // -----------------------------------------------------
  // OBTENER USUARIO A MODIFICAR
  // -----------------------------------------------------

  const usuarioRef = doc(
    db,
    "usuarios",
    usuarioId
  );

  const usuarioSnap =
    await getDoc(
      usuarioRef
    );


  if (!usuarioSnap.exists()) {
    throw new Error(
      "El usuario seleccionado no existe."
    );
  }


  const datosUsuario =
    usuarioSnap.data();


  // -----------------------------------------------------
  // MISMO LABORATORIO
  // -----------------------------------------------------

  if (
    datosUsuario.laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puede modificar usuarios de otro laboratorio."
    );
  }


  // -----------------------------------------------------
  // SOLO RECEPCIONISTA/BIOQUIMICO
  // -----------------------------------------------------

  if (
    !ROLES_ASIGNABLES.includes(
      datosUsuario.rol
    )
  ) {
    throw new Error(
      "Ese usuario no puede recibir este cambio de rol."
    );
  }


  // -----------------------------------------------------
  // GUARDAR CAMBIO
  // -----------------------------------------------------

  await updateDoc(
    usuarioRef,
    {
      rol:
        nuevoRol,
    }
  );


  return true;
}