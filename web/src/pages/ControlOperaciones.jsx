
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  listarAuditoriaLaboratorio,
  listarNotificacionesLaboratorio,
  marcarNotificacionLeida,
} from "../services/adminSprint3Service";

import "./Sprint3.css";

// ==========================================
// CONVERTIR FECHA
// ==========================================

function fechaVisible(valor) {
  if (!valor) {
    return "-";
  }

  const fecha =
    typeof valor?.toDate === "function"
      ? valor.toDate()
      : typeof valor?.seconds === "number"
        ? new Date(valor.seconds * 1000)
        : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? "-"
    : fecha.toLocaleString("es-BO");
}

// ==========================================
// TEXTO SEGURO
// ==========================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number"
  ) {
    return String(valor).trim();
  }

  return "";
}

// ==========================================
// NOMBRE DE LA ACCIÓN
// ==========================================

function nombreAccion(accion) {
  const codigo = texto(accion).toUpperCase();

  const nombres = {
    CAMBIO_PASSWORD: "Cambio de contraseña",
    REGISTRO_RESULTADO: "Registro de resultado",
    CREAR_RESULTADO: "Registro de resultado",
    VALIDAR_RESULTADO: "Validación de resultado",
    RESULTADO_VALIDADO: "Validación de resultado",
    CREAR_PACIENTE: "Registro de paciente",
    REGISTRO_PACIENTE: "Registro de paciente",
    ACTUALIZAR_PACIENTE: "Actualización de paciente",
    CREAR_MUESTRA: "Registro de muestra",
    REGISTRO_MUESTRA: "Registro de muestra",
    ACTUALIZAR_MUESTRA: "Actualización de muestra",
    CREAR_VENTA: "Registro de venta",
    REGISTRO_VENTA: "Registro de venta",
    CREAR_ORDEN: "Generación de orden",
    REGISTRO_ORDEN: "Registro de orden",
    INICIO_SESION: "Inicio de sesión",
    CIERRE_SESION: "Cierre de sesión",
  };

  return nombres[codigo] ||
    texto(accion).replace(/_/g, " ") ||
    "Operación del sistema";
}

// ==========================================
// ENTIDAD DE AUDITORÍA
// ==========================================

function obtenerEntidad(item) {
  // Primero mostrar la información real de Firestore.
  const entidadGuardada =
    texto(item.entidad) ||
    texto(item.tipoEntidad) ||
    texto(item.coleccion);

  if (entidadGuardada) {
    return entidadGuardada;
  }

  // Para eventos antiguos, inferir solamente
  // la categoría general a partir de la acción.
  const accion = texto(item.accion).toUpperCase();

  if (accion.includes("PASSWORD") ||
      accion.includes("CONTRASEÑA") ||
      accion.includes("USUARIO") ||
      accion.includes("SESION")) {
    return "Usuarios";
  }

  if (accion.includes("PACIENTE")) {
    return "Pacientes";
  }

  if (accion.includes("RESULTADO")) {
    return "Resultados clínicos";
  }

  if (accion.includes("MUESTRA")) {
    return "Muestras";
  }

  if (accion.includes("VENTA")) {
    return "Ventas";
  }

  if (accion.includes("ORDEN")) {
    return "Órdenes de análisis";
  }

  if (accion.includes("SOLICITUD")) {
    return "Solicitudes de análisis";
  }

  if (accion.includes("LABORATORIO")) {
    return "Laboratorios";
  }

  if (accion.includes("ROL")) {
    return "Roles y permisos";
  }

  return "No especificada";
}

// ==========================================
// DETALLE DE AUDITORÍA
// ==========================================

