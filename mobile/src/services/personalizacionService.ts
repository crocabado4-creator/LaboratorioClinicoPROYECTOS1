import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export type PersonalizacionLaboratorio = {
  id: string;
  laboratorioId: string;
  nombre: string;
  nombreVisible: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  activo: boolean;
  fechaRegistro: unknown | null;
};

export type DatosPersonalizacion = {
  nombreVisible: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
};

export const PERSONALIZACION_DEFAULT = {
  nombreVisible: "",
  logoUrl: "",
  colorPrimario: "#2563EB",
  colorSecundario: "#14B8A6",
};

function limpiarTexto(valor: unknown): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function colorValido(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function convertirLaboratorio(
  id: string,
  datos: DocumentData
): PersonalizacionLaboratorio {
  const colorPrimario =
    limpiarTexto(datos.colorPrimario);

  const colorSecundario =
    limpiarTexto(datos.colorSecundario);

  return {
    id,

    laboratorioId:
      limpiarTexto(datos.laboratorioId) ||
      id,

    nombre:
      limpiarTexto(datos.nombre),

    nombreVisible:
      limpiarTexto(datos.nombreVisible),

    direccion:
      limpiarTexto(datos.direccion),

    telefono:
      limpiarTexto(datos.telefono),

    email:
      limpiarTexto(datos.email),

    logoUrl:
      limpiarTexto(datos.logoUrl),

    colorPrimario:
      colorValido(colorPrimario)
        ? colorPrimario.toUpperCase()
        : PERSONALIZACION_DEFAULT.colorPrimario,

    colorSecundario:
      colorValido(colorSecundario)
        ? colorSecundario.toUpperCase()
        : PERSONALIZACION_DEFAULT.colorSecundario,

    activo:
      datos.activo === true,

    fechaRegistro:
      datos.fechaRegistro ?? null,
  };
}

export async function obtenerPersonalizacion(
  laboratorioId: string
): Promise<PersonalizacionLaboratorio | null> {
  const id =
    limpiarTexto(laboratorioId);

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
    await getDoc(referencia);

  if (!snapshot.exists()) {
    return null;
  }

  return convertirLaboratorio(
    snapshot.id,
    snapshot.data()
  );
}

export async function obtenerLaboratoriosPersonalizacion():
Promise<PersonalizacionLaboratorio[]> {
  const snapshot =
    await getDocs(
      collection(
        db,
        "laboratorios"
      )
    );

  return snapshot.docs
    .map((documento) =>
      convertirLaboratorio(
        documento.id,
        documento.data()
      )
    )
    .sort((a, b) =>
      a.nombre.localeCompare(
        b.nombre,
        "es"
      )
    );
}

export async function actualizarPersonalizacion(
  laboratorioId: string,
  datos: DatosPersonalizacion
): Promise<void> {
  const id =
    limpiarTexto(laboratorioId);

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

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  if (nombreVisible.length < 2) {
    throw new Error(
      "Ingresa un nombre visible válido."
    );
  }

  if (!colorValido(colorPrimario)) {
    throw new Error(
      "El color principal no es válido."
    );
  }

  if (!colorValido(colorSecundario)) {
    throw new Error(
      "El color secundario no es válido."
    );
  }

  if (
    logoUrl &&
    !logoUrl.startsWith("data:image/") &&
    !/^https?:\/\//i.test(logoUrl)
  ) {
    throw new Error(
      "El formato del logo no es válido."
    );
  }

  if (
    logoUrl.startsWith("data:image/") &&
    logoUrl.length > 700000
  ) {
    throw new Error(
      "El logo es demasiado pesado para guardarlo en Firestore."
    );
  }

  const referencia =
    doc(
      db,
      "laboratorios",
      id
    );

  const snapshot =
    await getDoc(referencia);

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