import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../firebase/firebase";

import "./ResultadosRecepcion.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const texto = (valor) => {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
};

const primero = (...valores) => {
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
};

const mostrar = (valor, defecto = "No registrado") => {
  const resultado = texto(valor);
  return resultado || defecto;
};

const normalizar = (valor) =>
  texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const fechaTexto = (valor) => {
  if (!valor) return "Sin fecha";

  try {
    let fecha;

    if (typeof valor.toDate === "function") {
      fecha = valor.toDate();
    } else if (typeof valor.seconds === "number") {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor);
    }

    if (Number.isNaN(fecha.getTime())) {
      return "Sin fecha";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "Sin fecha";
  }
};

const documentos = (snapshot) =>
  snapshot.docs.map((documento) => ({
    ...documento.data(),
    id: documento.id,
  }));

const convertirLista = (valor) => {
  if (Array.isArray(valor)) {
    return valor.filter(Boolean);
  }

  if (valor && typeof valor === "object") {
    return Object.entries(valor).map(([id, datos]) => ({
      ...(datos && typeof datos === "object"
        ? datos
        : { valor: datos }),
      id,
    }));
  }

  return [];
};

const nombrePaciente = (paciente) => {
  if (!paciente) return "Paciente no identificado";

  const nombres = primero(
    paciente.nombres,
    paciente.nombre
  );

  const apellidos = primero(
    paciente.apellidos,
    paciente.apellido
  );

  return mostrar(
    primero(
      paciente.nombreCompleto,
      `${nombres} ${apellidos}`.trim()
    )
  );
};

const ciPaciente = (paciente) =>
  mostrar(
    primero(
      paciente?.ci,
      paciente?.carnet,
      paciente?.numeroDocumento
    ),
    "Sin CI"
  );

const obtenerIdParametro = (parametro) =>
  texto(
    primero(
      parametro?.parametroId,
      parametro?.idParametro,
      parametro?.id
    )
  );

const obtenerNombreParametro = (parametro) =>
  mostrar(
    primero(
      parametro?.nombreParametro,
      parametro?.nombre,
      parametro?.parametro,
      parametro?.descripcion
    ),
    "Parámetro"
  );

const obtenerRango = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  if (typeof valor !== "object") {
    return texto(valor);
  }

  const rangoAnidado = primero(
    valor.rangoReferencia,
    valor.rangoNormal,
    valor.referencia
  );

  if (rangoAnidado) {
    const rango = obtenerRango(rangoAnidado);

    if (rango) return rango;
  }

  const descripcion = primero(
    valor.textoReferencia,
    valor.descripcionRango,
    valor.rangoTexto
  );

  if (descripcion) {
    return texto(descripcion);
  }

  const minimo = primero(
    valor.minimo,
    valor.valorMinimo,
    valor.rangoMinimo,
    valor.min
  );

  const maximo = primero(
    valor.maximo,
    valor.valorMaximo,
    valor.rangoMaximo,
    valor.max
  );

  if (minimo !== "" && maximo !== "") {
    return `${minimo} - ${maximo}`;
  }

  if (minimo !== "") {
    return `Desde ${minimo}`;
  }

  if (maximo !== "") {
    return `Hasta ${maximo}`;
  }

  return "";
};

const coincidenParametros = (a, b) => {
  const idA = obtenerIdParametro(a);
  const idB = obtenerIdParametro(b);

  if (idA && idB && idA === idB) {
    return true;
  }

  const nombreA = normalizar(
    obtenerNombreParametro(a)
  );

  const nombreB = normalizar(
    obtenerNombreParametro(b)
  );

  return (
    nombreA !== "" &&
    nombreA !== "parametro" &&
    nombreA === nombreB
  );
};

const numero = (valor, defecto = 0) => {
  const resultado = Number(valor);

  return Number.isFinite(resultado)
    ? resultado
    : defecto;
};

const moneda = (valor) =>
  numero(valor).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ======================================================
// ESTILOS
// ======================================================

