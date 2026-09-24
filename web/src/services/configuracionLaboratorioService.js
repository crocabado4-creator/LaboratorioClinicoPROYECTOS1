import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";


// =====================================================
// VALIDAR ADMINISTRADOR ACTUAL
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
      "Solo el Administrador del Laboratorio puede modificar esta información."
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
// LIMPIAR TEXTO
// =====================================================

function limpiarTexto(
  valor
) {
  return typeof valor ===
    "string"
    ? valor.trim()
    : "";
}


// =====================================================
// OBTENER LABORATORIO DEL ADMINISTRADOR
//
// IMPORTANTE:
// No recibe un laboratorio cualquiera.
// Se obtiene desde el usuario autenticado.
// =====================================================

export async function obtenerLaboratorio() {
  const administrador =
    await obtenerAdministradorActual();


  const laboratorioRef =
    doc(
      db,
      "laboratorios",
      administrador.laboratorioId
    );


  const laboratorioSnap =
    await getDoc(
      laboratorioRef
    );


  if (
    !laboratorioSnap.exists()
  ) {
    throw new Error(
      "El laboratorio asociado al Administrador no existe."
    );
  }


  const datos =
    laboratorioSnap.data();


  return {
    id:
      laboratorioSnap.id,

    laboratorioId:
      datos.laboratorioId ||
      laboratorioSnap.id,

    nombre:
      typeof datos.nombre ===
      "string"
        ? datos.nombre
        : "",

    direccion:
      typeof datos.direccion ===
      "string"
        ? datos.direccion
        : "",

    telefono:
      typeof datos.telefono ===
      "string"
        ? datos.telefono
        : "",

    email:
      typeof datos.email ===
      "string"
        ? datos.email
        : "",

    activo:
      datos.activo ===
      true,

    fechaRegistro:
      datos.fechaRegistro ||
      null,

    // =========================================
    // SOLO LECTURA
    // HU-06
    // =========================================

    nombreVisible:
      typeof datos.nombreVisible ===
      "string"
        ? datos.nombreVisible
        : "",

    logoUrl:
      typeof datos.logoUrl ===
      "string"
        ? datos.logoUrl
        : "",

    colorPrimario:
      typeof datos.colorPrimario ===
      "string"
        ? datos.colorPrimario
        : "",

    colorSecundario:
      typeof datos.colorSecundario ===
      "string"
        ? datos.colorSecundario
        : "",
  };
}


// =====================================================
// ALIAS COMPATIBLE
// =====================================================

export async function obtenerConfiguracionLaboratorio() {
  return obtenerLaboratorio();
}


// =====================================================
// ACTUALIZAR DATOS GENERALES
//
// SOLO:
// nombre
// direccion
// telefono
// email
//
// NO:
// logoUrl
// nombreVisible
// colorPrimario
// colorSecundario
// activo
// laboratorioId
// =====================================================

export async function actualizarConfiguracionLaboratorio(
  datos
) {
  const administrador =
    await obtenerAdministradorActual();


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


  // =====================================================
  // VALIDACIONES
  // =====================================================

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


  const correoValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  if (
    !correoValido.test(
      email
    )
  ) {
    throw new Error(
      "Ingrese un correo electrónico válido."
    );
  }


  // =====================================================
  // OBTENER SU LABORATORIO
  // =====================================================

  const laboratorioRef =
    doc(
      db,
      "laboratorios",
      administrador.laboratorioId
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


  // =====================================================
  // ACTUALIZAR ÚNICAMENTE DATOS GENERALES
  // =====================================================

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