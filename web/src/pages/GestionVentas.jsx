import { useEffect, useMemo, useState } from "react";
import { obtenerPacientes } from "../services/pacientesService";
import { obtenerSolicitudes } from "../services/solicitudesService";
import {
  obtenerOrdenPorId,
  obtenerVentas,
  registrarVentaYGenerarOrden,
} from "../services/ventasService";
import { generarPDFVenta } from "../services/pdfService";
import "./GestionVentas.css";

function GestionVentas({ usuario, onVolver }) {
  const laboratorioId = usuario?.laboratorioId || "";
  const empleadoId = usuario?.id || usuario?.uid || "";
  const rol = String(usuario?.rol || "").toLowerCase();
  const puedeRegistrar = rol === "recepcionista";

  const [pacientes, setPacientes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [ventas, setVentas] = useState([]);

  const [solicitudId, setSolicitudId] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");

  const [detalleVenta, setDetalleVenta] = useState(null);
  const [detalleOrden, setDetalleOrden] = useState(null);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pacienteFiltro, setPacienteFiltro] = useState("");
  const [usuarioFiltro, setUsuarioFiltro] = useState("");

  // NUEVO: buscador por nombre, apellido o CI
  const [busquedaPaciente, setBusquedaPaciente] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Normalizar texto para buscar sin importar mayúsculas ni tildes
  const normalizarTexto = (texto) => {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  // Convertir fechas de Firestore
  const timestampADate = (fecha) => {
    if (!fecha) return null;

    if (typeof fecha.toDate === "function") {
      return fecha.toDate();
    }

    if (typeof fecha.seconds === "number") {
      return new Date(fecha.seconds * 1000);
    }

    const fechaConvertida = new Date(fecha);

    return Number.isNaN(fechaConvertida.getTime())
      ? null
      : fechaConvertida;
  };

  const formatearFecha = (fecha) => {
    const date = timestampADate(fecha);
    return date ? date.toLocaleString("es-BO") : "Sin fecha";
  };

  const fechaInput = (fecha) => {
    const date = timestampADate(fecha);

    if (!date) return "";

    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
  };

  // Obtener paciente por su ID
  const obtenerPaciente = (idPaciente) => {
    return pacientes.find(
      (item) =>
        String(item.id || "") === String(idPaciente || "") ||
        String(item.pacienteId || "") === String(idPaciente || "")
    );
  };

  // Obtener nombre completo
  const obtenerNombrePaciente = (idPaciente) => {
    const paciente = obtenerPaciente(idPaciente);

    if (!paciente) return idPaciente || "Paciente";

    return [
      paciente.nombres || paciente.nombre,
      paciente.apellidos || paciente.apellido,
    ]
      .filter(Boolean)
      .join(" ");
  };

  // NUEVO: buscar paciente por nombre, apellido o CI
  const coincideBusqueda = (idPaciente, busqueda) => {
    const textoBuscado = normalizarTexto(busqueda);

    if (!textoBuscado) return true;

    const paciente = obtenerPaciente(idPaciente);

    if (!paciente) return false;

    const nombre = paciente.nombres || paciente.nombre || "";
    const apellido = paciente.apellidos || paciente.apellido || "";
    const ci = paciente.ci || paciente.carnet || paciente.documento || "";

    const textoCompleto = normalizarTexto(
      `${nombre} ${apellido} ${ci}`
    );

    // Permite buscar varias palabras
    const palabras = textoBuscado.split(/\s+/).filter(Boolean);

    return palabras.every((palabra) =>
      textoCompleto.includes(palabra)
    );
  };

  // Cargar datos
  const recargar = async () => {
    if (!laboratorioId) {
      setError("El usuario no está asociado a un laboratorio.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const [
        pacientesResultado,
        solicitudesResultado,
        ventasResultado,
      ] = await Promise.all([
        obtenerPacientes(laboratorioId),
        obtenerSolicitudes(laboratorioId),
        obtenerVentas(laboratorioId),
      ]);

      setPacientes(
        Array.isArray(pacientesResultado)
          ? pacientesResultado
          : []
      );

      setSolicitudes(
        Array.isArray(solicitudesResultado)
          ? solicitudesResultado
          : []
      );

      setVentas(
        Array.isArray(ventasResultado)
          ? ventasResultado
          : []
      );
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo cargar ventas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    recargar();
  }, [laboratorioId]);

  // Solicitudes pendientes
  const solicitudesPendientes = useMemo(() => {
    return solicitudes.filter((item) => {
      const estado = String(item.estado || "").toLowerCase();

      return (
        !item.ventaId &&
        !item.ordenId &&
        !["pagada", "vendida", "procesada"].includes(estado)
      );
    });
  }, [solicitudes]);

  // Solicitud seleccionada
  const solicitudSeleccionada = useMemo(() => {
    return (
      solicitudes.find(
        (item) =>
          String(item.id) === String(solicitudId) ||
          String(item.solicitudId) === String(solicitudId)
      ) || null
    );
  }, [solicitudes, solicitudId]);

  // NUEVO: filtrar ventas incluyendo nombre, apellido y CI
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((venta) => {
      if (
        fechaDesde &&
        fechaInput(venta.fecha) < fechaDesde
      ) {
        return false;
      }

      if (
        fechaHasta &&
        fechaInput(venta.fecha) > fechaHasta
      ) {
        return false;
      }

      if (
        pacienteFiltro &&
        String(venta.pacienteId) !== String(pacienteFiltro)
      ) {
        return false;
      }

      if (
        usuarioFiltro &&
        !normalizarTexto(venta.empleadoId).includes(
          normalizarTexto(usuarioFiltro)
        )
      ) {
        return false;
      }

      // Buscar por nombre, apellido o CI
      if (
        busquedaPaciente &&
        !coincideBusqueda(venta.pacienteId, busquedaPaciente)
      ) {
        return false;
      }

      return true;
    });
  }, [
    ventas,
    pacientes,
    fechaDesde,
    fechaHasta,
    pacienteFiltro,
    usuarioFiltro,
    busquedaPaciente,
  ]);

  // Registrar venta y generar orden
  const registrarVenta = async () => {
    setMensaje("");
    setError("");

    if (!solicitudId) {
      setError("Debe seleccionar una solicitud.");
      return;
    }

    if (!empleadoId) {
      setError("No se pudo identificar al usuario.");
      return;
    }

    try {
      setGuardando(true);

      const resultado = await registrarVentaYGenerarOrden({
        laboratorioId,
        empleadoId,
        solicitudId,
        metodoPago,
      });

      await recargar();

      const ventasActualizadas = await obtenerVentas(laboratorioId);

      const ventaCreada = ventasActualizadas.find(
        (item) =>
          item.ventaId === resultado.ventaId ||
          item.id === resultado.ventaId
      );

      setDetalleVenta(ventaCreada || null);
      setDetalleOrden(null);

      if (resultado.ordenId) {
        const orden = await obtenerOrdenPorId(
          resultado.ordenId,
          laboratorioId
        );

        setDetalleOrden(orden);
      }

      setSolicitudId("");
      setMetodoPago("efectivo");

      setMensaje(
        "Venta registrada y orden generada correctamente."
      );
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo registrar la venta.");
    } finally {
      setGuardando(false);
    }
  };

  // Ver detalle de venta
  const verDetalle = async (venta) => {
    setDetalleVenta(venta);
    setDetalleOrden(null);
    setError("");

    try {
      if (venta.ordenId) {
        const orden = await obtenerOrdenPorId(
          venta.ordenId,
          laboratorioId
        );

        setDetalleOrden(orden);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message || "No se pudo cargar la orden asociada."
      );
    }
  };

  // Descargar PDF
  const descargarPDF = (venta) => {
    setError("");

    try {
      const paciente = obtenerPaciente(venta.pacienteId);

      const solicitud = solicitudes.find(
        (item) =>
          String(item.id) === String(venta.solicitudId) ||
          String(item.solicitudId) === String(venta.solicitudId)
      );

      const ventaPDF = {
        ...venta,
        analisis:
          Array.isArray(venta.analisis) && venta.analisis.length > 0
            ? venta.analisis
            : solicitud?.analisis || [],
      };

      const laboratorio = {
        nombreVisible:
          usuario?.nombreLaboratorio ||
          usuario?.laboratorio?.nombreVisible ||
          usuario?.laboratorio?.nombre ||
          "Laboratorio Clínico",
      };

      generarPDFVenta(ventaPDF, paciente, laboratorio);
    } catch (err) {
      console.error(err);

      setError(
        err?.message || "No se pudo generar el PDF de venta."
      );
    }
  };

  // Mostrar tabla de análisis
  const tablaAnalisis = (analisis) => {
    const lista = Array.isArray(analisis) ? analisis : [];

    if (lista.length === 0) {
      return (
        <div className="gv-empty">
          No existen análisis registrados.
        </div>
      );
    }

    return (
      <div className="gv-table-wrap">
        <table className="gv-table">
          <thead>
            <tr>
              <th>ANÁLISIS</th>
              <th>PRECIO</th>
              <th>CANTIDAD</th>
              <th>SUBTOTAL</th>
            </tr>
          </thead>

          <tbody>
            {lista.map((item, index) => {
              const precio = Number(item.precio || 0);
              const cantidad = Number(item.cantidad || 1);
              const subtotal = Number(
                item.subtotal ?? precio * cantidad
              );

              return (
                <tr key={item.analisisId || index}>
                  <td>{item.nombre}</td>
                  <td>Bs {precio.toFixed(2)}</td>
                  <td>{cantidad}</td>
                  <td>Bs {subtotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (cargando) {
    return (
      <main className="gv-page">
        <section className="gv-card">
          <h2>Gestión de ventas</h2>
          <p>Cargando información...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="gv-page">
      {/* ENCABEZADO */}
      <header className="gv-header">
        <div>
          {onVolver && (
            <button
              type="button"
              className="gv-back"
              onClick={onVolver}
            >
              ← Volver
            </button>
          )}

          <span className="gv-eyebrow">
            VENTAS Y ÓRDENES
          </span>

          <h1>Gestión de ventas</h1>

          <p>
            Registra la venta de una solicitud y genera una
            orden independiente para el procesamiento.
          </p>
        </div>

        <div className="gv-header-icon">$</div>
      </header>

      {/* MENSAJES */}
      {mensaje && (
        <div className="gv-message gv-success">
          ✓ {mensaje}
        </div>
      )}

      {error && (
        <div className="gv-message gv-error">
          ! {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}
      <section className="gv-stats">
        <article>
          <span>VENTAS</span>
          <strong>{ventas.length}</strong>
        </article>

        <article>
          <span>SOLICITUDES PENDIENTES</span>
          <strong>{solicitudesPendientes.length}</strong>
        </article>

        <article>
          <span>RESULTADOS FILTRADOS</span>
          <strong>{ventasFiltradas.length}</strong>
        </article>
      </section>

      {/* REGISTRAR VENTA */}
      {puedeRegistrar && (
        <section className="gv-card">
          <div className="gv-card-head">
            <span>HU-20</span>

            <h2>Registrar venta y generar orden</h2>

            <p>
              Selecciona una solicitud pendiente y registra el cobro.
            </p>
          </div>

          <div className="gv-grid">
            <div className="gv-field">
              <label>Solicitud</label>

              <select
                value={solicitudId}
                onChange={(e) => setSolicitudId(e.target.value)}
              >
                <option value="">
                  Seleccione una solicitud
                </option>

                {solicitudesPendientes.map((solicitud) => (
                  <option
                    key={solicitud.id || solicitud.solicitudId}
                    value={solicitud.id || solicitud.solicitudId}
                  >
                    {obtenerNombrePaciente(solicitud.pacienteId)}
                    {" - Bs "}
                    {Number(solicitud.total || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="gv-field">
              <label>Método de pago</label>

              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="qr">QR</option>
                <option value="transferencia">
                  Transferencia
                </option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>

          {solicitudSeleccionada && (
            <div className="gv-note">
              <div className="gv-note-title">
                <div>
                  <span>NOTA DE VENTA</span>

                  <h3>
                    {obtenerNombrePaciente(
                      solicitudSeleccionada.pacienteId
                    )}
                  </h3>
                </div>

                <strong>
                  Bs{" "}
                  {Number(
                    solicitudSeleccionada.total || 0
                  ).toFixed(2)}
                </strong>
              </div>

              {tablaAnalisis(solicitudSeleccionada.analisis)}

              <div className="gv-actions">
                <button
                  type="button"
                  className="gv-primary"
                  disabled={guardando}
                  onClick={registrarVenta}
                >
                  {guardando
                    ? "Registrando..."
                    : "Registrar venta y generar orden"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* HISTORIAL DE VENTAS */}
      <section className="gv-card">
        <div className="gv-card-head">
          <span>HU-21</span>

          <h2>Historial de ventas</h2>

          <p>
            Filtra por fecha, paciente, nombre, apellido,
            CI o usuario que realizó la operación.
          </p>
        </div>

        {/* NUEVO BUSCADOR EN TIEMPO REAL */}
        <div
          className="gv-field"
          style={{
            marginBottom: "20px",
            width: "100%",
          }}
        >
          <label
            htmlFor="gv-buscar-paciente"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            Buscar paciente por nombre, apellido o CI
          </label>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <input
              id="gv-buscar-paciente"
              type="text"
              placeholder="Escribe el nombre, apellido o carnet..."
              value={busquedaPaciente}
              onChange={(e) =>
                setBusquedaPaciente(e.target.value)
              }
              autoComplete="off"
              style={{
                width: "100%",
                flex: 1,
                padding: "12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />

            {busquedaPaciente && (
              <button
                type="button"
                className="gv-detail-btn"
                onClick={() => setBusquedaPaciente("")}
              >
                Limpiar
              </button>
            )}
          </div>

          <small
            style={{
              display: "block",
              marginTop: "8px",
              color: "#64748b",
            }}
          >
            Resultados encontrados: {ventasFiltradas.length}
          </small>
        </div>

        {/* FILTROS EXISTENTES */}
        <div className="gv-filter-grid">
          <div className="gv-field">
            <label>Desde</label>

            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="gv-field">
            <label>Hasta</label>

            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="gv-field">
            <label>Paciente</label>

            <select
              value={pacienteFiltro}
              onChange={(e) => setPacienteFiltro(e.target.value)}
            >
              <option value="">Todos</option>

              {pacientes.map((paciente) => (
                <option
                  key={paciente.id || paciente.pacienteId}
                  value={paciente.pacienteId || paciente.id}
                >
                  {paciente.nombres || paciente.nombre}{" "}
                  {paciente.apellidos || paciente.apellido}
                </option>
              ))}
            </select>
          </div>

          <div className="gv-field">
            <label>Usuario / UID</label>

            <input
              type="text"
              value={usuarioFiltro}
              placeholder="Buscar UID..."
              onChange={(e) => setUsuarioFiltro(e.target.value)}
            />
          </div>
        </div>

        {/* TABLA DE VENTAS */}
        {ventasFiltradas.length === 0 ? (
          <div className="gv-empty">
            No se encontraron ventas con los filtros seleccionados.
          </div>
        ) : (
          <div className="gv-table-wrap">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>PACIENTE</th>
                  <th>CI</th>
                  <th>MÉTODO</th>
                  <th>TOTAL</th>
                  <th>ORDEN</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>

              <tbody>
                {ventasFiltradas.map((venta) => {
                  const paciente = obtenerPaciente(venta.pacienteId);

                  return (
                    <tr key={venta.id || venta.ventaId}>
                      <td>
                        {formatearFecha(venta.fecha)}
                      </td>

                      <td>
                        {obtenerNombrePaciente(venta.pacienteId)}
                      </td>

                      {/* NUEVO: mostrar CI */}
                      <td>
                        {paciente?.ci ||
                          paciente?.carnet ||
                          paciente?.documento ||
                          "-"}
                      </td>

                      <td>
                        {venta.metodoPago}
                      </td>

                      <td>
                        <strong>
                          Bs{" "}
                          {Number(venta.total || 0).toFixed(2)}
                        </strong>
                      </td>

                      <td>
                        {venta.ordenId || "-"}
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="gv-detail-btn"
                            onClick={() => verDetalle(venta)}
                          >
                            Ver detalle
                          </button>

                          <button
                            type="button"
                            className="gv-primary"
                            onClick={() => descargarPDF(venta)}
                          >
                            Descargar PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DETALLE DE VENTA */}
      {detalleVenta && (
        <section className="gv-detail">
          <div className="gv-detail-head">
            <div>
              <span>DETALLE</span>
              <h2>Venta y orden asociada</h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="gv-primary"
                onClick={() => descargarPDF(detalleVenta)}
              >
                Descargar PDF
              </button>

              <button
                type="button"
                className="gv-close"
                onClick={() => {
                  setDetalleVenta(null);
                  setDetalleOrden(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="gv-detail-grid">
            <div>
              <span>VENTA</span>
              <strong>
                {detalleVenta.ventaId || detalleVenta.id}
              </strong>
            </div>

            <div>
              <span>SOLICITUD</span>
              <strong>
                {detalleVenta.solicitudId || "-"}
              </strong>
            </div>

            <div>
              <span>ORDEN</span>
              <strong>
                {detalleVenta.ordenId || "-"}
              </strong>
            </div>

            <div>
              <span>PACIENTE</span>
              <strong>
                {obtenerNombrePaciente(detalleVenta.pacienteId)}
              </strong>
            </div>

            <div>
              <span>CI</span>
              <strong>
                {obtenerPaciente(detalleVenta.pacienteId)?.ci ||
                  obtenerPaciente(detalleVenta.pacienteId)?.carnet ||
                  "-"}
              </strong>
            </div>

            <div>
              <span>TOTAL</span>
              <strong>
                Bs{" "}
                {Number(detalleVenta.total || 0).toFixed(2)}
              </strong>
            </div>

            <div>
              <span>ESTADO ORDEN</span>
              <strong>
                {detalleOrden?.estado ||
                  "Cargando / no disponible"}
              </strong>
            </div>
          </div>

          {tablaAnalisis(detalleVenta.analisis)}
        </section>
      )}
    </main>
  );
}

export default GestionVentas;