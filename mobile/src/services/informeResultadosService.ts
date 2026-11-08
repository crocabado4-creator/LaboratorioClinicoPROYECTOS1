import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// TIPOS
// =====================================================

type Registro = Record<string, any>;

export type ParametroInforme = {
  id: string;
  nombre: string;
  valor: string;
  unidad: string;
  referencia: string;
  observacion: string;
};

export type InformeClinico = {
  id: string;

  laboratorioId: string;
  laboratorioNombre: string;
  laboratorioLogo: string;
  laboratorioDireccion: string;
  laboratorioTelefono: string;
  laboratorioCorreo: string;

  pacienteId: string;
  pacienteNombre: string;
  pacienteCI: string;
  pacienteEdad: string;
  pacienteSexo: string;
  pacienteCorreo: string;

  analisisId: string;
  analisisNombre: string;

  ordenId: string;
  numeroOrden: string;

  muestraId: string;
  numeroMuestra: string;
  tipoMuestra: string;
  fechaToma: string;

  valorResultado: string;
  unidad: string;
  referencia: string;
  observaciones: string;

  estado: string;
  fechaRegistro: string;
  fechaValidacion: string;
  validadoPorNombre: string;

  parametros: ParametroInforme[];
};

// =====================================================
// UTILIDADES
// =====================================================

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number" ||
    typeof valor === "boolean"
  ) {
    return String(valor).trim();
  }

  return "";
}

function primero(...valores: unknown[]): string {
  for (const valor of valores) {
    const resultado = texto(valor);

    if (resultado) {
      return resultado;
    }
  }

  return "";
}

