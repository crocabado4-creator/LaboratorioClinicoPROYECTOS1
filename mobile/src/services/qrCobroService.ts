import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  validarAdministradorActual,
} from "./configuracionLaboratorioService";

// ========================================
// TIPOS
// ========================================

export type ConfiguracionQR = {
  laboratorioId: string;
  laboratorioNombre: string;
  qrUrl: string;
};

// ========================================
// VALIDACIONES
// ========================================

function validarId(laboratorioId: string): string {
  const id = laboratorioId?.trim();

  if (!id) {
    throw new Error(
      "No se encontró el identificador del laboratorio."
    );
  }

  return id;
}

function validarImagen(imagen: string): void {
  if (!imagen) {
    throw new Error(
      "Selecciona una imagen QR."
    );
  }

  const patron =
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

  if (!patron.test(imagen)) {
    throw new Error(
      "La imagen debe ser PNG, JPG o WEBP."
    );
  }

  if (imagen.length > 150000) {
    throw new Error(
      "La imagen QR es demasiado grande. Debe ocupar menos de aproximadamente 110 KB."
    );
  }
}

// ========================================
// VALIDAR ADMINISTRADOR
// ========================================

async function validarPermisoAdministrador(
  laboratorioId: string
): Promise<void> {
  const administrador =
    await validarAdministradorActual();

  if (
    administrador.laboratorioId !== laboratorioId
  ) {
    throw new Error(
      "No tienes permiso para modificar el QR de este laboratorio."
    );
  }
}

// ========================================
// OBTENER CONFIGURACIÓN QR
// ========================================

export async function obtenerConfiguracionQR(
  laboratorioId: string
): Promise<ConfiguracionQR> {
  const id = validarId(laboratorioId);

  const referencia = doc(
    db,
    "laboratorios",
    id
  );

  const snapshot = await getDoc(referencia);

  if (!snapshot.exists()) {
    throw new Error(
      "No se encontró el laboratorio en Firestore."
    );
  }

  const datos = snapshot.data();

  const configuracionPagos =
    datos.configuracionPagos || {};

  const qrUrl =
    typeof configuracionPagos.imagenURL === "string"
      ? configuracionPagos.imagenURL
      : typeof configuracionPagos.qrUrl === "string"
        ? configuracionPagos.qrUrl
        : "";

  const laboratorioNombre =
    typeof datos.nombreVisible === "string" &&
    datos.nombreVisible.trim()
      ? datos.nombreVisible.trim()
      : typeof datos.nombre === "string"
        ? datos.nombre.trim()
        : "Laboratorio clínico";

  return {
    laboratorioId: snapshot.id,
    laboratorioNombre,
    qrUrl,
  };
}

// ========================================
// OBTENER QR
// ========================================

export async function obtenerQRLaboratorio(
  laboratorioId: string
): Promise<string> {
  const configuracion =
    await obtenerConfiguracionQR(laboratorioId);

  return configuracion.qrUrl;
}

// ========================================
// GUARDAR O ACTUALIZAR QR
// ========================================

export async function guardarQRLaboratorio(
  laboratorioId: string,
  imagenQR: string
): Promise<void> {
  const id = validarId(laboratorioId);

  validarImagen(imagenQR);

  await validarPermisoAdministrador(id);

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

  if (snapshot.data().activo !== true) {
    throw new Error(
      "El laboratorio se encuentra inactivo."
    );
  }

  // Guardar en la misma estructura autorizada
  // por las reglas de Firestore.

  await updateDoc(referencia, {
    configuracionPagos: {
      imagenURL: imagenQR,
      qrUrl: imagenQR,
    },
  });

  // Verificar el guardado.

  const verificacion = await getDoc(referencia);

  if (!verificacion.exists()) {
    throw new Error(
      "No se pudo verificar el laboratorio."
    );
  }

  const datos = verificacion.data();

  if (
    datos.configuracionPagos?.imagenURL !== imagenQR ||
    datos.configuracionPagos?.qrUrl !== imagenQR
  ) {
    throw new Error(
      "No se pudo confirmar el guardado del QR."
    );
  }
}

// ========================================
// ELIMINAR QR
// ========================================

export async function eliminarQRLaboratorio(
  laboratorioId: string
): Promise<void> {
  const id = validarId(laboratorioId);

  await validarPermisoAdministrador(id);

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

  if (snapshot.data().activo !== true) {
    throw new Error(
      "El laboratorio se encuentra inactivo."
    );
  }

  await updateDoc(referencia, {
    configuracionPagos: {
      imagenURL: "",
      qrUrl: "",
    },
  });

  const verificacion = await getDoc(referencia);

  if (!verificacion.exists()) {
    throw new Error(
      "No se pudo verificar la eliminación."
    );
  }

  const configuracionPagos =
    verificacion.data().configuracionPagos;

  if (
    configuracionPagos?.imagenURL !== "" ||
    configuracionPagos?.qrUrl !== ""
  ) {
    throw new Error(
      "No se pudo confirmar la eliminación del QR."
    );
  }
}