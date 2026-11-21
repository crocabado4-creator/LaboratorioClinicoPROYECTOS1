import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../firebase/firebase";

import "./HistorialPacientes.css";

// ======================================================
// LABORATORIO CLÍNICO
// HISTORIAL COMPLETO DE PACIENTES
// ======================================================

// ======================================================
// UTILIDADES GENERALES
// ======================================================

function texto(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(valor).trim();
}

function primero(...valores) {
  for (const valor of valores) {
    if (
      valor !== null &&
      valor !== undefined &&
      valor !== ""
    ) {
      return valor;
    }
  }

  return "";
}

function mostrar(valor, defecto = "No registrado") {
  return texto(valor) || defecto;
}

function normalizar(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lista(valor) {
  if (Array.isArray(valor)) {
    return valor.filter(
      (item) =>
        item !== null &&
        item !== undefined
    );
  }

  if (
    valor &&
    typeof valor === "object"
  ) {
    return Object.entries(valor).map(
      ([clave, dato]) => {
        if (
          dato &&
          typeof dato === "object" &&
          !Array.isArray(dato)
        ) {
          return {
            ...dato,
            _clave: clave,
          };
        }

        return {
          _clave: clave,
          valor: dato,
        };
      }
    );
  }

  return [];
}

// ======================================================
// FECHAS
// ======================================================

function fechaObjeto(valor) {
  if (!valor) return null;

  try {
    let fecha;

    if (
      typeof valor.toDate === "function"
    ) {
      fecha = valor.toDate();
    } else if (
      typeof valor.seconds === "number"
    ) {
      fecha = new Date(
        valor.seconds * 1000
      );
    } else if (
      typeof valor === "number"
    ) {
      fecha = new Date(valor);
    } else {
      fecha = new Date(valor);
    }

    if (
      Number.isNaN(fecha.getTime())
    ) {
      return null;
    }

    return fecha;
  } catch {
    return null;
  }
}

function fechaTexto(valor) {
  const fecha = fechaObjeto(valor);

  if (!fecha) {
    return "Sin fecha";
  }

  return fecha.toLocaleString("es-BO");
}

function fechaCorta(valor) {
  const fecha = fechaObjeto(valor);

  if (!fecha) {
    return "Sin fecha";
  }

  return fecha.toLocaleDateString("es-BO");
}

function fechaRegistro(item, tipo = "") {
  if (!item) return null;

  switch (tipo) {
    case "solicitudes":
      return primero(
        item.fechaSolicitud,
        item.fechaCreacion,
        item.fechaRegistro,
        item.createdAt,
        item.fecha
      );

    case "ordenes":
      return primero(
        item.fechaOrden,
        item.fechaCreacion,
        item.fechaRegistro,
        item.fechaSolicitud,
        item.createdAt,
        item.fecha
      );

    case "ventas":
      return primero(
        item.fechaVenta,
        item.fechaCreacion,
        item.fechaRegistro,
        item.createdAt,
        item.fecha
      );

    case "muestras":
      return primero(
        item.fechaToma,
        item.fechaRegistro,
        item.fechaRecepcion,
        item.fechaCreacion,
        item.createdAt,
        item.fecha
      );

    case "resultados":
      return primero(
        item.fechaResultado,
        item.fechaRegistro,
        item.fechaValidacion,
        item.fechaCreacion,
        item.createdAt,
        item.fecha
      );

    default:
      return primero(
        item.fechaRegistro,
        item.fechaCreacion,
        item.createdAt,
        item.fecha
      );
  }
}

function ordenarPorFecha(registros, tipo) {
  return [...registros].sort((a, b) => {
    const fechaA = fechaObjeto(
      fechaRegistro(a, tipo)
    );

    const fechaB = fechaObjeto(
      fechaRegistro(b, tipo)
    );

    return (
      (fechaB?.getTime() || 0) -
      (fechaA?.getTime() || 0)
    );
  });
}

// ======================================================
// DATOS DE PACIENTES
// ======================================================

function nombreCompleto(paciente) {
  if (!paciente) {
    return "Sin nombre";
  }

  const completo = primero(
    paciente.nombreCompleto,
    paciente.nombrePaciente
  );

  if (completo) {
    return texto(completo);
  }

  const nombre = texto(
    primero(
      paciente.nombres,
      paciente.nombre
    )
  );

  const apellido = texto(
    primero(
      paciente.apellidos,
      paciente.apellido
    )
  );

  return (
    `${nombre} ${apellido}`.trim() ||
    "Sin nombre"
  );
}

function idRegistro(registro) {
  return texto(registro?.id);
}

function coincidePaciente(
  registro,
  paciente
) {
  if (
    !registro ||
    !paciente
  ) {
    return false;
  }

  const id = texto(paciente.id);

  if (!id) return false;

  return (
    texto(registro.pacienteId) === id ||
    texto(registro.idPaciente) === id
  );
}

function mensajeError(error) {
  if (
    error?.code === "permission-denied"
  ) {
    return (
      "No tienes permisos para consultar " +
      "esta información."
    );
  }

  return (
    error?.message ||
    "Error al consultar Firestore."
  );
}

function moneda(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "No registrado";
  }

  return `Bs ${numero.toLocaleString(
    "es-BO",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

// ======================================================
// DATOS DE ANÁLISIS
// ======================================================

function nombreAnalisis(
  registro,
  catalogo = []
) {
  const analisisId = texto(
    primero(
      registro?.analisisId,
      registro?.idAnalisis
    )
  );

  const encontrado = catalogo.find(
    (item) =>
      texto(item.id) === analisisId
  );

  return mostrar(
    primero(
      registro?.nombreAnalisis,
      registro?.analisisNombre,
      registro?.nombreExamen,
      encontrado?.nombre,
      encontrado?.nombreAnalisis
    ),
    "Análisis no identificado"
  );
}

function obtenerAnalisis(
  registro,
  catalogo = []
) {
  const id = texto(
    primero(
      registro?.analisisId,
      registro?.idAnalisis
    )
  );

  return catalogo.find(
    (item) => texto(item.id) === id
  );
}

// ======================================================
// ANÁLISIS INCLUIDOS EN SOLICITUDES,
// ÓRDENES Y VENTAS
// ======================================================

function obtenerItems(registro) {
  if (!registro) return [];

  const origen = primero(
    registro.detalles,
    registro.detalleVenta,
    registro.detallesVenta,
    registro.items,
    registro.analisisVendidos,
    registro.analisisSolicitados,
    registro.examenes,
    registro.analisis,
    registro.servicios,
    registro.productos
  );

  return lista(origen);
}

function obtenerNombreItem(
  item,
  catalogo = []
) {
  if (
    typeof item === "string"
  ) {
    const encontrado = catalogo.find(
      (a) => texto(a.id) === item
    );

    return mostrar(
      primero(
        encontrado?.nombre,
        encontrado?.nombreAnalisis,
        item
      )
    );
  }

  const id = texto(
    primero(
      item?.analisisId,
      item?.idAnalisis
    )
  );

  const encontrado = catalogo.find(
    (a) => texto(a.id) === id
  );

  return mostrar(
    primero(
      item?.nombreAnalisis,
      item?.analisisNombre,
      item?.nombre,
      item?.descripcion,
      encontrado?.nombre,
      encontrado?.nombreAnalisis
    ),
    "Análisis no identificado"
  );
}

function obtenerCantidad(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return 1;
  }

  const cantidad = Number(
    primero(item.cantidad, 1)
  );

  return Number.isFinite(cantidad)
    ? cantidad
    : 1;
}

function obtenerPrecio(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  const valor = primero(
    item.precioUnitario,
    item.precio
  );

  if (valor === "") return null;

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function obtenerSubtotal(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  const directo = primero(
    item.subtotal,
    item.total
  );

  if (directo !== "") {
    const numero = Number(directo);

    return Number.isFinite(numero)
      ? numero
      : null;
  }

  const precio = obtenerPrecio(item);

  if (precio === null) {
    return null;
  }

  return precio * obtenerCantidad(item);
}

// ======================================================
// VALORES CLÍNICOS
// ======================================================

const CAMPOS_VALOR = [
  "valorResultado",
  "valorRegistrado",
  "resultado",
  "valor",
  "medicion",
  "valorMedido",
  "resultadoObtenido",
  "valorObtenido",
  "resultadoFinal",
  "resultadoParametro",
  "valorAnalisis",
  "valorIngresado",
  "valorNumerico",
  "valorTexto",
  "dato",
  "lectura",
  "respuesta",
];

const CAMPOS_LISTAS = [
  "valoresParametros",
  "resultadosParametros",
  "parametrosResultados",
  "valores",
  "mediciones",
  "detalles",
  "resultados",
  "items",
  "datos",
  "parametros",
  "analitos",
];

function extraerValor(
  dato,
  profundidad = 0
) {
  if (
    dato === null ||
    dato === undefined ||
    profundidad > 6
  ) {
    return "";
  }

  if (
    typeof dato === "string" ||
    typeof dato === "number" ||
    typeof dato === "boolean"
  ) {
    return dato;
  }

  if (
    Array.isArray(dato) ||
    typeof dato !== "object"
  ) {
    return "";
  }

  for (const campo of CAMPOS_VALOR) {
    const valor = dato[campo];

    if (
      valor !== null &&
      valor !== undefined &&
      valor !== ""
    ) {
      const encontrado = extraerValor(
        valor,
        profundidad + 1
      );

      if (encontrado !== "") {
        return encontrado;
      }
    }
  }

  return "";
}

function extraerRegistros(documento) {
  if (
    !documento ||
    typeof documento !== "object"
  ) {
    return [];
  }

  const encontrados = [];

  for (const campo of CAMPOS_LISTAS) {
    const valor = documento[campo];

    if (
      Array.isArray(valor) ||
      (
        valor &&
        typeof valor === "object"
      )
    ) {
      encontrados.push(
        ...lista(valor)
      );
    }
  }

  return encontrados;
}

function obtenerIdParametro(dato) {
  return texto(
    primero(
      dato?.parametroId,
      dato?.idParametro,
      dato?.codigoParametro,
      dato?.codigo,
      dato?.id,
      dato?._clave
    )
  );
}

function obtenerNombreParametro(dato) {
  if (
    typeof dato === "string"
  ) {
    return dato;
  }

  return texto(
    primero(
      dato?.nombreParametro,
      dato?.parametroNombre,
      dato?.nombre,
      dato?.parametro,
      dato?.analito,
      dato?.descripcion
    )
  );
}

function obtenerUnidad(dato) {
  return texto(
    primero(
      dato?.unidadMedida,
      dato?.unidad,
      dato?.unidades
    )
  );
}

function obtenerRango(
  dato,
  profundidad = 0
) {
  if (
    dato === null ||
    dato === undefined ||
    dato === "" ||
    profundidad > 4
  ) {
    return "";
  }

  if (
    typeof dato === "string" ||
    typeof dato === "number"
  ) {
    return texto(dato);
  }

  if (
    typeof dato !== "object" ||
    Array.isArray(dato)
  ) {
    return "";
  }

  const referencia = primero(
    dato.rangoReferencia,
    dato.rangoNormal,
    dato.referencia,
    dato.rango,
    dato.valoresReferencia
  );

  if (
    referencia !== "" &&
    referencia !== dato
  ) {
    const encontrado = obtenerRango(
      referencia,
      profundidad + 1
    );

    if (encontrado) {
      return encontrado;
    }
  }

  const minimo = primero(
    dato.minimo,
    dato.valorMinimo,
    dato.rangoMinimo,
    dato.min
  );

  const maximo = primero(
    dato.maximo,
    dato.valorMaximo,
    dato.rangoMaximo,
    dato.max
  );

  if (
    minimo !== "" &&
    maximo !== ""
  ) {
    return `${minimo} - ${maximo}`;
  }

  if (minimo !== "") {
    return `Desde ${minimo}`;
  }

  if (maximo !== "") {
    return `Hasta ${maximo}`;
  }

  return texto(
    primero(
      dato.textoReferencia,
      dato.descripcionRango,
      dato.rangoTexto
    )
  );
}

function coincidenParametros(a, b) {
  const idA = obtenerIdParametro(a);
  const idB = obtenerIdParametro(b);

  if (
    idA &&
    idB &&
    idA === idB
  ) {
    return true;
  }

  const nombreA = normalizar(
    obtenerNombreParametro(a)
  );

  const nombreB = normalizar(
    obtenerNombreParametro(b)
  );

  return Boolean(
    nombreA &&
    nombreB &&
    nombreA === nombreB
  );
}

function evaluarRango(valor, rango) {
  const numeroTexto = texto(valor)
    .replace(",", ".");

  if (
    !/^-?\d+(\.\d+)?$/.test(
      numeroTexto
    )
  ) {
    return null;
  }

  const referencia = texto(rango)
    .replace(/,/g, ".");

  const coincidencia = referencia.match(
    /^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/
  );

  if (!coincidencia) {
    return null;
  }

  const numero = Number(numeroTexto);
  const minimo = Number(coincidencia[1]);
  const maximo = Number(coincidencia[2]);

  return (
    numero < minimo ||
    numero > maximo
  );
}

// ======================================================
// CONSTRUIR PARÁMETROS DE UN RESULTADO
// ======================================================

function construirParametros(
  resultado,
  analisis,
  registrosAdicionales = []
) {
  const configurados = [
    ...lista(analisis?.parametros),
    ...lista(
      analisis?.parametrosConfigurados
    ),
  ];

  const registrados = [
    ...extraerRegistros(resultado),
    ...registrosAdicionales,
  ];

  const filas = [];

  const agregarFila = (
    registro,
    configuracion = null
  ) => {
    const valor = extraerValor(registro);

    const nombre = primero(
      obtenerNombreParametro(registro),
      obtenerNombreParametro(configuracion),
      resultado?.nombreAnalisis,
      analisis?.nombre
    );

    const unidad = primero(
      obtenerUnidad(registro),
      obtenerUnidad(configuracion),
      obtenerUnidad(resultado)
    );

    const rango = primero(
      obtenerRango(registro),
      obtenerRango(configuracion)
    );

    const observacion = primero(
      registro?.observacion,
      registro?.observaciones
    );

    filas.push({
      id: primero(
        obtenerIdParametro(registro),
        obtenerIdParametro(configuracion),
        nombre
      ),

      nombre: mostrar(
        nombre,
        "Parámetro clínico"
      ),

      valor:
        valor !== ""
          ? texto(valor)
          : "Sin resultado registrado",

      unidad: mostrar(unidad, "-"),

      rango: mostrar(rango, "-"),

      observacion: mostrar(
        observacion,
        "-"
      ),

      registrado: valor !== "",

      anormal:
        evaluarRango(
          valor,
          rango
        ) === true,
    });
  };

  // Resultados existentes.

  for (const registro of registrados) {
    const configuracion =
      configurados.find((item) =>
        coincidenParametros(
          item,
          registro
        )
      );

    agregarFila(
      registro,
      configuracion
    );
  }

  // Resultado directo del documento.

  if (filas.length === 0) {
    const valorPrincipal =
      extraerValor(resultado);

    if (valorPrincipal !== "") {
      agregarFila(
        {
          nombre: primero(
            resultado?.nombreAnalisis,
            analisis?.nombre,
            "Resultado principal"
          ),

          resultado: valorPrincipal,

          unidad: primero(
            resultado?.unidad,
            analisis?.unidad
          ),

          rangoReferencia: primero(
            resultado?.rangoReferencia,
            analisis?.rangoReferencia
          ),

          observacion: primero(
            resultado?.observacion,
            resultado?.observaciones
          ),
        },
        null
      );
    }
  }

  // Parámetros configurados sin resultado.

  if (filas.length === 0) {
    configurados.forEach(
      (parametro) => {
        agregarFila(
          parametro,
          parametro
        );
      }
    );
  } else {
    configurados.forEach(
      (parametro) => {
        const existe = filas.some(
          (fila) =>
            (
              obtenerIdParametro(parametro) &&
              fila.id ===
                obtenerIdParametro(parametro)
            ) ||
            normalizar(fila.nombre) ===
              normalizar(
                obtenerNombreParametro(
                  parametro
                )
              )
        );

        if (!existe) {
          agregarFila(
            parametro,
            parametro
          );
        }
      }
    );
  }

  // Eliminar duplicados exactos.

  return filas.filter(
    (fila, indice, arreglo) =>
      arreglo.findIndex(
        (item) =>
          texto(item.id) === texto(fila.id) &&
          texto(item.nombre) === texto(fila.nombre) &&
          texto(item.valor) === texto(fila.valor)
      ) === indice
  );
}

// ======================================================
// FORMATO DE REFERENCIA
// ======================================================

function referenciaCompleta(parametro) {
  const rango = texto(
    parametro?.rango
  );

  const unidad = texto(
    parametro?.unidad
  );

  if (
    !rango ||
    rango === "-"
  ) {
    return "-";
  }

  if (
    !unidad ||
    unidad === "-"
  ) {
    return rango;
  }

  if (
    rango
      .toLowerCase()
      .includes(unidad.toLowerCase())
  ) {
    return rango;
  }

  return `${rango} ${unidad}`;
}

// ======================================================
// ESTILOS ADICIONALES
// ======================================================

const estilos = {
  resumen: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 12,
    marginTop: 18,
  },

  resumenCard: {
    background: "#f1f5f9",
    border: "1px solid #dbe5f1",
    borderRadius: 12,
    padding: 15,
  },

  registro: {
    background: "#ffffff",
    border: "1px solid #dbe5f1",
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
    minWidth: 0,
  },

  tituloRegistro: {
    color: "#19385f",
    fontSize: 16,
    fontWeight: 800,
    margin: "0 0 14px",
  },

  dato: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "#475569",
    margin: "5px 0",
    overflowWrap: "anywhere",
  },

  tablaContenedor: {
    width: "100%",
    overflowX: "auto",
    marginTop: 14,
    borderRadius: 10,
    border: "1px solid #dbe5f1",
  },

  tabla: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    minWidth: 600,
  },

  th: {
    background: "#19385f",
    color: "#ffffff",
    padding: "11px 12px",
    textAlign: "left",
    fontWeight: 700,
    borderBottom:
      "1px solid #dbe5f1",
  },

  td: {
    padding: "11px 12px",
    borderBottom:
      "1px solid #e2e8f0",
    color: "#334155",
    verticalAlign: "top",
  },

  mensaje: {
    padding: 15,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    color: "#64748b",
    fontSize: 13,
  },

  etiqueta: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 20,
    background: "#e0f2fe",
    color: "#075985",
    fontWeight: 700,
    fontSize: 11,
  },

  observacion: {
    background: "#f8fafc",
    padding: 12,
    borderRadius: 9,
    marginTop: 12,
    fontSize: 12,
    color: "#475569",
    lineHeight: 1.6,
  },
};

// ======================================================
// COMPONENTE DE DATO
// ======================================================

function Dato({
  titulo,
  valor,
}) {
  return (
    <p style={estilos.dato}>
      <strong
        style={{
          color: "#19385f",
        }}
      >
        {titulo}:
      </strong>{" "}
      {mostrar(valor)}
    </p>
  );
}

// ======================================================
// TABLA REUTILIZABLE
// ======================================================

function TablaDatos({
  columnas,
  filas,
}) {
  if (!filas.length) {
    return (
      <div style={estilos.mensaje}>
        No hay datos registrados.
      </div>
    );
  }

  return (
    <div style={estilos.tablaContenedor}>
      <table style={estilos.tabla}>
        <thead>
          <tr>
            {columnas.map(
              (columna, index) => (
                <th
                  key={index}
                  style={estilos.th}
                >
                  {columna}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {filas.map(
            (fila, index) => (
              <tr key={index}>
                {fila.map(
                  (valor, indice) => (
                    <td
                      key={indice}
                      style={estilos.td}
                    >
                      {valor}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function HistorialPacientes({
  usuario,
}) {
  const laboratorioId = texto(
    usuario?.laboratorioId
  );

  // ====================================================
  // ESTADOS
  // ====================================================

  const [pacientes, setPacientes] =
    useState([]);

  const [solicitudes, setSolicitudes] =
    useState([]);

  const [ordenes, setOrdenes] =
    useState([]);

  const [ventas, setVentas] =
    useState([]);

  const [muestras, setMuestras] =
    useState([]);

  const [resultados, setResultados] =
    useState([]);

  const [analisis, setAnalisis] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [
    pacienteSeleccionado,
    setPacienteSeleccionado,
  ] = useState(null);

  const [
    detallesResultados,
    setDetallesResultados,
  ] = useState({});

  const [
    cargandoDetalles,
    setCargandoDetalles,
  ] = useState(false);

  const [
    erroresDetalles,
    setErroresDetalles,
  ] = useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [generandoPDF, setGenerandoPDF] =
    useState(false);

  const [error, setError] =
    useState("");

  // ====================================================
  // CONSULTAR COLECCIONES
  // ====================================================

  useEffect(() => {
    if (!laboratorioId) {
      setError(
        "No se encontró el laboratorio."
      );

      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    const colecciones = [
      ["pacientes", setPacientes],
      ["solicitudes", setSolicitudes],
      ["ordenes", setOrdenes],
      ["ventas", setVentas],
      ["muestras", setMuestras],
      ["resultados", setResultados],
      ["analisis", setAnalisis],
    ];

    const cargadas = new Set();

    const cancelar = colecciones.map(
      ([nombre, actualizar]) => {
        const consulta = query(
          collection(db, nombre),
          where(
            "laboratorioId",
            "==",
            laboratorioId
          )
        );

        return onSnapshot(
          consulta,
          (snapshot) => {
            actualizar(
              snapshot.docs.map(
                (documento) => ({
                  ...documento.data(),
                  id: documento.id,
                })
              )
            );

            cargadas.add(nombre);

            if (
              cargadas.size ===
              colecciones.length
            ) {
              setCargando(false);
            }
          },

          (err) => {
            console.error(
              `Error consultando ${nombre}:`,
              err
            );

            setError(
              (anterior) =>
                anterior
                  ? `${anterior} | ${nombre}: ${mensajeError(err)}`
                  : `${nombre}: ${mensajeError(err)}`
            );

            cargadas.add(nombre);

            if (
              cargadas.size ===
              colecciones.length
            ) {
              setCargando(false);
            }
          }
        );
      }
    );

    return () => {
      cancelar.forEach(
        (funcion) => funcion()
      );
    };
  }, [laboratorioId]);

  // ====================================================
  // FILTRAR PACIENTES
  // ====================================================

  const pacientesFiltrados = useMemo(() => {
    const palabra = normalizar(
      busqueda
    );

    if (!palabra) {
      return pacientes;
    }

    return pacientes.filter(
      (paciente) => {
        const contenido = [
          nombreCompleto(paciente),
          paciente.ci,
          paciente.telefono,
        ]
          .join(" ");

        return normalizar(
          contenido
        ).includes(palabra);
      }
    );
  }, [
    pacientes,
    busqueda,
  ]);

  // ====================================================
  // CONSTRUIR HISTORIAL DEL PACIENTE
  // ====================================================

  const historial = useMemo(() => {
    if (!pacienteSeleccionado) {
      return null;
    }

    return {
      solicitudes: ordenarPorFecha(
        solicitudes.filter(
          (item) =>
            coincidePaciente(
              item,
              pacienteSeleccionado
            )
        ),
        "solicitudes"
      ),

      ordenes: ordenarPorFecha(
        ordenes.filter(
          (item) =>
            coincidePaciente(
              item,
              pacienteSeleccionado
            )
        ),
        "ordenes"
      ),

      ventas: ordenarPorFecha(
        ventas.filter(
          (item) =>
            coincidePaciente(
              item,
              pacienteSeleccionado
            )
        ),
        "ventas"
      ),

      muestras: ordenarPorFecha(
        muestras.filter(
          (item) =>
            coincidePaciente(
              item,
              pacienteSeleccionado
            )
        ),
        "muestras"
      ),

      resultados: ordenarPorFecha(
        resultados.filter(
          (item) =>
            coincidePaciente(
              item,
              pacienteSeleccionado
            )
        ),
        "resultados"
      ),
    };
  }, [
    pacienteSeleccionado,
    solicitudes,
    ordenes,
    ventas,
    muestras,
    resultados,
  ]);

  // ====================================================
  // CONSULTAR VALORES CLÍNICOS REALES
  // ====================================================

  const cargarDetallesResultados = useCallback(
    async (resultadosPaciente) => {
      const detalles = {};
      const errores = [];

      const respuestas = await Promise.all(
        resultadosPaciente.map(
          async (resultado) => {
            const valores = [];
            const advertencias = [];

            // Datos guardados dentro del resultado.

            valores.push(
              ...extraerRegistros(resultado)
            );

            // Subcolección de valores.

            if (resultado.id) {
              try {
                const snapshot = await getDocs(
                  collection(
                    db,
                    "resultados",
                    resultado.id,
                    "valores"
                  )
                );

                snapshot.docs.forEach(
                  (documento) => {
                    valores.push({
                      ...documento.data(),
                      id: documento.id,
                    });
                  }
                );
              } catch (err) {
                advertencias.push(
                  `Valores del resultado ${resultado.id}: ` +
                  mensajeError(err)
                );
              }
            }

            // Valores almacenados en la muestra.

            const muestraId = texto(
              resultado.muestraId
            );

            if (muestraId) {
              const muestra = muestras.find(
                (item) =>
                  texto(item.id) === muestraId
              );

              if (muestra) {
                valores.push(
                  ...extraerRegistros(muestra)
                );
              }
            }

            const configuracion =
              obtenerAnalisis(
                resultado,
                analisis
              );

            const parametros =
              construirParametros(
                resultado,
                configuracion,
                valores
              );

            return {
              id: resultado.id,
              parametros,
              advertencias,
            };
          }
        )
      );

      respuestas.forEach(
        (respuesta) => {
          detalles[respuesta.id] =
            respuesta.parametros;

          errores.push(
            ...respuesta.advertencias
          );
        }
      );

      return {
        detalles,
        errores,
      };
    },
    [
      muestras,
      analisis,
    ]
  );

  // ====================================================
  // CARGAR PARÁMETROS CUANDO SE SELECCIONA PACIENTE
  // ====================================================

  useEffect(() => {
    if (
      !pacienteSeleccionado ||
      !historial
    ) {
      setDetallesResultados({});
      setErroresDetalles([]);
      setCargandoDetalles(false);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargandoDetalles(true);
      setErroresDetalles([]);

      try {
        const respuesta =
          await cargarDetallesResultados(
            historial.resultados
          );

        if (!activo) return;

        setDetallesResultados(
          respuesta.detalles
        );

        setErroresDetalles(
          respuesta.errores
        );
      } catch (err) {
        if (activo) {
          setErroresDetalles([
            mensajeError(err),
          ]);
        }
      } finally {
        if (activo) {
          setCargandoDetalles(false);
        }
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [
    pacienteSeleccionado,
    historial,
    cargarDetallesResultados,
  ]);

  // ====================================================
  // RESUMEN DEL HISTORIAL
  // ====================================================

  const resumen = useMemo(() => {
    if (!historial) {
      return [];
    }

    return [
      {
        titulo: "Solicitudes",
        cantidad:
          historial.solicitudes.length,
      },
      {
        titulo: "Órdenes",
        cantidad:
          historial.ordenes.length,
      },
      {
        titulo: "Ventas",
        cantidad:
          historial.ventas.length,
      },
      {
        titulo: "Muestras",
        cantidad:
          historial.muestras.length,
      },
      {
        titulo: "Resultados",
        cantidad:
          historial.resultados.length,
      },
    ];
  }, [historial]);

  // ====================================================
  // GENERAR PDF COMPLETO DEL HISTORIAL
  // ====================================================

  const descargarPDF = async () => {
    if (
      !pacienteSeleccionado ||
      !historial ||
      generandoPDF ||
      cargandoDetalles
    ) {
      return;
    }

    setGenerandoPDF(true);

    try {
      // ================================================
      // ACTUALIZAR DETALLES DE RESULTADOS
      // ================================================

      const consulta =
        await cargarDetallesResultados(
          historial.resultados
        );

      // Si fallaron consultas de valores, no
      // generar un PDF que parezca completo.

      if (
        consulta.errores.length > 0
      ) {
        throw new Error(
          "No se pudieron consultar todos los valores clínicos. " +
          "Revisa los permisos de Firestore antes de generar " +
          "el historial completo."
        );
      }

      const valoresActualizados =
        consulta.detalles;

      // ================================================
      // CREAR DOCUMENTO
      // ================================================

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const ANCHO = 210;
      const ALTO = 297;

      const IZQUIERDA = 14;
      const DERECHA = 196;

      const LIMITE = 267;

      const AZUL = [25, 56, 95];
      const AZUL_CLARO = [239, 246, 255];

      const TEXTO = [30, 41, 59];
      const GRIS = [100, 116, 139];

      let y = 0;

      // ================================================
      // CONTROL DE PÁGINAS
      // ================================================

      const nuevaPagina = () => {
        pdf.addPage();
        y = 22;
      };

      const comprobarEspacio = (
        altura
      ) => {
        if (
          y + altura > LIMITE
        ) {
          nuevaPagina();
        }
      };

      // ================================================
      // ENCABEZADO
      // ================================================

      pdf.setFillColor(...AZUL);

      pdf.rect(
        0,
        0,
        ANCHO,
        37,
        "F"
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(16);

      pdf.setTextColor(
        255,
        255,
        255
      );

      pdf.text(
        "LABORATORIO CLÍNICO",
        14,
        15
      );

      pdf.setFontSize(11);

      pdf.text(
        "HISTORIAL COMPLETO DEL PACIENTE",
        14,
        25
      );

      // ================================================
      // INFORMACIÓN DEL PACIENTE
      // ================================================

      autoTable(pdf, {
        startY: 45,

        margin: {
          left: 14,
          right: 14,
          bottom: 30,
        },

        theme: "grid",

        body: [
          [
            "PACIENTE",
            nombreCompleto(
              pacienteSeleccionado
            ),
          ],

          [
            "CI",
            mostrar(
              pacienteSeleccionado.ci
            ),
          ],

          [
            "TELÉFONO",
            mostrar(
              pacienteSeleccionado.telefono
            ),
          ],

          [
            "CORREO",
            mostrar(
              primero(
                pacienteSeleccionado.correo,
                pacienteSeleccionado.email,
                pacienteSeleccionado.correoElectronico
              )
            ),
          ],

          [
            "FECHA DE EMISIÓN",
            fechaTexto(new Date()),
          ],
        ],

        styles: {
          fontSize: 8.5,
          cellPadding: 3.2,
          lineColor: [215, 225, 235],
          lineWidth: 0.2,
          textColor: TEXTO,
        },

        columnStyles: {
          0: {
            fontStyle: "bold",
            fillColor: AZUL_CLARO,
            cellWidth: 46,
          },
        },
      });

      y =
        pdf.lastAutoTable.finalY + 12;

      // ================================================
      // FUNCIÓN PARA TÍTULOS
      // ================================================

      const tituloSeccion = (
        titulo
      ) => {
        comprobarEspacio(20);

        pdf.setFillColor(
          ...AZUL_CLARO
        );

        pdf.roundedRect(
          14,
          y,
          182,
          10,
          2,
          2,
          "F"
        );

        pdf.setFillColor(...AZUL);

        pdf.rect(
          14,
          y,
          3,
          10,
          "F"
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(10);

        pdf.setTextColor(...AZUL);

        pdf.text(
          titulo,
          21,
          y + 6.5
        );

        y += 15;
      };

      // ================================================
      // FUNCIÓN PARA TABLAS
      // ================================================

      const agregarTabla = (
        columnas,
        filas,
        opciones = {}
      ) => {
        autoTable(pdf, {
          startY: y,

          margin: {
            left: 14,
            right: 14,
            top: 22,
            bottom: 30,
          },

          tableWidth: 182,

          head: [columnas],

          body:
            filas.length > 0
              ? filas
              : [
                  [
                    "Sin registros",
                    ...columnas
                      .slice(1)
                      .map(() => ""),
                  ],
                ],

          theme: "grid",

          headStyles: {
            fillColor: AZUL,
            textColor: [
              255,
              255,
              255,
            ],
            fontStyle: "bold",
            fontSize: 8,
          },

          styles: {
            font: "helvetica",
            fontSize: 7.8,
            cellPadding: 3,
            textColor: TEXTO,
            lineColor: [
              220,
              228,
              236,
            ],
            lineWidth: 0.15,
            overflow: "linebreak",
            valign: "middle",
          },

          alternateRowStyles: {
            fillColor: [
              248,
              250,
              252,
            ],
          },

          ...opciones,
        });

        y =
          pdf.lastAutoTable.finalY + 11;
      };

      // ================================================
      // FUNCIÓN PARA TEXTO
      // ================================================

      const agregarTexto = (
        contenido,
        opciones = {}
      ) => {
        const tamanio =
          opciones.tamanio || 8.5;

        const ancho =
          opciones.ancho || 180;

        pdf.setFont(
          "helvetica",
          opciones.negrita
            ? "bold"
            : "normal"
        );

        pdf.setFontSize(
          tamanio
        );

        pdf.setTextColor(
          ...(opciones.color || TEXTO)
        );

        const lineas =
          pdf.splitTextToSize(
            mostrar(contenido),
            ancho
          );

        // Evitar que el texto atraviese
        // el pie de página.

        const altura =
          lineas.length * 4.5 + 4;

        comprobarEspacio(
          altura
        );

        pdf.text(
          lineas,
          14,
          y
        );

        y += altura;
      };

      // ================================================
      // RESUMEN GENERAL
      // ================================================

      tituloSeccion(
        "RESUMEN DEL HISTORIAL"
      );

      agregarTabla(
        [
          "Solicitudes",
          "Órdenes",
          "Ventas",
          "Muestras",
          "Resultados",
        ],

        [
          [
            String(
              historial.solicitudes.length
            ),
            String(
              historial.ordenes.length
            ),
            String(
              historial.ventas.length
            ),
            String(
              historial.muestras.length
            ),
            String(
              historial.resultados.length
            ),
          ],
        ]
      );

      // ================================================
      // SOLICITUDES DE ANÁLISIS
      // ================================================

      tituloSeccion(
        "SOLICITUDES DE ANÁLISIS"
      );

      agregarTabla(
        [
          "Fecha",
          "Estado",
          "Código",
          "Total",
        ],

        historial.solicitudes.map(
          (item) => [
            fechaTexto(
              fechaRegistro(
                item,
                "solicitudes"
              )
            ),

            mostrar(item.estado),

            mostrar(
              primero(
                item.codigo,
                item.codigoSolicitud,
                item.id
              )
            ),

            moneda(
              primero(
                item.total,
                item.montoTotal
              )
            ),
          ]
        )
      );

      // Análisis de cada solicitud.

      for (
        const solicitud of
        historial.solicitudes
      ) {
        const items =
          obtenerItems(solicitud);

        if (
          items.length === 0
        ) {
          continue;
        }

        agregarTexto(
          `Solicitud del ${fechaTexto(
            fechaRegistro(
              solicitud,
              "solicitudes"
            )
          )}`,
          {
            negrita: true,
            color: AZUL,
          }
        );

        agregarTabla(
          [
            "Análisis solicitado",
            "Cantidad",
          ],

          items.map(
            (item) => [
              obtenerNombreItem(
                item,
                analisis
              ),

              String(
                obtenerCantidad(item)
              ),
            ]
          )
        );
      }

      // ================================================
      // ÓRDENES DE ANÁLISIS
      // ================================================

      tituloSeccion(
        "ÓRDENES DE ANÁLISIS"
      );

      agregarTabla(
        [
          "Fecha",
          "Estado",
          "Código",
          "Total",
        ],

        historial.ordenes.map(
          (item) => [
            fechaTexto(
              fechaRegistro(
                item,
                "ordenes"
              )
            ),

            mostrar(item.estado),

            mostrar(
              primero(
                item.codigoOrden,
                item.numeroOrden,
                item.id
              )
            ),

            moneda(
              primero(
                item.total,
                item.montoTotal
              )
            ),
          ]
        )
      );

      for (
        const orden of
        historial.ordenes
      ) {
        const items =
          obtenerItems(orden);

        if (
          items.length === 0
        ) {
          continue;
        }

        agregarTexto(
          `Orden registrada: ${fechaTexto(
            fechaRegistro(
              orden,
              "ordenes"
            )
          )}`,
          {
            negrita: true,
            color: AZUL,
          }
        );

        agregarTabla(
          [
            "Análisis incluido",
            "Cantidad",
          ],

          items.map(
            (item) => [
              obtenerNombreItem(
                item,
                analisis
              ),

              String(
                obtenerCantidad(item)
              ),
            ]
          )
        );
      }

      // ================================================
      // VENTAS
      // ================================================

      tituloSeccion(
        "VENTAS"
      );

      agregarTabla(
        [
          "Fecha",
          "Estado",
          "Método de pago",
          "Total",
        ],

        historial.ventas.map(
          (item) => [
            fechaTexto(
              fechaRegistro(
                item,
                "ventas"
              )
            ),

            mostrar(item.estado),

            mostrar(
              item.metodoPago
            ),

            moneda(
              primero(
                item.total,
                item.montoTotal,
                item.totalVenta
              )
            ),
          ]
        )
      );

      // Detalle de cada venta.

      for (
        const venta of
        historial.ventas
      ) {
        const items =
          obtenerItems(venta);

        if (
          items.length === 0
        ) {
          continue;
        }

        agregarTexto(
          `Venta del ${fechaTexto(
            fechaRegistro(
              venta,
              "ventas"
            )
          )}`,
          {
            negrita: true,
            color: AZUL,
          }
        );

        agregarTabla(
          [
            "Análisis",
            "Cant.",
            "Precio",
            "Subtotal",
          ],

          items.map(
            (item) => [
              obtenerNombreItem(
                item,
                analisis
              ),

              String(
                obtenerCantidad(item)
              ),

              moneda(
                obtenerPrecio(item)
              ),

              moneda(
                obtenerSubtotal(item)
              ),
            ]
          )
        );
      }

      // ================================================
      // MUESTRAS
      // ================================================

      tituloSeccion(
        "MUESTRAS"
      );

      agregarTabla(
        [
          "Fecha de toma",
          "Tipo",
          "Estado",
          "Recepción",
        ],

        historial.muestras.map(
          (item) => [
            fechaTexto(
              primero(
                item.fechaToma,
                item.fechaRegistro,
                item.fecha
              )
            ),

            mostrar(
              primero(
                item.tipoMuestra,
                item.tipo
              )
            ),

            mostrar(item.estado),

            fechaTexto(
              item.fechaRecepcion
            ),
          ]
        )
      );

      // Información adicional de muestras.

      for (
        const muestra of
        historial.muestras
      ) {
        comprobarEspacio(35);

        agregarTexto(
          `Muestra: ${mostrar(
            primero(
              muestra.tipoMuestra,
              muestra.tipo
            )
          )}`,
          {
            negrita: true,
            color: AZUL,
          }
        );

        agregarTexto(
          `Fecha de toma: ${fechaTexto(
            primero(
              muestra.fechaToma,
              muestra.fechaRegistro
            )
          )}`
        );

        agregarTexto(
          `Estado: ${mostrar(
            muestra.estado
          )}`
        );

        if (
          muestra.motivoRechazo
        ) {
          agregarTexto(
            `Motivo de rechazo: ${muestra.motivoRechazo}`
          );
        }

        const analisisMuestra =
          nombreAnalisis(
            muestra,
            analisis
          );

        if (
          analisisMuestra !==
          "Análisis no identificado"
        ) {
          agregarTexto(
            `Análisis relacionado: ${analisisMuestra}`
          );
        }

        y += 4;
      }

      // ================================================
      // RESULTADOS CLÍNICOS
      // ================================================

      tituloSeccion(
        "RESULTADOS CLÍNICOS"
      );

      if (
        historial.resultados.length === 0
      ) {
        agregarTexto(
          "No existen resultados clínicos registrados."
        );
      }

      // ================================================
      // RECORRER TODOS LOS RESULTADOS
      // ================================================

      for (
        const resultado of
        historial.resultados
      ) {
        comprobarEspacio(45);

        // Nombre del análisis.

        const nombre =
          nombreAnalisis(
            resultado,
            analisis
          );

        agregarTexto(
          nombre.toUpperCase(),
          {
            negrita: true,
            color: AZUL,
            tamanio: 10,
          }
        );

        // Datos de registro.

        agregarTabla(
          [
            "Fecha de registro",
            "Fecha de validación",
            "Estado",
          ],

          [
            [
              fechaTexto(
                fechaRegistro(
                  resultado,
                  "resultados"
                )
              ),

              fechaTexto(
                resultado.fechaValidacion
              ),

              mostrar(
                resultado.estado
              ),
            ],
          ]
        );

        // ==============================================
        // PARÁMETROS DEL ANÁLISIS
        // ==============================================

        const parametros =
          valoresActualizados[
            resultado.id
          ] || [];

        if (
          parametros.length === 0
        ) {
          agregarTexto(
            "No se encontraron parámetros individuales registrados."
          );
        } else {
          agregarTabla(
            [
              "Parámetro",
              "Resultado",
              "Unidad",
              "Referencia",
            ],

            parametros.map(
              (parametro) => [
                parametro.nombre,

                {
                  content:
                    parametro.anormal
                      ? `${parametro.valor} *`
                      : parametro.valor,

                  styles: {
                    fontStyle:
                      parametro.anormal
                        ? "bold"
                        : "normal",

                    textColor:
                      parametro.anormal
                        ? [190, 35, 45]
                        : TEXTO,
                  },
                },

                parametro.unidad,

                parametro.rango,
              ]
            ),

            {
              columnStyles: {
                0: {
                  cellWidth: 57,
                },

                1: {
                  cellWidth: 36,
                },

                2: {
                  cellWidth: 31,
                },

                3: {
                  cellWidth: 58,
                },
              },
            }
          );

          // Observaciones de parámetros.

          const observacionesParametros =
            parametros.filter(
              (parametro) =>
                parametro.observacion &&
                parametro.observacion !== "-"
            );

          if (
            observacionesParametros.length > 0
          ) {
            agregarTexto(
              "Observaciones de parámetros:",
              {
                negrita: true,
                color: AZUL,
              }
            );

            observacionesParametros.forEach(
              (parametro) => {
                agregarTexto(
                  `${parametro.nombre}: ${parametro.observacion}`
                );
              }
            );
          }
        }

        // ==============================================
        // OBSERVACIONES GENERALES
        // ==============================================

        const observaciones =
          primero(
            resultado.observaciones,
            resultado.observacion
          );

        if (observaciones) {
          agregarTexto(
            `Observaciones generales: ${texto(observaciones)}`
          );
        }

        // ==============================================
        // PROFESIONAL QUE VALIDÓ
        // ==============================================

        agregarTexto(
          `Validado por: ${mostrar(
            primero(
              resultado.validadoPorNombre,
              resultado.nombreValidador
            )
          )}`
        );

        agregarTexto(
          `Fecha de validación: ${fechaTexto(
            resultado.fechaValidacion
          )}`
        );

        // Separador.

        comprobarEspacio(10);

        pdf.setDrawColor(
          220,
          228,
          236
        );

        pdf.line(
          14,
          y,
          196,
          y
        );

        y += 10;
      }

      // ================================================
      // PIE DE PÁGINA
      // ================================================

      const paginas =
        pdf.internal.getNumberOfPages();

      for (
        let pagina = 1;
        pagina <= paginas;
        pagina++
      ) {
        pdf.setPage(pagina);

        pdf.setDrawColor(
          215,
          225,
          235
        );

        pdf.line(
          IZQUIERDA,
          ALTO - 20,
          DERECHA,
          ALTO - 20
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(7);

        pdf.setTextColor(...GRIS);

        pdf.text(
          "Laboratorio Clínico - Historial de pacientes",
          14,
          ALTO - 14
        );

        pdf.text(
          `${pagina} / ${paginas}`,
          196,
          ALTO - 14,
          {
            align: "right",
          }
        );

        pdf.text(
          "Información obtenida de los registros del sistema.",
          105,
          ALTO - 9,
          {
            align: "center",
          }
        );
      }

      // ================================================
      // NOMBRE DEL PDF
      // ================================================

      const nombreSeguro =
        nombreCompleto(
          pacienteSeleccionado
        )
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-zA-Z0-9_-]+/g,
            "_"
          )
          .slice(0, 60);

      const fechaArchivo =
        new Date()
          .toISOString()
          .slice(0, 10);

      pdf.save(
        `Historial_Completo_${nombreSeguro}_${fechaArchivo}.pdf`
      );

    } catch (err) {
      console.error(
        "Error generando historial PDF:",
        err
      );

      alert(
        err?.message ||
        "No se pudo generar el historial."
      );
    } finally {
      setGenerandoPDF(false);
    }
  };

  // ====================================================
  // INTERFAZ PRINCIPAL
  // ====================================================

  return (
    <div className="hp-page">

      {/* ================================================
          ENCABEZADO
      ================================================ */}

      <div className="hp-header">
        <div>
          <h2>
            Historial de pacientes
          </h2>

          <p>
            Consulta las solicitudes, órdenes,
            ventas, muestras y todos los
            resultados clínicos de cada paciente.
          </p>
        </div>
      </div>

      {/* ================================================
          ERRORES
      ================================================ */}

      {error && (
        <div className="hp-error">
          {error}
        </div>
      )}

      {/* ================================================
          LISTADO DE PACIENTES
      ================================================ */}

      {!pacienteSeleccionado ? (
        <div className="hp-card">

          <h3>
            Buscar paciente
          </h3>

          <input
            type="text"
            placeholder="Buscar por nombre, apellido o CI"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
            }
            className="hp-input"
          />

          {cargando ? (
            <p>
              Cargando pacientes...
            </p>
          ) : (
            <div className="hp-grid">
              {pacientesFiltrados.map(
                (paciente) => (
                  <div
                    className="hp-paciente"
                    key={idRegistro(paciente)}
                  >
                    <h4>
                      {nombreCompleto(paciente)}
                    </h4>

                    <Dato
                      titulo="CI"
                      valor={paciente.ci}
                    />

                    <Dato
                      titulo="Teléfono"
                      valor={paciente.telefono}
                    />

                    <button
                      type="button"
                      className="hp-btn"
                      onClick={() => {
                        setPacienteSeleccionado(
                          paciente
                        );

                        setDetallesResultados({});
                        setErroresDetalles([]);
                      }}
                    >
                      Ver historial completo
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {!cargando &&
            pacientesFiltrados.length === 0 && (
              <p>
                No se encontraron pacientes.
              </p>
            )}
        </div>
      ) : (
        <>
          {/* ==========================================
              BOTONES
          ========================================== */}

          <div className="hp-actions">
            <button
              type="button"
              className="hp-btn-secondary"
              onClick={() => {
                setPacienteSeleccionado(null);
                setDetallesResultados({});
                setErroresDetalles([]);
              }}
            >
              ← Volver a pacientes
            </button>

            <button
              type="button"
              className="hp-btn"
              onClick={descargarPDF}
              disabled={
                generandoPDF ||
                cargandoDetalles ||
                cargando
              }
            >
              {generandoPDF
                ? "Generando historial..."
                : "Descargar historial completo PDF"}
            </button>
          </div>

          {/* ==========================================
              DATOS DEL PACIENTE
          ========================================== */}

          <div className="hp-card">
            <h3>
              {nombreCompleto(
                pacienteSeleccionado
              )}
            </h3>

            <Dato
              titulo="CI"
              valor={
                pacienteSeleccionado.ci
              }
            />

            <Dato
              titulo="Teléfono"
              valor={
                pacienteSeleccionado.telefono
              }
            />

            <Dato
              titulo="Correo"
              valor={primero(
                pacienteSeleccionado.correo,
                pacienteSeleccionado.email
              )}
            />

            {/* RESUMEN */}

            <div style={estilos.resumen}>
              {resumen.map(
                (item) => (
                  <div
                    key={item.titulo}
                    style={estilos.resumenCard}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginBottom: 7,
                      }}
                    >
                      {item.titulo}
                    </div>

                    <strong
                      style={{
                        fontSize: 23,
                        color: "#19385f",
                      }}
                    >
                      {item.cantidad}
                    </strong>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ==========================================
              SOLICITUDES DE ANÁLISIS
          ========================================== */}

          <div className="hp-card">
            <h3>
              Solicitudes de análisis
            </h3>

            {!historial?.solicitudes.length ? (
              <p>
                No existen solicitudes registradas.
              </p>
            ) : (
              historial.solicitudes.map(
                (solicitud) => {
                  const items =
                    obtenerItems(solicitud);

                  return (
                    <div
                      key={solicitud.id}
                      style={estilos.registro}
                    >
                      <h4
                        style={estilos.tituloRegistro}
                      >
                        Solicitud de análisis
                      </h4>

                      <Dato
                        titulo="Fecha de solicitud"
                        valor={fechaTexto(
                          fechaRegistro(
                            solicitud,
                            "solicitudes"
                          )
                        )}
                      />

                      <Dato
                        titulo="Estado"
                        valor={
                          solicitud.estado
                        }
                      />

                      <Dato
                        titulo="Código"
                        valor={primero(
                          solicitud.codigo,
                          solicitud.codigoSolicitud,
                          solicitud.id
                        )}
                      />

                      <Dato
                        titulo="Total"
                        valor={moneda(
                          primero(
                            solicitud.total,
                            solicitud.montoTotal
                          )
                        )}
                      />

                      {items.length > 0 && (
                        <>
                          <h4>
                            Análisis solicitados
                          </h4>

                          <TablaDatos
                            columnas={[
                              "Análisis",
                              "Cantidad",
                            ]}
                            filas={items.map(
                              (item) => [
                                obtenerNombreItem(
                                  item,
                                  analisis
                                ),

                                String(
                                  obtenerCantidad(item)
                                ),
                              ]
                            )}
                          />
                        </>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>

          {/* ==========================================
              ÓRDENES DE ANÁLISIS
          ========================================== */}

          <div className="hp-card">
            <h3>
              Órdenes de análisis
            </h3>

            {!historial?.ordenes.length ? (
              <p>
                No existen órdenes registradas.
              </p>
            ) : (
              historial.ordenes.map(
                (orden) => {
                  const items =
                    obtenerItems(orden);

                  return (
                    <div
                      key={orden.id}
                      style={estilos.registro}
                    >
                      <h4
                        style={estilos.tituloRegistro}
                      >
                        Orden de análisis
                      </h4>

                      <Dato
                        titulo="Fecha"
                        valor={fechaTexto(
                          fechaRegistro(
                            orden,
                            "ordenes"
                          )
                        )}
                      />

                      <Dato
                        titulo="Estado"
                        valor={
                          orden.estado
                        }
                      />

                      <Dato
                        titulo="Código"
                        valor={primero(
                          orden.codigoOrden,
                          orden.numeroOrden,
                          orden.id
                        )}
                      />

                      <Dato
                        titulo="Total"
                        valor={moneda(
                          primero(
                            orden.total,
                            orden.montoTotal
                          )
                        )}
                      />

                      {items.length > 0 && (
                        <>
                          <h4>
                            Análisis incluidos
                          </h4>

                          <TablaDatos
                            columnas={[
                              "Análisis",
                              "Cantidad",
                            ]}
                            filas={items.map(
                              (item) => [
                                obtenerNombreItem(
                                  item,
                                  analisis
                                ),

                                String(
                                  obtenerCantidad(item)
                                ),
                              ]
                            )}
                          />
                        </>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>

          {/* ==========================================
              VENTAS
          ========================================== */}

          <div className="hp-card">
            <h3>
              Ventas
            </h3>

            {!historial?.ventas.length ? (
              <p>
                No existen ventas registradas.
              </p>
            ) : (
              historial.ventas.map(
                (venta) => {
                  const items =
                    obtenerItems(venta);

                  return (
                    <div
                      key={venta.id}
                      style={estilos.registro}
                    >
                      <h4
                        style={estilos.tituloRegistro}
                      >
                        Venta registrada
                      </h4>

                      <Dato
                        titulo="Fecha de venta"
                        valor={fechaTexto(
                          fechaRegistro(
                            venta,
                            "ventas"
                          )
                        )}
                      />

                      <Dato
                        titulo="Estado"
                        valor={
                          venta.estado
                        }
                      />

                      <Dato
                        titulo="Método de pago"
                        valor={
                          venta.metodoPago
                        }
                      />

                      <Dato
                        titulo="Total"
                        valor={moneda(
                          primero(
                            venta.total,
                            venta.montoTotal,
                            venta.totalVenta
                          )
                        )}
                      />

                      {items.length > 0 && (
                        <>
                          <h4>
                            Detalle de análisis
                          </h4>

                          <TablaDatos
                            columnas={[
                              "Análisis",
                              "Cantidad",
                              "Precio",
                              "Subtotal",
                            ]}
                            filas={items.map(
                              (item) => [
                                obtenerNombreItem(
                                  item,
                                  analisis
                                ),

                                String(
                                  obtenerCantidad(item)
                                ),

                                moneda(
                                  obtenerPrecio(item)
                                ),

                                moneda(
                                  obtenerSubtotal(item)
                                ),
                              ]
                            )}
                          />
                        </>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>

          {/* ==========================================
              MUESTRAS
          ========================================== */}

          <div className="hp-card">
            <h3>
              Muestras
            </h3>

            {!historial?.muestras.length ? (
              <p>
                No existen muestras registradas.
              </p>
            ) : (
              historial.muestras.map(
                (muestra) => {
                  const nombre =
                    nombreAnalisis(
                      muestra,
                      analisis
                    );

                  return (
                    <div
                      key={muestra.id}
                      style={estilos.registro}
                    >
                      <h4
                        style={estilos.tituloRegistro}
                      >
                        {mostrar(
                          primero(
                            muestra.tipoMuestra,
                            muestra.tipo
                          ),
                          "Muestra clínica"
                        )}
                      </h4>

                      <Dato
                        titulo="Fecha de toma"
                        valor={fechaTexto(
                          primero(
                            muestra.fechaToma,
                            muestra.fechaRegistro,
                            muestra.fecha
                          )
                        )}
                      />

                      <Dato
                        titulo="Fecha de recepción"
                        valor={fechaTexto(
                          muestra.fechaRecepcion
                        )}
                      />

                      <Dato
                        titulo="Estado"
                        valor={
                          muestra.estado
                        }
                      />

                      {nombre !==
                        "Análisis no identificado" && (
                        <Dato
                          titulo="Análisis relacionado"
                          valor={nombre}
                        />
                      )}

                      {muestra.motivoRechazo && (
                        <Dato
                          titulo="Motivo de rechazo"
                          valor={
                            muestra.motivoRechazo
                          }
                        />
                      )}

                      {muestra.observaciones && (
                        <Dato
                          titulo="Observaciones"
                          valor={
                            muestra.observaciones
                          }
                        />
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>

          {/* ==========================================
              RESULTADOS CLÍNICOS
          ========================================== */}

          <div className="hp-card">
            <h3>
              Resultados clínicos
            </h3>

            <p
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Historial de análisis realizados,
              fechas, parámetros, valores obtenidos,
              unidades y rangos de referencia.
            </p>

            {cargandoDetalles && (
              <div style={estilos.mensaje}>
                Consultando los valores clínicos
                registrados...
              </div>
            )}

            {erroresDetalles.length > 0 && (
              <div
                style={{
                  ...estilos.mensaje,
                  color: "#b45309",
                  marginTop: 12,
                }}
              >
                No se pudieron consultar todos
                los datos clínicos:
                {" "}
                {erroresDetalles.join(" | ")}
              </div>
            )}

            {!historial?.resultados.length ? (
              <p>
                No existen resultados clínicos
                registrados.
              </p>
            ) : (
              historial.resultados.map(
                (resultado) => {
                  const parametros =
                    detallesResultados[
                      resultado.id
                    ] || [];

                  const nombre =
                    nombreAnalisis(
                      resultado,
                      analisis
                    );

                  return (
                    <div
                      key={resultado.id}
                      style={estilos.registro}
                    >
                      {/* NOMBRE DEL ANÁLISIS */}

                      <h4
                        style={estilos.tituloRegistro}
                      >
                        {nombre}
                      </h4>

                      <span
                        style={estilos.etiqueta}
                      >
                        {mostrar(
                          resultado.estado
                        )}
                      </span>

                      {/* FECHAS */}

                      <div
                        style={{
                          marginTop: 15,
                        }}
                      >
                        <Dato
                          titulo="Fecha de registro"
                          valor={fechaTexto(
                            fechaRegistro(
                              resultado,
                              "resultados"
                            )
                          )}
                        />

                        <Dato
                          titulo="Fecha de validación"
                          valor={fechaTexto(
                            resultado.fechaValidacion
                          )}
                        />

                        <Dato
                          titulo="Estado"
                          valor={
                            resultado.estado
                          }
                        />
                      </div>

                      {/* PARÁMETROS */}

                      <h4
                        style={{
                          marginTop: 22,
                          marginBottom: 12,
                          color: "#19385f",
                        }}
                      >
                        Parámetros y resultados
                      </h4>

                      {cargandoDetalles ? (
                        <p>
                          Cargando parámetros...
                        </p>
                      ) : parametros.length === 0 ? (
                        <div
                          style={estilos.mensaje}
                        >
                          No se encontraron parámetros
                          individuales registrados.
                        </div>
                      ) : (
                        <TablaDatos
                          columnas={[
                            "Parámetro",
                            "Resultado",
                            "Unidad",
                            "Rango de referencia",
                            "Observación",
                          ]}
                          filas={parametros.map(
                            (parametro) => [
                              parametro.nombre,

                              <span
                                style={{
                                  fontWeight:
                                    parametro.anormal
                                      ? 800
                                      : 600,

                                  color:
                                    parametro.anormal
                                      ? "#dc2626"
                                      : "#19385f",
                                }}
                              >
                                {parametro.valor}

                                {parametro.anormal
                                  ? " *"
                                  : ""}
                              </span>,

                              parametro.unidad,

                              parametro.rango,

                              parametro.observacion,
                            ]
                          )}
                        />
                      )}

                      {/* OBSERVACIONES GENERALES */}

                      {primero(
                        resultado.observaciones,
                        resultado.observacion
                      ) && (
                        <div
                          style={
                            estilos.observacion
                          }
                        >
                          <strong>
                            Observaciones generales:
                          </strong>{" "}
                          {texto(
                            primero(
                              resultado.observaciones,
                              resultado.observacion
                            )
                          )}
                        </div>
                      )}

                      {/* VALIDACIÓN */}

                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 12,
                          borderTop:
                            "1px solid #e2e8f0",
                        }}
                      >
                        <Dato
                          titulo="Validado por"
                          valor={primero(
                            resultado.validadoPorNombre,
                            resultado.nombreValidador
                          )}
                        />

                        <Dato
                          titulo="Fecha de validación"
                          valor={fechaTexto(
                            resultado.fechaValidacion
                          )}
                        />
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}