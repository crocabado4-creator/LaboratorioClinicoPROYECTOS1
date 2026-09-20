import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

export type PersonalizacionLaboratorio = {
  id: string;
  nombre: string;
  logoUrl: string;
};

export const obtenerPersonalizacion =
  async (
    laboratorioId: string
  ): Promise<PersonalizacionLaboratorio | null> => {
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
      return null;
    }

    const datos =
      resultado.data();

    return {
      id: resultado.id,

      nombre:
        typeof datos.nombre === "string"
          ? datos.nombre
          : "",

      logoUrl:
        typeof datos.logoUrl === "string"
          ? datos.logoUrl
          : "",
    };
  };


export const actualizarPersonalizacion =
  async (
    laboratorioId: string,
    datos: {
      nombre: string;
      logoUrl: string;
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

    await updateDoc(
      referencia,
      {
        nombre:
          datos.nombre.trim(),

        logoUrl:
          datos.logoUrl.trim(),
      }
    );
  };