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


export type RolSistema = {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
  activo: boolean;
};


export type UsuarioRol = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  laboratorioId: string;
  activo: boolean;
};


const ROLES_ASIGNABLES = [
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


export async function obtenerPermisosRol(
  rolId: string
): Promise<string[]> {
  const id =
    limpiarTexto(
      rolId
    );

  if (!id) {
    return [];
  }


  const rolRef = doc(
    db,
    "roles",
    id
  );


  const rolSnap =
    await getDoc(
      rolRef
    );


  if (!rolSnap.exists()) {
    return [];
  }


  const datos =
    rolSnap.data();


  if (
    datos.activo !==
    true
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
            "string" &&
          permiso.trim() !==
            ""
      )
    : [];
}


async function validarAdministrador() {
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
      "El usuario autenticado no existe."
    );
  }


  const datos =
    usuarioSnap.data();


  if (
    datos.activo !==
    true
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
      "Solo el Administrador del Laboratorio puede gestionar roles."
    );
  }


  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );


  if (!laboratorioId) {
    throw new Error(
      "La cuenta no tiene un laboratorio asociado."
    );
  }


  const permisos =
    await obtenerPermisosRol(
      "administrador"
    );


  if (
    !permisos.includes(
      "roles.asignar"
    )
  ) {
    throw new Error(
      "No tienes permiso para asignar roles."
    );
  }


  return {
    uid:
      usuarioSnap.id,

    laboratorioId,
  };
}


export async function obtenerRolesAsignables(): Promise<
  RolSistema[]
> {
  await validarAdministrador();


  const resultado:
    RolSistema[] = [];


  for (
    const rolId of
    ROLES_ASIGNABLES
  ) {
    const rolRef = doc(
      db,
      "roles",
      rolId
    );


    const rolSnap =
      await getDoc(
        rolRef
      );


    if (!rolSnap.exists()) {
      continue;
    }


    const datos =
      rolSnap.data();


    if (
      datos.activo !==
      true
    ) {
      continue;
    }


    resultado.push({
      id:
        rolSnap.id,

      nombre:
        limpiarTexto(
          datos.nombre
        ) ||
        nombreRol(
          rolSnap.id
        ),

      descripcion:
        limpiarTexto(
          datos.descripcion
        ),

      permisos:
        Array.isArray(
          datos.permisos
        )
          ? datos.permisos.filter(
              (
                permiso
              ): permiso is string =>
                typeof permiso ===
                  "string"
            )
          : [],

      activo:
        true,
    });
  }


  return resultado;
}


export async function obtenerUsuariosLaboratorio(
  laboratorioIdSolicitado?: string
): Promise<UsuarioRol[]> {
  const administrador =
    await validarAdministrador();


  if (
    laboratorioIdSolicitado &&
    laboratorioIdSolicitado !==
      administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes consultar usuarios de otro laboratorio."
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
      ): UsuarioRol => {
        const datos =
          documento.data();


        return {
          id:
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
        };
      }
    )
    .filter(
      (usuario) =>
        ROLES_ASIGNABLES.includes(
          usuario.rol
        )
    )
    .sort(
      (a, b) =>
        `${a.nombre} ${a.apellido}`.localeCompare(
          `${b.nombre} ${b.apellido}`,
          "es"
        )
    );
}


export async function actualizarRolUsuario(
  usuarioId: string,
  nuevoRol: string
): Promise<void> {
  const administrador =
    await validarAdministrador();


  const idUsuario =
    limpiarTexto(
      usuarioId
    );


  const rol =
    limpiarTexto(
      nuevoRol
    );


  if (!idUsuario) {
    throw new Error(
      "El usuario seleccionado no es válido."
    );
  }


  if (
    !ROLES_ASIGNABLES.includes(
      rol
    )
  ) {
    throw new Error(
      "El rol seleccionado no es válido."
    );
  }


  const rolRef = doc(
    db,
    "roles",
    rol
  );


  const rolSnap =
    await getDoc(
      rolRef
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


  const usuarioRef = doc(
    db,
    "usuarios",
    idUsuario
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


  if (
    datosUsuario.laboratorioId !==
    administrador.laboratorioId
  ) {
    throw new Error(
      "No puedes modificar usuarios de otro laboratorio."
    );
  }


  if (
    !ROLES_ASIGNABLES.includes(
      datosUsuario.rol
    )
  ) {
    throw new Error(
      "No puedes modificar el rol de esta cuenta."
    );
  }


  await updateDoc(
    usuarioRef,
    {
      rol,
    }
  );
}


export function nombreRol(
  rolId: string
): string {
  if (
    rolId ===
    "recepcionista"
  ) {
    return "Recepcionista";
  }


  if (
    rolId ===
    "bioquimico"
  ) {
    return "Bioquímico";
  }


  if (
    rolId ===
    "administrador"
  ) {
    return "Administrador";
  }


  if (
    rolId ===
    "super_admin"
  ) {
    return "Super Administrador";
  }


  return rolId ||
    "Sin rol";
}