import { useEffect, useMemo, useState } from "react";
import { obtenerPacientes } from "../services/pacientesService";
import { obtenerAnalisis } from "../services/analisisService";
import {
  crearSolicitud,
  obtenerSolicitudes,
} from "../services/solicitudesService";
import "./GestionSolicitudes.css";

function GestionSolicitudes({ usuario, onVolver }) {
  const laboratorioId = usuario?.laboratorioId || "";
  const empleadoId = usuario?.id || usuario?.uid || "";

  const [pacientes, setPacientes] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [pacienteId, setPacienteId] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cargarDatos = async () => {
      if (!laboratorioId) {
        setError("El usuario no está asociado a un laboratorio.");
        setCargando(false);
        return;
      }

      try {
        setCargando(true);
        setError("");

        const [pacientesResultado, analisisResultado, solicitudesResultado] =
          await Promise.all([
            obtenerPacientes(laboratorioId),
            obtenerAnalisis(laboratorioId),
            obtenerSolicitudes(laboratorioId),
          ]);

        setPacientes(Array.isArray(pacientesResultado) ? pacientesResultado : []);
        setAnalisis(
          Array.isArray(analisisResultado)
            ? analisisResultado.filter((item) => item.activo === true)
            : []
        );
        setSolicitudes(
          Array.isArray(solicitudesResultado) ? solicitudesResultado : []
        );
      } catch (err) {
        console.error("Error cargando solicitudes:", err);
        setError(
          err?.message || "No se pudo cargar la información de solicitudes."
        );
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [laboratorioId]);

  const analisisFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return analisis;

    return analisis.filter((item) => {
      const nombre = String(item.nombre || "").toLowerCase();
      const tipo = String(item.tipo || "").toLowerCase();
      return nombre.includes(texto) || tipo.includes(texto);
    });
  }, [analisis, busqueda]);

  const total = useMemo(() => {
    return seleccionados.reduce((acumulado, item) => {
      const precio = Number(item.precio || 0);
      const cantidad = Number(item.cantidad || 1);
      return acumulado + precio * cantidad;
    }, 0);
  }, [seleccionados]);

  const agregarAnalisis = (item) => {
    setError("");
    setMensaje("");

    const id = item.analisisId || item.id;
    const existe = seleccionados.some(
      (seleccionado) => seleccionado.analisisId === id
    );

    if (existe) {
      setError("Ese análisis ya fue agregado.");
      return;
    }

    setSeleccionados((actual) => [
      ...actual,
      {
        analisisId: id,
        nombre: item.nombre || "",
        precio: Number(item.precio || 0),
        cantidad: 1,
      },
    ]);
  };

  const cambiarCantidad = (analisisId, valor) => {
    const numero = Number(valor);
    const cantidad = Number.isFinite(numero) && numero >= 1 ? Math.floor(numero) : 1;

    setSeleccionados((actual) =>
      actual.map((item) =>
        item.analisisId === analisisId ? { ...item, cantidad } : item
      )
    );
  };

  const quitarAnalisis = (analisisId) => {
    setSeleccionados((actual) =>
      actual.filter((item) => item.analisisId !== analisisId)
    );
  };

  const guardarSolicitud = async () => {
    setError("");
    setMensaje("");

    if (!pacienteId) {
      setError("Debe seleccionar un paciente.");
      return;
    }

    if (seleccionados.length === 0) {
      setError("Debe seleccionar al menos un análisis.");
      return;
    }

    if (!empleadoId) {
      setError("No se pudo identificar al usuario que registra la solicitud.");
      return;
    }

    try {
      setGuardando(true);

      await crearSolicitud(
        laboratorioId,
        empleadoId,
        pacienteId,
        seleccionados
      );

      const nuevasSolicitudes = await obtenerSolicitudes(laboratorioId);
      setSolicitudes(
        Array.isArray(nuevasSolicitudes) ? nuevasSolicitudes : []
      );

      setPacienteId("");
      setSeleccionados([]);
      setBusqueda("");
      setMensaje("Solicitud registrada correctamente.");
    } catch (err) {
      console.error("Error registrando solicitud:", err);
      setError(err?.message || "No se pudo registrar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  const obtenerNombrePaciente = (idPaciente) => {
    const paciente = pacientes.find(
      (item) => item.id === idPaciente || item.pacienteId === idPaciente
    );

    if (!paciente) return "Paciente no encontrado";

    return [paciente.nombres, paciente.apellidos]
      .filter(Boolean)
      .join(" ")
      .trim();
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    if (typeof fecha.toDate === "function") {
      return fecha.toDate().toLocaleString("es-BO");
    }
    if (fecha instanceof Date) {
      return fecha.toLocaleString("es-BO");
    }
    return "Registrada";
  };

  if (cargando) {
    return (
      <main className="gs-page">
        <section className="gs-card">
          <div className="gs-card-header">
            <span>SOLICITUDES</span>
            <h2>Gestión de solicitudes</h2>
            <p>Cargando información del laboratorio...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="gs-page">
      <header className="gs-header">
        <div className="gs-header-info">
          {onVolver && (
            <button type="button" className="gs-back-button" onClick={onVolver}>
              ← Volver
            </button>
          )}

          <span className="gs-eyebrow">SOLICITUDES DE ANÁLISIS</span>
          <h1>Gestión de solicitudes</h1>
          <p>
            Registra solicitudes de análisis clínicos, selecciona al paciente y
            calcula automáticamente el total de los estudios solicitados.
          </p>
        </div>

        <div className="gs-header-icon">📋</div>
      </header>

      {mensaje && (
        <div className="gs-message gs-message-success">✓ {mensaje}</div>
      )}

      {error && <div className="gs-message gs-message-error">! {error}</div>}

      <section className="gs-stats">
        <article className="gs-stat-card">
          <div className="gs-stat-icon gs-stat-purple">📋</div>
          <div>
            <span>SOLICITUDES</span>
            <strong>{solicitudes.length}</strong>
          </div>
        </article>

        <article className="gs-stat-card">
          <div className="gs-stat-icon gs-stat-green">🔬</div>
          <div>
            <span>ANÁLISIS SELECCIONADOS</span>
            <strong>{seleccionados.length}</strong>
          </div>
        </article>

        <article className="gs-stat-card">
          <div className="gs-stat-icon gs-stat-blue">Bs</div>
          <div>
            <span>TOTAL ACTUAL</span>
            <strong>{total.toFixed(2)}</strong>
          </div>
        </article>
      </section>

      <section className="gs-card">
        <div className="gs-card-header">
          <span>PASO 1</span>
          <h2>Seleccionar paciente</h2>
          <p>Selecciona el paciente para quien se registrará la solicitud.</p>
        </div>

        <div className="gs-field">
          <label htmlFor="gs-paciente">Paciente</label>
          <select
            id="gs-paciente"
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
          >
            <option value="">Seleccione un paciente</option>
            {pacientes.map((paciente) => (
              <option
                key={paciente.id}
                value={paciente.pacienteId || paciente.id}
              >
                {paciente.nombres} {paciente.apellidos} - CI {paciente.ci}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="gs-card">
        <div className="gs-card-header">
          <span>PASO 2</span>
          <h2>Seleccionar análisis</h2>
          <p>Busca y agrega uno o varios análisis a la solicitud.</p>
        </div>

        <div className="gs-field">
          <label htmlFor="gs-busqueda">Buscar análisis</label>
          <input
            id="gs-busqueda"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o tipo..."
          />
        </div>

        {analisisFiltrados.length === 0 ? (
          <div className="gs-empty">No existen análisis disponibles.</div>
        ) : (
          <div className="gs-table-wrap">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>ANÁLISIS</th>
                  <th>TIPO</th>
                  <th>PRECIO</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {analisisFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.nombre}</strong></td>
                    <td>{item.tipo || "-"}</td>
                    <td>Bs {Number(item.precio || 0).toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="gs-add-button"
                        onClick={() => agregarAnalisis(item)}
                      >
                        + Agregar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="gs-card">
        <div className="gs-card-header">
          <span>PASO 3</span>
          <h2>Detalle de la solicitud</h2>
          <p>Revisa los análisis seleccionados antes de registrar.</p>
        </div>

        {seleccionados.length === 0 ? (
          <div className="gs-empty">Todavía no agregaste análisis.</div>
        ) : (
          <div className="gs-table-wrap">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>ANÁLISIS</th>
                  <th>PRECIO</th>
                  <th>CANTIDAD</th>
                  <th>SUBTOTAL</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {seleccionados.map((item) => (
                  <tr key={item.analisisId}>
                    <td><strong>{item.nombre}</strong></td>
                    <td>Bs {Number(item.precio || 0).toFixed(2)}</td>
                    <td>
                      <input
                        className="gs-quantity"
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) =>
                          cambiarCantidad(item.analisisId, e.target.value)
                        }
                      />
                    </td>
                    <td>
                      Bs{" "}
                      {(
                        Number(item.precio || 0) * Number(item.cantidad || 1)
                      ).toFixed(2)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="gs-remove-button"
                        onClick={() => quitarAnalisis(item.analisisId)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="gs-total-box">
          <span>TOTAL DE LA SOLICITUD</span>
          <strong>Bs {total.toFixed(2)}</strong>
        </div>

        <div className="gs-save-area">
          <button
            type="button"
            className="gs-save-button"
            disabled={guardando || !pacienteId || seleccionados.length === 0}
            onClick={guardarSolicitud}
          >
            {guardando ? "Registrando..." : "Registrar solicitud"}
          </button>
        </div>
      </section>

      <section className="gs-card">
        <div className="gs-card-header">
          <span>HISTORIAL</span>
          <h2>Solicitudes registradas</h2>
          <p>Consulta las solicitudes existentes del laboratorio.</p>
        </div>

        {solicitudes.length === 0 ? (
          <div className="gs-empty">No existen solicitudes registradas.</div>
        ) : (
          <div className="gs-table-wrap">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>PACIENTE</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th>TOTAL</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((solicitud) => (
                  <tr key={solicitud.id}>
                    <td>{obtenerNombrePaciente(solicitud.pacienteId)}</td>
                    <td>{formatearFecha(solicitud.fecha)}</td>
                    <td>{solicitud.estado}</td>
                    <td><strong>Bs {Number(solicitud.total || 0).toFixed(2)}</strong></td>
                    <td>
                      <button
                        type="button"
                        className="gs-detail-button"
                        onClick={() => setDetalle(solicitud)}
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
      </section>

      {detalle && (
        <section className="gs-detail">
          <h2>Detalle de solicitud</h2>

          <div className="gs-detail-grid">
            <div className="gs-detail-item">
              <span>SOLICITUD</span>
              <strong>{detalle.solicitudId || detalle.id}</strong>
            </div>

            <div className="gs-detail-item">
              <span>PACIENTE</span>
              <strong>{obtenerNombrePaciente(detalle.pacienteId)}</strong>
            </div>

            <div className="gs-detail-item">
              <span>FECHA</span>
              <strong>{formatearFecha(detalle.fecha)}</strong>
            </div>

            <div className="gs-detail-item">
              <span>ESTADO</span>
              <strong>{detalle.estado || "Sin estado"}</strong>
            </div>
          </div>

          {Array.isArray(detalle.analisis) && detalle.analisis.length > 0 ? (
            <div className="gs-table-wrap">
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>ANÁLISIS</th>
                    <th>PRECIO</th>
                    <th>CANTIDAD</th>
                    <th>SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.analisis.map((item) => {
                    const subtotal =
                      item.subtotal ??
                      Number(item.precio || 0) * Number(item.cantidad || 1);

                    return (
                      <tr key={item.analisisId}>
                        <td>{item.nombre}</td>
                        <td>Bs {Number(item.precio || 0).toFixed(2)}</td>
                        <td>{item.cantidad || 1}</td>
                        <td>Bs {Number(subtotal).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="gs-empty">
              Esta solicitud no contiene análisis registrados.
            </div>
          )}

          <div className="gs-total-box">
            <span>TOTAL</span>
            <strong>Bs {Number(detalle.total || 0).toFixed(2)}</strong>
          </div>

          <div className="gs-detail-actions">
            <button
              type="button"
              className="gs-close-button"
              onClick={() => setDetalle(null)}
            >
              Cerrar detalle
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default GestionSolicitudes;
