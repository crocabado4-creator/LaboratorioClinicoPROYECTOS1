import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
} from "firebase/auth";

import {
  db,
} from "../firebase/firebase";

function limpiar(valor) {
  return String(valor ?? "").trim();
}

export async function registrarEventoSprint3({
  laboratorioId,
  accion,
  entidad,
  entidadId = "",
  detalle = "",
  notificarAdministrador = true,
}) {
  const usuario =
    getAuth().currentUser;

  const idLaboratorio =
    limpiar(laboratorioId);

  if (
    !usuario ||
    !idLaboratorio ||
    !accion
  ) {
    return;
  }

  let usuarioNombre =
    limpiar(
      usuario.displayName
    ) ||
    limpiar(usuario.email) ||
    usuario.uid;

  try {
    const perfil =
      await getDoc(
        doc(
          db,
          "usuarios",
          usuario.uid
        )
      );

    if (perfil.exists()) {
      const datos =
        perfil.data();

      usuarioNombre =
        `${limpiar(
          datos.nombre
        )} ${limpiar(
          datos.apellido
        )}`.trim() ||
        limpiar(
          datos.email
        ) ||
        usuarioNombre;
    }
  } catch (error) {
    console.warn(
      "No se pudo cargar el nombre para auditoría:",
      error
    );
  }

  try {
    await addDoc(
      collection(
        db,
        "auditoria"
      ),
      {
        laboratorioId:
          idLaboratorio,
        usuarioId:
          usuario.uid,
        usuarioNombre,
        accion:
          limpiar(accion),
        entidad:
          limpiar(entidad),
        entidadId:
          limpiar(entidadId),
        detalle:
          limpiar(detalle),
        fecha:
          serverTimestamp(),
      }
    );
  } catch (error) {
    console.warn(
      "No se pudo registrar la auditoría:",
      error
    );
  }

  if (
    !notificarAdministrador
  ) {
    return;
  }

  try {
    await addDoc(
      collection(
        db,
        "notificaciones"
      ),
      {
        laboratorioId:
          idLaboratorio,
        usuarioId: "",
        rolDestino:
          "administrador",
        titulo:
          limpiar(accion),
        mensaje:
          limpiar(detalle) ||
          `${limpiar(
            accion
          )} - ${limpiar(
            entidad
          )}`,
        entidad:
          limpiar(entidad),
        entidadId:
          limpiar(entidadId),
        generadoPor:
          usuario.uid,
        generadoPorNombre:
          usuarioNombre,
        leida: false,
        fecha:
          serverTimestamp(),
      }
    );
  } catch (error) {
    console.warn(
      "No se pudo generar la notificación:",
      error
    );
  }
}
