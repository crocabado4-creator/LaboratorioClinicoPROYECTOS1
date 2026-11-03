import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// ============================================================
// UTILIDADES
// ============================================================

function limpiar(valor) {
  return String(valor ?? "").trim();
}

function fechaMs(valor) {
  if (!valor) {
    return 0;
  }

  if (typeof valor?.toMillis === "function") {
    return valor.toMillis();
  }

  if (typeof valor?.toDate === "function") {
    return valor.toDate().getTime();
  }

  if (typeof valor?.seconds === "number") {
    return valor.seconds * 1000;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? 0
    : fecha.getTime();
}

// ============================================================
// CONSULTAR COLECCIONES
// ============================================================

async function listar(coleccionNombre, laboratorioId) {
  const snapshot = await getDocs(
    query(
      collection(db, coleccionNombre),
      where("laboratorioId", "==", laboratorioId)
    )
  );

  return snapshot.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));
}

// ============================================================
// EXTRAER PARÁMETROS Y RANGOS REALES
// ============================================================

function extraerParametrosYRangos(analisis) {
  const parametros = [];
  const rangos = [];

  for (const item of analisis) {
    const analisisId = limpiar(item.id);

    const listaParametros = Array.isArray(item.parametros)
      ? item.parametros
      : [];

    for (const parametro of listaParametros) {
      if (!parametro || typeof parametro !== "object") {
        continue;
      }

      const parametroId = limpiar(
        parametro.parametroId ?? parametro.id
      );

      if (!parametroId) {
        continue;
      }

      parametros.push({
        ...parametro,
        id: parametroId,
        parametroId,
        analisisId,
      });

      const referencia = parametro.rangoReferencia;

      if (
        referencia &&
        typeof referencia === "object" &&
        !Array.isArray(referencia)
      ) {
        rangos.push({
          ...referencia,
          id: `${analisisId}-${parametroId}`,
          analisisId,
          parametroId,
        });
      }
    }
  }

  return {
    parametros,
    rangos,
  };
}

// ============================================================
// OBTENER LABORATORIO
// ============================================================

export async function obtenerLaboratorioAdmin(
  laboratorioId
) {
  const id = limpiar(laboratorioId);

  if (!id) {
    return null;
  }

  const snapshot = await getDoc(
    doc(db, "laboratorios", id)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...snapshot.data(),
    id: snapshot.id,
  };
}

// ============================================================
// DASHBOARD DEL LABORATORIO
// ============================================================

export async function cargarDashboardLaboratorio(
  laboratorioId
) {
  const id = limpiar(laboratorioId);

  if (!id) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const [
    pacientes,
    analisis,
    ventas,
    ordenes,
    resultados,
    muestras,
  ] = await Promise.all([
    listar("pacientes", id),
    listar("analisis", id),
    listar("ventas", id),
    listar("ordenes", id),
    listar("resultados", id),
    listar("muestras", id),
  ]);

  const totalVentas = ventas.reduce(
    (total, venta) =>
      total + Number(venta.total || 0),
    0
  );

  const finalizados = resultados.filter(
    (resultado) =>
      resultado.validado === true ||
      resultado.estado === "validado" ||
      resultado.estado === "finalizado"
  ).length;

  return {
    pacientes: pacientes.length,
    analisis: analisis.length,
    ventas: ventas.length,
    totalVentas,
    ordenes: ordenes.length,
    resultados: resultados.length,
    resultadosFinalizados: finalizados,
    resultadosPendientes:
      resultados.length - finalizados,

    muestrasPendientes: muestras.filter(
      (muestra) =>
        [
          "tomada",
          "aceptada",
          "en_proceso",
        ].includes(limpiar(muestra.estado))
    ).length,

    ordenesRecientes: [...ordenes]
      .sort(
        (a, b) =>
          fechaMs(
            b.fecha ??
              b.fechaRegistro ??
              b.fechaCreacion
          ) -
          fechaMs(
            a.fecha ??
              a.fechaRegistro ??
              a.fechaCreacion
          )
      )
      .slice(0, 5),
  };
}

// ============================================================
// REPORTES DEL LABORATORIO
// ============================================================

export async function cargarReportesLaboratorio(
  laboratorioId
) {
  const id = limpiar(laboratorioId);

  if (!id) {
    throw new Error(
      "No se identificó el laboratorio."
    );
  }

  const [
    pacientes,
    analisis,
    ventas,
    ordenes,
    resultados,
  ] = await Promise.all([
    listar("pacientes", id),
    listar("analisis", id),
    listar("ventas", id),
    listar("ordenes", id),
    listar("resultados", id),
  ]);

  const configuraciones =
    extraerParametrosYRangos(analisis);

  return {
    pacientes,
    analisis,
    ventas,
    ordenes,
    resultados,
    parametros: configuraciones.parametros,
    rangos: configuraciones.rangos,
  };
}

// ============================================================
// NOTIFICACIONES DEL LABORATORIO
// ============================================================

export async function listarNotificacionesLaboratorio(
  laboratorioId
) {
  const id = limpiar(laboratorioId);

  if (!id) {
    return [];
  }

  const lista = await listar(
    "notificaciones",
    id
  );

  return lista.sort(
    (a, b) =>
      fechaMs(
        b.fecha ?? b.fechaRegistro
      ) -
      fechaMs(
        a.fecha ?? a.fechaRegistro
      )
  );
}

// ============================================================
// MARCAR NOTIFICACIÓN COMO LEÍDA
// ============================================================

export async function marcarNotificacionLeida(
  notificacionId
) {
  if (!notificacionId) {
    return;
  }

  await updateDoc(
    doc(
      db,
      "notificaciones",
      notificacionId
    ),
    {
      leida: true,
      fechaLectura: serverTimestamp(),
    }
  );
}

// ============================================================
// AUDITORÍA DEL LABORATORIO
// ============================================================

export async function listarAuditoriaLaboratorio(
  laboratorioId
) {
  const id = limpiar(laboratorioId);

  if (!id) {
    return [];
  }

  const lista = await listar(
    "auditoria",
    id
  );

  return lista.sort(
    (a, b) =>
      fechaMs(
        b.fecha ?? b.fechaRegistro
      ) -
      fechaMs(
        a.fecha ?? a.fechaRegistro
      )
  );
}