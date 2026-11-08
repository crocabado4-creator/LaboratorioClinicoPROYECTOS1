import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../firebase/firebase";
import "./ResultadosRecepcion.css";

// ======================================================
// UTILIDADES
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

const mostrar = (valor, defecto = "No registrado") =>
  texto(valor) || defecto;

const normalizar = (valor) =>
  texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const fechaObjeto = (valor) => {
  if (!valor) return null;

  try {
    let fecha;

    if (typeof valor.toDate === "function") {
      fecha = valor.toDate();
    } else if (typeof valor.seconds === "number") {
      fecha = new Date(valor.seconds * 1000);
    } else {
      fecha = new Date(valor);
    }

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  } catch {
    return null;
  }
};

const fechaTexto = (valor) => {
  const fecha = fechaObjeto(valor);
  return fecha ? fecha.toLocaleString("es-BO") : "No registrada";
};

const fechaCorta = (valor) => {
  const fecha = fechaObjeto(valor);
  return fecha ? fecha.toLocaleDateString("es-BO") : "No registrada";
};

const lista = (valor) => {
  if (Array.isArray(valor)) {
    return valor.filter((item) => item !== null && item !== undefined);
  }

  if (valor && typeof valor === "object") {
    return Object.entries(valor).map(([clave, dato]) => {
      if (dato && typeof dato === "object" && !Array.isArray(dato)) {
        return {
          ...dato,
          _clave: clave,
        };
      }

      return {
        _clave: clave,
        valor: dato,
      };
    });
  }

  return [];
};

const nombrePaciente = (paciente) => {
  if (!paciente) return "Paciente no identificado";

  const completo = primero(
    paciente.nombreCompleto,
    paciente.nombrePaciente
  );

  if (completo) return texto(completo);

  return mostrar(
    `${texto(primero(paciente.nombres, paciente.nombre))} ${texto(
      primero(paciente.apellidos, paciente.apellido)
    )}`.trim(),
    "Paciente no identificado"
  );
};

const ciPaciente = (paciente) =>
  mostrar(
    primero(
      paciente?.ci,
      paciente?.carnet,
      paciente?.numeroDocumento
    )
  );

const correoPaciente = (paciente) =>
  mostrar(
    primero(
      paciente?.correo,
      paciente?.email,
      paciente?.correoElectronico
    )
  );

const edadPaciente = (paciente) => {
  const edad = primero(paciente?.edad, paciente?.edadAnios);

  if (edad !== "") return `${edad} años`;

  const nacimiento = fechaObjeto(paciente?.fechaNacimiento);

  if (!nacimiento) return "No registrada";

  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();

  if (
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() < nacimiento.getDate())
  ) {
    anios--;
  }

  return anios >= 0 ? `${anios} años` : "No registrada";
};

