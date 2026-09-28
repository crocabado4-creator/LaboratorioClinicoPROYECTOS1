import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


export type AnalisisSolicitudHistorial = {
  analisisId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};


export type SolicitudHistorial = {
  id: string;
  solicitudId: string;
  pacienteId: string;
  laboratorioId: string;
  empleadoId: string;
  fecha: unknown;
  estado: string;
  total: number;
  analisis: AnalisisSolicitudHistorial[];
};


export type ValorResultadoHistorial = {
  parametroId: string;
  nombre: string;
  valor: string;
  unidad: string;
  rangoReferencia?: unknown;
};


export type ResultadoHistorial = {
  id: string;
  resultadoId: string;
  solicitudId: string;
  pacienteId: string;
  laboratorioId: string;
  analisisId: string;
  analisisNombre: string;
  estado: string;
  observaciones: string;
  fechaRegistro: unknown;
  valores: ValorResultadoHistorial[];
};


export type HistorialPaciente = {
  solicitudes: SolicitudHistorial[];
  resultados: ResultadoHistorial[];
  totalAnalisis: number;
};


function limpiarTexto(
  valor: unknown
): string {
  return typeof valor === "string"
    ? valor.trim()
    : "";
}


function numeroSeguro(
  valor: unknown
): number {
  const numero =
    Number(valor);

  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
}


function fechaEnMilisegundos(
  valor: unknown
): number {
  if (!valor) {
    return 0;
  }

  if (
    typeof valor ===
      "object" &&
    valor !== null
  ) {
    const objeto =
      valor as {
        toMillis?: () => number;
        toDate?: () => Date;
        seconds?: number;
      };

    if (
      typeof objeto.toMillis ===
      "function"
    ) {
      return objeto.toMillis();
    }

    if (
      typeof objeto.toDate ===
      "function"
    ) {
      return objeto
        .toDate()
        .getTime();
    }

    if (
      typeof objeto.seconds ===
      "number"
    ) {
      return objeto.seconds *
        1000;
    }
  }

  if (
    typeof valor ===
    "string"
  ) {
    const fecha =
      new Date(valor);

    if (
      !Number.isNaN(
        fecha.getTime()
      )
    ) {
      return fecha.getTime();
    }
  }

  return 0;
}


function normalizarAnalisis(
  valor: unknown
): AnalisisSolicitudHistorial[] {
  if (
    !Array.isArray(
      valor
    )
  ) {
    return [];
  }

  return valor.map(
    (item) => {
      const datos =
        item &&
        typeof item ===
          "object"
          ? item as Record<
              string,
              unknown
            >
          : {};

      return {
        analisisId:
          limpiarTexto(
            datos.analisisId
          ),

        nombre:
          limpiarTexto(
            datos.nombre
          ) ||
          "Análisis clínico",

        precio:
          numeroSeguro(
            datos.precio
          ),

        cantidad:
          numeroSeguro(
            datos.cantidad
          ) || 1,

        subtotal:
          numeroSeguro(
            datos.subtotal
          ),
      };
    }
  );
}


function normalizarValores(
  valor: unknown
): ValorResultadoHistorial[] {
  if (
    !Array.isArray(
      valor
    )
  ) {
    return [];
  }

  return valor.map(
    (item) => {
      const datos =
        item &&
        typeof item ===
          "object"
          ? item as Record<
              string,
              unknown
            >
          : {};

      const valorResultado =
        datos.valor ??
        datos.resultado ??
        datos.valorObtenido ??
        "";

      return {
        parametroId:
          limpiarTexto(
            datos.parametroId
          ),

        nombre:
          limpiarTexto(
            datos.nombre
          ) ||
          limpiarTexto(
            datos.parametro
          ) ||
          "Parámetro",

        valor:
          valorResultado ===
          null ||
          valorResultado ===
          undefined
            ? ""
            : String(
                valorResultado
              ),

        unidad:
          limpiarTexto(
            datos.unidad
          ),

        rangoReferencia:
          datos.rangoReferencia,
      };
    }
  );
}


function crearMapaAnalisis(
  solicitudes:
    SolicitudHistorial[]
): Map<string, string> {
  const mapa =
    new Map<
      string,
      string
    >();

  solicitudes.forEach(
    (solicitud) => {
      solicitud.analisis.forEach(
        (analisis) => {
          if (
            analisis.analisisId &&
            analisis.nombre
          ) {
            mapa.set(
              analisis.analisisId,
              analisis.nombre
            );
          }
        }
      );
    }
  );

  return mapa;
}