function obtenerDetalle(item) {
  // Dar prioridad al detalle realmente guardado.
  const detalleGuardado =
    texto(item.detalle) ||
    texto(item.descripcion) ||
    texto(item.mensaje);

  if (detalleGuardado) {
    return detalleGuardado;
  }

  // Descripciones generales para registros antiguos.
  // No atribuyen información que no esté registrada.
  const accion = texto(item.accion).toUpperCase();

  const detalles = {
    CAMBIO_PASSWORD:
      "Se registró una operación de cambio de contraseña. No se guardaron detalles adicionales.",

    REGISTRO_RESULTADO:
      "Se registró un resultado clínico en el sistema.",

    CREAR_RESULTADO:
      "Se registró un resultado clínico en el sistema.",

    VALIDAR_RESULTADO:
      "Se registró una validación de resultado clínico.",

    RESULTADO_VALIDADO:
      "Se registró una validación de resultado clínico.",

    CREAR_PACIENTE:
      "Se registró un nuevo paciente en el laboratorio.",

    REGISTRO_PACIENTE:
      "Se registró un paciente en el laboratorio.",

    ACTUALIZAR_PACIENTE:
      "Se registró una actualización de datos de paciente.",

    CREAR_MUESTRA:
      "Se registró una muestra clínica.",

    REGISTRO_MUESTRA:
      "Se registró una muestra clínica.",

    ACTUALIZAR_MUESTRA:
      "Se registró una actualización de una muestra clínica.",

    CREAR_VENTA:
      "Se registró una venta de análisis clínicos.",

    REGISTRO_VENTA:
      "Se registró una venta de análisis clínicos.",

    CREAR_ORDEN:
      "Se registró la generación de una orden de análisis.",

    REGISTRO_ORDEN:
      "Se registró una orden de análisis.",

    INICIO_SESION:
      "Se registró un inicio de sesión.",

    CIERRE_SESION:
      "Se registró un cierre de sesión.",
  };

  return detalles[accion] ||
    "La operación quedó registrada sin detalles adicionales.";
}

// ==========================================
// BUSCAR NOMBRE DEL USUARIO EN FIRESTORE
// ==========================================

async function obtenerNombreUsuario(
  uid,
  laboratorioId
) {
  if (!uid) {
    return "";
  }

  try {
    const referencia = doc(
      db,
      "usuarios",
      uid
    );

    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      return "";
    }

    const datos = documento.data();

    // Evitar mostrar perfiles de otro laboratorio.
    if (
      datos.laboratorioId &&
      datos.laboratorioId !== laboratorioId
    ) {
      return "";
    }

    const nombreCompleto =
      texto(datos.nombreCompleto);

    const nombres =
      texto(datos.nombres || datos.nombre);

    const apellidos =
      texto(datos.apellidos || datos.apellido);

    const nombre =
      [nombres, apellidos]
        .filter(Boolean)
        .join(" ");

    const correo =
      texto(datos.email || datos.correo);

    const resultado =
      nombreCompleto ||
      nombre ||
      texto(datos.displayName) ||
      correo;

    return resultado === uid ? "" : resultado;
  } catch (error) {
    console.warn(
      "No se pudo recuperar el nombre del usuario:",
      error
    );

    return "";
  }
}

// ==========================================
// COMPLETAR DATOS DE AUDITORÍA
// ==========================================

