import { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../firebase/firebase";

import "./HistorialPacientes.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function fechaTexto(valor) {
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
}

function nombreCompleto(paciente) {
  const nombre = texto(
    paciente?.nombres ||
    paciente?.nombre ||
    paciente?.nombreCompleto
  );

  const apellido = texto(
    paciente?.apellidos ||
    paciente?.apellido
  );

  return `${nombre} ${apellido}`.trim() || "Sin nombre";
}

function idRegistro(registro) {
  return texto(registro?.id);
}

function coincidePaciente(registro, paciente) {
  if (!registro || !paciente) return false;

  const id = texto(paciente.id);

  return (
    texto(registro.pacienteId) === id ||
    texto(registro.idPaciente) === id
  );
}

function mensajeError(error) {
  if (error?.code === "permission-denied") {
    return "No tienes permisos para consultar esta información.";
  }

  return error?.message || "Error al consultar Firestore.";
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function HistorialPacientes({ usuario }) {
  const laboratorioId = texto(usuario?.laboratorioId);

  const [pacientes, setPacientes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [muestras, setMuestras] = useState([]);
  const [resultados, setResultados] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // ====================================================
  // CONSULTAR COLECCIONES
  // ====================================================

  useEffect(() => {
    if (!laboratorioId) {
      setError("No se encontró el laboratorio.");
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
    ];

    let pendientes = colecciones.length;

    const cancelar = colecciones.map(([nombre, actualizar]) => {
      const consulta = query(
        collection(db, nombre),
        where("laboratorioId", "==", laboratorioId)
      );

      return onSnapshot(
        consulta,
        (resultado) => {
          actualizar(
            resultado.docs.map((documento) => ({
              ...documento.data(),
              id: documento.id,
            }))
          );

          pendientes -= 1;

          if (pendientes <= 0) {
            setCargando(false);
          }
        },
        (err) => {
          console.error(`Error en ${nombre}:`, err);
          setError(mensajeError(err));
          setCargando(false);
        }
      );
    });

    return () => {
      cancelar.forEach((funcion) => funcion());
    };
  }, [laboratorioId]);

  // ====================================================
  // BUSCAR PACIENTES
  // ====================================================

  const pacientesFiltrados = useMemo(() => {
    const palabra = busqueda.toLowerCase().trim();

    if (!palabra) return pacientes;

    return pacientes.filter((paciente) => {
      const contenido = [
        nombreCompleto(paciente),
        paciente.ci,
        paciente.telefono,
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(palabra);
    });
  }, [pacientes, busqueda]);

  // ====================================================
  // HISTORIAL DEL PACIENTE
  // ====================================================

  const historial = useMemo(() => {
    if (!pacienteSeleccionado) return null;

    return {
      solicitudes: solicitudes.filter((item) =>
        coincidePaciente(item, pacienteSeleccionado)
      ),

      ordenes: ordenes.filter((item) =>
        coincidePaciente(item, pacienteSeleccionado)
      ),

      ventas: ventas.filter((item) =>
        coincidePaciente(item, pacienteSeleccionado)
      ),

      muestras: muestras.filter((item) =>
        coincidePaciente(item, pacienteSeleccionado)
      ),

      resultados: resultados.filter((item) =>
        coincidePaciente(item, pacienteSeleccionado)
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
  // DESCARGAR HISTORIAL PDF
  // ====================================================

  const descargarPDF = () => {
    if (!pacienteSeleccionado || !historial) return;

    const pdf = new jsPDF();

    const paciente = pacienteSeleccionado;

    pdf.setFillColor(23, 54, 93);
    pdf.rect(0, 0, 210, 30, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(17);
    pdf.text("LABORATORIO CLINICO", 14, 13);

    pdf.setFontSize(11);
    pdf.text("HISTORIAL DEL PACIENTE", 14, 22);

    pdf.setTextColor(23, 54, 93);
    pdf.setFontSize(12);

    pdf.text(
      `Paciente: ${nombreCompleto(paciente)}`,
      14,
      42
    );

    pdf.text(
      `CI: ${texto(paciente.ci) || "No registrado"}`,
      14,
      50
    );

    pdf.text(
      `Telefono: ${texto(paciente.telefono) || "No registrado"}`,
      14,
      58
    );

    pdf.setFontSize(9);

    pdf.text(
      `Fecha de generacion: ${new Date().toLocaleString("es-BO")}`,
      14,
      66
    );

    let posicion = 75;

    const agregarTabla = (titulo, columnas, filas) => {
      pdf.setFontSize(12);
      pdf.setTextColor(23, 54, 93);

      if (posicion > 260) {
        pdf.addPage();
        posicion = 20;
      }

      pdf.text(titulo, 14, posicion);

      autoTable(pdf, {
        startY: posicion + 5,
        head: [columnas],
        body:
          filas.length > 0
            ? filas
            : [["Sin registros", ...columnas.slice(1).map(() => "")]],

        theme: "grid",

        headStyles: {
          fillColor: [23, 54, 93],
        },

        styles: {
          fontSize: 8,
          cellPadding: 3,
        },

        margin: {
          left: 14,
          right: 14,
        },
      });

      posicion = pdf.lastAutoTable.finalY + 14;
    };

    agregarTabla(
      "SOLICITUDES DE ANALISIS",
      ["Fecha", "Estado", "Codigo"],
      historial.solicitudes.map((item) => [
        fechaTexto(item.fechaSolicitud || item.fechaCreacion),
        texto(item.estado),
        texto(item.codigo || item.id),
      ])
    );

    agregarTabla(
      "ORDENES",
      ["Fecha", "Estado", "Codigo"],
      historial.ordenes.map((item) => [
        fechaTexto(item.fechaCreacion || item.fecha),
        texto(item.estado),
        texto(item.codigoOrden || item.id),
      ])
    );

    agregarTabla(
      "VENTAS",
      ["Fecha", "Estado", "Total"],
      historial.ventas.map((item) => [
        fechaTexto(item.fechaVenta || item.fechaCreacion),
        texto(item.estado),
        `Bs ${texto(item.total || item.montoTotal || 0)}`,
      ])
    );

    agregarTabla(
      "MUESTRAS",
      ["Fecha", "Tipo", "Estado", "Motivo de rechazo"],
      historial.muestras.map((item) => [
        fechaTexto(item.fechaToma || item.fechaRegistro),
        texto(item.tipoMuestra || item.tipo),
        texto(item.estado),
        texto(item.motivoRechazo || "-"),
      ])
    );

    agregarTabla(
      "RESULTADOS",
      ["Fecha", "Analisis", "Estado"],
      historial.resultados.map((item) => [
        fechaTexto(item.fechaResultado || item.fechaCreacion),
        texto(item.analisisNombre || item.nombreAnalisis),
        texto(item.estado),
      ])
    );

    const nombreArchivo = nombreCompleto(paciente)
      .replace(/[^a-zA-Z0-9]/g, "_");

    pdf.save(`Historial_${nombreArchivo}.pdf`);
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div className="hp-page">
      <div className="hp-header">
        <h2>Historial de pacientes</h2>

        <p>
          Consulta las atenciones, análisis, ventas,
          muestras y resultados de cada paciente.
        </p>
      </div>

      {error && <div className="hp-error">{error}</div>}

      {!pacienteSeleccionado ? (
        <div className="hp-card">
          <h3>Buscar paciente</h3>

          <input
            type="text"
            placeholder="Buscar por nombre, apellido o CI"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="hp-input"
          />

          {cargando ? (
            <p>Cargando pacientes...</p>
          ) : (
            <div className="hp-grid">
              {pacientesFiltrados.map((paciente) => (
                <div
                  className="hp-paciente"
                  key={idRegistro(paciente)}
                >
                  <h4>{nombreCompleto(paciente)}</h4>

                  <p>
                    <strong>CI:</strong>{" "}
                    {paciente.ci || "No registrado"}
                  </p>

                  <p>
                    <strong>Teléfono:</strong>{" "}
                    {paciente.telefono || "No registrado"}
                  </p>

                  <button
                    className="hp-btn"
                    onClick={() =>
                      setPacienteSeleccionado(paciente)
                    }
                  >
                    Ver historial
                  </button>
                </div>
              ))}
            </div>
          )}

          {!cargando && pacientesFiltrados.length === 0 && (
            <p>No se encontraron pacientes.</p>
          )}
        </div>
      ) : (
        <>
          <div className="hp-actions">
            <button
              className="hp-btn-secondary"
              onClick={() => setPacienteSeleccionado(null)}
            >
              ← Volver a pacientes
            </button>

            <button
              className="hp-btn"
              onClick={descargarPDF}
            >
              Descargar historial PDF
            </button>
          </div>

          <div className="hp-card">
            <h3>{nombreCompleto(pacienteSeleccionado)}</h3>

            <p>
              <strong>CI:</strong>{" "}
              {pacienteSeleccionado.ci || "No registrado"}
            </p>

            <p>
              <strong>Teléfono:</strong>{" "}
              {pacienteSeleccionado.telefono || "No registrado"}
            </p>
          </div>

          {[
            ["Solicitudes de análisis", historial?.solicitudes],
            ["Órdenes de análisis", historial?.ordenes],
            ["Ventas", historial?.ventas],
            ["Muestras", historial?.muestras],
            ["Resultados", historial?.resultados],
          ].map(([titulo, registros]) => (
            <div className="hp-card" key={titulo}>
              <h3>{titulo}</h3>

              {!registros?.length ? (
                <p>No existen registros.</p>
              ) : (
                <div className="hp-grid">
                  {registros.map((registro) => (
                    <div
                      className="hp-registro"
                      key={registro.id}
                    >
                      <p>
                        <strong>Fecha:</strong>{" "}
                        {fechaTexto(
                          registro.fechaCreacion ||
                          registro.fechaSolicitud ||
                          registro.fechaVenta ||
                          registro.fechaToma ||
                          registro.fechaResultado ||
                          registro.fechaRegistro
                        )}
                      </p>

                      <p>
                        <strong>Estado:</strong>{" "}
                        {registro.estado || "No indicado"}
                      </p>

                      <p>
                        <strong>Código:</strong>{" "}
                        {registro.codigoOrden ||
                          registro.codigoEtiqueta ||
                          registro.codigo ||
                          registro.id}
                      </p>

                      {registro.motivoRechazo && (
                        <p>
                          <strong>Motivo de rechazo:</strong>{" "}
                          {registro.motivoRechazo}
                        </p>
                      )}

                      {(registro.total || registro.montoTotal) && (
                        <p>
                          <strong>Total:</strong> Bs{" "}
                          {registro.total || registro.montoTotal}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}