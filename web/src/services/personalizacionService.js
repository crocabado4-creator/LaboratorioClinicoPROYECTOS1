import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";


// =====================================================
// COLORES POR DEFECTO
// =====================================================

export const PERSONALIZACION_DEFAULT = {
  nombreVisible: "",
  logoUrl: "",
  colorPrimario: "#2563EB",
  colorSecundario: "#14B8A6",
};


// =====================================================
// LIMPIAR TEXTO
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


// =====================================================
// VALIDAR COLOR HEXADECIMAL
// =====================================================

function colorValido(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(
    color
  );
}


// =====================================================
// VALIDAR SUPER ADMINISTRADOR
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
      "El usuario autenticado se encuentra inactivo."
    );
  }


  if (
    datos.rol !==
    "super_admin"
  ) {
    throw new Error(
      "Solo el Super Administrador puede modificar la personalización."
    );
  }


  return {
    uid:
      usuarioSnap.id,

    rol:
      datos.rol,
  };
}


// =====================================================
// OBTENER PERSONALIZACIÓN DE UN LABORATORIO
//
// Esta función se utiliza también desde Dashboard.jsx.
//
// Administrador, Recepcionista y Bioquímico reciben
// automáticamente la personalización de SU laboratorio.
// =====================================================

export async function obtenerPersonalizacion(
  laboratorioId
) {
  if (
    typeof laboratorioId !==
      "string" ||
    laboratorioId.trim() ===
      ""
  ) {
    return null;
  }


  const laboratorioRef = doc(
    db,
    "laboratorios",
    laboratorioId
  );


  const laboratorioSnap =
    await getDoc(
      laboratorioRef
    );


  if (!laboratorioSnap.exists()) {
    return null;
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
      limpiarTexto(
        datos.nombre
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

    fechaRegistro:
      datos.fechaRegistro ||
      null,

    nombreVisible:
      limpiarTexto(
        datos.nombreVisible
      ),

    logoUrl:
      limpiarTexto(
        datos.logoUrl
      ),

    colorPrimario:
      colorValido(
        datos.colorPrimario
      )
        ? datos.colorPrimario
        : PERSONALIZACION_DEFAULT.colorPrimario,

    colorSecundario:
      colorValido(
        datos.colorSecundario
      )
        ? datos.colorSecundario
        : PERSONALIZACION_DEFAULT.colorSecundario,
  };
}


// =====================================================
// OBTENER LABORATORIOS PARA PERSONALIZACIÓN
// SOLO SUPER ADMIN
// =====================================================

export async function obtenerLaboratoriosPersonalizacion() {
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


        const nombreVisible =
          limpiarTexto(
            datos.nombreVisible
          );


        const logoUrl =
          limpiarTexto(
            datos.logoUrl
          );


        const colorPrimario =
          colorValido(
            datos.colorPrimario
          )
            ? datos.colorPrimario
            : PERSONALIZACION_DEFAULT.colorPrimario;


        const colorSecundario =
          colorValido(
            datos.colorSecundario
          )
            ? datos.colorSecundario
            : PERSONALIZACION_DEFAULT.colorSecundario;


        const personalizado =
          nombreVisible !== "" ||
          logoUrl !== "" ||
          typeof datos.colorPrimario ===
            "string" ||
          typeof datos.colorSecundario ===
            "string";


        return {
          id:
            documento.id,

          laboratorioId:
            datos.laboratorioId ||
            documento.id,

          nombre:
            limpiarTexto(
              datos.nombre
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

          fechaRegistro:
            datos.fechaRegistro ||
            null,

          nombreVisible,

          logoUrl,

          colorPrimario,

          colorSecundario,

          personalizado,
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
// ACTUALIZAR PERSONALIZACIÓN
// SOLO SUPER ADMIN
// =====================================================

export async function actualizarPersonalizacion(
  laboratorioId,
  datos
) {
  await validarSuperAdmin();


  if (
    typeof laboratorioId !==
      "string" ||
    laboratorioId.trim() ===
      ""
  ) {
    throw new Error(
      "Laboratorio inválido."
    );
  }


  const nombreVisible =
    limpiarTexto(
      datos?.nombreVisible
    );


  const logoUrl =
    limpiarTexto(
      datos?.logoUrl
    );


  const colorPrimario =
    limpiarTexto(
      datos?.colorPrimario
    ).toUpperCase();


  const colorSecundario =
    limpiarTexto(
      datos?.colorSecundario
    ).toUpperCase();


  // =====================================================
  // VALIDACIONES
  // =====================================================

  if (!nombreVisible) {
    throw new Error(
      "El nombre visible es obligatorio."
    );
  }


  if (
    !colorValido(
      colorPrimario
    )
  ) {
    throw new Error(
      "El color principal no es válido."
    );
  }


  if (
    !colorValido(
      colorSecundario
    )
  ) {
    throw new Error(
      "El color secundario no es válido."
    );
  }


  if (
    logoUrl !== ""
  ) {
    try {
      new URL(
        logoUrl
      );

    } catch {
      throw new Error(
        "La URL del logo no es válida."
      );
    }
  }


  // =====================================================
  // COMPROBAR LABORATORIO
  // =====================================================

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
      "El laboratorio seleccionado no existe."
    );
  }


  // =====================================================
  // GUARDAR SOLO PERSONALIZACIÓN
  // =====================================================

  await updateDoc(
    laboratorioRef,
    {
      nombreVisible,
      logoUrl,
      colorPrimario,
      colorSecundario,
    }
  );


  return true;
}