async function completarAuditoria(
  registros,
  laboratorioId
) {
  // Obtener UID únicos.
  const ids = [
    ...new Set(
      registros
        .map((item) => texto(item.usuarioId))
        .filter(Boolean)
    ),
  ];

  const nombres = new Map();

  // Consultar cada perfil una sola vez.
  await Promise.all(
    ids.map(async (uid) => {
      const nombre = await obtenerNombreUsuario(
        uid,
        laboratorioId
      );

      nombres.set(uid, nombre);
    })
  );

  return registros.map((item) => {
    const uid = texto(item.usuarioId);

    const nombreGuardado =
      texto(item.usuarioNombre);

    const nombreUsuario =
      nombreGuardado && nombreGuardado !== uid
        ? nombreGuardado
        : nombres.get(uid) || "Nombre no disponible";

    return {
      ...item,

      usuarioNombre: nombreUsuario,

      entidadVisible: obtenerEntidad(item),

      detalleVisible: obtenerDetalle(item),

      accionVisible: nombreAccion(item.accion),
    };
  });
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function ControlOperaciones({
  usuario,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const [seccion, setSeccion] =
    useState("notificaciones");

  const [notificaciones, setNotificaciones] =
    useState([]);

  const [auditoria, setAuditoria] =
    useState([]);

  const [error, setError] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  // ==========================================
  // CARGAR INFORMACIÓN
  // ==========================================

  const cargar = useCallback(async () => {
    if (!laboratorioId) {
      setError(
        "El usuario no tiene un laboratorio asignado."
      );

      setNotificaciones([]);
      setAuditoria([]);
      setCargando(false);

      return;
    }

    try {
      setCargando(true);
      setError("");

      const [avisos, acciones] =
        await Promise.all([
          listarNotificacionesLaboratorio(
            laboratorioId
          ),

          listarAuditoriaLaboratorio(
            laboratorioId
          ),
        ]);

      const accionesCompletas =
        await completarAuditoria(
          acciones,
          laboratorioId
        );

      setNotificaciones(avisos);
      setAuditoria(accionesCompletas);

    } catch (e) {
      console.error(
        "Error en control de operaciones:",
        e
      );

      setError(
        e?.message ||
        "No se pudo cargar el control de operaciones."
      );
    } finally {
      setCargando(false);
    }
  }, [laboratorioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ==========================================
  // MARCAR NOTIFICACIÓN COMO LEÍDA
  // ==========================================

  const leer = async (id) => {
    try {
      setError("");

      await marcarNotificacionLeida(id);

      await cargar();
    } catch (e) {
      setError(
        e?.message ||
        "No se pudo marcar la notificación."
      );
    }
  };

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div>
      {/* ENCABEZADO */}

      <div className="s3-header">
        <div>
          <h2>
            Notificaciones y auditoría
          </h2>

          <p>
            HU-35: seguimiento de eventos y acciones.
          </p>
        </div>

        <button
          className="s3-button secondary"
          type="button"
          onClick={cargar}
          disabled={cargando}
        >
          {cargando
            ? "Cargando..."
            : "Actualizar"}
        </button>
      </div>

      {/* MENSAJES DE ERROR */}

      {error && (
        <div className="s3-error">
          {error}
        </div>
      )}

      {/* PESTAÑAS */}

      <div className="s3-tabs">
        <button
          className={`s3-button ${
            seccion === "notificaciones"
              ? ""
              : "secondary"
          }`}
          type="button"
          onClick={() =>
            setSeccion("notificaciones")
          }
        >
          Notificaciones
        </button>

        <button
          className={`s3-button ${
            seccion === "auditoria"
              ? ""
              : "secondary"
          }`}
          type="button"
          onClick={() =>
            setSeccion("auditoria")
          }
        >
          Auditoría
        </button>
      </div>

      {/* CONTENIDO */}

      <div className="s3-section">
        {cargando ? (
          <div className="s3-empty">
            Cargando...
          </div>
        ) : seccion === "notificaciones" ? (

          // ==================================
          // NOTIFICACIONES
          // ==================================

          notificaciones.length === 0 ? (
            <div className="s3-empty">
              No existen notificaciones.
            </div>
          ) : (
            notificaciones.map((item) => (
              <div
                className="s3-card"
                key={item.id}
              >
                <div className="s3-header">
                  <div>
                    <h3>
                      {item.titulo ||
                        "Evento del laboratorio"}
                    </h3>

                    <p>
                      {item.mensaje ||
                        item.detalle ||
                        "-"}
                    </p>
                  </div>

                  <span
                    className={
                      item.leida
                        ? "s3-muted"
                        : "s3-badge"
                    }
                  >
                    {item.leida
                      ? "Leída"
                      : "Nueva"}
                  </span>
                </div>

                <p className="s3-muted">
                  {fechaVisible(
                    item.fecha ??
                    item.fechaRegistro
                  )}
                </p>

                {!item.leida && (
                  <button
                    className="s3-button secondary"
                    type="button"
                    onClick={() =>
                      leer(item.id)
                    }
                  >
                    Marcar como leída
                  </button>
                )}
              </div>
            ))
          )

        ) : (

          // ==================================
          // AUDITORÍA
          // ==================================

          auditoria.length === 0 ? (
            <div className="s3-empty">
              No existen registros de auditoría.
            </div>
          ) : (
            auditoria.map((item) => (
              <div
                className="s3-card"
                key={item.id}
              >
                <h3>
                  {item.accionVisible}
                </h3>

                {/* CÓDIGO DE ACCIÓN */}

                <p className="s3-muted">
                  Código: {item.accion || "-"}
                </p>

                {/* USUARIO */}

                <p>
                  <strong>
                    Usuario:
                  </strong>{" "}
                  {item.usuarioNombre}
                </p>

                {/* ENTIDAD */}

                <p>
                  <strong>
                    Entidad:
                  </strong>{" "}
                  {item.entidadVisible}

                  {item.entidadId
                    ? ` (${item.entidadId})`
                    : ""}
                </p>

                {/* DETALLE */}

                <p>
                  <strong>
                    Detalle:
                  </strong>{" "}
                  {item.detalleVisible}
                </p>

                {/* FECHA */}

                <p className="s3-muted">
                  Fecha:{" "}
                  {fechaVisible(
                    item.fecha ??
                    item.fechaRegistro
                  )}
                </p>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
