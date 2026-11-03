import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

const COLECCION_ORDENES = "ordenes";
const COLECCION_SOLICITUDES = "solicitudes";
const COLECCION_MUESTRAS = "muestras";
const COLECCION_NUEVAS_TOMAS = "solicitudesNuevaToma";

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function normalizarEstado(valor) {
  return limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fechaMilisegundos(fecha) {
  if (!fecha) return 0;

  if (typeof fecha.toMillis === "function") {
    return fecha.toMillis();
  }

  if (typeof fecha.seconds === "number") {
    return fecha.seconds * 1000;
  }

  if (fecha instanceof Date) {
    return fecha.getTime();
  }

  const fechaConvertida = new Date(fecha);

  return Number.isNaN(fechaConvertida.getTime())
    ? 0
    : fechaConvertida.getTime();
}

function normalizarAnalisis(valor) {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const analisisId = limpiarTexto(
        item.analisisId || item.id
      );

      if (!analisisId) {
        return null;
      }

      const precio = Number(item.precio || 0);
      const cantidad = Math.max(
        1,
        Number(item.cantidad || 1)
      );

      return {
        analisisId,
        nombre:
          limpiarTexto(item.nombre) ||
          "Análisis",
        precio: Number.isFinite(precio)
          ? precio
          : 0,
        cantidad: Number.isFinite(cantidad)
          ? cantidad
          : 1,
        subtotal:
          Number(item.subtotal) ||
          precio * cantidad,
      };
    })
    .filter(Boolean);
}

function convertirMuestra(documento) {
  const datos = documento.data();

  return {
    ...datos,
    id: documento.id,
    muestraId:
      limpiarTexto(datos.muestraId) ||
      documento.id,
    laboratorioId: limpiarTexto(
      datos.laboratorioId
    ),
    solicitudId: limpiarTexto(
      datos.solicitudId
    ),
    ordenId: limpiarTexto(datos.ordenId),
    pacienteId: limpiarTexto(
      datos.pacienteId
    ),
    analisisId: limpiarTexto(
      datos.analisisId
    ),
    analisisNombre:
      limpiarTexto(datos.analisisNombre) ||
      "Análisis",
    bioquimicoId: limpiarTexto(
      datos.bioquimicoId
    ),
    tipo:
      limpiarTexto(datos.tipo) ||
      limpiarTexto(datos.tipoMuestra),
    codigoEtiqueta: limpiarTexto(
      datos.codigoEtiqueta
    ),
    estado:
      limpiarTexto(datos.estado) ||
      "tomada",
    estadoValidacion:
      limpiarTexto(datos.estadoValidacion) ||
      "pendiente",
    aceptada: datos.aceptada === true,
    motivoRechazo: limpiarTexto(
      datos.motivoRechazo
    ),
    fechaToma: datos.fechaToma || null,
    fechaRegistro:
      datos.fechaRegistro || null,
    esNuevaToma: datos.esNuevaToma === true,
    muestraOriginalId: limpiarTexto(
      datos.muestraOriginalId
    ),
    solicitudNuevaTomaId: limpiarTexto(
      datos.solicitudNuevaTomaId
    ),
  };
}

async function obtenerUsuarioAutenticado() {
  const usuarioFirebase = getAuth().currentUser;

  if (!usuarioFirebase) {
    throw new Error(
      "Tu sesión ha expirado. Inicia sesión nuevamente."
    );
  }

  const referencia = doc(
    db,
    "usuarios",
    usuarioFirebase.uid
  );

  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error(
      "No se encontró tu usuario en el sistema."
    );
  }

  const datos = documento.data();

  if (datos.activo !== true) {
    throw new Error(
      "Tu usuario se encuentra inactivo."
    );
  }

  return {
    uid: usuarioFirebase.uid,
    rol: normalizarEstado(datos.rol),
    laboratorioId: limpiarTexto(
      datos.laboratorioId
    ),
  };
}

