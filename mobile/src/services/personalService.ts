import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
  type UserCredential,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
  firebaseConfig,
} from "../firebase/firebase";


export type Personal = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  laboratorioId: string;
  activo: boolean;
};


// ======================================================
// OBTENER PERSONAL DEL LABORATORIO
// ======================================================

export const obtenerPersonal =
  async (
    laboratorioId: string
  ): Promise<Personal[]> => {
    if (!laboratorioId) {
      return [];
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
// CREAR PERSONAL
// ======================================================

export const crearPersonal =
  async (datos: {
    nombre: string;
    apellido: string;
    email: string;
    password: string;
    rol: string;
    laboratorioId: string;
  }): Promise<void> => {
    if (
      datos.rol !==
        "recepcionista" &&
      datos.rol !==
        "bioquimico"
    ) {
      throw new Error(
        "Rol no permitido"
      );
    }

    const nombreApp =
      `crear-personal-${Date.now()}`;

    const appSecundaria =
      initializeApp(
        firebaseConfig,
        nombreApp
      );

    const authSecundaria =
      getAuth(
        appSecundaria
      );

    let credencial:
      UserCredential | null =
      null;

    try {
      credencial =
        await createUserWithEmailAndPassword(
          authSecundaria,
          datos.email
            .trim()
            .toLowerCase(),
          datos.password
        );

      const uid =
        credencial.user.uid;

      await setDoc(
        doc(
          db,
          "usuarios",
          uid
        ),
        {
          nombre:
            datos.nombre.trim(),

          apellido:
            datos.apellido.trim(),

          email:
            datos.email
              .trim()
              .toLowerCase(),

          rol:
            datos.rol,

          laboratorioId:
            datos.laboratorioId,

          activo:
            true,

          fechaRegistro:
            serverTimestamp(),
        }
      );

      await signOut(
        authSecundaria
      );

    } catch (error) {
      if (credencial?.user) {
        try {
          await deleteUser(
            credencial.user
          );
        } catch (
          errorEliminar
        ) {
          console.error(
            "Error eliminando usuario:",
            errorEliminar
          );
        }
      }

      console.error(
        "Error creando personal:",
        error
      );

      throw error;

    } finally {
      try {
        await deleteApp(
          appSecundaria
        );
      } catch (
        errorEliminarApp
      ) {
        console.error(
          "Error eliminando app secundaria:",
          errorEliminarApp
        );
      }
    }
  };


// ======================================================
// ACTUALIZAR PERSONAL
// ======================================================

export const actualizarPersonal =
  async (
    uid: string,
    datos: {
      nombre: string;
      apellido: string;
      rol: string;
    }
  ): Promise<void> => {
    if (
      datos.rol !==
        "recepcionista" &&
      datos.rol !==
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
        nombre:
          datos.nombre.trim(),

        apellido:
          datos.apellido.trim(),

        rol:
          datos.rol,
      }
    );
  };


// ======================================================
// ACTIVAR / DESACTIVAR PERSONAL
// ======================================================

export const cambiarEstadoPersonal =
  async (
    uid: string,
    activo: boolean
  ): Promise<void> => {
    await updateDoc(
      doc(
        db,
        "usuarios",
        uid
      ),
      {
        activo,
      }
    );
  };