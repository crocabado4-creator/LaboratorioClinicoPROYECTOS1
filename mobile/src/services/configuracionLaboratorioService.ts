import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

export type ConfiguracionLaboratorio = {
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
};

export type DatosConfiguracionLaboratorio = {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
};

function limpiarTexto(
  valor: unknown
): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}

function correoValido(
  correo: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    correo
  );
}

function telefonoValido(
  telefono: string
): boolean {
  return /^[0-9+\-\s()]{6,20}$/.test(
    telefono
  );
}

async function validarAdministradorActual() {
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
      "La cuenta autenticada no existe en el sistema."
    );
  }

  const datos =
    usuarioSnap.data();

  if (
    datos.activo !== true
  ) {
    throw new Error(
      "Tu cuenta se encuentra inactiva."
    );
  }

  if (
    datos.rol !==
    "administrador"
  ) {
    throw new Error(
      "Solo el Administrador del Laboratorio puede acceder a esta configuración."
    );
  }

  const laboratorioId =
    limpiarTexto(
      datos.laboratorioId
    );

  if (!laboratorioId) {
    throw new Error(
      "Tu cuenta no tiene un laboratorio asociado."
    );
  }

  return {
    uid:
      firebaseUser.uid,

    laboratorioId,
  };
}

export async function obtenerConfiguracionLaboratorio(): Promise<ConfiguracionLaboratorio> {
  const administrador =
    await validarAdministradorActual();

  const laboratorioRef = doc(
    db,
    "laboratorios",
    administrador.laboratorioId
  );

  const laboratorioSnap =
    await getDoc(
      laboratorioRef
    );

  if (!laboratorioSnap.exists()) {
    throw new Error(
      "No se encontró el laboratorio asociado a tu cuenta."
    );
  }

  const datos =
    laboratorioSnap.data();

  return {
    id:
      laboratorioSnap.id,

    laboratorioId:
      limpiarTexto(
        datos.laboratorioId
      ) ||
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

    logoUrl:
      limpiarTexto(
        datos.logoUrl
      ),

    nombreVisible:
      limpiarTexto(
        datos.nombreVisible
      ),

    colorPrimario:
      limpiarTexto(
        datos.colorPrimario
      ) ||
      "#2563EB",

    colorSecundario:
      limpiarTexto(
        datos.colorSecundario
      ) ||
      "#14B8A6",

    activo:
      datos.activo === true,
  };
}

export async function actualizarConfiguracionLaboratorio(
  datos: DatosConfiguracionLaboratorio
): Promise<void> {
  const administrador =
    await validarAdministradorActual();

  const nombre =
    limpiarTexto(
      datos.nombre
    );

  const direccion =
    limpiarTexto(
      datos.direccion
    );

  const telefono =
    limpiarTexto(
      datos.telefono
    );

  const email =
    limpiarTexto(
      datos.email
    ).toLowerCase();

  if (
    nombre.length < 2
  ) {
    throw new Error(
      "Ingresa un nombre válido para el laboratorio."
    );
  }

  if (
    direccion.length < 4
  ) {
    throw new Error(
      "Ingresa una dirección válida."
    );
  }

  if (
    !telefonoValido(
      telefono
    )
  ) {
    throw new Error(
      "Ingresa un número de teléfono válido."
    );
  }

  if (
    !correoValido(
      email
    )
  ) {
    throw new Error(
      "Ingresa un correo electrónico válido."
    );
  }

  const laboratorioRef = doc(
    db,
    "laboratorios",
    administrador.laboratorioId
  );

  const laboratorioSnap =
    await getDoc(
      laboratorioRef
    );

  if (!laboratorioSnap.exists()) {
    throw new Error(
      "El laboratorio asociado no existe."
    );
  }

  if (
    laboratorioSnap.data().activo !==
    true
  ) {
    throw new Error(
      "El laboratorio se encuentra inactivo."
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
}