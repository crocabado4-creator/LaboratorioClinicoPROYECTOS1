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
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  db,
  firebaseConfig,
} from "../firebase/firebase";

export const obtenerAdministradores = async () => {
  const consulta = query(
    collection(db, "usuarios"),
    where("rol", "==", "administrador")
  );

  const resultado =
    await getDocs(consulta);

  return resultado.docs.map(
    (documento) => ({
      id: documento.id,
      ...documento.data(),
    })
  );
};

export const crearAdministrador = async (
  datos
) => {
  let appSecundaria = null;
  let authSecundaria = null;
  let usuarioCreado = null;

  try {
    appSecundaria = initializeApp(
      firebaseConfig,
      `crear-admin-${Date.now()}`
    );

    authSecundaria =
      getAuth(appSecundaria);

    const credencial =
      await createUserWithEmailAndPassword(
        authSecundaria,
        datos.email
          .trim()
          .toLowerCase(),
        datos.password
      );

    usuarioCreado =
      credencial.user;

    const uid =
      usuarioCreado.uid;

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

    return uid;

  } catch (error) {
    /*
      Si Authentication creó el usuario
      pero Firestore falló, eliminamos la
      cuenta para no dejar datos incompletos.
    */
    if (
      usuarioCreado &&
      error.code ===
        "permission-denied"
    ) {
      try {
        await deleteUser(
          usuarioCreado
        );
      } catch (
        errorEliminar
      ) {
        console.error(
          "No se pudo limpiar el usuario:",
          errorEliminar
        );
      }
    }

    throw error;

  } finally {
    if (appSecundaria) {
      try {
        await deleteApp(
          appSecundaria
        );
      } catch (
        errorCerrar
      ) {
        console.error(
          "Error al cerrar Firebase secundario:",
          errorCerrar
        );
      }
    }
  }
};

export const actualizarAdministrador =
  async (
    uid,
    datos
  ) => {
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

export const cambiarEstadoAdministrador =
  async (
    uid,
    activo
  ) => {
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