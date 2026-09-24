import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

export const PERSONALIZACION_DEFAULT = {
  nombreVisible: "",
  logoUrl: "",
  colorPrimario: "#2563EB",
  colorSecundario: "#14B8A6",
};

export type PersonalizacionLaboratorio = {
  id: string;
  laboratorioId: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  activo: boolean;
  fechaRegistro: unknown;
  nombreVisible: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  personalizado: boolean;
};

export type DatosPersonalizacion = {
  nombreVisible: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
};

function limpiarTexto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function colorValido(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

async function validarSuperAdmin() {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error("No existe una sesión autenticada.");
  }

  const usuarioSnap = await getDoc(doc(db, "usuarios", firebaseUser.uid));

  if (!usuarioSnap.exists()) {
    throw new Error("La cuenta autenticada no existe en el sistema.");
  }

  const datos = usuarioSnap.data();

  if (datos.activo !== true) {
    throw new Error("La cuenta se encuentra inactiva.");
  }

  if (datos.rol !== "super_admin") {
    throw new Error("Solo el Super Administrador puede modificar la personalización.");
  }

  return {
    uid: firebaseUser.uid,
  };
}

function convertirLaboratorio(
  id: string,
  datos: Record<string, unknown>
): PersonalizacionLaboratorio {
  const nombreVisibleReal = limpiarTexto(datos.nombreVisible);
  const logoReal = limpiarTexto(datos.logoUrl);
  const primarioReal = limpiarTexto(datos.colorPrimario);
  const secundarioReal = limpiarTexto(datos.colorSecundario);

  return {
    id,
    laboratorioId: limpiarTexto(datos.laboratorioId) || id,
    nombre: limpiarTexto(datos.nombre),
    direccion: limpiarTexto(datos.direccion),
    telefono: limpiarTexto(datos.telefono),
    email: limpiarTexto(datos.email),
    activo: datos.activo === true,
    fechaRegistro: datos.fechaRegistro || null,
    nombreVisible: nombreVisibleReal,
    logoUrl: logoReal,
    colorPrimario: colorValido(primarioReal)
      ? primarioReal.toUpperCase()
      : PERSONALIZACION_DEFAULT.colorPrimario,
    colorSecundario: colorValido(secundarioReal)
      ? secundarioReal.toUpperCase()
      : PERSONALIZACION_DEFAULT.colorSecundario,
    personalizado: Boolean(
      nombreVisibleReal ||
      logoReal ||
      primarioReal ||
      secundarioReal
    ),
  };
}

export async function obtenerPersonalizacion(
  laboratorioId: string
): Promise<PersonalizacionLaboratorio> {
  const id = limpiarTexto(laboratorioId);

  if (!id) {
    throw new Error("Laboratorio inválido.");
  }

  const laboratorioSnap = await getDoc(doc(db, "laboratorios", id));

  if (!laboratorioSnap.exists()) {
    throw new Error("El laboratorio no existe.");
  }

  return convertirLaboratorio(
    laboratorioSnap.id,
    laboratorioSnap.data()
  );
}

export async function obtenerLaboratoriosPersonalizacion(): Promise<
  PersonalizacionLaboratorio[]
> {
  await validarSuperAdmin();

  const snapshot = await getDocs(collection(db, "laboratorios"));

  return snapshot.docs
    .map((documento) =>
      convertirLaboratorio(documento.id, documento.data())
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function actualizarPersonalizacion(
  laboratorioId: string,
  datos: DatosPersonalizacion
): Promise<void> {
  await validarSuperAdmin();

  const id = limpiarTexto(laboratorioId);
  const nombreVisible = limpiarTexto(datos.nombreVisible);
  const logoUrl = limpiarTexto(datos.logoUrl);
  const colorPrimario = limpiarTexto(datos.colorPrimario).toUpperCase();
  const colorSecundario = limpiarTexto(datos.colorSecundario).toUpperCase();

  if (!id) {
    throw new Error("Laboratorio inválido.");
  }

  if (nombreVisible.length < 2) {
    throw new Error("Ingresa un nombre visible válido.");
  }

  if (!colorValido(colorPrimario)) {
    throw new Error("El color principal debe tener formato hexadecimal, por ejemplo #2563EB.");
  }

  if (!colorValido(colorSecundario)) {
    throw new Error("El color secundario debe tener formato hexadecimal, por ejemplo #14B8A6.");
  }

  if (logoUrl && !/^https?:\/\/.+/i.test(logoUrl)) {
    throw new Error("La dirección del logo no es válida.");
  }

  const referencia = doc(db, "laboratorios", id);
  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error("El laboratorio seleccionado no existe.");
  }

  await updateDoc(referencia, {
    nombreVisible,
    logoUrl,
    colorPrimario,
    colorSecundario,
  });
}