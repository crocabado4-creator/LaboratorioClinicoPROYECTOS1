import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  query
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import "./SuperAdminAuditoria.css";

const COLECCION_AUDITORIA = "auditoria";

function convertirFecha(valor) {
  if (!valor) return null;

  if (typeof valor.toDate === "function") {
    return valor.toDate();
  }

  if (typeof valor.seconds === "number") {
    return new Date(valor.seconds * 1000);
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function mostrarFecha(valor) {
  const fecha = convertirFecha(valor);

  if (!fecha) return "Fecha no disponible";

  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function obtenerNombreUsuario(usuario) {
  if (!usuario) return "";

  const nombre = [
    usuario.nombres || usuario.nombre || "",
    usuario.apellidos || usuario.apellido || ""
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    nombre ||
    usuario.nombreCompleto ||
    usuario.displayName ||
    usuario.email ||
    usuario.correo ||
    ""
  );
}

function obtenerNombreLaboratorio(laboratorio) {
  if (!laboratorio) return "";

  return (
    laboratorio.nombre ||
    laboratorio.nombreLaboratorio ||
    laboratorio.razonSocial ||
    laboratorio.nombreComercial ||
    ""
  );
}

function formatearAccion(accion) {
  const acciones = {
    CAMBIO_PASSWORD: "Cambio de contraseña",
    CREAR_USUARIO: "Creación de usuario",
    USUARIO_CREADO: "Creación de usuario",
    EDITAR_USUARIO: "Actualización de usuario",
    ACTUALIZAR_USUARIO: "Actualización de usuario",
    ELIMINAR_USUARIO: "Eliminación de usuario",
    CREAR_LABORATORIO: "Creación de laboratorio",
    EDITAR_LABORATORIO: "Actualización de laboratorio",
    ACTUALIZAR_LABORATORIO: "Actualización de laboratorio",
    ELIMINAR_LABORATORIO: "Eliminación de laboratorio",
    LOGIN: "Inicio de sesión",
    LOGOUT: "Cierre de sesión"
  };

  if (!accion) return "Actividad registrada";

  return (
    acciones[accion] ||
    String(accion)
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^./, (letra) => letra.toUpperCase())
  );
}

function generarDescripcion(registro) {
  if (registro.descripcion) {
    return registro.descripcion;
  }

  const accion = String(registro.accion || "").toUpperCase();
  const modulo = registro.modulo || "sistema";
  const objetivo = registro.usuarioObjetivo || "";

  if (accion === "CAMBIO_PASSWORD") {
    return objetivo
      ? `Se realizó un cambio de contraseña para ${objetivo}.`
      : "Se realizó un cambio de contraseña de una cuenta del sistema.";
  }

  if (accion.includes("CREAR") || accion.includes("REGISTR")) {
    return `Se registró una nueva actividad en el módulo de ${modulo}.`;
  }

  if (accion.includes("EDITAR") || accion.includes("ACTUALIZAR")) {
    return `Se actualizó información en el módulo de ${modulo}.`;
  }

  if (accion.includes("ELIMINAR")) {
    return `Se eliminó un registro del módulo de ${modulo}.`;
  }

  if (accion === "LOGIN") {
    return "El usuario inició sesión en la plataforma.";
  }

  if (accion === "LOGOUT") {
    return "El usuario cerró sesión en la plataforma.";
  }

  return `Se registró la actividad "${formatearAccion(
    registro.accion
  )}" en el módulo de ${modulo}.`;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function SuperAdminAuditoria({ onVolver }) {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroLaboratorio, setFiltroLaboratorio] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);

  function volverAlDashboard() {
    if (typeof onVolver === "function") {
      onVolver();
      return;
    }

    // Navegación sin react-router-dom.
    // Requiere que App.jsx reconozca esta ruta.
    window.location.assign("/super-admin");
  }

  async function cargarAuditoria() {
    setCargando(true);
    setError("");

    try {
      const consultaAuditoria = query(
        collection(db, COLECCION_AUDITORIA),
        limit(500)
      );

      const resultadoAuditoria = await getDocs(consultaAuditoria);

      const usuarios = new Map();
      const laboratorios = new Map();

      const [resultadoUsuarios, resultadoLaboratorios] =
        await Promise.allSettled([
          getDocs(collection(db, "usuarios")),
          getDocs(collection(db, "laboratorios"))
        ]);

      if (resultadoUsuarios.status === "fulfilled") {
        resultadoUsuarios.value.docs.forEach((documento) => {
          const datos = documento.data();
          const nombre = obtenerNombreUsuario(datos);

          if (nombre) {
            usuarios.set(documento.id, nombre);

            if (datos.uid) {
              usuarios.set(datos.uid, nombre);
            }
          }
        });
      } else {
        console.warn(
          "No se pudo consultar usuarios:",
          resultadoUsuarios.reason
        );
      }

      if (resultadoLaboratorios.status === "fulfilled") {
        resultadoLaboratorios.value.docs.forEach((documento) => {
          const datos = documento.data();
          const nombre = obtenerNombreLaboratorio(datos);

          if (nombre) {
            laboratorios.set(documento.id, nombre);
          }
        });
      } else {
        console.warn(
          "No se pudo consultar laboratorios:",
          resultadoLaboratorios.reason
        );
      }

      const datos = resultadoAuditoria.docs.map((documento) => {
        const informacion = documento.data();

        const usuarioId =
          informacion.usuarioId ||
          informacion.uid ||
          "";

        const usuarioObjetivoId =
          informacion.usuarioObjetivoId || "";

        const laboratorioId =
          informacion.laboratorioId || "";

        const usuarioNombre =
          usuarios.get(usuarioId) ||
          informacion.usuarioNombre ||
          informacion.nombreUsuario ||
          informacion.email ||
          "Usuario no disponible";

        const usuarioObjetivo =
          usuarios.get(usuarioObjetivoId) ||
          informacion.usuarioObjetivoNombre ||
          "";

        const laboratorioNombre =
          laboratorios.get(laboratorioId) ||
          informacion.laboratorioNombre ||
          "Laboratorio no disponible";

        const registro = {
          id: documento.id,
          usuarioId,
          usuarioNombre,
          usuarioObjetivoId,
          usuarioObjetivo,
          laboratorioId,
          laboratorioNombre,

          accion:
            informacion.accion ||
            informacion.evento ||
            "",

          modulo:
            informacion.modulo ||
            "General",

          fecha:
            informacion.fecha ||
            informacion.fechaHora ||
            informacion.createdAt ||
            informacion.creadoEn ||
            null,

          descripcion:
            informacion.descripcion ||
            informacion.detalle ||
            informacion.mensaje ||
            ""
        };

        return {
          ...registro,
          accionTexto: formatearAccion(registro.accion),
          descripcionTexto: generarDescripcion(registro)
        };
      });

      datos.sort((a, b) => {
        const fechaA = convertirFecha(a.fecha)?.getTime() || 0;
        const fechaB = convertirFecha(b.fecha)?.getTime() || 0;

        return fechaB - fechaA;
      });

      setRegistros(datos);
    } catch (err) {
      console.error("Error al consultar auditoría:", err);

      if (err.code === "permission-denied") {
        setError(
          "No tienes permisos para consultar los registros de auditoría. Revisa las reglas de Firestore."
        );
      } else {
        setError(
          "No se pudieron cargar las actividades: " +
            (err.message || "Error desconocido")
        );
      }

      setRegistros([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarAuditoria();
  }, []);

  const acciones = useMemo(() => {
    return [...new Set(registros.map((r) => r.accion))]
      .filter(Boolean)
      .sort();
  }, [registros]);

  const laboratorios = useMemo(() => {
    const mapa = new Map();

    registros.forEach((registro) => {
      mapa.set(
        registro.laboratorioId || registro.laboratorioNombre,
        registro.laboratorioNombre
      );
    });

    return [...mapa.entries()];
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((registro) => {
      const texto = normalizarTexto(busqueda.trim());

      const contenido = normalizarTexto(
        [
          registro.usuarioNombre,
          registro.usuarioObjetivo,
          registro.accionTexto,
          registro.modulo,
          registro.laboratorioNombre,
          registro.descripcionTexto
        ].join(" ")
      );

      const coincideBusqueda =
        !texto || contenido.includes(texto);

      const coincideAccion =
        !filtroAccion || registro.accion === filtroAccion;

      const coincideLaboratorio =
        !filtroLaboratorio ||
        (registro.laboratorioId || registro.laboratorioNombre) ===
          filtroLaboratorio;

      const fechaRegistro = convertirFecha(registro.fecha);

      const fechaTexto = fechaRegistro
        ? [
            fechaRegistro.getFullYear(),
            String(fechaRegistro.getMonth() + 1).padStart(2, "0"),
            String(fechaRegistro.getDate()).padStart(2, "0")
          ].join("-")
        : "";

      const coincideFecha =
        !filtroFecha || fechaTexto === filtroFecha;

      return (
        coincideBusqueda &&
        coincideAccion &&
        coincideLaboratorio &&
        coincideFecha
      );
    });
  }, [
    registros,
    busqueda,
    filtroAccion,
    filtroLaboratorio,
    filtroFecha
  ]);

  const totalUsuarios = useMemo(() => {
    return new Set(
      registros
        .map((registro) => registro.usuarioId)
        .filter(Boolean)
    ).size;
  }, [registros]);

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroAccion("");
    setFiltroLaboratorio("");
    setFiltroFecha("");
  }

  return (
    <div className="auditoria-contenedor">
      <div className="auditoria-encabezado">
        <div>
          <button
            type="button"
            className="auditoria-volver"
            onClick={volverAlDashboard}
          >
            ← Volver al Dashboard
          </button>

          <p className="auditoria-etiqueta">
            SEGURIDAD Y CONTROL
          </p>

          <h1>Auditoría Global</h1>

          <p className="auditoria-subtitulo">
            Supervisa las actividades realizadas por los usuarios
            y laboratorios de la plataforma.
          </p>
        </div>

        <button
          type="button"
          className="auditoria-actualizar"
          onClick={cargarAuditoria}
          disabled={cargando}
        >
          {cargando ? "Actualizando..." : "↻ Actualizar"}
        </button>
      </div>

      <div className="auditoria-estadisticas">
        <div className="auditoria-tarjeta">
          <span>Actividades registradas</span>
          <strong>{registros.length}</strong>
          <small>Últimos registros consultados</small>
        </div>

        <div className="auditoria-tarjeta">
          <span>Usuarios involucrados</span>
          <strong>{totalUsuarios}</strong>
          <small>Usuarios que realizaron acciones</small>
        </div>

        <div className="auditoria-tarjeta">
          <span>Laboratorios</span>
          <strong>{laboratorios.length}</strong>
          <small>Laboratorios con actividad</small>
        </div>

        <div className="auditoria-tarjeta">
          <span>Resultados encontrados</span>
          <strong>{registrosFiltrados.length}</strong>
          <small>Según los filtros seleccionados</small>
        </div>
      </div>

      <div className="auditoria-panel">
        <div className="auditoria-panel-titulo">
          <div>
            <p className="auditoria-etiqueta">
              REGISTRO DE ACTIVIDADES
            </p>

            <h2>Historial de actividades</h2>

            <p>
              Consulta quién realizó cada acción, en qué
              laboratorio y cuándo ocurrió.
            </p>
          </div>
        </div>

        <div className="auditoria-filtros">
          <input
            type="text"
            placeholder="Buscar usuario, acción o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
          >
            <option value="">Todas las acciones</option>

            {acciones.map((accion) => (
              <option key={accion} value={accion}>
                {formatearAccion(accion)}
              </option>
            ))}
          </select>

          <select
            value={filtroLaboratorio}
            onChange={(e) => setFiltroLaboratorio(e.target.value)}
          >
            <option value="">Todos los laboratorios</option>

            {laboratorios.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
          />

          <button
            type="button"
            className="auditoria-limpiar"
            onClick={limpiarFiltros}
          >
            Limpiar
          </button>
        </div>

        {error && (
          <div className="auditoria-error">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="auditoria-vacio">
            <h3>Cargando actividades...</h3>
            <p>Consultando la información de Firestore.</p>
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="auditoria-vacio">
            <div className="auditoria-icono">📋</div>

            <h3>No se encontraron actividades</h3>

            <p>
              {registros.length === 0
                ? "Todavía no existen registros de auditoría."
                : "No hay actividades que coincidan con los filtros."}
            </p>
          </div>
        ) : (
          <div className="auditoria-tabla-contenedor">
            <table className="auditoria-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>Laboratorio</th>
                  <th>Descripción</th>
                  <th>Detalle</th>
                </tr>
              </thead>

              <tbody>
                {registrosFiltrados.map((registro) => (
                  <tr key={registro.id}>
                    <td>{mostrarFecha(registro.fecha)}</td>

                    <td>
                      <div className="auditoria-usuario">
                        <div className="auditoria-avatar">
                          {registro.usuarioNombre
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <strong>{registro.usuarioNombre}</strong>
                      </div>
                    </td>

                    <td>
                      <span className="auditoria-accion">
                        {registro.accionTexto}
                      </span>
                    </td>

                    <td>{registro.modulo}</td>

                    <td>
                      <strong>
                        {registro.laboratorioNombre}
                      </strong>
                    </td>

                    <td className="auditoria-descripcion">
                      {registro.descripcionTexto}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="auditoria-detalle"
                        onClick={() =>
                          setRegistroSeleccionado(registro)
                        }
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="auditoria-nota">
          Se consultan hasta 500 documentos de auditoría por carga.
        </p>
      </div>

      {registroSeleccionado && (
        <div
          className="auditoria-modal-fondo"
          onClick={() => setRegistroSeleccionado(null)}
        >
          <div
            className="auditoria-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auditoria-modal-encabezado">
              <div>
                <p className="auditoria-etiqueta">
                  INFORMACIÓN DE AUDITORÍA
                </p>

                <h2>Detalle de actividad</h2>
              </div>

              <button
                type="button"
                className="auditoria-modal-x"
                onClick={() => setRegistroSeleccionado(null)}
              >
                ✕
              </button>
            </div>

            <div className="auditoria-modal-contenido">
              <div className="auditoria-detalle-destacado">
                <span className="auditoria-accion">
                  {registroSeleccionado.accionTexto}
                </span>

                <h3>
                  {registroSeleccionado.descripcionTexto}
                </h3>

                <p>
                  {mostrarFecha(registroSeleccionado.fecha)}
                </p>
              </div>

              <div className="auditoria-detalle-grid">
                <div className="auditoria-detalle-campo">
                  <span>Usuario responsable</span>
                  <strong>
                    {registroSeleccionado.usuarioNombre}
                  </strong>
                </div>

                <div className="auditoria-detalle-campo">
                  <span>Laboratorio</span>
                  <strong>
                    {registroSeleccionado.laboratorioNombre}
                  </strong>
                </div>

                <div className="auditoria-detalle-campo">
                  <span>Módulo</span>
                  <strong>
                    {registroSeleccionado.modulo}
                  </strong>
                </div>

                <div className="auditoria-detalle-campo">
                  <span>Fecha y hora</span>
                  <strong>
                    {mostrarFecha(registroSeleccionado.fecha)}
                  </strong>
                </div>

                {registroSeleccionado.usuarioObjetivo && (
                  <div className="auditoria-detalle-campo">
                    <span>Usuario afectado</span>
                    <strong>
                      {registroSeleccionado.usuarioObjetivo}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="auditoria-modal-pie">
              <button
                type="button"
                className="auditoria-cerrar"
                onClick={() => setRegistroSeleccionado(null)}
              >
                Cerrar detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}