import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";


// =====================================================
// VALIDAR SUPER ADMIN
// =====================================================

async function validarSuperAdmin() {
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
    "super_admin"
  ) {
    throw new Error(
      "Solo el Super Administrador puede gestionar laboratorios."
    );
  }

  return true;
}


// =====================================================
// NORMALIZAR TEXTO
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


// =====================================================
// OBTENER TODOS LOS LABORATORIOS
// =====================================================

export async function obtenerLaboratorios() {
  await validarSuperAdmin();

  const snapshot =
    await getDocs(
      collection(
        db,
        "laboratorios"
      )
    );

  const laboratorios =
    snapshot.docs.map(
      (documento) => {
        const datos =
          documento.data();

        return {
          id:
            documento.id,

          laboratorioId:
            datos.laboratorioId ||
            documento.id,

          nombre:
            datos.nombre ||
            "",

          direccion:
            datos.direccion ||
            "",

          telefono:
            datos.telefono ||
            "",

          email:
            datos.email ||
            "",

          logoUrl:
            datos.logoUrl ||
            "",

          activo:
            datos.activo ===
            true,

          fechaRegistro:
            datos.fechaRegistro ||
            null,

          nombreVisible:
            datos.nombreVisible ||
            "",

          colorPrimario:
            datos.colorPrimario ||
            "",

          colorSecundario:
            datos.colorSecundario ||
            "",
        };
      }
    );

  return laboratorios.sort(
    (a, b) =>
      a.nombre.localeCompare(
        b.nombre,
        "es"
      )
  );
}


// =====================================================
// OBTENER LABORATORIO POR ID
// =====================================================

export async function obtenerLaboratorioPorId(
  laboratorioId
) {
  await validarSuperAdmin();

  if (!laboratorioId) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  const laboratorioRef =
    doc(
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
      "El laboratorio no existe."
    );
  }

  return {
    id:
      laboratorioSnap.id,

    ...laboratorioSnap.data(),
  };
}


// =====================================================
// CREAR LABORATORIO
// =====================================================

export async function crearLaboratorio(
  datos
) {
  await validarSuperAdmin();

  const nombre =
    limpiarTexto(
      datos?.nombre
    );

  const direccion =
    limpiarTexto(
      datos?.direccion
    );

  const telefono =
    limpiarTexto(
      datos?.telefono
    );

  const email =
    limpiarTexto(
      datos?.email
    ).toLowerCase();


  if (!nombre) {
    throw new Error(
      "El nombre del laboratorio es obligatorio."
    );
  }

  if (!direccion) {
    throw new Error(
      "La dirección es obligatoria."
    );
  }

  if (!telefono) {
    throw new Error(
      "El teléfono es obligatorio."
    );
  }

  if (!email) {
    throw new Error(
      "El correo electrónico es obligatorio."
    );
  }


  const laboratorioRef =
    doc(
      collection(
        db,
        "laboratorios"
      )
    );


  const nuevoLaboratorio = {
    laboratorioId:
      laboratorioRef.id,

    nombre,

    direccion,

    telefono,

    email,

    logoUrl:
      "",

    activo:
      true,

    fechaRegistro:
      serverTimestamp(),
  };


  await setDoc(
    laboratorioRef,
    nuevoLaboratorio
  );


  return laboratorioRef.id;
}


// =====================================================
// ACTUALIZAR LABORATORIO
// =====================================================

export async function actualizarLaboratorio(
  laboratorioId,
  datos
) {
  await validarSuperAdmin();

  if (!laboratorioId) {
    throw new Error(
      "Laboratorio inválido."
    );
  }


  const nombre =
    limpiarTexto(
      datos?.nombre
    );

  const direccion =
    limpiarTexto(
      datos?.direccion
    );

  const telefono =
    limpiarTexto(
      datos?.telefono
    );

  const email =
    limpiarTexto(
      datos?.email
    ).toLowerCase();


  if (!nombre) {
    throw new Error(
      "El nombre es obligatorio."
    );
  }

  if (!direccion) {
    throw new Error(
      "La dirección es obligatoria."
    );
  }

  if (!telefono) {
    throw new Error(
      "El teléfono es obligatorio."
    );
  }

  if (!email) {
    throw new Error(
      "El correo electrónico es obligatorio."
    );
  }


  const laboratorioRef =
    doc(
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
      "El laboratorio no existe."
    );
  }


  await updateDoc(
    laboratorioRef,
    {
      nombre,
      direccion,
      telefono,
      email,
    }
  );


  return true;
}


// =====================================================
// ACTIVAR / DESACTIVAR
//
// NO se elimina físicamente.
// =====================================================

export async function cambiarEstadoLaboratorio(
  laboratorioId,
  nuevoEstado
) {
  await validarSuperAdmin();

  if (!laboratorioId) {
    throw new Error(
      "Laboratorio inválido."
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


  const laboratorioRef =
    doc(
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
      "El laboratorio no existe."
    );
  }


  await updateDoc(
    laboratorioRef,
    {
      activo:
        nuevoEstado,
    }
  );


  return true;
}