export async function obtenerHistorialPaciente(
  laboratorioId: string,
  pacienteId: string
): Promise<HistorialPaciente> {
  const idLaboratorio =
    limpiarTexto(
      laboratorioId
    );

  const idPaciente =
    limpiarTexto(
      pacienteId
    );

  if (!idLaboratorio) {
    throw new Error(
      "No se pudo identificar el laboratorio."
    );
  }

  if (!idPaciente) {
    throw new Error(
      "No se pudo identificar el paciente."
    );
  }


  const consultaSolicitudes =
    query(
      collection(
        db,
        "solicitudes"
      ),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );


  const consultaResultados =
    query(
      collection(
        db,
        "resultado"
      ),
      where(
        "laboratorioId",
        "==",
        idLaboratorio
      )
    );


  const [
    solicitudesSnap,
    resultadosSnap,
  ] =
    await Promise.all([
      getDocs(
        consultaSolicitudes
      ),

      getDocs(
        consultaResultados
      ),
    ]);


  const solicitudes:
    SolicitudHistorial[] =
    solicitudesSnap.docs
      .filter(
        (
          item:
            QueryDocumentSnapshot<DocumentData>
        ) =>
          limpiarTexto(
            item.data()
              .pacienteId
          ) ===
          idPaciente
      )
      .map(
        (
          item:
            QueryDocumentSnapshot<DocumentData>
        ) => {
          const datos =
            item.data();

          return {
            id:
              item.id,

            solicitudId:
              limpiarTexto(
                datos.solicitudId
              ) ||
              item.id,

            pacienteId:
              limpiarTexto(
                datos.pacienteId
              ),

            laboratorioId:
              limpiarTexto(
                datos.laboratorioId
              ),

            empleadoId:
              limpiarTexto(
                datos.empleadoId
              ),

            fecha:
              datos.fecha ??
              datos.fechaRegistro ??
              null,

            estado:
              limpiarTexto(
                datos.estado
              ) ||
              "Sin estado",

            total:
              numeroSeguro(
                datos.total
              ),

            analisis:
              normalizarAnalisis(
                datos.analisis
              ),
          };
        }
      );


  solicitudes.sort(
    (a, b) =>
      fechaEnMilisegundos(
        b.fecha
      ) -
      fechaEnMilisegundos(
        a.fecha
      )
  );


  const mapaAnalisis =
    crearMapaAnalisis(
      solicitudes
    );


  const resultados:
    ResultadoHistorial[] =
    resultadosSnap.docs
      .filter(
        (
          item:
            QueryDocumentSnapshot<DocumentData>
        ) =>
          limpiarTexto(
            item.data()
              .pacienteId
          ) ===
          idPaciente
      )
      .map(
        (
          item:
            QueryDocumentSnapshot<DocumentData>
        ) => {
          const datos =
            item.data();

          const analisisId =
            limpiarTexto(
              datos.analisisId
            );

          const nombreDirecto =
            limpiarTexto(
              datos.analisisNombre
            ) ||
            limpiarTexto(
              datos.nombreAnalisis
            );

          return {
            id:
              item.id,

            resultadoId:
              limpiarTexto(
                datos.resultadoId
              ) ||
              item.id,

            solicitudId:
              limpiarTexto(
                datos.solicitudId
              ),

            pacienteId:
              limpiarTexto(
                datos.pacienteId
              ),

            laboratorioId:
              limpiarTexto(
                datos.laboratorioId
              ),

            analisisId,

            analisisNombre:
              nombreDirecto ||
              mapaAnalisis.get(
                analisisId
              ) ||
              analisisId ||
              "Análisis clínico",

            estado:
              limpiarTexto(
                datos.estado
              ) ||
              "Sin estado",

            observaciones:
              limpiarTexto(
                datos.observaciones
              ),

            fechaRegistro:
              datos.fechaRegistro ??
              datos.fecha ??
              null,

            valores:
              normalizarValores(
                datos.valores
              ),
          };
        }
      );


  resultados.sort(
    (a, b) =>
      fechaEnMilisegundos(
        b.fechaRegistro
      ) -
      fechaEnMilisegundos(
        a.fechaRegistro
      )
  );


  const totalAnalisis =
    solicitudes.reduce(
      (
        total,
        solicitud
      ) =>
        total +
        solicitud.analisis.length,
      0
    );


  return {
    solicitudes,
    resultados,
    totalAnalisis,
  };
}
