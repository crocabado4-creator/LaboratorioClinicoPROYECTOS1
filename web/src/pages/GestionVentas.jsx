import { useEffect, useMemo, useState } from "react";

import {
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";

import { getApp } from "firebase/app";

import { obtenerPacientes } from "../services/pacientesService";

import { obtenerSolicitudes } from "../services/solicitudesService";

import {
  obtenerOrdenPorId,
  obtenerVentas,
  registrarVentaYGenerarOrden,
} from "../services/ventasService";

import { generarPDFVenta } from "../services/pdfService";

import "./GestionVentas.css";

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function convertirFecha(fecha) {
  if (!fecha) return null;

  if (typeof fecha.toDate === "function") {
    return fecha.toDate();
  }

  if (typeof fecha.seconds === "number") {
    return new Date(fecha.seconds * 1000);
  }

  const resultado = new Date(fecha);

  return Number.isNaN(resultado.getTime())
    ? null
    : resultado;
}

function formatearFecha(fecha) {
  const resultado = convertirFecha(fecha);

  return resultado
    ? resultado.toLocaleString("es-BO")
    : "Sin fecha";
}

function fechaParaInput(fecha) {
  const resultado = convertirFecha(fecha);

  if (!resultado) return "";

  const anio = resultado.getFullYear();

  const mes = String(
    resultado.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    resultado.getDate()
  ).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function formatearMonto(valor) {
  const numero = Number(valor || 0);

  return `Bs ${numero.toFixed(2)}`;
}

// ======================================================
// ESTILOS ADICIONALES
// ======================================================

const estilos = {
  modalFondo: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    backgroundColor: "rgba(10, 25, 47, 0.72)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    overflowY: "auto",
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: "22px",
    width: "100%",
    maxWidth: "490px",
    padding: "28px",
    boxShadow: "0 25px 70px rgba(0,0,0,0.25)",
    position: "relative",
    maxHeight: "95vh",
    overflowY: "auto",
  },

  modalTitulo: {
    fontSize: "25px",
    fontWeight: "800",
    color: "#102B50",
    marginBottom: "8px",
    textAlign: "center",
  },

  modalDescripcion: {
    fontSize: "14px",
    color: "#64748B",
    textAlign: "center",
    lineHeight: "23px",
    marginBottom: "20px",
  },

  qrContenedor: {
    backgroundColor: "#F8FAFC",
    border: "1px solid #DBEAFE",
    borderRadius: "18px",
    padding: "22px",
    textAlign: "center",
    marginBottom: "18px",
  },

  qrImagen: {
    width: "100%",
    maxWidth: "280px",
    height: "auto",
    maxHeight: "280px",
    objectFit: "contain",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "10px",
    border: "1px solid #E2E8F0",
  },

  monto: {
    fontSize: "34px",
    fontWeight: "900",
    color: "#00853D",
    textAlign: "center",
    margin: "12px 0",
  },

  informacion: {
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    padding: "15px",
    borderRadius: "12px",
    marginBottom: "15px",
    fontSize: "14px",
    color: "#1E3A5F",
    lineHeight: "24px",
  },

  advertencia: {
    backgroundColor: "#FFF7ED",
    border: "1px solid #FED7AA",
    padding: "14px",
    borderRadius: "12px",
    fontSize: "13px",
    color: "#9A3412",
    lineHeight: "21px",
    marginBottom: "15px",
  },

  confirmacion: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    backgroundColor: "#F0FDF4",
    padding: "15px",
    borderRadius: "12px",
    marginBottom: "20px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#166534",
    lineHeight: "22px",
  },

  botonesModal: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  botonPrimario: {
    backgroundColor: "#2563EB",
    border: "none",
    color: "#FFFFFF",
    padding: "13px 20px",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
    flex: 1,
  },

  botonSecundario: {
    backgroundColor: "#E2E8F0",
    border: "none",
    color: "#17365D",
    padding: "13px 20px",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
    flex: 1,
  },

  botonDeshabilitado: {
    backgroundColor: "#94A3B8",
    cursor: "not-allowed",
  },

  qrSinConfigurar: {
    padding: "30px 15px",
    color: "#B45309",
    backgroundColor: "#FFFBEB",
    border: "1px dashed #F59E0B",
    borderRadius: "12px",
    textAlign: "center",
    lineHeight: "24px",
  },

  botonMostrarQR: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    border: "1px solid #86EFAC",
    borderRadius: "10px",
    padding: "12px 18px",
    fontWeight: "800",
    cursor: "pointer",
  },
};

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function GestionVentas({
  usuario,
  onVolver,
}) {
  const laboratorioId =
    usuario?.laboratorioId || "";

  const empleadoId =
    usuario?.id ||
    usuario?.uid ||
    "";

  const rol = normalizarTexto(usuario?.rol);

  const puedeRegistrar =
    rol === "recepcionista";

  // ====================================================
  // ESTADOS ORIGINALES
  // ====================================================

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

  const [busquedaPaciente, setBusquedaPaciente] = useState("");

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState("");

  const [error, setError] = useState("");

  // ====================================================
  // NUEVOS ESTADOS PARA PAGOS QR
  // ====================================================

  const [mostrarModalQR, setMostrarModalQR] = useState(false);

  const [qrUrl, setQrUrl] = useState("");

  const [cargandoQR, setCargandoQR] = useState(false);

  const [errorQR, setErrorQR] = useState("");

  const [pagoQRConfirmado, setPagoQRConfirmado] = useState(false);

  const [qrImagenError, setQrImagenError] = useState(false);

  const [nombreLaboratorio, setNombreLaboratorio] = useState(
    usuario?.nombreLaboratorio ||
      usuario?.laboratorio?.nombreVisible ||
      usuario?.laboratorio?.nombre ||
      "Laboratorio Clínico"
  );

  // ====================================================
  // OBTENER PACIENTE
  // ====================================================

  const obtenerPaciente = (idPaciente) => {
    return pacientes.find(
      (item) =>
        String(item.id || "") ===
          String(idPaciente || "") ||
        String(item.pacienteId || "") ===
          String(idPaciente || "")
    );
  };

  const obtenerNombrePaciente = (idPaciente) => {
    const paciente = obtenerPaciente(idPaciente);

    if (!paciente) {
      return idPaciente || "Paciente";
    }

    return [
      paciente.nombres || paciente.nombre,
      paciente.apellidos || paciente.apellido,
    ]
      .filter(Boolean)
      .join(" ");
  };

  // ====================================================
  // BUSCADOR
  // ====================================================

  const coincideBusqueda = (idPaciente, busqueda) => {
    const textoBuscado = normalizarTexto(busqueda);

    if (!textoBuscado) return true;

    const paciente = obtenerPaciente(idPaciente);

    if (!paciente) return false;

    const nombre =
      paciente.nombres ||
      paciente.nombre ||
      "";

    const apellido =
      paciente.apellidos ||
      paciente.apellido ||
      "";

    const ci =
      paciente.ci ||
      paciente.carnet ||
      paciente.documento ||
      "";

    const textoCompleto = normalizarTexto(
      `${nombre} ${apellido} ${ci}`
    );

    const palabras = textoBuscado
      .split(/\s+/)
      .filter(Boolean);

    return palabras.every((palabra) =>
      textoCompleto.includes(palabra)
    );
  };

  // ====================================================
  // CARGAR INFORMACIÓN
  // ====================================================

  const recargar = async () => {
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

      setError(
        err?.message ||
          "No se pudo cargar la información de ventas."
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    recargar();
  }, [laboratorioId]);

  // ====================================================
  // CONSULTAR QR DEL LABORATORIO
  // ====================================================

  const cargarConfiguracionQR = async () => {
    if (!laboratorioId) {
      setErrorQR(
        "No se identificó el laboratorio."
      );

      return;
    }

    try {
      setCargandoQR(true);
      setErrorQR("");
      setQrUrl("");
      setQrImagenError(false);

      const db = getFirestore(getApp());

      const referenciaLaboratorio = doc(
        db,
        "laboratorios",
        String(laboratorioId)
      );

      const documento = await getDoc(
        referenciaLaboratorio
      );

      if (!documento.exists()) {
        setErrorQR(
          "No se encontró la configuración del laboratorio."
        );

        return;
      }

      const datos = documento.data();

      const configuracion =
        datos.configuracionPagos || {};

      const imagenQR =
        configuracion.qrUrl ||
        datos.qrUrl ||
        "";

      const nombre =
        datos.nombreVisible ||
        datos.nombre ||
        datos.nombreLaboratorio ||
        nombreLaboratorio;

      setNombreLaboratorio(nombre);

      setQrUrl(imagenQR);

      if (!imagenQR) {
        setErrorQR(
          "El laboratorio todavía no tiene un QR configurado. " +
            "Solicita al Administrador que registre uno."
        );
      }
    } catch (err) {
      console.error(
        "Error consultando QR:",
        err
      );

      setErrorQR(
        err?.code === "permission-denied"
          ? "No tienes permisos para consultar el QR del laboratorio."
          : err?.message ||
              "No se pudo consultar el código QR."
      );
    } finally {
      setCargandoQR(false);
    }
  };

  // ====================================================
  // ABRIR VENTANA QR
  // ====================================================

  const abrirModalQR = async () => {
    setPagoQRConfirmado(false);
    setMostrarModalQR(true);

    await cargarConfiguracionQR();
  };

  // ====================================================
  // CERRAR VENTANA QR
  // ====================================================

  const cerrarModalQR = () => {
    if (guardando) return;

    setMostrarModalQR(false);
  };

  // ====================================================
  // CAMBIAR MÉTODO DE PAGO
  // ====================================================

  const cambiarMetodoPago = async (valor) => {
    setMetodoPago(valor);

    setPagoQRConfirmado(false);

    if (valor === "qr") {
      await abrirModalQR();
    } else {
      setMostrarModalQR(false);
    }
  };

  // ====================================================
  // SOLICITUDES PENDIENTES
  // ====================================================

  const solicitudesPendientes = useMemo(() => {
    return solicitudes.filter((item) => {
      const estado = normalizarTexto(
        item.estado
      );

      return (
        !item.ventaId &&
        !item.ordenId &&
        ![
          "pagada",
          "vendida",
          "procesada",
        ].includes(estado)
      );
    });
  }, [solicitudes]);

  // ====================================================
  // SOLICITUD SELECCIONADA
  // ====================================================

  const solicitudSeleccionada = useMemo(() => {
    return (
      solicitudes.find(
        (item) =>
          String(item.id) ===
            String(solicitudId) ||
          String(item.solicitudId) ===
            String(solicitudId)
      ) || null
    );
  }, [solicitudes, solicitudId]);

  // ====================================================
  // FILTRAR VENTAS
  // ====================================================

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((venta) => {
      if (
        fechaDesde &&
        fechaParaInput(venta.fecha) <
          fechaDesde
      ) {
        return false;
      }

      if (
        fechaHasta &&
        fechaParaInput(venta.fecha) >
          fechaHasta
      ) {
        return false;
      }

      if (
        pacienteFiltro &&
        String(venta.pacienteId) !==
          String(pacienteFiltro)
      ) {
        return false;
      }

      if (
        usuarioFiltro &&
        !normalizarTexto(
          venta.empleadoId
        ).includes(
          normalizarTexto(usuarioFiltro)
        )
      ) {
        return false;
      }

      if (
        busquedaPaciente &&
        !coincideBusqueda(
          venta.pacienteId,
          busquedaPaciente
        )
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

  // ====================================================
  // REGISTRAR VENTA Y GENERAR ORDEN
  // ====================================================

  const registrarVenta = async () => {
    setMensaje("");
    setError("");

    if (!solicitudId) {
      setError(
        "Debe seleccionar una solicitud."
      );

      return;
    }

    if (!empleadoId) {
      setError(
        "No se pudo identificar al usuario."
      );

      return;
    }

    if (
      metodoPago !== "efectivo" &&
      metodoPago !== "qr"
    ) {
      setError(
        "Selecciona un método de pago válido."
      );

      return;
    }

    if (
      metodoPago === "qr" &&
      !pagoQRConfirmado
    ) {
      setError(
        "Debes verificar y confirmar el pago QR antes de registrar la venta."
      );

      setMostrarModalQR(true);

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

      const ventasActualizadas =
        await obtenerVentas(laboratorioId);

      const ventaCreada =
        ventasActualizadas.find(
          (item) =>
            item.ventaId ===
              resultado.ventaId ||
            item.id === resultado.ventaId
        );

      setDetalleVenta(
        ventaCreada || null
      );

      setDetalleOrden(null);

      if (resultado.ordenId) {
        const orden =
          await obtenerOrdenPorId(
            resultado.ordenId,
            laboratorioId
          );

        setDetalleOrden(orden);
      }

      setSolicitudId("");

      setMetodoPago("efectivo");

      setPagoQRConfirmado(false);

      setMostrarModalQR(false);

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

  // ====================================================
  // VER DETALLE
  // ====================================================

  const verDetalle = async (venta) => {
    setDetalleVenta(venta);
    setDetalleOrden(null);
    setError("");

    try {
      if (venta.ordenId) {
        const orden =
          await obtenerOrdenPorId(
            venta.ordenId,
            laboratorioId
          );

        setDetalleOrden(orden);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudo cargar la orden asociada."
      );
    }
  };

  // ====================================================
  // DESCARGAR PDF
  // ====================================================

  const descargarPDF = (venta) => {
    setError("");

    try {
      const paciente = obtenerPaciente(
        venta.pacienteId
      );

      const solicitud = solicitudes.find(
        (item) =>
          String(item.id) ===
            String(venta.solicitudId) ||
          String(item.solicitudId) ===
            String(venta.solicitudId)
      );

      const ventaPDF = {
        ...venta,

        analisis:
          Array.isArray(venta.analisis) &&
          venta.analisis.length > 0
            ? venta.analisis
            : solicitud?.analisis || [],
      };

      const laboratorio = {
        nombreVisible:
          usuario?.nombreLaboratorio ||
          usuario?.laboratorio
            ?.nombreVisible ||
          usuario?.laboratorio?.nombre ||
          nombreLaboratorio,
      };

      generarPDFVenta(
        ventaPDF,
        paciente,
        laboratorio
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudo generar el PDF."
      );
    }
  };

  // ====================================================
  // TABLA DE ANÁLISIS
  // ====================================================

  const tablaAnalisis = (analisis) => {
    const lista = Array.isArray(analisis)
      ? analisis
      : [];

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
              const precio = Number(
                item.precio || 0
              );

              const cantidad = Number(
                item.cantidad || 1
              );

              const subtotal = Number(
                item.subtotal ??
                  precio * cantidad
              );

              return (
                <tr
                  key={
                    item.analisisId ||
                    index
                  }
                >
                  <td>{item.nombre}</td>

                  <td>
                    {formatearMonto(precio)}
                  </td>

                  <td>{cantidad}</td>

                  <td>
                    {formatearMonto(subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ====================================================
  // VENTANA MODAL QR
  // ====================================================

  const ventanaQR = mostrarModalQR && (
    <div
      style={estilos.modalFondo}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          cerrarModalQR();
        }
      }}
    >
      <div
        style={estilos.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Pago mediante QR"
      >
        <button
          type="button"
          onClick={cerrarModalQR}
          disabled={guardando}
          style={{
            position: "absolute",
            right: "18px",
            top: "15px",
            border: "none",
            backgroundColor: "#E2E8F0",
            color: "#334155",
            borderRadius: "8px",
            width: "34px",
            height: "34px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ✕
        </button>

        <div
          style={{
            textAlign: "center",
            fontSize: "38px",
            marginBottom: "10px",
          }}
        >
          ▦
        </div>

        <h2 style={estilos.modalTitulo}>
          Pago mediante QR
        </h2>

        <p style={estilos.modalDescripcion}>
          {nombreLaboratorio}
          <br />
          Escanea el código para realizar el pago.
        </p>

        {solicitudSeleccionada ? (
          <div style={estilos.informacion}>
            <strong>Paciente:</strong>{" "}
            {obtenerNombrePaciente(
              solicitudSeleccionada.pacienteId
            )}

            <br />

            <strong>Solicitud:</strong>{" "}
            {solicitudSeleccionada.id ||
              solicitudSeleccionada.solicitudId}

            <br />

            <strong>Método:</strong> QR
          </div>
        ) : (
          <div style={estilos.advertencia}>
            Primero selecciona una solicitud
            para conocer el importe del pago.
          </div>
        )}

        <div style={estilos.qrContenedor}>
          {cargandoQR ? (
            <p>
              Cargando código QR...
            </p>
          ) : qrUrl && !qrImagenError ? (
            <img
              src={qrUrl}
              alt={`QR de pago de ${nombreLaboratorio}`}
              style={estilos.qrImagen}
              onError={() =>
                setQrImagenError(true)
              }
            />
          ) : (
            <div style={estilos.qrSinConfigurar}>
              <strong>
                QR no disponible
              </strong>

              <p>
                {errorQR ||
                  (qrImagenError
                    ? "No se pudo cargar la imagen del QR."
                    : "El Administrador debe configurar el QR del laboratorio.")}
              </p>
            </div>
          )}
        </div>

        {solicitudSeleccionada && (
          <>
            <p
              style={{
                textAlign: "center",
                color: "#64748B",
                marginBottom: "4px",
              }}
            >
              Importe total a pagar
            </p>

            <div style={estilos.monto}>
              {formatearMonto(
                solicitudSeleccionada.total
              )}
            </div>
          </>
        )}

        <div style={estilos.advertencia}>
          <strong>Importante:</strong>{" "}
          La visualización del QR no confirma
          automáticamente el pago. Recepción
          debe verificar que el importe haya
          sido recibido antes de registrar
          la venta.
        </div>

        {qrUrl &&
          !qrImagenError &&
          !cargandoQR &&
          solicitudSeleccionada && (
            <label
              style={estilos.confirmacion}
            >
              <input
                type="checkbox"
                checked={pagoQRConfirmado}
                onChange={(e) =>
                  setPagoQRConfirmado(
                    e.target.checked
                  )
                }
                style={{
                  width: "19px",
                  height: "19px",
                  marginTop: "2px",
                  cursor: "pointer",
                }}
              />

              <span>
                Confirmo que verifiqué
                el pago QR del paciente
                por el importe indicado.
              </span>
            </label>
          )}

        <div style={estilos.botonesModal}>
          <button
            type="button"
            style={estilos.botonSecundario}
            onClick={cerrarModalQR}
          >
            Cerrar
          </button>

          <button
            type="button"
            disabled={
              !pagoQRConfirmado ||
              !solicitudSeleccionada ||
              !qrUrl ||
              qrImagenError ||
              cargandoQR ||
              guardando
            }
            style={{
              ...estilos.botonPrimario,

              ...(
                !pagoQRConfirmado ||
                !solicitudSeleccionada ||
                !qrUrl ||
                qrImagenError ||
                cargandoQR ||
                guardando
                  ? estilos.botonDeshabilitado
                  : {}
              ),
            }}
            onClick={cerrarModalQR}
          >
            Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );

  // ====================================================
  // PANTALLA DE CARGA
  // ====================================================

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

  // ====================================================
  // INTERFAZ PRINCIPAL
  // ====================================================

  return (
    <main className="gv-page">

      {/* ============================================== */}
      {/* ENCABEZADO */}
      {/* ============================================== */}

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
            Registra la venta de una solicitud
            y genera una orden independiente
            para el procesamiento.
          </p>
        </div>

        <div className="gv-header-icon">
          $
        </div>
      </header>

      {/* ============================================== */}
      {/* MENSAJES */}
      {/* ============================================== */}

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

      {/* ============================================== */}
      {/* ESTADÍSTICAS */}
      {/* ============================================== */}

      <section className="gv-stats">
        <article>
          <span>VENTAS</span>

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

      {/* ============================================== */}
      {/* REGISTRAR VENTA */}
      {/* ============================================== */}

      {puedeRegistrar && (
        <section className="gv-card">
          <div className="gv-card-head">
            <span>HU-20</span>

            <h2>
              Registrar venta y generar orden
            </h2>

            <p>
              Selecciona una solicitud pendiente
              y registra el cobro.
            </p>
          </div>

          <div className="gv-grid">

            {/* SOLICITUD */}

            <div className="gv-field">
              <label>
                Solicitud
              </label>

              <select
                value={solicitudId}
                onChange={(e) => {
                  setSolicitudId(
                    e.target.value
                  );

                  setPagoQRConfirmado(false);
                }}
              >
                <option value="">
                  Seleccione una solicitud
                </option>

                {solicitudesPendientes.map(
                  (solicitud) => (
                    <option
                      key={
                        solicitud.id ||
                        solicitud.solicitudId
                      }
                      value={
                        solicitud.id ||
                        solicitud.solicitudId
                      }
                    >
                      {obtenerNombrePaciente(
                        solicitud.pacienteId
                      )}

                      {" - "}

                      {formatearMonto(
                        solicitud.total
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* MÉTODO DE PAGO */}

            <div className="gv-field">
              <label>
                Método de pago
              </label>

              <select
                value={metodoPago}
                onChange={(e) =>
                  cambiarMetodoPago(
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
              </select>
            </div>
          </div>

          {/* ========================================== */}
          {/* INFORMACIÓN QR */}
          {/* ========================================== */}

          {metodoPago === "qr" && (
            <div
              style={{
                marginTop: "18px",
                marginBottom: "18px",
                padding: "18px",
                backgroundColor: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "14px",
              }}
            >
              <h3
                style={{
                  color: "#166534",
                  fontSize: "17px",
                  marginBottom: "10px",
                }}
              >
                Pago mediante QR
              </h3>

              <p
                style={{
                  color: "#475569",
                  marginBottom: "15px",
                  lineHeight: "23px",
                }}
              >
                Muestra el código QR al paciente
                y verifica que haya realizado
                el pago correctamente.
              </p>

              <button
                type="button"
                style={estilos.botonMostrarQR}
                onClick={abrirModalQR}
              >
                Ver código QR
              </button>

              {pagoQRConfirmado && (
                <p
                  style={{
                    color: "#15803D",
                    fontWeight: "700",
                    marginTop: "12px",
                  }}
                >
                  ✓ Pago QR confirmado
                  por Recepción.
                </p>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* NOTA DE VENTA */}
          {/* ========================================== */}

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
                  {formatearMonto(
                    solicitudSeleccionada.total
                  )}
                </strong>
              </div>

              {tablaAnalisis(
                solicitudSeleccionada.analisis
              )}

              {/* BOTÓN REGISTRAR */}

              <div className="gv-actions">
                <button
                  type="button"
                  className="gv-primary"
                  disabled={
                    guardando ||
                    (
                      metodoPago === "qr" &&
                      !pagoQRConfirmado
                    )
                  }
                  onClick={registrarVenta}
                >
                  {guardando
                    ? "Registrando..."
                    : "Registrar venta y generar orden"}
                </button>
              </div>

              {metodoPago === "qr" &&
                !pagoQRConfirmado && (
                  <p
                    style={{
                      marginTop: "12px",
                      color: "#B45309",
                      fontSize: "13px",
                    }}
                  >
                    Para registrar esta venta
                    debes confirmar primero
                    el pago mediante QR.
                  </p>
                )}
            </div>
          )}
        </section>
      )}

      {/* ============================================== */}
      {/* HISTORIAL DE VENTAS */}
      {/* ============================================== */}

      <section className="gv-card">
        <div className="gv-card-head">
          <span>
            HU-21
          </span>

          <h2>
            Historial de ventas
          </h2>

          <p>
            Filtra por fecha, paciente,
            nombre, apellido, CI o usuario
            que realizó la operación.
          </p>
        </div>

        {/* BUSCADOR */}

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
            Buscar paciente por nombre,
            apellido o CI
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
                setBusquedaPaciente(
                  e.target.value
                )
              }
              autoComplete="off"
              style={{
                width: "100%",
                flex: 1,
                padding: "12px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />

            {busquedaPaciente && (
              <button
                type="button"
                className="gv-detail-btn"
                onClick={() =>
                  setBusquedaPaciente("")
                }
              >
                Limpiar
              </button>
            )}
          </div>

          <small
            style={{
              display: "block",
              marginTop: "8px",
              color: "#64748B",
            }}
          >
            Resultados encontrados:{" "}
            {ventasFiltradas.length}
          </small>
        </div>

        {/* FILTROS */}

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

              {pacientes.map((paciente) => (
                <option
                  key={
                    paciente.id ||
                    paciente.pacienteId
                  }
                  value={
                    paciente.pacienteId ||
                    paciente.id
                  }
                >
                  {paciente.nombres ||
                    paciente.nombre}{" "}

                  {paciente.apellidos ||
                    paciente.apellido}
                </option>
              ))}
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

        {/* TABLA */}

        {ventasFiltradas.length === 0 ? (
          <div className="gv-empty">
            No se encontraron ventas
            con los filtros seleccionados.
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
                {ventasFiltradas.map(
                  (venta) => {
                    const paciente =
                      obtenerPaciente(
                        venta.pacienteId
                      );

                    return (
                      <tr
                        key={
                          venta.id ||
                          venta.ventaId
                        }
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
                          {paciente?.ci ||
                            paciente?.carnet ||
                            paciente?.documento ||
                            "-"}
                        </td>

                        <td>
                          {normalizarTexto(
                            venta.metodoPago
                          ) === "qr"
                            ? "QR"
                            : venta.metodoPago}
                        </td>

                        <td>
                          <strong>
                            {formatearMonto(
                              venta.total
                            )}
                          </strong>
                        </td>

                        <td>
                          {venta.ordenId ||
                            "-"}
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
                              onClick={() =>
                                verDetalle(
                                  venta
                                )
                              }
                            >
                              Ver detalle
                            </button>

                            <button
                              type="button"
                              className="gv-primary"
                              onClick={() =>
                                descargarPDF(
                                  venta
                                )
                              }
                            >
                              Descargar PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============================================== */}
      {/* DETALLE DE VENTA */}
      {/* ============================================== */}

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
                onClick={() =>
                  descargarPDF(
                    detalleVenta
                  )
                }
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
                {detalleVenta.ventaId ||
                  detalleVenta.id}
              </strong>
            </div>

            <div>
              <span>SOLICITUD</span>

              <strong>
                {detalleVenta.solicitudId ||
                  "-"}
              </strong>
            </div>

            <div>
              <span>ORDEN</span>

              <strong>
                {detalleVenta.ordenId ||
                  "-"}
              </strong>
            </div>

            <div>
              <span>PACIENTE</span>

              <strong>
                {obtenerNombrePaciente(
                  detalleVenta.pacienteId
                )}
              </strong>
            </div>

            <div>
              <span>CI</span>

              <strong>
                {obtenerPaciente(
                  detalleVenta.pacienteId
                )?.ci ||
                  obtenerPaciente(
                    detalleVenta.pacienteId
                  )?.carnet ||
                  "-"}
              </strong>
            </div>

            <div>
              <span>TOTAL</span>

              <strong>
                {formatearMonto(
                  detalleVenta.total
                )}
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

          {tablaAnalisis(
            detalleVenta.analisis
          )}
        </section>
      )}

      {/* ============================================== */}
      {/* MODAL QR */}
      {/* ============================================== */}

      {ventanaQR}
    </main>
  );
}