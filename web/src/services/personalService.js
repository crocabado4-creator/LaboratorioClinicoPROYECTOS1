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


// ========================================
// OBTENER PERSONAL DEL LABORATORIO
// ========================================

export const obtenerPersonal = async (
  laboratorioId
) => {
  const consulta = query(
    collection(db, "usuarios"),
    where(
      "laboratorioId",
      "==",
      laboratorioId
    )
  );

  const resultado =
    await getDocs(consulta);

  return resultado.docs
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .filter(
      (usuario) =>
        usuario.rol === "recepcionista" ||
        usuario.rol === "bioquimico"
    );
};


// ========================================
// CREAR PERSONAL
// ========================================

export const crearPersonal = async (
  datos
) => {
  let appSecundaria = null;
  let usuarioCreado = null;

  try {
    appSecundaria =
      initializeApp(
        firebaseConfig,
        `crear-personal-${Date.now()}`
      );

    const authSecundaria =
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

    return uid;

  } catch (error) {
    if (usuarioCreado) {
      try {
        await deleteUser(
          usuarioCreado
        );
      } catch (errorEliminar) {
        console.error(
          "No se pudo eliminar el usuario incompleto:",
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
      } catch (error) {
        console.error(
          "Error al cerrar Firebase secundario:",
          error
        );
      }
    }
  }
};


// ========================================
// EDITAR PERSONAL
// ========================================

export const actualizarPersonal = async (
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

      rol:
        datos.rol,
    }
  );
};


// ========================================
// ACTIVAR / DESACTIVAR
// ========================================

export const cambiarEstadoPersonal = async (
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