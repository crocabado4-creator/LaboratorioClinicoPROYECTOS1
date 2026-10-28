
import { useCallback, useEffect, useState } from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  cargarDashboardLaboratorio,
  obtenerLaboratorioAdmin,
} from "../services/adminSprint3Service";

import "./Sprint3.css";

// ==========================================
// CONVERTIR VALORES A TEXTO
// ==========================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "string" || typeof valor === "number") {
    return String(valor).trim();
  }

  return "";
}

// ==========================================
// OBTENER NOMBRE COMPLETO DEL PACIENTE
// ==========================================

function nombrePaciente(paciente) {
  if (!paciente) {
    return "";
  }

  const nombreCompleto =
    texto(paciente.nombreCompleto) ||
    texto(paciente.nombrePaciente);

  if (nombreCompleto) {
    return nombreCompleto;
  }

  const nombres =
    texto(paciente.nombres) ||
    texto(paciente.nombre);

  const apellidos =
    texto(paciente.apellidos) ||
    texto(paciente.apellido);

  return [nombres, apellidos]
    .filter(Boolean)
    .join(" ");
}

// ==========================================
// OBTENER ID DEL PACIENTE DE UNA ORDEN
// ==========================================

function obtenerPacienteId(orden) {
  return (
    texto(orden.pacienteId) ||
    texto(orden.idPaciente) ||
    texto(orden.paciente_id) ||
    texto(orden.paciente?.id) ||
    texto(orden.paciente?.pacienteId)
  );
}

// ==========================================
// BUSCAR PACIENTE RELACIONADO
// ==========================================

function resolverNombrePaciente(orden, mapaPacientes) {
  const pacienteId = obtenerPacienteId(orden);

  // Primero buscamos el documento del paciente.
  if (pacienteId) {
    const paciente = mapaPacientes.get(pacienteId);

    if (paciente) {
      const nombre = nombrePaciente(paciente);

      if (nombre) {
        return nombre;
      }
    }
  }

  // Si la orden guarda el objeto del paciente.
  if (orden.paciente && typeof orden.paciente === "object") {
    const nombre = nombrePaciente(orden.paciente);

    if (nombre) {
      return nombre;
    }
  }

  // Si la orden ya tiene un nombre guardado.
  const nombreGuardado =
    texto(orden.pacienteNombre) ||
    texto(orden.nombrePaciente);

  if (
    nombreGuardado &&
    nombreGuardado !== pacienteId
  ) {
    return nombreGuardado;
  }

  return "Nombre no disponible";
}

// ==========================================
// MOSTRAR MONTO
// ==========================================

function montoVisible(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "Bs. 0.00";
  }

  return `Bs. ${numero.toFixed(2)}`;
}

// ==========================================
// FORMATO DEL ESTADO
// ==========================================

function estadoVisible(valor) {
  const estado = texto(valor);

  if (!estado) {
    return "Sin estado";
  }

  const limpio = estado.replace(/_/g, " ");

  return (
    limpio.charAt(0).toUpperCase() +
    limpio.slice(1)
  );
}

// ==========================================
// TARJETA DE ESTADISTICA
// ==========================================

