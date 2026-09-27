import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  actualizarPaciente,
  crearPaciente,
  obtenerPacientes,
} from "../services/pacientesService";

import HistorialPaciente from "./HistorialPaciente";

import "./GestionPacientes.css";


// =====================================================
// FORMULARIO INICIAL
// =====================================================

const formularioInicial = {
  nombres: "",
  apellidos: "",
  ci: "",
  fechaNacimiento: "",
  sexo: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  alergias: "",
  enfermedadesPrevias: "",
};


// =====================================================
// COMPONENTE
// =====================================================

function GestionPacientes({
  usuario,
  permisos = [],
  volver,
}) {

  // ===================================================
  // PERMISOS
  // ===================================================

  const puedeCrear =
    permisos.includes(
      "pacientes.crear"
    );

  const puedeEditar =
    permisos.includes(
      "pacientes.editar"
    );

  const puedeVer =
    permisos.includes(
      "pacientes.ver"
    ) ||
    puedeCrear ||
    puedeEditar;


  const puedeVerHistorial =
    permisos.includes(
      "resultados.ver"
    );


  // ===================================================
  // ESTADOS
  // ===================================================

  const [
    pacientes,
    setPacientes,
  ] = useState([]);


  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );


  const [
    pacienteSeleccionado,
    setPacienteSeleccionado,
  ] = useState(null);


  const [
    editandoId,
    setEditandoId,
  ] = useState(null);


  const [
    modalFormulario,
    setModalFormulario,
  ] = useState(false);


  const [
    modalDetalle,
    setModalDetalle,
  ] = useState(false);


  const [
    cargando,
    setCargando,
  ] = useState(true);


  const [
    guardando,
    setGuardando,
  ] = useState(false);


  const [
    mensaje,
    setMensaje,
  ] = useState(null);


  const [
    pacienteHistorial,
    setPacienteHistorial,
  ] = useState(null);


  // ===================================================
  // HU-10
  // FILTROS
  // ===================================================

  const [
    busqueda,
    setBusqueda,
  ] = useState("");


  const [
    campoBusqueda,
    setCampoBusqueda,
  ] = useState("todos");


  const [
    fechaFiltro,
    setFechaFiltro,
  ] = useState("");


  // ===================================================
  // CARGAR PACIENTES
  // ===================================================

  useEffect(() => {
    cargarPacientes();
  }, []);


  const cargarPacientes =
    async () => {

      try {

        setCargando(true);


        if (
          !usuario?.laboratorioId
        ) {

          setPacientes([]);

          setMensaje({
            tipo: "error",
            texto:
              "El usuario no está asociado a un laboratorio.",
          });

          return;
        }


        if (!puedeVer) {

          setPacientes([]);

          setMensaje({
            tipo: "error",
            texto:
              "No tienes permiso para consultar pacientes.",
          });

          return;
        }


        const resultado =
          await obtenerPacientes(
            usuario.laboratorioId
          );


        setPacientes(
          Array.isArray(resultado)
            ? resultado
            : []
        );

      } catch (error) {

        console.error(
          "Error cargando pacientes:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudieron cargar los pacientes.",
        });

      } finally {

        setCargando(false);
      }
    };


  // ===================================================
  // OCULTAR MENSAJE
  // ===================================================

  useEffect(() => {

    if (!mensaje) {
      return;
    }


    const temporizador =
      window.setTimeout(
        () => {
          setMensaje(null);
        },
        5000
      );


    return () => {
      window.clearTimeout(
        temporizador
      );
    };

  }, [mensaje]);


  // ===================================================
  // HU-10
  // PACIENTES FILTRADOS
  // ===================================================

  const pacientesFiltrados =
    useMemo(() => {

      const texto =
        busqueda
          .trim()
          .toLowerCase();


      return pacientes.filter(
        (paciente) => {

          // ---------------------------------------------
          // FILTRO POR FECHA DE NACIMIENTO
          // ---------------------------------------------

          const coincideFecha =
            fechaFiltro === "" ||
            paciente.fechaNacimiento ===
              fechaFiltro;


          if (!coincideFecha) {
            return false;
          }


          // ---------------------------------------------
          // SIN TEXTO
          // ---------------------------------------------

          if (texto === "") {
            return true;
          }


          // ---------------------------------------------
          // VALORES
          // ---------------------------------------------

          const nombres =
            normalizarTexto(
              paciente.nombres
            );

          const apellidos =
            normalizarTexto(
              paciente.apellidos
            );

          const ci =
            normalizarTexto(
              paciente.ci
            );

          const telefono =
            normalizarTexto(
              paciente.telefono
            );

          const email =
            normalizarTexto(
              paciente.email
            );


          // ---------------------------------------------
          // FILTRO SEGÚN CAMPO
          // ---------------------------------------------

          switch (
            campoBusqueda
          ) {

            case "nombres":
              return nombres.includes(
                texto
              );

            case "apellidos":
              return apellidos.includes(
                texto
              );

            case "ci":
              return ci.includes(
                texto
              );

            case "telefono":
              return telefono.includes(
                texto
              );

            case "email":
              return email.includes(
                texto
              );

            default:
              return [
                nombres,
                apellidos,
                ci,
                telefono,
                email,
              ].some(
                (valor) =>
                  valor.includes(
                    texto
                  )
              );
          }
        }
      );

    }, [
      pacientes,
      busqueda,
      campoBusqueda,
      fechaFiltro,
    ]);


  // ===================================================
  // HU-10
  // LIMPIAR FILTROS
  // ===================================================

  const limpiarFiltros =
    () => {

      setBusqueda("");

      setCampoBusqueda(
        "todos"
      );

      setFechaFiltro("");
    };


  const filtrosActivos =
    busqueda.trim() !== "" ||
    fechaFiltro !== "" ||
    campoBusqueda !== "todos";


  // ===================================================
  // CAMBIO FORMULARIO
  // ===================================================

  const manejarCambio =
    (evento) => {

      const {
        name,
        value,
      } = evento.target;


      setFormulario(
        (actual) => ({
          ...actual,
          [name]: value,
        })
      );
    };


  // ===================================================
  // NUEVO PACIENTE
  // ===================================================

  const abrirNuevoPaciente =
    () => {

      if (!puedeCrear) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para registrar pacientes.",
        });

        return;
      }


      setFormulario(
        formularioInicial
      );

      setEditandoId(
        null
      );

      setPacienteSeleccionado(
        null
      );

      setModalFormulario(
        true
      );
    };


  // ===================================================
  // EDITAR
  // ===================================================

  const abrirEditarPaciente =
    (paciente) => {

      if (!puedeEditar) {

        setMensaje({
          tipo: "error",
          texto:
            "No tienes permiso para modificar pacientes.",
        });

        return;
      }


      setEditandoId(
        paciente.id
      );


      setPacienteSeleccionado(
        paciente
      );


      setFormulario({

        nombres:
          paciente.nombres ||
          "",

        apellidos:
          paciente.apellidos ||
          "",

        ci:
          paciente.ci ||
          "",

        fechaNacimiento:
          paciente.fechaNacimiento ||
          "",

        sexo:
          paciente.sexo ||
          "",

        telefono:
          paciente.telefono ||
          "",

        email:
          paciente.email ||
          "",

        direccion:
          paciente.direccion ||
          "",

        ciudad:
          paciente.ciudad ||
          "",

        alergias:
          Array.isArray(
            paciente.alergias
          )
            ? paciente.alergias.join(
                ", "
              )
            : "",

        enfermedadesPrevias:
          Array.isArray(
            paciente.enfermedadesPrevias
          )
            ? paciente.enfermedadesPrevias.join(
                ", "
              )
            : "",
      });


      setModalFormulario(
        true
      );
    };


  // ===================================================
  // VER DETALLE
  // ===================================================

  const abrirDetalle =
    (paciente) => {

      setPacienteSeleccionado(
        paciente
      );

      setModalDetalle(
        true
      );
    };


  // ===================================================
  // CERRAR FORMULARIO
  // ===================================================

  const cerrarFormulario =
    () => {

      if (guardando) {
        return;
      }


      setModalFormulario(
        false
      );

      setEditandoId(
        null
      );

      setPacienteSeleccionado(
        null
      );

      setFormulario(
        formularioInicial
      );
    };


  // ===================================================
  // CERRAR DETALLE
  // ===================================================

  const cerrarDetalle =
    () => {

      setModalDetalle(
        false
      );

      setPacienteSeleccionado(
        null
      );
    };


  // ===================================================
  // VALIDAR
  // ===================================================

  const validarFormulario =
    () => {

      if (
        formulario.nombres.trim() ===
        ""
      ) {
        return "Los nombres son obligatorios.";
      }


      if (
        formulario.apellidos.trim() ===
        ""
      ) {
        return "Los apellidos son obligatorios.";
      }


      if (
        formulario.ci.trim() ===
        ""
      ) {
        return "El CI es obligatorio.";
      }


      if (
        formulario.fechaNacimiento ===
        ""
      ) {
        return "La fecha de nacimiento es obligatoria.";
      }


      if (
        formulario.sexo ===
        ""
      ) {
        return "Debe seleccionar el sexo.";
      }


      const fecha =
        new Date(
          `${formulario.fechaNacimiento}T00:00:00`
        );


      if (
        Number.isNaN(
          fecha.getTime()
        )
      ) {
        return "La fecha de nacimiento no es válida.";
      }


      const hoy =
        new Date();


      hoy.setHours(
        0,
        0,
        0,
        0
      );


      if (
        fecha >
        hoy
      ) {
        return "La fecha de nacimiento no puede ser futura.";
      }


      if (
        formulario.email.trim() !==
          "" &&
        !validarEmail(
          formulario.email
        )
      ) {
        return "El correo electrónico no es válido.";
      }


      return "";
    };


  // ===================================================
  // GUARDAR
  // ===================================================

  const guardarPaciente =
    async (evento) => {

      evento.preventDefault();

      setMensaje(null);


      const error =
        validarFormulario();


      if (error) {

        setMensaje({
          tipo: "error",
          texto:
            error,
        });

        return;
      }


      const datos = {

        nombres:
          formulario.nombres,

        apellidos:
          formulario.apellidos,

        ci:
          formulario.ci,

        fechaNacimiento:
          formulario.fechaNacimiento,

        sexo:
          formulario.sexo,

        telefono:
          formulario.telefono,

        email:
          formulario.email,

        direccion:
          formulario.direccion,

        ciudad:
          formulario.ciudad,

        alergias:
          textoALista(
            formulario.alergias
          ),

        enfermedadesPrevias:
          textoALista(
            formulario.enfermedadesPrevias
          ),
      };


      try {

        setGuardando(true);


        if (editandoId) {

          if (!puedeEditar) {
            throw new Error(
              "No tienes permiso para modificar pacientes."
            );
          }


          await actualizarPaciente(
            editandoId,
            usuario.laboratorioId,
            datos
          );


          setMensaje({
            tipo: "exito",
            texto:
              "Paciente actualizado correctamente.",
          });

        } else {

          if (!puedeCrear) {
            throw new Error(
              "No tienes permiso para registrar pacientes."
            );
          }


          await crearPaciente(
            usuario.laboratorioId,
            datos
          );


          setMensaje({
            tipo: "exito",
            texto:
              "Paciente registrado correctamente.",
          });
        }


        setModalFormulario(
          false
        );

        setEditandoId(
          null
        );

        setPacienteSeleccionado(
          null
        );

        setFormulario(
          formularioInicial
        );


        await cargarPacientes();

      } catch (error) {

        console.error(
          "Error guardando paciente:",
          error
        );


        setMensaje({
          tipo: "error",
          texto:
            error?.message ||
            "No se pudo guardar el paciente.",
        });

      } finally {

        setGuardando(
          false
        );
      }
    };


  // ===================================================
  // CARGANDO
  // ===================================================

  if (cargando) {

    return (
      <main className="gp-page gp-loading-page">

        <div className="gp-loading-card">

          <div className="gp-spinner" />

          <h2>
            Gestión de pacientes
          </h2>

          <p>
            Cargando pacientes del laboratorio...
          </p>

        </div>

      </main>
    );
  }


  // ===================================================
  // HU-11 - HISTORIAL DEL PACIENTE
  // ===================================================

  if (pacienteHistorial) {

    return (
      <HistorialPaciente
        paciente={
          pacienteHistorial
        }
        usuario={
          usuario
        }
        permisos={
          permisos
        }
        volver={() =>
          setPacienteHistorial(
            null
          )
        }
      />
    );
  }


  // ===================================================
  // UI
  // ===================================================

  return (
    <main className="gp-page">

      {/* ===============================================
          CABECERA
      =============================================== */}

      <header className="gp-header">

        <div className="gp-header-info">

          <button
            type="button"
            className="gp-back-button"
            onClick={() => {
              if (
                typeof volver ===
                "function"
              ) {
                volver();
              }
            }}
          >
            ← Volver
          </button>


          <span className="gp-eyebrow">
            PACIENTES
          </span>


          <h1>
            Gestión de pacientes
          </h1>


          <p>
            Registra, consulta, actualiza y encuentra rápidamente pacientes de tu laboratorio.
          </p>

        </div>


        <div className="gp-header-actions">

          <div className="gp-header-icon">
            🧑‍⚕️
          </div>


          {puedeCrear && (
            <button
              type="button"
              className="gp-new-button"
              onClick={
                abrirNuevoPaciente
              }
            >
              <span>
                +
              </span>

              Nuevo paciente
            </button>
          )}

        </div>

      </header>


      {/* ===============================================
          MENSAJE
      =============================================== */}

      {mensaje && (
        <div
          className={`gp-message ${
            mensaje.tipo ===
            "error"
              ? "gp-message-error"
              : "gp-message-success"
          }`}
        >
          <span>
            {mensaje.tipo ===
            "error"
              ? "!"
              : "✓"}
          </span>

          {mensaje.texto}
        </div>
      )}


      {/* ===============================================
          ESTADÍSTICAS
      =============================================== */}

      <section className="gp-stats">

        <article className="gp-stat-card">

          <div className="gp-stat-icon gp-stat-blue">
            👥
          </div>

          <div>
            <span>
              TOTAL PACIENTES
            </span>

            <strong>
              {pacientes.length}
            </strong>
          </div>

        </article>


        <article className="gp-stat-card">

          <div className="gp-stat-icon gp-stat-green">
            🔎
          </div>

          <div>
            <span>
              RESULTADOS
            </span>

            <strong>
              {pacientesFiltrados.length}
            </strong>
          </div>

        </article>


        <article className="gp-stat-card">

          <div className="gp-stat-icon gp-stat-purple">
            ✓
          </div>

          <div>
            <span>
              ESTADO DEL MÓDULO
            </span>

            <strong className="gp-stat-text">
              Activo
            </strong>
          </div>

        </article>

      </section>


      {/* ===============================================
          HU-10 - BÚSQUEDA Y FILTROS
      =============================================== */}

      <section className="gp-filter-card">

        <div className="gp-filter-title">

          <div>

            <span>
              BÚSQUEDA
            </span>

            <h2>
              Buscar pacientes
            </h2>

            <p>
              Puedes buscar por nombre, apellido, CI, teléfono, correo o fecha de nacimiento.
            </p>

          </div>


          {filtrosActivos && (
            <button
              type="button"
              className="gp-clear-button"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar filtros
            </button>
          )}

        </div>


        <div className="gp-filter-grid">

          {/* CAMPO */}

          <div className="gp-filter-field">

            <label>
              Buscar por
            </label>

            <select
              value={
                campoBusqueda
              }
              onChange={(
                evento
              ) =>
                setCampoBusqueda(
                  evento.target.value
                )
              }
            >
              <option value="todos">
                Todos los campos
              </option>

              <option value="nombres">
                Nombres
              </option>

              <option value="apellidos">
                Apellidos
              </option>

              <option value="ci">
                CI / Carnet
              </option>

              <option value="telefono">
                Teléfono
              </option>

              <option value="email">
                Correo
              </option>
            </select>

          </div>


          {/* TEXTO */}

          <div className="gp-filter-field gp-search-field">

            <label>
              Texto de búsqueda
            </label>

            <div className="gp-search-input">

              <span>
                🔎
              </span>

              <input
                type="text"
                value={
                  busqueda
                }
                onChange={(
                  evento
                ) =>
                  setBusqueda(
                    evento.target.value
                  )
                }
                placeholder={
                  obtenerPlaceholder(
                    campoBusqueda
                  )
                }
              />

              {busqueda !== "" && (
                <button
                  type="button"
                  onClick={() =>
                    setBusqueda("")
                  }
                  title="Limpiar búsqueda"
                >
                  ×
                </button>
              )}

            </div>

          </div>


          {/* FECHA */}

          <div className="gp-filter-field">

            <label>
              Fecha de nacimiento
            </label>

            <input
              type="date"
              value={
                fechaFiltro
              }
              max={
                obtenerFechaActual()
              }
              onChange={(
                evento
              ) =>
                setFechaFiltro(
                  evento.target.value
                )
              }
            />

          </div>

        </div>


        {filtrosActivos && (
          <div className="gp-filter-summary">

            Mostrando{" "}

            <strong>
              {
                pacientesFiltrados.length
              }
            </strong>

            {" "}
            de{" "}

            <strong>
              {pacientes.length}
            </strong>

            {" "}
            pacientes.

          </div>
        )}

      </section>


      {/* ===============================================
          TABLA
      =============================================== */}

      <section className="gp-table-card">

        <div className="gp-table-header">

          <div>

            <h2>
              Pacientes registrados
            </h2>

            <p>
              La tabla muestra los datos principales. Usa Ver detalle para consultar toda la información.
            </p>

          </div>


          <span className="gp-result-count">

            {
              pacientesFiltrados.length
            }{" "}

            {
              pacientesFiltrados.length ===
              1
                ? "paciente"
                : "pacientes"
            }

          </span>

        </div>


        {/* =============================================
            SIN PACIENTES
        ============================================= */}

        {pacientes.length ===
        0 ? (

          <div className="gp-empty">

            <div className="gp-empty-icon">
              🧑‍⚕️
            </div>

            <h3>
              No existen pacientes registrados
            </h3>

            <p>
              Registra el primer paciente de este laboratorio.
            </p>


            {puedeCrear && (
              <button
                type="button"
                className="gp-new-button"
                onClick={
                  abrirNuevoPaciente
                }
              >
                + Nuevo paciente
              </button>
            )}

          </div>

        ) : pacientesFiltrados.length ===
        0 ? (

          /* ===========================================
             HU-10 - SIN COINCIDENCIAS
          =========================================== */

          <div className="gp-empty">

            <div className="gp-empty-icon">
              🔎
            </div>

            <h3>
              No se encontraron coincidencias
            </h3>

            <p>
              Intenta cambiar el texto de búsqueda o limpiar los filtros aplicados.
            </p>


            <button
              type="button"
              className="gp-secondary-button"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar filtros
            </button>

          </div>

        ) : (

          <div className="gp-table-wrapper">

            <table className="gp-table">

              <thead>

                <tr>

                  <th>
                    Paciente
                  </th>

                  <th>
                    CI
                  </th>

                  <th>
                    Fecha nacimiento
                  </th>

                  <th>
                    Teléfono
                  </th>

                  <th>
                    Acciones
                  </th>

                </tr>

              </thead>


              <tbody>

                {pacientesFiltrados.map(
                  (paciente) => (

                    <tr
                      key={
                        paciente.id
                      }
                    >

                      <td>

                        <div className="gp-patient-cell">

                          <div className="gp-avatar">

                            {obtenerIniciales(
                              paciente
                            )}

                          </div>


                          <div className="gp-patient-name">

                            <strong>

                              {
                                paciente.nombres
                              }{" "}

                              {
                                paciente.apellidos
                              }

                            </strong>


                            <span>

                              {
                                paciente.email ||
                                "Sin correo registrado"
                              }

                            </span>

                          </div>

                        </div>

                      </td>


                      <td>

                        <strong className="gp-ci">
                          {paciente.ci}
                        </strong>

                      </td>


                      <td>

                        {formatearFecha(
                          paciente.fechaNacimiento
                        )}

                      </td>


                      <td>

                        {paciente.telefono ||
                          "Sin teléfono"}

                      </td>


                      <td>

                        <div className="gp-actions">

                          <button
                            type="button"
                            className="gp-action gp-detail-button"
                            onClick={() =>
                              abrirDetalle(
                                paciente
                              )
                            }
                          >
                            Ver detalle
                          </button>


                          {puedeVerHistorial && (
                            <button
                              type="button"
                              className="gp-action gp-history-button"
                              onClick={() =>
                                setPacienteHistorial(
                                  paciente
                                )
                              }
                            >
                              Historial
                            </button>
                          )}


                          {puedeEditar && (
                            <button
                              type="button"
                              className="gp-action gp-edit-button"
                              onClick={() =>
                                abrirEditarPaciente(
                                  paciente
                                )
                              }
                            >
                              Editar
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>


      {/* ===============================================
          MODAL CREAR / EDITAR
      =============================================== */}

      {modalFormulario && (
        <div
          className="gp-modal-overlay"
          onMouseDown={(
            evento
          ) => {

            if (
              evento.target ===
                evento.currentTarget &&
              !guardando
            ) {
              cerrarFormulario();
            }
          }}
        >

          <div className="gp-modal gp-form-modal">

            <div className="gp-modal-header">

              <div>

                <span className="gp-modal-eyebrow">

                  {editandoId
                    ? "ACTUALIZAR"
                    : "NUEVO REGISTRO"}

                </span>


                <h2>

                  {editandoId
                    ? "Editar paciente"
                    : "Registrar paciente"}

                </h2>


                <p>
                  Completa la información del paciente.
                </p>

              </div>


              <button
                type="button"
                className="gp-modal-close"
                onClick={
                  cerrarFormulario
                }
                disabled={
                  guardando
                }
              >
                ×
              </button>

            </div>


            <form
              className="gp-form"
              onSubmit={
                guardarPaciente
              }
            >

              {/* ===========================================
                  DATOS PERSONALES
              =========================================== */}

              <section className="gp-form-section">

                <div className="gp-form-section-title">

                  <div className="gp-section-icon gp-section-blue">
                    👤
                  </div>

                  <div>

                    <h3>
                      Datos personales
                    </h3>

                    <p>
                      Información básica de identificación.
                    </p>

                  </div>

                </div>


                <div className="gp-form-grid">

                  <Campo
                    label="Nombres"
                    obligatorio
                  >
                    <input
                      type="text"
                      name="nombres"
                      value={
                        formulario.nombres
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="80"
                      placeholder="Ej. Juan Carlos"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>


                  <Campo
                    label="Apellidos"
                    obligatorio
                  >
                    <input
                      type="text"
                      name="apellidos"
                      value={
                        formulario.apellidos
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="80"
                      placeholder="Ej. Pérez López"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>


                  <Campo
                    label="CI / Carnet"
                    obligatorio
                  >
                    <input
                      type="text"
                      name="ci"
                      value={
                        formulario.ci
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="25"
                      placeholder="Ej. 1234567"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>


                  <Campo
                    label="Fecha de nacimiento"
                    obligatorio
                  >
                    <input
                      type="date"
                      name="fechaNacimiento"
                      value={
                        formulario.fechaNacimiento
                      }
                      onChange={
                        manejarCambio
                      }
                      max={
                        obtenerFechaActual()
                      }
                      disabled={
                        guardando
                      }
                    />
                  </Campo>


                  <Campo
                    label="Sexo"
                    obligatorio
                  >

                    <select
                      name="sexo"
                      value={
                        formulario.sexo
                      }
                      onChange={
                        manejarCambio
                      }
                      disabled={
                        guardando
                      }
                    >

                      <option value="">
                        Seleccionar
                      </option>

                      <option value="Femenino">
                        Femenino
                      </option>

                      <option value="Masculino">
                        Masculino
                      </option>

                      <option value="Otro">
                        Otro
                      </option>

                    </select>

                  </Campo>


                  <Campo
                    label="Ciudad"
                  >
                    <input
                      type="text"
                      name="ciudad"
                      value={
                        formulario.ciudad
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="80"
                      placeholder="Ej. Cochabamba"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>

                </div>

              </section>


              {/* ===========================================
                  CONTACTO
              =========================================== */}

              <section className="gp-form-section">

                <div className="gp-form-section-title">

                  <div className="gp-section-icon gp-section-green">
                    ☎
                  </div>

                  <div>

                    <h3>
                      Contacto
                    </h3>

                    <p>
                      Información de contacto del paciente.
                    </p>

                  </div>

                </div>


                <div className="gp-form-grid">

                  <Campo
                    label="Teléfono"
                  >
                    <input
                      type="tel"
                      name="telefono"
                      value={
                        formulario.telefono
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="25"
                      placeholder="Ej. 70707070"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>


                  <Campo
                    label="Correo electrónico"
                  >
                    <input
                      type="email"
                      name="email"
                      value={
                        formulario.email
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="120"
                      placeholder="paciente@correo.com"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>


                  <Campo
                    label="Dirección"
                    full
                  >
                    <input
                      type="text"
                      name="direccion"
                      value={
                        formulario.direccion
                      }
                      onChange={
                        manejarCambio
                      }
                      maxLength="180"
                      placeholder="Ej. Av. América N° 123"
                      disabled={
                        guardando
                      }
                    />
                  </Campo>

                </div>

              </section>


              {/* ===========================================
                  INFORMACIÓN CLÍNICA
              =========================================== */}

              <section className="gp-form-section">

                <div className="gp-form-section-title">

                  <div className="gp-section-icon gp-section-purple">
                    🩺
                  </div>

                  <div>

                    <h3>
                      Información clínica
                    </h3>

                    <p>
                      Antecedentes declarados por el paciente.
                    </p>

                  </div>

                </div>


                <div className="gp-form-grid">

                  <Campo
                    label="Alergias"
                  >

                    <textarea
                      name="alergias"
                      value={
                        formulario.alergias
                      }
                      onChange={
                        manejarCambio
                      }
                      rows="4"
                      placeholder="Ej. Penicilina, polen, mariscos"
                      disabled={
                        guardando
                      }
                    />

                    <small>
                      Separa cada alergia con una coma.
                    </small>

                  </Campo>


                  <Campo
                    label="Enfermedades previas"
                  >

                    <textarea
                      name="enfermedadesPrevias"
                      value={
                        formulario.enfermedadesPrevias
                      }
                      onChange={
                        manejarCambio
                      }
                      rows="4"
                      placeholder="Ej. Diabetes, hipertensión"
                      disabled={
                        guardando
                      }
                    />

                    <small>
                      Separa cada enfermedad con una coma.
                    </small>

                  </Campo>

                </div>

              </section>


              <div className="gp-form-actions">

                <button
                  type="button"
                  className="gp-secondary-button"
                  onClick={
                    cerrarFormulario
                  }
                  disabled={
                    guardando
                  }
                >
                  Cancelar
                </button>


                <button
                  type="submit"
                  className="gp-primary-button"
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? "Guardando..."
                    : editandoId
                      ? "Guardar cambios"
                      : "Registrar paciente"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ===============================================
          MODAL DETALLE
      =============================================== */}

      {modalDetalle &&
        pacienteSeleccionado && (

          <div
            className="gp-modal-overlay"
            onMouseDown={(
              evento
            ) => {

              if (
                evento.target ===
                evento.currentTarget
              ) {
                cerrarDetalle();
              }
            }}
          >

            <div className="gp-modal gp-detail-modal">

              <div className="gp-modal-header">

                <div>

                  <span className="gp-modal-eyebrow">
                    INFORMACIÓN COMPLETA
                  </span>

                  <h2>
                    Detalle del paciente
                  </h2>

                  <p>
                    Consulta todos los datos registrados.
                  </p>

                </div>


                <button
                  type="button"
                  className="gp-modal-close"
                  onClick={
                    cerrarDetalle
                  }
                >
                  ×
                </button>

              </div>


              <div className="gp-detail-profile">

                <div className="gp-detail-avatar">

                  {obtenerIniciales(
                    pacienteSeleccionado
                  )}

                </div>


                <div>

                  <h3>

                    {
                      pacienteSeleccionado.nombres
                    }{" "}

                    {
                      pacienteSeleccionado.apellidos
                    }

                  </h3>


                  <span>

                    CI:{" "}

                    {
                      pacienteSeleccionado.ci
                    }

                  </span>

                </div>

              </div>


              <div className="gp-detail-grid">

                <DetalleItem
                  titulo="Nombres"
                  valor={
                    pacienteSeleccionado.nombres
                  }
                />


                <DetalleItem
                  titulo="Apellidos"
                  valor={
                    pacienteSeleccionado.apellidos
                  }
                />


                <DetalleItem
                  titulo="CI / Carnet"
                  valor={
                    pacienteSeleccionado.ci
                  }
                />


                <DetalleItem
                  titulo="Fecha de nacimiento"
                  valor={
                    formatearFecha(
                      pacienteSeleccionado.fechaNacimiento
                    )
                  }
                />


                <DetalleItem
                  titulo="Edad"
                  valor={
                    calcularEdad(
                      pacienteSeleccionado.fechaNacimiento
                    )
                  }
                />


                <DetalleItem
                  titulo="Sexo"
                  valor={
                    pacienteSeleccionado.sexo
                  }
                />


                <DetalleItem
                  titulo="Teléfono"
                  valor={
                    pacienteSeleccionado.telefono
                  }
                />


                <DetalleItem
                  titulo="Correo"
                  valor={
                    pacienteSeleccionado.email
                  }
                />


                <DetalleItem
                  titulo="Ciudad"
                  valor={
                    pacienteSeleccionado.ciudad
                  }
                />


                <DetalleItem
                  titulo="Dirección"
                  valor={
                    pacienteSeleccionado.direccion
                  }
                  full
                />


                <DetalleItem
                  titulo="Alergias"
                  valor={
                    listaATexto(
                      pacienteSeleccionado.alergias
                    )
                  }
                  full
                />


                <DetalleItem
                  titulo="Enfermedades previas"
                  valor={
                    listaATexto(
                      pacienteSeleccionado.enfermedadesPrevias
                    )
                  }
                  full
                />


                <DetalleItem
                  titulo="Fecha de registro"
                  valor={
                    formatearTimestamp(
                      pacienteSeleccionado.fechaRegistro
                    )
                  }
                  full
                />

              </div>


              <div className="gp-modal-footer">

                <button
                  type="button"
                  className="gp-secondary-button"
                  onClick={
                    cerrarDetalle
                  }
                >
                  Cerrar
                </button>


                {puedeEditar && (
                  <button
                    type="button"
                    className="gp-primary-button"
                    onClick={() => {

                      const paciente =
                        pacienteSeleccionado;


                      setModalDetalle(
                        false
                      );


                      abrirEditarPaciente(
                        paciente
                      );
                    }}
                  >
                    Editar paciente
                  </button>
                )}

              </div>

            </div>

          </div>
        )}

    </main>
  );
}


// =====================================================
// CAMPO
// =====================================================

function Campo({
  label,
  obligatorio = false,
  full = false,
  children,
}) {

  return (
    <div
      className={`gp-field ${
        full
          ? "gp-field-full"
          : ""
      }`}
    >

      <label>

        {label}

        {obligatorio && (
          <span className="gp-required">
            *
          </span>
        )}

      </label>

      {children}

    </div>
  );
}


// =====================================================
// DETALLE
// =====================================================

function DetalleItem({
  titulo,
  valor,
  full = false,
}) {

  return (
    <div
      className={`gp-detail-item ${
        full
          ? "gp-detail-full"
          : ""
      }`}
    >

      <span>
        {titulo}
      </span>

      <strong>

        {valor ||
          "Sin información"}

      </strong>

    </div>
  );
}


// =====================================================
// NORMALIZAR TEXTO PARA BÚSQUEDA
// =====================================================

function normalizarTexto(
  valor
) {

  return String(
    valor || ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}


// =====================================================
// PLACEHOLDER
// =====================================================

function obtenerPlaceholder(
  campo
) {

  switch (campo) {

    case "nombres":
      return "Buscar por nombres...";

    case "apellidos":
      return "Buscar por apellidos...";

    case "ci":
      return "Buscar por CI...";

    case "telefono":
      return "Buscar por teléfono...";

    case "email":
      return "Buscar por correo...";

    default:
      return "Nombre, apellido, CI, teléfono o correo...";
  }
}


// =====================================================
// TEXTO -> ARRAY
// =====================================================

function textoALista(
  texto
) {

  if (
    typeof texto !==
      "string" ||
    texto.trim() ===
      ""
  ) {
    return [];
  }


  return texto
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}


// =====================================================
// ARRAY -> TEXTO
// =====================================================

function listaATexto(
  lista
) {

  if (
    !Array.isArray(lista) ||
    lista.length ===
      0
  ) {
    return "Ninguna registrada";
  }


  return lista.join(
    ", "
  );
}


// =====================================================
// EMAIL
// =====================================================

function validarEmail(
  email
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email.trim()
  );
}


// =====================================================
// FECHA ACTUAL
// =====================================================

function obtenerFechaActual() {

  const ahora =
    new Date();


  const year =
    ahora.getFullYear();


  const month =
    String(
      ahora.getMonth() +
      1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      ahora.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


// =====================================================
// FORMATEAR FECHA
// =====================================================

function formatearFecha(
  fecha
) {

  if (!fecha) {
    return "Sin información";
  }


  const partes =
    String(fecha).split(
      "-"
    );


  if (
    partes.length !==
    3
  ) {
    return fecha;
  }


  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}


// =====================================================
// EDAD
// =====================================================

function calcularEdad(
  fechaNacimiento
) {

  if (!fechaNacimiento) {
    return "Sin información";
  }


  const nacimiento =
    new Date(
      `${fechaNacimiento}T00:00:00`
    );


  if (
    Number.isNaN(
      nacimiento.getTime()
    )
  ) {
    return "Sin información";
  }


  const hoy =
    new Date();


  let edad =
    hoy.getFullYear() -
    nacimiento.getFullYear();


  const diferenciaMes =
    hoy.getMonth() -
    nacimiento.getMonth();


  if (
    diferenciaMes < 0 ||
    (
      diferenciaMes === 0 &&
      hoy.getDate() <
        nacimiento.getDate()
    )
  ) {
    edad--;
  }


  return `${edad} años`;
}


// =====================================================
// TIMESTAMP
// =====================================================

function formatearTimestamp(
  valor
) {

  if (!valor) {
    return "Sin información";
  }


  try {

    if (
      typeof valor.toDate ===
      "function"
    ) {

      return valor
        .toDate()
        .toLocaleString(
          "es-BO"
        );
    }


    if (
      valor.seconds
    ) {

      return new Date(
        valor.seconds *
        1000
      ).toLocaleString(
        "es-BO"
      );
    }


    return String(valor);

  } catch {

    return "Sin información";
  }
}


// =====================================================
// INICIALES
// =====================================================

function obtenerIniciales(
  paciente
) {

  const nombre =
    paciente?.nombres
      ?.trim()
      ?.charAt(0) ||
    "";


  const apellido =
    paciente?.apellidos
      ?.trim()
      ?.charAt(0) ||
    "";


  return (
    `${nombre}${apellido}`
      .toUpperCase() ||
    "P"
  );
}


export default GestionPacientes;