const moneda = (valor) => {
  const numero = Number(valor);

  return (Number.isFinite(numero) ? numero : 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ======================================================
// CAMPOS UTILIZADOS POR LOS RESULTADOS
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

const obtenerIdParametro = (dato) =>
  texto(
    primero(
      dato?.parametroId,
      dato?.idParametro,
      dato?.codigoParametro,
      dato?.codigo,
      dato?.id,
      dato?._clave
    )
  );

const obtenerNombreParametro = (dato) => {
  if (typeof dato === "string") return dato;

  return texto(
    primero(
      dato?.nombreParametro,
      dato?.parametroNombre,
      dato?.nombre,
      dato?.parametro,
      dato?.analito,
      dato?.descripcion,
      dato?.nombreAnalisis
    )
  );
};

const obtenerUnidad = (dato) =>
  texto(
    primero(
      dato?.unidadMedida,
      dato?.unidad,
      dato?.unidades
    )
  );

const obtenerRango = (dato, profundidad = 0) => {
  if (
    dato === null ||
    dato === undefined ||
    dato === "" ||
    profundidad > 4
  ) {
    return "";
  }

  if (typeof dato === "string" || typeof dato === "number") {
    return texto(dato);
  }

  if (typeof dato !== "object" || Array.isArray(dato)) {
    return "";
  }

  const referencia = primero(
    dato.rangoReferencia,
    dato.rangoNormal,
    dato.referencia,
    dato.rango,
    dato.valoresReferencia
  );

  if (referencia !== "" && referencia !== dato) {
    const encontrado = obtenerRango(referencia, profundidad + 1);
    if (encontrado) return encontrado;
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

  if (minimo !== "" && maximo !== "") {
    return `${minimo} - ${maximo}`;
  }

  if (minimo !== "") return `Desde ${minimo}`;
  if (maximo !== "") return `Hasta ${maximo}`;

  return texto(
    primero(
      dato.textoReferencia,
      dato.descripcionRango,
      dato.rangoTexto
    )
  );
};

const extraerValor = (dato, profundidad = 0) => {
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

  if (Array.isArray(dato) || typeof dato !== "object") {
    return "";
  }

  for (const campo of CAMPOS_VALOR) {
    const valor = dato[campo];

    if (
      valor !== null &&
      valor !== undefined &&
      valor !== ""
    ) {
      const encontrado = extraerValor(valor, profundidad + 1);

      if (encontrado !== "") return encontrado;
    }
  }

  return "";
};

const extraerRegistros = (documento) => {
  if (!documento || typeof documento !== "object") return [];

  const encontrados = [];

  for (const campo of CAMPOS_LISTAS) {
    const valor = documento[campo];

    if (Array.isArray(valor)) {
      encontrados.push(...lista(valor));
    } else if (valor && typeof valor === "object") {
      encontrados.push(...lista(valor));
    }
  }

  return encontrados;
};

const coincidenParametros = (a, b) => {
  const idA = obtenerIdParametro(a);
  const idB = obtenerIdParametro(b);

  if (idA && idB && idA === idB) return true;

  const nombreA = normalizar(obtenerNombreParametro(a));
  const nombreB = normalizar(obtenerNombreParametro(b));

  return Boolean(nombreA && nombreB && nombreA === nombreB);
};

const evaluarRango = (valor, rango) => {
  const numeroTexto = texto(valor).replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(numeroTexto)) return null;

  const referencia = texto(rango).replace(/,/g, ".");

  const coincidencia = referencia.match(
    /^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/
  );

  if (!coincidencia) return null;

  const numero = Number(numeroTexto);
  const minimo = Number(coincidencia[1]);
  const maximo = Number(coincidencia[2]);

  return numero < minimo || numero > maximo;
};

// ======================================================
// CONSTRUIR RESULTADOS REALES
// ======================================================

const construirParametros = (
  resultado,
  analisis,
  registrosAdicionales = []
) => {
  const configurados = [
    ...lista(analisis?.parametros),
    ...lista(analisis?.parametrosConfigurados),
  ];

  const registrados = [
    ...extraerRegistros(resultado),
    ...registrosAdicionales,
  ];

  const filas = [];

  const agregarFila = (registro, configuracion = null) => {
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

    const fila = {
      id: primero(
        obtenerIdParametro(registro),
        obtenerIdParametro(configuracion),
        nombre
      ),
      nombre: mostrar(nombre, "Resultado clínico"),
      valor: valor !== "" ? texto(valor) : "Sin resultado registrado",
      unidad: mostrar(unidad, "-"),
      rango: mostrar(rango, "-"),
      registrado: valor !== "",
      anormal: evaluarRango(valor, rango) === true,
      observacion: mostrar(
        primero(
          registro?.observacion,
          registro?.observaciones
        ),
        "-"
      ),
    };

    filas.push(fila);
  };

  // Prioridad 1: resultados efectivamente registrados.
  for (const registro of registrados) {
    const configuracion = configurados.find((item) =>
      coincidenParametros(item, registro)
    );

    agregarFila(registro, configuracion);
  }

  // Prioridad 2: resultado directo del documento clínico.
  if (filas.length === 0) {
    const valorPrincipal = extraerValor(resultado);

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

  // Prioridad 3: parámetros configurados sin resultado encontrado.
  if (filas.length === 0) {
    configurados.forEach((parametro) => {
      agregarFila(parametro, parametro);
    });
  } else {
    // Agregar únicamente parámetros configurados que no tengan registro.
    configurados.forEach((parametro) => {
      const existe = filas.some(
        (fila) =>
          (obtenerIdParametro(parametro) &&
            fila.id === obtenerIdParametro(parametro)) ||
          normalizar(fila.nombre) ===
            normalizar(obtenerNombreParametro(parametro))
      );

      if (!existe) {
        agregarFila(parametro, parametro);
      }
    });
  }

  // Evitar duplicados exactos.
  return filas.filter((fila, indice, arreglo) => {
    return (
      arreglo.findIndex(
        (item) =>
          item.id === fila.id &&
          item.nombre === fila.nombre &&
          item.valor === fila.valor
      ) === indice
    );
  });
};

// ======================================================
// PDF
// ======================================================

const colorPDF = (color) => {
  const valor = texto(color);

  if (!/^#[0-9a-fA-F]{6}$/.test(valor)) {
    return [37, 99, 235];
  }

  return [
    parseInt(valor.substring(1, 3), 16),
    parseInt(valor.substring(3, 5), 16),
    parseInt(valor.substring(5, 7), 16),
  ];
};

const cargarLogo = async (url) => {
  if (!url || typeof url !== "string") return null;

  return new Promise((resolve) => {
    const imagen = new Image();
    imagen.crossOrigin = "anonymous";

    imagen.onload = () => {
      try {
        const canvas = document.createElement("canvas");

        canvas.width = imagen.naturalWidth;
        canvas.height = imagen.naturalHeight;

        const contexto = canvas.getContext("2d");

        if (!contexto) {
          resolve(null);
          return;
        }

        contexto.drawImage(imagen, 0, 0);

        resolve({
          data: canvas.toDataURL("image/png"),
          ancho: imagen.naturalWidth,
          alto: imagen.naturalHeight,
        });
      } catch {
        resolve(null);
      }
    };

    imagen.onerror = () => resolve(null);
    imagen.src = url;
  });
};

const encabezadoPDF = (pdf, laboratorio, logo, titulo) => {
  const ancho = pdf.internal.pageSize.getWidth();
  const color = colorPDF(laboratorio?.colorPrimario);

  pdf.setFillColor(...color);
  pdf.rect(0, 0, ancho, 5, "F");

  pdf.setFillColor(247, 250, 253);
  pdf.rect(12, 11, ancho - 24, 37, "F");

  pdf.setDrawColor(218, 227, 236);
  pdf.rect(12, 11, ancho - 24, 37);

  if (logo) {
    try {
      let anchoLogo = 29;
      let altoLogo = (29 * logo.alto) / logo.ancho;

      if (altoLogo > 29) {
        altoLogo = 29;
        anchoLogo = (29 * logo.ancho) / logo.alto;
      }

      pdf.addImage(
        logo.data,
        "PNG",
        16 + (30 - anchoLogo) / 2,
        15 + (29 - altoLogo) / 2,
        anchoLogo,
        altoLogo
      );
    } catch (error) {
      console.warn("No se pudo dibujar el logo:", error);
    }
  }

  const nombre = mostrar(
    primero(laboratorio?.nombreVisible, laboratorio?.nombre),
    "LABORATORIO CLÍNICO"
  );

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...color);

  const lineasNombre = pdf.splitTextToSize(
    nombre.toUpperCase(),
    140
  );

  pdf.text(lineasNombre.slice(0, 2), 51, 19);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(65, 78, 91);

  let y = lineasNombre.length > 1 ? 30 : 25;

  const datos = [
    laboratorio?.direccion,
    laboratorio?.telefono
      ? `Tel.: ${laboratorio.telefono}`
      : "",
    primero(laboratorio?.email, laboratorio?.correo),
  ].filter(Boolean);

  datos.forEach((dato) => {
    pdf.text(
      pdf.splitTextToSize(texto(dato), 140).slice(0, 2),
      51,
      y
    );

    y += 4;
  });

  pdf.setFillColor(...color);
  pdf.roundedRect(12, 51, ancho - 24, 12, 2, 2, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);

  pdf.text(titulo, ancho / 2, 58.5, {
    align: "center",
  });
};

const piePDF = (pdf, laboratorio) => {
  const paginas = pdf.internal.getNumberOfPages();
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();

  const nombre = mostrar(
    primero(laboratorio?.nombreVisible, laboratorio?.nombre),
    "Laboratorio Clínico"
  );

  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina);

    pdf.setDrawColor(210, 220, 230);
    pdf.line(12, alto - 20, ancho - 12, alto - 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 110, 120);

    pdf.text(nombre.substring(0, 35), 12, alto - 14);

    pdf.text(
      `Impreso: ${fechaTexto(new Date())}`,
      ancho / 2,
      alto - 14,
      { align: "center" }
    );

    pdf.text(`${pagina} / ${paginas}`, ancho - 12, alto - 14, {
      align: "right",
    });

    pdf.setFontSize(6.5);

    pdf.text(
      "Documento generado con la información registrada en el sistema.",
      ancho / 2,
      alto - 9,
      { align: "center" }
    );
  }
};

