import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cargarReportesLaboratorio,
} from "../services/adminSprint3Service";

import "./Sprint3.css";

// ============================================================
// DATOS INICIALES
// ============================================================

const DATOS_VACIOS = {
  pacientes: [],
  analisis: [],
  ventas: [],
  ordenes: [],
  resultados: [],
  parametros: [],
  rangos: [],
};

// ============================================================
// UTILIDADES
// ============================================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizar(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function primero(...valores) {
  for (const valor of valores) {
    if (
      valor !== null &&
      valor !== undefined &&
      texto(valor) !== ""
    ) {
      return valor;
    }
  }

  return "";
}

function numero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    texto(valor) === ""
  ) {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor)
      ? valor
      : null;
  }

  const limpio = texto(valor).replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(limpio)) {
    return null;
  }

  const convertido = Number(limpio);

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function fechaTexto(valor) {
  if (!valor) {
    return "-";
  }

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
      return "-";
    }

    return fecha.toLocaleString("es-BO");
  } catch {
    return "-";
  }
}

function nombrePaciente(item) {
  if (!item) {
    return "No registrado";
  }

  const completo = primero(
    item.nombreCompleto,
    item.pacienteNombre,
    item.nombrePaciente
  );

  if (texto(completo)) {
    return texto(completo);
  }

  const nombres = primero(
    item.nombres,
    item.nombre
  );

  const apellidos = primero(
    item.apellidos,
    item.apellido
  );

  return (
    `${texto(nombres)} ${texto(apellidos)}`.trim() ||
    "No registrado"
  );
}

function dinero(valor) {
  const cantidad = Number(valor || 0);

  return `Bs ${
    Number.isFinite(cantidad)
      ? cantidad.toFixed(2)
      : "0.00"
  }`;
}

function coinciden(a, b) {
  return (
    texto(a) !== "" &&
    texto(b) !== "" &&
    texto(a) === texto(b)
  );
}

function obtenerId(item) {
  return texto(
    item?.id ??
    item?.analisisId ??
    ""
  );
}

// ============================================================
// BUSCAR PACIENTE
// ============================================================

function buscarPaciente(resultado, pacientes) {
  const pacienteId = primero(
    resultado.pacienteId,
    resultado.idPaciente,
    resultado.paciente?.id
  );

  const encontrado = pacientes.find(
    (paciente) =>
      coinciden(
        paciente.id,
        pacienteId
      )
  );

  if (encontrado) {
    return encontrado;
  }

  const ci = primero(
    resultado.pacienteCI,
    resultado.ciPaciente,
    resultado.ci
  );

  return (
    pacientes.find(
      (paciente) =>
        coinciden(
          paciente.ci,
          ci
        )
    ) ||
    resultado.paciente ||
    null
  );
}

// ============================================================
// BUSCAR ANÁLISIS
// ============================================================

function buscarAnalisis(resultado, analisis) {
  const analisisId = primero(
    resultado.analisisId,
    resultado.idAnalisis,
    resultado.analisis?.id
  );

  const encontrado = analisis.find(
    (item) =>
      coinciden(
        item.id,
        analisisId
      )
  );

  if (encontrado) {
    return encontrado;
  }

  const nombre = normalizar(
    primero(
      resultado.analisisNombre,
      resultado.nombreAnalisis
    )
  );

  return (
    analisis.find(
      (item) =>
        nombre !== "" &&
        normalizar(item.nombre) === nombre
    ) ||
    resultado.analisis ||
    null
  );
}

// ============================================================
// IDENTIFICAR PARÁMETRO
// ============================================================