const estilos = {
  pagina: {
    minHeight: "100%",
    padding: "28px",
    background: "#f1f5f9",
    color: "#17365d",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  cabecera: {
    padding: "30px",
    background:
      "linear-gradient(120deg, #ffffff, #eaf2ff)",
    border: "1px solid #c7dcff",
    borderRadius: "18px",
    marginBottom: "24px",
  },

  titulo: {
    margin: "0 0 12px",
    fontSize: "29px",
    fontWeight: 800,
  },

  tarjeta: {
    background: "#ffffff",
    border: "1px solid #dbe5f1",
    borderRadius: "15px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow:
      "0 5px 20px rgba(15,23,42,0.04)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },

  boton: {
    background: "#2563eb",
    color: "#ffffff",
    padding: "11px 18px",
    border: "none",
    borderRadius: "9px",
    fontWeight: 700,
    cursor: "pointer",
  },

  botonSecundario: {
    background: "#e2e8f0",
    color: "#17365d",
    padding: "11px 18px",
    border: "none",
    borderRadius: "9px",
    fontWeight: 700,
    cursor: "pointer",
  },

  campo: {
    background: "#f3f7fc",
    borderRadius: "10px",
    padding: "15px",
    minWidth: 0,
    overflowWrap: "anywhere",
  },

  fondoModal: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    zIndex: 9999,
  },

  modal: {
    background: "#ffffff",
    width: "100%",
    maxWidth: "1000px",
    maxHeight: "92vh",
    overflowY: "auto",
    borderRadius: "18px",
    padding: "30px",
    boxSizing: "border-box",
  },

  seccion: {
    border: "1px solid #dbe5f1",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "18px",
  },

  tabla: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "15px",
  },

  celda: {
    border: "1px solid #dbe5f1",
    padding: "12px",
    textAlign: "left",
    fontSize: "13px",
  },
};

// ======================================================
// COMPONENTES VISUALES
// ======================================================

