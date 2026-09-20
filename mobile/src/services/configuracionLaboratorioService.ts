import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

export type ConfiguracionLaboratorio = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
  activo: boolean;
};

export const obtenerLaboratorio =
  async (
    laboratorioId: string
  ): Promise<ConfiguracionLaboratorio | null> => {
    if (
      !laboratorioId ||
      laboratorioId.trim() === ""
    ) {
      throw new Error(
        "laboratorioId vacío"
      );
    }

    const referencia = doc(
      db,
      "laboratorios",
      laboratorioId
    );

    const resultado =
      await getDoc(referencia);

    if (!resultado.exists()) {
      throw new Error(
        `No existe laboratorios/${laboratorioId}`
      );
    }

    const datos =
      resultado.data();

    return {
      id: resultado.id,

      nombre:
        typeof datos.nombre === "string"
          ? datos.nombre
          : "",

      direccion:
        typeof datos.direccion === "string"
          ? datos.direccion
          : "",

      telefono:
        typeof datos.telefono === "string"
          ? datos.telefono
          : "",

      email:
        typeof datos.email === "string"
          ? datos.email
          : "",

      logoUrl:
        typeof datos.logoUrl === "string"
          ? datos.logoUrl
          : "",

      activo:
        datos.activo === true,
    };
  };


export const actualizarConfiguracionLaboratorio =
  async (
    laboratorioId: string,
    datos: {
      nombre: string;
      direccion: string;
      telefono: string;
      email: string;
    }
  ): Promise<void> => {
    if (
      !laboratorioId ||
      laboratorioId.trim() === ""
    ) {
      throw new Error(
        "laboratorioId vacío"
      );
    }

    const referencia = doc(
      db,
      "laboratorios",
      laboratorioId
    );

    const resultado =
      await getDoc(referencia);

    if (!resultado.exists()) {
      throw new Error(
        `No existe el laboratorio ${laboratorioId}`
      );
    }

    await updateDoc(
      referencia,
      {
        nombre:
          datos.nombre.trim(),

        direccion:
          datos.direccion.trim(),

        telefono:
          datos.telefono.trim(),

        email:
          datos.email
            .trim()
            .toLowerCase(),
      }
    );

    console.log(
      "CAMBIOS GUARDADOS EN:",
      `laboratorios/${laboratorioId}`
    );
  };