const datosPacientePDF = (pdf, paciente, fecha) => {
  autoTable(pdf, {
    startY: 68,
    margin: {
      left: 12,
      right: 12,
      bottom: 25,
    },
    theme: "grid",
    body: [
      [
        "PACIENTE",
        nombrePaciente(paciente),
        "EDAD",
        edadPaciente(paciente),
      ],
      [
        "CI",
        ciPaciente(paciente),
        "SEXO",
        mostrar(paciente?.sexo),
      ],
      [
        "CORREO",
        correoPaciente(paciente),
        "FECHA",
        fechaCorta(fecha),
      ],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [215, 225, 235],
      lineWidth: 0.2,
      textColor: [42, 55, 69],
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: [242, 246, 250],
        cellWidth: 23,
      },
      1: {
        cellWidth: 75,
      },
      2: {
        fontStyle: "bold",
        fillColor: [242, 246, 250],
        cellWidth: 20,
      },
    },
  });

  return pdf.lastAutoTable.finalY;
};

const tituloSeccionPDF = (pdf, titulo, posicionY, color) => {
  let y = posicionY;

  if (y + 13 > 270) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFillColor(235, 242, 248);
  pdf.roundedRect(12, y, 186, 9, 1.5, 1.5, "F");

  pdf.setFillColor(...color);
  pdf.rect(12, y, 2.5, 9, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...color);

  pdf.text(
    pdf.splitTextToSize(titulo.toUpperCase(), 170)[0],
    18,
    y + 6
  );

  return y + 13;
};

// ======================================================
// ESTILOS
// ======================================================

const estilos = {
  pagina: {
    minHeight: "100vh",
    padding: 28,
    background: "#f1f5f9",
    fontFamily: "Arial, sans-serif",
    color: "#17365d",
    boxSizing: "border-box",
  },

  cabecera: {
    padding: 28,
    background: "#ffffff",
    border: "1px solid #dbe5f1",
    borderRadius: 16,
    marginBottom: 20,
  },

  tarjeta: {
    background: "#ffffff",
    border: "1px solid #dbe5f1",
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 15,
  },

  boton: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "11px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },

  secundario: {
    background: "#e2e8f0",
    color: "#17365d",
    border: "none",
    padding: "11px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },

  campo: {
    background: "#f3f7fc",
    padding: 14,
    borderRadius: 9,
    overflowWrap: "anywhere",
  },

  fondoModal: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    zIndex: 9999,
  },

  modal: {
    background: "#ffffff",
    width: "100%",
    maxWidth: 1050,
    maxHeight: "92vh",
    overflowY: "auto",
    borderRadius: 16,
    padding: 25,
    boxSizing: "border-box",
  },

  tabla: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 15,
  },

  celda: {
    border: "1px solid #dbe5f1",
    padding: 10,
    textAlign: "left",
    fontSize: 13,
  },
};

