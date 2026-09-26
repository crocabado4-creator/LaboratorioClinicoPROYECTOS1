import { useState } from "react";
import "./SuperAdminDashboard.css";

function SuperAdminDashboard({
  usuario,
  onLogout,
  onNavigate,
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nombreCompleto =
    `${usuario?.nombre || "Super"} ${usuario?.apellido || "Administrador"}`.trim();

  // =====================================================
  // NAVEGACIÓN
  // =====================================================

  const navegar = (modulo) => {
    setMenuAbierto(false);

    if (typeof onNavigate === "function") {
      onNavigate(modulo);
    }
  };

  // =====================================================
  // CERRAR SESIÓN
  // =====================================================

  const cerrarSesion = () => {
    if (typeof onLogout === "function") {
      onLogout();
    }
  };

  // =====================================================
  // MÓDULOS DEL SUPER ADMIN
  // =====================================================

  const modulos = [
    {
      id: "laboratorios",
      icono: "🏥",
      titulo: "Gestión de Laboratorios",
      descripcion:
        "Registra, consulta, modifica, activa y desactiva laboratorios.",
      clase: "modulo-azul",
      estado: "Disponible",
      boton: "Abrir módulo",
    },
    {
      id: "personalizacion",
      icono: "🎨",
      titulo: "Personalización",
      descripcion:
        "Configura nombre visible, logo y colores de cada laboratorio.",
      clase: "modulo-morado",
      estado: "Disponible",
      boton: "Personalizar",
    },
    {
      id: "administradores",
      icono: "👤",
      titulo: "Administradores",
      descripcion:
        "Gestiona los administradores responsables de cada laboratorio.",
      clase: "modulo-morado",
      estado: "Disponible",
      boton: "Abrir módulo",
    },
    {
      id: "usuarios",
      icono: "👥",
      titulo: "Usuarios",
      descripcion:
        "Consulta los usuarios registrados dentro de la plataforma.",
      clase: "modulo-turquesa",
      estado: "Consulta",
      boton: "Ver información",
    },
    {
      id: "roles",
      icono: "🛡️",
      titulo: "Roles y permisos",
      descripcion:
        "Consulta los permisos disponibles según cada rol del sistema.",
      clase: "modulo-indigo",
      estado: "Sistema",
      boton: "Abrir módulo",
    },
    {
      id: "auditoria",
      icono: "📋",
      titulo: "Auditoría Global",
      descripcion:
        "Consulta las actividades realizadas dentro de la plataforma.",
      clase: "modulo-naranja",
      estado: "Consulta",
      boton: "Ver información",
    },
  ];

  return (
    <div className="super-admin-layout">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`super-sidebar ${
          menuAbierto ? "super-sidebar-abierto" : ""
        }`}
      >
        {/* LOGO */}

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

        {/* PRINCIPAL */}

        <p className="sidebar-seccion">
          PRINCIPAL
        </p>

        <nav className="sidebar-nav">

          {/* DASHBOARD */}

          <button
            type="button"
            className="sidebar-item activo"
            onClick={() => navegar("dashboard")}
          >
            <span className="sidebar-icono">
              🏠
            </span>

            Dashboard
          </button>

          {/* LABORATORIOS */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() => navegar("laboratorios")}
          >
            <span className="sidebar-icono">
              🏥
            </span>

            Laboratorios
          </button>

          {/* PERSONALIZACIÓN */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() => navegar("personalizacion")}
          >
            <span className="sidebar-icono">
              🎨
            </span>

            Personalización
          </button>

          {/* ADMINISTRADORES */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() => navegar("administradores")}
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
            onClick={() => navegar("usuarios")}
          >
            <span className="sidebar-icono">
              👥
            </span>

            Usuarios
          </button>

          {/* SISTEMA */}

          <p className="sidebar-seccion sidebar-seccion-segunda">
            SISTEMA
          </p>

          {/* ROLES */}

          <button
            type="button"
            className="sidebar-item"
            onClick={() => navegar("roles")}
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
            onClick={() => navegar("auditoria")}
          >
            <span className="sidebar-icono">
              📋
            </span>

            Auditoría global
          </button>
        </nav>

        {/* USUARIO */}

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
            onClick={cerrarSesion}
          >
            ↪ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* =====================================================
          OVERLAY MÓVIL
      ===================================================== */}

      {menuAbierto && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* =====================================================
          CONTENIDO PRINCIPAL
      ===================================================== */}

      <main className="super-main">

        {/* TOPBAR */}

        <header className="super-topbar">
          <div className="topbar-izquierda">
            <button
              type="button"
              className="boton-menu"
              aria-label="Abrir menú"
              onClick={() =>
                setMenuAbierto(!menuAbierto)
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

        {/* =====================================================
            CONTENIDO
        ===================================================== */}

        <section className="dashboard-contenido">

          {/* =================================================
              HERO
          ================================================= */}

          <div className="dashboard-hero">
            <div className="hero-decoracion hero-circulo-1" />

            <div className="hero-decoracion hero-circulo-2" />

            <div className="hero-contenido">
              <span className="hero-etiqueta">
                PANEL DE CONTROL
              </span>

              <h2>
                Bienvenido,
                <span>
                  {" "}
                  {usuario?.nombre || "Super Admin"}
                </span>
              </h2>

              <p>
                Administra laboratorios, responsables e identidad visual
                desde un único panel.
              </p>

              <button
                type="button"
                className="hero-boton"
                onClick={() => navegar("laboratorios")}
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

              <div className="hero-mini-card hero-mini-1">
                ✓ Plataforma segura
              </div>

              <div className="hero-mini-card hero-mini-2">
                ● En línea
              </div>
            </div>
          </div>

          {/* =================================================
              CABECERA DE MÓDULOS
          ================================================= */}

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

          {/* =================================================
              MÓDULOS
          ================================================= */}

          <div className="modulos-grid">
            {modulos.map((modulo) => (
              <article
                key={modulo.id}
                className={`modulo-card ${modulo.clase}`}
              >
                <div className="modulo-cabecera">
                  <div className="modulo-icono">
                    {modulo.icono}
                  </div>

                  <span className="modulo-estado">
                    {modulo.estado}
                  </span>
                </div>

                <div className="modulo-contenido">
                  <h3>
                    {modulo.titulo}
                  </h3>

                  <p>
                    {modulo.descripcion}
                  </p>
                </div>

                <button
                  type="button"
                  className="modulo-boton"
                  onClick={() =>
                    navegar(modulo.id)
                  }
                >
                  {modulo.boton}

                  <span>
                    →
                  </span>
                </button>
              </article>
            ))}
          </div>

          {/* =================================================
              INFORMACIÓN INFERIOR
          ================================================= */}

          <div className="info-grid">

            {/* ESTADO DE LA PLATAFORMA */}

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

              {/* GESTIÓN */}

              <div className="actividad-item">
                <div className="actividad-punto azul-punto" />

                <div>
                  <strong>
                    Gestión centralizada
                  </strong>

                  <p>
                    Administración general de laboratorios.
                  </p>
                </div>
              </div>

              {/* SEGURIDAD */}

              <div className="actividad-item">
                <div className="actividad-punto verde-punto" />

                <div>
                  <strong>
                    Seguridad activa
                  </strong>

                  <p>
                    Firebase Authentication y Firestore conectados.
                  </p>
                </div>
              </div>

              {/* PERSONALIZACIÓN */}

              <div className="actividad-item">
                <div className="actividad-punto azul-punto" />

                <div>
                  <strong>
                    Identidad por laboratorio
                  </strong>

                  <p>
                    Nombre, logo y colores pueden configurarse
                    individualmente.
                  </p>
                </div>
              </div>

              {/* LOGO DESDE ARCHIVO */}

              <div className="actividad-item">
                <div className="actividad-punto verde-punto" />

                <div>
                  <strong>
                    Logo personalizado
                  </strong>

                  <p>
                    Cada laboratorio puede utilizar su propia identidad
                    visual.
                  </p>
                </div>
              </div>
            </div>

            {/* =================================================
                PERFIL SUPER ADMIN
            ================================================= */}

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
                    {usuario?.email || "Sin correo"}
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
                onClick={cerrarSesion}
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