function buscarParametro(
  resultado,
  analisis,
  parametros
) {
  const analisisId = obtenerId(analisis);

  const parametroId = texto(
    primero(
      resultado.parametroId,
      resultado.idParametro,
      resultado.parametro?.parametroId,
      resultado.parametro?.id
    )
  );

  const relacionados = parametros.filter(
    (item) =>
      coinciden(
        item.analisisId,
        analisisId
      )
  );

  if (parametroId) {
    const encontrado = relacionados.find(
      (item) =>
        coinciden(
          item.parametroId,
          parametroId
        ) ||
        coinciden(
          item.id,
          parametroId
        )
    );

    if (encontrado) {
      return encontrado;
    }
  }

  const nombreParametro = normalizar(
    primero(
      resultado.nombreParametro,
      resultado.parametroNombre,
      resultado.parametro?.nombre
    )
  );

  if (nombreParametro) {
    const encontrado = relacionados.find(
      (item) =>
        normalizar(
          primero(
            item.nombre,
            item.nombreParametro
          )
        ) === nombreParametro
    );

    if (encontrado) {
      return encontrado;
    }
  }

  // Solo se asigna automáticamente cuando
  // el análisis tiene exactamente un parámetro.
  if (relacionados.length === 1) {
    return relacionados[0];
  }

  return null;
}

// ============================================================
// RANGOS DE REFERENCIA
// ============================================================

function obtenerRango(objeto) {
  if (!objeto || typeof objeto !== "object") {
    return null;
  }

  const referencia =
    objeto.rangoReferencia &&
    typeof objeto.rangoReferencia === "object"
      ? objeto.rangoReferencia
      : objeto;

  const tipo = normalizar(
    referencia.tipo || "numerico"
  );

  if (tipo === "texto") {
    const textoReferencia = texto(
      referencia.textoReferencia
    );

    if (!textoReferencia) {
      return null;
    }

    return {
      tipo: "texto",
      minimo: null,
      maximo: null,
      textoReferencia,
      observaciones: texto(
        referencia.observaciones
      ),
    };
  }

  const minimo = numero(
    primero(
      referencia.minimo,
      referencia.valorMinimo,
      referencia.limiteInferior
    )
  );

  const maximo = numero(
    primero(
      referencia.maximo,
      referencia.valorMaximo,
      referencia.limiteSuperior
    )
  );

  if (
    minimo === null &&
    maximo === null
  ) {
    return null;
  }

  if (
    minimo !== null &&
    maximo !== null &&
    minimo > maximo
  ) {
    return null;
  }

  return {
    tipo: "numerico",
    minimo,
    maximo,
    textoReferencia: "",
    observaciones: texto(
      referencia.observaciones
    ),
  };
}

function mostrarRango(rango) {
  if (!rango) {
    return "No configurado";
  }

  if (rango.tipo === "texto") {
    return (
      rango.textoReferencia ||
      "No configurado"
    );
  }

  if (
    rango.minimo !== null &&
    rango.maximo !== null
  ) {
    return `${rango.minimo} - ${rango.maximo}`;
  }

  if (rango.minimo !== null) {
    return `Desde ${rango.minimo}`;
  }

  if (rango.maximo !== null) {
    return `Hasta ${rango.maximo}`;
  }

  return "No configurado";
}

// ============================================================
// RANGO CORRESPONDIENTE AL RESULTADO
// ============================================================

function rangoParaResultado(
  resultado,
  analisis,
  parametro,
  rangos
) {
  // 1. Rango guardado directamente
  // en el resultado.
  const rangoResultado = obtenerRango(
    resultado.rangoReferencia &&
    typeof resultado.rangoReferencia === "object"
      ? resultado.rangoReferencia
      : resultado
  );

  if (rangoResultado) {
    return rangoResultado;
  }

  // 2. Rango del parámetro real.
  if (parametro) {
    const rangoParametro = obtenerRango(
      parametro
    );

    if (rangoParametro) {
      return rangoParametro;
    }
  }

  // 3. Rango relacionado por identificadores.
  const analisisId = obtenerId(analisis);

  const parametroId = texto(
    primero(
      parametro?.parametroId,
      resultado.parametroId,
      resultado.idParametro
    )
  );

  if (analisisId && parametroId) {
    const referencia = rangos.find(
      (item) =>
        coinciden(
          item.analisisId,
          analisisId
        ) &&
        coinciden(
          item.parametroId,
          parametroId
        )
    );

    if (referencia) {
      return obtenerRango(referencia);
    }
  }

  // No utilizar el rango de otro parámetro.
  return null;
}

