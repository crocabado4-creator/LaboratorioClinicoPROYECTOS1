import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

// =====================================================
// VALORES PREDETERMINADOS
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
// VALIDAR COLOR
// =====================================================

function colorValido(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(
    color
  );
}


// =====================================================
// CONVERTIR LABORATORIO
// =====================================================

function convertirLaboratorio(
  id,
  datos
) {
  const colorPrimario =
    limpiarTexto(
      datos.colorPrimario
    );

  const colorSecundario =
    limpiarTexto(
      datos.colorSecundario
    );

  return {
    id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ) || id,

    nombre:
      limpiarTexto(
        datos.nombre
      ),

    nombreVisible:
      limpiarTexto(
        datos.nombreVisible
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

    logoUrl:
      limpiarTexto(
        datos.logoUrl
      ),

    colorPrimario:
      colorValido(
        colorPrimario
      )
        ? colorPrimario.toUpperCase()
        : PERSONALIZACION_DEFAULT.colorPrimario,

    colorSecundario:
      colorValido(
        colorSecundario
      )
        ? colorSecundario.toUpperCase()
        : PERSONALIZACION_DEFAULT.colorSecundario,

    activo:
      datos.activo === true,

    fechaRegistro:
      datos.fechaRegistro ||
      null,
  };
}


// =====================================================
// OBTENER PERSONALIZACIÓN DE UN LABORATORIO
//
// Lo usa también el Dashboard del Administrador,
// Recepcionista y Bioquímico.
// =====================================================

export async function obtenerPersonalizacion(
  laboratorioId
) {
  const id =
    limpiarTexto(
      laboratorioId
    );

  if (!id) {
    return null;
  }

  const referencia =
    doc(
      db,
      "laboratorios",
      id
    );

  const snapshot =
    await getDoc(
      referencia
    );

  if (!snapshot.exists()) {
    return null;
  }

  return convertirLaboratorio(
    snapshot.id,
    snapshot.data()
  );
}


// =====================================================
// LISTAR LABORATORIOS PARA SUPER ADMIN
// =====================================================

export async function obtenerLaboratoriosPersonalizacion() {
  const snapshot =
    await getDocs(
      collection(
        db,
        "laboratorios"
      )
    );

  return snapshot.docs
    .map(
      (documento) =>
        convertirLaboratorio(
          documento.id,
          documento.data()
        )
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
// ACTUALIZAR PERSONALIZACIÓN
// =====================================================

export async function actualizarPersonalizacion(
  laboratorioId,
  datos
) {
  const id =
    limpiarTexto(
      laboratorioId
    );

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  const nombreVisible =
    limpiarTexto(
      datos.nombreVisible
    );

  const logoUrl =
    limpiarTexto(
      datos.logoUrl
    );

  const colorPrimario =
    limpiarTexto(
      datos.colorPrimario
    ).toUpperCase();

  const colorSecundario =
    limpiarTexto(
      datos.colorSecundario
    ).toUpperCase();

  if (
    nombreVisible.length < 2
  ) {
    throw new Error(
      "Ingresa un nombre visible válido."
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

  // Permitimos:
  // data:image/...  -> archivo convertido a Data URL
  // http/https      -> compatibilidad con logos anteriores
  if (
    logoUrl &&
    !logoUrl.startsWith(
      "data:image/"
    ) &&
    !/^https?:\/\//i.test(
      logoUrl
    )
  ) {
    throw new Error(
      "El formato del logo no es válido."
    );
  }

  const referencia =
    doc(
      db,
      "laboratorios",
      id
    );

  const snapshot =
    await getDoc(
      referencia
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  await updateDoc(
    referencia,
    {
      nombreVisible,
      logoUrl,
      colorPrimario,
      colorSecundario,
    }
  );
}