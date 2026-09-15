import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

function Login() {
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

      // 1. Validar correo y contraseña con Firebase Authentication
      const credencial = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Usamos el correo confirmado por Firebase Authentication
      const correoUsuario = credencial.user.email;

      // 2. Buscar el usuario que YA EXISTE en Firestore
      const consulta = query(
        collection(db, "usuarios"),
        where("email", "==", correoUsuario)
      );

      const resultado = await getDocs(consulta);

      // 3. Si Authentication existe pero no existe en nuestra colección usuarios
      if (resultado.empty) {
        await signOut(auth);
        setMensaje("El usuario no está registrado en el sistema.");
        return;
      }

      // 4. Recuperar datos del usuario existente
      const documento = resultado.docs[0];

      const usuario = {
        id: documento.id,
        ...documento.data(),
      };

      // 5. Verificar si el usuario está activo
      if (usuario.activo !== true) {
        await signOut(auth);
        setMensaje("El usuario se encuentra inactivo.");
        return;
      }

      // 6. Mostrar los datos recuperados para comprobar el funcionamiento
      console.log("Usuario autenticado:", usuario);
      console.log("ID:", usuario.id);
      console.log("Nombre:", usuario.nombre);
      console.log("Apellido:", usuario.apellido);
      console.log("Email:", usuario.email);
      console.log("Rol:", usuario.rol);
      console.log("Laboratorio ID:", usuario.laboratorioId);

      // 7. Guardar temporalmente datos del usuario en el navegador
      localStorage.setItem(
        "usuario",
        JSON.stringify({
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          rol: usuario.rol,
          laboratorioId: usuario.laboratorioId,
        })
      );

      setMensaje(
        `Bienvenido ${usuario.nombre} ${usuario.apellido}`
      );
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
          "Demasiados intentos fallidos. Intente nuevamente más tarde."
        );
      } else if (error.code === "auth/network-request-failed") {
        setMensaje("Error de conexión. Verifique su Internet.");
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