// ============================================================
// OBTENER VALOR REGISTRADO
// ============================================================

function valorRegistrado(resultado) {
  return primero(
    resultado.valor,
    resultado.valorResultado,
    resultado.valorRegistrado,
    resultado.valorNumerico,
    resultado.resultado,
    resultado.valorPrincipal,
    resultado.resultadoCualitativo
  );
}

// ============================================================
// ESTADO DEL RESULTADO
// ============================================================

function estaValidado(resultado) {
  const estado = normalizar(
    resultado.estado
  );

  return (
    resultado.validado === true ||
    [
      "validado",
      "finalizado",
    ].includes(estado)
  );
}

// ============================================================
// CLASIFICACIÓN
// ============================================================

function clasificarResultado(
  resultado,
  rango
) {
  if (!estaValidado(resultado)) {
    return "Pendiente";
  }

  const valor = valorRegistrado(resultado);

  const interpretacion = normalizar(
    primero(
      resultado.resultadoCualitativo,
      resultado.interpretacion,
      resultado.clasificacion,
      resultado.estadoClinico
    )
  );

  const valorTexto = normalizar(valor);

  const cualitativo =
    interpretacion || valorTexto;

  // Resultados cualitativos.
  if (
    [
      "positivo",
      "reactivo",
      "detectado",
    ].includes(cualitativo)
  ) {
    return "Positivo";
  }

  if (
    [
      "negativo",
      "no reactivo",
      "no detectado",
    ].includes(cualitativo)
  ) {
    return "Negativo";
  }

  // Resultados numéricos.
  const valorNumerico = numero(valor);

  if (
    rango &&
    rango.tipo === "numerico" &&
    valorNumerico !== null
  ) {
    if (
      rango.maximo !== null &&
      valorNumerico > rango.maximo
    ) {
      return "Elevado";
    }

    if (
      rango.minimo !== null &&
      valorNumerico < rango.minimo
    ) {
      return "Bajo";
    }

    if (
      rango.minimo !== null &&
      rango.maximo !== null &&
      valorNumerico >= rango.minimo &&
      valorNumerico <= rango.maximo
    ) {
      return "Normal";
    }
  }

  // Referencia de texto.
  if (
    rango &&
    rango.tipo === "texto"
  ) {
    const referencia = normalizar(
      rango.textoReferencia
    );

    if (
      referencia &&
      valorTexto &&
      referencia === valorTexto
    ) {
      return "Normal";
    }

    // No se considera positivo o negativo
    // únicamente por diferir del texto.
  }

  // Interpretación explícita registrada.
  if (
    [
      "alto",
      "elevado",
    ].includes(interpretacion)
  ) {
    return "Elevado";
  }

  if (interpretacion === "bajo") {
    return "Bajo";
  }

  if (interpretacion === "normal") {
    return "Normal";
  }

  return "Sin clasificación";
}

// ============================================================
// COMPONENTE
// ============================================================