function Campo({ titulo, valor }) {
  return (
    <div style={estilos.campo}>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        {titulo}
      </div>

      <strong>{mostrar(valor)}</strong>
    </div>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function ResultadosRecepcion({ usuario, onVolver }) {
  const laboratorioId = texto(usuario?.laboratorioId);

  const [pacientes, setPacientes] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [muestras, setMuestras] = useState([]);

  const [laboratorio, setLaboratorio] = useState(null);

  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState(null);

  const [resultadoSeleccionado, setResultadoSeleccionado] =
    useState(null);

  const [ventaSeleccionada, setVentaSeleccionada] =
    useState(null);

  const [valores, setValores] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const [error, setError] = useState("");
  const [errorDetalle, setErrorDetalle] = useState("");

  // ====================================================
  // CONSULTAR COLECCIONES
  // ====================================================

  const consultarColeccion = useCallback(
    async (nombre) => {
      const referencia = query(
        collection(db, nombre),
        where("laboratorioId", "==", laboratorioId)
      );

      const snapshot = await getDocs(referencia);

      return snapshot.docs.map((documento) => ({
        ...documento.data(),
        id: documento.id,
      }));
    },
    [laboratorioId]
  );

  const cargarDatos = useCallback(async () => {
    if (!laboratorioId) {
      setError("No se identificó el laboratorio.");
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      const [
        pacientesData,
        resultadosData,
        ventasData,
        analisisData,
      ] = await Promise.all([
        consultarColeccion("pacientes"),
        consultarColeccion("resultados"),
        consultarColeccion("ventas"),
        consultarColeccion("analisis"),
      ]);

      setPacientes(pacientesData);
      setResultados(resultadosData);
      setVentas(ventasData);
      setAnalisis(analisisData);

      try {
        const muestrasData = await consultarColeccion("muestras");
        setMuestras(muestrasData);
      } catch (err) {
        console.warn("No se pudieron cargar las muestras:", err);
        setMuestras([]);
      }

      try {
        const laboratorioDoc = await getDoc(
          doc(db, "laboratorios", laboratorioId)
        );

        if (laboratorioDoc.exists()) {
          setLaboratorio({
            ...laboratorioDoc.data(),
            id: laboratorioDoc.id,
          });
        }
      } catch (err) {
        console.warn("No se pudo cargar el laboratorio:", err);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.code === "permission-denied"
          ? "No tienes permisos para consultar esta información."
          : err?.message || "Error al cargar los datos."
      );
    } finally {
      setCargando(false);
    }
  }, [laboratorioId, consultarColeccion]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ====================================================
  // RELACIONES
  // ====================================================

  const obtenerAnalisis = useCallback(
    (resultado) =>
      analisis.find(
        (item) =>
          texto(item.id) === texto(resultado?.analisisId)
      ),
    [analisis]
  );

  const obtenerMuestra = useCallback(
    (resultado) =>
      muestras.find(
        (item) =>
          texto(item.id) === texto(resultado?.muestraId)
      ),
    [muestras]
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

  const obtenerNumeroOrden = (resultado) =>
    mostrar(
      primero(
        resultado?.numeroOrden,
        resultado?.codigoOrden,
        resultado?.ordenId
      )
    );

  const obtenerNumeroMuestra = (resultado) => {
    const muestra = obtenerMuestra(resultado);

    return mostrar(
      primero(
        muestra?.numeroMuestra,
        muestra?.codigoMuestra,
        muestra?.codigo,
        resultado?.numeroMuestra,
        resultado?.codigoMuestra,
        muestra?.id,
        resultado?.muestraId
      )
    );
  };

  const obtenerTipoMuestra = (resultado) => {
    const muestra = obtenerMuestra(resultado);

    return mostrar(
      primero(
        muestra?.tipoMuestra,
        muestra?.tipo,
        resultado?.tipoMuestra
      )
    );
  };

  // ====================================================
  // LEER RESULTADOS REGISTRADOS
  // ====================================================

  const consultarValoresResultado = useCallback(
    async (resultado) => {
      if (!resultado?.id) {
        return {
          valores: [],
          advertencias: [],
        };
      }

      const encontrados = [];
      const advertencias = [];

      // 1. Datos que ya están dentro del documento resultado.
      encontrados.push(...extraerRegistros(resultado));

      // 2. Subcolección principal de valores.
      try {
        const snapshot = await getDocs(
          collection(db, "resultados", resultado.id, "valores")
        );

        snapshot.docs.forEach((documento) => {
          encontrados.push({
            ...documento.data(),
            id: documento.id,
          });
        });
      } catch (err) {
        advertencias.push(
          `valores: ${err?.code || err?.message}`
        );
      }

      // 3. Documento de muestra relacionado.
      const muestraId = texto(resultado.muestraId);

      if (muestraId) {
        try {
          const snapshot = await getDoc(
            doc(db, "muestras", muestraId)
          );

          if (snapshot.exists()) {
            encontrados.push(
              ...extraerRegistros(snapshot.data())
            );
          }
        } catch (err) {
          advertencias.push(
            `muestra: ${err?.code || err?.message}`
          );
        }
      }

      // No se consultan subcolecciones adicionales sin conocer
      // sus reglas de acceso y estructura real.

      return {
        valores: encontrados,
        advertencias,
      };
    },
    []
  );

  useEffect(() => {
    if (!resultadoSeleccionado) {
      setValores([]);
      setErrorDetalle("");
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargandoDetalle(true);
      setValores([]);
      setErrorDetalle("");

      try {
        const respuesta = await consultarValoresResultado(
          resultadoSeleccionado
        );

        if (!activo) return;

        setValores(respuesta.valores);

        if (respuesta.advertencias.length > 0) {
          setErrorDetalle(respuesta.advertencias.join(" | "));
        }

        console.log("RESULTADO FIRESTORE:", resultadoSeleccionado);
        console.log("VALORES RECUPERADOS:", respuesta.valores);
      } catch (err) {
        if (activo) {
          setErrorDetalle(
            err?.message || "No se pudieron consultar los valores."
          );
        }
      } finally {
        if (activo) setCargandoDetalle(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [resultadoSeleccionado, consultarValoresResultado]);

  const parametrosCompletos = useMemo(() => {
    if (!resultadoSeleccionado) return [];

    return construirParametros(
      resultadoSeleccionado,
      obtenerAnalisis(resultadoSeleccionado),
      valores
    );
  }, [resultadoSeleccionado, obtenerAnalisis, valores]);

  // ====================================================
  // FILTROS
  // ====================================================

  const pacientesFiltrados = useMemo(() => {
    const buscar = normalizar(busqueda);

    return pacientes.filter((paciente) =>
      normalizar(
        `${nombrePaciente(paciente)} ${ciPaciente(
          paciente
        )} ${correoPaciente(paciente)}`
      ).includes(buscar)
    );
  }, [pacientes, busqueda]);

  const resultadosPaciente = useMemo(() => {
    if (!pacienteSeleccionado) return [];

    return resultados.filter(
      (resultado) =>
        texto(resultado.pacienteId) ===
          texto(pacienteSeleccionado.id) &&
        (normalizar(resultado.estado) === "validado" ||
          resultado.validado === true)
    );
  }, [resultados, pacienteSeleccionado]);

  const ventasPaciente = useMemo(() => {
    if (!pacienteSeleccionado) return [];

    return ventas.filter(
      (venta) =>
        texto(venta.pacienteId) ===
        texto(pacienteSeleccionado.id)
    );
  }, [ventas, pacienteSeleccionado]);

  // ====================================================
  // PDF CLÍNICO
  // ====================================================

  const descargarResultado = async (resultado) => {
    if (!resultado || generandoPDF) return;

    setGenerandoPDF(true);

    try {
      const datosLaboratorio = laboratorio || {};

      const logo = await cargarLogo(
        primero(
          datosLaboratorio.logoUrl,
          datosLaboratorio.imagenURL,
          datosLaboratorio.logo
        )
      );

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const color = colorPDF(datosLaboratorio.colorPrimario);

      const ordenId = texto(resultado.ordenId);

      const resultadosInforme = ordenId
        ? resultadosPaciente.filter(
            (item) => texto(item.ordenId) === ordenId
          )
        : [resultado];

      if (
        !resultadosInforme.some(
          (item) => item.id === resultado.id
        )
      ) {
        resultadosInforme.push(resultado);
      }

      const detalles = await Promise.all(
        resultadosInforme.map(async (item) => {
          const respuesta = await consultarValoresResultado(item);

          return {
            resultado: item,
            parametros: construirParametros(
              item,
              obtenerAnalisis(item),
              respuesta.valores
            ),
          };
        })
      );

      encabezadoPDF(
        pdf,
        datosLaboratorio,
        logo,
        "INFORME DE RESULTADOS CLÍNICOS"
      );

      const fecha = primero(
        resultado.fechaValidacion,
        resultado.fechaRegistro,
        resultado.fecha
      );

      let y = datosPacientePDF(
        pdf,
        pacienteSeleccionado,
        fecha
      );

      y = tituloSeccionPDF(
        pdf,
        "Información de la orden",
        y + 6,
        color
      );

      const numerosMuestra = [
        ...new Set(
          resultadosInforme.map((item) =>
            obtenerNumeroMuestra(item)
          )
        ),
      ].join(", ");

      autoTable(pdf, {
        startY: y,
        margin: {
          left: 12,
          right: 12,
          bottom: 25,
        },
        theme: "grid",
        body: [
          [
            "N.º ORDEN",
            obtenerNumeroOrden(resultado),
            "N.º MUESTRA",
            numerosMuestra,
          ],
          [
            "REGISTRO",
            fechaTexto(
              primero(resultado.fechaRegistro, resultado.fecha)
            ),
            "VALIDACIÓN",
            fechaTexto(resultado.fechaValidacion),
          ],
          [
            "ESTADO",
            mostrar(resultado.estado),
            "ANÁLISIS",
            String(detalles.length),
          ],
        ],
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [215, 225, 235],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: {
            fontStyle: "bold",
            fillColor: [242, 246, 250],
            cellWidth: 39,
          },
          1: {
            cellWidth: 59,
          },
          2: {
            fontStyle: "bold",
            fillColor: [242, 246, 250],
            cellWidth: 31,
          },
        },
      });

      y = pdf.lastAutoTable.finalY + 8;

      for (const detalle of detalles) {
        const item = detalle.resultado;

        y = tituloSeccionPDF(
          pdf,
          obtenerNombreAnalisis(item),
          y,
          color
        );

        autoTable(pdf, {
          startY: y,
          margin: {
            left: 12,
            right: 12,
            bottom: 25,
          },
          theme: "plain",
          body: [
            [
              `Muestra: ${obtenerTipoMuestra(item)}`,
              `N.º: ${obtenerNumeroMuestra(item)}`,
              `Fecha: ${fechaTexto(
                primero(item.fechaRegistro, item.fecha)
              )}`,
            ],
          ],
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [90, 105, 120],
          },
        });

        y = pdf.lastAutoTable.finalY + 3;

        const filas =
          detalle.parametros.length > 0
            ? detalle.parametros.map((parametro) => [
                parametro.nombre,
                {
                  content: parametro.valor,
                  styles: {
                    fontStyle: parametro.anormal
                      ? "bold"
                      : "normal",
                    textColor: parametro.anormal
                      ? [200, 35, 45]
                      : [35, 50, 65],
                  },
                },
                parametro.unidad,
                parametro.rango,
                parametro.observacion,
              ])
            : [
                [
                  obtenerNombreAnalisis(item),
                  "Sin resultado registrado",
                  "-",
                  "-",
                  "-",
                ],
              ];

        autoTable(pdf, {
          startY: y,
          margin: {
            left: 12,
            right: 12,
            top: 18,
            bottom: 25,
          },
          head: [
            [
              "PARÁMETRO",
              "RESULTADO",
              "UNIDAD",
              "REFERENCIA",
              "OBS.",
            ],
          ],
          body: filas,
          theme: "grid",
          headStyles: {
            fillColor: color,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
            lineWidth: 0.15,
            lineColor: [215, 225, 235],
            textColor: [40, 55, 70],
            overflow: "linebreak",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 253],
          },
          columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 32, halign: "center" },
            2: { cellWidth: 24, halign: "center" },
            3: { cellWidth: 42, halign: "center" },
            4: { cellWidth: 33 },
          },
        });

        y = pdf.lastAutoTable.finalY + 8;

        const observaciones = texto(
          primero(item.observaciones, item.observacion)
        );

        if (observaciones) {
          const lineas = pdf.splitTextToSize(observaciones, 178);

          if (y + lineas.length * 4 + 15 > 270) {
            pdf.addPage();
            y = 20;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(...color);
          pdf.text("OBSERVACIONES:", 12, y);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(65, 75, 85);
          pdf.text(lineas, 12, y + 5);

          y += lineas.length * 4 + 13;
        }

        if (y + 17 > 270) {
          pdf.addPage();
          y = 20;
        }

        pdf.setDrawColor(220, 228, 236);
        pdf.line(12, y, 198, y);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(85, 95, 105);

        pdf.text(
          `Validado por: ${mostrar(
            primero(
              item.validadoPorNombre,
              item.nombreValidador
            )
          )}`,
          12,
          y + 5
        );

        pdf.text(
          `Fecha: ${fechaTexto(item.fechaValidacion)}`,
          198,
          y + 5,
          { align: "right" }
        );

        y += 17;
      }

      if (y + 22 > 270) {
        pdf.addPage();
        y = 20;
      }

      pdf.setDrawColor(...color);
      pdf.line(12, y, 198, y);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...color);

      pdf.text("FIN DEL INFORME", 105, y + 8, {
        align: "center",
      });

      piePDF(pdf, datosLaboratorio);

      const nombreArchivo = texto(
        primero(resultado.ordenId, resultado.id, "clinico")
      ).replace(/[\\/:*?"<>|]/g, "_");

      pdf.save(`Resultados_Orden_${nombreArchivo}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);

      alert(
        err?.message ||
          "No se pudo generar el informe clínico."
      );
    } finally {
      setGenerandoPDF(false);
    }
  };

  // ====================================================
  // DETALLES DE VENTA
  // ====================================================

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

    const items = lista(origen);

    return items.map((item, index) => {
      const dato =
        item && typeof item === "object"
          ? item
          : { analisisId: item };

      const encontrado = analisis.find(
        (a) =>
          texto(a.id) ===
          texto(primero(dato.analisisId, dato.idAnalisis))
      );

      const cantidad = Number(primero(dato.cantidad, 1)) || 1;
      const precio =
        Number(primero(dato.precioUnitario, dato.precio, 0)) || 0;

      return {
        id: primero(dato.id, index),
        nombre: mostrar(
          primero(
            dato.nombreAnalisis,
            dato.analisisNombre,
            dato.nombre,
            encontrado?.nombre
          ),
          "Análisis"
        ),
        cantidad,
        precio,
        subtotal:
          Number(
            primero(dato.subtotal, dato.total, cantidad * precio)
          ) || 0,
      };
    });
  };

  const descargarVenta = async (venta) => {
    if (!venta || generandoPDF) return;

    setGenerandoPDF(true);

    try {
      const datosLaboratorio = laboratorio || {};

      const logo = await cargarLogo(
        primero(
          datosLaboratorio.logoUrl,
          datosLaboratorio.imagenURL,
          datosLaboratorio.logo
        )
      );

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
      });

      const color = colorPDF(datosLaboratorio.colorPrimario);

      encabezadoPDF(
        pdf,
        datosLaboratorio,
        logo,
        "NOTA DE VENTA"
      );

      const fecha = primero(
        venta.fechaVenta,
        venta.fecha,
        venta.createdAt
      );

      let y = datosPacientePDF(
        pdf,
        pacienteSeleccionado,
        fecha
      );

      y = tituloSeccionPDF(
        pdf,
        "Información de la venta",
        y + 6,
        color
      );

      autoTable(pdf, {
        startY: y,
        margin: {
          left: 12,
          right: 12,
          bottom: 25,
        },
        theme: "grid",
        body: [
          [
            "N.º VENTA",
            mostrar(primero(venta.ventaId, venta.id)),
          ],
          ["N.º ORDEN", mostrar(venta.ordenId)],
          ["N.º SOLICITUD", mostrar(venta.solicitudId)],
          ["MÉTODO DE PAGO", mostrar(venta.metodoPago)],
          ["ESTADO", mostrar(venta.estado)],
          ["FECHA", fechaTexto(fecha)],
        ],
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [215, 225, 235],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: {
            fontStyle: "bold",
            fillColor: [242, 246, 250],
            cellWidth: 45,
          },
        },
      });

      y = tituloSeccionPDF(
        pdf,
        "Detalle de análisis",
        pdf.lastAutoTable.finalY + 8,
        color
      );

      const items = obtenerItemsVenta(venta);

      const filas = items.map((item) => [
        item.nombre,
        String(item.cantidad),
        `Bs ${moneda(item.precio)}`,
        `Bs ${moneda(item.subtotal)}`,
      ]);

      if (filas.length === 0) {
        filas.push(["Detalle no disponible", "-", "-", "-"]);
      }

      autoTable(pdf, {
        startY: y,
        margin: {
          left: 12,
          right: 12,
          top: 18,
          bottom: 25,
        },
        head: [
          ["ANÁLISIS", "CANTIDAD", "PRECIO", "SUBTOTAL"],
        ],
        body: filas,
        theme: "grid",
        headStyles: {
          fillColor: color,
          textColor: [255, 255, 255],
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [215, 225, 235],
          lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 253],
        },
      });

      let totalY = pdf.lastAutoTable.finalY + 12;

      if (totalY + 25 > 270) {
        pdf.addPage();
        totalY = 20;
      }

      pdf.setFillColor(237, 245, 251);
      pdf.roundedRect(110, totalY, 88, 17, 2, 2, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...color);

      pdf.text(
        `TOTAL: Bs ${moneda(
          primero(venta.total, venta.montoTotal, venta.totalVenta)
        )}`,
        193,
        totalY + 11,
        { align: "right" }
      );

      piePDF(pdf, datosLaboratorio);

      const nombreArchivo = texto(
        primero(venta.ventaId, venta.id, "venta")
      ).replace(/[\\/:*?"<>|]/g, "_");

      pdf.save(`Nota_Venta_${nombreArchivo}.pdf`);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar la nota de venta.");
    } finally {
      setGenerandoPDF(false);
    }
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div style={estilos.pagina}>
      <header style={estilos.cabecera}>
        <h1>Resultados de pacientes</h1>

        <p>
          Consulta de resultados clínicos, parámetros,
          rangos de referencia y notas de venta.
        </p>

        {laboratorio && (
          <p>
            <strong>
              {mostrar(
                primero(
                  laboratorio.nombreVisible,
                  laboratorio.nombre
                )
              )}
            </strong>
          </p>
        )}

        {typeof onVolver === "function" && (
          <button
            type="button"
            style={estilos.secundario}
            onClick={onVolver}
          >
            ← Volver
          </button>
        )}
      </header>

      {error && (
        <div style={estilos.tarjeta}>
          <p style={{ color: "red" }}>{error}</p>

          <button
            type="button"
            style={estilos.boton}
            onClick={cargarDatos}
          >
            Reintentar
          </button>
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
            placeholder="Buscar por nombre, CI o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              marginBottom: 20,
              boxSizing: "border-box",
            }}
          />

          <div style={estilos.grid}>
            {pacientesFiltrados.map((paciente) => (
              <div
                key={paciente.id}
                style={{
                  ...estilos.tarjeta,
                  marginBottom: 0,
                }}
              >
                <h3>{nombrePaciente(paciente)}</h3>

                <p>
                  <strong>CI:</strong> {ciPaciente(paciente)}
                </p>

                <p>
                  <strong>Correo:</strong> {correoPaciente(paciente)}
                </p>

                <button
                  type="button"
                  style={estilos.boton}
                  onClick={() => {
                    setPacienteSeleccionado(paciente);
                    setResultadoSeleccionado(null);
                    setVentaSeleccionada(null);
                  }}
                >
                  Ver resultados
                </button>
              </div>
            ))}
          </div>

          {pacientesFiltrados.length === 0 && (
            <p>No se encontraron pacientes.</p>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            style={{
              ...estilos.secundario,
              marginBottom: 15,
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
            <h2>{nombrePaciente(pacienteSeleccionado)}</h2>

            <div style={estilos.grid}>
              <Campo
                titulo="CI"
                valor={ciPaciente(pacienteSeleccionado)}
              />

              <Campo
                titulo="Edad"
                valor={edadPaciente(pacienteSeleccionado)}
              />

              <Campo
                titulo="Sexo"
                valor={pacienteSeleccionado.sexo}
              />

              <Campo
                titulo="Correo electrónico"
                valor={correoPaciente(pacienteSeleccionado)}
              />
            </div>
          </div>

          <div style={estilos.tarjeta}>
            <h2>Resultados clínicos</h2>
            <p>Resultados validados del paciente.</p>

            {resultadosPaciente.length === 0 ? (
              <p>No existen resultados validados.</p>
            ) : (
              <div style={estilos.grid}>
                {resultadosPaciente.map((resultado) => (
                  <div
                    key={resultado.id}
                    style={{
                      ...estilos.tarjeta,
                      marginBottom: 0,
                    }}
                  >
                    <h3>{obtenerNombreAnalisis(resultado)}</h3>

                    <p>
                      <strong>N.º orden:</strong>{" "}
                      {obtenerNumeroOrden(resultado)}
                    </p>

                    <p>
                      <strong>N.º muestra:</strong>{" "}
                      {obtenerNumeroMuestra(resultado)}
                    </p>

                    <p>
                      <strong>Estado:</strong>{" "}
                      {mostrar(resultado.estado)}
                    </p>

                    <p>
                      <strong>Fecha:</strong>{" "}
                      {fechaTexto(
                        primero(
                          resultado.fechaValidacion,
                          resultado.fechaRegistro
                        )
                      )}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        style={estilos.boton}
                        onClick={() =>
                          setResultadoSeleccionado(resultado)
                        }
                      >
                        Ver resultado
                      </button>

                      <button
                        type="button"
                        disabled={generandoPDF}
                        style={estilos.secundario}
                        onClick={() => descargarResultado(resultado)}
                      >
                        {generandoPDF
                          ? "Generando..."
                          : "Descargar PDF"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={estilos.tarjeta}>
            <h2>Notas de venta</h2>

            {ventasPaciente.length === 0 ? (
              <p>No existen notas de venta.</p>
            ) : (
              <div style={estilos.grid}>
                {ventasPaciente.map((venta) => (
                  <div
                    key={venta.id}
                    style={{
                      ...estilos.tarjeta,
                      marginBottom: 0,
                    }}
                  >
                    <h3>
                      Nota de venta{" "}
                      {mostrar(primero(venta.ventaId, venta.id))}
                    </h3>

                    <p>
                      <strong>Fecha:</strong>{" "}
                      {fechaTexto(
                        primero(venta.fechaVenta, venta.fecha)
                      )}
                    </p>

                    <p>
                      <strong>Total:</strong> Bs{" "}
                      {moneda(
                        primero(venta.total, venta.montoTotal)
                      )}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        style={estilos.boton}
                        onClick={() => setVentaSeleccionada(venta)}
                      >
                        Ver nota
                      </button>

                      <button
                        type="button"
                        style={estilos.secundario}
                        disabled={generandoPDF}
                        onClick={() => descargarVenta(venta)}
                      >
                        Descargar PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL RESULTADO */}

      {resultadoSeleccionado && (
        <div
          style={estilos.fondoModal}
          onClick={() => setResultadoSeleccionado(null)}
        >
          <div
            style={estilos.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 15,
              }}
            >
              <h2>Detalle del resultado clínico</h2>

              <button
                type="button"
                style={estilos.secundario}
                onClick={() => setResultadoSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>

            <h3>Información del paciente</h3>

            <div style={estilos.grid}>
              <Campo
                titulo="Paciente"
                valor={nombrePaciente(pacienteSeleccionado)}
              />

              <Campo
                titulo="CI"
                valor={ciPaciente(pacienteSeleccionado)}
              />

              <Campo
                titulo="Correo"
                valor={correoPaciente(pacienteSeleccionado)}
              />

              <Campo
                titulo="Edad"
                valor={edadPaciente(pacienteSeleccionado)}
              />
            </div>

            <h3>Información del análisis</h3>

            <div style={estilos.grid}>
              <Campo
                titulo="Análisis"
                valor={obtenerNombreAnalisis(
                  resultadoSeleccionado
                )}
              />

              <Campo
                titulo="Número de orden"
                valor={obtenerNumeroOrden(
                  resultadoSeleccionado
                )}
              />

              <Campo
                titulo="Número de muestra"
                valor={obtenerNumeroMuestra(
                  resultadoSeleccionado
                )}
              />

              <Campo
                titulo="Tipo de muestra"
                valor={obtenerTipoMuestra(
                  resultadoSeleccionado
                )}
              />
            </div>

            <h3>Parámetros y resultados</h3>

            {cargandoDetalle ? (
              <p>Cargando valores registrados...</p>
            ) : (
              <>
                {errorDetalle && (
                  <p style={{ color: "#b45309" }}>
                    {errorDetalle}
                  </p>
                )}

                {parametrosCompletos.length === 0 ? (
                  <p>
                    No se encontraron parámetros individuales.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={estilos.tabla}>
                      <thead>
                        <tr>
                          {[
                            "Parámetro",
                            "Resultado",
                            "Unidad",
                            "Referencia",
                            "Observación",
                          ].map((titulo) => (
                            <th
                              key={titulo}
                              style={{
                                ...estilos.celda,
                                background: "#eaf2ff",
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

                              <td
                                style={{
                                  ...estilos.celda,
                                  color: parametro.anormal
                                    ? "#dc2626"
                                    : "#17365d",
                                  fontWeight: parametro.anormal
                                    ? "bold"
                                    : "normal",
                                }}
                              >
                                {parametro.valor}
                              </td>

                              <td style={estilos.celda}>
                                {parametro.unidad}
                              </td>

                              <td style={estilos.celda}>
                                {parametro.rango}
                              </td>

                              <td style={estilos.celda}>
                                {parametro.observacion}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <h3>Observaciones y validación</h3>

            <div style={estilos.grid}>
              <Campo
                titulo="Observaciones"
                valor={primero(
                  resultadoSeleccionado.observaciones,
                  resultadoSeleccionado.observacion
                )}
              />

              <Campo
                titulo="Estado"
                valor={resultadoSeleccionado.estado}
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

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 25,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                disabled={generandoPDF}
                style={estilos.boton}
                onClick={() =>
                  descargarResultado(resultadoSeleccionado)
                }
              >
                {generandoPDF
                  ? "Generando PDF..."
                  : "Descargar PDF completo"}
              </button>

              <button
                type="button"
                style={estilos.secundario}
                onClick={() => setResultadoSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA */}

      {ventaSeleccionada && (
        <div
          style={estilos.fondoModal}
          onClick={() => setVentaSeleccionada(null)}
        >
          <div
            style={{
              ...estilos.modal,
              maxWidth: 850,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Detalle de nota de venta</h2>

            <div style={estilos.grid}>
              <Campo
                titulo="Paciente"
                valor={nombrePaciente(pacienteSeleccionado)}
              />

              <Campo
                titulo="Número de venta"
                valor={primero(
                  ventaSeleccionada.ventaId,
                  ventaSeleccionada.id
                )}
              />

              <Campo
                titulo="Número de orden"
                valor={ventaSeleccionada.ordenId}
              />

              <Campo
                titulo="Método de pago"
                valor={ventaSeleccionada.metodoPago}
              />

              <Campo
                titulo="Estado"
                valor={ventaSeleccionada.estado}
              />

              <Campo
                titulo="Total"
                valor={`Bs ${moneda(
                  primero(
                    ventaSeleccionada.total,
                    ventaSeleccionada.montoTotal
                  )
                )}`}
              />
            </div>

            <h3>Detalle de análisis vendidos</h3>

            <div style={{ overflowX: "auto" }}>
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
                          background: "#eaf2ff",
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {obtenerItemsVenta(ventaSeleccionada).map(
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

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 25,
              }}
            >
              <button
                type="button"
                style={estilos.boton}
                disabled={generandoPDF}
                onClick={() => descargarVenta(ventaSeleccionada)}
              >
                Descargar PDF
              </button>

              <button
                type="button"
                style={estilos.secundario}
                onClick={() => setVentaSeleccionada(null)}
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