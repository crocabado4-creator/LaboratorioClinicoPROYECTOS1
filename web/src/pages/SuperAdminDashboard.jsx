import { useState } from "react";
import "./SuperAdminDashboard.css";


function SuperAdminDashboard({
  usuario,
  onLogout,
  onNavigate,
}) {
  // =====================================================
  // ESTADOS
  // =====================================================

  const [
    menuAbierto,
    setMenuAbierto,
  ] = useState(false);


  // =====================================================
  // NOMBRE DEL SUPER ADMIN
  // =====================================================

  const nombreCompleto =
    `${usuario?.nombre || "Super"} ${
      usuario?.apellido || "Administrador"
    }`.trim();


  // =====================================================
  // NAVEGAR ENTRE MÓDULOS
  // =====================================================

  const navegar = (
    modulo
  ) => {
    setMenuAbierto(
      false
    );


    if (
      typeof onNavigate ===
      "function"
    ) {
      onNavigate(
        modulo
      );
    }
  };


  // =====================================================
  // CERRAR SESIÓN
  // =====================================================

  const cerrarSesion =
    () => {
      if (
        typeof onLogout ===
        "function"
      ) {
        onLogout();
      }
    };


  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <div className="super-admin-layout">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`super-sidebar ${
          menuAbierto
            ? "super-sidebar-abierto"
            : ""
        }`}
      >

        {/* ===============================================
            LOGO
        =============================================== */}

        <div className="sidebar-logo">

          <div className="logo-icono">
            ✚
          </div>


          <div className="logo-textos">

            <h2>
              ClinicalLab
            </h2>


            <span>
              Super Administración
            </span>

          </div>

        </div>


        <div className="sidebar-separador" />


        {/* ===============================================
            PRINCIPAL
        =============================================== */}

        <p className="sidebar-seccion">
          PRINCIPAL
        </p>


        <nav className="sidebar-nav">

          {/* DASHBOARD */}

          <button
            type="button"
            className="sidebar-item activo"
            onClick={() =>
              navegar(
                "dashboard"
              )
            }
          >
            <span className="sidebar-icono">
              🏠
            </span>

            Dashboard
          </button>


          {/* =============================================
              HU-04
              LABORATORIOS
          ============================================= */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() =>
              navegar(
                "laboratorios"
              )
            }
          >
            <span className="sidebar-icono">
              🏥
            </span>

            Laboratorios
          </button>


          {/* =============================================
              HU-06
              PERSONALIZACIÓN
          ============================================= */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() =>
              navegar(
                "personalizacion"
              )
            }
          >
            <span className="sidebar-icono">
              🎨
            </span>

            Personalización
          </button>


          {/* =============================================
              HU-07
              ADMINISTRADORES
          ============================================= */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() =>
              navegar(
                "administradores"
              )
            }
          >
            <span className="sidebar-icono">
              👤
            </span>

            Administradores
          </button>


          {/* USUARIOS */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() =>
              navegar(
                "usuarios"
              )
            }
          >
            <span className="sidebar-icono">
              👥
            </span>

            Usuarios
          </button>


          {/* =============================================
              SISTEMA
          ============================================= */}

          <p
            className="
              sidebar-seccion
              sidebar-seccion-segunda
            "
          >
            SISTEMA
          </p>


          {/* ROLES */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() =>
              navegar(
                "roles"
              )
            }
          >
            <span className="sidebar-icono">
              🛡️
            </span>

            Roles y permisos
          </button>


          {/* AUDITORÍA */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() =>
              navegar(
                "auditoria"
              )
            }
          >
            <span className="sidebar-icono">
              📋
            </span>

            Auditoría global
          </button>

        </nav>


        {/* ===============================================
            USUARIO
        =============================================== */}

        <div className="sidebar-footer">

          <div className="sidebar-usuario">

            <div className="avatar">
              {nombreCompleto
                .charAt(0)
                .toUpperCase()}
            </div>


            <div className="sidebar-usuario-info">

              <strong>
                {nombreCompleto}
              </strong>


              <span>
                Super Administrador
              </span>

            </div>

          </div>


          <button
            type="button"
            className="boton-salir-sidebar"
            onClick={
              cerrarSesion
            }
          >
            ↪ Cerrar sesión
          </button>

        </div>

      </aside>


      {/* =================================================
          OVERLAY MÓVIL
      ================================================= */}

      {menuAbierto && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() =>
            setMenuAbierto(
              false
            )
          }
        />
      )}


      {/* =================================================
          CONTENIDO PRINCIPAL
      ================================================= */}

      <main className="super-main">

        {/* ===============================================
            TOPBAR
        =============================================== */}

        <header className="super-topbar">

          <div className="topbar-izquierda">

            <button
              type="button"
              className="boton-menu"
              onClick={() =>
                setMenuAbierto(
                  !menuAbierto
                )
              }
            >
              ☰
            </button>


            <div>

              <p className="topbar-ruta">
                Administración / Dashboard
              </p>


              <h1>
                Panel General
              </h1>

            </div>

          </div>


          <div className="topbar-derecha">

            <div className="estado-sistema">

              <span className="estado-punto" />

              Sistema activo
            </div>


            <div className="topbar-perfil">

              <div className="topbar-avatar">

                {nombreCompleto
                  .charAt(0)
                  .toUpperCase()}

              </div>


              <div className="topbar-perfil-info">

                <strong>
                  {nombreCompleto}
                </strong>


                <span>
                  Super Admin
                </span>

              </div>

            </div>

          </div>

        </header>


        {/* =================================================
            CONTENIDO
        ================================================= */}

        <section className="dashboard-contenido">

          {/* ===============================================
              HERO
          =============================================== */}

          <div className="dashboard-hero">

            <div
              className="
                hero-decoracion
                hero-circulo-1
              "
            />


            <div
              className="
                hero-decoracion
                hero-circulo-2
              "
            />


            <div className="hero-contenido">

              <span className="hero-etiqueta">
                PANEL DE CONTROL
              </span>


              <h2>
                Bienvenido,

                <span>
                  {" "}
                  {usuario?.nombre ||
                    "Super Admin"}
                </span>
              </h2>


              <p>
                Administra laboratorios,
                responsables e identidad visual
                desde un único panel.
              </p>


              <button
                type="button"
                className="hero-boton"
                onClick={() =>
                  navegar(
                    "laboratorios"
                  )
                }
              >
                Gestionar laboratorios

                <span>
                  →
                </span>
              </button>

            </div>


            <div className="hero-ilustracion">

              <div className="hero-icono-grande">
                🧪
              </div>


              <div
                className="
                  hero-mini-card
                  hero-mini-1
                "
              >
                ✓ Plataforma segura
              </div>


              <div
                className="
                  hero-mini-card
                  hero-mini-2
                "
              >
                ● En línea
              </div>

            </div>

          </div>


          {/* ===============================================
              TÍTULO MÓDULOS
          =============================================== */}

          <div className="seccion-cabecera">

            <div>

              <span className="seccion-eyebrow">
                GESTIÓN
              </span>


              <h2>
                Módulos administrativos
              </h2>


              <p>
                Selecciona el módulo que deseas gestionar.
              </p>

            </div>

          </div>


          {/* ===============================================
              TARJETAS
          =============================================== */}

          <div className="modulos-grid">

            {/* =============================================
                HU-04
                LABORATORIOS
            ============================================= */}

            <article
              className="
                modulo-card
                modulo-azul
              "
            >

              <div className="modulo-cabecera">

                <div className="modulo-icono">
                  🏥
                </div>


                <span className="modulo-estado">
                  Disponible
                </span>

              </div>


              <div className="modulo-contenido">

                <h3>
                  Gestión de Laboratorios
                </h3>


                <p>
                  Registra, consulta, modifica,
                  activa y desactiva laboratorios.
                </p>

              </div>


              <button
                type="button"
                className="modulo-boton"
                onClick={() =>
                  navegar(
                    "laboratorios"
                  )
                }
              >
                Abrir módulo

                <span>
                  →
                </span>
              </button>

            </article>


            {/* =============================================
                HU-06
                PERSONALIZACIÓN
            ============================================= */}

            <article
              className="
                modulo-card
                modulo-morado
              "
            >

              <div className="modulo-cabecera">

                <div className="modulo-icono">
                  🎨
                </div>


                <span className="modulo-estado">
                  Disponible
                </span>

              </div>


              <div className="modulo-contenido">

                <h3>
                  Personalización
                </h3>


                <p>
                  Configura nombre visible, logo
                  y colores de cada laboratorio.
                </p>

              </div>


              <button
                type="button"
                className="modulo-boton"
                onClick={() =>
                  navegar(
                    "personalizacion"
                  )
                }
              >
                Personalizar

                <span>
                  →
                </span>
              </button>

            </article>


            {/* =============================================
                HU-07
                ADMINISTRADORES
            ============================================= */}

            <article
              className="
                modulo-card
                modulo-morado
              "
            >

              <div className="modulo-cabecera">

                <div className="modulo-icono">
                  👤
                </div>


                <span className="modulo-estado">
                  Disponible
                </span>

              </div>


              <div className="modulo-contenido">

                <h3>
                  Administradores
                </h3>


                <p>
                  Gestiona los administradores
                  responsables de cada laboratorio.
                </p>

              </div>


              <button
                type="button"
                className="modulo-boton"
                onClick={() =>
                  navegar(
                    "administradores"
                  )
                }
              >
                Abrir módulo

                <span>
                  →
                </span>
              </button>

            </article>


            {/* =============================================
                USUARIOS
            ============================================= */}

            <article
              className="
                modulo-card
                modulo-turquesa
              "
            >

              <div className="modulo-cabecera">

                <div className="modulo-icono">
                  👥
                </div>


                <span className="modulo-estado">
                  Consulta
                </span>

              </div>


              <div className="modulo-contenido">

                <h3>
                  Usuarios
                </h3>


                <p>
                  Consulta los usuarios registrados
                  dentro de la plataforma.
                </p>

              </div>


              <button
                type="button"
                className="modulo-boton"
                onClick={() =>
                  navegar(
                    "usuarios"
                  )
                }
              >
                Ver información

                <span>
                  →
                </span>
              </button>

            </article>


            {/* =============================================
                ROLES
            ============================================= */}

            <article
              className="
                modulo-card
                modulo-indigo
              "
            >

              <div className="modulo-cabecera">

                <div className="modulo-icono">
                  🛡️
                </div>


                <span className="modulo-estado">
                  Sistema
                </span>

              </div>


              <div className="modulo-contenido">

                <h3>
                  Roles y permisos
                </h3>


                <p>
                  Consulta los permisos disponibles
                  según cada rol del sistema.
                </p>

              </div>


              <button
                type="button"
                className="modulo-boton"
                onClick={() =>
                  navegar(
                    "roles"
                  )
                }
              >
                Abrir módulo

                <span>
                  →
                </span>
              </button>

            </article>


            {/* =============================================
                AUDITORÍA
            ============================================= */}

            <article
              className="
                modulo-card
                modulo-naranja
              "
            >

              <div className="modulo-cabecera">

                <div className="modulo-icono">
                  📋
                </div>


                <span className="modulo-estado">
                  Consulta
                </span>

              </div>


              <div className="modulo-contenido">

                <h3>
                  Auditoría Global
                </h3>


                <p>
                  Consulta las actividades realizadas
                  dentro de la plataforma.
                </p>

              </div>


              <button
                type="button"
                className="modulo-boton"
                onClick={() =>
                  navegar(
                    "auditoria"
                  )
                }
              >
                Ver información

                <span>
                  →
                </span>
              </button>

            </article>

          </div>


          {/* ===============================================
              INFORMACIÓN INFERIOR
          =============================================== */}

          <div className="info-grid">

            {/* ESTADO */}

            <div className="actividad-card">

              <div className="actividad-header">

                <div>

                  <span className="seccion-eyebrow">
                    SISTEMA
                  </span>


                  <h3>
                    Estado de la plataforma
                  </h3>

                </div>


                <div className="actividad-icono">
                  ⚙️
                </div>

              </div>


              <div className="actividad-item">

                <div
                  className="
                    actividad-punto
                    azul-punto
                  "
                />


                <div>

                  <strong>
                    Gestión centralizada
                  </strong>


                  <p>
                    Administración general de
                    laboratorios.
                  </p>

                </div>

              </div>


              <div className="actividad-item">

                <div
                  className="
                    actividad-punto
                    verde-punto
                  "
                />


                <div>

                  <strong>
                    Seguridad activa
                  </strong>


                  <p>
                    Firebase Authentication y
                    Firestore conectados.
                  </p>

                </div>

              </div>


              {/* HU-06 */}

              <div className="actividad-item">

                <div
                  className="
                    actividad-punto
                    azul-punto
                  "
                />


                <div>

                  <strong>
                    Identidad por laboratorio
                  </strong>


                  <p>
                    Nombre, logo y colores pueden
                    configurarse individualmente.
                  </p>

                </div>

              </div>

            </div>


            {/* =============================================
                PERFIL SUPER ADMIN
            ============================================= */}

            <div className="perfil-card">

              <div className="perfil-fondo" />


              <div className="perfil-avatar-grande">

                {nombreCompleto
                  .charAt(0)
                  .toUpperCase()}

              </div>


              <h3>
                {nombreCompleto}
              </h3>


              <span className="perfil-rol">
                Super Administrador
              </span>


              <div className="perfil-datos">

                <div>

                  <span>
                    Correo
                  </span>


                  <strong>
                    {usuario?.email ||
                      "Sin correo"}
                  </strong>

                </div>


                <div>

                  <span>
                    Estado
                  </span>


                  <strong className="perfil-activo">
                    ● Activo
                  </strong>

                </div>


                <div>

                  <span>
                    Acceso
                  </span>


                  <strong>
                    Global
                  </strong>

                </div>

              </div>


              <button
                type="button"
                className="perfil-logout"
                onClick={
                  cerrarSesion
                }
              >
                Cerrar sesión
              </button>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


export default SuperAdminDashboard;