function normalizar(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fecha(valor: any): string {
  if (!valor) {
    return "-";
  }

  try {
    let resultado: Date;

    if (typeof valor.toDate === "function") {
      resultado = valor.toDate();
    } else if (typeof valor.seconds === "number") {
      resultado = new Date(valor.seconds * 1000);
    } else {
      resultado = new Date(valor);
    }

    if (Number.isNaN(resultado.getTime())) {
      return texto(valor) || "-";
    }

    return resultado.toLocaleString("es-BO");
  } catch {
    return "-";
  }
}

function fechaMilisegundos(valor: any): number {
  if (!valor) return 0;

  if (typeof valor.toMillis === "function") {
    return valor.toMillis();
  }

  if (typeof valor.seconds === "number") {
    return valor.seconds * 1000;
  }

  const resultado = new Date(valor).getTime();

  return Number.isNaN(resultado) ? 0 : resultado;
}

function estadoValidado(datos: Registro): boolean {
  const estado = normalizar(
    primero(
      datos.estado,
      datos.estadoResultado,
      datos.estadoValidacion
    )
  );

  return (
    datos.validado === true ||
    [
      "validado",
      "finalizado",
      "completado",
      "entregado",
    ].includes(estado)
  );
}

// =====================================================
// RANGOS DE REFERENCIA
// =====================================================

function obtenerReferencia(datos: Registro): string {
  const campos = [
    datos.rangoReferencia,
    datos.referencia,
    datos.valorReferencia,
    datos.valoresReferencia,
    datos.rangoNormal,
    datos.rango,
    datos.intervaloReferencia,
    datos.intervaloNormal,
    datos.valorNormal,
  ];

  for (const campo of campos) {
    if (campo === null || campo === undefined) {
      continue;
    }

    if (
      typeof campo === "string" ||
      typeof campo === "number"
    ) {
      const valor = texto(campo);

      if (valor) {
        return valor;
      }
    }

    if (
      typeof campo === "object" &&
      !Array.isArray(campo)
    ) {
      const minimo = primero(
        campo.minimo,
        campo.min,
        campo.valorMinimo,
        campo.desde
      );

      const maximo = primero(
        campo.maximo,
        campo.max,
        campo.valorMaximo,
        campo.hasta
      );

      if (minimo && maximo) {
        return `${minimo} - ${maximo}`;
      }

      const descripcion = primero(
        campo.texto,
        campo.descripcion,
        campo.valor,
        campo.referencia
      );

      if (descripcion) {
        return descripcion;
      }
    }
  }

  const minimo = primero(
    datos.valorMinimo,
    datos.minimo,
    datos.min
  );

  const maximo = primero(
    datos.valorMaximo,
    datos.maximo,
    datos.max
  );

  if (minimo && maximo) {
    return `${minimo} - ${maximo}`;
  }

  if (minimo) {
    return `Desde ${minimo}`;
  }

  if (maximo) {
    return `Hasta ${maximo}`;
  }

  return "";
}

// =====================================================
// VALORES CLÍNICOS
// =====================================================

function obtenerValor(datos: Registro): string {
  return primero(
    datos.valorResultado,
    datos.resultado,
    datos.valor,
    datos.valorRegistrado,
    datos.resultadoFinal,
    datos.valorObtenido,
    datos.valorMedido,
    datos.medicion
  );
}

function obtenerUnidad(datos: Registro): string {
  return primero(
    datos.unidad,
    datos.unidadMedida,
    datos.unidades,
    datos.unidadResultado
  );
}

function convertirParametro(
  datos: Registro,
  id: string
): ParametroInforme {
  return {
    id: primero(
      datos.parametroId,
      datos.idParametro,
      datos.id,
      id
    ),

    nombre: primero(
      datos.nombreParametro,
      datos.parametroNombre,
      datos.nombre,
      datos.parametro,
      datos.analito,
      datos.descripcion,
      "Parámetro"
    ),

    valor: obtenerValor(datos),

    unidad: obtenerUnidad(datos),

    referencia: obtenerReferencia(datos),

    observacion: primero(
      datos.observacion,
      datos.observaciones,
      datos.nota,
      datos.comentario
    ),
  };
}

function convertirColeccion(
  origen: unknown
): ParametroInforme[] {
  if (Array.isArray(origen)) {
    return origen.map((item, indice) => {
      const datos =
        item && typeof item === "object"
          ? item
          : { valor: item };

      return convertirParametro(
        datos,
        String(indice)
      );
    });
  }

  if (
    origen &&
    typeof origen === "object"
  ) {
    return Object.entries(origen).map(
      ([id, item]) => {
        const datos =
          item && typeof item === "object"
            ? item
            : { valor: item };

        return convertirParametro(datos, id);
      }
    );
  }

  return [];
}

// =====================================================
// COMBINAR PARÁMETROS
// =====================================================

function combinarParametros(
  configurados: ParametroInforme[],
  registrados: ParametroInforme[]
): ParametroInforme[] {
  const resultado: ParametroInforme[] = [];

  const utilizados = new Set<number>();

  for (const configurado of configurados) {
    const indice = registrados.findIndex(
      (registrado, posicion) => {
        if (utilizados.has(posicion)) {
          return false;
        }

        const idIgual =
          normalizar(configurado.id) !== "" &&
          normalizar(configurado.id) ===
            normalizar(registrado.id);

        const nombreIgual =
          normalizar(configurado.nombre) !== "" &&
          normalizar(configurado.nombre) ===
            normalizar(registrado.nombre);

        return idIgual || nombreIgual;
      }
    );

    if (indice === -1) {
      resultado.push(configurado);
      continue;
    }

    utilizados.add(indice);

    const registrado = registrados[indice];

    resultado.push({
      id: configurado.id,

      nombre:
        configurado.nombre ||
        registrado.nombre,

      valor:
        registrado.valor ||
        configurado.valor,

      unidad:
        registrado.unidad ||
        configurado.unidad,

      referencia:
        registrado.referencia ||
        configurado.referencia,

      observacion:
        registrado.observacion ||
        configurado.observacion,
    });
  }

  registrados.forEach((registrado, indice) => {
    if (utilizados.has(indice)) {
      return;
    }

    const existente = resultado.findIndex(
      (parametro) =>
        normalizar(parametro.id) ===
          normalizar(registrado.id) ||
        normalizar(parametro.nombre) ===
          normalizar(registrado.nombre)
    );

    if (existente >= 0) {
      const anterior = resultado[existente];

      resultado[existente] = {
        ...anterior,

        valor:
          registrado.valor ||
          anterior.valor,

        unidad:
          registrado.unidad ||
          anterior.unidad,

        referencia:
          registrado.referencia ||
          anterior.referencia,

        observacion:
          registrado.observacion ||
          anterior.observacion,
      };
    } else {
      resultado.push(registrado);
    }
  });

  return resultado;
}

// =====================================================
// OBTENER USUARIO
// =====================================================

async function obtenerLaboratorioId(): Promise<string> {
  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error(
      "Debes iniciar sesión."
    );
  }

  const snapshot = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  if (!snapshot.exists()) {
    throw new Error(
      "No se encontró el usuario."
    );
  }

  const datos = snapshot.data();

  if (datos.activo === false) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  const laboratorioId = texto(
    datos.laboratorioId
  );

  if (!laboratorioId) {
    throw new Error(
      "El usuario no tiene laboratorio asignado."
    );
  }

  return laboratorioId;
}

