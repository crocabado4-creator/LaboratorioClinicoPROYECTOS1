import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerPacientes,
} from "../services/pacientesService";

import {
  obtenerSolicitudes,
} from "../services/solicitudesService";

import {
  obtenerOrdenPorId,
  obtenerVentas,
  registrarVentaYGenerarOrden,
} from "../services/ventasService";

import "./GestionVentas.css";

function GestionVentas({
  usuario,
  onVolver,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const empleadoId =
    usuario?.id ||
    usuario?.uid ||
    "";

  const rol =
    String(
      usuario?.rol || ""
    ).toLowerCase();

  const puedeRegistrar =
    rol === "recepcionista";

  const [pacientes, setPacientes] =
    useState([]);

  const [solicitudes, setSolicitudes] =
    useState([]);

  const [ventas, setVentas] =
    useState([]);

  const [solicitudId, setSolicitudId] =
    useState("");

  const [metodoPago, setMetodoPago] =
    useState("efectivo");

  const [detalleVenta, setDetalleVenta] =
    useState(null);

  const [detalleOrden, setDetalleOrden] =
    useState(null);

  const [fechaDesde, setFechaDesde] =
    useState("");

  const [fechaHasta, setFechaHasta] =
    useState("");

  const [pacienteFiltro, setPacienteFiltro] =
    useState("");

  const [usuarioFiltro, setUsuarioFiltro] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [error, setError] =
    useState("");

  const timestampADate =
    (fecha) => {
      if (!fecha) {
        return null;
      }

      if (
        typeof fecha.toDate ===
        "function"
      ) {
        return fecha.toDate();
      }

      if (
        typeof fecha.seconds ===
        "number"
      ) {
        return new Date(
          fecha.seconds * 1000
        );
      }

      if (fecha instanceof Date) {
        return fecha;
      }

      return null;
    };

  const formatearFecha =
    (fecha) => {
      const date =
        timestampADate(
          fecha
        );

      if (!date) {
        return "Sin fecha";
      }

      return date.toLocaleString(
        "es-BO"
      );
    };

  const fechaInput =
    (fecha) => {
      const date =
        timestampADate(
          fecha
        );

      if (!date) {
        return "";
      }

      const anio =
        date.getFullYear();

      const mes =
        String(
          date.getMonth() + 1
        ).padStart(
          2,
          "0"
        );

      const dia =
        String(
          date.getDate()
        ).padStart(
          2,
          "0"
        );

      return (
        anio +
        "-" +
        mes +
        "-" +
        dia
      );
    };

  const obtenerNombrePaciente =
    (idPaciente) => {
      const paciente =
        pacientes.find(
          (item) =>
            item.id === idPaciente ||
            item.pacienteId ===
              idPaciente
        );

      if (!paciente) {
        return idPaciente ||
          "Paciente";
      }

      return [
        paciente.nombres,
        paciente.apellidos,
      ]
        .filter(Boolean)
        .join(" ");
    };

  const recargar =
    async () => {
      if (!laboratorioId) {
        setError(
          "El usuario no está asociado a un laboratorio."
        );

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
          obtenerPacientes(
            laboratorioId
          ),

          obtenerSolicitudes(
            laboratorioId
          ),

          obtenerVentas(
            laboratorioId
          ),
        ]);

        setPacientes(
          Array.isArray(
            pacientesResultado
          )
            ? pacientesResultado
            : []
        );

        setSolicitudes(
          Array.isArray(
            solicitudesResultado
          )
            ? solicitudesResultado
            : []
        );

        setVentas(
          Array.isArray(
            ventasResultado
          )
            ? ventasResultado
            : []
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo cargar ventas."
        );
      } finally {
        setCargando(false);
      }
    };

  useEffect(() => {
    recargar();
  }, [laboratorioId]);

  const solicitudesPendientes =
    useMemo(() => {
      return solicitudes.filter(
        (item) => {
          const estado =
            String(
              item.estado || ""
            ).toLowerCase();

          return (
            !item.ventaId &&
            !item.ordenId &&
            ![
              "pagada",
              "vendida",
              "procesada",
            ].includes(
              estado
            )
          );
        }
      );
    }, [solicitudes]);

  const solicitudSeleccionada =
    useMemo(() => {
      return solicitudes.find(
        (item) =>
          item.id ===
            solicitudId ||
          item.solicitudId ===
            solicitudId
      ) || null;
    }, [
      solicitudes,
      solicitudId,
    ]);

  const ventasFiltradas =
    useMemo(() => {
      return ventas.filter(
        (venta) => {
          if (
            fechaDesde &&
            fechaInput(
              venta.fecha
            ) < fechaDesde
          ) {
            return false;
          }

          if (
            fechaHasta &&
            fechaInput(
              venta.fecha
            ) > fechaHasta
          ) {
            return false;
          }

          if (
            pacienteFiltro &&
            venta.pacienteId !==
              pacienteFiltro
          ) {
            return false;
          }

          if (
            usuarioFiltro &&
            !String(
              venta.empleadoId ||
              ""
            )
              .toLowerCase()
              .includes(
                usuarioFiltro
                  .trim()
                  .toLowerCase()
              )
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      ventas,
      fechaDesde,
      fechaHasta,
      pacienteFiltro,
      usuarioFiltro,
    ]);

  const registrarVenta =
    async () => {
      setMensaje("");
      setError("");

      if (!solicitudId) {
        setError(
          "Debe seleccionar una solicitud."
        );

        return;
      }

      try {
        setGuardando(true);

        const resultado =
          await registrarVentaYGenerarOrden({
            laboratorioId,
            empleadoId,
            solicitudId,
            metodoPago,
          });

        await recargar();

        const ventaCreada =
          (
            await obtenerVentas(
              laboratorioId
            )
          ).find(
            (item) =>
              item.ventaId ===
                resultado.ventaId ||
              item.id ===
                resultado.ventaId
          );

        setDetalleVenta(
          ventaCreada || null
        );

        if (resultado.ordenId) {
          const orden =
            await obtenerOrdenPorId(
              resultado.ordenId,
              laboratorioId
            );

          setDetalleOrden(
            orden
          );
        }

        setSolicitudId("");

        setMetodoPago(
          "efectivo"
        );

        setMensaje(
          "Venta registrada y orden generada correctamente."
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo registrar la venta."
        );
      } finally {
        setGuardando(false);
      }
    };

  const verDetalle =
    async (venta) => {
      setDetalleVenta(
        venta
      );

      setDetalleOrden(
        null
      );

      try {
        if (venta.ordenId) {
          const orden =
            await obtenerOrdenPorId(
              venta.ordenId,
              laboratorioId
            );

          setDetalleOrden(
            orden
          );
        }
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo cargar la orden asociada."
        );
      }
    };

  if (cargando) {
    return (
      <main className="gv-page">
        <section className="gv-card">
          <h2>
            Gestión de ventas
          </h2>
          <p>
            Cargando información...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="gv-page">
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

          <h1>
            Gestión de ventas
          </h1>

          <p>
            Registra la venta de una solicitud y genera
            una orden independiente para el procesamiento.
          </p>
        </div>

        <div className="gv-header-icon">
          $
        </div>
      </header>

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

      <section className="gv-stats">
        <article>
          <span>
            VENTAS
          </span>
          <strong>
            {ventas.length}
          </strong>
        </article>

        <article>
          <span>
            SOLICITUDES PENDIENTES
          </span>
          <strong>
            {solicitudesPendientes.length}
          </strong>
        </article>

        <article>
          <span>
            RESULTADOS FILTRADOS
          </span>
          <strong>
            {ventasFiltradas.length}
          </strong>
        </article>
      </section>

      {puedeRegistrar && (
        <section className="gv-card">
          <div className="gv-card-head">
            <span>
              HU-20
            </span>

            <h2>
              Registrar venta y generar orden
            </h2>

            <p>
              Selecciona una solicitud pendiente y registra el cobro.
            </p>
          </div>

          <div className="gv-grid">
            <div className="gv-field">
              <label>
                Solicitud
              </label>

              <select
                value={solicitudId}
                onChange={(e) =>
                  setSolicitudId(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Seleccione una solicitud
                </option>

                {solicitudesPendientes.map(
                  (solicitud) => (
                    <option
                      key={solicitud.id}
                      value={solicitud.id}
                    >
                      {obtenerNombrePaciente(
                        solicitud.pacienteId
                      )}
                      {" - Bs "}
                      {Number(
                        solicitud.total || 0
                      ).toFixed(2)}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="gv-field">
              <label>
                Método de pago
              </label>

              <select
                value={metodoPago}
                onChange={(e) =>
                  setMetodoPago(
                    e.target.value
                  )
                }
              >
                <option value="efectivo">
                  Efectivo
                </option>
                <option value="qr">
                  QR
                </option>
                <option value="transferencia">
                  Transferencia
                </option>
                <option value="tarjeta">
                  Tarjeta
                </option>
              </select>
            </div>
          </div>

          {solicitudSeleccionada && (
            <div className="gv-note">
              <div className="gv-note-title">
                <div>
                  <span>
                    NOTA DE VENTA
                  </span>

                  <h3>
                    {obtenerNombrePaciente(
                      solicitudSeleccionada.pacienteId
                    )}
                  </h3>
                </div>

                <strong>
                  Bs{" "}
                  {Number(
                    solicitudSeleccionada.total ||
                    0
                  ).toFixed(2)}
                </strong>
              </div>

              <div className="gv-table-wrap">
                <table className="gv-table">
                  <thead>
                    <tr>
                      <th>
                        ANÁLISIS
                      </th>
                      <th>
                        PRECIO
                      </th>
                      <th>
                        CANTIDAD
                      </th>
                      <th>
                        SUBTOTAL
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(
                      solicitudSeleccionada.analisis ||
                      []
                    ).map(
                      (item) => (
                        <tr
                          key={
                            item.analisisId
                          }
                        >
                          <td>
                            {item.nombre}
                          </td>

                          <td>
                            Bs{" "}
                            {Number(
                              item.precio || 0
                            ).toFixed(2)}
                          </td>

                          <td>
                            {item.cantidad || 1}
                          </td>

                          <td>
                            Bs{" "}
                            {Number(
                              item.subtotal ??
                                Number(
                                  item.precio ||
                                  0
                                ) *
                                  Number(
                                    item.cantidad ||
                                    1
                                  )
                            ).toFixed(2)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="gv-actions">
                <button
                  type="button"
                  className="gv-primary"
                  disabled={guardando}
                  onClick={
                    registrarVenta
                  }
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

      <section className="gv-card">
        <div className="gv-card-head">
          <span>
            HU-21
          </span>

          <h2>
            Historial de ventas
          </h2>

          <p>
            Filtra por fecha, paciente o usuario que realizó la operación.
          </p>
        </div>

        <div className="gv-filter-grid">
          <div className="gv-field">
            <label>
              Desde
            </label>

            <input
              type="date"
              value={fechaDesde}
              onChange={(e) =>
                setFechaDesde(
                  e.target.value
                )
              }
            />
          </div>

          <div className="gv-field">
            <label>
              Hasta
            </label>

            <input
              type="date"
              value={fechaHasta}
              onChange={(e) =>
                setFechaHasta(
                  e.target.value
                )
              }
            />
          </div>

          <div className="gv-field">
            <label>
              Paciente
            </label>

            <select
              value={pacienteFiltro}
              onChange={(e) =>
                setPacienteFiltro(
                  e.target.value
                )
              }
            >
              <option value="">
                Todos
              </option>

              {pacientes.map(
                (paciente) => (
                  <option
                    key={paciente.id}
                    value={
                      paciente.pacienteId ||
                      paciente.id
                    }
                  >
                    {paciente.nombres}{" "}
                    {paciente.apellidos}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="gv-field">
            <label>
              Usuario / UID
            </label>

            <input
              type="text"
              value={usuarioFiltro}
              placeholder="Buscar UID..."
              onChange={(e) =>
                setUsuarioFiltro(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {ventasFiltradas.length === 0 ? (
          <div className="gv-empty">
            No existen ventas para los filtros seleccionados.
          </div>
        ) : (
          <div className="gv-table-wrap">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>
                    FECHA
                  </th>
                  <th>
                    PACIENTE
                  </th>
                  <th>
                    MÉTODO
                  </th>
                  <th>
                    TOTAL
                  </th>
                  <th>
                    ORDEN
                  </th>
                  <th>
                    ACCIÓN
                  </th>
                </tr>
              </thead>

              <tbody>
                {ventasFiltradas.map(
                  (venta) => (
                    <tr
                      key={venta.id}
                    >
                      <td>
                        {formatearFecha(
                          venta.fecha
                        )}
                      </td>

                      <td>
                        {obtenerNombrePaciente(
                          venta.pacienteId
                        )}
                      </td>

                      <td>
                        {venta.metodoPago}
                      </td>

                      <td>
                        <strong>
                          Bs{" "}
                          {Number(
                            venta.total || 0
                          ).toFixed(2)}
                        </strong>
                      </td>

                      <td>
                        {venta.ordenId ||
                          "-"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="gv-detail-btn"
                          onClick={() =>
                            verDetalle(
                              venta
                            )
                          }
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalleVenta && (
        <section className="gv-detail">
          <div className="gv-detail-head">
            <div>
              <span>
                DETALLE
              </span>

              <h2>
                Venta y orden asociada
              </h2>
            </div>

            <button
              type="button"
              className="gv-close"
              onClick={() => {
                setDetalleVenta(
                  null
                );

                setDetalleOrden(
                  null
                );
              }}
            >
              Cerrar
            </button>
          </div>

          <div className="gv-detail-grid">
            <div>
              <span>
                VENTA
              </span>
              <strong>
                {detalleVenta.ventaId}
              </strong>
            </div>

            <div>
              <span>
                SOLICITUD
              </span>
              <strong>
                {detalleVenta.solicitudId}
              </strong>
            </div>

            <div>
              <span>
                ORDEN
              </span>
              <strong>
                {detalleVenta.ordenId}
              </strong>
            </div>

            <div>
              <span>
                PACIENTE
              </span>
              <strong>
                {obtenerNombrePaciente(
                  detalleVenta.pacienteId
                )}
              </strong>
            </div>

            <div>
              <span>
                TOTAL
              </span>
              <strong>
                Bs{" "}
                {Number(
                  detalleVenta.total ||
                  0
                ).toFixed(2)}
              </strong>
            </div>

            <div>
              <span>
                ESTADO ORDEN
              </span>
              <strong>
                {detalleOrden?.estado ||
                  "Cargando / no disponible"}
              </strong>
            </div>
          </div>

          <div className="gv-table-wrap">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>
                    ANÁLISIS
                  </th>
                  <th>
                    PRECIO
                  </th>
                  <th>
                    CANTIDAD
                  </th>
                  <th>
                    SUBTOTAL
                  </th>
                </tr>
              </thead>

              <tbody>
                {(
                  detalleVenta.analisis ||
                  []
                ).map(
                  (item) => (
                    <tr
                      key={
                        item.analisisId
                      }
                    >
                      <td>
                        {item.nombre}
                      </td>
                      <td>
                        Bs{" "}
                        {Number(
                          item.precio || 0
                        ).toFixed(2)}
                      </td>
                      <td>
                        {item.cantidad || 1}
                      </td>
                      <td>
                        Bs{" "}
                        {Number(
                          item.subtotal || 0
                        ).toFixed(2)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default GestionVentas;
