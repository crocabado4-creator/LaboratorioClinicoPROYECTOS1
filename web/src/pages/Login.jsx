import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "../firebase/firebase";
import "./Login.css";

function Login({
  mensajeExterno = "",
  onLimpiarMensaje,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mostrarPassword, setMostrarPassword] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [cargando, setCargando] =
    useState(false);

  const limpiarMensajes = () => {
    setMensaje("");

    if (
      typeof onLimpiarMensaje ===
      "function"
    ) {
      onLimpiarMensaje();
    }
  };

  const cambiarCorreo = (evento) => {
    setEmail(
      evento.target.value
    );

    limpiarMensajes();
  };

  const cambiarPassword = (evento) => {
    setPassword(
      evento.target.value
    );

    limpiarMensajes();
  };

  const iniciarSesion = async (
    evento
  ) => {
    evento.preventDefault();

    limpiarMensajes();

    const correo =
      email
        .trim()
        .toLowerCase();

    // =========================================
    // VALIDAR CAMPOS
    // =========================================

    if (
      correo === "" ||
      password === ""
    ) {
      setMensaje(
        "Ingrese su correo electrónico y contraseña."
      );

      return;
    }

    // =========================================
    // VALIDAR FORMATO DEL CORREO
    // =========================================

    const formatoCorreo =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !formatoCorreo.test(
        correo
      )
    ) {
      setMensaje(
        "Ingrese un correo electrónico válido."
      );

      return;
    }

    try {
      setCargando(true);

      // =======================================
      // FIREBASE AUTHENTICATION
      // =======================================

      await signInWithEmailAndPassword(
        auth,
        correo,
        password
      );

      /*
        No guardamos la contraseña.

        App.jsx detectará la sesión mediante
        onAuthStateChanged y comprobará:

        - usuario en Firestore
        - usuario activo
        - rol válido
        - verificación de correo
      */

      setPassword("");

    } catch (error) {
      console.error(
        "Error al iniciar sesión:",
        error
      );

      const codigo =
        error?.code || "";

      // =======================================
      // CREDENCIALES INCORRECTAS
      // =======================================

      if (
        codigo ===
          "auth/invalid-credential" ||
        codigo ===
          "auth/wrong-password" ||
        codigo ===
          "auth/user-not-found"
      ) {
        setMensaje(
          "Correo o contraseña incorrectos."
        );

        return;
      }

      // =======================================
      // CORREO INVÁLIDO
      // =======================================

      if (
        codigo ===
        "auth/invalid-email"
      ) {
        setMensaje(
          "El correo electrónico ingresado no es válido."
        );

        return;
      }

      // =======================================
      // MUCHOS INTENTOS
      // =======================================

      if (
        codigo ===
        "auth/too-many-requests"
      ) {
        setMensaje(
          "Se realizaron demasiados intentos incorrectos. El acceso fue restringido temporalmente. Intente nuevamente más tarde."
        );

        return;
      }

      // =======================================
      // USUARIO DESHABILITADO EN AUTH
      // =======================================

      if (
        codigo ===
        "auth/user-disabled"
      ) {
        setMensaje(
          "Esta cuenta se encuentra deshabilitada."
        );

        return;
      }

      // =======================================
      // ERROR DE INTERNET
      // =======================================

      if (
        codigo ===
        "auth/network-request-failed"
      ) {
        setMensaje(
          "No se pudo conectar con Firebase. Revise su conexión a Internet."
        );

        return;
      }

      // =======================================
      // ERROR GENERAL
      // =======================================

      setMensaje(
        "No se pudo iniciar sesión. Intente nuevamente."
      );

    } finally {
      setCargando(false);
    }
  };

  const mensajeVisible =
    mensaje ||
    mensajeExterno;

  return (
    <main className="login-page">

      {/* =====================================
          PANEL IZQUIERDO
      ===================================== */}

      <section className="login-brand">

        <div className="login-circle login-circle-one" />

        <div className="login-circle login-circle-two" />

        <div className="login-brand-content">

          <div className="login-logo">
            🧪
          </div>

          <span className="login-eyebrow">
            LABORATORIO CLÍNICO
          </span>

          <h1>
            Gestión clínica
            <span>
              {" "}segura y eficiente.
            </span>
          </h1>

          <p className="login-description">
            Plataforma integral para la
            administración de laboratorios
            clínicos con acceso seguro según
            rol y laboratorio.
          </p>

          <div className="login-features">

            <div className="login-feature">

              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>
                  Acceso seguro
                </strong>

                <span>
                  Autenticación mediante Firebase
                </span>
              </div>

            </div>


            <div className="login-feature">

              <div className="feature-icon">
                🛡
              </div>

              <div>
                <strong>
                  Roles y permisos
                </strong>

                <span>
                  Acceso según las funciones autorizadas
                </span>
              </div>

            </div>


            <div className="login-feature">

              <div className="feature-icon">
                🏥
              </div>

              <div>
                <strong>
                  Multi-laboratorio
                </strong>

                <span>
                  Información separada por laboratorio
                </span>
              </div>

            </div>

          </div>

        </div>


        <div className="login-security-card">

          <div className="security-icon">
            🔒
          </div>

          <div>
            <strong>
              Conexión protegida
            </strong>

            <span>
              Firebase Authentication
            </span>
          </div>

        </div>

      </section>


      {/* =====================================
          PANEL LOGIN
      ===================================== */}

      <section className="login-panel">

        <div className="login-panel-content">

          <div className="login-mobile-logo">
            🧪
          </div>

          <span className="form-eyebrow">
            ACCESO AL SISTEMA
          </span>

          <h2>
            Bienvenido
          </h2>

          <p className="login-subtitle">
            Ingrese sus credenciales para
            acceder a la plataforma.
          </p>


          {/* =================================
              MENSAJE ERROR
          ================================= */}

          {mensajeVisible && (
            <div className="login-alert">

              <div className="login-alert-icon">
                !
              </div>

              <div>
                <strong>
                  No se pudo iniciar sesión
                </strong>

                <span>
                  {mensajeVisible}
                </span>
              </div>

            </div>
          )}


          {/* =================================
              FORMULARIO
          ================================= */}

          <form
            className="login-form"
            onSubmit={
              iniciarSesion
            }
          >

            {/* CORREO */}

            <div className="login-field">

              <label
                htmlFor="email"
              >
                Correo electrónico
              </label>

              <div className="login-input-container">

                <span className="input-icon">
                  ✉
                </span>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={
                    cambiarCorreo
                  }
                  placeholder="usuario@correo.com"
                  autoComplete="email"
                  disabled={
                    cargando
                  }
                />

              </div>

            </div>


            {/* CONTRASEÑA */}

            <div className="login-field">

              <div className="password-label">

                <label
                  htmlFor="password"
                >
                  Contraseña
                </label>

                <span>
                  Acceso seguro
                </span>

              </div>


              <div className="login-input-container">

                <span className="input-icon">
                  🔒
                </span>

                <input
                  id="password"
                  type={
                    mostrarPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={
                    cambiarPassword
                  }
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  disabled={
                    cargando
                  }
                />


                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setMostrarPassword(
                      !mostrarPassword
                    )
                  }
                  disabled={
                    cargando
                  }
                  aria-label={
                    mostrarPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword
                    ? "🙈"
                    : "👁"}
                </button>

              </div>

            </div>


            {/* BOTÓN LOGIN */}

            <button
              type="submit"
              className="login-button"
              disabled={
                cargando
              }
            >

              {cargando ? (
                <>
                  <span className="login-spinner" />

                  Verificando...
                </>
              ) : (
                <>
                  Iniciar sesión

                  <span>
                    →
                  </span>
                </>
              )}

            </button>

          </form>


          {/* =================================
              SEGURIDAD
          ================================= */}

          <div className="login-information">

            <div className="information-icon">
              🛡
            </div>

            <p>
              Su contraseña es gestionada por
              <strong>
                {" "}Firebase Authentication
              </strong>{" "}
              y nunca se almacena como texto
              dentro de Firestore.
            </p>

          </div>


          <div className="login-footer">

            <span className="footer-status">
              <span className="status-dot" />
              Sistema operativo
            </span>

            <span>
              ClinicalLab
            </span>

          </div>

        </div>

      </section>

    </main>
  );
}

export default Login;