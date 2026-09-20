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
  db,
} from "../firebase/firebase";


// ======================================================
// TIPOS
// ======================================================

export type RolSistema = {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  permisos: string[];
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


// ======================================================
// OBTENER PERMISOS DE UN ROL
// ======================================================

export const obtenerPermisosRol =
  async (
    rolId: string
  ): Promise<string[]> => {
    try {
      if (!rolId) {
        return [];
      }

      const referencia =
        doc(
          db,
          "roles",
          rolId
        );

      const resultado =
        await getDoc(
          referencia
        );

      if (!resultado.exists()) {
        return [];
      }

      const datos =
        resultado.data();

      if (
        datos.activo !== true
      ) {
        return [];
      }

      if (
        !Array.isArray(
          datos.permisos
        )
      ) {
        return [];
      }

      return datos.permisos.filter(
        (permiso) =>
          typeof permiso ===
          "string"
      );

    } catch (error) {
      console.error(
        "Error obteniendo permisos:",
        error
      );

      return [];
    }
  };


// ======================================================
// OBTENER ROLES ASIGNABLES
// ======================================================

export const obtenerRolesAsignables =
  async (): Promise<RolSistema[]> => {
    const resultado =
      await getDocs(
        collection(
          db,
          "roles"
        )
      );

    return resultado.docs
      .map(
        (documento) => {
          const datos =
            documento.data();

          return {
            id:
              documento.id,

            nombre:
              typeof datos.nombre ===
              "string"
                ? datos.nombre
                : documento.id,

            descripcion:
              typeof datos.descripcion ===
              "string"
                ? datos.descripcion
                : "",

            activo:
              datos.activo === true,

            permisos:
              Array.isArray(
                datos.permisos
              )
                ? datos.permisos
                : [],
          };
        }
      )
      .filter(
        (rol) =>
          rol.activo &&
          (
            rol.id ===
              "recepcionista" ||
            rol.id ===
              "bioquimico"
          )
      );
  };


// ======================================================
// OBTENER USUARIOS DEL LABORATORIO
// ======================================================

export const obtenerUsuariosLaboratorio =
  async (
    laboratorioId: string
  ): Promise<UsuarioRol[]> => {
    if (!laboratorioId) {
      return [];
    }

    const consulta =
      query(
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

    const resultado =
      await getDocs(
        consulta
      );

    return resultado.docs
      .map(
        (documento) => {
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
              datos.activo === true,
          };
        }
      )
      .filter(
        (usuario) =>
          usuario.rol ===
            "recepcionista" ||
          usuario.rol ===
            "bioquimico"
      );
  };


// ======================================================
// ACTUALIZAR ROL
// ======================================================

export const actualizarRolUsuario =
  async (
    uid: string,
    nuevoRol: string
  ): Promise<void> => {
    if (
      nuevoRol !==
        "recepcionista" &&
      nuevoRol !==
        "bioquimico"
    ) {
      throw new Error(
        "Rol no permitido"
      );
    }

    await updateDoc(
      doc(
        db,
        "usuarios",
        uid
      ),
      {
        rol:
          nuevoRol,
      }
    );
  };