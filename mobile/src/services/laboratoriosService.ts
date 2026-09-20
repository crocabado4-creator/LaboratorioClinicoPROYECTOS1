import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export type Laboratorio = {
  id: string;
  laboratorioId?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl?: string;
  activo: boolean;
};

export const obtenerLaboratorios =
  async (): Promise<Laboratorio[]> => {
    const resultado =
      await getDocs(
        collection(
          db,
          "laboratorios"
        )
      );

    return resultado.docs.map(
      (documento) => ({
        id: documento.id,
        ...(documento.data() as Omit<
          Laboratorio,
          "id"
        >),
      })
    );
  };

export const crearLaboratorio =
  async (datos: {
    nombre: string;
    direccion: string;
    telefono: string;
    email: string;
  }) => {
    const referencia = doc(
      collection(
        db,
        "laboratorios"
      )
    );

    await setDoc(
      referencia,
      {
        laboratorioId:
          referencia.id,

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

        logoUrl: "",

        activo: true,

        fechaRegistro:
          serverTimestamp(),
      }
    );
  };

export const actualizarLaboratorio =
  async (
    laboratorioId: string,
    datos: {
      nombre: string;
      direccion: string;
      telefono: string;
      email: string;
    }
  ) => {
    await updateDoc(
      doc(
        db,
        "laboratorios",
        laboratorioId
      ),
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
  };

export const cambiarEstadoLaboratorio =
  async (
    laboratorioId: string,
    activo: boolean
  ) => {
    await updateDoc(
      doc(
        db,
        "laboratorios",
        laboratorioId
      ),
      {
        activo,
      }
    );
  };