async function validarAccesoLaboratorio(
  laboratorioId,
  rolesPermitidos = [
    "administrador",
    "recepcionista",
    "bioquimico",
  ]
) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }

  const usuario =
    await obtenerUsuarioAutenticado();

  if (
    usuario.laboratorioId !== idLaboratorio
  ) {
    throw new Error(
      "No tienes autorización para acceder a este laboratorio."
    );
  }

  if (
    !rolesPermitidos.includes(usuario.rol)
  ) {
    throw new Error(
      "No tienes permisos para realizar esta operación."
    );
  }

  return usuario;
}

async function completarOrdenConSolicitud(
  documento,
  laboratorioId
) {
  const datosOrden = documento.data();

  const solicitudId = limpiarTexto(
    datosOrden.solicitudId
  );

  let datosSolicitud = null;

  if (solicitudId) {
    try {
      const solicitudDocumento = await getDoc(
        doc(
          db,
          COLECCION_SOLICITUDES,
          solicitudId
        )
      );

      if (solicitudDocumento.exists()) {
        const datos = solicitudDocumento.data();

        if (
          limpiarTexto(datos.laboratorioId) ===
          laboratorioId
        ) {
          datosSolicitud = datos;
        }
      }
    } catch (error) {
      console.warn(
        "No se pudo consultar la solicitud:",
        error
      );
    }
  }

  const analisisOrden = normalizarAnalisis(
    datosOrden.analisis
  );

  const analisisSolicitud = normalizarAnalisis(
    datosSolicitud?.analisis
  );

  return {
    id: documento.id,
    ordenId:
      limpiarTexto(datosOrden.ordenId) ||
      documento.id,
    ventaId: limpiarTexto(
      datosOrden.ventaId
    ),
    solicitudId,
    laboratorioId: limpiarTexto(
      datosOrden.laboratorioId
    ),
    pacienteId:
      limpiarTexto(datosOrden.pacienteId) ||
      limpiarTexto(datosSolicitud?.pacienteId),
    empleadoId:
      limpiarTexto(datosOrden.empleadoId) ||
      limpiarTexto(datosSolicitud?.empleadoId),
    fecha:
      datosOrden.fecha ||
      datosSolicitud?.fecha ||
      null,
    estado:
      limpiarTexto(datosOrden.estado) ||
      "generada",
    total: Number(
      datosOrden.total ??
        datosSolicitud?.total ??
        0
    ),
    analisis:
      analisisOrden.length > 0
        ? analisisOrden
        : analisisSolicitud,
  };
}

export async function obtenerOrdenesParaMuestras(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idLaboratorio) {
    return [];
  }

  await validarAccesoLaboratorio(
    idLaboratorio
  );

  const consulta = query(
    collection(db, COLECCION_ORDENES),
    where(
      "laboratorioId",
      "==",
      idLaboratorio
    )
  );

  const resultado = await getDocs(consulta);

  const ordenes = await Promise.all(
    resultado.docs.map((documento) =>
      completarOrdenConSolicitud(
        documento,
        idLaboratorio
      )
    )
  );

  return ordenes
    .filter(
      (orden) =>
        orden.laboratorioId ===
        idLaboratorio
    )
    .sort(
      (a, b) =>
        fechaMilisegundos(b.fecha) -
        fechaMilisegundos(a.fecha)
    );
}

export async function obtenerMuestras(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idLaboratorio) {
    return [];
  }

  await validarAccesoLaboratorio(
    idLaboratorio
  );

  const consulta = query(
    collection(db, COLECCION_MUESTRAS),
    where(
      "laboratorioId",
      "==",
      idLaboratorio
    )
  );

  const resultado = await getDocs(consulta);

  return resultado.docs
    .map(convertirMuestra)
    .sort(
      (a, b) =>
        fechaMilisegundos(b.fechaToma) -
        fechaMilisegundos(a.fechaToma)
    );
}

