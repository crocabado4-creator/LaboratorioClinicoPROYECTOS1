import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;

const TAMANO_MAXIMO_BASE64 = 150000;

// =====================================================
// VALIDAR ADMINISTRADOR
// =====================================================

async function obtenerAdministradorActual() {
  const usuarioFirebase = auth.currentUser;

  if (!usuarioFirebase) {
    throw new Error("Debes iniciar sesión.");
  }

  const usuarioRef = doc(
    db,
    "usuarios",
    usuarioFirebase.uid
  );

  const usuarioSnap = await getDoc(usuarioRef);

  if (!usuarioSnap.exists()) {
    throw new Error(
      "No se encontró tu usuario en Firestore."
    );
  }

  const usuario = usuarioSnap.data();

  if (usuario.activo !== true) {
    throw new Error("Tu usuario está inactivo.");
  }

  if (usuario.rol !== "administrador") {
    throw new Error(
      "Solo el Administrador puede configurar el QR."
    );
  }

  if (!usuario.laboratorioId) {
    throw new Error(
      "Tu usuario no tiene laboratorio asignado."
    );
  }

  return {
    uid: usuarioFirebase.uid,
    laboratorioId: usuario.laboratorioId,
  };
}

// =====================================================
// OBTENER LABORATORIO
// =====================================================

async function obtenerDocumentoLaboratorio() {
  const administrador =
    await obtenerAdministradorActual();

  const laboratorioRef = doc(
    db,
    "laboratorios",
    administrador.laboratorioId
  );

  const laboratorioSnap = await getDoc(
    laboratorioRef
  );

  if (!laboratorioSnap.exists()) {
    throw new Error(
      "No se encontró el laboratorio."
    );
  }

  return {
    administrador,
    laboratorioRef,
    laboratorio: laboratorioSnap.data(),
  };
}

// =====================================================
// OBTENER CONFIGURACIÓN QR
// =====================================================

export async function obtenerConfiguracionQR() {
  const {
    administrador,
    laboratorio,
  } = await obtenerDocumentoLaboratorio();

  return {
    laboratorioId: administrador.laboratorioId,

    nombre:
      laboratorio.nombreVisible ||
      laboratorio.nombre ||
      "Laboratorio Clínico",

    qrUrl:
      laboratorio.configuracionPagos?.imagenURL ||
      laboratorio.configuracionPagos?.qrUrl ||
      "",
  };
}

// =====================================================
// CONVERTIR ARCHIVO A IMAGEN
// =====================================================

function cargarImagen(archivo) {
  return new Promise((resolve, reject) => {
    const urlTemporal = URL.createObjectURL(archivo);

    const imagen = new Image();

    imagen.onload = () => {
      URL.revokeObjectURL(urlTemporal);
      resolve(imagen);
    };

    imagen.onerror = () => {
      URL.revokeObjectURL(urlTemporal);

      reject(
        new Error(
          "No se pudo leer la imagen seleccionada."
        )
      );
    };

    imagen.src = urlTemporal;
  });
}

// =====================================================
// CONVERTIR IMAGEN A BASE64
// =====================================================

async function convertirImagenABase64(archivo) {
  if (!archivo) {
    throw new Error(
      "Selecciona una imagen QR."
    );
  }

  if (
    !["image/png", "image/jpeg"].includes(
      archivo.type
    )
  ) {
    throw new Error(
      "Solo se permiten imágenes PNG o JPG."
    );
  }

  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    throw new Error(
      "La imagen no puede superar los 5 MB."
    );
  }

  const imagen = await cargarImagen(archivo);

  // Mantener proporción original.
  const dimensionMaxima = 450;

  const escala = Math.min(
    1,
    dimensionMaxima / Math.max(
      imagen.width,
      imagen.height
    )
  );

  const ancho = Math.max(
    1,
    Math.round(imagen.width * escala)
  );

  const alto = Math.max(
    1,
    Math.round(imagen.height * escala)
  );

  const canvas = document.createElement("canvas");

  canvas.width = ancho;
  canvas.height = alto;

  const contexto = canvas.getContext("2d");

  if (!contexto) {
    throw new Error(
      "No se pudo procesar la imagen."
    );
  }

  // Fondo blanco para mantener la legibilidad.
  contexto.fillStyle = "#FFFFFF";

  contexto.fillRect(
    0,
    0,
    ancho,
    alto
  );

  // Evitar suavizado excesivo en los QR.
  contexto.imageSmoothingEnabled = false;

  contexto.drawImage(
    imagen,
    0,
    0,
    ancho,
    alto
  );

  // PNG evita artefactos JPEG en los módulos QR.
  const imagenBase64 = canvas.toDataURL(
    "image/png"
  );

  if (
    imagenBase64.length > TAMANO_MAXIMO_BASE64
  ) {
    throw new Error(
      "La imagen QR es demasiado grande. " +
      "Selecciona un QR más sencillo o una imagen más pequeña."
    );
  }

  return imagenBase64;
}

// =====================================================
// GUARDAR IMAGEN EN FIRESTORE
// =====================================================

export async function guardarImagenQR(archivo) {
  const imagenBase64 =
    await convertirImagenABase64(archivo);

  const {
    laboratorioRef,
  } = await obtenerDocumentoLaboratorio();

  await updateDoc(laboratorioRef, {
    "configuracionPagos.imagenURL": imagenBase64,
    "configuracionPagos.qrUrl": imagenBase64,
  });

  return imagenBase64;
}

// =====================================================
// ELIMINAR IMAGEN QR
// =====================================================

export async function eliminarImagenQR() {
  const {
    laboratorioRef,
  } = await obtenerDocumentoLaboratorio();

  await updateDoc(laboratorioRef, {
    "configuracionPagos.imagenURL": "",
    "configuracionPagos.qrUrl": "",
  });

  return true;
} 