// =====================================================
// OBTENER DOCUMENTOS
// =====================================================

async function obtenerDocumento(
  coleccionNombre: string,
  id: string,
  laboratorioId: string
): Promise<Registro> {
  if (!id) {
    return {};
  }

  const snapshot = await getDoc(
    doc(db, coleccionNombre, id)
  );

  if (!snapshot.exists()) {
    return {};
  }

  const datos = snapshot.data();

  if (
    datos.laboratorioId &&
    texto(datos.laboratorioId) !== laboratorioId
  ) {
    throw new Error(
      `El documento de ${coleccionNombre} pertenece a otro laboratorio.`
    );
  }

  return datos;
}

// =====================================================
// LABORATORIO
// =====================================================

async function obtenerLaboratorio(
  laboratorioId: string
): Promise<Registro> {
  const datos = await obtenerDocumento(
    "laboratorios",
    laboratorioId,
    laboratorioId
  );

  const personalizacion =
    datos.personalizacion &&
    typeof datos.personalizacion === "object"
      ? datos.personalizacion
      : {};

  const configuracion =
    datos.configuracion &&
    typeof datos.configuracion === "object"
      ? datos.configuracion
      : {};

  return {
    nombre: primero(
      personalizacion.nombreLaboratorio,
      personalizacion.nombre,
      configuracion.nombreLaboratorio,
      datos.nombreVisible,
      datos.nombreLaboratorio,
      datos.nombre,
      "Laboratorio Clínico"
    ),

    logo: primero(
      personalizacion.logoUrl,
      personalizacion.logoURL,
      personalizacion.logo,
      configuracion.logoUrl,
      configuracion.logo,
      datos.logoUrl,
      datos.logoURL,
      datos.logo,
      datos.logotipo,
      datos.imagenURL
    ),

    direccion: primero(
      personalizacion.direccion,
      configuracion.direccion,
      datos.direccion,
      datos.ubicacion
    ),

    telefono: primero(
      personalizacion.telefono,
      configuracion.telefono,
      datos.telefono,
      datos.celular
    ),

    correo: primero(
      personalizacion.correo,
      personalizacion.email,
      configuracion.correo,
      datos.correo,
      datos.email
    ),
  };
}

// =====================================================
// PACIENTE
// =====================================================

async function obtenerPaciente(
  pacienteId: string,
  laboratorioId: string
): Promise<Registro> {
  const datos = await obtenerDocumento(
    "pacientes",
    pacienteId,
    laboratorioId
  );

  if (!Object.keys(datos).length) {
    throw new Error(
      "No se encontró el paciente."
    );
  }

  let edad = primero(
    datos.edad,
    datos.edadAnios
  );

  if (!edad && datos.fechaNacimiento) {
    try {
      const nacimiento =
        typeof datos.fechaNacimiento.toDate ===
        "function"
          ? datos.fechaNacimiento.toDate()
          : new Date(datos.fechaNacimiento);

      if (!Number.isNaN(nacimiento.getTime())) {
        const hoy = new Date();

        let anios =
          hoy.getFullYear() -
          nacimiento.getFullYear();

        const diferenciaMes =
          hoy.getMonth() -
          nacimiento.getMonth();

        if (
          diferenciaMes < 0 ||
          (diferenciaMes === 0 &&
            hoy.getDate() < nacimiento.getDate())
        ) {
          anios--;
        }

        edad = String(Math.max(0, anios));
      }
    } catch {
      edad = "";
    }
  }

  return {
    nombre: primero(
      datos.nombreCompleto,
      datos.nombrePaciente,
      [
        texto(datos.nombres),
        texto(datos.apellidos),
      ]
        .filter(Boolean)
        .join(" "),
      [
        texto(datos.nombre),
        texto(datos.apellido),
      ]
        .filter(Boolean)
        .join(" ")
    ),

    ci: primero(
      datos.ci,
      datos.carnet,
      datos.numeroDocumento
    ),

    edad: edad
      ? edad.toLowerCase().includes("año")
        ? edad
        : `${edad} años`
      : "",

    sexo: primero(
      datos.sexo,
      datos.genero
    ),

    correo: primero(
      datos.correo,
      datos.email,
      datos.correoElectronico
    ),
  };
}

// =====================================================
// OBTENER PARÁMETROS DEL ANÁLISIS
// =====================================================