export default function ReportesLaboratorio({
  usuario,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const [datos, setDatos] = useState(
    DATOS_VACIOS
  );

  const [tipo, setTipo] = useState(
    "pacientes"
  );

  const [busqueda, setBusqueda] = useState("");

  const [
    clasificacion,
    setClasificacion,
  ] = useState("Todos");

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] = useState("");

  // ==========================================================
  // CARGAR DATOS
  // ==========================================================

  const cargar = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "No se identificó el laboratorio."
      );

      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const respuesta =
        await cargarReportesLaboratorio(
          laboratorioId
        );

      setDatos({
        pacientes:
          respuesta?.pacientes || [],

        analisis:
          respuesta?.analisis || [],

        ventas:
          respuesta?.ventas || [],

        ordenes:
          respuesta?.ordenes || [],

        resultados:
          respuesta?.resultados || [],

        parametros:
          respuesta?.parametros || [],

        rangos:
          respuesta?.rangos || [],
      });
    } catch (e) {
      console.error(
        "Error cargando reportes:",
        e
      );

      setError(
        e?.message ||
          "No se pudieron cargar los reportes."
      );
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ==========================================================
  // PROCESAR RESULTADOS
  // ==========================================================

  const resultadosProcesados = useMemo(() => {
    return datos.resultados.map(
      (resultado) => {
        const paciente = buscarPaciente(
          resultado,
          datos.pacientes
        );

        const analisis = buscarAnalisis(
          resultado,
          datos.analisis
        );

        const parametro = buscarParametro(
          resultado,
          analisis,
          datos.parametros
        );

        const rango = rangoParaResultado(
          resultado,
          analisis,
          parametro,
          datos.rangos
        );

        const pacienteNombre = paciente
          ? nombrePaciente(paciente)
          : texto(
              primero(
                resultado.pacienteNombre,
                resultado.nombrePaciente
              )
            ) || "No registrado";

        const pacienteCI = texto(
          primero(
            paciente?.ci,
            resultado.pacienteCI,
            resultado.ci
          )
        ) || "-";

        const nombreAnalisis = texto(
          primero(
            analisis?.nombre,
            resultado.analisisNombre,
            resultado.nombreAnalisis
          )
        ) || "No registrado";

        const nombreParametro = texto(
          primero(
            parametro?.nombre,
            parametro?.nombreParametro,
            resultado.nombreParametro,
            resultado.parametroNombre
          )
        ) || "-";

        const unidadClinica = texto(
          primero(
            resultado.unidad,
            resultado.unidadMedida,
            parametro?.unidad,
            parametro?.unidadMedida,
            analisis?.unidad
          )
        ) || "-";

        const fechaClinica = fechaTexto(
          primero(
            resultado.fechaValidacion,
            resultado.fechaRegistro,
            resultado.fecha
          )
        );

        return {
          ...resultado,

          pacienteNombre,

          pacienteCI,

          nombreAnalisis,

          nombreParametro,

          valorClinico:
            valorRegistrado(resultado),

          unidadClinica,

          rangoClinico: rango,

          clasificacionClinica:
            clasificarResultado(
              resultado,
              rango
            ),

          fechaClinica,
        };
      }
    );
  }, [datos]);

  // ==========================================================
  // ESTADÍSTICAS
  // ==========================================================

  const estadisticas = useMemo(() => {
    const contar = (nombre) =>
      resultadosProcesados.filter(
        (item) =>
          item.clasificacionClinica ===
          nombre
      ).length;

    return {
      total: resultadosProcesados.length,

      positivos: contar("Positivo"),

      negativos: contar("Negativo"),

      elevados: contar("Elevado"),

      bajos: contar("Bajo"),

      normales: contar("Normal"),

      sinClasificacion:
        contar("Sin clasificación"),

      pendientes: contar("Pendiente"),
    };
  }, [resultadosProcesados]);

  // ==========================================================
  // FILTRAR REGISTROS
  // ==========================================================

  const lista = useMemo(() => {
    const origen =
      tipo === "resultados"
        ? resultadosProcesados
        : datos[tipo] || [];

    const termino = normalizar(
      busqueda
    );

    return origen.filter((item) => {
      if (
        tipo === "resultados" &&
        clasificacion !== "Todos" &&
        item.clasificacionClinica !==
          clasificacion
      ) {
        return false;
      }

      if (!termino) {
        return true;
      }

      return normalizar(
        JSON.stringify(item)
      ).includes(termino);
    });
  }, [
    tipo,
    datos,
    resultadosProcesados,
    busqueda,
    clasificacion,
  ]);

  // ==========================================================
  // COLUMNAS
  // ==========================================================

  const columnas = {
    pacientes: [
      "Paciente",
      "CI",
      "Teléfono",
      "Email",
    ],

    analisis: [
      "Análisis",
      "Tipo",
      "Precio",
      "Estado",
    ],

    ventas: [
      "Venta",
      "Paciente",
      "Total",
      "Estado",
    ],

    ordenes: [
      "Orden",
      "Paciente",
      "Total",
      "Estado",
    ],

    resultados: [
      "Paciente",
      "CI",
      "Análisis",
      "Parámetro",
      "Valor registrado",
      "Unidad",
      "Rango de referencia",
      "Clasificación",
      "Fecha",
    ],
  };

  // ==========================================================
  // CELDAS DE LA TABLA
  // ==========================================================

  function obtenerCeldas(item) {
    if (tipo === "pacientes") {
      return [
        nombrePaciente(item),
        texto(item.ci) || "-",
        texto(item.telefono) || "-",
        texto(item.email) || "-",
      ];
    }

    if (tipo === "analisis") {
      return [
        texto(item.nombre) || "-",
        texto(item.tipo) || "-",
        dinero(item.precio),
        item.activo === false
          ? "Inactivo"
          : "Activo",
      ];
    }

    if (
      tipo === "ventas" ||
      tipo === "ordenes"
    ) {
      const paciente =
        datos.pacientes.find(
          (p) =>
            coinciden(
              p.id,
              item.pacienteId
            )
        );

      return [
        texto(
          primero(
            item.ventaId,
            item.ordenId,
            item.id
          )
        ) || "-",

        paciente
          ? nombrePaciente(paciente)
          : texto(
              item.pacienteNombre
            ) || "-",

        dinero(item.total),

        texto(item.estado) || "-",
      ];
    }

    return [
      item.pacienteNombre,
      item.pacienteCI,
      item.nombreAnalisis,
      item.nombreParametro,
      texto(item.valorClinico) || "-",
      item.unidadClinica,
      mostrarRango(item.rangoClinico),
      item.clasificacionClinica,
      item.fechaClinica,
    ];
  }

  // ==========================================================
  // ESTILOS
  // ==========================================================

  const estilos = {
    tarjetas: {
      display: "grid",

      gridTemplateColumns:
        "repeat(auto-fit, minmax(170px, 1fr))",

      gap: "16px",

      marginBottom: "24px",
    },

    tarjeta: {
      background: "#ffffff",

      border: "1px solid #dbe5f1",

      borderRadius: "15px",

      padding: "20px",

      textAlign: "left",

      cursor: "pointer",

      boxShadow:
        "0 5px 18px rgba(15,23,42,0.04)",

      transition: "all 0.2s ease",
    },

    numero: {
      fontSize: "30px",

      fontWeight: 800,

      marginTop: "12px",
    },

    aviso: {
      background: "#fff7e6",

      border: "1px solid #f3d58d",

      borderRadius: "12px",

      padding: "14px 18px",

      marginBottom: "20px",

      color: "#925b00",

      fontSize: "14px",
    },
  };

  // ==========================================================
  // TARJETAS
  // ==========================================================

  const tarjetas = [
    {
      titulo: "Total de resultados",
      valor: estadisticas.total,
      color: "#17365d",
      filtro: "Todos",
    },

    {
      titulo: "Resultados positivos",
      valor: estadisticas.positivos,
      color: "#c45b00",
      filtro: "Positivo",
    },

    {
      titulo: "Resultados elevados",
      valor: estadisticas.elevados,
      color: "#dc2626",
      filtro: "Elevado",
    },

    {
      titulo: "Resultados bajos",
      valor: estadisticas.bajos,
      color: "#2563eb",
      filtro: "Bajo",
    },

    {
      titulo: "Resultados normales",
      valor: estadisticas.normales,
      color: "#15803d",
      filtro: "Normal",
    },

    {
      titulo: "Sin clasificación",
      valor: estadisticas.sinClasificacion,
      color: "#64748b",
      filtro: "Sin clasificación",
    },
  ];

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div>
      {/* ENCABEZADO */}

      <div className="s3-header">
        <div>
          <h2>
            Reportes del laboratorio
          </h2>

          <p>
            Consulta pacientes, análisis,
            ventas, órdenes y resultados
            clínicos.
          </p>
        </div>

        <button
          type="button"
          className="s3-button secondary"
          onClick={cargar}
          disabled={cargando}
        >
          {cargando
            ? "Actualizando..."
            : "Actualizar"}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="s3-error">
          {error}
        </div>
      )}

      {/* ADVERTENCIA */}

      {!cargando &&
        estadisticas.sinClasificacion >
          0 && (
          <div style={estilos.aviso}>
            Hay{" "}
            <strong>
              {
                estadisticas.sinClasificacion
              }
            </strong>{" "}
            resultado(s) sin clasificación
            clínica.

            {" "}Verifica que el resultado
            esté relacionado con su parámetro
            y que tenga un rango de referencia
            configurado.
          </div>
        )}

      {/* TARJETAS */}

      <div style={estilos.tarjetas}>
        {tarjetas.map((tarjeta) => (
          <button
            key={tarjeta.titulo}
            type="button"
            style={{
              ...estilos.tarjeta,

              border:
                tipo === "resultados" &&
                clasificacion ===
                  tarjeta.filtro
                  ? `2px solid ${tarjeta.color}`
                  : "1px solid #dbe5f1",
            }}
            onClick={() => {
              setTipo("resultados");

              setClasificacion(
                tarjeta.filtro
              );

              setBusqueda("");
            }}
          >
            <div
              style={{
                fontSize: "14px",
                color: "#52647d",
              }}
            >
              {tarjeta.titulo}
            </div>

            <div
              style={{
                ...estilos.numero,
                color: tarjeta.color,
              }}
            >
              {tarjeta.valor}
            </div>
          </button>
        ))}
      </div>

      {/* FILTROS */}

      <div className="s3-toolbar">
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);

            setClasificacion("Todos");

            setBusqueda("");
          }}
        >
          <option value="pacientes">
            Pacientes
          </option>

          <option value="analisis">
            Análisis
          </option>

          <option value="ventas">
            Ventas
          </option>

          <option value="ordenes">
            Órdenes
          </option>

          <option value="resultados">
            Resultados clínicos
          </option>
        </select>

        <input
          type="text"
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
          placeholder="Buscar paciente, CI, análisis..."
        />

        {tipo === "resultados" && (
          <select
            value={clasificacion}
            onChange={(e) =>
              setClasificacion(
                e.target.value
              )
            }
          >
            <option value="Todos">
              Todos los resultados
            </option>

            <option value="Positivo">
              Positivos
            </option>

            <option value="Negativo">
              Negativos
            </option>

            <option value="Elevado">
              Elevados
            </option>

            <option value="Bajo">
              Bajos
            </option>

            <option value="Normal">
              Normales
            </option>

            <option value="Sin clasificación">
              Sin clasificación
            </option>

            <option value="Pendiente">
              Pendientes
            </option>
          </select>
        )}

        <span className="s3-muted">
          {lista.length} registro(s)
        </span>
      </div>

      {/* TABLA */}

      {cargando ? (
        <div className="s3-empty">
          Cargando reportes...
        </div>
      ) : lista.length === 0 ? (
        <div className="s3-empty">
          No existen registros con los
          filtros seleccionados.
        </div>
      ) : (
        <div className="s3-table-wrap">
          <table className="s3-table">
            <thead>
              <tr>
                {columnas[tipo].map(
                  (columna) => (
                    <th key={columna}>
                      {columna}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {lista.map(
                (item, indice) => (
                  <tr
                    key={
                      item.id ||
                      `${tipo}-${indice}`
                    }
                  >
                    {obtenerCeldas(
                      item
                    ).map(
                      (
                        celda,
                        posicion
                      ) => (
                        <td
                          key={
                            posicion
                          }
                        >
                          {celda}
                        </td>
                      )
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}