export async function obtenerSolicitudesNuevaToma(
  laboratorioId
) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  if (!idLaboratorio) {
    return [];
  }

  await validarAccesoLaboratorio(
    idLaboratorio
  );

  const consulta = query(
    collection(
      db,
      COLECCION_NUEVAS_TOMAS
    ),
    where(
      "laboratorioId",
      "==",
      idLaboratorio
    )
  );

  const resultado = await getDocs(consulta);

  return resultado.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  }));
}

function solicitudEstaPendiente(solicitud) {
  const estado = normalizarEstado(
    solicitud?.estado
  );

  return [
    "pendiente",
    "solicitada",
    "reanudada",
    "nueva_toma_solicitada",
  ].includes(estado);
}

function esMuestraRechazada(muestra) {
  return (
    normalizarEstado(muestra?.estado) ===
      "rechazada" ||
    normalizarEstado(
      muestra?.estadoValidacion
    ) === "rechazada"
  );
}

function generarCodigoEtiqueta() {
  const fecha = Date.now()
    .toString()
    .slice(-8);

  const aleatorio = Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase();

  return `MUE-${fecha}-${aleatorio}`;
}

export async function registrarMuestra({
  laboratorioId,
  bioquimicoId,
  ordenId,
  analisisId,
  tipo,
  solicitudNuevaTomaId = "",
}) {
  const idLaboratorio = limpiarTexto(
    laboratorioId
  );

  const idBioquimico = limpiarTexto(
    bioquimicoId
  );

  const idOrden = limpiarTexto(ordenId);

  const idAnalisis = limpiarTexto(
    analisisId
  );

  const tipoMuestra = limpiarTexto(tipo);

  const idNuevaToma = limpiarTexto(
    solicitudNuevaTomaId
  );

  if (
    !idLaboratorio ||
    !idBioquimico ||
    !idOrden ||
    !idAnalisis ||
    !tipoMuestra
  ) {
    throw new Error(
      "Debes completar todos los datos de la muestra."
    );
  }

  const usuario =
    await validarAccesoLaboratorio(
      idLaboratorio,
      ["bioquimico"]
    );

  if (usuario.uid !== idBioquimico) {
    throw new Error(
      "El Bioquímico no coincide con la sesión actual."
    );
  }

  const ordenReferencia = doc(
    db,
    COLECCION_ORDENES,
    idOrden
  );

  const ordenDocumento = await getDoc(
    ordenReferencia
  );

  if (!ordenDocumento.exists()) {
    throw new Error(
      "La orden seleccionada no existe."
    );
  }

  const orden =
    await completarOrdenConSolicitud(
      ordenDocumento,
      idLaboratorio
    );

  if (
    orden.laboratorioId !== idLaboratorio
  ) {
    throw new Error(
      "La orden pertenece a otro laboratorio."
    );
  }

  if (!orden.pacienteId) {
    throw new Error(
      "La orden no tiene un paciente asociado."
    );
  }

  const analisis = orden.analisis.find(
    (item) =>
      limpiarTexto(item.analisisId) ===
      idAnalisis
  );

  if (!analisis) {
    throw new Error(
      "El análisis no pertenece a la orden."
    );
  }

  const muestrasActuales =
    await obtenerMuestras(idLaboratorio);

  const muestrasDelAnalisis =
    muestrasActuales.filter(
      (muestra) =>
        limpiarTexto(muestra.ordenId) ===
          idOrden &&
        limpiarTexto(muestra.analisisId) ===
          idAnalisis
    );

  const muestrasVigentes =
    muestrasDelAnalisis.filter(
      (muestra) =>
        !esMuestraRechazada(muestra)
    );

  if (muestrasVigentes.length > 0) {
    throw new Error(
      "Ya existe una muestra vigente para este análisis."
    );
  }

  const rechazadas =
    muestrasDelAnalisis.filter(
      esMuestraRechazada
    );

  const esRepeticion =
    rechazadas.length > 0;

  let solicitudNuevaToma = null;

  if (esRepeticion) {
    if (!idNuevaToma) {
      throw new Error(
        "Esta muestra fue rechazada. Debes seleccionar una solicitud de nueva toma autorizada por Recepción."
      );
    }

    const referenciaSolicitud = doc(
      db,
      COLECCION_NUEVAS_TOMAS,
      idNuevaToma
    );

    const documentoSolicitud = await getDoc(
      referenciaSolicitud
    );

    if (!documentoSolicitud.exists()) {
      throw new Error(
        "No existe la solicitud de nueva toma."
      );
    }

    solicitudNuevaToma = {
      id: documentoSolicitud.id,
      ...documentoSolicitud.data(),
    };

    if (
      limpiarTexto(
        solicitudNuevaToma.laboratorioId
      ) !== idLaboratorio ||
      limpiarTexto(
        solicitudNuevaToma.ordenId
      ) !== idOrden ||
      limpiarTexto(
        solicitudNuevaToma.analisisId
      ) !== idAnalisis ||
      !solicitudEstaPendiente(
        solicitudNuevaToma
      )
    ) {
      throw new Error(
        "La solicitud de nueva toma no está pendiente o no corresponde a esta orden."
      );
    }
  } else if (idNuevaToma) {
    throw new Error(
      "No se puede utilizar una solicitud de repetición para una primera toma."
    );
  }

  const referencia = doc(
    collection(db, COLECCION_MUESTRAS)
  );

  const codigoEtiqueta =
    generarCodigoEtiqueta();

  const muestraOriginal =
    rechazadas
      .slice()
      .sort(
        (a, b) =>
          fechaMilisegundos(b.fechaToma) -
          fechaMilisegundos(a.fechaToma)
      )[0] || null;

  const datosNuevaMuestra = {
    muestraId: referencia.id,
    laboratorioId: idLaboratorio,
    solicitudId: orden.solicitudId,
    ordenId: idOrden,
    pacienteId: orden.pacienteId,
    analisisId: idAnalisis,
    analisisNombre: analisis.nombre,
    bioquimicoId: usuario.uid,
    registradoPor: usuario.uid,
    tipo: tipoMuestra,
    tipoMuestra,
    codigoEtiqueta,
    estado: "tomada",
    estadoValidacion: "pendiente",
    aceptada: false,
    motivoRechazo: "",
    esNuevaToma: esRepeticion,
    muestraOriginalId:
      muestraOriginal?.id || "",
    solicitudNuevaTomaId:
      idNuevaToma,
    fechaToma: serverTimestamp(),
    fechaRegistro: serverTimestamp(),
  };

  if (esRepeticion) {
    const solicitudReferencia = doc(
      db,
      COLECCION_NUEVAS_TOMAS,
      idNuevaToma
    );

    await runTransaction(
      db,
      async (transaccion) => {
        const solicitudActual =
          await transaccion.get(
            solicitudReferencia
          );

        if (
          !solicitudActual.exists() ||
          !solicitudEstaPendiente(
            solicitudActual.data()
          )
        ) {
          throw new Error(
            "La nueva toma ya fue atendida o cancelada."
          );
        }

        const datosSolicitud =
          solicitudActual.data();

        if (
          limpiarTexto(
            datosSolicitud.laboratorioId
          ) !== idLaboratorio ||
          limpiarTexto(
            datosSolicitud.ordenId
          ) !== idOrden ||
          limpiarTexto(
            datosSolicitud.analisisId
          ) !== idAnalisis
        ) {
          throw new Error(
            "La solicitud no corresponde al análisis."
          );
        }

        transaccion.set(
          referencia,
          datosNuevaMuestra
        );

        transaccion.update(
          solicitudReferencia,
          {
            estado: "completada",
            nuevaMuestraId: referencia.id,
            atendidoPor: usuario.uid,
            fechaAtencion:
              serverTimestamp(),
          }
        );
      }
    );
  } else {
    await setDoc(
      referencia,
      datosNuevaMuestra
    );
  }

  const creada = await getDoc(
    referencia
  );

  if (!creada.exists()) {
    throw new Error(
      "La muestra se registró, pero no pudo recuperarse."
    );
  }

  return convertirMuestra(creada);
}