async function obtenerParametrosAnalisis(
  analisisId: string,
  laboratorioId: string
): Promise<ParametroInforme[]> {
  if (!analisisId) {
    return [];
  }

  const analisis = await obtenerDocumento(
    "analisis",
    analisisId,
    laboratorioId
  );

  const configurados: ParametroInforme[] = [];

  // Parámetros integrados en el documento del análisis.
  const campos = [
    analisis.parametros,
    analisis.parametrosConfigurados,
    analisis.valoresReferencia,
  ];

  for (const campo of campos) {
    configurados.push(
      ...convertirColeccion(campo)
    );
  }

  // Parámetros guardados como subcolección.
  const snapshot = await getDocs(
    collection(
      db,
      "analisis",
      analisisId,
      "parametros"
    )
  );

  snapshot.docs.forEach((documento) => {
    const datos = documento.data();

    if (datos.activo !== false) {
      configurados.push(
        convertirParametro(
          datos,
          documento.id
        )
      );
    }
  });

  // Eliminar duplicados conservando los datos completos.
  return combinarParametros(
    [],
    configurados
  );
}

// =====================================================
// OBTENER PARÁMETROS DEL RESULTADO
// =====================================================

async function obtenerParametrosResultado(
  resultadoId: string,
  datosResultado: Registro,
  laboratorioId: string
): Promise<ParametroInforme[]> {
  const registrados: ParametroInforme[] = [];

  const campos = [
    datosResultado.parametros,
    datosResultado.valores,
    datosResultado.resultadosParametros,
    datosResultado.detalleResultados,
  ];

  for (const campo of campos) {
    registrados.push(
      ...convertirColeccion(campo)
    );
  }

  // Valores ingresados por el bioquímico.
  const snapshot = await getDocs(
    collection(
      db,
      "resultados",
      resultadoId,
      "valores"
    )
  );

  snapshot.docs.forEach((documento) => {
    registrados.push(
      convertirParametro(
        documento.data(),
        documento.id
      )
    );
  });

  const configurados =
    await obtenerParametrosAnalisis(
      texto(datosResultado.analisisId),
      laboratorioId
    );

  return combinarParametros(
    configurados,
    registrados
  );
}

// =====================================================
// OBTENER UN INFORME
// =====================================================

