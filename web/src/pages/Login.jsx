import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (email.trim() === "" || password.trim() === "") {
      setMensaje("Debe completar el correo y la contraseña.");
      return;
    }

    try {
      setCargando(true);

      // 1. Autenticación
      const credencial = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const uid = credencial.user.uid;

      // 2. Buscar directamente usuarios/{UID}
      const usuarioRef = doc(db, "usuarios", uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        await signOut(auth);
        setMensaje("El usuario no está registrado en el sistema.");
        return;
      }

      const usuario = {
        id: usuarioSnap.id,
        ...usuarioSnap.data(),
      };

      // 3. Verificar usuario activo
      if (usuario.activo !== true) {
        await signOut(auth);
        setMensaje("El usuario se encuentra inactivo.");
        return;
      }

      const datosUsuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
        laboratorioId: usuario.laboratorioId,
      };

      localStorage.setItem(
        "usuario",
        JSON.stringify(datosUsuario)
      );

      onLogin(datosUsuario);

    } catch (error) {
      console.error("Error al iniciar sesión:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setMensaje("Correo o contraseña incorrectos.");
      } else if (error.code === "auth/invalid-email") {
        setMensaje("El correo electrónico no es válido.");
      } else if (error.code === "auth/user-disabled") {
        setMensaje("Esta cuenta fue deshabilitada.");
      } else if (error.code === "auth/too-many-requests") {
        setMensaje(
          "Demasiados intentos. Intente nuevamente más tarde."
        );
      } else if (error.code === "permission-denied") {
        setMensaje("No tiene permisos para consultar sus datos.");
      } else {
        setMensaje("No se pudo iniciar sesión.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <h1>Laboratorio Clínico</h1>
      <h2>Iniciar sesión</h2>

      <form onSubmit={iniciarSesion}>
        <div>
          <label htmlFor="email">Correo electrónico</label>

          <br />

          <input
            id="email"
            type="email"
            placeholder="Ingrese su correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={cargando}
          />
        </div>

        <br />

        <div>
          <label htmlFor="password">Contraseña</label>

          <br />

          <input
            id="password"
            type="password"
            placeholder="Ingrese su contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={cargando}
          />
        </div>

        <br />

        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      {mensaje !== "" && <p>{mensaje}</p>}
    </div>
  );
}

export default Login;