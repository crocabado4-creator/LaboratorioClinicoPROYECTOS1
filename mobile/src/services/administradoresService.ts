import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
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


export type Administrador = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  laboratorioId: string;
  rol: string;
  activo: boolean;
};


// ======================================================
// OBTENER ADMINISTRADORES
// ======================================================

export const obtenerAdministradores =
  async (): Promise<Administrador[]> => {
    const consulta = query(
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

    const resultado =
      await getDocs(
        consulta
      );

    return resultado.docs.map(
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

          laboratorioId:
            typeof datos.laboratorioId ===
            "string"
              ? datos.laboratorioId
              : "",

          rol:
            "administrador",

          activo:
            datos.activo === true,
        };
      }
    );
  };


// ======================================================
// CREAR ADMINISTRADOR
// ======================================================

export const crearAdministrador =
  async (datos: {
    nombre: string;
    apellido: string;
    email: string;
    password: string;
    laboratorioId: string;
  }): Promise<void> => {
    const nombreApp =
      `crear-admin-${Date.now()}`;

    const appSecundaria =
      initializeApp(
        firebaseConfig,
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
          datos.email
            .trim()
            .toLowerCase(),
          datos.password
        );

      const uid =
        usuarioCreado.user.uid;

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
            "administrador",

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
      if (
        usuarioCreado?.user
      ) {
        try {
          await deleteUser(
            usuarioCreado.user
          );
        } catch (
          errorEliminar
        ) {
          console.error(
            "Error eliminando usuario temporal:",
            errorEliminar
          );
        }
      }

      console.error(
        "Error creando administrador:",
        error
      );

      throw error;

    } finally {
      try {
        await deleteApp(
          appSecundaria
        );
      } catch (
        errorCerrar
      ) {
        console.error(
          "Error cerrando app secundaria:",
          errorCerrar
        );
      }
    }
  };


// ======================================================
// ACTUALIZAR ADMINISTRADOR
// ======================================================

export const actualizarAdministrador =
  async (
    uid: string,
    datos: {
      nombre: string;
      apellido: string;
      laboratorioId: string;
    }
  ): Promise<void> => {
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

        laboratorioId:
          datos.laboratorioId,
      }
    );
  };


// ======================================================
// ACTIVAR / DESACTIVAR
// ======================================================

export const cambiarEstadoAdministrador =
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