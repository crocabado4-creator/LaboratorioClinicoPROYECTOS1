import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

export type Laboratorio = {
  id: string;
  laboratorioId: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
  nombreVisible: string;
  colorPrimario: string;
  colorSecundario: string;
  activo: boolean;
  fechaRegistro: unknown;
};

export type DatosLaboratorio = {
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function limpiarTexto(valor: unknown): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function validarTelefono(telefono: string): boolean {
  return /^[0-9+\-\s()]{6,20}$/.test(telefono);
}

function validarCorreo(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// =====================================================
// VALIDAR SUPER ADMINISTRADOR
// =====================================================

async function validarSuperAdmin(): Promise<{
  uid: string;
}> {
  const firebaseUser = auth.currentUser;

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

  const usuarioSnap = await getDoc(usuarioRef);

  if (!usuarioSnap.exists()) {
    throw new Error(
      "El usuario no existe en Firestore."
    );
  }

  const datos = usuarioSnap.data();

  if (datos.activo !== true) {
    throw new Error(
      "La cuenta se encuentra inactiva."
    );
  }

  if (datos.rol !== "super_admin") {
    throw new Error(
      "Solo el Super Administrador puede gestionar laboratorios."
    );
  }

  return {
    uid: firebaseUser.uid,
  };
}

// =====================================================
// CONVERTIR DATOS DE FIRESTORE
// =====================================================

function convertirLaboratorio(
  id: string,
  datos: Record<string, unknown>
): Laboratorio {
  const colorPrimario = limpiarTexto(
    datos.colorPrimario
  );

  const colorSecundario = limpiarTexto(
    datos.colorSecundario
  );

  return {
    id,

    laboratorioId:
      limpiarTexto(datos.laboratorioId) || id,

    nombre: limpiarTexto(datos.nombre),

    direccion: limpiarTexto(datos.direccion),

    telefono: limpiarTexto(datos.telefono),

    email: limpiarTexto(datos.email),

    logoUrl: limpiarTexto(datos.logoUrl),

    nombreVisible: limpiarTexto(
      datos.nombreVisible
    ),

    colorPrimario:
      /^#[0-9A-Fa-f]{6}$/.test(colorPrimario)
        ? colorPrimario
        : "#2563EB",

    colorSecundario:
      /^#[0-9A-Fa-f]{6}$/.test(colorSecundario)
        ? colorSecundario
        : "#14B8A6",

    activo: datos.activo === true,

    fechaRegistro: datos.fechaRegistro || null,
  };
}

// =====================================================
// OBTENER TODOS LOS LABORATORIOS
// =====================================================

export async function obtenerLaboratorios(): Promise<
  Laboratorio[]
> {
  await validarSuperAdmin();

  const snapshot = await getDocs(
    collection(db, "laboratorios")
  );

  const laboratorios = snapshot.docs.map(
    (documento) =>
      convertirLaboratorio(
        documento.id,
        documento.data()
      )
  );

  return laboratorios.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );
}

// =====================================================
// OBTENER LABORATORIO POR ID
// =====================================================

export async function obtenerLaboratorioPorId(
  laboratorioId: string
): Promise<Laboratorio> {
  await validarSuperAdmin();

  const id = limpiarTexto(laboratorioId);

  if (!id) {
    throw new Error("Laboratorio inválido.");
  }

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  return convertirLaboratorio(
    snapshot.id,
    snapshot.data()
  );
}

// =====================================================
// CREAR LABORATORIO SIN CORREO
// =====================================================

export async function crearLaboratorio(
  datos: DatosLaboratorio
): Promise<string> {
  await validarSuperAdmin();

  const nombre = limpiarTexto(datos.nombre);

  const direccion = limpiarTexto(
    datos.direccion
  );

  const telefono = limpiarTexto(
    datos.telefono
  );

  // ================================================
  // VALIDACIONES
  // ================================================

  if (nombre.length < 2) {
    throw new Error(
      "Ingresa un nombre válido para el laboratorio."
    );
  }

  if (direccion.length < 4) {
    throw new Error(
      "Ingresa una dirección válida."
    );
  }

  if (!validarTelefono(telefono)) {
    throw new Error(
      "Ingresa un número de teléfono válido."
    );
  }

  // ================================================
  // GENERAR ID DEL LABORATORIO
  // ================================================

  const nuevoRef = doc(
    collection(db, "laboratorios")
  );

  // ================================================
  // GUARDAR EN FIRESTORE
  // ================================================

  await setDoc(nuevoRef, {
    laboratorioId: nuevoRef.id,

    nombre,

    direccion,

    telefono,

    // No se solicita correo electrónico.

    email: "",

    // Personalización inicial.

    nombreVisible: "",

    logoUrl: "",

    colorPrimario: "#2563EB",

    colorSecundario: "#14B8A6",

    // Estado inicial.

    activo: true,

    fechaRegistro: serverTimestamp(),
  });

  console.log(
    "Laboratorio creado correctamente:",
    nuevoRef.id
  );

  return nuevoRef.id;
}

// =====================================================
// ACTUALIZAR LABORATORIO SIN CORREO OBLIGATORIO
// =====================================================

export async function actualizarLaboratorio(
  laboratorioId: string,
  datos: DatosLaboratorio
): Promise<void> {
  await validarSuperAdmin();

  const id = limpiarTexto(laboratorioId);

  const nombre = limpiarTexto(datos.nombre);

  const direccion = limpiarTexto(
    datos.direccion
  );

  const telefono = limpiarTexto(
    datos.telefono
  );

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  if (nombre.length < 2) {
    throw new Error(
      "Ingresa un nombre válido."
    );
  }

  if (direccion.length < 4) {
    throw new Error(
      "Ingresa una dirección válida."
    );
  }

  if (!validarTelefono(telefono)) {
    throw new Error(
      "Ingresa un teléfono válido."
    );
  }

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  // Solo actualizamos los datos generales.
  // Se conserva la personalización y el correo
  // que pudiera tener un laboratorio existente.

  await updateDoc(referencia, {
    nombre,
    direccion,
    telefono,
  });

  console.log(
    "Laboratorio actualizado:",
    id
  );
}

// =====================================================
// CAMBIAR ESTADO DEL LABORATORIO
// =====================================================

export async function cambiarEstadoLaboratorio(
  laboratorioId: string,
  nuevoEstado: boolean
): Promise<void> {
  await validarSuperAdmin();

  const id = limpiarTexto(laboratorioId);

  if (!id) {
    throw new Error(
      "Laboratorio inválido."
    );
  }

  if (typeof nuevoEstado !== "boolean") {
    throw new Error(
      "Estado inválido."
    );
  }

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error(
      "El laboratorio no existe."
    );
  }

  await updateDoc(referencia, {
    activo: nuevoEstado,
  });

  console.log(
    "Estado del laboratorio actualizado:",
    nuevoEstado
  );
}