function Campo({ titulo, valor }) {
  return (
    <div style={estilos.campo}>
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
          marginBottom: "7px",
        }}
      >
        {titulo}
      </div>

      <strong style={{ fontSize: "15px" }}>
        {mostrar(valor)}
      </strong>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <section style={estilos.seccion}>
      <h3
        style={{
          marginTop: 0,
          fontSize: "18px",
        }}
      >
        {titulo}
      </h3>

      {children}
    </section>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ResultadosRecepcion({
  usuario,
  onVolver,
}) {
  const laboratorioId = texto(
    usuario?.laboratorioId
  );

  const [pacientes, setPacientes] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [muestras, setMuestras] = useState([]);

  const [
    pacienteSeleccionado,
    setPacienteSeleccionado,
  ] = useState(null);

  const [
    resultadoSeleccionado,
    setResultadoSeleccionado,
  ] = useState(null);

  const [
    ventaSeleccionada,
    setVentaSeleccionada,
  ] = useState(null);

  const [valores, setValores] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);

  const [
    cargandoDetalle,
    setCargandoDetalle,
  ] = useState(false);

  const [error, setError] = useState("");
  const [errorDetalle, setErrorDetalle] =
    useState("");

  // ====================================================
  // CONSULTAR COLECCIONES
  // ====================================================

  const consultarColeccion = useCallback(
    async (nombre) => {
      const referencia = query(
        collection(db, nombre),
        where(
          "laboratorioId",
          "==",
          laboratorioId
        )
      );

      const snapshot = await getDocs(referencia);

      return documentos(snapshot);
    },
    [laboratorioId]
  );

  const cargarDatos = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "No se identificó el laboratorio."
      );

      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [
        datosPacientes,
        datosResultados,
        datosVentas,
        datosAnalisis,
      ] = await Promise.all([
        consultarColeccion("pacientes"),
        consultarColeccion("resultados"),
        consultarColeccion("ventas"),
        consultarColeccion("analisis"),
      ]);

      setPacientes(datosPacientes);
      setResultados(datosResultados);
      setVentas(datosVentas);
      setAnalisis(datosAnalisis);

      try {
        const datosMuestras =
          await consultarColeccion("muestras");

        setMuestras(datosMuestras);
      } catch (err) {
        console.warn(
          "No se pudieron consultar muestras:",
          err
        );

        setMuestras([]);
      }
    } catch (err) {
      console.error(
        "Error cargando resultados:",
        err
      );

      setError(
        err.code === "permission-denied"
          ? "Firestore no permite consultar los datos."
          : err.message
      );
    } finally {
      setCargando(false);
    }
  }, [
    laboratorioId,
    consultarColeccion,
  ]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ====================================================
  // OBTENER ANÁLISIS Y MUESTRAS
  // ====================================================

  const obtenerAnalisis = (resultado) =>
    analisis.find(
      (item) =>
        texto(item.id) ===
        texto(resultado?.analisisId)
    );

  const obtenerMuestra = (resultado) =>
    muestras.find(
      (item) =>
        texto(item.id) ===
        texto(resultado?.muestraId)
    );

  const obtenerNombreAnalisis = (resultado) => {
    const actual = obtenerAnalisis(resultado);

    return mostrar(
      primero(
        resultado?.nombreAnalisis,
        resultado?.analisisNombre,
        actual?.nombre,
        actual?.nombreAnalisis
      ),
      "Análisis clínico"
    );
  };

  // ====================================================
  // OBTENER DETALLE DE LOS ANÁLISIS VENDIDOS
  // ====================================================

  const obtenerNombreItem = (item) => {
    if (typeof item === "string") {
      const encontrado = analisis.find(
        (a) => texto(a.id) === texto(item)
      );

      return mostrar(
        primero(
          encontrado?.nombre,
          encontrado?.nombreAnalisis
        ),
        "Análisis no identificado"
      );
    }

    const analisisId = texto(
      primero(
        item?.analisisId,
        item?.idAnalisis,
        item?.productoId
      )
    );

    const encontrado = analisis.find(
      (a) => texto(a.id) === analisisId
    );

    return mostrar(
      primero(
        item?.nombreAnalisis,
        item?.analisisNombre,
        item?.nombreProducto,
        item?.producto,
        item?.nombre,
        item?.descripcion,
        encontrado?.nombre,
        encontrado?.nombreAnalisis
      ),
      "Análisis no identificado"
    );
  };

  const obtenerItemsVenta = (venta) => {
    if (!venta) return [];

    const origen = primero(
      venta.detalles,
      venta.detalleVenta,
      venta.detallesVenta,
      venta.items,
      venta.productos,
      venta.analisisVendidos,
      venta.analisis,
      venta.servicios
    );

    let lista = [];

    if (Array.isArray(origen)) {
      lista = origen;
    } else if (
      origen &&
      typeof origen === "object"
    ) {
      lista = Object.values(origen);
    } else if (
      typeof origen === "string"
    ) {
      lista = [origen];
    }

    if (
      lista.length === 0 &&
      primero(
        venta.analisisId,
        venta.nombreAnalisis
      )
    ) {
      lista = [venta];
    }

    return lista.map((item, index) => {
      const datos =
        typeof item === "object" &&
        item !== null
          ? item
          : { analisisId: item };

      const cantidad = numero(
        primero(
          datos.cantidad,
          datos.cantidadAnalisis,
          1
        ),
        1
      );

      const precio = numero(
        primero(
          datos.precioUnitario,
          datos.precio,
          datos.costo,
          datos.monto,
          0
        )
      );

      const subtotal = numero(
        primero(
          datos.subtotal,
          datos.total,
          cantidad * precio
        )
      );

      return {
        id: texto(
          primero(
            datos.id,
            datos.analisisId,
            index
          )
        ),
        nombre: obtenerNombreItem(datos),
        cantidad,
        precio,
        subtotal,
      };
    });
  };

  const itemsVentaSeleccionada = useMemo(
    () => obtenerItemsVenta(ventaSeleccionada),
    [ventaSeleccionada, analisis]
  );

  const nombreVenta = (venta) => {
    const items = obtenerItemsVenta(venta);

    if (items.length === 0) {
      return "Detalle de venta no disponible";
    }

    return items.map((item) => item.nombre).join(", ");
  };

  // ====================================================
  // CONSULTAR VALORES REGISTRADOS
  // ====================================================

  useEffect(() => {
    if (!resultadoSeleccionado) {
      setValores([]);
      setErrorDetalle("");
      return;
    }

    let activo = true;

    const cargarValores = async () => {
      setCargandoDetalle(true);
      setErrorDetalle("");

      const integrados = convertirLista(
        primero(
          resultadoSeleccionado.valoresParametros,
          resultadoSeleccionado.parametros,
          resultadoSeleccionado.valores
        )
      );

      try {
        const referencia = collection(
          db,
          "resultados",
          resultadoSeleccionado.id,
          "valores"
        );

        const snapshot = await getDocs(referencia);

        const guardados = documentos(snapshot);

        if (activo) {
          setValores([
            ...guardados,
            ...integrados,
          ]);
        }
      } catch (err) {
        console.error(
          "Error consultando valores:",
          err
        );

        if (activo) {
          setValores(integrados);

          setErrorDetalle(
            err.code === "permission-denied"
              ? "Firestore no permite consultar los valores registrados."
              : "No se pudieron consultar todos los valores."
          );
        }
      } finally {
        if (activo) {
          setCargandoDetalle(false);
        }
      }
    };

    cargarValores();

    return () => {
      activo = false;
    };
  }, [resultadoSeleccionado]);

  // ====================================================
  // PARÁMETROS COMPLETOS
  // ====================================================

  const parametrosCompletos = useMemo(() => {
    if (!resultadoSeleccionado) {
      return [];
    }

    const analisisActual = analisis.find(
      (item) =>
        texto(item.id) ===
        texto(
          resultadoSeleccionado.analisisId
        )
    );

    const configurados = convertirLista(
      primero(
        analisisActual?.parametros,
        analisisActual?.parametrosConfigurados
      )
    );

    const todos = [];

    configurados.forEach((parametro) => {
      if (
        !todos.some((actual) =>
          coincidenParametros(
            actual,
            parametro
          )
        )
      ) {
        todos.push(parametro);
      }
    });

    valores.forEach((parametro) => {
      if (
        !todos.some((actual) =>
          coincidenParametros(
            actual,
            parametro
          )
        )
      ) {
        todos.push(parametro);
      }
    });

    return todos.map((parametro) => {
      const configuracion = configurados.find(
        (actual) =>
          coincidenParametros(
            actual,
            parametro
          )
      );

      const registrado = valores.find(
        (actual) =>
          coincidenParametros(
            actual,
            parametro
          )
      );

      const rango = primero(
        obtenerRango(configuracion),
        obtenerRango(registrado),
        obtenerRango(parametro)
      );

      return {
        id: obtenerIdParametro(parametro),

        nombre: obtenerNombreParametro(
          configuracion ||
          registrado ||
          parametro
        ),

        unidad: mostrar(
          primero(
            registrado?.unidad,
            configuracion?.unidad,
            parametro.unidad
          ),
          "Sin unidad"
        ),

        rango: mostrar(
          rango,
          "No configurado"
        ),
      };
    });
  }, [
    resultadoSeleccionado,
    analisis,
    valores,
  ]);

  // ====================================================
  // RESULTADO CLÍNICO PRINCIPAL
  // ====================================================

  const rangoPrincipal = useMemo(() => {
    if (!resultadoSeleccionado) {
      return "No configurado";
    }

    const directo = primero(
      obtenerRango(resultadoSeleccionado),
      obtenerRango(
        obtenerAnalisis(
          resultadoSeleccionado
        )
      )
    );

    if (directo) {
      return directo;
    }

    if (parametrosCompletos.length === 1) {
      return parametrosCompletos[0].rango;
    }

    if (parametrosCompletos.length > 1) {
      return "Ver rangos en los parámetros";
    }

    return "No configurado";
  }, [
    resultadoSeleccionado,
    parametrosCompletos,
    analisis,
  ]);

  const valorPrincipal = useMemo(() => {
    return mostrar(
      primero(
        resultadoSeleccionado?.valorResultado,
        resultadoSeleccionado?.valor
      )
    );
  }, [resultadoSeleccionado]);

  const observacionPrincipal = useMemo(() => {
    return mostrar(
      primero(
        resultadoSeleccionado?.observaciones,
        resultadoSeleccionado?.observacion
      ),
      "Sin observaciones"
    );
  }, [resultadoSeleccionado]);

  // ====================================================
  // FILTRAR PACIENTES
  // ====================================================

  const pacientesFiltrados = useMemo(() => {
    const buscar = normalizar(busqueda);

    return pacientes.filter((paciente) =>
      normalizar(
        `${nombrePaciente(paciente)} ${
          ciPaciente(paciente)
        }`
      ).includes(buscar)
    );
  }, [
    pacientes,
    busqueda,
  ]);

  const resultadosPaciente = useMemo(() => {
    if (!pacienteSeleccionado) {
      return [];
    }

    return resultados.filter(
      (resultado) =>
        texto(resultado.pacienteId) ===
          texto(pacienteSeleccionado.id) &&
        (
          normalizar(resultado.estado) ===
            "validado" ||
          resultado.validado === true
        )
    );
  }, [
    resultados,
    pacienteSeleccionado,
  ]);

  const ventasPaciente = useMemo(() => {
    if (!pacienteSeleccionado) {
      return [];
    }

    return ventas.filter(
      (venta) =>
        texto(venta.pacienteId) ===
        texto(pacienteSeleccionado.id)
    );
  }, [
    ventas,
    pacienteSeleccionado,
  ]);

  // ====================================================
  // DESCARGAR PDF DE NOTA DE VENTA
  // ====================================================

  const descargarVenta = (venta) => {
    if (!venta) return;

    const pdf = new jsPDF();

    const items = obtenerItemsVenta(venta);

    const paciente = nombrePaciente(
      pacienteSeleccionado
    );

    const ci = ciPaciente(
      pacienteSeleccionado
    );

    const fecha = fechaTexto(
      primero(
        venta.fechaVenta,
        venta.fecha,
        venta.createdAt
      )
    );

    const total = numero(
      primero(
        venta.total,
        venta.montoTotal,
        venta.totalVenta,
        0
      )
    );

    pdf.setFillColor(25, 56, 95);
    pdf.rect(0, 0, 210, 38, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(19);
    pdf.setFont("helvetica", "bold");

    pdf.text(
      "NOTA DE VENTA",
      105,
      20,
      { align: "center" }
    );

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    pdf.text(
      "Laboratorio Clinico",
      105,
      29,
      { align: "center" }
    );

    pdf.setTextColor(23, 54, 93);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");

    pdf.text(
      "INFORMACION DE LA VENTA",
      15,
      51
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    pdf.text(
      `Venta: ${mostrar(venta.id)}`,
      15,
      61
    );

    pdf.text(
      `Paciente: ${paciente}`,
      15,
      69
    );

    pdf.text(
      `CI: ${ci}`,
      15,
      77
    );

    pdf.text(
      `Fecha: ${fecha}`,
      15,
      85
    );

    pdf.setFont("helvetica", "bold");

    pdf.text(
      "DETALLE DE ANALISIS VENDIDOS",
      15,
      99
    );

    const filas = items.map((item) => [
      item.nombre,
      String(item.cantidad),
      `Bs ${moneda(item.precio)}`,
      `Bs ${moneda(item.subtotal)}`,
    ]);

    if (filas.length === 0) {
      filas.push([
        "Detalle no disponible",
        "-",
        "-",
        "-",
      ]);
    }

    autoTable(pdf, {
      startY: 105,

      head: [[
        "Analisis",
        "Cantidad",
        "Precio unitario",
        "Subtotal",
      ]],

      body: filas,

      theme: "grid",

      headStyles: {
        fillColor: [25, 56, 95],
        textColor: [255, 255, 255],
      },

      styles: {
        fontSize: 9,
        cellPadding: 4,
      },

      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });

    const posicionFinal =
      pdf.lastAutoTable?.finalY || 120;

    let y = posicionFinal + 15;

    if (y > 270) {
      pdf.addPage();
      y = 25;
    }

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");

    pdf.text(
      `TOTAL: Bs ${moneda(total)}`,
      195,
      y,
      { align: "right" }
    );

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    pdf.text(
      "Documento generado por el sistema del laboratorio clinico.",
      105,
      285,
      { align: "center" }
    );

    pdf.save(
      `Nota_Venta_${venta.id}.pdf`
    );
  };

  // ====================================================
  // DESCARGAR PDF DEL RESULTADO
  // ====================================================

  const descargarResultado = (resultado) => {
    if (!resultado) return;

    const pdf = new jsPDF();

    const muestraActual =
      obtenerMuestra(resultado);

    const analisisActual =
      obtenerAnalisis(resultado);

    pdf.setFillColor(25, 56, 95);
    pdf.rect(0, 0, 210, 38, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");

    pdf.text(
      "RESULTADO CLINICO",
      105,
      22,
      { align: "center" }
    );

    pdf.setTextColor(23, 54, 93);

    const filas = [
      [
        "Paciente",
        nombrePaciente(
          pacienteSeleccionado
        ),
      ],
      [
        "CI",
        ciPaciente(
          pacienteSeleccionado
        ),
      ],
      [
        "Analisis",
        obtenerNombreAnalisis(resultado),
      ],
      [
        "Descripcion",
        mostrar(
          analisisActual?.descripcion
        ),
      ],
      [
        "Tipo de muestra",
        mostrar(
          primero(
            muestraActual?.tipoMuestra,
            resultado.tipoMuestra
          )
        ),
      ],
      [
        "Valor registrado",
        valorPrincipal,
      ],
      [
        "Unidad",
        mostrar(resultado.unidad),
      ],
      [
        "Rango de referencia",
        rangoPrincipal,
      ],
      [
        "Estado",
        mostrar(resultado.estado),
      ],
      [
        "Observaciones",
        observacionPrincipal,
      ],
      [
        "Validado por",
        mostrar(
          primero(
            resultado.validadoPorNombre,
            resultado.nombreValidador
          )
        ),
      ],
      [
        "Fecha de validacion",
        fechaTexto(
          resultado.fechaValidacion
        ),
      ],
    ];

    autoTable(pdf, {
      startY: 48,

      head: [[
        "Campo",
        "Informacion",
      ]],

      body: filas,

      theme: "grid",

      headStyles: {
        fillColor: [25, 56, 95],
      },

      styles: {
        fontSize: 9,
      },
    });

    if (parametrosCompletos.length > 0) {
      const posicion =
        pdf.lastAutoTable?.finalY || 180;

      autoTable(pdf, {
        startY: posicion + 15,

        head: [[
          "Parametro",
          "Unidad",
          "Rango de referencia",
        ]],

        body: parametrosCompletos.map(
          (parametro) => [
            parametro.nombre,
            parametro.unidad,
            parametro.rango,
          ]
        ),

        theme: "grid",

        headStyles: {
          fillColor: [25, 56, 95],
        },
      });
    }

    pdf.save(
      `Resultado_${resultado.id}.pdf`
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div style={estilos.pagina}>

      <header style={estilos.cabecera}>
        <h1 style={estilos.titulo}>
          Resultados de pacientes
        </h1>

        <p
          style={{
            margin: 0,
            color: "#64748b",
          }}
        >
          Consulta resultados clínicos,
          rangos de referencia y notas de venta.
        </p>
      </header>

      {error && (
        <div style={estilos.tarjeta}>
          <p style={{ color: "#dc2626" }}>
            {error}
          </p>
        </div>
      )}

      {cargando ? (
        <div style={estilos.tarjeta}>
          Cargando información...
        </div>
      ) : !pacienteSeleccionado ? (
        <div style={estilos.tarjeta}>
          <h2>Buscar pacientes</h2>

          <input
            type="text"
            placeholder="Buscar por nombre, apellido o CI..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            style={{
              width: "100%",
              padding: "14px",
              border:
                "1px solid #cbd5e1",
              borderRadius: "9px",
              marginBottom: "20px",
              boxSizing: "border-box",
            }}
          />

          <div style={estilos.grid}>
            {pacientesFiltrados.map(
              (paciente) => (
                <div
                  key={paciente.id}
                  style={estilos.tarjeta}
                >
                  <h3>
                    {nombrePaciente(
                      paciente
                    )}
                  </h3>

                  <p>
                    CI: {ciPaciente(
                      paciente
                    )}
                  </p>

                  <button
                    type="button"
                    style={estilos.boton}
                    onClick={() =>
                      setPacienteSeleccionado(
                        paciente
                      )
                    }
                  >
                    Ver resultados
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            style={{
              ...estilos.botonSecundario,
              marginBottom: "15px",
            }}
            onClick={() => {
              setPacienteSeleccionado(null);
              setResultadoSeleccionado(null);
              setVentaSeleccionada(null);
            }}
          >
            ← Volver a pacientes
          </button>

          <div style={estilos.tarjeta}>
            <h2 style={{ marginTop: 0 }}>
              {nombrePaciente(
                pacienteSeleccionado
              )}
            </h2>

            <p style={{ marginBottom: 0 }}>
              CI: {ciPaciente(
                pacienteSeleccionado
              )}
            </p>
          </div>

          <div style={estilos.tarjeta}>
            <h2>Resultados clínicos</h2>

            {resultadosPaciente.length === 0 ? (
              <p>
                No existen resultados validados.
              </p>
            ) : (
              <div style={estilos.grid}>
                {resultadosPaciente.map(
                  (resultado) => (
                    <div
                      key={resultado.id}
                      style={{
                        ...estilos.tarjeta,
                        marginBottom: 0,
                      }}
                    >
                      <h3>
                        {obtenerNombreAnalisis(
                          resultado
                        )}
                      </h3>

                      <p>
                        <strong>
                          Estado:
                        </strong>{" "}
                        {mostrar(
                          resultado.estado
                        )}
                      </p>

                      <p>
                        <strong>
                          Fecha:
                        </strong>{" "}
                        {fechaTexto(
                          primero(
                            resultado.fechaValidacion,
                            resultado.fechaRegistro
                          )
                        )}
                      </p>

                      <button
                        type="button"
                        style={estilos.boton}
                        onClick={() =>
                          setResultadoSeleccionado(
                            resultado
                          )
                        }
                      >
                        Ver resultado
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div style={estilos.tarjeta}>
            <h2>Notas de venta</h2>

            {ventasPaciente.length === 0 ? (
              <p>
                No existen notas de venta.
              </p>
            ) : (
              <div style={estilos.grid}>
                {ventasPaciente.map(
                  (venta) => (
                    <div
                      key={venta.id}
                      style={{
                        ...estilos.tarjeta,
                        marginBottom: 0,
                      }}
                    >
                      <h3>
                        {nombreVenta(venta)}
                      </h3>

                      <p>
                        <strong>
                          Fecha:
                        </strong>{" "}
                        {fechaTexto(
                          primero(
                            venta.fechaVenta,
                            venta.fecha
                          )
                        )}
                      </p>

                      <p>
                        <strong>
                          Total:
                        </strong>{" "}
                        Bs{" "}
                        {moneda(
                          primero(
                            venta.total,
                            venta.montoTotal,
                            0
                          )
                        )}
                      </p>

                      <button
                        type="button"
                        style={estilos.boton}
                        onClick={() =>
                          setVentaSeleccionada(
                            venta
                          )
                        }
                      >
                        Ver nota de venta
                      </button>

                      <button
                        type="button"
                        style={{
                          ...estilos.botonSecundario,
                          marginLeft: "10px",
                        }}
                        onClick={() =>
                          descargarVenta(venta)
                        }
                      >
                        Descargar PDF
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==============================================
          MODAL RESULTADO CLÍNICO
      ============================================== */}

      {resultadoSeleccionado && (
        <div
          style={estilos.fondoModal}
          onClick={() =>
            setResultadoSeleccionado(null)
          }
        >
          <div
            style={estilos.modal}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "15px",
              }}
            >
              <h2 style={{ margin: 0 }}>
                Detalle completo del resultado clínico
              </h2>

              <button
                type="button"
                style={estilos.botonSecundario}
                onClick={() =>
                  setResultadoSeleccionado(null)
                }
              >
                ✕
              </button>
            </div>

            <Seccion titulo="1. Información del paciente">
              <div style={estilos.grid}>
                <Campo
                  titulo="Paciente"
                  valor={nombrePaciente(
                    pacienteSeleccionado
                  )}
                />

                <Campo
                  titulo="CI"
                  valor={ciPaciente(
                    pacienteSeleccionado
                  )}
                />
              </div>
            </Seccion>

            <Seccion titulo="2. Información del análisis">
              <div style={estilos.grid}>
                <Campo
                  titulo="Análisis"
                  valor={obtenerNombreAnalisis(
                    resultadoSeleccionado
                  )}
                />

                <Campo
                  titulo="Descripción"
                  valor={
                    obtenerAnalisis(
                      resultadoSeleccionado
                    )?.descripcion
                  }
                />
              </div>
            </Seccion>

            <Seccion titulo="3. Información de la muestra">
              <div style={estilos.grid}>
                <Campo
                  titulo="Tipo de muestra"
                  valor={primero(
                    obtenerMuestra(
                      resultadoSeleccionado
                    )?.tipoMuestra,
                    resultadoSeleccionado.tipoMuestra
                  )}
                />

                <Campo
                  titulo="Estado de muestra"
                  valor={
                    obtenerMuestra(
                      resultadoSeleccionado
                    )?.estado
                  }
                />

                <Campo
                  titulo="Fecha de toma"
                  valor={fechaTexto(
                    obtenerMuestra(
                      resultadoSeleccionado
                    )?.fechaToma
                  )}
                />
              </div>
            </Seccion>

            <Seccion titulo="4. Resultado clínico">
              <div style={estilos.grid}>
                <Campo
                  titulo="Valor registrado"
                  valor={valorPrincipal}
                />

                <Campo
                  titulo="Unidad"
                  valor={
                    resultadoSeleccionado.unidad
                  }
                />

                <Campo
                  titulo="Rango de referencia"
                  valor={rangoPrincipal}
                />

                <Campo
                  titulo="Estado"
                  valor={
                    resultadoSeleccionado.estado
                  }
                />

                <Campo
                  titulo="Fecha de registro"
                  valor={fechaTexto(
                    resultadoSeleccionado.fechaRegistro
                  )}
                />

                <Campo
                  titulo="Observaciones"
                  valor={observacionPrincipal}
                />
              </div>
            </Seccion>

            {!cargandoDetalle &&
              parametrosCompletos.length > 0 && (
                <Seccion titulo="5. Valores de los parámetros">
                  {errorDetalle && (
                    <p
                      style={{
                        color: "#b45309",
                      }}
                    >
                      {errorDetalle}
                    </p>
                  )}

                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table style={estilos.tabla}>
                      <thead>
                        <tr>
                          {[
                            "Parámetro",
                            "Unidad",
                            "Rango de referencia",
                          ].map((titulo) => (
                            <th
                              key={titulo}
                              style={{
                                ...estilos.celda,
                                background:
                                  "#eaf2ff",
                              }}
                            >
                              {titulo}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {parametrosCompletos.map(
                          (parametro, index) => (
                            <tr
                              key={`${parametro.id}-${index}`}
                            >
                              <td style={estilos.celda}>
                                {parametro.nombre}
                              </td>

                              <td style={estilos.celda}>
                                {parametro.unidad}
                              </td>

                              <td style={estilos.celda}>
                                {parametro.rango}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </Seccion>
              )}

            <Seccion titulo="6. Validación del resultado">
              <div style={estilos.grid}>
                <Campo
                  titulo="Estado"
                  valor={
                    resultadoSeleccionado.estado
                  }
                />

                <Campo
                  titulo="Validado por"
                  valor={primero(
                    resultadoSeleccionado.validadoPorNombre,
                    resultadoSeleccionado.nombreValidador
                  )}
                />

                <Campo
                  titulo="Fecha de validación"
                  valor={fechaTexto(
                    resultadoSeleccionado.fechaValidacion
                  )}
                />
              </div>
            </Seccion>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "25px",
              }}
            >
              <button
                type="button"
                style={estilos.boton}
                onClick={() =>
                  descargarResultado(
                    resultadoSeleccionado
                  )
                }
              >
                Descargar PDF
              </button>

              <button
                type="button"
                style={estilos.botonSecundario}
                onClick={() =>
                  setResultadoSeleccionado(null)
                }
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================
          MODAL NOTA DE VENTA
      ============================================== */}

      {ventaSeleccionada && (
        <div
          style={estilos.fondoModal}
          onClick={() =>
            setVentaSeleccionada(null)
          }
        >
          <div
            style={{
              ...estilos.modal,
              maxWidth: "850px",
            }}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>
              Detalle de la nota de venta
            </h2>

            <Seccion titulo="Información de venta">
              <div style={estilos.grid}>
                <Campo
                  titulo="Análisis vendidos"
                  valor={nombreVenta(
                    ventaSeleccionada
                  )}
                />

                <Campo
                  titulo="Paciente"
                  valor={nombrePaciente(
                    pacienteSeleccionado
                  )}
                />

                <Campo
                  titulo="CI"
                  valor={ciPaciente(
                    pacienteSeleccionado
                  )}
                />

                <Campo
                  titulo="Fecha"
                  valor={fechaTexto(
                    primero(
                      ventaSeleccionada.fechaVenta,
                      ventaSeleccionada.fecha
                    )
                  )}
                />

                <Campo
                  titulo="Total"
                  valor={`Bs ${moneda(
                    primero(
                      ventaSeleccionada.total,
                      ventaSeleccionada.montoTotal,
                      0
                    )
                  )}`}
                />
              </div>
            </Seccion>

            <Seccion titulo="Detalle de análisis vendidos">
              {itemsVentaSeleccionada.length === 0 ? (
                <p>
                  No se encontraron detalles de los
                  análisis vendidos en esta venta.
                </p>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table style={estilos.tabla}>
                    <thead>
                      <tr>
                        {[
                          "Análisis",
                          "Cantidad",
                          "Precio",
                          "Subtotal",
                        ].map((titulo) => (
                          <th
                            key={titulo}
                            style={{
                              ...estilos.celda,
                              background:
                                "#eaf2ff",
                            }}
                          >
                            {titulo}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {itemsVentaSeleccionada.map(
                        (item, index) => (
                          <tr key={index}>
                            <td style={estilos.celda}>
                              {item.nombre}
                            </td>

                            <td style={estilos.celda}>
                              {item.cantidad}
                            </td>

                            <td style={estilos.celda}>
                              Bs {moneda(item.precio)}
                            </td>

                            <td style={estilos.celda}>
                              Bs {moneda(item.subtotal)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "25px",
              }}
            >
              <button
                type="button"
                style={estilos.boton}
                onClick={() =>
                  descargarVenta(
                    ventaSeleccionada
                  )
                }
              >
                Descargar PDF
              </button>

              <button
                type="button"
                style={estilos.botonSecundario}
                onClick={() =>
                  setVentaSeleccionada(null)
                }
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}