export async function obtenerInformeFinalizado(
  resultadoId: string
): Promise<InformeClinico> {
  const laboratorioId =
    await obtenerLaboratorioId();

  if (!resultadoId) {
    throw new Error(
      "No se indicó el resultado."
    );
  }

  const resultadoSnapshot = await getDoc(
    doc(db, "resultados", resultadoId)
  );

  if (!resultadoSnapshot.exists()) {
    throw new Error(
      "No se encontró el resultado clínico."
    );
  }

  const datos = resultadoSnapshot.data();

  if (
    texto(datos.laboratorioId) !== laboratorioId
  ) {
    throw new Error(
      "El resultado pertenece a otro laboratorio."
    );
  }

  if (!estadoValidado(datos)) {
    throw new Error(
      "El resultado todavía no está validado."
    );
  }

  const [
    laboratorio,
    paciente,
    orden,
    muestra,
    analisis,
    parametros,
  ] = await Promise.all([
    obtenerLaboratorio(laboratorioId),

    obtenerPaciente(
      texto(datos.pacienteId),
      laboratorioId
    ),

    obtenerDocumento(
      "ordenes",
      texto(datos.ordenId),
      laboratorioId
    ),

    obtenerDocumento(
      "muestras",
      texto(datos.muestraId),
      laboratorioId
    ),

    obtenerDocumento(
      "analisis",
      texto(datos.analisisId),
      laboratorioId
    ),

    obtenerParametrosResultado(
      resultadoId,
      datos,
      laboratorioId
    ),
  ]);

  const analisisNombre = primero(
    datos.analisisNombre,
    datos.nombreAnalisis,
    analisis.nombre,
    analisis.nombreAnalisis,
    "Análisis clínico"
  );

  const valorGeneral = obtenerValor(datos);

  const unidadGeneral = primero(
    obtenerUnidad(datos),
    obtenerUnidad(analisis)
  );

  const referenciaGeneral = primero(
    obtenerReferencia(datos),
    obtenerReferencia(analisis)
  );

  // Agregar el resultado general cuando no existe
  // como un parámetro con ese mismo resultado.
  if (valorGeneral) {
    const existe = parametros.some(
      (parametro) =>
        normalizar(parametro.nombre) ===
          normalizar(analisisNombre) &&
        parametro.valor === valorGeneral
    );

    if (!existe) {
      parametros.unshift({
        id: `general-${resultadoId}`,
        nombre: analisisNombre,
        valor: valorGeneral,
        unidad: unidadGeneral,
        referencia: referenciaGeneral,
        observacion: primero(
          datos.observacion,
          datos.observaciones
        ),
      });
    }
  }

  // Si un parámetro tiene el mismo nombre que
  // el análisis, completar su referencia general.
  const parametrosCompletos = parametros.map(
    (parametro) => {
      if (
        normalizar(parametro.nombre) ===
        normalizar(analisisNombre)
      ) {
        return {
          ...parametro,

          unidad:
            parametro.unidad ||
            unidadGeneral,

          referencia:
            parametro.referencia ||
            referenciaGeneral,
        };
      }

      return parametro;
    }
  );

  return {
    id: resultadoId,

    laboratorioId,

    laboratorioNombre:
      laboratorio.nombre,

    laboratorioLogo:
      laboratorio.logo,

    laboratorioDireccion:
      laboratorio.direccion,

    laboratorioTelefono:
      laboratorio.telefono,

    laboratorioCorreo:
      laboratorio.correo,

    pacienteId:
      texto(datos.pacienteId),

    pacienteNombre:
      paciente.nombre,

    pacienteCI:
      paciente.ci,

    pacienteEdad:
      paciente.edad,

    pacienteSexo:
      paciente.sexo,

    pacienteCorreo:
      paciente.correo,

    analisisId:
      texto(datos.analisisId),

    analisisNombre,

    ordenId:
      texto(datos.ordenId),

    numeroOrden: primero(
      orden.numeroOrden,
      orden.codigoOrden,
      datos.numeroOrden,
      datos.ordenId
    ),

    muestraId:
      texto(datos.muestraId),

    numeroMuestra: primero(
      muestra.numeroMuestra,
      muestra.codigoMuestra,
      muestra.codigo,
      datos.numeroMuestra,
      datos.muestraId
    ),

    tipoMuestra: primero(
      muestra.tipoMuestra,
      muestra.tipo,
      datos.tipoMuestra
    ),

    fechaToma: fecha(
      muestra.fechaToma ||
      muestra.fechaRegistro ||
      datos.fechaToma
    ),

    valorResultado:
      valorGeneral,

    unidad:
      unidadGeneral,

    referencia:
      referenciaGeneral,

    observaciones: primero(
      datos.observaciones,
      datos.observacion
    ),

    estado: primero(
      datos.estado,
      datos.estadoResultado,
      "validado"
    ),

    fechaRegistro: fecha(
      datos.fechaRegistro ||
      datos.fecha
    ),

    fechaValidacion: fecha(
      datos.fechaValidacion ||
      datos.validadoEn
    ),

    validadoPorNombre: primero(
      datos.validadoPorNombre,
      datos.nombreValidador,
      datos.bioquimicoNombre
    ),

    parametros: parametrosCompletos,
  };
}

// =====================================================
// INFORMES POR ORDEN
// =====================================================

export async function obtenerInformesPorOrden(
  ordenId: string
): Promise<InformeClinico[]> {
  const laboratorioId =
    await obtenerLaboratorioId();

  if (!ordenId) {
    throw new Error(
      "No se indicó la orden."
    );
  }

  const snapshot = await getDocs(
    query(
      collection(db, "resultados"),
      where("laboratorioId", "==", laboratorioId),
      where("ordenId", "==", ordenId)
    )
  );

  const documentos = snapshot.docs.filter(
    (documento) =>
      estadoValidado(documento.data())
  );

  return Promise.all(
    documentos.map((documento) =>
      obtenerInformeFinalizado(documento.id)
    )
  );
}

// =====================================================
// LISTAR INFORMES FINALIZADOS
// =====================================================

export async function listarInformesFinalizados():
  Promise<InformeClinico[]> {
  const laboratorioId =
    await obtenerLaboratorioId();

  const snapshot = await getDocs(
    query(
      collection(db, "resultados"),
      where("laboratorioId", "==", laboratorioId)
    )
  );

  const documentos = snapshot.docs
    .filter((documento) =>
      estadoValidado(documento.data())
    )
    .sort((a, b) => {
      const fechaA = fechaMilisegundos(
        a.data().fechaValidacion ||
        a.data().fechaRegistro
      );

      const fechaB = fechaMilisegundos(
        b.data().fechaValidacion ||
        b.data().fechaRegistro
      );

      return fechaB - fechaA;
    });

  return Promise.all(
    documentos.map((documento) =>
      obtenerInformeFinalizado(documento.id)
    )
  );
}