function TarjetaEstadistica({ titulo, valor }) {
  return (
    <div className="s3-stat">
      <span>{titulo}</span>

      <strong>{valor}</strong>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function DashboardLaboratorio({ usuario }) {
  const laboratorioId =
    texto(usuario?.laboratorioId);

  const [resumen, setResumen] = useState(null);

  const [laboratorio, setLaboratorio] = useState(null);

  const [ordenes, setOrdenes] = useState([]);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [aviso, setAviso] = useState("");

  // ==========================================
  // CARGAR DATOS
  // ==========================================

  const cargar = useCallback(async () => {
    if (!laboratorioId) {
      setError("El usuario no tiene un laboratorio asignado.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      setAviso("");

      // 1. Consultar las estadísticas y el laboratorio.
      const [datosResumen, datosLaboratorio] =
        await Promise.all([
          cargarDashboardLaboratorio(laboratorioId),
          obtenerLaboratorioAdmin(laboratorioId),
        ]);

      setResumen(datosResumen);
      setLaboratorio(datosLaboratorio);

      // 2. Leer las órdenes recientes.
      const ordenesRecientes =
        datosResumen.ordenesRecientes || [];

      // 3. Obtener los pacientes del mismo laboratorio.
      const mapaPacientes = new Map();

      try {
        const consultaPacientes = query(
          collection(db, "pacientes"),
          where("laboratorioId", "==", laboratorioId)
        );

        const snapshotPacientes =
          await getDocs(consultaPacientes);

        snapshotPacientes.forEach((documento) => {
          mapaPacientes.set(documento.id, {
            id: documento.id,
            ...documento.data(),
          });
        });
      } catch (errorPacientes) {
        console.error(
          "Error al consultar los pacientes:",
          errorPacientes
        );

        setAviso(
          "Las estadísticas se cargaron, pero no fue posible consultar los nombres de los pacientes. Revisa los permisos de lectura de Firestore."
        );
      }

      // 4. Relacionar cada orden con su paciente.
      const ordenesConPacientes =
        ordenesRecientes.map((orden) => {
          const nombre =
            resolverNombrePaciente(
              orden,
              mapaPacientes
            );

          return {
            ...orden,
            pacienteNombreVisible: nombre,
          };
        });

      setOrdenes(ordenesConPacientes);

    } catch (e) {
      console.error(
        "Error al cargar el dashboard:",
        e
      );

      setError(
        e?.message ||
        "No se pudo cargar el Dashboard del laboratorio."
      );
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  // ==========================================
  // CARGAR AL ENTRAR
  // ==========================================

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ==========================================
  // VERIFICAR ROL
  // ==========================================

  if (usuario?.rol !== "administrador") {
    return (
      <div className="s3-error">
        Este Dashboard está disponible únicamente
        para el Administrador del Laboratorio.
      </div>
    );
  }

  // ==========================================
  // CARGANDO
  // ==========================================

  if (cargando) {
    return (
      <div className="s3-empty">
        Cargando Dashboard del laboratorio...
      </div>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================

  if (error) {
    return (
      <div>
        <div className="s3-error">
          {error}
        </div>

        <button
          type="button"
          className="s3-button secondary"
          onClick={cargar}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ==========================================
  // INTERFAZ DEL DASHBOARD
  // ==========================================

  return (
    <div>
      {/* ENCABEZADO */}

      <div className="s3-header">
        <div>
          <h2>
            Dashboard del laboratorio
          </h2>

          <p>
            {texto(laboratorio?.nombreVisible) ||
              texto(laboratorio?.nombre) ||
              "Laboratorio Clínico"}
          </p>
        </div>

        <button
          type="button"
          className="s3-button secondary"
          onClick={cargar}
        >
          Actualizar datos
        </button>
      </div>

      {/* ESTADÍSTICAS */}

      {resumen && (
        <div className="s3-grid">
          <TarjetaEstadistica
            titulo="Pacientes"
            valor={resumen.pacientes ?? 0}
          />

          <TarjetaEstadistica
            titulo="Análisis"
            valor={resumen.analisis ?? 0}
          />

          <TarjetaEstadistica
            titulo="Ventas"
            valor={resumen.ventas ?? 0}
          />

          <TarjetaEstadistica
            titulo="Total vendido"
            valor={montoVisible(
              resumen.totalVentas
            )}
          />

          <TarjetaEstadistica
            titulo="Órdenes"
            valor={resumen.ordenes ?? 0}
          />

          <TarjetaEstadistica
            titulo="Resultados finalizados"
            valor={
              resumen.resultadosFinalizados ?? 0
            }
          />

          <TarjetaEstadistica
            titulo="Resultados pendientes"
            valor={
              resumen.resultadosPendientes ?? 0
            }
          />

          <TarjetaEstadistica
            titulo="Muestras pendientes"
            valor={
              resumen.muestrasPendientes ?? 0
            }
          />
        </div>
      )}

      {/* AVISO SI NO SE PUDO LEER PACIENTES */}

      {aviso && (
        <div className="s3-error">
          {aviso}
        </div>
      )}

      {/* ÓRDENES RECIENTES */}

      <div className="s3-header">
        <div>
          <h2>
            Órdenes recientes
          </h2>

          <p>
            Últimas órdenes registradas en tu laboratorio.
          </p>
        </div>
      </div>

      {ordenes.length === 0 ? (
        <div className="s3-empty">
          No hay órdenes recientes.
        </div>
      ) : (
        <div className="s3-list">
          {ordenes.map((orden) => (
            <div
              className="s3-card"
              key={orden.id}
            >
              {/* NÚMERO DE ORDEN */}

              <h3>
                Orden:{" "}
                {texto(orden.numeroOrden) ||
                  texto(orden.codigoOrden) ||
                  texto(orden.codigo) ||
                  texto(orden.id) ||
                  "Sin número"}
              </h3>

              {/* NOMBRE DEL PACIENTE */}

              <p>
                <strong>
                  Paciente:
                </strong>{" "}
                {orden.pacienteNombreVisible}
              </p>

              {/* ESTADO */}

              <p>
                <strong>
                  Estado:
                </strong>{" "}
                {estadoVisible(orden.estado)}
              </p>

              {/* TOTAL */}

              <p>
                <strong>
                  Total:
                </strong>{" "}
                {montoVisible(
                  orden.total ?? orden.totalVenta ?? 0
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


